# HumaNai — Plateforme RH Intelligente

> Full-stack HR platform with an AI assistant powered by n8n + OpenRouter (Gemini 2.5 Flash), built with React/Electron (frontend) and FastAPI (backend).

---

## Architecture

```
Electron (frontend)
  └── React/Vite  :5173
        └── api.js → http://localhost:8000/api/v1
                          └── FastAPI (backend)
                                ├── PostgreSQL  :5432  (Docker)
                                ├── Redis       :6379  (Docker)
                                ├── MinIO       :9000  (Docker)
                                └── n8n         :5678  (Docker)
                                      └── OpenRouter (Gemini 2.5 Flash)
```

---

## Features

- **AI Assistant** — role-aware HR chatbot (admin, RH, manager, collaborateur) via n8n + OpenRouter
- **Employee Management** — full CRUD with contract types, departments, status
- **Absence Management** — requests, approvals, rejections
- **Onboarding** — AI-generated onboarding plans
- **Document Generation** — AI-filled HR document templates
- **Analytics** — KPI dashboard with charts
- **Role-based access control** — admin, rh, manager, collaborateur, direction, qvt
- **Electron desktop app** — runs as a native Windows application
- **Docker** — full stack runs with one command
- **CI/CD** — GitHub Actions for build checks and Windows `.exe` packaging

---

## Prerequisites

