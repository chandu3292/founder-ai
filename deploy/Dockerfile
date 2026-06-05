# syntax=docker/dockerfile:1

############  Stage 1: build the React frontend  ############
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build      # outputs frontend/dist

############  Stage 2: python runtime (app + agent)  ############
FROM python:3.11-slim AS runtime

ENV PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/cache/hf

# OpenMP for onnxruntime (silero VAD / turn-detector); curl for health checks
RUN apt-get update && apt-get install -y --no-install-recommends \
        libgomp1 curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .
COPY --from=frontend /app/frontend/dist ./frontend/dist

EXPOSE 8006
CMD ["python", "server.py"]
