/**
 * Extract equipment tables from the OCR'd Rules Cyclopedia markdown.
 * Writes data/equipment.json (Foundry Item documents of type weapon/armor/equipment).
 *
 * Usage: node tools/extract-equipment.mjs [path-to-markdown]
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { flatten, stripPictureText, toNumber } from "./normalize.mjs";
import { ocrInput } from "./ocr-input.mjs";
import { BASIC_WEAPONS } from "./mastery-data.mjs";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));
const input = ocrInput();

const RANGES = {
  armor: [6217, 6227],
  gear: [6369, 6412],
  transport: [6475, 6806]
};

function splitCell(cell) {
  return flatten(cell)
    .replace(/`/g, "")
    .split(/<br\s*\/?>/i)
    .map((v) => v.trim())
    .filter(Boolean);
}

function parseRow(line) {
  if (!/^\s*\|/.test(line)) return null;
  const cells = line.split("|").slice(1, -1).map(splitCell);
  if (!cells.length || !cells[0].length) return null;
  return cells;
}

function valueAt(cells, index, fallback = "") {
  const cell = cells[index] ?? [];
  return cell[0] ?? fallback;
}

function makeItem({ name, type, system, notes }) {
  const clean = flatten(name)
    .replace(/^[,.\s]+/, "")
    .replace(/\*+$/, "")
    .trim();
  if (!clean || clean.includes("**") || /^(item|see|ammunition|notes|cost|total|type)$/i.test(clean)) return null;
  return {
    name: clean,
    type,
    flags: { becmi: { source: "Rules Cyclopedia", notes: notes ?? "" } },
    system: {
      description: system.description ?? "",
      source: "Rules Cyclopedia",
      page: 0,
      notes: notes ?? "",
      ...system
    }
  };
}

/**
 * The OCR split and merged several weapon rows ("Dagger, Normal" became
 * "Normal"; "Blowgun, 2'+" and "Bola" became one entry). Use the curated
 * Weapons Table transcription so regeneration is deterministic and clean.
 */
function curatedWeapons() {
  return BASIC_WEAPONS.map(([name, damage, range, cost, enc, notes]) => makeItem({
    name,
    type: "weapon",
    notes,
    system: {
      damage,
      range: toNumber(String(range).split("/")[0], 0),
      ranges: range,
      cost,
      weight: toNumber(enc, 0),
      weaponType: /\bm\b/.test(notes) ? "missile" : "melee",
      hands: /2H/.test(notes) ? 2 : 1,
      rate: 1,
      attackBonus: 0,
      damageBonus: 0,
      magicBonus: 0,
      attackAbility: /\bm\b/.test(notes) ? "dex" : "str",
      description: notes
    }
  })).filter(Boolean);
}

function parseArmor(lines) {
  const items = [];
  for (const line of lines) {
    const cells = parseRow(line);
    if (!cells || cells.length < 4) continue;
    const ac = toNumber(valueAt(cells, 0), null);
    const name = valueAt(cells, 1);
    if (ac === null || !name) continue;
    const item = makeItem({
      name,
      type: "armor",
      notes: valueAt(cells, 4),
      system: {
        ac,
        cost: valueAt(cells, 2),
        weight: toNumber(valueAt(cells, 3), 0),
        armorType: name,
        description: valueAt(cells, 4)
      }
    });
    if (item) items.push(item);
  }
  return items;
}

function parseGeneric(lines, label) {
  const items = [];
  for (const line of lines) {
    const cells = parseRow(line);
    if (!cells || cells.length < 2) continue;
    const name = valueAt(cells, 0);
    if (!name || /^(item|description|type|movement|animal|vehicle)$/i.test(name)) continue;
    const joined = cells.map((c) => c.join(" ")).join(" ");
    const costMatch = joined.match(/(\d+(?:\.\d+)?)\s*(gp|sp|ep|cp|pp)\b/i);
    const item = makeItem({
      name,
      type: "equipment",
      notes: label,
      system: {
        cost: costMatch ? `${costMatch[1]} ${costMatch[2]}` : "",
        weight: toNumber(valueAt(cells, cells.length - 1), 0),
        quantity: 1,
        description: cells.slice(1).map((c) => c.join(" ")).join(" — ").slice(0, 400)
      }
    });
    if (item) items.push(item);
  }
  return items;
}

function main() {
  const lines = require("node:fs").readFileSync(input, "utf8").split(/\r?\n/);
  const slice = ([from, to]) => stripPictureText(lines.slice(from - 1, to).join("\n")).split(/\r?\n/);
  const items = [
    ...curatedWeapons(),
    ...parseArmor(slice(RANGES.armor)),
    ...parseGeneric(slice(RANGES.gear), "Adventuring gear"),
    ...parseGeneric(slice(RANGES.transport), "Transportation / siege equipment")
  ];
  const unique = new Map();
  for (const item of items) if (!unique.has(item.name.toLowerCase())) unique.set(item.name.toLowerCase(), item);
  return [...unique.values()];
}

const equipment = main();
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/equipment.json", import.meta.url), JSON.stringify(equipment, null, 2));
console.log(`Extracted ${equipment.length} equipment entries.`);
console.log(equipment.slice(0, 8).map((e) => `${e.name} [${e.type}]: ${e.system.damage ?? e.system.ac ?? e.system.cost}`).join("\n"));
