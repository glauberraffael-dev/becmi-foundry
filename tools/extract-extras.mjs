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
import {
  AMMUNITION, ARMOR, ATTACK_BONUSES, BASIC_SPECIAL_EFFECTS, BASIC_WEAPONS, BARDING,
  DESPAIR_EFFECT, EFFECTS_BLOWGUN_NET, EFFECTS_BLACKJACK, EFFECTS_BOLA_WHIP,
  MASTERY_CHOICES, MASTERY_JOURNAL, MASTERY_LEVELS, MASTERY_REFERENCE,
  MONSTER_MASTERY_LIMITS, NETS, PASSAGE, SIEGE_EQUIPMENT, SIEGE_WEAPONS,
  TRAINING_COSTS, TRAINING_SUCCESS, WEAPON_PENALTIES, rollTable
} from "./mastery-data.mjs";

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

const CHAPTERS = [
  [1, "Steps in Character Creation", "Ability scores, alignments, hit points, starting money and the first decisions a player makes."],
  [2, "The Character Classes", "Cleric, fighter, magic-user, thief, dwarf, elf, halfling and the optional druid and mystic classes, with progression tables."],
  [3, "Spells and Spellcasting", "Clerical, druidic and magical spell lists, descriptions and the rules for learning and casting spells."],
  [4, "Equipment", "Weapons, armor, adventuring gear, transportation and siege equipment with costs and encumbrance."],
  [5, "Other Character Abilities", "Weapon mastery and the optional general skill system."],
  [6, "Movement", "Game time, distance, land, water and aerial travel rates."],
  [7, "Encounters and Evasion", "Encounter checks, surprise, monster reactions, wandering monsters and pursuit."],
  [8, "Combat", "Initiative, morale, attack rolls, missile fire, magic, unarmed and special forms of combat."],
  [9, "Mass Combat", "The War Machine and Siege Machine for resolving large-scale battles."],
  [10, "Experience", "Awarding XP for role-playing, goals, monsters, treasure and exceptional actions; maximum hit points."],
  [11, "Nonplayer Characters", "Retainers, mercenaries and specialists."],
  [12, "Strongholds and Dominions", "Building a stronghold, hiring staff and ruling a dominion."],
  [13, "Dungeon Master Procedures", "Ability checks, aging, alignment changes, anti-magic and ICC rulings."],
  [14, "Monsters", "How to read monster descriptions and the alphabetical monster list with complete statistics."],
  [15, "Immortals", "Immortal spheres, statistics and the paths by which mortals may become immortals."],
  [16, "Treasure", "Treasure types, coins, gems, jewelry and magical items."],
  [17, "Campaigning", "Running an ongoing campaign and linking adventures together."]
];

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
  return [...unique.values()];
}

function tables() {
  const reactions = [
    [2, "Hostile, attacks immediately"],
    [3, "Hostile, attacks immediately"],
    [4, "Hostile, may attack"],
    [5, "Hostile, may attack"],
    [6, "Neutral, uncertain"],
    [7, "Neutral, uncertain"],
    [8, "No attack, may parley"],
    [9, "No attack, may parley"],
    [10, "Friendly, helpful"],
    [11, "Friendly, helpful"],
    [12, "Friendly, enthusiastic"]
  ];
  const built = [{
    name: "Monster Reactions (2d6)",
    flags: { becmi: { source: "Rules Cyclopedia", category: "Encounters" } },
    formula: "2d6",
    results: reactions.map(([range, text], i) => ({
      _id: `reaction${i}`.padEnd(16, "0"),
      type: "text",
      text: text,
      range: [range, range],
      weight: 1,
      drawn: false
    }))
  }];

  built.push(rollTable("Weapons (Basic Stats)", "Equipment", BASIC_WEAPONS.map(
    ([name, damage, range, cost, enc, notes]) =>
      [name, `damage ${damage}; range ${range}; ${cost} gp; ${enc} cn; notes ${notes}`]
  )));
  built.push(rollTable("Weapon Special Effects (Basic Weapons)", "Equipment", BASIC_SPECIAL_EFFECTS));
  built.push(rollTable("Weapon Choices by Experience Level", "Weapon Mastery", MASTERY_CHOICES));
  built.push(rollTable("Levels of Weapon Mastery", "Weapon Mastery", MASTERY_LEVELS));
  built.push(rollTable("Training Times and Costs", "Weapon Mastery", TRAINING_COSTS));
  built.push(rollTable("Chance of Training Success", "Weapon Mastery", TRAINING_SUCCESS));
  built.push(rollTable("Attack Roll Bonuses (Weapon Mastery)", "Weapon Mastery", ATTACK_BONUSES));
  built.push(rollTable("Despair Effect", "Weapon Mastery", DESPAIR_EFFECT));
  built.push(rollTable("Mastery Limits for Weapon-Using Monsters", "Weapon Mastery", MONSTER_MASTERY_LIMITS));
  built.push(rollTable("Weapon Mastery Penalties", "Weapon Mastery", WEAPON_PENALTIES));
  built.push(rollTable("Special Effects: Blowgun and Net", "Weapon Mastery", EFFECTS_BLOWGUN_NET));
  built.push(rollTable("Special Effects: Blackjack", "Weapon Mastery", EFFECTS_BLACKJACK));
  built.push(rollTable("Special Effects: Bola and Whip", "Weapon Mastery", EFFECTS_BOLA_WHIP));
  built.push(rollTable("Ammunition", "Equipment", AMMUNITION));
  built.push(rollTable("Armor", "Equipment", ARMOR));
  built.push(rollTable("Barding", "Equipment", BARDING));
  built.push(rollTable("Nets", "Equipment", NETS));
  built.push(rollTable("Siege Weapons", "Equipment", SIEGE_WEAPONS));
  built.push(rollTable("Miscellaneous Siege Equipment", "Equipment", SIEGE_EQUIPMENT));
  built.push(rollTable("Passage", "Equipment", PASSAGE));
  built.push(rollTable("Weapon Mastery Lookup", "Weapon Mastery", MASTERY_REFERENCE.flatMap((g) =>
    g.weapons.map(([name, ...levels]) =>
      [name, `BS ${levels[0]} | SK ${levels[1]} | EX ${levels[2]} | MS ${levels[3]} | GM ${levels[4]}`]
    )
  )));

  return built;
}

function journals() {
  return [
    ...CHAPTERS.map(([num, title, text]) => ({
      name: `Chapter ${num}: ${title}`,
      flags: { becmi: { source: "Rules Cyclopedia", chapter: num } },
      pages: [{
        name: "Summary",
        type: "text",
        text: { content: `<p>${text}</p><p><em>Reference: D&amp;D Rules Cyclopedia, Chapter ${num}. Full rules text is not reproduced here.</em></p>` }
      }]
    })),
    MASTERY_JOURNAL
  ];
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
