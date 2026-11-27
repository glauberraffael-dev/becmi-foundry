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
 * Experience awards (RC pp. 12, 127-129)                              *
 * ------------------------------------------------------------------ */

function abilityScore(abilities, key) {
  const entry = abilities?.[key];
  const value = Number(entry?.value ?? entry);
  return Number.isFinite(value) ? value : NaN;
}

/**
 * RC p. 12: the normal prime-requisite scale is -20% at 3-5, -10% at 6-8,
 * none at 9-12, +5% at 13-15 and +10% at 16-18. Elves and halflings use
 * combined requirements; mystics use Strength and acrobatic mystics take an
 * extra -20% (p. 30). Returns an integer percentage.
 */
export function primeRequisiteBonus(classKey, abilities = {}, options = {}) {
  if (options.apply === false) return 0;
  const key = normalizeClassKey(classKey ?? options.classKey);
  const step = (score) => {
    if (!Number.isFinite(score)) return 0;
    if (score <= 5) return -20;
    if (score <= 8) return -10;
    if (score >= 16) return 10;
    if (score >= 13) return 5;
    return 0;
  };

  let percent = 0;
  if (key === "mystic") {
    const str = abilityScore(abilities, "str");
    if (Number.isFinite(str)) {
      if (str <= 5) percent = -10;
      else if (str <= 8) percent = -5;
      else if (str >= 16) percent = 10;
      else if (str >= 13) percent = 5;
    }
  } else if (key === "elf") {
    const str = abilityScore(abilities, "str");
    const int = abilityScore(abilities, "int");
    if (str >= 13 && int >= 16) percent = 10;
    else if (str >= 13 && int >= 13) percent = 5;
  } else if (key === "halfling") {
    const str = abilityScore(abilities, "str");
    const dex = abilityScore(abilities, "dex");
    if (str >= 13 && dex >= 13) percent = 10;
    else if (str >= 13 || dex >= 13) percent = 5;
  } else {
    const requisites = {
      cleric: "wis", fighter: "str", "magic-user": "int", thief: "dex",
      dwarf: "str", druid: "wis", mystic: "str"
    };
    const attribute = requisites[key];
    if (attribute) percent = step(abilityScore(abilities, attribute));
  }

  if (key === "mystic" && options.acrobatic) percent -= 20;
  return percent;
}

/**
 * RC p. 128, Experience Points for Monsters. A plus value is a separate
 * category up to 9 HD; above 21 HD every extra die adds 250 to both columns.
 */
export const MONSTER_XP_TABLE = Object.freeze([
  { hd: "Under 1", base: 5, asterisk: 1 },
  { hd: "1", base: 10, asterisk: 3 },
  { hd: "1+", base: 15, asterisk: 4 },
  { hd: "2", base: 20, asterisk: 5 },
  { hd: "2+", base: 25, asterisk: 10 },
  { hd: "3", base: 35, asterisk: 15 },
  { hd: "3+", base: 50, asterisk: 25 },
  { hd: "4", base: 75, asterisk: 50 },
  { hd: "4+", base: 125, asterisk: 75 },
  { hd: "5", base: 175, asterisk: 125 },
  { hd: "5+", base: 225, asterisk: 175 },
  { hd: "6", base: 275, asterisk: 225 },
  { hd: "6+", base: 350, asterisk: 300 },
  { hd: "7", base: 450, asterisk: 400 },
  { hd: "7+", base: 550, asterisk: 475 },
  { hd: "8", base: 650, asterisk: 550 },
  { hd: "8+", base: 775, asterisk: 625 },
  { hd: "9", base: 900, asterisk: 700 },
  { hd: "9+ to 10", base: 1000, asterisk: 750 },
  { hd: "10+ to 11", base: 1100, asterisk: 800 },
  { hd: "11+ to 12", base: 1250, asterisk: 875 },
  { hd: "12+ to 13", base: 1350, asterisk: 950 },
  { hd: "13+ to 14", base: 1500, asterisk: 1000 },
  { hd: "14+ to 15", base: 1650, asterisk: 1050 },
  { hd: "15+ to 16", base: 1850, asterisk: 1100 },
  { hd: "16+ to 17", base: 2000, asterisk: 1150 },
  { hd: "17+ to 18", base: 2125, asterisk: 1350 },
  { hd: "18+ to 19", base: 2250, asterisk: 1550 },
  { hd: "19+ to 20", base: 2375, asterisk: 1800 },
  { hd: "20+ to 21", base: 2500, asterisk: 2000 }
]);

function monsterXpRow(hd) {
  const raw = String(hd ?? "").replace(/\*/g, " ").replace(/\([^)]*\)/g, " ")
    .replace(/\bhd\b/gi, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!raw || /under\s*1/.test(raw)) return { index: 0, extra: 0 };
  if (/^\d+\s*\/\s*\d+$/.test(raw)) {
    const [top, bottom] = raw.split("/").map(Number);
    return { index: bottom > top ? 0 : 1, extra: 0 };
  }

  const band = raw.match(/^(\d+)\+\s*to\s*(\d+)$/);
  if (band) {
    const upper = Number(band[2]);
    return { index: Math.max(18, Math.min(29, 18 + upper - 10)), extra: 0 };
  }

  // A trailing `+` is the table's plus category (1+, 2+, ...). A number with
  // a positive adjustment (3+1) uses the same category; above 21 it counts as
  // the next higher die for the 250-point increase.
  const plusCategory = raw.match(/^(\d+)\s*\+$/);
  if (plusCategory) {
    const count = Number(plusCategory[1]);
    if (count <= 8) return { index: 2 * count, extra: 0 };
    if (count <= 20) return { index: 18 + count - 9, extra: 0 };
    return { index: 29, extra: (count + 1 - 21) * 250 };
  }

  const parsed = parseMonsterHitDice(raw);
  const count = Math.max(0, Number(parsed.count) || 0);
  const adjustment = Number(parsed.adjustment) || 0;
  const effective = count + (adjustment > 0 ? 1 : 0);
  if (effective < 1) return { index: 0, extra: 0 };
  if (effective === 1) return { index: adjustment > 0 ? 2 : 1, extra: 0 };
  if (effective <= 8) return { index: adjustment > 0 ? 2 * effective : 2 * effective - 1, extra: 0 };
  if (effective === 9) return { index: adjustment > 0 ? 18 : 17, extra: 0 };
  if (effective <= 21) return { index: 18 + effective - 10, extra: 0 };
  return { index: 29, extra: (effective - 21) * 250 };
}

/** Resolve the RC monster XP value from a Hit Dice entry and asterisk count. */
export function monsterXpValue(hd, asterisks) {
  const raw = String(hd ?? "");
  const explicit = Number(asterisks);
  const count = Number.isFinite(explicit)
    ? Math.max(0, Math.floor(explicit))
    : (raw.match(/\*/g) ?? []).length;
  const { index, extra } = monsterXpRow(raw);
  const row = MONSTER_XP_TABLE[index];
  const base = row.base + extra;
  const bonus = row.asterisk + extra;
  return {
    hd: raw,
    row: row.hd,
    base,
    bonusPerAsterisk: bonus,
    asterisks: count,
    xp: base + bonus * count
  };
}

/**
 * RC p. 12/p. 129: at most one level per adventure. Excess XP is retained
 * only up to one point below the threshold for the second level ahead.
 */
export function capXpAdvancement({ classInfo = {}, currentXp = 0, awardedXp = 0, level = 1, applyCap = true } = {}) {
  const awarded = Math.max(0, Number(awardedXp) || 0);
  if (!applyCap) return { awarded, lost: 0, capped: false };
  const max = Math.max(1, Number(classInfo.maxLevel)
    || getRCClass(classInfo.key ?? classInfo.name)?.maxLevel || 36);
  const current = Math.max(1, Number(level) || 1);
  if (current >= max) return { awarded, lost: 0, capped: false };

  const thresholds = xpThresholds(classInfo, max);
  const second = thresholds[current];
  if (!Number.isFinite(second)) return { awarded, lost: 0, capped: false };
  const total = Math.max(0, Number(currentXp) || 0) + awarded;
  if (total < second) return { awarded, lost: 0, capped: false };

  const kept = Math.max(0, second - 1 - Math.max(0, Number(currentXp) || 0));
  return { awarded: kept, lost: Math.max(0, awarded - kept), capped: true, capTotal: second - 1 };
}

