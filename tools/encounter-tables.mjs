/**
 * Random encounter tables from Rules Cyclopedia chapter 7.
 *
 * The OCR interleaves the printed columns and mangles dice notation (1dl0,
 * Sp1der, W1dow). These records are curated once here so rebuilding the data
 * stays reproducible and Foundry receives genuine RollTables with one result
 * per die face. Multi-column tables keep every terrain column in the result
 * text; the castle/city subtables are rollable RollTables and their reaction
 * procedures remain in the Core Rules Reference journal.
 */

let counter = 0;
const nextId = () => `enc${String(++counter).padStart(13, "0")}`;

function table(name, category, formula, rows, note) {
  const flags = { becmi: { source: "Rules Cyclopedia", category } };
  if (note) flags.becmi.note = note;
  return {
    name,
    flags,
    formula,
    results: rows.map(([range, text]) => ({
      _id: nextId(),
      type: "text",
      text,
      range: Array.isArray(range) ? range : [range, range],
      weight: 1,
      drawn: false
    }))
  };
}

function dungeonTable(name, rows, note) {
  return table(name, "Dungeon Encounters", "1d20", rows, note);
}

function columnTable(name, category, formula, columns, rows, note) {
  return table(
    name,
    category,
    formula,
    rows.map((values, index) => [
      index + 1,
      columns.map((column, i) => `${column}: ${values[i]}`).join("; ")
    ]),
    note
  );
}

const REACTIONS = [
  [2, "Monster attacks"],
  [3, "Monster attacks"],
  [4, "Monster is aggressive (growls, threatens); roll again in one round with a penalty of -4 to the roll"],
  [5, "Monster is aggressive (growls, threatens); roll again in one round with a penalty of -4 to the roll"],
  [6, "Monster is aggressive (growls, threatens); roll again in one round with a penalty of -4 to the roll"],
  [7, "Monster is cautious; roll again in one round"],
  [8, "Monster is cautious; roll again in one round"],
  [9, "Monster is cautious; roll again in one round"],
  [10, "Monster is neutral; roll again in one round with a bonus of +4 to the roll"],
  [11, "Monster is neutral; roll again in one round with a bonus of +4 to the roll"],
  [12, "Monster is friendly"]
];

export const REACTION_TABLE = {
  name: "Monster Reactions (2d6)",
  flags: { becmi: { source: "Rules Cyclopedia", category: "Reactions" } },
  formula: "2d6",
  results: REACTIONS.map(([range, text], i) => ({
    _id: `reaction${i}`.padEnd(16, "0"),
    type: "text",
    text,
    range: [range, range],
    weight: 1,
    drawn: false
  }))
};

