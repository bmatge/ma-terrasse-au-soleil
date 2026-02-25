# ☀️ Terrasse au Soleil — Plan MVP v2

## Vision

Une application web/mobile permettant de trouver une terrasse ensoleillée à Paris et petite couronne (92, 93, 94), en croisant calcul d'ombrage urbain et prévisions météo.

---

## Les deux modes d'utilisation

### Mode 1 — "Quand y aller ?"

> *Je sais OÙ je veux aller, je cherche QUAND.*

**Entrée utilisateur :** une adresse OU un nom de bar/restaurant (autocomplétion)

**Résultat :**
- Timeline de la journée montrant les créneaux ensoleillés (barre colorée type calendrier)
- Croisement avec la météo : les créneaux "soleil théorique + ciel dégagé" sont mis en valeur
- Indication synthétique : *"Meilleur créneau aujourd'hui : 12h30 – 15h00 ☀️"*
- Si l'établissement n'a pas de terrasse connue, on calcule quand même pour le trottoir/façade et on le signale

**Variante :** l'utilisateur peut changer de jour (aujourd'hui, demain, samedi prochain…) pour planifier à l'avance.

```
┌─────────────────────────────────────────────────┐
│  🔍 Le Petit Cler, rue Cler Paris 7e            │
├─────────────────────────────────────────────────┤
│                                                  │
│  Aujourd'hui – Mercredi 25 février               │
│                                                  │
│  08  09  10  11  12  13  14  15  16  17  18     │
│  ░░  ░░  ░░  ▓▓  ▓▓  ▓▓  ▓▓  ▓▓  ░░  ░░     │
│                  ☀️ soleil                        │
│                                                  │
│  Météo : ⛅ Éclaircies 12h-14h │ ☀️ Dégagé 14h+ │
│                                                  │
│  ✨ Meilleur créneau : 14h00 – 15h45            │
│     (soleil + ciel dégagé)                       │
│                                                  │
│  ░░ = ombre bâtiments  ▓▓ = exposition soleil   │
│  Les créneaux tiennent compte de la météo       │
└─────────────────────────────────────────────────┘
```

### Mode 2 — "Où aller ?"

> *Je sais QUAND (maintenant ou bientôt), je cherche OÙ.*

**Entrée utilisateur :** position GPS (géoloc) ou adresse saisie + créneau (par défaut : maintenant)

**Résultat :**
- Carte centrée sur la position, avec les terrasses proches colorées selon leur statut soleil/ombre à l'heure demandée
- Liste triée par distance des terrasses actuellement au soleil
- Filtre météo : si le ciel est couvert, message transparent *"Ciel couvert actuellement — voici les terrasses qui seraient au soleil par temps dégagé"*
- Possibilité de scroller dans le temps (slider) pour trouver un créneau qui marche

```
┌──────────────────────────────────────────────────┐
│  📍 Autour de Rue Oberkampf, Paris 11e           │
│  🕐 Maintenant (14h30) – ☀️ Ciel dégagé         │
├──────────────────────────────────────────────────┤
│                                                   │
│  ┌──────────────────────────────────┐             │
│  │        🗺️ CARTE                  │             │
│  │                                  │             │
│  │    ☀️  ☀️        📍              │             │
│  │            🏢        ☀️          │             │
│  │      🏢          🏢             │             │
│  │  ☀️                    ⛅        │             │
│  └──────────────────────────────────┘             │
│                                                   │
│  ☀️ Café Charbon — 80m — soleil jusqu'à 16h15    │
│  ☀️ Aux Deux Amis — 150m — soleil jusqu'à 15h30  │
│  ⛅ Le Perchoir — 200m — soleil dans 25 min      │
│  🏢 Café de l'Industrie — 120m — ombre           │
│                                                   │
│  ◀ 13h ━━━━━━━━●━━━━━━━ 18h ▶  [slider temps]   │
└──────────────────────────────────────────────────┘
```

---

## Intégration Météo

### Source de données