const nonNegative = (value) => Math.max(0, Number(value) || 0);
const countOf = (value) => Math.max(0, Math.floor(Number(value) || 0));

/**
 * Full RC XP calculation for one character. Monetary treasure is 1 XP per gp
 * value kept (p. 128); role-playing, exceptional actions and exceptional skill
 * use are each worth 1/20 of the XP needed for the next level (pp. 127-129).
 */
export function calculateXpAward(input = {}) {
  const classInfo = input.classInfo ?? {};
  const classKey = normalizeClassKey(classInfo.key ?? classInfo.name ?? input.classKey);
  const currentXp = nonNegative(input.currentXp);
  const currentLevel = Math.max(1, Number(input.level) || 1);
  const fromLevel = levelForXp(classInfo, currentXp, currentLevel);
  const participants = Math.max(1, countOf(input.participants) || 1);

  const groupMonsterXp = nonNegative(input.monsterXp);
  const defeated = input.outcome !== "defeat" && input.outcome !== "retreat";
  const monsterShare = (groupMonsterXp / participants) * (defeated ? 1 : 0.25);

  const treasureGp = nonNegative(input.treasureGp);
  const treasurePerCharacter = input.splitTreasure ? treasureGp / participants : treasureGp;
  const soldItems = Array.isArray(input.magicItemsSold)
    ? input.magicItemsSold
    : (nonNegative(input.magicCreationGp) ? [{ creationCostGp: input.magicCreationGp }] : []);
  const magicSaleXp = soldItems.reduce((sum, item) => sum + Math.min(
    item?.saleValueGp === undefined ? Infinity : nonNegative(item.saleValueGp),
    nonNegative(item?.creationCostGp) * 0.1
  ), 0);

  const isMystic = classKey === "mystic";
  const donated = Boolean(input.mysticTreasureDonated);
  const treasureXp = isMystic && !donated ? 0 : treasurePerCharacter + magicSaleXp;

  const goalXp = input.goalXp === undefined || input.goalXp === "" || input.goalXp === null
    ? monsterShare : nonNegative(input.goalXp);

  const nextLevelXp = xpForNextLevel(classInfo, fromLevel) ?? 0;
  const exceptionalUnit = Math.round(nextLevelXp / 20);
  const roleplayCount = Math.min(1, countOf(input.roleplayAwards));
  const actionCount = countOf(input.exceptionalActions) + countOf(input.exceptionalSkillUses);
  const roleplayXp = roleplayCount * exceptionalUnit;
  const exceptionalXp = actionCount * exceptionalUnit;

  const baseXp = monsterShare + treasureXp + goalXp + roleplayXp + exceptionalXp
    + nonNegative(input.otherXp);
  const roundedBase = Math.round(baseXp);
  const percent = primeRequisiteBonus(classKey, input.abilities, {
    apply: input.applyPrimeRequisite !== false,
    acrobatic: Boolean(input.acrobaticMystic)
  });
  const primeXp = Math.round(roundedBase * percent / 100);
  const earned = Math.max(0, roundedBase + primeXp);

  const cap = capXpAdvancement({
    classInfo,
    currentXp,
    awardedXp: earned,
    level: fromLevel,
    applyCap: input.applyLevelCap !== false
  });
  const finalXp = currentXp + cap.awarded;
  const finalLevel = levelForXp(classInfo, finalXp, fromLevel);
  const notes = [];
  if (defeated) notes.push(`Monsters: ${groupMonsterXp} XP split among ${participants} participants.`);
  else notes.push(`Failed to defeat the monsters: one-quarter of the calculated monster XP.`);
  if (input.splitTreasure) notes.push(`Treasure value divided among ${participants} participants.`);
  if (magicSaleXp > 0) notes.push(`Magical item sale XP capped at 10% of creation cost.`);
  if (isMystic && treasureGp > 0) {
    notes.push(donated
      ? "Mystic treasure counts only when donated to the needy; 10% must be tithed to the cloister."
      : "Mystics earn no XP from treasure unless it is donated to the needy.");
  }
  if (percent) notes.push(`Prime requisite: ${percent > 0 ? "+" : ""}${percent}% to all XP earned.`);
  if (cap.capped) notes.push(`Maximum one level per adventure: ${cap.lost} XP lost.`);

  return {
    classKey,
    fromLevel,
    nextLevelXp,
    exceptionalUnit,
    participants,
    monsterXp: groupMonsterXp,
    monsterShare: Math.round(monsterShare * 100) / 100,
    treasureXp: Math.round(treasureXp * 100) / 100,
    goalXp: Math.round(goalXp * 100) / 100,
    roleplayXp,
    exceptionalXp,
    otherXp: nonNegative(input.otherXp),
    baseXp: roundedBase,
    primePercent: percent,
    primeXp,
    earnedXp: earned,
    awardedXp: cap.awarded,
    lostXp: cap.lost,
    capped: cap.capped,
    currentXp,
    finalXp,
    finalLevel,
    levelGained: Math.max(0, finalLevel - fromLevel),
    notes
  };
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

/* ------------------------------------------------------------------ *
 * Optional general skills (RC pp. 81-87)                              *
 * ------------------------------------------------------------------ */

/**
 * Sample Skills Table. `choice` marks entries the RC prints as
 * "choose type/terrain/immortal/culture"; the sheet gives those rows a free
 * text field so the player can record the chosen specialty. `Art` appears in
 * both the Intelligence and Wisdom columns; the default is Intelligence and
 * the stored row can override the ability when the DM allows it.
 */
export const GENERAL_SKILLS = Object.freeze([
  ["intimidation", "str"], ["muscle", "str"], ["wrestling", "str"],

  ["alchemy", "int"], ["alternateMagics", "int"], ["art", "int", true],
  ["artillery", "int"], ["craft", "int", true], ["disguise", "int"],
  ["engineering", "int"], ["fireBuilding", "int"], ["healing", "int"],
  ["hunting", "int"], ["knowledge", "int", true], ["labor", "int"],
  ["language", "int", true], ["lipReading", "int"], ["magicalEngineering", "int"],
  ["mapping", "int"], ["militaryTactics", "int"], ["mimicry", "int"],
  ["natureLore", "int"], ["navigation", "int"], ["planarGeography", "int"],
  ["profession", "int", true], ["science", "int", true], ["shipbuilding", "int"],
  ["signaling", "int", true], ["snares", "int"], ["survival", "int", true],
  ["tracking", "int"], ["veterinaryHealing", "int"],

  ["animalTraining", "wis", true], ["bravery", "wis"], ["caving", "wis"],
  ["ceremony", "wis", true], ["dangerSense", "wis"], ["detectDeception", "wis"],
  ["gambling", "wis"], ["lawAndJustice", "wis", true], ["mysticism", "wis"],

  ["acrobatics", "dex"], ["alertness", "dex"], ["blindShooting", "dex"],
  ["cheating", "dex"], ["escape", "dex"], ["mountaineering", "dex"],
  ["piloting", "dex", true], ["quickDraw", "dex"], ["riding", "dex", true],
  ["stealth", "dex", true],

  ["endurance", "con"], ["foodTasting", "con"],

  ["acting", "cha"], ["bargaining", "cha"], ["deception", "cha"],
  ["leadership", "cha"], ["music", "cha", true], ["persuasion", "cha"],
  ["singing", "cha"], ["storytelling", "cha"]
].map(([key, ability, choice]) => Object.freeze({ key, ability, choice: Boolean(choice) })));

export const GENERAL_SKILL_KEYS = Object.freeze(GENERAL_SKILLS.map((skill) => skill.key));

const GENERAL_SKILL_BY_KEY = new Map(GENERAL_SKILLS.map((skill) => [skill.key, skill]));

/** Resolve a catalog entry, allowing only the RC's Wisdom-based Art choice. */
export function generalSkillInfo(key, ability) {
  const skill = GENERAL_SKILL_BY_KEY.get(String(key ?? ""));
  if (!skill) return null;
  return skill.key === "art" && ability === "wis" ? { ...skill, ability: "wis" } : skill;
}

const HUMAN_SKILL_LEVELS = [5, 9, 13, 17, 21, 25, 29, 33];
const DEMIHUMAN_SKILL_XP = {
  dwarf: [1200000, 2000000],
  elf: [1350000, 2350000],
  halfling: [300000, 1500000]
};

/** Starting slots (4 + INT bonus) plus the level/XP acquisitions in the RC. */
export function generalSkillSlots(className, level = 1, xp = 0, intelligence = 10) {
  const score = Number(intelligence) || 10;
  const bonus = score >= 18 ? 3 : score >= 16 ? 2 : score >= 13 ? 1 : 0;
  let slots = 4 + bonus;
  const key = normalizeClassKey(className);
  const earned = Math.max(0, Number(xp) || 0);
  const current = Math.max(1, Number(level) || 1);
  if (DEMIHUMAN_SKILL_XP[key]) {
    if (current >= 5) slots++;
    if (key !== "halfling" && current >= 9) slots++;
    for (const threshold of DEMIHUMAN_SKILL_XP[key]) if (earned >= threshold) slots++;
  } else {
    for (const minimum of HUMAN_SKILL_LEVELS) if (current >= minimum) slots++;
  }
  return slots;
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

/* ------------------------------------------------------------------ *
 * Encounters, surprise, reactions, distance and evasion (RC Ch. 7) 
 * ------------------------------------------------------------------ */

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const numeric = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/** RC p. 92: terrain classes for the Chance of Encounter Table. */
export const ENCOUNTER_TERRAIN_CLASSES = Object.freeze({
  clear: "open",
  grasslands: "open",
  inhabited: "open",
  settled: "open",
  forest: "difficult",
  river: "difficult",
  hills: "difficult",
  barren: "difficult",
  desert: "difficult",
  ocean: "difficult",
  aerial: "difficult",
  swamp: "severe",
  jungle: "severe",
  mountains: "severe"
});

const CHANCE_THRESHOLDS = { open: 1, difficult: 2, severe: 3 };

/** Normalize terrain names used by the encounter UI and the monster tables. */
export function encounterTerrainKey(value) {
  const raw = String(value ?? "").toLowerCase().trim()
    .replace(/[-\s]+/g, " ")
    .replace(/\b(land|lands|wood|woods)\b/g, (word) => word === "woods" ? "forest" : word);
  const aliases = {
    "clear grassland": "clear", "grass land": "grasslands", "grassland": "grasslands",
    "barren land": "barren", "barren lands": "barren", "open": "clear", "wood": "forest",
    "mountain": "mountains", "sea": "ocean", "air": "aerial", "sky": "aerial",
    "town": "settled", "city": "settled", "village": "inhabited"
  };
  const key = aliases[raw] ?? raw;
  return key in ENCOUNTER_TERRAIN_CLASSES ? key : "clear";
}

/**
 * RC p. 92 Chance of Encounter Table. Dungeon/city uses 1d6 every two turns
 * and 1d12 at night; wilderness uses 1d6 by day and 1d12 at night.
 */
export function encounterChance({ area = "wilderness", terrain = "clear", night = false } = {}) {
  const setting = String(area ?? "wilderness").toLowerCase().trim();
  const isDungeon = ["dungeon", "city", "town", "indoor"].includes(setting);
  const terrainKey = encounterTerrainKey(terrain);
  const terrainClass = ENCOUNTER_TERRAIN_CLASSES[terrainKey];
  const threshold = isDungeon ? 1 : (CHANCE_THRESHOLDS[terrainClass] ?? 1);
  const faces = night ? 12 : 6;
  return {
    area: setting,
    terrain: terrainKey,
    terrainClass: isDungeon ? "dungeon" : terrainClass,
    formula: `1d${faces}`,
    faces,
    threshold,
    target: threshold === 1 ? "1" : `1-${threshold}`,
    frequency: isDungeon ? "every 2 turns" : (night ? "once at night" : "once during the day"),
    note: terrainKey === "ocean" && threshold > 1
      ? "A 2 is no encounter unless the ship lands at the end of the day."
      : terrainKey === "aerial"
        ? "Aerial encounters always use the Flyers subtable."
        : null
  };
}

/** Roll a random encounter check. A supplied `roll` makes the check deterministic. */
export function encounterCheck(input = {}, rng = Math.random) {
  const chance = encounterChance(input);
  const roll = input?.roll === undefined || input?.roll === null || input?.roll === ""
    ? rollExpression(chance.formula, rng).total
    : clamp(Math.round(numeric(input.roll, 1)), 1, chance.faces);
  return { ...chance, roll, encounter: roll <= chance.threshold };
}

/**
 * RC pp. 91-93: each side rolls 1d6; 1-2 is surprised. A surprised side
 * loses initiative automatically; otherwise 1d6 per side decides who acts.
 */
export function surpriseCheck(input = {}, rng = Math.random) {
  const rollD6 = (value) => value === undefined || value === null || value === ""
    ? rollExpression("1d6", rng).total
    : clamp(Math.round(numeric(value, 3)), 1, 6);
  const partyRoll = rollD6(input?.partyRoll);
  const monsterRoll = rollD6(input?.monsterRoll);
  const partySurprised = partyRoll <= 2;
  const monsterSurprised = monsterRoll <= 2;
  let state = "neither";
  if (partySurprised && monsterSurprised) state = "both";
  else if (partySurprised) state = "party";
  else if (monsterSurprised) state = "monsters";

  let first = null;
  let automatic = false;
  let partyInitiativeRoll = null;
  let monsterInitiativeRoll = null;
  if (state === "party") {
    first = "monsters";
    automatic = true;
  } else if (state === "monsters") {
    first = "party";
    automatic = true;
  } else {
    partyInitiativeRoll = rollD6(input?.partyInitiativeRoll);
    monsterInitiativeRoll = rollD6(input?.monsterInitiativeRoll);
    if (partyInitiativeRoll > monsterInitiativeRoll) first = "party";
    else if (monsterInitiativeRoll > partyInitiativeRoll) first = "monsters";
    else first = "tie";
  }

  return {
    state,
    partyRoll,
    monsterRoll,
    partySurprised,
    monsterSurprised,
    lostRound: state === "both",
    freeRound: state === "party" || state === "monsters",
    initiative: { first, automatic, partyRoll: partyInitiativeRoll, monsterRoll: monsterInitiativeRoll }
  };
}

/** RC p. 93 Monster Reactions Table (2d6). */
export const REACTION_OUTCOMES = Object.freeze([
  { key: "attack", min: 2, max: 3, label: "Monster attacks", reroll: false, nextModifier: 0 },
  {
    key: "aggressive", min: 4, max: 6,
    label: "Monster is aggressive (growls, threatens); roll again in one round with a penalty of -4 to the roll",
    reroll: true, nextModifier: -4
  },
  { key: "cautious", min: 7, max: 9, label: "Monster is cautious; roll again in one round", reroll: true, nextModifier: 0 },
  {
    key: "neutral", min: 10, max: 11,
    label: "Monster is neutral; roll again in one round with a bonus of +4 to the roll",
    reroll: true, nextModifier: 4
  },
  { key: "friendly", min: 12, max: 12, label: "Monster is friendly", reroll: false, nextModifier: 0 }
]);

export function reactionBand(total) {
  const value = Math.round(numeric(total, 2));
  return REACTION_OUTCOMES.find((band) => value >= band.min && value <= band.max) ?? REACTION_OUTCOMES[0];
}

/**
 * One 2d6 reaction roll. The first roll ignores Charisma; later rolls add
 * Charisma, PC actions (±2) and the modifier carried by the previous result.
 * RC allows at most three rolls, and a third roll below 10 attacks or leaves.
 */
export function reactionStep(input = {}, rng = Math.random) {
  const attempt = clamp(Math.round(numeric(input?.attempt, 1)), 1, 3);
  const raw = input?.roll === undefined || input?.roll === null || input?.roll === ""
    ? rollExpression("2d6", rng).total
    : Math.round(numeric(input.roll, 7));
  const first = attempt === 1;
  const charisma = Math.round(numeric(input?.charisma, 0));
  const action = clamp(Math.round(numeric(input?.action, 0)), -2, 2);
  const pendingModifier = Math.round(numeric(input?.pendingModifier, 0));
  const modifier = first ? 0 : charisma + action + pendingModifier;
  const total = raw + modifier;
  const band = reactionBand(total);
  const reroll = band.reroll && attempt < 3;
  const forcedOutcome = attempt >= 3 && total < 10 ? "attacks or leaves" : null;
  return {
    attempt,
    raw,
    charisma: first ? 0 : charisma,
    action: first ? 0 : action,
    pendingModifier: first ? 0 : pendingModifier,
    modifier,
    total,
    band,
    reroll,
    forcedOutcome,
    done: !reroll,
    state: {
      attempt: reroll ? attempt + 1 : attempt,
      pendingModifier: reroll ? band.nextModifier : 0,
      done: !reroll
    }
  };
}

/** RC p. 93 Encounter Distances Table. */
export const ENCOUNTER_DISTANCES = Object.freeze([
  { setting: "dungeon", visibility: "bright", encounter: "any", formula: "4d6", unit: "ft" },
  { setting: "dungeon", visibility: "dim", encounter: "any", formula: "2d6", unit: "ft" },
  { setting: "dungeon", visibility: "none", encounter: "any", formula: "1d4", unit: "ft" },
  { setting: "wilderness", visibility: "bright", encounter: "any", formula: "4d6", unit: "yards" },
  { setting: "wilderness", visibility: "dim", encounter: "any", formula: "2d6", unit: "yards" },
  { setting: "wilderness", visibility: "none", encounter: "any", formula: "1d4", unit: "yards" },
  { setting: "ocean", visibility: "bright", encounter: "ship", formula: null, distance: 300, unit: "yards" },
  { setting: "ocean", visibility: "bright", encounter: "monster", formula: "4d6", unit: "yards" },
  { setting: "ocean", visibility: "dim", encounter: "ship", formula: null, distance: 120, unit: "yards" },
  { setting: "ocean", visibility: "dim", encounter: "monster", formula: "2d6", unit: "yards" },
  { setting: "ocean", visibility: "none", encounter: "ship", formula: null, distance: 40, unit: "yards" },
  { setting: "ocean", visibility: "none", encounter: "monster", formula: "1d4", unit: "yards" },
  { setting: "undersea", visibility: "any", encounter: "any", formula: "1d6", unit: "yards" }
]);

function encounterDistanceRow(setting, visibility, encounter) {
  const aliases = { indoor: "dungeon", city: "dungeon", sea: "ocean", underwater: "undersea" };
  const wantedSetting = aliases[setting] ?? setting;
  const visibilityAliases = { veryGood: "bright", good: "bright", dark: "none", poor: "none" };
  const wantedVisibility = visibilityAliases[visibility] ?? visibility;
  return ENCOUNTER_DISTANCES.find((row) => row.setting === wantedSetting
    && (row.visibility === wantedVisibility || row.visibility === "any")
    && (row.encounter === encounter || row.encounter === "any"))
    ?? ENCOUNTER_DISTANCES[0];
}

/**
 * RC p. 92: surprise replaces the table with 1d4 x 10; a single surprised
 * side notices at half the rolled distance.
 */
export function encounterDistance(input = {}, rng = Math.random) {
  const setting = String(input?.setting ?? input?.area ?? "dungeon").toLowerCase().trim();
  const visibility = String(input?.visibility ?? "bright").toLowerCase().trim();
  const encounter = String(input?.encounter ?? "monster").toLowerCase().trim();
  const surprise = ["both", "party", "monsters"].includes(input?.surprise) ? input.surprise : "none";
  const surprised = surprise !== "none";
  const row = surprised
    ? { setting, visibility, encounter: "any", formula: "1d4", unit: setting === "dungeon" ? "ft" : "yards" }
    : encounterDistanceRow(setting, visibility, encounter);
  const roll = row.formula
    ? (input?.roll === undefined || input?.roll === null || input?.roll === ""
      ? rollExpression(row.formula, rng).total
      : Math.round(numeric(input.roll, 1)))
    : row.distance;
  const unitValue = row.unit === "ft" ? 10 : 10;
  const distance = row.formula ? roll * unitValue : row.distance;
  return {
    setting,
    visibility,
    encounter,
    surprise,
    formula: row.formula,
    unit: row.unit,
    roll,
    distance,
    surprisedDistance: surprised && surprise !== "both" ? distance / 2 : null,
    fixed: !row.formula
  };
}

/** RC p. 91: wandering monsters appear 2d6 x 10 ft away. */
export function wanderingMonsterDistance(input = {}, rng = Math.random) {
  const roll = input?.roll === undefined || input?.roll === null || input?.roll === ""
    ? rollExpression("2d6", rng).total
    : Math.round(numeric(input.roll, 2));
  return { formula: "2d6", unit: "ft", roll, distance: roll * 10 };
}

/** RC p. 99 Evasion Table, indexed by party size then monsters encountered. */
export const EVASION_TABLE = Object.freeze([
  {
    party: [1, 4], ranges: [[1, 1, 50], [2, 3, 70], [4, Infinity, 90]]
  },
  {
    party: [5, 12], ranges: [[1, 3, 35], [4, 8, 50], [9, Infinity, 70]]
  },
  {
    party: [13, 24], ranges: [[1, 6, 25], [7, 16, 35], [17, Infinity, 50]]
  },
  {
    party: [25, Infinity], ranges: [[1, 10, 10], [11, 30, 25], [31, Infinity, 35]]
  }
]);

/** RC p. 99 Evasion Table adjustments; the prose also mentions scouts at -10%. */
export const EVASION_ADJUSTMENTS = Object.freeze({
  wooded: 25,
  featureless: -15,
  pursuersFaster: -25,
  evadersFaster: 25,
  scouts: -15
});

export function evasionChance(input = {}) {
  const partySize = Math.max(1, Math.round(numeric(input?.partySize, 1)));
  const monsterCount = Math.max(1, Math.round(numeric(input?.monsterCount, 1)));
  const row = EVASION_TABLE.find((entry) => partySize >= entry.party[0] && partySize <= entry.party[1])
    ?? EVASION_TABLE[0];
  const band = row.ranges.find(([low, high]) => monsterCount >= low && monsterCount <= high)
    ?? row.ranges.at(-1);
  const namedAdjustments = Object.fromEntries(Object.entries(EVASION_ADJUSTMENTS).map(([key, value]) => [
    key, Boolean(input?.adjustments?.[key]) ? value : 0
  ]));
  const custom = numeric(input?.adjustments?.custom, 0);
  const totalAdjustment = Object.values(namedAdjustments).reduce((sum, value) => sum + value, custom);
  const chance = clamp(band[2] + totalAdjustment, 5, 100);
  return {
    partySize,
    monsterCount,
    partyBand: row.party[1] === Infinity ? `${row.party[0]}+` : `${row.party[0]}-${row.party[1]}`,
    monsterBand: band[1] === Infinity ? `${band[0]}+` : `${band[0]}-${band[1]}`,
    base: band[2],
    adjustments: namedAdjustments,
    custom,
    totalAdjustment,
    chance
  };
}

/** Roll a d100 evasion attempt; the evader always has at least a 5% chance. */
export function evasionCheck(input = {}, rng = Math.random) {
  const chance = evasionChance(input);
  const roll = input?.roll === undefined || input?.roll === null || input?.roll === ""
    ? 1 + Math.floor(rng() * 100)
    : clamp(Math.round(numeric(input.roll, 1)), 1, 100);
  return { ...chance, roll, success: roll <= chance.chance, failure: roll > chance.chance };
}

/** RC p. 99: chase rounds use 1d6 per side and a morale check every 5 rounds. */
export function pursuitRound(input = {}, rng = Math.random) {
  const round = Math.max(1, Math.round(numeric(input?.round, 1)));
  const rollD6 = (value) => value === undefined || value === null || value === ""
    ? rollExpression("1d6", rng).total
    : clamp(Math.round(numeric(value, 3)), 1, 6);
  const partyRoll = rollD6(input?.partyRoll);
  const monsterRoll = rollD6(input?.monsterRoll);
  const first = partyRoll > monsterRoll ? "party" : monsterRoll > partyRoll ? "monsters" : "tie";
  return {
    round,
    partyRoll,
    monsterRoll,
    first,
    moraleCheckDue: round % 5 === 0
  };
}

/* ------------------------------------------------------------------ *
 * Treasure (RC pp. 224-231). Coins in lairs are given in thousands;   *
 * carried coins are pieces per individual. "Nil" means "do not roll". *
 * ------------------------------------------------------------------ */

export const TREASURE_TYPES = Object.freeze({
  A: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "25% 1d6", sp: "30% 1d6", ep: "20% 1d4", gp: "35% 2d6", pp: "25% 1d2" }),
      gems: "50% 6d6", jewelry: "50% 6d6", special: "10% 1d2", magic: "30% Any 3"
    }),
    averageGp: 17000
  }),
  B: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "50% 1d8", sp: "25% 1d6", ep: "25% 1d4", gp: "35% 1d3", pp: "Nil" }),
      gems: "25% 1d6", jewelry: "25% 1d6", special: "Nil",
      magic: "10% 1 sword, miscellaneous weapon, or armor"
    }),
    averageGp: 2000
  }),
  C: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "20% 1d12", sp: "30% 1d4", ep: "10% 1d4", gp: "Nil", pp: "Nil" }),
      gems: "25% 1d4", jewelry: "25% 1d4", special: "5% 1d2", magic: "10% Any 2"
    }),
    averageGp: 750
  }),
  D: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "10% 1d8", sp: "15% 2d12", ep: "Nil", gp: "60% 1d6", pp: "Nil" }),
      gems: "30% 1d8", jewelry: "30% 1d8", special: "10% 1d2", magic: "15% Any 2 + 1 potion"
    }),
    averageGp: 4000
  }),
  E: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "5% 1d10", sp: "30% 2d12", ep: "25% 1d4", gp: "25% 1d8", pp: "Nil" }),
      gems: "10% 1d10", jewelry: "10% 1d10", special: "15% 1d2", magic: "25% Any 3 + 1 scroll"
    }),
    averageGp: 2500
  }),
  F: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "Nil", sp: "10% 2d10", ep: "20% 1d8", gp: "45% 1d12", pp: "30% 1d3" }),
      gems: "20% 2d12", jewelry: "10% 1d12", special: "20% 1d3",
      magic: "30% 1 potion, 1 scroll, +3 any but weapons"
    }),
    averageGp: 7600
  }),
  G: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "Nil", sp: "Nil", ep: "Nil", gp: "50% 1d4 x 10", pp: "50% 1d6 x 10" }),
      gems: "25% 3d6", jewelry: "25% 1d10", special: "30% 1d3", magic: "35% Any 4 + 1 scroll"
    }),
    averageGp: 25000
  }),
  H: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "25% 3d8", sp: "50% 1d100", ep: "50% 1d4 x 10", gp: "50% 1d6 x 10", pp: "25% 5d4" }),
      gems: "50% 1d100", jewelry: "50% 1d4 x 10", special: "10% 1d2",
      magic: "15% 1 potion + 1 scroll + any 4"
    }),
    averageGp: 60000
  }),
  I: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "Nil", sp: "Nil", ep: "Nil", gp: "Nil", pp: "30% 1d8" }),
      gems: "50% 2d6", jewelry: "50% 2d6", special: "5% 1d2", magic: "15% Any 1"
    }),
    averageGp: 7500
  }),
  J: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "25% 1d4", sp: "10% 1d3", ep: "Nil", gp: "Nil", pp: "Nil" }),
      gems: "Nil", jewelry: "Nil", special: "Nil", magic: "Nil"
    }),
    averageGp: 25
  }),
  K: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "Nil", sp: "30% 1d6", ep: "10% 1d2", gp: "Nil", pp: "Nil" }),
      gems: "Nil", jewelry: "Nil", special: "Nil", magic: "Nil"
    }),
    averageGp: 250
  }),
  L: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "Nil", sp: "Nil", ep: "Nil", gp: "Nil", pp: "Nil" }),
      gems: "50% 1d4", jewelry: "Nil", special: "Nil", magic: "Nil"
    }),
    averageGp: 225
  }),
  M: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "Nil", sp: "Nil", ep: "Nil", gp: "40% 2d4", pp: "50% 3d10" }),
      gems: "55% 5d4", jewelry: "45% 2d6", special: "Nil", magic: "Nil"
    }),
    averageGp: 50000
  }),
  N: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "Nil", sp: "Nil", ep: "Nil", gp: "Nil", pp: "Nil" }),
      gems: "Nil", jewelry: "Nil", special: "10% 1d2", magic: "40% 2d4 potions"
    })
  }),
  O: Object.freeze({
    lair: Object.freeze({
      coins: Object.freeze({ cp: "Nil", sp: "Nil", ep: "Nil", gp: "Nil", pp: "Nil" }),
      gems: "Nil", jewelry: "Nil", special: "10% 1d3", magic: "50% 1d4 scrolls"
    })
  }),
  P: Object.freeze({
    carried: Object.freeze({
      coins: Object.freeze({ cp: "3d8", sp: "Nil", ep: "Nil", gp: "Nil", pp: "Nil" }),
      gems: "Nil", jewelry: "Nil", special: "Nil", magic: "Nil"
    })
  }),
  Q: Object.freeze({
    carried: Object.freeze({
      coins: Object.freeze({ cp: "Nil", sp: "3d6", ep: "Nil", gp: "Nil", pp: "Nil" }),
      gems: "Nil", jewelry: "Nil", special: "Nil", magic: "Nil"
    })
  }),
  R: Object.freeze({
    carried: Object.freeze({
      coins: Object.freeze({ cp: "Nil", sp: "Nil", ep: "2d6", gp: "Nil", pp: "Nil" }),
      gems: "Nil", jewelry: "Nil", special: "Nil", magic: "Nil"
    })
  }),
  S: Object.freeze({
    carried: Object.freeze({
      coins: Object.freeze({ cp: "Nil", sp: "Nil", ep: "Nil", gp: "2d4", pp: "Nil" }),
      gems: "5% 1", jewelry: "Nil", special: "Nil", magic: "Nil"
    })
  }),
  T: Object.freeze({
    carried: Object.freeze({
      coins: Object.freeze({ cp: "Nil", sp: "Nil", ep: "Nil", gp: "Nil", pp: "1d6" }),
      gems: "5% 1", jewelry: "Nil", special: "Nil", magic: "Nil"
    })
  }),
  U: Object.freeze({
    carried: Object.freeze({
      coins: Object.freeze({ cp: "10% 1d100", sp: "10% 1d100", ep: "Nil", gp: "5% 1d100", pp: "Nil" }),
      gems: "5% 1d2", jewelry: "5% 1d4", special: "2% Any 1", magic: "2% Any 1"
    })
  }),
  V: Object.freeze({
    carried: Object.freeze({
      coins: Object.freeze({ cp: "Nil", sp: "10% 1d100", ep: "5% 1d100", gp: "10% 1d100", pp: "5% 1d100" }),
      gems: "10% 1d2", jewelry: "10% 1d4", special: "5% Any 1", magic: "5% Any 1"
    })
  })
});

