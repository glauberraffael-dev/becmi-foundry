/**
 * Foundry ApplicationV2 wizard for Rules Cyclopedia character creation.
 *
 * All rule decisions come from character-creation.mjs. This module only reads
 * transient form state, resolves compendium Items and writes the final plan.
 */
import {
  ABILITY_KEYS, ALIGNMENTS, RACES, WIZARD_STEPS, abilityAdjustments,
  applyCreationSwap, availableStartingItems, buildCharacterPlan,
  normalizeAlignment, purchaseSummary, scoresFromRolls, startingHpFor,
  toActorUpdates
} from "../character-creation.mjs";
import { RC, adjustment, getRCClass } from "../rules-rc.mjs";
import { applySheetTheme, isDarkMode } from "../sheets/preferences.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const CLASS_RACES = Object.freeze({ dwarf: "Dwarf", elf: "Elf", halfling: "Halfling" });
const ITEM_GROUPS = Object.freeze([
  ["weapons", "BECMI.wizard.items.weapons"],
  ["armor", "BECMI.wizard.items.armor"],
  ["adventuring", "BECMI.wizard.items.adventuring"]
]);

function raceForClass(classKey, fallback = "Human") {
  return CLASS_RACES[getRCClass(classKey)?.key] ?? fallback;
}

function initialState(actor) {
  const system = actor?.system ?? {};
  const attrs = system.attributes ?? {};
  const classKey = getRCClass(attrs.classKey ?? attrs.class)?.key ?? "";
  const abilities = Object.fromEntries(ABILITY_KEYS.map((key) =>
    [key, Number(system.abilities?.[key]?.value) || 10]));
  const goldRolls = Array.from({ length: 3 }, () => 1 + Math.floor(Math.random() * 6));
  return {
    name: actor?.name ?? "",
    player: String(attrs.player ?? ""),
    race: attrs.race ?? raceForClass(classKey),
    alignment: normalizeAlignment(attrs.alignment) ?? "neutral",
    classKey,
    abilities,
    swapCount: 0,
    hpMode: "rolled",
    hp: startingHpFor(classKey, abilities.con).gain || 1,
    hpManual: false,
    goldRolls,
    languages: "",
    height: String(attrs.details?.height ?? ""),
    weight: String(attrs.details?.weight ?? ""),
    items: [],
    personality: String(system.details?.personality ?? ""),
    background: String(system.details?.background ?? ""),
    generalSkillsEnabled: Boolean(system.generalSkills?.enabled),
    masteryEnabled: Boolean(system.mastery?.enabled)
  };
}

