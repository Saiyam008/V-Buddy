FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY app.py .
COPY templates/ ./templates/
COPY static/ ./static/
COPY UpdatedLists/ ./UpdatedLists/

# Local fallback data directory (used when /data persistent storage is not available)
RUN mkdir -p /app/data

# HF Spaces runs as a non-root user; ensure /app is writable
RUN chmod -R 777 /app/data

ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py

# Hugging Face Spaces expects port 7860
EXPOSE 7860

CMD ["python", "-u", "app.py"]
