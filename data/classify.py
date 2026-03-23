"""Classify raw Paris Open Data typologie into simplified categories."""
import re


# Categories excluded from import (not actual terrasses)
EXCLUDED_CATEGORIES = frozenset({"ÉTALAGE", "EXCLU"})


def classify_typologie(typ: str | None) -> str:
    """Normalize raw typologie into a simple category.

    Categories kept:
        TERRASSE OUVERTE — open-air terrace
        TERRASSE FERMÉE  — enclosed/glazed terrace
        CONTRE-TERRASSE  — counter-terrace (estivale, permanente, etc.)
        AUTRE            — plancher mobile, parallèle, perpendiculaire…

    Categories excluded (see EXCLUDED_CATEGORIES):
        ÉTALAGE — merchandise display (not a terrace)
        EXCLU   — commerce accessoire, immobilière, auvent, jardinière, etc.
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
    # Non-terrasse types
    if any(kw in t for kw in (
        "COMMERCE ACCESSOIRE",
        "IMMOBILIÈRE", "IMMOBILIERE",
        "EXCEPTIONNELLE", "MANIFESTATION",
        "AUVENT", "MARQUISE",
        "JARDINIÈRE", "JARDINIERE",
        "ECRAN",
    )):
        return "EXCLU"
    return "AUTRE"
