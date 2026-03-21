import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useTheme } from "../contexts/ThemeContext";
import Nav from "../components/Nav";
import BottomNav from "../components/BottomNav";
import { F } from "../lib/constants";

interface BlogPostBlock {
  type: "paragraph" | "heading" | "image";
  content: string;
  alt?: string;
  caption?: string;
}

interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  body: BlogPostBlock[];
}

const postModules = import.meta.glob<BlogPost>("../../../content/blog/*/index.json", { eager: true, import: "default" });

const mediaModules = import.meta.glob<string>("../../../content/blog/*/media/*", { eager: true, import: "default" });

function getPost(slug: string): BlogPost | undefined {
  return Object.values(postModules).find((p) => p.slug === slug);
}

function resolveMedia(slug: string, filename: string): string | undefined {
  const suffix = `/${slug}/media/${filename}`;
  for (const [path, url] of Object.entries(mediaModules)) {
    if (path.endsWith(suffix)) return url;
  }
  // Try matching just the filename across all post dirs
  for (const [path, url] of Object.entries(mediaModules)) {
    if (path.includes(`/media/${filename}`)) return url;
  }
  return undefined;
}

export default function BlogPostPage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const { th } = useTheme();
  const post = slug ? getPost(slug) : undefined;

  const wrap: React.CSSProperties = { minHeight: "100vh", background: th.bg, fontFamily: F, maxWidth: 860, margin: "0 auto", paddingBottom: 70 };

  if (!post) {
    return (
      <div style={wrap}>
        <Nav back title="Blog" onBack={() => navigate("/blog")} />
        <div style={{ padding: "60px 24px", textAlign: "center", color: th.textMuted, fontFamily: F }}>
          {t("blog.notFound")}
        </div>
        <BottomNav page="blog" navigate={(p) => navigate(p === "home" ? "/" : `/${p}`)} />
      </div>
    );
  }

  return (
    <div style={wrap}>
      <Nav back title="Blog" onBack={() => navigate("/blog")} />
      <article style={{ padding: "20px 24px 100px" }}>
        <header style={{ marginBottom: 24 }}>
          <h1 style={{ fontFamily: F, fontWeight: 700, fontSize: 22, color: th.text, lineHeight: 1.3, marginBottom: 8 }}>
            {post.title}
          </h1>
          <div style={{ fontFamily: F, fontSize: 12, color: th.textMuted }}>
            {new Date(post.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            {" · "}{post.author}
          </div>
          {post.tags.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              {post.tags.map((tag) => (
                <span key={tag} style={{
                  fontFamily: F, fontSize: 11, color: th.accent,
                  background: `${th.accent}18`, borderRadius: 20, padding: "2px 10px",
                }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {post.body.map((block, i) => {
            if (block.type === "heading") {
              return (
                <h2 key={i} style={{ fontFamily: F, fontWeight: 700, fontSize: 17, color: th.text, marginTop: 8 }}>
                  {block.content}
                </h2>
              );
            }
            if (block.type === "image") {
              const src = resolveMedia(post.slug, block.content);
              if (!src) return null;
              return (
                <figure key={i} style={{ margin: "8px 0" }}>
                  <img
                    src={src}
                    alt={block.alt || ""}
                    style={{ width: "100%", borderRadius: 10, display: "block" }}
                  />
                  {block.caption && (
                    <figcaption style={{ fontFamily: F, fontSize: 12, color: th.textMuted, textAlign: "center", marginTop: 6 }}>
                      {block.caption}
                    </figcaption>
                  )}
                </figure>
              );
            }
            return (
              <p key={i} style={{ fontFamily: F, fontSize: 14, color: th.textSoft, lineHeight: 1.7, margin: 0 }}>
                {block.content}
              </p>
            );
          })}
        </div>

        <div style={{ borderTop: `1px solid ${th.border}`, marginTop: 32, paddingTop: 16, textAlign: "center" }}>
          <button
            onClick={() => navigate("/blog")}
            style={{
              fontFamily: F, fontSize: 13, color: th.accent,
              background: "none", border: "none", cursor: "pointer",
            }}
          >
            {t("blog.backToList")}
          </button>
        </div>
      </article>
      <BottomNav page="blog" navigate={(p) => navigate(p === "home" ? "/" : `/${p}`)} />
    </div>
  );
}
