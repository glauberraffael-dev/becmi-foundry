/**
 * Named monster variants from the page-ordered Rules Cyclopedia oracle.
 *
 * The old interleaved OCR export collapsed several multi-column stat tables
 * into two synthetic "Form 1/2" actors. This repair replaces those artifacts
 * with one document per named creature, using the stat tables and prose of the
 * read-only oracle. It runs after the OCR extraction and prose repair, and it
 * writes only build data under /data — never into the Foundry system ZIP.
 */
import { fixDice } from "./normalize.mjs";
import { monsterHpFromHitDice } from "../scripts/rules-rc.mjs";

const COMMON_LYCANTHROPE = [
  "Animal Form: In animal form, a lycanthrope can be harmed only by magical weapons, silvered weapons, or spells. It cannot speak normal languages, but can speak with normal animals of its weretype.",
  "Human Form: In human form a lycanthrope often looks somewhat like its wereform. It can speak and use weapons normally.",
  "Summon Animals: Any lycanthrope can summon 1d2 normal animals of its type; they arrive in 1d4 rounds.",
  "Wolfsbane: If hit by wolfsbane, the lycanthrope must save vs. poison or flee in fear."
].join("\n");

function actor(name, fields) {
  const hd = String(fields.hd ?? "1");
  const description = String(fields.description ?? "").replace(/\s+/g, " ").trim();
  // Keep bullets separate so normalize-compendia can render one <p> each.
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
        variant: fields.variant ?? ""
      }
    },
    system: {
      ac: fields.ac ?? 9,
      hd,
      hp: monsterHpFromHitDice(hd),
      move: {
        dungeon: fields.move?.[0] ?? 120,
        outdoor: fields.move?.[1] ?? 40
      },
      attacks: fixDice(fields.attacks ?? "1 attack"),
      damage: fixDice(fields.damage ?? "By weapon"),
      appearing: fixDice(fields.appearing ?? "1"),
      saveAs: fields.saveAs ?? "F1",
      morale: fields.morale ?? 7,
      treasure: fields.treasure ?? "Nil",
      intelligence: fields.intelligence ?? 5,
      alignment: fields.alignment ?? "Neutral",
      xpValue: fields.xp ?? 0,
      terrain: fields.terrain ?? "Any",
      monsterType: fields.monsterType ?? "Monster",
      special,
      description,
      notes: "",
      source: "Rules Cyclopedia",
      page: 0
    }
  };
}

