from fastapi import HTTPException
from app.middleware.firebase_auth import CurrentUser

ROLE_PERMISSIONS = {
    "collaborateur": {
        "generate_document": True,
        "view_employee": False,
        "view_salary": False,
        "manage_templates": False,
        "manage_rules": False,
        "approve_document": False,
    },
    "manager": {
        "generate_document": True,
        "view_employee": True,
        "view_salary": False,
        "manage_templates": False,
        "manage_rules": False,
        "approve_document": True,
    },
    "rh": {
        "generate_document": True,
        "view_employee": True,
        "view_salary": False,
        "manage_templates": True,
        "manage_rules": True,
        "approve_document": True,
    },
    "admin": {
        "generate_document": True,
        "view_employee": True,
        "view_salary": True,
        "manage_templates": True,
        "manage_rules": True,
        "approve_document": True,
    },
    "super_admin": {
        "generate_document": True,
        "view_employee": True,
        "view_salary": True,
        "manage_templates": True,
        "manage_rules": True,
        "approve_document": True,
    }
}

def verify_permission(user: CurrentUser, action: str) -> None:
    role = user.role.lower()
    role_perms = ROLE_PERMISSIONS.get(role, {})
    if not role_perms.get(action, False):
        raise HTTPException(
            status_code=403,
            detail=f"Action '{action}' non autorisée pour le rôle {user.role}"
        )
