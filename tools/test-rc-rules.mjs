/**
 * Foundry-independent tests for the Rules Cyclopedia tables and automations.
 *
 * Usage: node tools/test-rc-rules.mjs
 */
import assert from "node:assert/strict";
import {
  armorWeaponEnchantmentCost, constructChance, constructCost, constructRequirements,
  craftingAbilityScore, craftingChance, craftingXp, enchantmentTime, researchCost,
  researchRollSucceeds, researchTime, spellEffectCost, spellResearchChance
} from "../scripts/magic-crafting.mjs";
import { classFeaturesFor } from "../scripts/class-features.mjs";
import { nameLevelDetails, nameLevelOptions, nameLevelThreshold } from "../scripts/name-level.mjs";
import {
  hasMasteryRows, masteryAttackBonus, masteryDamageFormula, masteryEnabled,
  weaponMasteryFor
} from "../scripts/mastery.mjs";
import {
  RC, adjustment, armorBase, attackInfo, attackNeeded, attackRows, attackSpecFor,
  baseSaves, baseThiefSkills, calculateXpAward, capXpAdvancement, chooseDamage,
  computeArmorClass, computeLoad, encounterChance, encounterCheck, encounterDistance,
  equippedAcBonus, equippedSaveBonuses, evasionChance, evasionCheck, finalDamage,
  gemValue, generalSkillInfo, generalSkillSlots, GENERAL_SKILLS, hpForLevel, jewelryValue,
  magicItemCategory, masteryChoices, masteryData, masteryWeapon, levelForXp, monsterAttackRows,
  monsterDamageFormula,
  monsterHpFormula, monsterHpFromHitDice, monsterSaveTargets, monsterSpellcasterInfo,
  monsterThac0, monsterXpValue, MONSTER_XP_TABLE, normalizeClassKey, parseMonsterHitDice,
  parseMonsterSaveAs, planAbilityAdjustment, primeRequisiteBonus, pursuitRound,
  reactionBand, reactionStep, resolveTurnResult, rollExpression, rollMagicItem,
  rollTreasureType, spellKey, spellSlotsForLevel, spellsFor, sumDamage, surpriseCheck,
  treasureTypeInfo, TREASURE_TYPES, turnUndeadCell, turnUndeadColumn, turnUndeadTable,
  wanderingMonsterDistance, xpForNextLevel, xpThresholds
} from "../scripts/rules-rc.mjs";

const check = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

check("extracted data has the expected reference tables", () => {
  assert.equal(Object.keys(RC.classes).length, 8);
  assert.equal(RC.spells.length, 201);
  assert.equal(RC.mastery.weapons.length, 37);
  assert.equal(RC.thief.length, 36);
  assert.equal(RC.turnUndead.rows.length, 14);
  assert.equal(RC.attack.sequence.length, 71);
});

check("class aliases normalize to RC keys", () => {
  assert.equal(normalizeClassKey("Mage"), "magic-user");
  assert.equal(normalizeClassKey("Warrior"), "fighter");
  assert.equal(normalizeClassKey("Rogue"), "thief");
  assert.equal(normalizeClassKey("not a class"), null);
  assert.equal(normalizeClassKey("Mystic"), "mystic");
});

check("XP thresholds drive automatic level advancement", () => {
  const fighter = RC.classes.fighter;
  assert.equal(xpThresholds(fighter)[0], 2000);
  assert.equal(xpForNextLevel(fighter, 1), 2000);
  assert.equal(xpForNextLevel(fighter, 36), null);
  assert.equal(levelForXp(fighter, 1999, 1), 1);
  assert.equal(levelForXp(fighter, 2000, 1), 2);
  assert.equal(levelForXp(fighter, 4350000, 1), 36);
  assert.equal(levelForXp(fighter, 99999999, 1), 36);

  const mystic = RC.classes.mystic;
  assert.equal(mystic.maxLevel, 16);
  assert.equal(xpForNextLevel(mystic, 15), 1080000);
  assert.equal(levelForXp(mystic, 1080000, 1), 16);
  assert.equal(levelForXp(mystic, 5000000, 1), 16);

  const broken = { maxLevel: 4, xpTable: { 1: 0, 2: 1000, 3: 500, 4: 3000 } };
  assert.deepEqual(xpThresholds(broken), [1000, 1001, 3000]);
  assert.equal(levelForXp(broken, 1001, 1), 3);
});

check("prime requisite bonuses follow the RC class table", () => {
  assert.equal(primeRequisiteBonus("fighter", { str: { value: 4 } }), -20);
  assert.equal(primeRequisiteBonus("fighter", { str: { value: 7 } }), -10);
  assert.equal(primeRequisiteBonus("fighter", { str: { value: 11 } }), 0);
  assert.equal(primeRequisiteBonus("cleric", { wis: { value: 14 } }), 5);
  assert.equal(primeRequisiteBonus("magic-user", { int: { value: 17 } }), 10);
  assert.equal(primeRequisiteBonus("thief", { dex: { value: 5 } }), -20);
  assert.equal(primeRequisiteBonus("elf", { str: { value: 16 }, int: { value: 14 } }), 5);
  assert.equal(primeRequisiteBonus("elf", { str: { value: 16 }, int: { value: 17 } }), 10);
  assert.equal(primeRequisiteBonus("elf", { str: { value: 16 }, int: { value: 10 } }), 0);
  assert.equal(primeRequisiteBonus("halfling", { str: { value: 14 }, dex: { value: 10 } }), 5);
  assert.equal(primeRequisiteBonus("halfling", { str: { value: 14 }, dex: { value: 15 } }), 10);
  assert.equal(primeRequisiteBonus("mystic", { str: { value: 7 } }), -5);
  assert.equal(primeRequisiteBonus("mystic", { str: { value: 14 } }, { acrobatic: true }), -15);
  assert.equal(primeRequisiteBonus("fighter", { str: { value: 18 } }, { apply: false }), 0);
});

