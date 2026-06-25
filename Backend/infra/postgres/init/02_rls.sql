-- 02_rls.sql: Configure Row-Level Security (RLS) with Multi-Tenant Filtering

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE annual_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_generation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_decision_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_document_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;

-- Helper functions to fetch current context from session settings
CREATE OR REPLACE FUNCTION current_user_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('app.current_user_id', true), '')::UUID;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_user_role() RETURNS VARCHAR AS $$
    SELECT current_setting('app.current_user_role', true)::VARCHAR;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS VARCHAR AS $$
    SELECT current_setting('app.tenant_id', true)::VARCHAR;
$$ LANGUAGE sql STABLE;

-- 1. Policies for `users` table
CREATE POLICY user_tenant_policy ON users
    FOR ALL
    USING (
        tenant_id = current_tenant_id() AND (
            current_user_role() IN ('admin', 'rh', 'direction') OR
            id = current_user_id() OR
            manager_id = current_user_id()
        )
    );

-- 2. Policies for `employees` table
CREATE POLICY employee_tenant_policy ON employees
    FOR ALL
    USING (
        tenant_id = current_tenant_id() AND (
            current_user_role() IN ('admin', 'rh', 'direction') OR
            user_id = current_user_id() OR
            department_id IN (
                SELECT department_id FROM users WHERE id = current_user_id() AND role = 'manager'
            )
        )
    );

-- 3. Policies for `absences` table
CREATE POLICY absence_tenant_policy ON absences
    FOR ALL
    USING (
        tenant_id = current_tenant_id() AND (
            current_user_role() IN ('admin', 'rh', 'direction') OR
            employee_id IN (
                SELECT id FROM employees WHERE user_id = current_user_id()
            ) OR
            employee_id IN (
                SELECT id FROM employees WHERE department_id IN (
                    SELECT department_id FROM users WHERE id = current_user_id() AND role = 'manager'
                )
            )
        )
    );

-- 4. Policies for `generated_documents` table
CREATE POLICY document_tenant_policy ON generated_documents
    FOR ALL
    USING (
        tenant_id = current_tenant_id() AND (
            current_user_role() IN ('admin', 'rh') OR
            employee_id IN (
                SELECT id FROM employees WHERE user_id = current_user_id()
            )
        )
    );

-- 5. Policies for `annual_reviews` table
CREATE POLICY review_tenant_policy ON annual_reviews
    FOR ALL
    USING (
        tenant_id = current_tenant_id() AND (
            current_user_role() IN ('admin', 'rh', 'direction') OR
            reviewer_id = current_user_id() OR
            employee_id IN (
                SELECT id FROM employees WHERE user_id = current_user_id()
            )
        )
    );

-- 6. Policies for `document_templates` table
CREATE POLICY template_tenant_policy ON document_templates
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- 7. Policies for `document_generation_rules` table
CREATE POLICY rules_tenant_policy ON document_generation_rules
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- 8. Policies for `document_requests` table
CREATE POLICY requests_tenant_policy ON document_requests
    FOR ALL
    USING (
        tenant_id = current_tenant_id() AND (
            current_user_role() IN ('admin', 'rh', 'manager') OR
            employee_id IN (
                SELECT id FROM employees WHERE user_id = current_user_id()
            )
        )
    );

-- 9. Policies for `policy_decision_logs` table
CREATE POLICY decision_tenant_policy ON policy_decision_logs
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- 10. Policies for `rag_documents` table
CREATE POLICY rag_docs_tenant_policy ON rag_documents
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- 11. Policies for `rag_document_access` table
CREATE POLICY rag_access_tenant_policy ON rag_document_access
    FOR ALL
    USING (tenant_id = current_tenant_id());

-- 12. Policies for `rag_chunks` table
CREATE POLICY rag_chunks_tenant_policy ON rag_chunks
    FOR ALL
    USING (
        tenant_id = current_tenant_id() AND (
            current_user_role() IN ('admin', 'rh') OR
            current_user_role() = ANY(role_access)
        )
    );

-- 13. Policies for `audit_logs` table (Only readable by Admin, anyone can write via logging system)
CREATE POLICY audit_tenant_read_policy ON audit_logs
    FOR SELECT
    USING (tenant_id = current_tenant_id() AND current_user_role() = 'admin');

CREATE POLICY audit_tenant_write_policy ON audit_logs
    FOR INSERT
    WITH CHECK (tenant_id = current_tenant_id());
