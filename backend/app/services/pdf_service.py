from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from io import BytesIO

class PDFService:
    @staticmethod
    def generate_pdf(title: str, content: str, note_type: str = "General Notes") -> BytesIO:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        
        # Create custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=30
        )
        
        content_style = ParagraphStyle(
            'CustomBody',
            parent=styles['Normal'],
            fontSize=12,
            spaceAfter=12,
            leading=16  # Add line spacing
        )
        
        # Build PDF content
        elements = []
        elements.append(Paragraph(title, title_style))
        elements.append(Paragraph(f"Type: {note_type}", styles["Italic"]))
        elements.append(Spacer(1, 12))

        # Format content with proper line breaks
        formatted_content = content.replace('\n', '<br/>')  # Convert newlines to HTML breaks
        elements.append(Paragraph(formatted_content, content_style))
        
        # Generate PDF
        doc.build(elements)
        buffer.seek(0)
        return buffer 