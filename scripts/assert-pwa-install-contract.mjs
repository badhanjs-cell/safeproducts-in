import { readFileSync, existsSync } from "node:fs";

function read(path) {
  if (!existsSync(path)) throw new Error(`Missing required file: ${path}`);
  return readFileSync(path, "utf8");
}

function requireText(source, text, scope) {
  if (!source.includes(text)) throw new Error(`${scope}: missing ${text}`);
}

function forbidText(source, text, scope) {
  if (source.includes(text)) throw new Error(`${scope}: must not contain ${text}`);
}

const providerPath = "src/components/PwaInstallProvider.tsx";
const provider = read(providerPath);
const root = read("src/routes/__root.tsx");
const header = read("src/components/HeaderInstallShortcut.tsx");
const banner = read("src/components/PwaInstallBanner.tsx");
const section = read("src/components/PwaInstallSection.tsx");
const manifest = JSON.parse(read("public/manifest.json"));

requireText(provider, "beforeinstallprompt", "PWA provider");
requireText(provider, "appinstalled", "PWA provider");
requireText(provider, "sp_pwa_installed_v1", "PWA provider");
requireText(provider, "promptInFlight", "PWA provider");
requireText(root, "PwaInstallProvider", "Root layout");

for (const [scope, source] of [
  ["Header install shortcut", header],
  ["Install banner", banner],
  ["Install section", section],
]) {
  requireText(source, "usePwaInstall", scope);
  forbidText(source, 'addEventListener("beforeinstallprompt"', scope);
  forbidText(source, 'addEventListener("appinstalled"', scope);
}

const icons = manifest.icons ?? [];
const regular192 = icons.find((icon) => icon.src === "/safeproducts-app-192-v2.png" && icon.sizes === "192x192");
const regular512 = icons.find((icon) => icon.src === "/safeproducts-app-512-v2.png" && icon.sizes === "512x512");
const maskable512 = icons.find((icon) => icon.src === "/safeproducts-app-maskable-512-v2.png" && icon.sizes === "512x512" && String(icon.purpose ?? "").includes("maskable"));
if (!regular192 || !regular512 || !maskable512) {
  throw new Error("Manifest: missing versioned SafeProducts 192/512/maskable install icons");
}
for (const path of [
  "public/safeproducts-app-192-v2.png",
  "public/safeproducts-app-512-v2.png",
  "public/safeproducts-app-maskable-512-v2.png",
]) {
  if (!existsSync(path)) throw new Error(`Manifest icon asset missing: ${path}`);
}

requireText(root, '{ rel: "icon", href: "/safeproducts-app-192-v2.png"', "Root metadata");
requireText(root, '{ rel: "apple-touch-icon", href: "/safeproducts-app-192-v2.png"', "Root metadata");
requireText(header, 'src="/download-app-icon.png"', "Header install shortcut");
requireText(header, "Edit Actions", "Header iOS install recovery");
requireText(header, "Install on iPhone", "Header iOS install label");
requireText(banner, 'src="/download-app-icon.png"', "Install banner");

console.log("PWA install contract PASS");
