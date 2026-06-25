import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
import uuid
from datetime import date

from app.main import app
from app.models.document import DocumentTemplate, GeneratedDocument, DocumentType, DocumentStatus
from app.models.employee import Employee
from app.models.user import User, UserRole

client = TestClient(app)

@pytest.fixture
async def setup_api_data(db):
    # Create a Collaborateur user
    collab_user = User(
        id=uuid.UUID("44444444-4444-4444-4444-444444444444"),
        firebase_uid="test-uid-collab",
        email="collab@humanai.com",
        role=UserRole.collaborateur,
    )
    db.add(collab_user)
    await db.flush()

    collab_emp = Employee(
        id=uuid.UUID("55555555-5555-5555-5555-555555555555"),
        user_id=collab_user.id,
        matricule="EMP001",
        full_name="Jane Collab",
        hire_date=date(2025, 1, 1),
    )
    db.add(collab_emp)
    await db.flush()

    # Create a another Collaborateur user to test unauthorized generation access
    other_user = User(
        id=uuid.UUID("99999999-9999-9999-9999-999999999999"),
        firebase_uid="test-uid-other",
        email="other@humanai.com",
        role=UserRole.collaborateur,
    )
    db.add(other_user)
    await db.flush()

    other_emp = Employee(
        id=uuid.UUID("88888888-8888-8888-8888-888888888888"),
        user_id=other_user.id,
        matricule="EMP002",
        full_name="John Other",
        hire_date=date(2025, 1, 1),
    )
    db.add(other_emp)
    await db.flush()

    # Create an RH user
    rh_user = User(
        id=uuid.UUID("33333333-3333-3333-3333-333333333333"),
        firebase_uid="test-uid-rh",
        email="rh@humanai.com",
        role=UserRole.rh,
    )
    db.add(rh_user)
    await db.flush()

    # Create standard template allowed for collaborateur & rh
    standard_template = DocumentTemplate(
        id=uuid.UUID("11111111-1111-1111-1111-111111111111"),
        name="Attestation Standard",
        type=DocumentType.attestation,
        content_template="Attestation pour {{employee.full_name}}",
        allowed_roles=["collaborateur", "rh"]
    )
    db.add(standard_template)
    await db.flush()

    # Create a template restricted to RH only
    restricted_template = DocumentTemplate(
        id=uuid.UUID("22222222-2222-2222-2222-222222222222"),
        name="Evaluation Annuelle Template",
        type=DocumentType.synthese,
        content_template="Synthese RH",
        allowed_roles=["rh"]
    )
    db.add(restricted_template)
    await db.flush()

    # Create a generated document in draft status
    generated_doc = GeneratedDocument(
        id=uuid.UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"),
        employee_id=collab_emp.id,
        template_id=standard_template.id,
        generated_by=collab_user.id,
        status=DocumentStatus.draft,
        minio_path="humanai-documents/55555555-5555-5555-5555-555555555555/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.pdf"
    )
    db.add(generated_doc)
    await db.flush()

    return {
        "collab_user": collab_user,
        "collab_emp": collab_emp,
        "other_user": other_user,
        "other_emp": other_emp,
        "rh_user": rh_user,
        "standard_template": standard_template,
        "restricted_template": restricted_template,
        "generated_doc": generated_doc
    }

def test_generate_document_self_success(mock_firebase_claims, setup_api_data):
    # Mock firebase claims as the collaborator user
    mock_firebase_claims(
        role="collaborateur",
        email="collab@humanai.com",
        employee_id="55555555-5555-5555-5555-555555555555"
    )
    with patch("firebase_admin.auth.verify_id_token") as mock_auth:
        mock_auth.return_value = {
            "uid": "test-uid-collab",
            "email": "collab@humanai.com",
            "role": "collaborateur",
            "employee_id": "55555555-5555-5555-5555-555555555555"
        }
        
        response = client.post(
            "/api/v1/documents/generate",
            json={
                "template_id": "11111111-1111-1111-1111-111111111111",
                "employee_id": "55555555-5555-5555-5555-555555555555"
            },
            headers={"Authorization": "Bearer mock_token"}
        )
        
        assert response.status_code == 202
        assert "document_id" in response.json()
        assert response.json()["status"] == "processing"

def test_generate_document_other_forbidden(mock_firebase_claims, setup_api_data):
    # Collab user tries to generate for John Other
    mock_firebase_claims(
        role="collaborateur",
        email="collab@humanai.com",
        employee_id="55555555-5555-5555-5555-555555555555"
    )
    with patch("firebase_admin.auth.verify_id_token") as mock_auth:
        mock_auth.return_value = {
            "uid": "test-uid-collab",
            "email": "collab@humanai.com",
            "role": "collaborateur",
            "employee_id": "55555555-5555-5555-5555-555555555555"
        }
        
        response = client.post(
            "/api/v1/documents/generate",
            json={
                "template_id": "11111111-1111-1111-1111-111111111111",
                "employee_id": "88888888-8888-8888-8888-888888888888"  # John Other's ID
            },
            headers={"Authorization": "Bearer mock_token"}
        )
        assert response.status_code == 403
        assert "lui-" in response.json()["detail"]

