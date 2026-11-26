/**
 * Per-variant stat blocks restored from the page-ordered Rules Cyclopedia.
 *
 * The OCR collapsed multi-column tables into a single row, shuffling HD, AC,
 * save levels, XP and attacks between variants. These sheets replace those
 * artifacts with one playable document per named creature or Hit Dice step.
 * The read-only oracle is C:\Users\Usuário\OneDrive\Documents\Rules_Cyclopedia.md.
 */
import { fixDice } from "./normalize.mjs";
import { monsterHpFromHitDice } from "../scripts/rules-rc.mjs";

function sheet(name, fields) {
  const hd = String(fields.hd ?? "1");
  const exactHp = Number.isFinite(fields.hp) ? Math.max(1, Number(fields.hp)) : null;
  const special = (Array.isArray(fields.special) ? fields.special : [fields.special ?? ""])
    .map((line) => String(line).replace(/\s+/g, " ").trim())
    .filter(Boolean);
  return {
    name,
    type: "monster",
    flags: {
      becmi: {
        source: "Rules Cyclopedia",
        key: name,
        category: fields.category ?? "Monster",
        variant: fields.variant ?? "",
        ...(exactHp ? { exactHp: true } : {})
      }
    },
    system: {
      ac: fields.ac ?? 9,
      hd,
      hp: exactHp ?? monsterHpFromHitDice(hd),
      move: { dungeon: fields.move?.[0] ?? 120, outdoor: fields.move?.[1] ?? 40 },
      attacks: fixDice(fields.attacks ?? "1 attack"),
      damage: fixDice(fields.damage ?? "By weapon"),
      appearing: fixDice(fields.appearing ?? "1"),
      saveAs: fields.saveAs ?? "F1",
      morale: fields.morale ?? 7,
      treasure: fields.treasure ?? "Nil",
      intelligence: fields.intelligence ?? 5,
      alignment: fields.alignment ?? "Neutral",
      xpValue: fields.xp ?? 1,
      terrain: fields.terrain ?? "Any",
      monsterType: fields.monsterType ?? "Monster",
      spellcasting: String(fields.spellcasting ?? ""),
      special,
      description: String(fields.description ?? `${name} — Rules Cyclopedia stat block.`).replace(/\s+/g, " ").trim(),
      notes: "",
      source: "Rules Cyclopedia",
      page: 0
    }
  };
}

function group(rows) {
  return rows.map(([name, fields]) => sheet(name, fields));
}