const DUNGEON_TABLES = [
  ["Dungeon Encounters Level 1 (1d20)", [
    [1, "Bandit - 1d6"],
    [2, "Beetle, Fire - 1d6"],
    [3, "Cave Locust - 1d6"],
    [4, "Centipede, Giant - 1d6"],
    [5, "Ghoul - 1d2"],
    [6, "Goblin - 1d6"],
    [[7, 10], "Human - 1d3"],
    [11, "Kobold - 2d6"],
    [12, "Lizard, Gecko - 1d2"],
    [13, "NPC Party - 1 party"],
    [14, "Orc - 1d6"],
    [15, "Skeleton - 1d10"],
    [16, "Snake, Racer - 1d2"],
    [17, "Spider, Crab - 1d2"],
    [18, "Stirge - 1d8"],
    [19, "Troglodyte - 1d3"],
    [20, "Zombie - 1d3"]
  ]],
  ["Dungeon Encounters Level 2 (1d20)", [
    [1, "Beetle, Oil - 1d6"],
    [2, "Carrion Crawler - 1"],
    [3, "Ghoul - 1d4"],
    [4, "Gnoll - 1d4"],
    [5, "Goblin - 2d4"],
    [6, "Gray Ooze - 1"],
    [7, "Hobgoblin - 1d6"],
    [[8, 10], "Human - 1d3"],
    [11, "Lizard, Draco - 1"],
    [12, "Lizard Man - 1d6"],
    [13, "Neanderthal - 2d4"],
    [14, "NPC Party - 1 party"],
    [15, "Orc - 1d10"],
    [16, "Skeleton - 2d6"],
    [17, "Snake, Pit Viper - 1d6"],
    [18, "Spider, Black Widow - 1"],
    [19, "Troglodyte - 1d6"],
    [20, "Zombie - 1d6"]
  ]],
  ["Dungeon Encounters Level 3 (1d20)", [
    [1, "Ape, White - 1d4"],
    [2, "Beetle, Tiger - 1d4"],
    [3, "Bugbear - 1d6"],
    [4, "Carrion Crawler - 1d3"],
    [5, "Doppelganger - 1d2"],
    [6, "Gargoyle - 1d3"],
    [7, "Gelatinous Cube - 1"],
    [8, "Harpy - 1d3"],
    [[9, 10], "Human - 1d3"],
    [11, "Living Statue, Crystal - 1d4"],
    [12, "Lycanthrope, Wererat - 1d6"],
    [13, "Medusa - 1"],
    [14, "NPC Party - 1 party"],
    [15, "Ochre Jelly - 1"],
    [16, "Ogre - 1d3"],
    [17, "Shadow - 1d4"],
    [18, "Spider, Tarantella - 1"],
    [19, "Thoul - 1d4"],
    [20, "Wight - 1d3"]
  ]],
  ["Dungeon Encounters Levels 4-5 (1d20)", [
    [1, "Blink Dog - 1d4"],
    [2, "Bugbear - 1d6+4"],
    [3, "Caecilia - 1"],
    [4, "Cockatrice - 1d2"],
    [5, "Displacer Beast - 1"],
    [6, "Gargoyle - 1d4+1"],
    [7, "Giant, Hill - 1"],
    [8, "Harpy - 1d4+1"],
    [9, "Hellhound (1d3+2 HD) - 1d4"],
    [10, "Hydra (5-headed) - 1"],
    [11, "Lycanthrope, Werewolf - 1d4"],
    [12, "Medusa - 1d2"],
    [13, "Mummy - 1d3"],
    [14, "NPC Party - 1"],
    [15, "Ochre Jelly - 1"],
    [16, "Rhagodessa - 1d3"],
    [17, "Rust Monster - 1d2"],
    [18, "Scorpion, Giant - 1d3"],
    [19, "Troll - 1d2"],
    [20, "Wraith - 1d2"]
  ]],
  ["Dungeon Encounters Levels 6-7 (1d20)", [
    [1, "Basilisk - 1d3"],
    [2, "Caecilia - 1d4"],
    [3, "Cockatrice - 1d3"],
    [4, "Giant, Hill - 1d2"],
    [5, "Giant, Stone - 1d2"],
    [6, "Hellhound (5-7 HD) - 1d4"],
    [7, "Hydra (6-8 heads) - 1"],
    [8, "Lycanthrope (weretiger or werebear) - 1d3"],
    [9, "Manticore - 1"],
    [10, "Minotaur - 1d4"],
    [11, "Mummy - 1d4"],
    [12, "NPC Party - 1"],
    [13, "Ochre Jelly - 1"],
    [14, "Ogre - 2d4"],
    [15, "Rust Monster - 1d3+1"],
    [16, "Spectre - 1d3"],
    [17, "Spider, Tarantella - 1d3"],
    [18, "Salamander, Flame - 1d2"],
    [19, "Troll - 1d4+1"],
    [20, "Vampire - 1"]
  ]],
  ["Dungeon Encounters Levels 8-10 (1d20)", [
    [1, "Basilisk - 1d6"],
    [2, "Black Pudding - 1"],
    [3, "Chimera - 1"],
    [4, "Devil Swine - 1d2"],
    [5, "Dragon - 1d2"],
    [[6, 7], "Giant (select a type; adjust the number for level) - 1d6"],
    [8, "Golem (select a type; adjust the number for level) - 1"],
    [9, "Hydra (7-12 heads) - 1"],
    [10, "Living Statue (select a type; adjust the number for level) - 1d4+1"],
    [[11, 12], "Lycanthrope (select a type; adjust the number for level) - 1d6+1"],
    [13, "NPC Party - 1"],
    [14, "Purple Worm - 1"],
    [15, "Rust Monster - 1d4+1"],
    [16, "Salamander (select a type; adjust the number for level) - 1d4"],
    [17, "Snake (select a type; adjust the number for level) - 1d4+1"],
    [18, "Spectre - 1d3"],
    [19, "Spider (select a type; adjust the number for level) - 1d4+1"],
    [20, "Vampire - 1d2"]
  ]]
].map(([name, rows]) => dungeonTable(name, rows));

