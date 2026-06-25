import uuid
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException

from app.redis_client import set_lock, release_lock, get_redis
from app.config import settings
from app.models.document import GeneratedDocument, DocumentStatus, DocumentTemplate
from app.models.document_rules import DocumentRequest, RequestStatus, DocumentGenerationRules
from app.models.user import User
from app.middleware.firebase_auth import CurrentUser
from app.services.policy_engine import evaluate_document_policy
from app.utils.audit_logger import log_action

async def request_document_generation(
    db: AsyncSession,
    template_id: uuid.UUID,
    employee_id: uuid.UUID,
    user: CurrentUser
) -> Tuple[Optional[uuid.UUID], str]:
    """
    Life-cycle orchestrator:
    1. Fetch template type.
    2. Evaluate Policy (Quotas, Allowed Roles, Self-generation checks).
    3. If decision is DENY -> Raise HTTP 403.
    4. If decision is REQUIRE_APPROVAL -> Insert DocumentRequest in PENDING_* state.
    5. If decision is ALLOW -> Insert DocumentRequest as APPROVED, create GeneratedDocument, enqueue generation.
    """
    correlation_id = uuid.uuid4()

    # 0. Set concurrent lock on employee_id to prevent duplicate generation requests
    lock_key = f"lock:doc_gen:{employee_id}"
    if not await set_lock(lock_key, ttl=300):
        return None, "Une génération de document est déjà en cours pour cet employé."

    # 1. Fetch template
    stmt = select(DocumentTemplate).where(DocumentTemplate.id == template_id)
    res = await db.execute(stmt)
    template = res.scalar_one_or_none()
    if not template:
        await release_lock(lock_key)
        raise HTTPException(status_code=404, detail="Template non trouvé")

    # 2. Run policy engine checks
    policy = await evaluate_document_policy(db, user, employee_id, template.type, correlation_id)
    if policy.decision == "DENY":
        await release_lock(lock_key)
        raise HTTPException(status_code=403, detail=f"Génération refusée: {policy.reason}")

    # Resolve database user ID
    user_stmt = select(User.id).where(User.firebase_uid == user.uid)
    user_res = await db.execute(user_stmt)
    user_db_id = user_res.scalar_one_or_none()
    if not user_db_id:
        user_db_id = uuid.uuid4()

    # Create DocumentRequest
    request_id = uuid.uuid4()
    req = DocumentRequest(
        id=request_id,
        tenant_id=user.tenant_id,
        employee_id=employee_id,
        template_id=template_id,
        status=RequestStatus.DRAFT,
        requester_uid=user.uid,
        variables_snapshot={},
        correlation_id=correlation_id
    )

    if policy.decision == "REQUIRE_APPROVAL":
        # Check rule to determine which approval state to transition to
        rule_stmt = select(DocumentGenerationRules).where(DocumentGenerationRules.id == policy.rule_id)
        rule_res = await db.execute(rule_stmt)
        rule = rule_res.scalar_one_or_none()
        
        target_status = RequestStatus.PENDING_MANAGER
        if rule and rule.admin_approval_required and not rule.manager_approval_required:
            target_status = RequestStatus.PENDING_ADMIN
        
        req.status = target_status
        db.add(req)
        await db.flush()
        
        await log_action(db, user.uid, f"REQUEST_APPROVAL_{target_status.value}", "document_request", str(request_id), correlation_id=correlation_id)
        await release_lock(lock_key)
        return request_id, "pending_approval"

    # Else decision is ALLOW
    req.status = RequestStatus.APPROVED
    db.add(req)
    
    # Create GeneratedDocument in Draft state
    doc_id = uuid.uuid4()
    new_doc = GeneratedDocument(
        id=doc_id,
        tenant_id=user.tenant_id,
        employee_id=employee_id,
        template_id=template_id,
        correlation_id=correlation_id,
        generated_by=user_db_id,
        status=DocumentStatus.draft,
    )
    db.add(new_doc)
    await db.flush()

    await log_action(db, user.uid, "REQUEST_GENERATE", "document", str(doc_id), correlation_id=correlation_id)
    
    # Push to generation queue
    await enqueue_generation_job(user.tenant_id, doc_id, employee_id, template_id, user.uid, user.role, correlation_id)
    
    return doc_id, "processing"


async def enqueue_generation_job(
    tenant_id: str,
    doc_id: uuid.UUID,
    employee_id: uuid.UUID,
    template_id: uuid.UUID,
    requester_uid: str,
    requester_role: str,
    correlation_id: uuid.UUID
):
    """Enqueue job into BullMQ or Redis fallback list queue with idempotency keys and retry limits."""
    job_id = str(doc_id)
    lock_key = f"lock:doc_gen:{employee_id}"
    
    job_data = {
        "job_id": job_id,
        "idempotency_key": f"idemp:doc_gen:{doc_id}",
        "lock_key": lock_key,
        "retry_count": 0,
        "max_retries": 3,
        "tenant_id": tenant_id,
        "document_id": str(doc_id),
        "employee_id": str(employee_id),
        "template_id": str(template_id),
        "requester_uid": requester_uid,
        "requester_role": requester_role,
        "correlation_id": str(correlation_id)
    }

    if settings.APP_ENV == "testing":
        from app.redis_client import queue_push
        await queue_push("doc-gen", job_data)
    else:
        try:
            from bullmq import Queue
            queue = Queue("doc-gen", connection=settings.REDIS_URL)
            # Use job_id as the unique job ID inside BullMQ to prevent duplicates at the queue level
            await queue.add("generate", job_data, {"jobId": job_id})
            await queue.close()
        except Exception:
            # Fallback direct queue push
            from app.redis_client import queue_push
            await queue_push("doc-gen", job_data)
