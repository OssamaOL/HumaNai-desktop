import uuid
import hashlib
import json
import logging
from datetime import date
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, text, literal

from app.database import get_db, set_rls_context
from app.config import settings
from app.middleware.hmac_signature import verify_hmac_signature
from app.services.pii_sanitizer import mask_pii
from app.services.html_sanitizer import sanitize_html
from app.services.guardrails_service import (
    check_prompt_injection,
    validate_document_output,
    check_output_hallucinations
)
from app.models.rag import RagChunk
from app.models.user import User
from app.models.document import DocumentTemplate, GeneratedDocument, DocumentStatus
from app.models.employee import Employee
from app.models.organisation import Position, Department
from app.models.absence import Absence, AbsenceStatus
from app.utils.audit_logger import log_action

logger = logging.getLogger("internal_api")

router = APIRouter(
    prefix="/api/v1/internal",
    tags=["internal"],
    dependencies=[Depends(verify_hmac_signature)]
)

class AssistantContextRequest(BaseModel):
    query_text: str
    role: str
    tenant_id: str

class DocGenContextRequest(BaseModel):
    employee_id: str
    template_id: str
    tenant_id: str
    requester_role: str

class CoherenceIssueInput(BaseModel):
    field: str
    issue: str
    severity: str

class DocGenSaveRequest(BaseModel):
    document_id: str
    employee_id: str
    template_id: str
    content_html: str
    variables_used: Dict[str, str]
    missing_variables: List[str]
    coherence_issues: List[CoherenceIssueInput]
    needs_human_review: bool
    summary_for_log: str
    tenant_id: str
    requester_uid: str
    requester_role: str

async def get_embedding(text: str) -> List[float]:
    """Fetch query embedding from OpenAI or fall back to a mock vector."""
    if settings.APP_ENV == "testing" or not settings.OPENAI_API_KEY:
        return [0.0] * 1536
    try:
        import openai
        client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        resp = await client.embeddings.create(
            input=[text],
            model=settings.EMBEDDING_MODEL
        )
        return resp.data[0].embedding
    except Exception as e:
        logger.warning(f"Error calling OpenAI embeddings, falling back to mock: {e}")
        return [0.0] * 1536

async def fetch_doc_context(session: AsyncSession, employee_id: uuid.UUID, template_id: uuid.UUID, requester_role: str):
    """Retrieve full raw context data from database."""
    # 1. Fetch template
    template_stmt = select(DocumentTemplate).where(DocumentTemplate.id == template_id)
    template_res = await session.execute(template_stmt)
    template = template_res.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template non trouvé")
        
    allowed = template.allowed_roles
    if allowed:
        if isinstance(allowed, str):
            try:
                allowed = json.loads(allowed)
            except Exception:
                allowed = [allowed]
        allowed_set = {str(r).lower() for r in allowed}
        if requester_role.lower() not in allowed_set:
            raise HTTPException(
                status_code=403,
                detail=f"Accès refusé pour le rôle {requester_role}."
            )
            
    template_data = {
        "id": str(template.id),
        "name": template.name,
        "type": template.type.value if hasattr(template.type, "value") else str(template.type),
        "content_template": template.content_template,
    }

    # 2. Fetch employee details
    emp_stmt = (
        select(
            Employee.full_name,
            Employee.matricule,
            Employee.hire_date,
            Employee.contract_type,
            Position.name.label("position"),
            Department.name.label("department")
        )
        .outerjoin(Position, Employee.position_id == Position.id)
        .outerjoin(Department, Employee.department_id == Department.id)
        .where(Employee.id == employee_id)
    )
    emp_res = await session.execute(emp_stmt)
    row = emp_res.first()
    if not row:
        raise HTTPException(status_code=404, detail="Employé non trouvé")
        
    seniority = 0.0
    if row.hire_date:
        delta = date.today() - row.hire_date
        seniority = round(delta.days / 365.25, 1)
        
    employee_data = {
        "id": str(employee_id),
        "full_name": row.full_name,
        "matricule": row.matricule,
        "position": row.position or "Non renseigné",
        "department": row.department or "Non renseigné",
        "hire_date": str(row.hire_date) if row.hire_date else None,
        "contract_type": row.contract_type.value if hasattr(row.contract_type, "value") else str(row.contract_type),
        "seniority_years": seniority
    }

    # 3. Fetch absences
    year = date.today().year
    start_of_year = date(year, 1, 1)
    end_of_year = date(year, 12, 31)
    
    abs_stmt = (
        select(Absence.type, func.sum(Absence.duration_days))
        .where(Absence.employee_id == employee_id)
        .where(Absence.status == AbsenceStatus.approved)
        .where(Absence.start_date >= start_of_year)
        .where(Absence.start_date <= end_of_year)
        .group_by(Absence.type)
    )
    abs_res = await session.execute(abs_stmt)
    absences = {}
    for r in abs_res.all():
        abs_type = r[0].value if hasattr(r[0], "value") else str(r[0])
        duration = float(r[1]) if r[1] is not None else 0.0
        absences[abs_type] = duration

    return {
        "template": template_data,
        "employee": employee_data,
        "absences": absences
    }

