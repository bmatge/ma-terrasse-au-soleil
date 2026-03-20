"""API Recherche Entreprises integration for enriching terrasse data.

Uses the free, no-auth API at recherche-entreprises.api.gouv.fr
to look up commercial names (enseignes) from SIRET numbers.
"""
import asyncio
import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

SEARCH_URL = "https://recherche-entreprises.api.gouv.fr/search"

# Rate limit: 7 req/s — we stay safe at ~5 req/s
RATE_LIMIT_DELAY = 0.2


@dataclass
class SireneInfo:
    """Data fetched from Recherche Entreprises API."""
    siret: str
    enseigne: str | None = None
    nom_commercial: str | None = None
    nom_raison_sociale: str | None = None
    etat_administratif: str | None = None  # "A" = actif, "F" = fermé
    code_naf: str | None = None
    adresse: str | None = None
    latitude: float | None = None
    longitude: float | None = None


async def fetch_sirene_info(siret: str, client: httpx.AsyncClient | None = None) -> SireneInfo | None:
    """Look up a SIRET on recherche-entreprises.api.gouv.fr.

    Returns SireneInfo with enseigne (commercial name), legal name, NAF code, etc.
    Returns None if not found or API error.
    """
    if not siret or len(siret.strip()) < 9:
        return None

    close_client = False
    if client is None:
        client = httpx.AsyncClient(timeout=10.0)
        close_client = True

    try:
        resp = await client.get(
            SEARCH_URL,
            params={"q": siret, "page": 1, "per_page": 1},
            headers={"User-Agent": "ma-terrasse-au-soleil/1.0"},
        )
        resp.raise_for_status()
        data = resp.json()

        results = data.get("results", [])
        if not results:
            logger.debug("SIRENE: no result for SIRET %s", siret)
            return None

        company = results[0]

        # Find the matching établissement (siege or matching SIRET)
        siege = company.get("siege", {})
        matching_etab = siege  # default to siege

        # Check if the SIRET matches siege, otherwise look in matching_etablissements
        siege_siret = siege.get("siret", "")
        if siege_siret != siret:
            for etab in company.get("matching_etablissements", []):
                if etab.get("siret") == siret:
                    matching_etab = etab
                    break

        # Extract enseigne: liste_enseignes contains the public-facing names
        enseignes = matching_etab.get("liste_enseignes") or []
        enseigne = enseignes[0] if enseignes else None

        # Fallback to nom_commercial if no enseigne
        nom_commercial = matching_etab.get("nom_commercial")

        return SireneInfo(
            siret=siret,
            enseigne=enseigne,
            nom_commercial=nom_commercial,
            nom_raison_sociale=company.get("nom_raison_sociale"),
            etat_administratif=matching_etab.get("etat_administratif"),
            code_naf=matching_etab.get("activite_principale"),
            adresse=matching_etab.get("adresse"),
            latitude=matching_etab.get("latitude"),
            longitude=matching_etab.get("longitude"),
        )
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 429:
            logger.warning("SIRENE rate limited, waiting 2s...")
            await asyncio.sleep(2)
            return await fetch_sirene_info(siret, client)
        logger.warning("SIRENE API error for %s: %s", siret, e)
        return None
    except Exception as e:
        logger.warning("SIRENE fetch error for %s: %s", siret, e)
        return None
    finally:
        if close_client:
            await client.aclose()


async def batch_fetch_sirene(
    sirets: list[str],
    delay: float = RATE_LIMIT_DELAY,
) -> dict[str, SireneInfo]:
    """Fetch SIRENE info for a batch of SIRETs.

    Returns a dict mapping SIRET -> SireneInfo for successful lookups.
    """
    results = {}
    async with httpx.AsyncClient(timeout=10.0) as client:
        for i, siret in enumerate(sirets):
            info = await fetch_sirene_info(siret, client)
            if info:
                results[siret] = info
            if i < len(sirets) - 1:
                await asyncio.sleep(delay)
            if (i + 1) % 50 == 0:
                logger.info("SIRENE: processed %d/%d SIRETs", i + 1, len(sirets))

    logger.info("SIRENE: got info for %d/%d SIRETs", len(results), len(sirets))
    return results
