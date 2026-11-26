import {
  advanceActorLevels, classInfoFromRC, importSpellToActor, spellListsForClass,
  syncGrimoireFromImportedSpell
} from "../integrations.mjs";
import { classFeaturesFor } from "../class-features.mjs";
import { nameLevelDetails, nameLevelOptions } from "../name-level.mjs";
import { hasMasteryRows } from "../mastery.mjs";
import { applySheetTheme, isDarkMode, sanitizeImageUpdate, setDarkMode } from "./preferences.mjs";
import {
  RC, SPELL_LISTS, attackRows, adjustment, getRCClass, hpForLevel, masteryData, masteryRanks,
  masteryWeapon, masteryChoices, monsterAttackRows, monsterSpellcasterInfo,
  normalizeClassKey, spellKey, spellSlotsForLevel, spellsFor, turnUndeadColumn
} from "../rules-rc.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const ABILITIES = ["str", "int", "wis", "dex", "con", "cha"];
const SAVES = ["deathRay", "magicWand", "paralysis", "breath", "spells"];

/** HP tracking is the only sheet data a player may change in use mode. */
const TRACKING_FIELDS = new Set(["system.attributes.hp.value"]);
const HP_FIELDS = ["system.attributes.hp", "system.attributes.hp.value", "system.attributes.hp.max"];

function trackingValue(path, value) {
  if (path !== "system.attributes.hp.value") return value;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : 0;
}

/** The class selector is a normal form field; it expands into a full RC snapshot. */
function classUpdateFor(key) {
  const cls = RC.classes[key];
  if (!cls) {
    return {
      "system.attributes.classKey": "",
      "system.attributes.class": "",
      "system.attributes.hd": "",
      "flags.becmi.classInfo": null
    };
  }
  return {
    "system.attributes.classKey": key,
    "system.attributes.class": cls.name,
    "system.attributes.hd": `1d${cls.hitDie}`,
    "flags.becmi.classInfo": classInfoFromRC(cls.name)
  };
}

const SHEET_TABS = [
  ["main", "BECMI.sheet.tab.main"],
  ["features", "BECMI.sheet.tab.features"],
  ["equipment", "BECMI.sheet.tab.equipment"],
  ["spells", "BECMI.sheet.tab.spells"],
  ["thief", "BECMI.sheet.tab.thief"],
  ["undead", "BECMI.sheet.tab.undead"],
  ["attack", "BECMI.sheet.tab.attack"],
  ["mastery", "BECMI.sheet.tab.mastery"],
  ["magic", "BECMI.sheet.tab.magic"],
  ["notes", "BECMI.sheet.tab.notes"]
];

/** Class-exclusive sheet sections. Unknown classes get no special abilities. */
const CLASS_CAPABILITIES = {
  fighter: { mastery: true },
  cleric: { spells: true, turn: true },
  thief: { thief: true },
  "magic-user": { spells: true },
  dwarf: { mastery: true },
  elf: { spells: true, mastery: true },
  halfling: { mastery: true }
};

const RESOURCE_LABELS = {
  magias: "BECMI.sheet.resource.spells",
  afugentar: "BECMI.sheet.resource.turn",
  pericias: "BECMI.sheet.resource.skills"
};

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

const EQUIPMENT_GROUPS = [
  ["weapons", "BECMI.sheet.group.weapons"],
  ["armor", "BECMI.sheet.group.armor"],
  ["adventuring", "BECMI.sheet.group.adventuring"],
  ["transport", "BECMI.sheet.group.transport"]
];

function equipmentGroupFor(item) {
  if (item.type === "weapon") return "weapons";
  if (item.type === "armor") return "armor";
  const note = String(item.flags?.becmi?.notes ?? "");
  const group = item.flags?.becmi?.group;
  if (group === "transport" || /transport|siege/i.test(note)) return "transport";
  return "adventuring";
}

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

const byName = (a, b) => String(a.name ?? "").localeCompare(String(b.name ?? ""), "en", { sensitivity: "base", numeric: true });
const spellLevelOf = (spell) => Number(spell?.system?.spellLevel ?? spell?.level) || 0;
const bySpellLevelThenName = (a, b) => spellLevelOf(a) - spellLevelOf(b) || byName(a, b);

const spellSourceUuid = (item) => String(
  item?.flags?.becmi?.sourceUuid ?? item?.flags?.core?.sourceId ?? item?.uuid ?? ""
);