export const COIN_VALUE_GP = Object.freeze({ cp: 0.01, sp: 0.1, ep: 0.2, gp: 1, pp: 5 });

/** Resolve a letter code and pick the lair or carried table. */
export function treasureTypeInfo(type, location = "auto") {
  const key = String(type ?? "").trim().toUpperCase();
  const entry = TREASURE_TYPES[key];
  if (!entry) return null;
  const table = location === "lair" || location === "carried"
    ? (entry[location] ? location : (entry.lair ? "lair" : "carried"))
    : (entry.lair ? "lair" : "carried");
  return { key, table, row: entry[table], averageGp: entry.averageGp ?? null };
}

function treasureCell(text) {
  const value = String(text ?? "").trim();
  if (!value || /^nil$/i.test(value)) return null;
  const match = value.match(/^(\d+)%\s*(.+)$/);
  if (!match) return { chance: null, recipe: value };
  return { chance: Number(match[1]), recipe: match[2].trim() };
}

function treasureCount(recipe, rng) {
  const anyCount = recipe.match(/^Any\s+(\d+)/i);
  if (anyCount) return { count: Number(anyCount[1]), dice: null, text: recipe };
  const special = recipe.match(/^(.+?)\s*\(([^)]*d[^)]*)\)$/);
  const dice = special ? special[2] : (recipe.match(/^\d+d\d+(?:\s*\+\s*\d+)?/) ?? [null])[0];
  return {
    count: dice ? rollExpression(dice.replace(/\s*x\s*/gi, " * "), rng).total : 1,
    dice: dice ?? null,
    text: special ? special[1].trim() : recipe.replace(/^\d+d\d+(?:\s*\+\s*\d+)?\s*/, "").trim() || recipe
  };
}

