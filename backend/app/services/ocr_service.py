import cv2
import numpy as np
import pytesseract
from PIL import Image
import logging
from app.utils.image_utils import preprocess_image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OCRService:
    @staticmethod
    async def extract_text(image: Image.Image) -> str:
        try:
            logger.info("Starting OCR process")
            
            # Log image details
            logger.info(f"Image size: {image.size}")
            logger.info(f"Image mode: {image.mode}")
            
            # Preprocess image
            processed_img = preprocess_image(image)
            logger.info("Image preprocessing completed")
            
            # Save processed image for debugging
            cv2.imwrite("debug_processed_image.png", processed_img)
            
            # Extract text
            extracted_text = pytesseract.image_to_string(
                processed_img,
                config='--psm 6 --oem 3 -l eng'  # Added language specification
            )
            
            # Clean up text
            cleaned_text = extracted_text.strip()
            logger.info(f"Extracted text length: {len(cleaned_text)}")
            logger.info(f"First 100 chars: {cleaned_text[:100]}")
            
            if not cleaned_text:
                logger.warning("No text was extracted from the image")
                return "No text could be extracted from the image"
                
            return cleaned_text
            
        except Exception as e:
            logger.error(f"OCR processing failed: {str(e)}")
            raise Exception(f"OCR processing failed: {str(e)}") 