// Copies Font Awesome, Leaflet and fonts from node_modules into <www>/assets so the app works 100% offline.
// Usage: node build-assets.mjs [wwwDir]   (default: www)
import { cpSync, mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const WWW = process.argv[2] || "www";
const NM = "node_modules";
const OUT = join(WWW, "assets");
const need = (p) => { if (!existsSync(p)) { console.error(`Missing ${p} — run: npm install`); process.exit(1); } return p; };

// --- Font Awesome 6.5.1 (css + webfonts must stay side by side) ---
const fa = need(join(NM, "@fortawesome/fontawesome-free"));
mkdirSync(join(OUT, "vendor/fontawesome/css"), { recursive: true });
cpSync(join(fa, "css/all.min.css"), join(OUT, "vendor/fontawesome/css/all.min.css"));
cpSync(join(fa, "webfonts"), join(OUT, "vendor/fontawesome/webfonts"), { recursive: true });

// --- Leaflet 1.9.4 (css references ./images/*) ---
const lf = need(join(NM, "leaflet/dist"));
mkdirSync(join(OUT, "vendor/leaflet"), { recursive: true });
cpSync(join(lf, "leaflet.css"), join(OUT, "vendor/leaflet/leaflet.css"));
cpSync(join(lf, "leaflet.js"), join(OUT, "vendor/leaflet/leaflet.js"));
cpSync(join(lf, "images"), join(OUT, "vendor/leaflet/images"), { recursive: true });

// --- Fonts (latin subset only, via @fontsource) -> assets/fonts/fonts.css ---
const FONTS = [
  { pkg: "dm-sans", weights: [400, 500, 600, 700] },
  { pkg: "cormorant-garamond", weights: [400, 500, 600, 700] },
  { pkg: "caveat", weights: [600, 700] },
];
const fontsOut = join(OUT, "fonts");
mkdirSync(fontsOut, { recursive: true });
let css = "";
for (const { pkg, weights } of FONTS) {
  const base = need(join(NM, "@fontsource", pkg));
  const dest = join(fontsOut, pkg, "files");
  mkdirSync(dest, { recursive: true });
  for (const w of weights) {
    css += readFileSync(join(base, `latin-${w}.css`), "utf8").replaceAll("./files/", `./${pkg}/files/`) + "\n";
    for (const f of readdirSync(join(base, "files"))) {
      if (f.includes(`-latin-${w}-normal.`)) cpSync(join(base, "files", f), join(dest, f));
    }
  }
}
writeFileSync(join(fontsOut, "fonts.css"), css);
console.log(`Offline assets written to ${OUT}`);
