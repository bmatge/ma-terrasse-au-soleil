-- ============================================================
-- Blog "Paris en terrasses" — Requêtes stats
-- ============================================================
-- Pré-requis : avoir lancé compute_sun_stats.py pour les dates voulues
-- Paramètre : remplacer :target_date par la date ciblée (ex: '2026-04-05')
--
-- Angles éditoriaux :
--   ☀️  "au soleil"  → terrasses ensoleillées (Pâques, printemps…)
--   🌿 "à l'ombre"  → refuges canicule (été, terrasses ombragées 12h-16h)
-- ============================================================


-- ============================================================
-- MODULE 1 — KPIs globaux
-- ============================================================

-- Q1-A · Nombre total de terrasses indexées
SELECT
    COUNT(*)                                      AS total_terrasses,
    COUNT(hp.terrasse_id)                         AS avec_profil_horizon,
    COUNT(*) - COUNT(hp.terrasse_id)              AS sans_profil
FROM terrasses t
LEFT JOIN horizon_profiles hp ON hp.terrasse_id = t.id;


-- Q1-B · Distribution par arrondissement
SELECT
    arrondissement,
    COUNT(*) AS nb_terrasses
FROM terrasses
GROUP BY arrondissement
ORDER BY arrondissement;


-- Q1-C · Répartition soleil / ombre sur une date donnée
SELECT
    COUNT(*) FILTER (WHERE soleil = TRUE)  AS total_slots_soleil,
    COUNT(*) FILTER (WHERE soleil = FALSE) AS total_slots_ombre,
    ROUND(
        COUNT(*) FILTER (WHERE soleil = TRUE) * 100.0
        / NULLIF(COUNT(*), 0), 1
    ) AS pct_soleil
FROM sun_stats
WHERE date = :target_date;


-- Q1-D · Terrasses "défavorisées" (< 2h de soleil sur la journée)
SELECT
    COUNT(*) AS terrasses_a_l_ombre,
    ROUND(
        COUNT(*) * 100.0
        / (SELECT COUNT(DISTINCT terrasse_id) FROM sun_stats WHERE date = :target_date), 1
    ) AS pct_du_total
FROM (
    SELECT terrasse_id,
           COUNT(*) FILTER (WHERE soleil = TRUE) AS heures_soleil
    FROM sun_stats
    WHERE date = :target_date
    GROUP BY terrasse_id
) sub
WHERE heures_soleil < 2;


-- ============================================================
-- MODULE 2 — Palmarès ☀️ (au soleil)
-- ============================================================

-- Q2-A · Top 10 terrasses les plus ensoleillées
SELECT
    COALESCE(t.nom_commercial, t.nom) AS nom,
    t.arrondissement,
    t.adresse,
    COUNT(*) FILTER (WHERE ss.soleil = TRUE) AS heures_soleil,
    ROUND(
        COUNT(*) FILTER (WHERE ss.soleil = TRUE) * 100.0
        / NULLIF(COUNT(*), 0), 1
    ) AS pct_soleil
FROM sun_stats ss
JOIN terrasses t ON t.id = ss.terrasse_id
WHERE ss.date = :target_date
GROUP BY t.id, t.nom_commercial, t.nom, t.arrondissement, t.adresse
ORDER BY heures_soleil DESC
LIMIT 10;


-- Q2-B · Flop 10 — les plus à l'ombre (= top refuge canicule 🌿)
SELECT
    COALESCE(t.nom_commercial, t.nom) AS nom,
    t.arrondissement,
    t.adresse,
    COUNT(*) FILTER (WHERE ss.soleil = TRUE) AS heures_soleil,
    ROUND(
        COUNT(*) FILTER (WHERE ss.soleil = TRUE) * 100.0
        / NULLIF(COUNT(*), 0), 1
    ) AS pct_soleil
FROM sun_stats ss
JOIN terrasses t ON t.id = ss.terrasse_id
WHERE ss.date = :target_date
GROUP BY t.id, t.nom_commercial, t.nom, t.arrondissement, t.adresse
ORDER BY heures_soleil ASC
LIMIT 10;


-- Q2-C · Arrondissement champion soleil
SELECT
    t.arrondissement,
    ROUND(AVG(sub.pct_soleil), 1) AS pct_moyen,
    COUNT(*) AS nb_terrasses
FROM (
    SELECT
        terrasse_id,
        COUNT(*) FILTER (WHERE soleil = TRUE) * 100.0
        / NULLIF(COUNT(*), 0) AS pct_soleil
    FROM sun_stats
    WHERE date = :target_date
    GROUP BY terrasse_id
) sub
JOIN terrasses t ON t.id = sub.terrasse_id
GROUP BY t.arrondissement
HAVING COUNT(*) >= 10
ORDER BY pct_moyen DESC;


