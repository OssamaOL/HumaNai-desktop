import bleach

ALLOWED_TAGS = [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "ul", "ol", "li",
    "table", "thead", "tbody", "tr", "td", "th",
    "strong", "em", "br", "span"
]

def sanitize_html(raw_html: str) -> str:
    """Sanitize raw HTML using bleach to strip out unsafe tags, scripts, styles, and attributes."""
    if not raw_html:
        return ""
    cleaned = bleach.clean(
        raw_html,
        tags=ALLOWED_TAGS,
        attributes={},  # Allow no attributes (style, scripts, classes, etc.) to ensure zero code/injection execution
        strip=True
    )
    return cleaned
