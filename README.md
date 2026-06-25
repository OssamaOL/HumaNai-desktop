# HumaNai Desktop

## Setup
```bash
npm install
npm run start
```

## Backend connection
Make sure the FastAPI backend is running at http://localhost:8000

```bash
cd Backend
python scripts/populate_rag.py   # first time only — creates DB tables
uvicorn app.main:app --reload --port 8000
```

## Test accounts
| Email | Password | Role |
|---|---|---|
| alice@rh-corp.com | RH@Secure2025! | RH |
| bob@rh-corp.com | Manager@Secure2025! | Manager |
| admin@rh-corp.com | Admin@Secure2025! | Admin |
