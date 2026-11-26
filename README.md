# BECMI — Rules Cyclopedia for Foundry VTT v13+

An unofficial **Foundry VTT system** for the Basic / Expert / Companion / Master /
Immortal rules, based on the *D&D Rules Cyclopedia*. This is a system, not a content
module. The compendia contain structured game data, a condensed rules reference and
short paraphrases; the PDF and OCR export are **not** included.

## Features

- Descending AC and THAC0, saving throws, ability checks, initiative and morale.
- Actor, Item and Journal sheets built with Foundry v13+ `ApplicationV2` (verified on v14).
- Parchment-style tabbed character sheet: Main, Equipment, Spells, Thief Skills,
  Turn Undead, Attack Table, Weapon Mastery, Magic Items and Notes, plus a collapsible
  reference sidebar for quick rolls, class features and hidden details.
- Dropping a Character Class onto an Actor fills class, HD, prime requisite and the
  next-level XP from its compendium table; duplicate class items are removed.
- Character generation asks for confirmation before replacing scores, level, XP and HP.
- Druid is handled as a Cleric extension, not as a stand-alone class.
- Class-exclusive sections (thief skills, turn undead, spellcasting) only appear
  for classes that have them. Weapon Mastery is an optional switch available to
  every character: when enabled, trained weapon ranks modify attack bonuses and
  damage; when disabled, rolls use the plain BECMI rules.
- Optional General Skills use the 61 sample skills from the Rules Cyclopedia: a
  per-character toggle, ability-based 1d20 checks, stored specialties and DM
  modifiers, and slot budgets derived from Intelligence, level and XP. The
  Chapter 5 reference journal carries the sample-skill and slot-acquisition tables.
- Name Level choices are on the character sheet: Land Owner or Travelling, holding
  style, and fighter specialization by alignment. The sheet derives the title and
  shows the RC advantages and obligations; paladins/avengers get cleric-level spells,
  turning undead and a Detect Evil action.
- Spells are split into compendium folders by list and level, and are sorted by level
  and name on the sheet; equipment is grouped and alphabetized as weapons, armor,
  adventuring gear and transport/siege gear.
- Treasure separates tangible items (potions, miscellaneous magical items, missile
  talents) from item-enchantment rules, each in its own folder.
- All rolls work directly from item and actor sheets without a selected token: attack
  rolls take a Target AC field and default to AC 9; damage, spell effects and arbitrary
  dice formulas have dedicated buttons.
- Automatic level-up whenever XP changes, using the same class table and HP advance
  as the manual Level Up button; manually adjusted levels are never overwritten.
- A Class Features tab and sidebar list every class and racial ability, including
  backstab, elven/dwarven/halfling abilities and the Mystic's martial arts.
- Click the small pencil badge on the portrait (or item image) to change artwork
  through the Foundry FilePicker.
- Actor and item sheets open in use mode; switch to edit mode to change fields.
  Rolls and item actions stay available in both modes. Each sheet also has a button
  to switch between the black-and-white light theme and the dark theme.
- Spell slots are grouped by level with prepared/maximum bars; imported compendium
  spells are added to the character's grimoire and can be memorized immediately.
- Monster Hit Dice count d8 (for example `11` means `11d8`), and their average HP
  is derived from that formula rather than from the HD number.
- Every sheet tab and long table scrolls inside the window, so nothing requires
  resizing the Foundry window.
- Complete class XP tables: 36 human levels, 12 dwarf, 10 elf, 8 halfling, 16 mystic,
  plus the extended demihuman/mystic progression from Chapter 19.
- Seven precompiled LevelDB compendia with 745 documents in total.

## Compendia

| Compendium | Type | Documents |
|---|---|---:|
| BECMI Monsters | Actor | 369 |
| BECMI Spells | Item | 184 |
| BECMI Equipment | Item | 106 |
| BECMI Classes | Item | 9 |
| BECMI Treasure | Item | 32 |
| BECMI Tables | RollTable | 19 |
| BECMI Rules Reference | JournalEntry | 26 |