check("monster XP table resolves Hit Dice and asterisks", () => {
  assert.equal(MONSTER_XP_TABLE.length, 30);
  assert.equal(monsterXpValue("Under 1").xp, 5);
  assert.equal(monsterXpValue("1", 2).xp, 16);
  assert.equal(monsterXpValue("4**").xp, 175);
  assert.equal(monsterXpValue("9+ to 10", 1).xp, 1750);
  assert.deepEqual(monsterXpValue("23+1 HD"), {
    hd: "23+1 HD", row: "20+ to 21", base: 3250, bonusPerAsterisk: 2750,
    asterisks: 0, xp: 3250
  });
});

check("XP awards combine RC sources, prime requisites and the level cap", () => {
  const fighter = { ...RC.classes.fighter, key: "fighter" };
  const award = calculateXpAward({
    classInfo: fighter,
    abilities: { str: { value: 16 } },
    level: 1,
    currentXp: 0,
    monsterXp: 1000,
    participants: 4,
    treasureGp: 200,
    goalXp: 250,
    roleplayAwards: 2, // capped at one role-playing bonus per session
    exceptionalActions: 1
  });
  assert.equal(award.monsterShare, 250);
  assert.equal(award.roleplayXp, 100);
  assert.equal(award.exceptionalXp, 100);
  assert.equal(award.baseXp, 900);
  assert.equal(award.primePercent, 10);
  assert.equal(award.earnedXp, 990);
  assert.equal(award.finalXp, 990);

  const defeat = calculateXpAward({
    classInfo: fighter, level: 1, currentXp: 0, monsterXp: 1000,
    participants: 1, goalXp: 0, applyPrimeRequisite: false,
    applyLevelCap: false, outcome: "defeat"
  });
  assert.equal(defeat.baseXp, 250);

  const capped = calculateXpAward({
    classInfo: fighter, level: 1, currentXp: 0, monsterXp: 10000,
    participants: 1, goalXp: 0, applyPrimeRequisite: false
  });
  assert.equal(capped.capped, true);
  assert.equal(capped.awardedXp, 3999);
  assert.equal(capped.lostXp, 6001);
  assert.equal(capped.finalXp, 3999);

  const maximum = calculateXpAward({
    classInfo: fighter, level: 36, currentXp: 3480000, monsterXp: 1000,
    participants: 1, goalXp: 0, applyPrimeRequisite: false
  });
  assert.equal(maximum.capped, false);
  assert.equal(maximum.awardedXp, 1000);

  assert.equal(capXpAdvancement({
    classInfo: fighter, level: 1, currentXp: 1000, awardedXp: 1000
  }).awarded, 1000);
});

check("mystics only gain treasure XP when it is donated", () => {
  const mystic = { ...RC.classes.mystic, key: "mystic" };
  const base = {
    classInfo: mystic, abilities: { str: { value: 10 } }, level: 1,
    currentXp: 0, treasureGp: 1000, goalXp: 0, applyPrimeRequisite: false,
    applyLevelCap: false
  };
  assert.equal(calculateXpAward({ ...base, mysticTreasureDonated: false }).treasureXp, 0);
  assert.equal(calculateXpAward({ ...base, mysticTreasureDonated: true }).treasureXp, 1000);
  assert.equal(capXpAdvancement({ classInfo: mystic, level: 16, awardedXp: 500 }).awarded, 500);
});

check("class abilities include backstab, demihuman and mystic features", () => {
  const thief = classFeaturesFor("Thief", { level: 1 });
  const backstab = thief.find((feature) => feature.key === "backstab");
  assert.ok(backstab?.unlocked);
  assert.match(backstab.detail, /double weapon damage/);

  const elf = classFeaturesFor("Elf", { level: 4, xp: 900000 });
  assert.ok(elf.find((feature) => feature.key === "elfSpells")?.unlocked);
  assert.ok(elf.find((feature) => feature.key === "combatOptions")?.unlocked);
  assert.ok(!elf.find((feature) => feature.key === "halfBreath")?.unlocked);

  const mystic = classFeaturesFor("Mystic", { level: 16, xp: 1080000 });
  assert.equal(mystic.find((feature) => feature.key === "gentleTouch")?.unlocked, true);
  assert.equal(mystic.find((feature) => feature.key === "combatOptions")?.unlocked, true);

  const druid = classFeaturesFor("Cleric", { level: 9, xp: 200000, druid: true });
  assert.ok(druid.some((feature) => feature.key === "druidSpells"));
  assert.ok(druid.find((feature) => feature.key === "druid")?.unlocked);
});

check("attack table maps specs and AC values", () => {
  assert.equal(attackNeeded(19, 0), "19");
  assert.equal(attackNeeded("2k3", 0), "2");
  assert.equal(attackNeeded("1", 0), "1");
  const info = attackInfo("19", -1, 0);
  assert.equal(info.needed, 20);
  const rows = attackRows(19, 9, -10);
  assert.equal(rows.length, 20);
  assert.equal(rows.at(-1).ac, -10);
});

