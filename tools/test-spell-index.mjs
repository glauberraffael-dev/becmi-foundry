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
  if (/^\s*(?:Range|Duration|Effect):/i.test(spell.system?.description ?? "")) {
    throw new Error(`Stat line leaked into the description of ${spell.name}`);
  }
}

// The first-level magic-user spells are the clearest regression case: the
// two-column OCR used to assign Floating Disc, Magic Missile and Read Magic
// prose to the following heading. Each of these openings must stay with its
// own spell.
const openings = new Map([
  ["Shield", ["This spell creates a magical barrier", "horizontal platform"]],
  ["Floating Disc", ["This spell creates an invisible magical horizontal platform", "magical barrier all around"]],
  ["Magic Missile", ["A magic missile is a glowing arrow", "read, not speak, any magical words"]],
  ["Read Languages", ["read, not speak, any unknown languages", "magical words or runes"]],
  ["Read Magic", ["read, not speak, any magical words", "unknown languages or codes"]],
  ["Light", ["This spell creates a large ball of light", "not affect a magic missile"]],
  ["Protection from Evil", ["invisible magical barrier all around", "read, not speak"]],
  ["Cure Light Wounds", ["This spell either heals damage", "A cleric may reverse a spell simply"]]
]);
for (const [name, [expected, forbidden]] of openings) {
  const spell = spells.find((entry) => entry.name === name);
  if (!spell) throw new Error(`Spell missing for prose check: ${name}`);
  const description = String(spell.system?.description ?? "");
  if (!description.includes(expected) || description.includes(forbidden)) {
    throw new Error(`${name}: description is mixed with another spell: ${description.slice(0, 120)}`);
  }
}

// Stacked headings on the three-column spell pages used to attach the prose of
// one spell to the previous heading. These cases cover the left/middle column
// swaps and multi-line stat blocks that leaked into descriptions or effects.
const regressions = new Map([
  ["Shield", { effect: "The spellcaster only", contains: "AC of 2 against missiles", forbidden: "horizontal platform" }],
  ["Floating Disc", { effect: "Disc stays within 6'", contains: "horizontal platform", forbidden: "magical barrier all around" }],
  ["Stone to Flesh", { effect: "One creature or object", contains: "turns any one statue", forbidden: "wall of iron" }],
  ["Stoneform", { contains: "mass of stone equal to 1,000 cubic feet", forbidden: "wall of iron" }],
  ["Wall of Iron", { contains: "vertical wall of iron exactly 2' thick", forbidden: "turns any one statue" }],
  ["Permanence", { contains: "By means of this spell", forbidden: "Duration: Permanent until dispelled Effect:" }],
  ["Maze", { contains: "indestructible maze in the Astral Plane", forbidden: "2d4 rounds, or ld4 rounds) Effect:" }],
  ["Timestop", { contains: "To the caster, this spell seems to stop time", forbidden: 'rounds while everything else "stops" To the caster' }],
  ["Know Alignment", { effect: "One creature within 10'" }],
  ["Massmorph", { duration: "See below" }]
]);
for (const [name, checks] of regressions) {
  const spell = spells.find((entry) => entry.name === name);
  if (!spell) throw new Error(`Spell missing for regression check: ${name}`);
  if (checks.effect !== undefined && spell.system?.effect !== checks.effect) {
    throw new Error(`${name}: effect should be ${JSON.stringify(checks.effect)}, found ${JSON.stringify(spell.system?.effect)}`);
  }
  if (checks.duration !== undefined && spell.system?.duration !== checks.duration) {
    throw new Error(`${name}: duration should be ${JSON.stringify(checks.duration)}, found ${JSON.stringify(spell.system?.duration)}`);
  }
  const description = String(spell.system?.description ?? "");
  if (checks.contains && !description.includes(checks.contains)) {
    throw new Error(`${name}: description is missing ${JSON.stringify(checks.contains)}`);
  }
  if (checks.forbidden && description.includes(checks.forbidden)) {
    throw new Error(`${name}: description still contains mixed prose ${JSON.stringify(checks.forbidden)}`);
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
for (const text of [
  "Monster attacks", "Monster is aggressive", "penalty of -4", "Monster is cautious",
  "bonus of +4", "Monster is friendly"
]) {
  if (!prose.includes(text)) throw new Error(`Reaction text missing from the rules reference: ${text}`);
}

console.log(`Spell index OK: ${spells.length} spells, ${expected.size} RC entries; reaction bands consistent.`);
