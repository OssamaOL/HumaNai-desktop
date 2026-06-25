from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid

class DocumentGenerateRequest(BaseModel):
    template_id: uuid.UUID
    employee_id: Optional[uuid.UUID] = None

class DocumentResponseData(BaseModel):
    id: uuid.UUID
    employee_id: uuid.UUID
    template_id: Optional[uuid.UUID] = None
    generated_by: uuid.UUID
    generated_at: datetime
    minio_path: Optional[str] = None
    status: str
    rh_validated_by: Optional[uuid.UUID] = None
    rh_validated_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    data: DocumentResponseData

class DocumentListResponse(BaseModel):
    data: List[DocumentResponseData]