check("attack column follows level and XP rank", () => {
  assert.equal(attackSpecFor("fighter", 1).spec, 19);
  assert.equal(attackSpecFor("fighter", 30).spec, "2k3");
  assert.equal(attackSpecFor("magic-user", 5).spec, 19);
  assert.equal(attackSpecFor("magic-user", 6).spec, 17);
  assert.equal(attackSpecFor("halfling", 36, 120000).spec, 15);
});

check("saves and thief skills come from the level tables", () => {
  assert.deepEqual(baseSaves("fighter", 3), {
    deathRay: 12, magicWand: 13, paralysis: 14, breath: 15, spells: 16
  });
  assert.equal(baseThiefSkills(5).climbWalls, 91);
  assert.equal(baseThiefSkills(5).openLocks, 35);
});

check("general skills follow the RC sample table and slot acquisition", () => {
  assert.equal(GENERAL_SKILLS.length, 61);
  assert.equal(new Set(GENERAL_SKILLS.map((skill) => skill.key)).size, GENERAL_SKILLS.length);
  assert.equal(generalSkillInfo("riding").ability, "dex");
  assert.equal(generalSkillInfo("tracking").ability, "int");
  assert.equal(generalSkillInfo("art", "wis").ability, "wis");
  assert.equal(generalSkillInfo("riding", "cha").ability, "dex");
  assert.equal(generalSkillInfo("not-a-skill"), null);

  // Four starting slots plus the Intelligence bonus.
  assert.equal(generalSkillSlots("fighter", 1, 0, 10), 4);
  assert.equal(generalSkillSlots("fighter", 1, 0, 14), 5);
  assert.equal(generalSkillSlots("fighter", 1, 0, 17), 6);
  assert.equal(generalSkillSlots("fighter", 1, 0, 18), 7);
  // Humans gain one slot at levels 5, 9, 13, 17, 21, 25, 29 and 33.
  assert.equal(generalSkillSlots("fighter", 5, 0, 10), 5);
  assert.equal(generalSkillSlots("fighter", 36, 0, 10), 12);
  // Demihumans use their own level/XP table instead of the human levels.
  assert.equal(generalSkillSlots("dwarf", 5, 0, 10), 5);
  assert.equal(generalSkillSlots("dwarf", 9, 1200000, 10), 7);
  assert.equal(generalSkillSlots("elf", 10, 2350000, 10), 8);
  assert.equal(generalSkillSlots("halfling", 8, 1500000, 10), 7);
});

check("spell slots and spell lists use the extracted tables", () => {
  assert.deepEqual(spellSlotsForLevel("cleric", 3), [2, 1, 0, 0, 0, 0, 0]);
  assert.deepEqual(spellSlotsForLevel("cleric", 5).slice(0, 3), [2, 2, 1]);
  assert.deepEqual(spellSlotsForLevel("magic-user", 5).slice(0, 3), [2, 2, 1]);
  assert.equal(spellsFor("cleric", 1).length, 8);
  const key = spellKey(spellsFor("cleric", 1)[0]);
  assert.ok(spellsFor("magic-user", 1, { grimoire: [key] }).length >= 0);
  assert.equal(spellsFor("fighter", 1).length, 0);
  const druidSpells = spellsFor("cleric", 1, { extraLists: ["druid"] });
  assert.ok(druidSpells.length > 8);
  assert.ok(druidSpells.every((spell) => ["cleric", "druid"].includes(spell.class)));
});

check("ability adjustments and creation swap follow the RC bands", () => {
  assert.equal(adjustment(3), -3);
  assert.equal(adjustment(9), 0);
  assert.equal(adjustment(13), 1);
  assert.equal(adjustment(18), 3);
  const plan = planAbilityAdjustment("fighter", { str: 15, int: 12, wis: 12 }, 1);
  assert.equal(plan.scores.str, 16);
  assert.equal(plan.scores.int, 10);
  assert.equal(plan.swaps, 1);
});

check("armor class and load are derived from equipment", () => {
  assert.equal(armorBase("malha"), 5);
  assert.equal(computeArmorClass({ type: "malha", shield: true, dexAdj: 1, magicArmor: 1, itemBonus: 1 }).value, 1);
  const load = computeLoad({ armor: "placas", shield: true, coins: 1000 });
  assert.equal(load.total, 1600);
  assert.equal(load.movementTurn, 30);
  assert.equal(load.movementRound, 10);
});

check("turn undead resolves the highlighted column", () => {
  assert.equal(turnUndeadColumn(1), 0);
  assert.equal(turnUndeadColumn(9), 8);
  assert.equal(turnUndeadColumn(33), 16);
  assert.equal(turnUndeadCell(5, "Skeleton"), "D");
  assert.equal(turnUndeadCell(1, "Skeleton"), "7");
  assert.equal(resolveTurnResult("D+", 7).dice, "3d6");
  assert.equal(resolveTurnResult("7", 6).kind, "failure");
  assert.equal(turnUndeadTable(5).length, 17);
  assert.equal(turnUndeadTable(5)[4].active, true);
});