const animals = group([
  ["Bat (Normal)", { category: "Normal Animal", monsterType: "Normal Animal", ac: 6, hd: "1/4", hp: 1, move: [9, 3], attacks: "Confusion", damage: "Nil", saveAs: "Normal Man", morale: 6, appearing: "d100 (d100)", intelligence: 2, terrain: "Any", special: "Echolocation: normal bats confuse intruders in darkness." }],
  ["Bat (Giant)", { category: "Normal Animal", monsterType: "Giant Animal", ac: 6, hd: "2", move: [30, 10], attacks: "1 bite", damage: "1d4", saveAs: "F1", morale: 8, appearing: "1d10 (1d10)", xp: 20, intelligence: 2, terrain: "Any" }],
  ["Rat (Normal)", { category: "Normal Animal", monsterType: "Normal Animal", ac: 9, hd: "1", hp: 1, move: [60, 20], attacks: "1 bite per pack", damage: "1d6 + disease", saveAs: "Normal Man", morale: 5, appearing: "1d10 x 5 (1d10 x 2)", treasure: "L", xp: 2, intelligence: 2, terrain: "Any" }],
  ["Rat (Giant)", { category: "Normal Animal", monsterType: "Normal Animal", ac: 7, hd: "1/2", hp: 2, move: [120, 40], attacks: "1 bite each", damage: "1d3 + disease", saveAs: "Normal Man", morale: 8, appearing: "3d6 (3d10)", treasure: "L", xp: 5, intelligence: 2, terrain: "Any" }],
  ["Snake (Spitting Cobra)", { category: "Normal Animal", monsterType: "Normal Animal", ac: 7, hd: "1", move: [90, 30], attacks: "1 bite or 1 spit", damage: "1d3 + poison", saveAs: "F1", morale: 7, appearing: "1d6 (1d6)", xp: 13, intelligence: 2, terrain: "Any" }],
  ["Snake (Giant Racer)", { category: "Normal Animal", monsterType: "Normal Animal", ac: 5, hd: "2", move: [120, 40], attacks: "1 bite", damage: "1d6", saveAs: "F1", morale: 7, appearing: "1d6 (1d8)", xp: 20, intelligence: 2, terrain: "Any" }],
  ["Snake (Pit Viper)", { category: "Normal Animal", monsterType: "Normal Animal", ac: 6, hd: "2", move: [90, 30], attacks: "1 bite", damage: "1d4 + poison", saveAs: "F1", morale: 7, appearing: "1d8 (1d8)", xp: 25, intelligence: 2, terrain: "Any" }],
  ["Snake (Sea)", { category: "Normal Animal", monsterType: "Normal Animal", ac: 6, hd: "3", move: [90, 30], attacks: "1 bite", damage: "1 + poison", saveAs: "F2", morale: 7, appearing: "0 (1d8)", xp: 50, intelligence: 2, terrain: "Ocean" }],
  ["Snake (Giant Rattler)", { category: "Normal Animal", monsterType: "Normal Animal", ac: 5, hd: "4", move: [120, 40], attacks: "2 bites", damage: "1d4 + poison", saveAs: "F2", morale: 8, appearing: "1d4 (1d4)", treasure: "U", xp: 125, intelligence: 2, terrain: "Any" }],
  ["Snake (Rock Python)", { category: "Normal Animal", monsterType: "Normal Animal", ac: 6, hd: "5", move: [90, 30], attacks: "1 bite/1 squeeze", damage: "1d4/2d4", saveAs: "F3", morale: 8, appearing: "1d3 (1d3)", treasure: "U", xp: 300, intelligence: 2, terrain: "Any" }],
  ["Toad (Giant)", { category: "Normal Animal", monsterType: "Giant Animal", ac: 1, hd: "2+2", move: [90, 30], attacks: "1 bite", damage: "1d4 + 1", saveAs: "F1", morale: 6, appearing: "1d4 (1d6)", xp: 25, intelligence: 2 }],
  ["Toad (Rock/Cave)", { category: "Normal Animal", monsterType: "Giant Animal", ac: 2, hd: "3+1", move: [60, 20], attacks: "1 bite + special", damage: "1d6 + charm", saveAs: "F3", morale: 7, appearing: "1d4 (1d4)", treasure: "V", xp: 75, intelligence: 2 }],
  ["Lizard, Giant (Gecko)", { category: "Normal Animal", monsterType: "Giant Animal", ac: 5, hd: "3+1", move: [120, 40], attacks: "1 bite", damage: "1d8", saveAs: "F2", morale: 7, appearing: "1d6 (1d10)", treasure: "U", xp: 50, intelligence: 2 }],
  ["Lizard, Giant (Draco)", { category: "Normal Animal", monsterType: "Giant Animal", ac: 5, hd: "4+2", move: [120, 40], attacks: "1 bite", damage: "1d10", saveAs: "F3", morale: 7, appearing: "1d4 (1d8)", treasure: "U", xp: 125, intelligence: 2, special: "Glide: 150' (50')." }],
  ["Lizard, Giant (Horned Chameleon)", { category: "Normal Animal", monsterType: "Giant Animal", ac: 2, hd: "5", move: [120, 40], attacks: "1 bite/1 horn", damage: "2d4/1d6", saveAs: "F3", morale: 7, appearing: "1d3 (1d6)", treasure: "U", xp: 300, intelligence: 2 }],
  ["Lizard, Giant (Tuatara)", { category: "Normal Animal", monsterType: "Giant Animal", ac: 4, hd: "6", move: [90, 30], attacks: "2 claws/1 bite", damage: "1d4/1d4/2d6", saveAs: "F3", morale: 6, appearing: "1d2 (1d4)", treasure: "V", xp: 275, intelligence: 2 }],
  ["Fish, Giant (Bass)", { category: "Normal Animal", monsterType: "Giant Animal", ac: 7, hd: "2", move: [120, 40], attacks: "1 bite", damage: "1d6", saveAs: "F1", morale: 8, appearing: "0 (2d4)", xp: 20, intelligence: 1, terrain: "River/Lake" }],
  ["Fish, Giant (Rockfish)", { category: "Normal Animal", monsterType: "Giant Animal", ac: 1, hd: "5+5", move: [180, 60], attacks: "4 spines + poison (special)", damage: "1d4 each + poison", saveAs: "F3", morale: 8, appearing: "0 (2d4)", xp: 400, intelligence: 1, terrain: "Ocean" }],
  ["Fish, Giant (Sturgeon)", { category: "Normal Animal", monsterType: "Giant Animal", ac: 0, hd: "10+2", move: [180, 60], attacks: "1 bite", damage: "2d10", saveAs: "F5", morale: 9, appearing: "0 (2d10)", xp: 1900, intelligence: 1, terrain: "River/Lake, Ocean" }]
]);

const lowlife = group([
  ["Spider, Giant (Crab)", { category: "Lowlife", monsterType: "Lowlife (Rare)", ac: 7, hd: "2", move: [120, 40], attacks: "1 bite", damage: "1d8 + poison", saveAs: "F1", morale: 7, appearing: "1d4 (1d4)", treasure: "U", xp: 25, intelligence: 0, special: "Poison: save vs. poison at +2 or die in 1d4 turns." }],
  ["Spider, Giant (Black Widow)", { category: "Lowlife", monsterType: "Lowlife (Rare)", ac: 6, hd: "3", move: [60, 20], attacks: "1 bite", damage: "2d6 + poison", saveAs: "F2", morale: 8, appearing: "1d3 (1d3)", treasure: "U", xp: 50, intelligence: 0, special: "Poison: save vs. poison or die in 1 turn. Webbing acts as the web spell." }],
  ["Spider, Giant (Tarantella)", { category: "Lowlife", monsterType: "Lowlife (Rare)", ac: 5, hd: "4", move: [120, 40], attacks: "1 bite", damage: "1d8 + poison", saveAs: "F2", morale: 8, appearing: "1d3 (1d3)", treasure: "U", xp: 125, intelligence: 0, special: "Poison: save vs. poison or dance for 2d6 turns; observers save vs. spells." }]
]);

