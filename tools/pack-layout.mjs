/**
 * Shared compendium layout rules.
 *
 * Keeping folder keys and document ordering in one module prevents the pack
 * builder, the normalizer and the validator from drifting apart.
 */
import { createHash } from "node:crypto";

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const byName = (a, b) => collator.compare(String(a.name ?? ""), String(b.name ?? ""));

export const SPELL_LIST_ORDER = ["cleric", "druid", "magic-user"];
export const SPELL_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Levels actually printed for each spell list in the Rules Cyclopedia.
 * Clerics and druids stop at 7th level, so empty 8th/9th-level folders are not
 * generated. Magic-users have all nine levels.
 */
export const SPELL_LIST_LEVELS = Object.freeze({
  cleric: [1, 2, 3, 4, 5, 6, 7],
  druid: [1, 2, 3, 4, 5, 6, 7],
  "magic-user": SPELL_LEVELS
});

export const TREASURE_CATEGORIES = Object.freeze({
  "Potion Descriptions": {
    folder: "Potions", group: "potions", rule: false
  },
  "Miscellaneous Item Descriptions": {
    folder: "Miscellaneous Magical Items", group: "items", rule: false
  },
  "Missile Talent Descriptions": {
    folder: "Missile Talents", group: "talents", rule: false
  },
  "Miscellaneous Magical Item Enchantment Cost Checklist": {
    folder: "Magic Item Enchantment Rules", group: "rules", rule: true
  }
});

export const TREASURE_FOLDER_ORDER = [
  "Potions",
  "Miscellaneous Magical Items",
  "Missile Talents",
  "Magic Item Enchantment Rules"
];

export const EQUIPMENT_GROUP_ORDER = ["weapons", "armor", "adventuring", "transport"];
export const CLASS_FOLDER_ORDER = ["Classes", "Subclasses"];
export const MONSTER_CATEGORY_ORDER = [
  "Normal Animal", "Lowlife", "Construct", "Dragon", "Humanoid", "Monster",
  "Planar Monster", "Undead", "Unclassified"
];

