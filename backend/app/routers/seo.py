"""SEO endpoints: sitemap.xml generation."""
from datetime import date

from fastapi import APIRouter
from fastapi.responses import Response

router = APIRouter(tags=["seo"])


@router.get("/api/sitemap.xml")
async def sitemap() -> Response:
    """Generate a sitemap.xml with static pages only."""
    today = date.today().isoformat()
    base = "https://ausoleil.app"

    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>{base}/</loc>
    <lastmod>{today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>{base}/about</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
  <url>
    <loc>{base}/contact</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
</urlset>"""

    return Response(content=xml, media_type="application/xml")
