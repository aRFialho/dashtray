import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const liveModePath = path.join(root, "client", "components", "LiveMode.tsx");
const stylesPath = path.join(root, "client", "styles.css");
const componentSource = path.join(root, "client", "components", "LiveCoachMascot.tsx");
const packagePath = path.join(root, "package.json");

function fail(message) {
  console.error(`\n[Live Coach v1.6] ${message}\n`);
  process.exit(1);
}

if (!fs.existsSync(liveModePath)) fail(`Arquivo não encontrado: ${liveModePath}`);
if (!fs.existsSync(stylesPath)) fail(`Arquivo não encontrado: ${stylesPath}`);
if (!fs.existsSync(componentSource)) fail(`Componente não encontrado: ${componentSource}`);

const backupDir = path.join(root, ".live-coach-v1.6-backup");
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
  const returnEndPatterns = [
    /\n\s*<\/main>\s*\n\s*\);\s*\n}\s*$/,
    /\n\s*<\/section>\s*\n\s*\);\s*\n}\s*$/,
    /\n\s*<\/div>\s*\n\s*\);\s*\n}\s*$/
  ];

  let match = null;
  for (const pattern of returnEndPatterns) {
    match = liveMode.match(pattern);
    if (match) break;
  }
  if (!match || match.index === undefined) {
    fail("Não foi possível localizar o final do JSX em LiveMode.tsx. O backup foi preservado.");
  }

  const closingTagIndex = match.index + match[0].indexOf("</");
  const coachMarkup = "\n      <LiveCoachMascot data={data} increment={increment} />\n    ";
  liveMode = `${liveMode.slice(0, closingTagIndex)}${coachMarkup}${liveMode.slice(closingTagIndex)}`;
}

fs.writeFileSync(liveModePath, liveMode, "utf8");

const cssMarker = "/* LIVE COACH V1.6 */";
let styles = fs.readFileSync(stylesPath, "utf8");
if (!styles.includes(cssMarker)) {
  styles += `\n\n${cssMarker}\n.live-coach{position:fixed;right:clamp(14px,2.2vw,34px);bottom:clamp(14px,2.2vw,30px);z-index:80;display:flex;align-items:flex-end;gap:14px;pointer-events:none;filter:drop-shadow(0 20px 34px rgba(0,0,0,.34))}.live-coach__character{position:relative;flex:0 0 auto}.live-coach__character img{display:block;width:clamp(130px,15vw,230px);max-height:34vh;object-fit:contain;user-select:none}.live-coach__bubble{position:relative;max-width:min(340px,30vw);min-width:190px;margin-bottom:clamp(48px,7vh,90px);padding:15px 18px;border:1px solid rgba(255,255,255,.54);border-radius:20px 20px 6px 20px;background:rgba(255,255,255,.96);color:#101827;font-size:clamp(14px,1.05vw,18px);font-weight:800;line-height:1.35;box-shadow:0 18px 48px rgba(0,0,0,.26);animation:liveCoachBubbleIn .45s cubic-bezier(.2,.9,.25,1.2)}.live-coach__bubble::after{content:"";position:absolute;right:-9px;bottom:16px;width:20px;height:20px;background:inherit;border-right:1px solid rgba(255,255,255,.54);border-top:1px solid rgba(255,255,255,.54);transform:rotate(45deg);border-radius:3px}.live-coach__increment{position:absolute;left:50%;top:4%;z-index:3;color:#55f2ae;font-size:clamp(30px,4vw,64px);font-weight:950;letter-spacing:-.06em;text-shadow:0 5px 24px rgba(35,255,165,.56),0 2px 6px rgba(0,0,0,.55);animation:liveCoachIncrement 2.15s ease-out both}.live-coach--reacting .live-coach__character{animation:liveCoachReact .68s cubic-bezier(.2,.85,.25,1.35)}.live-coach--reacting .live-coach__bubble{border-color:rgba(82,240,177,.58);box-shadow:0 18px 52px rgba(31,230,154,.2)}@keyframes liveCoachBubbleIn{0%{opacity:0;transform:translateY(12px) scale(.94)}100%{opacity:1;transform:none}}@keyframes liveCoachIncrement{0%{opacity:0;transform:translate(-50%,35px) scale(.55)}20%{opacity:1;transform:translate(-50%,0) scale(1.14)}70%{opacity:1}100%{opacity:0;transform:translate(-50%,-105px) scale(1)}}@keyframes liveCoachReact{0%,100%{transform:none}35%{transform:translateY(-12px) rotate(-2deg) scale(1.04)}65%{transform:translateY(-5px) rotate(2deg)}}@media(max-width:900px){.live-coach{right:10px;bottom:10px;gap:7px}.live-coach__character img{width:clamp(105px,25vw,155px);max-height:25vh}.live-coach__bubble{max-width:52vw;min-width:0;margin-bottom:45px;padding:11px 13px;border-radius:16px 16px 5px 16px;font-size:12px}.live-coach__bubble::after{right:-7px;width:15px;height:15px}}@media(prefers-reduced-motion:reduce){.live-coach__bubble,.live-coach__increment,.live-coach--reacting .live-coach__character{animation:none}}\n`;
  fs.writeFileSync(stylesPath, styles, "utf8");
}

if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  packageJson.version = "1.6.0";
  fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8");
}

const mascotDir = path.join(root, "client", "public", "mascot");
fs.mkdirSync(mascotDir, { recursive: true });
const notePath = path.join(mascotDir, "COLOQUE-O-GIF-AQUI.txt");
if (!fs.existsSync(notePath)) {
  fs.writeFileSync(notePath, "Coloque o arquivo GIF nesta pasta com o nome: drossi-live.gif\n", "utf8");
}

console.log("\n✓ Live Coach v1.6 aplicado com sucesso.");
console.log("✓ Backup criado em .live-coach-v1.6-backup/");
console.log("✓ Coloque o GIF em client/public/mascot/drossi-live.gif");
console.log("✓ Execute npm run typecheck e npm run build antes do deploy.\n");
