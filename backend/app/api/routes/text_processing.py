from fastapi import APIRouter, HTTPException, UploadFile, File
from app.models.schemas import TextRequest, TextResponse
from app.services.openrouter_service import OpenRouterService
from app.services.pdf_service import PDFService
from fastapi.responses import StreamingResponse
import PyPDF2
import io

router = APIRouter()
openrouter_service = OpenRouterService()
pdf_service = PDFService()

@router.post("/summarize", response_model=TextResponse)
async def summarize_text(request: TextRequest):
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
        if not file.filename.endswith('.pdf'):
            raise HTTPException(status_code=400, detail="File must be a PDF")
            
        content = await file.read()
        pdf_file = io.BytesIO(content)
        
        # Read PDF
        pdf_reader = PyPDF2.PdfReader(pdf_file)
        text = ""
        
        # Extract text from all pages
        for page in pdf_reader.pages:
            text += page.extract_text()
            
        return {"extracted_text": text.strip()}
        
    except Exception as e:
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