/** RC pp. 190-193: one sheet per named lycanthrope, not a fused table. */
function lycanthropes() {
  const common = {
    category: "Humanoid",
    monsterType: "Lycanthrope (Common)",
    treasure: "C",
    terrain: "Variable, often as animal type",
    special: [COMMON_LYCANTHROPE]
  };
  const uncommon = { ...common, monsterType: "Lycanthrope (Uncommon)" };

  return [
    actor("Wererat", {
      ...common, ac: 7, hd: "3", move: [120, 40], attacks: "1 bite or weapon",
      damage: "1d4 or by weapon", appearing: "1d8 (2d8)", saveAs: "F3", morale: 8,
      intelligence: 10, alignment: "Chaotic", xp: 50,
      description: "Wererats are lycanthropes whose rat form is their natural shape; they can assume human form and speak Common in either shape. They are sneaky ambushers, surprising on 1-4 on 1d6, and summon giant rats to help them fight. Only a wererat's bite transmits lycanthropy. In human form their AC is 9.",
      special: [COMMON_LYCANTHROPE,
        "Human Form AC: 9; wererats can use any weapon in either form.",
        "Lycanthropy: Only the bite inflicts the disease."]
    }),
    actor("Werewolf", {
      ...common, ac: 5, hd: "4", move: [180, 60], attacks: "1 bite", damage: "2d4",
      appearing: "1d6 (2d6)", saveAs: "F4", morale: 8, intelligence: 10,
      alignment: "Chaotic", xp: 125,
      description: "Werewolves are semi-intelligent lycanthropes that hunt in packs. Any group of five or more has a 30-hit-point leader that attacks as a 5 Hit Die monster and adds +2 to damage. They summon normal wolves to form large packs. In human form their AC is 9.",
      special: [COMMON_LYCANTHROPE,
        "Pack Leader: Groups of 5+ include a leader with 30 HP, attacking as 5 HD with +2 damage.",
        "Human Form AC: 9."]
    }),
    actor("Wereboar", {
      ...common, ac: 4, hd: "4 + 1", move: [150, 50], attacks: "1 tusk slash",
      damage: "2d6", appearing: "1d4 (2d4)", saveAs: "F4", morale: 9,
      intelligence: 10, alignment: "Neutral", xp: 200,
      description: "Wereboars are semi-intelligent, bad-tempered lycanthropes. In human form they often seem to be berserkers and may fight to the death, gaining +2 on attack rolls. They summon normal boars and do not associate with devil swine. In human form their AC is 9.",
      special: [COMMON_LYCANTHROPE,
        "Berserk Rage: +2 on attack rolls and fights to the death.",
        "Human Form AC: 9."]
    }),
    actor("Weretiger", {
      ...common, ac: 3, hd: "5", move: [150, 50], attacks: "2 claws/1 bite",
      damage: "1d6/1d6/2d6", appearing: "1d4 (1d4)", saveAs: "F5", morale: 9,
      intelligence: 10, alignment: "Neutral", xp: 300,
      description: "Weretigers are relatives of the great cats: curious, dangerous when threatened, and quiet trackers that surprise on 1-4 on 1d6. They are good swimmers and summon local great cats, preferring tigers. In human form their AC is 9.",
      special: [COMMON_LYCANTHROPE,
        "Surprise: 1-4 on 1d6.",
        "Human Form AC: 9."]
    }),
    actor("Werebear", {
      ...common, ac: 2, hd: "6", move: [120, 40], attacks: "2 claws/1 bite",
      damage: "2d4/2d4/2d8", appearing: "1d4 (1d4)", saveAs: "F6", morale: 10,
      intelligence: 10, alignment: "Neutral", xp: 500,
      description: "Werebears are highly intelligent even in animal form and may be friendly if approached peacefully. In combat, if both paws hit the same target in a round, they can hug for an extra 2d8 damage. They summon any bears in the area. In human form their AC is 8.",
      special: [COMMON_LYCANTHROPE,
        "Hug: If both claws hit one target in a round, add 2d8 damage.",
        "Human Form AC: 8."]
    }),
    actor("Werebat", {
      ...uncommon, ac: 4, hd: "3 + 3", move: [60, 20], attacks: "1 bite",
      damage: "1d4", appearing: "2d6 (1d8)", saveAs: "F3", morale: 7,
      intelligence: 10, alignment: "Chaotic", xp: 75,
      description: "Werebats are dangerous flying lycanthropes often mistaken for vampires. They summon normal and giant bats and 1d4 other werebats. Each bite has a 1-in-6 chance of spreading a nonmagical disease. They fly at 180' (60'). In human form their AC is 9.",
      special: [COMMON_LYCANTHROPE,
        "Disease: Each bite has a 1-in-6 chance of inflicting a disease chosen by the DM.",
        "Flying: 180' (60').",
        "Human Form AC: 9."]
    }),
    actor("Werefox", {
      ...uncommon, ac: 6, hd: "3 + 2", move: [180, 60], attacks: "1 bite or weapon",
      damage: "1d6 or by weapon", appearing: "1d6 (2d6)", saveAs: "F3", morale: 8,
      intelligence: 12, alignment: "Neutral", xp: 75,
      description: "Werefoxes move at full speed even through dense underbrush and are highly intelligent, often becoming magic-users who can cast only in human form. They can charm three times per day, for up to 24 hours: persons in human form, animals in fox form. They swim at 90' (30').",
      special: [COMMON_LYCANTHROPE,
        "Charm: Three times per day; lasts up to 24 hours (persons in human form, animals in fox form).",
        "Swimming: 90' (30').",
        "Human Form AC: 9."]
    }),
    actor("Wereshark", {
      ...uncommon, ac: 4, hd: "4", move: [0, 0], attacks: "1 bite", damage: "2d6",
      appearing: "0 (2d6)", saveAs: "F4", morale: 7, intelligence: 9,
      alignment: "Neutral", xp: 125,
      description: "Weresharks are mermen who can take the form of a mako shark in darkness. At full moon they must change and become bloodthirsty killers. They swim at 180' (60') and can be harmed only by magic or silver weapons. In human form their AC is 9.",
      special: [COMMON_LYCANTHROPE,
        "Swimming: 180' (60'); no land movement.",
        "Forced Change: At full moon the wereshark becomes a mako shark and loses its intelligence.",
        "Human Form AC: 9."]
    }),
    actor("Wereseal", {
      ...uncommon, ac: 5, hd: "5 + 2", move: [60, 20], attacks: "1 bite", damage: "2d6",
      appearing: "0 (2d10)", saveAs: "F5", morale: 9, intelligence: 10,
      alignment: "Chaotic", xp: 400,
      description: "Wereseals live near cold seacoasts. The common female form is usually not aggressive, but a bull wereseal is dangerous: AC 3, HD 8*, move 180' (60'), damage 2d10, Save F8, ML 11, XPV 1,200. One bull is usually accompanied by 2d4 females. Wereseals swim at 180' (60').",
      special: [COMMON_LYCANTHROPE,
        "Swimming: 180' (60').",
        "Bull Wereseal: AC 3; HD 8*; MV 180' (60'); Dmg 2d10; Save F8; ML 11; XPV 1,200.",
        "Human Form AC: 9."]
    }),
    actor("Devil Swine", {
      ...uncommon, ac: 3, hd: "9", move: [180, 60], attacks: "1 gore or blow",
      damage: "2d6 or by weapon", appearing: "1d3 (1d4)", saveAs: "F9", morale: 10,
      intelligence: 11, alignment: "Chaotic", xp: 1600,
      description: "A devil swine appears as a huge hog or a grossly fat human and may change shape freely at night, but must keep one shape during daylight. It haunts the fringes of human settlements, favors human flesh, and ambushes when possible. Unlike wereboars, it is fat, pink and smooth-skinned.",
      special: [COMMON_LYCANTHROPE,
        "Charm Person: Three times per day in either form; saving throw at -2.",
        "Control: Usually keeps 0-3 (1d4-1) humans under its control.",
        "Human Form AC: 9."]
    })
  ];
}