/**
 * RC pp. 225-226 random treasure checklist. Chance rolls are d100 ("the number
 * shown or less"); amounts are dice, with lair coins multiplied by 1,000.
 */
export function rollTreasureType(input = {}, rng = Math.random) {
  const info = treasureTypeInfo(input?.type, input?.location ?? "auto");
  if (!info) return null;
  const rollD100 = () => 1 + Math.floor(rng() * 100);
  const rollCell = (cellText, { multiply = 1 } = {}) => {
    const cell = treasureCell(cellText);
    if (!cell) return null;
    const roll = cell.chance === null ? null : rollD100();
    const found = cell.chance === null ? true : roll <= cell.chance;
    const details = found ? treasureCount(cell.recipe, rng) : { count: 0, dice: null, text: cell.recipe };
    return { chance: cell.chance, roll, found, recipe: cell.recipe, ...details, amount: found ? details.count * multiply : 0 };
  };
  const coins = Object.fromEntries(Object.entries(info.row.coins).map(([coin, cell]) => [
    coin, rollCell(cell, { multiply: info.table === "lair" ? 1000 : 1 })
  ]));
  const coinGp = Object.entries(coins).reduce((sum, [coin, result]) => sum + (result?.amount ?? 0) * COIN_VALUE_GP[coin], 0);
  return {
    type: info.key,
    location: info.table,
    averageGp: info.averageGp,
    coins,
    coinGp,
    gems: rollCell(info.row.gems),
    jewelry: rollCell(info.row.jewelry),
    special: rollCell(info.row.special),
    magic: rollCell(info.row.magic)
  };
}

