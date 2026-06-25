import logging
from jinja2 import Template

logger = logging.getLogger("pdf_renderer")

# Robust fallback in case WeasyPrint cannot load GTK+ libraries on Windows
try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except Exception as e:
    WEASYPRINT_AVAILABLE = False
    logger.warning(
        f"WeasyPrint n'est pas disponible sur ce système (librairies GTK+/Pango manquantes). "
        f"Un rendu PDF factice (mock) sera utilisé par défaut. Erreur : {e}"
    )

def render_html(template_str: str, context: dict) -> str:
    """
    Renders a Jinja2 template with context.
    """
    template = Template(template_str)
    return template.render(**context)

def render_pdf(html_content: str) -> bytes:
    """
    Renders HTML content to PDF bytes.
    If WeasyPrint is not available, returns a mock PDF byte stream.
    """
    if WEASYPRINT_AVAILABLE:
        try:
            import io
            pdf_io = io.BytesIO()
            HTML(string=html_content).write_pdf(pdf_io)
            return pdf_io.getvalue()
        except Exception as e:
            logger.error(f"Échec de génération PDF avec WeasyPrint : {e}")
            
    # Fallback mock PDF format
    return b"%PDF-1.4\n% Mock PDF generated because WeasyPrint is not available or failed."
