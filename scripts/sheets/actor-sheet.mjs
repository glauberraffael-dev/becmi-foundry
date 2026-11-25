const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const ABILITIES = ["str", "int", "wis", "dex", "con", "cha"];
const SAVES = ["deathRay", "magicWand", "paralysis", "breath", "spells"];

const SHEET_TABS = [
  ["main", "BECMI.sheet.tab.main"],
  ["spells", "BECMI.sheet.tab.spells"],
  ["thief", "BECMI.sheet.tab.thief"],
  ["undead", "BECMI.sheet.tab.undead"],
  ["attack", "BECMI.sheet.tab.attack"],
  ["mastery", "BECMI.sheet.tab.mastery"],
  ["magic", "BECMI.sheet.tab.magic"],
  ["notes", "BECMI.sheet.tab.notes"]
];

const THIEF_SKILLS = [
  ["pickPockets", "BECMI.thief.pickPockets"],
  ["openLocks", "BECMI.thief.openLocks"],
  ["removeTraps", "BECMI.thief.removeTraps"],
  ["climbWalls", "BECMI.thief.climbWalls"],
  ["moveSilently", "BECMI.thief.moveSilently"],
  ["hideInShadows", "BECMI.thief.hideInShadows"],
  ["hearNoise", "BECMI.thief.hearNoise"],
  ["backstab", "BECMI.thief.backstab"]
];

const TURN_UNDEAD = [
  ["skeleton", "BECMI.undead.skeleton"],
  ["zombie", "BECMI.undead.zombie"],
  ["ghoul", "BECMI.undead.ghoul"],
  ["wight", "BECMI.undead.wight"],
  ["wraith", "BECMI.undead.wraith"],
  ["mummy", "BECMI.undead.mummy"],
  ["spectre", "BECMI.undead.spectre"],
  ["vampire", "BECMI.undead.vampire"],
  ["lich", "BECMI.undead.lich"]
];

function attackTable(thac0) {
  const rows = [];
  for (let ac = 9; ac >= -5; ac--) {
    rows.push({ ac, needed: Math.min(20, Math.max(1, thac0 - ac)) });
  }
  return rows;
}

export class BECMIActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  activeTab = "main";

  static DEFAULT_OPTIONS = Object.freeze(foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["becmi", "sheet", "actor"],
    tag: "form",
    position: { width: 1280, height: 860 },
    window: { title: "BECMI.title", resizable: true },
    form: {
      handler: BECMIActorSheet.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      switchTab: BECMIActorSheet.#switchTab,
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
    const isCharacter = actor.type !== "monster";
    const flags = actor.flags?.becmi ?? {};
    context.actor = actor;
    context.system = actor.system;
    context.flags = flags;
    context.editable = this.isEditable;
    context.isCharacter = isCharacter;

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
    context.thiefSkills = THIEF_SKILLS.map(([key, label]) => ({
      key,
      label: game.i18n.localize(label),
      value: actor.system.thiefSkills?.[key] ?? 0
    }));
    context.turnUndead = TURN_UNDEAD.map(([key, label]) => ({
      key,
      label: game.i18n.localize(label),
      value: flags.turnUndead?.[key] ?? ""
    }));

    const weapons = actor.items.filter((i) => i.type === "weapon");
    context.weapons = weapons;
    context.weaponRows = weapons.map((item) => ({
      id: item.id,
      name: item.name,
      mastery: flags.mastery?.[item.id] ?? "",
      attackBonus: item.system.attackBonus ?? 0,
      damageBonus: item.system.damageBonus ?? 0,
      damage: item.system.damage ?? ""
    }));
    context.spells = actor.items.filter((i) => i.type === "spell");
    context.equipment = actor.items.filter((i) => !["weapon", "spell", "feature", "class"].includes(i.type));
    context.features = actor.items.filter((i) => i.type === "feature");
    context.magicItems = weapons.filter((i) => Number(i.system.magicBonus ?? 0) > 0);
    context.attackTable = attackTable(Number(actor.system.attributes?.thac0 ?? 19));

    const definitions = isCharacter ? SHEET_TABS : SHEET_TABS.filter(([id]) => ["main", "notes"].includes(id));
    context.tabs = definitions.map(([id, label]) => ({
      id,
      label: game.i18n.localize(label),
      active: id === this.activeTab
    }));
    if (!context.tabs.some((tab) => tab.id === this.activeTab)) this.activeTab = context.tabs[0]?.id ?? "main";
    for (const tab of context.tabs) tab.active = tab.id === this.activeTab;
    context.activeTab = this.activeTab;
    return context;
  }

  static async #switchTab(event, target) {
    this.activeTab = target.dataset.tab;
    await this.render();
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
