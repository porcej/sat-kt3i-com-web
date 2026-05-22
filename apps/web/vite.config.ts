import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** Writes dist/_redirects so /api/* is not rewritten to index.html when VITE_API_BASE is set. */
function productionRedirectsPlugin(env: Record<string, string>): Plugin {
  return {
    name: "sat-production-redirects",
    apply: "build",
    closeBundle() {
      const dist = path.join(dirname, "dist");
      const apiBase = env.VITE_API_BASE?.replace(/\/$/, "");
      const lines: string[] = [];
      if (apiBase) {
        lines.push(`/api/*  ${apiBase}/api/:splat  200`);
      }
      lines.push("/*  /index.html  200");
      fs.mkdirSync(dist, { recursive: true });
      fs.writeFileSync(path.join(dist, "_redirects"), `${lines.join("\n")}\n`);
      if (!apiBase) {
        console.warn(
          "\n[sat/web] VITE_API_BASE is unset. In production, /api/* may return the SPA HTML unless you:\n" +
            "  • Set VITE_API_BASE to your Worker URL in Cloudflare Pages build variables, or\n" +
            "  • Deploy the site with apps/web/wrangler.toml (SAT_API service binding to sat-api).\n"
        );
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, dirname, "");
  return {
  plugins: [react(), productionRedirectsPlugin(env)],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
      },
    },
  },
  };
});
