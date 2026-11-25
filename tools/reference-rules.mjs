/**
 * Compact rules reference used by the JournalEntry and RollTable compendia.
 *
 * The text is written from the structured Rules Cyclopedia data already used
 * by the system. The scanned PDF/OCR export is a build-time input only and is
 * never copied into these documents.
 */
import { RC } from "../scripts/rc-data.mjs";

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
<p>Use wandering monsters, random treasure and reaction checks sparingly so that the story remains coherent. Reward clever plans as well as combat, and let character actions change the world.</p>`,
  18: `<h2>The Planes of Existence</h2>
 <p>The Prime Plane is the balanced home world of ordinary adventurers. Other planes are arranged around it: the Ethereal Plane overlays the Prime, the four Elemental Planes connect to it through wormholes, and the Outer Planes lie beyond them. Interplanar travel normally passes through the Ethereal Plane, because direct travel between the Prime and the elemental spheres is not available to ordinary characters.</p>
 <p>In the Ethereal Plane ether appears as gray fog. Light works normally but illuminates only the ether; infravision is nearly useless because everything shares the same temperature. Visitors can breathe, cannot fall, and cannot walk. Movement requires magic and changes with the material nearby on the Prime Plane: vacuum doubles speed, air is normal, fire or water reduces it to three quarters, soil or wood to half, rock to one quarter, and metal or lead stops movement entirely.</p>
 <p>Elemental planes are hostile environments. Air dominates Water, Water dominates Fire, Fire dominates Earth, and Earth dominates Air; Air and Fire oppose each other, as do Earth and Water. Survival requires spells such as create air or survival, a ring of elemental adaptation, or a talisman of elemental travel. Energy-based effects work normally; matter-based effects may be altered or negated.</p>
 <p>The Outer Planes are the realms of alignment, deities and immortal powers. They are reached by advanced magic or immortal travel. Beyond the multiverse lies whatever the DM places there; use the same plane rules as a frontier rather than assuming fixed physics.</p>`,
  19: `<h2>Variant Rules</h2>
 <p>These options are optional. Apply them consistently or not at all, since they change encounters, advancement and combat pacing.</p>
 <p><strong>Ability scores and saving throws:</strong> in the standard game only Wisdom modifies saves versus spells. The DM may also apply the ability modifier to the matching category: Strength vs. paralysis and petrification, Intelligence vs. mind attacks, Wisdom vs. spells, Dexterity vs. wands and breath weapons, and Constitution vs. poison but not death rays. Charisma gives no save bonus. A combined modifier cannot exceed +3 or -3.</p>
 <p><strong>Death in the campaign:</strong> resurrection magic can be removed to make death final. A gentler option keeps a character at 0 hit points unconscious and mortally wounded: roll a saving throw versus death ray each round while taking damage and once per ten minutes; failure means death. Healing magic or a successful Healing skill check with a -5 penalty stabilizes the character.</p>
 <p><strong>Demihuman and mystic advancement:</strong> the standard caps keep these classes balanced because they begin with many abilities. The extended table lets them reach level 36. Under that option demihumans use the normal attack chart instead of Attack Ranks: dwarves attack as fighters, elves and halflings as clerics; mystics attack as fighters. Hit points above 9th level become fixed, saving throws stop improving at the old cap, and spell access follows the normal spell table for casters.</p>
 <p><strong>Nonlethal combat:</strong> divide each damage roll into real damage (one quarter, rounded down) and nonlethal damage (the remainder). Track them separately. When their sum reaches the target's hit points, the target falls unconscious. Nonlethal damage wears off in two stages of 2d6 x 10 minutes; real damage only heals normally. Unarmed attacks and purpose-built practice weapons have no penalty; using an ordinary weapon to deal nonlethal damage imposes a -3 attack penalty.</p>`
};

const CHAPTER_TITLES = {
  1: "Steps in Character Creation", 2: "The Character Classes", 3: "Spells and Spellcasting",
  4: "Equipment", 5: "Other Character Abilities", 6: "Movement", 7: "Encounters and Evasion",
  8: "Combat", 9: "Mass Combat", 10: "Experience", 11: "Nonplayer Characters",
  12: "Strongholds and Dominions", 13: "Dungeon Master Procedures", 14: "Monsters",
  15: "Immortals", 16: "Treasure", 17: "Campaigning", 18: "The Planes of Existence",
  19: "Variant Rules"
};

const APPENDIX_TITLES = {
  1: "The D&D Game World", 2: "AD&D Game Conversions", 3: "Record Sheets", 4: "Indices"
};

