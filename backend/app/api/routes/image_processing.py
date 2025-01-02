from fastapi import APIRouter, HTTPException, UploadFile, File
from PIL import Image
import pytesseract
import io

router = APIRouter()

@router.post("/process-image")
async def process_image(file: UploadFile = File(...)):
    try:
        # Check if file is an image
        if not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400,
                detail="File must be an image (PNG, JPEG, etc.)"
            )
            
        # Read the image file
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Extract text from image using OCR
        extracted_text = pytesseract.image_to_string(image)
        
        if not extracted_text.strip():
            return {
                "message": "No text was detected in the image",
                "text": ""
            }
            
        return {
            "message": "Text extracted successfully",
            "text": extracted_text.strip()
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error processing image: {str(e)}"
        ) 