const monsters = group([
  ["Gargantua (Carrion Crawler)", { category: "Monster", monsterType: "Lowlife (Very Rare)", ac: 3, hd: "25", move: [240, 80], attacks: "8 tentacles", damage: "1d4 + 1 each", saveAs: "F13", morale: 11, appearing: "1 (1)", treasure: "B x 4", xp: 6500, intelligence: 0, special: "Paralysis: victims failing a save vs. paralysis are paralysed." }],
  ["Gargantua (Gargoyle)", { category: "Monster", monsterType: "Construct, Enchanted (Very Rare)", ac: 4, hd: "32", move: [180, 60], attacks: "4 claws", damage: "4d3/4d3/4d6/4d4", saveAs: "F32", morale: 11, appearing: "1 (1)", treasure: "C x 4", xp: 10000, intelligence: 5, special: "Can be hit only by magical weapons." }],
  ["Gargantua (Troll)", { category: "Monster", monsterType: "Humanoid (Very Rare)", ac: 4, hd: "51", move: [240, 80], attacks: "3 claws", damage: "4d6/4d6/4d10", saveAs: "F36", morale: 11, appearing: "1 (1)", treasure: "D x 4", xp: 29000, intelligence: 6, special: "Regenerates 3 hp per round." }],
  ["Roc (Small)", { category: "Monster", monsterType: "Monster (Rare)", ac: 4, hd: "6", move: [60, 20], attacks: "2 claws/1 bite", damage: "1d4 + 1/1d4 + 1/2d6", saveAs: "F3", morale: 8, appearing: "0 (1d12)", xp: 275, intelligence: 2, alignment: "Lawful", special: "Flying: 480' (160')." }],
  ["Roc (Large)", { category: "Monster", monsterType: "Monster (Rare)", ac: 2, hd: "12", move: [60, 20], attacks: "2 claws/1 bite", damage: "1d8/1d8/2d10", saveAs: "F6", morale: 9, appearing: "0 (1d8)", xp: 1250, intelligence: 2, alignment: "Lawful", special: "Flying: 480' (160')." }],
  ["Roc (Giant)", { category: "Monster", monsterType: "Monster (Rare)", ac: -2, hd: "36", move: [60, 20], attacks: "2 claws/1 bite", damage: "3d6/3d6/8d6", saveAs: "F18", morale: 10, appearing: "0 (1)", xp: 6250, intelligence: 2, alignment: "Lawful", special: "Flying: 480' (160')." }],
  ["Dragon Turtle", { category: "Dragon", monsterType: "Dragon-Kin (Rare)", ac: -2, hd: "30", move: [30, 10], attacks: "2 claws/1 bite", damage: "1d8/1d8/1d6 x 10", saveAs: "F15", morale: 10, appearing: "0 (1)", treasure: "H", xp: 9000, intelligence: 5, alignment: "Chaotic", special: "Steam breath cloud 50' x 40', damage equal to a dragon's breath weapon." }]
]);

const DRAGONS = [
  { color: "White", ac: [3, 1, -1], hd: ["6", "9", "12"], saveAs: ["F6", "F18", "F36"], xp: [725, 3000, 4750], morale: [8, 8, 10], claw: ["1d4", "1d6 + 1", "1d8 + 2"], bite: ["2d8", "2d8 + 4", "2d8 + 8"], breath: "Cold cone", alignment: "Neutral", treasure: ["H", "H x 2, I", "H x 3, I x 2"] },
  { color: "Black", ac: [2, 0, -2], hd: ["7", "10+3", "14"], saveAs: ["F7", "F21", "F36"], xp: [1250, 3500, 5500], morale: [8, 9, 10], claw: ["1d4 + 1", "1d6 + 2", "1d8 + 3"], bite: ["2d10", "2d10 + 4", "2d10 + 8"], breath: "Acid line", alignment: "Chaotic", treasure: ["H", "H x 2, I", "H x 3, I x 2"] },
  { color: "Green", ac: [1, -1, -3], hd: ["8", "12", "16"], saveAs: ["F8", "F24", "F36"], xp: [1750, 3875, 6250], morale: [9, 9, 10], claw: ["1d6", "1d8 + 1", "1d10 + 2"], bite: ["3d8", "3d8 + 4", "3d8 + 8"], breath: "Chlorine gas cloud", alignment: "Chaotic", treasure: ["H", "H x 2, I", "H x 3, I x 2"] },
  { color: "Blue", ac: [0, -2, -4], hd: ["9", "13+3", "18"], saveAs: ["F9", "F27", "F36"], xp: [2300, 4500, 7525], morale: [9, 9, 10], claw: ["1d6 + 1", "1d8 + 2", "1d10 + 3"], bite: ["3d10", "3d10 + 4", "3d10 + 8"], breath: "Lightning line", alignment: "Neutral", treasure: ["H", "H x 2, I", "H x 3, I x 2"] },
  { color: "Red", ac: [-1, -3, -5], hd: ["10", "15", "20"], saveAs: ["F10", "F30", "F36"], xp: [2500, 4800, 9575], morale: [10, 10, 11], claw: ["1d8", "1d10 + 1", "1d12 + 2"], bite: ["4d8", "4d8 + 4", "4d8 + 8"], breath: "Fire cone", alignment: "Chaotic", treasure: ["H", "H x 2, I", "H x 3, I x 2"] },
  { color: "Gold", ac: [-2, -4, -6], hd: ["11", "16+3", "22"], saveAs: ["F11", "F33", "F36"], xp: [2700, 5450, 11750], morale: [10, 10, 11], claw: ["2d4", "3d4", "4d4"], bite: ["6d6", "6d6 + 4", "6d6 + 8"], breath: "Fire cone or gas cloud", alignment: "Lawful", treasure: ["H", "H x 2, I", "H x 3, I x 2"] }
];

