/**
 * Foundry-independent tests for playable monster compendium data.
 *
 * Checks the Rules Cyclopedia variants that used to be corrupted by the OCR
 * column flattening, plus invariants that must hold for every monster sheet.
 *
 * Usage: node tools/test-monsters.mjs
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  attackSpecFor, baseSaves, monsterAttackRows, monsterHpFormula,
  monsterHpFromHitDice, monsterSaveTargets, monsterThac0, parseMonsterSaveAs
} from "../scripts/rules-rc.mjs";

const docs = JSON.parse(await readFile(new URL("../data/monsters.json", import.meta.url), "utf8"));
const byName = new Map(docs.map((doc) => [doc.name, doc]));
const check = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

check("every monster sheet has a unique name and playable stats", () => {
  assert.ok(docs.length >= 250, `expected curated variants, got ${docs.length}`);
  assert.equal(byName.size, docs.length, "duplicate monster names");
  for (const doc of docs) {
    const system = doc.system ?? {};
    assert.ok(Number.isFinite(system.ac), `${doc.name}: invalid AC`);
    assert.ok(system.hp > 0, `${doc.name}: invalid HP`);
    assert.ok(system.morale >= 2 && system.morale <= 12, `${doc.name}: invalid morale`);
    assert.ok(system.xpValue > 0, `${doc.name}: invalid XP`);
    assert.ok(monsterAttackRows(system).length > 0, `${doc.name}: no attack buttons`);
    for (const field of ["attacks", "damage"]) {
      assert.doesNotMatch(String(system[field]), /No\.\s*Appearing|Armor Class|Hit Dice|Save As|XP Value/i,
        `${doc.name}: ${field} contains OCR column labels`);
    }
    // Special cases (for example the blackball) genuinely have no save.
    if (doc.name === "Blackball (Deadly Sphere)") continue;
    const parsed = parseMonsterSaveAs(system.saveAs, system.hd);
    assert.ok(parsed, `${doc.name}: unreadable Save As ${system.saveAs}`);
    assert.ok(monsterSaveTargets(system.saveAs, system.hd), `${doc.name}: no save targets`);
    assert.doesNotMatch(String(system.saveAs), /\s+[CFMTEHD]\d/, `${doc.name}: ambiguous multi-column Save As`);
  }
});

function expectStats(name, fields) {
  const doc = byName.get(name);
  assert.ok(doc, `missing ${name}`);
  const system = doc.system;
  for (const [key, expected] of Object.entries(fields)) {
    assert.equal(system[key], expected, `${name}.${key}`);
  }
  if (!doc.flags?.becmi?.exactHp) {
    assert.equal(monsterHpFromHitDice(system.hd), system.hp, `${name}: HP must match HD`);
  }
  assert.ok(monsterAttackRows(system).length > 0, `${name}: no attack buttons`);
}

check("fish and lizard variants use their own HD, AC, saves and XP", () => {
  expectStats("Fish, Giant (Rockfish)", { hd: "5+5", hp: 28, ac: 1, saveAs: "F3", xpValue: 400, damage: "1d4 each + poison" });
  expectStats("Fish, Giant (Sturgeon)", { hd: "10+2", hp: 47, ac: 0, saveAs: "F5", xpValue: 1900, damage: "2d10" });
  expectStats("Lizard, Giant (Gecko)", { hd: "3+1", hp: 15, ac: 5, saveAs: "F2", xpValue: 50, damage: "1d8" });
  expectStats("Lizard, Giant (Draco)", { hd: "4+2", hp: 20, ac: 5, saveAs: "F3", xpValue: 125, damage: "1d10" });
});

check("giant spider variants are no longer shuffled", () => {
  expectStats("Spider, Giant (Crab)", { hd: "2", hp: 9, ac: 7, saveAs: "F1", xpValue: 25, damage: "1d8 + poison" });
  expectStats("Spider, Giant (Black Widow)", { hd: "3", hp: 14, ac: 6, saveAs: "F2", xpValue: 50, damage: "2d6 + poison" });
  expectStats("Spider, Giant (Tarantella)", { hd: "4", hp: 18, ac: 5, saveAs: "F2", xpValue: 125, damage: "1d8 + poison" });
});

check("gargantuas and rocs keep the RC Hit Dice and XP", () => {
  expectStats("Gargantua (Carrion Crawler)", { hd: "25", hp: 113, ac: 3, saveAs: "F13", xpValue: 6500 });
  expectStats("Gargantua (Gargoyle)", { hd: "32", hp: 144, ac: 4, saveAs: "F32", xpValue: 10000 });
  expectStats("Gargantua (Troll)", { hd: "51", hp: 230, ac: 4, saveAs: "F36", xpValue: 29000 });
  expectStats("Roc (Small)", { hd: "6", hp: 27, ac: 4, saveAs: "F3", xpValue: 275 });
  expectStats("Roc (Large)", { hd: "12", hp: 54, ac: 2, saveAs: "F6", xpValue: 1250 });
  expectStats("Roc (Giant)", { hd: "36", hp: 162, ac: -2, saveAs: "F18", xpValue: 6250 });
  assert.equal(monsterThac0("36"), attackSpecFor("fighter", 36).thac0);
});

check("dragon ages carry the correct AC, HD, save and XP", () => {
  expectStats("Dragon, Black (Small)", { hd: "7", hp: 32, ac: 2, saveAs: "F7", xpValue: 1250 });
  expectStats("Dragon, Black (Large)", { hd: "10+3", hp: 48, ac: 0, saveAs: "F21", xpValue: 3500 });
  expectStats("Dragon, Black (Huge)", { hd: "14", hp: 63, ac: -2, saveAs: "F36", xpValue: 5500, damage: "1d8 + 3/1d8 + 3/2d10 + 8" });
  expectStats("Dragon, Blue (Small)", { hd: "9", hp: 41, ac: 0, saveAs: "F9", xpValue: 2300 });
  expectStats("Dragon, Blue (Huge)", { hd: "18", hp: 81, ac: -4, saveAs: "F36", xpValue: 7525 });
  expectStats("Dragon, White (Huge)", { hd: "12", hp: 54, ac: -1, saveAs: "F36", xpValue: 4750 });
  expectStats("Dragon, Gold (Huge)", { hd: "22", hp: 99, ac: -6, saveAs: "F36", xpValue: 11750 });
});

check("variable-HD monsters are one sheet per HD step", () => {
  expectStats("Horde (3 HD)", { hd: "3", hp: 14, saveAs: "F3", xpValue: 50, damage: "1d6" });
  expectStats("Horde (11-12 HD)", { hd: "11-12", hp: 50, saveAs: "F11", xpValue: 1900, damage: "2d8" });
  expectStats("Hydra (5 HD)", { hd: "5", hp: 40, saveAs: "F5", xpValue: 175 });
  assert.equal(monsterHpFormula("5"), "5d8");
  assert.equal(monsterAttackRows(byName.get("Hydra (5 HD)").system).length, 5);
  expectStats("Vampire (7 HD)", { hd: "7", hp: 32, saveAs: "F7", xpValue: 1250 });
  expectStats("Slug, Giant (9 HD)", { hd: "9", hp: 41, saveAs: "F (level = 1/2 HD)", xpValue: 2300 });
  assert.deepEqual(monsterSaveTargets("F (level = 1/2 HD)", "9"), baseSaves("fighter", 5));
  expectStats("Giant (Mountain, 12 HD)", { hd: "12", hp: 54, saveAs: "F (level = HD)", xpValue: 2125 });
  assert.deepEqual(monsterSaveTargets("F (level = HD)", "12"), baseSaves("fighter", 12));
  expectStats("Hag (Black, 11 HD)", { hd: "11", hp: 50, saveAs: "C (level = HD)", xpValue: 4300 });
  assert.deepEqual(monsterSaveTargets("C (level = HD)", "11"), baseSaves("cleric", 11));
});

check("special undead and planar variants have usable saves and attacks", () => {
  expectStats("Phantom (Apparition)", { hd: "10", hp: 45, saveAs: "M10", xpValue: 3250 });
  expectStats("Phantom (Shade)", { hd: "11", hp: 50, saveAs: "T11", xpValue: 3500 });
  expectStats("Phantom (Vision)", { hd: "12", hp: 54, saveAs: "C12", xpValue: 3875 });
  expectStats("Spirit (Druj)", { hd: "14", hp: 63, saveAs: "F14", xpValue: 5500 });
  expectStats("Spirit (Odic)", { hd: "16", hp: 72, saveAs: "F16", xpValue: 6250 });
  expectStats("Lich (Magic-User 21)", { hd: "9d4+12", hp: 35, saveAs: "M21", xpValue: 12500 });
  assert.equal(monsterHpFormula("9d4+12"), "9d4+12");
  assert.deepEqual(monsterSaveTargets("M21", "9d4+12"), baseSaves("magic-user", 21));
  expectStats("Rust Monster", { hd: "5", hp: 23, saveAs: "F3", xpValue: 300 });
  expectStats("Salamander (Flame)", { hd: "8", hp: 36, saveAs: "F8", xpValue: 1200 });
  expectStats("Salamander (Frost)", { hd: "12", hp: 54, saveAs: "F12", xpValue: 2125 });
});

check("range and table monsters have one sheet per Rules Cyclopedia row", () => {
  expectStats("Dinosaur, Aquatic (Small)", { hd: "2-8", hp: 9, ac: 7, saveAs: "F (level = 1/2 HD)", xpValue: 30 });
  expectStats("Dinosaur, Aquatic (Large)", { hd: "9-24", hp: 41, ac: 5, saveAs: "F (level = 1/2 HD)", xpValue: 3700 });
  expectStats("Dinosaur, Aquatic (Armored)", { hd: "6-9", hp: 27, ac: 2, saveAs: "F (level = 1/2 HD)", xpValue: 2300 });

  expectStats("Elemental (Air, Staff)", { hd: "8", hp: 36, ac: 2, saveAs: "F8", xpValue: 650, damage: "1d8" });
  expectStats("Elemental (Air, Device)", { hd: "12", hp: 54, ac: 0, saveAs: "F12", xpValue: 1250, damage: "2d8" });
  expectStats("Elemental (Fire, Spell)", { hd: "16", hp: 72, ac: -2, saveAs: "F16", xpValue: 1850, damage: "3d8" });
  expectStats("Elemental (Water, Staff)", { hd: "8", hp: 36, ac: 2, saveAs: "F8", xpValue: 650 });
  expectStats("Elemental Ruler (41 HD)", { hd: "41", hp: 185, ac: -11, saveAs: "F36", xpValue: 28500, damage: "8d12" });
  expectStats("Elemental Ruler (73 HD)", { hd: "73", hp: 329, ac: -15, saveAs: "F36", xpValue: 60500, damage: "12d12" });

  expectStats("Hydrax (5 HD)", { hd: "5", hp: 23, saveAs: "F (level = 2 X HD)", xpValue: 425 });
  expectStats("Hydrax (12 HD)", { hd: "12", hp: 54, saveAs: "F (level = 2 X HD)", xpValue: 3000 });
  assert.deepEqual(monsterSaveTargets("F (level = 2 X HD)", "12"), baseSaves("fighter", 24));
  expectStats("Animal Herd (1 HD)", { hd: "1", hp: 5, saveAs: "F1", xpValue: 10 });
  expectStats("Animal Herd (4 HD)", { hd: "4", hp: 18, saveAs: "F1", xpValue: 75 });
  expectStats("Blackball (Deadly Sphere)", { hd: "None", hp: 1, xpValue: 7500, damage: "Disintegration (no save)" });
  expectStats("Scorpion, Giant", { hd: "4", hp: 18, ac: 2, saveAs: "F2", xpValue: 125, damage: "1d10/1d10/1d4 + poison" });
  expectStats("Spider, Giant (Tarantella)", { appearing: "1d3 (1d3)" });
  expectStats("Snake (Giant Rattler)", { damage: "1d4 + poison" });
});
