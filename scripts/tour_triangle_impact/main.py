"""Impact de la Tour Triangle sur les terrasses parisiennes.

Usage:
    python -m scripts.tour_triangle_impact.main
    python -m scripts.tour_triangle_impact.main --rayon 700
    python -m scripts.tour_triangle_impact.main --dry-run  # 10 terrasses seulement

Ce script est READ-ONLY sur la BDD de l'app.
Il écrit uniquement dans le dossier output/.
"""
import argparse
import sys
import time

from shapely.geometry import Point

from .db_reader import fetch_horizon_profile, fetch_terrasses_in_radius, get_connection
from .exporter import (
    ensure_output_dir,
    export_shadow_geojson,
    export_stats_json,
    export_terrasses_csv,
    export_top10_json,
)
from .shadow_calculator import (
    MOMENTS_CLES,
    compute_distance_m,
    compute_shadow_for_moment,
    compute_terrasse_impact,
    get_tour_centroid,
    load_tour_geometry,
)


def main():
    parser = argparse.ArgumentParser(
        description="Impact de la Tour Triangle sur les terrasses parisiennes"
    )
    parser.add_argument("--rayon", type=int, default=750, help="Rayon d'analyse en mètres (défaut: 750)")
    parser.add_argument("--dry-run", action="store_true", help="Limite à 10 terrasses pour tester")
    parser.add_argument("--output", type=str, default="./output", help="Répertoire de sortie")
    parser.add_argument("--verbose", action="store_true", help="Affiche le détail du calcul")
    args = parser.parse_args()

    ensure_output_dir(args.output)

    # Load tower geometry
    tour_geom = load_tour_geometry()
    tour_lat, tour_lon = get_tour_centroid()
    print(f"Tour Triangle — centroïde: {tour_lat:.6f}°N, {tour_lon:.6f}°E")
    print(f"Rayon d'analyse: {args.rayon}m")

    # Connect to DB (read-only)
    print("Connexion à la BDD (read-only)...")
    conn = get_connection()

    try:
        # Fetch terrasses in zone
        terrasses = fetch_terrasses_in_radius(conn, tour_lat, tour_lon, args.rayon)
        print(f"Terrasses dans la zone: {len(terrasses)}")

        if args.dry_run:
            terrasses = terrasses[:10]
            print(f"Mode dry-run: limité à {len(terrasses)} terrasses")

        if not terrasses:
            print("Aucune terrasse trouvée dans la zone. Vérifiez le rayon ou la BDD.")
            sys.exit(1)

        # Process each terrasse
        results = []
        t0 = time.time()
        sans_profil = 0

        for i, t in enumerate(terrasses):
            if args.verbose or (i + 1) % 50 == 0 or i == 0:
                print(f"[{i+1}/{len(terrasses)}] {t['nom'] or t['adresse'] or f'id={t[\"id\"]}'}")

            # Fetch horizon profile
            profile = fetch_horizon_profile(conn, t["id"])
            if profile is None:
                sans_profil += 1
                if args.verbose:
                    print(f"  ⚠ Pas de profil d'horizon, skip")
                continue

            # Compute distance to tower
            dist = compute_distance_m(tour_lat, tour_lon, t["lat"], t["lon"])

            # Compute impact
            impact = compute_terrasse_impact(
                t["lat"], t["lon"], profile, tour_geom, verbose=args.verbose
            )

            results.append({
                "id": t["id"],
                "nom": t["nom"],
                "adresse": t["adresse"],
                "arrondissement": t["arrondissement"],
                "lat": round(t["lat"], 6),
                "lon": round(t["lon"], 6),
                "distance_tour_m": round(dist, 0),
                **impact,
            })

        elapsed = time.time() - t0
        print(f"\nCalcul terminé en {elapsed:.1f}s")

        if sans_profil > 0:
            print(f"  ({sans_profil} terrasses sans profil d'horizon, ignorées)")

        # Filter to impacted only for CSV
        impactees = [r for r in results if r["heures_perdues"] > 0]
        print(f"Terrasses impactées: {len(impactees)} / {len(results)}")

        # Compute shadow polygons for key moments
        print("\nCalcul des polygones d'ombre pour les moments clés...")
        shadow_features = []
        for mois, heure, label in MOMENTS_CLES:
            feature = compute_shadow_for_moment(tour_geom, mois, heure, label)
            if feature is not None:
                # Count terrasses in this shadow
                from shapely.geometry import shape as shp
                shadow_poly = shp(feature["geometry"])
                count = sum(
                    1 for r in results
                    if shadow_poly.contains(Point(r["lon"], r["lat"]))
                )
                feature["properties"]["nb_terrasses_dans_ombre"] = count
                print(f"  {label}: ombre {feature['properties']['longueur_ombre_m']:.0f}m, "
                      f"{count} terrasses dans l'ombre")
            shadow_features.append(feature)

        # Export all outputs
        print(f"\nExport vers {args.output}/")

        p1 = export_terrasses_csv(impactees, args.output)
        print(f"  ✓ {p1}")

        p2 = export_stats_json(results, len(results), tour_lat, tour_lon, args.output)
        print(f"  ✓ {p2}")

        p3 = export_top10_json(results, args.output)
        print(f"  ✓ {p3}")

        p4 = export_shadow_geojson(shadow_features, args.output)
        print(f"  ✓ {p4}")

        # Summary
        if impactees:
            top = max(impactees, key=lambda r: r["heures_perdues"])
            total_lost = sum(r["heures_perdues"] for r in impactees)
            print(f"\n{'='*60}")
            print(f"RÉSUMÉ")
            print(f"  Terrasses dans la zone: {len(results)}")
            print(f"  Terrasses impactées: {len(impactees)}")
            print(f"  Total heures perdues/an: {total_lost}")
            print(f"  Plus impactée: {top['nom']} — {top['heures_perdues']}h perdues ({top['pct_perte']}%)")
            print(f"{'='*60}")
        else:
            print("\nAucune terrasse impactée par la Tour Triangle dans cette zone.")

    finally:
        conn.close()
        print("\nConnexion BDD fermée.")


if __name__ == "__main__":
    main()