const dragonSheets = DRAGONS.flatMap((dragon) => ["Small", "Large", "Huge"].map((size, index) => sheet(`Dragon, ${dragon.color} (${size})`, {
  category: "Dragon",
  monsterType: "Dragon",
  ac: dragon.ac[index],
  hd: dragon.hd[index],
  move: [[90, 30], [120, 40], [150, 50]][index],
  appearing: ["1d4 (1d4)", "1d3 (1d3)", "1d2 (1d2)"][index],
  attacks: "2 claws/1 bite",
  damage: `${dragon.claw[index]}/${dragon.claw[index]}/${dragon.bite[index]}`,
  saveAs: dragon.saveAs[index],
  morale: dragon.morale[index],
  treasure: dragon.treasure[index],
  intelligence: [9, 12, 15][index],
  alignment: dragon.alignment,
  xp: dragon.xp[index],
  terrain: "Any",
  special: `${dragon.breath}; flying ${[240, 300, 360][index]}' (${[80, 100, 120][index]}').`
})));

const undead = group([
  ["Phantom (Apparition)", { category: "Undead", monsterType: "Undead, Enchanted (Rare)", ac: 0, hd: "10", attacks: "2 claws", damage: "1d6 + 2/1d6 + 2", saveAs: "M10", morale: 10, appearing: "1 (1)", treasure: "L, N, O", xp: 3250, intelligence: 11, alignment: "Chaotic", special: "Ethereal at first; magical weapons needed to hit." }],
  ["Phantom (Shade)", { category: "Undead", monsterType: "Undead, Enchanted (Rare)", ac: 0, hd: "11", move: [120, 40], attacks: "1 dagger", damage: "3d4", saveAs: "T11", morale: 9, appearing: "1 (0)", treasure: "L, N, V", xp: 3500, intelligence: 10, alignment: "Chaotic", special: "Ethereal at first; magical weapons needed to hit." }],
  ["Phantom (Vision)", { category: "Undead", monsterType: "Undead, Enchanted (Rare)", ac: 0, hd: "12", attacks: "2-8 swords", damage: "1d8 each", saveAs: "C12", morale: 12, appearing: "1 (1)", treasure: "L, N, O", xp: 3875, intelligence: 9, alignment: "Chaotic", special: "Ethereal at first; sight causes fear." }],
  ["Spirit (Druj)", { category: "Undead", monsterType: "Undead, Enchanted (Very Rare)", ac: -4, hd: "14", move: [90, 30], attacks: "1 or 4", damage: "See below (all + poison)", saveAs: "F14", morale: 12, appearing: "1 (1) or 1d4 + 1", treasure: "I, O, V", xp: 5500, intelligence: 14, alignment: "Chaotic", special: "+2 weapon or better to hit; immune to 1st-3rd level spells." }],
  ["Spirit (Odic)", { category: "Undead", monsterType: "Undead, Enchanted (Very Rare)", ac: -4, hd: "16", attacks: "1 (see below)", damage: "1d12 + poison (see below)", saveAs: "F16", morale: 12, appearing: "0 (1)", treasure: "I, O, V", xp: 6250, intelligence: 12, alignment: "Chaotic", special: "Travels up to 24 miles from its body; +2 weapon or better to hit." }],
  ["Spirit (Revenant)", { category: "Undead", monsterType: "Undead, Enchanted (Very Rare)", ac: -3, hd: "18", move: [120, 40], attacks: "2 claws/1 bite", damage: "2d4/2d4/1d4 + 2", saveAs: "F18", morale: 10, appearing: "1 (1)", treasure: "I, O, V", xp: 7525, intelligence: 13, alignment: "Chaotic", special: "All attacks carry poison; +2 weapon or better to hit." }]
]);

const HAG_XP = { 11: 4300, 12: 5625, 13: 6100, 14: 6500, 15: 6900, 16: 7350, 17: 8900, 18: 10225, 19: 11550, 20: 13175 };
const hags = group([
  ...Object.entries(HAG_XP).map(([hd, xp]) => [`Hag (Black, ${hd} HD)`, {
    category: "Humanoid", monsterType: "Humanoid (Very Rare)", ac: 4, hd, move: [150, 50], attacks: "2 claws or 1 spell", damage: "2d4 + poison or spell", saveAs: "C (level = HD)", morale: 10, appearing: "1 (1)", treasure: "C", xp, intelligence: 12, alignment: "Chaotic", special: "Swimming 50' (20'); controls undead as a 2x-HD liege."
  }]),
  ["Hag (Sea)", { category: "Humanoid", monsterType: "Humanoid, Enchanted (Very Rare)", ac: 4, hd: "8", move: [120, 40], attacks: "1 dagger/1 touch + gaze", damage: "1d6/1 energy drain + special", saveAs: "F8", morale: 10, appearing: "1 (1)", treasure: "G + M", xp: 2300, intelligence: 12, alignment: "Chaotic", special: "Swimming 150' (50'); gaze and touch drain energy." }]
]);

