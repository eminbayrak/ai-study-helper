from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
import torch

class DeepseekService:
    def __init__(self):
        self.model = AutoModelForSeq2SeqLM.from_pretrained("google/flan-t5-large")
        self.tokenizer = AutoTokenizer.from_pretrained("google/flan-t5-large")
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.device)

    async def generate_summary(self, text: str) -> str:
        try:
            # Improved prompt for technical text
            prompt = (
                "Provide a clear and concise summary of this technical requirement. "
                "Focus on the main requirements and specifications: "
                f"{text}"
            )
            
            inputs = self.tokenizer(
                prompt, 
                return_tensors="pt", 
                max_length=1024, 
                truncation=True
            ).to(self.device)
            
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_length=256,
                    min_length=50,
                    num_beams=5,
                    temperature=0.7,
                    no_repeat_ngram_size=3,
                    do_sample=True,
                    top_p=0.9,
                    early_stopping=True
                )
            
            summary = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Clean up the summary
            summary = summary.replace("Summary:", "").strip()
            
            # If the summary looks like code, generate a new one with different prompt
            if any(code_indicator in summary.lower() for code_indicator in ['print(', 'for ', 'if ', '==']):
                prompt = (
                    "Explain in plain English what this technical requirement is asking for: "
                    f"{text}"
                )
                
                inputs = self.tokenizer(
                    prompt, 
                    return_tensors="pt", 
                    max_length=1024, 
                    truncation=True
                ).to(self.device)
                
                outputs = self.model.generate(
                    **inputs,
                    max_length=256,
                    min_length=50,
                    num_beams=5,
                    temperature=0.7,
                    no_repeat_ngram_size=3,
                    do_sample=True,
                    top_p=0.9,
                    early_stopping=True
                )
                
                summary = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            return summary.strip()

        except Exception as e:
            print(f"Error generating summary: {str(e)}")
            raise e

    async def generate_questions(self, text: str) -> list:
        try:
            # More specific prompt to generate study questions
            prompt = (
                "Generate 5 comprehensive study questions based on this text. "
                "Include questions about key concepts, definitions, and important relationships. "
                "Questions should test understanding, not just recall. "
                f"Text: {text}\n\nQuestions:"
            )
            
            inputs = self.tokenizer(prompt, return_tensors="pt", max_length=1024, truncation=True).to(self.device)
            
            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_length=1024,  # Increased max length
                    min_length=100,   # Added min length
                    num_beams=5,      # Increased beam search
                    temperature=0.8,
                    no_repeat_ngram_size=2,
                    early_stopping=True,
                    do_sample=True,   # Enable sampling
                    top_k=50,         # Add top_k sampling
                    top_p=0.95        # Add nucleus sampling
                )
            
            questions_text = self.tokenizer.decode(outputs[0], skip_special_tokens=True)
            
            # Better question parsing
            questions = []
            for line in questions_text.split('\n'):
                line = line.strip()
                if line and '?' in line:
                    # Clean up the question
                    question = line.split('Questions:')[-1].strip()
                    if not question.endswith('?'):
                        question += '?'
                    questions.append(question)
            
            # Ensure we get exactly 5 questions
            if len(questions) < 5:
                default_questions = [
                    "What are the main concepts discussed in this text?",
                    "How does this material relate to the broader field of study?",
                    "What are the key terms and their definitions?",
                    "What are the major relationships described in the text?",
                    "How would you apply these concepts in practice?"
                ]
                questions.extend(default_questions[len(questions):5])
            
            return questions[:5]

        except Exception as e:
            print(f"Error generating questions: {str(e)}")
            raise e 