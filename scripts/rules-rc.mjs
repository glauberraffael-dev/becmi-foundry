/**
 * Pure Rules Cyclopedia rules layer, ported from the standalone HTML sheet.
 *
 * No Foundry globals are used here so every rule can be unit-tested with Node.
 * The data comes from scripts/rc-data.mjs, generated from the reference HTML.
 */
import { RC } from "./rc-data.mjs";

export { RC };

const CLASS_ALIASES = {
  fighter: "fighter", warrior: "fighter",
  cleric: "cleric",
  thief: "thief", rogue: "thief",
  "magic-user": "magic-user", magicuser: "magic-user", mage: "magic-user", wizard: "magic-user",
  dwarf: "dwarf", elf: "elf", halfling: "halfling"
};

export function normalizeClassKey(name) {
  const key = String(name ?? "").toLowerCase().trim();
  return CLASS_ALIASES[key] ?? (RC.classes[key] ? key : null);
}

export function getRCClass(name) {
  const key = normalizeClassKey(name);
  return key ? RC.classes[key] : null;
}

/* ------------------------------------------------------------------ *
 * Attack table (p. 106): a master sequence indexed by the "anchor".   *
 * ------------------------------------------------------------------ */

export function anchorFor(spec) {
  const text = String(spec);
  if (text === "2k3") return RC.attack.sequence.indexOf("2") + 3;
  if (text === "2k1") return RC.attack.sequence.indexOf("2") + 1;
  return RC.attack.sequence.indexOf(text);
}

export function attackNeeded(spec, ac) {
  const index = anchorFor(spec) - Number(ac);
  return RC.attack.sequence[index] ?? "";
}

export function attackInfo(spec, ac, bonus = 0) {
  const raw = attackNeeded(spec, ac);
  const needed = parseInt(raw, 10);
  const auto = String(raw).includes("†");
  return { raw, needed: Number.isFinite(needed) ? needed : 21, auto, bonus };
}

export function attackRows(spec, fromAC = 9, toAC = -10) {
  const rows = [];
  const step = fromAC >= toAC ? -1 : 1;
  for (let ac = fromAC; ; ac += step) {
    rows.push({ ac, needed: attackNeeded(spec, ac) });
    if (ac === toAC) break;
  }
  return rows;
}

function bandFor(table, level) {
  return table.find(([max]) => level <= max) ?? table[table.length - 1];
}

function bandLabel(table, level) {
  const index = table.findIndex(([max]) => level <= max);
  const safe = index < 0 ? table.length - 1 : index;
  const start = safe === 0 ? 1 : table[safe - 1][0] + 1;
  return start === table[safe][0] ? String(start) : `${start}-${table[safe][0]}`;
}

export function rankForXp(classInfo, xp) {
  const ranks = classInfo?.ranks ?? [];
  let rank = null;
  for (const [minimum, letter] of ranks) if (Number(xp) >= minimum) rank = letter;
  return rank;
}

/** Resolve the attack column spec used by a character of the given level/XP. */
export function attackSpecFor(className, level, xp = 0) {
  const cls = getRCClass(className);
  if (!cls) return { spec: 19, label: "", thac0: 19 };
  const levelNumber = Math.max(1, Number(level) || 1);
  if (cls.ranks?.length && levelNumber >= cls.maxLevel) {
    const rank = rankForXp(cls, xp);
    if (rank && RC.attack.anchors[rank] !== undefined) {
      const spec = RC.attack.anchors[rank];
      return { spec, label: `${cls.name} level ${levelNumber} — attack rank ${rank}`, thac0: attackNeeded(spec, 0) };
    }
  }
  const [, spec] = bandFor(cls.attack, levelNumber);
  return {
    spec,
    label: `${cls.name} level ${levelNumber} — ${cls.attackColumn} column ${bandLabel(cls.attack, levelNumber)}`,
    thac0: attackNeeded(spec, 0)
  };
}

/* ------------------------------------------------------------------ *
 * Saves, thief skills, spell slots, turn undead                      *
 * ------------------------------------------------------------------ */

export function baseSaves(className, level) {
  const cls = getRCClass(className);
  const result = {};
  if (!cls) return result;
  const thresholds = cls.saves.thresholds;
  let index = thresholds.findIndex((max) => Number(level) <= max);
  if (index < 0) index = thresholds.length - 1;
  RC.saveIds.forEach((key, row) => {
    result[key] = Number(cls.saves.rows[row]?.[index] ?? 10);
  });
  return result;
}

const THIEF_KEYS = ["openLocks", "findTraps", "removeTraps", "climbWalls", "moveSilently", "hideInShadows", "pickPockets", "hearNoise"];

