/**
 * Pure Rules Cyclopedia character creation helpers.
 *
 * This module deliberately avoids Foundry globals so the whole creation flow
 * can be unit-tested with Node. The ApplicationV2 wizard supplies the inputs,
 * resolves the compendium items and applies the resulting Actor updates.
 */
import {
  RC, adjustment, attackSpecFor, computeArmorClass, computeLoad, generalSkillSlots,
  getRCClass, hpForLevel, planAbilityAdjustment, primeRequisiteBonus
} from "./rules-rc.mjs";

export const ABILITY_KEYS = Object.freeze(["str", "int", "wis", "dex", "con", "cha"]);
export const ABILITY_NAMES = Object.freeze({
  str: "Strength", int: "Intelligence", wis: "Wisdom",
  dex: "Dexterity", con: "Constitution", cha: "Charisma"
});
export const ALIGNMENTS = Object.freeze(["lawful", "neutral", "chaotic"]);
export const ALIGNMENT_LABELS = Object.freeze({
  lawful: "Lawful", neutral: "Neutral", chaotic: "Chaotic"
});
export const RACES = Object.freeze(["Human", "Dwarf", "Elf", "Halfling"]);
export const WIZARD_STEPS = Object.freeze([
  "identity", "abilities", "class", "combat", "languages", "equipment", "review"
]);

const CLASS_RACES = Object.freeze({ dwarf: "Dwarf", elf: "Elf", halfling: "Halfling" });
const ABILITY_ALIASES = Object.freeze({
  for: "str", des: "dex", int: "int", sab: "wis", wis: "wis", con: "con", car: "cha"
});
const ARMOR_NAMES = Object.freeze({
  nenhuma: "No armor", couro: "Leather armor", escamas: "Scale mail", malha: "Chain mail",
  bandas: "Banded mail", placas: "Plate mail", completa: "Full plate"
});
const PRIME_LABELS = Object.freeze({ str: "Strength", int: "Intelligence", wis: "Wisdom", dex: "Dexterity" });

const issue = (code, severity = "error", text = "", params = {}) =>
  ({ code, severity, text, params });

/** Join player-entered languages with RC suggestions without duplicating entries. */
function joinLanguages(extra = "", suggested = []) {
  const parts = [extra, ...suggested]
    .flatMap((entry) => String(entry ?? "").split(";"))
    .map((entry) => entry.trim())
    .filter(Boolean);
  return [...new Set(parts)].join("; ");
}

function cleanScore(value, fallback = 10) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(3, Math.min(18, Math.round(number)));
}

/** Normalize { str: 14 } and { str: { value: 14 } } into a flat score map. */
export function scoreMap(scores = {}) {
  return Object.fromEntries(ABILITY_KEYS.map((key) => {
    const entry = scores[key];
    const raw = entry && typeof entry === "object" ? entry.value : entry;
    return [key, cleanScore(raw)];
  }));
}

function rollValues(rolls, count) {
  const flat = Array.isArray(rolls?.[0]) ? rolls.flat() : (rolls ?? []);
  return Array.from({ length: count }, (_, index) => {
    const value = Number(flat[index]);
    return Number.isFinite(value) ? Math.max(1, Math.min(6, Math.round(value))) : null;
  });
}

export function roll3d6(rng = Math.random) {
  return Array.from({ length: 3 }, () => 1 + Math.floor(rng() * 6));
}

/** RC p. 6: roll 3d6 in order for Strength, Intelligence, Wisdom, Dexterity, Constitution, Charisma. */
export function rollAbilities(rng = Math.random) {
  const rolls = ABILITY_KEYS.map(() => roll3d6(rng));
  return {
    scores: Object.fromEntries(ABILITY_KEYS.map((key, index) =>
      [key, rolls[index].reduce((sum, value) => sum + value, 0)])),
    rolls
  };
}

export function scoresFromRolls(rolls) {
  const parsed = Array.isArray(rolls?.[0]) ? rolls : Array.from({ length: 6 }, (_, index) => rollValues(rolls.slice(index * 3, index * 3 + 3), 3));
  return {
    scores: Object.fromEntries(ABILITY_KEYS.map((key, index) =>
      [key, rollValues(parsed[index], 3).reduce((sum, value) => sum + (value ?? 0), 0)])),
    rolls: parsed.map((entry) => rollValues(entry, 3))
  };
}

