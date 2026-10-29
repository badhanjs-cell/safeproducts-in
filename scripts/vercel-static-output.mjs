import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve("dist");
const outDir = resolve(".vercel/output");
const staticDir = resolve(outDir, "static");

if (!existsSync(distDir)) {
  console.error("Expected dist/ directory from vite build");
  process.exit(1);
}

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

writeFileSync(resolve(outDir, "config.json"), JSON.stringify(config, null, 2));
console.log("Generated .vercel/output static bundle successfully.");