const HYDRA_XP = { 5: 175, 6: 275, 7: 450, 8: 650, 9: 900, 10: 1000, 11: 1100, 12: 1250 };
const hydras = Object.entries(HYDRA_XP).map(([heads, xp]) => sheet(`Hydra (${heads} HD)`, {
  category: "Monster",
  monsterType: "Monster (Rare)",
  ac: 5,
  hd: heads,
  hp: Number(heads) * 8,
  attacks: `${heads} bites`,
  damage: Array(Number(heads)).fill("1d10").join("/"),
  saveAs: `F${heads}`,
  morale: 11,
  appearing: "1 (1)",
  treasure: "B",
  xp,
  intelligence: 2,
  terrain: "Any",
  special: "One head (and 8 hp) is destroyed for every 8 damage taken."
}));

const VAMPIRE_XP = { 7: 1250, 8: 1750, 9: 2300 };
const vampires = Object.entries(VAMPIRE_XP).map(([hd, xp]) => sheet(`Vampire (${hd} HD)`, {
  category: "Undead",
  monsterType: "Undead, Enchanted (Rare)",
  ac: 2,
  hd,
  move: [120, 40],
  attacks: "1 touch or special",
  damage: "1d10 + double energy drain or special",
  saveAs: `F${hd}`,
  morale: 11,
  appearing: "1d4 (1d6)",
  treasure: "F",
  xp,
  intelligence: 10,
  alignment: "Chaotic",
  special: "Flying 180' (60'); immune to charms and cold; magical weapon needed to hit."
}));

const SLUG_XP = { 9: 2300, 10: 2500, 11: 2700, 12: 3000, 13: 3250, 14: 3500, 15: 3750, 16: 4050, 17: 4300, 18: 4825, 19: 5350, 20: 5975 };
const slugs = Object.entries(SLUG_XP).map(([hd, xp]) => sheet(`Slug, Giant (${hd} HD)`, {
  category: "Normal Animal",
  monsterType: "Giant Animal (Rare)",
  ac: 8,
  hd,
  move: [60, 20],
  attacks: "1 bite or 1 spit",
  damage: "1d12 or as dragon breath",
  saveAs: "F (level = 1/2 HD)",
  morale: 8,
  appearing: "1 (1)",
  xp,
  intelligence: 2,
  terrain: "Cavern, Ruins",
  special: "Burrowing 30' (10'); blunt weapons do no damage and edged weapons deal half damage."
}));

const GIANT_XP = { 9: 1600, 10: 1750, 11: 1900, 12: 2125, 13: 2300, 14: 2500, 15: 2700, 16: 2950, 17: 3150, 18: 3475, 19: 3800, 20: 4175 };
const variableGiants = [
  ...Array.from({ length: 9 }, (_, index) => index + 12).map((hd) => sheet(`Giant (Mountain, ${hd} HD)`, {
    category: "Humanoid", monsterType: "Giant Humanoid", ac: 0, hd, move: [150, 50], attacks: "1 weapon", damage: "5d10", saveAs: "F (level = HD)", morale: 9, appearing: "1d4 (1d20)", treasure: "E + 5,000 gp", xp: GIANT_XP[hd], intelligence: 10, terrain: "Mountains"
  })),
  ...Array.from({ length: 7 }, (_, index) => index + 9).map((hd) => sheet(`Giant (Sea, ${hd} HD)`, {
    category: "Humanoid", monsterType: "Giant Humanoid", ac: 0, hd, move: [120, 40], attacks: "1 or special", damage: "See below", saveAs: "F (level = HD)", morale: 10, appearing: "1d2 (1d20)", treasure: "E + 5,000 gp", xp: GIANT_XP[hd], intelligence: 12, terrain: "Ocean", special: "Amphibious; can hold its breath for 1 hour."
  }))
];

const HORDE_ROWS = [
  ["3", "1d6", 50], ["4", "1d6", 125], ["5", "1d8", 300], ["6", "1d8", 500],
  ["7", "1d10", 850], ["8", "1d10", 1200], ["9", "2d6", 1600],
  ["10", "2d6", 1750], ["11-12", "2d8", 1900], ["13-16", "3d6", 2300],
  ["17-20", "4d6", 3150], ["21", "5d6", 4500]
];
const hordes = HORDE_ROWS.map(([hd, damage, xp]) => sheet(`Horde (${hd} HD)`, {
  category: "Planar Monster",
  monsterType: "Planar Monster (Very Rare)",
  ac: 3,
  hd,
  move: [150, 50],
  attacks: "1 bite or special",
  damage,
  saveAs: `F${Number(hd.split("-")[0])}`,
  morale: 12,
  appearing: "2d4 (d100 x 10)",
  treasure: "Special",
  intelligence: 13,
  alignment: "Lawful",
  xp,
  terrain: "Plane of Earth",
  special: "ESP and telekinesis; normally fails saving throws voluntarily."
}));