/** RC p. 226 Gem Value Table; below level 9 the d100 roll is lowered by 10. */
export const GEM_VALUES = Object.freeze([
  Object.freeze({ min: 1, max: 3, value: 10, examples: "Agate, quartz, turquoise" }),
  Object.freeze({ min: 4, max: 10, value: 50, examples: "Crystal, jasper, onyx" }),
  Object.freeze({ min: 11, max: 25, value: 100, examples: "Amber, amethyst, coral, garnet, jade" }),
  Object.freeze({ min: 26, max: 46, value: 500, examples: "Aquamarine, pearl, topaz" }),
  Object.freeze({ min: 47, max: 71, value: 1000, examples: "Carbuncle, opal" }),
  Object.freeze({ min: 72, max: 90, value: 5000, examples: "Emerald, ruby, sapphire" }),
  Object.freeze({ min: 91, max: 97, value: 10000, examples: "Diamond, jacinth" }),
  Object.freeze({ min: 98, max: 100, value: null, examples: "Starstone, tristal" })
]);

/** RC p. 227 Jewelry Value Table; the same -10 modifier applies below level 9. */
export const JEWELRY_VALUES = Object.freeze([
  Object.freeze({ min: 1, max: 1, value: 100, enc: 10 }),
  Object.freeze({ min: 2, max: 3, value: 500, enc: 10 }),
  Object.freeze({ min: 4, max: 6, value: 1000, enc: 10 }),
  Object.freeze({ min: 7, max: 10, value: 1500, enc: 10 }),
  Object.freeze({ min: 11, max: 16, value: 2000, enc: 10 }),
  Object.freeze({ min: 17, max: 24, value: 2500, enc: 10 }),
  Object.freeze({ min: 25, max: 34, value: 3000, enc: 25 }),
  Object.freeze({ min: 35, max: 45, value: 4000, enc: 25 }),
  Object.freeze({ min: 46, max: 58, value: 5000, enc: 25 }),
  Object.freeze({ min: 59, max: 69, value: 7500, enc: 25 }),
  Object.freeze({ min: 70, max: 78, value: 10000, enc: 25 }),
  Object.freeze({ min: 79, max: 85, value: 15000, enc: 25 }),
  Object.freeze({ min: 86, max: 90, value: 20000, enc: 50 }),
  Object.freeze({ min: 91, max: 94, value: 25000, enc: 50 }),
  Object.freeze({ min: 95, max: 97, value: 30000, enc: 50 }),
  Object.freeze({ min: 98, max: 99, value: 40000, enc: 50 }),
  Object.freeze({ min: 100, max: 100, value: 50000, enc: 50 })
]);