| API | Gratuit | Prévision | Données utiles |
|-----|---------|-----------|----------------|
| **Open-Meteo** | ✅ Totalement gratuit, pas de clé API | 16 jours | Couverture nuageuse %, ensoleillement direct W/m², précipitations |
| **OpenWeather** | Freemium (1000 appels/jour) | 5 jours | Couverture nuageuse, météo description, icône |
| **Météo-France API** | Gratuit (inscription) | 4 jours | Données officielles France, nébulosité |

**Choix MVP : Open-Meteo** — gratuit, sans clé, données horaires, couverture nuageuse par heure, ensoleillement direct (DNI/GHI). Parfait pour un projet perso.

### Logique de croisement

```
Pour chaque créneau horaire :
  ensoleillement_urbain = profil_horizon vs position_soleil  (notre calcul)
  couverture_nuageuse   = Open-Meteo cloud_cover (0-100%)
  
  score_final = 
    si couverture_nuageuse > 80%  → "couvert" (gris) même si pas d'ombre urbaine
    si couverture_nuageuse > 50%  → "mitigé"  (jaune) 
    si ensoleillement_urbain ET couverture < 50% → "soleil" ☀️ (vert/doré)
    si ombre_bâtiment → "ombre urbaine" 🏢 (gris foncé)
```

### Données Open-Meteo utiles

```
GET https://api.open-meteo.com/v1/forecast
  ?latitude=48.8566&longitude=2.3522
  &hourly=cloud_cover,direct_radiation,precipitation_probability
  &timezone=Europe/Paris
  &forecast_days=7
```

Paramètres clés :
- `cloud_cover` : nébulosité 0-100% (le plus important)
- `direct_radiation` : rayonnement solaire direct en W/m² (confirme si le soleil "tape" réellement)
- `precipitation_probability` : utile pour le message d'ambiance ("prenez un parapluie" vs "lunettes de soleil")

---

## Architecture technique actualisée

```
┌─────────────────────────────────────────────────────┐
│              Frontend (React + MapLibre)              │
│                                                       │
│  ┌─────────────┐  ┌──────────────────────────────┐   │
│  │ Mode 1      │  │ Mode 2                       │   │
│  │ "Quand ?"   │  │ "Où ?"                       │   │
│  │             │  │                              │   │
│  │ Recherche   │  │ Carte + liste                │   │
│  │ bar/adresse │  │ Géoloc + slider temps        │   │
│  │ Timeline    │  │ Markers soleil/ombre         │   │
│  └──────┬──────┘  └──────────────┬───────────────┘   │
│         │                        │                    │
│         └────────┬───────────────┘                    │
│                  │                                     │
└──────────────────┼─────────────────────────────────────┘
                   │ API REST
┌──────────────────▼─────────────────────────────────────┐
│                Backend (Python FastAPI)                  │
│                                                         │
│  /api/terrasse/search?q=...           → autocomplétion  │
│  /api/terrasse/{id}/timeline?date=... → Mode 1          │
│  /api/terrasses/nearby?lat=..&lon=..&datetime=...       │
│                                       → Mode 2          │
│  /api/meteo?lat=..&lon=..&date=...    → proxy météo     │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │ SunCalc  │  │ Ombrage  │  │ Open-Meteo (caché)   │  │
│  │ (soleil) │  │ (profils │  │ Refresh toutes les   │  │
│  │          │  │ horizon) │  │ heures               │  │
│  └──────────┘  └──────────┘  └──────────────────────┘  │
└──────────────────┬─────────────────────────────────────┘
                   │
┌──────────────────▼─────────────────────────────────────┐
│           PostgreSQL + PostGIS                          │
│                                                         │
│  terrasses          bâtiments         profils_horizon   │
│  ─────────          ──────────        ───────────────   │
│  id                 id                terrasse_id       │
│  nom                geometry(poly)    azimut (0-359°)   │
│  geometry(point)    hauteur           elevation_max     │
│  adresse            source            (tableau 360      │
│  type_source        date_maj           valeurs)         │
│  code_naf                                               │
│  a_terrasse_confirmee                  meteo_cache      │
│                                        ──────────────   │
│                                        date             │
│                                        heure            │
│                                        cloud_cover      │
│                                        direct_radiation │
└─────────────────────────────────────────────────────────┘
```

---

## API Endpoints détaillés

### Mode 1 — Timeline pour un lieu

