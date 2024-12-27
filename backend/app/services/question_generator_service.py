from transformers import pipeline
import re
from typing import Dict, List

class QuestionGeneratorService:
    def __init__(self):
        # Initialize the question generation pipeline
        self.generator = pipeline("text2text-generation", model="google/flan-t5-base")

    def _clean_text(self, text: str) -> str:
        # Remove extra whitespace and normalize text
        return re.sub(r'\s+', ' ', text).strip()

    def _generate_prompts(self, text: str) -> List[str]:
        # Create different prompts based on text content
        prompts = [
            f"Generate a question about: {text}",
            f"What are the key points in: {text}",
            f"Ask a question to test understanding of: {text}",
            f"What would you ask to verify comprehension of: {text}",
            f"Create a technical question about: {text}"
        ]
        return prompts

    def _extract_key_terms(self, text: str) -> List[str]:
        # Extract technical terms and important concepts
        terms = set()
        
        # Match code-like terms
        code_terms = re.findall(r'["\']([^"\']+)["\']|`([^`]+)`|\{([^\}]+)\}', text)
        for matches in code_terms:
            terms.update(match for match in matches if match)
            
        # Match technical terms (capitalized words, numbers with units)
        technical_terms = re.findall(r'\b[A-Z][a-zA-Z]*\b|\b\d+(?:\.\d+)?(?:\s*[a-zA-Z]+)?\b', text)
        terms.update(technical_terms)
        
        return list(terms)

    def _detect_text_type(self, text: str) -> str:
        # Detect the type of text
        patterns = {
            'code': r'[\{\}()\[\];]|function|class|var|const|let',
            'technical': r'endpoint|api|database|algorithm|function',
            'mathematical': r'\b\d+(?:\.\d+)?\b|average|count|length',
        }
        
        matches = {
            category: len(re.findall(pattern, text.lower()))
            for category, pattern in patterns.items()
        }
        
        max_matches = max(matches.values())
        if max_matches > 0:
            return max(matches.items(), key=lambda x: x[1])[0]
        return "general"

    async def generate_questions(self, text: str) -> Dict:
        try:
            # Clean and prepare text
            cleaned_text = self._clean_text(text)
            if not cleaned_text:
                return {
                    "questions": [],
                    "note_type": "general",
                    "key_terms": None
                }

            # Generate prompts
            prompts = self._generate_prompts(cleaned_text)
            
            # Generate questions
            questions = []
            for prompt in prompts[:3]:  # Limit to 3 questions for performance
                response = self.generator(
                    prompt,
                    max_length=64,
                    num_return_sequences=1,
                    do_sample=True,
                    temperature=0.7
                )
                question = response[0]['generated_text'].strip()
                if question and question not in questions and question.endswith('?'):
                    questions.append(question)

            # Extract key terms and detect type
            key_terms = self._extract_key_terms(cleaned_text)
            text_type = self._detect_text_type(cleaned_text)

            # Add specific questions based on text type
            if text_type == 'technical':
                questions.append("How would you implement this solution?")
            elif text_type == 'mathematical':
                questions.append("Can you explain the calculation process?")

            return {
                "questions": questions,
                "note_type": text_type,
                "key_terms": key_terms if key_terms else None
            }

        except Exception as e:
            print(f"Error generating questions: {str(e)}")
            return {
                "questions": [],
                "note_type": "general",
                "key_terms": None
            } 