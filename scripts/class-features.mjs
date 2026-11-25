/**
 * Class and racial abilities shown on the character sheet.
 *
 * The Rules Cyclopedia scatters these abilities through Chapter 2, the class
 * experience tables and the optional Mystic section. This module keeps a
 * compact, testable index so the sheet can show every class ability, including
 * those that are not represented by an Actor sheet tab or a dice button.
 */
import { normalizeClassKey } from "./rules-rc.mjs";

const F = (key, label, detail, minLevel = 1, minXp = 0) =>
  ({ key, label, detail, minLevel, minXp });

export const CLASS_FEATURES = {
  cleric: [
    F("turnUndead", "Turn Undead", "Force undead to flee or be destroyed. Use the Turn Undead tab and the level column from the rules."),
    F("clericSpells", "Clerical Spells", "Cast spells from the Cleric list. Spell slots come from the class experience table."),
    F("druid", "Druid Extension", "A Neutral cleric of at least 9th level may become a druid and use both Cleric and Druid spells.", 9)
  ],

  druid: [
    F("druidSpells", "Druid Spells", "Cast both Cleric and Druid spells, except spells that affect good or evil."),
    F("druidRestrictions", "Druid Restrictions", "No metal armor or metal weapons; leather and wooden gear only. Prefer a woodland home.")
  ],

  fighter: [
    F("lanceAttack", "Lance Attack", "A mounted fighter may make a Lance Attack. Dwarves, elves and fighters can use it; mystics cannot."),
    F("setSpear", "Set Spear vs. Charge", "Set a spear against a charging opponent for increased damage."),
    F("combatOptions", "Fighter Combat Options", "Smash, parry, disarm and multiple attacks. Extra attacks are granted by the class experience table.", 9),
    F("weaponMastery", "Weapon Mastery", "Gain weapon mastery choices at the levels shown in the class progression.")
  ],

  thief: [
    F("thiefSkills", "Thief Skills", "Open Locks, Find Traps, Remove Traps, Climb Walls, Move Silently, Hide in Shadows, Pick Pockets and Hear Noise."),
    F("backstab", "Backstab", "When unnoticed with a one-handed melee weapon: +4 to hit and double weapon damage before modifiers."),
    F("readLanguages", "Read Languages", "80% chance to read normal writing, codes, dead languages and treasure maps. Not magical writing.", 4),
    F("scrolls", "Magic-User Scrolls", "Cast magic-user spells from scrolls with a 10% chance of backfire; thieves cannot write their own scrolls.", 10)
  ],

  "magic-user": [
    F("arcaneSpells", "Arcane Spells", "Cast magic-user spells memorized from spell books. Up to nine spell levels for humans; elves stop at fifth."),
    F("spellResearch", "Spell Books and Research", "Find, copy and research spells into personal spell books."),
    F("magicItems", "Magical Items", "Magic-users can use magical items appropriate to spellcasters, including scrolls and wands.")
  ],

  dwarf: [
    F("infravision", "Infravision", "See 60 feet in darkness. Warm creatures appear red and cold objects blue; normal or magical light cancels it."),
    F("detection", "Detection", "1-in-3 chance to detect traps, sliding walls, sloping corridors and new construction."),
    F("languages", "Racial Languages", "Also knows dwarf, gnome, goblin and kobold."),
    F("fighterManeuvers", "Fighter Maneuvers", "Lance Attack and Set Spear vs. Charge at 1st level."),
    F("combatOptions", "Combat Options", "Fighter Combat Options: two attacks at 660,000 XP and three attacks at 2,200,000 XP.", 1, 660000),
    F("halfSpellDamage", "Resist Spells", "Half damage from spells that deal damage; one quarter if the saving throw succeeds.", 1, 1400000)
  ],

  elf: [
    F("infravision", "Infravision", "See 60 feet in darkness; normal or magical light cancels it."),
    F("secretDoors", "Detect Secret Doors", "1-in-3 chance to notice secret and hidden doors."),
    F("languages", "Racial Languages", "Also knows elf, gnoll, hobgoblin and orc."),
    F("ghoulImmunity", "Ghoul Paralysis Immunity", "Immune to the paralyzing touch of ghouls."),
    F("fighterManeuvers", "Fighter Maneuvers", "Lance Attack and Set Spear vs. Charge."),
    F("elfSpells", "Elven Spells", "Cast magic-user spells, but only up to 5th level.", 1),
    F("combatOptions", "Combat Options", "Fighter Combat Options: two attacks at 850,000 XP and three attacks at 2,600,000 XP; never four.", 1, 850000),
    F("halfBreath", "Resist Dragon Breath", "Half damage from dragon breath attacks.", 1, 1600000)
  ],

  halfling: [
    F("combatBonuses", "Combat Bonuses", "-2 AC versus man-sized or larger monsters, +1 to missile attack rolls and +1 to individual initiative."),
    F("hiding", "Woodland Hiding", "90% chance to hide motionless in woodlands and 33% in dimly lit interiors."),
    F("setSpear", "Set Spear vs. Charge", "Set a spear against a charging opponent."),
    F("halfSpells", "Resist Spells", "Half damage from spells that deal damage.", 1, 300000),
    F("combatOptions", "Combat Options", "Fighter Combat Options: two attacks at 900,000 XP and three attacks at 3,000,000 XP.", 1, 900000),
    F("halfBreath", "Resist Dragon Breath", "Half damage from dragon breath attacks.", 1, 2100000)
  ],

  mystic: [
    F("unarmed", "Martial Arts", "Unarmed attacks improve with level and can strike creatures otherwise hurt only by silver or magical weapons."),
    F("acMovement", "AC and Movement Bonus", "Armor Class and movement rate improve with level; mystics never wear armor or use protective magical devices."),
    F("thiefAbilities", "Thief Abilities", "Find Traps, Remove Traps, Move Silently, Climb Walls and Hide in Shadows as a thief of the same level."),
    F("awareness", "Awareness", "Surprised only on a roll of 1 on 1d6.", 2),
    F("healSelf", "Heal Self", "Once per day, concentrate for one round to heal 1 hit point per level.", 4),
    F("speakAnimals", "Speak with Animals", "Speak with any normal or giant animal; animals understand but are not compelled.", 6),
    F("resistance", "Resistance", "Half damage from damaging spells and breath weapons, or one quarter on a successful save.", 8),
    F("speakAnyone", "Speak with Anyone", "Speak with any living creature that has a language.", 10),
    F("mindBlock", "Mind Block", "Resist mental intrusion and control attempts.", 12),
    F("blankout", "Blankout", "Erase traces that would allow pursuers to track the mystic.", 14),
    F("gentleTouch", "Gentle Touch", "Render a creature unconscious without causing permanent harm.", 16),
    F("combatOptions", "Fighter Combat Options", "At 9th level: smash, parry and disarm, but not multiple attacks. No Lance Attack.", 9)
  ]
};

export function classFeaturesFor(className, { level = 1, xp = 0, druid = false } = {}) {
  const key = normalizeClassKey(className) ?? "";
  const currentLevel = Math.max(1, Number(level) || 1);
  const earnedXp = Math.max(0, Number(xp) || 0);
  const source = [...(CLASS_FEATURES[key] ?? [])];
  if (druid && key === "cleric") source.unshift(...CLASS_FEATURES.druid);

  return source.map((feature) => ({
    ...feature,
    unlocked: currentLevel >= feature.minLevel && earnedXp >= feature.minXp,
    requirement: feature.minXp
      ? `${feature.minXp.toLocaleString("en-US")} XP`
      : feature.minLevel > 1 ? `Level ${feature.minLevel}` : ""
  }));
}
