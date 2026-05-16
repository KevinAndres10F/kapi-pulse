"""POST /api/ai/studio/copy — genera copy contextual para campañas de Studio.

Recibe el brief del producto + descripción del visual generado y devuelve
copy + hashtags + CTA por cada plataforma solicitada. Reutiliza
SYSTEM_GENERATE (mismo system prompt cacheado) para aprovechar el cache hit
de Anthropic cuando hay alto volumen.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, Any
from anthropic import APIError, RateLimitError

from lib.claude import get_client, cached_system, CLAUDE_MODEL, SYSTEM_GENERATE
from lib.json_parse import extract_json


router = APIRouter(prefix="/api/ai/studio", tags=["studio"])


Platform = Literal[
    "linkedin", "facebook", "instagram", "x", "tiktok", "threads", "youtube"
]


class StudioCopyRequest(BaseModel):
    brief: dict[str, Any] = Field(..., description="Brief del producto: {product, audience, tone, format, notes?}")
    platforms: list[Platform] = Field(..., min_length=1)
    image_description: str | None = Field(default=None, max_length=1500)
    n_variants: int = Field(default=3, ge=1, le=5)


class StudioCopyVariant(BaseModel):
    platform: Platform
    content: str
    hashtags: list[str]
    cta: str | None = None
    rationale: str


class StudioCopyResponse(BaseModel):
    variants: list[StudioCopyVariant]
    model: str
    cache_read: int = 0
    cache_write: int = 0


def _format_brief(brief: dict[str, Any]) -> str:
    lines = []
    if brief.get("product"):
        lines.append(f"PRODUCTO: {brief['product']}")
    if brief.get("audience"):
        lines.append(f"AUDIENCIA: {brief['audience']}")
    if brief.get("tone"):
        lines.append(f"TONO DESEADO: {brief['tone']}")
    if brief.get("format"):
        lines.append(f"FORMATO: {brief['format']}")
    if brief.get("notes"):
        lines.append(f"NOTAS ADICIONALES: {brief['notes']}")
    return "\n".join(lines)


@router.post("/copy", response_model=StudioCopyResponse)
async def studio_copy(req: StudioCopyRequest):
    brief_text = _format_brief(req.brief)
    platforms_label = ", ".join(p.upper() for p in req.platforms)

    user_prompt = f"""Necesito copy adaptado para una campaña de marketing.

{brief_text}

PLATAFORMAS OBJETIVO: {platforms_label}
NÚMERO DE VARIANTES POR PLATAFORMA: {req.n_variants}
"""

    if req.image_description:
        user_prompt += f"\nDESCRIPCIÓN DEL VISUAL QUE ACOMPAÑA AL POST: {req.image_description}\n"

    user_prompt += """
Generá variantes adaptadas a cada plataforma respetando los límites y estilo de cada red.
Cada variante debe abordar el producto desde un ángulo distinto (beneficio funcional, story-driven, prueba social, urgencia, etc.) — no variantes cosméticas del mismo enfoque.

Devolvé JSON estricto con esta estructura exacta:
{
  "variants": [
    {
      "platform": "instagram",
      "content": "texto del post sin hashtags",
      "hashtags": ["hashtag1SinNumeral", "hashtag2"],
      "cta": "frase corta de llamado a la acción",
      "rationale": "1 frase sobre por qué este enfoque va a funcionar"
    }
  ]
}
"""

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

    text_blocks = [b.text for b in response.content if b.type == "text"]
    if not text_blocks:
        raise HTTPException(status_code=502, detail="Respuesta sin contenido de texto")

    try:
        data = extract_json(text_blocks[0])
    except ValueError as e:
        raise HTTPException(status_code=502, detail=str(e))

    if "variants" not in data or not isinstance(data["variants"], list):
        raise HTTPException(status_code=502, detail="Respuesta sin campo 'variants'")

    return StudioCopyResponse(
        variants=[StudioCopyVariant(**v) for v in data["variants"]],
        model=response.model,
        cache_read=response.usage.cache_read_input_tokens or 0,
        cache_write=response.usage.cache_creation_input_tokens or 0,
    )
