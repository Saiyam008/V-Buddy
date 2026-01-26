FROM python:3.9-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all application files
COPY app.py /app/
COPY templates/ /app/templates/
COPY static/ /app/static/
COPY UpdatedLists/ /app/UpdatedLists/

# Create data directory for persistent storage
RUN mkdir -p /app/data

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py

# Expose port for Hugging Face Spaces
EXPOSE 7860

# Run the application
CMD ["python", "-u", "app.py"]
