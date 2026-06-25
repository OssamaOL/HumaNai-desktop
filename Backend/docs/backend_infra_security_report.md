# Backend and Infrastructure Security Assessment

**Project:** HumaNai backend and local infrastructure  
**Date:** 2026-06-23  
**Scope:** Static review of `humanai_backend`, `infra`, GitHub Actions, local environment structure, security tests, Docker/Nginx/Redis/Postgres/n8n/monitoring configuration, and automated Python dependency/SAST scans.  
**Auditor**: DevSecOps Team (Rayane, Oussama, Issa)  
**Out of scope:** Destructive testing, brute force, third-party account access, and exploitation of public internet targets.

## Executive Summary

The project has meaningful security controls: Firebase auth, role dependencies on most business routes, HMAC protection for `/api/v1/internal/*`, PostgreSQL RLS on some core tables, Redis-backed rate limiting, security headers, a non-root backend container user, HTML sanitization, and document-generation guardrails.

The current codebase is still **not production-ready**. The most serious risks are:

- A tracked Firebase Admin service account private key.
- Public self-signup that lets the caller choose privileged roles.
- Development JWT fallback using a default app secret.
- RLS missing from many tenant-scoped tables.
- RLS may be bypassed entirely if the app connects as the table owner.
- Manager/collaborator routes that rely on incomplete RLS or do not verify ownership before reading/updating records.
- Exposed infrastructure/admin ports and unsafe n8n defaults.
- Public metrics/docs/test surfaces.
- Unpinned dependencies/images and one known vulnerable dependency.

## Verification Performed

- Reviewed backend entrypoint, config, auth, middleware, routers, services, workers, models, database schema, RLS SQL, CI, Docker Compose, Nginx, Redis, Prometheus, Grafana, and `.gitignore`.
- Searched for secrets, default credentials, unsafe route surfaces, broad infrastructure exposure, SQL construction, file upload handling, caching scope, and RLS coverage.
- Ran the full backend test suite:
  - `python -m pytest -q`
  - Result: **42 passed**, 6 warnings.
- Ran security-focused tests:
  - `python -m pytest tests/test_security.py tests/test_production_security.py -q`
  - Result: **11 passed**, 2 warnings.
- Installed and ran Bandit:
  - `python -m bandit -r app -f txt`
  - Result: **7 low severity findings**, all `B110 try_except_pass`.
- Installed and ran pip-audit:
  - `python -m pip_audit -r requirements.txt`
  - Result: **1 known vulnerability**: `msgpack 1.1.2`, `GHSA-6v7p-g79w-8964`, fixed in `1.2.1`.
- Attempted Semgrep:
  - Local Semgrep wrapper failed with `pysemgrep` execution error. No Semgrep result is claimed.

## Critical Findings

### 1. Firebase Admin Service Account Private Key Is Tracked

**Severity:** Critical  
**Evidence:** `humanai_backend/service-account.json` is tracked by git. `humanai_backend/constfirebase.txt` is also tracked. `.gitignore` excludes `.env` files but not Firebase service account JSON files.

**Impact:** Anyone with repository or history access may be able to impersonate the Firebase Admin SDK service account, manage users, set claims, or access Firebase-linked resources depending on IAM permissions.

**Remediation:**

- Revoke and rotate the Firebase service account key immediately.
- Remove the file from the repository and git history.
- Store service-account material in a secret manager or deployment secret mount.
- Add ignore rules for `*service-account*.json`, `firebase-adminsdk*.json`, `*.pem`, and similar key files.
- Add CI secret scanning with Gitleaks or TruffleHog.

### 2. Public Signup Allows Role Self-Assignment

**Severity:** Critical  
**Evidence:** `humanai_backend/app/routers/auth.py:19` defines `role: str = "collaborateur"` in the public signup payload. `humanai_backend/app/routers/auth.py:36-55` creates the Firebase user, sets custom claims from `payload.role`, and inserts that role into the database without requiring admin approval.

**Impact:** An unauthenticated caller can request `admin`, `rh`, `direction`, or other privileged roles at account creation time. In production this can become full privilege escalation.

**Remediation:**

