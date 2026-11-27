/**
 * Foundry-independent smoke test for the character wizard ApplicationV2.
 *
 * Usage: node tools/test-character-wizard.mjs
 */
import assert from "node:assert/strict";

class FakeApplicationV2 {
  static DEFAULT_OPTIONS = { actions: {} };

  constructor() {
    this.element = {
      classList: { toggle() {} },
      dataset: {},
      querySelector: () => null,
      querySelectorAll: () => []
    };
  }

  async _prepareContext() { return {}; }
  async _onRender() {}
  async render() { this.renderCount = (this.renderCount ?? 0) + 1; }
  async close() { this.closed = true; }
}

globalThis.foundry = {
  applications: {
    api: {
      ApplicationV2: FakeApplicationV2,
      HandlebarsApplicationMixin: (Base) => Base
    }
  },
  utils: {
    mergeObject: (base, extra) => ({
      ...base,
      ...extra,
      actions: { ...(base.actions ?? {}), ...(extra.actions ?? {}) }
    })
  }
};
globalThis.game = {
  i18n: { localize: (key) => key, format: (key, data) => `${key}:${JSON.stringify(data ?? {})}` },
  settings: { get: () => false },
  packs: new Map()
};
globalThis.ui = { notifications: { warn() {}, info() {} } };
globalThis.Roll = class {
  constructor(formula) { this.formula = formula; }
  async evaluate() {
    return {
      dice: [{ results: [{ result: 3 }, { result: 3 }, { result: 3 }] }],
      total: this.formula === "3d6" ? 9 : 8
    };
  }
};

const { CharacterWizard } = await import("../scripts/applications/character-wizard.mjs");

const actions = CharacterWizard.DEFAULT_OPTIONS.actions;
for (const name of [
  "switchStep", "rollAbilities", "rerollAbilities", "applySwap", "resetSwap",
  "rollHp", "useLanguages", "rollMoney", "apply", "cancel"
]) {
  assert.equal(typeof actions[name], "function", `wizard action ${name} is not registered`);
}

const actor = {
  name: "Hero",
  items: [],
  system: {
    abilities: Object.fromEntries(["str", "int", "wis", "dex", "con", "cha"].map((key) => [key, { value: 10 }])),
    attributes: {
      classKey: "fighter", class: "Fighter", race: "Human", alignment: "Lawful",
      player: "Tester", details: {}, gold: { gp: 0 }, armor: { type: "nenhuma", shield: false },
      load: {}
    },
    details: { personality: "", background: "" },
    generalSkills: { enabled: false },
    mastery: { enabled: false }
  },
  updates: [],
  created: [],
  deleted: [],
  async update(data) { this.updates.push(data); },
  async createEmbeddedDocuments(type, data) { this.created.push({ type, data }); },
  async deleteEmbeddedDocuments(type, ids) { this.deleted.push({ type, ids }); }
};

const wizard = new CharacterWizard(actor);
const context = await wizard._prepareContext({});
assert.equal(context.steps.length, 7);
assert.equal(context.steps[3].key, "combat");
assert.equal(context.steps[4].key, "languages");
assert.equal(context.activeStep, "identity");

await actions.switchStep.call(wizard, {}, { dataset: { step: "combat" } });
assert.equal(wizard.activeStep, "combat");
await actions.switchStep.call(wizard, {}, { dataset: { step: "invalid" } });
assert.equal(wizard.activeStep, "identity");

await actions.rollAbilities.call(wizard, {}, {});
assert.equal(wizard.state.abilities.str, 9);
assert.equal(wizard.state.abilities.cha, 9);
assert.equal(wizard.state.swapCount, 0);

await actions.rollMoney.call(wizard, {}, {});
assert.deepEqual(wizard.state.goldRolls, [3, 3, 3]);

wizard.state.classKey = "fighter";
wizard.state.abilities = { str: 14, int: 12, wis: 12, dex: 12, con: 13, cha: 10 };
wizard.state.swapCount = 0;
wizard.state.hpMode = "rolled";
wizard.state.hpManual = false;
await actions.rollHp.call(wizard, {}, {});
assert.equal(wizard.state.hp, 9);
assert.equal(wizard.state.hpManual, true);

await actions.useLanguages.call(wizard, {}, {});
assert.equal(wizard.state.languages, "Common, Lawful tongue");

wizard.state = {
  name: "Hero", player: "Tester", race: "Human", alignment: "lawful", classKey: "fighter",
  abilities: { str: 14, int: 12, wis: 12, dex: 12, con: 13, cha: 10 },
  swapCount: 0, hpMode: "rolled", hp: 9, hpManual: true, goldRolls: [4, 4, 4],
  languages: "", height: "5'8\"", weight: "150 lb",
  items: ["Sword, Short", "Leather Armor"],
  personality: "", background: "", generalSkillsEnabled: false, masteryEnabled: false
};

const classDocument = {
  name: "Fighter",
  flags: { core: { sourceId: "Compendium.becmi.classes.fighter" } },
  uuid: "Compendium.becmi.classes.fighter",
  toObject: () => ({ name: "Fighter", type: "class", system: {} })
};
const packFor = (documents) => ({
  getIndex: async () => documents.map((doc, index) => ({ name: doc.name, _id: String(index) })),
  getDocument: async (id) => documents[Number(id)]
});
game.packs.set("becmi.classes", packFor([classDocument]));
game.packs.set("becmi.equipment", packFor([
  { name: "Sword, Short", toObject: () => ({ name: "Sword, Short", type: "weapon", system: {} }) },
  { name: "Leather Armor", toObject: () => ({ name: "Leather Armor", type: "armor", system: {} }) }
]));

await actions.apply.call(wizard, {}, {});
assert.equal(actor.updates.length, 1);
assert.equal(actor.updates[0].name, "Hero");
assert.equal(actor.updates[0]["system.attributes.hp"].value, 9);
assert.equal(actor.updates[0]["system.attributes.armor.type"], "couro");
assert.equal(actor.updates[0]["system.attributes.classUuid"], "Compendium.becmi.classes.fighter");
assert.equal(actor.created.length, 1);
assert.equal(actor.created[0].data.length, 3);
assert.equal(actor.created[0].data.find((item) => item.type === "class").system.equipped, undefined);
assert.ok(actor.created[0].data.filter((item) => item.type !== "class")
  .every((item) => item.system.equipped === true));
assert.equal(wizard.closed, true);

console.log("character wizard ApplicationV2 OK");
