"""Helpers compartidos para parsear el JSON que devuelve Claude."""
import json
import re
from typing import Any


def extract_json(text: str) -> Any:
    """Extrae un objeto JSON del texto devuelto por Claude.

    Aunque pedimos JSON estricto en el prompt, a veces el modelo envuelve la
    salida en ```json ... ``` o agrega texto antes/después. Esto lo limpia.
    """
    text = text.strip()

    # Strip ```json ... ``` o ``` ... ``` wrapping
    fence_match = re.search(r"```(?:json)?\s*\n?(.*?)\n?```", text, re.DOTALL)
    if fence_match:
        text = fence_match.group(1).strip()

    # Try direct parse
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try to find the first { ... } or [ ... ] in the text
    for opener, closer in [("{", "}"), ("[", "]")]:
        start = text.find(opener)
        if start == -1:
            continue
        depth = 0
        for i in range(start, len(text)):
            if text[i] == opener:
                depth += 1
            elif text[i] == closer:
                depth -= 1
                if depth == 0:
                    candidate = text[start : i + 1]
                    try:
                        return json.loads(candidate)
                    except json.JSONDecodeError:
                        break

    raise ValueError(f"No JSON válido encontrado en la respuesta: {text[:200]}...")
