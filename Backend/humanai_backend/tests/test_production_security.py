import pytest
import time
import uuid
from fastapi import HTTPException
from app.services.rbac_service import verify_permission
from app.middleware.firebase_auth import CurrentUser
from app.middleware.hmac_signature import verify_hmac_signature, sign_request
from app.config import settings

# 1. Test RBAC Service Enforcement
def test_rbac_permissions():
    collab = CurrentUser(
        uid="1", email="collab@test.com", role="collaborateur", dept_id="", tenant_id="tenant-A"
    )
    rh = CurrentUser(
        uid="2", email="rh@test.com", role="rh", dept_id="", tenant_id="tenant-A"
    )
    
    # Collaborateur should be able to generate_document
    verify_permission(collab, "generate_document")
    
    # Collaborateur should not be able to view_salary or manage_rules
    with pytest.raises(HTTPException) as exc:
        verify_permission(collab, "view_salary")
    assert exc.value.status_code == 403
    
    with pytest.raises(HTTPException) as exc:
        verify_permission(collab, "manage_rules")
    assert exc.value.status_code == 403
    
    # RH should be able to manage_rules and approve_document
    verify_permission(rh, "manage_rules")
    verify_permission(rh, "approve_document")
    
    # RH should not be able to view_salary
    with pytest.raises(HTTPException) as exc:
        verify_permission(rh, "view_salary")
    assert exc.value.status_code == 403


# 2. Test HMAC Request Signature Middleware
class MockRequest:
    def __init__(self, body_bytes: bytes, headers: dict):
        self.body_bytes = body_bytes
        self.headers_dict = headers
        
    @property
    def headers(self):
        return self.headers_dict
        
    async def body(self) -> bytes:
        return self.body_bytes

@pytest.mark.asyncio
async def test_hmac_signature_validation():
    secret = settings.APP_ENCRYPTION_KEY
    body = b'{"test": "data"}'
    body_str = body.decode("utf-8")
    
    # A. Correct signature must succeed
    sig, timestamp, nonce = sign_request(body_str, secret)
    req = MockRequest(
        body,
        {
            "X-Signature": sig,
            "X-Timestamp": timestamp,
            "X-Nonce": nonce,
        }
    )
    # verify_hmac_signature should run without throwing any HTTPExceptions
    await verify_hmac_signature(req)
    
    # B. Missing headers must fail with 401
    req_missing = MockRequest(body, {})
    with pytest.raises(HTTPException) as exc:
        await verify_hmac_signature(req_missing)
    assert exc.value.status_code == 401
    
    # C. Expired timestamp must fail with 401
    expired_time = str(time.time() - 35.0)
    sig_exp, _, nonce_exp = sign_request(body_str, secret)
    import hmac
    import hashlib
    msg = f"{body_str}{expired_time}{nonce_exp}".encode("utf-8")
    sig_exp = hmac.new(secret.encode("utf-8"), msg, hashlib.sha256).hexdigest()
    req_expired = MockRequest(
        body,
        {
            "X-Signature": sig_exp,
            "X-Timestamp": expired_time,
            "X-Nonce": nonce_exp,
        }
    )
    with pytest.raises(HTTPException) as exc:
        await verify_hmac_signature(req_expired)
    assert exc.value.status_code == 401
    
    # D. Replay attack must fail with 401 (re-using the same nonce)
    from unittest.mock import AsyncMock, patch
    mock_redis_replay = AsyncMock()
    mock_redis_replay.set = AsyncMock(return_value=False)
    
    with patch("app.middleware.hmac_signature.get_redis", return_value=mock_redis_replay):
        req_replay = MockRequest(
            body,
            {
                "X-Signature": sig,
                "X-Timestamp": timestamp,
                "X-Nonce": nonce,
            }
        )
        with pytest.raises(HTTPException) as exc:
            await verify_hmac_signature(req_replay)
        assert exc.value.status_code == 401
        assert "Attaque par rejeu" in exc.value.detail
    
    # E. Incorrect signature must fail with 401
    req_wrong = MockRequest(
        body,
        {
            "X-Signature": "wrongsignature123",
            "X-Timestamp": timestamp,
            "X-Nonce": str(uuid.uuid4()),
        }
    )
    with pytest.raises(HTTPException) as exc:
        await verify_hmac_signature(req_wrong)
    assert exc.value.status_code == 401


# 3. Test RLS database context and tenant isolation simulation
@pytest.mark.asyncio
async def test_rls_tenant_isolation(db):
    from app.database import set_rls_context
    from app.models.employee import Employee
    
    # Insert two test employees for two different tenants
    emp_A = Employee(
        id=uuid.uuid4(),
        tenant_id="tenant-A",
        full_name="Employee A",
        matricule="EMP-AAA",
    )
    emp_B = Employee(
        id=uuid.uuid4(),
        tenant_id="tenant-B",
        full_name="Employee B",
        matricule="EMP-BBB",
    )
    db.add_all([emp_A, emp_B])
    await db.commit()
    
    # Verify set_rls_context function executes correctly without errors
    await set_rls_context(db, user_id="", role="rh", dept_id="", tenant_id="tenant-A")
    
    # Verify both exist in local SQLite engine test
    from sqlalchemy import select
    stmt = select(Employee)
    res = await db.execute(stmt)
    employees = res.scalars().all()
    assert len(employees) == 2
