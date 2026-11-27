/**
 * Pure Rules Cyclopedia magic creation math (pp. 250-255).
 *
 * No Foundry globals are used here. The sheet and chat helpers turn these
 * results into roll cards; the formulas stay independently testable.
 */
import { normalizeClassKey } from "./rules-rc.mjs";

const DIVINE_KEYS = new Set(["cleric", "druid"]);
const ARCANE_KEYS = new Set(["magic-user", "elf"]);
const PERIOD_DISCOUNTS = Object.freeze({
  hour: 0.20, day: 0.25, week: 0.30, month: 0.35
});

const numeric = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const nonNegative = (value, fallback = 0) => Math.max(0, numeric(value, fallback));
const whole = (value, fallback = 0) => Math.max(0, Math.floor(numeric(value, fallback)));
const roundUpToTen = (value) => Math.ceil(value / 10) * 10;
const percentRemaining = (restrictions) => Math.max(0, 1 - 0.10 * Math.min(10, nonNegative(restrictions)));

function classKeyFor(classKey) {
  const text = String(classKey ?? "").toLowerCase().trim();
  return normalizeClassKey(text) ?? (DIVINE_KEYS.has(text) ? text : null);
}

/**
 * Clerics and druids use Wisdom in every creation formula that calls for the
 * magic-user's Intelligence (RC p. 250). Non-spellcasters have no score.
 */
export function craftingAbilityScore(classKey, abilities = {}) {
  const key = classKeyFor(classKey);
  const divine = DIVINE_KEYS.has(key);
  if (!divine && !ARCANE_KEYS.has(key)) return null;
  const abilityKey = divine ? "wis" : "int";
  const entry = abilities?.[abilityKey] ?? abilities?.[divine ? "wisdom" : "intelligence"];
  const score = Number(entry?.value ?? entry);
  return {
    key: abilityKey,
    label: divine ? "Wisdom" : "Intelligence",
    value: Number.isFinite(score) ? score : null
  };
}

/**
 * RC p. 250: ([ability + level] x 2) - (3 x spell level). Armor and weapon
 * bonuses use the number of pluses/minuses in place of the spell level.
 * Spell research uses the same base with a 3 or 5 point penalty per level.
 */
export function craftingChance({
  abilityScore = null, level = 1, spellLevel = 0, bonusLevels = 0, penaltyPerLevel = 3
} = {}) {
  const score = Number(abilityScore);
  if (!Number.isFinite(score)) return null;
  const penalty = nonNegative(penaltyPerLevel)
    * (nonNegative(spellLevel) + nonNegative(bonusLevels));
  return (score + Math.max(1, whole(level, 1))) * 2 - penalty;
}

/**
 * RC pp. 251-252. The rounded base grants the first plus/minus; each extra
 * plus/minus costs one more base. Bonuses against a special opponent cost half
 * a base per plus, and each restriction reduces that extra cost by 10%.
 */
export function armorWeaponEnchantmentCost({
  kind = "weapon", priceGp = 0, encumbranceCn = 0, bonuses = 1,
  bonusesAgainstOpponents = 0, restrictions = 0
} = {}) {
  const armor = String(kind).toLowerCase().startsWith("armor");
  const price = nonNegative(priceGp);
  const enc = nonNegative(encumbranceCn);
  const bonusCount = Math.max(1, whole(bonuses, 1));
  const raw = price * enc;
  const unrounded = armor ? raw / 3 : raw * 5;
  const rounded = roundUpToTen(unrounded);
  const minimum = armor ? 3000 : 100;
  const beforeMinimum = rounded * bonusCount;
  const initial = Math.max(minimum, beforeMinimum);
  const extraBonusCost = initial - rounded;
  const opponentRaw = rounded * 0.5 * nonNegative(bonusesAgainstOpponents);
  const opponentCost = Math.round(opponentRaw * percentRemaining(restrictions));

  return {
    kind: armor ? "armor" : "weapon",
    rawGp: raw,
    unroundedGp: unrounded,
    roundedBaseGp: rounded,
    bonusCount,
    minimumGp: minimum,
    beforeMinimumGp: beforeMinimum,
    initialGp: initial,
    extraBonusGp: extraBonusCost,
    bonusesAgainstOpponents: nonNegative(bonusesAgainstOpponents),
    restrictions: nonNegative(restrictions),
    opponentCostGp: opponentCost,
    totalInitialGp: initial + opponentCost
  };
}

function periodDiscount(period) {
  const text = String(period ?? "").toLowerCase().trim();
  const key = Object.keys(PERIOD_DISCOUNTS).find((candidate) => text.includes(candidate));
  return key ? PERIOD_DISCOUNTS[key] : 0;
}

/**
 * RC pp. 252-253. Charges cost 10% of the initial enchantment cost each;
 * permanency costs five times the initial cost (the same as 50 charges).
 * Restrictions reduce the spell-effect portion by 10% each. Items limited to
 * a number of uses per period discount the initial cost first, then use 30
 * charges plus one charge per allowed use in that period.
 */