const WILDERNESS_MAIN = [
  ["Wilderness Encounters: Clear/Grassland, Woods, River, Swamp (1d8)", [
    "Clear, Grassland", "Woods", "River", "Swamp"
  ], [
    ["Human", "Human", "Human", "Human"],
    ["Flyer", "Flyer", "Flyer", "Flyer"],
    ["Humanoid", "Humanoid", "Humanoid", "Humanoid"],
    ["Animal", "Insect", "Insect", "Swimmer"],
    ["Animal", "Unusual", "Swimmer", "Undead"],
    ["Unusual", "Animal", "Swimmer", "Undead"],
    ["Dragon", "Animal", "Animal", "Insect"],
    ["Insect", "Dragon", "Dragon", "Dragon"]
  ]],
  ["Wilderness Encounters: Barren/Mountain/Hill, Desert, Settled (1d8)", [
    "Barren, Mountain, Hill", "Desert", "Settled"
  ], [
    ["Human", "Human", "Castle (Subtable 10)"],
    ["Flyer", "Flyer", "Flyer"],
    ["Humanoid", "Humanoid", "Humanoid"],
    ["Unusual", "Human", "Human"],
    ["Animal", "Animal", "Human"],
    ["Humanoid", "Dragon", "Animal"],
    ["Dragon", "Undead", "Animal"],
    ["Dragon", "Animal", "Dragon"]
  ]],
  ["Wilderness Encounters: City, Ocean, Jungle (1d8)", [
    "City", "Ocean", "Jungle"
  ], [
    ["Human", "Human", "Human"],
    ["Undead", "Flyer", "Flyer"],
    ["Humanoid", "Swimmer", "Insect"],
    ["Human", "Swimmer", "Insect"],
    ["Human", "Swimmer", "Humanoid"],
    ["Human", "Swimmer", "Animal"],
    ["Human", "Swimmer", "Animal"],
    ["Special (Subtable 11)", "Dragon", "Dragon"]
  ]]
].map(([name, columns, rows]) =>
  columnTable(name, "Wilderness Encounters", "1d8", columns, rows));

