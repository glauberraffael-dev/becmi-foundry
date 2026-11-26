/**
 * Dice mechanics for the BECMI system.
 *
 * BECMI uses descending Armor Class (AC 9 = unarmoured, lower is better) and
 * THAC0 ("To Hit Armor Class 0"). To hit AC X with THAC0 T, the attacker needs
 * a modified d20 result of T - X or better.
 *
 * Every roll works from a sheet without a selected token: the actor is optional
 * and the target AC can be supplied by the sheet or falls back to AC 9.
 */

import {
  attackInfo, monsterAttackRows, monsterHpFormula, parseMonsterHitDice, rollExpression
} from "./rules-rc.mjs";
import {
  masteryAttackBonus, masteryDamageFormula, masteryLabel, weaponMasteryFor
} from "./mastery.mjs";

const ABILITY_BONUS = { str: "str", dex: "dex", wis: "wis" };
const DEFAULT_TARGET_AC = 9;

function modifierFor(actor, ability) {
  const ab = actor?.system?.abilities?.[ability];
  if (!ab) return 0;
  const derived = Number(actor?.system?.attributes?.adjustments?.[ability] ?? 0);
  return derived + Number(ab.bonus ?? ab.mod ?? 0);
}

function clampedRoll(value, min = 1, max = 20) {
  return Math.min(max, Math.max(min, value));
}

function rollName(actor, item) {
  return actor?.name ?? item?.name ?? "BECMI";
}

/** Render a roll to chat using the shared BECMI card. */
async function toChat(roll, { title, flavor, result, target, outcome, rollMode, actor }) {
  const html = await foundry.applications.handlebars.renderTemplate(
    "systems/becmi/templates/chat/roll.hbs",
    {
      title,
      flavor,
      result,
      target,
      outcome,
      isHit: outcome === "hit",
      isMiss: outcome === "miss",
      total: Math.round(roll.total),
      formula: roll.formula,
      dice: roll.dice.map((d) => ({
        faces: d.faces,
        results: d.results.map((r) => ({
          result: r.result,
          active: r.active !== false
        }))
      })),
      showDice: game.settings.get("becmi", "showDice"),
      darkMode: Boolean(game.settings?.get?.("becmi", "darkMode"))
    }
  );

  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html,
    flavor: title,
    rollMode: rollMode ?? game.settings.get("core", "rollMode"),
    rolls: [roll],
    sound: outcome === "hit" ? "sounds/dice.wav" : undefined
  });
}

/** Resolve the target AC from options, a targeted token, or the default AC 9. */
function resolveTargetAC(targetAC) {
  if (targetAC !== undefined && targetAC !== null && targetAC !== "") {
    const value = Number(targetAC);
    if (Number.isFinite(value)) return { ac: value, assumed: false };
  }
  const target = [...(game.user.targets ?? [])][0];
  if (target?.actor) {
    const t = target.actor.system ?? {};
    const ac = Number(t.ac?.value ?? t.attributes?.ac?.value ?? t.ac ?? NaN);
    if (Number.isFinite(ac)) return { ac, assumed: false };
  }
  return { ac: DEFAULT_TARGET_AC, assumed: true };
}

/**
 * Roll an attack. Accepts an explicit target AC, otherwise uses a targeted
 * token, otherwise assumes the unarmoured AC 9. No token is required.
 */
export async function attackRoll(actor, item, { targetAC, rollMode, skipDamage = false } = {}) {
  const system = actor?.system ?? {};
  const attrs = system.attributes ?? system;
  const thac0 = Number(attrs.thac0?.value ?? attrs.thac0 ?? 10);
  const ability = item?.system?.attackAbility === "dex" ? "dex" : "str";
  let bonus = modifierFor(actor, ability) + Number(item?.system?.attackBonus ?? 0);
  if (item?.system?.magicBonus) bonus += Number(item.system.magicBonus);
  const mastery = weaponMasteryFor(actor, item);
  bonus += masteryAttackBonus(mastery);

  const { ac, assumed } = resolveTargetAC(targetAC);
  if (assumed) {
    ui.notifications.info(game.i18n.format("BECMI.notification.assumedTargetAC", { ac }));
  }

  const spec = attrs.attackSpec;
  let needed = clampedRoll(thac0 - ac - bonus, 1, 20);
  let auto = false;
  if (spec) {
    const info = attackInfo(spec, ac, bonus);
    if (Number.isFinite(info.needed)) {
      needed = clampedRoll(info.needed - bonus, 1, 20);
      auto = info.auto;
    }
  }
  const formula = `1d20${bonus >= 0 ? " + " : " - "}${Math.abs(bonus)}`;
  const roll = await new Roll(formula).evaluate();
  const total = Math.round(roll.total);
  const natural = total - Math.round(bonus);
  // BECMI: a natural 1 always misses, a natural 20 always hits; † also hits.
  const hit = natural === 20 || (natural !== 1 && (auto || total >= needed));

  const result = `${total} vs AC ${ac}${assumed ? " (assumed)" : ""} (needed ${auto ? `${needed}†` : `${needed}+`})${mastery ? ` — ${masteryLabel(mastery)}` : ""}`;
  await toChat(roll, {
    title: game.i18n.localize("BECMI.rolls.attack"),
    flavor: `${rollName(actor, item)} — ${item?.name ?? "Attack"}`,
    result,
    target: `AC ${ac}`,
    outcome: hit ? "hit" : "miss",
    rollMode,
    actor
  });

  if (hit && !skipDamage && item?.system?.damage) {
    await damageRoll(actor, item, { rollMode });
  }
  return { roll, hit, needed, auto, targetAC: ac };
}