function adjustedTreasureRoll(roll, averageLevel) {
  const raw = clamp(Math.round(numeric(roll, 1)), 1, 100);
  return { raw, adjusted: numeric(averageLevel, 9) < 9 ? Math.max(1, raw - 10) : raw };
}

export function gemValue(input = {}, rng = Math.random) {
  const roll = input?.roll === undefined || input?.roll === null || input?.roll === ""
    ? 1 + Math.floor(rng() * 100) : input.roll;
  const adjusted = adjustedTreasureRoll(roll, input?.averageLevel);
  const row = GEM_VALUES.find((entry) => adjusted.adjusted >= entry.min && adjusted.adjusted <= entry.max)
    ?? GEM_VALUES[0];
  return { ...adjusted, value: row.value, examples: row.examples };
}

export function jewelryValue(input = {}, rng = Math.random) {
  const roll = input?.roll === undefined || input?.roll === null || input?.roll === ""
    ? 1 + Math.floor(rng() * 100) : input.roll;
  const adjusted = adjustedTreasureRoll(roll, input?.averageLevel);
  const row = JEWELRY_VALUES.find((entry) => adjusted.adjusted >= entry.min && adjusted.adjusted <= entry.max)
    ?? JEWELRY_VALUES[0];
  return { ...adjusted, value: row.value, enc: row.enc };
}

/** RC p. 228 Magical Items Main Table. */
export const MAGIC_ITEM_CATEGORIES = Object.freeze([
  Object.freeze({ min: 1, max: 25, key: "potions", name: "Potion" }),
  Object.freeze({ min: 26, max: 37, key: "scrolls", name: "Scroll" }),
  Object.freeze({ min: 38, max: 46, key: "wands", name: "Wand, staff, or rod" }),
  Object.freeze({ min: 47, max: 52, key: "rings", name: "Ring" }),
  Object.freeze({ min: 53, max: 62, key: "miscellaneous", name: "Miscellaneous magical item" }),
  Object.freeze({ min: 63, max: 72, key: "armor", name: "Armor or shield" }),
  Object.freeze({ min: 73, max: 83, key: "missiles", name: "Missile weapon or missile" }),
  Object.freeze({ min: 84, max: 92, key: "swords", name: "Sword" }),
  Object.freeze({ min: 93, max: 100, key: "miscWeapons", name: "Miscellaneous weapon" })
]);

function rangeValue(text) {
  const value = String(text).trim();
  return value === "00" ? 100 : Number(value);
}

function rangeRows(entries) {
  return Object.freeze(entries.map(([range, name]) => {
    const [low, high] = String(range).split("-").map(rangeValue);
    return Object.freeze({ min: low, max: high ?? low, name });
  }));
}

