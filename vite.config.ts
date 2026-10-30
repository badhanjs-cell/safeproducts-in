import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

function safeProductsVercelOutputPlugin() {
  return {
    name: "safeproducts-vercel-static-output",
    closeBundle() {
      const distDir = resolve("dist");
      const standaloneHtmlPath = resolve("public/app-standalone.html");

      mkdirSync(distDir, { recursive: true });
      if (existsSync(standaloneHtmlPath)) {
        const html = readFileSync(standaloneHtmlPath, "utf8");
        writeFileSync(resolve(distDir, "index.html"), html, "utf8");
      }

      const outDir = resolve(".vercel/output");
      const staticDir = resolve(outDir, "static");
      rmSync(outDir, { recursive: true, force: true });
      mkdirSync(staticDir, { recursive: true });
      cpSync(distDir, staticDir, { recursive: true });

      const config = {
        version: 3,
        routes: [
          { handle: "filesystem" },
          { src: "/(.*)", dest: "/index.html" },
        ],
      };
      writeFileSync(resolve(outDir, "config.json"), JSON.stringify(config, null, 2), "utf8");
      console.log("✓ SafeProducts standalone production bundle written to dist/ and .vercel/output/static/");
    },
  };
}

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    react(),
    safeProductsVercelOutputPlugin(),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
