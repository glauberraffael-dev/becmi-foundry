/**
 * Foundry-independent smoke test for sheet drop handling.
 *
 * Usage: node tools/test-sheets.mjs
 */
import { readFile } from "node:fs/promises";

class FakeActorSheet {
  static DEFAULT_OPTIONS = { actions: { editImage: () => "edited" } };

  constructor() {
    this.superDrops = [];
    this.superItems = [];
    this.editable = true;
    this.actor = { id: "actor" };
  }

  get isEditable() { return this.editable; }

  async _onDrop(event) {
    this.superDrops.push(event);
    return "super-drop";
  }

  async _onDropItem(event, item) {
    this.superItems.push(item);
    return item;
  }

  async render() {}
}

let dragPayload = {};
globalThis.foundry = {
  applications: {
    api: { HandlebarsApplicationMixin: (Base) => Base },
    sheets: { ActorSheetV2: FakeActorSheet, ItemSheetV2: class {} },
    ux: { TextEditor: { implementation: { getDragEventData: () => dragPayload } } }
  },
  utils: {
    mergeObject: (base, extra) => ({
      ...base,
      ...extra,
      actions: { ...(base.actions ?? {}), ...(extra.actions ?? {}) }
    }),
    deepClone: (value) => structuredClone(value),
    getProperty: (object, path) => path.split(".").reduce((value, part) => value?.[part], object),
    setProperty: (object, path, value) => {
      const parts = path.split(".");
      const last = parts.pop();
      const target = parts.reduce((node, part) => (node[part] ??= {}), object);
      target[last] = value;
    },
    deleteProperty: (object, path) => {
      const parts = path.split(".");
      const last = parts.pop();
      const target = parts.reduce((node, part) => node?.[part], object);
      if (target) delete target[last];
    },
    escapeHTML: (value) => String(value).replace(/[&<>"]/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"
    })[c])
  }
};
globalThis.game = { i18n: { localize: (key) => key, format: (key) => key }, userId: "gm" };
globalThis.ui = { notifications: { warn() {}, info() {} } };

const { BECMIActorSheet } = await import("../scripts/sheets/actor-sheet.mjs");
if (typeof BECMIActorSheet.DEFAULT_OPTIONS.actions.editImage !== "function") {
  throw new Error("the inherited editImage action was dropped from actor sheet options");
}
const sheet = new BECMIActorSheet({});
sheet.editMode = true; // drops are edit actions; use mode is tested below
const event = {};
const classItem = { documentName: "Item", type: "class", name: "Magic-User" };

// Non-spell items must reach the standard ActorSheetV2 creation path.
const classResult = await sheet._onDropItem(event, classItem);
if (classResult !== classItem || sheet.superItems[0] !== classItem) {
  throw new Error("class items are no longer delegated to ActorSheetV2");
}

// Owned items are reordering and must also use the standard handler.
const owned = { documentName: "Item", type: "weapon", parent: sheet.actor };
await sheet._onDropItem(event, owned);
if (sheet.superItems[1] !== owned) throw new Error("owned items are not delegated");

// Payloads without a document must not raise an unhandled fromDropData error.
dragPayload = {};
if (await sheet._onDrop(event) !== null || sheet.superDrops.length !== 0) {
  throw new Error("undocumented drag payload was forwarded to ActorSheetV2");
}

// Valid document payloads still use the inherited handler.
dragPayload = { uuid: "Compendium.becmi.classes.Item.magicuser", type: "Item" };
if (await sheet._onDrop(event) !== "super-drop" || sheet.superDrops.length !== 1) {
  throw new Error("document drag payload was not forwarded to ActorSheetV2");
}

// Use mode must not submit actor changes through edit actions.
const actions = BECMIActorSheet.DEFAULT_OPTIONS.actions;
sheet.editMode = false;
sheet.actor = {
  async update() { throw new Error("read-only sheet tried to update the actor"); }
};
if (sheet.editMode) throw new Error("sheets must open in use mode");
await actions.levelUp.call(sheet);
await actions.memorizeSpell.call(sheet, {}, { dataset: { itemId: "spell" } });
await actions.setClass.call(sheet, {}, { dataset: { classKey: "fighter" } });
await actions.toggleEditMode.call(sheet);
if (!sheet.editMode) throw new Error("edit mode toggle did not enable editing");
await actions.toggleEditMode.call(sheet);
if (sheet.editMode) throw new Error("edit mode toggle did not return to use mode");

