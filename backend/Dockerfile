# Use Python 3.9 or higher
FROM python:3.9-slim

# Install system dependencies required for OpenCV and Tesseract
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    tesseract-ocr \
    tesseract-ocr-eng \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m -u 1000 edulingo

# Create and set working directory ownership
WORKDIR /app
RUN chown edulingo:edulingo /app

# Install Python packages globally before switching to non-root user
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && \
    pip install python-dotenv

# Switch to non-root user
USER edulingo

# Copy the rest of the application
COPY --chown=edulingo:edulingo . . 