check("weapon mastery resolves ranks and damage options", () => {
  const weapon = masteryWeapon("Cassetete");
  assert.equal(weapon.name, "Blackjack");
  assert.equal(masteryData(weapon, "gm").damage, "P=1d4+5; S=1d6+2");
  assert.equal(masteryData(weapon, "sem").damage, "—");
  assert.equal(masteryData(weapon, "gm").attack[0], 8);
  assert.equal(chooseDamage("P=1d4+3; S=1d6+1", "sec"), "1d6+1");
  assert.equal(sumDamage("1d6", 2), "1d6+2");
  assert.equal(finalDamage("1d6", 1, true), "½(1d6)+1");
  assert.equal(masteryChoices("fighter", 5), 5);
  assert.equal(masteryChoices("fighter", 36, 660000), 15);
});

check("weapon mastery is opt-in and applies to the trained weapon only", () => {
  const actor = {
    system: {
      mastery: {
        enabled: false,
        rows: [{ name: "Cassetete", grade: "habil", primary: "H", target: "prim" }]
      }
    }
  };
  assert.equal(masteryEnabled(actor), false);
  assert.equal(hasMasteryRows(actor), true);
  assert.equal(weaponMasteryFor(actor, { name: "Cassetete" }), null);

  actor.system.mastery.enabled = true;
  const trained = weaponMasteryFor(actor, { name: "Cassetete" });
  assert.equal(trained.weapon, "Blackjack");
  assert.equal(trained.gradeName, "Habilidoso");
  assert.equal(masteryAttackBonus(trained), 2);
  assert.equal(masteryDamageFormula(trained), "2d2");
  assert.equal(weaponMasteryFor(actor, { name: "Sword, Normal" }), null);

  actor.system.mastery.rows[0].primary = "S";
  assert.equal(masteryAttackBonus(weaponMasteryFor(actor, { name: "Cassetete" })), 1);
  actor.system.mastery.rows[0].grade = "sem";
  assert.equal(weaponMasteryFor(actor, { name: "Cassetete" }), null);
});

check("hit points use dice up to level 9 and fixed values after", () => {
  assert.equal(hpForLevel("fighter", 2, 2, () => 0).gain, 3);
  assert.equal(hpForLevel("fighter", 9, 2, () => 0).gain, 3);
  const fixed = { fighter: 2, cleric: 1, thief: 2, "magic-user": 1, dwarf: 3, elf: 1, mystic: 2 };
  for (const [key, gain] of Object.entries(fixed)) {
    const result = hpForLevel(key, 10, 5, () => 0);
    assert.equal(result.gain, gain, `${key} fixed HP after 9th`);
    assert.match(result.text, /fixed HP \(no CON bonus\)/, `${key} must ignore CON after 9th`);
  }
  // The halfling campaign ends at 8th level, so it never reaches a fixed gain.
  assert.ok(hpForLevel("halfling", 8, 2, () => 0).gain > 0);
});

check("the free roller supports dice, modifiers and half expressions", () => {
  assert.equal(rollExpression("2d6+3", () => 0).total, 5);
  assert.equal(rollExpression("½(2d6+4)+3", () => 0).total, 6);
  assert.equal(rollExpression("10-2-1").total, 7);
  assert.equal(rollExpression("1d10*10", () => 0).total, 10);
  assert.equal(rollExpression("6 d6", () => 0).total, 6);
  assert.equal(rollExpression("not dice").valid, false);
});

check("equipment bonuses are derived only from equipped items", () => {
  const items = [
    { system: { equipped: true, acBonus: -2, saveBonuses: { deathRay: 1, spells: 2 } } },
    { system: { equipped: false, acBonus: -9, saveBonuses: { deathRay: 9 } } }
  ];
  assert.equal(equippedAcBonus(items), -2);
  assert.deepEqual(equippedSaveBonuses(items), {
    deathRay: 1, magicWand: 0, paralysis: 0, breath: 0, spells: 2
  });
  assert.equal(equippedAcBonus([], [{ equipped: true, ac: -1 }]), -1);
});

check("monster by-weapon attacks use an owned weapon", () => {
  const rows = monsterAttackRows(
    { attacks: "1 by weapon", damage: "by weapon" },
    { weapons: [{ id: "w1", name: "Sword", type: "weapon", system: { equipped: true, damage: "1d8+1" } }] }
  );
  assert.equal(rows[0].damage, "1d8+1");
  assert.equal(rows[0].itemId, "w1");
});

check("monster Hit Dice count d8 and never equal the HP total", () => {
  assert.deepEqual(parseMonsterHitDice("11"), {
    kind: "dice", count: 11, faces: 8, adjustment: 0, formula: "11d8", hp: 50
  });
  assert.equal(monsterHpFormula("3 + 1"), "3d8+1");
  assert.equal(monsterHpFromHitDice("3 + 1"), 15);
  assert.equal(monsterHpFormula("1-1"), "1d8-1");
  assert.equal(monsterHpFromHitDice("5 + 5"), 28);
  assert.equal(monsterHpFromHitDice("8* (M)"), 36);
  assert.equal(monsterHpFromHitDice("1/4 (S)"), 1);
  assert.equal(monsterHpFromHitDice("1-4"), 5, "ranges use the lower d8 count");
});