// Use mode still accepts the live HP tracker, but no other actor edit.
const updates = [];
sheet.editable = true;
sheet.actor = {
  async update(changes) { updates.push(changes); }
};
const submit = BECMIActorSheet.DEFAULT_OPTIONS.form.handler;
await submit.call(sheet, {}, {}, {
  object: {
    "system.attributes.hp.value": "7",
    "system.attributes.hp.max": "12",
    "system.attributes.xp": "5000",
    "system.attributes.xpNext": "9999",
    "system.generalSkills.rows.tracking.trained": "true"
  }
});
if (updates.length !== 1 || Object.keys(updates[0]).join() !== "system.attributes.hp.value"
  || updates[0]["system.attributes.hp.value"] !== 7) {
  throw new Error(`use mode must only track current HP, got ${JSON.stringify(updates)}`);
}

// Switching class stores the RC snapshot, never a writable xpNext threshold.
updates.length = 0;
sheet.editMode = true;
await actions.setClass.call(sheet, {}, { dataset: { classKey: "fighter" } });
const classUpdate = updates[0] ?? {};
if ("system.attributes.xpNext" in classUpdate) {
  throw new Error("class selection wrote the derived xpNext field");
}
if (classUpdate["flags.becmi.classInfo"]?.key !== "fighter") {
  throw new Error("class selection did not store the RC class snapshot");
}

// The selector is a real form field, so submitting it must expand the snapshot.
updates.length = 0;
sheet.editMode = true;
sheet.actor = {
  system: { attributes: { level: 1 } },
  async update(changes) { updates.push(changes); }
};
await submit.call(sheet, {}, {}, {
  object: {
    "system.attributes.classKey": "magic-user",
    "system.attributes.xpNext": "9999"
  }
});
const formClassUpdate = updates[0] ?? {};
if (formClassUpdate["system.attributes.classKey"] !== "magic-user"
  || formClassUpdate["system.attributes.class"] !== "Magic-User"
  || formClassUpdate["flags.becmi.classInfo"]?.key !== "magic-user"
  || "system.attributes.xpNext" in formClassUpdate) {
  throw new Error(`class field submit did not apply the RC snapshot: ${JSON.stringify(updates)}`);
}

// A manual level edit rolls HP once, then ignores the stale HP fields that the
// form still carries; otherwise the rolled maximum is immediately overwritten.
const { classInfoFromRC } = await import("../scripts/integrations.mjs");
updates.length = 0;
sheet.editMode = true;
sheet.actor = {
  system: {
    attributes: { level: 1, hp: { value: 4, max: 4 } },
    abilities: { con: { value: 10 } }
  },
  flags: { becmi: { classInfo: classInfoFromRC("Fighter") } },
  async update(changes) { updates.push(changes); }
};
await submit.call(sheet, {}, {}, {
  object: {
    "system.attributes.level": "2",
    "system.attributes.hp.value": "4",
    "system.attributes.hp.max": "4",
    "system.attributes.xp": "2000"
  }
});
if (updates.length !== 2) {
  throw new Error(`manual level edit produced ${updates.length} updates: ${JSON.stringify(updates)}`);
}
const [levelUpdate, otherUpdate] = updates;
if (levelUpdate["system.attributes.level"] !== 2
  || !(levelUpdate["system.attributes.hp"]?.max > 4)
  || Number(otherUpdate["system.attributes.xp"]) !== 2000
  || "system.attributes.hp.value" in otherUpdate
  || "system.attributes.hp.max" in otherUpdate) {
  throw new Error(`manual level edit did not roll HP canonically: ${JSON.stringify(updates)}`);
}

