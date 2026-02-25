"""Batch compute horizon profiles for all terrasses.

Uses multiprocessing to parallelize the CPU-bound computation.
Each worker fetches buildings near a terrace and computes its 360° horizon profile.

Usage:
    python data/compute_horizon_profiles.py [--workers N]
"""
import argparse
import os
import sys
import time
from multiprocessing import Pool

from sqlalchemy import create_engine, text

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app.services.shadow import compute_horizon_profile_sync, BUILDING_SEARCH_RADIUS_M  # noqa: E402

DATABASE_URL = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://terrasse:devpassword@localhost:5432/terrasse_soleil",
)


def fetch_terrasses(engine) -> list[dict]:
    """Fetch all terrasses that need horizon profile computation."""
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT t.id, ST_X(t.geometry) AS lon, ST_Y(t.geometry) AS lat
            FROM terrasses t
            LEFT JOIN horizon_profiles hp ON hp.terrasse_id = t.id
            WHERE hp.terrasse_id IS NULL
            ORDER BY t.id
        """)).fetchall()
    return [{"id": r[0], "lon": r[1], "lat": r[2]} for r in rows]


def fetch_buildings_for_terrace(engine, lat: float, lon: float) -> list[dict]:
    """Fetch buildings within radius of a terrace."""
    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    ST_AsText(geometry) AS geom_wkt,
                    hauteur,
                    COALESCE(altitude_sol, 0) AS altitude_sol
                FROM batiments
                WHERE ST_DWithin(
                    geometry::geography,
                    ST_SetSRID(ST_MakePoint(:lon, :lat), 4326)::geography,
                    :radius
                )
            """),
            {"lat": lat, "lon": lon, "radius": BUILDING_SEARCH_RADIUS_M},
        ).fetchall()
    return [{"geom_wkt": r[0], "hauteur": r[1], "altitude_sol": r[2]} for r in rows]


def process_terrace(terrace: dict) -> dict | None:
    """Compute horizon profile for a single terrace (worker function)."""
    engine = create_engine(DATABASE_URL)
    try:
        buildings = fetch_buildings_for_terrace(engine, terrace["lat"], terrace["lon"])
        profile = compute_horizon_profile_sync(buildings, terrace["lat"], terrace["lon"])
        return {"terrasse_id": terrace["id"], "profile": profile}
    except Exception as e:
        print(f"  ERROR terrace {terrace['id']}: {e}")
        return None
    finally:
        engine.dispose()


def save_profiles(engine, profiles: list[dict]) -> None:
    """Bulk insert computed profiles."""
    with engine.begin() as conn:
        for p in profiles:
            conn.execute(
                text("""
                    INSERT INTO horizon_profiles (terrasse_id, profile, computed_at)
                    VALUES (:terrasse_id, :profile, NOW())
                    ON CONFLICT (terrasse_id) DO UPDATE
                    SET profile = EXCLUDED.profile, computed_at = NOW()
                """),
                {"terrasse_id": p["terrasse_id"], "profile": p["profile"]},
            )


def main():
    parser = argparse.ArgumentParser(description="Compute horizon profiles")
    parser.add_argument("--workers", type=int, default=None, help="Number of workers (default: CPU count - 1)")
    parser.add_argument("--batch-size", type=int, default=100, help="Save every N profiles")
    args = parser.parse_args()

    workers = args.workers or max(1, (os.cpu_count() or 2) - 1)

    engine = create_engine(DATABASE_URL)

    # Fetch terrasses needing computation
    terrasses = fetch_terrasses(engine)
    if not terrasses:
        print("All terrasses already have horizon profiles. Nothing to do.")
        return

    total = len(terrasses)
    print(f"Computing horizon profiles for {total} terrasses with {workers} workers...")

    t0 = time.time()
    completed = 0
    batch = []

    with Pool(processes=workers) as pool:
        for result in pool.imap_unordered(process_terrace, terrasses, chunksize=10):
            if result is not None:
                batch.append(result)
                completed += 1

                if len(batch) >= args.batch_size:
                    save_profiles(engine, batch)
                    batch.clear()

                if completed % 100 == 0:
                    elapsed = time.time() - t0
                    rate = completed / elapsed
                    eta = (total - completed) / rate if rate > 0 else 0
                    print(f"  {completed}/{total} ({completed/total*100:.0f}%) — {rate:.1f}/s — ETA {eta:.0f}s")

    # Save remaining
    if batch:
        save_profiles(engine, batch)

    elapsed = time.time() - t0
    print(f"Done: {completed}/{total} profiles computed in {elapsed:.1f}s ({completed/elapsed:.1f}/s)")

    engine.dispose()


if __name__ == "__main__":
    main()
