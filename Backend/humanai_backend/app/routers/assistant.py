from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.middleware.firebase_auth import get_current_user, CurrentUser, require_roles
from app.models.alert import AiInteraction, AiSecurityEvent, SecurityEventType, AlertSeverity
from app.models.rag import RagDocument, RagChunk, RagDocumentAccess
from app.redis_client import cache_get, cache_set, queue_push
from app.config import settings
from pydantic import BaseModel
from typing import Optional, List
import uuid, hashlib, json
from datetime import datetime

router = APIRouter(prefix="/assistant", tags=["Assistant IA"])

class ChatMessage(BaseModel):
    message: str
    session_id: Optional[str] = None

class FeedbackRequest(BaseModel):
    interaction_id: str
    rating: int  # 1 or -1
    comment: Optional[str] = None

SUGGESTED_QUESTIONS = {
    "collaborateur": ["Combien de jours de congé me restent ?", "Comment soumettre une demande d'absence ?", "Quelle est la politique de télétravail ?"],
    "manager": ["Quel est le taux d'absentéisme de mon équipe ?", "Comment initier un entretien annuel ?", "Qui est en congé cette semaine ?"],
    "rh": ["Quel est le turnover du mois ?", "Combien d'onboardings sont en cours ?", "Quelles alertes sont non résolues ?"],
    "direction": ["Quelle est l'évolution de la masse salariale ?", "Quel département a le plus fort taux de turnover ?"],
    "admin": ["Combien de tentatives d'accès refusées cette semaine ?", "Quel est l'état des queues BullMQ ?"],
    "qvt": ["Quels collaborateurs présentent un risque de burnout ?", "Quel est le score d'engagement moyen ?"],
}

def detect_prompt_injection(message: str) -> bool:
    patterns = ["ignore previous", "ignore les instructions", "system:", "oublie", "act as", "jailbreak", "DAN", "pretend you are"]
    return any(p.lower() in message.lower() for p in patterns)

@router.post("/chat")
async def chat(
    payload: ChatMessage,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    session_id = payload.session_id or str(uuid.uuid4())
    message = payload.message.strip()

    # Prompt injection detection
    if detect_prompt_injection(message):
        event = AiSecurityEvent(
            id=uuid.uuid4(),
            event_type=SecurityEventType.prompt_injection,
            severity=AlertSeverity.critique,
            created_at=datetime.utcnow(),
        )
        db.add(event)
        raise HTTPException(status_code=400, detail="Message non autorisé détecté")

    # Cache check
    cache_key = f"rag:query:{hashlib.sha256((message + user.role).encode()).hexdigest()}"
    cached = await cache_get(cache_key)
    if cached:
        return {"data": {"response": cached["response"], "session_id": session_id, "from_cache": True}}

    # n8n Webhook call
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            payload_data = {
                "message": message,
                "session_id": session_id,
                "user": {
                    "uid": user.uid,
                    "email": user.email,
                    "role": user.role,
                    "tenant_id": user.tenant_id,
                }
            }
            response = await client.post(
                settings.N8N_WEBHOOK_URL_ASSISTANT,
                json=payload_data,
                timeout=60.0
            )
            response.raise_for_status()
            res_json = response.json()
            if "response" in res_json:
                answer = res_json["response"]
            elif "data" in res_json and "response" in res_json["data"]:
                answer = res_json["data"]["response"]
            else:
                answer = str(res_json)
    except Exception as e:
        answer = f"Je ne peux pas répondre pour le moment. Veuillez contacter votre équipe RH. ({str(e)[:50]})"

    # Cache set
    await cache_set(cache_key, {"response": answer}, ttl=1800)

    # Log interaction
    from sqlalchemy import select as sa_select
    from app.models.user import User as UserModel
    db_user_result = await db.execute(
        sa_select(UserModel.id).where(UserModel.firebase_uid == user.uid)
    )
    db_user_id = db_user_result.scalar_one_or_none() or uuid.uuid4()

    interaction = AiInteraction(
        id=uuid.uuid4(),
        user_id=db_user_id,
        session_id=uuid.UUID(session_id) if len(session_id) == 36 else uuid.uuid4(),
        query_text=message[:500],
        response_summary=answer[:200],
        role_at_time=user.role,
    )
    db.add(interaction)

    return {"data": {"response": answer, "session_id": session_id, "interaction_id": str(interaction.id)}}

@router.get("/sessions")
async def list_sessions(page: int = Query(1), limit: int = Query(20), user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AiInteraction.session_id).distinct().limit(limit).offset((page-1)*limit))
    sessions = [str(r[0]) for r in result.fetchall()]
    return {"data": sessions, "page": page}

