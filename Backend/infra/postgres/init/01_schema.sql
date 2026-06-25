-- 01_schema.sql: Define Custom Types, Tables, Constraints, and Indexes

-- 1. Create Custom Enum Types
CREATE TYPE user_role_type AS ENUM ('collaborateur', 'manager', 'rh', 'direction', 'admin', 'qvt');
CREATE TYPE contract_type AS ENUM ('cdi', 'cdd', 'stage', 'consultant');
CREATE TYPE employee_status_type AS ENUM ('actif', 'inactif', 'en_sortie');
CREATE TYPE absence_type AS ENUM ('conge_paye', 'maladie', 'sans_solde', 'autre');
CREATE TYPE absence_status_type AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
CREATE TYPE document_type AS ENUM ('attestation', 'formulaire', 'synthese', 'courrier', 'offboarding');
CREATE TYPE document_status_type AS ENUM ('draft', 'validated', 'rejected', 'archived');
CREATE TYPE plan_status_type AS ENUM ('draft', 'active', 'completed');
CREATE TYPE departure_reason_type AS ENUM ('demission', 'licenciement', 'fin_contrat', 'retraite');
CREATE TYPE workflow_status_type AS ENUM ('initiated', 'in_progress', 'completed');
CREATE TYPE step_type AS ENUM ('materiel', 'acces', 'admin', 'transfert', 'cloture');
CREATE TYPE sentiment_type AS ENUM ('positif', 'neutre', 'negatif');
CREATE TYPE risk_level_type AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE alert_severity_type AS ENUM ('anomalie', 'repetee', 'critique', 'fuite_donnees');
CREATE TYPE security_event_type AS ENUM ('unauthorized_access', 'prompt_injection', 'repeated_attempt', 'data_leak_risk');

-- 2. Sites Table
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sites_tenant ON sites(tenant_id);

-- 3. Departments Table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    name VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_departments_tenant ON departments(tenant_id);

-- 4. Positions Table
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_positions_tenant ON positions(tenant_id);