/** Roll damage for a weapon, spell or natural attack. */
export async function damageRoll(actor, item, { rollMode, bonusDamage = 0 } = {}) {
  const mastery = weaponMasteryFor(actor, item);
  const formula = masteryDamageFormula(mastery, item?.system?.damage || "1d6");
  const bonus = modifierFor(actor, "str") + Number(item?.system?.damageBonus ?? 0) + Number(bonusDamage || 0);
  const roll = await new Roll(`${formula}${bonus ? ` + ${bonus}` : ""}`).evaluate();
  await toChat(roll, {
    title: game.i18n.localize("BECMI.rolls.damage"),
    flavor: `${rollName(actor, item)} — ${item?.name ?? "Damage"}${mastery ? ` (${masteryLabel(mastery)})` : ""}`,
    result: `${Math.round(roll.total)} damage`,
    rollMode,
    actor
  });
  return roll;
}

/**
 * One button per natural attack, with separate attack-only and damage-only
 * rolls. `mode: "both"` is kept for callers that still want the old combined
 * behaviour; the sheet uses the two explicit modes.
 */
export async function monsterAttackRoll(actor, index, { mode = "attack", ...options } = {}) {
  const row = monsterAttackRow(actor, index);
  if (!row) return null;
  const pseudoItem = monsterAttackItem(row);
  if (mode === "damage") return monsterDamageRoll(actor, index, options);
  return attackRoll(actor, pseudoItem, { ...options, skipDamage: mode !== "both" });
}

/** Damage-only roll for one natural attack, independent of its attack roll. */
export async function monsterDamageRoll(actor, index, options = {}) {
  const row = monsterAttackRow(actor, index);
  if (!row) return null;
  if (!row.damage) {
    ui.notifications.warn(game.i18n.localize("BECMI.notification.noFormula"));
    return null;
  }
  return damageRoll(actor, monsterAttackItem(row), options);
}

function monsterAttackRow(actor, index) {
  const weapons = [...(actor?.items ?? [])].filter((item) => item.type === "weapon");
  const row = monsterAttackRows(actor?.system ?? {}, { weapons })[Number(index)];
  if (!row) ui.notifications.warn(game.i18n.localize("BECMI.notification.noMonsterAttack"));
  return row ?? null;
}

function monsterAttackItem(row) {
  const name = row.weaponName ? `${row.name} — ${row.weaponName}` : row.name;
  return {
    name: row.note && !row.weaponName ? `${name} (${row.note})` : name,
    system: {
      damage: row.damage,
      attackAbility: row.attackAbility,
      attackBonus: Number(row.attackBonus) || 0,
      magicBonus: Number(row.magicBonus) || 0,
      damageBonus: Number(row.damageBonus) || 0
    }
  };
}

/** Roll an arbitrary item formula (spell effect, treasure value, etc.). */
export async function itemFormulaRoll(actor, item, { rollMode, expression } = {}) {
  const raw = expression ?? item?.system?.rollFormula;
  if (!raw) {
    ui.notifications.warn(game.i18n.localize("BECMI.notification.noFormula"));
    return null;
  }
  const level = Math.max(1, Number(actor?.system?.attributes?.level ?? actor?.system?.level ?? 1) || 1);
  const formula = String(raw).replace(/@level\b/gi, String(level));
  return freeRoll(actor, formula, { rollMode });
}

