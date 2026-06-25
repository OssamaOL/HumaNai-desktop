from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.middleware.firebase_auth import get_current_user, CurrentUser, require_roles
from app.models.document import DocumentTemplate, GeneratedDocument, DocumentType, DocumentStatus
from app.models.user import User
from app.utils.audit_logger import log_action
from app.schemas.documents import DocumentGenerateRequest, DocumentResponse, DocumentListResponse
from app.services.document_service import request_document_generation
from app.services.storage import get_document_presigned_url
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

router = APIRouter(prefix="/documents", tags=["Documents"])

class TemplateCreate(BaseModel):
    name: str
    type: str
    content_template: str
    allowed_roles: List[str]

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    content_template: Optional[str] = None
    allowed_roles: Optional[List[str]] = None

class DocumentGenerate(BaseModel):
    template_id: str
    employee_id: str

def template_to_dict(t: DocumentTemplate) -> dict:
    return {
        "id": str(t.id),
        "name": t.name,
        "type": t.type,
        "content_template": t.content_template,
        "allowed_roles": t.allowed_roles,
        "created_at": str(t.created_at) if t.created_at else None,
    }

def doc_to_dict(d: GeneratedDocument) -> dict:
    return {
        "id": str(d.id),
        "employee_id": str(d.employee_id),
        "template_id": str(d.template_id) if d.template_id else None,
        "generated_by": str(d.generated_by),
        "generated_at": str(d.generated_at),
        "minio_path": d.minio_path,
        "status": d.status,
        "rh_validated_by": str(d.rh_validated_by) if d.rh_validated_by else None,
        "rh_validated_at": str(d.rh_validated_at) if d.rh_validated_at else None,
        "rejection_reason": d.rejection_reason,
    }

# ---- Templates ----

