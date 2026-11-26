/**
 * Extract magical treasure and build reference journals/tables.
 * Writes data/treasure.json, data/tables.json and data/journals.json.
 *
 * Usage: node tools/extract-extras.mjs [path-to-markdown]
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { flatten, stripPictureText, summary } from "./normalize.mjs";
import { ocrInput } from "./ocr-input.mjs";
import { EQUIPMENT_JOURNAL, MASTERY_JOURNAL } from "./mastery-data.mjs";
import { normalizeTreasureDocument } from "./pack-layout.mjs";
import { buildReferenceJournals } from "./reference-rules.mjs";
import { ENCOUNTER_TABLES, REACTION_TABLE } from "./encounter-tables.mjs";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));
const input = ocrInput();

const STOP = new Set([
  "Appearance", "Level of Effect", "Duration", "Dosage", "In Combat", "Multiple Potions",
  "Blending", "Note", "Notes", "Uses", "Charges", "Value", "Weight", "Communication",
  "Intelligence", "Ego", "Alignment", "Personality", "Purpose", "Special", "XP Value",
  "Hit Dice", "Armor Class", "Damage", "Saving Throw", "Curses", "Restrictions",
  "Creation", "Construction", "Cost", "Type", "General", "Powers", "Abilities"
]);

function treasureSection(lines) {
  const section = stripPictureText(lines.slice(19715, 21741).join("\n")).split(/\r?\n/);
  const items = [];
  let category = "Magical Item";
  for (const line of section) {
    const heading = line.match(/^#{3,6}\s*\*\*(.+?)\*\*\s*$/);
    if (heading) {
      const name = flatten(heading[1]).replace(/\*+$/, "").trim();
      if (/descriptions$|^potions$|^scrolls$|^rings$|^wands|^swords|^armor|^miscellaneous/i.test(name)) category = name;
      continue;
    }
    const bold = line.match(/^\*\*([^*]{2,60}):?\*\*\s*(.*)$/);
    if (!bold) continue;
    const name = flatten(bold[1]).replace(/:$/, "").trim();
    if (!name || STOP.has(name) || /^(level|hit|armor|treasure|no\.)/i.test(name)) continue;
    const text = flatten(bold[2]);
    if (text.length < 20) continue;
    items.push({
      name: name.replace(/^(potion|scroll|ring|wand|staff) of\s+/i, "").trim(),
      type: "equipment",
      flags: { becmi: { source: "Rules Cyclopedia", category } },
      system: {
        treasureType: category,
        value: 0,
        quantity: 1,
        cost: "",
        weight: 0,
        description: summary(text, 420),
        source: "Rules Cyclopedia",
        page: 0,
        notes: category
      }
    });
  }
  const unique = new Map();
  for (const item of items) if (!unique.has(item.name.toLowerCase())) unique.set(item.name.toLowerCase(), item);
  return [...unique.values()].map(normalizeTreasureDocument);
}

function tables() {
  // Chapter 7 encounters are genuinely random (1d20/1d8/1d12) and are kept as
  // RollTables. Castle/city procedures and static lookups stay in the journals.
  return [REACTION_TABLE, ...ENCOUNTER_TABLES];
}

function journals() {
  return [...buildReferenceJournals(MASTERY_JOURNAL), EQUIPMENT_JOURNAL];
}

const lines = require("node:fs").readFileSync(input, "utf8").split(/\r?\n/);
const output = {
  treasure: treasureSection(lines),
  tables: tables(),
  journals: journals()
};

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
for (const [name, docs] of Object.entries(output)) {
  await writeFile(new URL(`../data/${name}.json`, import.meta.url), JSON.stringify(docs, null, 2));
  console.log(`${name}: ${docs.length} entries`);
}
