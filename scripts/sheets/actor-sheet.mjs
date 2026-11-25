const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const ABILITIES = ["str", "int", "wis", "dex", "con", "cha"];
const SAVES = ["deathRay", "magicWand", "paralysis", "breath", "spells"];

export class BECMIActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = Object.freeze(foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["becmi", "sheet", "actor"],
    tag: "form",
    position: { width: 680, height: 620 },
    window: { title: "BECMI.title", resizable: true },
    form: {
      handler: BECMIActorSheet.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      rollAbility: BECMIActorSheet.#rollAbility,
      rollSave: BECMIActorSheet.#rollSave,
      rollInitiative: BECMIActorSheet.#rollInitiative,
      rollMorale: BECMIActorSheet.#rollMorale,
      rollHitDice: BECMIActorSheet.#rollHitDice,
      itemAttack: BECMIActorSheet.#itemAttack,
      itemDamage: BECMIActorSheet.#itemDamage,
      itemOpen: BECMIActorSheet.#itemOpen,
      itemDelete: BECMIActorSheet.#itemDelete,
      addItem: BECMIActorSheet.#addItem
    }
  }, { inplace: false }));

  static PARTS = {
    header: { template: "systems/becmi/templates/actor/header.hbs" },
    body: { template: "systems/becmi/templates/actor/body.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const actor = this.document;
    context.actor = actor;
    context.system = actor.system;
    context.editable = this.isEditable;
    context.isCharacter = actor.type !== "monster";
    context.abilities = ABILITIES.map((key) => ({
      key,
      label: game.i18n.localize(`BECMI.abilities.${key}Abbr`),
      ...(actor.system.abilities?.[key] ?? { value: 10, bonus: 0 })
    }));
    context.saves = SAVES.map((key) => ({
      key,
      label: game.i18n.localize(`BECMI.saves.${key}`),
      value: actor.system.saves?.[key] ?? 10
    }));
    context.weapons = actor.items.filter((i) => i.type === "weapon");
    context.spells = actor.items.filter((i) => i.type === "spell");
    context.equipment = actor.items.filter((i) => !["weapon", "spell", "feature", "class"].includes(i.type));
    context.features = actor.items.filter((i) => i.type === "feature");
    return context;
  }

  static async #onSubmit(event, form, formData) {
    await this.document.update(formData.object);
  }

  static async #rollAbility(event, target) {
    await this.actor.rollAbility(target.dataset.ability);
  }

  static async #rollSave(event, target) {
    await this.actor.rollSave(target.dataset.save);
  }

  static async #rollInitiative() {
    await this.actor.rollInitiative();
  }

  static async #rollMorale() {
    await this.actor.rollMorale();
  }

  static async #rollHitDice() {
    await this.actor.rollHitDice();
  }

  static async #itemAttack(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    await item?.rollAttack();
  }

  static async #itemDamage(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    await item?.rollDamage();
  }

  static async #itemOpen(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    item?.sheet.render(true);
  }

  static async #itemDelete(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    await item?.delete();
  }

  static async #addItem() {
    if (!this.isEditable) return;
    const type = await foundry.applications.api.DialogV2.wait({
      window: { title: "BECMI.sheet.newItem" },
      content: `<p>${game.i18n.localize("BECMI.sheet.chooseItemType")}</p>`,
      buttons: ["weapon", "armor", "equipment", "spell", "feature"].map((key) => ({
        action: key,
        label: game.i18n.localize(`BECMI.item.${key}`),
        callback: () => key
      }))
    });
    if (!type) return;
    await this.actor.createEmbeddedDocuments("Item", [{ name: `New ${type}`, type }]);
  }
}
