import aiohttp
from app.core.settings import get_settings
import json

settings = get_settings()

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

    async def generate_summary(self, text: str) -> str:
        try:
            prompt = (
                "You are a helpful AI assistant. Please provide a clear and concise summary "
                f"of the following text:\n\n{text}\n\nSummary:"
            )
            
            payload = {
                "model": self.model,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.7,
                "max_tokens": 500
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload
                ) as response:
                    response_text = await response.text()
                    if response.status != 200:
                        print(f"OpenRouter API error response: {response_text}")
                        raise Exception(f"OpenRouter API error: {response_text}")
                    
                    data = json.loads(response_text)
                    return data['choices'][0]['message']['content'].strip()

        except Exception as e:
            print(f"Error in generate_summary: {str(e)}")
            raise e

    async def generate_questions(self, text: str) -> list[str]:
        try:
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
                "max_tokens": 500
            }

            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/chat/completions",
                    headers=self.headers,
                    json=payload
                ) as response:
                    response_text = await response.text()
                    if response.status != 200:
                        print(f"OpenRouter API error response: {response_text}")
                        raise Exception(f"OpenRouter API error: {response_text}")
                    
                    data = json.loads(response_text)
                    response_text = data['choices'][0]['message']['content']
                    
                    # Parse questions and remove any numbering
                    questions = []
                    for line in response_text.split('\n'):
                        line = line.strip()
                        # Remove any numbering at the start (e.g., "1.", "1)", "[1]", etc.)
                        line = line.lstrip('0123456789.)[]-• ')
                        line = line.strip()
                        if line and '?' in line:
                            questions.append(line)
                    
                    # Ensure we have exactly 5 questions
                    while len(questions) < 5:
                        questions.append("What other aspects of this text would you like to explore?")
                    
                    return questions[:5]

        except Exception as e:
            print(f"Error in generate_questions: {str(e)}")
            raise e 