export function baseThiefSkills(level) {
  const row = RC.thief[Math.max(1, Number(level) || 1) - 1] ?? RC.thief[RC.thief.length - 1];
  return Object.fromEntries(THIEF_KEYS.map((key, index) => [key, Number(row[index] ?? 0)]));
}

export function spellSlotsForLevel(className, level) {
  const cls = getRCClass(className);
  if (!cls?.spells) return [];
  const table = RC.spellSlots[cls.spells.table] ?? RC.spellSlots[cls.spells.list] ?? [];
  const row = table[Math.max(1, Number(level) || 1) - 1] ?? [];
  return Array.from({ length: cls.spells.levels }, (_, i) => Number(row[i] ?? 0));
}

export function turnUndeadColumn(level) {
  const n = Math.max(1, Number(level) || 1);
  if (n <= 8) return n - 1;
  if (n <= 10) return 8;
  if (n <= 12) return 9;
  if (n <= 14) return 10;
  if (n <= 16) return 11;
  if (n <= 20) return 12;
  if (n <= 24) return 13;
  if (n <= 28) return 14;
  if (n <= 32) return 15;
  return 16;
}

const UNDEAD_NAMES_EN = [
  "skeleton", "zombie", "ghoul", "wight", "wraith", "mummy", "spectre", "vampire",
  "phantom", "haunt", "spirit", "nightshade", "lich", "special"
];

export function turnUndeadCell(level, typeName) {
  const needle = String(typeName).trim().toLowerCase();
  let index = RC.turnUndead.rows.findIndex((entry) => entry.name.toLowerCase() === needle);
  if (index < 0) index = UNDEAD_NAMES_EN.indexOf(needle);
  return RC.turnUndead.rows[index]?.values[turnUndeadColumn(level)] ?? "—";
}

export function turnUndeadTable(level) {
  const column = turnUndeadColumn(level);
  return RC.turnUndead.columns.map((label, index) => ({
    label,
    active: index === column,
    cells: RC.turnUndead.rows.map((row) => ({ name: row.name, value: row.values[index] ?? "—" }))
  }));
}

/** Interpret a Turn Undead cell for a die result. */
export function resolveTurnResult(cell, roll) {
  if (cell === "-" || cell === "—") return { kind: "impossible" };
  if (cell === "T") return { kind: "turn", dice: "2d6" };
  if (cell === "D") return { kind: "destroy", dice: "2d6" };
  if (cell === "D+") return { kind: "destroy", dice: "3d6" };
  if (cell === "D#") return { kind: "destroy", dice: "4d6" };
  const target = parseInt(cell, 10);
  if (!Number.isFinite(target)) return { kind: "special", value: cell };
  return Number(roll) >= target
    ? { kind: "turn", dice: "2d6", target }
    : { kind: "failure", target };
}

/* ------------------------------------------------------------------ *
 * Ability scores, armor and load                                     *
 * ------------------------------------------------------------------ */

export function adjustment(score) {
  const value = parseInt(score, 10);
  if (!Number.isFinite(value) || value < 1) return null;
  if (value <= 3) return -3;
  if (value <= 5) return -2;
  if (value <= 8) return -1;
  if (value <= 12) return 0;
  if (value <= 15) return 1;
  if (value <= 17) return 2;
  return 3;
}

export function armorBase(type) {
  return Number(RC.armor.types[type]?.ac ?? RC.armor.types.nenhuma.ac);
}

export function computeArmorClass({ type = "nenhuma", shield = false, dexAdj = 0, magicArmor = 0, magicShield = 0, itemBonus = 0 } = {}) {
  const base = armorBase(type);
  const value = base - (shield ? 1 : 0) - Number(dexAdj || 0) - Number(magicArmor || 0)
    - (shield ? Number(magicShield || 0) : 0) - Number(itemBonus || 0);
  return { base, value, shield: Boolean(shield) };
}

export function computeLoad({ armor = "nenhuma", shield = false, coins = 0, equipment = 0, gems = 0, jewels = 0, weapons = 0 } = {}) {
  const armorWeight = Number(RC.armor.weights[armor] ?? 0);
  const shieldWeight = shield ? Number(RC.armor.shieldWeight) : 0;
  const total = armorWeight + shieldWeight + Number(coins || 0) + Number(equipment || 0)
    + Number(gems || 0) + Number(jewels || 0) + Number(weapons || 0);
  const band = RC.armor.movement.find(([limit]) => limit === null || total <= limit) ?? RC.armor.movement.at(-1);
  return { total, movementTurn: band[1], movementRound: band[2] };
}

/** Plan the creation-time ability swap (2 points from non-primary FOR/INT/WIS → +1 primary). */
const ABILITY_ALIASES = { for: "str", des: "dex", int: "int", sab: "wis", con: "con", car: "cha" };