export class CharacterWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this.state = initialState(actor);
    this.activeStep = "identity";
    this.structuralChange = false;
  }

  static DEFAULT_OPTIONS = Object.freeze(foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    classes: ["becmi", "character-wizard"],
    tag: "form",
    position: { width: 860, height: 760 },
    window: { title: "BECMI.wizard.title", resizable: true },
    form: {
      handler: CharacterWizard.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      switchStep: CharacterWizard.#switchStep,
      rollAbilities: CharacterWizard.#rollAbilities,
      rerollAbilities: CharacterWizard.#rollAbilities,
      applySwap: CharacterWizard.#applySwap,
      resetSwap: CharacterWizard.#resetSwap,
      rollHp: CharacterWizard.#rollHp,
      useLanguages: CharacterWizard.#useLanguages,
      rollMoney: CharacterWizard.#rollMoney,
      apply: CharacterWizard.#apply,
      cancel: CharacterWizard.#cancel
    }
  }, { inplace: false }));

  static PARTS = {
    main: { template: "systems/becmi/templates/actor/character-wizard.hbs" }
  };

  async _onRender(context, options) {
    await super._onRender(context, options);
    applySheetTheme(this.element, isDarkMode());
  }

  /** Read the current form without writing anything to the Actor. */
  #readForm(form) {
    if (!form) return;
    const state = this.state;
    const value = (name, fallback) => {
      const field = form.querySelector(`[name="${name}"]`);
      if (!field) return fallback;
      return field.type === "checkbox" ? field.checked : field.value;
    };
    const previousClass = state.classKey;
    const previousCon = Number(state.abilities.con);
    const previousHpMode = state.hpMode;

    state.name = String(value("name", state.name));
    state.player = String(value("player", state.player));
    state.classKey = String(value("classKey", state.classKey) ?? "");
    state.race = String(value("race", state.race) ?? "Human");
    state.alignment = String(value("alignment", state.alignment) ?? "neutral");
    state.swapCount = Math.max(0, Math.floor(Number(value("swapCount", state.swapCount)) || 0));
    state.hpMode = value("hpMode", state.hpMode) === "maximum" ? "maximum" : "rolled";
    state.languages = String(value("languages", state.languages) ?? "");
    state.height = String(value("height", state.height) ?? "");
    state.weight = String(value("weight", state.weight) ?? "");
    state.personality = String(value("personality", state.personality) ?? "");
    state.background = String(value("background", state.background) ?? "");
    state.generalSkillsEnabled = Boolean(value("generalSkillsEnabled", state.generalSkillsEnabled));
    state.masteryEnabled = Boolean(value("masteryEnabled", state.masteryEnabled));

    for (const key of ABILITY_KEYS) {
      const raw = value(`ability.${key}`, state.abilities[key]);
      const number = Math.max(3, Math.min(18, Math.round(Number(raw) || 10)));
      if (number !== Number(state.abilities[key])) this.structuralChange = true;
      state.abilities[key] = number;
    }
    const requestedHp = value("hp", state.hp);
    if (String(requestedHp) !== String(state.hp)) state.hpManual = true;
    state.hp = Math.max(1, Math.round(Number(requestedHp) || 1));

    const itemFields = [...form.querySelectorAll("[data-wizard-item]")];
    if (itemFields.length) {
      state.items = itemFields.filter((field) => field.checked).map((field) => field.value);
      this.structuralChange = true;
    }

    if (state.classKey !== previousClass) {
      state.race = CLASS_RACES[state.classKey]
        ?? (CLASS_RACES[previousClass] ? "Human" : state.race);
      state.items = [];
      this.structuralChange = true;
    }
    if ((state.classKey !== previousClass || Number(state.abilities.con) !== previousCon
      || state.hpMode !== previousHpMode) && !state.hpManual) {
      state.hp = startingHpFor(state.classKey, state.abilities.con, Math.random,
        { startAtMaximum: state.hpMode === "maximum" }).gain || 1;
      this.structuralChange = true;
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const plan = buildCharacterPlan({ ...this.state });
    const adjusted = applyCreationSwap(this.state.classKey, this.state.abilities, this.state.swapCount);
    const issues = plan.issues.map((entry) => ({
      ...entry,
      label: game.i18n.format(`BECMI.wizard.issue.${entry.code}`, entry.params)
    }));

    context.actorName = this.actor?.name ?? "";
    context.state = this.state;
    context.plan = plan;
    context.issues = issues;
    context.steps = WIZARD_STEPS.map((key) => ({
      key, label: game.i18n.localize(`BECMI.wizard.step.${key}`), active: this.activeStep === key
    }));
    context.activeStep = this.activeStep;
    context.classOptions = Object.values(RC.classes).map((cls) => ({
      key: cls.key,
      name: cls.name,
      hitDie: `d${cls.hitDie}`,
      maxLevel: cls.maxLevel
    }));
    context.raceOptions = RACES.map((name) => ({ key: name, label: name }));
    context.alignmentOptions = ALIGNMENTS.map((key) => ({
      key, label: game.i18n.localize(`BECMI.wizard.alignment.${key}`)
    }));
    context.abilityRows = ABILITY_KEYS.map((key) => ({
      key,
      label: game.i18n.localize(`BECMI.abilities.${key}`),
      score: this.state.abilities[key],
      adjustment: adjustment(this.state.abilities[key]) ?? 0,
      adjusted: adjusted.scores[key]
    }));
    context.adjustments = abilityAdjustments(adjusted.scores);
    context.purchase = purchaseSummary(this.state.items);
    const selectedItems = new Set(this.state.items);
    context.itemGroups = ITEM_GROUPS.map(([key, label]) => ({
      key, label: game.i18n.localize(label),
      items: availableStartingItems(this.state.classKey)
        .filter((item) => item.group === key)
        .map((item) => ({ ...item, selected: selectedItems.has(item.name) }))
    })).filter((group) => group.items.length);
    context.requirements = plan.preview.requirements.map((entry) =>
      `${entry.name} ${entry.minimum}+`);
    context.languageSuggestions = plan.preview.languages.languages.join(", ");
    return context;
  }

  static async #onSubmit(event, form, formData) {
    this.#readForm(form);
    const shouldRender = this.structuralChange;
    this.structuralChange = false;
    if (shouldRender) await this.render();
  }

  static async #switchStep(event, target) {
    this.#readForm(this.element);
    this.structuralChange = false;
    this.activeStep = WIZARD_STEPS.includes(target.dataset.step) ? target.dataset.step : "identity";
    await this.render();
  }

  static async #rollThreeDice() {
    const roll = await new Roll("3d6").evaluate();
    return roll.dice.flatMap((die) => die.results.map((result) =>
      Number(result.result ?? result.value)));
  }

  static async #rollAbilities() {
    this.#readForm(this.element);
    const rolls = Array.from({ length: 6 }, () => CharacterWizard.#rollThreeDice());
    const result = scoresFromRolls(await Promise.all(rolls));
    this.state.abilities = result.scores;
    this.state.swapCount = 0;
    this.state.hpManual = false;
    this.state.hp = startingHpFor(this.state.classKey, result.scores.con, Math.random,
      { startAtMaximum: this.state.hpMode === "maximum" }).gain || 1;
    this.structuralChange = false;
    await this.render();
  }

  static async #applySwap(event, target) {
    this.#readForm(this.element);
    const input = this.element.querySelector('[name="swapCount"]');
    const value = target.dataset.swaps ?? input?.value ?? this.state.swapCount;
    this.state.swapCount = Math.max(0, Math.floor(Number(value) || 0));
    this.structuralChange = false;
    await this.render();
  }

  static async #resetSwap() {
    this.#readForm(this.element);
    this.state.swapCount = 0;
    this.structuralChange = false;
    await this.render();
  }

  static async #rollHp() {
    this.#readForm(this.element);
    const cls = getRCClass(this.state.classKey);
    if (!cls) {
      ui.notifications.warn(game.i18n.localize("BECMI.wizard.chooseClassFirst"));
      return;
    }
    const conAdj = adjustment(this.state.abilities.con) ?? 0;
    if (this.state.hpMode === "maximum") {
      this.state.hp = Math.max(1, cls.hitDie + conAdj);
    } else {
      const roll = await new Roll(`1d${cls.hitDie}`).evaluate();
      this.state.hp = Math.max(1, Number(roll.total) + conAdj);
    }
    this.state.hpManual = true;
    this.structuralChange = false;
    await this.render();
  }

  static async #useLanguages() {
    this.#readForm(this.element);
    const plan = buildCharacterPlan({ ...this.state });
    this.state.languages = plan.preview.languages.languages.join(", ");
    this.structuralChange = false;
    await this.render();
  }

  static async #rollMoney() {
    this.#readForm(this.element);
    this.state.goldRolls = await CharacterWizard.#rollThreeDice();
    this.structuralChange = false;
    await this.render();
  }

  static async #cancel() {
    await this.close();
  }

  static async #compendiumDocuments(packName, names) {
    const pack = game.packs?.get(packName);
    if (!pack || !names.length) return [];
    const index = await pack.getIndex({ fields: ["name"] });
    const byName = new Map(index.map((entry) => [String(entry.name).toLowerCase(), entry._id]));
    const documents = await Promise.all(names.map(async (name) => {
      const id = byName.get(String(name).toLowerCase());
      return id ? pack.getDocument(id) : null;
    }));
    return documents.filter(Boolean);
  }

  static async #apply() {
    this.#readForm(this.element);
    const plan = buildCharacterPlan({ ...this.state });
    if (plan.blocking) {
      ui.notifications.warn(game.i18n.localize("BECMI.notification.wizardBlocked"));
      this.activeStep = "review";
      await this.render();
      return;
    }

    const classDocuments = await CharacterWizard.#compendiumDocuments(
      "becmi.classes", [plan.preview.className]);
    const equipmentDocuments = await CharacterWizard.#compendiumDocuments(
      "becmi.equipment", plan.itemsToCreate);
    const embedded = [
      ...classDocuments.map((document) => document.toObject()),
      ...equipmentDocuments.map((document) => {
        const data = document.toObject();
        data.system = { ...(data.system ?? {}), equipped: true };
        return data;
      })
    ];
    const oldClasses = (this.actor.items ?? []).filter((item) => item.type === "class");
    if (oldClasses.length) {
      await this.actor.deleteEmbeddedDocuments("Item", oldClasses.map((item) => item.id));
    }
    if (embedded.length) {
      await this.actor.createEmbeddedDocuments("Item", embedded);
    }

    const changes = toActorUpdates(plan);
    const classUuid = classDocuments[0]?.flags?.core?.sourceId ?? classDocuments[0]?.uuid ?? "";
    if (classUuid) {
      changes["system.attributes.classUuid"] = classUuid;
      changes["flags.becmi.classInfo"] = {
        ...(changes["flags.becmi.classInfo"] ?? {}), uuid: classUuid
      };
    }
    await this.actor.update(changes);
    ui.notifications.info(game.i18n.format("BECMI.notification.wizardApplied", {
      name: changes.name
    }));
    await this.close();
  }
}
