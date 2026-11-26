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
  dwarf: "dwarf", elf: "elf", halfling: "halfling",
  mystic: "mystic", monk: "mystic"
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
 * Experience and automatic level advancement                         *
 * ------------------------------------------------------------------ */

/**
 * Build the XP thresholds for levels 2..maxLevel.
 *
 * RC data stores `xp[0]` as the XP for level 1, so `xp[level - 1]` is the XP
 * needed to reach `level + 1`. Class items use a 1-indexed `xpTable` instead;
 * both shapes are accepted here. Non-monotonic OCR values are repaired so the
 * resulting thresholds can never run backwards.
 */
export function xpThresholds(classInfo = {}, requestedMaxLevel) {
  const key = normalizeClassKey(classInfo.key ?? classInfo.name ?? classInfo.classKey);
  const rc = key ? RC.classes[key] : null;
  const maxLevel = Math.max(1, Number(requestedMaxLevel ?? classInfo.maxLevel ?? rc?.maxLevel ?? 36) || 1);
  const table = classInfo.xpTable ?? {};
  const source = rc?.xp ?? classInfo.xp ?? [];
  const thresholds = [];
  let previous = -1;

  for (let level = 2; level <= maxLevel; level++) {
    const fromRc = Number(source[level - 1]);
    const fromTable = Number(table[String(level)]);
    let value = Number.isFinite(fromRc) && fromRc >= 0 ? fromRc : fromTable;
    if (!Number.isFinite(value) || value < 0) value = previous + 1;
    if (value <= previous) value = previous + 1;
    thresholds.push(value);
    previous = value;
  }
  return thresholds;
}

/** XP needed to advance from `level` to the next level (null at the cap). */
export function xpForNextLevel(classInfo, level) {
  const maxLevel = Math.max(1, Number(classInfo?.maxLevel) || 36);
  const current = Math.max(1, Number(level) || 1);
  if (current >= maxLevel) return null;
  return xpThresholds(classInfo, maxLevel)[current - 1] ?? null;
}

/** Highest level reached by `xp`, starting at `currentLevel` and respecting the cap. */
export function levelForXp(classInfo, xp, currentLevel = 1) {
  const thresholds = xpThresholds(classInfo);
  const start = Math.min(thresholds.length + 1, Math.max(1, Number(currentLevel) || 1));
  const earned = Math.max(0, Number(xp) || 0);
  let level = start;
  for (let index = start - 1; index < thresholds.length; index++) {
    if (earned < thresholds[index]) break;
    level = index + 2;
  }
  return level;
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

/* ------------------------------------------------------------------ *
 * Monster saving throws                                               *
 * ------------------------------------------------------------------ */

const MONSTER_SAVE_CLASSES = {
  F: "fighter", C: "cleric", M: "magic-user", T: "thief",
  D: "dwarf", E: "elf", H: "halfling"
};

const NORMAL_MAN_SAVES = Object.freeze({
  deathRay: 14, magicWand: 15, paralysis: 16, breath: 17, spells: 17
});

function monsterLevelFromHitDice(hd) {
  const raw = String(hd ?? "");
  const fraction = raw.match(/(\d+)\s*\/\s*(\d+)/);
  if (fraction) return Math.max(1, Number(fraction[1]) / Number(fraction[2]));
  return Math.max(1, parseMonsterHitDice(raw).count || 1);
}

/**
 * Resolve a monster's "Save As" entry to a character class and level.
 *
 * The RC allows `F7`, `Normal Man`, `F (level = HD)` and similar shorthand.
 * Multi-column OCR texts such as `F7 F21 F36` are ambiguous; the build
 * pipeline resolves those per named variant, so this helper uses the first
 * readable token as a safe fallback for manually created actors.
 */
export function parseMonsterSaveAs(saveAs, hd = "1") {
  const raw = String(saveAs ?? "").replace(/[•·]/g, " ").replace(/\s+/g, " ").trim();
  if (!raw || /^(?:see below|npc class and level|character type and level)$/i.test(raw)) return null;
  if (/normal man/i.test(raw)) return { classKey: "normalMan", level: 0, label: "Normal Man" };

  const level = monsterLevelFromHitDice(hd);
  const formula = raw.match(/\b([CFMTEHD])\s*\(\s*level\s*=\s*([^)]+)\)/i);
  if (formula) {
    const classKey = MONSTER_SAVE_CLASSES[formula[1].toUpperCase()];
    const spec = formula[2].replace(/\s+/g, " ").trim().toLowerCase();
    let saveLevel = level;
    if (/^\d+\s*\/\s*\d+\s*hd$/.test(spec)) {
      const [numerator, denominator] = spec.match(/\d+/g).map(Number);
      saveLevel = Math.ceil(level * numerator / denominator);
    } else if (/^2\s*[x×]\s*hd$/.test(spec)) saveLevel = level * 2;
    else if (!/^hd$/.test(spec)) return null;
    if (classKey) return { classKey, level: Math.max(1, Math.min(36, Math.round(saveLevel))), label: raw };
  }

  const fixed = raw.replace(/\b([CFMTEHD])l(\d+)\b/gi, "$11$2");
  const match = fixed.match(/\b([CFMTEHD])\s*(\d+)\b/i);
  if (!match) return null;
  const classKey = MONSTER_SAVE_CLASSES[match[1].toUpperCase()];
  if (!classKey) return null;
  return { classKey, level: Math.max(1, Math.min(36, Number(match[2]))), label: raw };
}

