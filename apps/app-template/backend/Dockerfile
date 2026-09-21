# Backend image for the app-template starter (FastAPI + Uvicorn).

FROM python:3.12-slim

WORKDIR /app

# Install dependencies first so they are cached independently of source changes.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]