-- Q2-D · Arrondissement champion ombre (refuges canicule 🌿)
-- Même requête, ORDER BY ASC
SELECT
    t.arrondissement,
    ROUND(AVG(sub.pct_soleil), 1) AS pct_moyen_soleil,
    ROUND(100 - AVG(sub.pct_soleil), 1) AS pct_moyen_ombre,
    COUNT(*) AS nb_terrasses
FROM (
    SELECT
        terrasse_id,
        COUNT(*) FILTER (WHERE soleil = TRUE) * 100.0
        / NULLIF(COUNT(*), 0) AS pct_soleil
    FROM sun_stats
    WHERE date = :target_date
    GROUP BY terrasse_id
) sub
JOIN terrasses t ON t.id = sub.terrasse_id
GROUP BY t.arrondissement
HAVING COUNT(*) >= 10
ORDER BY pct_moyen_soleil ASC;


-- ============================================================
-- MODULE 2bis — Palmarès 🌿 canicule (ombre 12h–16h)
-- ============================================================

-- Q2E · Top 10 terrasses 100% à l'ombre pendant les heures chaudes
-- Angle : "Où se réfugier quand Paris fond"
SELECT
    COALESCE(t.nom_commercial, t.nom) AS nom,
    t.arrondissement,
    t.adresse,
    sub.heures_ombre_midi AS heures_full_ombre_12h_16h,
    sub.heures_soleil_total AS heures_soleil_journee
FROM (
    SELECT
        terrasse_id,
        COUNT(*) FILTER (WHERE heure BETWEEN 12 AND 16 AND soleil = FALSE) AS heures_ombre_midi,
        COUNT(*) FILTER (WHERE soleil = TRUE) AS heures_soleil_total
    FROM sun_stats
    WHERE date = :target_date
    GROUP BY terrasse_id
    HAVING COUNT(*) FILTER (WHERE heure BETWEEN 12 AND 16 AND soleil = FALSE) = 5
    -- 5 = toutes les heures 12,13,14,15,16 sont à l'ombre
) sub
JOIN terrasses t ON t.id = sub.terrasse_id
ORDER BY sub.heures_soleil_total DESC  -- parmi les ombragés midi, ceux avec du soleil matin/soir
LIMIT 10;


-- Q2F · Terrasses "mixtes" — soleil le matin, ombre l'après-midi
-- Angle : "Le meilleur des deux mondes"
SELECT
    COALESCE(t.nom_commercial, t.nom) AS nom,
    t.arrondissement,
    t.adresse,
    sub.soleil_matin,
    sub.soleil_aprem
FROM (
    SELECT
        terrasse_id,
        COUNT(*) FILTER (WHERE heure BETWEEN 7 AND 12 AND soleil = TRUE) AS soleil_matin,
        COUNT(*) FILTER (WHERE heure BETWEEN 13 AND 17 AND soleil = TRUE) AS soleil_aprem
    FROM sun_stats
    WHERE date = :target_date
    GROUP BY terrasse_id
) sub
JOIN terrasses t ON t.id = sub.terrasse_id
WHERE sub.soleil_matin >= 4 AND sub.soleil_aprem <= 1
ORDER BY sub.soleil_matin DESC
LIMIT 10;


-- ============================================================
-- MODULE 3 — Anatomie des terrasses
-- ============================================================

-- Q3-A · Superficie : min, max, médiane, moyenne
SELECT
    MIN(longueur * largeur)                                           AS superficie_min_m2,
    MAX(longueur * largeur)                                           AS superficie_max_m2,
    ROUND(AVG(longueur * largeur)::NUMERIC, 1)                       AS superficie_moyenne_m2,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP
        (ORDER BY longueur * largeur)::NUMERIC, 1)                   AS superficie_mediane_m2,
    COUNT(*) FILTER (WHERE longueur IS NULL OR largeur IS NULL)       AS sans_superficie
FROM terrasses
WHERE longueur > 0 AND largeur > 0;


-- Q3-A bis · Top 3 plus grandes terrasses
SELECT
    COALESCE(nom_commercial, nom) AS nom,
    adresse,
    arrondissement,
    ROUND((longueur * largeur)::NUMERIC, 1) AS superficie_m2,
    longueur,
    largeur
FROM terrasses
WHERE longueur > 0 AND largeur > 0
ORDER BY longueur * largeur DESC NULLS LAST
LIMIT 3;


-- Q3-B · Distribution des superficies (buckets)
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
ORDER BY MIN(longueur * largeur);


-- Q3-C · Types de terrasses (typologie)
SELECT
    typologie,
    COUNT(*) AS nb,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct
FROM terrasses
WHERE typologie IS NOT NULL
GROUP BY typologie
ORDER BY nb DESC;


