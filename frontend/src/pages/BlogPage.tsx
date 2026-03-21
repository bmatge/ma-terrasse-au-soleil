import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import Nav from "../components/Nav";
import BottomNav from "../components/BottomNav";
import { F } from "../lib/constants";

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
}

const postModules = import.meta.glob<BlogPost>("../content/blog/*/index.json", { eager: true, import: "default" });

function getPosts(): BlogPost[] {
  return Object.values(postModules).sort((a, b) => b.date.localeCompare(a.date));
}

export default function BlogPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { th } = useTheme();
  const posts = getPosts();

  const wrap: React.CSSProperties = { minHeight: "100vh", background: th.bg, fontFamily: F, maxWidth: 860, margin: "0 auto", paddingBottom: 70 };

  return (
    <div style={wrap}>
      <Nav back title={t("blog.title")} onBack={() => navigate(-1)} />
      <div style={{ padding: "20px 24px 100px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontFamily: F, fontWeight: 600, fontSize: 15, color: th.textSoft, marginTop: 8 }}>{t("blog.subtitle")}</div>
        </div>

        {posts.length === 0 && (
          <div style={{ textAlign: "center", color: th.textMuted, fontFamily: F, fontSize: 14, marginTop: 40 }}>
            {t("blog.empty")}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {posts.map((post) => (
            <button
              key={post.slug}
              onClick={() => navigate(`/blog/${post.slug}`)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                background: th.bgCard, border: `1px solid ${th.border}`, borderRadius: 12,
                padding: "16px 20px", cursor: "pointer",
                transition: "box-shadow 0.2s",
              }}
            >
              <div style={{ fontFamily: F, fontWeight: 700, fontSize: 16, color: th.text, marginBottom: 6 }}>
                {post.title}
              </div>
              <div style={{ fontFamily: F, fontSize: 13, color: th.textSoft, lineHeight: 1.5, marginBottom: 8 }}>
                {post.description}
              </div>
              <div style={{ fontFamily: F, fontSize: 11, color: th.textMuted }}>
                {new Date(post.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                {" · "}{post.author}
              </div>
            </button>
          ))}
        </div>
      </div>
      <BottomNav page="blog" navigate={(p) => navigate(p === "home" ? "/" : `/${p}`)} />
    </div>
  );
}
