import { useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
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

/* ---- chart configs ---- */

export interface BlogChartBlock {
  type: "chart";
  chartId: string;   // unique identifier for each chart
  caption?: string;
}

interface ChartProps {
  chartId: string;
  slug: string;
}

/* Palette that works on both sun/shade themes */
const WINTER_COLOR = "#3B82F6"; // blue
const SUMMER_COLOR = "#F59E0B"; // amber

function Top10Bar({ slug }: { slug: string }) {
  const { th } = useTheme();
  const raw = loadData(slug, "top10_perdantes.json") as Array<{
    nom: string; heures_perdues: number; impact_hiver: number; impact_ete: number;
  }> | undefined;
  if (!raw) return null;

  const data = raw.map((d) => ({
    nom: d.nom.length > 18 ? d.nom.slice(0, 16) + "…" : d.nom,
    Hiver: d.impact_hiver,
    "Été": d.impact_ete,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" tick={{ fontFamily: F, fontSize: 11, fill: th.textMuted }} unit="h" />
        <YAxis type="category" dataKey="nom" width={120} tick={{ fontFamily: F, fontSize: 11, fill: th.textSoft }} />
        <Tooltip
          contentStyle={{ fontFamily: F, fontSize: 12, background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 8 }}
          formatter={(v, name) => [`${v}h`, name as string]}
        />
        <Legend wrapperStyle={{ fontFamily: F, fontSize: 12 }} />
        <Bar dataKey="Hiver" stackId="a" fill={WINTER_COLOR} radius={[0, 0, 0, 0]} />
        <Bar dataKey="Été" stackId="a" fill={SUMMER_COLOR} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ImpactDonut({ slug }: { slug: string }) {
  const { th } = useTheme();
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
        <Pie
          data={data}
          cx="50%" cy="50%"
          innerRadius={60} outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          label={({ name, value }) => `${name} (${value})`}
          style={{ fontFamily: F, fontSize: 12 }}
        >
          {data.map((_, idx) => <Cell key={idx} fill={COLORS[idx]} />)}
        </Pie>
        <Tooltip
          contentStyle={{ fontFamily: F, fontSize: 12, background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 8 }}
          formatter={(v) => [`${v} terrasses`]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function ShadowLength({ slug }: { slug: string }) {
  const { th } = useTheme();

  /* Data from the GeoJSON properties — hardcoded since it's a single static dataset */
  const dataRaw = loadData(slug, "tour_triangle_shadow.json") as {
    features: Array<{ properties: { label: string; longueur_ombre_m: number; nb_terrasses_dans_ombre: number } }>;
  } | undefined;

  const data = useMemo(() => {
    if (!dataRaw) return [];
    return dataRaw.features.map((f) => ({
      moment: f.properties.label,
      "Longueur (m)": f.properties.longueur_ombre_m,
      terrasses: f.properties.nb_terrasses_dans_ombre,
    }));
  }, [dataRaw]);

  if (!data.length) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis dataKey="moment" tick={{ fontFamily: F, fontSize: 10, fill: th.textMuted }} interval={0} angle={-15} textAnchor="end" height={60} />
        <YAxis tick={{ fontFamily: F, fontSize: 11, fill: th.textMuted }} unit="m" />
        <Tooltip
          contentStyle={{ fontFamily: F, fontSize: 12, background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 8 }}
          formatter={(v) => [`${v}m`]}
        />
        <Bar dataKey="Longueur (m)" radius={[4, 4, 0, 0]}>
          {data.map((d, idx) => (
            <Cell key={idx} fill={d.moment.includes("été") ? SUMMER_COLOR : d.moment.includes("printemps") ? "#10B981" : WINTER_COLOR} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ---- registry ---- */

const CHARTS: Record<string, React.FC<{ slug: string }>> = {
  "tour-triangle-top10": Top10Bar,
  "tour-triangle-donut": ImpactDonut,
  "tour-triangle-shadow-length": ShadowLength,
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
