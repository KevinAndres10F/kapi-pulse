"""KAPI Pulse AI — Servicio FastAPI con endpoints de generación / mejora / análisis.

Diseño: este servicio NO se expone públicamente. Coolify lo levanta sin domain
y apps/api lo proxea por red interna en `http://kapi-ai:3002`. Eso evita que
nuestra ANTHROPIC_API_KEY se gaste por requests externos sin auth.
"""
import os
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import generate, improve, analyze, studio_copy

load_dotenv()

app = FastAPI(
    title="KAPI Pulse AI",
    description="Servicio de IA editorial (generación + análisis) para KAPI Pulse",
    version="0.1.0",
)

# CORS abierto solo si lo configurás explícitamente. En producción no debería
# necesitarse — apps/api lo llama server-to-server, no el browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("APP_URL", "http://localhost:3000"),
        os.getenv("API_URL", "http://localhost:3001"),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"service": "kapi-pulse-ai", "status": "ok"}


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "claude_configured": bool(os.getenv("ANTHROPIC_API_KEY")),
        "model": os.getenv("CLAUDE_MODEL", "claude-opus-4-7"),
    }


app.include_router(generate.router)
app.include_router(improve.router)
app.include_router(analyze.router)
app.include_router(studio_copy.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=3002, reload=True)