const SUBTABLES = [
  ["Wilderness Subtable 1: Animals (1d12)", [
    "Clear, Grassland", "Woods", "River", "Barren, Mountain, Hill", "Desert", "Settled", "Jungle", "Prehistoric"
  ], [
    ["Animal Herd", "Animal Herd", "Animal Herd", "Animal Herd", "Animal Herd", "Animal Herd", "Animal Herd", "Bear, Cave"],
    ["Baboon, Rock", "Boar", "Boar", "Ape, Snow", "Animal Herd", "Animal Herd", "Boar", "Cat, Sabretooth"],
    ["Boar", "Cat, Panther", "Cat, Panther", "Ape, White", "Camel", "Boar", "Cat, Panther", "Crocodile, Giant"],
    ["Cat, Lion", "Cat, Tiger", "Cat, Tiger", "Baboon, Rock", "Camel", "Cat, Tiger", "Lizard, Draco", "Elephant, Mastodon"],
    ["Elephant", "Lizard, Gecko", "Crab, Giant", "Bear, Cave", "Cat, Lion", "Ferret, Giant", "Lizard, Gecko", "Pterodactyl"],
    ["Ferret, Giant", "Lizard, Draco", "Crocodile", "Bear, Grizzly", "Cat, Lion", "Horse, Riding", "Lizard, Horned", "Pteranodon"],
    ["Horse, Riding", "Lizard, Tuatara", "Crocodile, Large", "Cat, Mountain Lion", "Lizard, Gecko", "Rat, Giant", "Rat, Giant", "Snake, Racer"],
    ["Lizard, Draco", "Snake, Viper", "Fish, Rock", "Mule", "Lizard, Tuatara", "Shrew, Giant", "Shrew, Giant", "Snake, Viper"],
    ["Mule", "Spider, Crab", "Leech, Giant", "Snake, Viper", "Snake, Viper", "Snake, Racer", "Snake, Viper", "Triceratops"],
    ["Snake, Viper", "Unicorn", "Rat, Giant", "Snake, Rattler", "Snake, Rattler", "Snake, Viper", "Snake, Python", "Triceratops"],
    ["Snake, Rattler", "Wolf", "Shrew, Giant", "Wolf", "Spider, Widow", "Spider, Tarantella", "Snake, Spitting", "Tyrannosaurus"],
    ["Weasel, Giant", "Wolf, Dire", "Toad, Giant", "Wolf, Dire", "Spider, Tarantella", "Wolf", "Spider, Crab", "Wolf, Dire"]
  ]],
  ["Wilderness Subtable 2: Humanoids (1d12)", [
    "Clear, Grassland", "Woods", "River", "Swamp", "Barren, Mountain, Hill", "Desert", "City and Inhabited", "Jungle"
  ], [
    ["Bugbear", "Bugbear", "Bugbear", "Gnoll", "Dwarf", "Giant, Fire", "Dwarf", "Bugbear"],
    ["Elf", "Cyclops", "Elf", "Goblin", "Giant, Cloud", "Goblin", "Elf", "Cyclops"],
    ["Giant, Hill", "Dryad", "Gnoll", "Hobgoblin", "Giant, Frost", "Hobgoblin", "Giant, Hill", "Elf"],
    ["Gnoll", "Elf", "Hobgoblin", "Lizard Man", "Giant, Hill", "Hobgoblin", "Gnome", "Giant, Fire"],
    ["Goblin", "Giant, Hill", "Lizard Man", "Lizard Man", "Giant, Stone", "Ogre", "Gnoll", "Giant, Hill"],
    ["Halfling", "Gnoll", "Lizard Man", "Lizard Man", "Giant, Storm", "Ogre", "Goblin", "Gnoll"],
    ["Hobgoblin", "Goblin", "Nixie", "Nixie", "Gnome", "Ogre", "Halfling", "Goblin"],
    ["Ogre", "Hobgoblin", "Ogre", "Ogre", "Goblin", "Orc", "Hobgoblin", "Lizard Man"],
    ["Orc", "Ogre", "Orc", "Orc", "Kobold", "Orc", "Ogre", "Ogre"],
    ["Pixie", "Orc", "Sprite", "Troglodyte", "Orc", "Pixie", "Orc", "Orc"],
    ["Thoul", "Thoul", "Thoul", "Troll", "Troglodyte", "Sprite", "Pixie", "Troglodyte"],
    ["Troll", "Troll", "Troll", "Troll", "Troll", "Thoul", "Sprite", "Troll"]
  ]],
  ["Wilderness Subtable 3: Humans (1d12)", [
    "Clear, Grassland", "Woods", "River", "Hill", "Desert", "Settled", "Ocean", "Jungle", "Swamp"
  ], [
    ["Adventurer", "Adventurer", "Adventurer", "Adventurer", "Adventurer", "Acolyte", "Adventurer", "Adventurer", "Adventurer"],
    ["Bandit", "Bandit", "Bandit", "Bandit", "Cleric", "Adventurer", "Buccaneer", "Adventurer", "Adventurer"],
    ["Bandit", "Bandit", "Buccaneer", "Berserker", "Dervish", "Bandit", "Buccaneer", "Bandit", "Bandit"],
    ["Berserker", "Berserker", "Buccaneer", "Berserker", "Dervish", "Bandit", "Merchant", "Berserker", "Bandit"],
    ["Brigand", "Brigand", "Buccaneer", "Brigand", "Fighter", "Cleric", "Merchant", "Brigand", "Berserker"],
    ["Cleric", "Brigand", "Cleric", "Caveman", "Magic-User", "Fighter", "Merchant", "Brigand", "Brigand"],
    ["Fighter", "Brigand", "Cleric", "Caveman", "Merchant", "Magic-User", "Merchant", "Brigand", "Cleric"],
    ["Magic-User", "Cleric", "Fighter", "Caveman", "Noble", "Merchant", "Merchant", "Caveman", "Fighter"],
    ["Merchant", "Fighter", "Magic-User", "Cleric", "Nomad", "Noble", "Pirate", "Cleric", "Magic-User"],
    ["Merchant", "Magic-User", "Merchant", "Fighter", "Nomad", "NPC Party", "Pirate", "Fighter", "Merchant"],
    ["Noble", "Merchant", "Merchant", "Magic-User", "Nomad", "Trader", "Pirate", "Magic-User", "NPC Party"],
    ["Nomad", "NPC Party", "NPC Party", "Merchant", "Nomad", "Veteran", "Pirate", "Merchant", "Trader"]
  ]],
  ["Wilderness Subtable 4: Flyers (1d12)", [
    "Mountain", "Desert", "All Other"
  ], [
    ["Bee, Giant", "Gargoyle", "Bee, Giant"],
    ["Gargoyle", "Gargoyle", "Cockatrice"],
    ["Griffon", "Griffon", "Gargoyle"],
    ["Harpy", "Harpy", "Griffon"],
    ["Hippogriff", "Insect Swarm", "Hippogriff"],
    ["Insect Swarm", "Lizard, Draco", "Lizard, Draco"],
    ["Manticore", "Manticore", "Pegasus"],
    ["Pegasus", "Manticore", "Pixie"],
    ["Robber Fly", "Manticore", "Robber Fly"],
    ["Roc, Small", "Roc, Small", "Roc, Small"],
    ["Roc, Large", "Roc, Large", "Sprite"],
    ["Roc, Giant", "Roc, Giant", "Stirge"]
  ]],
  ["Wilderness Subtable 5: Swimmers (1d12)", [
    "River/Lake", "Ocean", "Swamp"
  ], [
    ["Crab, Giant", "Giant, Storm", "Crab, Giant"],
    ["Crocodile", "Hydra, Sea", "Crocodile"],
    ["Crocodile, Large", "Hydra, Sea", "Crocodile"],
    ["Fish, Giant Bass", "Hydra, Sea", "Crocodile, Large"],
    ["Fish, Sturgeon", "Merman", "Crocodile, Large"],
    ["Leech, Giant", "Snake, Sea", "Leech, Giant"],
    ["Leech, Giant", "Snake, Sea", "Leech, Giant"],
    ["Lizard Man", "Snake, Sea", "Leech, Giant"],
    ["Lizard Man", "Snake, Sea", "Lizard Man"],
    ["Merman", "Termite, Water", "Lizard Man"],
    ["Nixie", "Termite, Water", "Termite, Water"],
    ["Termite, Water", "Termite, Water", "Termite, Water"]
  ]],
  ["Wilderness Subtable 6: Dragons (1d12)", ["Roll"], [
    ["Chimera"], ["Dragon, Black"], ["Dragon, Blue"], ["Dragon, Gold"],
    ["Dragon, Green"], ["Dragon, Red"], ["Dragon, White"], ["Hydra"],
    ["Hydra"], ["Wyvern"], ["Salamander, Flame"], ["Salamander, Frost"]
  ], "At sea, roll 1d10 instead of 1d12."],
  ["Wilderness Subtable 7: Insects (1d12)", ["Roll"], [
    ["Ant, Giant"], ["Bee, Giant"], ["Beetle, Fire"], ["Beetle, Oil"],
    ["Beetle, Tiger"], ["Insect Swarm"], ["Rhagodessa"], ["Robber Fly"],
    ["Scorpion, Giant"], ["Spider, Black Widow"], ["Spider, Crab"], ["Spider, Tarantella"]
  ]],
  ["Wilderness Subtable 8: Undead (1d12)", ["Roll"], [
    ["Ghoul"], ["Ghoul"], ["Ghoul"], ["Mummy"], ["Skeleton"], ["Skeleton"],
    ["Spectre"], ["Wight"], ["Wraith"], ["Vampire"], ["Zombie"], ["Zombie"]
  ]],
  ["Wilderness Subtable 9: Unusual (1d12)", ["Roll"], [
    ["Basilisk"], ["Blink Dog"], ["Centaur"], ["Displacer Beast"],
    ["Gorgon"], ["Lycanthrope, Werebear"], ["Lycanthrope, Wereboar"],
    ["Lycanthrope, Wererat"], ["Lycanthrope, Weretiger"], ["Lycanthrope, Werewolf"],
    ["Medusa"], ["Treant"]
  ]]
].map(([name, columns, rows, note]) =>
  columnTable(name, "Wilderness Encounters", "1d12", columns, rows, note));