- Remove role and department from public signup.
- Default every self-service signup to the lowest privilege.
- Move role assignment to an authenticated admin/RH workflow.
- Add tests proving unauthenticated signup cannot assign privileged roles.

### 3. Development JWT Fallback Can Become an Auth Bypass

**Severity:** Critical if enabled outside local dev; High in local dev  
**Evidence:** `humanai_backend/app/middleware/firebase_auth.py:50` accepts locally signed HS256 JWTs when `APP_ENV == "development"`. `humanai_backend/app/routers/auth.py:87-99` can mint mock tokens. The signing key comes from `APP_ENCRYPTION_KEY`, which defaults to a placeholder in `humanai_backend/app/config.py:25`.

**Impact:** If development mode or default keys reach a shared environment, an attacker can forge roles and tenant claims.

**Remediation:**

- Remove dev-token verification from the normal auth middleware, or gate it behind an explicit `ALLOW_DEV_AUTH=false` setting.
- Fail startup when `APP_ENV != "development"` and any secret equals a placeholder.
- Use separate keys for dev JWTs, HMAC signing, and database encryption.

### 4. RLS Is Missing on Many Tenant-Scoped Tables

**Severity:** Critical  
**Evidence:** `infra/postgres/init/01_schema.sql` defines 30 tenant-scoped tables. `infra/postgres/init/02_rls.sql:4-16` enables RLS on only 13 tables. Missing tenant-scoped tables include `sites`, `departments`, `positions`, `onboarding_plans`, `onboarding_steps`, `offboarding_workflows`, `offboarding_steps`, `engagement_surveys`, `survey_responses`, `disengagement_signals`, `hr_alerts`, `ai_security_rules`, `ai_interactions`, `ai_security_events`, `data_consents`, and `data_requests`.

**Impact:** Any query path that reaches these tables can bypass database-level tenant isolation. This is especially risky because multiple routers query these models directly and often rely on app-level role checks only.

**Remediation:**

- Enable RLS and create tenant policies for every table with `tenant_id`.
- Add `WITH CHECK` policies for inserts/updates.
- Add tests that enumerate schema tables with `tenant_id` and fail if RLS is not enabled.

### 5. RLS May Be Bypassed by the Application Database Owner

**Severity:** Critical  
**Evidence:** The Docker Compose database is initialized with `POSTGRES_USER` from `infra/docker-compose.yml:11`, and the app defaults to connecting as `humanai_user` in `humanai_backend/app/config.py:6`. The schema and RLS scripts run during container initialization, which means the same configured Postgres user is likely the table owner. `infra/postgres/init/02_rls.sql` enables RLS, but there is no `ALTER TABLE ... FORCE ROW LEVEL SECURITY`.

**Impact:** In PostgreSQL, table owners bypass RLS unless `FORCE ROW LEVEL SECURITY` is enabled or the application connects with a separate non-owner role. If the app uses the owner role, RLS policies may not protect tenant data at runtime.

**Remediation:**

- Create a separate migration/owner role and a least-privilege application role.
- Grant only required DML permissions to the app role.
- Add `ALTER TABLE ... FORCE ROW LEVEL SECURITY` for protected tables where appropriate.
- Add an integration test that connects as the app DB user and proves cross-tenant rows are blocked.

## High Findings

### 6. Manager IDOR and Over-Broad Object Access

**Severity:** High  
**Evidence:** Several manager-accessible routes retrieve objects by arbitrary IDs without proving the object belongs to the manager's team before returning or mutating it:

- `humanai_backend/app/routers/employees.py:105-115` lets `manager` read `/{employee_id}`.
- `humanai_backend/app/routers/absences.py:150-185` lets `manager` approve/reject `/{absence_id}`.
- `humanai_backend/app/routers/alerts.py:23-39`, `:47-60` lets `manager` list/read/mark arbitrary HR alerts without team filtering.
- `humanai_backend/app/routers/engagement.py:113-118` lets `manager` read any disengagement signal by `signal_id`.
- `humanai_backend/app/routers/engagement.py:125-130` lets `manager` update action plans by `signal_id`.
- `humanai_backend/app/routers/offboarding.py:84-94` lets `manager` read any offboarding workflow by `workflow_id`.
- `humanai_backend/app/routers/offboarding.py:105-120` lets `manager` update any offboarding step by `step_id`.
- `humanai_backend/app/routers/onboarding.py:141-148`, `:151-164`, and `:167-177` let any authenticated user read/update/progress-check onboarding steps by IDs without first verifying plan ownership.