```
GET /api/terrasse/search?q=petit+cler
→ autocomplétion : [{id, nom, adresse, lat, lon}, ...]

GET /api/terrasse/{id}/timeline?date=2026-02-25
→ {
    terrasse: {nom, adresse, lat, lon},
    timeline: [
      {heure: "08:00", soleil_urbain: false, cloud_cover: 90, statut: "couvert"},
      {heure: "12:00", soleil_urbain: true,  cloud_cover: 30, statut: "soleil"},
      {heure: "15:00", soleil_urbain: true,  cloud_cover: 10, statut: "soleil"},
      {heure: "17:00", soleil_urbain: false, cloud_cover: 20, statut: "ombre_batiment"},
    ],
    meilleur_creneau: {debut: "11:45", fin: "15:30"},
    meteo_resume: "Éclaircies à partir de 11h, dégagé l'après-midi"
  }
```

### Mode 2 — Terrasses au soleil autour de moi

```
GET /api/terrasses/nearby?lat=48.865&lon=2.379&datetime=2026-02-25T14:30&rayon=500
→ {
    meteo: {cloud_cover: 25, statut: "dégagé", temperature: 18},
    terrasses: [
      {id, nom, distance_m: 80,  statut: "soleil", soleil_jusqua: "16:15"},
      {id, nom, distance_m: 150, statut: "soleil", soleil_jusqua: "15:30"},
      {id, nom, distance_m: 200, statut: "soleil_partiel", soleil_dans: "25min"},
      {id, nom, distance_m: 120, statut: "ombre", prochain_soleil: "demain 11:00"},
    ]
  }
```

### Recherche par adresse (les deux modes)

```
GET /api/geocode?q=12+rue+oberkampf+paris
→ proxy vers API BAN, retourne {lat, lon, adresse_formatee}
```

---

## Modèle de données

### Table `terrasses`

| Colonne | Type | Source |
|---------|------|--------|
| id | UUID | généré |
| nom | text | Sirene / Paris Open Data |
| adresse | text | BAN / Paris Open Data |
| geometry | point (4326) | géocodage BAN |
| code_naf | varchar(6) | Sirene |
| source | enum (paris_opendata, sirene, osm, crowdsource) | — |
| terrasse_confirmee | boolean | Paris OD = true, sinon false |
| outdoor_seating_osm | boolean | OSM si dispo |
| orientation_facade | float (degrés) | calculé depuis géométrie voirie |
| profil_horizon_id | FK | lien vers profil pré-calculé |

### Table `batiments`

| Colonne | Type | Source |
|---------|------|--------|
| id | UUID | — |
| geometry | polygon (4326) | BD TOPO |
| hauteur | float (mètres) | BD TOPO |
| nb_etages | int | OSM si dispo |

### Table `profils_horizon`

| Colonne | Type | Description |
|---------|------|-------------|
| terrasse_id | FK | — |
| profil | float[360] | Élévation max de l'obstacle pour chaque degré d'azimut |
| date_calcul | timestamp | pour savoir quand recalculer |

### Table `meteo_cache`

| Colonne | Type | Description |
|---------|------|-------------|
| lat_arrondi | float | arrondi à 0.05° (~5km, suffisant pour la météo) |
| lon_arrondi | float | — |
| date | date | — |
| donnees_horaires | jsonb | cloud_cover, radiation, precipitations par heure |
| fetched_at | timestamp | pour refresh si > 1h |

---

## Plan de réalisation révisé

### Phase 0 — Données & infra (2 semaines)

**Objectif : avoir toutes les données dans PostGIS, vérifiées sur QGIS.**

- [ ] Setup repo Git + Docker Compose (PostGIS, Redis)
- [ ] Script d'import BD TOPO 3D (Paris + 92/93/94) → table `batiments`
- [ ] Script d'import terrasses Paris Open Data → table `terrasses`
- [ ] Script Sirene + géocodage BAN pour petite couronne → table `terrasses`
- [ ] Enrichissement OSM (outdoor_seating) via Overpass API
- [ ] Vérification visuelle QGIS : superposer terrasses + bâtiments
- [ ] Calculer l'orientation de la façade pour chaque terrasse (angle de la rue la plus proche via PostGIS + données voirie)

