# HumaNai Platform — YDAYS 2026

HumaNai is a secure, modern AI-driven Human Resources platform designed for employee lifecycle management, onboarding/offboarding workflows, absence tracking, and engagement metrics.

---

## 🚀 Project Architecture

The project is structured as a mono-repo containing the following main directories:

- **[`humanai_backend/`](file:///c:/Users/Rayane/OneDrive/Bureau/ydays/humanai_backend)**: Core backend application built with **FastAPI**, **SQLAlchemy 2.0**, and **Firebase Auth**.
- **[`infra/`](file:///c:/Users/Rayane/OneDrive/Bureau/ydays/infra)**: Infrastructure configurations including **Docker Compose**, **PostgreSQL (with pgvector)**, **Redis**, **Nginx**, and monitoring tools (**Prometheus**, **Grafana**).

---

## 🛠️ Stack Technique

- **Backend**: Python 3.13+, FastAPI, SQLAlchemy 2.0, Async Pydantic v2
- **Authentication**: Firebase Authentication with custom RBAC claims
- **Database**: PostgreSQL 16 with pgvector & Row-Level Security (RLS)
- **Caching & Queue**: Redis 7
- **Storage**: MinIO (S3-compatible object storage)
- **Proxy**: Nginx
- **Monitoring**: Prometheus & Grafana

---

## ⚙️ Getting Started

### 1. Prerequisities
- Docker & Docker Compose
- Python 3.13+

### 2. Infrastructure Startup
Navigate to the `infra/` directory and run:
```bash
cd infra
make up
```
This will pull and run all the required containers, and automatically execute the SQL initialization scripts:
- `00_extensions.sql` (enables pgcrypto, vector, pg_trgm)
- `01_schema.sql` (database schema for all tables)
- `02_rls.sql` (Row-Level Security policies)
- `03_seed.sql` (demo data for development)

### 3. Backend Setup
Navigate to `humanai_backend/` directory:
1. Create a virtual environment and install dependencies:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. Configure `.env` using `.env.example` as a template.
3. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload
   ```

---

## 🧪 Testing

Le backend inclut une suite de tests automatisés comprenant **28 tests unitaires, d'intégration et de sécurité** couvrant l'authentification, les congés, l'administration et la résilience face aux failles web.

Pour lancer les tests localement :
```bash
cd humanai_backend
python -m pytest
```
*Note : La suite de tests utilise une base SQLite en mémoire asynchrone (`StaticPool`) avec un monkeypatch dynamique émulant les comportements du type PostgreSQL UUID.*

---

## 🛡️ DevSecOps & Sécurité

Le projet applique une approche **DevSecOps** d'intégration continue de la sécurité :

### 1. Sécurisation Applicative (Code & DB)
* **Protection contre l'Injection SQL** : Toutes les requêtes vers la base de données PostgreSQL exploitent l'ORM SQLAlchemy avec requêtes paramétrées. L'injection RLS est quant à elle sécurisée par l'utilisation paramétrée de la fonction native `set_config` à la place de l'interpolation de chaînes.
* **Headers de Sécurité HTTP** : Le middleware `SecurityHeadersMiddleware` injecte automatiquement les headers standardisés (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `X-XSS-Protection`, `Content-Security-Policy`) sur toutes les réponses de l'API.
* **Limitation de Débit (Rate Limiting)** : Le middleware `RateLimitMiddleware` s'appuie sur le cache **Redis** pour limiter les requêtes par adresse IP cliente (ex. maximum 100 requêtes par minute), protégeant le serveur des attaques par déni de service (DDoS) et de force brute.
* **Rapport de Sécurité** : Le rapport d'audit et la documentation DevSecOps complète sont accessibles dans le répertoire [`docs/security_report.md`](file:///c:/Users/Rayane/OneDrive/Bureau/ydays/docs/security_report.md).

### 2. Durcissement des Conteneurs (Container Hardening)
Les fichiers Dockerfiles appliquent le principe du moindre privilège :
* **Backend** : Le conteneur ne tourne pas en mode root. Il configure et bascule sur l'utilisateur système non-privilégié `humanai` (`USER humanai`).
* **Nginx** : Écoute en interne sur le port non-privilégié `8080` et s'exécute entièrement sous le profil `USER nginx`.

---

## 🔁 CI/CD Pipeline (GitHub Actions)

Un pipeline CI/CD automatisé est configuré dans le fichier [`.github/workflows/ci.yml`](file:///c:/Users/Rayane/OneDrive/Bureau/ydays/.github/workflows/ci.yml) pour se déclencher sur chaque commit ou pull request sur la branche `main`.

Il orchestre les étapes suivantes :
1. **Qualité du code (Linting)** : Analyse syntaxique et de style via `flake8`.
2. **Scanners de Sécurité (SAST & SCA)** :
   - **Bandit** : Recherche récursive de failles de sécurité dans le code Python.
   - **Safety** : Recherche de vulnérabilités connues (CVE) dans les dépendances de production.
3. **Tests de Sécurité & d'Intégration** : Lancement complet de la suite des 28 tests (incluant les tests d'injection SQL et de contournement RBAC).
4. **Vérification des Conteneurs (Trivy Scan)** : Construit localement les conteneurs et les scanne avec **Trivy** à la recherche de CVEs système. Si des vulnérabilités de sévérité *HIGH* ou *CRITICAL* sont trouvées, le build échoue et ne publie pas les images.
5. **Publication d'Images de Release** : Publie les conteneurs sécurisés sur le **GitHub Container Registry (GHCR)**.
6. **Déploiement Continu Résilient** : Se connecte en SSH sur le serveur cible pour mettre à jour et redémarrer la stack. Le pipeline passe automatiquement cette étape avec un avertissement si les secrets de connexion ne sont pas encore provisionnés sur le dépôt GitHub.

Pour activer le déploiement automatique, configurez les secrets suivants dans les paramètres de votre dépôt GitHub :
- `DEPLOY_HOST` : Adresse IP ou nom de domaine de votre serveur.
- `DEPLOY_USER` : Nom de l'utilisateur de déploiement.
- `DEPLOY_SSH_KEY` : Clé SSH privée autorisant l'accès au serveur.


