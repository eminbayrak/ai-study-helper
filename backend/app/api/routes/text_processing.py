from fastapi import APIRouter, HTTPException, UploadFile, File
from app.models.schemas import TextRequest, TextResponse
from app.services.summarizer_service import SummarizerService
from app.services.question_generator_service import QuestionGeneratorService
from app.services.pdf_service import PDFService
from fastapi.responses import StreamingResponse
import PyPDF2
import io

router = APIRouter()
summarizer_service = SummarizerService()
question_service = QuestionGeneratorService()
pdf_service = PDFService()

@router.post("/summarize", response_model=TextResponse)
async def summarize_text(request: TextRequest):
    try:
        result = await summarizer_service.analyze_text(request.text)
        return TextResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-questions", response_model=TextResponse)
async def generate_questions(request: TextRequest):
    try:
        print("Generating questions for text:", request.text[:100])
        
        result = await question_service.generate_questions(request.text)
        
        if not result or not result.get("questions"):
            print("No questions generated")
            return TextResponse(
                questions=["What is the main purpose of this text?"],
                note_type="general",
                key_terms=None
            )
            
        return TextResponse(
            questions=result["questions"],
            note_type=result["note_type"],
            key_terms=result["key_terms"]
        )
    except Exception as e:
        print(f"Error in generate_questions endpoint: {str(e)}")
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