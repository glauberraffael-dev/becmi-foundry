/**
 * Name-level (9th level, 8th for halflings) choices from the Rules Cyclopedia.
 *
 * Chapter 2 gives each class a land-owning/travelling decision and, for
 * travelling fighters, alignments grant paladin/knight/avenger abilities.
 * Chapter 12 adds the stronghold retainers. This module keeps those choices
 * testable without Foundry; the actor sheet renders the same data.
 */
import { RC, adjustment, normalizeClassKey } from "./rules-rc.mjs";

const PATH_KEYS = new Set(["landowner", "travelling"]);
const SPECIALIZATION_KEYS = new Set(["paladin", "knight", "avenger"]);

export const PATH_OPTIONS = [
  { key: "", name: "Undecided" },
  { key: "landowner", name: "Land Owner — stronghold and dominion" },
  { key: "travelling", name: "Travelling — no dominion" }
];

export const SPECIALIZATION_OPTIONS = [
  { key: "", name: "None — Lord / Lady" },
  { key: "paladin", name: "Paladin — Lawful" },
  { key: "knight", name: "Knight — any alignment" },
  { key: "avenger", name: "Avenger — Chaotic" }
];

const HOLDING_OPTIONS = {
  cleric: [
    { key: "", name: "Stronghold sanctioned by the order" }
  ],
  fighter: [
    { key: "", name: "In fealty to a ruler (Baron / Baroness)" },
    { key: "independent", name: "Independent wilderness ruler (title by DM)" }
  ],
  "magic-user": [
    { key: "", name: "Tower — independent wizard" },
    { key: "magist", name: "Magist — employed by a ruler" }
  ],
  thief: [
    { key: "", name: "Hideout — official Guild branch" }
  ],
  dwarf: [{ key: "", name: "Underground clan stronghold" }],
  elf: [{ key: "", name: "Clan stronghold" }],
  halfling: [{ key: "", name: "Clan stronghold" }],
  mystic: [{ key: "", name: "Cloister" }],
  druid: [{ key: "", name: "Woodland home — no stronghold" }]
};

/** Halflings reach Name level at 8th; every other class uses 9th. */
export function nameLevelThreshold(classKey) {
  return normalizeClassKey(classKey) === "halfling" ? 8 : 9;
}

/** Selectable values for the path, holding style and fighter specialization. */
export function nameLevelOptions(classKey, alignment = "") {
  const key = normalizeClassKey(classKey);
  return {
    path: PATH_OPTIONS,
    holding: HOLDING_OPTIONS[key] ?? HOLDING_OPTIONS.fighter,
    specialization: key === "fighter" ? SPECIALIZATION_OPTIONS : [],
    alignment: String(alignment ?? "")
  };
}

function alignmentKey(value) {
  const text = String(value ?? "").toLowerCase();
  if (text.startsWith("law")) return "lawful";
  if (text.startsWith("cha")) return "chaotic";
  return "neutral";
}

function titleFor({ classKey, druid, path, specialization, holdingStyle, active }) {
  if (!active) return "";
  if (druid) return "Druid";
  if (!path) return classKey === "fighter" ? "Lord / Lady" : "";
  switch (classKey) {
    case "fighter":
      if (path === "landowner") {
        return holdingStyle === "independent" ? "Independent ruler (title by DM)" : "Baron / Baroness";
      }
      return ({ paladin: "Paladin", knight: "Knight", avenger: "Avenger" })[specialization] ?? "Lord / Lady";
    case "cleric":
      return path === "landowner" ? "Patriarch / Matriarch" : "Travelling Cleric";
    case "magic-user":
      if (path !== "landowner") return "Magus";
      return holdingStyle === "magist" ? "Magist" : "Wizard / Maga";
    case "thief":
      return path === "landowner" ? "Guildmaster" : "Rogue";
    case "dwarf":
      return "Dwarf Lord / Lady";
    case "elf":
      return "Elf Lord / Lady (Clanholder)";
    case "halfling":
      return "Halfling Lord / Lady (Clanholder)";
    case "mystic":
      return path === "landowner" ? "Cloister Master" : "Master Mystic";
    default:
      return "";
  }
}