/** A full reroll is always available before the player commits to a class. */
export function rerollAbilities(_scores = {}, rng = Math.random) {
  return rollAbilities(rng);
}

export function abilityAdjustments(scores = {}) {
  const clean = scoreMap(scores);
  return Object.fromEntries(ABILITY_KEYS.map((key) => [key, adjustment(clean[key]) ?? 0]));
}

export function applyCreationSwap(classKey, scores = {}, swaps = 0) {
  const clean = scoreMap(scores);
  const requested = Math.max(0, Math.floor(Number(swaps) || 0));
  const planned = planAbilityAdjustment(classKey, clean, requested);
  return { scores: scoreMap(planned.scores), swaps: planned.swaps, requested };
}

export function normalizeAlignment(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return null;
  if (/^(law|lawful)\b/.test(text) || text === "l") return "lawful";
  if (/^(cha|chaotic)\b/.test(text) || text === "c") return "chaotic";
  if (/^(neu|neutral)\b/.test(text) || text === "n") return "neutral";
  return null;
}

/** RC p. 7: demihuman and special class entry requirements. */
export function validateMinimumRequirements(classKey, scores = {}) {
  const cls = getRCClass(classKey);
  const key = cls?.key ?? String(classKey ?? "").toLowerCase();
  if (!cls && key !== "druid") return {
    ok: false, requirements: [], missing: [],
    issues: [issue("invalidClass", "error", "Choose a Rules Cyclopedia character class.")]
  };

  const clean = scoreMap(scores);
  const raw = key === "mystic"
    ? [["wis", 13], ["dex", 13]]
    : (cls?.requirements ?? []).map(([entry, minimum]) => [ABILITY_ALIASES[entry] ?? entry, Number(minimum)]);
  const requirements = raw.map(([entry, minimum]) => ({ key: entry, minimum, name: ABILITY_NAMES[entry] ?? entry }));
  const missing = requirements.filter((entry) => clean[entry.key] < entry.minimum);
  const className = cls?.name ?? "Druid";
  const issues = missing.map((entry) => issue("missingRequirement", "error",
    `${entry.name} ${entry.minimum}+ is required for ${className}.`,
    { ability: entry.name, minimum: entry.minimum, className }));
  if (key === "druid") {
    issues.push(issue("druidRequiresCleric", "error",
      "A druid must first reach 9th level as a Neutral cleric; new characters start as clerics."));
  }
  return { ok: issues.length === 0, requirements, missing, issues };
}

export function validateAlignment(classKey, alignment) {
  const key = normalizeAlignment(alignment);
  const issues = [];
  if (!key) issues.push(issue("invalidAlignment", "error", "Choose Lawful, Neutral or Chaotic."));
  if (String(getRCClass(classKey)?.key ?? classKey ?? "").toLowerCase() === "druid" && key && key !== "neutral") {
    issues.push(issue("druidAlignment", "error", "A druid must be Neutral."));
  }
  return { key, ok: issues.length === 0, label: ALIGNMENT_LABELS[key] ?? "", issues };
}

export function validateRace(classKey, race) {
  const cls = getRCClass(classKey);
  const expected = cls ? CLASS_RACES[cls.key] : null;
  const current = String(race ?? "Human");
  const issues = [];
  if (expected && current.toLowerCase() !== expected.toLowerCase()) {
    issues.push(issue("raceMismatch", "error", `${cls.name} characters must be ${expected}.`,
      { className: cls.name, race: expected }));
  }
  if (!expected && Object.values(CLASS_RACES).some((value) => value.toLowerCase() === current.toLowerCase())) {
    issues.push(issue("raceClassMismatch", "error", `${current} characters use the ${current} class.`,
      { race: current }));
  }
  return { race: expected ?? current, ok: issues.length === 0, issues };
}

