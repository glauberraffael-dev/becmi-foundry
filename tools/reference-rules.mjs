/**
 * Compact rules reference used by the JournalEntry and RollTable compendia.
 *
 * The text is written from the structured Rules Cyclopedia data already used
 * by the system. The scanned PDF/OCR export is a build-time input only and is
 * never copied into these documents.
 */
import { RC } from "../scripts/rc-data.mjs";
import { rollTable } from "./mastery-data.mjs";

const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

const htmlTable = (headers, rows) =>
  `<table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>` +
  rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("") +
  "</tbody></table>";

const p = (content) => ({ name: "Reference", type: "text", text: { content } });

const SAVE_LABELS = ["Death Ray / Poison", "Magic Wands", "Paralysis / Petrify", "Breath Weapon", "Spells"];
const THIEF_LABELS = ["Pick Pockets", "Open Locks", "Find Traps", "Remove Traps", "Climb Walls",
  "Move Silently", "Hide in Shadows", "Hear Noise", "Backstab"];
const UNDEAD_LABELS = ["Skeleton", "Zombie", "Ghoul", "Wight", "Wraith", "Mummy", "Spectre", "Vampire",
  "Phantom", "Haunt", "Spirit", "Nightshade", "Lich", "Special"];

function levelBands(thresholds) {
  return thresholds.map((threshold, index) => {
    const start = index === 0 ? 1 : threshold;
    const next = thresholds[index + 1];
    const end = next ? next - 1 : 36;
    return start === end ? `${start}` : `${start}-${end}`;
  });
}

function savingThrowTable(classKey) {
  const cls = RC.classes[classKey];
  const bands = levelBands(cls.saves.thresholds);
  const rows = cls.saves.rows.map((values, index) => [SAVE_LABELS[index], ...values]);
  return htmlTable(["Level", ...bands], [
    ...rows.map((row) => {
      const [label, ...values] = row;
      return [`≥ ${label}`, ...values];
    })
  ]);
}

