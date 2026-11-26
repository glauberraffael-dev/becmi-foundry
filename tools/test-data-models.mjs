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

// Weapon mastery is an opt-in switch on every character, never a class-only tab.
const mastery = characterSchema.mastery?.options;
if (!mastery?.enabled || mastery.enabled.options.initial !== false
  || !mastery.rows || !Array.isArray(mastery.rows.options.initial)
  || mastery.rows.element?.options?.primary?.options?.initial !== "H") {
  throw new Error("CharacterData.mastery must default to disabled with plain mastery rows");
}
console.log("Optional mastery schema fields OK.");

// Monster-like actors have no system.attributes.ac; preparation must not throw.
const { BECMIActor } = await import("../scripts/documents/actor.mjs");
const withoutAc = new BECMIActor();
withoutAc.system = { attributes: { hp: { value: 1, max: 1 } } };
withoutAc.prepareDerivedData();

const withAc = new BECMIActor();
withAc.system = {
  attributes: {
    ac: { base: 9, value: undefined },
    acBonus: 1,
    armor: { type: "malha", shield: true, magicBonus: 0, shieldMagic: 0 },
    adjustments: { dex: 1 }
  }
};
withAc.prepareDerivedData();
// Chain mail (5), shield (-1), DEX adjustment (-1), item bonus (-1).
if (withAc.system.attributes.ac.value !== 2) {
  throw new Error(`Derived AC expected 2, got ${withAc.system.attributes.ac.value}`);
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