/** RC p. 193: one manticore with claws, bite and tail spikes. */
function manticore() {
  return actor("Manticore", {
    category: "Monster", monsterType: "Monster (Rare)", terrain: "Mountain",
    ac: 4, hd: "6 + 1", move: [120, 40], attacks: "2 claws/1 bite or 6 spikes",
    damage: "1d4/1d4/2d4 or 1d6 each", appearing: "1d2 (1d4)", saveAs: "F6",
    morale: 9, treasure: "D", intelligence: 3, alignment: "Chaotic", xp: 650,
    description: "A manticore has a lion's body, leathery bat wings, a spiked tail and a man's face with large fangs. It lives in wild mountain ranges and preys on humans, often ambushing a resting group with spikes or stalking a lone victim like a great cat. It flies at 180' (60').",
    special: [
      "Tail Spikes: 24 spikes; fires up to six per round at ranges 50/100/180, even while flying. Regrows two spikes per day.",
      "Flying: 180' (60')."
    ]
  });
}

function mantas() {
  const common = {
    category: "Normal Animal", treasure: "Nil", intelligence: 2,
    alignment: "Neutral", terrain: "Ocean"
  };
  return [
    actor("Manta Ray", {
      ...common, monsterType: "Normal Animal (Common)", ac: 6, hd: "4",
      move: [120, 40], attacks: "1 tail", damage: "1d8 + paralysis",
      appearing: "0 (1-3)", saveAs: "F2", morale: 7, xp: 125,
      description: "Manta rays are flat aquatic fish whose broad wings propel them through the water. A manta lying on the ocean floor is completely invisible. The normal manta grows to 7 feet wide and 12 feet long, and attacks with a tail full of poisonous spines.",
      special: ["Paralysis: A hit on the tail requires a saving throw vs. poison or the victim is paralysed."]
    }),
    actor("Manta Ray (Giant)", {
      ...common, monsterType: "Giant Animal (Rare)", ac: 6, hd: "10",
      move: [180, 60], attacks: "1 buffet/1 tail", damage: "3d4/2d10 + paralysis",
      appearing: "0 (1)", saveAs: "F5", morale: 7, treasure: "V", xp: 1750,
      description: "Giant manta rays grow to about 40 feet wide and 75 feet long. Besides their poisonous tail, they can buffet a creature for 3d4 damage and sometimes swallow treasure from the ocean floor.",
      special: ["Paralysis: A tail hit requires a saving throw vs. poison or the victim is paralysed."]
    })
  ];
}

