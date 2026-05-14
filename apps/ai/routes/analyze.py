"""POST /api/ai/analyze-competitors — analiza muestras de posts de competidores."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from anthropic import APIError, RateLimitError

from lib.claude import get_client, cached_system, CLAUDE_MODEL, SYSTEM_ANALYZE
from lib.json_parse import extract_json

router = APIRouter(prefix="/api/ai", tags=["analyze"])


class CompetitorSample(BaseModel):
    platform: str | None = None
    content: str = Field(..., min_length=10, max_length=10000)
    metric: str | None = Field(default=None, description="Engagement observado, ej. '450 likes, 23 comentarios'")
    url: str | None = None


class AnalyzeRequest(BaseModel):
    competitor_name: str = Field(..., min_length=1, max_length=200)
    samples: list[CompetitorSample] = Field(..., min_length=1, max_length=20)
    industry: str | None = Field(default=None, max_length=200)
    focus_question: str | None = Field(default=None, max_length=500, description="Pregunta específica del usuario")


class Pattern(BaseModel):
    category: str  # 'temas' | 'estructura' | 'tono' | 'frecuencia' | 'hashtags' | 'cta'
    observation: str
    evidence: str  # ejemplo concreto de las samples


class AnalyzeResponse(BaseModel):
    summary: str
    patterns: list[Pattern]
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]
    model: str


@router.post("/analyze-competitors", response_model=AnalyzeResponse)
async def analyze_competitors(req: AnalyzeRequest):
    samples_text = "\n\n".join(
        f"[Muestra {i+1}{' · ' + s.platform if s.platform else ''}{' · ' + s.metric if s.metric else ''}]\n{s.content}"
        for i, s in enumerate(req.samples)
    )

    user_prompt = f"""Analizá los siguientes posts del competidor "{req.competitor_name}".
"""
    if req.industry:
        user_prompt += f"\nSECTOR: {req.industry}\n"
    if req.focus_question:
        user_prompt += f"\nPREGUNTA ESPECÍFICA DEL USUARIO: {req.focus_question}\n"

    user_prompt += f"""
MUESTRAS ({len(req.samples)}):

{samples_text}

Devolvé JSON estricto con esta estructura exacta:
{{
  "summary": "2-3 frases: qué tipo de contenido hace este competidor y qué busca",
  "patterns": [
    {{
      "category": "temas|estructura|tono|frecuencia|hashtags|cta",
      "observation": "patrón concreto que detectaste",
      "evidence": "ejemplo de las muestras que lo demuestra"
    }}
  ],
  "strengths": ["fortaleza específica 1", "fortaleza 2", "fortaleza 3"],
  "weaknesses": ["debilidad / oportunidad 1", "debilidad 2", "debilidad 3"],
  "recommendations": [
    "acción concreta 1 para diferenciarse o aprovechar gap",
    "acción 2",
    "acción 3"
  ]
}}

Identificá al menos 3 patterns. Sé específico con números/frecuencias cuando se vea en las muestras (ej. "5 de 7 posts empiezan con pregunta"). NADA de halagos genéricos tipo "buen contenido"."""

    try:
        response = get_client().messages.create(
            model=CLAUDE_MODEL,
            max_tokens=8192,
            thinking={"type": "adaptive"},  # análisis se beneficia de pensar
            system=cached_system(SYSTEM_ANALYZE),
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

    return AnalyzeResponse(
        summary=data.get("summary", ""),
        patterns=[Pattern(**p) for p in data.get("patterns", [])],
        strengths=data.get("strengths", []),
        weaknesses=data.get("weaknesses", []),
        recommendations=data.get("recommendations", []),
        model=response.model,
    )