def test_generate_restricted_template_forbidden(mock_firebase_claims, setup_api_data):
    # Collab user tries to generate a restricted template (RH only)
    mock_firebase_claims(
        role="collaborateur",
        email="collab@humanai.com",
        employee_id="55555555-5555-5555-5555-555555555555"
    )
    with patch("firebase_admin.auth.verify_id_token") as mock_auth:
        mock_auth.return_value = {
            "uid": "test-uid-collab",
            "email": "collab@humanai.com",
            "role": "collaborateur",
            "employee_id": "55555555-5555-5555-5555-555555555555"
        }
        
        response = client.post(
            "/api/v1/documents/generate",
            json={
                "template_id": "22222222-2222-2222-2222-222222222222",  # RH restricted template
                "employee_id": "55555555-5555-5555-5555-555555555555"
            },
            headers={"Authorization": "Bearer mock_token"}
        )
        assert response.status_code == 403
        assert "autorisé" in response.json()["detail"]

def test_generate_document_concurrent_conflict(mock_firebase_claims, setup_api_data):
    # Collab user tries to generate but Redis lock is already held
    mock_firebase_claims(
        role="collaborateur",
        email="collab@humanai.com",
        employee_id="55555555-5555-5555-5555-555555555555"
    )
    with patch("firebase_admin.auth.verify_id_token") as mock_auth:
        mock_auth.return_value = {
            "uid": "test-uid-collab",
            "email": "collab@humanai.com",
            "role": "collaborateur",
            "employee_id": "55555555-5555-5555-5555-555555555555"
        }
        
        # Mock Redis lock failure (return False)
        with patch("app.services.document_service.set_lock", AsyncMock(return_value=False)):
            response = client.post(
                "/api/v1/documents/generate",
                json={
                    "template_id": "11111111-1111-1111-1111-111111111111",
                    "employee_id": "55555555-5555-5555-5555-555555555555"
                },
                headers={"Authorization": "Bearer mock_token"}
            )
            assert response.status_code == 409
            assert "déjà en cours" in response.json()["detail"]

def test_download_document_presigned(mock_firebase_claims, setup_api_data):
    # Collaborateur downloads their own generated document
    mock_firebase_claims(
        role="collaborateur",
        email="collab@humanai.com",
        employee_id="55555555-5555-5555-5555-555555555555"
    )
    with patch("firebase_admin.auth.verify_id_token") as mock_auth:
        mock_auth.return_value = {
            "uid": "test-uid-collab",
            "email": "collab@humanai.com",
            "role": "collaborateur",
            "employee_id": "55555555-5555-5555-5555-555555555555"
        }
        
        # Mock get_document_presigned_url
        with patch("app.routers.documents.get_document_presigned_url", return_value="http://mock-minio/presigned-url") as mock_url:
            response = client.get(
                "/api/v1/documents/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/download",
                headers={"Authorization": "Bearer mock_token"}
            )
            assert response.status_code == 200
            assert response.json()["download_url"] == "http://mock-minio/presigned-url"
            mock_url.assert_called_once_with(setup_api_data["generated_doc"].minio_path)

def test_rh_validate_document(mock_firebase_claims, setup_api_data):
    # RH validates document
    mock_firebase_claims(
        role="rh",
        email="rh@humanai.com"
    )
    with patch("firebase_admin.auth.verify_id_token") as mock_auth:
        mock_auth.return_value = {
            "uid": "test-uid-rh",
            "email": "rh@humanai.com",
            "role": "rh"
        }
        
        response = client.post(
            "/api/v1/documents/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/validate",
            json={"commentaire": "C'est validé !"},
            headers={"Authorization": "Bearer mock_token"}
        )
        assert response.status_code == 200
        assert response.json()["data"]["status"] == "validated"

def test_rh_reject_document_success(mock_firebase_claims, setup_api_data):
    # RH rejects document with motif
    mock_firebase_claims(
        role="rh",
        email="rh@humanai.com"
    )
    with patch("firebase_admin.auth.verify_id_token") as mock_auth:
        mock_auth.return_value = {
            "uid": "test-uid-rh",
            "email": "rh@humanai.com",
            "role": "rh"
        }
        
        response = client.post(
            "/api/v1/documents/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/reject",
            json={"motif": "Le matricule est incorrect"},
            headers={"Authorization": "Bearer mock_token"}
        )
        assert response.status_code == 200
        assert response.json()["data"]["status"] == "rejected"
        assert response.json()["data"]["rejection_reason"] == "Le matricule est incorrect"

def test_rh_reject_document_missing_motif(mock_firebase_claims, setup_api_data):
    # RH rejects document without motif -> should return 400
    mock_firebase_claims(
        role="rh",
        email="rh@humanai.com"
    )
    with patch("firebase_admin.auth.verify_id_token") as mock_auth:
        mock_auth.return_value = {
            "uid": "test-uid-rh",
            "email": "rh@humanai.com",
            "role": "rh"
        }
        
        response = client.post(
            "/api/v1/documents/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/reject",
            json={},  # missing motif
            headers={"Authorization": "Bearer mock_token"}
        )
        assert response.status_code == 400
        assert "motif" in response.json()["detail"]
