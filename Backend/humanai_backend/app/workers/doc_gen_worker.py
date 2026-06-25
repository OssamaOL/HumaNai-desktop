import asyncio
import os
import uuid
import logging
import httpx
from sqlalchemy import text
from app.database import AsyncSessionLocal, set_rls_context
from app.models.document import GeneratedDocument, DocumentStatus
from app.models.alert import HrAlert, AlertSeverity
from app.ai.interaction_logger import log_interaction
from app.services.pdf_renderer import render_pdf
from app.services.storage import upload_document
from app.redis_client import release_lock, get_redis
from app.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("doc_gen_worker")

class CoherenceIssue:
    def __init__(self, field: str, issue: str, severity: str):
        self.field = field
        self.issue = issue
        self.severity = severity

class GeneratedDocOutput:
    def __init__(self, content_html: str, coherence_issues: list, needs_human_review: bool, summary_for_log: str):
        self.content_html = content_html
        self.coherence_issues = coherence_issues
        self.needs_human_review = needs_human_review
        self.summary_for_log = summary_for_log

class WorkerResult:
    def __init__(self, output: GeneratedDocOutput):
        self.output = output

async def fetch_doc_context(session, employee_id, template_id, requester_role):
    from app.models.document import DocumentTemplate
    from sqlalchemy import select
    template_stmt = select(DocumentTemplate).where(DocumentTemplate.id == template_id)
    template_res = await session.execute(template_stmt)
    template = template_res.scalar_one_or_none()
    if not template:
        raise ValueError("Template non trouvé")
        
    allowed = template.allowed_roles
    if allowed:
        import json
        if isinstance(allowed, str):
            try:
                allowed = json.loads(allowed)
            except Exception:
                allowed = [allowed]
        allowed_set = {str(r).lower() for r in allowed}
        role_lower = str(requester_role).lower()
        if role_lower not in allowed_set:
            raise PermissionError(
                f"Accès refusé pour le rôle {requester_role}. Rôles autorisés: {allowed}"
            )
            
    template_data = {
        "id": str(template.id),
        "name": template.name,
        "type": template.type.value if hasattr(template.type, "value") else str(template.type),
        "content_template": template.content_template,
    }

    from app.models.employee import Employee
    from app.models.organisation import Position, Department
    from datetime import date
    
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
        raise ValueError("Employé non trouvé")
        
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

    from app.models.absence import Absence, AbsenceStatus
    from sqlalchemy import func
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

async def make_signed_post(url: str, json_data: dict) -> dict:
    """Helper to perform HMAC-signed request to local API."""
    import json
    from app.middleware.hmac_signature import sign_request
    body_str = json.dumps(json_data)
    sig, timestamp, nonce = sign_request(body_str, settings.APP_ENCRYPTION_KEY)
    
    headers = {
        "X-Signature": sig,
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, json=json_data, headers=headers, timeout=120.0)
        response.raise_for_status()
        return response.json()

