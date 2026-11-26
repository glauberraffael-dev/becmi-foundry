/**
 * Automatic compendium-to-sheet integrations.
 *
 * Applying a Character Class item to an Actor fills the class/XP fields and
 * keeps a snapshot of the class data in a flag. The snapshot is used to keep
 * "Next Level XP" in sync when the level changes and to filter the spell list.
 */

const CLASS_SPELL_LISTS = {
  cleric: ["cleric"],
  "magic-user": ["magic-user"],
  elf: ["magic-user"]
};

/**
 * Curated dice formulas for legacy owned spells imported before the compendium
 * carried `system.rollFormula`. Names are lowercased for a stable lookup.
 */
export const SPELL_FORMULA_FALLBACKS = Object.freeze({
  sleep: "2d8",
  "snake charm": "1d4 + 1",
  "cure disease": "2d12",
  barrier: "7d10",
  "holy word": "2d10",
  restore: "2d10",
  "mirror image": "1d4",
  "hold monster": "1d4",
  "lower water": "1d12 + 20",
  "power word blind": "1d4",
  gate: "1d10 * 10",
  timestop: "1d4 + 1",
  fireball: "@level d6",
  "lightning bolt": "@level d6",
  "cure serious wounds": "2d6 + 2",
  "cure critical wounds": "3d6 + 3",
  "sticks to snakes": "2d8",
  "call lightning": "8d6",
  web: "2d4",
  "wall of stone": "10d10",
  "death spell": "4d8",
  "power word stun": "2d6"
});

export function spellFormulaFor(name) {
  return SPELL_FORMULA_FALLBACKS[String(name ?? "").toLocaleLowerCase("en")] ?? "";
}

const CLASS_FLAG = "flags.becmi.classInfo";

function getProperty(object, path) {
  return foundry.utils.getProperty(object, path);
}

function setProperty(object, path, value) {
  const keys = String(path).split(".");
  let target = object;
  for (let index = 0; index < keys.length - 1; index++) {
    target[keys[index]] ??= {};
    target = target[keys[index]];
  }
  target[keys.at(-1)] = value;
}

