import asyncio
import uuid
import logging
import json
from typing import List
from sqlalchemy import select, delete

from app.database import AsyncSessionLocal
from app.models.rag import RagDocument, RagChunk, RagDocumentAccess
from app.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("rag_ingest_worker")

def chunk_text(text: str, min_size: int = 500, max_size: int = 1000, overlap: int = 100) -> List[str]:
    """Splits raw text into overlapping semantic/character chunks."""
    chunks = []
    if len(text) <= max_size:
        return [text]
    
    start = 0
    while start < len(text):
        end = start + max_size
        if end >= len(text):
            chunks.append(text[start:])
            break
        
        # Try to find a good split point in the boundary region
        search_region = text[start + min_size:end]
        split_idx = -1
        for separator in ["\n\n", "\n", ". ", " "]:
            idx = search_region.rfind(separator)
            if idx != -1:
                split_idx = start + min_size + idx + len(separator)
                break
        
        if split_idx == -1:
            split_idx = end
            
        chunks.append(text[start:split_idx].strip())
        start = split_idx - overlap
        if start < 0:
            start = 0
            
    return chunks

def count_tokens(text: str) -> int:
    """Estimates or calculates tiktoken tokens count for a chunk."""
    try:
        import tiktoken
        encoding = tiktoken.get_encoding("cl100k_base")
        return len(encoding.encode(text))
    except Exception:
        # Fallback to character-count rough approximation
        return max(1, len(text) // 4)

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

async def handle_job(job_data: dict):
    doc_id_str = job_data.get("doc_id")
    if not doc_id_str:
        logger.error("No doc_id in job data")
        return
        
    doc_uuid = uuid.UUID(doc_id_str)
    
    async with AsyncSessionLocal() as session:
        try:
            # 1. Fetch RagDocument
            doc_stmt = select(RagDocument).where(RagDocument.id == doc_uuid)
            doc_res = await session.execute(doc_stmt)
            doc = doc_res.scalar_one_or_none()
            if not doc:
                logger.error(f"RagDocument {doc_uuid} not found")
                return
                
            tenant_id = doc.tenant_id
            content_raw = doc.content_raw or ""
            
            # 2. Fetch allowed roles from RagDocumentAccess
            access_stmt = select(RagDocumentAccess.allowed_role).where(RagDocumentAccess.document_id == doc_uuid)
            access_res = await session.execute(access_stmt)
            allowed_roles = [r for r in access_res.scalars().all()]
            
            # Default roles if none specified
            if not allowed_roles:
                allowed_roles = ["collaborateur", "manager", "rh", "admin", "direction", "qvt"]
                
            # 3. Clean up existing chunks for this document
            delete_stmt = delete(RagChunk).where(RagChunk.document_id == doc_uuid)
            await session.execute(delete_stmt)
            
            # 4. Chunk text
            chunks = chunk_text(content_raw)
            logger.info(f"Splitting document {doc_uuid} into {len(chunks)} chunks...")
            
            # 5. Process chunks and generate embeddings
            for idx, chunk_content in enumerate(chunks):
                if not chunk_content.strip():
                    continue
                embedding = await get_embedding(chunk_content)
                token_count = count_tokens(chunk_content)
                
                chunk_obj = RagChunk(
                    id=uuid.uuid4(),
                    tenant_id=tenant_id,
                    document_id=doc_uuid,
                    chunk_index=idx,
                    content=chunk_content,
                    embedding=embedding,
                    token_count=token_count,
                    role_access=allowed_roles
                )
                session.add(chunk_obj)
                
            await session.commit()
            logger.info(f"Successfully indexed document {doc_uuid} with {len(chunks)} chunks.")
            
        except Exception as e:
            await session.rollback()
            logger.error(f"Error processing RAG ingestion for document {doc_uuid}: {e}")
            raise e

async def bullmq_processor(job, job_token=None):
    """
    BullMQ job processor wrapper.
    """
    logger.info(f"Processing RAG ingestion job {job.id}...")
    data = job.data
    if isinstance(data, str):
        data = json.loads(data)
    await handle_job(data)

async def main():
    from bullmq import Worker
    logger.info("Starting BullMQ worker 'rag-ingest'...")
    worker = Worker("rag-ingest", bullmq_processor, {"connection": settings.REDIS_URL})
    
    try:
        while True:
            await asyncio.sleep(1)
    except (KeyboardInterrupt, asyncio.CancelledError):
        logger.info("Stopping RAG ingest worker...")
    finally:
        await worker.close()

if __name__ == "__main__":
    asyncio.run(main())
