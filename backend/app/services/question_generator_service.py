from transformers import T5ForConditionalGeneration, T5Tokenizer
import torch
from typing import Dict, List
import re

class QuestionGeneratorService:
    def __init__(self):
        # Initialize T5 model and tokenizer
        self.model_name = "t5-large"  # Using larger model for better quality
        self.tokenizer = T5Tokenizer.from_pretrained(self.model_name)
        self.model = T5ForConditionalGeneration.from_pretrained(self.model_name)
        
        # Use GPU if available
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.device)

    def _prepare_input_text(self, text: str) -> str:
        """Clean and prepare text for question generation"""
        # Remove extra whitespace and normalize text
        text = re.sub(r'\s+', ' ', text).strip()
        # Prefix for T5 to indicate question generation task
        return f"generate questions: {text}"

    def _extract_key_terms(self, text: str) -> List[str]:
        """Extract important terms from the text"""
        terms = set()
        
        # Match technical terms (capitalized words and phrases)
        technical_terms = re.findall(r'\b[A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*\b', text)
        
        # Match terms in parentheses
        parenthetical_terms = re.findall(r'\(([^)]+)\)', text)
        
        # Match terms after colons or defined terms
        defined_terms = re.findall(r'([A-Z][a-zA-Z]*(?:\s+[A-Z][a-zA-Z]*)*)\s*:', text)
        
        # Add all found terms
        terms.update(technical_terms)
        terms.update(t.strip() for t in parenthetical_terms)
        terms.update(defined_terms)
        
        return sorted(list(terms))

    def _detect_subject(self, text: str) -> str:
        """Detect the subject matter of the text"""
        text_lower = text.lower()
        
        subject_keywords = {
            "quantum_computing": ["quantum", "qubit", "superposition", "entanglement"],
            "programming": ["code", "function", "algorithm", "programming"],
            "mathematics": ["theorem", "equation", "calculation", "math"],
            "physics": ["force", "energy", "particle", "physics"],
            "language": ["grammar", "vocabulary", "pronunciation", "verb"]
        }
        
        # Count matches for each subject
        matches = {
            subject: sum(1 for kw in keywords if kw in text_lower)
            for subject, keywords in subject_keywords.items()
        }
        
        # Return the subject with the most matches, or "general" if no matches
        max_matches = max(matches.values(), default=0)
        if max_matches > 0:
            return max(matches.items(), key=lambda x: x[1])[0]
        return "general"

    async def generate_questions(self, text: str) -> Dict:
        try:
            # Prepare input text
            input_text = self._prepare_input_text(text)
            
            # Tokenize input
            inputs = self.tokenizer(input_text, return_tensors="pt", max_length=1024, truncation=True)
            inputs = inputs.to(self.device)
            
            # Generate multiple questions
            outputs = self.model.generate(
                inputs["input_ids"],
                max_length=64,
                min_length=20,
                num_return_sequences=7,  # Generate extra for filtering
                num_beams=5,
                no_repeat_ngram_size=2,
                early_stopping=True,
                temperature=0.7,
                top_k=50,
                top_p=0.95,
                do_sample=True
            )
            
            # Decode and clean up questions
            questions = []
            for output in outputs:
                question = self.tokenizer.decode(output, skip_special_tokens=True)
                # Clean up and format question
                question = question.strip()
                if not question.endswith('?'):
                    question += '?'
                if question not in questions:  # Avoid duplicates
                    questions.append(question)
            
            # Filter for best questions
            questions = [q for q in questions if len(q.split()) >= 5]  # Ensure meaningful length
            questions = sorted(questions, key=len)[:5]  # Get top 5 questions
            
            # Extract key terms and detect subject
            key_terms = self._extract_key_terms(text)
            subject = self._detect_subject(text)
            
            return {
                "questions": questions,
                "note_type": subject,
                "key_terms": key_terms
            }
            
        except Exception as e:
            print(f"Error generating questions: {str(e)}")
            return {
                "questions": [],
                "note_type": "general",
                "key_terms": None
            } 