/** RC pp. 179-180: eight named giant races, each with its own statistics. */
function giants() {
  const common = {
    category: "Humanoid", monsterType: "Giant Humanoid",
    treasure: "E + 5,000 gp", terrain: "Variable by giant type"
  };
  return [
    actor("Giant (Hill)", {
      ...common, ac: 4, hd: "8", move: [120, 40], attacks: "1 weapon",
      damage: "2d8", appearing: "1d4 (1d4)", saveAs: "F8", morale: 8,
      intelligence: 7, alignment: "Chaotic", xp: 650, terrain: "Hill, Mountain",
      description: "Hill giants are 12-foot hairy brutes that wear animal skins and carry huge clubs and spears. They sometimes throw rocks (range 30/60/100) and raid human communities for food and plunder.",
      special: ["Thrown Boulders: 3d6 damage; range 30/60/100 yards."]
    }),
    actor("Giant (Cloud)", {
      ...common, ac: 4, hd: "13", move: [120, 40], attacks: "1 weapon",
      damage: "6d6", appearing: "1d2 (1d3)", saveAs: "F12", morale: 10,
      intelligence: 16, alignment: "Neutral", xp: 2300, terrain: "Mountain, Cloud",
      description: "Cloud giants stand 20 feet tall with white or gray skin and hair. They have keen senses and are rarely surprised (1 chance in 6). They live in cloud castles or mountain strongholds and keep rocs or dire wolves as guards.",
      special: ["Surprise: Others suffer a 1-in-6 chance only.", "Thrown Boulders: 3d6 damage; range 60/130/200 yards."]
    }),
    actor("Giant (Stone)", {
      ...common, ac: 4, hd: "9", move: [120, 40], attacks: "1 weapon",
      damage: "3d6", appearing: "1d2 (1d6)", saveAs: "F9", morale: 9,
      intelligence: 10, alignment: "Neutral", xp: 900, terrain: "Cave, Mountain",
      description: "Stone giants are 14 feet tall with gray, rocklike skin and use large stalactites as clubs. They often hurl rocks and live in caves or crude stone huts, sometimes keeping 1d4 cave bears as guards.",
      special: ["Thrown Boulders: 3d6 damage; range 100/200/300 yards."]
    }),
    actor("Giant (Storm)", {
      ...common, ac: 2, hd: "15", move: [150, 50], attacks: "1 + special",
      damage: "8d6 + special", appearing: "1 (1d3)", saveAs: "F15", morale: 10,
      intelligence: 18, alignment: "Lawful", xp: 3750, terrain: "Mountain, Cloud, Ocean",
      description: "Storm giants are over 22 feet tall with bronze skin and red or yellow hair. They love thunderstorms, can create one in a turn, and in a storm may throw a lightning bolt every five rounds for damage equal to their remaining hit points.",
      special: [
        "Lightning Bolt: Every 5 rounds in a storm; damage equals remaining HP (save vs. spells halves it).",
        "Immunity: Lightning does not affect storm giants.",
        "Thrown Boulders: 3d6 damage; range 150/300/450 yards."
      ]
    }),
    actor("Giant (Frost)", {
      ...common, ac: 4, hd: "10 + 1", move: [120, 40], attacks: "1 weapon",
      damage: "4d6", appearing: "1d2 (1d4)", saveAs: "F10", morale: 9,
      intelligence: 14, alignment: "Chaotic", xp: 1900, terrain: "Mountain",
      description: "Frost giants stand 18 feet tall with pale skin, light hair and iron armor. They build castles above the timberline, are immune to cold-based attacks, and keep polar bears or wolves as guards.",
      special: ["Immunity: Cold-based attacks.", "Thrown Boulders: 3d6 damage; range 60/130/200 yards."]
    }),
    actor("Giant (Mountain)", {
      ...common, ac: 0, hd: "12-20", move: [150, 50], attacks: "1 weapon",
      damage: "5d10", appearing: "1d4 (1d20)", saveAs: "F (level = HD)", morale: 9,
      intelligence: 8, alignment: "Neutral", xp: 2125, terrain: "Mountain",
      description: "Mountain giants resemble stone or hill giants and stand 12 to 20 feet tall, about one foot per Hit Die. They are reclusive mercenaries, carry huge swords or stone clubs, and often hurl boulders for 4d6 damage.",
      special: [
        "Thrown Boulders: 4d6 damage; range 100/200/400 yards.",
        "Melee: Huge swords or stone clubs (1d10 x 5).",
        "XP by HD: 9*=1,600; 10*=1,750; 11*=1,900; 12*=2,125; 13*=2,300; 14*=2,500; 15*=2,700; 16*=2,950; 17*=3,150; 18*=3,475; 19*=3,800; 20*=4,175."
      ]
    }),
    actor("Giant (Fire)", {
      ...common, ac: 4, hd: "11 + 2", move: [120, 40], attacks: "1 weapon",
      damage: "5d6", appearing: "1d2 (1d3)", saveAs: "F11", morale: 9,
      intelligence: 13, alignment: "Chaotic", xp: 2125, terrain: "Mountain, Desert",
      description: "Fire giants have red skin and dark hair, stand 16 feet tall, and wear copper, brass or bronze armor. They live near volcanoes, are immune to fire-based attacks, and guard their castles with hydras or hellhounds.",
      special: ["Immunity: Fire-based attacks.", "Thrown Boulders: 3d6 damage; range 60/130/200 yards."]
    }),
    actor("Giant (Sea)", {
      ...common, ac: 0, hd: "9-15", move: [120, 40], attacks: "1 or special",
      damage: "See below", appearing: "1d2 (1d20)", saveAs: "F (level = HD)", morale: 10,
      intelligence: 12, alignment: "Neutral", xp: 1750, terrain: "Ocean",
      description: "Sea giants are usually friendly creatures that live in the deepest ocean canyons. They can hold their breath for a full turn on land and can push water in a 50-foot cone, shoving victims 60 feet away and stunning them for 1d6 rounds.",
      special: [
        "Water Current: 50-foot cone, 30 feet wide at the base; no save for the shove, save vs. death ray or be stunned 1d6 rounds.",
        "Surface Wave: 120 feet long and 60 feet wide; 2d6 hull damage to vessels.",
        "XP by HD: 9*=1,600; 10*=1,750; 11*=1,900; 12*=2,125; 13*=2,300; 14*=2,500; 15*=2,700."
      ]
    })
  ];
}