check("monster Save As resolves to character saving-throw targets", () => {
  assert.deepEqual(parseMonsterSaveAs("F7", "9"), { classKey: "fighter", level: 7, label: "F7" });
  assert.deepEqual(monsterSaveTargets("Normal Man"), {
    deathRay: 14, magicWand: 15, paralysis: 16, breath: 17, spells: 17
  });
  assert.deepEqual(monsterSaveTargets("F (level = HD)", "9"), baseSaves("fighter", 9));
  assert.deepEqual(monsterSaveTargets("F (level = 1/2 HD)", "9"), baseSaves("fighter", 5));
  assert.deepEqual(monsterSaveTargets("F (level = 2 X HD)", "9"), baseSaves("fighter", 18));
  assert.deepEqual(monsterSaveTargets("M10", "9"), baseSaves("magic-user", 10));
  assert.deepEqual(monsterSaveTargets("T11", "9"), baseSaves("thief", 11));
  assert.deepEqual(monsterSaveTargets("C12", "9"), baseSaves("cleric", 12));
  assert.deepEqual(monsterSaveTargets("E1 (or better)", "9"), baseSaves("elf", 1));
  // Ambiguous multi-column OCR text falls back to the first readable token.
  assert.deepEqual(monsterSaveTargets("F7 F21 F36", "9"), baseSaves("fighter", 7));
  assert.equal(parseMonsterSaveAs("See below"), null);
  assert.equal(monsterSaveTargets("Character type and level"), null);
});

check("monster spellcasting notes resolve to RC caster lists and levels", () => {
  const lich = monsterSpellcasterInfo({
    spellcasting: "Magic-User spells by character level (level 21).", saveAs: "M21", hd: "9d4+12"
  });
  assert.equal(lich.classKey, "magic-user");
  assert.equal(lich.level, 21);
  const sphinx = monsterSpellcasterInfo({
    spellcasting: "Female: 12th-level cleric spells; male: 12 level magic-user spells.", saveAs: "F24", hd: "12"
  });
  assert.deepEqual(sphinx.classKeys, ["magic-user", "cleric"]);
  assert.equal(sphinx.level, 12);
  assert.equal(monsterSpellcasterInfo({ saveAs: "F5", hd: "5" }), null);
});

check("each natural attack becomes its own rollable monster macro", () => {
  assert.equal(monsterDamageFormula("1d4/ld4/2d4 or 1d6 each"), "1d4");
  const manticore = monsterAttackRows({
    attacks: "2 claws/1 bite or 6 spikes",
    damage: "1d4/1d4/2d4 or 1d6 each"
  });
  assert.deepEqual(manticore.map((row) => row.name), [
    "Claw 1", "Claw 2", "Bite",
    "Spike 1", "Spike 2", "Spike 3", "Spike 4", "Spike 5", "Spike 6"
  ]);
  assert.deepEqual(manticore.map((row) => row.damage), [
    "1d4", "1d4", "2d4", "1d6", "1d6", "1d6", "1d6", "1d6", "1d6"
  ]);

  const curated = monsterAttackRows({
    attacks: "ignored", damage: "ignored",
    attackRows: [{ name: "Claw", count: 2, damage: "1d4" }, { name: "Bite", count: 1, damage: "2d4" }]
  });
  assert.deepEqual(curated.map((row) => row.name), ["Claw 1", "Claw 2", "Bite"]);
  assert.equal(monsterThac0("6 + 1"), attackSpecFor("fighter", 6).thac0);

  const grizzly = monsterAttackRows({
    attacks: "2 claws/ 1 bite", damage: "1d8/1d8/ldl0"
  });
  assert.deepEqual(grizzly.map((row) => row.name), ["Claw 1", "Claw 2", "Bite"]);
  assert.deepEqual(grizzly.map((row) => row.damage), ["1d8", "1d8", "1d10"]);

  const hydra = monsterAttackRows({ attacks: "5-12 bites (1 per head)", damage: "1d10 each" });
  assert.equal(hydra.length, 5, "variable head counts use the lowest count for buttons");
  assert.match(hydra[0].name, /^Bites/);
  assert.equal(hydra[0].damage, "1d10");
  const tentacles = monsterAttackRows({ attacks: "8", damage: "1d4 + 1 each" });
  assert.equal(tentacles.length, 8);
  assert.deepEqual(tentacles.map((row) => row.damage), Array(8).fill("1d4+1"));
});