/** Category used for both the monster folder and its deterministic ordering. */
export function monsterCategory(doc) {
  const declared = doc.flags?.becmi?.category;
  if (MONSTER_CATEGORY_ORDER.includes(declared)) return declared;

  const name = String(doc.name ?? "").toLowerCase();
  // The "Monster Type" line is the Rules Cyclopedia classification. Read only
  // its first clause: combined entries list several unrelated creatures and
  // would otherwise put ordinary humans, elves or pegasi among the undead.
  const primary = String(doc.system?.monsterType ?? "").toLowerCase().split(";")[0];
  const rules = [
    [/undead|banshee|ghost|poltergeist|haunt|phantom|apparition|shade|vision|skeleton|zombie|ghoul|wight|wraith|mummy|spectre|vampire|lich|revenant/, "Undead"],
    [/dragon|drake|wyvern/, "Dragon"],
    [/construct|golem|automaton|animated statue|statue, living/, "Construct"],
    [/planar|demon|devil|elemental|nightshade|astral|ethereal|djinni|efreeti|rakshasa|archon|invisible stalker|aerial servant/, "Planar Monster"],
    [/lowlife|slime|ooze|pudding|jelly|fungus|mold|shrieker|grab grass|yellow mold/, "Lowlife"],
    [/animal|bat|bear|boar|whale|shark|fish|ape|dinosaur|pterosaur|pteranodon|plesiosaurus|rat|wolf|snake|toad|manta|slug|worm|beetle|fly|spider|scorpion|locust/, "Normal Animal"],
    [/humanoid|human|demihuman|dwarf|elf|halfling|goblin|orc|kobold|gnoll|hobgoblin|mystic|giant|troll|ogre|lycanthrope|thoul|minotaur|sphinx|dryad|, giant\b/, "Humanoid"],
    [/monster|mimic|hydra|carrion crawler|rust monster|mujina/, "Monster"]
  ];
  for (const [pattern, category] of rules) {
    if (pattern.test(primary)) return category;
  }
  if (/^(?:black|blue|green|red|white|gold|silver|bronze|copper|brass)\s*\(/.test(name)) return "Dragon";
  for (const [pattern, category] of rules) {
    if (pattern.test(name)) return category;
  }
  return "Unclassified";
}

/** Normalize an extracted treasure category into its display folder name. */
export function treasureCategory(value) {
  return TREASURE_CATEGORIES[value]?.folder ?? String(value ?? "Potions");
}

export function treasureInfo(value) {
  if (TREASURE_CATEGORIES[value]) return TREASURE_CATEGORIES[value];
  const byFolder = Object.values(TREASURE_CATEGORIES).find((info) => info.folder === value);
  return byFolder ?? { folder: treasureCategory(value), group: "potions", rule: false };
}

/** Make a treasure document item-only or rule-only, without mixing the two. */
export function normalizeTreasureDocument(doc) {
  const info = treasureInfo(doc.flags?.becmi?.category ?? doc.system?.treasureType);
  const folder = info.folder;
  doc.type = info.rule ? "feature" : "equipment";
  doc.flags = {
    ...(doc.flags ?? {}),
    becmi: {
      ...(doc.flags?.becmi ?? {}),
      category: folder,
      group: info.group,
      kind: info.rule ? "rule" : "item"
    }
  };
  doc.system = {
    ...(doc.system ?? {}),
    treasureType: folder,
    notes: folder
  };
  return doc;
}

/** Folder key for a spell list and level. */
export function spellFolderKey(list, level) {
  const key = SPELL_LIST_ORDER.includes(list) ? list : "magic-user";
  const spellLevel = SPELL_LEVELS.includes(Number(level)) ? Number(level) : 1;
  return `spells:${key}:${spellLevel}`;
}

/** Folder key used by a document in a generated pack. */
export function folderKeyForDocument(pack, doc) {
  if (pack === "spells") {
    const list = doc.flags?.becmi?.list ?? doc.system?.spellLists?.[0] ?? "magic-user";
    return spellFolderKey(list, doc.system?.spellLevel);
  }
  if (pack === "equipment") {
    const group = doc.flags?.becmi?.group
      ?? (doc.type === "weapon" ? "weapons" : doc.type === "armor" ? "armor" : "adventuring");
    return ({ weapons: "Weapons", armor: "Armor & Shields", adventuring: "Adventuring Gear", transport: "Transport & Siege" })[group]
      ?? "Adventuring Gear";
  }
  if (pack === "classes") return doc.type === "feature" ? "Subclasses" : "Classes";
  if (pack === "monsters") return `monsters:${monsterCategory(doc)}`;
  if (pack === "treasure") return treasureCategory(doc.flags?.becmi?.category ?? doc.system?.treasureType);
  return null;
}

/** Effective key of a folder definition (falls back to its display name). */
export function folderDefinitionKey(definition) {
  return definition.key ?? definition.name;
}

/**
 * Foundry validates Folder IDs as 16-character alphanumeric strings. A
 * hexadecimal digest is safer than base64url document IDs, which can contain
 * "-" and "_".
 */
export function folderId(pack, key) {
  return createHash("sha256").update(`folder:${pack}:${key}`).digest("hex").slice(0, 16);
}

const rank = (value, order) => {
  const index = order.indexOf(value);
  return index === -1 ? order.length : index;
};

/** Deterministic ordering for docs inside every compendium. */
export function compareDocuments(pack, a, b) {
  if (pack === "spells") {
    const listA = a.flags?.becmi?.list ?? a.system?.spellLists?.[0] ?? "magic-user";
    const listB = b.flags?.becmi?.list ?? b.system?.spellLists?.[0] ?? "magic-user";
    return rank(listA, SPELL_LIST_ORDER) - rank(listB, SPELL_LIST_ORDER)
      || Number(a.system?.spellLevel ?? 0) - Number(b.system?.spellLevel ?? 0)
      || byName(a, b);
  }
  if (pack === "equipment") {
    const group = (doc) => doc.flags?.becmi?.group
      ?? (doc.type === "weapon" ? "weapons" : doc.type === "armor" ? "armor" : "adventuring");
    return rank(group(a), EQUIPMENT_GROUP_ORDER) - rank(group(b), EQUIPMENT_GROUP_ORDER) || byName(a, b);
  }
  if (pack === "treasure") {
    return rank(treasureCategory(a.flags?.becmi?.category ?? a.system?.treasureType), TREASURE_FOLDER_ORDER)
      - rank(treasureCategory(b.flags?.becmi?.category ?? b.system?.treasureType), TREASURE_FOLDER_ORDER)
      || byName(a, b);
  }
  if (pack === "classes") {
    const folder = (doc) => doc.type === "feature" ? "Subclasses" : "Classes";
    return rank(folder(a), CLASS_FOLDER_ORDER) - rank(folder(b), CLASS_FOLDER_ORDER) || byName(a, b);
  }
  if (pack === "monsters") {
    return rank(monsterCategory(a), MONSTER_CATEGORY_ORDER)
      - rank(monsterCategory(b), MONSTER_CATEGORY_ORDER) || byName(a, b);
  }
  return byName(a, b);
}

export function sortDocuments(pack, docs) {
  return [...docs].sort((a, b) => compareDocuments(pack, a, b));
}
