from sqlalchemy import Column, String, Text, ForeignKey, Enum as SAEnum, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.database import Base
import uuid, enum

class DocumentType(str, enum.Enum):
    attestation = "attestation"
    formulaire = "formulaire"
    synthese = "synthese"
    courrier = "courrier"
    offboarding = "offboarding"

class DocumentStatus(str, enum.Enum):
    draft = "draft"
    validated = "validated"
    rejected = "rejected"
    archived = "archived"

class DocumentTemplate(Base):
    __tablename__ = "document_templates"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False, default="default-tenant", index=True)
    name = Column(String, nullable=False)
    type = Column(SAEnum(DocumentType, name="document_type"), nullable=False)
    content_template = Column(Text, nullable=False)
    allowed_roles = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class GeneratedDocument(Base):
    __tablename__ = "generated_documents"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, nullable=False, default="default-tenant", index=True)
    employee_id = Column(UUID(as_uuid=True), ForeignKey("employees.id"), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("document_templates.id"), nullable=True)
    correlation_id = Column(UUID(as_uuid=True), nullable=True)
    security_hash = Column(String, nullable=True)
    template_version = Column(String, nullable=True)
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    content_snapshot = Column(Text, nullable=True)  # encrypted
    minio_path = Column(String, nullable=True)
    status = Column(SAEnum(DocumentStatus, name="document_status_type"), default=DocumentStatus.draft)
    rh_validated_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    rh_validated_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
