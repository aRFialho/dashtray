import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const liveModePath = path.join(root, "client", "components", "LiveMode.tsx");
const stylesPath = path.join(root, "client", "styles.css");
const componentPath = path.join(root, "client", "components", "LiveCoachMascot.tsx");
const packagePath = path.join(root, "package.json");
const mascotDir = path.join(root, "client", "public", "mascot");

function fail(message) {
  console.error(`\n[Live Coach v1.6.1] ${message}\n`);
  process.exit(1);
}

function isPng(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const header = fs.readFileSync(filePath).subarray(0, 8);
  return header.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

if (!fs.existsSync(liveModePath)) fail(`Arquivo não encontrado: ${liveModePath}`);
if (!fs.existsSync(stylesPath)) fail(`Arquivo não encontrado: ${stylesPath}`);
if (!fs.existsSync(componentPath)) fail(`Componente não encontrado: ${componentPath}`);

const backupDir = path.join(root, ".live-coach-v1.6.1-backup");
fs.mkdirSync(backupDir, { recursive: true });
fs.copyFileSync(liveModePath, path.join(backupDir, "LiveMode.tsx"));
fs.copyFileSync(stylesPath, path.join(backupDir, "styles.css"));

let liveMode = fs.readFileSync(liveModePath, "utf8");

if (!liveMode.includes('from "./LiveCoachMascot"') && !liveMode.includes("from './LiveCoachMascot'")) {
  const imports = [...liveMode.matchAll(/^import .*;$/gm)];
  if (!imports.length) fail("Não foi possível localizar os imports em LiveMode.tsx.");
  const lastImport = imports.at(-1);
  const insertAt = lastImport.index + lastImport[0].length;
  liveMode = `${liveMode.slice(0, insertAt)}\nimport { LiveCoachMascot } from "./LiveCoachMascot";${liveMode.slice(insertAt)}`;
}

if (!liveMode.includes("<LiveCoachMascot")) {
  const patterns = [
    /\n\s*<\/main>\s*\n\s*\);\s*\n}\s*$/,
    /\n\s*<\/section>\s*\n\s*\);\s*\n}\s*$/,
    /\n\s*<\/div>\s*\n\s*\);\s*\n}\s*$/
  ];
  let match = null;
  for (const pattern of patterns) {
    match = liveMode.match(pattern);
    if (match) break;
  }
  if (!match || match.index === undefined) fail("Não foi possível localizar o final do JSX em LiveMode.tsx.");
  const closingTagIndex = match.index + match[0].indexOf("</");
  liveMode = `${liveMode.slice(0, closingTagIndex)}\n      <LiveCoachMascot data={data} increment={increment} />\n    ${liveMode.slice(closingTagIndex)}`;
}

fs.writeFileSync(liveModePath, liveMode, "utf8");

const cssMarker = "/* LIVE COACH HOTFIX V1.6.1 */";
let styles = fs.readFileSync(stylesPath, "utf8");
if (!styles.includes(cssMarker)) {
  styles += `\n\n${cssMarker}\n.live-coach__image-warning{display:flex;width:clamp(130px,15vw,230px);min-height:170px;align-items:center;justify-content:center;flex-direction:column;gap:5px;padding:18px;border:1px dashed rgba(255,255,255,.35);border-radius:22px;background:rgba(12,20,35,.82);color:#fff;text-align:center}.live-coach__image-warning strong{font-size:18px}.live-coach__image-warning span{font-size:12px;opacity:.72}\n`;
  fs.writeFileSync(stylesPath, styles, "utf8");
}

fs.mkdirSync(mascotDir, { recursive: true });
const gifPath = path.join(mascotDir, "drossi-live.gif");
const pngPath = path.join(mascotDir, "drossi-live.png");
const downloadGif = path.join(mascotDir, "download.gif");

if (isPng(gifPath)) {
  fs.copyFileSync(gifPath, pngPath);
  console.log("✓ O arquivo drossi-live.gif continha PNG e foi corrigido para drossi-live.png.");
} else if (!fs.existsSync(pngPath) && isPng(downloadGif)) {
  fs.copyFileSync(downloadGif, pngPath);
  console.log("✓ download.gif continha PNG e foi copiado como drossi-live.png.");
}

if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  packageJson.version = "1.6.1";
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

console.log("\n✓ Hotfix Live Coach v1.6.1 aplicado.");
console.log("✓ O componente tenta GIF, PNG e nomes alternativos automaticamente.");
console.log("✓ A personagem não desaparece silenciosamente quando uma imagem falha.");
console.log("✓ Execute npm run build e publique novamente no Render.\n");
