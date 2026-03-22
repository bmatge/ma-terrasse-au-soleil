"""Compute sun exposure stats for all terrasses on given dates.

For each terrasse with a horizon profile, computes whether the terrace
is sunny at each hour slot (7h–21h) on the specified dates. Results are
stored in a `sun_stats` table for SQL analysis.

Also computes shade-friendly stats: terraces that stay shaded during the
hottest hours (12h–16h) — useful for canicule/summer blog posts.

Usage:
    python data/compute_sun_stats.py 2026-04-05 2026-04-06
    python data/compute_sun_stats.py --clear 2026-04-05  # recompute a date
    python data/compute_sun_stats.py --export-csv 2026-04-05  # also dump CSV

Runs inside Docker:
    docker compose exec backend python /app/data/compute_sun_stats.py 2026-04-05 2026-04-06
"""
import argparse
import csv
import os
import sys
import time
from datetime import date, datetime
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, text

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from app.services.shadow import is_sunny  # noqa: E402
from app.services.sun import get_sun_position  # noqa: E402

PARIS_TZ = ZoneInfo("Europe/Paris")

DATABASE_URL = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://terrasse:devpassword@localhost:5432/terrasse_soleil",
)

# Hour slots to compute (7h to 21h inclusive)
HOUR_START = 7
HOUR_END = 21

# Canicule / shade analysis: hottest hours
SHADE_HOURS = range(12, 17)  # 12h–16h inclusive


def ensure_table(engine) -> None:
    """Create sun_stats table if it doesn't exist."""
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS sun_stats (
                terrasse_id  INT REFERENCES terrasses(id) ON DELETE CASCADE,
                date         DATE NOT NULL,
                heure        INT NOT NULL,
                sun_altitude FLOAT NOT NULL,
                sun_azimuth  FLOAT NOT NULL,
                soleil       BOOLEAN NOT NULL,
                PRIMARY KEY (terrasse_id, date, heure)
            )
        """))
        # Index for per-date queries
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_sun_stats_date
            ON sun_stats (date)
        """))
        # Index for shade analysis (hot hours)
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_sun_stats_date_heure
            ON sun_stats (date, heure)
        """))


def clear_dates(engine, dates: list[date]) -> None:
    """Remove existing data for specified dates."""
    with engine.begin() as conn:
        for d in dates:
            deleted = conn.execute(
                text("DELETE FROM sun_stats WHERE date = :d"),
                {"d": d},
            ).rowcount
            if deleted:
                print(f"  Cleared {deleted} rows for {d}")


def fetch_terrasses_with_profiles(engine) -> list[dict]:
    """Fetch all terrasses that have a horizon profile."""
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT
                t.id,
                ST_X(t.geometry) AS lon,
                ST_Y(t.geometry) AS lat,
                hp.profile
            FROM terrasses t
            JOIN horizon_profiles hp ON hp.terrasse_id = t.id
            ORDER BY t.id
        """)).fetchall()
    return [
        {"id": r[0], "lon": r[1], "lat": r[2], "profile": r[3]}
        for r in rows
    ]


def compute_for_terrace(terrace: dict, dates: list[date]) -> list[dict]:
    """Compute sun stats for one terrace across all dates and hours."""
    profile = terrace["profile"]
    lat, lon = terrace["lat"], terrace["lon"]
    rows = []

    for d in dates:
        for hour in range(HOUR_START, HOUR_END + 1):
            dt = datetime(d.year, d.month, d.day, hour, 0, tzinfo=PARIS_TZ)
            sun_alt, sun_azi = get_sun_position(lat, lon, dt)
            sunny = is_sunny(profile, sun_alt, sun_azi)

            rows.append({
                "terrasse_id": terrace["id"],
                "date": d,
                "heure": hour,
                "sun_altitude": sun_alt,
                "sun_azimuth": sun_azi,
                "soleil": sunny,
            })

    return rows


def save_batch(engine, rows: list[dict]) -> None:
    """Bulk insert rows into sun_stats."""
    if not rows:
        return
    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO sun_stats (terrasse_id, date, heure, sun_altitude, sun_azimuth, soleil)
                VALUES (:terrasse_id, :date, :heure, :sun_altitude, :sun_azimuth, :soleil)
                ON CONFLICT (terrasse_id, date, heure) DO UPDATE
                SET sun_altitude = EXCLUDED.sun_altitude,
                    sun_azimuth = EXCLUDED.sun_azimuth,
                    soleil = EXCLUDED.soleil
            """),
            rows,
        )


def export_csv(engine, dates: list[date], output_dir: str = "data/exports") -> None:
    """Export sun_stats for given dates as CSV."""
    os.makedirs(output_dir, exist_ok=True)
    for d in dates:
        filename = os.path.join(output_dir, f"sun_stats_{d.isoformat()}.csv")
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT
                        ss.terrasse_id,
                        COALESCE(t.nom_commercial, t.nom) AS nom,
                        t.arrondissement,
                        t.adresse,
                        ss.date,
                        ss.heure,
                        ss.sun_altitude,
                        ss.sun_azimuth,
                        ss.soleil
                    FROM sun_stats ss
                    JOIN terrasses t ON t.id = ss.terrasse_id
                    WHERE ss.date = :d
                    ORDER BY ss.terrasse_id, ss.heure
                """),
                {"d": d},
            ).fetchall()

        with open(filename, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "terrasse_id", "nom", "arrondissement", "adresse",
                "date", "heure", "sun_altitude", "sun_azimuth", "soleil",
            ])
            for r in rows:
                writer.writerow(r)

        print(f"  Exported {len(rows)} rows → {filename}")


