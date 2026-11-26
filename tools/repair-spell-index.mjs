/**
 * Keeps the spell compendium aligned with the RC spell index.
 *
 * Adds spells that exist in the RC index but were swallowed into the prose of
 * another spell, removes section headings that were imported as spells, and
 * records every class/level pair in `system.spellLevels` so one item can serve
 * classes that receive the same spell at different levels.
 *
 * Usage: node tools/repair-spell-index.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { compareDocuments } from "./pack-layout.mjs";

const root = new URL("..", import.meta.url);
const rc = JSON.parse(readFileSync(new URL("data/rc-tables.json", root), "utf8"));
const path = new URL("data/spells.json", root);
const spells = JSON.parse(readFileSync(path, "utf8"));
const normalize = (value) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

const headings = new Set(["Druidic Spells", "Higher-level Spells", "Lost Spell Books"]);
const byName = new Map();
for (const entry of rc.spells) {
  const name = normalize(entry.name);
  if (!byName.has(name)) byName.set(name, new Map());
  byName.get(name).set(entry.class, Number(entry.level));
}

/** Split prose that was pulled into the preceding spell during extraction. */
function unsplit(hostName, marker, stolenName, stolenDescriptionStart) {
  const host = spells.find((spell) => spell.name === hostName);
  if (!host || !host.system?.effect?.includes(marker)) return null;
  const [effect] = host.system.effect.split(marker);
  const [description] = host.system.description.split(stolenDescriptionStart);
  host.system.effect = effect.trim();
  host.system.description = description.trim();
  const facts = rc.spells.find((entry) => entry.name === stolenName);
  if (!facts) return null;
  return {
    name: stolenName,
    type: "spell",
    flags: { becmi: { source: "Rules Cyclopedia", list: facts.class } },
    system: {
      spellLevel: facts.level,
      spellLists: [facts.class],
      range: "90'",
      duration: "1/5 round (2 seconds)",
      effect: "Causes victims in a 30' cubic volume to fall upward",
      reversible: false,
      description: stolenDescriptionStart,
      source: "Rules Cyclopedia",
      page: 0,
      notes: ""
    }
  };
}

const reverseGravity = unsplit(
  "Power Word Stun", " Reverse Gravity Range:", "Reverse Gravity", "fall upward This spell affects"
);
if (reverseGravity) {
  // The split above removed the stolen prose from the host; recover it from
  // the original description before overwriting the host field.
  const original = "fall upward This spell affects all creatures and objects within a cubic volume 30'x 30'x 30', causing them to \"fall\" in a direction opposite the normal gravity. In two seconds, creatures and objects can \"fall\" a maximum of 65'. No saving throw is allowed, and all victims hitting a ceiling or other obstruction take 1d6 points of damage per 10' \"fallen.";
  reverseGravity.system.description = original.replace(/^fall upward /, "");
}
const meteorSwarm = unsplit(
  "Maze", " Meteor Swarm Range:", "Meteor Swarm", "This spell creates either 4 or 8 meteors"
);
if (meteorSwarm) {
  meteorSwarm.system.description = "This spell creates either 4 or 8 meteors (at the caster's choice). Each meteor is a fireball that strikes a target within 240'. A saving throw is allowed.";
  meteorSwarm.system.range = "240'";
  meteorSwarm.system.duration = "Instantaneous";
  meteorSwarm.system.effect = "Creates four or eight meteor-fireballs";
}

const newSpells = [
  reverseGravity, meteorSwarm,
  {
    name: "Cure Light Wounds",
    type: "spell",
    flags: { becmi: { source: "Rules Cyclopedia", list: "cleric" } },
    system: {
      spellLevel: 1,
      spellLists: ["cleric"],
      range: "Touch",
      duration: "Permanent",
      effect: "Any living creature",
      reversible: true,
      description: "Cures 1d6+1 hit points of damage on a living creature touched. The reverse, Cause Light Wounds, inflicts 1d6+1 points of damage.",
      source: "Rules Cyclopedia",
      page: 0,
      notes: "",
      rollFormula: "1d6 + 1"
    }
  },
  {
    name: "Speak with Animals",
    type: "spell",
    flags: { becmi: { source: "Rules Cyclopedia", list: "cleric" } },
    system: {
      spellLevel: 2,
      spellLists: ["cleric"],
      range: "Self (cleric only)",
      duration: "6 turns",
      effect: "Conversation within 30'",
      reversible: false,
      description: "The cleric can converse with animals within 30' for the duration of the spell.",
      source: "Rules Cyclopedia",
      page: 0,
      notes: ""
    }
  },
  {
    name: "Floating Disc",
    type: "spell",
    flags: { becmi: { source: "Rules Cyclopedia", list: "magic-user" } },
    system: {
      spellLevel: 1,
      spellLists: ["magic-user"],
      range: "Self",
      duration: "6 turns",
      effect: "Disc stays within 6'",
      reversible: false,
      description: "Creates a rigid disc that floats within 6' of the caster and can carry equipment.",
      source: "Rules Cyclopedia",
      page: 0,
      notes: ""
    }
  },
  {
    name: "Wall of Iron",
    type: "spell",
    flags: { becmi: { source: "Rules Cyclopedia", list: "magic-user" } },
    system: {
      spellLevel: 6,
      spellLists: ["magic-user"],
      range: "120'",
      duration: "Permanent",
      effect: "Creates 500 square feet of iron",
      reversible: false,
      description: "Creates a permanent wall of iron covering 500 square feet.",
      source: "Rules Cyclopedia",
      page: 0,
      notes: ""
    }
  },
  {
    name: "Shapechange",
    type: "spell",
    flags: { becmi: { source: "Rules Cyclopedia", list: "magic-user" } },
    system: {
      spellLevel: 9,
      spellLists: ["magic-user"],
      range: "Self (caster only)",
      duration: "1 turn per caster level",
      effect: "The caster can change form",
      reversible: false,
      description: "The caster can change form for one turn per level.",
      source: "Rules Cyclopedia",
      page: 0,
      notes: ""
    }
  }
].filter(Boolean);

let removed = 0;
let added = 0;
for (let index = spells.length - 1; index >= 0; index--) {
  if (headings.has(spells[index].name)) {
    spells.splice(index, 1);
    removed++;
  }
}
for (const spell of newSpells) {
  if (spells.some((item) => normalize(item.name) === normalize(spell.name))) continue;
  spells.push(spell);
  added++;
}

for (const spell of spells) {
  const levels = byName.get(normalize(spell.name));
  if (!levels) continue;
  spell.system.spellLevels = Object.fromEntries([...levels].sort(([a], [b]) => a.localeCompare(b)));
  spell.system.spellLists = Object.keys(spell.system.spellLevels);
  const primary = spell.system.spellLists.find((list) => list === spell.flags?.becmi?.list)
    ?? spell.system.spellLists[0];
  spell.system.spellLevel = spell.system.spellLevels[primary];
  spell.flags.becmi = { ...(spell.flags?.becmi ?? {}), list: primary };
}

spells.sort((a, b) => compareDocuments("spells", a, b));
writeFileSync(path, `${JSON.stringify(spells, null, 2)}\n`);
console.log(`Spell index repaired: removed ${removed} headings, added ${added} spells, ${spells.length} total.`);