-- 5. Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    role user_role_type NOT NULL DEFAULT 'collaborateur',
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- 6. Employees Table
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    matricule VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    position_id UUID REFERENCES positions(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    hire_date DATE,
    contract_type contract_type DEFAULT 'cdi',
    salary_band TEXT,  -- encrypted
    status employee_status_type DEFAULT 'actif',
    sirh_sync_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_employees_user_id ON employees(user_id);
CREATE INDEX idx_employees_tenant ON employees(tenant_id);

-- 7. Absences Table
CREATE TABLE absences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    type absence_type NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    duration_days NUMERIC(5, 1),
    motif TEXT,
    status absence_status_type DEFAULT 'pending',
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_absences_tenant ON absences(tenant_id);

-- 8. Document Templates Table
CREATE TABLE document_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    name VARCHAR(255) NOT NULL,
    type document_type NOT NULL,
    content_template TEXT NOT NULL,
    allowed_roles VARCHAR(255)[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_document_templates_tenant ON document_templates(tenant_id);

-- 9. Generated Documents Table
CREATE TABLE generated_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    template_id UUID REFERENCES document_templates(id) ON DELETE SET NULL,
    correlation_id UUID,
    security_hash VARCHAR(255),
    template_version VARCHAR(255),
    generated_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    content_snapshot TEXT,  -- encrypted
    minio_path VARCHAR(255),
    status document_status_type DEFAULT 'draft',
    rh_validated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    rh_validated_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT
);
CREATE INDEX idx_generated_documents_tenant ON generated_documents(tenant_id);

-- 10. Document Generation Rules Table
CREATE TABLE document_generation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    document_type document_type NOT NULL,
    allow_self_generation BOOLEAN NOT NULL DEFAULT TRUE,
    manager_approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    admin_approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    max_per_year INTEGER NOT NULL DEFAULT 5,
    allowed_roles VARCHAR(255)[] NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX idx_document_generation_rules_tenant ON document_generation_rules(tenant_id);

-- 11. Document Requests Table
CREATE TABLE document_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES document_templates(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    requester_uid VARCHAR(255) NOT NULL,
    variables_snapshot JSONB,
    correlation_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_document_requests_tenant ON document_requests(tenant_id);

-- 12. Policy Decision Logs Table
CREATE TABLE policy_decision_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    decision VARCHAR(50) NOT NULL,
    rule_triggered_id UUID REFERENCES document_generation_rules(id) ON DELETE SET NULL,
    approval_required BOOLEAN NOT NULL DEFAULT FALSE,
    correlation_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_policy_decision_logs_tenant ON policy_decision_logs(tenant_id);

-- 13. Onboarding Plans Table
CREATE TABLE onboarding_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    status plan_status_type DEFAULT 'draft',
    day_30_calendar JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_onboarding_plans_tenant ON onboarding_plans(tenant_id);

-- 14. Onboarding Steps Table
CREATE TABLE onboarding_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    plan_id UUID NOT NULL REFERENCES onboarding_plans(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    is_alert_triggered BOOLEAN DEFAULT FALSE,
    day_number VARCHAR(50)
);
CREATE INDEX idx_onboarding_steps_tenant ON onboarding_steps(tenant_id);

-- 15. Offboarding Workflows Table
CREATE TABLE offboarding_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    departure_reason departure_reason_type NOT NULL,
    departure_date DATE NOT NULL,
    status workflow_status_type DEFAULT 'initiated',
    knowledge_transfer_doc_id UUID REFERENCES generated_documents(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_offboarding_workflows_tenant ON offboarding_workflows(tenant_id);

-- 16. Offboarding Steps Table
CREATE TABLE offboarding_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    workflow_id UUID NOT NULL REFERENCES offboarding_workflows(id) ON DELETE CASCADE,
    step_type step_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);
CREATE INDEX idx_offboarding_steps_tenant ON offboarding_steps(tenant_id);

-- 17. Engagement Surveys Table
CREATE TABLE engagement_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    title VARCHAR(255) NOT NULL,
    questions JSONB NOT NULL,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_engagement_surveys_tenant ON engagement_surveys(tenant_id);

-- 18. Survey Responses Table
CREATE TABLE survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    survey_id UUID NOT NULL REFERENCES engagement_surveys(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    answers JSONB NOT NULL,
    score INTEGER,
    sentiment sentiment_type,
    responded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_survey_responses_tenant ON survey_responses(tenant_id);

-- 19. Annual Reviews Table
CREATE TABLE annual_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    review_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    rating NUMERIC(3, 1),
    workload_score INTEGER,
    notes TEXT  -- encrypted
);
CREATE INDEX idx_annual_reviews_tenant ON annual_reviews(tenant_id);

-- 20. Disengagement Signals Table
CREATE TABLE disengagement_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    computed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    risk_score NUMERIC(5, 2) NOT NULL DEFAULT 0,
    risk_level risk_level_type DEFAULT 'low',
    signals JSONB,
    action_plan JSONB
);
CREATE INDEX idx_disengagement_signals_tenant ON disengagement_signals(tenant_id);

-- 21. HR Alerts Table
CREATE TABLE hr_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
    alert_type VARCHAR(255) NOT NULL,
    severity alert_severity_type NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    is_read BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_hr_alerts_tenant ON hr_alerts(tenant_id);

-- 22. AI Security Rules Table
CREATE TABLE ai_security_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    name VARCHAR(255) NOT NULL,
    condition_logic JSONB NOT NULL,
    severity alert_severity_type NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ai_security_rules_tenant ON ai_security_rules(tenant_id);

-- 23. AI Interactions Table
CREATE TABLE ai_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id UUID NOT NULL,
    correlation_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    query_text TEXT,  -- encrypted
    response_summary TEXT,
    role_at_time VARCHAR(255) NOT NULL,
    data_scope_requested VARCHAR(255)[],
    is_security_event BOOLEAN DEFAULT FALSE
);
CREATE INDEX idx_ai_interactions_tenant ON ai_interactions(tenant_id);

-- 24. AI Security Events Table
CREATE TABLE ai_security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    interaction_id UUID REFERENCES ai_interactions(id) ON DELETE CASCADE,
    correlation_id UUID,
    event_type security_event_type NOT NULL,
    severity alert_severity_type NOT NULL,
    triggered_rule_id UUID REFERENCES ai_security_rules(id) ON DELETE SET NULL,
    admin_notified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_ai_security_events_tenant ON ai_security_events(tenant_id);

-- 25. RAG Documents Table
CREATE TABLE rag_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    title VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    content_raw TEXT,
    minio_path VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_rag_documents_tenant ON rag_documents(tenant_id);

-- 26. RAG Document Access Table
CREATE TABLE rag_document_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    allowed_role VARCHAR(255) NOT NULL
);
CREATE INDEX idx_rag_document_access_tenant ON rag_document_access(tenant_id);

-- 27. RAG Chunks Table
CREATE TABLE rag_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    document_id UUID NOT NULL REFERENCES rag_documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536),
    token_count INTEGER,
    role_access VARCHAR(255)[]
);
CREATE INDEX idx_rag_chunks_tenant ON rag_chunks(tenant_id);

-- 28. Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(255),
    entity_id UUID,
    correlation_id UUID,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    details JSONB
);
CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);

-- 29. Data Consents Table
CREATE TABLE data_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    purpose VARCHAR(255) NOT NULL,
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_data_consents_tenant ON data_consents(tenant_id);

-- 30. Data Requests Table
CREATE TABLE data_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL DEFAULT 'default-tenant',
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    request_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT
);
CREATE INDEX idx_data_requests_tenant ON data_requests(tenant_id);