@router.get("/templates/")
async def list_templates(
    type: Optional[str] = Query(None),
    role_access: Optional[str] = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(DocumentTemplate)
    if type:
        q = q.where(DocumentTemplate.type == type)
    result = await db.execute(q)
    templates = result.scalars().all()
    
    # Filter based on role access
    role = role_access or user.role
    filtered = [t for t in templates if not t.allowed_roles or role in t.allowed_roles]
    return {"data": [template_to_dict(t) for t in filtered]}

@router.post("/templates/")
async def create_template(
    payload: TemplateCreate,
    user: CurrentUser = Depends(require_roles("rh", "admin")),
    db: AsyncSession = Depends(get_db),
):
    template = DocumentTemplate(
        id=uuid.uuid4(),
        name=payload.name,
        type=DocumentType(payload.type),
        content_template=payload.content_template,
        allowed_roles=payload.allowed_roles,
    )
    db.add(template)
    await db.flush()
    await log_action(db, user.uid, "CREATE", "document_template", str(template.id))
    return {"data": template_to_dict(template)}

@router.put("/templates/{template_id}")
async def update_template(
    template_id: str,
    payload: TemplateUpdate,
    user: CurrentUser = Depends(require_roles("rh", "admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DocumentTemplate).where(DocumentTemplate.id == uuid.UUID(template_id)))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template non trouvé")
    
    if payload.name:
        t.name = payload.name
    if payload.content_template:
        t.content_template = payload.content_template
    if payload.allowed_roles:
        t.allowed_roles = payload.allowed_roles
        
    await log_action(db, user.uid, "UPDATE", "document_template", template_id)
    return {"data": template_to_dict(t)}

@router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    user: CurrentUser = Depends(require_roles("admin")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(DocumentTemplate).where(DocumentTemplate.id == uuid.UUID(template_id)))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template non trouvé")
    await db.delete(t)
    await log_action(db, user.uid, "DELETE", "document_template", template_id)
    return {"message": "Template supprimé"}

# ---- Generated Documents ----

@router.get("/", response_model=DocumentListResponse)
async def list_my_documents(
    status: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user.employee_id:
        return {"data": []}
    q = select(GeneratedDocument).where(GeneratedDocument.employee_id == uuid.UUID(user.employee_id))
    if status:
        q = q.where(GeneratedDocument.status == status)
    result = await db.execute(q)
    return {"data": [doc_to_dict(d) for d in result.scalars()]}

@router.get("/all", response_model=DocumentListResponse)
async def list_all_documents(
    employee_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    user: CurrentUser = Depends(require_roles("rh", "admin")),
    db: AsyncSession = Depends(get_db),
):
    q = select(GeneratedDocument)
    if employee_id:
        q = q.where(GeneratedDocument.employee_id == uuid.UUID(employee_id))
    if status:
        q = q.where(GeneratedDocument.status == status)
    result = await db.execute(q)
    return {"data": [doc_to_dict(d) for d in result.scalars()]}

@router.post("/generate", status_code=202)
async def generate_document(
    payload: DocumentGenerateRequest,
    user: CurrentUser = Depends(require_roles("collaborateur", "rh")),
    db: AsyncSession = Depends(get_db),
):
    # 1. Security check: Collaborateur can only generate for themselves
    target_employee_id = payload.employee_id
    if user.role == "collaborateur":
        if not user.employee_id:
            raise HTTPException(status_code=403, detail="L'utilisateur n'a pas de profil employé associé")
        
        # If employee_id is provided, it must match user.employee_id
        if target_employee_id and str(target_employee_id) != user.employee_id:
            raise HTTPException(status_code=403, detail="Un collaborateur ne peut générer de documents que pour lui-même")
        
        # Default to user.employee_id
        target_employee_id = uuid.UUID(user.employee_id)
    else:
        # RH/Admin roles must provide target employee_id or fallback to their own
        if not target_employee_id:
            if user.employee_id:
                target_employee_id = uuid.UUID(user.employee_id)
            else:
                raise HTTPException(status_code=400, detail="L'ID de l'employé cible doit être spécifié")

    # 2. Retrieve template and verify allowed roles
    t_result = await db.execute(select(DocumentTemplate).where(DocumentTemplate.id == payload.template_id))
    template = t_result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template non trouvé")
        
    allowed = template.allowed_roles
    if allowed:
        import json
        if isinstance(allowed, str):
            try:
                allowed = json.loads(allowed)
            except Exception:
                allowed = [allowed]
        allowed_set = {str(r).lower() for r in allowed}
        if user.role.lower() not in allowed_set:
            raise HTTPException(status_code=403, detail=f"Ce modèle n'est pas autorisé pour le rôle {user.role}")

    # 3. Call service orchestrator (sets Redis lock, inserts GeneratedDocument, pushes to BullMQ)
    doc_id, status_or_error = await request_document_generation(
        db=db,
        template_id=template.id,
        employee_id=target_employee_id,
        user=user
    )
    
    if doc_id is None:
        raise HTTPException(status_code=409, detail=status_or_error)
        
    if status_or_error == "pending_approval":
        await log_action(db, user.uid, "REQUEST_GENERATION_PENDING", "document_request", str(doc_id))
        return {
            "document_id": str(doc_id),
            "status": "pending_approval"
        }
        
    await log_action(db, user.uid, "GENERATE", "document", str(doc_id))
    
    return {
        "document_id": str(doc_id),
        "status": "processing"
    }

@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(
    doc_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de document invalide")
        
    result = await db.execute(select(GeneratedDocument).where(GeneratedDocument.id == doc_uuid))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")
        
    # Check ownership
    if user.role not in ["rh", "admin"] and str(doc.employee_id) != user.employee_id:
        raise HTTPException(status_code=403, detail="Accès interdit")
        
    return {"data": doc_to_dict(doc)}

@router.get("/{doc_id}/download")
async def download_document(
    doc_id: str,
    user: CurrentUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de document invalide")
        
    result = await db.execute(select(GeneratedDocument).where(GeneratedDocument.id == doc_uuid))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")
        
    if user.role not in ["rh", "admin"] and str(doc.employee_id) != user.employee_id:
        raise HTTPException(status_code=403, detail="Accès interdit")
        
    # Check if document has been generated yet (minio_path exists)
    if not doc.minio_path:
        raise HTTPException(status_code=404, detail="Le document n'est pas encore prêt pour le téléchargement")
        
    # Generate 10-minute presigned URL
    try:
        presigned_url = get_document_presigned_url(doc.minio_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la récupération du lien de téléchargement : {str(e)}")
        
    return {"download_url": presigned_url}

@router.post("/{doc_id}/validate", response_model=DocumentResponse)
async def validate_document(
    doc_id: str,
    payload: dict = {},
    user: CurrentUser = Depends(require_roles("rh")),
    db: AsyncSession = Depends(get_db),
):
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de document invalide")
        
    result = await db.execute(select(GeneratedDocument).where(GeneratedDocument.id == doc_uuid))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")
        
    # Resolve RH User DB ID
    user_stmt = select(User.id).where(User.firebase_uid == user.uid)
    user_res = await db.execute(user_stmt)
    user_db_id = user_res.scalar_one_or_none()
    if not user_db_id:
        user_db_id = uuid.uuid4()
        
    doc.status = DocumentStatus.validated
    doc.rh_validated_by = user_db_id
    doc.rh_validated_at = datetime.utcnow()
    
    commentaire = payload.get("commentaire", "Validé par la RH")
    
    await log_action(db, user.uid, "VALIDATE", "document", doc_id, details={"commentaire": commentaire})
    return {"data": doc_to_dict(doc)}

@router.post("/{doc_id}/reject", response_model=DocumentResponse)
async def reject_document(
    doc_id: str,
    payload: dict = {},
    user: CurrentUser = Depends(require_roles("rh")),
    db: AsyncSession = Depends(get_db),
):
    motif = payload.get("motif")
    if not motif:
        raise HTTPException(status_code=400, detail="Le motif du rejet est requis")
        
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de document invalide")
        
    result = await db.execute(select(GeneratedDocument).where(GeneratedDocument.id == doc_uuid))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")
        
    # Transition to rejected status
    doc.status = DocumentStatus.rejected
    doc.rejection_reason = motif
    
    await log_action(db, user.uid, "REJECT", "document", doc_id, details={"motif": motif})
    return {"data": doc_to_dict(doc)}

@router.delete("/{doc_id}")
async def archive_document(
    doc_id: str,
    user: CurrentUser = Depends(require_roles("admin", "rh")),
    db: AsyncSession = Depends(get_db),
):
    try:
        doc_uuid = uuid.UUID(doc_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="ID de document invalide")
        
    result = await db.execute(select(GeneratedDocument).where(GeneratedDocument.id == doc_uuid))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document non trouvé")
        
    doc.status = DocumentStatus.archived
    await log_action(db, user.uid, "ARCHIVE", "document", doc_id)
    return {"message": "Document archivé"}
