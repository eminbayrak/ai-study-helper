from .image_processing import router as image_processing
from .text_processing import router as text_processing
from .word_generation import router as word_generation

__all__ = ["image_processing", "text_processing", "word_generation"] 