`BECMI Spells` has folders for Cleric, Druid and Magic-User spells, each with a
subfolder per spell level. The seven packs are also grouped in the sidebar under
`BECMI Rules Cyclopedia`; if an older world keeps the previous sidebar layout, run
`game.settings.set("core", "compendiumConfiguration", {})` in the console and reload
twice. `BECMI Equipment`
contains **42 weapons**, 7 armor types and 57 other equipment entries, organized in
folders for Weapons, Armor & Shields, Adventuring Gear and Transport & Siege.
`BECMI Classes` keeps the Druid entry in a Subclasses folder.
`BECMI Treasure` has separate folders for Potions, Miscellaneous Magical Items,
Missile Talents and Magic Item Enchantment Rules (procedural rules are `feature`
items, not treasures).
`BECMI Tables` contains the 2d6 monster reaction table, six dungeon encounter
tables (1d20), three wilderness main tables (1d8) and nine wilderness subtables
(1d12), in separate Reactions, Dungeon Encounters and Wilderness Encounters folders.
Multi-column tables put every terrain column in the same result, so no die face is
duplicated. The castle/city encounter procedures and all static lookups are journal
text: the **Equipment Tables** journal keeps the weapon, special-effect, ammunition,
armor, barding, net and siege tables, while the **Core Rules Reference** and chapter
journals keep attack, save, thief skill, turn undead, spell slot and magic-item
creation tables. `BECMI Rules Reference` includes condensed rules for all 19 chapters
and all 4 appendices, the Core Rules Reference (with castle/city encounter guidance),
a nine-page Equipment Tables journal and a six-page **Weapon Mastery (Optional)**
journal with a condensed level-by-level weapon table.
Monsters are filed in nine folders (animals, lowlife, constructs, dragons,
humanoids, monsters, planar monsters, undead and unclassified) with stat blocks in
Rules Cyclopedia order. Chapters 10, 18 and 19 and Appendix 4 carry the extended XP,
plane and index tables; each journal has its own scrollable table pages.

## Installation

### From GitHub

Install it in Foundry with this manifest URL:

```text
https://raw.githubusercontent.com/glauberraffael-dev/becmi-foundry/main/system.json
```

If a cached manifest offers an older version, add a cache-busting query such as
`.../system.json?v=0.1.30`. The manifest points to a versioned archive,
`becmi-foundry-0.1.30.zip`, so Foundry never downloads a stale ZIP from `main`.
See [PUBLISHING.md](PUBLISHING.md) for regeneration and push instructions.

### From a local folder

Copy this repository to:

```text
<Foundry user data>/Data/systems/becmi
```

Then restart Foundry and create a world using the **BECMI — Rules Cyclopedia** system.

## Repository layout

```text
data/       generated JSON used to build the packs
source/     one JSON document per file, ready for the Foundry CLI
packs/      compiled LevelDB compendia loaded by Foundry
scripts/    runtime system code, data models, sheets and hooks
templates/  Handlebars templates
lang/       English localization
styles/     system CSS
tools/      regeneration and verification scripts
```

`node_modules/` is not committed. Run `npm install` if you want to regenerate packs.

## Mechanics

- Attack: `d20 + bonuses >= THAC0 - AC`; natural 1 misses, natural 20 hits.
- Saving throws: `d20 >= target` (Death Ray/Poison, Wands, Paralysis/Petrify, Breath, Spells).
- Ability checks: `d20 <= ability score + bonus`.
- Initiative: `d6 + bonus`, highest first.
- Morale: `2d6 <= morale`.

## Regenerating the compendia

Regeneration is optional. It needs Node 20+ and a locally produced OCR markdown export
of the Rules Cyclopedia, which is **not** distributed here.

```bash
npm install
export BECMI_OCR="/path/to/BECMI MARKDOWN.txt"
npm run extract
npm run pack
npm run verify
```

On PowerShell:

```powershell
npm install
$env:BECMI_OCR = "C:\path\to\BECMI MARKDOWN.txt"
npm run extract
npm run pack
npm run verify
```

You can also pass the path directly:

```bash
node tools/extract-all.mjs "/path/to/BECMI MARKDOWN.txt"
```

`tools/extract-*.mjs` write JSON to `data/`; `tools/build-packs.mjs` writes one JSON file
per document into `source/<pack>/`; `fvtt package pack` compiles these into LevelDB packs
under `packs/`.

## Known limitations

- The OCR source has column-interleaving errors. Some monster descriptions and table rows
  contain artifacts; verify against the PDF before use.
- The large scanned Weapon Mastery table (PDF pages 78–79) was recovered with OCR and
  condensed into a compact level-by-level reference. Check the original PDF for exact
  cell alignment before relying on a specific mastery entry.
- Treasure and class descriptions are short paraphrases, not verbatim rules.
- Monsters use a single AC/HP value per entry; variant stat blocks are separate actors.
- Compatibility was exercised in a live Foundry v14 instance; the automated checks
  are structural and do not replace playtesting.

## License and credits

Code and tooling are MIT licensed; see [LICENSE](LICENSE). Game content is an unofficial
fan conversion; see [CREDITS.md](CREDITS.md). No affiliation with or endorsement by
Wizards of the Coast or Foundry Gaming LLC.