### Phase 1 — Moteur d'ombrage (2-3 semaines)

**Objectif : pour chaque terrasse, un profil d'horizon pré-calculé.**

- [ ] Lib de calcul solaire (pysolar) — tests unitaires sur des cas connus
- [ ] Algorithme de profil d'horizon :
  - Pour chaque terrasse, requête PostGIS bâtiments dans un rayon de 200m
  - Pour chaque degré d'azimut (0-359°), trouver l'élévation max des obstacles
  - Stocker le profil (array de 360 floats)
- [ ] Batch de calcul pour toutes les terrasses (paralléliser avec multiprocessing)
- [ ] Fonction `est_au_soleil(terrasse_id, datetime) → bool` basée sur le profil
- [ ] Validation : comparer avec des observations réelles sur 5-10 terrasses connues
- [ ] Benchmark : objectif < 5ms par lookup terrasse (hors BDD)

### Phase 2 — API Backend (2 semaines)

**Objectif : les deux endpoints principaux fonctionnent.**

- [ ] FastAPI + SQLAlchemy/GeoAlchemy2
- [ ] Endpoint autocomplétion terrasses (recherche full-text PostgreSQL)
- [ ] Endpoint timeline Mode 1 (calcul soleil × météo pour une terrasse, 1 journée)
- [ ] Endpoint nearby Mode 2 (terrasses dans un rayon, triées par distance, avec statut)
- [ ] Proxy géocodage BAN
- [ ] Intégration Open-Meteo avec cache (1 appel par zone de 5km² par heure)
- [ ] Logique de croisement soleil urbain × météo
- [ ] Tests d'intégration
- [ ] Doc Swagger

### Phase 3 — Frontend (3 semaines)

**Objectif : application utilisable sur mobile.**

