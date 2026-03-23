"""Repository for terrasse data access."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def search_terrasses(db: AsyncSession, query: str, limit: int = 10) -> list:
    """Search terrasses by name or address, deduplicated by SIRET.

    Returns one row per establishment (grouped by SIRET).
    Terrasses without SIRET are treated as individual entries.
    """
    result = await db.execute(
        text("""
            WITH scored AS (
                SELECT
                    id, nom, nom_commercial, adresse, arrondissement,
                    ST_X(geometry) AS lon, ST_Y(geometry) AS lat,
                    price_level, place_type, rating, user_rating_count,
                    phone, website, google_maps_uri,
                    siret,
                    GREATEST(
                        COALESCE(similarity(nom_commercial, :q), 0),
                        similarity(nom, :q),
                        similarity(adresse, :q)
                    ) AS sim,
                    ROW_NUMBER() OVER (
                        PARTITION BY COALESCE(NULLIF(siret, ''), id::text)
                        ORDER BY
                            GREATEST(
                                COALESCE(similarity(nom_commercial, :q), 0),
                                similarity(nom, :q),
                                similarity(adresse, :q)
                            ) DESC,
                            nom_commercial IS NOT NULL DESC,
                            id
                    ) AS rn
                FROM terrasses
                WHERE nom % :q OR adresse % :q OR nom_commercial % :q
            )
            SELECT id, nom, nom_commercial, adresse, arrondissement,
                   lon, lat, price_level, place_type, rating,
                   user_rating_count, phone, website, google_maps_uri, sim
            FROM scored
            WHERE rn = 1
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
                WITH matched AS (
                    SELECT
                        id, nom, nom_commercial, adresse, arrondissement,
                        ST_X(geometry) AS lon, ST_Y(geometry) AS lat,
                        price_level, place_type, rating, user_rating_count,
                        phone, website, google_maps_uri,
                        siret,
                        ROW_NUMBER() OVER (
                            PARTITION BY COALESCE(NULLIF(siret, ''), id::text)
                            ORDER BY nom_commercial IS NOT NULL DESC, id
                        ) AS rn
                    FROM terrasses
                    WHERE nom ILIKE :pattern OR adresse ILIKE :pattern OR nom_commercial ILIKE :pattern
                )
                SELECT id, nom, nom_commercial, adresse, arrondissement,
                       lon, lat, price_level, place_type, rating,
                       user_rating_count, phone, website, google_maps_uri
                FROM matched
                WHERE rn = 1
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
                t.siret, t.longueur, t.largeur, t.typologie,
                hp.profile
            FROM terrasses t
            LEFT JOIN horizon_profiles hp ON hp.terrasse_id = t.id
            WHERE t.id = :id
        """),
        {"id": terrasse_id},
    )
    return result.fetchone()


async def find_siblings(db: AsyncSession, siret: str) -> list:
    """Find all terrasses sharing a SIRET, with their profiles and dimensions."""
    result = await db.execute(
        text("""
            SELECT
                t.id, t.nom, t.nom_commercial, t.adresse, t.typologie,
                t.longueur, t.largeur,
                ST_X(t.geometry) AS lon, ST_Y(t.geometry) AS lat,
                hp.profile
            FROM terrasses t
            LEFT JOIN horizon_profiles hp ON hp.terrasse_id = t.id
            WHERE t.siret = :siret AND t.siret != ''
            ORDER BY t.id
        """),
        {"siret": siret},
    )
    return result.fetchall()


async def find_nearby(
    db: AsyncSession, lat: float, lon: float, radius_m: int = 500, limit: int = 50
) -> list:
    """Find terrasses within a radius, deduplicated by SIRET.

    Returns one representative row per establishment with:
    - terrasse_ids: array of all terrasse IDs in the group
    - profiles: array of horizon profiles for sun union
    - coords: array of (lat, lon) for each terrasse
    - surface_m2: aggregated surface
    - terrasse_count: number of terrasses
    """
    result = await db.execute(
        text("""
            WITH nearby AS (
                SELECT
                    t.id,
                    t.nom,
                    t.nom_commercial,
                    t.adresse,
                    t.siret,
                    t.longueur,
                    t.largeur,
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
                    hp.profile,
                    COALESCE(NULLIF(t.siret, ''), t.id::text) AS group_key
                FROM terrasses t
                LEFT JOIN horizon_profiles hp ON hp.terrasse_id = t.id
                WHERE ST_DWithin(
                    t.geometry::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                    :radius
                )
            ),
            ranked AS (
                SELECT *,
                    ROW_NUMBER() OVER (
                        PARTITION BY group_key
                        ORDER BY nom_commercial IS NOT NULL DESC, distance_m, id
                    ) AS rn
                FROM nearby
            )
            SELECT
                r.id, r.nom, r.nom_commercial, r.adresse, r.lon, r.lat,
                r.distance_m, r.price_level, r.place_type, r.rating,
                r.user_rating_count, r.profile,
                r.group_key,
                agg.terrasse_count,
                agg.surface_m2,
                agg.all_ids,
                agg.all_profiles,
                agg.all_lats,
                agg.all_lons
            FROM ranked r
            JOIN (
                SELECT
                    group_key,
                    COUNT(*) AS terrasse_count,
                    ROUND(SUM(COALESCE(longueur, 0) * COALESCE(largeur, 0))::numeric, 1) AS surface_m2,
                    array_agg(id ORDER BY id) AS all_ids,
                    array_agg(profile ORDER BY id) AS all_profiles,
                    array_agg(lat ORDER BY id) AS all_lats,
                    array_agg(lon ORDER BY id) AS all_lons
                FROM nearby
                GROUP BY group_key
            ) agg ON agg.group_key = r.group_key
            WHERE r.rn = 1
            ORDER BY r.distance_m
            LIMIT :limit
        """),
        {"lat": lat, "lon": lon, "radius": radius_m, "limit": limit},
    )
    return result.fetchall()