/** RC pp. 229-231 Magical Item Subtables 1-9. */
export const MAGIC_ITEM_SUBTABLES = Object.freeze({
  potions: rangeRows([
    ["01-02", "Agility"], ["03", "Animal Control"], ["04-06", "Antidote"],
    ["07-08", "Blending"], ["09-10", "Bug Repellent"], ["11-12", "Clairaudience"],
    ["13-14", "Clairvoyance"], ["15-16", "Climbing"], ["17-18", "Defense"],
    ["19-22", "Delusion"], ["23-24", "Diminution"], ["25", "Dragon Control"],
    ["26-27", "Dreamspeech"], ["28", "Elasticity"], ["29-30", "Elemental Form"],
    ["31-32", "ESP"], ["33", "Ethereality"], ["34-36", "Fire Resistance"],
    ["37-39", "Flying"], ["40-41", "Fortitude"], ["42", "Freedom"],
    ["43-45", "Gaseous Form"], ["46", "Giant Control"], ["47-49", "Giant Strength"],
    ["50-51", "Growth"], ["52-57", "Healing"], ["58-60", "Heroism"],
    ["61", "Human Control"], ["62-64", "Invisibility"], ["65-66", "Invulnerability"],
    ["67-68", "Levitation"], ["69-70", "Longevity"], ["71", "Luck"],
    ["72", "Merging"], ["73-74", "Plant Control"], ["75-77", "Poison"],
    ["78-80", "Polymorph Self"], ["81-82", "Sight"], ["83-84", "Speech"],
    ["85-88", "Speed"], ["89-90", "Strength"], ["91-93", "Super-Healing"],
    ["94-96", "Swimming"], ["97", "Treasure Finding"], ["98", "Undead Control"],
    ["99-00", "Water Breathing"]
  ]),
  scrolls: rangeRows([
    ["01-03", "Communication"], ["04-05", "Creation"],
    ["06-13", "Curse (occurs when read)"], ["14", "Delay (S)"], ["15-17", "Equipment"],
    ["18-19", "Illumination"], ["20-21", "Mages (S)"], ["22-25", "Map to normal treasure"],
    ["26-28", "Map to magical treasure"], ["29-30", "Map to combined treasure"],
    ["31", "Map to special treasure"], ["32-34", "Mapping"], ["35-36", "Portals"],
    ["37-42", "Protection from Elementals"], ["43-50", "Protection from Lycanthropes"],
    ["51-54", "Protection from Magic"], ["55-61", "Protection from Undead"],
    ["62-63", "Questioning"], ["64", "Repetition (S)"], ["65-66", "Seeing"],
    ["67-68", "Shelter"], ["69-71", "Spell Catching"],
    ["72-96", "Spell (see Spell Scrolls)"], ["97-98", "Trapping"], ["99-00", "Truth"]
  ]),
  wands: rangeRows([
    ["01-05", "Wand of Cold (M)"], ["06-10", "Wand of Enemy Detection (M)"],
    ["11-14", "Wand of Fear (M)"], ["15-19", "Wand of Fireballs (M)"],
    ["20-23", "Wand of Illusion (M)"], ["24-28", "Wand of Lightning Bolts (M)"],
    ["29-33", "Wand of Magic Detection (M)"], ["34-38", "Wand of Metal Detection (M)"],
    ["39-42", "Wand of Negation (M)"], ["43-47", "Wand of Paralyzation (M)"],
    ["48-52", "Wand of Polymorphing (M)"], ["53-56", "Wand of Secret Door Detection (M)"],
    ["57-60", "Wand of Trap Detection (M)"], ["61", "Staff of Commanding (S)"],
    ["62-63", "Staff of Dispelling"], ["64-66", "Staff of the Druids (DR)"],
    ["67-69", "Staff of an Element (M)"], ["70-71", "Staff of Harming (C)"],
    ["72-78", "Staff of Healing (C)"], ["79", "Staff of Power (M)"],
    ["80-82", "Snake Staff (C)"], ["83-85", "Staff of Striking (S)"],
    ["86-87", "Staff of Withering (C)"], ["88", "Staff of Wizardry (M)"],
    ["89-90", "Rod of Cancellation"], ["91", "Rod of Dominion"],
    ["92", "Rod of Health (C)"], ["93-94", "Rod of Inertia (N)"],
    ["95", "Rod of Parrying"], ["96", "Rod of Victory"],
    ["97-99", "Rod of Weaponry"], ["00", "Rod of the Wyrm"]
  ]),
  rings: rangeRows([
    ["01-02", "Animal Control"], ["03-08", "Delusion"], ["09", "Djinni Summoning"],
    ["10-13", "Ear"], ["14-17", "Elemental Adaptation"], ["18-23", "Fire Resistance"],
    ["24-26", "Holiness (C, DR)"], ["27", "Human Control"], ["28-32", "Invisibility"],
    ["33-35", "Life Protection"], ["36-38", "Memory (S)"], ["39-40", "Plant Control"],
    ["41-45", "Protection +1"], ["46-48", "Protection +2"], ["49-50", "Protection +3"],
    ["51", "Protection +4"], ["52-55", "Quickness"], ["56", "Regeneration"],
    ["57-59", "Remedies"], ["60-61", "Safety"], ["62-64", "Seeing"],
    ["65-67", "Spell Eating"], ["68-69", "Spell Storing"], ["70-71", "Spell Turning"],
    ["72-75", "Survival"], ["76-77", "Telekinesis"], ["78-81", "Truth"],
    ["82-84", "Truthfulness"], ["85-86", "Truthlessness"], ["87-91", "Water Walking"],
    ["92-96", "Weakness"], ["97-98", "Wishes"], ["99-00", "X-ray Vision"]
  ]),
  miscellaneous: rangeRows([
    ["01-02", "Amulet of Protection from Crystal Balls and ESP"],
    ["03-04", "Bag of Devouring"], ["05-09", "Bag of Holding"],
    ["10-12", "Boat, Undersea"], ["13-14", "Boots of Levitation"],
    ["15-17", "Boots of Speed"], ["18-19", "Boots of Traveling/Leaping"],
    ["20", "Bowl of Commanding Water Elementals"],
    ["21", "Brazier of Commanding Fire Elementals"], ["22-23", "Broom of Flying"],
    ["24", "Censer of Controlling Air Elementals"], ["25-27", "Chime of Time"],
    ["28-29", "Crystal Ball (E, M)"], ["30", "Crystal Ball with Clairaudience (M)"],
    ["31", "Crystal Ball with ESP (M)"], ["32-33", "Displacer Cloak"],
    ["34", "Drums of Panic"], ["35", "Efreeti Bottle"], ["36", "Egg of Wonder"],
    ["37-38", "Elven Boots"], ["39-40", "Elven Cloak"], ["41-42", "Flying Carpet"],
    ["43", "Gauntlets of Ogre Power"], ["44-45", "Girdle of Giant Strength"],
    ["46-47", "Helm of Alignment Changing"], ["48-49", "Helm of Reading"],
    ["50-51", "Helm of Telepathy"], ["52", "Helm of Teleportation (M)"],
    ["53", "Horn of Blasting"], ["54", "Lamp, Hurricane"],
    ["55-56", "Lamp of Long Burning"], ["57-59", "Medallion of ESP, 30' range"],
    ["60-61", "Medallion of ESP, 90' range"], ["62", "Mirror of Life Trapping"],
    ["63", "Muzzle of Training"], ["64-66", "Nail, Finger"],
    ["67-68", "Nail of Pointing"], ["69-71", "Ointment"],
    ["72-76", "Pouch of Security"], ["77-79", "Quill of Copying (S)"],
    ["80-82", "Rope of Climbing"], ["83-86", "Scarab of Protection"],
    ["87-88", "Slate of Identification (S)"],
    ["89-91", "Stone of Controlling Earth Elementals"],
    ["92", "Talisman of Elemental Travel"], ["93-94", "Wheel of Floating"],
    ["95-97", "Wheel of Fortune"], ["98", "Wheel, Square"],
    ["99-00", "Wheel, Square (variant)"]
  ]),
  armorSizes: rangeRows([
    ["01-68", "Human"], ["69-81", "Dwarf"], ["82-91", "Elf"],
    ["92-98", "Halfling"], ["99-00", "Giant"]
  ]),
  armorTypes: rangeRows([
    ["01-10", "Leather armor"], ["11-17", "Scale mail"], ["18-30", "Chain mail"],
    ["31-39", "Banded mail"], ["40-50", "Plate mail"], ["51-55", "Suit armor"],
    ["56-75", "Shield"], ["76-77", "Scale & shield"], ["78-85", "Chain & shield"],
    ["86-90", "Banded & shield"], ["91-00", "Plate & shield"]
  ]),
  armorAc: rangeRows([
    ["01-70", "+1"], ["71-88", "+2"], ["89-96", "+3"],
    ["97-99", "+4"], ["00", "+5"]
  ]),
  armorSpecial: rangeRows([
    ["01-07", "Absorption"], ["08-17", "Charm"], ["18-32", "Cure wounds"],
    ["33-42", "Electricity"], ["43-47", "Energy drain"], ["48-50", "Ethereality"],
    ["51-60", "Fly"], ["61-66", "Gaseous form"], ["67-75", "Haste"],
    ["76-85", "Invisibility"], ["86-93", "Reflection"], ["94-00", "Remove curse"]
  ]),
  missiles: rangeRows([
    ["01-37", "Arrows"], ["38-59", "Quarrels"], ["60-70", "Sling stones"],
    ["71-72", "Blowgun"], ["73-80", "Bow, long"], ["81-85", "Bow, short"],
    ["86-87", "Crossbow, heavy"], ["88-92", "Crossbow, light"], ["93-00", "Sling"]
  ]),
  missileGeneration: rangeRows([
    ["01-06", "Arrows +1 (2d10)"], ["07-11", "Arrows +2 (2d6)"],
    ["12-15", "Arrows +3 (2d4)"], ["16-18", "Arrow, +1 silver"],
    ["19-20", "Arrow, +2 silver"], ["21", "Arrow, +3 silver"],
    ["22-25", "Blowgun +1"], ["26-28", "Bola +1"], ["29-33", "Bow, short +1"],
    ["34-37", "Bow, short +2"], ["38-40", "Bow, short +3"], ["41-45", "Bow, long +1"],
    ["46-49", "Bow, long +2"], ["50-52", "Bow, long +3"],
    ["53-57", "Crossbow, light +1"], ["58-61", "Crossbow, light +2"],
    ["62-64", "Crossbow, light +3"], ["65-69", "Crossbow, heavy +1"],
    ["70-73", "Crossbow, heavy +2"], ["74-76", "Crossbow, heavy +3"],
    ["77-82", "Quarrels +1 (2d10)"], ["83-87", "Quarrels +2 (2d6)"],
    ["88-91", "Quarrels +3 (2d4)"], ["92-94", "Quarrel, +1 silver"],
    ["95-96", "Quarrel, +2 silver"], ["97", "Quarrel, +3 silver"],
    ["98-00", "Sling +1"]
  ]),
  missileTalents: rangeRows([
    ["01-04", "Biting"], ["05-09", "Blinking"], ["10-14", "Charming"],
    ["15-21", "Climbing"], ["22-31", "Curing"], ["32-34", "Disarming"],
    ["35-38", "Dispelling"], ["39-45", "Flying"], ["46-52", "Lighting"],
    ["53-57", "Penetrating"], ["58-61", "Refilling"], ["62-67", "Screaming"],
    ["68-72", "Seeking"], ["73-76", "Sinking"], ["77-78", "Slaying"],
    ["79-85", "Speaking"], ["86-89", "Stunning"], ["90-91", "Teleporting"],
    ["92-96", "Transporting"], ["97-00", "Wounding"]
  ]),
  swords: rangeRows([
    ["01-10", "Sword, short +1"], ["11-20", "Sword, short +2"],
    ["21-30", "Sword, short +3"], ["31-34", "Sword, normal +1"],
    ["35", "Sword, normal +1, +3 vs dragonkind"],
    ["36", "Sword, normal +1, +3 vs giantkind"],
    ["37", "Sword, normal +1, +3 vs lycanthropes"],
    ["38", "Sword, normal +1, +3 vs regenerating monsters"],
    ["39", "Sword, normal +1, +3 vs spellcasters"],
    ["40", "Sword, normal +1, +3 vs undead"],
    ["41-50", "Sword, normal +2"], ["51-60", "Sword, normal +3"],
    ["61-64", "Sword, bastard +1"],
    ["65", "Sword, bastard +1, +3 vs dragonkind"],
    ["66", "Sword, bastard +1, +3 vs giantkind"],
    ["67", "Sword, bastard +1, +3 vs lycanthropes"],
    ["68", "Sword, bastard +1, +3 vs regenerating monsters"],
    ["69", "Sword, bastard +1, +3 vs spellcasters"],
    ["70", "Sword, bastard +1, +3 vs undead"],
    ["71-75", "Sword, bastard +2"], ["76-80", "Sword, bastard +3"],
    ["81-84", "Sword, two-handed +1"],
    ["85", "Sword, two-handed +1, +3 vs dragonkind"],
    ["86", "Sword, two-handed +1, +3 vs giantkind"],
    ["87", "Sword, two-handed +1, +3 vs lycanthropes"],
    ["88", "Sword, two-handed +1, +3 vs regenerating monsters"],
    ["89", "Sword, two-handed +1, +3 vs spellcasters"],
    ["90", "Sword, two-handed +1, +3 vs undead"],
    ["91-95", "Sword, two-handed +2"], ["96-00", "Sword, two-handed +3"]
  ]),
  miscWeapons: rangeRows([
    ["01-05", "Axe, battle +1"], ["06-08", "Axe, battle +2"],
    ["09-10", "Axe, battle +3"], ["11-15", "Axe, hand +1"],
    ["16-18", "Axe, hand +2"], ["19-20", "Axe, hand +3"],
    ["21-25", "Dagger +1"], ["26-28", "Dagger +2"], ["29-30", "Dagger +3"],
    ["31-35", "Hammer, throwing +1"], ["36-38", "Hammer, throwing +2"],
    ["39-40", "Hammer, throwing +3"], ["41-45", "Hammer, war +1"],
    ["46-48", "Hammer, war +2"], ["49-50", "Hammer, war +3"],
    ["51-55", "Mace +1"], ["56-58", "Mace +2"], ["59-60", "Mace +3"],
    ["61-65", "Polearm +1"], ["66-68", "Polearm +2"], ["69-70", "Polearm +3"],
    ["71-72", "Shield, horned +1"], ["73-75", "Shield, knife +1"],
    ["76-78", "Shield, sword +1"], ["79-80", "Shield, tusked +1"],
    ["81-85", "Spear +1"], ["86-88", "Spear +2"], ["89-90", "Spear +3"],
    ["91-95", "Staff +1"], ["96-98", "Staff +2"], ["99-00", "Staff +3"]
  ])
});

