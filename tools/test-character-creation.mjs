/**
 * Foundry-independent tests for the Rules Cyclopedia character wizard rules.
 *
 * Usage: node tools/test-character-creation.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  ABILITY_KEYS, PURCHASE_ITEMS, WIZARD_STEPS, applyCreationSwap,
  availableStartingItems, buildCharacterPlan, deriveArmorFromItems,
  normalizeAlignment, purchaseSummary, rollAbilities, roll3d6, scoresFromRolls,
  startingGoldFromRolls, startingHpFor, suggestLanguages, toActorUpdates,
  validateAlignment, validateArmor, validateMinimumRequirements, validateRace
} from "../scripts/character-creation.mjs";

const check = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

const sequence = (values) => {
  let index = 0;
  return () => values[index++ % values.length];
};

check("the wizard covers the full RC creation checklist", () => {
  assert.deepEqual([...WIZARD_STEPS], [
    "identity", "abilities", "class", "combat", "languages", "equipment", "review"
  ]);
});

check("purchase names resolve to real compendium documents", () => {
  const root = new URL("../", import.meta.url);
  const equipment = JSON.parse(readFileSync(fileURLToPath(new URL("data/equipment.json", root)), "utf8"));
  const classes = JSON.parse(readFileSync(fileURLToPath(new URL("data/classes.json", root)), "utf8"));
  const equipmentNames = new Set(equipment.map((entry) => entry.name));
  const classNames = new Set(classes.map((entry) => entry.name));
  const missing = PURCHASE_ITEMS.map((item) => item.name).filter((name) => !equipmentNames.has(name));
  assert.deepEqual(missing, []);
  for (const name of ["Cleric", "Fighter", "Magic-User", "Thief", "Dwarf", "Elf", "Halfling", "Mystic"]) {
    assert.ok(classNames.has(name), `${name} is missing from the class compendium`);
  }
});

check("3d6 rolls are in order and clamp to a d6", () => {
  assert.deepEqual(roll3d6(sequence([0, 0.99, 0.5])), [1, 6, 4]);
  const rolled = rollAbilities(sequence([0]));
  assert.deepEqual(rolled.scores, Object.fromEntries(ABILITY_KEYS.map((key) => [key, 3])));
  assert.equal(rolled.rolls.length, 6);
  assert.ok(rolled.rolls.every((entry) => entry.length === 3));
});

check("flat and grouped roll input produce the same scores", () => {
  const flat = Array.from({ length: 18 }, () => 3);
  const grouped = Array.from({ length: 6 }, () => [3, 3, 3]);
  const expected = Object.fromEntries(ABILITY_KEYS.map((key) => [key, 9]));
  assert.deepEqual(scoresFromRolls(flat).scores, expected);
  assert.deepEqual(scoresFromRolls(grouped).scores, expected);
});

check("creation swap trades two non-primary points for one prime point", () => {
  const before = { str: 15, int: 12, wis: 12, dex: 10, con: 12, cha: 10 };
  const after = applyCreationSwap("fighter", before, 1);
  assert.equal(after.swaps, 1);
  assert.equal(after.scores.str, 16);
  assert.equal(after.scores.int, 10);
  assert.equal(after.scores.dex, 10);
  assert.equal(after.scores.con, 12);
});

check("demihuman and mystic requirements follow RC p. 7", () => {
  const dwarfOk = validateMinimumRequirements("dwarf", { con: 9 });
  assert.equal(dwarfOk.ok, true);
  assert.deepEqual(dwarfOk.requirements, [{ key: "con", minimum: 9, name: "Constitution" }]);

  const dwarfBad = validateMinimumRequirements("dwarf", { con: 8 });
  assert.equal(dwarfBad.ok, false);
  assert.equal(dwarfBad.issues[0].code, "missingRequirement");

  assert.equal(validateMinimumRequirements("elf", { int: 8 }).ok, false);
  assert.equal(validateMinimumRequirements("halfling", { dex: 9, con: 9 }).ok, true);
  assert.equal(validateMinimumRequirements("halfling", { dex: 9, con: 8 }).ok, false);
  assert.equal(validateMinimumRequirements("mystic", { sab: 12, des: 13 }).ok, false);
  assert.equal(validateMinimumRequirements("mystic", { wis: 13, dex: 13 }).ok, true);
});

check("alignment is normalized and race follows the demihuman class", () => {
  assert.equal(normalizeAlignment("Law"), "lawful");
  assert.equal(normalizeAlignment("Chaotic"), "chaotic");
  assert.equal(normalizeAlignment("neutral"), "neutral");
  assert.equal(normalizeAlignment("LG"), null);
  assert.equal(validateAlignment("fighter", "lawful").ok, true);
  assert.equal(validateAlignment("fighter", "LG").ok, false);
  assert.equal(validateRace("elf", "Elf").ok, true);
  assert.equal(validateRace("elf", "Human").ok, false);
  assert.equal(validateRace("fighter", "Dwarf").ok, false);
});

check("armor restrictions are enforced by class", () => {
  assert.equal(validateArmor("magic-user", "nenhuma", false).ok, true);
  assert.equal(validateArmor("magic-user", "placas", false).ok, false);
  assert.equal(validateArmor("magic-user", "nenhuma", true).ok, false);
  assert.equal(validateArmor("thief", "couro", false).ok, true);
  assert.equal(validateArmor("thief", "malha", false).ok, false);
  assert.equal(validateArmor("druid", "couro", true).ok, true);
  assert.equal(validateArmor("druid", "placas", false).ok, false);
});

check("languages follow intelligence, alignment and racial tongues", () => {
  const cleric = suggestLanguages({ intelligence: 18, classKey: "cleric", alignment: "lawful" });
  assert.deepEqual(cleric.languages, ["Common", "Lawful tongue"]);
  assert.equal(cleric.bonus, 3);
  assert.match(cleric.note, /Choose 3 additional languages/);

  const dwarf = suggestLanguages({ intelligence: 10, classKey: "dwarf", alignment: "neutral" });
  assert.ok(dwarf.languages.includes("Dwarvish"));
  assert.ok(dwarf.languages.includes("Kobold"));

  const illiterate = suggestLanguages({ intelligence: 4, classKey: "fighter", alignment: "neutral" });
  assert.equal(illiterate.literate, false);
  assert.match(illiterate.note, /Cannot read or write Common/);
});

check("starting HP rolls the class die with the Constitution adjustment", () => {
  assert.equal(startingHpFor("fighter", 18, () => 0.99).gain, 11);
  assert.equal(startingHpFor("fighter", 3, () => 0).gain, 1);
  assert.equal(startingHpFor("magic-user", 10, () => 0.99, { startAtMaximum: true }).gain, 4);
});

check("purchases use the equipment catalog and class restrictions", () => {
  assert.deepEqual(startingGoldFromRolls([4, 4, 4]), { gold: 120, rolls: [4, 4, 4] });
  const summary = purchaseSummary(["Sword, Short", "Leather Armor", "missing item"]);
  assert.equal(summary.cost, 27);
  assert.equal(summary.weight, 230);
  assert.deepEqual(summary.unknown, ["missing item"]);
  assert.ok(availableStartingItems("magic-user").some((item) => item.name === "Dagger, Normal"));
  assert.ok(!availableStartingItems("magic-user").some((item) => item.name === "Sword, Normal"));
  assert.ok(!availableStartingItems("thief").some((item) => item.name === "Shield"));
});

check("the character plan applies RC choices without writing derived fields", () => {
  const plan = buildCharacterPlan({
    name: "Aramil", player: "Alice", classKey: "fighter", race: "Human", alignment: "lawful",
    abilities: { str: 15, int: 12, wis: 12, dex: 14, con: 13, cha: 10 },
    swapCount: 1, hp: 9, goldRolls: [4, 4, 4],
    items: ["Sword, Short", "Leather Armor"], languages: "Elvish",
    height: "5'8\"", weight: "150 lb",
    generalSkillsEnabled: true, masteryEnabled: false
  });

  assert.equal(plan.blocking, false);
  assert.deepEqual(plan.issues, []);
  assert.equal(plan.changes.name, "Aramil");
  assert.equal(plan.changes["system.abilities"].str.value, 16);
  assert.equal(plan.changes["system.attributes.hp"].value, 9);
  assert.equal(plan.changes["system.attributes.gold.gp"], 93);
  assert.equal(plan.changes["system.attributes.armor.type"], "couro");
  assert.equal(plan.changes["system.attributes.alignment"], "Lawful");
  assert.equal(plan.changes["system.attributes.primeRequisite"], "Strength");
  assert.equal(plan.changes["system.attributes.details.height"], "5'8\"");
  assert.equal(plan.changes["system.attributes.details.weight"], "150 lb");
  assert.equal(plan.changes["flags.becmi.classInfo"].key, "fighter");
  assert.equal(plan.preview.generalSkillSlots, 4);
  assert.equal(plan.preview.armorType, "couro");
  assert.equal(plan.preview.shield, false);
  assert.ok(!("system.attributes.xpNext" in plan.changes));
  assert.ok(!("system.attributes.ac.value" in plan.changes));
  assert.ok(!("system.attributes.thac0" in plan.changes));
  assert.deepEqual(plan.itemsToCreate, ["Sword, Short", "Leather Armor"]);
  assert.deepEqual(toActorUpdates(plan), plan.changes);
});

check("budget, requirement and armor errors block the plan", () => {
  const plan = buildCharacterPlan({
    name: "Poor Mage", classKey: "magic-user", race: "Human", alignment: "neutral",
    abilities: { str: 10, int: 10, wis: 10, dex: 10, con: 10, cha: 10 },
    goldRolls: [1, 1, 1],
    items: ["Dagger, Normal", "Chain Mail", "Shield"]
  });
  const codes = plan.issues.map((entry) => entry.code);
  assert.equal(plan.blocking, true);
  assert.ok(codes.includes("overBudget"));
  assert.ok(codes.includes("armorNotAllowed"));
  assert.ok(codes.includes("shieldNotAllowed"));
  assert.equal(plan.changes["system.attributes.armor.type"], "nenhuma");
  assert.equal(plan.changes["system.attributes.armor.shield"], false);
});

check("a demihuman character cannot be created with the wrong race", () => {
  const plan = buildCharacterPlan({
    name: "Wrong Elf", classKey: "elf", race: "Human", alignment: "neutral",
    abilities: { str: 10, int: 12, wis: 10, dex: 10, con: 10, cha: 10 },
    goldRolls: [3, 3, 3]
  });
  assert.equal(plan.blocking, true);
  assert.ok(plan.issues.some((entry) => entry.code === "raceMismatch"));
});

check("armor and shield come only from purchased equipment", () => {
  assert.deepEqual(deriveArmorFromItems(["Chain Mail", "Shield"]),
    { armorType: "malha", shield: true });
  assert.deepEqual(deriveArmorFromItems(["Club"]),
    { armorType: "nenhuma", shield: false });

  const plan = buildCharacterPlan({
    name: "Armored", classKey: "fighter", race: "Human", alignment: "lawful",
    abilities: { str: 14, int: 13, wis: 10, dex: 12, con: 12, cha: 10 },
    goldRolls: [6, 6, 6], items: ["Chain Mail", "Shield"], hp: 11
  });
  assert.equal(plan.blocking, false);
  assert.equal(plan.changes["system.attributes.armor.type"], "malha");
  assert.equal(plan.changes["system.attributes.armor.shield"], true);
  assert.equal(plan.preview.generalSkillSlots, 5);
});

check("language suggestions are not duplicated when reused as extra text", () => {
  const plan = buildCharacterPlan({
    name: "Linguist", classKey: "cleric", race: "Human", alignment: "lawful",
    abilities: { str: 10, int: 18, wis: 14, dex: 10, con: 10, cha: 10 },
    goldRolls: [4, 4, 4], languages: "Common; Lawful tongue"
  });
  assert.equal(plan.changes["system.languages"], "Common; Lawful tongue");
});
