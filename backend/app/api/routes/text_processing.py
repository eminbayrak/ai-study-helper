from fastapi import APIRouter, HTTPException
from app.models.schemas import TextRequest, TextResponse
from app.services.summarizer_service import SummarizerService
from app.services.question_generator_service import QuestionGeneratorService

router = APIRouter()
summarizer_service = SummarizerService()
question_service = QuestionGeneratorService()

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
        print("Incoming text:", request.text[:100])  # Debug log
        
        result = await question_service.generate_questions(request.text)
        
        print("Generated result:", result)  # Debug log
        
        if not result:
            raise HTTPException(status_code=500, detail="Failed to generate questions")
            
        return TextResponse(
            questions=result["questions"],
            note_type=result["note_type"],
            key_terms=result["key_terms"]
        )
    except Exception as e:
        print(f"Error in generate_questions endpoint: {str(e)}")  # Debug log
        raise HTTPException(status_code=500, detail=str(e)) 