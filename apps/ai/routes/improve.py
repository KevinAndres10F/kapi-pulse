"""POST /api/ai/improve — mejora un texto existente con varias variantes."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from anthropic import APIError, RateLimitError

from lib.claude import get_client, cached_system, CLAUDE_MODEL, SYSTEM_IMPROVE
from lib.json_parse import extract_json

router = APIRouter(prefix="/api/ai", tags=["improve"])


Platform = Literal[
    "linkedin", "facebook", "instagram", "x", "tiktok", "threads", "youtube"
]


class ImproveRequest(BaseModel):
    text: str = Field(..., min_length=10, max_length=5000)
    platform: Platform | None = None
    goal: str | None = Field(default=None, max_length=500, description="Qué querés mejorar")


class ImprovedVariant(BaseModel):
    content: str
    changes: str  # qué cambió esta versión vs el original


class ImproveResponse(BaseModel):
    analysis: str  # qué detectó del texto original
    variants: list[ImprovedVariant]
    model: str


@router.post("/improve", response_model=ImproveResponse)
async def improve(req: ImproveRequest):
    user_prompt = f"""Mejorá este texto:

TEXTO ORIGINAL:
{req.text}
"""
    if req.platform:
        user_prompt += f"\nRED SOCIAL: {req.platform.upper()}\n"
    if req.goal:
        user_prompt += f"\nOBJETIVO ESPECÍFICO DEL USUARIO: {req.goal}\n"

    user_prompt += """
Devolvé JSON estricto con esta estructura exacta:
{
  "analysis": "1-2 frases: qué problemas principales tiene el texto original",
  "variants": [
    {
      "content": "versión mejorada completa con hashtags si aplica",
      "changes": "qué cambiaste y por qué (1 frase concreta)"
    }
  ]
}

Generá 3 variantes con enfoques DISTINTOS — no 3 versiones del mismo cambio. Ejemplo: una recorta y agudiza, otra reescribe el gancho, otra cambia el CTA."""

    try:
        response = get_client().messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            system=cached_system(SYSTEM_IMPROVE),
            messages=[{"role": "user", "content": user_prompt}],
        )
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=f"Rate limit Anthropic: {e}")
    except APIError as e:
        raise HTTPException(status_code=502, detail=f"Error Anthropic: {e}")

    text_blocks = [b.text for b in response.content if b.type == "text"]
    if not text_blocks:
        raise HTTPException(status_code=502, detail="Respuesta sin contenido de texto")

    try:
        data = extract_json(text_blocks[0])
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return ImproveResponse(
        analysis=data.get("analysis", ""),
        variants=[ImprovedVariant(**v) for v in data.get("variants", [])],
        model=response.model,
    )
