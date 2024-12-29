from fastapi import APIRouter, HTTPException, UploadFile, File
from app.models.schemas import TextRequest, TextResponse
from app.services.openrouter_service import OpenRouterService
from app.services.pdf_service import PDFService
from fastapi.responses import StreamingResponse
import PyPDF2
import io
import sys

router = APIRouter()
openrouter_service = OpenRouterService()
pdf_service = PDFService()

# Add constants
MAX_TEXT_LENGTH = 50000  # characters
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB in bytes

@router.post("/summarize", response_model=TextResponse)
async def summarize_text(request: TextRequest):
    if len(request.text) > MAX_TEXT_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Text length must be less than {MAX_TEXT_LENGTH} characters"
        )
    try:
        summary = await openrouter_service.generate_summary(request.text)
        return TextResponse(
            summary=summary,
            note_type="general"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-questions", response_model=TextResponse)
async def generate_questions(request: TextRequest):
    try:
        questions = await openrouter_service.generate_questions(request.text)
        return TextResponse(
            questions=questions,
            note_type="general"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/extract-pdf")
async def extract_pdf(file: UploadFile = File(...)):
    try:
        # Check file size
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset position
        
        if file_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"File size must be less than {MAX_FILE_SIZE/1024/1024}MB"
            )

        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")
            
        content = await file.read()
        pdf_file = io.BytesIO(content)
        
        # Read PDF
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        
        # Check number of pages
        if len(pdf_reader.pages) > 50:  # Limit to 50 pages
            raise HTTPException(
                status_code=400,
                detail="PDF must be less than 50 pages"
            )
            
        text = ""
        # Extract text from all pages
        for page in pdf_reader.pages:
            text += page.extract_text()
            
        # Check text length
        if len(text) > MAX_TEXT_LENGTH:
            text = text[:MAX_TEXT_LENGTH] + "\n\n[Text truncated due to length...]"
            
        return {"extracted_text": text.strip()}
        
    except Exception as e:
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/download-pdf")
async def download_pdf(request: TextRequest):
    try:
        buffer = pdf_service.generate_pdf(
            title="AI Study Helper Notes",
            content=request.text,
            note_type=request.note_type if hasattr(request, 'note_type') else "General Notes"
        )
        
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "attachment; filename=study_notes.pdf"
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) 