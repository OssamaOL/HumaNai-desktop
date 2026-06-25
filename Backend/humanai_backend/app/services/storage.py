from app.utils.minio_client import upload_bytes, get_minio_client
from app.config import settings
from datetime import timedelta

def upload_document(employee_id: str, doc_id: str, pdf_data: bytes) -> str:
    """
    Uploads a generated PDF document to MinIO under the humanai-documents bucket.
    Path format: humanai-documents/{employee_id}/{doc_id}.pdf
    """
    bucket = settings.MINIO_BUCKET_DOCUMENTS or "humanai-documents"
    object_name = f"{employee_id}/{doc_id}.pdf"
    return upload_bytes(bucket, object_name, pdf_data, "application/pdf")

def get_document_presigned_url(minio_path: str) -> str:
    """
    Generates a presigned GET URL for a document in MinIO with a 10-minute TTL.
    """
    if not minio_path or "/" not in minio_path:
        raise ValueError("Chemin MinIO invalide")
        
    bucket, object_name = minio_path.split("/", 1)
    client = get_minio_client()
    # 10 minutes TTL as required by the specifications
    return client.presigned_get_object(bucket, object_name, expires=timedelta(minutes=10))