function spellSlotsTable(classKey) {
  const slots = RC.spellSlots[classKey] ?? [];
  return htmlTable(
    ["Level", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    slots.map((row, index) => [index + 1, ...Array.from({ length: 9 }, (_, slot) => row[slot] ?? "—")])
  );
}

function attackMatrixRows() {
  return RC.attack.sequence.map((needed, index) => [`AC ${index - 10}`, needed]);
}

const CHAPTER_RULES = {
  1: `<h2>Steps in Character Creation</h2>
<p>Choose an alignment, roll six ability scores in order, select a class that satisfies the prime requisite, then record hit points, armor class, saving throws, starting equipment and languages. Strength, Intelligence, Wisdom, Dexterity, Constitution and Charisma are scored from 3 to 18; the normal modifier is -3 at 3, -2 at 4-5, -1 at 6-8, none at 9-12, +1 at 13-15, +2 at 16-17 and +3 at 18. A prime requisite of 13 or better grants a 5% XP bonus; 9 or lower grants a 10% XP penalty.</p>
<p>Starting hit points are the maximum of the class hit die plus the Constitution adjustment; subsequent levels roll the hit die, with a minimum of 1 point. Starting gold is 3d6 x 10 gp. Characters begin with a languages score based on Intelligence and buy equipment from the Equipment chapter.</p>`,
  2: `<h2>The Character Classes</h2>
<p>Choose one class. A human may reach level 36 as a fighter, cleric, magic-user or thief; demihumans have lower maximum levels and class restrictions. A class supplies hit dice, attack progression, saving throws, experience requirements, spell access and special abilities.</p>
${htmlTable(["Class", "Hit die", "Prime requisite", "Max level", "Notes"], [
  ["Cleric", "d8", "Wisdom", "36", "Turn undead; cleric spells"],
  ["Fighter", "d10", "Strength", "36", "Weapon mastery; no spells"],
  ["Magic-User", "d4", "Intelligence", "36", "Magic-user spells; read magic"],
  ["Thief", "d6", "Dexterity", "36", "Thief skills; backstab"],
  ["Dwarf", "d8", "Constitution", "12", "Fighter abilities; detect tricks"],
  ["Elf", "d6", "Intelligence", "10", "Magic-user spells plus fighter abilities"],
  ["Halfling", "d6", "Dexterity", "8", "Fighter abilities; hiding and missile bonus"]
])}
<p>Multiclassing is not used. The optional Druid is an extension of the Cleric: it keeps cleric hit dice, saves and XP, but uses the druid spell list and druid restrictions. The Mystic is an optional variant handled by the DM.</p>`,
  3: `<h2>Spells and Spellcasting</h2>
<p>Spells are divided into nine levels and into the cleric, druid and magic-user lists. Clerics and druids receive spells through their deity; magic-users learn spells from spellbooks and need read magic to decipher them. A caster can only prepare the number of spells shown by the level table, and a spell is expended when cast.</p>
${htmlTable(["Class", "Level 1", "Level 2", "Level 3", "Level 4", "Level 5", "Level 6", "Level 7", "Level 8", "Level 9"],
  RC.spellSlots["cleric"].slice(0, 12).map((row, index) => [
    `Cleric ${index + 1}`, ...Array.from({ length: 9 }, (_, slot) => row[slot] ?? "—")
  ]).concat(RC.spellSlots["magic-user"].slice(0, 12).map((row, index) => [
    `Magic-User ${index + 1}`, ...Array.from({ length: 9 }, (_, slot) => row[slot] ?? "—")
  ])))}
<p>A spell description gives range, duration, effect and often a saving throw. Reversible spells can be cast in an opposite form, usually with a saving throw allowed. Magical defenses modify saving throws, and anti-magic areas suppress spell effects.</p>`,
  4: `<h2>Equipment</h2>
<p>Coins weigh 10 per pound (100 cn), gems and jewels are carried separately, and each item has a cost in gold pieces and a weight in coin weight. Armor class is descending: unarmored AC 9, leather 7, scale 6, chain 5, banded 4, plate 3 and full plate 0. A shield subtracts 1 from AC.</p>
${htmlTable(["Armor", "AC", "Cost", "Weight"], [
  ["Shield", "-1", "10 gp", "100 cn"],
  ["Leather", "7", "20 gp", "200 cn"],
  ["Scale mail", "6", "30 gp", "300 cn"],
  ["Chain mail", "5", "40 gp", "400 cn"],
  ["Banded mail", "4", "50 gp", "450 cn"],
  ["Plate mail", "3", "60 gp", "500 cn"],
  ["Full plate", "0", "250 gp", "750 cn"]
])}
<p>Weapons list damage, range, cost and encumbrance; two-handed and missile weapons have the usual restrictions. Adventuring gear, transport and siege equipment are bought from the Equipment compendium.</p>`,
  5: `<h2>Other Character Abilities</h2>
<p>Weapon Mastery is optional. Humans receive weapon choices by level; demihumans begin with Basic skill in class-approved weapons. The five ranks are Basic, Skilled, Expert, Master and Grand Master. Each rank improves damage, range, attack bonus, defense or special effects as shown in the Weapon Mastery journal.</p>
<p>The optional General Skills system lets a character buy noncombat skills with weapon choices or skill points. The DM sets the characteristic and difficulty, then the player rolls d20 against the resulting target.</p>`,
  6: `<h2>Movement</h2>
<p>Exploration movement is measured in turns (10 minutes) and dungeon movement in rounds. Encumbered characters move more slowly; the movement rate is derived from total carried weight. Running increases speed but makes stealth impossible and can cause fatigue.</p>
${htmlTable(["Encumbrance (cn)", "Movement / turn", "Movement / round"], [
  ["Up to 400", "120 ft", "12 ft"],
  ["401-600", "90 ft", "9 ft"],
  ["601-800", "60 ft", "6 ft"],
  ["801-1,000", "30 ft", "3 ft"],
  ["Over 1,000", "Cannot move", "—"]
])}
<p>Water and air travel use their own tables for ships, rowing and flying speeds; weather and currents modify travel time.</p>`,
  7: `<h2>Encounters and Evasion</h2>
<p>When an encounter is possible, roll 2d6 for surprise (a result of 1-2 on a d6 can mean surprise for one side) and 2d6 on the monster reaction table. Hostile creatures may attack, parley or flee according to the result; the DM adjusts for obvious strength, alignment and previous conduct.</p>
${htmlTable(["2d6", "Reaction"], [
  ["2-3", "Hostile, attacks immediately"],
  ["4-5", "Hostile, may attack"],
  ["6-7", "Neutral, uncertain"],
  ["8-9", "No attack, may parley"],
  ["10-12", "Friendly, helpful or enthusiastic"]
])}
<p>Wandering monsters are rolled by time and terrain. Evasion, pursuit and hiding use movement rates, surprise and the DM's judgment.</p>`,
  8: `<h2>Combat</h2>
<p>Each round: roll initiative (1d6 per side), resolve morale, movement, missile fire, spells and hand-to-hand attacks in order. To hit, roll d20 and compare the result to the attack matrix using THAC0 and the target's descending AC; a natural 1 always misses and a natural 20 always hits. Damage is rolled after a hit, modified by Strength for melee weapons.</p>
${htmlTable(["Category", "Check", "Success"], [
  ["Attack", "d20 + bonuses", "≥ THAC0 - AC"],
  ["Saving throw", "d20", "≥ saving throw target"],
  ["Ability check", "d20", "≤ ability score + bonus"],
  ["Morale", "2d6", "≤ morale score"],
  ["Turn undead", "2d6", "≥ table cell"]
])}
<p>Morale is checked when foes die or when the situation turns against them. Unarmed combat deals 1d2 or 1d3 damage; grappling, disarming and called shots are optional. Spells cast in combat follow their listed casting time and range.</p>`,
  9: `<h2>Mass Combat</h2>
<p>For battles with many combatants, the War Machine converts each unit into a Combat Result using troop class, hit dice, morale and leaders. Opposing results are compared on the War Machine table to produce casualties, gains and losses. The Siege Machine resolves attacks on fortifications using class, armor and construction factors.</p>
<p>Leaders add their level and ability bonuses; terrain, surprise and morale can shift the result. The system resolves the battle as a whole rather than individual attacks.</p>`,
  10: `<h2>Experience</h2>
<p>XP is awarded for defeating monsters (the XP value in the monster entry), for treasure gained, for completing goals and for good role-playing. The DM divides awards among the characters who earned them. Partial levels are not used.</p>
${htmlTable(["Constitution adjustment", "Hit points per level"], [
  ["-3", "1"], ["-2", "1"], ["-1", "1"], ["None", "Roll hit die (minimum 1)"],
  ["+1", "Roll hit die + 1 (minimum 2)"], ["+2", "Roll hit die + 2 (minimum 3)"],
  ["+3", "Roll hit die + 3 (minimum 4)"]
])}
<p>Class maximum levels and demihuman level limits are enforced by the class tables in the Classes compendium.</p>`,
  11: `<h2>Nonplayer Characters</h2>
<p>Retainers and mercenaries are hired with pay, food and lodging. Their loyalty depends on the employer's Charisma, alignment, treatment and regular pay. Specialists such as sages, smiths and alchemists charge for services and may require contracts or advances.</p>
<p>Hirelings have morale scores and abandon or betray an employer when morale fails. The DM controls all NPC decisions, even when the players negotiate terms.</p>`,
  12: `<h2>Strongholds and Dominions</h2>
<p>A character can build a stronghold after reaching the appropriate level. Construction cost depends on size, materials and fortifications; monthly upkeep covers wages, supplies and repairs. Staff are hired from the NPC rules and have morale and loyalty.</p>
<p>A dominion generates income from taxes, trade and resources. The ruler must maintain order, collect taxes and defend the territory; population and attitude affect revenue.</p>`,
  13: `<h2>Dungeon Master Procedures</h2>
<p>When no specific rule applies, the DM sets a target number on d20 (easy 5, moderate 10, hard 15, very hard 20) and applies the relevant ability adjustment. Ability checks are optional; a natural 20 succeeds and a natural 1 fails when the DM uses that convention.</p>
<p>Aging modifies ability scores at thresholds determined by the DM. Alignment changes require a major shift in behavior and may cause the loss of class abilities. Anti-magic areas suppress spells and magical item powers. The DM's final ruling resolves ambiguous cases.</p>`,
  14: `<h2>Monsters</h2>
<p>Each monster entry lists armor class, hit dice, hit points, number appearing, movement, attacks, damage, special abilities, morale, treasure type and XP value. Hit dice are d8; a "+" adds hit points without changing the HD for attack or saving throw purposes.</p>
<p>Monsters use the same descending AC and saving throw categories as characters. Special attacks such as breath weapons, poison, paralysis and charm usually allow a saving throw with a stated modifier. Treasure type determines the rolled treasure.</p>`,
  15: `<h2>Immortals</h2>
<p>Immortal characters use spheres (matter, energy, time, space and thought) and ranks from novice to Hierophant. Each rank grants powers, higher ability scores and increased hit points, while requiring experience and a patron's approval.</p>
<p>Mortals may qualify through the paths of the Dynamism, the Hierarchy or the Void, each with different prerequisites. Immortal magic uses the same level structure but much larger energy costs.</p>`,
  16: `<h2>Treasure</h2>
<p>Treasure is generated by lettered types that specify coins, gems, jewelry and magical items. Gold, electrum, silver, copper and platinum have different values; gems and jewelry are valued individually and weigh less than coins.</p>
<p>Magical items include potions, scrolls, rings, wands, staves, swords, armor and miscellaneous items. Missile talents such as speaking, stunning, teleporting, transporting and wounding are separate from ordinary item powers. Creating an item costs gold and spell levels and requires a roll for success.</p>`,
  17: `<h2>Campaigning</h2>
<p>A campaign links adventures into a continuing world. The DM prepares key locations, factions, rumors and encounters, then adapts them to player choices. Consistent timekeeping, geography and NPC memory make the setting believable.</p>
<p>Use wandering monsters, random treasure and reaction checks sparingly so that the story remains coherent. Reward clever plans as well as combat, and let character actions change the world.</p>`
};

const CORE_REFERENCE_PAGES = [
  {
    ...p(`<h2>Combat Sequence</h2>
<ol><li>Roll 1d6 for each side; the higher roll acts first.</li><li>Check morale for NPCs and monsters.</li><li>Move, then resolve missile fire, spells and hand-to-hand attacks.</li><li>Apply damage and resolve special effects.</li></ol>
<p>Attack: d20 + Strength/Dexterity + magic + mastery versus THAC0 - AC. Natural 1 misses; natural 20 hits automatically. Damage uses the weapon die plus Strength for melee attacks.</p>`),
    name: "Combat Sequence"
  },
  {
    ...p(`<h2>Attack Matrix</h2>
<p>Read the row for the target's AC to find the needed modified d20 result. The dagger symbol marks an automatic hit on a natural 20; a natural 1 still misses.</p>
${htmlTable(["AC", "Needed"], attackMatrixRows())}`),
    name: "Attack Matrix"
  },
  {
    ...p(`<h2>Saving Throws</h2>
<p>Roll d20; the throw succeeds when the total equals or exceeds the target. Wisdom adjusts saves vs. spells; magic items can add bonuses.</p>
<p>Fighter</p>${savingThrowTable("fighter")}
<p>Cleric / Thief</p>${savingThrowTable("cleric")}
<p>Magic-User</p>${savingThrowTable("magic-user")}`),
    name: "Saving Throws"
  },
  {
    ...p(`<h2>Spellcasting</h2>
<p>Spell slots reset after rest and study. A magic-user must have the spell in the spellbook; clerics and druids receive spells from their deity.</p>
${htmlTable(["Class", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  RC.spellSlots["cleric"].slice(0, 10).map((row, index) => [
    `Cleric ${index + 1}`, ...Array.from({ length: 9 }, (_, slot) => row[slot] ?? "—")
  ]))}
${htmlTable(["Class", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  RC.spellSlots["magic-user"].slice(0, 10).map((row, index) => [
    `Magic-User ${index + 1}`, ...Array.from({ length: 9 }, (_, slot) => row[slot] ?? "—")
  ]))}`),
    name: "Spellcasting"
  },
  {
    ...p(`<h2>Encumbrance and Movement</h2>
${htmlTable(["Carried weight", "Movement / turn", "Movement / round"], [
  ["Up to 400 cn", "120 ft", "12 ft"],
  ["401-600 cn", "90 ft", "9 ft"],
  ["601-800 cn", "60 ft", "6 ft"],
  ["801-1,000 cn", "30 ft", "3 ft"],
  ["Over 1,000 cn", "Cannot move", "—"]
])}
<p>Coins weigh 10 per cn; gems and jewelry are recorded separately.</p>`),
    name: "Encumbrance"
  },
  {
    ...p(`<h2>Treasure</h2>
<p>Treasure types are rolled from the Treasure tables. Coins, gems and jewelry are valued separately; magical items are identified by their descriptions.</p>
${htmlTable(["Category", "Contents"], [
  ["Potions", "Single-use liquids with effects such as healing, control, defense or illusion"],
  ["Miscellaneous magical items", "Permanent items such as helms, lamps, medallions and girdles"],
  ["Missile talents", "Special effects carried by magical missiles"],
  ["Enchantment rules", "Costs, attack limits, reproduction and special attacks for constructed items"]
])}
<p>Creating a magical item requires the caster to supply the spell levels, pay the gold cost and roll for success.</p>`),
    name: "Treasure"
  }
];

/** JournalEntry documents for the reference compendium. */
export function buildReferenceJournals(masteryJournal) {
  const chapters = Object.entries(CHAPTER_RULES).map(([number, content]) => ({
    name: `Chapter ${number}: ${{
      1: "Steps in Character Creation", 2: "The Character Classes", 3: "Spells and Spellcasting",
      4: "Equipment", 5: "Other Character Abilities", 6: "Movement", 7: "Encounters and Evasion",
      8: "Combat", 9: "Mass Combat", 10: "Experience", 11: "Nonplayer Characters",
      12: "Strongholds and Dominions", 13: "Dungeon Master Procedures", 14: "Monsters",
      15: "Immortals", 16: "Treasure", 17: "Campaigning"
    }[number]}`,
    flags: { becmi: { source: "Rules Cyclopedia", chapter: Number(number) } },
    pages: [{ ...p(content), name: "Rules" }]
  }));

  const core = {
    name: "Core Rules Reference",
    flags: { becmi: { source: "Rules Cyclopedia", category: "Reference" } },
    pages: CORE_REFERENCE_PAGES
  };

  const mastery = structuredClone(masteryJournal);
  mastery.pages = mastery.pages.map((page) => ({
    ...page,
    text: {
      ...page.text,
      content: String(page.text?.content ?? "")
        .replace(/Full rules text is not reproduced here\./g, "Rules are summarized in the tables on this page.")
        .replace(/Short paraphrase of Rules Cyclopedia, Chapter 5\. The full text remains in the source PDF\./g,
          "Condensed reference from Rules Cyclopedia, Chapter 5.")
        .replace(/Condensed from the scanned table on PDF page 78; check the original for exact cell alignment\./g,
          "Compact reference table; check the source for exact cell alignment.")
        .replace(/Condensed from the scanned table on PDF page 79; check the original for exact cell alignment\./g,
          "Compact reference table; check the source for exact cell alignment.")
    }
  }));

  return [...chapters, core, mastery];
}

/** RollTable documents that expose reference data as lookup tables. */
export function buildReferenceTables() {
  const tables = [
    rollTable("Ability Score Modifiers", "Reference", [
      ["3", "-3"], ["4-5", "-2"], ["6-8", "-1"], ["9-12", "0"],
      ["13-15", "+1"], ["16-17", "+2"], ["18", "+3"]
    ]),
    rollTable("Attack Roll Matrix", "Reference", attackMatrixRows()),
    rollTable("Saving Throws — Fighter", "Reference",
      RC.classes.fighter.saves.rows.flatMap((values, index) =>
        levelBands(RC.classes.fighter.saves.thresholds).map((band, column) =>
          [`${band} ${SAVE_LABELS[index]}`, values[column]]))),
    rollTable("Saving Throws — Cleric and Thief", "Reference",
      RC.classes.cleric.saves.rows.flatMap((values, index) =>
        levelBands(RC.classes.cleric.saves.thresholds).map((band, column) =>
          [`${band} ${SAVE_LABELS[index]}`, values[column]]))),
    rollTable("Saving Throws — Magic-User", "Reference",
      RC.classes["magic-user"].saves.rows.flatMap((values, index) =>
        levelBands(RC.classes["magic-user"].saves.thresholds).map((band, column) =>
          [`${band} ${SAVE_LABELS[index]}`, values[column]]))),
    rollTable("Thief Skills by Level", "Reference", RC.thief.map((row, index) =>
      [`Level ${index + 1}`,
        row.map((value, skill) => `${THIEF_LABELS[skill] ?? skill}: ${value}%`).join(" | ")])),
    rollTable("Turn Undead Results", "Reference", RC.turnUndead.rows.map((row, index) =>
      [UNDEAD_LABELS[index] ?? row.name,
        row.values.map((value, column) => `Levels ${RC.turnUndead.columns[column]}: ${value}`).join(" | ")])),
    rollTable("Spell Slots — Cleric", "Reference", spellSlotsTable("cleric").match(/<tr>.*?<\/tr>/g)?.slice(1)
      .map((row, index) => [`Level ${index + 1}`, row.replace(/<[^>]+>/g, " ").trim()]) ?? []),
    rollTable("Spell Slots — Magic-User", "Reference", spellSlotsTable("magic-user").match(/<tr>.*?<\/tr>/g)?.slice(1)
      .map((row, index) => [`Level ${index + 1}`, row.replace(/<[^>]+>/g, " ").trim()]) ?? [])
  ];
  return tables;
}
