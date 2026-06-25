# HumaNai Backend Refactoring & Technical Integration Report

**Project**: HumaNai Platform (IA RH — YDAYS 2026)  
**Date**: 22 June 2026  
**Authors**: Backend Team (Rayane, Daren)  
**Status**: COMPLETED & INTEGRATED

---

## 1. Executive Summary

This report documents the architectural improvements, new services, and technical integrations implemented in the HumaNai FastAPI backend. To prepare the platform for enterprise-grade SaaS production, we modernized multi-tenant database isolation, implemented a real semantic RAG pipeline, refactored background workers with Redis idempotency and concurrency locking, and established HMAC-signed internal APIs.

---

## 2. Multi-Tenant Database Isolation

To enforce complete tenant data isolation and prevent cross-tenant leaks (e.g. users or documents belonging to other companies), we updated the database layer:

1. **SQLAlchemy Model Updates**: Added `tenant_id` (indexed `VARCHAR`) to all business models:
   - `User`, `Employee`, `Absence`, `DocumentTemplate`, `GeneratedDocument`, `AuditLog`.
   - Added `correlation_id` to trace operations end-to-end.
2. **PostgreSQL Row-Level Security (RLS)**: Enforced isolation at the database engine level via tables' RLS policies.
3. **Session-Level Context Injection**: Implemented `set_rls_context(session, user_id, role, dept_id, tenant_id)` in `app/database.py`. The backend sets session-local configs safely before executing queries:
   ```python
   await session.execute(
       text("SELECT set_config('app.tenant_id', :tenant_id, true);"),
       {"tenant_id": str(tenant_id)}
   )
   ```

---

## 3. Secure RAG Semantic Search Pipeline

The mock document listing system was replaced with a fully functional Retrieval-Augmented Generation (RAG) vector search pipeline:

### 3.1. RAG Ingestion Worker (`rag_ingest_worker.py`)
- **Queue**: Listens to the `rag-ingest` BullMQ queue.
- **Chunking Engine**: Implemented a dynamic text-splitting algorithm (500–1000 character windows) that respects paragraph breaks (`\n\n`) and includes a 100-character overlap for context conservation.
- **Embedding Generation**: Calls OpenAI's `text-embedding-3-small` (1536-dimensional vectors) via the asynchronous `openai` client.
- **Access Control Isolation**: Fetches allowed roles from `RagDocumentAccess` and bulk inserts chunks into the `rag_chunks` table containing `tenant_id` and the `role_access` string array.

### 3.2. Vector Search Endpoint (`/assistant/context`)
- **Route**: `POST /api/v1/internal/assistant/context`
- **Method**: Embeds the user's chat message and queries Postgres using the `pgvector` cosine distance operator (`<=>`):
  ```sql
  SELECT content 
  FROM rag_chunks 
  WHERE tenant_id = :tenant_id 
    AND :role = ANY(role_access)
  ORDER BY embedding <=> :query_embedding 
  LIMIT 5;
  ```
- **PII Guardrail**: Applies regex-based masking to mask sensitive employee details (e.g., CIN, CNSS, salary numbers) before projecting context to the LLM.

---

## 4. Document Generation & Concurrency Orchestrator

The document generation workflow has been refactored to enforce data consistency and concurrency safety:

### 4.1. Concurrency Job Locking (Redis)
- Implemented `set_lock(lock_key, ttl=300)` and `release_lock(lock_key)` in `app/redis_client.py`.
- Prevents concurrent generation requests for the same employee:
  ```python
  lock_key = f"lock:doc_gen:{employee_id}"
  if not await set_lock(lock_key, ttl=300):
      return None, "Une génération de document est déjà en cours pour cet employé."
  ```

### 4.2. Document Generation Worker (`doc_gen_worker.py`)
- Retrieves job data containing `job_id`, `idempotency_key`, and `correlation_id` from the `doc-gen` queue.
- Implements **Deduplication / Idempotency Check**: Verifies if the job has already been processed to prevent double document creation.
- Fetches context from `/doc-gen/context` and triggers n8n orchestrator workflow.
- Receives generated HTML, sends it to the secure `/doc-gen/save` endpoint (which performs Bleach tag filtering, checks for prompt injection/hallucinations, and commits atomically).
- Generates PDF binary using **WeasyPrint** (or mock fallback in dev environment) and uploads to MinIO bucket.

---

## 5. Signed Internal APIs (HMAC)

Workers and external orchestrators (n8n) communicate with backend internal endpoints `/api/v1/internal/*` using HMAC-SHA256 signature verification to prevent spoofing or unauthorized queries:

- **Formula**: `Signature = HMAC_SHA256(APP_ENCRYPTION_KEY, body + timestamp + nonce)`.
- **Headers**:
  - `X-Signature`: HMAC string.
  - `X-Timestamp`: Unix epoch string (rejected if `|current_time - timestamp| > 30s` to prevent replay attacks).
  - `X-Nonce`: Unique UUID stored in Redis for 60 seconds (rejected if nonce already used).

---

## 6. Database Schema & Migration Status

The database contains the following structural tables:
- `document_generation_rules`: Holds policies per document type (quotas, approval flags, allowed roles).
- `document_requests`: Tracks request life-cycle status (`DRAFT`, `PENDING_MANAGER`, `PENDING_RH`, `APPROVED`, etc.).
- `policy_decision_logs`: Records policy decision context traces.
- `rag_documents` / `rag_chunks`: Holds knowledge documents and embedded vectors.

Seeding script `/postgres/init/03_seed.sql` has been executed successfully to populate the database with default profiles and RBAC rules.