check("name level derives titles, cleric levels, hireling limits and spell cost", () => {
  assert.equal(nameLevelThreshold("halfling"), 8);
  assert.equal(nameLevelThreshold("fighter"), 9);
  assert.equal(nameLevelOptions("fighter", "Lawful").specialization.length, 4);
  assert.deepEqual(nameLevelOptions("cleric").specialization, []);

  const paladin = nameLevelDetails({
    attributes: { classKey: "fighter", level: 9, alignment: "Lawful", adjustments: { cha: 0 } },
    abilities: { wis: { value: 13 }, cha: { value: 10 } },
    nameLevel: { path: "travelling", specialization: "paladin", hirelings: 5 }
  });
  assert.equal(paladin.title, "Paladin");
  assert.equal(paladin.clericalLevel, 3);
  assert.equal(paladin.spellLevel, 3);
  assert.equal(paladin.hirelingCap, 3);
  assert.equal(paladin.hirelingOver, true);
  assert.equal(paladin.canDetectEvil, true);
  assert.equal(paladin.canTurnUndead, true);
  assert.ok(paladin.pros.some((line) => line.includes("Detect Evil")));
  assert.ok(paladin.pros.some((line) => line.includes("3rd level cleric")));
  assert.ok(paladin.cons.some((line) => line.includes("hirelings")));

  const lowWis = nameLevelDetails({
    attributes: { class: "Fighter", level: 18, alignment: "Lawful" },
    abilities: { wis: { value: 12 }, cha: { value: 10 } },
    nameLevel: { path: "travelling", specialization: "paladin" }
  });
  assert.equal(lowWis.clericalLevel, 6);
  assert.equal(lowWis.spellLevel, 0);
  assert.equal(lowWis.canCastCleric, false);
  assert.equal(lowWis.canTurnUndead, true);
  assert.ok(lowWis.warnings.some((line) => line.includes("Wisdom 12")));

  const avenger = nameLevelDetails({
    attributes: { classKey: "fighter", level: 12, alignment: "Chaotic" },
    abilities: { wis: { value: 15 }, cha: { value: 15 } },
    nameLevel: {
      path: "travelling", specialization: "avenger", avengerSpellLevels: 4, hirelings: 9
    }
  });
  assert.equal(avenger.clericalLevel, 4);
  assert.equal(avenger.spellLevel, 4);
  assert.equal(avenger.followerRange[1], 8);
  assert.equal(avenger.hirelingCap, 8);
  assert.equal(avenger.spellCost, 40000);
  assert.equal(avenger.isAvenger, true);
  assert.ok(avenger.pros.some((line) => line.includes("control")));

  const misaligned = nameLevelDetails({
    attributes: { classKey: "fighter", level: 12, alignment: "Lawful" },
    abilities: { wis: { value: 15 }, cha: { value: 10 } },
    nameLevel: { path: "travelling", specialization: "avenger" }
  });
  assert.equal(misaligned.specialization, "");
  assert.equal(misaligned.canDetectEvil, false);
  assert.ok(misaligned.warnings.some((line) => line.includes("Chaotic")));

  const baron = nameLevelDetails({
    attributes: { classKey: "fighter", level: 9, alignment: "Neutral" },
    nameLevel: { path: "landowner", specialization: "paladin", holdingStyle: "independent" }
  });
  assert.equal(baron.title, "Independent ruler (title by DM)");
  assert.equal(baron.canDetectEvil, false);
  assert.ok(baron.cons.some((line) => line.includes("major campaign development")));

  const guildmaster = nameLevelDetails({
    attributes: { classKey: "thief", level: 9, alignment: "Neutral" },
    nameLevel: { path: "landowner" }
  });
  assert.equal(guildmaster.title, "Guildmaster");

  const early = nameLevelDetails({
    attributes: { classKey: "fighter", level: 8, alignment: "Lawful" },
    nameLevel: { path: "travelling", specialization: "paladin" }
  });
  assert.equal(early.active, false);
  assert.equal(early.canDetectEvil, false);
  assert.ok(early.warnings.some((line) => line.includes("preview")));
});

check("encounter checks use RC dice and terrain thresholds", () => {
  assert.deepEqual(
    [encounterChance({ area: "dungeon" }).formula, encounterChance({ area: "dungeon", night: true }).formula],
    ["1d6", "1d12"]
  );
  assert.equal(encounterChance({ area: "city" }).target, "1");
  assert.equal(encounterChance({ area: "wilderness", terrain: "clear" }).target, "1");
  assert.equal(encounterChance({ area: "wilderness", terrain: "ocean" }).target, "1-2");
  assert.equal(encounterChance({ area: "wilderness", terrain: "mountains" }).target, "1-3");
  assert.equal(encounterChance({ area: "wilderness", terrain: "Woods" }).target, "1-2");
  assert.equal(encounterCheck({ area: "dungeon", roll: 1 }).encounter, true);
  assert.equal(encounterCheck({ area: "dungeon", roll: 2 }).encounter, false);
  assert.equal(encounterCheck({ area: "wilderness", terrain: "swamp", roll: 3 }).encounter, true);
});

check("surprise grants a free round or automatic initiative", () => {
  const both = surpriseCheck({
    partyRoll: 2, monsterRoll: 1, partyInitiativeRoll: 3, monsterInitiativeRoll: 5
  });
  assert.equal(both.state, "both");
  assert.equal(both.lostRound, true);
  assert.equal(both.initiative.first, "monsters");

  const party = surpriseCheck({ partyRoll: 1, monsterRoll: 5 });
  assert.equal(party.state, "party");
  assert.equal(party.initiative.first, "monsters");
  assert.equal(party.initiative.automatic, true);
  assert.equal(party.initiative.partyRoll, null);

  const monsters = surpriseCheck({ partyRoll: 6, monsterRoll: 2 });
  assert.equal(monsters.state, "monsters");
  assert.equal(monsters.initiative.first, "party");
  assert.equal(monsters.freeRound, true);

  const neither = surpriseCheck({ partyRoll: 4, monsterRoll: 3, partyInitiativeRoll: 5, monsterInitiativeRoll: 4 });
  assert.equal(neither.state, "neither");
  assert.equal(neither.initiative.first, "party");
  assert.equal(neither.initiative.automatic, false);
});