const APPENDIX_RULES = {
  1: `<h2>Appendix 1 — The D&D Game World</h2>
 <p>The Rules Cyclopedia presents two linked campaign settings on the planet Mystara. The Known World is the surface setting where most characters begin: kingdoms, city-states and frontier wilderness suitable for low- and mid-level play. The Hollow World is a vast interior world reached through special passes; it preserves ancient cultures, dinosaur-hunting grounds and immortal guardians, and suits higher-level exploration.</p>
 <p>Use the Known World for a conventional dungeon-and-domain campaign. Introduce the Hollow World when the party is ready for polar openings, longer journeys and immortal politics. Nothing in the system requires either setting; the compendia provide the rules, while the DM supplies geography, factions and rumors.</p>`,
  2: `<h2>Appendix 2 — AD&D Game Conversions</h2>
 <p>When moving characters between the two games, convert levels, not experience points. Levels 1-12 transfer unchanged. Above that, one AD&D level equals three BECMI levels going one way, and three BECMI levels equal one AD&D level going the other; round fractions down. Multiclass AD&D characters use the level of the active class, and dual-class characters use their active class.</p>
 <p>Keep Lawful-Neutral-Chaotic as a role-playing axis when converting to BECMI; assign Good-Neutral-Evil from past behavior when converting to AD&D. Use equivalent spells where they exist and assume knowledge is lost where no equivalent exists. Ordinary equipment, encumbrance and money are converted by using the target game's tables; adjust the starting purse so it fits the treasure level of the new campaign.</p>
 ${htmlTable(["BECMI armor", "BECMI AC", "AD&D AC"], [
   ["None", "9", "10"], ["Leather", "7", "8"], ["Scale", "6", "6"],
   ["Chain", "5", "5"], ["Banded", "4", "4"], ["Plate", "3", "3"], ["Suit armor", "1", "—"]
 ])}
 <p>A shield gives -1 AC in both systems. Weapon mastery of Expert or better converts to the target game's weapon proficiency; demihuman multiclass options that have no BECMI equivalent should be approved by the DM case by case.</p>`,
  3: `<h2>Appendix 3 — Record Sheets</h2>
 <p>The original appendix supplies printable forms. This system maps those records to editable sheet sections so no separate PDF is needed.</p>
 ${htmlTable(["Original form", "Fields to record", "Foundry equivalent"], [
   ["DM's character card", "Name, class, level, alignment, XP, hp, abilities, weapons, THAC0, magic items", "Actor sheet Main, Equipment and Magic Items tabs"],
   ["Character record sheet", "Ability adjustments, saves, AC, hp, attack matrix, carried treasure, languages", "Actor sheet Main, Attack Table and Notes tabs"],
   ["Spell book sheet", "Spell name, level, brief description and source", "Spells tab plus spell Items in the Spell compendia"],
   ["Adventure record sheet", "Date, roster, monsters, treasure and event log", "Journal entries and chat log"],
   ["Hex mapping paper", "Hex grid for wilderness exploration", "Foundry scene grid (10 ft per hex by default)"]
 ])}
 <p>Use a JournalEntry for a long-lived adventure log and the actor Notes tab for character-specific secrets and experience notes.</p>`,
  4: `<h2>Appendix 4 — Indices</h2>
 <p>The spell index is alphabetized by name; the letter after a name identifies its list: C for cleric, D for druid and M for magic-user. The same letters are used by the Spell compendium's folder keys. Reference tables and checklists are indexed as text pages in the Rules Reference compendium; only tables with a die instruction (such as Monster Reactions) are RollTables. Monsters and equipment are indexed alphabetically inside their category folders.</p>`
};

const fmt = (value) => Number(value ?? 0).toLocaleString("en-US");
const chunk = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

function classProgressionTable() {
  return htmlTable(["Class", "Hit die", "Prime requisite", "Max level", "Fixed hp / level", "XP to level 2"],
    Object.values(RC.classes).map((cls) => [
      cls.name, `d${cls.hitDie}`, (cls.primeRequisites ?? []).join(", ") || "—",
      String(cls.maxLevel), String(cls.hpAfterFixed || "by die"), fmt(cls.xp[1])
    ]));
}

function xpTables() {
  const keys = Object.keys(RC.classes);
  return chunk(Array.from({ length: 36 }, (_, i) => i + 1), 18).map((levels) =>
    htmlTable(["Level", ...keys.map((key) => RC.classes[key].name)], levels.map((level) => [
      String(level), ...keys.map((key) => {
        const cls = RC.classes[key];
        if (level > cls.maxLevel) return "—";
        return level === cls.maxLevel ? "Maximum" : fmt(cls.xp[level]);
      })
    ])));
}