**Impact:** A manager or authenticated employee who obtains another object's UUID can access or change HR records outside their department or ownership boundary.

**Remediation:**

- For every object route, load the related employee/plan/workflow and verify tenant plus ownership/team scope before returning data or mutating state.
- Do not rely only on role checks for object-specific access.
- Add IDOR tests for manager and collaborator roles using records from another department.

### 7. Tenant IDs Are Often Not Set on Inserts

**Severity:** High  
**Evidence:** Many create paths instantiate tenant-scoped models without setting `tenant_id`, relying on the model/database default `default-tenant`. Examples include employees in `humanai_backend/app/routers/employees.py:81` and `:170`, RAG documents in `humanai_backend/app/routers/assistant.py:181`, surveys in `humanai_backend/app/routers/engagement.py:38`, annual reviews in `humanai_backend/app/routers/engagement.py:83`, alerts in `humanai_backend/app/routers/assistant.py:50`, and security rules in `humanai_backend/app/routers/alerts.py:96`.

**Impact:** Multi-tenant data can be inserted into the wrong tenant, usually `default-tenant`, causing data commingling and breaking RLS assumptions.

**Remediation:**

- Require every tenant-scoped insert to set `tenant_id=user.tenant_id` or a trusted system tenant context.
- Add database `WITH CHECK` RLS policies that reject mismatched tenant IDs.
- Remove unsafe model defaults for production tables.

### 8. Assistant Conversation Routes Are Not Scoped to the Current User

**Severity:** High  
**Evidence:** `humanai_backend/app/routers/assistant.py:111-135` lists distinct sessions, reads a session by `session_id`, and deletes a session without filtering by the current user's database ID. The chat logger uses a placeholder random `user_id` at `humanai_backend/app/routers/assistant.py:101`, making reliable ownership checks impossible.

**Impact:** Any authenticated user may enumerate, read, or delete other users' assistant sessions if they know or can discover a session UUID.

**Remediation:**

- Store the real database user ID and tenant ID for every interaction.
- Filter session list/read/delete by current user unless the caller has an explicit admin supervision role.
- Add tests proving users cannot read or delete another user's chat session.

### 9. Stateful Infrastructure Ports Are Exposed on the Host

**Severity:** High  
**Evidence:** `infra/docker-compose.yml` publishes Postgres `5432`, Redis `6379`, MinIO `9000/9001`, Prometheus `9090`, Grafana `3001`, and n8n `5678`.

**Impact:** On a server or shared developer network, stateful services and admin UIs can become directly reachable unless protected by host firewalling.

**Remediation:**

- Bind local services to `127.0.0.1`.
- Do not publish Postgres, Redis, MinIO API, Prometheus, or n8n directly in production.
- Put admin UIs behind VPN/SSO/reverse proxy auth.

### 10. n8n Defaults and Function Permissions Are Unsafe

**Severity:** High  
**Evidence:** `infra/docker-compose.yml:92` has a fallback n8n encryption key, `:94` enables the public API, `:100` sets `NODE_FUNCTION_ALLOW_BUILTIN=*`, `:102` defaults basic auth to false, and `:104/:133` default the password to `changeme`.

**Impact:** If n8n is reachable, workflow users may execute powerful code and access environment secrets. Weak/default auth increases takeover risk.

**Remediation:**

- Require SSO or strong basic auth outside local-only development.
- Remove fallback credentials and fallback encryption keys.
- Restrict `NODE_FUNCTION_ALLOW_BUILTIN` to only required modules, ideally just `crypto`.
- Disable the public API except during controlled workflow import.

### 11. Legacy Internal RAG Endpoint Uses Static Token Instead of HMAC

**Severity:** High  
**Evidence:** `/api/v1/internal/*` is HMAC-protected in `humanai_backend/app/routers/internal_api.py:35`, but `humanai_backend/app/routers/assistant.py:158-169` exposes `/api/v1/assistant/internal/rag-context` with only `X-Internal-Token`.