export function allowedArmorTypes(classKey) {
  const key = String(getRCClass(classKey)?.key ?? classKey ?? "").toLowerCase();
  if (key === "magic-user" || key === "mystic") return ["nenhuma"];
  if (key === "thief" || key === "druid") return ["nenhuma", "couro"];
  return Object.keys(RC.armor.types);
}

export function shieldAllowed(classKey) {
  const key = String(getRCClass(classKey)?.key ?? classKey ?? "").toLowerCase();
  return !["magic-user", "thief", "mystic"].includes(key);
}

export function validateArmor(classKey, armorType = "nenhuma", shield = false) {
  const allowed = allowedArmorTypes(classKey);
  const issues = [];
  if (!allowed.includes(armorType)) {
    issues.push(issue("armorNotAllowed", "error",
      `${getRCClass(classKey)?.name ?? "This class"} cannot use ${ARMOR_NAMES[armorType] ?? armorType}.`,
      { armor: ARMOR_NAMES[armorType] ?? armorType }));
  }
  if (shield && !shieldAllowed(classKey)) {
    issues.push(issue("shieldNotAllowed", "error",
      `${getRCClass(classKey)?.name ?? "This class"} cannot use a shield.`));
  }
  return { ok: issues.length === 0, issues };
}

export function armorOptions(classKey) {
  return allowedArmorTypes(classKey).map((key) => ({
    key, name: ARMOR_NAMES[key], ac: Number(RC.armor.types[key]?.ac ?? 9)
  }));
}

/** RC p. 10 and pp. 24-26: native languages, racial tongues and literacy limits. */
export function suggestLanguages({ intelligence = 10, classKey = "", alignment = "neutral", druid = false } = {}) {
  const value = scoreMap({ int: intelligence }).int;
  const adj = adjustment(value) ?? 0;
  const align = normalizeAlignment(alignment) ?? "neutral";
  const languages = ["Common", `${ALIGNMENT_LABELS[align]} tongue`];
  const key = String(getRCClass(classKey)?.key ?? classKey ?? "").toLowerCase();
  if (key === "dwarf") languages.push("Dwarvish", "Gnomish", "Goblin", "Kobold");
  if (key === "elf") languages.push("Elvish", "Gnoll", "Hobgoblin", "Orc");
  if (key === "druid" || druid) languages.push("Druidic");

  const bonus = Math.max(0, adj);
  let note = "Reads and writes native languages.";
  if (adj <= -3) note = "Has trouble speaking; cannot read or write.";
  else if (adj === -2) note = "Cannot read or write Common.";
  else if (adj === -1) note = "Can write simple Common words only.";
  else if (bonus) note = `Choose ${bonus} additional language${bonus === 1 ? "" : "s"}.`;

  return { languages, bonus, note, literate: adj >= -1, value };
}

export function startingGold(rng = Math.random) {
  const rolls = roll3d6(rng);
  return { gold: rolls.reduce((sum, value) => sum + value, 0) * 10, rolls };
}

export function startingGoldFromRolls(rolls) {
  const values = rollValues(rolls, 3);
  return { gold: values.reduce((sum, value) => sum + (value ?? 0), 0) * 10, rolls: values };
}

/** RC p. 8: roll the class hit die and apply the Constitution adjustment, minimum 1 HP. */
export function startingHpFor(classKey, constitution = 10, rng = Math.random, options = {}) {
  const cls = getRCClass(classKey);
  if (!cls) return { gain: 0, text: "" };
  const conAdj = adjustment(cleanScore(constitution)) ?? 0;
  if (options.startAtMaximum) {
    return {
      gain: Math.max(1, cls.hitDie + conAdj),
      text: `maximum d${cls.hitDie}${conAdj ? ` ${conAdj > 0 ? "+" : ""}${conAdj}` : ""} → HP`
    };
  }
  return hpForLevel(classKey, 1, conAdj, rng);
}

/**
 * A compact shopping list. Names match the `becmi.equipment` compendium so the
 * wizard can embed the corresponding Items after the plan is approved.
 */