/** RC p. 197: the Mystic and its Leader have separate stat blocks. */
function mystics() {
  return [
    actor("Mystic", {
      category: "Humanoid", monsterType: "Human (Rare)", terrain: "Any",
      ac: 6, hd: "4", move: [150, 50], attacks: "1 weapon or hand",
      damage: "By weapon or 1d6+1", appearing: "1d8 (6d8)", saveAs: "F4", morale: 8,
      treasure: "V; I, L, M, N, O", intelligence: 12, alignment: "Lawful", xp: 175,
      description: "Mystics are humans who follow a rigorous life of meditation, study and physical training. They live in cloisters and are usually Lawful. Mystics are surprised only on a roll of 1, never wear armor or protective magic, and can use potions and magic items freely.",
      special: ["Surprise: A mystic is surprised only on a roll of 1."]
    }),
    actor("Mystic (Leader)", {
      category: "Humanoid", monsterType: "Human (Rare)", terrain: "Any",
      ac: 3, hd: "7", move: [180, 60], attacks: "1 weapon or 2 hands",
      damage: "By weapon or 1d10/1d10", appearing: "See below", saveAs: "F6",
      morale: 10, treasure: "I, L, M, N, O", intelligence: 12, alignment: "Lawful",
      xp: 1650,
      description: "Mystic leaders are the senior masters of a cloister. They fight with a weapon or two hands for 1d10 damage each and have a larger retinue than ordinary mystics.",
      special: ["Surprise: A mystic is surprised only on a roll of 1."]
    })
  ];
}