@router.get("/sessions/{session_id}")
async def get_session(session_id: str, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        sid = uuid.UUID(session_id)
    except Exception:
        raise HTTPException(400, "session_id invalide")
    result = await db.execute(select(AiInteraction).where(AiInteraction.session_id == sid).order_by(AiInteraction.timestamp))
    interactions = [{"id": str(i.id), "query": i.query_text, "response": i.response_summary, "timestamp": str(i.timestamp)} for i in result.scalars()]
    return {"data": interactions}

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        sid = uuid.UUID(session_id)
    except Exception:
        raise HTTPException(400, "session_id invalide")
    result = await db.execute(select(AiInteraction).where(AiInteraction.session_id == sid))
    for i in result.scalars():
        await db.delete(i)
    return {"message": "Session supprimée"}

@router.post("/feedback")
async def submit_feedback(payload: FeedbackRequest, user: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return {"message": "Feedback enregistré", "interaction_id": payload.interaction_id, "rating": payload.rating}

@router.get("/suggested")
async def suggested_questions(user: CurrentUser = Depends(get_current_user)):
    questions = SUGGESTED_QUESTIONS.get(user.role, SUGGESTED_QUESTIONS["collaborateur"])
    return {"data": questions}

# ---- RAG Documents ----

@router.get("/rag/documents")
async def list_rag_documents(type: Optional[str] = Query(None), page: int = Query(1), user: CurrentUser = Depends(require_roles("rh", "admin")), db: AsyncSession = Depends(get_db)):
    q = select(RagDocument)
    if type: q = q.where(RagDocument.source_type == type)
    result = await db.execute(q.offset((page-1)*20).limit(20))
    docs = [{"id": str(d.id), "title": d.title, "source_type": d.source_type, "created_at": str(d.created_at)} for d in result.scalars()]
    return {"data": docs, "page": page}


@router.get("/internal/rag-context")
async def internal_rag_context(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Internal endpoint called by n8n to fetch RAG document list.
    Protected by X-Internal-Token header instead of Firebase auth.
    """
    token = request.headers.get("X-Internal-Token", "")
    if token != settings.INTERNAL_API_TOKEN:
        raise HTTPException(status_code=403, detail="Forbidden")
    result = await db.execute(select(RagDocument).limit(20))
    docs = [{"id": str(d.id), "title": d.title, "source_type": d.source_type} for d in result.scalars()]
    return {"data": docs}

@router.post("/rag/documents")
async def upload_rag_document(
    file: UploadFile = File(...),
    user: CurrentUser = Depends(require_roles("rh", "admin")),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    text = content.decode("utf-8", errors="ignore")
    doc = RagDocument(id=uuid.uuid4(), title=file.filename, source_type="guide", content_raw=text[:50000])
    db.add(doc)
    await db.flush()
    await queue_push("rag-ingest", {"doc_id": str(doc.id), "content": text[:50000]})
    return {"data": {"id": str(doc.id), "title": doc.title, "status": "indexing"}}

@router.delete("/rag/documents/{doc_id}")
async def delete_rag_document(doc_id: str, user: CurrentUser = Depends(require_roles("admin")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RagDocument).where(RagDocument.id == uuid.UUID(doc_id)))
    doc = result.scalar_one_or_none()
    if not doc: raise HTTPException(404, "Document non trouvé")
    await db.delete(doc)
    return {"message": "Document supprimé du RAG"}

@router.post("/rag/documents/{doc_id}/reindex")
async def reindex_document(doc_id: str, user: CurrentUser = Depends(require_roles("admin", "rh")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RagDocument).where(RagDocument.id == uuid.UUID(doc_id)))
    doc = result.scalar_one_or_none()
    if not doc: raise HTTPException(404, "Non trouvé")
    await queue_push("rag-ingest", {"doc_id": doc_id, "content": doc.content_raw, "reindex": True})
    return {"message": "Ré-indexation en cours"}

@router.get("/rag/documents/{doc_id}/chunks")
async def get_chunks(doc_id: str, user: CurrentUser = Depends(require_roles("admin")), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RagChunk).where(RagChunk.document_id == uuid.UUID(doc_id)).order_by(RagChunk.chunk_index))
    chunks = [{"id": str(c.id), "index": c.chunk_index, "content": c.content[:200], "token_count": c.token_count} for c in result.scalars()]
    return {"data": chunks}