export function spellEffectCost({
  spellLevels = 0, charges = 0, permanent = false, nonRechargeable = false,
  restrictions = 0, usesPerPeriod = "", usesPerPeriodCount = 0
} = {}) {
  const initial = 1000 * nonNegative(spellLevels);
  const discount = periodDiscount(usesPerPeriod);

  if (discount) {
    const discountedInitial = Math.round(initial * (1 - discount));
    const includedCharges = 30 + nonNegative(usesPerPeriodCount);
    const chargeCost = Math.round(discountedInitial * 0.10 * includedCharges);
    return {
      initialGp: initial,
      periodDiscountPercent: discount * 100,
      discountedInitialGp: discountedInitial,
      includedCharges,
      chargesGp: chargeCost,
      permanencyGp: 0,
      restrictionDiscountGp: 0,
      totalGp: discountedInitial + chargeCost
    };
  }

  const permanency = permanent ? 5 * initial : 0;
  const chargeCost = permanent ? 0 : Math.round(initial * 0.10 * nonNegative(charges));
  const effect = initial + permanency;
  const restrictionDiscount = Math.round(effect * (1 - percentRemaining(restrictions)));
  const effectAfterRestrictions = effect - restrictionDiscount;
  let total = effectAfterRestrictions + chargeCost;
  if (nonRechargeable && !permanent && charges > 0) total = Math.round(total * 0.8);

  return {
    initialGp: initial,
    periodDiscountPercent: 0,
    discountedInitialGp: initial,
    includedCharges: nonNegative(charges),
    chargesGp: chargeCost,
    permanencyGp: permanency,
    restrictions: nonNegative(restrictions),
    restrictionDiscountGp: restrictionDiscount,
    effectAfterRestrictionsGp: effectAfterRestrictions,
    nonRechargeable: Boolean(nonRechargeable && !permanent && charges > 0),
    totalGp: total
  };
}

/** RC pp. 251-253: one week plus one day per 1,000 gp spent, rounded up. */
export function enchantmentTime(totalGp) {
  const gp = nonNegative(totalGp);
  const extraDays = Math.ceil(gp / 1000);
  return { weeks: 1, extraDays, days: 7 + extraDays };
}

/** RC p. 253: 2,000 gp per HD plus 5,000 gp per asterisk. */
export function constructCost({ hitDice = 1, asterisks = 0 } = {}) {
  const hd = Math.max(1, whole(hitDice, 1));
  const stars = nonNegative(asterisks);
  const hitDiceGp = 2000 * hd;
  const asteriskGp = 5000 * stars;
  return { hitDice: hd, asterisks: stars, hitDiceGp, asteriskGp, totalGp: hitDiceGp + asteriskGp };
}

/** RC p. 253: ([ability + level] x 2) - (HD + asterisks). */
export function constructChance({
  abilityScore = null, level = 1, hitDice = 1, asterisks = 0
} = {}) {
  const score = Number(abilityScore);
  if (!Number.isFinite(score)) return null;
  return (score + Math.max(1, whole(level, 1))) * 2
    - (Math.max(1, whole(hitDice, 1)) + nonNegative(asterisks));
}

/** RC p. 253: minimum level, required spell and clerical restrictions. */
export function constructRequirements({ classKey = "", hitDice = 1, asterisks = 0 } = {}) {
  const key = classKeyFor(classKey);
  const divine = DIVINE_KEYS.has(key);
  const hd = Math.max(1, whole(hitDice, 1));
  const stars = nonNegative(asterisks);
  return {
    requiredLevel: Math.max(18, hd),
    requiredSpell: stars >= 3 ? "create any monster" : "create magical monsters",
    clericAllowed: !(divine && stars >= 3),
    overMaximum: hd > 36
  };
}

/** RC p. 255: 1,000 gp per spell level and the usual enchantment timetable. */
export function researchCost(spellLevel = 1) {
  return 1000 * Math.max(1, whole(spellLevel, 1));
}

export function researchTime(spellLevel = 1) {
  return enchantmentTime(researchCost(spellLevel));
}

/**
 * RC p. 255: common spells subtract 3 per level, new spells 5 per level. Each
 * previous failure adds +5%, but a d100 roll of 95 or higher always fails and
 * there is no automatic success.
 */
export function spellResearchChance({
  abilityScore = null, level = 1, spellLevel = 1, newSpell = false, failures = 0
} = {}) {
  const chance = craftingChance({
    abilityScore, level, spellLevel, penaltyPerLevel: newSpell ? 5 : 3
  });
  if (chance === null) return null;
  return chance + 5 * nonNegative(failures);
}

export function researchRollSucceeds(roll, chance) {
  const value = numeric(roll, NaN);
  const target = numeric(chance, -Infinity);
  return {
    roll: value,
    chance: target,
    autoFailure: value >= 95,
    success: Number.isFinite(value) && value < 95 && value <= target
  };
}

/**
 * RC p. 255: successful first-time creation is worth its gp cost in XP;
 * huge magical constructions are worth one third of the successful cost.
 */
export function craftingXp({
  totalGp = 0, success = false, huge = false, firstTime = true
} = {}) {
  if (!success || firstTime === false) return 0;
  const gp = nonNegative(totalGp);
  return huge ? Math.floor(gp / 3) : Math.floor(gp);
}