export function rollOnRangeTable(rows, roll, rng = Math.random) {
  const value = roll === undefined || roll === null || roll === ""
    ? 1 + Math.floor(rng() * 100)
    : clamp(Math.round(numeric(roll, 1)), 1, 100);
  const row = (rows ?? []).find((entry) => value >= entry.min && value <= entry.max);
  return row ? { roll: value, name: row.name } : null;
}

export function magicItemCategory(roll, rng = Math.random) {
  const result = rollOnRangeTable(MAGIC_ITEM_CATEGORIES, roll, rng);
  return result ? { ...result, key: MAGIC_ITEM_CATEGORIES.find((entry) => entry.name === result.name)?.key } : null;
}

/** RC pp. 228-231: pick the category, then the exact item on its subtable. */
export function rollMagicItem(input = {}, rng = Math.random) {
  const selected = MAGIC_ITEM_CATEGORIES.find((entry) => entry.key === input?.category);
  const category = selected
    ? { roll: null, name: selected.name, key: selected.key }
    : magicItemCategory(input?.roll, rng);
  if (!category) return null;
  const subRoll = () => 1 + Math.floor(rng() * 100);
  if (category.key === "armor") {
    const size = rollOnRangeTable(MAGIC_ITEM_SUBTABLES.armorSizes, subRoll(), rng)?.name;
    const armor = rollOnRangeTable(MAGIC_ITEM_SUBTABLES.armorTypes, subRoll(), rng)?.name;
    const ac = rollOnRangeTable(MAGIC_ITEM_SUBTABLES.armorAc, subRoll(), rng)?.name;
    const special = rollOnRangeTable(MAGIC_ITEM_SUBTABLES.armorSpecial, subRoll(), rng)?.name;
    return {
      ...category,
      item: `${size} ${armor} ${ac}`,
      details: { size, armor, ac, special },
      subRoll: null
    };
  }
  if (category.key === "missiles") {
    const weapon = rollOnRangeTable(MAGIC_ITEM_SUBTABLES.missileGeneration, subRoll(), rng)?.name;
    const weaponClass = rollOnRangeTable(MAGIC_ITEM_SUBTABLES.missiles, subRoll(), rng)?.name;
    const possibleTalent = subRoll() <= 40
      ? rollOnRangeTable(MAGIC_ITEM_SUBTABLES.missileTalents, subRoll(), rng)?.name : null;
    return {
      ...category,
      item: weapon,
      details: { weaponClass, possibleTalent },
      subRoll: null
    };
  }
  const item = rollOnRangeTable(MAGIC_ITEM_SUBTABLES[category.key], subRoll(), rng);
  return item ? { ...category, item: item.name, itemRoll: item.roll, subRoll: item.roll } : null;
}


