# BECMI — Rules Cyclopedia for Foundry VTT v13+

An unofficial **Foundry VTT system** for the Basic / Expert / Companion / Master /
Immortal rules, based on the *D&D Rules Cyclopedia*. This is a system, not a content
module. The compendia contain structured game data and short paraphrases; the full
rules text and the PDF are **not** included.

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
- Class-exclusive sections (thief skills, turn undead, mastery, spellcasting) only
  appear for classes that have them.
- Spells are split into compendium folders and filtered by Cleric, Druid or Magic-User
  lists on the sheet; equipment is grouped as weapons, armor, adventuring gear and
  transport/siege gear.
- Complete class XP tables: 36 human levels, 12 dwarf, 10 elf, 8 halfling.
- Seven precompiled LevelDB compendia with 537 documents in total.

## Compendia

| Compendium | Type | Documents |
|---|---|---:|
| BECMI Monsters | Actor | 170 |
| BECMI Spells | Item | 180 |
| BECMI Equipment | Item | 106 |
| BECMI Classes | Item | 9 |
| BECMI Treasure | Item | 32 |
| BECMI Tables | RollTable | 22 |
| BECMI Rules Reference | JournalEntry | 18 |

`BECMI Spells` has folders for Cleric, Druid and Magic-User spells. `BECMI Equipment`
contains **42 weapons**, 7 armor types and 57 other equipment entries, organized in
folders for Weapons, Armor & Shields, Adventuring Gear and Transport & Siege.
`BECMI Classes` keeps the Druid entry in a Subclasses folder.
`BECMI Tables` includes the monster reaction table, a Weapons Table lookup, basic weapon
special effects, ammunition, armor, barding, nets, siege equipment, passage prices and
the optional Weapon Mastery tables. `BECMI Rules Reference` includes a six-page
**Weapon Mastery (Optional)** journal with a condensed level-by-level weapon table.

## Installation

### From GitHub

Install it in Foundry with this manifest URL:

```text
https://raw.githubusercontent.com/glauberraffael-dev/becmi-foundry/main/system.json
```

If a cached manifest offers an older version, add a cache-busting query such as
`.../system.json?v=0.1.10`. The manifest points to a versioned archive,
`becmi-foundry-0.1.10.zip`, so Foundry never downloads a stale ZIP from `main`.
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
- The system has been validated structurally but has not yet been exercised in a live
  Foundry instance.

## License and credits

Code and tooling are MIT licensed; see [LICENSE](LICENSE). Game content is an unofficial
fan conversion; see [CREDITS.md](CREDITS.md). No affiliation with or endorsement by
Wizards of the Coast or Foundry Gaming LLC.
