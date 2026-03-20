"""Contact form endpoint."""
import time
from email.message import EmailMessage
from email.utils import make_msgid

import aiosmtplib
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.config import settings
from app.i18n import get_lang, tr

router = APIRouter(prefix="/api", tags=["contact"])

# Simple in-memory rate limit: max 5 submissions per IP per hour
_rate: dict[str, list[float]] = {}
_RATE_LIMIT = 5
_RATE_WINDOW = 3600


class ContactRequest(BaseModel):
    name: str
    email: str
    message: str


def _check_rate(ip: str) -> None:
    now = time.time()
    timestamps = [t for t in _rate.get(ip, []) if now - t < _RATE_WINDOW]
    if len(timestamps) >= _RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
    timestamps.append(now)
    _rate[ip] = timestamps


@router.post("/contact")
async def contact(body: ContactRequest, request: Request) -> dict:
    lang = get_lang(request)
    if not body.name.strip() or not body.message.strip():
        raise HTTPException(status_code=422, detail=tr("name_message_required", lang))

    msg = EmailMessage()
    msg["Message-ID"] = make_msgid(domain="ecosysteme.matge.com")
    msg["Subject"] = f"[Au Soleil] Message de {body.name}"
    msg["From"] = settings.SMTP_FROM
    msg["To"] = settings.CONTACT_TO
    msg["Reply-To"] = body.email
    msg.set_content(
        f"Nom : {body.name}\n"
        f"Email : {body.email}\n\n"
        f"{body.message}\n"
    )

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            start_tls=False,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=tr("send_error", lang, error=str(e)))

    return {"ok": True}