// Monster sheets expose one button per save and a named pair per attack row.
const body = await readFile(new URL("../templates/actor/body.hbs", import.meta.url), "utf8");
if (!body.includes('data-action="rollSave" data-save="{{save.key}}"')
  || !body.includes('data-action="monsterAttack" data-attack-index="{{attack.index}}"')
  || !body.includes('data-action="monsterDamage" data-attack-index="{{attack.index}}"')
  || !body.includes('data-action="rollInitiative"')
  || !body.includes('data-action="rollMonsterHp"')
  || !body.includes("{{#if monsterSpellcaster}}")
  || !body.includes('name="system.spellcasting"')
  || !body.includes('data-tab="equipment"')) {
  throw new Error("monster save, HP, initiative, weapon or spell buttons are missing from the sheet template");
}
for (const action of ["encounterCheck", "surpriseCheck", "encounterDistance", "wanderingDistance",
  "reactionCheck", "resetReaction", "evasionCheck", "pursuitRound", "rollEncounterTable"]) {
  if (typeof actions[action] !== "function") throw new Error(`encounter action ${action} is not registered`);
}
for (const action of ["travelDay", "lostCheck", "forageCheck", "seaWeather", "swimCheck"]) {
  if (typeof actions[action] !== "function") throw new Error(`travel action ${action} is not registered`);
}
for (const action of ["rollTreasure", "rollMagicItem", "rollGemValue", "rollJewelryValue"]) {
  if (typeof actions[action] !== "function") throw new Error(`treasure action ${action} is not registered`);
}
if (typeof actions.openWizard !== "function") throw new Error("creation wizard action is not registered");
if (!body.includes('data-action="openWizard"')) throw new Error("creation wizard button is missing from the sheet");
for (const marker of [
  'data-tab="encounter"', 'data-action="encounterCheck"', 'data-action="surpriseCheck"',
  'data-action="encounterDistance"', 'data-action="wanderingDistance"',
  'data-action="reactionCheck"', 'data-action="resetReaction"', 'data-action="evasionCheck"',
  'data-action="pursuitRound"', 'data-encounter-input="pursuitRound"',
  'data-action="rollEncounterTable"', 'data-encounter-input="table"'
]) {
  if (!body.includes(marker)) throw new Error(`encounter panel is missing ${marker}`);
}
for (const marker of [
  'data-tab="travel"', 'data-action="travelDay"', 'data-action="lostCheck"',
  'data-action="forageCheck"', 'data-action="seaWeather"', 'data-action="swimCheck"',
  'data-travel-input="load"', 'data-travel-input="mode"', 'data-travel-input="terrain"',
  'data-travel-input="road"', 'data-travel-input="guide"', 'data-travel-input="forage"',
  'data-travel-input="constitution"', 'data-travel-input="drowning"'
]) {
  if (!body.includes(marker)) throw new Error(`travel panel is missing ${marker}`);
}
for (const marker of [
  'data-tab="treasure"', 'data-action="rollTreasure"', 'data-action="rollMagicItem"',
  'data-action="rollGemValue"', 'data-action="rollJewelryValue"',
  'data-treasure-input="type"', 'data-treasure-input="location"',
  'data-treasure-input="category"', 'data-treasure-input="averageLevel"'
]) {
  if (!body.includes(marker)) throw new Error(`treasure panel is missing ${marker}`);
}
const equipmentPartial = await readFile(new URL("../templates/actor/parts/equipment.hbs", import.meta.url), "utf8");
if (!equipmentPartial.includes('data-action="itemAttack"')
  || !equipmentPartial.includes('data-action="itemDamage"')) {
  throw new Error("equipment partial must expose weapon attack and damage buttons");
}
const rolled = [];
sheet.actor = {
  async rollSave(key) { rolled.push(["save", key]); },
  async rollInitiative() { rolled.push(["initiative"]); },
  async rollMonsterHitPoints() { rolled.push(["monsterHp"]); },
  async rollMonsterAttack(index, options) {
    rolled.push(["attack", index, options?.targetAC, options?.mode]);
  },
  async rollMonsterDamage(index) { rolled.push(["damage", index]); }
};
await actions.rollSave.call(sheet, {}, { dataset: { save: "breath" } });
await actions.rollInitiative.call(sheet);
sheet.editMode = false; // rolling HP is an action, available in use mode
await actions.rollMonsterHp.call(sheet);
await actions.monsterAttack.call(sheet, {}, { dataset: { attackIndex: "2" } });
await actions.monsterDamage.call(sheet, {}, { dataset: { attackIndex: "2" } });
if (JSON.stringify(rolled) !== JSON.stringify([
  ["save", "breath"], ["initiative"], ["monsterHp"], ["attack", 2, 9, "attack"], ["damage", 2]
])) {
  throw new Error(`monster roll actions did not reach the actor: ${JSON.stringify(rolled)}`);
}