function robberFly() {
  return actor("Robber Fly", {
    category: "Normal Animal", monsterType: "Lowlife (Rare)",
    terrain: "Open, Ruins, Woods", ac: 6, hd: "2", move: [90, 30],
    attacks: "1 bite", damage: "1d8", appearing: "1d6 (2d6)", saveAs: "F1",
    morale: 8, treasure: "U", intelligence: 0, alignment: "Neutral", xp: 20,
    description: "A robber fly is a 3-foot giant fly with black and yellow stripes. It prefers giant bees as food and is immune to their poison. Patient hunters, robber flies hide in shadows to surprise prey on 1-4 of a d6 and can leap up to 30 feet to bite.",
    special: ["Flying: 180' (60').", "Surprise: 1-4 on 1d6.", "Immunity: Giant bee poison."]
  });
}

function yellowMold() {
  return actor("Yellow Mold", {
    category: "Lowlife", monsterType: "Fungus", terrain: "Cavern, Ruins",
    ac: 9, hd: "2", move: [0, 0], attacks: "Spores", damage: "1d6 + special",
    appearing: "1d8 (1d4)", saveAs: "F2", morale: 7, treasure: "Nil",
    intelligence: 0, alignment: "Neutral", xp: 25,
    description: "Yellow mold can always be hit. It does not move or fight in melee, but releases spores that deal 1d6 damage and have an additional special effect.",
    special: ["Can always be hit.", "Spores: 1d6 damage plus the special effect described in the Rules Cyclopedia.", "Morale: Not applicable."]
  });
}

function thoul() {
  return actor("Thoul", {
    category: "Humanoid", monsterType: "Monster (Very Rare)",
    terrain: "Any", ac: 6, hd: "3", move: [120, 40],
    attacks: "2 claws or 1 weapon", damage: "1d3/1d3 or by weapon",
    appearing: "1d6 (1d10)", saveAs: "F3", morale: 10, treasure: "C",
    intelligence: 6, alignment: "Chaotic", xp: 65,
    description: "A thoul is a magical combination of a ghoul, a hobgoblin and a troll, and is not Undead. Except up close it looks exactly like a hobgoblin, so thouls often serve as guards to hobgoblin kings and Chaotic rulers.",
    special: [
      "Paralysis: The touch of a thoul paralyses as a ghoul does.",
      "Regeneration: If damaged, it regains 1 hit point per round while alive."
    ]
  });
}

