const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;

export class BECMIItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = Object.freeze(foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["becmi", "sheet", "item"],
    tag: "form",
    position: { width: 560, height: 520 },
    window: { title: "BECMI.title", resizable: true },
    form: {
      handler: BECMIItemSheet.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      rollAttack: BECMIItemSheet.#rollAttack,
      rollDamage: BECMIItemSheet.#rollDamage,
      sendToChat: BECMIItemSheet.#sendToChat
    }
  }, { inplace: false }));

  static PARTS = {
    header: { template: "systems/becmi/templates/item/header.hbs" },
    body: { template: "systems/becmi/templates/item/body.hbs" }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.document;
    context.item = item;
    context.system = item.system;
    context.editable = this.isEditable;
    context.isWeapon = item.type === "weapon";
    context.isSpell = item.type === "spell";
    context.isArmor = item.type === "armor";
    context.isClass = item.type === "class";
    return context;
  }

  static async #onSubmit(event, form, formData) {
    await this.document.update(formData.object);
  }

  static async #rollAttack() {
    await this.document.rollAttack();
  }

  static async #rollDamage() {
    await this.document.rollDamage();
  }

  static async #sendToChat() {
    await this.document.sendToChat();
  }
}
