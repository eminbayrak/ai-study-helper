# Use Python 3.9 or higher
FROM python:3.9-slim

# Install system dependencies required for OpenCV and Tesseract
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    tesseract-ocr \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user
RUN useradd -m -u 1000 appuser

# Create and set working directory ownership
RUN mkdir /app && chown appuser:appuser /app
WORKDIR /app

# Switch to non-root user
USER appuser

# Create and activate virtual environment
RUN python -m venv /app/venv
ENV PATH="/app/venv/bin:$PATH"

# Copy requirements first (as appuser)
COPY --chown=appuser:appuser requirements.txt .

# Install Python dependencies in virtual environment
RUN pip install --no-cache-dir -r requirements.txt --upgrade pip

# Copy the rest of the application
COPY --chown=appuser:appuser . .

# Set environment variable for port
ENV PORT=8080

# Expose the port
EXPOSE 8080

# Command to run the application
CMD [ "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1" ] 