export const PURCHASE_ITEMS = Object.freeze([
  { name: "Club", type: "weapon", group: "weapons", cost: 3, weight: 50 },
  { name: "Dagger, Normal", type: "weapon", group: "weapons", cost: 3, weight: 10 },
  { name: "Sling", type: "weapon", group: "weapons", cost: 2, weight: 20 },
  { name: "Staff", type: "weapon", group: "weapons", cost: 5, weight: 40 },
  { name: "Spear", type: "weapon", group: "weapons", cost: 3, weight: 30 },
  { name: "Mace", type: "weapon", group: "weapons", cost: 5, weight: 30 },
  { name: "Sword, Short", type: "weapon", group: "weapons", cost: 7, weight: 30 },
  { name: "Axe, Hand", type: "weapon", group: "weapons", cost: 4, weight: 30 },
  { name: "Bow, Short", type: "weapon", group: "weapons", cost: 25, weight: 20 },
  { name: "Crossbow, Light", type: "weapon", group: "weapons", cost: 30, weight: 50 },
  { name: "Sword, Normal", type: "weapon", group: "weapons", cost: 10, weight: 60 },
  { name: "Axe, Battle", type: "weapon", group: "weapons", cost: 7, weight: 60 },
  { name: "Sword, Two-Handed", type: "weapon", group: "weapons", cost: 15, weight: 100 },
  { name: "Oil, Burning", type: "equipment", group: "adventuring", cost: 2, weight: 10 },
  { name: "Torch", type: "weapon", group: "adventuring", cost: 0, weight: 20 },
  { name: "Holy Water", type: "weapon", group: "adventuring", cost: 25, weight: 1 },
  { name: "Holy symbol", type: "equipment", group: "adventuring", cost: 25, weight: 1 },
  { name: "Thieves' tools", type: "equipment", group: "adventuring", cost: 25, weight: 10 },
  { name: "Backpack", type: "equipment", group: "adventuring", cost: 5, weight: 20 },
  { name: "Rope", type: "equipment", group: "adventuring", cost: 1, weight: 50 },
  { name: "Torches", type: "equipment", group: "adventuring", cost: 1, weight: 120 },
  { name: "Rations, standard", type: "equipment", group: "adventuring", cost: 5, weight: 200 },
  { name: "Waterskin /wineskin", type: "equipment", group: "adventuring", cost: 1, weight: 5 },
  { name: "Tinder box", type: "equipment", group: "adventuring", cost: 3, weight: 5 },
  { name: "Lantern", type: "equipment", group: "adventuring", cost: 10, weight: 30 },
  { name: "Oil", type: "equipment", group: "adventuring", cost: 2, weight: 10 },
  { name: "Leather Armor", type: "armor", group: "armor", cost: 20, weight: 200, armorType: "couro" },
  { name: "Scale Mail", type: "armor", group: "armor", cost: 30, weight: 300, armorType: "escamas" },
  { name: "Chain Mail", type: "armor", group: "armor", cost: 40, weight: 400, armorType: "malha" },
  { name: "Banded Mail", type: "armor", group: "armor", cost: 50, weight: 450, armorType: "bandas" },
  { name: "Plate Mail", type: "armor", group: "armor", cost: 60, weight: 500, armorType: "placas" },
  { name: "Suit Armor", type: "armor", group: "armor", cost: 250, weight: 750, armorType: "completa" },
  { name: "Shield", type: "armor", group: "armor", cost: 10, weight: 100, isShield: true }
]);

const CLASS_WEAPONS = Object.freeze({
  cleric: ["Club", "Mace", "Staff", "Sling", "Hammer, War"],
  "magic-user": ["Dagger, Normal"],
  thief: ["Dagger, Normal", "Sword, Short", "Club", "Sling", "Bow, Short", "Crossbow, Light"],
  druid: ["Club", "Staff", "Sling"],
  mystic: []
});

export function availableStartingItems(classKey) {
  const key = String(getRCClass(classKey)?.key ?? classKey ?? "").toLowerCase();
  const armor = allowedArmorTypes(classKey);
  const weapons = CLASS_WEAPONS[key];
  return PURCHASE_ITEMS.filter((item) => {
    if (item.type === "weapon" && item.group === "weapons") return !weapons || weapons.includes(item.name);
    if (item.type === "armor" && item.isShield) return shieldAllowed(classKey);
    if (item.type === "armor") return armor.includes(item.armorType);
    return true;
  });
}