function notifySpellImport(sheet, result, name) {
  if (!globalThis.ui?.notifications) return;
  if (result.status === "imported") {
    ui.notifications.info(game.i18n.format("BECMI.notification.spellImported", {
      name: result.item?.name ?? name
    }));
  } else if (result.status === "duplicate") {
    ui.notifications.info(game.i18n.format("BECMI.notification.spellAlreadyKnown", { name }));
  } else if (result.status === "failed" || result.status === "invalid") {
    ui.notifications.warn(game.i18n.format("BECMI.notification.spellImportFailedName", { name }));
  }
}

/** Read the raw drag payload without assuming it contains a resolvable document. */
function dragEventData(event) {
  try {
    const TextEditor = foundry.applications.ux.TextEditor.implementation
      ?? foundry.applications.ux.TextEditor;
    return TextEditor.getDragEventData(event) ?? {};
  } catch {
    return {};
  }
}

/** Read the raw document UUID before ActorSheetV2 resolves the drop. */
function draggedDocumentUuid(event) {
  const data = dragEventData(event);
  const uuid = data.uuid ?? data.documentUuid;
  return typeof uuid === "string" ? uuid : "";
}

/** Normalize the compendium UUID variants used by Foundry v13 and v14. */
function canonicalCompendiumUuid(uuid) {
  const value = String(uuid ?? "");
  return value.replace(/^Compendium\.([^.]+)\.([^.]+)\.(?:Item\.)?([^.]+)$/,
    (_match, scope, pack, id) => `Compendium.${scope}.${pack}.Item.${id}`);
}

