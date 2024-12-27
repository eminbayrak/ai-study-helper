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