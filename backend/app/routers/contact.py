"""Contact form endpoint."""
from email.message import EmailMessage
from email.utils import make_msgid

import aiosmtplib
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.config import settings
from app.dependencies import get_redis
from app.i18n import get_lang, tr

router = APIRouter(prefix="/api", tags=["contact"])

_RATE_LIMIT = 5
_RATE_WINDOW = 3600


class ContactRequest(BaseModel):
    name: str
    email: str
    message: str


async def _check_rate(ip: str, redis) -> None:
    """Check rate limit using Redis. Allows _RATE_LIMIT requests per IP per hour."""
    if redis is None:
        return  # Skip rate limiting if Redis unavailable
    key = f"contact:rate:{ip}"
    count = await redis.incr(key)
    if count == 1:
        await redis.expire(key, _RATE_WINDOW)
    if count > _RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")


@router.post("/contact")
async def contact(body: ContactRequest, request: Request, redis=Depends(get_redis)) -> dict:
    lang = get_lang(request)
    if not body.name.strip() or not body.message.strip():
        raise HTTPException(status_code=422, detail=tr("name_message_required", lang))

    ip = request.client.host if request.client else "unknown"
    await _check_rate(ip, redis)

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