// RC pp. 95 and 98: the two special wilderness results are also subtables.
// Castle rolls a separate 1d6 for alignment; city rolls 1d8 for a section and
// then 1d20 inside it. Both are kept as real RollTables so the "Subtable 10"
// and "Subtable 11" entries in the wilderness tables are no longer dead ends.
const CASTLE_SUBTABLE = table(
  "Wilderness Subtable 10: Castle Encounters (1d6)",
  "Wilderness Encounters",
  "1d6",
  [
    [1, "Cleric - level 1d20+8; alignment 1d6: 1 Chaotic, 2-4 Neutral, 5-6 Lawful"],
    [2, "Magic-User - level 1d20+8; alignment 1d6: 1 Chaotic, 2-4 Neutral, 5-6 Lawful"],
    [3, "Demihuman - race 1d6: 1-2 Dwarf (12th), 3-4 Elf (10th), 5-6 Halfling (8th); level 1d20+8; alignment 1d6: 1 Chaotic, 2-4 Neutral, 5-6 Lawful"],
    [[4, 6], "Fighter - level 1d20+8; alignment 1d6: 1 Chaotic, 2-4 Neutral, 5-6 Lawful"]
  ],
  "Roll 1d6 for the owner's class, 1d20+8 for level (demihumans use the listed fixed level) and 1d6 for alignment."
);

