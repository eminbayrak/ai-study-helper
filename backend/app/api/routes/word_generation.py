from fastapi import APIRouter, HTTPException
from app.services.openrouter_service import OpenRouterService
from typing import Dict, List
import random

router = APIRouter()
openrouter_service = OpenRouterService()

@router.get("/random", tags=["words"])
async def get_random_words():
    try:
        prompt = """Generate a JSON object with three arrays of English words categorized by difficulty:
        {
            "easy": [10 common English words],
            "medium": [10 intermediate English words],
            "hard": [10 advanced English words]
        }
        Make sure each array has exactly 10 words. Words should be appropriate for language learning."""
        
        word_sets = await openrouter_service.generate_word_sets(prompt)
        print(f"OpenRouter API Response: {word_sets}")  # Debug print
        
        return {
            "status": "success",
            "data": word_sets
        }
        
    except Exception as e:
        print(f"Error in get_random_words: {str(e)}")  # Debug print
        raise HTTPException(
            status_code=500,
            detail=f"Error generating random words: {str(e)}"
        )

@router.get("/random/{category}", tags=["words"])
async def get_random_words_by_category(category: str):
    valid_categories = ["easy", "medium", "hard"]
    if category.lower() not in valid_categories:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category. Must be one of: {', '.join(valid_categories)}"
        )
        
    try:
        prompt = f"""Generate a JSON object with an array of 10 English words for {category} difficulty level:
        {{
            "{category}": [10 {category}-level English words]
        }}
        Make sure the array has exactly 10 words. Words should be appropriate for language learning."""
        
        word_sets = await openrouter_service.generate_word_sets(prompt)
        
        return {
            "status": "success",
            "data": word_sets[category]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error generating random words: {str(e)}"
        ) 