import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { useTheme } from "../contexts/ThemeContext";
import { F } from "../lib/constants";

/* ---- data imports (eager, bundled by Vite) ---- */
const dataModules = import.meta.glob<unknown>(
  "../content/blog/*/data/*.json",
  { eager: true, import: "default" },
);

function loadData(slug: string, filename: string): unknown {
  for (const [path, data] of Object.entries(dataModules)) {
    if (path.includes(`/data/${filename}`) && path.includes(slug)) return data;
  }
  return undefined;
}

/* ---- types ---- */
export interface BlogChartBlock {
  type: "chart";
  chartId: string;
  caption?: string;
}

interface ChartProps {
  chartId: string;
  slug: string;
}

/* ---- shared styles ---- */
const AMBER = "#F59E0B";
const BLUE = "#3B82F6";
const GREEN = "#10B981";
const PURPLE = "#8B5CF6";

function useTip() {
  const { th } = useTheme();
  return { fontFamily: F, fontSize: 12, background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 8 };
}

function tick(th: ReturnType<typeof useTheme>["th"], size = 11) {
  return { fontFamily: F, fontSize: size, fill: th.textMuted };
}

/* =============================================================
   Tour Triangle charts (existing)
   ============================================================= */

function TourTriangleTop10({ slug }: { slug: string }) {
  const { th } = useTheme();
  const tip = useTip();
  const raw = loadData(slug, "top10_perdantes.json") as Array<{
    nom: string; heures_perdues: number; impact_hiver: number; impact_ete: number;
  }> | undefined;
  if (!raw) return null;
  const data = raw.map((d) => ({
    nom: d.nom.length > 18 ? d.nom.slice(0, 16) + "…" : d.nom,
    Hiver: d.impact_hiver, "Été": d.impact_ete,
  }));
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={tick(th)} unit="h" />
        <YAxis type="category" dataKey="nom" width={120} tick={{ ...tick(th), fill: th.textSoft }} />
        <Tooltip contentStyle={tip} formatter={(v, name) => [`${v}h`, name as string]} />
        <Legend wrapperStyle={{ fontFamily: F, fontSize: 12 }} />
        <Bar dataKey="Hiver" stackId="a" fill={BLUE} radius={[0, 0, 0, 0]} />
        <Bar dataKey="Été" stackId="a" fill={AMBER} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function TourTriangleDonut({ slug }: { slug: string }) {
  const { th } = useTheme();
  const tip = useTip();
  const stats = loadData(slug, "stats_editoriales.json") as {
    nb_terrasses_zone: number; nb_terrasses_impactees: number;
  } | undefined;
  if (!stats) return null;
  const data = [
    { name: "Impactées", value: stats.nb_terrasses_impactees },
    { name: "Épargnées", value: stats.nb_terrasses_zone - stats.nb_terrasses_impactees },
  ];
  const COLORS = [th.accent, `${th.accent}30`];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}
          dataKey="value" label={({ name, value }) => `${name} (${value})`} style={{ fontFamily: F, fontSize: 12 }}>
          {data.map((_, idx) => <Cell key={idx} fill={COLORS[idx]} />)}
        </Pie>
        <Tooltip contentStyle={tip} formatter={(v) => [`${v} terrasses`]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TourTriangleShadow({ slug }: { slug: string }) {
  const { th } = useTheme();
  const tip = useTip();
  const dataRaw = loadData(slug, "tour_triangle_shadow.json") as {
    features: Array<{ properties: { label: string; longueur_ombre_m: number; nb_terrasses_dans_ombre: number } }>;
  } | undefined;
  const data = useMemo(() => {
    if (!dataRaw) return [];
    return dataRaw.features.map((f) => ({
      moment: f.properties.label, "Longueur (m)": f.properties.longueur_ombre_m,
      terrasses: f.properties.nb_terrasses_dans_ombre,
    }));
  }, [dataRaw]);
  if (!data.length) return null;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis dataKey="moment" tick={{ ...tick(th), fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
        <YAxis tick={tick(th)} unit="m" />
        <Tooltip contentStyle={tip} formatter={(v) => [`${v}m`]} />
        <Bar dataKey="Longueur (m)" radius={[4, 4, 0, 0]}>
          {data.map((d, idx) => (
            <Cell key={idx} fill={d.moment.includes("été") ? AMBER : d.moment.includes("printemps") ? GREEN : BLUE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* =============================================================
   "Paris en terrasses — les chiffres" charts
   ============================================================= */

/* 1. Donut — Catégories de terrasses */
function CategoriesDonut({ slug }: { slug: string }) {
  useTheme(); // needed for theme-aware tooltip
  const tip = useTip();
  const raw = loadData(slug, "categories.json") as Array<{
    categorie: string; nb: number; pct: string;
  }> | undefined;
  if (!raw) return null;

  // Merge duplicate AUTRE entries
  const merged: Record<string, { name: string; value: number }> = {};
  for (const r of raw) {
    const key = r.categorie;
    if (merged[key]) merged[key].value += r.nb;
    else merged[key] = { name: key, value: r.nb };
  }
  const data = Object.values(merged);
  const COLORS = [AMBER, GREEN, BLUE, "#78716C", PURPLE];

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}
          dataKey="value" label={({ name, value }: { name?: string; value?: number }) => `${(name ?? "").charAt(0)}${(name ?? "").slice(1).toLowerCase()} (${value})`}
          style={{ fontFamily: F, fontSize: 11 }}>
          {data.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={tip} formatter={(v) => [`${v} terrasses`]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* 2. Bar — Terrasses par arrondissement */
function ParArrondissement({ slug }: { slug: string }) {
  const { th } = useTheme();
  const tip = useTip();
  const raw = loadData(slug, "par_arrondissement.json") as Array<{
    arrondissement: string; nb_terrasses: number;
  }> | undefined;
  if (!raw) return null;

  const data = raw.map((r) => ({
    arr: r.arrondissement.replace("75", "").replace(/^0/, "") + "e",
    nb: r.nb_terrasses,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={tick(th)} />
        <YAxis type="category" dataKey="arr" width={36} tick={{ ...tick(th, 10), fill: th.textSoft }} />
        <Tooltip contentStyle={tip} formatter={(v) => [`${v} terrasses`]} />
        <Bar dataKey="nb" radius={[0, 4, 4, 0]} fill={th.accent} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* 3. Bar — Top rues (concentration) */
function TopRuesConcentration({ slug }: { slug: string }) {
  const { th } = useTheme();
  const tip = useTip();
  const raw = loadData(slug, "top_rues_concentration.json") as Array<{
    rue: string; nb_terrasses: number;
  }> | undefined;
  if (!raw) return null;

  const data = raw.slice(0, 10).map((r) => {
    // Title case
    const rue = r.rue.split(" ").map((w) =>
      w.length <= 2 ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase()
    ).join(" ");
    return { rue: rue.length > 22 ? rue.slice(0, 20) + "…" : rue, nb: r.nb_terrasses };
  });

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={tick(th)} />
        <YAxis type="category" dataKey="rue" width={150} tick={{ ...tick(th, 10), fill: th.textSoft }} />
        <Tooltip contentStyle={tip} formatter={(v) => [`${v} terrasses`]} />
        <Bar dataKey="nb" radius={[0, 4, 4, 0]} fill={GREEN} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* 4. Bar — Distribution des superficies */
function DistributionSuperficies({ slug }: { slug: string }) {
  const { th } = useTheme();
  const tip = useTip();
  const raw = loadData(slug, "distribution_superficies.json") as Array<{
    tranche: string; nb_terrasses: number; pct: string;
  }> | undefined;
  if (!raw) return null;

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={raw} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis dataKey="tranche" tick={{ ...tick(th, 10) }} />
        <YAxis tick={tick(th)} />
        <Tooltip contentStyle={tip} formatter={(v, _n, p) => [`${v} (${p.payload.pct}%)`]} />
        <Bar dataKey="nb_terrasses" radius={[4, 4, 0, 0]} fill={PURPLE} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* 5. Bar — Extrêmes de superficie (plus grandes vs plus petites) */
function ExtremesSuperficie({ slug }: { slug: string }) {
  const { th } = useTheme();
  const tip = useTip();
  const raw = loadData(slug, "extremes_superficie.json") as {
    plus_grandes: Array<{ nom: string; arrondissement: string; superficie_m2: string }>;
    plus_petites: Array<{ nom: string; arrondissement: string; superficie_m2: string }>;
  } | undefined;
  if (!raw) return null;

  const data = [
    ...raw.plus_grandes.map((r) => ({
      nom: r.nom.length > 20 ? r.nom.slice(0, 18) + "…" : r.nom,
      m2: parseFloat(r.superficie_m2),
      type: "grande",
    })),
  ];

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={tick(th)} unit=" m²" />
        <YAxis type="category" dataKey="nom" width={140} tick={{ ...tick(th, 10), fill: th.textSoft }} />
        <Tooltip contentStyle={tip} formatter={(v) => [`${v} m²`]} />
        <Bar dataKey="m2" radius={[0, 4, 4, 0]} fill={AMBER} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* 6. Donut — Sources d'enrichissement */
function EnrichissementDonut({ slug }: { slug: string }) {
  useTheme(); // needed for theme-aware tooltip
  const tip = useTip();
  const raw = loadData(slug, "enrichissement.json") as {
    total: number; google_places: number; osm: number; sirene: number;
  } | undefined;
  if (!raw) return null;

  const data = [
    { name: "OpenStreetMap", value: raw.osm },
    { name: "SIRENE", value: raw.sirene },
    { name: "Google Places", value: raw.google_places },
  ];
  const COLORS = [GREEN, BLUE, AMBER];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}
          dataKey="value" label={({ name, value }) => `${name} (${value})`}
          style={{ fontFamily: F, fontSize: 11 }}>
          {data.map((_, idx) => <Cell key={idx} fill={COLORS[idx]} />)}
        </Pie>
        <Tooltip contentStyle={tip} formatter={(v) => [`${v} terrasses enrichies`]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/* 7. Area — Ensoleillement par heure */
function EnsoleillementParHeure({ slug }: { slug: string }) {
  const { th } = useTheme();
  const tip = useTip();
  const raw = loadData(slug, "ensoleillement_par_heure.json") as Array<{
    heure: number; au_soleil: number; a_l_ombre: number; pct_soleil: string;
  }> | undefined;
  if (!raw) return null;

  const data = raw.filter((r) => r.heure >= 7 && r.heure <= 19).map((r) => ({
    heure: `${r.heure}h`,
    "Au soleil": r.au_soleil,
    "À l'ombre": r.a_l_ombre,
    pct: parseFloat(r.pct_soleil),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis dataKey="heure" tick={tick(th)} />
        <YAxis tick={tick(th)} />
        <Tooltip contentStyle={tip} formatter={(v, name) => [`${Number(v).toLocaleString("fr-FR")} terrasses`, name as string]} />
        <Legend wrapperStyle={{ fontFamily: F, fontSize: 12 }} />
        <Area type="monotone" dataKey="Au soleil" stackId="1" stroke={AMBER} fill={AMBER} fillOpacity={0.6} />
        <Area type="monotone" dataKey="À l'ombre" stackId="1" stroke={BLUE} fill={BLUE} fillOpacity={0.3} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* 8. Bar — Soleil par arrondissement */
function SoleilParArrondissement({ slug }: { slug: string }) {
  const { th } = useTheme();
  const tip = useTip();
  const raw = loadData(slug, "soleil_par_arrondissement.json") as Array<{
    arrondissement: string; pct_moyen_soleil: string; nb_terrasses: number;
  }> | undefined;
  if (!raw) return null;

  const data = raw.map((r) => ({
    arr: r.arrondissement.replace("75", "").replace(/^0/, "") + "e",
    pct: parseFloat(r.pct_moyen_soleil),
    nb: r.nb_terrasses,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={tick(th)} unit="%" domain={[0, 35]} />
        <YAxis type="category" dataKey="arr" width={36} tick={{ ...tick(th, 10), fill: th.textSoft }} />
        <Tooltip contentStyle={tip} formatter={(v, _n, p) => [`${v}% (${p.payload.nb} terrasses)`]} />
        <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
          {data.map((d, idx) => (
            <Cell key={idx} fill={d.pct >= 25 ? AMBER : d.pct >= 20 ? "#FBBF24" : BLUE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* 9. Bar — Top 10 ensoleillées */
function Top10Ensoleillees({ slug }: { slug: string }) {
  const { th } = useTheme();
  const tip = useTip();
  const raw = loadData(slug, "top10_ensoleillees.json") as Array<{
    nom: string; arrondissement: string | null; heures_soleil: number; pct_soleil: string;
  }> | undefined;
  if (!raw) return null;

  const data = raw.map((r) => ({
    nom: r.nom.length > 20 ? r.nom.slice(0, 18) + "…" : r.nom,
    heures: r.heures_soleil,
    pct: parseFloat(r.pct_soleil),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={tick(th)} unit="h" domain={[0, 15]} />
        <YAxis type="category" dataKey="nom" width={140} tick={{ ...tick(th, 10), fill: th.textSoft }} />
        <Tooltip contentStyle={tip} formatter={(v, _n, p) => [`${v}h (${p.payload.pct}%)`]} />
        <Bar dataKey="heures" radius={[0, 4, 4, 0]} fill={AMBER} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* 10. Bar — Top 10 ombragées */
function Top10Ombragees({ slug }: { slug: string }) {
  const { th } = useTheme();
  const tip = useTip();
  const raw = loadData(slug, "top10_ombragees.json") as Array<{
    nom: string; arrondissement: string | null; heures_soleil: number; heures_ombre: number; pct_ombre: string;
  }> | undefined;
  if (!raw) return null;

  const data = raw.map((r) => ({
    nom: r.nom.length > 20 ? r.nom.slice(0, 18) + "…" : r.nom,
    heures: r.heures_ombre,
    pct: parseFloat(r.pct_ombre),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={tick(th)} unit="h" domain={[0, 15]} />
        <YAxis type="category" dataKey="nom" width={140} tick={{ ...tick(th, 10), fill: th.textSoft }} />
        <Tooltip contentStyle={tip} formatter={(v, _n, p) => [`${v}h d'ombre (${p.payload.pct}%)`]} />
        <Bar dataKey="heures" radius={[0, 4, 4, 0]} fill={BLUE} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---- registry ---- */

const CHARTS: Record<string, React.FC<{ slug: string }>> = {
  // Tour Triangle
  "tour-triangle-top10": TourTriangleTop10,
  "tour-triangle-donut": TourTriangleDonut,
  "tour-triangle-shadow-length": TourTriangleShadow,
  // Paris en terrasses — les chiffres
  "chiffres-categories": CategoriesDonut,
  "chiffres-arrondissements": ParArrondissement,
  "chiffres-top-rues": TopRuesConcentration,
  "chiffres-superficies": DistributionSuperficies,
  "chiffres-extremes": ExtremesSuperficie,
  "chiffres-enrichissement": EnrichissementDonut,
  "chiffres-ensoleillement-heure": EnsoleillementParHeure,
  "chiffres-soleil-arrondissement": SoleilParArrondissement,
  "chiffres-top10-soleil": Top10Ensoleillees,
  "chiffres-top10-ombre": Top10Ombragees,
};

export default function BlogChart({ chartId, slug }: ChartProps) {
  const { th } = useTheme();
  const Chart = CHARTS[chartId];
  if (!Chart) return null;

  return (
    <div style={{ margin: "8px 0", padding: 16, background: th.bgCard, borderRadius: 12, border: `1px solid ${th.border}` }}>
      <Chart slug={slug} />
    </div>
  );
}