// Name-level controls stay in the template and their actions reach the actor
// even in use mode (they are rolls, not edits).
if (!body.includes('name="system.nameLevel.path"')
  || !body.includes("../nameLevelStored.path")
  || !body.includes("../nameLevelStored.specialization")
  || !body.includes("../nameLevelStored.holdingStyle")
  || !body.includes('{{#if (eq nameLevel.requested "avenger")}}')
  || !body.includes('data-action="detectEvil"')
  || !body.includes("{{#each nameLevel.pros as |line|}}")
  || !body.includes("{{#each nameLevel.cons as |line|}}")) {
  throw new Error("name-level persisted selectors, Detect Evil button or pros/cons panel are missing");
}
const nameRolls = [];
sheet.editMode = false;
sheet.turnUndeadLevel = 3;
sheet.nameLevel = { canDetectEvil: true, isAvenger: true };
sheet.actor = {
  async rollTurnUndead(type, options) { nameRolls.push(["undead", type, options?.level, options?.control]); },
  async rollDetectEvil() { nameRolls.push(["detectEvil"]); }
};
await actions.rollTurnUndead.call(sheet, {}, { dataset: { undead: "Skeleton" } });
await actions.detectEvil.call(sheet);
if (JSON.stringify(nameRolls) !== JSON.stringify([
  ["undead", "Skeleton", 3, true], ["detectEvil"]
])) {
  throw new Error(`name-level roll actions did not reach the actor: ${JSON.stringify(nameRolls)}`);
}

// Optional weapon mastery: an always-visible toggle and a usable grade dropdown.
if (!body.includes('data-action="toggleMastery"')
  || !body.includes('name="system.mastery.enabled"')
  || !body.includes("{{grade.name}}")) {
  throw new Error("the optional weapon-mastery toggle or grade dropdown is missing from the sheet");
}
let masteryUpdate = null;
sheet.editable = true;
sheet.editMode = true;
sheet.actor = {
  system: { mastery: { enabled: false } },
  async update(data) { masteryUpdate = data; }
};
await actions.toggleMastery.call(sheet, {}, {});
if (masteryUpdate?.["system.mastery.enabled"] !== true) {
  throw new Error("the mastery toggle did not opt the character in");
}

// General skills are opt-in for every class, stored per skill and rollable in
// use mode like the thief skills.
if (!body.includes('data-action="rollGeneral" data-skill="{{skill.key}}"')
  || !body.includes('name="system.generalSkills.rows.{{skill.key}}.trained"')
  || !body.includes('name="system.generalSkills.rows.{{skill.key}}.modifier"')
  || !body.includes('name="system.generalSkills.rows.{{skill.key}}.note"')
  || !body.includes('name="system.generalSkills.rows.{{skill.key}}.ability"')
  || !body.includes('data-action="toggleGeneral"')
  || !body.includes("{{generalSlots.used}} / {{generalSlots.total}}")) {
  throw new Error("the general-skill tab, fields, toggle or roll button are missing from the sheet");
}
const generalRolls = [];
sheet.editMode = false;
sheet.actor = {
  async rollGeneralSkill(skill) { generalRolls.push(skill); }
};
await actions.rollGeneral.call(sheet, {}, { dataset: { skill: "tracking" } });
if (generalRolls.join() !== "tracking") {
  throw new Error(`general skill roll did not reach the actor: ${JSON.stringify(generalRolls)}`);
}
let generalUpdate = null;
sheet.editMode = true;
sheet.actor = {
  system: { generalSkills: { enabled: false } },
  async update(data) { generalUpdate = data; }
};
await actions.toggleGeneral.call(sheet, {}, {});
if (generalUpdate?.["system.generalSkills.enabled"] !== true) {
  throw new Error("the general-skills toggle did not opt the character in");
}

