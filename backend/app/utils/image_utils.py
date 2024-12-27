import cv2
import numpy as np
from PIL import Image

def preprocess_image(image: Image.Image) -> np.ndarray:
    # Convert PIL Image to cv2 format
    img_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Convert to grayscale
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    
    # Apply thresholding
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Increase image size for better OCR
    enlarged = cv2.resize(binary, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    
    # Denoise
    denoised = cv2.fastNlMeansDenoising(enlarged)
    
    return denoised 