export function purchaseSummary(names = []) {
  const byName = new Map(PURCHASE_ITEMS.map((item) => [item.name, item]));
  const selected = [];
  const unknown = [];
  for (const name of [...new Set(names.map((value) => String(value)))].filter(Boolean)) {
    const item = byName.get(name);
    if (item) selected.push(item);
    else unknown.push(name);
  }
  const cost = selected.reduce((sum, item) => sum + Number(item.cost || 0), 0);
  const weight = selected.reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const equipment = selected.filter((item) => item.group === "adventuring")
    .reduce((sum, item) => sum + Number(item.weight || 0), 0);
  const weapons = selected.filter((item) => item.group === "weapons")
    .reduce((sum, item) => sum + Number(item.weight || 0), 0);
  return { items: selected, names: selected.map((item) => item.name), unknown, cost, weight, equipment, weapons };
}

export function deriveArmorFromItems(names = []) {
  const summary = purchaseSummary(names);
  const armor = summary.items.find((item) => item.armorType);
  return {
    armorType: armor?.armorType ?? "nenhuma",
    shield: summary.items.some((item) => item.isShield)
  };
}

function primeRequisiteLabel(classKey) {
  const cls = getRCClass(classKey);
  if (!cls) return "";
  return (cls.primeRequisites ?? [])
    .map((key) => PRIME_LABELS[ABILITY_ALIASES[key] ?? key] ?? key)
    .join(", ");
}

function classSnapshotFor(classKey, uuid = "") {
  const cls = getRCClass(classKey);
  if (!cls) return null;
  return {
    uuid: String(uuid ?? ""),
    name: cls.name,
    key: cls.key,
    hitDice: `1d${cls.hitDie}`,
    maxLevel: cls.maxLevel,
    xp: [...cls.xp],
    xpTable: {},
    saves: cls.saves
  };
}

/**
 * Build the complete creation plan without touching Foundry. `changes` uses
 * flattened Actor paths; derived fields such as xpNext, AC and THAC0 are never
 * written directly.
 */
