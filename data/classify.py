"""Classify raw Paris Open Data typologie into simplified categories."""
import re


def classify_typologie(typ: str | None) -> str:
    """Normalize raw typologie into a simple category.

    Categories:
        TERRASSE OUVERTE — open-air terrace
        TERRASSE FERMÉE  — enclosed/glazed terrace
        CONTRE-TERRASSE  — counter-terrace (estivale, permanente, etc.)
        ÉTALAGE          — merchandise display
        AUTRE            — anything else (perpendiculaire, parallèle, exceptionnelle…)
    """
    if not typ:
        return "AUTRE"
    t = typ.upper().strip()
    if re.search(r"CONTRE.?TERRASSE", t):
        return "CONTRE-TERRASSE"
    if "FERMÉE" in t or "FERMEE" in t or "FERMÉES" in t or "FERMEES" in t:
        return "TERRASSE FERMÉE"
    if "OUVERTE" in t or "OUVERTES" in t:
        return "TERRASSE OUVERTE"
    if "ESTIVAL" in t:
        return "CONTRE-TERRASSE"
    if "ÉTALAGE" in t or "ETALAGE" in t:
        return "ÉTALAGE"
    return "AUTRE"
