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

# Switch to non-root user
USER edulingo

# Create and activate virtual environment
RUN python -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

# Copy requirements first (as edulingo)
COPY --chown=edulingo:edulingo requirements.txt .

# Install Python dependencies in virtual environment
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY --chown=edulingo:edulingo . .

# Add debug commands
RUN echo "Directory structure:" && \
    ls -R /app && \
    echo "Python path:" && \
    python -c "import sys; print('\n'.join(sys.path))"

# Command to run the application
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT 