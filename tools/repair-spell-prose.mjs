/**
 * Replace spell descriptions with prose read from the PDF text layer.
 *
 * The legacy two-column OCR used by tools/extract-spells.mjs interleaves prose
 * from stacked headings, so descriptions can be swapped between spells. The
 * companion tools/extract-spell-prose.py reads pages 33-61 column by column
 * and emits a JSON map; this script applies only `description`, leaving names,
 * stats, ids and formulas in data/spells.json untouched.
 *
 * Usage: node tools/repair-spell-prose.mjs [prose-json]
 */
import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixDice, fixOnes } from "./normalize.mjs";
import { applySpellMathOverrides } from "./spell-math.mjs";

const root = new URL("..", import.meta.url);
const spellsFile = new URL("data/spells.json", root);
const proseFile = process.argv[2] ?? process.env.BECMI_SPELL_PROSE_OUT
  ?? join(tmpdir(), "becmi-spell-prose.json");
const normalize = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

// A few stat blocks wrap across blocks; trim the leading stat fragment when
// the extractor could not tell it apart from the opening sentence.
const trimTo = new Map([
  ["Permanence", "By means of this spell"],
  ["Maze", "This spell creates an indestructible maze"]
]);

const spells = JSON.parse(await readFile(spellsFile, "utf8"));
const prose = JSON.parse(await readFile(proseFile, "utf8"));
let changed = 0;
const missing = [];

for (const spell of spells) {
  const lists = spell.system?.spellLists ?? [];
  let record;
  for (const list of lists) {
    record = prose.byKey?.[`${list}|${normalize(spell.name)}`];
    if (record) break;
  }
  record ??= prose.byKey?.[`any|${normalize(spell.name)}`];
  if (!record?.description) {
    missing.push(spell.name);
    continue;
  }

  let description = record.description;
  const marker = trimTo.get(spell.name);
  if (marker) {
    const at = description.indexOf(marker);
    if (at > 0) description = description.slice(at);
  }
  description = fixDice(fixOnes(description)).replace(/\bllth\b/gi, "11th");
  spell.system.description = description;
  applySpellMathOverrides(spell);
  changed++;
}

if (missing.length) {
  throw new Error(`No PDF prose found for: ${missing.join(", ")}`);
}
await writeFile(spellsFile, JSON.stringify(spells, null, 2) + "\n");
console.log(`Repaired ${changed} spell descriptions from ${proseFile}`);
