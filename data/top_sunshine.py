#!/usr/bin/env python3
"""Compute top terrasses by sunshine duration (minutes) for a given date.

Usage:
    python -m data.top_sunshine [--date 2026-03-21] [--limit 20]
"""
import argparse
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import create_engine, text

from app.config import settings
from app.services.shadow import is_sunny
from app.services.sun import get_sun_position, get_sunrise_sunset

PARIS_TZ = ZoneInfo("Europe/Paris")
STEP_MINUTES = 5  # 5-min resolution for accuracy


def compute_sunny_minutes(profile: list[float], lat: float, lon: float, target_date: date) -> int:
    day_dt = datetime(target_date.year, target_date.month, target_date.day, tzinfo=PARIS_TZ)
    sunrise, sunset = get_sunrise_sunset(lat, lon, day_dt)

    start = datetime(target_date.year, target_date.month, target_date.day,
                     sunrise.hour, 0, tzinfo=PARIS_TZ)
    end = datetime(target_date.year, target_date.month, target_date.day,
                   min(sunset.hour + 1, 22), 0, tzinfo=PARIS_TZ)

    sunny_minutes = 0
    current = start
    while current <= end:
        alt, azi = get_sun_position(lat, lon, current)
        if is_sunny(profile, alt, azi):
            sunny_minutes += STEP_MINUTES
        current += timedelta(minutes=STEP_MINUTES)

    return sunny_minutes


def main(target_date: date, limit: int) -> None:
    engine = create_engine(settings.DATABASE_URL_SYNC)

    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT t.id, COALESCE(t.nom_commercial, t.nom) AS nom, t.adresse,
                   ST_X(t.geometry) AS lon, ST_Y(t.geometry) AS lat,
                   hp.profile
            FROM terrasses t
            JOIN horizon_profiles hp ON hp.terrasse_id = t.id
            WHERE t.etat_administratif IS DISTINCT FROM 'F'
        """)).fetchall()

    print(f"Computing sunshine for {len(rows)} terrasses on {target_date}...")
    print(f"(resolution: {STEP_MINUTES} min)\n")

    results = []
    for i, row in enumerate(rows, 1):
        minutes = compute_sunny_minutes(row.profile, row.lat, row.lon, target_date)
        results.append((row.id, row.nom, row.adresse, minutes))
        if i % 500 == 0:
            print(f"  {i}/{len(rows)} processed...")

    results.sort(key=lambda r: r[3], reverse=True)

    print(f"\n{'#':>3}  {'Min':>5}  {'Heures':>6}  {'Nom':<35}  Adresse")
    print("-" * 100)
    for rank, (tid, nom, adresse, minutes) in enumerate(results[:limit], 1):
        hours = f"{minutes // 60}h{minutes % 60:02d}"
        print(f"{rank:>3}  {minutes:>5}  {hours:>6}  {nom[:35]:<35}  {(adresse or '')[:40]}")

    engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Top terrasses by sunshine duration")
    parser.add_argument("--date", type=str, default=None, help="Date YYYY-MM-DD (default: today)")
    parser.add_argument("--limit", type=int, default=20, help="Number of results")
    args = parser.parse_args()

    target = date.fromisoformat(args.date) if args.date else date.today()
    main(target, args.limit)