const LICH_XP = [12500, 14000, 15500, 17000, 18500, 20000, 21500, 23000, 24500, 26000, 27500, 29000, 30500, 32000, 33500, 35000];
const liches = [["Magic-User", "M", "4"], ["Cleric", "C", "6"]].flatMap(([type, saveClass, faces]) =>
  LICH_XP.map((xp, index) => {
    const level = 21 + index;
    const bonus = 12 + index;
    return sheet(`Lich (${type} ${level})`, {
      category: "Undead",
      monsterType: "Undead, Enchanted (Very Rare)",
      ac: 0,
      hd: `9d${faces}+${bonus}`,
      move: [90, 30],
      attacks: "1 touch or 1 spell",
      damage: "1d10 + paralysis or by spell",
      saveAs: `${saveClass}${level}`,
      morale: 10,
      appearing: "1 (1)",
      treasure: "H",
      intelligence: 18,
      alignment: "Chaotic",
      xp,
      terrain: "Ruins",
      spellcasting: `${type} spells by character level (level ${level}).`,
      special: "Magical weapon needed to hit; touch paralyzes (save vs. paralysis); spells by character level."
    });
  })
);

const humanoid = group([
  ["Normal Human", { category: "Humanoid", monsterType: "Humanoid", ac: 9, hd: "1", hp: 4, move: [120, 40], attacks: "1 weapon", damage: "By weapon", saveAs: "F1", morale: 8, appearing: "1 (1)", treasure: "By class", xp: 16, intelligence: 9, terrain: "Any" }]
]);

const planar = group([
  ["Rust Monster", { category: "Monster", monsterType: "Monster (Rare)", ac: 2, hd: "5", attacks: "1", damage: "See below", saveAs: "F3", morale: 7, appearing: "1d4 (1d4)", xp: 300, intelligence: 2, terrain: "Cavern, Ruins", special: "Antenna rusts nonmagical metal; magical metal loses one plus per hit." }],
  ["Salamander (Flame)", { category: "Planar Monster", monsterType: "Planar Monster, Enchanted (Very Rare)", ac: 2, hd: "8", attacks: "2 claws/1 bite", damage: "1d4/1d4/1d8", saveAs: "F8", morale: 8, appearing: "1d4 + 1 (2d4)", treasure: "F", xp: 1200, intelligence: 1, alignment: "Neutral", special: "Immune to normal weapons." }],
  ["Salamander (Frost)", { category: "Planar Monster", monsterType: "Planar Monster, Enchanted (Very Rare)", ac: 3, hd: "12", attacks: "4 claws/1 bite", damage: "1d6(x4)/2d6", saveAs: "F12", morale: 9, appearing: "1d3 (1d3)", treasure: "E", xp: 2125, intelligence: 1, alignment: "Chaotic", special: "Immune to normal weapons." }]
]);

// Tables whose columns were flattened by the OCR: one row per real variant.
const aquaticDinosaurs = group([
  ["Dinosaur, Aquatic (Small)", { category: "Normal Animal", monsterType: "Giant Animal", ac: 7, hd: "2-8", move: [30, 120], attacks: "1 bite (+ 2 flippers)", damage: "1 to 2d4", saveAs: "F (level = 1/2 HD)", morale: 3, appearing: "1d2 to 2d8", xp: 30, intelligence: 2, terrain: "River/Lake, Ocean", special: "Swimming 120' to 180'." }],
  ["Dinosaur, Aquatic (Large)", { category: "Normal Animal", monsterType: "Giant Animal", ac: 5, hd: "9-24", move: [60, 150], attacks: "1 bite (+ 2 flippers)", damage: "2d4 to 4d8", saveAs: "F (level = 1/2 HD)", morale: 8, appearing: "1d2 to 1d4", treasure: "U + V", xp: 3700, intelligence: 2, terrain: "River/Lake, Ocean", special: "Swimming 150' to 240'." }],
  ["Dinosaur, Aquatic (Armored)", { category: "Normal Animal", monsterType: "Giant Animal", ac: 2, hd: "6-9", move: [60, 90], attacks: "1 bite (+ 2 flippers)", damage: "1d4 to 2d8", saveAs: "F (level = 1/2 HD)", morale: 8, appearing: "1d2 to 1d6", xp: 2300, intelligence: 2, terrain: "River/Lake, Ocean", special: "Swimming 90' to 150'; AC 2 to 4 by age." }]
]);

const ELEMENTAL_SUMMONINGS = [
  ["Staff", 2, "8", 8, 650, "1d8"],
  ["Device", 0, "12", 12, 1250, "2d8"],
  ["Spell", -2, "16", 16, 1850, "3d8"]
];
const ELEMENTAL_TYPES = [
  ["Air", 360, 120, "Flying 360' (120')."],
  ["Earth", 60, 20, "Burrows through earth."],
  ["Fire", 120, 40, "Ignores normal weapons."],
  ["Water", 60, 20, "Swimming 180' (60')."]
];
const elementals = ELEMENTAL_TYPES.flatMap(([type, move, outdoor, special]) =>
  ELEMENTAL_SUMMONINGS.map(([source, ac, hd, level, xp, damage]) => sheet(`Elemental (${type}, ${source})`, {
    category: "Planar Monster",
    monsterType: "Planar Monster, Enchanted (Common)",
    ac,
    hd,
    move: [move, outdoor],
    attacks: "1 or special",
    damage,
    saveAs: `F${level}`,
    morale: 10,
    appearing: "1 (1)",
    xp,
    intelligence: 9,
    terrain: `Plane of ${type}`,
    special
  }))
);