const CITY_SECTIONS = [
  ["Alchemist", "Animal Trainer", "Apothecary", "Archaeologist", "Armorer",
    "Artist/Sculptor", "Assassin", "Astrologer", "Astronomer", "Athlete",
    "Baker", "Banker", "Barber", "Bartender", "Basketweaver", "Bazaar Merchant",
    "Beekeeper", "Beggar", "Blacksmith", "Boardinghouse Keeper"],
  ["Boatman / Gondolier", "Bodyguard", "Bonecarver", "Bootmaker", "Bowyer",
    "Brewer", "Broommaker", "Butcher", "Candlemaker", "Caravan Master",
    "Carpenter", "Carter", "Chandler", "Charcoalmaker", "Chef", "Chemist",
    "Church / Temple", "Cleric Adventurer", "Coachman", "Constable"],
  ["Construction Worker", "Cooper", "Craft Guildsman", "Dairy Worker", "Dancer",
    "Diplomat", "Diver", "Docksman / Wharfsman", "Doctor / Dentist", "Druid Adventurer",
    "Dwarf Adventurer", "Elf Adventurer", "Entertainer", "Farmer", "Ferryman",
    "Fighter Adventurer", "Fighter, Mercenary", "Fisherman", "Fletcher", "Foundry Worker"],
  ["Freighter", "Furnituremaker", "Furrier", "Gambler", "Gemcutter",
    "Gentleman / Lady", "Geologist", "Glassblower", "Goldsmith", "Government Official",
    "Graveyard Keeper", "Guardsman", "Guide", "Guild Officer", "Halfling Adventurer",
    "Harlot", "Healer", "Herbalist", "Hunter", "Innkeeper"],
  ["Jailor", "Jeweler", "Judge", "Juggler / Mime", "Kennel Keeper",
    "Laborer", "Land Officer", "Lawyer", "Leatherworker", "Lighthouse Keeper",
    "Locksmith", "Logger", "Lumberyard Worker", "Madame", "Madman",
    "Magic-User Adventurer", "Magic-User Guild Officer", "Majordomo", "Mason", "Mayor"],
  ["Merchant", "Merchants' Guild Officer", "Metalsmith", "Military Officer", "Miller",
    "Monastery Worker", "Moneylender", "Mystic Adventurer", "Nobleman / Noblewoman",
    "Peasant", "Peddler", "Politician", "Potter", "Public Bathkeeper", "Ropemaker",
    "Royalty", "Sage", "Sailor, Captain", "Sailor, Common", "Saloonkeeper"],
  ["Schoolteacher", "Scribe", "Serf", "Servant, Hired", "Servant, Indentured",
    "Shipwright", "Shoemaker", "Singer", "Slave", "Smuggler",
    "Soapmaker", "Spy", "Stablekeeper", "Stoneworker", "Tailor",
    "Tanner", "Tavernkeeper", "Tax Assessor", "Taxidermist", "Thatcher"],
  ["Thief Adventurer", "Thieves' Guild Officer", "Town Drunk", "Town Hall Employee",
    "Trading Post Employee", "Translator", "Treasurer", "Undertaker", "Vagrant",
    "Vigilante", "Warehouse Worker", "Watchman", "Watering-Hole Worker", "Weaver",
    "Welldigger", "Wellkeeper", "Wheelwright", "Winemaker", "Woodcarver", "Woodcutter"]
];

const CITY_SUBTABLE = columnTable(
  "Wilderness Subtable 11: City Encounters (1d20)",
  "Wilderness Encounters",
  "1d20",
  CITY_SECTIONS.map((_, index) => `Section ${index + 1}`),
  CITY_SECTIONS[0].map((_, row) => CITY_SECTIONS.map((section) => section[row])),
  "Roll 1d8 first to choose a section, then 1d20 in that section."
);

/** RollTable documents for dungeon and wilderness random encounters. */
export const ENCOUNTER_TABLES = [
  ...DUNGEON_TABLES,
  ...WILDERNESS_MAIN,
  ...SUBTABLES,
  CASTLE_SUBTABLE,
  CITY_SUBTABLE
];
