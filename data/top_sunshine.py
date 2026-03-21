#!/usr/bin/env python3
"""Compute top terrasses by sunshine duration (minutes) for a given date.

Optimized: sun positions are precomputed once (same for all of Paris),
then each terrasse's horizon profile is checked with simple comparisons.

Usage:
    python -m data.top_sunshine [--date 2026-03-21] [--limit 20]
"""
import argparse
import time as timer
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, text

from app.config import settings
from app.services.sun import get_sun_position, get_sunrise_sunset

PARIS_TZ = ZoneInfo("Europe/Paris")
PARIS_LAT, PARIS_LON = 48.8566, 2.3522
STEP_MINUTES = 5


def precompute_sun_positions(target_date: date) -> list[tuple[float, int]]:
    """Precompute sun (altitude, azimuth_index) for each time step.

    Returns only steps where sun is above horizon.
    """
    day_dt = datetime(target_date.year, target_date.month, target_date.day, tzinfo=PARIS_TZ)
    sunrise, sunset = get_sunrise_sunset(PARIS_LAT, PARIS_LON, day_dt)

    start = datetime(target_date.year, target_date.month, target_date.day,
                     sunrise.hour, 0, tzinfo=PARIS_TZ)
    end = datetime(target_date.year, target_date.month, target_date.day,
                   min(sunset.hour + 1, 22), 0, tzinfo=PARIS_TZ)

    positions = []
    current = start
    while current <= end:
        alt, azi = get_sun_position(PARIS_LAT, PARIS_LON, current)
        if alt > 0:
            positions.append((alt, int(round(azi)) % 360))
        current += timedelta(minutes=STEP_MINUTES)

    return positions


def count_sunny_minutes(profile: list[float], sun_positions: list[tuple[float, int]]) -> int:
    """Count sunny minutes by comparing sun altitude vs horizon profile."""
    count = 0
    for alt, az_idx in sun_positions:
        if alt > profile[az_idx]:
            count += 1
    return count * STEP_MINUTES


def main(target_date: date, limit: int) -> None:
    engine = create_engine(settings.DATABASE_URL_SYNC)
    t0 = timer.time()

    # Precompute sun positions once for all terrasses
    print(f"Precomputing sun positions for {target_date}...")
    sun_positions = precompute_sun_positions(target_date)
    print(f"  {len(sun_positions)} time steps with sun above horizon")

    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT t.id, COALESCE(t.nom_commercial, t.nom) AS nom, t.adresse,
                   hp.profile
            FROM terrasses t
            JOIN horizon_profiles hp ON hp.terrasse_id = t.id
            WHERE t.etat_administratif IS DISTINCT FROM 'F'
        """)).fetchall()

    print(f"Computing sunshine for {len(rows)} terrasses...\n")

    results = []
    for row in rows:
        minutes = count_sunny_minutes(row.profile, sun_positions)
        results.append((row.id, row.nom, row.adresse, minutes))

    results.sort(key=lambda r: r[3], reverse=True)

    elapsed = timer.time() - t0
    print(f"{'#':>3}  {'Min':>5}  {'Heures':>6}  {'Nom':<35}  Adresse")
    print("-" * 100)
    for rank, (tid, nom, adresse, minutes) in enumerate(results[:limit], 1):
        hours = f"{minutes // 60}h{minutes % 60:02d}"
        print(f"{rank:>3}  {minutes:>5}  {hours:>6}  {nom[:35]:<35}  {(adresse or '')[:40]}")

    print(f"\nDone in {elapsed:.1f}s")
    engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Top terrasses by sunshine duration")
    parser.add_argument("--date", type=str, default=None, help="Date YYYY-MM-DD (default: today)")
    parser.add_argument("--limit", type=int, default=20, help="Number of results")
    args = parser.parse_args()

    target = date.fromisoformat(args.date) if args.date else date.today()
    main(target, args.limit)
