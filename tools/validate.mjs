/**
 * Lightweight, Foundry-independent validation of the generated system data.
 *
 * Usage: node tools/validate.mjs
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  compareDocuments, folderDefinitionKey, folderId, spellFolderKey,
  SPELL_LIST_LEVELS, TABLE_CATEGORY_ORDER, TREASURE_CATEGORIES
} from "./pack-layout.mjs";
import { ENCOUNTER_TABLES, REACTION_TABLE } from "./encounter-tables.mjs";
import { SPELL_MATH_OVERRIDES } from "./spell-math.mjs";

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
const folderPackNames = (system.packFolders ?? []).flatMap((folder) => [
  ...(folder.packs ?? []), ...folderPackNamesFrom(folder.folders ?? [])
]);
function folderPackNamesFrom(folders) {
  return folders.flatMap((folder) => [
    ...(folder.packs ?? []), ...folderPackNamesFrom(folder.folders ?? [])
  ]);
}
for (const pack of system.packs ?? []) {
  if (!folderPackNames.includes(pack.name)) note(`system.json: pack ${pack.name} is not assigned to a pack folder`);
}
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
  if (/evaluate\(\{\s*async\s*:/.test(text)) {
    note(`${file}: Roll#evaluate({async}) was removed in Foundry v12+; use await roll.evaluate()`);
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

// --- OCR spell maths must keep their explicit dice formulas ----------------
const spellDocs = await readJson("data/spells.json");
for (const [name, override] of Object.entries(SPELL_MATH_OVERRIDES)) {
  const spell = spellDocs.find((doc) => String(doc.name).toLowerCase() === name);
  if (!spell) { note(`spells: missing ${name} for math validation`); continue; }
  if (spell.system?.rollFormula !== override.rollFormula) {
    note(`spells: ${name} should roll ${override.rollFormula}`);
  }
  for (const [field, value] of Object.entries(override.fields ?? {})) {
    if (spell.system?.[field] !== value) note(`spells: ${name} has an incorrect ${field}`);
  }
  for (const [from] of override.descriptionReplace ?? []) {
    if (String(spell.system?.description ?? "").includes(from)) {
      note(`spells: ${name} still contains OCR-damaged math "${from}"`);
    }
  }
  if (override.descriptionAppend && !String(spell.system?.description ?? "").includes(override.descriptionAppend)) {
    note(`spells: ${name} is missing its dice explanation`);
  }
}

// --- Rollable encounter tables --------------------------------------------
const tableDocs = await readJson("data/tables.json");
const expectedTables = [REACTION_TABLE, ...ENCOUNTER_TABLES];
if (tableDocs.length !== expectedTables.length) {
  note(`tables: expected ${expectedTables.length} RollTables, found ${tableDocs.length}`);
}
for (const expected of expectedTables) {
  const actual = tableDocs.find((doc) => doc.name === expected.name);
  if (!actual) { note(`tables: missing ${expected.name}`); continue; }
  if (actual.formula !== expected.formula) {
    note(`tables: ${expected.name} should roll ${expected.formula}, got ${actual.formula}`);
  }
  const category = actual.flags?.becmi?.category;
  if (!TABLE_CATEGORY_ORDER.includes(category)) {
    note(`tables: unknown category ${category} on ${expected.name}`);
  }
  const signature = (doc) => JSON.stringify(
    (doc.results ?? []).map((result) => [result.range, result.type, result.text])
  );
  if (signature(actual) !== signature(expected)) {
    note(`tables: ${expected.name} differs from the curated encounter data`);
  }
  const faces = new Set();
  for (const result of actual.results ?? []) {
    const [low, high] = result.range ?? [];
    if (!Number.isInteger(low) || !Number.isInteger(high) || low > high) {
      note(`tables: bad result range on ${expected.name}`);
      continue;
    }
    for (let face = low; face <= high; face++) {
      if (faces.has(face)) note(`tables: duplicate face ${face} on ${expected.name}`);
      faces.add(face);
    }
    if (result.type !== "text" || !result.text) {
      note(`tables: empty result on ${expected.name}`);
    }
  }
  const die = Number(expected.formula.match(/d(\d+)/)?.[1] ?? 0);
  const first = expected.formula === "2d6" ? 2 : 1;
  for (let face = first; face <= die; face++) {
    if (!faces.has(face)) note(`tables: face ${face} is missing from ${expected.name}`);
  }
}
const rollableJournalDocs = await readJson("data/journals.json");
const equipmentJournal = rollableJournalDocs.find((doc) => doc.name === "Equipment Tables");
if (equipmentJournal?.pages?.length !== 9) note("journals: Equipment Tables should have 9 text pages");
if (!rollableJournalDocs.find((doc) => doc.name === "Core Rules Reference")?.pages
  ?.some((page) => page.name === "Encounters and Reaction Rolls")) {
  note("journals: missing encounter and reaction reference page");
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

// --- Folder hierarchy and document ordering ---------------------------------
const folderDefinitions = await readJson("data/pack-folders.json");
for (const [pack, definitions] of Object.entries(folderDefinitions)) {
  const keys = new Set(definitions.map(folderDefinitionKey));
  for (const definition of definitions) {
    const key = folderDefinitionKey(definition);
    if (!/^[a-f0-9]{16}$/.test(folderId(pack, key))) note(`${pack}: invalid folder id for ${key}`);
    if (definition.parentKey && !keys.has(definition.parentKey)) {
      note(`${pack}: folder ${key} has unknown parent ${definition.parentKey}`);
    }
  }
}
const expectedSpellFolders = new Set();
for (const [list, levels] of Object.entries(SPELL_LIST_LEVELS)) {
  expectedSpellFolders.add(`spells:${list}`);
  for (const level of levels) expectedSpellFolders.add(spellFolderKey(list, level));
}
const actualSpellFolders = new Set(folderDefinitions.spells.map(folderDefinitionKey));
for (const key of expectedSpellFolders) {
  if (!actualSpellFolders.has(key)) note(`spells: missing level folder ${key}`);
}
for (const key of actualSpellFolders) {
  if (!expectedSpellFolders.has(key)) note(`spells: empty or unexpected folder ${key}`);
}
for (const doc of await readJson("data/spells.json")) {
  const key = spellFolderKey(doc.flags?.becmi?.list ?? doc.system?.spellLists?.[0], doc.system?.spellLevel);
  if (!actualSpellFolders.has(key)) note(`spells: ${doc.name} points to missing folder ${key}`);
}

const sortedPacks = ["monsters", "spells", "equipment", "classes", "treasure", "tables", "journals"];
for (const pack of sortedPacks) {
  let docs;
  try { docs = await readJson(`data/${pack}.json`); }
  catch { continue; }
  for (let i = 1; i < docs.length; i++) {
    if (compareDocuments(pack, docs[i - 1], docs[i]) > 0) {
      note(`${pack}: documents are not sorted at ${docs[i - 1].name} / ${docs[i].name}`);
      break;
    }
  }
}

// --- Treasure: items and rules must stay in separate categories -------------
const treasureDocs = await readJson("data/treasure.json");
const treasureFolders = new Map(Object.values(TREASURE_CATEGORIES).map((info) => [info.folder, info]));
for (const doc of treasureDocs) {
  const category = doc.flags?.becmi?.category;
  const info = treasureFolders.get(category);
  if (!info) { note(`treasure: unknown category ${category} on ${doc.name}`); continue; }
  const expectedType = info.rule ? "feature" : "equipment";
  if (doc.type !== expectedType) note(`treasure: ${doc.name} should be ${expectedType}, got ${doc.type}`);
  if (doc.flags?.becmi?.kind !== (info.rule ? "rule" : "item")) {
    note(`treasure: ${doc.name} has an inconsistent kind`);
  }
  if (doc.system?.treasureType !== category) note(`treasure: ${doc.name} has a mismatched treasureType`);
}

// --- Reference rules are reproduced in the journals ------------------------
const journalDocs = await readJson("data/journals.json");
const journalText = journalDocs.map((doc) => (doc.pages ?? []).map((page) => page.text?.content ?? "").join("")).join("");
if (/Full rules text is not reproduced here/i.test(journalText)) {
  note("journals: placeholder text about withheld rules is still present");
}
if (!journalText.includes("Attack Matrix") || !journalText.includes("Saving Throws")) {
  note("journals: core combat reference is missing");
}

// --- Dice rolls must work from sheets without a token -----------------------
const rollsSource = await readFile(join(root, "scripts/rolls.mjs"), "utf8");
if (!rollsSource.includes("DEFAULT_TARGET_AC")) note("rolls.mjs: missing default target AC fallback");
if (/actor\.name/.test(rollsSource)) note("rolls.mjs: unguarded actor.name breaks rolls without an actor");
const itemSheet = await readFile(join(root, "templates/item/body.hbs"), "utf8");
for (const action of ["rollAttack", "rollDamage", "rollFormula", "castSpell"]) {
  if (!itemSheet.includes(`data-action="${action}"`)) note(`item sheet: missing ${action} button`);
}
const actorBody = await readFile(join(root, "templates/actor/body.hbs"), "utf8");
if (!actorBody.includes("data-target-ac")) note("actor sheet: missing target AC input");
if (!actorBody.includes("becmi-saves-scroll")) note("actor sheet: saves table is missing its scroll container");
const css = await readFile(join(root, "styles/becmi.css"), "utf8");
if (!css.includes(".becmi-saves-scroll")) note("CSS: missing stable saves container styles");

// --- Automatic level-up, class abilities and scrolling ----------------------
const integrationsSource = await readFile(join(root, "scripts/integrations.mjs"), "utf8");
for (const token of [
  "export async function advanceActorLevels",
  "export function autoLevelFromXp",
  'Hooks.on("updateActor"',
  'getProperty(changed, "system.attributes.xp")',
  "new WeakSet()"
]) {
  if (!integrationsSource.includes(token)) note(`integrations.mjs: missing ${token}`);
}
const rulesSource = await readFile(join(root, "scripts/rules-rc.mjs"), "utf8");
for (const token of ["xpForNextLevel", "levelForXp", "normalizeClassKey"]) {
  if (!rulesSource.includes(token)) note(`rules-rc.mjs: missing ${token}`);
}

const classFeaturesSource = await readFile(join(root, "scripts/class-features.mjs"), "utf8");
for (const key of [
  "cleric", "druid", "fighter", "thief", "magic-user", "dwarf", "elf", "halfling", "mystic"
]) {
  if (!new RegExp(`^\\s*["']?${key.replace("-", "\\-")}["']?: \\[`, "m").test(classFeaturesSource)) {
    note(`class-features.mjs: missing ${key} abilities`);
  }
}
for (const ability of ["backstab", "infravision", "secretDoors", "druidRestrictions", "unarmed"]) {
  if (!classFeaturesSource.includes(ability)) note(`class-features.mjs: missing ${ability}`);
}
const sheetSource = await readFile(join(root, "scripts/sheets/actor-sheet.mjs"), "utf8");
if (!sheetSource.includes("advanceActorLevels")) note("actor sheet: level-up button does not use advanceActorLevels");
if (!sheetSource.includes("classFeaturesFor")) note("actor sheet: class abilities are not indexed");
if (!sheetSource.includes("context.classFeatures")) note("actor sheet: class abilities are not passed to the template");
for (const token of [
  "async _onDrop(event)", "async _onDropItem(event, item)", "getDragEventData",
  "fromCompendium", "importSpellToActor"
]) {
  if (!sheetSource.includes(token)) note(`actor sheet: missing spell drop support (${token})`);
}
if (!actorBody.includes("spellDropHint")) note("actor sheet: missing spell drop hint");
if (!actorBody.includes('data-tab="features"')) note("actor sheet: missing class abilities tab");
if (!actorBody.includes("becmi-feature-grid")) note("actor sheet: missing class ability grid");
if (!css.includes(".becmi-tab-panel.is-active")) note("CSS: tab panels cannot scroll");
if (!css.includes(".becmi-scroll-y")) note("CSS: reusable scroll container is missing");
if (!css.includes("overscroll-behavior: contain")) note("CSS: scroll containers do not contain overscroll");
const itemBody = await readFile(join(root, "templates/item/body.hbs"), "utf8");
if (!/^<div class="becmi-body">\s*<div class="becmi-scroll-y">/.test(itemBody)) {
  note("item sheet: the whole body is not inside one scroll container");
}
if (!css.includes(".becmi.sheet.item .becmi-body > .becmi-scroll-y")) {
  note("CSS: item body scroll container is not sized");
}

// --- Journals must cover every chapter, appendix and progression table ------
for (let chapter = 1; chapter <= 19; chapter++) {
  if (!journalDocs.some((doc) => doc.name.startsWith(`Chapter ${chapter}:`))) {
    note(`journals: missing Chapter ${chapter}`);
  }
}
for (let appendix = 1; appendix <= 4; appendix++) {
  if (!journalDocs.some((doc) => doc.name.startsWith(`Appendix ${appendix}:`))) {
    note(`journals: missing Appendix ${appendix}`);
  }
}
for (const phrase of [
  "The Planes of Existence", "Variant Rules", "AD&D Game Conversions",
  "extended table", "Ability scores and saving throws", "Nonlethal combat"
]) {
  if (!journalText.includes(phrase)) note(`journals: missing reference text ${phrase}`);
}

// --- Monsters are categorized, sanitized and free of raw stat tables --------
const monsterDocs = await readJson("data/monsters.json");
const monsterCategories = folderDefinitions.monsters
  .map((folder) => folderDefinitionKey(folder).replace(/^monsters:/, ""));
for (const doc of monsterDocs) {
  const category = doc.flags?.becmi?.category;
  if (!monsterCategories.includes(category)) note(`monsters: unknown category ${category} on ${doc.name}`);
  if (!doc.system?.description) note(`monsters: empty description on ${doc.name}`);
  if (!doc.system?.monsterType) note(`monsters: empty monster type on ${doc.name}`);
  if (doc.system?.morale < 2 || doc.system?.morale > 12) note(`monsters: morale out of range on ${doc.name}`);
  if (!(doc.system?.xpValue > 0)) note(`monsters: missing XP value on ${doc.name}`);
  if (/(?:Armor Class|Hit Dice|XP Value)\s*:/i.test(`${doc.system?.description} ${doc.system?.special}`)) {
    note(`monsters: raw stat table leaked into ${doc.name}`);
  }
}
if (monsterDocs.length < 150) note(`monsters: only ${monsterDocs.length} documents extracted`);

// --- Sheet interactions ----------------------------------------------------
for (const template of ["templates/actor/header.hbs", "templates/item/header.hbs"]) {
  const source = await readFile(join(root, template), "utf8");
  if (!source.includes('data-action="editImage"')) note(`${template}: missing the editImage action`);
}
if (!lang["BECMI.sheet.editImage"]) note("lang: missing BECMI.sheet.editImage");
if (!lang["BECMI.notification.dropInvalid"]) note("lang: missing BECMI.notification.dropInvalid");
const actorSheetSource = await readFile(join(root, "scripts/sheets/actor-sheet.mjs"), "utf8");
if (!actorSheetSource.includes("item.type !== \"spell\"") ||
    !actorSheetSource.includes("super._onDropItem(event, item)")) {
  note("actor-sheet: non-spell drops must use the standard Foundry handler");
}
if (actorSheetSource.includes("spellDropInvalid")) {
  note("actor-sheet: non-spell drops still show the obsolete rejection message");
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(` - ${p}`);
  process.exitCode = 1;
} else {
  console.log("\nValidation passed.");
}
