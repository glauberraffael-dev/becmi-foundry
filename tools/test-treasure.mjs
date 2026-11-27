/**
 * Foundry-independent smoke test for the treasure chat procedures.
 *
 * Usage: node tools/test-treasure.mjs
 */
const messages = [];
const warnings = [];

globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ alias: actor?.name ?? "BECMI" }),
  async create(data) {
    messages.push(data);
    return data;
  }
};
globalThis.Roll = class {
  constructor(formula) { this.formula = formula; }
  async evaluate() { this.total = 42; return this; }
};
globalThis.game = {
  i18n: {
    localize: (key) => key,
    format: (key, data) => `${key}:${JSON.stringify(data)}`
  },
  settings: { get: (_scope, key) => key === "rollMode" ? "publicroll" : false }
};
globalThis.ui = { notifications: { warn: (message) => warnings.push(message) } };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const { rollGemValue, rollJewelryValue, rollMagicCrafting, rollMagicItemCard, rollTreasure } =
  await import("../scripts/treasure.mjs");

const actor = { name: "DM" };

const treasure = await rollTreasure(actor, { type: "A", location: "lair" });
assert(treasure?.type === "A" && treasure.location === "lair", "treasure type A did not roll");
assert(Object.keys(treasure.coins).length === 5, "the lair coin columns are missing");
assert(messages.at(-1).content.includes("BECMI.treasure.rollTitle"), "the treasure card has no title");
assert(messages.at(-1).content.includes("BECMI.treasure.average"), "the treasure card omitted the average");
assert(messages.at(-1).rollMode === "publicroll", "the treasure card ignored the roll mode");

const gem = await rollGemValue(actor, { roll: 98, averageLevel: 5 });
assert(gem.value === 5000 && gem.adjusted === 88, "the gem value did not apply the -10 adjustment");
assert(messages.at(-1).content.includes("BECMI.treasure.gemResult"), "the gem card was not posted");

const jewelry = await rollJewelryValue(actor, { roll: 100 });
assert(jewelry.value === 50000 && jewelry.enc === 50, "the jewelry value is wrong");
assert(messages.at(-1).content.includes("BECMI.treasure.jewelryResult"), "the jewelry card was not posted");

const armor = await rollMagicItemCard(actor, { category: "armor" });
assert(armor?.key === "armor" && armor.item, "the magical item roll did not resolve");
assert(messages.at(-1).content.includes("BECMI.treasure.magicResult"), "the item card was not posted");

assert(await rollTreasure(actor, { type: "Z" }) === null, "an invalid treasure type was accepted");
assert(warnings.length === 1, "the invalid type did not warn the GM");

const crafting = await rollMagicCrafting({
  system: { attributes: { classKey: "cleric", level: 10 }, abilities: { wis: { value: 16 } } },
  name: "Caster"
}, { mode: "armor", priceGp: 60, encumbranceCn: 150, bonuses: 1, roll: 40 });
assert(crafting?.mode === "armor" && crafting.success && crafting.totalGp === 3000,
  "crafting card computes armor cost and success");
assert(messages.at(-1)?.content.includes("BECMI.crafting.title.armor"),
  "crafting card is posted to chat");

assert(messages.length === 5, `expected 5 chat cards, got ${messages.length}`);

console.log(`Treasure procedures OK: ${messages.length} chat cards.`);
