from sqlalchemy import Column, String, Boolean, Integer, ForeignKey, Enum as SAEnum, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database import Base
from app.models.document import DocumentType
import uuid, enum

class RequestStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PENDING_MANAGER = "PENDING_MANAGER"
    PENDING_RH = "PENDING_RH"
    PENDING_ADMIN = "PENDING_ADMIN"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    GENERATED = "GENERATED"

class DocumentGenerationRules(Base):
    __tablename__ = "document_generation_rules"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False, default="default-tenant", index=True)
    document_type = Column(SAEnum(DocumentType, name="document_type"), nullable=False)
    allow_self_generation = Column(Boolean, nullable=False, default=True)
    manager_approval_required = Column(Boolean, nullable=False, default=False)
    admin_approval_required = Column(Boolean, nullable=False, default=False)
    max_per_year = Column(Integer, nullable=False, default=5)
    allowed_roles = Column(JSON, nullable=False, default=list)
    priority = Column(Integer, nullable=False, default=0)
    active = Column(Boolean, nullable=False, default=True)

class DocumentRequest(Base):
    __tablename__ = "document_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False, default="default-tenant", index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("document_templates.id"), nullable=False)
    status = Column(SAEnum(RequestStatus, name="request_status_type"), nullable=False, default=RequestStatus.DRAFT)
    requester_uid = Column(String, nullable=False)
    variables_snapshot = Column(JSON, nullable=True, default=dict)
    correlation_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class PolicyDecisionLog(Base):
    __tablename__ = "policy_decision_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False, default="default-tenant", index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)
    decision = Column(String, nullable=False)  # ALLOW | DENY | REQUIRE_APPROVAL
    rule_triggered_id = Column(UUID(as_uuid=True), ForeignKey("document_generation_rules.id"), nullable=True)
    approval_required = Column(Boolean, nullable=False, default=False)
    correlation_id = Column(UUID(as_uuid=True), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
