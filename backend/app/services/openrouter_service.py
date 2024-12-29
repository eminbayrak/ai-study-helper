import aiohttp
from app.core.settings import get_settings
import json
import tiktoken  # Add this import for token counting

settings = get_settings()

# Add constants at the top of the file
MAX_TOKENS = 16000  # Leave some buffer for the response
MAX_FILE_SIZE_MB = 5
ENCODING = tiktoken.encoding_for_model("gpt-3.5-turbo")

class OpenRouterService:
    def __init__(self):
        self.api_key = settings.OPENROUTER_API_KEY
        self.model = settings.OPENROUTER_MODEL
        self.base_url = "https://openrouter.ai/api/v1"
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "http://localhost:8000",
            "Content-Type": "application/json"
        }

    def count_tokens(self, text: str) -> int:
        """Count the number of tokens in a text."""
        return len(ENCODING.encode(text))

    def truncate_text(self, text: str, max_tokens: int) -> str:
        """Truncate text to fit within token limit."""
        tokens = ENCODING.encode(text)
        if len(tokens) <= max_tokens:
            return text
        return ENCODING.decode(tokens[:max_tokens]) + "\n\n[Text truncated due to length...]"

    async def generate_summary(self, text: str) -> str:
        try:
            # Check token count and truncate if necessary
            if self.count_tokens(text) > MAX_TOKENS:
                text = self.truncate_text(text, MAX_TOKENS)
                print(f"Text truncated to {self.count_tokens(text)} tokens")

            prompt = (
                "You are a helpful AI assistant. Please provide a clear and concise summary "
                f"of the following text:\n\n{text}\n\nSummary:"
            )
            
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": 500,
                "stream": False
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload
                ) as response:
                    response_text = await response.text()
                    print(f"API Response for summary: {response_text}")
                    
                    if response.status != 200:
                        print(f"OpenRouter API error response: {response_text}")
                        raise Exception(f"OpenRouter API error: {response_text}")
                    
                    data = json.loads(response_text)
                    if not data.get('choices'):
                        raise Exception("No choices in API response")
                        
                    return data['choices'][0]['message']['content'].strip()

        except Exception as e:
            print(f"Error in generate_summary: {str(e)}")
            raise e

    async def generate_questions(self, text: str) -> list[str]:
        try:
            # Check token count and truncate if necessary
            if self.count_tokens(text) > MAX_TOKENS:
                text = self.truncate_text(text, MAX_TOKENS)
                print(f"Text truncated to {self.count_tokens(text)} tokens")

            prompt = (
                "You are a helpful AI assistant. Generate 5 study questions based on "
                "this text. Questions should test understanding and critical thinking. "
                "Do not number the questions, just list them with each on a new line.\n\n"
                f"Text: {text}\n\nQuestions (make sure each ends with a question mark):"
            )
            
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.8,
                "max_tokens": 500,
                "stream": False
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload
                ) as response:
                    response_text = await response.text()
                    print(f"API Response for questions: {response_text}")
                    
                    if response.status != 200:
                        print(f"OpenRouter API error response: {response_text}")
                        raise Exception(f"OpenRouter API error: {response_text}")
                    
                    data = json.loads(response_text)
                    print(f"Parsed data: {data}")
                    
                    if not data.get('choices'):
                        raise Exception(f"No choices in API response. Full response: {data}")
                    
                    response_text = data['choices'][0]['message']['content']
                    
                    # Parse questions and remove any numbering
                    questions = []
                    for line in response_text.split('\n'):
                        line = line.strip()
                        line = line.lstrip('0123456789.)[]-• ')
                        line = line.strip()
                        if line and '?' in line:
                            questions.append(line)
                    
                    print(f"Extracted questions: {questions}")
                    
                    # Ensure we have exactly 5 questions
                    while len(questions) < 5:
                        questions.append("What other aspects of this text would you like to explore?")
                    
                    return questions[:5]

        except Exception as e:
            print(f"Error in generate_questions: {str(e)}")
            raise e 