/**
 * Optional weapon mastery helpers.
 *
 * The Rules Cyclopedia presents weapon mastery as an optional system that any
 * character may learn. A character opts in with `system.mastery.enabled`; when
 * the flag is off, rolls keep the plain BECMI behaviour. The helpers here are
 * pure so they can be tested without Foundry.
 */

import { RC, chooseDamage, masteryData, masteryWeapon } from "./rules-rc.mjs";

export function masteryEnabled(actor) {
  return Boolean(actor?.system?.mastery?.enabled);
}

/** A filled mastery row means an existing sheet can still find its data after opting in. */
export function hasMasteryRows(actor) {
  return (actor?.system?.mastery?.rows ?? []).some((row) =>
    Boolean(String(row?.name ?? "").trim()) || Boolean(row?.grade && row?.grade !== "sem"));
}

function matchingRow(actor, weapon) {
  const needle = String(weapon.name).toLowerCase();
  return (actor?.system?.mastery?.rows ?? []).find((row) =>
    String(masteryWeapon(row?.name)?.name ?? "").toLowerCase() === needle);
}

/**
 * Resolve the mastery entry that applies to an item, or null when mastery is
 * disabled, the weapon is unknown, or the character has no training in it.
 */
export function weaponMasteryFor(actor, item) {
  if (!masteryEnabled(actor)) return null;
  const name = item?.name ?? item?.system?.weaponName ?? "";
  const weapon = masteryWeapon(name);
  if (!weapon) return null;
  const row = matchingRow(actor, weapon);
  if (!row || !row.grade || row.grade === "sem") return null;
  const data = masteryData(weapon, row.grade);
  if (!data) return null;
  const target = row.target === "sec" ? "sec" : "prim";
  const hand = String(row.primary ?? "H").trim().toUpperCase() === "S" ? "S" : "H";
  return {
    weapon: weapon.name,
    grade: row.grade,
    gradeName: RC.mastery.grades[row.grade]?.nome ?? row.grade,
    hand,
    target,
    attackBonus: Number(data.attack?.[hand === "S" ? 1 : 0] ?? 0),
    damageFormula: chooseDamage(data.damage, target),
    defense: data.defense,
    special: data.special,
    dv: data.dv
  };
}

/** Mastery adds to the die roll, so it is part of the shared attack bonus. */
export function masteryAttackBonus(entry) {
  return entry?.attackBonus ?? 0;
}

/** Trained mastery replaces the weapon's damage die/rank. */
export function masteryDamageFormula(entry, fallback = "") {
  const formula = String(entry?.damageFormula ?? "").trim();
  return formula && formula !== "—" ? formula : fallback;
}

export function masteryLabel(entry) {
  if (!entry) return "";
  const side = entry.target === "sec" ? "secondary" : "primary";
  return `${entry.gradeName} (${entry.hand === "S" ? "off-hand" : "main"}/${side})`;
}