-- ============================================================
-- MODULE 4 — Temporalité solaire
-- ============================================================

-- Q4-A · Terrasses au soleil par heure de la journée
SELECT
    heure,
    COUNT(*) FILTER (WHERE soleil = TRUE) AS terrasses_au_soleil,
    COUNT(*) FILTER (WHERE soleil = FALSE) AS terrasses_a_l_ombre,
    ROUND(
        COUNT(*) FILTER (WHERE soleil = TRUE) * 100.0
        / NULLIF(COUNT(*), 0), 1
    ) AS pct_au_soleil
FROM sun_stats
WHERE date = :target_date
GROUP BY heure
ORDER BY heure;


-- Q4-B · Heure de pointe (le créneau d'or)
SELECT
    heure,
    COUNT(*) FILTER (WHERE soleil = TRUE) AS terrasses_au_soleil
FROM sun_stats
WHERE date = :target_date
GROUP BY heure
ORDER BY terrasses_au_soleil DESC
LIMIT 1;


-- Q4-C · Comparaison multi-dates (si plusieurs dates calculées)
SELECT
    date,
    heure,
    COUNT(*) FILTER (WHERE soleil = TRUE) AS terrasses_au_soleil,
    ROUND(
        COUNT(*) FILTER (WHERE soleil = TRUE) * 100.0
        / NULLIF(COUNT(*), 0), 1
    ) AS pct_au_soleil
FROM sun_stats
GROUP BY date, heure
ORDER BY date, heure;


-- ============================================================
-- MODULE 5 — Géographie et urbanisme
-- ============================================================

-- Q5-A · Corrélation hauteur bâtiments voisins / ensoleillement (agrégé par bucket)
SELECT
    CASE
        WHEN avg_h < 10  THEN '< 10 m'
        WHEN avg_h < 20  THEN '10–20 m'
        WHEN avg_h < 30  THEN '20–30 m'
        ELSE '> 30 m'
    END AS hauteur_voisins,
    ROUND(AVG(pct_soleil)::NUMERIC, 1) AS pct_soleil_moyen,
    COUNT(*) AS nb_terrasses
FROM (
    SELECT
        t.id,
        AVG(b.hauteur) AS avg_h,
        sub.pct_soleil
    FROM terrasses t
    JOIN (
        SELECT terrasse_id,
               COUNT(*) FILTER (WHERE soleil = TRUE) * 100.0
               / NULLIF(COUNT(*), 0) AS pct_soleil
        FROM sun_stats
        WHERE date = :target_date
        GROUP BY terrasse_id
    ) sub ON sub.terrasse_id = t.id
    JOIN batiments b
        ON ST_DWithin(t.geometry::geography, ST_Centroid(b.geometry)::geography, 50)
    WHERE b.hauteur IS NOT NULL
    GROUP BY t.id, sub.pct_soleil
) agg
GROUP BY 1
ORDER BY MIN(avg_h);


-- Q5-B · Rue la plus ensoleillée
SELECT
    REGEXP_REPLACE(t.adresse, '^\d+[A-Za-z]?\s*', '') AS rue,
    COUNT(*) AS nb_terrasses,
    ROUND(AVG(sub.pct_soleil)::NUMERIC, 1) AS pct_soleil_moyen
FROM terrasses t
JOIN (
    SELECT terrasse_id,
           COUNT(*) FILTER (WHERE soleil = TRUE) * 100.0
           / NULLIF(COUNT(*), 0) AS pct_soleil
    FROM sun_stats
    WHERE date = :target_date
    GROUP BY terrasse_id
) sub ON sub.terrasse_id = t.id
WHERE t.adresse IS NOT NULL
GROUP BY 1
HAVING COUNT(*) >= 3
ORDER BY pct_soleil_moyen DESC
LIMIT 10;


-- Q5-C · Rue la plus ombragée 🌿
SELECT
    REGEXP_REPLACE(t.adresse, '^\d+[A-Za-z]?\s*', '') AS rue,
    COUNT(*) AS nb_terrasses,
    ROUND(AVG(sub.pct_soleil)::NUMERIC, 1) AS pct_soleil_moyen,
    ROUND(100 - AVG(sub.pct_soleil)::NUMERIC, 1) AS pct_ombre_moyen
FROM terrasses t
JOIN (
    SELECT terrasse_id,
           COUNT(*) FILTER (WHERE soleil = TRUE) * 100.0
           / NULLIF(COUNT(*), 0) AS pct_soleil
    FROM sun_stats
    WHERE date = :target_date
    GROUP BY terrasse_id
) sub ON sub.terrasse_id = t.id
WHERE t.adresse IS NOT NULL
GROUP BY 1
HAVING COUNT(*) >= 3
ORDER BY pct_soleil_moyen ASC
LIMIT 10;
