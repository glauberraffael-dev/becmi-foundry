/**
 * Dice mechanics for the BECMI system.
 *
 * BECMI uses descending Armor Class (AC 0 = unarmoured, higher is better) and
 * THAC0 ("To Hit Armor Class 0"). To hit AC X with THAC0 T, the attacker needs
 * a natural (modified) roll of T - X or better.
 */

const ABILITY_BONUS = { str: "str", dex: "dex", wis: "wis" };

function modifierFor(actor, ability) {
  const ab = actor?.system?.abilities?.[ability];
  if (!ab) return 0;
  return Number(ab.bonus ?? ab.mod ?? 0);
}

function clampedRoll(value, min = 1, max = 20) {
  return Math.min(max, Math.max(min, value));
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
      showDice: game.settings.get("becmi", "showDice")
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

/** Roll an attack. Accepts an explicit target AC, otherwise uses the selected token. */
export async function attackRoll(actor, item, { targetAC, rollMode } = {}) {
  const system = actor.system;
  const attrs = system.attributes ?? system;
  const thac0 = Number(attrs.thac0?.value ?? attrs.thac0 ?? 10);
  const ability = item?.system?.attackAbility === "dex" ? "dex" : "str";
  let bonus = modifierFor(actor, ability) + Number(item?.system?.attackBonus ?? 0);
  if (item?.system?.magicBonus) bonus += Number(item.system.magicBonus);

  let ac = targetAC;
  if (ac === undefined) {
    const target = [...game.user.targets][0];
    if (target?.actor) {
      const t = target.actor.system;
      ac = Number(t.ac?.value ?? t.attributes?.ac?.value ?? t.ac ?? 0);
    }
  }
  if (ac === undefined || Number.isNaN(ac)) {
    ui.notifications.warn(game.i18n.localize("BECMI.notification.noTarget"));
    return null;
  }

  const needed = clampedRoll(thac0 - ac - bonus, 1, 20);
  const formula = `1d20${bonus >= 0 ? " + " : " - "}${Math.abs(bonus)}`;
  const roll = await new Roll(formula).evaluate({ async: true });
  const total = Math.round(roll.total);
  // BECMI: a natural 1 always misses, a natural 20 always hits.
  const hit = total === 20 ? true : total === 1 ? false : total >= needed;

  const result = `${total} vs AC ${ac} (needed ${needed}+)`;
  await toChat(roll, {
    title: game.i18n.localize("BECMI.rolls.attack"),
    flavor: `${actor.name} — ${item?.name ?? "Attack"}`,
    result,
    target: `AC ${ac}`,
    outcome: hit ? "hit" : "miss",
    rollMode,
    actor
  });

  if (hit && item?.system?.damage) {
    await damageRoll(actor, item, { rollMode });
  }
  return { roll, hit, needed };
}

/** Roll damage for a weapon or natural attack. */
export async function damageRoll(actor, item, { rollMode } = {}) {
  const formula = item?.system?.damage || "1d6";
  const bonus = modifierFor(actor, "str") + Number(item?.system?.damageBonus ?? 0);
  const roll = await new Roll(`${formula}${bonus ? ` + ${bonus}` : ""}`).evaluate({ async: true });
  await toChat(roll, {
    title: game.i18n.localize("BECMI.rolls.damage"),
    flavor: `${actor.name} — ${item.name}`,
    result: `${Math.round(roll.total)} damage`,
    rollMode,
    actor
  });
  return roll;
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

  const saves = actor.system.saves ?? {};
  let target = Number(saves[key] ?? saves.value ?? 10);
  if (key === "spells") target += modifierFor(actor, "wis");

  const roll = await new Roll("1d20").evaluate({ async: true });
  const success = roll.total >= target;
  await toChat(roll, {
    title: `${game.i18n.localize("BECMI.rolls.save")}: ${game.i18n.localize(`BECMI.saves.${key}`)}`,
    flavor: actor.name,
    result: `${Math.round(roll.total)} vs ${target} — ${game.i18n.localize(success ? "BECMI.rolls.success" : "BECMI.rolls.failure")}`,
    outcome: success ? "hit" : "miss",
    rollMode,
    actor
  });
  return { roll, success, target };
}

/** BECMI optional ability check: roll d20 <= ability score (with modifier). */
export async function abilityCheck(actor, ability, { rollMode } = {}) {
  const score = Number(actor.system.abilities?.[ability]?.value ?? 10);
  const bonus = modifierFor(actor, ability);
  const roll = await new Roll("1d20").evaluate({ async: true });
  const success = roll.total <= score + bonus;
  await toChat(roll, {
    title: `${game.i18n.localize("BECMI.rolls.abilityCheck")}: ${game.i18n.localize(`BECMI.abilities.${ability}`)}`,
    flavor: actor.name,
    result: `${Math.round(roll.total)} vs ${score + bonus} — ${game.i18n.localize(success ? "BECMI.rolls.success" : "BECMI.rolls.failure")}`,
    outcome: success ? "hit" : "miss",
    rollMode,
    actor
  });
  return { roll, success };
}

/** d6 initiative (high roll acts first). */
export async function initiativeRoll(actor, { rollMode } = {}) {
  const bonus = Number(actor.system.attributes?.initiativeBonus ?? actor.system.initiativeBonus ?? 0);
  const roll = await new Roll(`1d6${bonus ? ` + ${bonus}` : ""}`).evaluate({ async: true });
  await toChat(roll, {
    title: game.i18n.localize("BECMI.rolls.initiative"),
    flavor: actor.name,
    result: `${Math.round(roll.total)}`,
    rollMode,
    actor
  });
  if (actor.type === "character" && game.combat?.combatant?.actor === actor) {
    await game.combat.setInitiative(game.combat.combatant.id, roll.total);
  }
  return roll;
}

/** 2d6 morale check: succeed when the roll is <= morale. */
export async function moraleCheck(actor, { rollMode } = {}) {
  const morale = Number(actor.system.morale?.value ?? actor.system.morale ?? 7);
  const roll = await new Roll("2d6").evaluate({ async: true });
  const success = roll.total <= morale;
  await toChat(roll, {
    title: game.i18n.localize("BECMI.rolls.morale"),
    flavor: actor.name,
    result: `${Math.round(roll.total)} vs ${morale} — ${game.i18n.localize(success ? "BECMI.rolls.success" : "BECMI.rolls.failure")}`,
    outcome: success ? "hit" : "miss",
    rollMode,
    actor
  });
  return { roll, success };
}

/** Roll monster hit dice to generate hit points. */
export async function hitDiceRoll(actor, { rollMode } = {}) {
  const hd = String(actor.system.hd || "1").replace(/\*+$/, "").trim();
  let formula;
  if (hd.includes("/")) formula = "1"; // fractional Hit Dice have 1 hit point
  else if (/^\d+(?:\s*[-+]\s*\d+)?$/.test(hd)) formula = hd.replace(/^(\d+)/, "$1d8");
  else if (/^\d+d\d+/.test(hd)) formula = hd;
  else formula = "1d8";
  const roll = await new Roll(formula).evaluate({ async: true });
  await toChat(roll, {
    title: game.i18n.localize("BECMI.rolls.hitDice"),
    flavor: actor.name,
    result: `${Math.round(roll.total)} HP`,
    rollMode,
    actor
  });
  return roll;
}
