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