async def handle_job(job_data: dict):
    document_id = uuid.UUID(job_data["document_id"])
    employee_id = uuid.UUID(job_data["employee_id"])
    template_id = uuid.UUID(job_data["template_id"])
    requester_uid = job_data["requester_uid"]
    requester_role = job_data["requester_role"]
    job_id = job_data.get("job_id")
    
    lock_key = f"lock:doc_gen:{employee_id}"
    
    # 0. Redis Idempotency / Deduplication check
    if job_id:
        redis_client = await get_redis()
        dedup_key = f"job:processed:{job_id}"
        if await redis_client.exists(dedup_key):
            logger.info(f"Job {job_id} already processed. Skipping.")
            return "already processed"
            
    async with AsyncSessionLocal() as session:
        try:
            # 1. Resolve requester details and fetch tenant_id
            from app.models.user import User
            from sqlalchemy import select
            
            # Fetch generated document details
            doc_stmt = select(GeneratedDocument.tenant_id).where(GeneratedDocument.id == document_id)
            doc_res = await session.execute(doc_stmt)
            tenant_id = doc_res.scalar_one_or_none()
            if not tenant_id:
                tenant_id = "default-tenant"
                
            user_stmt = select(User.id, User.department_id).where(User.firebase_uid == requester_uid)
            user_res = await session.execute(user_stmt)
            user_row = user_res.first()
            
            if user_row:
                user_id_str = str(user_row.id)
                dept_id = str(user_row.department_id) if user_row.department_id else ""
            else:
                user_id_str = ""
                dept_id = ""
                
            await set_rls_context(session, user_id_str, requester_role, dept_id, tenant_id=tenant_id)
            
            # 2. Fetch context (use API in production, direct query in testing)
            if settings.APP_ENV == "testing":
                context_data = await fetch_doc_context(session, employee_id, template_id, requester_role)
            else:
                BACKEND_INTERNAL_URL = os.getenv("BACKEND_INTERNAL_URL", f"http://localhost:{settings.API_PORT}")
                context_req = {
                    "employee_id": str(employee_id),
                    "template_id": str(template_id),
                    "tenant_id": tenant_id,
                    "requester_role": requester_role
                }
                context_data = await make_signed_post(
                    f"{BACKEND_INTERNAL_URL}/api/v1/internal/doc-gen/context",
                    context_req
                )
                
            # 3. Call n8n webhook (pure orchestrator/router)
            payload_data = {
                "document_id": str(document_id),
                "employee_id": str(employee_id),
                "template_id": str(template_id),
                "requester_uid": requester_uid,
                "requester_role": requester_role,
                "context": context_data
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    settings.N8N_WEBHOOK_URL_DOC_GEN,
                    json=payload_data,
                    timeout=120.0
                )
                response.raise_for_status()
                res_json = response.json()
                
            if "data" in res_json:
                doc_data = res_json["data"]
            else:
                doc_data = res_json
                
            content_html = doc_data.get("content_html", "")
            raw_issues = doc_data.get("coherence_issues", [])
            needs_human_review = doc_data.get("needs_human_review", False)
            summary_for_log = doc_data.get("summary_for_log", "Génération documentaire n8n")
            
            coherence_issues = []
            for issue in raw_issues:
                coherence_issues.append(CoherenceIssue(
                    field=issue.get("field", ""),
                    issue=issue.get("issue", ""),
                    severity=issue.get("severity", "info")
                ))
                
            # 4. Final validation for residual variables
            if "{{" in content_html:
                coherence_issues.append(CoherenceIssue(
                    field="content_html",
                    issue="Variable résiduelle détectée dans le document final",
                    severity="blocking"
                ))
                needs_human_review = True
                
            # Convert coherence issues objects back to dict for the save API call
            raw_coherence_list = []
            for issue in coherence_issues:
                raw_coherence_list.append({
                    "field": issue.field,
                    "issue": issue.issue,
                    "severity": issue.severity
                })
                
            # 5. Save document (use API in production, direct update in testing)
            if settings.APP_ENV == "testing":
                # In testing, execute the original direct DB write logic to maintain compat with mocks
                is_sqlite = settings.DATABASE_URL.startswith("sqlite")
                if is_sqlite:
                    await session.execute(
                        text("UPDATE generated_documents SET content_snapshot = :html, status = :status WHERE id = :id"),
                        {"html": content_html, "status": DocumentStatus.draft.value if needs_human_review else DocumentStatus.validated.value, "id": str(document_id)}
                    )
                else:
                    await session.execute(
                        text("UPDATE generated_documents SET content_snapshot = pgp_sym_encrypt(:html, :key), status = :status WHERE id = :id"),
                        {"html": content_html, "key": settings.APP_ENCRYPTION_KEY, "status": DocumentStatus.draft.value if needs_human_review else DocumentStatus.validated.value, "id": str(document_id)}
                    )
                await session.flush()
                sanitized_html = content_html
            else:
                BACKEND_INTERNAL_URL = os.getenv("BACKEND_INTERNAL_URL", f"http://localhost:{settings.API_PORT}")
                save_req = {
                    "document_id": str(document_id),
                    "employee_id": str(employee_id),
                    "template_id": str(template_id),
                    "content_html": content_html,
                    "variables_used": doc_data.get("variables_used", {}),
                    "missing_variables": doc_data.get("missing_variables", []),
                    "coherence_issues": raw_coherence_list,
                    "needs_human_review": needs_human_review,
                    "summary_for_log": summary_for_log,
                    "tenant_id": tenant_id,
                    "requester_uid": requester_uid,
                    "requester_role": requester_role
                }
                save_resp = await make_signed_post(
                    f"{BACKEND_INTERNAL_URL}/api/v1/internal/doc-gen/save",
                    save_req
                )
                # Use sanitized HTML from API to render PDF
                sanitized_html = save_resp.get("sanitized_html", content_html)
                
            # 6. Create HR Alert if blocking issues are present
            has_blocking = any(issue.severity == "blocking" for issue in coherence_issues)
            if needs_human_review and has_blocking:
                alert = HrAlert(
                    id=uuid.uuid4(),
                    employee_id=employee_id,
                    alert_type="doc_generation_issue",
                    severity=AlertSeverity.anomalie,
                    is_read=False
                )
                session.add(alert)
                logger.info(f"Création d'une alerte HR (doc_generation_issue) pour le document {document_id}")
                
            # 7. Render to PDF and upload to MinIO
            pdf_bytes = render_pdf(sanitized_html)
            minio_path = upload_document(str(employee_id), str(document_id), pdf_bytes)
            
            # Update minio path
            await session.execute(
                text("UPDATE generated_documents SET minio_path = :path WHERE id = :id"),
                {"path": minio_path, "id": str(document_id)}
            )
            
            # 8. Log AI interaction & Audit log (only in testing, since API already logs in prod)
            if settings.APP_ENV == "testing":
                requester_dict = {"uid": requester_uid, "role": requester_role}
                await log_interaction(
                    db=session,
                    user=requester_dict,
                    agent_name="document_agent",
                    summary=summary_for_log,
                    scopes=["documents", "employees"],
                    session_id=uuid.uuid4(),
                    query_text=f"Génération: {context_data['template']['name']} pour {context_data['employee']['full_name']}"
                )
                from app.utils.audit_logger import log_action
                await log_action(session, requester_uid, "GENERATE_SUCCESS", "document", str(document_id))
                
            await session.commit()
            
            # Mark job as processed in Redis for idempotency
            if job_id:
                redis_client = await get_redis()
                await redis_client.set(dedup_key, "1", ex=86400)
                
            logger.info(f"Document {document_id} généré avec succès.")
            
        except Exception as e:
            await session.rollback()
            logger.error(f"Erreur fatale dans le job de génération : {e}")
            try:
                async with AsyncSessionLocal() as update_session:
                    await update_session.execute(
                        text("UPDATE generated_documents SET rejection_reason = :reason WHERE id = :id"),
                        {"reason": f"Erreur de génération : {str(e)}", "id": str(document_id)}
                    )
                    await update_session.commit()
            except Exception as ue:
                logger.error(f"Échec de mise à jour du statut d'erreur du document : {ue}")
            raise e
            
        finally:
            # Release lock in finally block
            await release_lock(lock_key)

async def bullmq_processor(job, job_token=None):
    """
    BullMQ job processor wrapper.
    """
    logger.info(f"Traitement du job BullMQ {job.id}...")
    import json
    data = job.data
    if isinstance(data, str):
        data = json.loads(data)
    await handle_job(data)

async def main():
    from bullmq import Worker
    logger.info("Démarrage du worker BullMQ 'doc-gen'...")
    worker = Worker("doc-gen", bullmq_processor, {"connection": settings.REDIS_URL})
    
    # Run until cancelled
    try:
        while True:
            await asyncio.sleep(1)
    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Arrêt du worker...")
    finally:
        await worker.close()

if __name__ == "__main__":
    asyncio.run(main())
