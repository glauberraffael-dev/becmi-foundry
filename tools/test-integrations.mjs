/**
 * Foundry-independent smoke test for the compendium-to-sheet integrations.
 *
 * Usage: node tools/test-integrations.mjs
 */
function getProperty(object, path) {
  return String(path).split(".").reduce((value, key) => value?.[key], object);
}

function setProperty(object, path, value) {
  const keys = String(path).split(".");
  let target = object;
  for (let i = 0; i < keys.length - 1; i++) {
    target[keys[i]] ??= {};
    target = target[keys[i]];
  }
  target[keys.at(-1)] = value;
}

globalThis.foundry = { utils: { getProperty } };

const {
  xpForLevel,
  spellListsForClass,
  dedupeActorClasses,
  applyClassToActor,
  applyDruidFeatureToActor,
  advanceActorLevels,
  autoLevelFromXp
} = await import("../scripts/integrations.mjs");

const xpTable = { 1: 2, 2: 2500, 3: 5000, 36: 4350000 };
const magicUser = { name: "Magic-User", maxLevel: 36, xpTable };

if (xpForLevel(magicUser, 2) !== 2500) throw new Error("xpForLevel(level 2) failed");
if (xpForLevel(magicUser, 37) !== 4350000) throw new Error("xpForLevel above max failed");
if (spellListsForClass(magicUser)[0] !== "magic-user") throw new Error("Magic-User spell list failed");
if (spellListsForClass({ name: "Elf" })[0] !== "magic-user") throw new Error("Elf spell list failed");
if (spellListsForClass({ name: "Fighter" }).length !== 0) throw new Error("Fighter should have no spells");
if (spellListsForClass({ name: "Druid" }).length !== 0) throw new Error("Druid is not a stand-alone class");
if (spellListsForClass({ name: "Cleric" }).join() !== "cleric") throw new Error("Cleric spell list failed");
if (spellListsForClass({ name: "Cleric" }, { druid: true }).join() !== "cleric,druid") throw new Error("Druid extension failed");

const actor = {
  system: { attributes: { level: 1, xpNext: 0 } },
  flags: {},
  items: [
    { id: "old", type: "class", name: "Magic-User", system: { xpTable } },
    { id: "new", type: "class", name: "Magic-User", system: { xpTable } },
    { id: "spell", type: "spell", name: "Magic Missile", system: {} }
  ],
  async update(changes) {
    for (const [path, value] of Object.entries(changes)) setProperty(this, path, value);
  },
  async deleteEmbeddedDocuments(type, ids) {
    this.items = this.items.filter((item) => !ids.includes(item.id));
  }
};

const removed = await applyClassToActor(actor, actor.items.find((item) => item.id === "old"));
if (removed !== 1) throw new Error("applyClassToActor did not remove the duplicate");
if (getProperty(actor, "system.attributes.xpNext") !== 2500) throw new Error("xpNext was not filled");
if (getProperty(actor, "flags.becmi.classInfo.name") !== "Magic-User") throw new Error("class snapshot missing");
actor.items.push({ id: "copy", type: "class", name: "Magic-User", system: { xpTable } });
if (await dedupeActorClasses(actor) !== 1) throw new Error("duplicate class was not removed");

const cleric = {
  system: { attributes: { level: 1, class: "Cleric", classKey: "cleric" } },
  flags: {},
  async update(changes) {
    for (const [path, value] of Object.entries(changes)) setProperty(this, path, value);
  }
};
if (await applyDruidFeatureToActor(cleric, { name: "Druid", type: "feature" }) !== 1) {
  throw new Error("Druid feature was not applied");
}
if (getProperty(cleric, "flags.becmi.druid") !== true) throw new Error("Druid flag missing");
if (getProperty(cleric, "system.attributes.classKey") !== "cleric") throw new Error("Druid lost the Cleric class");

const leveling = {
  name: "Test Adventurer",
  system: {
    abilities: { con: { value: 14 } },
    attributes: { level: 1, xp: 5000, xpNext: 2000, hp: { value: 8, max: 8 } }
  },
  flags: { becmi: { classInfo: { name: "Fighter", key: "fighter", maxLevel: 36, xpTable } } },
  items: [],
  async update(changes) {
    for (const [path, value] of Object.entries(changes)) setProperty(this, path, value);
  }
};
const gained = await autoLevelFromXp(leveling, { announce: false });
if (gained !== 2) throw new Error(`autoLevelFromXp should gain 2 levels, got ${gained}`);
if (getProperty(leveling, "system.attributes.level") !== 3) throw new Error("level was not advanced");
if (getProperty(leveling, "system.attributes.hp.max") <= 8) throw new Error("HP was not added on level up");
if (getProperty(leveling, "system.attributes.xpNext") !== 8000) throw new Error("xpNext was not advanced");
if (await autoLevelFromXp(leveling, { announce: false }) !== 0) throw new Error("level up repeated without new XP");
leveling.system.attributes.xp = 8000;
if (await autoLevelFromXp(leveling, { announce: false }) !== 1) throw new Error("new XP did not advance the level");
if (await advanceActorLevels(leveling, { targetLevel: 2, announce: false }) !== 0) {
  throw new Error("manual level downgrade must be ignored");
}

console.log("Integrations OK (class apply, XP, spell lists, dedupe, druid, auto level).");