function guidanceFor({ classKey, druid, path, specialization, clericalLevel, spellCost, hirelingCap, followerRange }) {
  const pros = [];
  const cons = [];
  if (druid) {
    pros.push("Authority over the woodland the druid protects; local rulers ignore him.");
    cons.push("No strongholds, mercenaries or civilian employees and no stronghold retainers.");
    return { pros, cons };
  }
  if (path === "landowner") {
    switch (classKey) {
      case "cleric":
        pros.push("May rise in the order; the order pays up to 50% of the stronghold cost.");
        pros.push("1d6 x 50 same-alignment loyal troops: no pay, morale 12, never check morale.");
        pros.push("1d6 cleric assistants of levels 1-3 serve the stronghold.");
        cons.push("Chief clerical authority for the area: local responsibilities compete with adventuring.");
        cons.push("A superior may require land to be requested or a quest to be performed.");
        break;
      case "fighter":
        pros.push("Baron / Baroness, or a fitting title for an independent wilderness dominion.");
        pros.push("Up to 50 normal men and fighters of levels 1-3 apply for paid jobs.");
        pros.push("The ruler sends military aid if the dominion is invaded.");
        cons.push("Petition for land; a quest or proof of loyalty may be required.");
        cons.push("Lend military aid in war and pay the normal mercenary rates.");
        break;
      case "magic-user":
        pros.push("Build or seize a tower without asking permission; a ruler may grant a title.");
        pros.push("1d6 apprentices of levels 1-3 and up to 12 normal men seek training.");
        cons.push("Magist alternative: at least 3,000 gp/month, an oath of fealty and all needs supplied.");
        cons.push("A monster-infested dungeon may disturb nearby settlements.");
        break;
      case "thief":
        pros.push("2d6 first-level apprentices and income from their minor pilfering.");
        pros.push("The Guild backs a hideout in an area it does not already control.");
        cons.push("Guild approval is required; at least one apprentice reports to the Guild.");
        break;
      case "dwarf":
      case "elf":
      case "halfling":
        pros.push("The clan finds the site and loans up to 50% of the construction cost.");
        pros.push("1d6 x 30 same-class NPCs move in; the whole clan may defend the stronghold.");
        cons.push("Only mercenaries of the same race may be hired.");
        cons.push("A PC is normally a Clanholder, not the Clanmaster or Keeper of the Relic.");
        break;
      case "mystic":
        pros.push("The Grand Abbot may pay up to 100% of a modest cloister.");
        pros.push("1d2 x 10 mystics and 1d6 x 30 normal men join as students.");
        cons.push("A cloister is a school, not a dominion: mystics do not rule lands.");
        cons.push("Independence is only possible at 13th level; the cloister must support its students.");
        break;
      default:
        break;
    }
    cons.push("Changing back and forth requires a major campaign development.");
    return { pros, cons };
  }

  if (path !== "travelling") {
    cons.push(`Reach ${nameLevelThreshold(classKey)}th level, then choose Land Owner or Travelling.`);
    cons.push("A home or castle built before Name level carries no official authority.");
    return { pros, cons };
  }

  switch (classKey) {
    case "cleric":
      pros.push("Free to travel where he pleases; not tied to one place or group.");
      cons.push("No rank above land-owning cleric and little influence in the order's hierarchy.");
      cons.push("Still bound to the order's goals and may be summoned at any time.");
      break;
    case "magic-user":
      pros.push("A magus can help other wizards: researched spells and items are completed faster.");
      pros.push("1d6 hirelings of at least 5th level offer to travel with the magus.");
      cons.push("No tower income or political authority from a dominion.");
      break;
    case "thief":
      pros.push("Weekly chance to learn of treasure maps or great treasures through the grapevine.");
      pros.push("Local Guilds may share information and tips with a rogue.");
      cons.push("Must visit the Guild once a year and hire low-level help to get local information.");
      cons.push("A rogue can never become Guildmaster of an established branch.");
      break;
    case "fighter":
      cons.push("No dominion or political power; special abilities come from alignment and are not automatic.");
      if (specialization === "paladin") {
        pros.push("Detect Evil once per round by concentrating (120').");
        pros.push(`Turn undead and cast cleric spells as a ${clericalLevel}th level cleric.`);
        cons.push("Swear fealty to a Lawful clerical order and obey summons that aid Good.");
        cons.push(`No more than ${hirelingCap} hirelings; no attack in a round spent detecting evil.`);
        cons.push("Must help anyone who asks, except evildoers, unless already on a higher mission.");
      } else if (specialization === "avenger") {
        pros.push("Detect Evil once per round by concentrating (120').");
        pros.push(`Turn undead as a ${clericalLevel}th level cleric and may control a turned/destroyed result for one turn per level.`);
        pros.push("Can demand sanctuary in a Chaotic monster's lair with the alignment tongue.");
        if (followerRange) pros.push(`Chaotic monster hirelings allowed: ${followerRange[0]}-${followerRange[1]} by Charisma.`);
        cons.push("Alliance with a Chaotic order; disobedience removes all benefits.");
        cons.push(`Cleric spells cost at least 10,000 gp per spell level (${spellCost} gp for ${clericalLevel} gained).`);
        cons.push("No human or demihuman hirelings; no attack in a round spent detecting evil.");
      } else if (specialization === "knight") {
        pros.push("Sanctuary for up to three days in any castle, with food and drink.");
        cons.push("Swear fealty to a prince, king or emperor; that ruler becomes the liege.");
        cons.push("Disobedience or a second oath costs three experience levels.");
        cons.push("Answer a call to arms in the area or from the liege; compensation is due.");
      } else {
        cons.push("Choose a specialization: paladin (Lawful), knight (any) or avenger (Chaotic).");
      }
      break;
    default:
      break;
  }
  cons.push("Changing back and forth requires a major campaign development.");
  return { pros, cons };
}