/** Saving throw: roll d20 >= the actor's save target (modified by Wisdom for spells). */
export async function savingThrow(actor, type, { rollMode } = {}) {
  const key = {
    deathRay: "deathRay",
    poison: "deathRay",
    magicWand: "magicWand",
    wands: "magicWand",
    paralysis: "paralysis",
    stone: "paralysis",
    breath: "breath",
    spells: "spells"
  }[type] ?? type;

  const saves = actor?.system?.saves ?? {};
  // The derived target already includes Wisdom, equipped items and the manual modifier.
  const target = Number(saves[key] ?? saves.value ?? 10);

  const roll = await new Roll("1d20").evaluate();
  const success = roll.total >= target;
  await toChat(roll, {
    title: `${game.i18n.localize("BECMI.rolls.save")}: ${game.i18n.localize(`BECMI.saves.${key}`)}`,
    flavor: rollName(actor),
    result: `${Math.round(roll.total)} vs ${target} — ${game.i18n.localize(success ? "BECMI.rolls.success" : "BECMI.rolls.failure")}`,
    outcome: success ? "hit" : "miss",
    rollMode,
    actor
  });
  return { roll, success, target };
}

/** BECMI optional ability check: roll d20 <= ability score (with modifier). */
export async function abilityCheck(actor, ability, { rollMode } = {}) {
  const score = Number(actor?.system?.abilities?.[ability]?.value ?? 10);
  const bonus = modifierFor(actor, ability);
  const roll = await new Roll("1d20").evaluate();
  const success = roll.total <= score + bonus;
  await toChat(roll, {
    title: `${game.i18n.localize("BECMI.rolls.abilityCheck")}: ${game.i18n.localize(`BECMI.abilities.${ability}`)}`,
    flavor: rollName(actor),
    result: `${Math.round(roll.total)} vs ${score + bonus} — ${game.i18n.localize(success ? "BECMI.rolls.success" : "BECMI.rolls.failure")}`,
    outcome: success ? "hit" : "miss",
    rollMode,
    actor
  });
  return { roll, success };
}

/** d6 initiative (high roll acts first). */
export async function initiativeRoll(actor, { rollMode } = {}) {
  const bonus = Number(actor?.system?.attributes?.initiativeBonus ?? actor?.system?.initiativeBonus ?? 0);
  const roll = await new Roll(`1d6${bonus ? ` + ${bonus}` : ""}`).evaluate();
  await toChat(roll, {
    title: game.i18n.localize("BECMI.rolls.initiative"),
    flavor: rollName(actor),
    result: `${Math.round(roll.total)}`,
    rollMode,
    actor
  });
  // Any combatant can roll initiative, not only the currently active character.
  const combat = game.combat;
  const combatant = combat?.combatants?.find((entry) =>
    entry.actor === actor || entry.token?.actor === actor || entry.actor?.id === actor?.id);
  if (combatant) await combat.setInitiative(combatant.id, roll.total);
  return roll;
}

/** 2d6 morale check: succeed when the roll is <= morale. */
export async function moraleCheck(actor, { rollMode } = {}) {
  const morale = Number(actor?.system?.morale?.value ?? actor?.system?.morale ?? 7);
  const roll = await new Roll("2d6").evaluate();
  const success = roll.total <= morale;
  await toChat(roll, {
    title: game.i18n.localize("BECMI.rolls.morale"),
    flavor: rollName(actor),
    result: `${Math.round(roll.total)} vs ${morale} — ${game.i18n.localize(success ? "BECMI.rolls.success" : "BECMI.rolls.failure")}`,
    outcome: success ? "hit" : "miss",
    rollMode,
    actor
  });
  return { roll, success };
}

/** Roll monster hit dice to generate hit points (RC p. 152: HD counts d8). */
export async function hitDiceRoll(actor, { rollMode } = {}) {
  const hd = String(actor?.system?.hd ?? actor?.system?.attributes?.hd ?? "1");
  const parsed = parseMonsterHitDice(hd);
  const formula = monsterHpFormula(hd);
  const roll = await new Roll(formula).evaluate();
  const result = parsed.kind === "fraction" ? "1 HP" : `${Math.round(roll.total)} HP`;
  await toChat(roll, {
    title: game.i18n.localize("BECMI.rolls.hitDice"),
    flavor: rollName(actor),
    result,
    rollMode,
    actor
  });
  return roll;
}