def print_summary(engine, dates: list[date]) -> None:
    """Print a quick summary of computed stats."""
    with engine.connect() as conn:
        for d in dates:
            row = conn.execute(
                text("""
                    SELECT
                        COUNT(DISTINCT terrasse_id) AS nb_terrasses,
                        COUNT(*) AS total_slots,
                        COUNT(*) FILTER (WHERE soleil = TRUE) AS slots_soleil,
                        ROUND(
                            COUNT(*) FILTER (WHERE soleil = TRUE) * 100.0
                            / NULLIF(COUNT(*), 0), 1
                        ) AS pct_soleil
                    FROM sun_stats
                    WHERE date = :d
                """),
                {"d": d},
            ).fetchone()
            print(f"\n  📅 {d}:")
            print(f"     {row[0]} terrasses, {row[1]} slots")
            print(f"     ☀️  {row[2]} au soleil ({row[3]}%)")

            # Shade stats for hot hours
            shade = conn.execute(
                text("""
                    SELECT
                        COUNT(DISTINCT terrasse_id) AS nb_terrasses_full_shade
                    FROM (
                        SELECT terrasse_id
                        FROM sun_stats
                        WHERE date = :d AND heure BETWEEN 12 AND 16
                        GROUP BY terrasse_id
                        HAVING COUNT(*) FILTER (WHERE soleil = TRUE) = 0
                    ) sub
                """),
                {"d": d},
            ).fetchone()
            print(f"     🌿 {shade[0]} terrasses 100% ombre 12h–16h (refuges canicule)")


def main():
    parser = argparse.ArgumentParser(
        description="Compute sun exposure stats for terrasses on specific dates",
    )
    parser.add_argument(
        "dates",
        nargs="+",
        help="Dates to compute (YYYY-MM-DD format)",
    )
    parser.add_argument(
        "--clear",
        action="store_true",
        help="Clear existing data for these dates before computing",
    )
    parser.add_argument(
        "--export-csv",
        action="store_true",
        help="Export results as CSV after computing",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=500,
        help="Save every N terrasses (default: 500)",
    )
    args = parser.parse_args()

    # Parse dates
    dates = []
    for d_str in args.dates:
        try:
            dates.append(date.fromisoformat(d_str))
        except ValueError:
            print(f"ERROR: Invalid date format '{d_str}', expected YYYY-MM-DD")
            sys.exit(1)

    print(f"Sun stats computation for: {', '.join(d.isoformat() for d in dates)}")
    print(f"  Hours: {HOUR_START}h–{HOUR_END}h ({HOUR_END - HOUR_START + 1} slots/day)")

    engine = create_engine(DATABASE_URL)

    # Ensure table exists
    ensure_table(engine)

    # Clear if requested
    if args.clear:
        clear_dates(engine, dates)

    # Check which dates already have data
    with engine.connect() as conn:
        for d in dates[:]:
            existing = conn.execute(
                text("SELECT COUNT(*) FROM sun_stats WHERE date = :d"),
                {"d": d},
            ).scalar()
            if existing and not args.clear:
                print(f"  ⚠️  {d} already has {existing} rows — skipping (use --clear to recompute)")
                dates.remove(d)

    if not dates:
        print("Nothing to compute.")
        engine.dispose()
        return

    # Fetch terrasses
    terrasses = fetch_terrasses_with_profiles(engine)
    if not terrasses:
        print("No terrasses with horizon profiles found. Run compute_horizon_profiles.py first.")
        engine.dispose()
        return

    total = len(terrasses)
    slots_per_terrace = len(dates) * (HOUR_END - HOUR_START + 1)
    print(f"  {total} terrasses × {slots_per_terrace} slots = {total * slots_per_terrace} computations")

    t0 = time.time()
    completed = 0
    batch = []

    for terrace in terrasses:
        rows = compute_for_terrace(terrace, dates)
        batch.extend(rows)
        completed += 1

        if completed % args.batch_size == 0:
            save_batch(engine, batch)
            batch.clear()
            elapsed = time.time() - t0
            rate = completed / elapsed
            eta = (total - completed) / rate if rate > 0 else 0
            print(f"  {completed}/{total} ({completed/total*100:.0f}%) — {rate:.1f} terrasses/s — ETA {eta:.0f}s")

    # Save remaining
    save_batch(engine, batch)

    elapsed = time.time() - t0
    print(f"\nDone: {completed} terrasses in {elapsed:.1f}s ({completed/elapsed:.1f}/s)")

    # Summary
    print_summary(engine, dates)

    # CSV export
    if args.export_csv:
        print("\nExporting CSV...")
        export_csv(engine, dates)

    engine.dispose()


if __name__ == "__main__":
    main()