/**
 * Resolve the stored name-level fields plus all derived consequences.
 * `system` may be an actor's system data or a plain snapshot.
 */
export function nameLevelDetails(system = {}, flags = {}) {
  const attrs = system.attributes ?? {};
  const input = system.nameLevel ?? {};
  const classKey = normalizeClassKey(attrs.classKey || attrs.class);
  const druid = classKey === "cleric" && Boolean(flags.druid);
  const level = Math.max(1, Number(attrs.level) || 1);
  const threshold = nameLevelThreshold(classKey);
  const active = level >= threshold;
  const path = PATH_KEYS.has(input.path) ? input.path : "";
  const requested = SPECIALIZATION_KEYS.has(input.specialization) ? input.specialization : "";
  const isFighter = classKey === "fighter" && !druid;
  const alignment = alignmentKey(attrs.alignment);
  const eligible = requested === "paladin" ? alignment === "lawful"
    : requested === "avenger" ? alignment === "chaotic"
      : requested === "knight";
  const specialization = active && path === "travelling" && isFighter && eligible ? requested : "";
  const holdingStyle = String(input.holdingStyle ?? "");

  const clericalLevel = specialization === "paladin" || specialization === "avenger"
    ? Math.floor(level / 3)
    : 0;
  const wis = Number(system.abilities?.wis?.value ?? 10);
  const purchased = Math.max(0, Math.min(9, Number(input.avengerSpellLevels) || 0));
  const spellLevel = clericalLevel > 0 && wis >= 13
    ? (specialization === "avenger" ? Math.min(clericalLevel, purchased) : clericalLevel)
    : 0;
  const spellCost = specialization === "avenger" ? purchased * 10000 : 0;

  const chaAdjustment = adjustment(Number(system.abilities?.cha?.value ?? 10)) ?? 0;
  const followerRange = RC.ability.followers[String(chaAdjustment)] ?? null;
  let hirelingCap = null;
  if (specialization === "paladin") hirelingCap = clericalLevel;
  if (specialization === "avenger") hirelingCap = followerRange ? followerRange[1] : 0;
  const hirelings = Math.max(0, Number(input.hirelings) || 0);

  const title = titleFor({ classKey, druid, path, specialization, holdingStyle, active });
  const { pros, cons } = guidanceFor({
    classKey, druid, path, specialization, clericalLevel, spellCost, hirelingCap, followerRange
  });
  const warnings = [];
  if (!active) warnings.push(`Name level begins at ${threshold}th level; this choice is a preview only.`);
  if (path === "landowner" && requested) warnings.push("Fighter specializations apply only to travelling fighters.");
  if (requested === "paladin" && alignment !== "lawful") {
    warnings.push("A paladin must be Lawful and swear fealty to a Lawful clerical order.");
  }
  if (requested === "avenger" && alignment !== "chaotic") {
    warnings.push("An avenger must be Chaotic and allied with a Chaotic clerical order.");
  }
  if (clericalLevel > 0 && wis < 13) {
    warnings.push(`Wisdom ${wis}: no cleric spells; turn undead still uses cleric level ${clericalLevel}.`);
  }
  if (hirelingCap !== null && hirelings > hirelingCap) {
    warnings.push(`${hirelings} hirelings exceed the limit of ${hirelingCap}.`);
  }
  if (active && !path) warnings.push("Choose Land Owner or Travelling to apply these rules.");

  return {
    classKey, druid, level, threshold, active, path, specialization, requested, holdingStyle, eligible,
    isFighter, isAvenger: specialization === "avenger", title,
    clericalLevel, spellLevel, spellCost, hirelings, hirelingCap, followerRange,
    hirelingOver: hirelingCap !== null && hirelings > hirelingCap,
    canDetectEvil: specialization === "paladin" || specialization === "avenger",
    canTurnUndead: clericalLevel > 0,
    canCastCleric: spellLevel > 0,
    pros, cons, guidance: [...pros, ...cons], warnings
  };
}
