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

console.log("Sheet handling OK (drops, invalid payloads and edit/use mode).");
