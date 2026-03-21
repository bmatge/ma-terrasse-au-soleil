import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

/** Inline small CSS files into the HTML to eliminate render-blocking requests. */
function cssInlinePlugin(): Plugin {
  return {
    name: "css-inline",
    enforce: "post",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        for (const [fileName, chunk] of Object.entries(ctx.bundle)) {
          if (chunk.type === "asset" && fileName.endsWith(".css") && !fileName.includes("maplibre")) {
            const css = typeof chunk.source === "string" ? chunk.source : new TextDecoder().decode(chunk.source);
            // Replace the <link> tag with an inline <style>
            html = html.replace(
              new RegExp(`<link[^>]+href="[^"]*${fileName.split("/").pop()}"[^>]*>`),
              `<style>${css}</style>`,
            );
            // Remove the CSS asset from the bundle so it's not emitted
            delete ctx.bundle[fileName];
          }
        }
        return html;
      },
    },
  };
}

export default defineConfig({
  build: {
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("maplibre-gl")) return "maplibre";
          if (id.includes("i18next") || id.includes("react-i18next")) return "i18n";
          if (id.includes("react-dom")) return "react-vendor";
          if (id.includes("react-router")) return "router";
          if (id.includes("@tanstack")) return "query";
        },
      },
    },
  },
  plugins: [
    react(),
    cssInlinePlugin(),
    VitePWA({
      registerType: "prompt",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /^\/tiles\//,
            handler: "CacheFirst",
            options: {
              cacheName: "tile-cache",
              expiration: { maxEntries: 500, maxAgeSeconds: 7 * 24 * 60 * 60 },
            },
          },
        ],
      },
      manifest: {
        name: "Au Soleil App",
        short_name: "AuSoleil",
        description: "Trouve une terrasse au soleil ou à l'ombre à Paris",
        icons: [
          { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
        ],
        theme_color: "#f59e0b",
        background_color: "#fffbf0",
        display: "standalone",
        start_url: "/",
        orientation: "portrait",
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
