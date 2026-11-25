import { spellListsForClass } from "../integrations.mjs";
import {
  RC, attackRows, adjustment, getRCClass, hpForLevel, masteryData, masteryRanks,
  masteryWeapon, masteryChoices, normalizeClassKey, spellKey, spellSlotsForLevel,
  spellsFor, turnUndeadColumn
} from "../rules-rc.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const ABILITIES = ["str", "int", "wis", "dex", "con", "cha"];
const SAVES = ["deathRay", "magicWand", "paralysis", "breath", "spells"];

const SHEET_TABS = [
  ["main", "BECMI.sheet.tab.main"],
  ["roller", "BECMI.sheet.tab.roller"],
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
  ["findTraps", "BECMI.thief.findTraps"],
  ["removeTraps", "BECMI.thief.removeTraps"],
  ["climbWalls", "BECMI.thief.climbWalls"],
  ["moveSilently", "BECMI.thief.moveSilently"],
  ["hideInShadows", "BECMI.thief.hideInShadows"],
  ["hearNoise", "BECMI.thief.hearNoise"],
  ["backstab", "BECMI.thief.backstab"]
];

const UNDEAD_EN = [
  "Skeleton", "Zombie", "Ghoul", "Wight", "Wraith", "Mummy", "Spectre", "Vampire",
  "Phantom", "Haunt", "Spirit", "Nightshade", "Lich", "Special"
];

const ARMOR_EN = {
  nenhuma: "No armor", couro: "Leather armor", escamas: "Scale mail", malha: "Chain mail",
  bandas: "Banded mail", placas: "Plate mail", completa: "Full plate"
};

