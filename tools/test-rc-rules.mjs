/**
 * Foundry-independent tests for the Rules Cyclopedia tables and automations.
 *
 * Usage: node tools/test-rc-rules.mjs
 */
import assert from "node:assert/strict";
import { classFeaturesFor } from "../scripts/class-features.mjs";
import { nameLevelDetails, nameLevelOptions, nameLevelThreshold } from "../scripts/name-level.mjs";
import {
  RC, adjustment, armorBase, attackInfo, attackNeeded, attackRows, attackSpecFor,
  baseSaves, baseThiefSkills, chooseDamage, computeArmorClass, computeLoad,
  finalDamage, hpForLevel, masteryChoices, masteryData, masteryWeapon,
  levelForXp, monsterAttackRows, monsterDamageFormula, monsterHpFormula, monsterHpFromHitDice,
  monsterSaveTargets, monsterSpellcasterInfo, monsterThac0, normalizeClassKey,
  parseMonsterHitDice, parseMonsterSaveAs,
  planAbilityAdjustment, resolveTurnResult,
  rollExpression, spellKey, spellSlotsForLevel, spellsFor, sumDamage,
  turnUndeadCell, turnUndeadColumn, turnUndeadTable, xpForNextLevel, xpThresholds
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

check("spell slots and spell lists use the extracted tables", () => {
  assert.deepEqual(spellSlotsForLevel("cleric", 3), [2, 0, 0, 0, 0, 0, 0]);
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
  assert.equal(rollExpression("not dice").valid, false);
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
