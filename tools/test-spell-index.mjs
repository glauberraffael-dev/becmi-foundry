/**
 * Foundry-independent checks for the spell index and reaction reference text.
 *
 * Usage: node tools/test-spell-index.mjs
 */
import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const normalize = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const rc = read("data/rc-tables.json");
const spells = read("data/spells.json");
const journals = read("data/journals.json");
const { REACTION_TABLE } = await import("./encounter-tables.mjs");

const expected = new Map();
for (const entry of rc.spells) {
  const name = normalize(entry.name);
  if (!expected.has(name)) expected.set(name, new Map());
  expected.get(name).set(entry.class, Number(entry.level));
}

const byName = new Map();
for (const spell of spells) {
  const name = normalize(spell.name);
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(spell);
}

for (const [name, levels] of expected) {
  const entries = byName.get(name) ?? [];
  if (!entries.length) throw new Error(`RC spell missing from compendium: ${name}`);
  const item = entries[0];
  const recorded = item.system?.spellLevels ?? {};
  for (const [list, level] of levels) {
    if (Number(recorded[list]) !== level) {
      throw new Error(`${item.name}: ${list} should be level ${level}, found ${recorded[list]}`);
    }
  }
  if (!entries.every((entry) => entry.system?.spellLevels)) {
    throw new Error(`${item.name}: duplicate entries must carry spellLevels`);
  }
}

for (const heading of ["Druidic Spells", "Higher-level Spells", "Lost Spell Books"]) {
  if (byName.has(normalize(heading))) throw new Error(`Section heading imported as a spell: ${heading}`);
}
for (const spell of spells) {
  if (/ Reverse Gravity Range:| Meteor Swarm Range:/.test(spell.system?.effect ?? "")) {
    throw new Error(`Spell prose was swallowed by ${spell.name}`);
  }
}

const prose = JSON.stringify(journals);
const bands = new Map();
for (const result of REACTION_TABLE.results) {
  if (!bands.has(result.text)) bands.set(result.text, []);
  bands.get(result.text).push(result.range[0]);
}
for (const [text, faces] of bands) {
  const label = faces.length === 1 ? `${faces[0]}` : `${faces[0]}-${faces.at(-1)}`;
  if (!prose.includes(label)) {
    throw new Error(`Reaction band ${label} (${text}) is missing from the rules reference`);
  }
}
for (const text of ["attacks immediately", "hostile and may attack", "no attack but may parley", "friendly and helpful"]) {
  if (!prose.includes(text)) throw new Error(`Reaction text missing from the rules reference: ${text}`);
}

console.log(`Spell index OK: ${spells.length} spells, ${expected.size} RC entries; reaction bands consistent.`);
