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
  druid: ["druid"],
  elf: ["magic-user"]
};

const CLASS_FLAG = "flags.becmi.classInfo";

function getProperty(object, path) {
  return foundry.utils.getProperty(object, path);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function spellListsForClass(classInfo) {
  const name = String(classInfo?.name ?? "").toLowerCase();
  return CLASS_SPELL_LISTS[name] ? [...CLASS_SPELL_LISTS[name]] : [];
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
    hitDice: system.hitDice ?? "",
    maxLevel: Number(system.maxLevel) || 36,
    primeRequisite: system.primeRequisite ?? "",
    requirements: system.requirements ?? "",
    xpTable: clone(system.xpTable ?? {}),
    saves: clone(system.saves ?? {})
  };
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
  const level = Number(getProperty(actor.system, "attributes.level")) || 1;
  const changes = changesFor(actor, {
    "system.attributes.class": snapshot.name,
    "system.attributes.classUuid": snapshot.uuid,
    "system.attributes.hd": snapshot.hitDice,
    "system.attributes.primeRequisite": snapshot.primeRequisite,
    "system.attributes.xpNext": xpForLevel(snapshot, level + 1),
    [CLASS_FLAG]: snapshot
  });
  if (Object.keys(changes).length) await actor.update(changes);
  return dedupeActorClasses(actor, classItem.id);
}

/** Re-derive XP and remove duplicates from an Actor that already has a class. */
export async function refreshActorFromClass(actor) {
  const classes = actor.items.filter((item) => item.type === "class");
  const removed = await dedupeActorClasses(actor);
  const snapshot = getProperty(actor, CLASS_FLAG);
  if (!snapshot && !classes.length) return removed;

  const source = snapshot ?? classSnapshot(classes[0]);
  const level = Number(getProperty(actor.system, "attributes.level")) || 1;
  const changes = changesFor(actor, {
    "system.attributes.xpNext": xpForLevel(source, level + 1),
    [CLASS_FLAG]: source
  });
  if (Object.keys(changes).length) await actor.update(changes);
  return removed;
}

/** Register the Foundry hooks that drive the integrations. */
export function registerIntegrations() {
  Hooks.on("createItem", (item, options, userId) => {
    if (game.userId !== userId || item.type !== "class") return;
    const actor = item.parent;
    if (actor?.documentName !== "Actor") return;
    applyClassToActor(actor, item).catch((err) => console.error("BECMI | applyClassToActor", err));
  });

  Hooks.on("preUpdateActor", (actor, changed) => {
    const level = getProperty(changed, "system.attributes.level");
    if (level === undefined || getProperty(changed, "system.attributes.xpNext") !== undefined) return;
    const snapshot = getProperty(actor, CLASS_FLAG);
    if (!snapshot) return;
    changed["system.attributes.xpNext"] = xpForLevel(snapshot, Number(level) + 1);
  });

  Hooks.on("createActor", (actor, options, userId) => {
    if (game.userId !== userId) return;
    const classItem = actor.items.find((item) => item.type === "class");
    if (classItem) {
      applyClassToActor(actor, classItem).catch((err) => console.error("BECMI | applyClassToActor", err));
    }
  });

  Hooks.once("ready", () => {
    for (const actor of game.actors) {
      refreshActorFromClass(actor).catch((err) => console.error("BECMI | refreshActorFromClass", err));
    }
  });
}
