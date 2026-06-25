# =============================================
# HumaNai n8n Workflows — Setup Guide
# =============================================

## Two AI Flows Included

### 1. Assistant IA (RAG) — `assistant_flow.json`
Triggered by: `POST http://localhost:5678/webhook/assistant`

**Flow steps:**
1. **Webhook** — Receives `{message, session_id, user: {uid, email, role}}`
2. **Parse Input** — Extracts fields, maps user role to a security context
3. **Fetch RAG Context** — Calls backend to list available RAG documents
4. **Build RAG Context** — Injects relevant document titles into the prompt
5. **Build LLM Prompt** — Constructs system + user messages with role-aware rules
6. **Call LLM (OpenRouter)** — Sends to `google/gemini-2.5-flash` (configurable)
7. **Format Response** — Extracts the LLM answer
8. **Respond** — Returns `{response: "...", session_id: "..."}`

---

### 2. Document Generation Agent — `doc_gen_flow.json`
Triggered by: `POST http://localhost:5678/webhook/doc-gen`

**Flow steps:**
1. **Webhook** — Receives full document context: template + employee data + absences
2. **Parse & Validate Input** — Checks required fields, builds absence summary
3. **Build Document Prompt** — Constructs a strict JSON-output prompt with all employee data
4. **Call LLM (OpenRouter)** — Sends to model with `response_format: json_object`
5. **Parse & Validate Doc** — Parses JSON, runs programmatic checks:
   - Residual `{{variables}}` in HTML → blocking issue
   - Missing or invalid matricule → blocking issue
   - Future hire date → blocking issue
6. **Respond** — Returns `{content_html, variables_used, missing_variables, coherence_issues, needs_human_review, summary_for_log}`

---

## How to Import the Flows

### Option A: Auto-import (recommended)
The workflows are mounted into n8n's data directory. When you start n8n:
```bash
cd infra/
docker-compose up -d n8n
```
Then navigate to http://localhost:5678 → **Workflows** — they should already appear.
If not, use Option B.

### Option B: Manual import
1. Open http://localhost:5678
2. Click **"New Workflow"** → **"Import from file"**
3. Select `infra/n8n/workflows/assistant_flow.json`
4. Repeat for `doc_gen_flow.json`

---

## Setting Up the OpenRouter Credential

Both flows use an HTTP Header Auth credential named **"OpenRouter API Key"**.

1. In n8n, go to **Settings → Credentials → New Credential**
2. Choose **"Header Auth"**
3. Name it: `OpenRouter API Key`
4. Header Name: `Authorization`
5. Header Value: `Bearer YOUR_OPENROUTER_API_KEY`

Your OpenRouter API key is in `humanai_backend/.env`:
```
OPENROUTER_API_KEY=sk-or-v1-xxxx
```

---

## Activating the Flows

After import, each workflow must be **toggled to Active** using the toggle switch 
in the top-right corner of the workflow editor in n8n.

Only active workflows respond to webhook calls.
