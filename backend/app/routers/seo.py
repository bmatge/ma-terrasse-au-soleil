"""SEO endpoints: sitemap index + paginated sub-sitemaps."""
import math
import unicodedata
from datetime import date

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from sqlalchemy import text

from app.database import async_session

router = APIRouter(tags=["seo"])

BASE_URL = "https://ausoleil.app"
TERRASSES_PER_SITEMAP = 10_000


def _slugify(s: str) -> str:
    """Turn a place name into a URL-friendly slug."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    import re
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


# Quartiers & lieux populaires de Paris pour le sitemap recherche
PARIS_LIEUX = [
    "Marais", "Bastille", "Oberkampf", "Belleville", "Montmartre",
    "Saint-Germain-des-Prés", "Latin", "Batignolles", "Buttes-Chaumont",
    "Canal Saint-Martin", "Opéra", "Châtelet", "République", "Nation",
    "Père Lachaise", "Pigalle", "Abbesses", "Ménilmontant",
    "Alésia", "Denfert-Rochereau", "Odéon", "Maubert",
    "Place d'Italie", "Bercy", "Bibliothèque", "Tolbiac",
    "Trocadéro", "Champs-Élysées", "Invalides", "Concorde",
    "Grands Boulevards", "Sentier", "Bourse", "Palais-Royal",
    "Saint-Michel", "Luxembourg", "Mouffetard", "Jussieu",
    "Gare de Lyon", "Gare du Nord", "Gare de l'Est", "Montparnasse",
    "Convention", "Vaugirard", "Commerce", "La Motte-Picquet",
    "Passy", "Auteuil", "Gambetta", "Charonne", "Ledru-Rollin",
]


@router.get("/api/sitemap.xml")
async def sitemap_index() -> Response:
    """Sitemap index pointing to static + paginated terrasse sitemaps."""
    today = date.today().isoformat()

    async with async_session() as db:
        result = await db.execute(text("SELECT COUNT(*) FROM terrasses"))
        total = result.scalar()

    num_pages = max(1, math.ceil(total / TERRASSES_PER_SITEMAP))

    sitemaps = [f"""  <sitemap>
    <loc>{BASE_URL}/api/sitemap-static.xml</loc>
    <lastmod>{today}</lastmod>
  </sitemap>""",
    f"""  <sitemap>
    <loc>{BASE_URL}/api/sitemap-recherche.xml</loc>
    <lastmod>{today}</lastmod>
  </sitemap>"""]

    for page in range(1, num_pages + 1):
        sitemaps.append(f"""  <sitemap>
    <loc>{BASE_URL}/api/sitemap-terrasses-{page}.xml</loc>
    <lastmod>{today}</lastmod>
  </sitemap>""")

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(sitemaps)}
</sitemapindex>"""

    return Response(content=xml, media_type="application/xml")


@router.get("/api/sitemap-static.xml")
async def sitemap_static() -> Response:
    """Sitemap for static pages."""
    today = date.today().isoformat()

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{BASE_URL}/</loc>
    <lastmod>{today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>{BASE_URL}/search</loc>
    <lastmod>{today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>{BASE_URL}/about</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>{BASE_URL}/contact</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>"""

    return Response(content=xml, media_type="application/xml")


@router.get("/api/sitemap-terrasses-{page}.xml")
async def sitemap_terrasses(page: int) -> Response:
    """Paginated sitemap for terrasse detail pages with image extension."""
    if page < 1:
        raise HTTPException(status_code=404, detail="Invalid page")

    offset = (page - 1) * TERRASSES_PER_SITEMAP

    async with async_session() as db:
        result = await db.execute(text("SELECT COUNT(*) FROM terrasses"))
        total = result.scalar()

    num_pages = max(1, math.ceil(total / TERRASSES_PER_SITEMAP))
    if page > num_pages:
        raise HTTPException(status_code=404, detail="Page not found")

    async with async_session() as db:
        result = await db.execute(
            text("""
                SELECT id, nom, nom_commercial, adresse, arrondissement
                FROM terrasses
                ORDER BY id
                LIMIT :limit OFFSET :offset
            """),
            {"limit": TERRASSES_PER_SITEMAP, "offset": offset},
        )
        rows = result.fetchall()

    today = date.today().isoformat()
    urls = []

    for row in rows:
        terrasse_id, nom, nom_commercial, adresse, arrondissement = row
        display_name = _xml_escape(nom_commercial or nom)
        loc = f"{BASE_URL}/terrasse/{terrasse_id}"
        poster_url = f"{BASE_URL}/api/terrasses/{terrasse_id}/poster"

        caption_parts = [display_name]
        if adresse:
            caption_parts.append(_xml_escape(adresse))
        if arrondissement:
            caption_parts.append(f"Paris {arrondissement}")
        caption = " — ".join(caption_parts)

        urls.append(f"""  <url>
    <loc>{loc}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
    <image:image>
      <image:loc>{poster_url}</image:loc>
      <image:title>Ensoleillement annuel — {display_name}</image:title>
      <image:caption>{caption}</image:caption>
    </image:image>
  </url>""")

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
{chr(10).join(urls)}
</urlset>"""

    return Response(content=xml, media_type="application/xml")


@router.get("/api/sitemap-recherche.xml")
async def sitemap_recherche() -> Response:
    """Sitemap for popular search landing pages (/recherche/...)."""
    today = date.today().isoformat()
    urls = []

    for lieu in PARIS_LIEUX:
        slug = _slugify(lieu)
        urls.append(f"""  <url>
    <loc>{BASE_URL}/recherche/{slug}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>""")

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(urls)}
</urlset>"""

    return Response(content=xml, media_type="application/xml")


def _xml_escape(s: str) -> str:
    """Escape special XML characters."""
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )
