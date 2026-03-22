#!/usr/bin/env python3
"""Export blog stats as JSON for the "Paris en terrasses — les chiffres" article.

Runs all analytics queries against the database and writes JSON files
ready for Recharts consumption in the blog frontend.

Usage (inside Docker):
    docker compose exec backend python /app/data/export_blog_stats.py
    docker compose exec backend python /app/data/export_blog_stats.py --date 2026-03-20

Output:
    frontend/src/content/blog/2026-03-23-paris-en-terrasses-les-chiffres/data/*.json
"""

import argparse
import json
import os
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get(
    "DATABASE_URL_SYNC",
    "postgresql://terrasse:devpassword@localhost:5432/terrasse_soleil",
)

# Output directory
BLOG_SLUG = "2026-03-23-paris-en-terrasses-les-chiffres"
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUT_DIR = PROJECT_ROOT / "frontend" / "src" / "content" / "blog" / BLOG_SLUG / "data"


def export(engine, target_date: str) -> None:
    """Run all queries and write JSON files."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with engine.connect() as conn:
        # ── 1. KPIs globaux ──────────────────────────────────────
        row = conn.execute(text("""
            SELECT
                COUNT(*) AS total_terrasses,
                COUNT(hp.terrasse_id) AS avec_profil,
                COUNT(*) - COUNT(hp.terrasse_id) AS sans_profil
            FROM terrasses t
            LEFT JOIN horizon_profiles hp ON hp.terrasse_id = t.id
        """)).mappings().one()

        row_bat = conn.execute(text(
            "SELECT COUNT(*) AS total FROM batiments"
        )).mappings().one()

        row_surface = conn.execute(text("""
            SELECT
                ROUND(SUM(longueur * largeur)::NUMERIC, 0) AS surface_totale_m2,
                ROUND(AVG(longueur * largeur)::NUMERIC, 1) AS surface_moyenne_m2,
                ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
                    (ORDER BY longueur * largeur)::NUMERIC, 1) AS surface_mediane_m2,
                ROUND(MIN(longueur * largeur)::NUMERIC, 1) AS surface_min_m2,
                ROUND(MAX(longueur * largeur)::NUMERIC, 1) AS surface_max_m2
            FROM terrasses
            WHERE longueur > 0 AND largeur > 0
        """)).mappings().one()

        # Check if sun_stats exist for the target date
        sun_stats_count = conn.execute(text(
            "SELECT COUNT(*) AS n FROM sun_stats WHERE date = :d"
        ), {"d": target_date}).mappings().one()["n"]

        kpis = {
            "total_terrasses": row["total_terrasses"],
            "avec_profil_horizon": row["avec_profil"],
            "sans_profil": row["sans_profil"],
            "total_batiments": row_bat["total"],
            "surface_totale_m2": float(row_surface["surface_totale_m2"] or 0),
            "surface_moyenne_m2": float(row_surface["surface_moyenne_m2"] or 0),
            "surface_mediane_m2": float(row_surface["surface_mediane_m2"] or 0),
            "surface_min_m2": float(row_surface["surface_min_m2"] or 0),
            "surface_max_m2": float(row_surface["surface_max_m2"] or 0),
            "date_reference": target_date,
            "sun_stats_disponibles": sun_stats_count > 0,
        }
        _write("kpis.json", kpis)

        # ── 2. Catégories (donut) ────────────────────────────────
        rows = conn.execute(text("""
            SELECT
                COALESCE(categorie, 'AUTRE') AS categorie,
                COUNT(*) AS nb,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct
            FROM terrasses
            GROUP BY categorie
            ORDER BY nb DESC
        """)).mappings().all()
        _write("categories.json", [dict(r) for r in rows])

        # ── 3. Terrasses par arrondissement (bar) ────────────────
        rows = conn.execute(text("""
            SELECT
                arrondissement,
                COUNT(*) AS nb_terrasses
            FROM terrasses
            WHERE arrondissement IS NOT NULL
            GROUP BY arrondissement
            ORDER BY nb_terrasses DESC
        """)).mappings().all()
        _write("par_arrondissement.json", [dict(r) for r in rows])

        # ── 4. Top 10 rues (concentration) ──────────────────────
        rows = conn.execute(text("""
            SELECT
                REGEXP_REPLACE(adresse, '^\\d+[A-Za-z]?\\s*', '') AS rue,
                COUNT(*) AS nb_terrasses
            FROM terrasses
            WHERE adresse IS NOT NULL
            GROUP BY 1
            HAVING COUNT(*) >= 3
            ORDER BY nb_terrasses DESC
            LIMIT 15
        """)).mappings().all()
        _write("top_rues_concentration.json", [dict(r) for r in rows])

        # ── 5. Distribution des superficies (histogram) ─────────
        rows = conn.execute(text("""
            SELECT
                CASE
                    WHEN longueur * largeur < 5    THEN '< 5 m²'
                    WHEN longueur * largeur < 10   THEN '5–10 m²'
                    WHEN longueur * largeur < 25   THEN '10–25 m²'
                    WHEN longueur * largeur < 50   THEN '25–50 m²'
                    WHEN longueur * largeur < 100  THEN '50–100 m²'
                    ELSE '> 100 m²'
                END AS tranche,
                COUNT(*) AS nb_terrasses,
                ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct
            FROM terrasses
            WHERE longueur > 0 AND largeur > 0
            GROUP BY 1
            ORDER BY MIN(longueur * largeur)
        """)).mappings().all()
        _write("distribution_superficies.json", [dict(r) for r in rows])

        # ── 6. Top 5 plus grandes + top 5 plus petites ──────────
        grandes = conn.execute(text("""
            SELECT
                COALESCE(nom_commercial, nom) AS nom,
                arrondissement,
                ROUND((longueur * largeur)::NUMERIC, 1) AS superficie_m2
            FROM terrasses
            WHERE longueur > 0 AND largeur > 0
            ORDER BY longueur * largeur DESC NULLS LAST
            LIMIT 5
        """)).mappings().all()
        petites = conn.execute(text("""
            SELECT
                COALESCE(nom_commercial, nom) AS nom,
                arrondissement,
                ROUND((longueur * largeur)::NUMERIC, 1) AS superficie_m2
            FROM terrasses
            WHERE longueur > 0 AND largeur > 0
            ORDER BY longueur * largeur ASC
            LIMIT 5
        """)).mappings().all()
        _write("extremes_superficie.json", {
            "plus_grandes": [dict(r) for r in grandes],
            "plus_petites": [dict(r) for r in petites],
        })

        # ── 7. Sources d'enrichissement (donut) ─────────────────
        rows = conn.execute(text("""
            SELECT
                CASE
                    WHEN google_place_id IS NOT NULL THEN 'google'
                    ELSE 'non'
                END AS google,
                CASE
                    WHEN osm_id IS NOT NULL THEN 'osm'
                    ELSE 'non'
                END AS osm,
                CASE
                    WHEN enseigne_sirene IS NOT NULL THEN 'sirene'
                    ELSE 'non'
                END AS sirene
            FROM terrasses
        """)).mappings().all()
        total = len(rows)
        google_count = sum(1 for r in rows if r["google"] == "google")
        osm_count = sum(1 for r in rows if r["osm"] == "osm")
        sirene_count = sum(1 for r in rows if r["sirene"] == "sirene")
        _write("enrichissement.json", {
            "total": total,
            "google_places": google_count,
            "osm": osm_count,
            "sirene": sirene_count,
        })

        # ── Sun stats queries (only if data exists) ─────────────
        if not sun_stats_count:
            print(f"⚠️  Pas de sun_stats pour {target_date}.")
            print(f"   Lance d'abord: python data/compute_sun_stats.py {target_date}")
            print("   Les fichiers soleil ne seront pas générés.")
            return

        # ── 8. Courbe ensoleillement par heure (area chart) ─────
        rows = conn.execute(text("""
            SELECT
                heure,
                COUNT(*) FILTER (WHERE soleil = TRUE) AS au_soleil,
                COUNT(*) FILTER (WHERE soleil = FALSE) AS a_l_ombre,
                ROUND(
                    COUNT(*) FILTER (WHERE soleil = TRUE) * 100.0
                    / NULLIF(COUNT(*), 0), 1
                ) AS pct_soleil
            FROM sun_stats
            WHERE date = :d
            GROUP BY heure
            ORDER BY heure
        """), {"d": target_date}).mappings().all()
        _write("ensoleillement_par_heure.json", [dict(r) for r in rows])

        # ── 9. Soleil par arrondissement (stacked bar) ──────────
        rows = conn.execute(text("""
            SELECT
                t.arrondissement,
                ROUND(AVG(sub.pct_soleil)::NUMERIC, 1) AS pct_moyen_soleil,
                COUNT(*) AS nb_terrasses
            FROM (
                SELECT
                    terrasse_id,
                    COUNT(*) FILTER (WHERE soleil = TRUE) * 100.0
                    / NULLIF(COUNT(*), 0) AS pct_soleil
                FROM sun_stats
                WHERE date = :d
                GROUP BY terrasse_id
            ) sub
            JOIN terrasses t ON t.id = sub.terrasse_id
            WHERE t.arrondissement IS NOT NULL
            GROUP BY t.arrondissement
            HAVING COUNT(*) >= 10
            ORDER BY pct_moyen_soleil DESC
        """), {"d": target_date}).mappings().all()
        _write("soleil_par_arrondissement.json", [dict(r) for r in rows])

        # ── 10. Top 10 terrasses les plus ensoleillées ──────────
        rows = conn.execute(text("""
            SELECT
                COALESCE(t.nom_commercial, t.nom) AS nom,
                t.arrondissement,
                COUNT(*) FILTER (WHERE ss.soleil = TRUE) AS heures_soleil,
                ROUND(
                    COUNT(*) FILTER (WHERE ss.soleil = TRUE) * 100.0
                    / NULLIF(COUNT(*), 0), 1
                ) AS pct_soleil
            FROM sun_stats ss
            JOIN terrasses t ON t.id = ss.terrasse_id
            WHERE ss.date = :d
            GROUP BY t.id, t.nom_commercial, t.nom, t.arrondissement
            ORDER BY heures_soleil DESC
            LIMIT 10
        """), {"d": target_date}).mappings().all()
        _write("top10_ensoleillees.json", [dict(r) for r in rows])

        # ── 11. Top 10 refuges ombre ────────────────────────────
        rows = conn.execute(text("""
            SELECT
                COALESCE(t.nom_commercial, t.nom) AS nom,
                t.arrondissement,
                COUNT(*) FILTER (WHERE ss.soleil = TRUE) AS heures_soleil,
                COUNT(*) FILTER (WHERE ss.soleil = FALSE) AS heures_ombre,
                ROUND(
                    COUNT(*) FILTER (WHERE ss.soleil = FALSE) * 100.0
                    / NULLIF(COUNT(*), 0), 1
                ) AS pct_ombre
            FROM sun_stats ss
            JOIN terrasses t ON t.id = ss.terrasse_id
            WHERE ss.date = :d
            GROUP BY t.id, t.nom_commercial, t.nom, t.arrondissement
            ORDER BY heures_soleil ASC
            LIMIT 10
        """), {"d": target_date}).mappings().all()
        _write("top10_ombragees.json", [dict(r) for r in rows])

        # NOTE: hauteur_vs_soleil, top10_rues_soleil, top10_rues_ombre
        # removed — ST_DWithin spatial join too heavy on prod (20k × 500k)

    print(f"\n✅ Export terminé → {OUT_DIR}/")
    print(f"   {len(list(OUT_DIR.glob('*.json')))} fichiers JSON générés")


def _write(filename: str, data) -> None:
    """Write JSON file and print confirmation."""
    path = OUT_DIR / filename
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    print(f"  ✓ {filename}")


def main():
    parser = argparse.ArgumentParser(description="Export blog stats as JSON")
    parser.add_argument(
        "--date",
        default="2026-03-20",
        help="Date de référence pour les stats soleil (défaut: 2026-03-20, équinoxe)",
    )
    args = parser.parse_args()

    engine = create_engine(DATABASE_URL)
    print(f"📊 Export des stats blog pour le {args.date}...")
    print(f"   → {OUT_DIR}\n")

    export(engine, args.date)


if __name__ == "__main__":
    main()