function extendedXpTables() {
  const keys = ["dwarf", "elf", "halfling", "mystic"];
  return chunk(Array.from({ length: 36 }, (_, i) => i + 1), 18).map((levels) =>
    htmlTable(["Level", ...keys.map((key) => RC.classes[key].name)], levels.map((level) => [
      String(level), ...keys.map((key) => {
        const cls = RC.classes[key];
        const value = cls.extendedXp?.[level];
        return value === undefined ? "—" : fmt(value);
      })
    ])));
}

function thiefSkillTables() {
  const labels = THIEF_LABELS.slice(0, 8);
  return chunk(RC.thief, 18).map((rows, index) =>
    htmlTable(["Level", ...labels], rows.map((values, rowIndex) => [
      String(index * 18 + rowIndex + 1), ...values.map((value) => `${value}%`)
    ])));
}

function turnUndeadTables() {
  return chunk(RC.turnUndead.rows, 7).map((rows) =>
    htmlTable(["Undead", ...RC.turnUndead.columns], rows.map((row) => [row.name, ...row.values])));
}

function spellSlotTables() {
  return chunk(RC.spellSlots.cleric, 18).map((rows, index) => {
    const magic = RC.spellSlots["magic-user"].slice(index * 18, (index + 1) * 18);
    return htmlTable(["Class and level", "1", "2", "3", "4", "5", "6", "7", "8", "9"], [
      ...rows.map((row, rowIndex) => [
        `Cleric / Druid ${index * 18 + rowIndex + 1}`, ...Array.from({ length: 9 }, (_, i) => row[i] ?? "—")
      ]),
      ...magic.map((row, rowIndex) => [
        `Magic-User ${index * 18 + rowIndex + 1}`, ...Array.from({ length: 9 }, (_, i) => row[i] ?? "—")
      ])
    ]);
  });
}

function masteryRankTable() {
  return htmlTable(["Rank", "Attack bonus", "Damage option", "Defense bonus", "Choices spent"],
    RC.mastery.order.map((key) => {
      const rank = RC.mastery.grades[key];
      return [rank.nome, `${rank.at[0]} / ${rank.at[1]}`, rank.dv ? `up to ${rank.dv} HD` : "—",
        `+${rank.at[1]}`, String(rank.peso)];
    }));
}

function planeTables() {
  return [
    htmlTable(["Realm", "Access", "Environment", "Adventure rules"], [
      ["Prime Plane", "Home world", "Balanced mix of elements", "All rules in this system apply normally"],
      ["Ethereal Plane", "Magic travel", "Gray ether; no gravity; magic movement required", "Cannot see the Prime without detect invisibility or similar magic"],
      ["Elemental Planes", "Wormholes from the Ethereal", "Air, Earth, Fire and Water", "Survival magic required; elemental dominance changes matter-based effects"],
      ["Outer Planes", "Advanced or immortal travel", "Alignment-linked realms", "Deities, patrons and planar creatures follow the DM's cosmology"],
      ["Beyond the Multiverse", "DM-defined", "No fixed physics", "Use planes as a frontier and assign local rules explicitly"]
    ]),
    htmlTable(["Nearby Prime material", "Ethereal movement", "Example", "Effect"], [
      ["Vacuum", "Double normal", "Open space", "Fast travel"],
      ["Air", "Normal", "Open sky", "No modifier"],
      ["Fire or water", "Three quarters normal", "Lake or flame", "Slowed"],
      ["Soil or wood", "Half normal", "Forest or field", "Slowed"],
      ["Rock", "One quarter normal", "Mountain", "Very slow"],
      ["Metal or lead", "No movement", "Vault or wall", "Blocked"]
    ])
  ];
}

function spellIndexPages() {
  const spells = [...RC.spells].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const rows = spells.map((spell) => [spell.name, spell.class, String(spell.level)]);
  const referencePages = [
    "Core Rules Reference", "Combat Sequence", "Attack Matrix", "Saving Throws",
    "Spellcasting", "Encumbrance", "Treasure", "Encounters and Reaction Rolls",
    "Equipment Tables", "Weapon Mastery (Optional)", "Weapon Choices and Training",
    "Benefits", "Mastery - Hand-Held", "Mastery - Missile", "Effects and Penalties"
  ].sort((a, b) => a.localeCompare(b, "en"));
  return [
    htmlTable(["Spell", "List", "Level"], rows.slice(0, 110)),
    htmlTable(["Spell", "List", "Level"], rows.slice(110)),
    htmlTable(["Reference page", "Compendium"], referencePages.map((name) => [name, "BECMI Rules Reference"]))
  ];
}

