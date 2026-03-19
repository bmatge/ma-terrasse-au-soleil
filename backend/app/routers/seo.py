"""SEO endpoints: sitemap.xml generation."""
from datetime import date

from fastapi import APIRouter
from fastapi.responses import Response
from sqlalchemy import select

from app.database import async_session

router = APIRouter(tags=["seo"])


@router.get("/api/sitemap.xml")
async def sitemap() -> Response:
    """Generate a dynamic sitemap.xml with all terrasse pages."""
    from app.models.terrasse import Terrasse

    async with async_session() as session:
        result = await session.execute(select(Terrasse.id))
        ids = [row[0] for row in result.fetchall()]

    today = date.today().isoformat()
    base = "https://ausoleil.app"

    urls = [
        f"""  <url>
    <loc>{base}/</loc>
    <lastmod>{today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>""",
        f"""  <url>
    <loc>{base}/about</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>""",
        f"""  <url>
    <loc>{base}/contact</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>""",
    ]

    for terrasse_id in ids:
        urls.append(f"""  <url>
    <loc>{base}/terrasse/{terrasse_id}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>""")

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(urls)}
</urlset>"""

    return Response(content=xml, media_type="application/xml")