const MONSTER_CASTER_PATTERNS = [
  ["magic-user", /\bmagic[\s-]?user\b|\bwizard\b/i],
  ["cleric", /\bcleric\b|\bpriest\b/i],
  ["druid", /\bdruid\b/i],
  ["elf", /\belf\b|\belves\b/i]
];

/**
 * Identify the spell lists and caster level described by a monster's
 * Spellcasting note. Drag-and-drop spells alone also enable the tab, in which
 * case the save-as entry supplies a safe fallback for the level.
 */
export function monsterSpellcasterInfo(system = {}, flags = {}) {
  const text = String(system.spellcasting ?? flags.spellcaster ?? "").replace(/\s+/g, " ").trim();
  const parsed = parseMonsterSaveAs(system.saveAs, system.hd);
  const detected = text
    ? MONSTER_CASTER_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([key]) => key)
    : [];
  const saveClass = ["cleric", "magic-user", "elf"].includes(parsed?.classKey) ? parsed.classKey : null;
  const classKeys = detected.length ? detected : saveClass ? [saveClass] : [];
  if (!classKeys.length) return null;
  const levelText = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s-]*level\b|\blevel\s*(\d{1,2})\b/i);
  const level = Number(levelText?.[1] ?? levelText?.[2] ?? parsed?.level ?? 1);
  return {
    text,
    classKeys,
    classKey: classKeys[0],
    level: Math.max(1, Math.min(36, Number.isFinite(level) ? level : 1))
  };
}