/** RC p. 192: three real pterosaur species replace six collapsed columns. */
function pterosaurs() {
  const common = {
    category: "Normal Animal", monsterType: "Prehistoric Animal (Very Rare)",
    treasure: "Nil", intelligence: 2, alignment: "Neutral"
  };
  return [
    actor("Pterosaur (Pterodactyl)", {
      ...common, ac: 7, hd: "1", move: [0, 0], attacks: "1 beak", damage: "1d3",
      appearing: "2d4 (2d4)", saveAs: "F1", morale: 7, xp: 10,
      terrain: "Hill, Mountain, Jungle (prehistoric)",
      description: "Small pterosaurs are batlike reptiles with 8- to 10-foot wingspans. They hunt insects, birds and small animals by gliding on air currents, attacking human-sized creatures only when driven by great hunger.",
      special: ["Flying: 180' (60')."]
    }),
    actor("Pterosaur (Pteranodon)", {
      ...common, ac: 6, hd: "5", move: [0, 0], attacks: "1 beak", damage: "1d12",
      appearing: "0 (1d4)", saveAs: "F3", morale: 8, xp: 175,
      terrain: "Hill, Mountain, Jungle (prehistoric)",
      description: "Pteranodons are larger, more aggressive pterosaurs with wingspans of up to 50 feet. They often attack and carry off man-sized creatures, and can carry 2,000 cn at full speed or 3,000 cn at half speed.",
      special: ["Flying: 240' (120').", "Carrying: 2,000 cn at full speed; 3,000 cn at half speed."]
    }),
    actor("Pterosaur (Large)", {
      ...common, ac: 5, hd: "10", move: [0, 0], attacks: "1 beak", damage: "3d6",
      appearing: "0 (1d2)", saveAs: "F5", morale: 9, xp: 1000,
      terrain: "Mountain (prehistoric)",
      description: "Large pterosaurs have wingspans over 50 feet and can carry off a creature as large as a warhorse. A surprise attack is a swoop for double damage. They carry 4,000 cn at full speed or 8,000 cn at half speed.",
      special: ["Flying: 180' (60').", "Swoop: Double damage when attacking with surprise.", "Carrying: 4,000 cn at full speed; 8,000 cn at half speed."]
    })
  ];
}

/** RC p. 172: the gemstone dragon family and its two unique rulers. */
function gemstoneDragons() {
  return [
    actor("Dragon, Gemstone", {
      category: "Dragon", monsterType: "Dragon (Rare)", terrain: "Any",
      ac: 3, hd: "6", move: [120, 40], attacks: "2 claws/1 bite or breath",
      damage: "See below", appearing: "1d4 (1d4)", saveAs: "F6", morale: 8,
      treasure: "H", intelligence: 9, alignment: "By variety", xp: 725,
      description: "Gemstone dragons are six distinct varieties: Crystal, Onyx, Jade, Sapphire, Ruby and Amber (or brown). Each is similar to a standard dragon colour and has its own alignment, breath weapon, sleeping chance and chance of speech.",
      special: [
        "Crystal: Lawful, similar to White; breath cold or crystal; 50% asleep; 10% talking.",
        "Onyx: Neutral, similar to Black; breath acid or darkness; 40% asleep; 20% talking.",
        "Jade: Neutral, similar to Green; breath chlorine gas or disease; 30% asleep; 30% talking.",
        "Sapphire: Lawful, similar to Blue; breath lightning or vaporize; 20% asleep; 40% talking.",
        "Ruby: Lawful, similar to Red; breath fire and melt; 10% asleep; 50% talking.",
        "Amber: Chaotic, similar to Gold; breath fire and melt, gas and disease; 5% asleep; 100% talking."
      ]
    }),
    actor("Dragon Ruler (Pearl)", {
      category: "Dragon", monsterType: "Dragon (Unique)", terrain: "Any",
      ac: -8, hd: "24", move: [180, 60], attacks: "Up to 9 (see below)",
      damage: "See below", appearing: "1 (1) (unique)", saveAs: "F36", morale: 10,
      treasure: "H x 4, I x 3, N, O", intelligence: 18, alignment: "Chaotic",
      xp: 25250,
      description: "Pearl, the Moon Dragon, is the ruler of all Chaotic dragons. It flies at 420' (140') and can use up to nine attacks per round, including the breath weapon of any Chaotic dragon.",
      special: ["Flying: 420' (140').", "Breath: As any chaotic dragon."]
    }),
    actor("Dragon Ruler (Diamond)", {
      category: "Dragon", monsterType: "Dragon (Unique)", terrain: "Any",
      ac: -10, hd: "30", move: [180, 60], attacks: "Up to 9 (see below)",
      damage: "See below", appearing: "1 (1) (unique)", saveAs: "F36", morale: 10,
      treasure: "H x 4, I x 3, N, O", intelligence: 18, alignment: "Lawful",
      xp: 38750,
      description: "Diamond, the Star Dragon, is the ruler of all Lawful dragons. It flies at 420' (140') and can use up to nine attacks per round, including the breath weapon of any Lawful dragon.",
      special: ["Floating: 420' (140').", "Breath: As any lawful dragon."]
    })
  ];
}

