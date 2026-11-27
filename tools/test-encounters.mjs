/**
 * Foundry-independent smoke test for the encounter chat procedures.
 *
 * Usage: node tools/test-encounters.mjs
 */
const messages = [];
const warnings = [];
const diceQueue = [];
const fixedTotals = { "1d6": 4, "2d6": 7, "1d100": 30, "1d4": 2 };

class FakeRoll {
  constructor(formula) {
    this.formula = formula;
    this.total = 0;
  }

  async evaluate() {
    this.total = diceQueue.length ? diceQueue.shift() : (fixedTotals[this.formula] ?? 1);
    return this;
  }
}

globalThis.Roll = FakeRoll;
globalThis.ChatMessage = {
  getSpeaker: ({ actor }) => ({ alias: actor?.name ?? "BECMI" }),
  async create(data) {
    messages.push(data);
    return data;
  }
};

const reactionTable = {
  name: "Monster Reactions (2d6)",
  uuid: "Compendium.becmi.tables.RollTable.reactions",
  formula: "2d6",
  drawCalls: [],
  async draw(options) {
    this.drawCalls.push({ ...options });
    const roll = new FakeRoll(this.formula);
    await roll.evaluate();
    return { roll, results: [{ text: "<p>Table reaction</p>" }] };
  }
};

globalThis.game = {
  i18n: {
    localize: (key) => key,
    format: (key, data) => `${key}:${JSON.stringify(data)}`
  },
  settings: { get: (_scope, key) => key === "rollMode" ? "publicroll" : false },
  tables: [],
  packs: {
    get: (id) => id === "becmi.tables"
      ? { getDocuments: async () => [reactionTable] }
      : null
  }
};
globalThis.ui = { notifications: { warn: (message) => warnings.push(message) } };

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const {
  availableTables, drawEncounterTable, rollEncounterCheck, rollEncounterDistance,
  rollEvasion, rollPursuitRound, rollReaction, rollSurprise, rollWanderingDistance
} = await import("../scripts/encounters.mjs");

const actor = { name: "DM" };

const tables = await availableTables();
assert(tables.length === 1 && tables[0].name === reactionTable.name, "reaction table was not listed");

diceQueue.push(1);
const check = await rollEncounterCheck(actor, { area: "dungeon" });
assert(check.encounter && check.roll === 1, "the encounter check missed the RC target");
assert(messages.at(-1).rollMode === "publicroll", "the chat card did not use the roll mode");
assert(messages.at(-1).content.includes("BECMI.encounter.found"), "the encounter result was not posted");

const surprise = await rollSurprise(actor);
assert(surprise.state === "neither", "the surprise check did not resolve");

diceQueue.push(4);
const distance = await rollEncounterDistance(actor, { setting: "dungeon", visibility: "bright" });
assert(distance.distance === 40, "dungeon encounter distance is wrong");

const wandering = await rollWanderingDistance(actor);
assert(wandering.distance === 70, "wandering monster distance is wrong");

diceQueue.push(10);
const firstReaction = await rollReaction(actor,
  { attempt: 1, pendingModifier: 0, done: false }, { charisma: 2, action: 1 });
assert(firstReaction.modifier === 0 && firstReaction.total === 10, "the first reaction roll used Charisma");
assert(firstReaction.state.pendingModifier === 4, "a neutral result did not carry +4");
assert(reactionTable.drawCalls.at(-1).displayChat === false, "the table draw duplicated chat output");
assert(messages.at(-1).content.includes("Table reaction"), "the table text was not posted");

diceQueue.push(5);
const secondReaction = await rollReaction(actor, firstReaction.state, { charisma: 2, action: 1 });
assert(secondReaction.modifier === 7 && secondReaction.total === 12, "the reroll did not add Charisma, actions and +4");
assert(secondReaction.state.done === true, "a friendly result did not end the reaction");

const evasion = await rollEvasion(actor, { partySize: 8, monsterCount: 12 });
assert(evasion.chance === 70 && evasion.roll === 30 && evasion.success, "the evasion check is wrong");

diceQueue.push(4, 2);
const chase = await rollPursuitRound(actor, { round: 5 });
assert(chase.round === 5 && chase.first === "party" && chase.moraleCheckDue, "the pursuit round is wrong");
assert(messages.at(-1).content.includes("BECMI.encounter.moraleCheckDue"), "the morale reminder was not posted");

const drawn = await drawEncounterTable(actor, reactionTable.name);
assert(drawn.results[0] === "Table reaction", "the selected table draw failed");
assert(messages.length === 9, `expected 9 chat cards, got ${messages.length}`);
assert(warnings.length === 0, "an encounter procedure produced a warning");

console.log(`Encounter procedures OK: ${messages.length} chat cards, ${reactionTable.drawCalls.length} table draws.`);
