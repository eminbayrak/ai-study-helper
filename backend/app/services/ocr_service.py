import cv2
import numpy as np
import pytesseract
from PIL import Image
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class OCRService:
    @staticmethod
    async def extract_text(image: Image.Image) -> str:
        try:
            # Convert PIL Image to cv2 format
            img_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Resize image if too large (helps with speed)
            height, width = img_cv.shape[:2]
            if width > 2000:
                scale = 2000 / width
                img_cv = cv2.resize(img_cv, None, fx=scale, fy=scale)

            # Convert to grayscale
            gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
            
            # Denoise
            denoised = cv2.fastNlMeansDenoising(gray)
            
            # Increase contrast
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            enhanced = clahe.apply(denoised)
            
            # Threshold
            _, binary = cv2.threshold(enhanced, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

            # OCR Configuration
            custom_config = r'--oem 3 --psm 6 -c preserve_interword_spaces=1'
            
            # Extract text
            extracted_text = pytesseract.image_to_string(
                binary,
                config=custom_config,
                lang='eng'  # Specify English language
            )
            
            # Clean up text
            cleaned_text = ' '.join(line.strip() for line in extracted_text.splitlines() if line.strip())
            
            if not cleaned_text:
                return "No text could be extracted from the image"
                
            return cleaned_text
            
        except Exception as e:
            logger.error(f"OCR processing failed: {str(e)}")
            raise Exception(f"OCR processing failed: {str(e)}") 