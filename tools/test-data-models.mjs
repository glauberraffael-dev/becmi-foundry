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
