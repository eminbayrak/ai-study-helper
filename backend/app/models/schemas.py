from pydantic import BaseModel
from typing import Optional, List, Union

class TextRequest(BaseModel):
    text: str

class TextResponse(BaseModel):
    summary: Optional[str] = None
    questions: Optional[List[str]] = None
    note_type: Optional[str] = None
    foreign_terms: Optional[List[str]] = None

class ErrorResponse(BaseModel):
    detail: str 