const CHAPTER_SUPPLEMENTS = {
  2: [classProgressionTable(), ...thiefSkillTables()],
  3: spellSlotTables(),
  5: [masteryRankTable()],
  8: [htmlTable(["Check", "Roll", "Success"], [
    ["Attack", "d20 + bonuses", "At least THAC0 - target AC"],
    ["Saving throw", "d20", "At least the listed target"],
    ["Ability check", "d20", "At most the ability score"],
    ["Morale", "2d6", "At most the morale score"],
    ["Turn undead", "2d6", "At least the table result"]
  ])],
  10: xpTables(),
  14: turnUndeadTables(),
  18: planeTables(),
  19: extendedXpTables()
};
const APPENDIX_SUPPLEMENTS = {
  2: [htmlTable(["BECMI level", "AD&D level"], [
    ["1-12", "No change"], ["13", "4"], ["16", "5"], ["19", "6"], ["36", "12"]
  ])],
  3: [htmlTable(["Record", "Where to keep it", "Update frequency"], [
    ["Character statistics", "Actor sheet", "When level, XP or equipment changes"],
    ["Spell book", "Spell compendium and Spells tab", "When a spell is learned or prepared"],
    ["Adventure log", "JournalEntry", "After each session"],
    ["Encounter log", "JournalEntry or chat export", "After each encounter"]
  ])],
  4: spellIndexPages()
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
    ...p(`<h2>Encounters and Reaction Rolls</h2>
<p><strong>Chance of encounter:</strong> in a dungeon or city, roll 1d6 every two turns (1d12 once at night); on a 1 an encounter occurs. In the wilderness, roll 1d6 by day and 1d12 at night: clear or settled land needs a 1; forest, river, hills, barren land, desert, ocean or aerial a 1-2; swamp, jungle or mountains a 1-3.</p>
<p><strong>Surprise:</strong> each side rolls 1d6; a 1 or 2 means that side is surprised. When neither side is surprised, encounter distance is looked up by terrain and visibility in the rules (dungeon bright light 4d6 x 10 ft, dim light 2d6 x 10 ft, darkness 1d4 x 10 ft).</p>
<p><strong>Reactions:</strong> the Monster Reactions table is the random table in the <em>BECMI Tables</em> compendium: roll 2d6 (2-3 attacks, 4-6 aggressive, 7-9 cautious, 10-11 neutral, 12 friendly). Subsequent rolls can be modified by Charisma, gestures and threats.</p>
<p><strong>Which monsters:</strong> roll 1d20 on the Dungeon Encounters table for the current dungeon level, then roll the number appearing shown in that row. In the wilderness, roll 1d8 for the terrain column, then 1d12 on the indicated subtable. These are die rolls; the tables are consulted by column and are not random tables in the compendium.</p>
<p><strong>Magic item creation:</strong> the chance of success is a d100 roll against ([Intelligence or Wisdom + level] x 2) - (3 x spell level), or the number of bonuses for armor and weapons. Costs and time are calculated from the checklists in the Enchantment rules; they are not a random table.</p>`),
    name: "Encounters and Reaction Rolls"
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
    name: `Chapter ${number}: ${CHAPTER_TITLES[number]}`,
    flags: { becmi: { source: "Rules Cyclopedia", chapter: Number(number) } },
    pages: [
      { ...p(content), name: "Rules" },
      ...(CHAPTER_SUPPLEMENTS[number] ?? []).map((table, index) => ({
        ...p(`<h2>${CHAPTER_TITLES[number]} — Tables ${index + 1}</h2>${table}`),
        name: `Tables ${index + 1}`
      }))
    ]
  }));

  const appendices = Object.entries(APPENDIX_RULES).map(([number, content]) => ({
    name: `Appendix ${number}: ${APPENDIX_TITLES[number]}`,
    flags: { becmi: { source: "Rules Cyclopedia", appendix: Number(number) } },
    pages: [
      { ...p(content), name: "Overview" },
      ...(APPENDIX_SUPPLEMENTS[number] ?? []).map((table, index) => ({
        ...p(`<h2>${APPENDIX_TITLES[number]} — Tables ${index + 1}</h2>${table}`),
        name: `Tables ${index + 1}`
      }))
    ]
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

  return [...chapters, ...appendices, core, mastery];
}

