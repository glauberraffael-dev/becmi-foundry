/**
 * Adds Rules Cyclopedia monsters that the legacy extractor missed.
 *
 * The legacy `extract-monsters.mjs` reads a different OCR export (fixed line
 * windows and `### **Name**` headings). The page-based export now available as
 * `Rules_Cyclopedia.md` uses different line numbers and plain headings, so
 * running the old extractor against it would lose the curated actors. This
 * tool reads the page-based export, parses only the explicit allowlist below,
 * and APPENDS missing monsters to data/monsters.json. It never rewrites an
 * existing actor. Run it after `npm run extract`, not before.
 *
 * Usage: node tools/extract-monsters-supplement.mjs [path-to-ocr.md]
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import {
  fixDice, fixOnes, flatten, parseHitDice, parseMovement, summary, toFirstNumber, toNumber
} from "./normalize.mjs";
import { monsterHpFromHitDice } from "../scripts/rules-rc.mjs";
import { sortDocuments } from "./pack-layout.mjs";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));
const input = process.argv[2]
  ?? process.env.BECMI_OCR
  ?? require("node:path").join(require("node:os").homedir(), "OneDrive", "Documents", "Rules_Cyclopedia.md");

const FROM = 31843;   // "Monster List" in the page-based export
const TO = 46200;     // after "Wyvern"

/** Only clean, single-stat-block entries are curated here. */
const ALLOW = new Set([
  "Ant, Giant", "Basilisk", "Beholder", "Black Pudding", "Blast Spore", "Camel",
  "Cat, Great", "Centaur", "Chimera", "Cockatrice", "Crab, Giant", "Cyclops",
  "Displacer Beast", "Dolphin", "Dwarf", "Efreeti (Greater; Amir)", "Efreeti, Lesser",
  "Ferret, Giant", "Gnome", "Gorgon", "Gray Ooze", "Green Slime", "Gremlin",
  "Griffon", "Halfling", "Harpy", "Hellhound", "Helion", "Hippogriff", "Kobold",
  "Kryst", "Leech, Giant", "Medusa", "Neanderthal (Caveman)", "Nekrozon", "Nightshade",
  "Nixie", "Nuckalavee", "Ochre Jelly", "Ogre", "Phoenix", "Poltergeist", "Shadow",
  "Sporacle", "Sprite", "Stirge", "Treant", "Triceratops",
  "Troglodyte", "Troll", "Undine", "Wyvern"
]);

/** OCR fixes that need a human decision. */
const OVERRIDES = {
  "Efreeti (Greater; Amir)": { ac: -2 },
  "Green Slime": { ac: 9 },        // "Can always be hit"
  "Displacer Beast": { ac: 4 },
  "Dwarf": { terrain: "Cavern, Hill, Mountain, Woods" },
  "Halfling": { terrain: "Hill, Woods" },
  "Beholder": { saveAs: "M11" },
  "Poltergeist": { ac: -1, hd: "12", xpValue: 4750, morale: 11, intelligence: 13, saveAs: "F12" },
  "Sporacle": { saveAs: "F7" }
};

/** Lines that begin the next entry when the OCR lost its `Armor Class:` label. */
const STOP_BEFORE = {
  "Cockatrice": ["Crocodile"],
  "Dwarf": ["Efreet are irritable"]
};

/**
 * Multi-column tables that cannot be parsed mechanically from this OCR export.
 * Values are taken directly from the Rules Cyclopedia monster list.
 */
