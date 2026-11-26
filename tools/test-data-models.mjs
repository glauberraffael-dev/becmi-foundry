/**
 * Foundry-independent smoke test for the TypeDataModel schemas.
 *
 * It stubs the DataField constructors so a typo such as `new fields()` is
 * caught here instead of breaking world launch inside Foundry.
 *
 * Usage: node tools/test-data-models.mjs
 */
class DataField {
  constructor(options = {}) {
    this.options = options;
  }
}

globalThis.foundry = {
  data: {
    fields: {
      SchemaField: class extends DataField {},
      NumberField: class extends DataField {},
      StringField: class extends DataField {},
      BooleanField: class extends DataField {},
      ArrayField: class extends DataField {
        constructor(element, options = {}) {
          super(options);
          this.element = element;
        }
      },
      ObjectField: class extends DataField {},
      HTMLField: class extends DataField {}
    }
  },
  abstract: {
    TypeDataModel: class {
      static defineSchema() {
        return {};
      }
      prepareDerivedData() {}
    }
  }
};

globalThis.Actor = class {
  prepareDerivedData() {}
  getRollData() {
    return {};
  }
};

const actorModels = await import("../scripts/data/actor.mjs");
const itemModels = await import("../scripts/data/item.mjs");

let checked = 0;
for (const module of [actorModels, itemModels]) {
  for (const [name, model] of Object.entries(module)) {
    if (typeof model !== "function" || !model.defineSchema) continue;
    const schema = model.defineSchema();
    if (!schema || typeof schema !== "object") throw new Error(`${name}.defineSchema() returned no schema`);
    checked++;
  }
}

if (checked < 10) throw new Error(`Only ${checked} data models were checked`);
console.log(`Data model schemas OK (${checked} models).`);

// ArrayField initial values must be plain data, not SchemaField definitions.
const characterSchema = actorModels.CharacterData.defineSchema();
const magicItems = characterSchema.magicItems.options.initial;
if (!Array.isArray(magicItems) || magicItems.length !== 10) {
  throw new Error("magicItems must start with 10 plain rows");
}
for (const row of magicItems) {
  if (typeof row.equipped !== "boolean" || row.equipped !== false) {
    throw new Error("magicItems initial row must contain equipped: false");
  }
}
console.log("magicItems initial rows OK.");

// Name-level choices are persistent actor data, not a temporary sheet state.
const nameLevel = characterSchema.nameLevel;
if (!nameLevel?.options || !nameLevel.options.path || !nameLevel.options.specialization) {
  throw new Error("CharacterData must expose persistent name-level path/specialization fields");
}
for (const key of ["hirelings", "avengerSpellLevels"]) {
  if (!nameLevel.options[key]) throw new Error(`CharacterData.nameLevel.${key} is missing`);
}
console.log("Name-level schema fields OK.");

// Equipment bonuses are item data, not a manual actor AC/save bar.
const itemSchema = itemModels.ArmorData.defineSchema();
for (const key of ["equipped", "acBonus", "saveBonuses"]) {
  if (!itemSchema[key]) throw new Error(`ItemData.${key} is missing`);
}
const equipmentSchema = itemModels.EquipmentData.defineSchema();
if (!equipmentSchema.acBonus || !equipmentSchema.saveBonuses) {
  throw new Error("EquipmentData must expose AC and save bonuses");
}
for (const key of ["deathRay", "magicWand", "paralysis", "breath", "spells"]) {
  if (!itemSchema.saveBonuses.options[key]) throw new Error(`ItemData.saveBonuses.${key} is missing`);
}
const saveDetail = actorModels.CharacterData.defineSchema().saveDetail;
if (!saveDetail?.options?.deathRay?.options?.item) {
  throw new Error("CharacterData.saveDetail must expose derived item bonuses");
}
console.log("Equipment bonus schema fields OK.");

// Weapon mastery is an opt-in switch on every character, never a class-only tab.
const mastery = characterSchema.mastery?.options;
if (!mastery?.enabled || mastery.enabled.options.initial !== false
  || !mastery.rows || !Array.isArray(mastery.rows.options.initial)
  || mastery.rows.element?.options?.primary?.options?.initial !== "H") {
  throw new Error("CharacterData.mastery must default to disabled with plain mastery rows");
}
console.log("Optional mastery schema fields OK.");

