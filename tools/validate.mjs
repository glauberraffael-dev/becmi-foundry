/**
 * Lightweight, Foundry-independent validation of the generated system data.
 *
 * Usage: node tools/validate.mjs
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const readJson = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
const problems = [];
const note = (msg) => problems.push(msg);

async function walk(dir) {
  const entries = await readdir(join(root, dir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await walk(rel));
    else if (/\.(mjs|hbs)$/.test(entry.name)) files.push(rel);
  }
  return files;
}

// --- Manifests and localization -------------------------------------------
const system = await readJson("system.json");
const lang = await readJson("lang/en.json");
if (system.compatibility?.minimum !== 13 || system.compatibility?.verified !== 14) {
  note("system.json compatibility should be minimum 13, verified 14");
}
if (!system.esmodules?.length) note("system.json has no esmodules entry");
// A versioned archive name prevents GitHub's raw cache from serving an old ZIP.
if (!system.download?.endsWith(`-${system.version}.zip`)) {
  note(`download must end with -${system.version}.zip to avoid stale caches`);
}
if (!system.manifest?.includes(`?v=${system.version}`)) {
  note(`manifest should include ?v=${system.version} to avoid stale caches`);
}
for (const pack of system.packs ?? []) {
  if (!pack.path.startsWith("packs/") || pack.path.includes(".db")) note(`Bad pack path: ${pack.path}`);
}

const files = [...await walk("scripts"), ...await walk("templates")];
const usedKeys = new Set();
for (const file of files) {
  const text = await readFile(join(root, file), "utf8");
  if (/new\s+fields\s*\(\)/.test(text)) {
    note(`${file}: use const f = fields(); new f.XField() instead of new fields()`);
  }
  for (const match of text.matchAll(/BECMI\.[A-Za-z][\w.]*/g)) {
    // Ignore prefixes of dynamically composed keys, e.g. BECMI.saves.${key}.
    if (!match[0].endsWith(".")) usedKeys.add(match[0]);
  }
}
for (const key of usedKeys) if (!(key in lang)) note(`Missing localization key: ${key}`);

// Foundry expands dotted keys into objects, so a key cannot be both a value
// and the parent of other keys (e.g. "a.b" and "a.b.c").
const langParents = new Set();
for (const key of Object.keys(lang)) {
  const parts = key.split(".");
  for (let i = 1; i < parts.length; i++) langParents.add(parts.slice(0, i).join("."));
}
for (const key of Object.keys(lang)) {
  if (langParents.has(key)) note(`Localization key is both a value and a namespace: ${key}`);
}

// --- ApplicationV2 template parts ------------------------------------------
// Each PARTS entry must render exactly one root HTML element.
const partTemplates = [
  "templates/actor/header.hbs",
  "templates/actor/body.hbs",
  "templates/item/header.hbs",
  "templates/item/body.hbs"
];
for (const file of partTemplates) {
  const raw = await readFile(join(root, file), "utf8");
  const text = raw
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\{\{!--[\s\S]*?--\}\}/g, "")
    .trim();
  const open = text.match(/^<([A-Za-z][\w-]*)\b/);
  const close = text.match(/<\/([A-Za-z][\w-]*)\s*>$/);
  if (!open || !close || open[1] !== close[1]) {
    note(`${file}: template part must render exactly one root HTML element`);
  }
}

// --- Extracted data --------------------------------------------------------
const expected = {
  monsters: (d) => typeof d.system?.ac === "number" && typeof d.system?.hp === "number" && typeof d.system?.hd === "string",
  spells: (d) => typeof d.system?.spellLevel === "number" && Array.isArray(d.system?.spellLists),
  equipment: (d) => ["weapon", "armor", "equipment"].includes(d.type),
  classes: (d) => d.type === "feature" || (d.system?.xpTable && typeof d.system.xpTable === "object"),
  treasure: (d) => typeof d.system?.treasureType === "string",
  tables: (d) => Array.isArray(d.results) && typeof d.formula === "string",
  journals: (d) => Array.isArray(d.pages)
};
for (const [pack, check] of Object.entries(expected)) {
  let docs;
  try { docs = await readJson(`data/${pack}.json`); }
  catch (err) { note(`Cannot read data/${pack}.json: ${err.message}`); continue; }
  if (!Array.isArray(docs)) { note(`data/${pack}.json is not an array`); continue; }
  const names = new Set();
  for (const doc of docs) {
    if (!doc.name) note(`${pack}: document without a name`);
    if (names.has(doc.name)) note(`${pack}: duplicate name ${doc.name}`);
    names.add(doc.name);
    if (!check(doc)) note(`${pack}: unexpected shape for ${doc.name}`);
  }
  console.log(`${pack}: ${docs.length} documents`);
}

// --- Compendium source files ----------------------------------------------
for (const pack of Object.keys(expected)) {
  const dir = `source/${pack}`;
  let names;
  try { names = (await readdir(join(root, dir))).filter((n) => n.endsWith(".json")); }
  catch (err) { note(`Cannot read ${dir}: ${err.message}`); continue; }
  const keys = new Set();
  for (const name of names) {
    const doc = await readJson(`${dir}/${name}`);
    if (!doc._id || !doc._key) note(`${pack}/${name}: missing _id or _key`);
    if (doc._key?.startsWith("!folders!") && !/^[A-Za-z0-9]{16}$/.test(doc._id)) {
      note(`${pack}/${name}: folder ID must be 16 alphanumeric characters`);
    }
    if (keys.has(doc._key)) note(`${pack}: duplicate key ${doc._key}`);
    keys.add(doc._key);
    for (const field of ["results", "pages"]) {
      for (const embedded of doc[field] ?? []) {
        if (!embedded._key?.startsWith(`!${doc._key.split("!")[1]}.${field}!`)) {
          note(`${pack}/${name}: bad ${field} key ${embedded._key}`);
        }
      }
    }
  }
  console.log(`${dir}: ${names.length} source documents`);
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(` - ${p}`);
  process.exitCode = 1;
} else {
  console.log("\nValidation passed.");
}
