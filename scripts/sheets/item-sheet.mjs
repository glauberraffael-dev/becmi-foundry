import { applyClassToActor } from "../integrations.mjs";

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
      sendToChat: BECMIItemSheet.#sendToChat,
      applyClass: BECMIItemSheet.#applyClass
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
    if (context.isClass) {
      context.xpTableRows = Object.entries(item.system.xpTable ?? {})
        .map(([level, xp]) => ({ level: Number(level), xp: Number(xp) }))
        .filter((row) => Number.isFinite(row.xp))
        .sort((a, b) => a.level - b.level);
      context.maxLevel = item.system.maxLevel ?? 36;
    }
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

  static async #applyClass() {
    const actor = canvas.tokens.controlled[0]?.actor ?? game.user.character;
    if (!actor) {
      ui.notifications.warn(game.i18n.localize("BECMI.notification.noActor"));
      return;
    }
    await applyClassToActor(actor, this.document);
    ui.notifications.info(game.i18n.format("BECMI.notification.classApplied", {
      name: this.document.name,
      actor: actor.name
    }));
  }
}