// General skills are opt-in, catalog-backed and derive their slot budget.
const general = characterSchema.generalSkills?.options;
if (!general?.enabled || general.enabled.options.initial !== false
  || !general.rows || !general.slots || !general.used) {
  throw new Error("CharacterData.generalSkills must be an opt-in rule with derived slots");
}
console.log("Optional general-skill schema fields OK.");

const saves = Object.fromEntries(["deathRay", "magicWand", "paralysis", "breath", "spells"]
  .map((key) => [key, { base: 10, auto: 0, mod: 0, item: 0, target: 10 }]));
const generalActor = {
  attributes: {
    classKey: "fighter", level: 5, xp: 1000, xpNext: 0,
    adjustments: { dex: 0, wis: 0 },
    ac: { base: 9, value: 9 }, armor: { type: "nenhuma", shield: false },
    gold: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
    load: { equipment: 0, gems: 0, jewels: 0, weapons: 0 },
    movement: {}, savingThrows: {}, thac0: 19
  },
  abilities: { int: { value: 14 }, dex: { value: 10 }, wis: { value: 10 } },
  saves: Object.fromEntries(Object.keys(saves).map((key) => [key, 10])),
  saveDetail: structuredClone(saves),
  thiefSkills: {
    pickPockets: 0, openLocks: 0, findTraps: 0, removeTraps: 0, climbWalls: 0,
    moveSilently: 0, hideInShadows: 0, hearNoise: 0, backstab: 0
  },
  generalSkills: {
    enabled: true, slots: 4, used: 0,
    rows: { tracking: { trained: true, modifier: 1, note: "forest" }, bogus: { trained: true } }
  },
  magicItems: []
};
actorModels.CharacterData.prototype.prepareDerivedData.call(generalActor);
if (generalActor.generalSkills.slots !== 6 || generalActor.generalSkills.used !== 1) {
  throw new Error(`general skill slots must derive from INT and level, got ${JSON.stringify(generalActor.generalSkills)}`);
}
if ("bogus" in generalActor.generalSkills.rows) {
  throw new Error("unknown general skills must not survive preparation");
}
console.log("General skills derive slots and discard unknown rows OK.");

// Monster-like actors have no system.attributes.ac; preparation must not throw.
const { BECMIActor } = await import("../scripts/documents/actor.mjs");
const withoutAc = new BECMIActor();
withoutAc.system = { attributes: { hp: { value: 1, max: 1 } } };
withoutAc.prepareDerivedData();

const withAc = new BECMIActor();
withAc.system = {
  attributes: {
    ac: { base: 9, value: undefined },
    armor: { type: "malha", shield: true },
    adjustments: { dex: 1 }
  },
  magicItems: []
};
withAc.items = [{ type: "armor", system: { equipped: true, acBonus: -1 } }];
withAc.prepareDerivedData();
// Chain mail (5), shield (-1), DEX adjustment (+1), item (-1 AC).
if (withAc.system.attributes.ac.value !== 4) {
  throw new Error(`Derived AC expected 4, got ${withAc.system.attributes.ac.value}`);
}
console.log("Actor prepareDerivedData OK (with and without AC).");

// Monster saves are derived from the RC stat block, not left at the schema
// default of 10. Ambiguous OCR text falls back to its first readable class.
const monster = {
  hd: "7",
  hp: 32,
  saveAs: "F7",
  saves: { deathRay: 10, magicWand: 10, paralysis: 10, breath: 10, spells: 10 },
  attributes: { hp: { value: 31, max: 0 }, thac0: 19 }
};
actorModels.MonsterData.prototype.prepareDerivedData.call(monster);
const expectedSaves = { deathRay: 8, magicWand: 9, paralysis: 10, breath: 11, spells: 12 };
for (const [key, value] of Object.entries(expectedSaves)) {
  if (monster.saves[key] !== value) {
    throw new Error(`Monster save ${key} expected ${value}, got ${monster.saves[key]}`);
  }
}
if (monster.attributes.hp.max !== 32 || monster.attributes.hp.value !== 31) {
  throw new Error("Monster HP mirror was not derived from the HD-based HP");
}
monster.saveAs = "F7 F21 F36";
actorModels.MonsterData.prototype.prepareDerivedData.call(monster);
if (monster.saves.deathRay !== 8) {
  throw new Error("Ambiguous monster Save As did not fall back to its first class");
}
console.log("MonsterData derives saving throws and HP mirror OK.");