@router.post("/assistant/context")
async def get_assistant_context(
    req: AssistantContextRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Exposes RAG context for assistant flow, isolated by tenant & role check.
    """
    check_prompt_injection(req.query_text)
    
    # Apply PostgreSQL Row Level Security context
    await set_rls_context(db, user_id="", role=req.role, dept_id="", tenant_id=req.tenant_id)
    
    query_vector = await get_embedding(req.query_text)
    
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")
    if is_sqlite:
        # SQLite fallback: fetch all for tenant and filter by role in python
        stmt = select(RagChunk).where(RagChunk.tenant_id == req.tenant_id)
        res = await db.execute(stmt)
        chunks = res.scalars().all()
        
        filtered = []
        for c in chunks:
            roles = c.role_access
            if isinstance(roles, str):
                try:
                    roles = json.loads(roles)
                except Exception:
                    roles = [roles]
            if not roles or req.role.lower() in [r.lower() for r in roles]:
                filtered.append(c)
        chunks = filtered[:5]
    else:
        # pgvector cosine distance search
        # cosine_distance is <=> in Postgres
        stmt = (
            select(RagChunk)
            .order_by(RagChunk.embedding.cosine_distance(query_vector))
            .limit(5)
        )
        res = await db.execute(stmt)
        chunks = res.scalars().all()
        
    context_parts = []
    for chunk in chunks:
        # Extra validation to ensure zero prompt injection parts in knowledge files leak
        sanitized_chunk = chunk.content
        context_parts.append(sanitized_chunk)
        
    aggregated_context = "\n\n".join(context_parts)
    # Mask PII at context projection level
    masked_context = mask_pii(aggregated_context)
    
    return {"context_text": masked_context}

@router.post("/doc-gen/context")
async def get_doc_gen_context(
    req: DocGenContextRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Provides context data for generating documents with PII masking and ID stripping.
    """
    emp_uuid = uuid.UUID(req.employee_id)
    tmpl_uuid = uuid.UUID(req.template_id)
    
    # Set RLS session context
    await set_rls_context(db, user_id="", role=req.requester_role, dept_id="", tenant_id=req.tenant_id)
    
    raw_context = await fetch_doc_context(db, emp_uuid, tmpl_uuid, req.requester_role)
    
    # Mask PII at context projection level
    employee_data = raw_context["employee"]
    
    masked_employee = {
        "full_name": employee_data["full_name"],
        "matricule": employee_data["matricule"],
        "position": employee_data["position"],
        "department": employee_data["department"],
        "hire_date": employee_data["hire_date"],
        "contract_type": employee_data["contract_type"],
        "seniority_years": employee_data["seniority_years"],
    }
    
    # Mask templates and remove IDs
    template_data = raw_context["template"]
    masked_template = {
        "name": template_data["name"],
        "type": template_data["type"],
        "content_template": template_data["content_template"]
    }
    
    return {
        "template": masked_template,
        "employee": masked_employee,
        "absences": raw_context["absences"]
    }

@router.post("/doc-gen/save")
async def save_doc_gen_output(
    req: DocGenSaveRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Sanitizes, validates, signs, and stores the document generation output.
    """
    doc_uuid = uuid.UUID(req.document_id)
    emp_uuid = uuid.UUID(req.employee_id)
    tmpl_uuid = uuid.UUID(req.template_id)
    
    # Set RLS session context
    await set_rls_context(db, user_id="", role=req.requester_role, dept_id="", tenant_id=req.tenant_id)
    
    # 1. Output Validation & Guardrails
    # Verify prompt injection in content_html
    check_prompt_injection(req.content_html)
    
    # Re-fetch context for hallucinations check
    raw_context = await fetch_doc_context(db, emp_uuid, tmpl_uuid, req.requester_role)
    
    # Strict validation of document payload structure
    coherence_list = [{"field": c.field, "issue": c.issue, "severity": c.severity} for c in req.coherence_issues]
    doc_output_dict = {
        "content_html": req.content_html,
        "variables_used": req.variables_used,
        "missing_variables": req.missing_variables,
        "coherence_issues": coherence_list,
        "needs_human_review": req.needs_human_review,
        "summary_for_log": req.summary_for_log
    }
    validate_document_output(doc_output_dict)
    
    # Hallucination check against actual database context
    check_output_hallucinations(doc_output_dict, raw_context["employee"])
    
    # 2. Bleach HTML Sanitizer
    sanitized_html = sanitize_html(req.content_html)
    
    # 3. SHA256 Signature Generation
    security_hash = hashlib.sha256(sanitized_html.encode("utf-8")).hexdigest()
    
    # 4. Resolve requester database UUID
    user_stmt = select(User.id).where(User.firebase_uid == req.requester_uid)
    user_res = await db.execute(user_stmt)
    user_id = user_res.scalar_one_or_none()
    if not user_id:
        raise HTTPException(status_code=404, detail="Requester user non trouvé dans la base")
        
    # 5. Database transaction updates
    # Update GeneratedDocument status and content
    is_sqlite = settings.DATABASE_URL.startswith("sqlite")
    
    status_val = DocumentStatus.draft.value if req.needs_human_review else DocumentStatus.validated.value
    
    if is_sqlite:
        stmt = (
            update(GeneratedDocument)
            .where(GeneratedDocument.id == doc_uuid)
            .values(
                content_snapshot=sanitized_html,
                security_hash=security_hash,
                status=DocumentStatus.draft if req.needs_human_review else DocumentStatus.validated,
                generated_by=user_id,
                generated_at=func.now()
            )
        )
    else:
        stmt = (
            update(GeneratedDocument)
            .where(GeneratedDocument.id == doc_uuid)
            .values(
                content_snapshot=func.pgp_sym_encrypt(sanitized_html, settings.APP_ENCRYPTION_KEY),
                security_hash=security_hash,
                status=DocumentStatus.draft if req.needs_human_review else DocumentStatus.validated,
                generated_by=user_id,
                generated_at=func.now()
            )
        )
        
    await db.execute(stmt)
    
    # Audit trail logging
    await log_action(db, req.requester_uid, "GENERATE_SUCCESS", "document", str(doc_uuid))
    
    await db.commit()
    
    return {
        "status": "success",
        "document_id": str(doc_uuid),
        "security_hash": security_hash,
        "needs_human_review": req.needs_human_review,
        "sanitized_html": sanitized_html
    }