export class BECMIActorSheet extends HandlebarsApplicationMixin(ActorSheetV2) {
  activeTab = "main";
  sidebarCollapsed = false;
  editMode = false;
  spellPicker = { level: 0, search: "", list: "" };
  targetAC = 9;
  #dropUuidByEvent = new WeakMap();

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
      toggleSidebar: BECMIActorSheet.#toggleSidebar,
      toggleEditMode: BECMIActorSheet.#toggleEditMode,
      toggleDarkMode: BECMIActorSheet.#toggleDarkMode,
      setClass: BECMIActorSheet.#setClass,
      toggleDruid: BECMIActorSheet.#toggleDruid,
      setSpellList: BECMIActorSheet.#setSpellList,
      importSpell: BECMIActorSheet.#importSpell,
      rollAbility: BECMIActorSheet.#rollAbility,
      rollSave: BECMIActorSheet.#rollSave,
      rollInitiative: BECMIActorSheet.#rollInitiative,
      rollMorale: BECMIActorSheet.#rollMorale,
      rollHitDice: BECMIActorSheet.#rollHitDice,
      monsterAttack: BECMIActorSheet.#monsterAttack,
      monsterDamage: BECMIActorSheet.#monsterDamage,
      rollFree: BECMIActorSheet.#rollFree,
      rollDice: BECMIActorSheet.#rollDice,
      rollThief: BECMIActorSheet.#rollThief,
      rollTurnUndead: BECMIActorSheet.#rollTurnUndead,
      detectEvil: BECMIActorSheet.#detectEvil,
      createCharacter: BECMIActorSheet.#createCharacter,
      levelUp: BECMIActorSheet.#levelUp,
      restSpells: BECMIActorSheet.#restSpells,
      castSpell: BECMIActorSheet.#castSpell,
      memorizeSpell: BECMIActorSheet.#memorizeSpell,
      addMasteryRow: BECMIActorSheet.#addMasteryRow,
      toggleMastery: BECMIActorSheet.#toggleMastery,
      itemAttack: BECMIActorSheet.#itemAttack,
      itemDamage: BECMIActorSheet.#itemDamage,
      itemFormula: BECMIActorSheet.#itemFormula,
      itemCast: BECMIActorSheet.#itemCast,
      itemOpen: BECMIActorSheet.#itemOpen,
      itemDelete: BECMIActorSheet.#itemDelete,
      addItem: BECMIActorSheet.#addItem
    }
  }, { inplace: false }));

  static PARTS = {
    header: { template: "systems/becmi/templates/actor/header.hbs" },
    body: { template: "systems/becmi/templates/actor/body.hbs" }
  };

  async _onRender(context, options) {
    await super._onRender(context, options);
    applySheetTheme(this.element, isDarkMode());
  }

  /** Capture the drag UUID, then let ActorSheetV2 resolve the dropped document. */
  async _onDrop(event) {
    if (!this.isEditable || !this.editMode) return null;
    const data = dragEventData(event);
    // Folder headers and partial drag payloads have no document to resolve.
    // Passing them to ActorSheetV2 would throw inside Item.fromDropData.
    if (!data.uuid && !data.documentUuid && !data.data) return null;
    const uuid = draggedDocumentUuid(event);
    if (uuid) this.#dropUuidByEvent.set(event, uuid);
    try {
      return await super._onDrop(event);
    } catch (error) {
      console.warn("BECMI | Ignored an unsupported drop", error);
      if (globalThis.ui?.notifications?.warn) {
        ui.notifications.warn(game.i18n.localize("BECMI.notification.dropInvalid"));
      }
      return null;
    } finally {
      this.#dropUuidByEvent.delete(event);
    }
  }

  /** Import compendium spells as owned Items; let core handle every other Item. */
  async _onDropItem(event, item) {
    if (!this.isEditable || !this.editMode || item?.documentName !== "Item") return null;

    // Owned items (reordering), classes, equipment and treasure all use the
    // standard ActorSheetV2 creation path. Only spells need the grimoire merge.
    if (item.parent === this.actor || item.type !== "spell") {
      return super._onDropItem(event, item);
    }

    const droppedUuid = canonicalCompendiumUuid(this.#dropUuidByEvent.get(event));
    const sourceUuid = canonicalCompendiumUuid(
      item.flags?.core?.sourceId ?? item._stats?.compendiumSource ?? item.uuid ?? droppedUuid
    );
    const uuid = droppedUuid.startsWith("Compendium.") ? droppedUuid : sourceUuid;

    const source = item.compendium
      ? game.items.fromCompendium(item, { clearFolder: true, keepId: false })
      : foundry.utils.deepClone(item.toObject());
    source.type = "spell";
    if (uuid.startsWith("Compendium.")) {
      source.flags ??= {};
      source.flags.core ??= {};
      source.flags.core.sourceId ??= uuid;
      source._stats ??= {};
      source._stats.compendiumSource ??= uuid;
    }

    const result = await importSpellToActor(this.actor, source);
    if (result.status === "imported") await syncGrimoireFromImportedSpell(this.actor, item);
    if (globalThis.ui?.notifications) {
      if (result.status === "imported") {
        ui.notifications.info(game.i18n.format("BECMI.notification.spellImported", {
          name: result.item?.name ?? item.name
        }));
      } else if (result.status === "duplicate") {
        ui.notifications.info(game.i18n.format("BECMI.notification.spellAlreadyKnown", {
          name: item.name
        }));
      } else if (result.status === "failed") {
        ui.notifications.warn(game.i18n.localize("BECMI.notification.spellImportFailed"));
      }
    }
    return result.item;
  }

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
    const capabilities = CLASS_CAPABILITIES[classKey] ?? {};
    const isDruid = classKey === "cleric" && Boolean(flags.druid);
    const nameLevel = nameLevelDetails(actor.system, flags);
    const nameLevelChoices = nameLevelOptions(classKey, attrs.alignment);
    // Paladins and avengers cast and turn as a cleric of one-third level.
    const canCast = Boolean(capabilities.spells) || nameLevel.canCastCleric;
    const casterInfo = isCharacter ? null : monsterSpellcasterInfo(actor.system, flags);
    const monsterSpellcaster = !isCharacter && Boolean(
      casterInfo || flags.spellcaster || actor.items.some((item) => item.type === "spell")
    );
    const hasSpellsTab = canCast || monsterSpellcaster;
    const spellClassKey = nameLevel.canCastCleric
      ? "cleric" : canCast ? classKey : (casterInfo?.classKey ?? "magic-user");
    const spellLevel = nameLevel.canCastCleric
      ? nameLevel.spellLevel : canCast ? level : (casterInfo?.level ?? level);
    const canTurn = Boolean(capabilities.turn) || nameLevel.canTurnUndead;
    const turnUndeadLevel = nameLevel.canTurnUndead ? nameLevel.clericalLevel : level;
    // Roll actions use these snapshots so the chat card shows the effective
    // clerical level instead of the fighter's actual level.
    this.nameLevel = nameLevel;
    this.turnUndeadLevel = turnUndeadLevel;
    this.spellClassKey = spellClassKey;
    this.spellLevel = spellLevel;
    const canThief = Boolean(capabilities.thief);
    // Weapon mastery is optional for every class in the Rules Cyclopedia.
    // Keep the tab reachable for sheets that already stored mastery rows.
    const masteryEnabled = Boolean(actor.system.mastery?.enabled);
    const canMastery = isCharacter && (masteryEnabled || Boolean(capabilities.mastery) || hasMasteryRows(actor));

    Object.assign(context, {
      actor, system: actor.system, flags, isCharacter,
      canEdit: this.isEditable,
      editMode: this.editMode,
      editable: this.isEditable && this.editMode,
      darkMode: isDarkMode(),
      level, xp, classKey, rcClass, isDruid, canCast, monsterSpellcaster, hasSpellsTab,
      spellClassKey, spellLevel, monsterSpellcastingText: casterInfo?.text ?? "",
      canTurn, turnUndeadLevel, nameLevel, nameLevelChoices, canThief, canMastery,
      masteryEnabled,
      masteryToggleLabel: game.i18n.localize(masteryEnabled
        ? "BECMI.sheet.masteryDisable" : "BECMI.sheet.masteryEnable"),
      sidebarCollapsed: this.sidebarCollapsed,
      sidebarToggleLabel: game.i18n.localize(this.sidebarCollapsed
        ? "BECMI.sheet.sidebar.show" : "BECMI.sheet.sidebar.hide"),
      targetAC: this.targetAC,
      classOptions: Object.values(RC.classes).map((cls) => ({ key: cls.key, name: cls.name })).sort(byName),
      armorOptions: Object.entries(RC.armor.types).map(([key, value]) => ({ key, name: ARMOR_EN[key] ?? value.name, ac: value.ac })),
      masteryGrades: masteryRanks().map((grade) => ({ key: grade.key, name: grade.nome })),
      diceOptions: [4, 6, 8, 10, 12, 20, 100].map((faces) => ({ faces })),
      masteryWeapons: RC.mastery.weapons.map((weapon) => weapon.name).sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" })),
      masteryCatalog: RC.mastery.weapons.map((weapon) => ({
        ...masteryData(weapon, "gm"),
        primary: weapon.primary,
        cost: weapon.cost,
        weight: weapon.weight
      })).sort(byName)
    });

    const hp = attrs.hp ?? {};
    const hpMax = Math.max(0, Number(hp.max) || 0);
    const hpValue = Math.max(0, Number(hp.value) || 0);
    context.hpBar = {
      value: hpValue,
      max: hpMax,
      percent: hpMax ? Math.min(100, Math.round((100 * hpValue) / hpMax)) : 0
    };
    context.monsterAttacks = isCharacter ? [] : monsterAttackRows(actor.system)
      .map((row, index) => ({ ...row, index }));

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

    const undeadColumn = turnUndeadColumn(turnUndeadLevel);
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

    const extraLists = isDruid ? ["druid"] : [];
    const grimoire = String(actor.system.spellbook?.grimoire ?? "").split(",").map((key) => key.trim()).filter(Boolean);
    const className = rcClass?.name ?? attrs.class ?? flags.classInfo?.name ?? "";
    const spellLists = canCast
      ? spellListsForClass(
        { name: getRCClass(spellClassKey)?.name ?? spellClassKey },
        { druid: isDruid && spellClassKey === "cleric" }
      )
      : monsterSpellcaster && casterInfo
        ? [...new Set(casterInfo.classKeys.flatMap((key) => key === "druid"
          ? ["druid"] : spellListsForClass({ name: getRCClass(key)?.name ?? key })))]
        : monsterSpellcaster ? SPELL_LISTS.map((entry) => entry.key) : [];
    const selectableLists = canCast ? spellLists : SPELL_LISTS.map((entry) => entry.key);
    const ownedSpells = actor.items.filter((item) => item.type === "spell");
    const knownUuids = new Set(ownedSpells.map((item) => spellSourceUuid(item)).filter(Boolean));
    const filterLevel = Math.max(0, Math.min(9, Number(this.spellPicker.level) || 0));
    const search = String(this.spellPicker.search ?? "").trim();
    const listFilter = selectableLists.includes(this.spellPicker.list) ? this.spellPicker.list : "";
    const needle = search.toLowerCase();

    context.grimoire = actor.system.spellbook?.grimoire ?? "";
    context.spellSlots = hasSpellsTab ? spellSlotsForLevel(spellClassKey, spellLevel) : [];
    const maxSpellLevel = Math.max(1, Math.min(9,
      Number(getRCClass(spellClassKey)?.spells?.levels) || context.spellSlots.length || 9));
    context.spellLevels = Array.from({ length: maxSpellLevel }, (_, index) => index + 1);
    context.spellSlots = context.spellSlots.slice(0, maxSpellLevel);

    const rcOptionsByLevel = context.spellLevels.map((spellLevel) =>
      spellsFor(spellClassKey, spellLevel, { grimoire, extraLists })
        .map((spell) => ({ key: spellKey(spell), name: spell.name, level: spell.level, itemId: "" })));
    const itemOptionsByLevel = context.spellLevels.map((spellLevel) =>
      ownedSpells
        .filter((item) => (Number(item.system?.spellLevel) || 0) === spellLevel
          && (!spellLists.length || (item.system?.spellLists ?? []).some((list) => spellLists.includes(list))))
        .map((item) => ({ key: `item:${item.id}`, name: item.name, level: spellLevel, itemId: item.id })));
    context.spellOptions = context.spellLevels.map((spellLevel, index) => {
      const seen = new Set();
      return [...rcOptionsByLevel[index], ...itemOptionsByLevel[index]].filter((option) => {
        const signature = option.name.toLowerCase();
        if (seen.has(signature)) return false;
        seen.add(signature);
        return true;
      });
    });

    context.spellGroups = context.spellLevels.map((spellLevel, levelIndex) => {
      const max = context.spellSlots[levelIndex] ?? 0;
      const entries = Array.from({ length: max }, (_, index) => {
        const key = `${spellLevel}_${index + 1}`;
        const spell = actor.system.spellbook?.memorized?.[key] ?? "";
        return {
          key,
          number: index + 1,
          spell,
          itemId: String(spell).startsWith("item:") ? String(spell).slice(5) : "",
          used: Boolean(actor.system.spellbook?.used?.[key]),
          options: context.spellOptions[levelIndex] ?? []
        };
      });
      const prepared = entries.filter((entry) => entry.spell).length;
      const spent = entries.filter((entry) => entry.spell && entry.used).length;
      return {
        level: spellLevel,
        max,
        prepared,
        spent,
        remaining: Math.max(0, max - spent),
        percent: max ? Math.round((100 * Math.max(0, max - spent)) / max) : 0,
        entries
      };
    });
    context.spellRows = context.spellGroups;

    context.spellFilterOptions = [
      { key: "", name: game.i18n.localize("BECMI.sheet.allLists") },
      ...SPELL_LISTS.filter((entry) => spellLists.includes(entry.key))
        .map((entry) => ({ key: entry.key, name: game.i18n.localize(`BECMI.sheet.list.${entry.key}`) }))
    ];
    context.spellListFilter = listFilter;
    const rcList = hasSpellsTab
      ? spellsFor(spellClassKey, filterLevel, { grimoire, search, extraLists, listFilter })
      : [];
    const rcRows = rcList.map((spell) => ({
      key: spellKey(spell),
      itemId: "",
      name: spell.name,
      level: spell.level,
      listName: game.i18n.localize(`BECMI.sheet.list.${spell.class}`),
      range: spell.range,
      duration: spell.duration,
      effect: spell.effect,
      notes: [spell.reverse ? `Reverse: ${spell.reverse}` : "", spell.save ? `Save: ${spell.save}` : ""].filter(Boolean).join("; ")
    }));
    const itemRows = ownedSpells
      .filter((item) => !filterLevel || (Number(item.system?.spellLevel) || 0) === filterLevel)
      .filter((item) => !listFilter || (item.system?.spellLists ?? []).includes(listFilter))
      .filter((item) => !needle || item.name.toLowerCase().includes(needle))
      .map((item) => ({
        key: `item:${item.id}`,
        itemId: item.id,
        name: item.name,
        level: Number(item.system?.spellLevel) || 0,
        listName: (item.system?.spellLists ?? []).map((list) => game.i18n.localize(`BECMI.sheet.list.${list}`)).join(", "),
        range: item.system?.range ?? "",
        duration: item.system?.duration ?? "",
        effect: item.system?.effect ?? "",
        notes: item.system?.description ?? ""
      }));
    context.spellList = [...rcRows, ...itemRows].sort(bySpellLevelThenName);
    context.spellSearch = search;
    context.spellFilterLevel = filterLevel;

    context.importSpellOptions = [];
    if (hasSpellsTab) {
      const pack = game.packs?.get("becmi.spells");
      const docs = pack ? await pack.getDocuments() : [];
      context.importSpellOptions = docs
        .filter((doc) => (doc.system?.spellLists ?? []).some((list) => spellLists.includes(list)))
        .filter((doc) => !filterLevel || Number(doc.system?.spellLevel) === filterLevel)
        .filter((doc) => !listFilter || (doc.system?.spellLists ?? []).includes(listFilter))
        .filter((doc) => !needle || doc.name.toLowerCase().includes(needle))
        .sort(bySpellLevelThenName)
        .map((doc) => ({
          uuid: doc.uuid,
          name: doc.name,
          level: Number(doc.system?.spellLevel) || 0,
          list: (doc.system?.spellLists ?? []).join(", "),
          known: knownUuids.has(doc.uuid)
        }));
    }

    const allItems = actor.items.filter((item) => !["spell", "feature", "class"].includes(item.type));
    context.equipmentGroups = EQUIPMENT_GROUPS.map(([key, label]) => ({
      key,
      label: game.i18n.localize(label),
      items: allItems.filter((item) => equipmentGroupFor(item) === key).sort(byName).map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        cost: item.system?.cost ?? "",
        weight: item.system?.weight ?? 0,
        quantity: item.system?.quantity ?? 1,
        damage: item.system?.damage ?? "",
        attackBonus: item.system?.attackBonus ?? 0,
        damageBonus: item.system?.damageBonus ?? 0,
        rollFormula: item.system?.rollFormula ?? ""
      }))
    }));
    context.magicItems = actor.system.magicItems ?? [];
    context.magicTotals = context.magicItems.reduce((totals, item) => {
      if (!item.equipped) return totals;
      totals.ac += Number(item.ac) || 0;
      totals.save += Number(item.save) || 0;
      totals.attack += Number(item.attack) || 0;
      totals.damage += Number(item.damage) || 0;
      return totals;
    }, { ac: 0, save: 0, attack: 0, damage: 0 });

    const allSpells = actor.items.filter((item) => item.type === "spell");
    context.className = className;
    context.classFeatures = isCharacter
      ? classFeaturesFor(className, { level, xp, druid: isDruid })
      : [];
    const spellView = (item) => ({
      id: item.id,
      name: item.name,
      level: Number(item.system?.spellLevel) || 0,
      rollFormula: item.system?.rollFormula ?? ""
    });
    const classSpellItems = spellLists.length
      ? allSpells.filter((item) => (item.system.spellLists ?? []).some((list) => spellLists.includes(list)))
      : allSpells;
    context.classSpells = [...classSpellItems].sort(bySpellLevelThenName).map(spellView);
    context.otherSpells = allSpells.filter((item) => !classSpellItems.includes(item))
      .sort(bySpellLevelThenName).map(spellView);
    context.classResources = (rcClass?.resources ?? []).map((key) => ({
      key,
      label: game.i18n.localize(RESOURCE_LABELS[key] ?? key)
    }));
    context.milestones = (rcClass?.milestones ?? []).filter(([minimum]) => xp >= minimum).map(([, text]) => text);

    const definitions = isCharacter ? SHEET_TABS.filter(([id]) => {
      if (id === "spells") return canCast;
      if (id === "thief") return canThief;
      if (id === "undead") return canTurn;
      if (id === "mastery") return canMastery;
      return true;
    }) : SHEET_TABS.filter(([id]) => ["main", ...(monsterSpellcaster ? ["spells"] : []), "notes"].includes(id));
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

  static async #toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    await this.render();
  }

  static async #toggleEditMode() {
    if (!this.isEditable) return;
    this.editMode = !this.editMode;
    await this.render();
  }

  static async #toggleDarkMode() {
    const dark = !isDarkMode();
    await setDarkMode(dark);
    applySheetTheme(this.element, dark);
    await this.render();
  }

  static async #onSubmit(event, form, formData) {
    const raw = { ...(formData.object ?? {}) };
    let filterChanged = false;
    if ("spellFilterLevel" in raw) {
      this.spellPicker.level = Math.max(0, Math.min(9, Number(raw.spellFilterLevel) || 0));
      delete raw.spellFilterLevel;
      filterChanged = true;
    }
    if ("spellSearch" in raw) {
      this.spellPicker.search = String(raw.spellSearch ?? "");
      delete raw.spellSearch;
      filterChanged = true;
    }

    const changes = sanitizeImageUpdate(raw);
    // XP thresholds come from the class table only; no form or action may write
    // them. The data model re-derives the value on every prepare cycle.
    delete changes["system.attributes.xpNext"];

    if ("system.attributes.classKey" in changes) {
      const classChanges = classUpdateFor(changes["system.attributes.classKey"]);
      delete changes["system.attributes.classKey"];
      Object.assign(changes, classChanges);
    }

    if (!this.isEditable || !this.editMode) {
      // The HP bar is a live tracking control, not an editing action. It works
      // in use mode for characters and monsters and stays bound to the token.
      const tracked = {};
      for (const [path, value] of Object.entries(changes)) {
        if (TRACKING_FIELDS.has(path)) tracked[path] = trackingValue(path, value);
      }
      if (Object.keys(tracked).length && this.isEditable) await this.actor.update(tracked);
      if (filterChanged) await this.render();
      return;
    }

    const requestedLevel = Number(changes["system.attributes.level"]);
    const currentLevel = Number(this.actor.system.attributes?.level) || 1;
    if (Number.isFinite(requestedLevel) && requestedLevel > currentLevel
      && !("system.attributes.hp" in changes)) {
      // Editing the level field must roll HP exactly like XP level-ups do.
      // The form still carries the old HP values; drop them so the canonical
      // level-up update is not overwritten by stale form data.
      delete changes["system.attributes.level"];
      for (const path of HP_FIELDS) delete changes[path];
      await advanceActorLevels(this.actor, { targetLevel: requestedLevel });
    }
    if (Object.keys(changes).length) await this.actor.update(changes);
    if (filterChanged) await this.render();
  }

  #targetAC() {
    const raw = this.element?.querySelector("[data-target-ac]")?.value;
    const value = String(raw ?? "").trim() === "" ? NaN : Number(raw);
    this.targetAC = Number.isFinite(value) ? value : 9;
    return this.targetAC;
  }

  static async #setClass(event, target) {
    if (!this.isEditable || !this.editMode) return;
    const key = target.dataset.classKey ?? target.value;
    // Keep only the RC snapshot; xpNext is re-derived by the data model.
    await this.actor.update(classUpdateFor(key));
  }

  static async #toggleDruid() {
    if (!this.isEditable || !this.editMode) return;
    const enabled = !Boolean(this.actor.flags?.becmi?.druid);
    await this.actor.update({ "flags.becmi.druid": enabled });
  }

  static async #setSpellList(event, target) {
    this.spellPicker.list = target.dataset.list ?? "";
    await this.render();
  }

  static async #importSpell() {
    if (!this.isEditable || !this.editMode) return;
    const options = [...(this.element?.querySelectorAll("[data-spell-import] option:checked") ?? [])];
    if (!options.length) {
      ui.notifications.warn(game.i18n.localize("BECMI.notification.spellImportSelect"));
      return;
    }
    for (const option of options) {
      const uuid = option.value;
      const doc = uuid ? await fromUuid(uuid) : null;
      if (doc?.type !== "spell") {
        notifySpellImport(this, { status: "invalid" }, option.textContent?.trim() ?? uuid);
        continue;
      }
      const source = doc.compendium
        ? game.items.fromCompendium(doc, { clearFolder: true, keepId: false })
        : foundry.utils.deepClone(doc.toObject());
      source.type = "spell";
      source.flags ??= {};
      source.flags.core ??= {};
      source.flags.core.sourceId = doc.uuid;
      source._stats ??= {};
      source._stats.compendiumSource = doc.uuid;
      const result = await importSpellToActor(this.actor, source);
      if (result.status === "imported") await syncGrimoireFromImportedSpell(this.actor, doc);
      notifySpellImport(this, result, doc.name);
    }
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

  static async #monsterAttack(event, target) {
    const index = Number(target.dataset.attackIndex);
    await this.actor.rollMonsterAttack(index, { targetAC: this.#targetAC(), mode: "attack" });
  }

  static async #monsterDamage(event, target) {
    const index = Number(target.dataset.attackIndex);
    await this.actor.rollMonsterDamage(index);
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
    await this.actor.rollTurnUndead(target.dataset.undead, {
      level: this.turnUndeadLevel,
      control: Boolean(this.nameLevel?.isAvenger)
    });
  }

  static async #detectEvil() {
    if (!this.nameLevel?.canDetectEvil) {
      ui.notifications.warn(game.i18n.localize("BECMI.notification.detectEvilUnavailable"));
      return;
    }
    await this.actor.rollDetectEvil();
  }

  static async #createCharacter() {
    if (!this.isEditable || !this.editMode) return;
    const cls = getRCClass(this.actor.system.attributes?.classKey || this.actor.system.attributes?.class);
    if (!cls) {
      ui.notifications.warn(game.i18n.localize("BECMI.notification.noClass"));
      return;
    }
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("BECMI.sheet.createCharacter") },
      content: `<p>${game.i18n.localize("BECMI.sheet.confirmCreate")}</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false,
      rejectClose: false
    });
    if (!confirmed) return;
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

  static async #levelUp() {
    if (!this.isEditable || !this.editMode) return;
    // The same helper used by the XP hook: one canonical XP table, HP added
    // once per level and no manual drift in "Next Level XP".
    await advanceActorLevels(this.actor);
  }

  static async #restSpells() {
    await this.actor.update({ "system.spellbook.used": {} });
  }

  static async #castSpell(event, target) {
    const slot = target.dataset.slot;
    const itemId = target.dataset.itemId;
    const spell = RC.spells.find((entry) => spellKey(entry) === target.dataset.spellKey);
    const item = itemId ? this.actor.items.get(itemId) : null;
    if (!spell && item?.type !== "spell") {
      ui.notifications.warn(game.i18n.localize("BECMI.notification.spellImportFailed"));
      return;
    }

    if (slot) {
      const used = { ...(this.actor.system.spellbook?.used ?? {}) };
      if (!used[slot]) {
        used[slot] = true;
        await this.actor.update({ "system.spellbook.used": used });
      }
    }

    if (item?.type === "spell") {
      await item.castSpell();
      return;
    }
    const escape = (value) => foundry.utils.escapeHTML(String(value ?? ""));
    const details = [
      ["Range", spell.range], ["Duration", spell.duration], ["Effect", spell.effect],
      spell.save ? ["Save", spell.save] : null, spell.reverse ? ["Reverse", spell.reverse] : null
    ].filter(Boolean).map(([label, value]) => `<p><strong>${label}:</strong> ${escape(value)}</p>`).join("");
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      flavor: `Spell — ${escape(spell.name)}`,
      content: `<div class="becmi-roll-card"><h3 class="becmi-roll-card__title">${escape(spell.name)}</h3>${details}</div>`
    });
  }

  static async #itemCast(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (item?.type === "spell") await item.castSpell();
  }

  static async #memorizeSpell(event, target) {
    if (!this.isEditable || !this.editMode) return;
    const itemId = target.dataset.itemId;
    const item = itemId ? this.actor.items.get(itemId) : null;
    const key = item ? `item:${item.id}` : target.dataset.spellKey;
    const spell = item ?? RC.spells.find((entry) => spellKey(entry) === key);
    if (!spell) {
      ui.notifications.warn(game.i18n.localize("BECMI.notification.spellImportFailed"));
      return;
    }
    const level = Number(spell.system?.spellLevel ?? spell.level) || 0;
    if (!level) return;
    const slotClass = this.spellClassKey
      ?? normalizeClassKey(this.actor.system.attributes?.classKey || this.actor.system.attributes?.class);
    const slotLevel = Number(this.spellLevel ?? this.actor.system.attributes?.level) || 1;
    const slots = spellSlotsForLevel(slotClass, slotLevel);
    const memorized = { ...(this.actor.system.spellbook?.memorized ?? {}) };
    for (let slot = 1; slot <= (slots[level - 1] ?? 0); slot++) {
      const field = `${level}_${slot}`;
      if (!memorized[field]) {
        memorized[field] = key;
        await this.actor.update({ "system.spellbook.memorized": memorized });
        return;
      }
    }
    ui.notifications.warn(game.i18n.localize("BECMI.notification.noSpellSlot"));
  }

  static async #toggleMastery() {
    if (!this.isEditable || !this.editMode) {
      ui.notifications.warn(game.i18n.localize("BECMI.notification.editModeRequired"));
      return;
    }
    const enabled = !Boolean(this.actor.system.mastery?.enabled);
    await this.actor.update({ "system.mastery.enabled": enabled });
  }

  static async #addMasteryRow() {
    if (!this.isEditable || !this.editMode) return;
    const rows = [...(this.actor.system.mastery?.rows ?? []), { name: "", grade: "sem", primary: "H", target: "prim" }];
    await this.actor.update({ "system.mastery.rows": rows });
  }

  static async #itemAttack(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    await item?.rollAttack({ targetAC: this.#targetAC() });
  }

  static async #itemDamage(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    await item?.rollDamage();
  }

  static async #itemFormula(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    await item?.rollFormula();
  }

  static async #itemOpen(event, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    if (item?.sheet) item.sheet.render(true);
  }

  static async #itemDelete(event, target) {
    if (!this.isEditable || !this.editMode) return;
    const item = this.actor.items.get(target.dataset.itemId);
    await item?.delete();
  }

  static async #addItem() {
    if (!this.isEditable || !this.editMode) return;
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