const RULER_BANDS = [[41, -11, "8d12"], [49, -12, "9d12"], [57, -13, "10d12"], [65, -14, "11d12"], [73, -15, "12d12"]];
const elementalRulers = RULER_BANDS.map(([hd, ac, damage]) => sheet(`Elemental Ruler (${hd} HD)`, {
  category: "Planar Monster",
  monsterType: "Planar Monster, Enchanted (Very Rare)",
  ac,
  hd: String(hd),
  move: [120, 40],
  attacks: "2 fists",
  damage,
  saveAs: "F36",
  morale: 11,
  appearing: "1d6",
  treasure: "Special",
  xp: 28500 + (hd - 41) * 1000,
  intelligence: 15,
  alignment: "Lawful or Neutral",
  terrain: "Elemental Planes",
  special: "Immune to 1st-5th level spells, poison and mental effects; 2' tall per Hit Die."
}));

const HYDRAX_XP = { 5: 425, 6: 725, 7: 1250, 8: 1750, 9: 2300, 10: 2500, 11: 2700, 12: 3000 };
const hydraxes = Object.entries(HYDRAX_XP).map(([hd, xp]) => sheet(`Hydrax (${hd} HD)`, {
  category: "Planar Monster",
  monsterType: "Planar Monster, Enchanted (Very Rare)",
  ac: 2,
  hd,
  move: [60, 20],
  attacks: "2 claws or special",
  damage: "1d10/1d10 or see below",
  saveAs: "F (level = 2 X HD)",
  morale: 9,
  appearing: "1 (1)",
  treasure: "Special",
  xp,
  intelligence: 9,
  alignment: "Lawful",
  terrain: "Plane of Water",
  special: "Swimming 180' (60'); immune to normal weapons."
}));

const HERD_XP = { 1: 10, 2: 20, 3: 35, 4: 75 };
const herds = Object.entries(HERD_XP).map(([hd, xp]) => sheet(`Animal Herd (${hd} HD)`, {
  category: "Normal Animal",
  monsterType: "Normal Animal (Common)",
  ac: 7,
  hd,
  move: [240, 80],
  attacks: "1 attack (butt, bite, or kick, by species)",
  damage: hd === "1" || hd === "2" ? "1d4" : hd === "3" ? "1d6" : "1d8",
  saveAs: "F1",
  morale: 5,
  appearing: "0 (3d10)",
  xp,
  intelligence: 2,
  terrain: "Any"
}));

const specials = group([
  ["Blackball (Deadly Sphere)", { category: "Planar Monster", monsterType: "Planar Monster (Very Rare)", ac: 9, hd: "None", hp: 1, move: [30, 10], attacks: "1 touch", damage: "Disintegration (no save)", saveAs: "See below", morale: 12, appearing: "1 (1)", xp: 7500, intelligence: 0, alignment: "None", terrain: "Any", special: "Whatever it touches disintegrates with no saving throw." }],
  ["Scorpion, Giant", { category: "Lowlife", monsterType: "Lowlife (Rare)", ac: 2, hd: "4", move: [150, 50], attacks: "2 claws/1 sting", damage: "1d10/1d10/1d4 + poison", saveAs: "F2", morale: 11, appearing: "1d6 (1d6)", treasure: "V", xp: 125, intelligence: 0, terrain: "Desert, Cavern, Ruins", special: "The sting carries poison." }]
]);