check("reaction rolls follow the 2d6 table and three-roll limit", () => {
  assert.equal(reactionBand(3).key, "attack");
  assert.equal(reactionBand(5).nextModifier, -4);
  assert.equal(reactionBand(8).nextModifier, 0);
  assert.equal(reactionBand(11).nextModifier, 4);
  assert.equal(reactionBand(12).key, "friendly");

  const first = reactionStep({ roll: 10, attempt: 1, charisma: 2, action: 1 });
  assert.equal(first.modifier, 0);
  assert.equal(first.total, 10);
  assert.equal(first.reroll, true);
  assert.equal(first.state.pendingModifier, 4);

  const second = reactionStep({
    roll: 5, attempt: 2, charisma: 2, action: 1, pendingModifier: first.state.pendingModifier
  });
  assert.equal(second.modifier, 7);
  assert.equal(second.total, 12);
  assert.equal(second.band.key, "friendly");
  assert.equal(second.done, true);

  const forced = reactionStep({ roll: 8, attempt: 3, charisma: 0, action: -5 });
  assert.equal(forced.action, -2);
  assert.equal(forced.total, 6);
  assert.equal(forced.forcedOutcome, "attacks or leaves");
  assert.equal(forced.done, true);
});

check("encounter distance uses terrain, visibility and surprise overrides", () => {
  assert.equal(encounterDistance({ setting: "dungeon", visibility: "bright", roll: 4 }).distance, 40);
  assert.equal(encounterDistance({ setting: "wilderness", visibility: "dim", roll: 2 }).distance, 20);
  assert.equal(encounterDistance({ setting: "ocean", visibility: "bright", encounter: "ship" }).distance, 300);
  const both = encounterDistance({ setting: "dungeon", surprise: "both", roll: 3 });
  assert.equal(both.formula, "1d4");
  assert.equal(both.distance, 30);
  const one = encounterDistance({ setting: "wilderness", visibility: "bright", surprise: "monsters", roll: 4 });
  assert.equal(one.distance, 40);
  assert.equal(one.surprisedDistance, 20);
  assert.equal(wanderingMonsterDistance({ roll: 7 }).distance, 70);
});

check("evasion chances and pursuit follow chapter 7", () => {
  assert.equal(evasionChance({ partySize: 8, monsterCount: 12 }).base, 70);
  assert.equal(evasionChance({ partySize: 8, monsterCount: 12 }).partyBand, "5-12");
  assert.equal(evasionChance({ partySize: 8, monsterCount: 12 }).monsterBand, "9+");
  assert.equal(evasionChance({ partySize: 25, monsterCount: 1 }).partyBand, "25+");
  assert.equal(evasionChance({ partySize: 8, monsterCount: 12 }).chance, 70);
  assert.equal(evasionChance({ partySize: 8, monsterCount: 12, adjustments: { wooded: true, scouts: true } }).chance, 80);
  assert.equal(evasionChance({
    partySize: 25, monsterCount: 31,
    adjustments: { featureless: true, pursuersFaster: true, scouts: true }
  }).chance, 5);
  assert.equal(evasionCheck({ partySize: 8, monsterCount: 12, roll: 70 }).success, true);
  assert.equal(evasionCheck({ partySize: 8, monsterCount: 12, roll: 71 }).success, false);
  const round = pursuitRound({ round: 5, partyRoll: 4, monsterRoll: 2 });
  assert.equal(round.first, "party");
  assert.equal(round.moraleCheckDue, true);
  assert.equal(pursuitRound({ round: 4, partyRoll: 4, monsterRoll: 2 }).moraleCheckDue, false);
});

check("treasure types A-V choose the lair or carried table", () => {
  assert.deepEqual(Object.keys(TREASURE_TYPES), "ABCDEFGHIJKLMNOPQRSTUV".split(""));
  assert.equal(treasureTypeInfo("c", "auto").table, "lair");
  assert.equal(treasureTypeInfo("P", "auto").table, "carried");
  assert.equal(treasureTypeInfo("v").table, "carried");
  assert.equal(treasureTypeInfo("Z"), null);

  const lair = rollTreasureType({ type: "A", location: "lair" }, () => 0);
  assert.equal(lair.location, "lair");
  assert.equal(lair.coins.cp.amount, 1000);
  assert.equal(lair.coins.pp.amount, 1000);
  assert.equal(lair.coinGp, 7310);
  assert.equal(lair.gems.count, 6);
  assert.equal(lair.jewelry.count, 6);
  assert.equal(lair.magic.count, 3);
  assert.equal(lair.magic.found, true);

  const carried = rollTreasureType({ type: "P" }, () => 0.9);
  assert.equal(carried.location, "carried");
  assert.equal(carried.coins.cp.amount, 24);
  assert.equal(rollTreasureType({ type: "S" }, () => 0.9).gems.found, false);
  assert.equal(rollTreasureType({ type: "S" }, () => 0).gems.found, true);
  const carriedLow = rollTreasureType({ type: "P" }, () => 0);
  assert.equal(carriedLow.coins.cp.amount, 3);
  assert.equal(carriedLow.coinGp, 0.03);
});