function wight() {
  return actor("Wight", {
    category: "Undead", monsterType: "Undead, Enchanted (Common)",
    terrain: "Barren Lands, Ruins", ac: 5, hd: "3", move: [90, 30],
    attacks: "1", damage: "Energy drain", appearing: "1d6 (1d8)", saveAs: "F3",
    morale: 12, treasure: "B", intelligence: 5, alignment: "Chaotic", xp: 50,
    description: "A wight is an undead spirit in the body of a dead human or demihuman. Its burial garments are tattered and filthy, and its eyes are hollow and lifeless. Each hit drains one level of experience or Hit Die; a victim drained completely becomes a wight in 1d4 days under the slayer's control.",
    special: ["Can be hit only by silvered or magical weapons.", "Energy Drain: One level or Hit Die per hit."]
  });
}

const REPLACEMENTS = [
  ...lycanthropes(),
  manticore(),
  ...mantas(),
  ...giants(),
  ...mystics(),
  robberFly(),
  yellowMold(),
  thoul(),
  ...pterosaurs(),
  ...gemstoneDragons(),
  wight()
];

/** Names produced by the old OCR for the collapsed blocks. */
const OBSOLETE = /^(?:Lycanthrope|Manticore|Manta Ray|Giant|Mystic|Robber Fly|Yellow Mold|Thoul|Dragon, Gemstone) \(Form \d+\)$/i;
const OBSOLETE_PTEROSAUR = /^Pterosaur \((?:\(Pteranodon\)|\(Pterodactyl\)|\(Pterosaur\)|Large|Medium|Small)\)$/i;
const OBSOLETE_CROSSREF = /^Were\(creature\)$/i;

/**
 * Replace collapsed artifacts with named sheets. Existing names are preserved
 * unless they are one of the synthetic OCR entries explicitly listed above.
 */
export function repairMonsterVariants(monsters) {
  if (!Array.isArray(monsters)) return monsters;
  // Curated sheets always win, so re-running the builder refreshes them even
  // when the OCR already produced a same-named entry.
  const curated = new Set(REPLACEMENTS.map((entry) => entry.name));
  const kept = monsters.filter((entry) => {
    const name = String(entry?.name ?? "").trim();
    return !curated.has(name) && !OBSOLETE.test(name)
      && !OBSOLETE_PTEROSAUR.test(name) && !OBSOLETE_CROSSREF.test(name);
  });
  return [...kept, ...REPLACEMENTS];
}

export const VARIANT_NAMES = REPLACEMENTS.map((entry) => entry.name);
