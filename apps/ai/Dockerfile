# syntax=docker/dockerfile:1.7
# Servicio FastAPI con Claude (apps/ai)
# Build:  docker build -f apps/ai/Dockerfile -t kapi-ai .  (desde la raíz del monorepo)

FROM python:3.13-slim

WORKDIR /app

# Dependencias del sistema (slim no trae build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY apps/ai/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/ai/ ./

ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

EXPOSE 3002

# Healthcheck nativo (Coolify lo respeta si está habilitado)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -fsS http://localhost:3002/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3002"]
