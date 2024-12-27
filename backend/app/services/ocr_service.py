import cv2
import numpy as np
import pytesseract
from PIL import Image
from app.utils.image_utils import preprocess_image

class OCRService:
    @staticmethod
    async def extract_text(image: Image.Image) -> str:
        try:
            processed_img = preprocess_image(image)
            extracted_text = pytesseract.image_to_string(
                processed_img,
                config='--psm 6 --oem 3'
            )
            return extracted_text.strip()
        except Exception as e:
            raise Exception(f"OCR processing failed: {str(e)}") 