import re

PII_PATTERNS = {
    "email": r"\b[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+\b",
    "phone": r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,3}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b",
    "cnss": r"\b\d{9}\b",
    "cin": r"\b[A-Z]{1,2}\d{5,6}\b",
}

def mask_pii(text: str) -> str:
    """Mask sensitive PII fields in a given text block."""
    if not text:
        return text
    for pii_type, pattern in PII_PATTERNS.items():
        text = re.sub(pattern, f"[{pii_type.upper()}_MASKED]", text)
    return text