const MANUAL = [
  {
    name: "Cat, Great (Lion)",
    stats: { ac: "6", hd: "5", move: "150' (50')", attacks: "2 claws/1 bite", damage: "1d4+1/1d4+1/1d10", appearing: "0 (2d6)", saveAs: "F3", morale: "9", treasure: "U", intelligence: "2", alignment: "Neutral", xpValue: "175" },
    lore: ["Monster Type: Normal Animal (Common).", "Lions generally live in warm climates and thrive in savannah and brush lands near deserts. They usually hunt in groups, known as prides. Male lions have the distinctive mane; females do not.", "Terrain: Savannah, Brush."]
  },
  ...[
    ["Wererat", "7 (9)", "3*", "120' (40')", "1 bite or weapon", "1d4 or by weapon", "1d8 (2d8)", "F3", "8", "C", "10", "Chaotic", "50", "Wererats are intelligent rat-humanoids that live in sewers and ruins."],
    ["Werewolf", "5 (9)", "4*", "180' (60')", "1 bite", "2d4", "1d6 (2d6)", "F4", "8", "C", "10", "Chaotic", "125", "Werewolves are savage wolf-humanoids that hunt in packs."],
    ["Wereboar", "4 (9)", "4+1*", "150' (50')", "1 tusk slash", "2d6", "1d4 (2d4)", "F4", "9", "C", "10", "Neutral", "200", "Wereboars are powerfully built boar-humanoids with tusks."],
    ["Weretiger", "3 (9)", "5*", "150' (50')", "2 claws/1 bite", "1d6/1d6/2d6", "1d4 (1d4)", "F5", "9", "C", "10", "Neutral", "300", "Weretigers are large, striped cat-humanoids and deadly hunters."],
    ["Werebear", "2 (8)", "6*", "120' (40')", "2 claws/1 bite", "2d4/2d4/2d8", "1d4 (1d4)", "F6", "10", "C", "10", "Neutral", "500", "Werebears are huge, powerful bear-humanoids."]
  ].map(([form, ac, hd, move, attacks, damage, appearing, saveAs, morale, treasure, intelligence, alignment, xpValue, prose]) => ({
    name: `Lycanthrope (${form})`,
    stats: { ac, hd, move, attacks, damage, appearing, saveAs, morale, treasure, intelligence, alignment, xpValue },
    lore: ["Monster Type: Monster (Rare).", prose, "Terrain: Woods, Wilderness."]
  })),
  {
    name: "Spider, Planar (5 HD)",
    stats: { ac: "6", hd: "5", move: "180' (60')", attacks: "1 bite", damage: "2d6 + poison", appearing: "2d6 (3d6)", saveAs: "F5", morale: "9", treasure: "See below", intelligence: "12", alignment: "Any", xpValue: "425" },
    lore: ["Monster Type: Planar Monster (Very Rare).", "Planar spiders are intelligent plane-traveling arachnids that can move between planes and dimensions at will. They arrive from another plane, attack, and may disappear just as quickly.", "Terrain: Any plane."]
  }
];

const LABELS = {
  "Armor Class": "ac", "Hit Dice": "hd", Move: "move", Flying: "flying",
  Swimming: "swimming", Attacks: "attacks", Damage: "damage",
  "No. Appearing": "appearing", "Save As": "saveAs", Morale: "morale",
  "Treasure Type": "treasure", Intelligence: "intelligence",
  Alignment: "alignment", "XP Value": "xpValue"
};
const LABEL_RE = new RegExp(`^(${Object.keys(LABELS).flatMap((k) => [k, k.replace(/\./g, "\\.")]).join("|")})\\s*[:;]\\s*(.*)$`, "i");
const PAGE_RE = /^<!-- Página \d+ do PDF -->$/;
const CATEGORIES = [
  "Normal Animal", "Lowlife", "Construct", "Dragon", "Humanoid",
  "Planar Monster", "Undead", "Monster"
];

const clean = (value) => fixOnes(flatten(value));
const nameKey = (name) => String(name).toLowerCase().replace(/\*+$/, "").replace(/\s+/g, " ").trim();
const baseKey = (name) => nameKey(name).replace(/\s*\([^)]*\)/g, "").trim();
const allowKeys = new Set([...ALLOW].map(nameKey));

function labelFor(line) {
  const match = line.match(LABEL_RE);
  if (!match) return null;
  const label = Object.keys(LABELS).find((k) => k.toLowerCase() === match[1].toLowerCase());
  return { key: LABELS[label], value: match[2].trim() };
}

/** Repair OCR digits that look like lowercase L in save-as shorthand. */
function repairSaveAs(value) {
  return clean(value).replace(/\b([CFMTEHD])l+\b/gi, (_m, letter) => `${letter}${"1".repeat(_m.length - 1)}`);
}