**Impact:** Static internal tokens are replayable and leak-prone compared with the timestamp/nonce HMAC scheme used elsewhere.

**Remediation:**

- Remove the route if obsolete.
- Otherwise move it under `internal_api.py` and apply HMAC verification.
- Rotate the old internal token after migration.

### 12. Public Metrics, Docs/OpenAPI, and Test Page

**Severity:** High in production; Medium in local dev  
**Evidence:** `humanai_backend/app/main.py:73` exposes `/metrics`; `humanai_backend/app/main.py:84-90` serves `/test`; rate limiting bypasses docs and OpenAPI at `humanai_backend/app/middleware/rate_limit.py:21-22`.

**Impact:** Metrics and OpenAPI schemas reveal operational and route information. Test pages increase attack surface and may expose auth behavior.

**Remediation:**

- Disable `/test` outside local development.
- Protect `/metrics` with network allowlists or auth.
- Disable or protect `/docs`, `/redoc`, and `/openapi.json` outside non-production environments.

### 13. File Uploads Lack Size, Type, and Content Controls

**Severity:** High  
**Evidence:** `humanai_backend/app/routers/employees.py:160-171` reads the entire uploaded CSV into memory. `humanai_backend/app/routers/assistant.py:173-184` reads the entire RAG document into memory, decodes with ignored errors, stores the original filename as title, and queues content without content-type, extension, or size validation.

**Impact:** Authenticated RH/admin users can accidentally or maliciously upload oversized files causing memory pressure, ingest unexpected binary content, or poison the RAG corpus.

**Remediation:**

- Enforce upload size limits at Nginx and FastAPI.
- Validate MIME type, extension, and CSV structure.
- Stream large files where possible.
- Normalize filenames/titles and scan uploaded knowledge documents before ingestion.

### 14. Cache Keys Omit Tenant/User Scope

**Severity:** High  
**Evidence:** Assistant response cache uses `message + user.role` only at `humanai_backend/app/routers/assistant.py:60`. Dashboard KPI caches use keys such as `kpi:overview:{period}` and `kpi:kpis:{scope}:{dept_id}:{period}` at `humanai_backend/app/routers/dashboard.py:28` and `:36`.

**Impact:** Cached answers or KPI data can leak across tenants, departments, or users when requests share the same role/message/period parameters.

**Remediation:**

- Include tenant ID and the relevant user/department scope in all cache keys.
- Treat LLM/RAG answers as user-scoped unless proven safe to share.
- Add tests for cross-tenant cache separation.

## Medium Findings

### 15. Sensitive Fields Marked Encrypted Are Often Stored/Returned Plaintext

**Severity:** Medium  
**Evidence:** Schema comments mark `salary_band`, annual review `notes`, and AI `query_text` as encrypted in `infra/postgres/init/01_schema.sql:78`, `:268`, and `:320`. Some paths encrypt document snapshots and one interaction logger encrypts query text, but `humanai_backend/app/routers/assistant.py:103` stores chat `query_text` directly, and annual review notes are assigned directly in `humanai_backend/app/routers/engagement.py:83` and `:92`.

**Impact:** HR notes and assistant prompts can contain sensitive personal data and may be stored or returned without encryption.

**Remediation:**

- Centralize encryption/decryption for fields requiring confidentiality.
- Ensure every write path uses encryption consistently.
- Avoid returning plaintext sensitive fields unless explicitly authorized and audited.

### 16. CORS Allows All Methods and Headers with Credentials

**Severity:** Medium  
**Evidence:** `humanai_backend/app/main.py:47-49` sets `allow_credentials=True`, `allow_methods=["*"]`, and `allow_headers=["*"]`.

**Impact:** Origin allowlisting helps, but broad methods/headers increase browser attack surface if an allowed frontend origin is compromised or misconfigured.

**Remediation:**

- Restrict methods and headers to the frontend's actual needs.
- Ensure production `CORS_ORIGINS` contains only HTTPS frontend origins.

### 17. Password Reset Endpoint Returns the Reset Link

**Severity:** Medium  
**Evidence:** `humanai_backend/app/routers/auth.py:139-141` generates a Firebase password reset link and returns it in the API response.

