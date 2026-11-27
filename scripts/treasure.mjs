/**
 * Foundry-facing treasure procedures from Rules Cyclopedia chapter 16.
 *
 * The pure tables and rollers live in rules-rc.mjs; this module only posts the
 * results to chat. Nothing here writes to an Actor.
 */
import {
  gemValue, jewelryValue, rollMagicItem, rollTreasureType, treasureTypeInfo
} from "./rules-rc.mjs";

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
