import re
from typing import Dict, Any, List, Literal
from pydantic import BaseModel, Field, constr
from fastapi import HTTPException

class CoherenceIssueSchema(BaseModel):
    field: str
    issue: str
    severity: Literal["info", "warning", "blocking"]

class DocumentOutputSchema(BaseModel):
    content_html: constr(min_length=1)
    variables_used: Dict[str, str]
    missing_variables: List[str]
    coherence_issues: List[CoherenceIssueSchema]
    needs_human_review: bool
    summary_for_log: str

PROMPT_INJECTION_PATTERNS = [
    r"ignore\s+previous\s+instructions",
    r"ignore\s+les\s+instructions\s+précédentes",
    r"oublie\s+les\s+instructions",
    r"act\s+as\s+admin",
    r"jailbreak",
    r"system:",
    r"dan\s+mode",
    r"pretend\s+you\s+are",
    r"révèle\s+le\s+prompt",
    r"reveal\s+prompt"
]

def check_prompt_injection(message: str) -> None:
    """Verify input text against prompt injection patterns."""
    if not message:
        return
    for pattern in PROMPT_INJECTION_PATTERNS:
        if re.search(pattern, message, re.IGNORECASE):
            raise HTTPException(status_code=400, detail="Message non autorisé (tentative d'injection de prompt détectée)")

def validate_document_output(data: Dict[str, Any]) -> Dict[str, Any]:
    """Strict structural schema validation of the LLM generation response."""
    try:
        validated = DocumentOutputSchema(**data)
        return validated.model_dump()
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Validation structurelle de l'output LLM échouée : {str(e)}"
        )

def check_output_hallucinations(output_data: Dict[str, Any], context_data: Dict[str, Any]) -> None:
    """Ensure the LLM did not invent fake dates, employees, or salaries."""
    variables_used = output_data.get("variables_used", {})
    
    # 1. Salary check - LLM should never guess or output salary if not in context
    salary_keys = [k for k in variables_used.keys() if "salaire" in k.lower() or "salary" in k.lower()]
    for k in salary_keys:
        val = variables_used[k]
        if val and val != "Non renseigné":
            # Check context
            context_salary = context_data.get("salary_band")
            if not context_salary:
                raise HTTPException(
                    status_code=422,
                    detail="Hallucination détectée : l'agent a inséré des informations salariales absentes du contexte."
                )