export function planAbilityAdjustment(className, scores, limit) {
  const cls = getRCClass(className);
  if (!cls) return { scores: { ...scores }, swaps: 0 };
  const primary = cls.primeRequisites.map((key) => ABILITY_ALIASES[key] ?? key);
  const sources = ["str", "int", "wis"].filter((key) => !primary.includes(key));
  const next = { ...scores };
  let swaps = 0;
  for (;;) {
    const target = primary.filter((key) => Number(next[key]) < 18)
      .sort((a, b) => Number(next[a]) - Number(next[b]))[0];
    const source = sources.filter((key) => Number(next[key]) >= 11)
      .sort((a, b) => Number(next[a]) - Number(next[b]))[0];
    if (!target || !source || (limit !== undefined && swaps >= limit)) break;
    next[source] = Number(next[source]) - 2;
    next[target] = Number(next[target]) + 1;
    swaps++;
  }
  return { scores: next, swaps };
}

/* ------------------------------------------------------------------ *
 * Weapon Mastery                                                     *
 * ------------------------------------------------------------------ */

function weaponAliases(weapon) {
  return [weapon.name, weapon.namePt].filter(Boolean).map((value) => value.toLowerCase());
}

export function masteryWeapon(name) {
  const needle = String(name ?? "").trim().toLowerCase();
  if (!needle) return null;
  return RC.mastery.weapons.find((weapon) => weaponAliases(weapon).includes(needle)) ?? null;
}

export function masteryRanks() {
  return Object.entries(RC.mastery.grades).map(([key, grade]) => ({ key, ...grade }));
}

export function masteryData(weapon, grade) {
  const name = typeof weapon === "string" ? masteryWeapon(weapon) : weapon;
  if (!name) return null;
  const level = String(grade || "sem");
  const mastery = RC.mastery.grades[level] ?? RC.mastery.grades.sem;
  const index = RC.mastery.order.indexOf(level);
  if (index < 0) {
    const empty = name.hasRange ? ["", "—", "—", ""] : ["—", "—", ""];
    const result = name.hasRange
      ? { range: empty[0], damage: empty[1], defense: empty[2], special: empty[3] }
      : { range: "", damage: empty[0], defense: empty[1], special: empty[2] };
    return { ...result, name: name.name, namePt: name.namePt, primary: name.primary, cost: name.cost, weight: name.weight, attack: mastery.at, dv: mastery.dv, weightCost: mastery.peso };
  }
  const rank = name.ranks[index] ?? name.ranks.at(-1);
  const result = name.hasRange
    ? { range: rank[0], damage: rank[1], defense: rank[2], special: rank[3] }
    : { range: "", damage: rank[0], defense: rank[1], special: rank[2] };
  return {
    ...result,
    name: name.name,
    namePt: name.namePt,
    primary: name.primary,
    cost: name.cost,
    weight: name.weight,
    attack: mastery.at,
    dv: mastery.dv,
    weightCost: mastery.peso
  };
}

export function chooseDamage(damage, target) {
  const primary = String(damage).match(/P=([^;]+)/);
  const secondary = String(damage).match(/S=(.+)$/);
  if (primary && secondary) {
    return (target === "sec" ? secondary[1] : primary[1]).replace(" ✱", "").trim();
  }
  return String(damage).replace(" ✱", "").trim();
}

export function sumDamage(dice, extra) {
  const match = String(dice).match(/^(\d+d\d+)(?:\+(\d+))?$/);
  if (!match) return `${dice}${extra ? (extra > 0 ? "+" : "") + extra : ""}`;
  const total = (parseInt(match[2], 10) || 0) + Number(extra || 0);
  return `${match[1]}${total ? (total > 0 ? "+" : "") + total : ""}`;
}

export function finalDamage(dice, extra, untrained) {
  if (!dice) return extra ? (Number(extra) > 0 ? "+" : "") + extra : "";
  if (untrained) return `½(${dice})${extra ? (Number(extra) > 0 ? "+" : "") + extra : ""}`;
  return sumDamage(dice, extra);
}

export function masteryChoices(className, level, xp = 0) {
  const cls = getRCClass(className);
  if (!cls) return 0;
  if (cls.ranks?.length) {
    let opportunities = cls.demiTraining.filter((minimum) => Number(level) >= minimum).length;
    if (Number(level) >= cls.maxLevel) {
      opportunities += Math.max(0, Math.floor((Number(xp) - cls.xp[cls.maxLevel - 1]) / 200000));
    }
    return opportunities;
  }
  let total = 0;
  for (const [minimum, quantity] of cls.choices) if (Number(level) >= minimum) total = quantity;
  if (Number(level) >= cls.maxLevel) {
    total += Math.max(0, Math.floor((Number(xp) - cls.xp[cls.maxLevel - 1]) / 200000));
  }
  return total;
}