/** Merman leaders and the metamorph were flattened into one OCR row. */
const coastalFolk = group([
  ["Merman (1 HD)", { category: "Humanoid", monsterType: "Humanoid (Common)", ac: 6, hd: "1", move: [120, 40], attacks: "1 weapon", damage: "By weapon", saveAs: "F1", morale: 8, appearing: "0 (1d20)", treasure: "A", intelligence: 12, alignment: "Neutral", xp: 10, terrain: "Ocean", special: "All ordinary mermen have 1 Hit Die and save as 1st-level fighters." }],
  ["Merman (2 HD)", { category: "Humanoid", monsterType: "Humanoid (Common), Leader", ac: 6, hd: "2", move: [120, 40], attacks: "1 weapon", damage: "By weapon", saveAs: "F2", morale: 8, appearing: "0 (1d20)", treasure: "A", intelligence: 12, alignment: "Neutral", xp: 20, terrain: "Ocean", special: "One 2 HD leader for every ten mermen." }],
  ["Merman (4 HD)", { category: "Humanoid", monsterType: "Humanoid (Common), Leader", ac: 6, hd: "4", move: [120, 40], attacks: "1 weapon", damage: "By weapon", saveAs: "F4", morale: 8, appearing: "0 (1d20)", treasure: "A", intelligence: 12, alignment: "Neutral", xp: 75, terrain: "Ocean", special: "One 4 HD leader for every fifty mermen." }],
  ["Metamorph", { category: "Humanoid", monsterType: "Humanoid (Rare)", ac: 5, hd: "3+1", move: [120, 40], attacks: "1 weapon or as form", damage: "By weapon type or form", saveAs: "M11", morale: 8, appearing: "1d6 (1d20)", treasure: "Variable", intelligence: 14, alignment: "Any (often Chaotic)", xp: 100, terrain: "Any", special: "Shapeshifts up to 11 times; AC, HD and damage can change with the assumed form." }],
  ["Devilfish (Vampire)", { category: "Monster", monsterType: "Monster, Enchanted (Rare)", ac: 6, hd: "5", move: [0, 120], attacks: "1 tail/1 bite", damage: "1d4/1d6 + energy drain", saveAs: "C (level = HD)", morale: 8, appearing: "20 (1d6 X 20)", treasure: "A x 2 + F per 20", intelligence: 9, alignment: "Chaotic", xp: 425, terrain: "Ocean", special: "Vampiric: double energy drain per hit; harmed only by magical or silver weapons (or holy items); turnable by clerics; charm and regenerate as vampires." }],
  ["Devilfish (Matriarch)", { category: "Monster", monsterType: "Monster, Enchanted (Rare)", ac: 6, hd: "6", move: [0, 120], attacks: "1 tail/1 bite", damage: "1d4/1d6 + energy drain", saveAs: "C (level = HD)", morale: 8, appearing: "20 (1d6 X 20)", treasure: "A x 2 + F per 20", intelligence: 9, alignment: "Chaotic", xp: 950, terrain: "Ocean", spellcasting: "Cleric spells as a 10th- to 16th-level character (no 7th-level spells).", special: "Vampiric abilities and cleric spellcasting must be resolved together; matriarchs are indistinguishable from other devilfish until they cast." }]
]);

export const RC_VARIANT_SHEETS = [
  ...animals, ...lowlife, ...monsters, ...dragonSheets, ...undead, ...hags,
  ...hydras, ...vampires, ...slugs, ...variableGiants, ...hordes, ...liches,
  ...humanoid, ...planar, ...aquaticDinosaurs, ...elementals, ...elementalRulers,
  ...hydraxes, ...herds, ...specials, ...coastalFolk
];

/** Spellcasting noted in the prose of sheets that are otherwise kept as-is. */
const SPELLCASTING_BY_NAME = new Map([
  ["Sphinx", "Female: 12th-level cleric spells; male: 12th-level magic-user spells. Saves vs. their spells are at -4."]
]);

/** Curated sheets replace OCR artifacts; existing unrelated docs are kept. */
export function mergeCuratedMonsterVariants(docs) {
  if (!Array.isArray(docs)) return docs;
  const curated = new Map(RC_VARIANT_SHEETS.map((doc) => [doc.name, doc]));
  const kept = docs
    .filter((doc) => !curated.has(doc.name) && !OBSOLETE_VARIANT_NAMES.has(doc.name))
    .map((doc) => {
      const spellcasting = SPELLCASTING_BY_NAME.get(doc.name);
      return spellcasting
        ? { ...doc, system: { ...doc.system, spellcasting } }
        : doc;
    });
  return [...kept, ...RC_VARIANT_SHEETS.map((doc) => structuredClone(doc))];
}

/** Flattened OCR artifacts superseded by the sheets above. */
export const OBSOLETE_VARIANT_NAMES = new Set([
  "Bat (Normal)", "Bat (Giant)", "Rat (Normal)", "Rat (Giant)",
  "Snake (Cobra)", "Snake (Giant)", "Snake (Racer)", "Snake (Spitting)",
  "Toad (Giant)", "Toad (Rock/Cave)",
  "Lizard, Giant", "Merman",
  "Fish, Giant (Bass)", "Fish, Giant (Giant)", "Fish, Giant (Rockfish)", "Fish, Giant (Sturgeon)",
  "Spider, Giant (Black)", "Spider, Giant (Crab)", "Spider, Giant (Spider)", "Spider, Giant (Tarantella)", "Spider, Giant (Widow)",
  "Gargantua (Carrion)", "Gargantua (Crawler)", "Gargantua (Gargoyle*)", "Gargantua (Troll)",
  "Dragon", "Black (Small)", "Black (Large)", "Black (Huge)",
  "Blue (Small)", "Blue (Large)", "Blue (Huge)",
  "Green (Small)", "Green (Large)", "Green (Huge)",
  "Red (Small)", "Red (Large)", "Red (Huge)",
  "Gold (Small)", "Gold (Large)", "Gold (Huge)",
  "Roc (Small)", "Roc (Large)", "Roc (Giant)", "Dragon Turtle",
  "Phantom (Apparition*)", "Phantom (Shade*)", "Phantom (Vision*)",
  "Spirit (Druj*)", "Spirit (Odic*)", "Hag", "Hydra", "Vampire", "Slug, Giant",
  "Giant (Mountain)", "Giant (Sea)", "Horde", "Lich", "Normal Human",
  "Elemental (Air,)", "Elemental (Earth,)", "Elemental (Fire,)", "Elemental (Water)",
  "Elemental Ruler", "Hydrax", "Animal Herd",
  "Rust Monster (Flame*)", "Rust Monster (Frost*)"
]);
