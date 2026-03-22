"""Export des résultats en CSV, JSON et GeoJSON."""
import csv
import json
import os


def ensure_output_dir(output_dir: str) -> None:
    os.makedirs(output_dir, exist_ok=True)


def export_terrasses_csv(results: list[dict], output_dir: str) -> str:
    """Export terrasses impactées en CSV."""
    path = os.path.join(output_dir, "terrasses_impactees.csv")
    fieldnames = [
        "id", "nom", "adresse", "arrondissement",
        "lat", "lon", "distance_tour_m",
        "heures_soleil_avant", "heures_soleil_apres",
        "heures_perdues", "pct_perte",
        "impact_hiver", "impact_ete", "impact_midi",
        "mois_le_plus_impacte",
    ]

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in results:
            row = {k: r[k] for k in fieldnames}
            writer.writerow(row)

    return path


def export_stats_json(
    results: list[dict],
    all_terrasses_count: int,
    tour_lat: float,
    tour_lon: float,
    output_dir: str,
) -> str:
    """Export editorial stats as JSON."""
    from .shadow_calculator import (
        TOUR_HAUTEUR_M,
        compute_distance_m,
    )
    import math

    impactees = [r for r in results if r["heures_perdues"] > 0]
    nb_impactees = len(impactees)

    total_heures_perdues = sum(r["heures_perdues"] for r in impactees)
    moyenne = total_heures_perdues / nb_impactees if nb_impactees > 0 else 0.0

    plus_impactee = max(impactees, key=lambda r: r["heures_perdues"]) if impactees else None

    rayon_impact = max(
        (r["distance_tour_m"] for r in impactees), default=0
    )

    # Ombre max théorique
    # Hiver: soleil ~18° d'altitude à midi en décembre à Paris
    # Été: soleil ~65° d'altitude à midi en juin
    ombre_hiver = round(TOUR_HAUTEUR_M / math.tan(math.radians(18)), 0)
    ombre_ete = round(TOUR_HAUTEUR_M / math.tan(math.radians(65)), 0)

    stats = {
        "nb_terrasses_zone": all_terrasses_count,
        "nb_terrasses_impactees": nb_impactees,
        "pct_terrasses_impactees": round(nb_impactees / all_terrasses_count * 100, 1) if all_terrasses_count > 0 else 0.0,
        "total_heures_perdues_annuel": total_heures_perdues,
        "moyenne_heures_perdues_par_terrasse": round(moyenne, 1),
        "terrasse_plus_impactee": {
            "nom": plus_impactee["nom"] if plus_impactee else "",
            "adresse": plus_impactee["adresse"] if plus_impactee else "",
            "heures_perdues": plus_impactee["heures_perdues"] if plus_impactee else 0,
        },
        "rayon_impact_reel_m": round(rayon_impact, 0),
        "ombre_max_hiver_m": ombre_hiver,
        "ombre_max_ete_m": ombre_ete,
        "moment_pire_impact": "décembre 21, 12h",
    }

    path = os.path.join(output_dir, "stats_editoriales.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)

    return path


def export_top10_json(results: list[dict], output_dir: str) -> str:
    """Export top 10 most impacted terrasses."""
    impactees = [r for r in results if r["heures_perdues"] > 0]
    top10 = sorted(impactees, key=lambda r: r["heures_perdues"], reverse=True)[:10]

    # Slim down for readability
    export = []
    for r in top10:
        export.append({
            "rang": len(export) + 1,
            "nom": r["nom"],
            "adresse": r["adresse"],
            "arrondissement": r["arrondissement"],
            "distance_tour_m": r["distance_tour_m"],
            "heures_perdues": r["heures_perdues"],
            "pct_perte": r["pct_perte"],
            "impact_hiver": r["impact_hiver"],
            "impact_ete": r["impact_ete"],
        })

    path = os.path.join(output_dir, "top10_perdantes.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(export, f, ensure_ascii=False, indent=2)

    return path


def export_shadow_geojson(features: list[dict], output_dir: str) -> str:
    """Export shadow polygons as GeoJSON FeatureCollection."""
    geojson = {
        "type": "FeatureCollection",
        "features": [f for f in features if f is not None],
    }

    path = os.path.join(output_dir, "tour_triangle_shadow.geojson")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)

    return path
