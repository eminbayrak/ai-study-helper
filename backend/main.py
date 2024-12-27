from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from PIL import Image
import io
import cv2
import numpy as np
import pytesseract
from dotenv import load_dotenv
import random
from transformers import pipeline

# Load environment variables
load_dotenv()

app = FastAPI()

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # WARNING: Don't use in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the pipeline once at startup
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

def preprocess_image(image):
    # Convert PIL Image to cv2 format
    img_cv = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
    
    # Convert to grayscale
    gray = cv2.cvtColor(img_cv, cv2.COLOR_BGR2GRAY)
    
    # Apply thresholding
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Increase image size for better OCR
    scale_factor = 2
    enlarged = cv2.resize(binary, None, fx=scale_factor, fy=scale_factor, interpolation=cv2.INTER_CUBIC)
    
    # Denoise
    denoised = cv2.fastNlMeansDenoising(enlarged)
    
    return denoised

@app.post("/extract-text")
async def extract_text(image: UploadFile = File(...)):
    try:
        print("Received request")
        print("File name:", image.filename)
        print("Content type:", image.content_type)
        
        # Verify the content type
        if not image.content_type or not image.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400, 
                detail=f"File must be an image. Received content type: {image.content_type}"
            )
            
        # Read the image content
        contents = await image.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file received")
            
        # Open and preprocess the image
        img = Image.open(io.BytesIO(contents)).convert('RGB')
        processed_img = preprocess_image(img)
        
        # Save processed image for debugging
        cv2.imwrite("processed_image.png", processed_img)
        
        # Extract text using Tesseract
        extracted_text = pytesseract.image_to_string(
            processed_img,
            config='--psm 6 --oem 3'  # PSM 6 assumes a uniform block of text
        )
        
        # Clean up the extracted text
        extracted_text = extracted_text.strip()
        
        print("Extracted text:", extracted_text)
        
        # Close the file and clean up
        await image.close()
        
        return {"extracted_text": extracted_text}
    except Exception as e:
        print("Error processing image:", str(e))
        print("Error type:", type(e))
        import traceback
        print("Traceback:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

class TextRequest(BaseModel):
    text: str

# Helper function to calculate appropriate max_length
def get_max_length(text_length: int) -> int:
    # Generally, summaries should be shorter than the input
    # A common ratio is 0.3 to 0.5 of the input length
    return max(30, min(int(text_length * 0.4), 150))

@app.post("/summarize")
async def summarize_text(request: TextRequest):
    try:
        # Enhanced patterns for study note detection
        study_patterns = {
            'language': {
                'patterns': ["vocabulary", "grammar", "phrase", "pronunciation", "translate",
                           "hiragana", "katakana", "kanji", "conjugation", "tense"],
                'structure': {
                    'title_patterns': [r'^\d+\..*', r'^Chapter.*', r'^Lesson.*'],
                    'term_patterns': [r'.*\(.*\).*', r'.*：.*', r'.*:.*'],
                    'section_markers': ['Basic Expressions', 'Vocabulary', 'Grammar Points', 'Practice']
                }
            },
            'science': {
                'patterns': ["theory", "experiment", "formula", "reaction", "compound",
                           "species", "cell", "organism", "element"],
                'structure': {
                    'title_patterns': [r'^\d+\..*', r'^Chapter.*'],
                    'term_patterns': [r'.*=.*', r'.*:.*'],
                    'section_markers': ['Definition', 'Properties', 'Examples', 'Applications']
                }
            },
            # Add other subjects...
        }

        def analyze_structure(text, note_type):
            sections = []
            current_section = ""
            lines = text.split('\n')
            
            # For language notes
            if note_type == 'language':
                terms_dict = {}
                current_category = None
                
                for line in lines:
                    # Detect section headers
                    if line.strip() and any(char.isdigit() for char in line[:2]):
                        if current_category:
                            sections.append({current_category: terms_dict})
                            terms_dict = {}
                        current_category = line.strip()
                    # Parse terms and translations
                    elif ':' in line or '(' in line:
                        parts = line.split(':') if ':' in line else line.split('(')
                        if len(parts) >= 2:
                            term = parts[0].strip()
                            meaning = parts[1].strip().rstrip(')')
                            if current_category:
                                if current_category not in terms_dict:
                                    terms_dict[current_category] = []
                                terms_dict[current_category].append(f"{term}: {meaning}")
                
                if current_category and terms_dict:
                    sections.append({current_category: terms_dict})
                
                # Create structured summary
                summary_parts = []
                for section in sections:
                    for category, terms in section.items():
                        summary_parts.append(f"{category}:")
                        for term_list in terms.values():
                            summary_parts.extend([f"• {term}" for term in term_list[:5]])
                        summary_parts.append("")
                
                return "\n".join(summary_parts)

            # For other types of notes...
            else:
                # Default summarization for other types
                summarizer = pipeline("summarization", 
                                   model="facebook/bart-large-cnn")
                
                chunks = [text[i:i + 1024] for i in range(0, len(text), 1024)]
                summaries = []
                
                for chunk in chunks:
                    if len(chunk.split()) > 30:
                        summary = summarizer(chunk, 
                                          max_length=150,
                                          min_length=30,
                                          do_sample=False)
                        summaries.append(summary[0]['summary_text'])
                
                return " ".join(summaries)

        # Detect note type
        note_type = None
        max_matches = 0
        
        for subject, config in study_patterns.items():
            matches = sum(1 for pattern in config['patterns'] 
                        if pattern.lower() in request.text.lower())
            if matches > max_matches:
                max_matches = matches
                note_type = subject

        # Generate structured summary
        structured_summary = analyze_structure(request.text, note_type)

        # Extract terms (for language notes)
        foreign_terms = []
        if note_type == 'language':
            for line in request.text.split('\n'):
                if '(' in line and ')' in line:
                    term = line.split('(')[1].split(')')[0].strip()
                    if term and not term.isascii():
                        foreign_terms.append(term)
                elif ':' in line:
                    parts = line.split(':')
                    if len(parts) >= 2 and not parts[0].strip().isascii():
                        foreign_terms.append(parts[0].strip())

        return {
            "summary": structured_summary,
            "note_type": note_type,
            "foreign_terms": foreign_terms if foreign_terms else None
        }

    except Exception as e:
        print(f"Error in summarize_text: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate-questions")
async def generate_questions(request: TextRequest):
    try:
        # First, detect if it's a language learning content
        is_language_content = any(marker in request.text.lower() for marker in [
            'vocabulary', 'grammar', 'phrase', 'pronunciation',
            'hiragana', 'katakana', 'kanji', '(', ')', 'translate'
        ])

        if is_language_content:
            # Extract terms and their meanings
            terms = []
            lines = request.text.split('\n')
            for line in lines:
                if '(' in line and ')' in line or ':' in line:
                    # Handle parentheses format
                    if '(' in line and ')' in line:
                        parts = line.split('(')
                        if len(parts) >= 2:
                            term = parts[1].split(')')[0].strip()
                            meaning = parts[0].strip()
                            terms.append((term, meaning))
                    # Handle colon format
                    elif ':' in line:
                        parts = line.split(':')
                        if len(parts) >= 2:
                            term = parts[0].strip()
                            meaning = parts[1].strip()
                            terms.append((term, meaning))

            # Language learning question templates
            templates = [
                "What is the meaning of '{term}'?",
                "How would you use '{term}' in a sentence?",
                "What is the correct pronunciation of '{term}'?",
                "When would you use the expression '{term}'?",
                "Translate '{term}' to English.",
            ]

            # Generate questions
            questions = []
            used_terms = set()
            
            for term, meaning in terms:
                if term not in used_terms and len(questions) < 5:
                    template = random.choice(templates)
                    questions.append(template.format(term=term))
                    used_terms.add(term)

            return {
                "questions": questions,
                "note_type": "language",
                "key_terms": list(used_terms)
            }
        else:
            # Default summarization-based questions
            summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
            
            # Generate a brief summary first
            summary = summarizer(request.text[:1024], 
                               max_length=150, 
                               min_length=30, 
                               do_sample=False)[0]['summary_text']

            # Generate general comprehension questions
            questions = [
                f"What are the main concepts discussed in this text?",
                f"How would you summarize the key points?",
                f"What is the main purpose of this content?",
                f"What are the important details to remember?",
                f"How would you explain this topic to someone else?"
            ]

            return {
                "questions": questions,
                "note_type": "general",
                "key_terms": None
            }

    except Exception as e:
        print(f"Error in generate_questions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", 8000)),
        reload=True
    )
