import pytest
import uuid
from datetime import date
from unittest.mock import patch, MagicMock, AsyncMock

from app.workers.doc_gen_worker import fetch_doc_context, handle_job
from app.models.document import DocumentTemplate, DocumentType, GeneratedDocument, DocumentStatus
from app.models.employee import Employee
from app.models.absence import Absence, AbsenceStatus
from app.models.user import User, UserRole

@pytest.fixture
async def setup_test_data(db):
    # Create user
    user = User(
        id=uuid.UUID("44444444-4444-4444-4444-444444444444"),
        firebase_uid="test-uid-123",
        email="employee@humanai.com",
        role=UserRole.collaborateur,
    )
    db.add(user)
    await db.flush()
    
    # Create employee
    employee = Employee(
        id=uuid.UUID("55555555-5555-5555-5555-555555555555"),
        user_id=user.id,
        matricule="EMP999",
        full_name="Jane Doe",
        hire_date=date(2025, 1, 1),
        contract_type="cdi",
    )
    db.add(employee)
    await db.flush()

    # Create document template (allowed for collaborateur & rh)
    template = DocumentTemplate(
        id=uuid.UUID("66666666-6666-6666-6666-666666666666"),
        name="Attestation de Travail",
        type=DocumentType.attestation,
        content_template="Je soussigné atteste que {{employee.full_name}} ({{employee.matricule}}).",
        allowed_roles=["collaborateur", "rh"]
    )
    db.add(template)
    await db.flush()

    # Create approved absence
    absence = Absence(
        id=uuid.UUID("77777777-7777-7777-7777-777777777777"),
        employee_id=employee.id,
        type="conge_paye",
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 5),
        duration_days=5.0,
        status=AbsenceStatus.approved
    )
    db.add(absence)
    await db.flush()
    
    # Create a generated document to process
    gen_doc = GeneratedDocument(
        id=uuid.UUID("88888888-8888-8888-8888-888888888888"),
        employee_id=employee.id,
        template_id=template.id,
        generated_by=user.id,
        status=DocumentStatus.draft
    )
    db.add(gen_doc)
    await db.flush()
    
    await db.commit()
    
    return {
        "user": user,
        "employee": employee,
        "template": template,
        "absence": absence,
        "generated_doc": gen_doc
    }

@pytest.mark.asyncio
async def test_fetch_doc_context_success(db, setup_test_data):
    context = await fetch_doc_context(
        db,
        employee_id=setup_test_data["employee"].id,
        template_id=setup_test_data["template"].id,
        requester_role="collaborateur"
    )
    assert context["employee"]["full_name"] == "Jane Doe"
    assert context["employee"]["matricule"] == "EMP999"
    assert context["template"]["name"] == "Attestation de Travail"
    assert context["absences"]["conge_paye"] == 5.0

@pytest.mark.asyncio
async def test_fetch_doc_context_forbidden(db, setup_test_data):
    setup_test_data["template"].allowed_roles = ["rh"]
    await db.commit()
    with pytest.raises(PermissionError):
        await fetch_doc_context(
            db,
            employee_id=setup_test_data["employee"].id,
            template_id=setup_test_data["template"].id,
            requester_role="collaborateur"
        )

@pytest.mark.asyncio
async def test_handle_job_n8n_success(db, setup_test_data):
    job_data = {
        "document_id": str(setup_test_data["generated_doc"].id),
        "employee_id": str(setup_test_data["employee"].id),
        "template_id": str(setup_test_data["template"].id),
        "requester_uid": "test-uid-123",
        "requester_role": "collaborateur"
    }

    mock_n8n_response = MagicMock()
    mock_n8n_response.status_code = 200
    mock_n8n_response.json = MagicMock(return_value={
        "content_html": "<h1>Attestation de travail</h1><p>Jane Doe travaille chez HumaNai.</p>",
        "coherence_issues": [],
        "needs_human_review": False,
        "summary_for_log": "Attestation OK"
    })
    mock_n8n_response.raise_for_status = MagicMock()

    # Build a proper async context manager mock for httpx.AsyncClient
    mock_client_instance = AsyncMock()
    mock_client_instance.post = AsyncMock(return_value=mock_n8n_response)

    mock_async_client = MagicMock()
    mock_async_client.return_value.__aenter__ = AsyncMock(return_value=mock_client_instance)
    mock_async_client.return_value.__aexit__ = AsyncMock(return_value=False)

    with patch("app.workers.doc_gen_worker.httpx.AsyncClient", mock_async_client), \
         patch("app.workers.doc_gen_worker.render_pdf", return_value=b"PDF_CONTENT") as mock_pdf, \
         patch("app.workers.doc_gen_worker.upload_document", return_value="minio/path/to/doc.pdf") as mock_upload, \
         patch("app.workers.doc_gen_worker.release_lock", AsyncMock()) as mock_lock, \
         patch("app.workers.doc_gen_worker.log_interaction", AsyncMock()) as mock_log, \
         patch("app.workers.doc_gen_worker.set_rls_context", AsyncMock()) as mock_rls, \
         patch("app.utils.audit_logger.log_action", AsyncMock()) as mock_audit:

        await handle_job(job_data)

        # Verify webhook was called
        mock_client_instance.post.assert_called_once()
        mock_pdf.assert_called_once()
        mock_upload.assert_called_once()
        mock_lock.assert_called_once()