export function buildCharacterPlan(input = {}) {
  const classKey = getRCClass(input.classKey)?.key ?? "";
  const cls = getRCClass(classKey);
  const swap = applyCreationSwap(classKey, input.abilities ?? {}, input.swapCount);
  const scores = swap.scores;
  const adjustments = abilityAdjustments(scores);
  const requirements = validateMinimumRequirements(classKey, scores);
  const alignment = validateAlignment(classKey, input.alignment);
  const race = validateRace(classKey, input.race ?? "Human");
  const languages = suggestLanguages({
    intelligence: scores.int, classKey, alignment: alignment.key ?? input.alignment,
    druid: Boolean(input.druid)
  });

  const goldRolls = input.goldRolls ?? startingGold().rolls;
  const rolledGold = startingGoldFromRolls(goldRolls);
  const purchase = purchaseSummary(input.items ?? []);
  const remainingGold = rolledGold.gold - purchase.cost;
  // AC and load follow the chosen equipment; there is no separate armor toggle.
  const equippedArmor = deriveArmorFromItems(purchase.names);
  const armorType = equippedArmor.armorType;
  const shield = equippedArmor.shield;
  const armor = validateArmor(classKey, armorType, shield);
  const hpMode = input.hpMode === "maximum" ? "maximum" : "rolled";
  const hpResult = input.hp !== undefined
    ? { gain: Math.max(1, Math.round(Number(input.hp) || 1)), text: "chosen by player" }
    : startingHpFor(classKey, scores.con, Math.random, { startAtMaximum: hpMode === "maximum" });
  const hp = Math.max(1, Number(hpResult.gain) || 1);

  const issues = [
    ...requirements.issues, ...alignment.issues, ...race.issues, ...armor.issues,
    ...purchase.unknown.map((name) => issue("unknownItem", "error", `Unknown equipment item: ${name}.`, { name }))
  ];
  if (remainingGold < 0) {
    issues.push(issue("overBudget", "error", `Starting gold is short by ${Math.abs(remainingGold)} gp.`,
      { amount: Math.abs(remainingGold) }));
  }
  if (!String(input.name ?? "").trim()) {
    issues.push(issue("missingName", "warning", "No character name was entered."));
  }
  const chosenRace = race.race;
  const languageText = joinLanguages(input.languages, languages.languages);
  const skillSlots = generalSkillSlots(classKey, 1, 0, scores.int);

  const effectiveArmorType = armor.ok ? armorType : (armorOptions(classKey)[0]?.key ?? "nenhuma");
  const effectiveShield = armor.ok ? shield : false;
  const ac = computeArmorClass({ type: effectiveArmorType, shield: effectiveShield, dexAdj: adjustments.dex });
  const load = computeLoad({
    armor: effectiveArmorType, shield: effectiveShield, coins: Math.max(0, remainingGold),
    equipment: purchase.equipment, weapons: purchase.weapons
  });

  const changes = {
    name: String(input.name ?? "").trim() || "Unnamed Character",
    "system.attributes.player": String(input.player ?? ""),
    "system.attributes.level": 1,
    "system.attributes.xp": 0,
    "system.abilities": Object.fromEntries(ABILITY_KEYS.map((key) => [key, { value: scores[key] }])),
    "system.attributes.hp": { value: hp, max: hp },
    "system.attributes.classKey": classKey,
    "system.attributes.class": cls?.name ?? "",
    "system.attributes.classUuid": String(input.classUuid ?? ""),
    "system.attributes.hd": cls ? `1d${cls.hitDie}` : "",
    "system.attributes.primeRequisite": primeRequisiteLabel(classKey),
    "system.attributes.race": chosenRace,
    "system.attributes.alignment": alignment.label || String(input.alignment ?? "Neutral"),
    "system.attributes.gold.gp": Math.max(0, remainingGold),
    "system.attributes.armor.type": effectiveArmorType,
    "system.attributes.armor.shield": effectiveShield,
    "system.attributes.load.equipment": purchase.equipment,
    "system.attributes.load.weapons": purchase.weapons,
    "system.languages": languageText,
    "system.generalSkills.enabled": Boolean(input.generalSkillsEnabled),
    "system.mastery.enabled": Boolean(input.masteryEnabled),
    "flags.becmi.classInfo": classSnapshotFor(classKey, input.classUuid)
  };
  if (String(input.personality ?? "").trim()) {
    changes["system.details.personality"] = String(input.personality).trim();
  }
  if (String(input.background ?? "").trim()) {
    changes["system.details.background"] = String(input.background).trim();
  }
  if (String(input.height ?? "").trim()) {
    changes["system.attributes.details.height"] = String(input.height).trim();
  }
  if (String(input.weight ?? "").trim()) {
    changes["system.attributes.details.weight"] = String(input.weight).trim();
  }

  return {
    preview: {
      classKey, className: cls?.name ?? "", hitDie: cls?.hitDie ?? null, maxLevel: cls?.maxLevel ?? null,
      scores, adjustments, adjustmentsUsed: swap.swaps,
      primeBonus: primeRequisiteBonus(classKey, scores),
      primeRequisites: primeRequisiteLabel(classKey),
      hp, hpText: hpResult.text, hpMode,
      ac, thac0: attackSpecFor(classKey, 1, 0).thac0,
      armorOptions: armorOptions(classKey), armorType: effectiveArmorType, shield: effectiveShield,
      generalSkillSlots: skillSlots,
      gold: rolledGold.gold, cost: purchase.cost, remainingGold,
      items: purchase.items, unknown: purchase.unknown, load,
      languages, languageText, requirements: requirements.requirements,
      race: chosenRace, alignment: alignment.label
    },
    changes,
    itemsToCreate: purchase.names,
    issues,
    blocking: issues.some((entry) => entry.severity === "error")
  };
}

export function toActorUpdates(plan) {
  return { ...(plan?.changes ?? {}) };
}
