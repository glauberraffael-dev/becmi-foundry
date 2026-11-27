/**
 * Foundry-facing treasure procedures from Rules Cyclopedia chapter 16.
 *
 * The pure tables and rollers live in rules-rc.mjs; this module only posts the
 * results to chat. Nothing here writes to an Actor.
 */
import {
  gemValue, jewelryValue, rollMagicItem, rollTreasureType, treasureTypeInfo
} from "./rules-rc.mjs";
import {
  armorWeaponEnchantmentCost, constructChance, constructCost, constructRequirements,
  craftingAbilityScore, craftingChance, craftingXp, enchantmentTime, researchCost,
  researchRollSucceeds, researchTime, spellEffectCost, spellResearchChance
} from "./magic-crafting.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function group(result) {
  if (!result?.found) return "—";
  const roll = result.roll === null ? "" : ` (d100 ${result.roll}/${result.chance})`;
  const amount = result.amount === result.count ? String(result.count) : `${result.amount} (${result.recipe})`;
  return `${amount}${roll}`;
}

function rollMode(options) {
  return options?.rollMode ?? game.settings?.get?.("core", "rollMode") ?? "publicroll";
}

async function postCard(actor, title, lines) {
  const content = `<div class="becmi-roll-card becmi-treasure-card">`
    + `<h3 class="becmi-roll-card__title">${escapeHtml(title)}</h3>`
    + lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")
    + `</div>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: title,
    content,
    rollMode: rollMode({})
  });
  return content;
}

function magicCategoryFromText(text) {
  const value = String(text ?? "").toLowerCase();
  const mentions = (word) => value.includes(word);
  if (mentions("potion") && !mentions("scroll") && !mentions("sword") && !mentions("weapon")
    && !mentions("armor") && !mentions("ring") && !mentions("wand")) return "potions";
  if (mentions("scroll") && !mentions("potion") && !mentions("sword") && !mentions("weapon")
    && !mentions("armor") && !mentions("ring") && !mentions("wand")) return "scrolls";
  return null;
}

function magicItemLines(result) {
  if (!result?.found) return [`Magic items: none (d100 ${result?.roll}/${result?.chance}).`];
  const lines = [`Magic items: ${result.text} (d100 ${result.roll}/${result.chance}).`];
  const category = magicCategoryFromText(result.text);
  for (let index = 0; index < Math.min(result.count, 20); index++) {
    const item = rollMagicItem(category ? { category } : {});
    lines.push(`  ${index + 1}. ${item ? `${item.item}${item.details?.special ? ` — ${item.details.special}` : ""}` : "no result"}`);
  }
  return lines;
}

/** RC pp. 225-226: random treasure from one lettered type. */
export async function rollTreasure(actor, input) {
  const info = treasureTypeInfo(input?.type, input?.location ?? "auto");
  if (!info) {
    ui.notifications?.warn(game.i18n.localize("BECMI.notification.treasureTypeMissing"));
    return null;
  }
  const result = rollTreasureType(input);
  const title = game.i18n.format("BECMI.treasure.rollTitle", { type: result.type, location: result.location });
  const coinLines = Object.entries(result.coins)
    .filter(([, value]) => value)
    .map(([coin, value]) => `${coin.toUpperCase()}: ${group(value)}`);
  const lines = [
    game.i18n.format("BECMI.treasure.location", { location: result.location }),
    ...(coinLines.length ? coinLines : ["Coins: none"]),
    game.i18n.format("BECMI.treasure.coinTotal", { gp: Math.round(result.coinGp * 100) / 100 }),
    `Gems: ${group(result.gems)}`,
    `Jewelry: ${group(result.jewelry)}`,
    `Special treasure: ${group(result.special)}`,
    ...magicItemLines(result.magic),
    ...(result.averageGp === null
      ? []
      : [game.i18n.format("BECMI.treasure.average", { gp: result.averageGp })])
  ];
  await postCard(actor, title, lines);
  return result;
}

/** RC p. 226 Gem Value Table. */
export async function rollGemValue(actor, input) {
  const result = gemValue(input);
  const title = game.i18n.localize("BECMI.treasure.gemValue");
  await postCard(actor, title, [
    game.i18n.format("BECMI.treasure.valueDetail", { raw: result.raw, adjusted: result.adjusted }),
    result.value === null
      ? game.i18n.format("BECMI.treasure.specialGem", { examples: result.examples })
      : game.i18n.format("BECMI.treasure.gemResult", { value: result.value, examples: result.examples })
  ]);
  return result;
}

/** RC p. 227 Jewelry Value Table. */
export async function rollJewelryValue(actor, input) {
  const result = jewelryValue(input);
  const title = game.i18n.localize("BECMI.treasure.jewelryValue");
  await postCard(actor, title, [
    game.i18n.format("BECMI.treasure.valueDetail", { raw: result.raw, adjusted: result.adjusted }),
    game.i18n.format("BECMI.treasure.jewelryResult", { value: result.value, enc: result.enc })
  ]);
  return result;
}

/** RC pp. 228-231: roll the main category, then the exact item. */
export async function rollMagicItemCard(actor, input = {}) {
  const result = rollMagicItem(input);
  if (!result) {
    ui.notifications?.warn(game.i18n.localize("BECMI.notification.treasureTypeMissing"));
    return null;
  }
  const title = game.i18n.localize("BECMI.treasure.magicItem");
  await postCard(actor, title, [
    game.i18n.format("BECMI.treasure.magicCategory", {
      category: result.name,
      roll: result.roll === null ? "—" : result.roll
    }),
    game.i18n.format("BECMI.treasure.magicResult", { item: result.item })
  ]);
  return result;
}

async function craftingRoll(input) {
  if (input?.roll !== undefined && input?.roll !== null && input?.roll !== "") {
    return Number(input.roll);
  }
  const roll = await new Roll("1d100").evaluate();
  return Number(roll.total);
}

function craftingSource(actor, input) {
  const attrs = actor?.system?.attributes ?? {};
  const classKey = input.classKey || attrs.classKey || attrs.class || "";
  const abilities = actor?.system?.abilities ?? input.abilities ?? {};
  const ability = craftingAbilityScore(classKey, abilities);
  const abilityScore = Number(input.abilityScore ?? ability?.value);
  const level = Math.max(1, Number(input.level ?? attrs.level ?? 1) || 1);
  return { classKey, ability, abilityScore, level };
}

function chanceLine(chance, score, level, penalty, label) {
  return game.i18n.format("BECMI.crafting.chance", {
    label, score, level, penalty, chance
  });
}

/** RC pp. 250-255: costs, chances, time and first-time XP for creation work. */
export async function rollMagicCrafting(actor, input = {}) {
  const mode = String(input.mode ?? "spellEffect").toLowerCase();
  const { ability, abilityScore, level } = craftingSource(actor, input);
  if (!Number.isFinite(abilityScore)) {
    ui.notifications?.warn(game.i18n.localize("BECMI.notification.craftingCaster"));
    return null;
  }

  const roll = await craftingRoll(input);
  const firstTime = input.firstTime !== false;
  const lines = [];
  let titleKey = "miscellaneous";
  let success = false;
  let chance = null;
  let totalGp = 0;
  let huge = false;

  if (mode === "armor" || mode === "weapon") {
    const cost = armorWeaponEnchantmentCost({ ...input, kind: mode });
    totalGp = cost.totalInitialGp;
    chance = craftingChance({ abilityScore, level, bonusLevels: cost.bonusCount });
    success = roll <= chance;
    titleKey = mode;
    lines.push(
      game.i18n.format("BECMI.crafting.baseCost", {
        raw: cost.rawGp, unrounded: Math.ceil(cost.unroundedGp), rounded: cost.roundedBaseGp
      }),
      game.i18n.format("BECMI.crafting.initialCost", {
        initial: cost.initialGp, minimum: cost.minimumGp, bonuses: cost.bonusCount
      }),
      game.i18n.format("BECMI.crafting.opponentCost", {
        cost: cost.opponentCostGp, bonuses: cost.bonusesAgainstOpponents, restrictions: cost.restrictions
      }),
      chanceLine(chance, abilityScore, level, `3 x ${cost.bonusCount}`, ability?.label ?? "Intelligence")
    );
  } else if (mode === "construct") {
    const cost = constructCost({ hitDice: input.hitDice ?? input.hd, asterisks: input.asterisks });
    const requirements = constructRequirements({
      classKey: input.classKey, hitDice: cost.hitDice, asterisks: cost.asterisks
    });
    totalGp = cost.totalGp;
    chance = constructChance({
      abilityScore, level, hitDice: cost.hitDice, asterisks: cost.asterisks
    });
    success = roll <= chance;
    titleKey = "construct";
    lines.push(
      game.i18n.format("BECMI.crafting.constructCost", {
        hd: cost.hitDiceGp, asterisks: cost.asteriskGp, total: cost.totalGp
      }),
      game.i18n.format("BECMI.crafting.requirements", {
        level: requirements.requiredLevel, spell: requirements.requiredSpell
      }),
      game.i18n.format("BECMI.crafting.constructChance", {
        label: ability?.label ?? "Intelligence", score: abilityScore, level,
        hd: cost.hitDice, asterisks: cost.asterisks, chance
      }),
      ...(requirements.clericAllowed ? [] : [game.i18n.localize("BECMI.crafting.clericForbidden")]),
      ...(requirements.overMaximum ? [game.i18n.localize("BECMI.crafting.constructLimit")] : [])
    );
  } else if (mode === "research") {
    const spellLevel = Math.max(1, Number(input.spellLevel ?? 1) || 1);
    totalGp = researchCost(spellLevel);
    chance = spellResearchChance({
      abilityScore, level, spellLevel,
      newSpell: Boolean(input.newSpell), failures: input.failures
    });
    const result = researchRollSucceeds(roll, chance);
    success = result.success;
    titleKey = "research";
    lines.push(
      game.i18n.format("BECMI.crafting.researchCost", { gp: totalGp }),
      chanceLine(chance, abilityScore, level,
        `${Boolean(input.newSpell) ? 5 : 3} x ${spellLevel}`
          + (Number(input.failures) > 0 ? ` - 5 x ${input.failures}` : ""),
        ability?.label ?? "Intelligence"),
      ...(result.autoFailure ? [game.i18n.localize("BECMI.crafting.autoFailure")] : [])
    );
  } else {
    const spellLevel = Math.max(1, Number(input.spellLevel ?? input.spellLevels ?? 1) || 1);
    const cost = spellEffectCost({ ...input, spellLevels: input.spellLevels ?? spellLevel });
    totalGp = cost.totalGp;
    chance = craftingChance({ abilityScore, level, spellLevel });
    success = roll <= chance;
    huge = Boolean(input.huge);
    lines.push(
      game.i18n.format("BECMI.crafting.effectCost", {
        initial: cost.initialGp, charges: cost.chargesGp,
        permanency: cost.permanencyGp, restrictions: cost.restrictionDiscountGp ?? 0,
        total: cost.totalGp
      }),
      chanceLine(chance, abilityScore, level, `3 x ${spellLevel}`, ability?.label ?? "Intelligence")
    );
  }

  const time = mode === "research" ? researchTime(input.spellLevel ?? 1) : enchantmentTime(totalGp);
  const xp = craftingXp({ totalGp, success, huge, firstTime });
  lines.push(
    game.i18n.format("BECMI.crafting.roll", {
      roll, chance, result: success
        ? game.i18n.localize("BECMI.crafting.result.success")
        : game.i18n.localize("BECMI.crafting.result.failure")
    }),
    game.i18n.format("BECMI.crafting.time", {
      extra: time.extraDays, total: time.days
    }),
    game.i18n.format("BECMI.crafting.xp", {
      xp,
      repeatNote: firstTime ? "" : game.i18n.localize("BECMI.crafting.repeatNote")
    })
  );

  const title = game.i18n.localize(`BECMI.crafting.title.${titleKey}`);
  await postCard(actor, title, lines);
  return { mode, chance, roll, success, totalGp, time, xp, lines };
}