/** Roll monster HP from HD and apply it, so the token bar follows the result. */
export async function monsterHpRoll(actor, { rollMode, apply = true } = {}) {
  const hd = String(actor?.system?.hd ?? "1");
  const formula = monsterHpFormula(hd);
  if (!formula) {
    ui.notifications.warn(game.i18n.localize("BECMI.notification.noFormula"));
    return null;
  }
  const roll = await new Roll(formula).evaluate();
  const hp = Math.max(1, Math.round(roll.total));
  if (actor && apply) {
    await actor.update({
      "system.hp": hp,
      "system.attributes.hp.value": hp,
      "flags.becmi.exactHp": true
    });
  }
  await toChat(roll, {
    title: game.i18n.localize("BECMI.rolls.hitPoints"),
    flavor: rollName(actor),
    result: `${hp} HP`,
    rollMode,
    actor
  });
  return { roll, hp };
}

/** Roll an arbitrary BECMI expression (NdM, +/- and half(...) are supported). */
export async function freeRoll(actor, expression, { rollMode } = {}) {
  const parsed = rollExpression(expression);
  if (!parsed.valid) {
    ui.notifications.warn(game.i18n.format("BECMI.notification.badExpression", { expression: String(expression) }));
    return null;
  }
  const roll = await new Roll(String(parsed.total)).evaluate();
  await toChat(roll, {
    title: game.i18n.localize("BECMI.rolls.free"),
    flavor: `${rollName(actor)} — ${parsed.formula}`,
    result: String(parsed.total),
    rollMode,
    actor
  });
  return { roll, total: parsed.total };
}

/** d100 <= skill chance, as in the Rules Cyclopedia thief table. */
export async function thiefSkillRoll(actor, skill, { rollMode } = {}) {
  const chance = Number(actor?.system?.thiefSkills?.[skill] ?? 0);
  const roll = await new Roll("1d100").evaluate();
  const success = roll.total <= chance;
  await toChat(roll, {
    title: `${game.i18n.localize("BECMI.rolls.skill")}: ${game.i18n.localize(`BECMI.thief.${skill}`)}`,
    flavor: rollName(actor),
    result: `${Math.round(roll.total)} vs ${chance}% — ${game.i18n.localize(success ? "BECMI.rolls.success" : "BECMI.rolls.failure")}`,
    outcome: success ? "hit" : "miss",
    rollMode,
    actor
  });
  return { roll, success };
}

/** Turn Undead: 2d6 against the level column, then roll the HD dice. */
export async function turnUndeadRoll(actor, typeName, { rollMode, level, control = false } = {}) {
  const { turnUndeadCell, resolveTurnResult } = await import("./rules-rc.mjs");
  const effectiveLevel = Number(level ?? actor?.system?.attributes?.level ?? 1) || 1;
  const cell = turnUndeadCell(effectiveLevel, typeName);
  const check = await new Roll("2d6").evaluate();
  const outcome = resolveTurnResult(cell, check.total);
  let result = `${cell} — ${game.i18n.localize(`BECMI.undead.outcome.${outcome.kind}`)}`;
  if (outcome.dice) {
    const dice = await new Roll(outcome.dice).evaluate();
    result += ` (${dice.total} HD)`;
  }
  if (control && (outcome.kind === "turn" || outcome.kind === "destroy")) {
    result += ` — ${game.i18n.format("BECMI.rolls.controlUndead", { turns: effectiveLevel })}`;
  }
  await toChat(check, {
    title: `${game.i18n.localize("BECMI.rolls.turnUndead")}: ${typeName}`,
    flavor: `${rollName(actor)} — ${game.i18n.localize("BECMI.labels.level")} ${effectiveLevel}`,
    result,
    outcome: outcome.kind === "failure" || outcome.kind === "impossible" ? "miss" : "hit",
    rollMode,
    actor
  });
  return { roll: check, cell, outcome, level: effectiveLevel };
}

/**
 * Paladins and avengers concentrate for a 120' Detect Evil once per round.
 * There is no die roll; the chat card records the round and the attack ban.
 */
export async function detectEvilRoll(actor, { rollMode } = {}) {
  const title = game.i18n.localize("BECMI.rolls.detectEvil");
  const round = game.combat?.round ?? null;
  const content = `<div class="becmi-chat-detect-evil">
    <p><strong>${title}</strong></p>
    <p>${game.i18n.localize("BECMI.rolls.detectEvilRange")}</p>
    <p>${game.i18n.format("BECMI.rolls.detectEvilRound", { round: round ?? "—" })}</p>
    <p>${game.i18n.localize("BECMI.rolls.detectEvilNoAttack")}</p>
  </div>`;
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content,
    flavor: title,
    rollMode: rollMode ?? game.settings.get("core", "rollMode")
  });
}