/* ------------------------------------------------------------------ *
 * Hit points and character creation                                  *
 * ------------------------------------------------------------------ */

export function hpForLevel(className, level, conAdj = 0, rng = Math.random) {
  const cls = getRCClass(className);
  if (!cls) return { gain: 1, text: "" };
  const number = Math.max(1, Number(level) || 1);
  if (number <= Math.min(9, cls.maxLevel)) {
    const roll = 1 + Math.floor(rng() * cls.hitDie);
    const gain = Math.max(1, roll + Number(conAdj || 0));
    const sign = Number(conAdj) > 0 ? `+${conAdj}` : String(conAdj || "");
    return { gain, text: `d${cls.hitDie}=${roll}${sign ? ` ${sign}` : ""} → ${gain} HP` };
  }
  return { gain: cls.hpAfterFixed, text: `+${cls.hpAfterFixed} fixed HP (no CON bonus)` };
}

/* ------------------------------------------------------------------ *
 * Spell helpers                                                      *
 * ------------------------------------------------------------------ */

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const SPELL_LISTS = [
  { key: "cleric", name: "Cleric" },
  { key: "druid", name: "Druid" },
  { key: "magic-user", name: "Magic-User" }
];

export function spellKey(spell) {
  return `${String(spell.class).charAt(0)}${spell.level}-${slug(spell.namePt)}`;
}

export function spellsFor(className, level, { grimoire = [], search = "", extraLists = [], listFilter = "" } = {}) {
  const cls = getRCClass(className);
  if (!cls?.spells) return [];
  const lists = new Set([cls.spells.list, ...extraLists]);
  const selectedLevel = Math.max(0, Number(level) || 0);
  const keys = new Set(grimoire);
  const needle = String(search).trim().toLowerCase();
  return RC.spells
    .filter((spell) => lists.has(spell.class) && spell.level <= cls.spells.levels)
    .filter((spell) => !selectedLevel || spell.level === selectedLevel)
    .filter((spell) => cls.spells.list !== "magic-user" || !keys.size || keys.has(spellKey(spell)))
    .filter((spell) => !listFilter || spell.class === listFilter)
    .filter((spell) => !needle || `${spell.name} ${spell.namePt} ${spell.effect}`.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/* ------------------------------------------------------------------ *
 * Free-form expression roller: NdM, integers, + / -, and half(...).  *
 * ------------------------------------------------------------------ */

export function rollExpression(expression, rng = Math.random) {
  let text = String(expression ?? "").trim();
  if (!text || /^nil$/i.test(text)) return { total: 0, parts: [], formula: text, valid: false };

  let position = 0;
  const skip = () => { while (/\s/.test(text[position] ?? "")) position++; };

  function parseSum() {
    let value = parseTerm();
    for (;;) {
      skip();
      const operator = text[position];
      if (operator !== "+" && operator !== "-") break;
      position++;
      const right = parseTerm();
      value += operator === "+" ? right : -right;
    }
    return value;
  }

  function parseTerm() {
    skip();
    if (text.startsWith("½", position) || text.startsWith("1/2", position)) {
      position += text.startsWith("½", position) ? 1 : 3;
      skip();
      if (text[position] !== "(") throw new Error("Expected '(' after ½");
      position++;
      const inside = parseSum();
      skip();
      if (text[position] !== ")") throw new Error("Expected ')' after ½ expression");
      position++;
      return Math.floor(inside / 2);
    }
    if (text[position] === "(") {
      position++;
      const inside = parseSum();
      skip();
      if (text[position] !== ")") throw new Error("Unbalanced parentheses");
      position++;
      return inside;
    }
    return parseDice();
  }

  function parseDice() {
    skip();
    const start = position;
    while (/\d/.test(text[position] ?? "")) position++;
    if (start === position) throw new Error(`Unexpected character '${text[position] ?? ""}'`);
    const count = parseInt(text.slice(start, position), 10);
    skip();
    if (text[position]?.toLowerCase() === "d") {
      position++;
      skip();
      const facesStart = position;
      while (/\d/.test(text[position] ?? "")) position++;
      if (facesStart === position) throw new Error("Missing dice faces");
      const faces = parseInt(text.slice(facesStart, position), 10);
      if (faces < 2 || count < 1 || count > 100) throw new Error("Invalid dice expression");
      let total = 0;
      for (let i = 0; i < count; i++) total += 1 + Math.floor(rng() * faces);
      return total;
    }
    return count;
  }

  try {
    const total = parseSum();
    skip();
    if (position !== text.length) throw new Error("Unexpected trailing characters");
    return { total, parts: [], formula: text, valid: true };
  } catch (error) {
    return { total: 0, parts: [], formula: text, valid: false, error: error.message };
  }
}
