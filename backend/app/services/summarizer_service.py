from transformers import pipeline
from app.core.settings import get_settings
import re
from typing import Dict, List, Optional

settings = get_settings()

class SummarizerService:
    def __init__(self):
        # Use T5 or BART model specifically trained for summarization
        self.summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

    def _clean_input_text(self, text: str) -> str:
        """Remove metadata and headers from the input text"""
        # Remove the metadata sentence
        text = re.sub(r"Here's a sample of.*?understanding:?\n", "", text, flags=re.DOTALL)
        
        # Remove any empty lines and clean up spacing
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        return '\n'.join(lines)

    def _extract_terms(self, text: str) -> List[str]:
        terms = []
        # Only extract actual Japanese terms and their translations
        patterns = [
            r'([ぁ-んァ-ン一-龥]+)\s*[（(]([^)）]+)[)）]',  # Japanese with readings
            r'([ぁ-んァ-ン一-龥]+)[:：]\s*([^\n]+)',       # Japanese with definitions
            r'([ぁ-んァ-ン一-龥]+)\s*[-]\s*([^\n]+)',      # Japanese with explanations
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                japanese_term = match.group(1).strip()
                # Only include actual Japanese terms, skip any metadata or English text
                if japanese_term and any('\u4e00' <= c <= '\u9fff' or '\u3040' <= c <= '\u30ff' for c in japanese_term):
                    terms.append(japanese_term)
        
        return list(set(terms))

    async def analyze_text(self, text: str) -> Dict:
        try:
            # Clean the text first
            text = self._clean_input_text(text)
            
            # Split text into manageable chunks for the model
            max_chunk_length = 1024
            chunks = [text[i:i + max_chunk_length] for i in range(0, len(text), max_chunk_length)]
            
            summaries = []
            for chunk in chunks:
                # Generate summary for each chunk
                summary = self.summarizer(chunk, 
                    max_length=min(len(chunk.split()) // 2, 150),
                    min_length=30,
                    do_sample=False,
                    truncation=True
                )
                summaries.append(summary[0]['summary_text'])
            
            # Combine summaries
            final_summary = " ".join(summaries)
            
            # Extract only actual Japanese terms
            terms = self._extract_terms(text)
            
            return {
                "summary": final_summary,
                "note_type": "language" if terms else "general",
                "foreign_terms": terms if terms else None
            }
        except Exception as e:
            print(f"Error in summarization: {str(e)}")
            return {
                "summary": "Failed to generate summary",
                "note_type": "general",
                "foreign_terms": None
            } 