// Spell slots are consumed once, blocked on recast and restored only by an
// owner-triggered Rest action; Auto AC must disable the manual target field.
if (!body.includes('data-action="toggleTargetAcAuto"')
  || !body.includes('{{#if targetAcAuto}}disabled{{/if}}')
  || !body.includes("{{#if entry.used}}disabled")
  || !body.includes('{{#if canEdit}}<button type="button" class="becmi-roll" data-action="restSpells"')) {
  throw new Error("target AC Auto toggle, spent-slot disable or owner-only Rest button is missing");
}
const { RC, spellKey } = await import("../scripts/rules-rc.mjs");
const slot = spellKey(RC.spells[0]);
const warnings = [];
const slotUpdates = [];
const casts = [];
const chats = [];
globalThis.ui.notifications.warn = (message) => warnings.push(message);
globalThis.ChatMessage = {
  create: async (data) => { chats.push(data); return {}; },
  getSpeaker: () => ({})
};
sheet.editMode = false; // spell tracking is a use-mode action
sheet.editable = true;
sheet.actor = {
  name: "Slot Test",
  system: { spellbook: { used: { [slot]: true } } },
  items: { get: () => ({ type: "spell", castSpell: async () => casts.push("spell") }) },
  async update(changes) { slotUpdates.push(changes); }
};
const castTarget = { dataset: { slot, spellKey: slot, itemId: "spell" } };
await actions.castSpell.call(sheet, {}, castTarget);
if (warnings.length !== 1 || casts.length || slotUpdates.length || chats.length) {
  throw new Error(`a spent slot was recast: ${JSON.stringify({ warnings, casts, slotUpdates, chats })}`);
}
sheet.actor.system.spellbook.used = {};
await actions.castSpell.call(sheet, {}, castTarget);
if (casts.length !== 1 || slotUpdates.length !== 1
  || slotUpdates[0]["system.spellbook.used"]?.[slot] !== true) {
  throw new Error(`a free slot was not consumed: ${JSON.stringify({ casts, slotUpdates })}`);
}
sheet.editable = false;
slotUpdates.length = 0;
await actions.restSpells.call(sheet);
if (slotUpdates.length || chats.length) throw new Error("a non-owner rested spells");
sheet.editable = true;
await actions.restSpells.call(sheet);
if (slotUpdates.length !== 1 || Object.keys(slotUpdates[0]["system.spellbook.used"] ?? {}).length
  || chats.length !== 1) {
  throw new Error(`rest did not clear slots and log to chat: ${JSON.stringify({ slotUpdates, chats })}`);
}

// The XP calculator is transient sheet state: it reads DOM inputs, never
// submits them as actor fields, and only awards derived XP in edit mode.
if (!body.includes('data-tab="xp"')
  || !body.includes('data-action="calculateXp"')
  || !body.includes('data-action="xpFromHd"')
  || !body.includes('data-action="awardXp"')
  || !body.includes('data-xp-input="monsterXp"')
  || !body.includes('data-xp-input="applyLevelCap"')) {
  throw new Error("the XP calculator tab, inputs or actions are missing from the sheet");
}
const xpFields = {
  '[data-xp-input="monsterXp"]': { value: "1000" },
  '[data-xp-input="participants"]': { value: "4" },
  '[data-xp-input="applyPrimeRequisite"]': { checked: false },
  '[data-xp-input="monsterHd"]': { value: "4" },
  '[data-xp-input="monsterAsterisks"]': { value: "2" },
  '[data-xp-input="monsterCount"]': { value: "3" }
};
sheet.element = { querySelector: (selector) => xpFields[selector] };
sheet.xpInputs = {};
sheet.editMode = false;
await actions.calculateXp.call(sheet);
if (sheet.xpInputs.monsterXp !== "1000" || sheet.xpInputs.participants !== "4"
  || sheet.xpInputs.applyPrimeRequisite !== false) {
  throw new Error(`XP calculator did not capture its inputs: ${JSON.stringify(sheet.xpInputs)}`);
}
await actions.xpFromHd.call(sheet);
if (sheet.xpInputs.monsterXp !== "525") {
  throw new Error(`the HD table lookup did not fill monster XP: ${sheet.xpInputs.monsterXp}`);
}
const xpUpdates = [];
sheet.editMode = true;
sheet.xpResult = { awardedXp: 990, finalXp: 990 };
sheet.actor = {
  async update(changes) { xpUpdates.push(changes); }
};
await actions.awardXp.call(sheet);
if (xpUpdates.length !== 1 || xpUpdates[0]["system.attributes.xp"] !== 990
  || "system.attributes.xpNext" in xpUpdates[0]) {
  throw new Error(`XP award wrote the wrong fields: ${JSON.stringify(xpUpdates)}`);
}

console.log("Sheet handling OK (drops, invalid payloads, edit/use mode, HP tracking, class field, derived XP, XP calculator, monster rolls, name level, optional mastery and general skills, spell slots and Auto AC).");