/**
 * Returns the flat stat object plus the indices of body lines that are part of
 * the stat block, so those lines can be excluded from the prose description.
 */
function parseStats(body) {
  const stats = {};
  const used = new Set();

  // Layout B: every label is printed first, then every value in order.
  const leading = [];
  for (let i = 0; i < body.length; i++) {
    const found = labelFor(body[i].trim());
    if (!found || found.value) break;
    leading.push({ key: found.key, index: i });
  }
  if (leading.length >= 10) {
    const values = [];
    const typeIndex = body.findIndex((line) => /^Monster Type\s*:/i.test(line));
    const stop = typeIndex === -1 ? body.length : typeIndex;
    for (let i = leading.length; i < stop; i++) {
      const text = body[i].trim();
      if (!text || labelFor(text)) continue;
      used.add(i);
      if (text.startsWith("(") && values.length) values[values.length - 1].text += ` ${text}`;
      else values.push({ text, index: i });
    }
    leading.forEach(({ key }, i) => { stats[key] = values[i]?.text ?? ""; });
    leading.forEach(({ index }) => used.add(index));
    return { stats, used };
  }

  // Layout A: label followed by one or more value lines.
  let current = null;
  for (let i = 0; i < body.length; i++) {
    const found = labelFor(body[i].trim());
    if (found) {
      stats[found.key] = found.value;
      used.add(i);
      current = found.key;
      continue;
    }
    if (/^(?:Monster Type|Terrain)\s*:/i.test(body[i].trim())) break;
    const text = body[i].trim();
    if (!text || !current) continue;
    if (/^(?:\(|and |or |see below|by weapon|\d)/i.test(text) && stats[current]) {
      stats[current] += ` ${text}`;
    } else if (!stats[current]) {
      stats[current] = text;
    }
    used.add(i);
  }
  return { stats, used };
}

function parseMonsterType(loreLines) {
  const index = loreLines.findIndex((line) => /^Monster Type\s*:/i.test(line));
  if (index === -1) return { text: "Monster (Unclassified).", lore: loreLines };
  const text = [loreLines[index].replace(/^Monster Type\s*:\s*/i, "")];
  let i = index + 1;
  while (i < loreLines.length && loreLines[i].trim() && !/^[A-Z][a-z]+\s+[a-z]/.test(loreLines[i].trim())) {
    text.push(loreLines[i].trim());
    i++;
  }
  return {
    text: flatten(text).replace(/[\s-]+(?=\.)/g, ""),
    lore: [...loreLines.slice(0, index), ...loreLines.slice(i)]
  };
}

function categoryFor(monsterType) {
  return CATEGORIES.find((category) => monsterType.toLowerCase().includes(category.toLowerCase())) ?? "Unclassified";
}

function buildActor(name, stats, loreLines) {
  const { text: monsterType, lore } = parseMonsterType(loreLines);
  const terrainMatch = lore.find((line) => /^Terrain\s*:/i.test(line));
  const terrain = terrainMatch ? flatten(terrainMatch.replace(/^Terrain\s*:\s*/i, "")) : "";
  const prose = lore.filter((line) => !/^Terrain\s*:/i.test(line) && !/^(?:Attacks|Defenses|Special Attacks|Special Defenses|DM Checklist)\s*:/i.test(line));
  const specialLines = lore.filter((line) => /^(?:Attacks|Defenses|Special Attacks|Special Defenses|DM Checklist)\s*:/i.test(line));
  const override = OVERRIDES[name] ?? {};
  const hd = override.hd ?? parseHitDice(stats.hd ?? "1");
  const move = parseMovement(stats.move ?? "");

  return {
    name,
    type: "monster",
    flags: { becmi: { source: "Rules Cyclopedia", variant: "", key: name, category: categoryFor(monsterType) } },
    system: {
      ac: override.ac ?? toFirstNumber(stats.ac, 9),
      hd,
      hp: monsterHpFromHitDice(hd),
      move: { dungeon: move.dungeon, outdoor: move.outdoor },
      attacks: fixDice(clean(stats.attacks ?? "")),
      damage: fixDice(clean(stats.damage ?? "")),
      appearing: fixDice(clean(stats.appearing ?? "")),
      saveAs: override.saveAs ?? repairSaveAs(stats.saveAs ?? ""),
      morale: override.morale ?? toFirstNumber(stats.morale, 7),
      treasure: override.treasure ?? clean(stats.treasure ?? ""),
      intelligence: override.intelligence ?? toFirstNumber(stats.intelligence, 0),
      alignment: clean(stats.alignment ?? "Neutral"),
      xpValue: override.xpValue ?? toFirstNumber(stats.xpValue, 0),
      terrain: override.terrain ?? terrain,
      monsterType,
      description: summary(prose.join(" "), 900),
      special: specialLines.length ? `<p>${flatten(specialLines.join(" "))}</p>` : "",
      notes: "",
      source: "Rules Cyclopedia",
      page: 0
    }
  };
}

function parseFile(text) {
  const lines = text.split(/\r?\n/).slice(FROM - 1, TO);
  const nextMeaningful = (from) => {
    let j = from;
    while (j < lines.length && (!lines[j].trim() || PAGE_RE.test(lines[j].trim()))) j++;
    return j;
  };
  const looksLikeHeader = (line) => !labelFor(line) && !/[:|]/.test(line)
    && line.length > 0 && line.length < 90 && /^[A-Z(]/.test(line);

  const headerNames = new Set();
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (looksLikeHeader(line) && /^Armor Class\s*:/i.test(lines[nextMeaningful(i + 1)]?.trim() ?? "")) {
      headerNames.add(line);
    }
  }

  const blocks = [];
  let current = null;
  let terrainSeen = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || PAGE_RE.test(line)) continue;
    if (current && headerNames.has(line) && line !== current.name) {
      current = null;
      terrainSeen = false;
    }
    if (current && (STOP_BEFORE[current.name] ?? []).some((prefix) => line.startsWith(prefix))) {
      current = null;
      terrainSeen = false;
    }
    const next = nextMeaningful(i + 1);
    const isHeader = looksLikeHeader(line) && /^Armor Class\s*:/i.test(lines[next]?.trim() ?? "");
    if (isHeader) {
      current = { name: line.replace(/\*+$/, ""), body: [] };
      blocks.push(current);
      terrainSeen = false;
      continue;
    }
    if (!current) continue;
    // The prose ends at the terrain line; later lines often belong to the next
    // entry because the OCR interleaves two page columns.
    if (terrainSeen && (headerNames.has(line) || /^(?:Armor Class|Load|Barding Multiplier)\s*:/i.test(line))) {
      current = null;
      continue;
    }
    current.body.push(line);
    if (/^Terrain\s*:/i.test(line)) terrainSeen = true;
  }
  return blocks;
}

