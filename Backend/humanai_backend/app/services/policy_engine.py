import uuid
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from fastapi import HTTPException

from app.models.document_rules import DocumentGenerationRules, DocumentRequest, RequestStatus, PolicyDecisionLog
from app.models.document import GeneratedDocument, DocumentType
from app.middleware.firebase_auth import CurrentUser

class PolicyDecision:
    def __init__(
        self,
        decision: str,  # ALLOW | DENY | REQUIRE_APPROVAL
        reason: str,
        rule_id: Optional[uuid.UUID] = None,
        evaluated_at: str = None,
        context_snapshot: Dict[str, Any] = None
    ):
        self.decision = decision
        self.reason = reason
        self.rule_id = rule_id
        self.evaluated_at = evaluated_at or datetime.utcnow().isoformat()
        self.context_snapshot = context_snapshot or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "decision": self.decision,
            "reason": self.reason,
            "rule_id": str(self.rule_id) if self.rule_id else None,
            "evaluated_at": self.evaluated_at,
            "context_snapshot": self.context_snapshot
        }

async def evaluate_document_policy(
    db: AsyncSession,
    user: CurrentUser,
    employee_id: uuid.UUID,
    document_type: DocumentType,
    correlation_id: uuid.UUID
) -> PolicyDecision:
    """
    Deterministic document generation rule evaluation.
    1. Fetch active rules for the given tenant and document type.
    2. Sort rules by priority (ascending/descending as specified - highest priority wins).
    3. Evaluate yearly quotas for the employee.
    4. Enforce self-generation limitations.
    5. Return PolicyDecision and log to PolicyDecisionLog.
    """
    # 1. Fetch active rules
    stmt = (
        select(DocumentGenerationRules)
        .where(DocumentGenerationRules.tenant_id == user.tenant_id)
        .where(DocumentGenerationRules.document_type == document_type)
        .where(DocumentGenerationRules.active == True)
        .order_by(DocumentGenerationRules.priority.desc()) # Highest priority first
    )
    res = await db.execute(stmt)
    rules = res.scalars().all()

    # Context snapshot for trace
    context_snapshot = {
        "tenant_id": user.tenant_id,
        "employee_id": str(employee_id),
        "document_type": document_type.value if hasattr(document_type, "value") else str(document_type),
        "requester_role": user.role,
        "is_self_generation": user.employee_id is not None and uuid.UUID(user.employee_id) == employee_id
    }

    if not rules:
        # Default fallback policy if no rule is found
        decision = PolicyDecision("ALLOW", "Pas de règle spécifique configurée. Autorisation par défaut.", None, None, context_snapshot)
        await log_policy_decision(db, user, "generate", decision, correlation_id)
        return decision

    rule = rules[0] # First match wins due to priority ordering
    context_snapshot["rule_id"] = str(rule.id)

    # 2. Allowed roles check
    allowed_roles_set = {str(r).lower() for r in rule.allowed_roles}
    if user.role.lower() not in allowed_roles_set:
        decision = PolicyDecision(
            "DENY",
            f"Rôle {user.role} non autorisé par la règle (Rôles autorisés: {rule.allowed_roles})",
            rule.id,
            None,
            context_snapshot
        )
        await log_policy_decision(db, user, "generate", decision, correlation_id)
        return decision

    # 3. Enforce self-generation limits
    is_self = user.employee_id is not None and uuid.UUID(user.employee_id) == employee_id
    if is_self and not rule.allow_self_generation:
        decision = PolicyDecision(
            "DENY",
            "La génération de ce type de document par soi-même est interdite.",
            rule.id,
            None,
            context_snapshot
        )
        await log_policy_decision(db, user, "generate", decision, correlation_id)
        return decision

    # 4. Check yearly quotas (current calendar year)
    year_start = datetime(date.today().year, 1, 1)
    year_end = datetime(date.today().year, 12, 31, 23, 59, 59)
    quota_stmt = (
        select(func.count(GeneratedDocument.id))
        .where(GeneratedDocument.tenant_id == user.tenant_id)
        .where(GeneratedDocument.employee_id == employee_id)
        .where(GeneratedDocument.generated_at >= year_start)
        .where(GeneratedDocument.generated_at <= year_end)
    )
    quota_res = await db.execute(quota_stmt)
    count = quota_res.scalar_one() or 0
    context_snapshot["yearly_count"] = count
    context_snapshot["max_per_year"] = rule.max_per_year

    if count >= rule.max_per_year:
        decision = PolicyDecision(
            "DENY",
            f"Quota annuel dépassé ({count}/{rule.max_per_year} documents générés ce calendrier).",
            rule.id,
            None,
            context_snapshot
        )
        await log_policy_decision(db, user, "generate", decision, correlation_id)
        return decision

    # 5. Enforce approval flow rules
    decision_type = "ALLOW"
    reason = "Génération autorisée directement sans approbation."
    approval_required = False

    if rule.manager_approval_required or rule.admin_approval_required:
        decision_type = "REQUIRE_APPROVAL"
        approval_required = True
        reasons = []
        if rule.manager_approval_required:
            reasons.append("Approbation Manager requise")
        if rule.admin_approval_required:
            reasons.append("Approbation Admin requise")
        reason = " / ".join(reasons)

    decision = PolicyDecision(decision_type, reason, rule.id, None, context_snapshot)
    await log_policy_decision(db, user, "generate", decision, correlation_id, approval_required)
    return decision

async def log_policy_decision(
    db: AsyncSession,
    user: CurrentUser,
    action: str,
    decision: PolicyDecision,
    correlation_id: uuid.UUID,
    approval_required: bool = False
):
    # Resolve user DB ID if possible
    from app.models.user import User
    user_stmt = select(User.id).where(User.firebase_uid == user.uid)
    user_res = await db.execute(user_stmt)
    user_db_id = user_res.scalar_one_or_none()

    log_entry = PolicyDecisionLog(
        id=uuid.uuid4(),
        tenant_id=user.tenant_id,
        user_id=user_db_id,
        action=action,
        decision=decision.decision,
        rule_triggered_id=decision.rule_id,
        approval_required=approval_required,
        correlation_id=correlation_id
    )
    db.add(log_entry)
