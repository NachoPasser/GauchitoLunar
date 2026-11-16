FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Shared libs que el GDAL bundleado de rasterio necesita en slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    libexpat1 \
    libcurl4 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

COPY backend/ ./backend/
COPY frontend/ ./frontend/
COPY data/ ./data/

WORKDIR /app/backend

EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
