FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .
COPY templates/ ./templates/
COPY static/ ./static/
COPY UpdatedLists/ ./UpdatedLists/

RUN mkdir -p /app/data
RUN chmod -R 777 /app/data

ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=app.py

EXPOSE 7860

CMD ["python", "-u", "app.py"]