function masteryRowsFor(actor) {
  const stored = actor.system.mastery?.rows ?? [];
  const rows = Array.from({ length: Math.max(15, stored.length) }, (_, index) => ({
    name: "", grade: "sem", primary: "H", target: "prim", ...(stored[index] ?? {})
  }));
  return rows.map((row) => {
    const weapon = masteryWeapon(row.name);
    const data = masteryData(weapon, row.grade || "sem");
    return {
      ...row,
      range: data?.range ?? "",
      damage: data?.damage ?? "",
      defense: data?.defense ?? "",
      special: data?.special ?? "",
      attack: data ? `${data.attack[0] >= 0 ? "+" : ""}${data.attack[0]} / ${data.attack[1] >= 0 ? "+" : ""}${data.attack[1]}` : "",
      dv: data?.dv ? `up to ${data.dv} HD` : ""
    };
  });
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
      setClass: BECMIActorSheet.#setClass,
      rollAbility: BECMIActorSheet.#rollAbility,
      rollSave: BECMIActorSheet.#rollSave,
      rollInitiative: BECMIActorSheet.#rollInitiative,
      rollMorale: BECMIActorSheet.#rollMorale,
      rollHitDice: BECMIActorSheet.#rollHitDice,
      rollFree: BECMIActorSheet.#rollFree,
      rollDice: BECMIActorSheet.#rollDice,
      rollThief: BECMIActorSheet.#rollThief,
      rollTurnUndead: BECMIActorSheet.#rollTurnUndead,
      createCharacter: BECMIActorSheet.#createCharacter,
      rollLevelHP: BECMIActorSheet.#rollLevelHP,
      levelUp: BECMIActorSheet.#levelUp,
      restSpells: BECMIActorSheet.#restSpells,
      memorizeSpell: BECMIActorSheet.#memorizeSpell,
      addMasteryRow: BECMIActorSheet.#addMasteryRow,
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
    const attrs = actor.system.attributes ?? {};
    const level = Number(attrs.level) || 1;
    const xp = Number(attrs.xp) || 0;
    const classKey = normalizeClassKey(attrs.classKey || attrs.class);
    const rcClass = getRCClass(attrs.classKey || attrs.class);

    Object.assign(context, {
      actor, system: actor.system, flags, editable: this.isEditable, isCharacter,
      level, xp, classKey, rcClass,
      classOptions: Object.values(RC.classes).map((cls) => ({ key: cls.key, name: cls.name })),
      armorOptions: Object.entries(RC.armor.types).map(([key, value]) => ({ key, name: ARMOR_EN[key] ?? value.name, ac: value.ac })),
      masteryGrades: masteryRanks().map((grade) => ({ key: grade.key, name: grade.nome })),
      diceOptions: [4, 6, 8, 10, 12, 20, 100].map((faces) => ({ faces })),
      masteryWeapons: RC.mastery.weapons.map((weapon) => weapon.name),
      masteryCatalog: RC.mastery.weapons.map((weapon) => ({
        ...masteryData(weapon, "gm"),
        primary: weapon.primary,
        cost: weapon.cost,
        weight: weapon.weight
      }))
    });

    context.abilityRows = ABILITIES.map((key) => ({
      key,
      label: game.i18n.localize(`BECMI.abilities.${key}Abbr`),
      value: actor.system.abilities?.[key]?.value ?? 10,
      bonus: actor.system.abilities?.[key]?.bonus ?? 0,
      adjustment: attrs.adjustments?.[key] ?? adjustment(actor.system.abilities?.[key]?.value ?? 10)
    }));

    context.saveRows = SAVES.map((key) => ({
      key,
      label: game.i18n.localize(`BECMI.saves.${key}`),
      ...(actor.system.saveDetail?.[key] ?? { base: actor.system.saves?.[key] ?? 10, auto: 0, mod: 0, target: actor.system.saves?.[key] ?? 10 })
    }));

    context.thiefSkills = THIEF_SKILLS.map(([key, label]) => ({
      key,
      label: game.i18n.localize(label),
      value: actor.system.thiefSkills?.[key] ?? 0
    }));

    const undeadColumn = turnUndeadColumn(level);
    context.undeadColumns = RC.turnUndead.columns.map((label, index) => ({ label, active: index === undeadColumn }));
    context.undeadRows = RC.turnUndead.rows.map((row, index) => ({
      name: UNDEAD_EN[index] ?? row.name,
      cells: row.values.map((value, cellIndex) => ({ value, active: cellIndex === undeadColumn }))
    }));

    const spec = attrs.attackSpec || "19";
    context.attackTable = attackRows(spec, 9, -10);
    context.attackLabel = attrs.attackBand || "";
    context.attackSpec = spec;

    context.masteryRows = masteryRowsFor(actor);
    context.masteryAvailable = rcClass ? masteryChoices(classKey, level, xp) : 0;
    context.masterySpent = (actor.system.mastery?.rows ?? []).reduce((sum, row) => {
      const weapon = masteryWeapon(row.name);
      const data = masteryData(weapon, row.grade || "sem");
      return sum + (data?.weightCost ?? 0);
    }, 0);

    const grimoire = String(actor.system.spellbook?.grimoire ?? "").split(",").map((key) => key.trim()).filter(Boolean);
    const search = String(flags.spellSearch ?? "");
    context.grimoire = actor.system.spellbook?.grimoire ?? "";
    context.spellLevels = Array.from({ length: 9 }, (_, index) => index + 1);
    context.spellSlots = spellSlotsForLevel(classKey, level);
    context.spellOptions = context.spellLevels.map((spellLevel) =>
      spellsFor(classKey, spellLevel, { grimoire }).map((spell) => ({ key: spellKey(spell), name: spell.name, level: spell.level })));
    context.spellRows = context.spellLevels.map((spellLevel, levelIndex) => ({
      level: spellLevel,
      slots: context.spellSlots[levelIndex] ?? 0,
      entries: Array.from({ length: 9 }, (_, index) => {
        const key = `${spellLevel}_${index + 1}`;
        return {
          key,
          spell: actor.system.spellbook?.memorized?.[key] ?? "",
          used: Boolean(actor.system.spellbook?.used?.[key]),
          options: context.spellOptions[levelIndex] ?? []
        };
      })
    }));
    context.spellList = spellsFor(classKey, Number(flags.spellFilterLevel) || 0, { grimoire, search }).slice(0, 120)
      .map((spell) => ({
        ...spell,
        key: spellKey(spell),
        notes: [spell.reverse ? `Reverse: ${spell.reverse}` : "", spell.save ? `Save: ${spell.save}` : ""].filter(Boolean).join("; ")
      }));
    context.spellSearch = search;

    const weapons = actor.items.filter((item) => item.type === "weapon");
    context.weapons = weapons;
    context.weaponRows = weapons.map((item) => ({
      id: item.id,
      name: item.name,
      mastery: flags.mastery?.[item.id] ?? "",
      attackBonus: item.system.attackBonus ?? 0,
      damageBonus: item.system.damageBonus ?? 0,
      damage: item.system.damage ?? ""
    }));
    const spellLists = spellListsForClass(flags.classInfo ?? {});
    const allSpells = actor.items.filter((item) => item.type === "spell");
    context.className = flags.classInfo?.name ?? attrs.class ?? "";
    context.classSpells = spellLists.length
      ? allSpells.filter((item) => (item.system.spellLists ?? []).some((list) => spellLists.includes(list)))
      : allSpells;
    context.otherSpells = spellLists.length
      ? allSpells.filter((item) => !context.classSpells.includes(item))
      : [];
    context.equipment = actor.items.filter((item) => !["weapon", "spell", "feature", "class"].includes(item.type));
    context.magicItems = actor.system.magicItems ?? [];
    context.magicTotals = context.magicItems.reduce((totals, item) => {
      if (!item.equipped) return totals;
      totals.ac += Number(item.ac) || 0;
      totals.save += Number(item.save) || 0;
      totals.attack += Number(item.attack) || 0;
      totals.damage += Number(item.damage) || 0;
      return totals;
    }, { ac: 0, save: 0, attack: 0, damage: 0 });
    context.milestones = (rcClass?.milestones ?? []).filter(([minimum]) => xp >= minimum).map(([, text]) => text);

    const definitions = isCharacter ? SHEET_TABS : SHEET_TABS.filter(([id]) => ["main", "notes"].includes(id));
    context.tabs = definitions.map(([id, label]) => ({
      id, label: game.i18n.localize(label), active: id === this.activeTab
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

  static async #setClass(event, target) {
    const key = target.dataset.classKey;
    const cls = RC.classes[key];
    if (!cls) return;
    await this.actor.update({
      "system.attributes.classKey": key,
      "system.attributes.class": cls.name,
      "system.attributes.hd": `1d${cls.hitDie}`,
      "system.attributes.xpNext": cls.xp[1] ?? 0
    });
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

  static async #rollFree() {
    const expression = this.element.querySelector("[data-roll-expression]")?.value || "1d20";
    await this.actor.rollFree(expression);
  }

  static async #rollDice(event, target) {
    await this.actor.rollFree(`1d${target.dataset.dice}`);
  }

  static async #rollThief(event, target) {
    await this.actor.rollThiefSkill(target.dataset.skill);
  }

  static async #rollTurnUndead(event, target) {
    await this.actor.rollTurnUndead(target.dataset.undead);
  }

  static async #createCharacter() {
    const cls = getRCClass(this.actor.system.attributes?.classKey || this.actor.system.attributes?.class);
    if (!cls) {
      ui.notifications.warn(game.i18n.localize("BECMI.notification.noClass"));
      return;
    }
    const roll = (faces) => 1 + Math.floor(Math.random() * faces);
    const abilities = Object.fromEntries(ABILITIES.map((key) => [key, { value: roll(6) + roll(6) + roll(6) }]));
    const hp = hpForLevel(cls.key, 1, adjustment(abilities.con.value))?.gain ?? 1;
    await this.actor.update({
      "system.attributes.level": 1,
      "system.attributes.xp": 0,
      "system.abilities": abilities,
      "system.attributes.hp": { value: hp, max: hp },
      "system.attributes.gold.gp": (roll(6) + roll(6) + roll(6)) * 10
    });
  }

  static async #rollLevelHP() {
    const cls = getRCClass(this.actor.system.attributes?.classKey || this.actor.system.attributes?.class);
    if (!cls) return;
    const level = Number(this.actor.system.attributes?.level) || 1;
    const con = adjustment(this.actor.system.abilities?.con?.value);
    const result = hpForLevel(cls.key, level, con);
    const hp = this.actor.system.attributes.hp ?? { value: 0, max: 0 };
    await this.actor.update({
      "system.attributes.hp": { value: Number(hp.value) + result.gain, max: Number(hp.max) + result.gain }
    });
  }

  static async #levelUp() {
    const cls = getRCClass(this.actor.system.attributes?.classKey || this.actor.system.attributes?.class);
    if (!cls) return;
    const level = Number(this.actor.system.attributes?.level) || 1;
    if (level >= cls.maxLevel) return;
    const next = level + 1;
    const result = hpForLevel(cls.key, next, adjustment(this.actor.system.abilities?.con?.value));
    const hp = this.actor.system.attributes.hp ?? { value: 0, max: 0 };
    await this.actor.update({
      "system.attributes.level": next,
      "system.attributes.xpNext": cls.xp[next] ?? cls.xp.at(-1),
      "system.attributes.hp": { value: Number(hp.value) + result.gain, max: Number(hp.max) + result.gain }
    });
  }

  static async #restSpells() {
    await this.actor.update({ "system.spellbook.used": {} });
  }

  static async #memorizeSpell(event, target) {
    const key = target.dataset.spellKey;
    const spell = RC.spells.find((entry) => spellKey(entry) === key);
    if (!spell) return;
    const classKey = normalizeClassKey(this.actor.system.attributes?.classKey || this.actor.system.attributes?.class);
    const slots = spellSlotsForLevel(classKey, Number(this.actor.system.attributes?.level) || 1);
    const memorized = { ...(this.actor.system.spellbook?.memorized ?? {}) };
    for (let slot = 1; slot <= (slots[spell.level - 1] ?? 0); slot++) {
      const field = `${spell.level}_${slot}`;
      if (!memorized[field]) {
        memorized[field] = key;
        await this.actor.update({ "system.spellbook.memorized": memorized });
        return;
      }
    }
    ui.notifications.warn(game.i18n.localize("BECMI.notification.noSpellSlot"));
  }

  static async #addMasteryRow() {
    const rows = [...(this.actor.system.mastery?.rows ?? []), { name: "", grade: "sem", primary: "H", target: "prim" }];
    await this.actor.update({ "system.mastery.rows": rows });
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
      buttons: ["weapon", "armor", "equipment", "spell", "feature", "class"].map((key) => ({
        action: key,
        label: game.i18n.localize(`BECMI.item.${key}`),
        callback: () => key
      }))
    });
    if (!type) return;
    await this.actor.createEmbeddedDocuments("Item", [{ name: `New ${type}`, type }]);
  }
}
