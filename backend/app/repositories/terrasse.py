"""Repository for terrasse data access."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def search_terrasses(db: AsyncSession, query: str, limit: int = 10) -> list:
    """Search terrasses by name or address (trigram similarity + ILIKE fallback)."""
    result = await db.execute(
        text("""
            SELECT
                id, nom, nom_commercial, adresse, arrondissement,
                ST_X(geometry) AS lon, ST_Y(geometry) AS lat,
                price_level, place_type, rating, user_rating_count,
                phone, website, google_maps_uri,
                GREATEST(
                    COALESCE(similarity(nom_commercial, :q), 0),
                    similarity(nom, :q),
                    similarity(adresse, :q)
                ) AS sim
            FROM terrasses
            WHERE nom % :q OR adresse % :q OR nom_commercial % :q
            ORDER BY sim DESC
            LIMIT :limit
        """),
        {"q": query, "limit": limit},
    )
    rows = result.fetchall()

    if not rows:
        # Fallback: ILIKE search
        result = await db.execute(
            text("""
                SELECT
                    id, nom, nom_commercial, adresse, arrondissement,
                    ST_X(geometry) AS lon, ST_Y(geometry) AS lat,
                    price_level, place_type, rating, user_rating_count,
                    phone, website, google_maps_uri
                FROM terrasses
                WHERE nom ILIKE :pattern OR adresse ILIKE :pattern OR nom_commercial ILIKE :pattern
                ORDER BY COALESCE(nom_commercial, nom)
                LIMIT :limit
            """),
            {"pattern": f"%{query}%", "limit": limit},
        )
        rows = result.fetchall()

    return rows


async def get_with_profile(db: AsyncSession, terrasse_id: int):
    """Fetch a terrasse with its horizon profile. Returns None if not found."""
    result = await db.execute(
        text("""
            SELECT
                t.id, t.nom, t.nom_commercial, t.adresse, t.arrondissement,
                ST_X(t.geometry) AS lon, ST_Y(t.geometry) AS lat,
                t.price_level, t.place_type, t.rating, t.user_rating_count,
                t.phone, t.website, t.google_maps_uri,
                hp.profile
            FROM terrasses t
            LEFT JOIN horizon_profiles hp ON hp.terrasse_id = t.id
            WHERE t.id = :id
        """),
        {"id": terrasse_id},
    )
    return result.fetchone()


async def find_nearby(
    db: AsyncSession, lat: float, lon: float, radius_m: int = 500, limit: int = 50
) -> list:
    """Find terrasses within a radius using PostGIS ST_DWithin."""
    result = await db.execute(
        text("""
            SELECT
                t.id,
                t.nom,
                t.nom_commercial,
                t.adresse,
                ST_X(t.geometry) AS lon,
                ST_Y(t.geometry) AS lat,
                ST_Distance(
                    t.geometry::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography
                )::int AS distance_m,
                t.price_level,
                t.place_type,
                t.rating,
                t.user_rating_count,
                hp.profile
            FROM terrasses t
            LEFT JOIN horizon_profiles hp ON hp.terrasse_id = t.id
            WHERE ST_DWithin(
                t.geometry::geography,
                ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                :radius
            )
            ORDER BY distance_m
            LIMIT :limit
        """),
        {"lat": lat, "lon": lon, "radius": radius_m, "limit": limit},
    )
    return result.fetchall()
