/**
 * Post-processing for extracted compendium data.
 *
 * - Druid becomes a Feature item (an extension of the Cleric), not a Class.
 * - Equipment is cleaned of table fragments and tagged with a sheet group.
 *
 * Usage: node tools/normalize-compendia.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
await writeJson("classes.json", classes);

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
await writeJson("equipment.json", equipment);

console.log(`Normalized ${classes.length} classes and ${equipment.length} equipment documents.`);