- [Node.js 20+](https://nodejs.org/)
- [Python 3.12+](https://www.python.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Git](https://git-scm.com/)

---

## Quick Start

### 1 — Clone the repos

```bash
git clone https://github.com/YOUR_USERNAME/humain-ai-main.git
git clone https://github.com/YOUR_USERNAME/hr-platform-desktop.git
```

### 2 — Configure the backend environment

Copy the example env file and fill in your values:

```bash
cd humain-ai-main/humanai_backend
cp .env.example .env
```

Open `.env` and set at minimum:

```dotenv
POSTGRES_USER=humanai_user
POSTGRES_PASSWORD=humanai2026
DATABASE_URL=postgresql+asyncpg://humanai_user:humanai2026@localhost:5432/humanai_db
APP_ENCRYPTION_KEY=HumaNai2026SecretKeyForJWT32Chr
APP_ENV=development
OPENROUTER_API_KEY=your_openrouter_key_here
N8N_WEBHOOK_URL_ASSISTANT=http://localhost:5678/webhook/assistant
N8N_WEBHOOK_URL_DOC_GEN=http://localhost:5678/webhook/doc-gen
```

> **Note:** Leave `FIREBASE_PROJECT_ID` and `FIREBASE_API_KEY` as-is. In `development` mode the app bypasses Firebase completely and uses local JWT — no Firebase setup needed.

### 3 — Firebase service account (dev mode — skip this)

> ⚠️ `service-account.json` is a Firebase Admin SDK credential. It is **never committed to GitHub** for security reasons.
>
> In `development` mode (`APP_ENV=development`) the backend bypasses Firebase entirely. You do **not** need `service-account.json` to run locally.
>
> If you are deploying to **production** and need Firebase auth, obtain your `service-account.json` from the Firebase Console → Project Settings → Service Accounts → Generate new private key, and place it at `humanai_backend/service-account.json`. Never commit this file.

### 4 — Start Docker (database, Redis, n8n, MinIO)

```bash
cd humain-ai-main/infra
docker compose up -d
```

Wait ~30 seconds for all containers to be healthy:

```bash
docker compose ps
```

### 5 — Set up the database

```bash
# Create the humanai_user
docker exec humanai_postgres psql -U postgres -d humanai_db -c "CREATE USER humanai_user WITH PASSWORD 'humanai2026';"

# Grant permissions
docker exec humanai_postgres psql -U postgres -d humanai_db -c "GRANT ALL PRIVILEGES ON DATABASE humanai_db TO humanai_user; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO humanai_user; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO humanai_user;"

# Seed the database
docker cp infra/postgres/init/03_seed.sql humanai_postgres:/tmp/03_seed.sql
docker exec humanai_postgres psql -U postgres -d humanai_db -f /tmp/03_seed.sql

# Disable Row Level Security for dev mode
docker exec humanai_postgres psql -U postgres -d humanai_db -c "ALTER TABLE users DISABLE ROW LEVEL SECURITY; ALTER TABLE employees DISABLE ROW LEVEL SECURITY; ALTER TABLE absences DISABLE ROW LEVEL SECURITY; ALTER TABLE hr_alerts DISABLE ROW LEVEL SECURITY; ALTER TABLE ai_interactions DISABLE ROW LEVEL SECURITY; ALTER TABLE departments DISABLE ROW LEVEL SECURITY; ALTER TABLE positions DISABLE ROW LEVEL SECURITY; ALTER TABLE sites DISABLE ROW LEVEL SECURITY; ALTER TABLE document_templates DISABLE ROW LEVEL SECURITY; ALTER TABLE onboarding_plans DISABLE ROW LEVEL SECURITY; ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;"
```

### 6 — Import n8n workflows

Get your n8n API key from http://localhost:5678 → Settings → n8n API → Create API key, then run inside the n8n container:

```bash
docker exec humanai_n8n node -e "
const fs = require('fs');
const http = require('http');
const KEY = 'YOUR_N8N_API_KEY';

function importWorkflow(file) {
  const raw = JSON.parse(fs.readFileSync(file));
  delete raw.id; delete raw.tags; delete raw.pinData; delete raw.staticData; delete raw.active;
  const data = Buffer.from(JSON.stringify(raw));
  const req = http.request({
    host:'localhost',port:5678,path:'/api/v1/workflows',method:'POST',
    headers:{'Content-Type':'application/json','X-N8N-API-KEY':KEY,'Content-Length':data.length}
  }, res=>{let b='';res.on('data',d=>b+=d);res.on('end',()=>{
    const id=JSON.parse(b).id;
    console.log(file+' => imported ID:'+id);
    const d2=Buffer.from(JSON.stringify({active:true}));
    const r2=http.request({host:'localhost',port:5678,path:'/api/v1/workflows/'+id+'/activate',method:'POST',headers:{'Content-Type':'application/json','X-N8N-API-KEY':KEY,'Content-Length':d2.length}},()=>console.log('activated'));
    r2.write(d2);r2.end();
  })});
  req.write(data);req.end();
}

importWorkflow('/opt/humanai-workflows/assistant_flow.json');
importWorkflow('/opt/humanai-workflows/doc_gen_flow.json');
"
```

Then add your OpenRouter credential in n8n:
- Go to http://localhost:5678 → Credentials → Add credential → Header Auth
- Name: `OpenRouter API Key`
- Header Name: `Authorization`
- Header Value: `Bearer YOUR_OPENROUTER_KEY`

### 7 — Start the backend

```bash
cd humain-ai-main/humanai_backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify: http://localhost:8000 should return `{"status":"healthy"}`

### 8 — Start the frontend

```bash
cd hr-platform-desktop
npm install
npm run dev
```

Open http://localhost:5173

---

## Test Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@humanai.com | Admin2026! | Admin |
| rh@humanai.com | RH2026! | RH |
| manager@humanai.com | Manager2026! | Manager |
| collab@humanai.com | Collab2026! | Collaborateur |

> These accounts are seeded directly in PostgreSQL. No Firebase setup needed in dev mode.

---

## DevOps

### Run as Docker container (web mode)

```bash
cd hr-platform-desktop
docker build -t humanai-frontend .
docker run -p 3000:3000 humanai-frontend
```

Open http://localhost:3000

### Build Windows installer

```bash
# Run PowerShell as Administrator
npm run dist:win
```

Find `HumaNai Setup 1.0.0.exe` in the `release/` folder.

### CI/CD (GitHub Actions)

| Pipeline | Trigger | What it does |
|----------|---------|-------------|
| CI — Frontend Build Check | Every push | Installs deps and builds the app |
| CD — Build Electron Installer | Push to main | Builds and uploads `.exe` as GitHub artifact |

---

## If Docker resets (volume wiped)

Run this to restore everything:

```bash
docker compose up -d

docker exec humanai_postgres psql -U postgres -d humanai_db -c "CREATE USER humanai_user WITH PASSWORD 'humanai2026';" 2>/dev/null || true

docker exec humanai_postgres psql -U postgres -d humanai_db -c "GRANT ALL PRIVILEGES ON DATABASE humanai_db TO humanai_user; GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO humanai_user; GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO humanai_user;"

docker cp infra/postgres/init/03_seed.sql humanai_postgres:/tmp/03_seed.sql
docker exec humanai_postgres psql -U postgres -d humanai_db -f /tmp/03_seed.sql

docker exec humanai_postgres psql -U postgres -d humanai_db -c "ALTER TABLE users DISABLE ROW LEVEL SECURITY; ALTER TABLE employees DISABLE ROW LEVEL SECURITY; ALTER TABLE absences DISABLE ROW LEVEL SECURITY; ALTER TABLE hr_alerts DISABLE ROW LEVEL SECURITY; ALTER TABLE ai_interactions DISABLE ROW LEVEL SECURITY; ALTER TABLE departments DISABLE ROW LEVEL SECURITY; ALTER TABLE positions DISABLE ROW LEVEL SECURITY; ALTER TABLE sites DISABLE ROW LEVEL SECURITY; ALTER TABLE document_templates DISABLE ROW LEVEL SECURITY; ALTER TABLE onboarding_plans DISABLE ROW LEVEL SECURITY; ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;"
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login fails "Identifiants invalides" | Re-run the database setup steps (Step 5) |
| Dashboard empty / orange dot | Backend not running — check uvicorn is on :8000 |
| AI says "Je ne peux pas répondre" | n8n workflows not imported or OpenRouter credential missing |
| 403 Forbidden on Employees page | Log in with admin@humanai.com |
| Backend crashes with ForeignKeyViolationError | Already fixed in this version of assistant.py |
| `service-account.json` missing error | Set APP_ENV=development in .env — Firebase is not needed in dev mode |
| Docker volume wiped after restart | Run the "If Docker resets" script above |

---

## Security Notes

- `service-account.json` — never commit this file. It is in `.gitignore`.
- `.env` — never commit this file. Use `.env.example` as a template.
- In production, set `APP_ENV=production` and configure real Firebase credentials.
- Row Level Security (RLS) is disabled in dev mode for simplicity. Re-enable it for production.
