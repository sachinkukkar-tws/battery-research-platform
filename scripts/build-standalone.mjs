// Builds a single self-contained HTML file (JS and CSS inlined), like the original prototype.
// Usage: npm run build:standalone. Uses the memory router. The file has no data of its own:
// like the website, it loads everything from the Amplifi proxy at VITE_AMPLIFI_PROXY_URL.
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

execSync("npx vite build --outDir dist-standalone --emptyOutDir", {
  stdio: "inherit",
  env: { ...process.env, VITE_ROUTER_MODE: "memory" },
});

const dir = "dist-standalone";
const assets = join(dir, "assets");
let html = readFileSync(join(dir, "index.html"), "utf8");
for (const file of readdirSync(assets)) {
  const content = readFileSync(join(assets, file), "utf8");
  if (file.endsWith(".js")) {
    html = html.replace(new RegExp(`<script type="module" crossorigin src="/assets/${file}"></script>`), () => `<script type="module">${content}</script>`);
  } else if (file.endsWith(".css")) {
    html = html.replace(new RegExp(`<link rel="stylesheet" crossorigin href="/assets/${file}">`), () => `<style>${content}</style>`);
  }
}
const favicon = readFileSync("public/favicon.svg", "utf8");
html = html.replace('href="/favicon.svg"', () => `href="data:image/svg+xml,${encodeURIComponent(favicon)}"`);
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "battery-research-platform.html"), html);
console.log(`Wrote ${dir}/battery-research-platform.html`);
