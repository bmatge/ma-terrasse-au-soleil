"""Open Graph preview endpoint for social media bots."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from sqlalchemy import select

from app.database import async_session

router = APIRouter(tags=["og"])


@router.get("/api/og/terrasse/{terrasse_id}", response_class=HTMLResponse)
async def og_terrasse(terrasse_id: int) -> HTMLResponse:
    from app.models.terrasse import Terrasse

    async with async_session() as session:
        result = await session.execute(select(Terrasse).where(Terrasse.id == terrasse_id))
        terrasse = result.scalar_one_or_none()

    if not terrasse:
        raise HTTPException(status_code=404)

    title = terrasse.nom
    adresse = terrasse.adresse or "Paris"
    description = f"{terrasse.nom} — {adresse}. Consulte les créneaux ensoleillés sur Au Soleil."
    url = f"https://ausoleil.app/terrasse/{terrasse_id}"
    image = "https://ausoleil.app/android-chrome-512x512.png"

    html = f"""<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>{title}</title>
  <meta name="description" content="{description}" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="{url}" />
  <meta property="og:title" content="☀️ {title}" />
  <meta property="og:description" content="{description}" />
  <meta property="og:image" content="{image}" />
  <meta property="og:site_name" content="Au Soleil" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="☀️ {title}" />
  <meta name="twitter:description" content="{description}" />
  <meta name="twitter:image" content="{image}" />
  <meta http-equiv="refresh" content="0;url={url}" />
</head>
<body>
  <p>Redirection vers <a href="{url}">{title}</a>…</p>
</body>
</html>"""
    return HTMLResponse(content=html)