check("gem, jewelry and magical item tables use the RC ranges", () => {
  assert.equal(gemValue({ roll: 98, averageLevel: 9 }).value, null);
  assert.equal(gemValue({ roll: 98, averageLevel: 5 }).adjusted, 88);
  assert.equal(gemValue({ roll: 98, averageLevel: 5 }).value, 5000);
  assert.equal(jewelryValue({ roll: 100 }).value, 50000);
  assert.equal(jewelryValue({ roll: 100 }).enc, 50);
  assert.equal(gemValue({ roll: 50 }, () => 0).value, 1000);

  assert.equal(magicItemCategory(25).key, "potions");
  assert.equal(magicItemCategory(26).key, "scrolls");
  assert.equal(magicItemCategory(100).key, "miscWeapons");
  assert.equal(rollMagicItem({ roll: 1 }, () => 0).item, "Agility");
  assert.equal(rollMagicItem({ category: "potions" }, () => 0).item, "Agility");
  const armor = rollMagicItem({ category: "armor" }, () => 0);
  assert.equal(armor.details.size, "Human");
  assert.equal(armor.details.armor, "Leather armor");
  assert.equal(armor.details.ac, "+1");
  assert.equal(armor.details.special, "Absorption");
  const missile = rollMagicItem({ category: "missiles" }, () => 0);
  assert.equal(missile.item, "Arrows +1 (2d10)");
  assert.equal(missile.details.weaponClass, "Arrows");
  assert.equal(missile.details.possibleTalent, "Biting");
});

check("magic crafting formulas follow RC pp. 250-255", () => {
  assert.deepEqual(craftingAbilityScore("cleric", { wis: { value: 16 } }), { key: "wis", label: "Wisdom", value: 16 });
  assert.deepEqual(craftingAbilityScore("elf", { int: { value: 18 } }), { key: "int", label: "Intelligence", value: 18 });
  assert.equal(craftingAbilityScore("fighter", { str: { value: 18 } }), null);
  assert.equal(craftingChance({ abilityScore: 18, level: 10, spellLevel: 3 }), 47);
  assert.equal(craftingChance({ abilityScore: 16, level: 12, bonusLevels: 2 }), 50);
  assert.equal(craftingChance({ abilityScore: 18, level: 10, spellLevel: 4, penaltyPerLevel: 5 }), 36);

  const plate = armorWeaponEnchantmentCost({ kind: "armor", priceGp: 60, encumbranceCn: 150, bonuses: 1 });
  assert.equal(plate.rawGp, 9000);
  assert.equal(plate.unroundedGp, 3000);
  assert.equal(plate.roundedBaseGp, 3000);
  assert.equal(plate.initialGp, 3000);
  const sword = armorWeaponEnchantmentCost({ kind: "weapon", priceGp: 10, encumbranceCn: 30, bonuses: 1 });
  assert.equal(sword.unroundedGp, 1500);
  assert.equal(sword.roundedBaseGp, 1500);
  assert.equal(sword.totalInitialGp, 1500);
  const special = armorWeaponEnchantmentCost({ kind: "sword", priceGp: 10, encumbranceCn: 30, bonuses: 1, bonusesAgainstOpponents: 2, restrictions: 1 });
  assert.equal(special.opponentCostGp, 1350);
  assert.equal(special.totalInitialGp, 2850);

  const charges = spellEffectCost({ spellLevels: 4, charges: 10 });
  assert.equal(charges.initialGp, 4000);
  assert.equal(charges.chargesGp, 4000);
  assert.equal(charges.totalGp, 8000);
  const permanent = spellEffectCost({ spellLevels: 4, permanent: true, restrictions: 1 });
  assert.equal(permanent.permanencyGp, 20000);
  assert.equal(permanent.totalGp, 21600);
  const nonRechargeable = spellEffectCost({ spellLevels: 4, charges: 10, nonRechargeable: true });
  assert.equal(nonRechargeable.totalGp, 6400);
  const daily = spellEffectCost({ spellLevels: 4, usesPerPeriod: "day", usesPerPeriodCount: 1 });
  assert.equal(daily.discountedInitialGp, 3000);
  assert.equal(daily.includedCharges, 31);
  assert.equal(daily.totalGp, 12300);

  assert.deepEqual(enchantmentTime(14000), { weeks: 1, extraDays: 14, days: 21 });
  assert.deepEqual(enchantmentTime(25200), { weeks: 1, extraDays: 26, days: 33 });
  assert.deepEqual(constructCost({ hitDice: 9, asterisks: 2 }), {
    hitDice: 9, asterisks: 2, hitDiceGp: 18000, asteriskGp: 10000, totalGp: 28000
  });
  assert.equal(constructChance({ abilityScore: 18, level: 18, hitDice: 9, asterisks: 2 }), 61);
  assert.deepEqual(constructRequirements({ classKey: "cleric", hitDice: 12, asterisks: 3 }), {
    requiredLevel: 18, requiredSpell: "create any monster", clericAllowed: false, overMaximum: false
  });
  assert.equal(constructRequirements({ hitDice: 37 }).overMaximum, true);

  assert.equal(researchCost(4), 4000);
  assert.deepEqual(researchTime(4), { weeks: 1, extraDays: 4, days: 11 });
  assert.equal(spellResearchChance({ abilityScore: 18, level: 12, spellLevel: 4, failures: 2 }), 58);
  assert.deepEqual(researchRollSucceeds(94, 58), { roll: 94, chance: 58, autoFailure: false, success: false });
  assert.deepEqual(researchRollSucceeds(95, 95), { roll: 95, chance: 95, autoFailure: true, success: false });
  assert.deepEqual(researchRollSucceeds(50, 58), { roll: 50, chance: 58, autoFailure: false, success: true });

  assert.equal(craftingXp({ totalGp: 8000, success: true }), 8000);
  assert.equal(craftingXp({ totalGp: 9000, success: true, huge: true }), 3000);
  assert.equal(craftingXp({ totalGp: 8000, success: true, firstTime: false }), 0);
  assert.equal(craftingXp({ totalGp: 8000, success: false }), 0);
});
