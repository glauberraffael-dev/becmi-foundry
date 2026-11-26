/**
 * Foundry-independent smoke test for sheet drop handling.
 *
 * Usage: node tools/test-sheets.mjs
 */
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
    deepClone: (value) => structuredClone(value)
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
    "system.attributes.xpNext": "9999"
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

console.log("Sheet handling OK (drops, invalid payloads, edit/use mode, HP tracking and derived XP).");
