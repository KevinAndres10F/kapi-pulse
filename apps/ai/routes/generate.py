"""POST /api/ai/generate — genera variantes de copy para una red social."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal
from anthropic import APIError, RateLimitError

from lib.claude import get_client, cached_system, CLAUDE_MODEL, SYSTEM_GENERATE
from lib.json_parse import extract_json

router = APIRouter(prefix="/api/ai", tags=["generate"])


Platform = Literal[
    "linkedin", "facebook", "instagram", "x", "tiktok", "threads", "youtube"
]


class GenerateRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=2000, description="Tema o idea del post")
    platform: Platform
    tone: str = Field(default="profesional", max_length=200)
    language: str = Field(default="es")
    context: str | None = Field(default=None, max_length=2000, description="Info extra de marca/audiencia")
    n_variants: int = Field(default=3, ge=1, le=5)


class PostVariant(BaseModel):
    content: str
    hashtags: list[str]
    rationale: str


class GenerateResponse(BaseModel):
    variants: list[PostVariant]
    model: str
    cache_read: int = 0
    cache_write: int = 0


@router.post("/generate", response_model=GenerateResponse)
async def generate(req: GenerateRequest):
    user_prompt = f"""Generá {req.n_variants} variantes de post para {req.platform.upper()} sobre este tema.

TEMA: {req.topic}

TONO DESEADO: {req.tone}
IDIOMA: {req.language}
"""
    if req.context:
        user_prompt += f"\nCONTEXTO DE LA MARCA / AUDIENCIA: {req.context}\n"

    user_prompt += """
Devolvé JSON estricto con esta estructura exacta:
{
  "variants": [
    {
      "content": "texto del post sin hashtags",
      "hashtags": ["hashtag1SinNumeral", "hashtag2"],
      "rationale": "1 frase sobre por qué este enfoque va a funcionar"
    }
  ]
}

Cada variante debe ser distinta en enfoque, no solo en palabras. Por ejemplo: una con historia personal, otra con dato concreto, otra con pregunta provocadora."""

    try:
        response = get_client().messages.create(
            model=CLAUDE_MODEL,
            max_tokens=4096,
            system=cached_system(SYSTEM_GENERATE),
            messages=[{"role": "user", "content": user_prompt}],
        )
    except RateLimitError as e:
        raise HTTPException(status_code=429, detail=f"Rate limit Anthropic: {e}")
    except APIError as e:
        raise HTTPException(status_code=502, detail=f"Error Anthropic: {e}")

    # Extract first text block
    text_blocks = [b.text for b in response.content if b.type == "text"]
    if not text_blocks:
        raise HTTPException(status_code=502, detail="Respuesta sin contenido de texto")

    try:
        data = extract_json(text_blocks[0])
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if "variants" not in data or not isinstance(data["variants"], list):
        raise HTTPException(status_code=502, detail="Respuesta sin campo 'variants'")

    return GenerateResponse(
        variants=[PostVariant(**v) for v in data["variants"]],
        model=response.model,
        cache_read=response.usage.cache_read_input_tokens or 0,
        cache_write=response.usage.cache_creation_input_tokens or 0,
    )