/** Remove a path from an update, whether it is flat or nested. */
function deleteProperty(object, path) {
  if (!object || typeof object !== "object") return;
  // Foundry normally sends flat dotted keys, but macros may pass a nested tree.
  if (Object.hasOwn(object, path)) {
    delete object[path];
    return;
  }
  const keys = String(path).split(".");
  if (keys.length === 1) {
    delete object[keys[0]];
    return;
  }
  deleteProperty(object[keys[0]], keys.slice(1).join("."));
  if (object[keys[0]] && !Object.keys(object[keys[0]]).length) delete object[keys[0]];
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

import {
  RC, adjustment, getRCClass, hpForLevel, levelForXp, monsterHpFromHitDice,
  normalizeClassKey, parseMonsterHitDice, spellKey
} from "./rules-rc.mjs";

export function spellListsForClass(classInfo, { druid = false } = {}) {
  const name = String(classInfo?.name ?? "").toLowerCase();
  const lists = CLASS_SPELL_LISTS[name] ? [...CLASS_SPELL_LISTS[name]] : [];
  if (druid && name === "cleric" && !lists.includes("druid")) lists.push("druid");
  return lists;
}

export function xpForLevel(classInfo, level) {
  const table = classInfo?.xpTable ?? {};
  const direct = Number(table[String(level)]);
  if (Number.isFinite(direct)) return direct;

  const max = Number(classInfo?.maxLevel) || 36;
  const capped = Number(table[String(max)]);
  return Number.isFinite(capped) ? capped : 0;
}

function classSnapshot(item) {
  const system = item.system ?? {};
  return {
    uuid: item.flags?.core?.sourceId ?? item.uuid ?? "",
    name: item.name ?? "",
    key: normalizeClassKey(item.name) ?? "",
    hitDice: system.hitDice ?? "",
    maxLevel: Number(system.maxLevel) || getRCClass(item.name)?.maxLevel || 36,
    primeRequisite: system.primeRequisite ?? "",
    requirements: system.requirements ?? "",
    description: system.description ?? "",
    xpTable: clone(system.xpTable ?? {}),
    saves: clone(system.saves ?? {})
  };
}

/** Snapshot for a class chosen straight from the sheet's class selector. */
export function classInfoFromRC(name) {
  const rc = getRCClass(name);
  if (!rc) return null;
  return {
    uuid: "",
    name: rc.name,
    key: rc.key,
    hitDice: `1d${rc.hitDie}`,
    maxLevel: rc.maxLevel,
    xp: rc.xp,
    xpTable: {},
    saves: rc.saves
  };
}

function classInfoFor(actor) {
  const stored = getProperty(actor, CLASS_FLAG);
  if (stored) return stored;
  const item = actor.items?.find((entry) => entry.type === "class");
  if (item) return classSnapshot(item);

  // Actors created from the sheet class selector have no Class item. The RC
  // table is still enough to drive auto-level and the "Level Up" button.
  const name = getProperty(actor, "system.attributes.class")
    || getProperty(actor, "system.attributes.classKey");
  return classInfoFromRC(name);
}

function changesFor(actor, values) {
  const changes = {};
  for (const [path, value] of Object.entries(values)) {
    if (JSON.stringify(getProperty(actor, path)) !== JSON.stringify(value)) changes[path] = value;
  }
  return changes;
}

/** Remove extra class items so an Actor never has two competing classes. */
export async function dedupeActorClasses(actor, keepId = null) {
  const classes = actor.items.filter((item) => item.type === "class");
  if (classes.length < 2) return 0;

  const keep = classes.find((item) => item.id === keepId) ?? classes[0];
  const extra = classes.filter((item) => item.id !== keep.id);
  if (extra.length) await actor.deleteEmbeddedDocuments("Item", extra.map((item) => item.id));
  return extra.length;
}

/** Apply a Class item to an Actor and populate the derived sheet fields. */
export async function applyClassToActor(actor, classItem) {
  if (!actor || !classItem || classItem.type !== "class") return 0;

  const snapshot = classSnapshot(classItem);
  const changes = changesFor(actor, {
    "system.attributes.class": snapshot.name,
    "system.attributes.classKey": normalizeClassKey(snapshot.name) ?? "",
    "system.attributes.classUuid": snapshot.uuid,
    "system.attributes.hd": snapshot.hitDice,
    "system.attributes.primeRequisite": snapshot.primeRequisite,
    [CLASS_FLAG]: snapshot
  });
  if (Object.keys(changes).length) await actor.update(changes);
  return dedupeActorClasses(actor, classItem.id);
}

/** Druid is a Cleric extension: mark the Cleric actor and enable its spell list. */
export async function applyDruidFeatureToActor(actor, item) {
  if (!actor || String(item?.name ?? "").toLowerCase() !== "druid") return 0;
  const classKey = normalizeClassKey(getProperty(actor.system, "attributes.classKey")
    || getProperty(actor.system, "attributes.class"));
  const changes = { "flags.becmi.druid": true };
  if (!classKey) {
    Object.assign(changes, {
      "system.attributes.class": "Cleric",
      "system.attributes.classKey": "cleric",
      "system.attributes.hd": "1d6"
    });
  }
  const needed = changesFor(actor, changes);
  if (Object.keys(needed).length) await actor.update(needed);
  return Object.keys(needed).length;
}

const spellSourceUuid = (item) => String(
  item?.flags?.becmi?.sourceUuid ?? item?.flags?.core?.sourceId ?? item?.uuid ?? ""
);

function spellSignature(item) {
  const lists = Array.isArray(item?.system?.spellLists) ? [...item.system.spellLists] : [];
  return [
    String(item?.name ?? "").toLocaleLowerCase("en"),
    Number(item?.system?.spellLevel) || 0,
    [...new Set(lists)].sort().join("+")
  ].join("|");
}

/** Build safe embedded Item data from a compendium spell or RC spell record. */
export function spellItemData(spell) {
  const source = typeof spell?.toObject === "function" ? spell.toObject() : spell;
  const data = clone(source) ?? {};
  const uuid = spellSourceUuid(source) || spellSourceUuid(spell);
  delete data._id;
  delete data.folder;
  delete data.ownership;
  delete data.sort;
  data.type = "spell";
  data.name = String(data.name ?? spell?.name ?? "");
  data.system = { ...(data.system ?? {}) };

  const list = data.flags?.becmi?.list ?? data.system.spellLists?.[0];
  if (!data.system.spellLists?.length && list) data.system.spellLists = [list];
  if (!data.system.rollFormula) {
    const formula = spellFormulaFor(data.name);
    if (formula) data.system.rollFormula = formula;
  }
  data.flags = { ...(data.flags ?? {}), becmi: { ...(data.flags?.becmi ?? {}) } };
  if (uuid) data.flags.becmi.sourceUuid = uuid;
  else delete data.flags.becmi.sourceUuid;
  return data;
}

/**
 * Import a spell onto an Actor without duplicating an already-known spell.
 * Returns the outcome so the sheet can show the right notification.
 */
export async function importSpellToActor(actor, spell) {
  if (!actor || !spell) return { status: "invalid", item: null };
  const data = spellItemData(spell);
  if (!data.name) return { status: "invalid", item: null };

  const uuid = spellSourceUuid(data);
  const signature = spellSignature(data);
  const existing = (actor.items ?? []).find((item) => item.type === "spell" && (
    (uuid && spellSourceUuid(item) === uuid) || spellSignature(item) === signature
  ));
  if (existing) return { status: "duplicate", item: existing };

  const created = await actor.createEmbeddedDocuments?.("Item", [data]);
  if (!created?.length) return { status: "failed", item: null };
  return { status: "imported", item: created[0] };
}

/**
 * Make an imported compendium spell immediately memorizable by adding its RC
 * grimoire key. The compendium uses English names; the grimoire uses the
 * Portuguese-derived RC key, so the two need an explicit bridge.
 */
export async function syncGrimoireFromImportedSpell(actor, spell) {
  if (!actor || !spell) return false;
  const name = String(spell.name ?? spell.system?.name ?? "").trim().toLowerCase();
  const level = Number(spell.system?.spellLevel ?? spell.system?.level) || 0;
  const lists = spell.system?.spellLists ?? [];
  const rc = RC.spells.find((entry) =>
    String(entry.name).trim().toLowerCase() === name
    && Number(entry.level) === level
    && (!lists.length || lists.includes(entry.class))
  ) ?? RC.spells.find((entry) => String(entry.name).trim().toLowerCase() === name && Number(entry.level) === level);
  if (!rc) return false;
  const key = spellKey(rc);
  const current = String(getProperty(actor, "system.spellbook.grimoire") ?? "");
  const keys = current.split(",").map((value) => value.trim()).filter(Boolean);
  if (keys.includes(key)) return false;
  keys.push(key);
  await actor.update({ "system.spellbook.grimoire": keys.join(",") });
  return true;
}

/** Re-derive XP and remove duplicates from an Actor that already has a class. */
export async function refreshActorFromClass(actor) {
  const classes = actor.items.filter((item) => item.type === "class");
  const removed = await dedupeActorClasses(actor);
  const snapshot = getProperty(actor, CLASS_FLAG);
  if (!snapshot && !classes.length) return removed;

  const source = snapshot ?? classSnapshot(classes[0]);
  const changes = changesFor(actor, { [CLASS_FLAG]: source });
  if (Object.keys(changes).length) await actor.update(changes);
  return removed;
}

/**
 * Advance an Actor to the level dictated by its XP, adding HP once per level.
 *
 * The class snapshot is the single source of truth, so the sheet button and the
 * automatic XP hook cannot diverge. Returns the number of levels gained.
 */
export async function advanceActorLevels(actor, { targetLevel, announce = true } = {}) {
  const info = classInfoFor(actor);
  if (!actor || !info) return 0;

  const current = Math.max(1, Number(getProperty(actor.system, "attributes.level")) || 1);
  const max = Math.max(1, Number(info.maxLevel) || getRCClass(info.name)?.maxLevel || 36);
  const requested = targetLevel === undefined
    ? levelForXp(info, Number(getProperty(actor.system, "attributes.xp")) || 0, current)
    : Number(targetLevel);
  const target = Math.max(current, Math.min(max, Number(requested) || current));
  if (target <= current) return 0;

  const classKey = normalizeClassKey(info.key || info.name) || info.key || "";
  const conScore = Number(getProperty(actor.system, "abilities.con.value"));
  const conAdj = Number.isFinite(conScore) ? adjustment(conScore) ?? 0
    : Number(getProperty(actor.system, "attributes.adjustments.con")) || 0;
  const hp = { ...(getProperty(actor.system, "attributes.hp") ?? { value: 0, max: 0 }) };

  for (let level = current + 1; level <= target; level++) {
    const gain = hpForLevel(classKey || info.name, level, conAdj).gain;
    hp.max = Number(hp.max || 0) + gain;
    hp.value = Number(hp.value || 0) + gain;
  }

  const changes = {
    "system.attributes.level": target,
    "system.attributes.hp": hp
  };
  const needed = changesFor(actor, changes);
  if (Object.keys(needed).length) await actor.update(needed);

  if (announce && globalThis.ui?.notifications?.info && target > current) {
    ui.notifications.info(game.i18n.format("BECMI.notification.autoLevel", {
      actor: actor.name ?? "",
      level: target
    }));
  }
  return target - current;
}

/** Recalculate the level whenever XP changes; used by the automatic hook. */
export function autoLevelFromXp(actor, options = {}) {
  if (!actor) return Promise.resolve(0);
  const info = classInfoFor(actor);
  if (!info) return Promise.resolve(0);
  const current = Math.max(1, Number(getProperty(actor.system, "attributes.level")) || 1);
  const target = levelForXp(info, Number(getProperty(actor.system, "attributes.xp")) || 0, current);
  return advanceActorLevels(actor, { ...options, targetLevel: target });
}

/** Register the Foundry hooks that drive the integrations. */
export function registerIntegrations() {
  // Every Actor type tracks current HP through attributes.hp.value, which is
  // also the token bar. The bar can then be edited straight from the token HUD.
  Hooks.on("preCreateActor", (actor, data) => {
    if (!["character", "npc", "monster"].includes(actor.type)) return;
    const path = "prototypeToken.bar1.attribute";
    if (getProperty(data, path) === "attributes.hp.value") return;
    setProperty(data, path, "attributes.hp.value");
    // Mutating the creation data is enough in Foundry's preCreate hooks; the
    // prototype token then exposes the very same path used by the sheet.
  });

  Hooks.on("createItem", (item, options, userId) => {
    if (game.userId !== userId) return;
    const actor = item.parent;
    if (actor?.documentName !== "Actor") return;
    if (item.type === "class") {
      applyClassToActor(actor, item).catch((err) => console.error("BECMI | applyClassToActor", err));
    } else if (item.type === "feature") {
      applyDruidFeatureToActor(actor, item).catch((err) => console.error("BECMI | applyDruidFeatureToActor", err));
    }
  });

  const leveling = new WeakSet();
  Hooks.on("updateActor", (actor, changed, options, userId) => {
    if (game.userId !== userId) return;
    if (getProperty(changed, "system.attributes.xp") === undefined) return;
    if (leveling.has(actor)) return;
    leveling.add(actor);
    Promise.resolve(autoLevelFromXp(actor))
      .catch((err) => console.error("BECMI | autoLevelFromXp", err))
      .finally(() => leveling.delete(actor));
  });

  // xpNext is a derived display field. Strip any attempt to write it, including
  // updates from macros or other modules, so the level-up table cannot drift.
  Hooks.on("preUpdateActor", (_actor, changed) => {
    deleteProperty(changed, "system.attributes.xpNext");
  });

  Hooks.on("createActor", (actor, options, userId) => {
    if (game.userId !== userId) return;
    if (actor.type === "monster") {
      repairMonsterHitPoints(actor).catch((err) => console.error("BECMI | repairMonsterHitPoints", err));
    }
    const classItem = actor.items.find((item) => item.type === "class");
    if (classItem) {
      applyClassToActor(actor, classItem).catch((err) => console.error("BECMI | applyClassToActor", err));
    }
    const druidItem = actor.items.find((item) => item.type === "feature" && String(item.name).toLowerCase() === "druid");
    if (druidItem) {
      applyDruidFeatureToActor(actor, druidItem).catch((err) => console.error("BECMI | applyDruidFeatureToActor", err));
    }
  });

  Hooks.once("ready", () => {
    for (const actor of game.actors) {
      if (actor.type === "monster") repairMonsterHitPoints(actor);
      repairSpellFormulas(actor).catch((err) => console.error("BECMI | repairSpellFormulas", err));
      refreshActorFromClass(actor).catch((err) => console.error("BECMI | refreshActorFromClass", err));
    }
  });
}

/** Fill blank dice formulas on spells imported before the compendium fix. */
export async function repairSpellFormulas(actor) {
  const updates = [];
  for (const item of actor?.items ?? []) {
    if (item.type !== "spell" || item.system?.rollFormula) continue;
    const formula = spellFormulaFor(item.name);
    if (!formula) continue;
    updates.push({ _id: item.id, "system.rollFormula": formula });
  }
  if (!updates.length || typeof actor?.updateEmbeddedDocuments !== "function") return 0;
  await actor.updateEmbeddedDocuments("Item", updates);
  return updates.length;
}

/**
 * Older compendium entries stored the HD number as hit points. Repair only
 * values that still look like that mistake; never overwrite a rolled total.
 */
export async function repairMonsterHitPoints(actor) {
  if (getProperty(actor.flags, "becmi.exactHp")) return 0;
  const hd = String(getProperty(actor.system, "hd") ?? "");
  const parsed = parseMonsterHitDice(hd);
  if (parsed.kind === "fraction" || parsed.kind === "unknown") return 0;
  const current = Number(getProperty(actor.system, "hp"));
  const expected = monsterHpFromHitDice(hd);
  if (!Number.isFinite(current) || expected === current) return 0;
  // The old export wrote either the HD count (8) or the digits glued together
  // (3+1 -> 31). Anything else is a real rolled total and must be preserved.
  const glued = Number(hd.replace(/\s/g, "").replace(/\D/g, ""));
  const suspect = current === parsed.count || (Number.isFinite(glued) && current === glued);
  if (!suspect) return 0;
  await actor.update({
    "system.hp": expected,
    "system.attributes.hp": { value: expected, max: expected }
  });
  return 1;
}
