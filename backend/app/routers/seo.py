"""SEO endpoints: sitemap index + paginated sub-sitemaps."""
import math
import re
import unicodedata
from datetime import date

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import text

from app.database import async_session

router = APIRouter(tags=["seo"])

BASE_URL = "https://ausoleil.app"
TERRASSES_PER_SITEMAP = 2_000


def _slugify(s: str) -> str:
    """Turn a place name into a URL-friendly slug."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = s.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def _xml_escape(s: str) -> str:
    """Escape special XML characters."""
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


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

    sitemaps = f"""  <sitemap>
    <loc>{BASE_URL}/sitemap-static.xml</loc>
    <lastmod>{today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>{BASE_URL}/sitemap-blog.xml</loc>
    <lastmod>{today}</lastmod>
  </sitemap>
  <sitemap>
    <loc>{BASE_URL}/sitemap-recherche.xml</loc>
    <lastmod>{today}</lastmod>
  </sitemap>"""

    for page in range(1, num_pages + 1):
        sitemaps += f"""
  <sitemap>
    <loc>{BASE_URL}/sitemap-terrasses.xml?p={page}</loc>
    <lastmod>{today}</lastmod>
  </sitemap>"""

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{sitemaps}
</sitemapindex>"""

    return Response(content=xml, media_type="application/xml")


@router.get("/api/sitemap-static.xml")
async def sitemap_static() -> Response:
    """Sitemap for static pages."""
    today = date.today().isoformat()

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>{BASE_URL}/</loc><lastmod>{today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>{BASE_URL}/search</loc><lastmod>{today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>
  <url><loc>{BASE_URL}/about</loc><lastmod>{today}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>
  <url><loc>{BASE_URL}/contact</loc><lastmod>{today}</lastmod><changefreq>monthly</changefreq><priority>0.3</priority></url>
</urlset>"""

    return Response(content=xml, media_type="application/xml")


# Blog posts — add new posts here when publishing
BLOG_POSTS = [
    {"slug": "comment-on-a-construit-ausoleil", "date": "2026-03-19"},
    {"slug": "ode-open-data", "date": "2026-03-20"},
    {"slug": "profil-ensoleillement-rorschach", "date": "2026-03-21"},
]


@router.get("/api/sitemap-blog.xml")
async def sitemap_blog() -> Response:
    """Sitemap for blog index + individual posts."""
    today = date.today().isoformat()

    urls = [f'  <url><loc>{BASE_URL}/blog</loc><lastmod>{today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>']
    for post in BLOG_POSTS:
        urls.append(f'  <url><loc>{BASE_URL}/blog/{post["slug"]}</loc><lastmod>{post["date"]}</lastmod><changefreq>monthly</changefreq><priority>0.6</priority></url>')

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(urls)}
</urlset>"""

    return Response(content=xml, media_type="application/xml")


@router.get("/api/sitemap-terrasses.xml")
async def sitemap_terrasses(p: int = Query(1, ge=1)) -> Response:
    """Paginated sitemap for terrasse detail pages. Lightweight: loc + lastmod only."""
    async with async_session() as db:
        result = await db.execute(text("SELECT COUNT(*) FROM terrasses"))
        total = result.scalar()

    num_pages = max(1, math.ceil(total / TERRASSES_PER_SITEMAP))
    if p > num_pages:
        raise HTTPException(status_code=404, detail="Page not found")

    offset = (p - 1) * TERRASSES_PER_SITEMAP

    async with async_session() as db:
        result = await db.execute(
            text("SELECT id FROM terrasses ORDER BY id LIMIT :limit OFFSET :offset"),
            {"limit": TERRASSES_PER_SITEMAP, "offset": offset},
        )
        rows = result.fetchall()

    today = date.today().isoformat()
    entries = "\n".join(
        f'  <url><loc>{BASE_URL}/terrasse/{row[0]}</loc><lastmod>{today}</lastmod></url>'
        for row in rows
    )

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{entries}
</urlset>"""

    return Response(content=xml, media_type="application/xml")


@router.get("/api/sitemap-recherche.xml")
async def sitemap_recherche() -> Response:
    """Sitemap for popular search landing pages (/recherche/...)."""
    today = date.today().isoformat()
    entries = "\n".join(
        f'  <url><loc>{BASE_URL}/recherche/{_slugify(lieu)}</loc><lastmod>{today}</lastmod><changefreq>daily</changefreq><priority>0.8</priority></url>'
        for lieu in PARIS_LIEUX
    )

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{entries}
</urlset>"""

    return Response(content=xml, media_type="application/xml")
