from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.dependencies import close_redis, init_redis
from app.routers import contact, geocode, og, poster, seo, streetview, terrasses
from mcp_server import mcp as mcp_server


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_redis()
    yield
    await close_redis()


app = FastAPI(title="Terrasse au Soleil", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.FRONTEND_URL.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(terrasses.router)
app.include_router(geocode.router)
app.include_router(contact.router)
app.include_router(og.router)
app.include_router(streetview.router)
app.include_router(seo.router)
app.include_router(poster.router)

# Mount MCP server at /mcp (Streamable HTTP transport)
app.mount("/mcp", mcp_server.streamable_http_app())


@app.get("/api/health")
async def health():
    return {"status": "ok"}