**Impact:** Reset links are sensitive. Returning them to the caller can enable account takeover if the endpoint is abused or responses are logged.

**Remediation:**

- Send password reset links through Firebase or a mail service.
- Return only a generic success response.
- Add endpoint-specific rate limiting and anti-enumeration behavior.

### 18. Dependency and Container Versions Are Mutable or Lower-Bound Only

**Severity:** Medium  
**Evidence:** `humanai_backend/requirements.txt` uses lower-bound-only dependencies. Compose uses mutable image tags such as `minio/minio:latest`, `prom/prometheus:latest`, `grafana/grafana:latest`, `docker.n8n.io/n8nio/n8n:latest`, and `curlimages/curl:latest`.

**Impact:** Builds are not reproducible and can pull vulnerable or breaking versions.

**Remediation:**

- Pin Python dependencies with a lockfile and hashes.
- Pin container images by version and preferably digest.
- Keep Trivy/pip-audit scans blocking for high/critical findings.

### 19. Known Vulnerable Transitive Dependency

**Severity:** Medium  
**Evidence:** `python -m pip_audit -r requirements.txt` found `msgpack 1.1.2`, `GHSA-6v7p-g79w-8964`, fixed in `1.2.1`.

**Impact:** The precise exploitability depends on where `msgpack` is used in the dependency graph, but the package is known vulnerable and should be updated.

**Remediation:**

- Constrain `msgpack>=1.2.1` if compatible.
- Regenerate and test the dependency lock.

### 20. HSTS Is Emitted Unconditionally

**Severity:** Medium  
**Evidence:** `humanai_backend/app/middleware/security.py` always sets `Strict-Transport-Security`.

**Impact:** HSTS should only be emitted when HTTPS is guaranteed end-to-end. Unconditional local HTTP emission can confuse testing/proxy behavior.

**Remediation:**

- Emit HSTS only in production and only for HTTPS or trusted TLS-terminated requests.

## Low Findings

### 21. Bandit: Swallowed Exceptions Reduce Security Observability

**Severity:** Low  
**Evidence:** Bandit found 7 `B110 try_except_pass` cases in `app/database.py`, `app/middleware/rate_limit.py`, `app/routers/admin.py`, `app/routers/auth.py`, and `app/services/feature_flags.py`.

**Impact:** Silent failures can hide security control failures, especially rate limiting and RLS context setup.

**Remediation:**

- Log exceptions with structured, non-sensitive context.
- Avoid silent fail-open behavior for security-critical controls unless explicitly justified and monitored.

## Positive Controls Observed

- HMAC request signing includes timestamp freshness and Redis nonce replay protection for `/api/v1/internal/*`.
- RLS context is set using parameterized `set_config` calls.
- Redis-backed rate limiting exists for `/api/v1` routes.
- Security headers include frame, content-type, referrer, CSP, and HSTS controls.
- Backend Dockerfile runs as a non-root `humanai` user.
- Generated document HTML is sanitized with Bleach and no attributes are allowed.
- Security and full backend test suites pass locally.
- CI includes flake8, Bandit, Safety, pytest, and Trivy image scans.

## Recommended Remediation Order

1. Revoke and remove the tracked Firebase service account key and clean git history.
2. Lock down signup so users cannot self-assign roles.
3. Disable/hard-gate development JWT fallback and reject placeholder secrets at startup.
4. Split database owner and application roles, force/test RLS, then enable RLS on every tenant-scoped table.
5. Ensure every tenant-scoped insert sets the correct tenant ID.
6. Fix manager/collaborator IDOR paths and assistant session ownership.
7. Lock down Compose port publishing, n8n auth, n8n public API, and Node built-ins.
8. Protect `/metrics`, `/docs`, `/openapi.json`, and `/test`.
9. Add upload size/type/content validation for CSV and RAG uploads.
10. Add tenant/user scope to cache keys.
11. Pin dependencies/images and update vulnerable `msgpack`.

## Residual Risk

The existing tests prove some core controls work, especially HMAC/RBAC/RLS behavior covered by the test suite. They do **not** prove the whole project is secure. The strongest residual risks are authorization boundary gaps, incomplete tenant isolation, and operational secret/infrastructure exposure.
