/**
 * Post-processing for extracted compendium data.
 *
 * - Druid becomes a Feature item (an extension of the Cleric), not a Class.
 * - Equipment is cleaned of table fragments and tagged with a sheet group.
 * - Treasure is split into item and rule categories and tagged for its folder.
 * - Every compendium is stored in deterministic level/category/alphabetical order.
 *
 * Usage: node tools/normalize-compendia.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTreasureDocument, sortDocuments } from "./pack-layout.mjs";
import { normalizeMonsterDocument } from "./normalize-monsters.mjs";
import { mergeCuratedMonsterVariants } from "./monster-variant-stats.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const readJson = async (name) => JSON.parse(await readFile(join(root, "data", name), "utf8"));
const writeJson = (name, value) => writeFile(join(root, "data", name), JSON.stringify(value, null, 2) + "\n");

// --- Classes: Druid is a Cleric subclass, not a stand-alone class. ----------
const classes = await readJson("classes.json");
for (const doc of classes) {
  if (doc.name !== "Druid") continue;
  doc.type = "feature";
  doc.flags = {
    ...(doc.flags ?? {}),
    becmi: {
      ...(doc.flags?.becmi ?? {}),
      classExtension: "cleric",
      xpLevels: undefined
    }
  };
  delete doc.flags.becmi.xpLevels;
  doc.system = {
    description: "Druid is an extension of the Cleric class. Druids use the Cleric hit dice, saving throws and experience table, but choose spells from the Druid list.",
    source: "Rules Cyclopedia",
    page: doc.system?.page ?? 0,
    notes: "Cleric subclass — Druid spell list"
  };
}

// --- Equipment: remove table fragments and tag the sheet group. ------------
const junk = new Set([
  "---", "Adventuring Gear Table", "Sailing Vessels Table", "Rafts tt:",
  "Galleys:", "Sailing Ships:", "Draft", "Riding", "War", "Professional",
  "Built by PCs", "Troop Transport", "First-Class", "Second-Class",
  "Third-Class", "Large", "Small"
]);
const equipment = (await readJson("equipment.json")).filter((doc) => !junk.has(doc.name.trim()));
for (const doc of equipment) {
  if (doc.name === "Horse:") doc.name = "Horse";
  const group = doc.type === "weapon" ? "weapons"
    : doc.type === "armor" ? "armor"
      : doc.flags?.becmi?.notes === "Transportation / siege equipment" ? "transport"
        : "adventuring";
  doc.flags = {
    ...(doc.flags ?? {}),
    becmi: { ...(doc.flags?.becmi ?? {}), group }
  };
}

// --- Treasure: keep tangible items and procedural rules in separate folders.
const treasure = (await readJson("treasure.json")).map(normalizeTreasureDocument);

// --- Monsters: repair OCR stat blocks and assign Rules Cyclopedia folders.
const monsters = mergeCuratedMonsterVariants(
  (await readJson("monsters.json"))
    .map(normalizeMonsterDocument)
    .filter(Boolean)
);

const packs = {
  classes,
  equipment,
  treasure,
  spells: await readJson("spells.json"),
  monsters,
  tables: await readJson("tables.json"),
  journals: await readJson("journals.json")
};

for (const [name, docs] of Object.entries(packs)) {
  await writeJson(`${name}.json`, sortDocuments(name, docs));
}

console.log(`Normalized and sorted: ${Object.entries(packs).map(([name, docs]) => `${name} ${docs.length}`).join(", ")}.`);