const raw = await readFile(input, "utf8");
const existing = JSON.parse(await readFile(`${root}/data/monsters.json`, "utf8"));
const have = new Set(existing.map((doc) => baseKey(doc.name)));
const added = [];
for (const block of parseFile(raw)) {
  if (!allowKeys.has(nameKey(block.name)) || have.has(baseKey(block.name))) continue;
  const { stats, used } = parseStats(block.body);
  const loreLines = block.body.filter((_, i) => !used.has(i));
  const actor = buildActor(block.name, stats, loreLines);
  if (!(actor.system.xpValue > 0) || !actor.system.description || !actor.system.attacks) {
    console.warn(`Skipping ${block.name}: incomplete stat block`);
    continue;
  }
  added.push(actor);
  have.add(baseKey(actor.name));
}
for (const entry of MANUAL) {
  if (have.has(nameKey(entry.name))) continue;
  const actor = buildActor(entry.name, entry.stats, entry.lore);
  added.push(actor);
  have.add(nameKey(actor.name));
}

const output = sortDocuments("monsters", [...existing, ...added]);
await writeFile(`${root}/data/monsters.json`, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Added ${added.length} monsters; compendium now has ${output.length} actors.`);
for (const actor of added) {
  console.log(`  ${actor.name}: AC ${actor.system.ac}, HD ${actor.system.hd}, XP ${actor.system.xpValue}`);
}