/** Saving-throw targets a monster uses on the character save table. */
export function monsterSaveTargets(saveAs, hd = "1") {
  const parsed = parseMonsterSaveAs(saveAs, hd);
  if (!parsed) return null;
  if (parsed.classKey === "normalMan") return { ...NORMAL_MAN_SAVES };
  return baseSaves(parsed.classKey, parsed.level);
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

function isEquipped(item) {
  return Boolean(item?.system?.equipped ?? item?.flags?.becmi?.equipped ?? false);
}

/** AC bonus supplied only by equipped items (plus legacy equipped magic rows). */
export function equippedAcBonus(items = [], magicItems = []) {
  const fromItems = [...(items ?? [])].reduce((sum, item) => {
    if (!isEquipped(item)) return sum;
    return sum + (Number(item.system?.acBonus) || 0);
  }, 0);
  const legacy = [...(magicItems ?? [])].reduce((sum, row) => (
    row?.equipped ? sum + (Number(row.ac) || 0) : sum
  ), 0);
  return fromItems + legacy;
}

/** Per-save bonus supplied only by equipped items (plus legacy flat magic rows). */
export function equippedSaveBonuses(items = [], magicItems = []) {
  const result = Object.fromEntries(RC.saveIds.map((key) => [key, 0]));
  for (const item of items ?? []) {
    if (!isEquipped(item)) continue;
    for (const key of RC.saveIds) result[key] += Number(item.system?.saveBonuses?.[key]) || 0;
  }
  for (const row of magicItems ?? []) {
    if (!row?.equipped) continue;
    for (const key of RC.saveIds) result[key] += Number(row.save) || 0;
  }
  return result;
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

/**
 * HP gains are rolled through 9th level (8th for halflings) and then become a
 * fixed class value with no Constitution bonus. The RC prose conflicts on the
 * elf's 10th-level gain (+1 in the summary/high-level appendix, +2 in one
 * paragraph); the summary value is used here, as in the reference sheet.
 */
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

/**
 * Monster Hit Dice are a count of d8, not a hit-point total (RC p. 152):
 * "Hit Dice: 11" means 11d8 and "3 + 1" means 3d8+1. Asterisks mark special
 * abilities and the (S)/(M)/(L) size code is informational; neither changes HP.
 *
 * Fractions (1/4, 1/2) have a single hit point. Ranges (1-4, 5-12) describe
 * several creatures in a group, so the lower bound is used as a representative
 * die count. An equal/lower trailing number is a negative adjustment: 1-1 is
 * 1d8-1, not a range.
 */
export function parseMonsterHitDice(value) {
  const text = String(value ?? "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\*+$/g, "")
    .trim();

  if (/^\d+\s*\/\s*\d+$/.test(text)) {
    return { kind: "fraction", count: 0, faces: 8, adjustment: 0, formula: "1", hp: 1 };
  }

  const range = text.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range && Number(range[2]) > Number(range[1])) {
    const count = Number(range[1]);
    return {
      kind: "range", count, faces: 8, adjustment: 0, min: count, max: Number(range[2]),
      formula: `${count}d8`, hp: averageHitPoints(count, 8, 0)
    };
  }

  const dice = text.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (dice) {
    const count = Number(dice[1]);
    const faces = Number(dice[2]);
    const adjustment = Number(dice[4] ?? 0) * (dice[3] === "-" ? -1 : 1);
    return {
      kind: "dice", count, faces, adjustment,
      formula: `${count}d${faces}${adjustment ? `${adjustment > 0 ? "+" : "-"}${Math.abs(adjustment)}` : ""}`,
      hp: averageHitPoints(count, faces, adjustment)
    };
  }

  const simple = text.match(/^(\d+)(?:\s*([+-])\s*(\d+))?$/);
  if (simple) {
    const count = Number(simple[1]);
    const adjustment = Number(simple[3] ?? 0) * (simple[2] === "-" ? -1 : 1);
    return {
      kind: "dice", count, faces: 8, adjustment,
      formula: `${count}d8${adjustment ? `${adjustment > 0 ? "+" : "-"}${Math.abs(adjustment)}` : ""}`,
      hp: averageHitPoints(count, 8, adjustment)
    };
  }

  return { kind: "unknown", count: 1, faces: 8, adjustment: 0, formula: "1d8", hp: 1 };
}

/** Rounded average of `count` dice of `faces` sides plus a fixed adjustment. */
export function averageHitPoints(count, faces = 8, adjustment = 0) {
  const value = Math.round(Number(count) * (Number(faces) + 1) / 2 + Number(adjustment));
  return Math.max(1, Number.isFinite(value) ? value : 1);
}

/** Average hit points for a monster Hit Dice expression. */
export function monsterHpFromHitDice(hd) {
  return parseMonsterHitDice(hd).hp;
}

/** Rollable Foundry formula for a monster Hit Dice expression. */
export function monsterHpFormula(hd) {
  return parseMonsterHitDice(hd).formula;
}

/* ------------------------------------------------------------------ *
 * Monster attack macros                                              *
 * ------------------------------------------------------------------ */

function fixDiceText(text) {
  return String(text ?? "")
    // The OCR frequently turns `1` into `l` and `0` into `O` inside dice codes.
    .replace(/\bldl(\d+)\b/gi, "1d1$1")
    .replace(/\bld[O0](\d*)\b/gi, "1d0$1")
    .replace(/\bld(\d+)\b/gi, "1d$1")
    .replace(/(\d+)\s*d\s*[lI|][oO]/gi, "$1d10")
    .replace(/(\d+)\s*d\s*[lI|](\d+)/gi, "$1d1$2")
    .replace(/(\d+)\s*d\s*[oO](\d*)/gi, "$1d0$2")
    .replace(/\bd\s*[lI|]\s*(\d+)\b/gi, "d$1")
    .replace(/\bd\s*[oO]\s*(\d*)\b/gi, "d0$1")
    .replace(/\b(\d+)\s+d\s+(\d+)\b/gi, "$1d$2")
    .trim();
}

/** Only formulas Foundry's roller can evaluate; prose stays in the note. */
export function monsterDamageFormula(text) {
  const fixed = fixDiceText(text).replace(/\beach\b/gi, "").replace(/\s+/g, " ").trim();
  const match = fixed.match(/^(\d*d\d+(?:\s*[+-]\s*(?:\d*d\d+|\d+))*)/i);
  return match ? match[1].replace(/\s+/g, "") : "";
}

function expandGroups(text) {
  return fixDiceText(text)
    .replace(/\s*\/\s*/g, "|")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function splitModes(text) {
  return fixDiceText(text).split(/\s+or\s+/i).map((part) => part.trim()).filter(Boolean);
}

function expandAttacks(mode) {
  const rows = [];
  for (const group of expandGroups(mode)) {
    // OCR renders "8 tentacles" as a bare "8", and variable counts (Hydra)
    // as "5-12 bites". Use the lowest count so every attack gets a button.
    const range = group.match(/^(\d+)\s*-\s*(\d+)\s+(.+)$/);
    const bare = group.match(/^(\d+)$/);
    const match = range ?? group.match(/^(\d+)\s+(.+)$/);
    const count = Math.max(1, Math.min(12, Number(match?.[1] ?? bare?.[1] ?? 1) || 1));
    let name = fixDiceText(range ? range[3] : match?.[2] ?? (bare ? "Attack" : group))
      .replace(/[.:,]+$/, "")
      .replace(/^(?:per pack|each)\s+/i, "")
      .replace(/^[+\-\s]+/, "")
      .replace(/^./, (letter) => letter.toUpperCase());
    if (!name || /^special$/i.test(name)) name = "Special";
    // "2 claws" means two separate "Claw 1/2" buttons, not "Claws 1/2".
    const singular = count > 1 && /s$/i.test(name) && !/ss$/i.test(name)
      ? name.slice(0, -1) : name;
    for (let index = 1; index <= count; index++) {
      rows.push({ name: count > 1 ? `${singular} ${index}` : name, count, damage: "", note: "" });
    }
  }
  return rows;
}

/**
 * One row per individual monster attack, ready for one macro/button each.
 * Curated `system.attackRows` win; otherwise the stat text is parsed.
 */
export function monsterAttackRows(system = {}, { weapons = [] } = {}) {
  const owned = [...(weapons ?? [])].filter((item) => item?.type === "weapon");
  const weapon = owned.find((item) => item.system?.equipped) ?? owned[0] ?? null;
  const weaponDamage = weapon?.system?.damage ? String(weapon.system.damage) : "";
  const withWeapon = (row, raw = "") => {
    if (!weapon || !weaponDamage) return row;
    const asksForWeapon = /^\s*(?:by|with)?\s*weapon\b/i.test(String(raw));
    if (row.damage && !asksForWeapon) return row;
    row.damage = weaponDamage;
    row.itemId = weapon.id;
    row.weaponName = weapon.name;
    row.attackBonus = Number(weapon.system?.attackBonus) || 0;
    row.magicBonus = Number(weapon.system?.magicBonus) || 0;
    row.damageBonus = Number(weapon.system?.damageBonus) || 0;
    row.attackAbility = weapon.system?.attackAbility === "dex" ? "dex" : "str";
    if (asksForWeapon) row.note = weapon.name;
    return row;
  };

  const stored = Array.isArray(system.attackRows) ? system.attackRows : [];
  if (stored.length) {
    return stored.flatMap((entry) => {
      const count = Math.max(1, Math.min(12, Number(entry?.count) || 1));
      const name = fixDiceText(entry?.name ?? "Attack").replace(/[.:,]+$/, "");
      const note = fixDiceText(entry?.note ?? "");
      return Array.from({ length: count }, (_, index) => withWeapon({
        name: count > 1 ? `${name} ${index + 1}` : name,
        count,
        damage: monsterDamageFormula(entry?.damage),
        note
      }, entry?.damage));
    });
  }

  const attacks = splitModes(system.attacks ?? "");
  const damages = splitModes(system.damage ?? "");
  const rows = [];
  attacks.forEach((mode, modeIndex) => {
    const group = expandAttacks(mode);
    const values = expandGroups(damages[modeIndex] ?? damages[0] ?? "");
    group.forEach((row, index) => {
      const raw = values[index] ?? values[values.length - 1] ?? "";
      row.damage = monsterDamageFormula(raw);
      const extra = raw.replace(/^(\d*d\d+(?:\s*[+-]\s*(?:\d*d\d+|\d+))*)/i, "").trim();
      row.note = extra && !row.damage ? fixDiceText(raw) : "";
      if (extra && row.damage && !/^\d*d\d+/i.test(extra)) row.note = extra.replace(/^[+\-\s]+/, "");
      rows.push(withWeapon(row, raw));
    });
  });
  return rows;
}

/** THAC0 for a monster: the fighter attack column indexed by its Hit Dice. */
export function monsterThac0(hd) {
  const parsed = parseMonsterHitDice(hd);
  const level = Math.max(1, Math.floor(parsed.count || 1));
  return attackNeeded(attackSpecFor("fighter", level, 0).spec, 0);
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
    let value = parseProduct();
    for (;;) {
      skip();
      const operator = text[position];
      if (operator !== "+" && operator !== "-") break;
      position++;
      const right = parseProduct();
      value += operator === "+" ? right : -right;
    }
    return value;
  }

  function parseProduct() {
    let value = parseTerm();
    for (;;) {
      skip();
      const operator = text[position];
      if (operator !== "*" && operator !== "/") break;
      position++;
      const right = parseTerm();
      value = operator === "*" ? value * right : (right ? Math.floor(value / right) : 0);
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