- [ ] Setup React + Vite + MapLibre GL JS
- [ ] Écran d'accueil : choix Mode 1 / Mode 2 (ou barre de recherche unifiée)
- [ ] Mode 1 :
  - Barre de recherche avec autocomplétion (bar OU adresse BAN)
  - Affichage timeline de la journée (composant barre colorée)
  - Indication "meilleur créneau"
  - Météo du jour intégrée
  - Sélecteur de date (aujourd'hui / demain / date libre)
- [ ] Mode 2 :
  - Carte MapLibre centrée sur la position (géoloc ou saisie)
  - Markers terrasses colorés (soleil/ombre/partiel)
  - Liste sous la carte triée par distance
  - Slider temporel (glisser pour voir l'évolution)
  - Indicateur météo en overlay
- [ ] Fiche terrasse (popup ou drawer) :
  - Nom, adresse, type
  - Timeline d'ensoleillement
  - Lien Google Maps / itinéraire
  - Bouton "signaler une erreur"
- [ ] Responsive mobile first (le cas d'usage principal est en mobilité)

### Phase 4 — Qualité & lancement (1-2 semaines)

- [ ] PWA (manifest, service worker pour le cache offline de la carte)
- [ ] Déploiement :
  - Frontend → Vercel ou Netlify
  - Backend → Render (tu connais déjà)
  - BDD → Neon ou Supabase (PostgreSQL + PostGIS managé)
  - Redis → Upstash (gratuit pour le cache)
- [ ] Monitoring (Sentry pour les erreurs, simple health check)
- [ ] Landing page minimale + partage sur les réseaux
- [ ] Feedback : bouton "cette terrasse était-elle vraiment au soleil ?" pour améliorer

---

## UX — Détails importants

### La barre de recherche unifiée

Plutôt que forcer le choix Mode 1 / Mode 2, une seule barre de recherche intelligente :

```
┌──────────────────────────────────────────────┐
│  🔍  "Le Comptoir, 12 rue..." │ 📍 Autour   │
│        OU saisir un lieu       │  de moi     │
└──────────────────────────────────────────────┘
```

- Si l'utilisateur tape un nom de bar → Mode 1 (timeline)
- Si l'utilisateur tape une adresse → Mode 2 (carte autour de cette adresse)
- Si l'utilisateur clique "Autour de moi" → Mode 2 (géoloc)
- Si l'utilisateur clique sur une terrasse dans la carte (Mode 2) → bascule vers la timeline de cette terrasse (Mode 1)

Les deux modes sont interconnectés, pas cloisonnés.

### Messages météo contextuels

| Situation | Message |
|-----------|---------|
| Soleil urbain + ciel dégagé | ☀️ *"Au soleil !"* |
| Soleil urbain + nuageux | ⛅ *"Exposé mais ciel nuageux"* |
| Soleil urbain + pluie prévue | 🌧️ *"Ensoleillé en théorie, mais pluie prévue"* |
| Ombre urbaine + beau temps | 🏢 *"À l'ombre des bâtiments malgré le beau temps"* |
| Ombre + couvert | *"À l'ombre — pas de soleil prévu"* |
| Nuit | 🌙 *"Le soleil est couché"* |

### Informations de confiance

Afficher un indicateur de fiabilité des données :
- ✅ **Terrasse confirmée** (source Paris Open Data ou validée par un utilisateur)
- 🔶 **Terrasse probable** (établissement Sirene + OSM outdoor_seating)
- ❓ **Terrasse possible** (restaurant/bar Sirene, non confirmé)

---

## Budget infrastructure (projet perso)

| Service | Offre | Coût |
|---------|-------|------|
| Open-Meteo | Gratuit | 0 € |
| API BAN | Gratuit | 0 € |
| API Sirene | Gratuit | 0 € |
| BD TOPO IGN | Gratuit (open data) | 0 € |
| Vercel (frontend) | Hobby | 0 € |
| Render (backend) | Free tier | 0 € (cold start) |
| Neon (PostgreSQL) | Free tier (0.5 Go) | 0 € |
| Upstash Redis | Free tier | 0 € |
| Domaine | .fr | ~8 €/an |
| **Total MVP** | | **~8 €/an** |

⚠️ Le free tier Neon (0.5 Go) sera serré avec les données bâtiments. Options :
- Neon Pro (~19 $/mois) si ça dépasse
- Render PostgreSQL (7 $/mois)
- Self-host sur un petit VPS (Hetzner 4 €/mois)
- Ou compresser les données (ne garder que les bâtiments dans un rayon utile autour des terrasses connues)

---

## Estimation calendrier réaliste (soirs & week-ends)

| Phase | Durée estimée | Livrable |
|-------|--------------|----------|
| Phase 0 — Données | 2-3 week-ends | BDD PostGIS peuplée, vérifiée |
| Phase 1 — Moteur ombrage | 3-4 week-ends | Profils d'horizon pour toutes les terrasses |
| Phase 2 — API | 2-3 week-ends | Endpoints fonctionnels, Swagger |
| Phase 3 — Frontend | 4-5 week-ends | App utilisable sur mobile |
| Phase 4 — Deploy | 1-2 week-ends | En ligne |
| **Total** | **~12-17 week-ends** | **~3-4 mois en rythme projet perso** |

**Raccourci possible :** commencer par un proto Mode 1 uniquement sur un seul arrondissement. Timeline pour un bar donné, sans carte. Faisable en 3-4 week-ends pour valider le concept.

---

## Évolutions post-MVP

- 🌳 **Arbres** : données arbres d'alignement Paris Open Data (~200 000 arbres avec localisation)
- 📸 **Crowdsourcing** : les utilisateurs confirment/infirment le résultat → amélioration continue
- 🔔 **Notifications** : "Ta terrasse préférée sera au soleil à 14h30 aujourd'hui"
- 🗺️ **Extension** : Lyon, Bordeaux, Marseille (BD TOPO couvre toute la France)
- 🍽️ **Filtres** : type de cuisine, budget, horaires, note Google
- 📱 **App native** : React Native ou PWA avancée
- 🏗️ **LIDAR HD** : quand la couverture IGN sera complète, précision centimétrique
- 🌡️ **Confort thermique** : croiser avec la température ressentie (vent, humidité) — parfois le soleil en terrasse c'est trop chaud !

---

*Nom de projet possible : **Terrasse Soleil** · **SolBar** · **Rayon Terrasse** · **TerrassoleiL***