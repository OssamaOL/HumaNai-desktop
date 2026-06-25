import pytest
from fastapi.testclient import TestClient
from app.main import app
from unittest.mock import patch

client = TestClient(app)

# 1. RBAC Security Tests: Access Control Enforcement

def test_collaborateur_access_restricted_employees_list(mock_firebase_claims):
    # Collaborateurs must not be allowed to list all employees (Forbidden)
    mock_firebase_claims(role="collaborateur")
    response = client.get(
        "/api/v1/employees/",
        headers={"Authorization": "Bearer mock_token"}
    )
    assert response.status_code == 403


def test_collaborateur_access_restricted_audit_logs(mock_firebase_claims):
    # Only Admin can access Audit Logs
    mock_firebase_claims(role="collaborateur")
    response = client.get(
        "/api/v1/audit/logs",
        headers={"Authorization": "Bearer mock_token"}
    )
    assert response.status_code == 403


def test_collaborateur_access_restricted_supervision(mock_firebase_claims):
    # Collaborateurs cannot view supervision interactions
    mock_firebase_claims(role="collaborateur")
    response = client.get(
        "/api/v1/supervision/interactions",
        headers={"Authorization": "Bearer mock_token"}
    )
    assert response.status_code == 403


def test_manager_cannot_modify_admin_config(mock_firebase_claims):
    # Managers cannot modify platform config (Forbidden)
    mock_firebase_claims(role="manager")
    response = client.put(
        "/api/v1/admin/config",
        json={"settings": {"app_env": "malicious"}},
        headers={"Authorization": "Bearer mock_token"}
    )
    assert response.status_code == 403


# 2. Token Authentication Security Tests

def test_no_auth_header_access_denied():
    # Endpoints requiring auth must fail with 401 if no header is present
    response = client.get("/api/v1/employees/me")
    assert response.status_code in (401, 403)


def test_invalid_bearer_token_access_denied():
    # Invalid token format or token signature failure
    with patch("firebase_admin.auth.verify_id_token", side_effect=Exception("Invalid token signature")):
        response = client.get(
            "/api/v1/employees/me",
            headers={"Authorization": "Bearer invalid_token"}
        )
        assert response.status_code in (401, 403)


# 3. SQL Injection Resilience Security Tests

def test_sql_injection_defense_employee_queries(mock_firebase_claims):
    # Ensure SQL Injection payloads in request query params do not cause SQL crashes
    mock_firebase_claims(role="rh")
    payloads = [
        "' OR '1'='1",
        "1; DROP TABLE employees;--",
        "' UNION SELECT NULL, NULL, NULL--"
    ]
    for payload in payloads:
        response = client.get(
            f"/api/v1/employees/?matricule={payload}",
            headers={"Authorization": "Bearer mock_token"}
        )
        # The API should respond with success (empty or normal list) or standard 422 validation error
        # but NEVER crash with internal server error 500 (which indicates raw query execution vulnerability)
        assert response.status_code in (200, 422)


# 4. Rate Limiting Security Tests

def test_rate_limiter_blocks_abuse():
    from unittest.mock import AsyncMock, patch
    # Mock Redis client to return a count above the limit (101 > 100)
    mock_redis_high = AsyncMock()
    mock_redis_high.incr = AsyncMock(return_value=101)
    mock_redis_high.expire = AsyncMock(return_value=True)
    
    with patch("app.middleware.rate_limit.get_redis", return_value=mock_redis_high), \
         patch("app.middleware.rate_limit.settings.APP_ENV", "production"): # Bypass test mode safe-circuit
        response = client.get("/api/v1/employees/me")
        assert response.status_code == 429
        assert "Rate limit exceeded" in response.json()["detail"]

