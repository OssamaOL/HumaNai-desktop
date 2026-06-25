-- 03_seed.sql: Seed initial site, department, position, user, and employee data

-- 1. Seed Sites
INSERT INTO sites (id, name, location) VALUES
('b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3', 'Paris Campus', 'Paris, France'),
('c4c4c4c4-c4c4-c4c4-c4c4-c4c4c4c4c4c4', 'Casablanca Campus', 'Casablanca, Morocco')
ON CONFLICT (id) DO NOTHING;

-- 2. Seed Departments
INSERT INTO departments (id, name, parent_id, site_id) VALUES
('d1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'Direction Générale', NULL, 'b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3'),
('d2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', 'Ressources Humaines', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'b3b3b3b3-b3b3-b3b3-b3b3-b3b3b3b3b3b3'),
('d3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', 'Développement Tech', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', 'c4c4c4c4-c4c4-c4c4-c4c4-c4c4c4c4c4c4')
ON CONFLICT (id) DO NOTHING;

-- 3. Seed Positions
INSERT INTO positions (id, name) VALUES
('f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1', 'Directeur Général'),
('f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2', 'Responsable RH'),
('f3f3f3f3-f3f3-f3f3-f3f3-f3f3f3f3f3f3', 'Lead Tech DevOps'),
('f4f4f4f4-f4f4-f4f4-f4f4-f4f4f4f4f4f4', 'Développeur Fullstack')
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Users
-- Passwords and authentications are handled via Firebase Auth.
-- These matching database entries correspond to Firebase UIDs.
INSERT INTO users (id, firebase_uid, email, display_name, role, department_id, manager_id, is_active) VALUES
('a1111111-1111-1111-1111-111111111111', 'fb-uid-admin', 'admin@humanai.com', 'Admin System', 'admin', NULL, NULL, TRUE),
('a2222222-2222-2222-2222-222222222222', 'fb-uid-hr', 'rh@humanai.com', 'Sarah RH', 'rh', 'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', NULL, TRUE),
('a3333333-3333-3333-3333-333333333333', 'fb-uid-manager', 'manager@humanai.com', 'Jean Tech Manager', 'manager', 'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', NULL, TRUE),
('a4444444-4444-4444-4444-444444444444', 'fb-uid-collab', 'collab@humanai.com', 'Alex Dev', 'collaborateur', 'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', 'a3333333-3333-3333-3333-333333333333', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 5. Seed Employees
INSERT INTO employees (id, user_id, matricule, full_name, position_id, department_id, hire_date, contract_type, salary_band, status, sirh_sync_id) VALUES
('e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'MAT-0001', 'Admin System', 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1', 'd1d1d1d1-d1d1-d1d1-d1d1-d1d1d1d1d1d1', '2025-01-01', 'cdi', NULL, 'actif', 'SIRH-001'),
('e2222222-2222-2222-2222-222222222222', 'a2222222-2222-2222-2222-222222222222', 'MAT-0002', 'Sarah RH', 'f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2', 'd2d2d2d2-d2d2-d2d2-d2d2-d2d2d2d2d2d2', '2025-02-15', 'cdi', NULL, 'actif', 'SIRH-002'),
('e3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', 'MAT-0003', 'Jean Tech Manager', 'f3f3f3f3-f3f3-f3f3-f3f3-f3f3f3f3f3f3', 'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', '2025-03-01', 'cdi', NULL, 'actif', 'SIRH-003'),
('e4444444-4444-4444-4444-444444444444', 'a4444444-4444-4444-4444-444444444444', 'MAT-0004', 'Alex Dev', 'f4f4f4f4-f4f4-f4f4-f4f4-f4f4f4f4f4f4', 'd3d3d3d3-d3d3-d3d3-d3d3-d3d3d3d3d3d3', '2025-04-10', 'cdi', NULL, 'actif', 'SIRH-004')
ON CONFLICT (id) DO NOTHING;

-- 6. Seed Document Templates
INSERT INTO document_templates (id, name, type, content_template, allowed_roles) VALUES
('b1111111-1111-1111-1111-111111111111', 'Attestation d''emploi standard', 'attestation', 'Je soussigné, Direction Générale, atteste que {{full_name}} est employé(e) au sein de notre entreprise.', '{"admin", "rh", "manager", "collaborateur"}'),
('b2222222-2222-2222-2222-222222222222', 'Lettre de départ / Clôture', 'offboarding', 'Clôture de contrat pour {{full_name}} effectif au {{departure_date}}.', '{"admin", "rh"}')
ON CONFLICT (id) DO NOTHING;
