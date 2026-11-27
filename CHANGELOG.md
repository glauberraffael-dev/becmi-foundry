# Changelog

## 0.1.37

- Added a **Crafting** panel to the Treasure tab with Rules Cyclopedia chapter 16
  procedures for armor and weapon enchantment, miscellaneous spell-effect items,
  magical constructs and spell research. Costs, chances, construction time and
  first-time XP post to chat; inputs stay off the Actor.
- Implemented the formulas in a Foundry-independent module with tests for the
  printed examples, including Wisdom for clerical casters, bonuses versus
  specific opponents, restrictions, charges, permanency, limited-use items,
  construct requirements and cumulative research failures.
- Corrected 34 extended-XP values in the printed optional progression: elves
  from 21st through 36th level and halflings from 19th through 36th were shifted
  by one level. The generated table now also preserves the printed `*`, `**`,
  `t` and `tt` footnotes and the derived demihuman/mystic rules on page 266.
- Expanded the generated Chapter 16 and Chapter 19 journals with the full
  creation formulas, spell research rules and the printed time-example
  inconsistency, instead of the previous short summaries.

## 0.1.36

- Added the two missing chapter 7 encounter subtables as rollable RollTables:
  **Wilderness Subtable 10: Castle Encounters (1d6)** with class, level and
  alignment, and **Wilderness Subtable 11: City Encounters (1d20)** with all
  eight sections of city dwellers. The "Castle" and "Special" results in the
  wilderness tables now resolve instead of pointing at missing tables.
- Added castle patrol sizes and reactions, plus the city encounter procedure, to
  the generated Chapter 7 and Core Rules Reference journals.
- Corrected the generated class table to the printed RC Hit Dice (cleric d6,
  fighter d8, magic-user/thief d4) and the encumbrance table to the printed
  normal, encounter and running speeds. Both tables are now derived from the
  same structured data the runtime uses, so they cannot drift again.
- Added an OCR-free `tools/build-tables.mjs` to `npm run sources`, and extended
  validation to reject unresolved "Subtable N" references and stale journal
  class/movement values.

## 0.1.35

- Added a **Travel** tab with the Rules Cyclopedia chapter 6 procedures:
  encumbrance-based movement rates, terrain modifiers and daily travel distances
  for every printed walker and mount, one rest day per six travelled days with
  the cumulative attack/damage penalty, the daily getting-lost check (roads,
  rivers and guides skip it), foraging and hunting, swimming/breath/drowning
  checks, sea weather on 2d6, and aerial mount/device distances. All checks post
  chat cards and keep their inputs off the Actor.
- Added Foundry-independent travel rule tests and extended the sheet smoke test
  to cover the new actions and panel controls.

## 0.1.34

- Added a seven-step **Creation Wizard** (`ApplicationV2`) on the Actor sheet,
  while keeping the legacy one-click generator as a fallback. The wizard covers
  identity, 3d6-in-order abilities, RC ability swaps, class requirements,
  starting HP, languages, optional General Skills and Weapon Mastery, equipment
  purchase and a final review before anything is written to the Actor.
- Implemented the RC creation rules in a Foundry-independent module: class and
  demihuman minimum scores, alignment and race restrictions, armor/weapon
  restrictions, the druid prerequisite, 3d6 × 10 gp starting money, language
  counts and literacy limits, class Hit Dice and initial HP, and general skill
  slots. Only the final approved plan updates the Actor; XP thresholds, AC,
  THAC0, saves and load remain derived by the system.
- Starting armor and shield are now derived from the equipment selected in the
  wizard, and purchased Items are embedded as equipped. No separate armor toggle
  can disagree with the purchased gear.
- Added Foundry-independent rule and ApplicationV2 smoke tests, including
  compendium name resolution and a full Apply flow, and extended the repository
  validator to cover the wizard actions, template and localization keys.

## 0.1.33

- Added a **Treasure** tab with the Rules Cyclopedia chapter 16 procedures:
  all lettered types A-V (lair and carried tables, d100 chances, lair coins
  multiplied by 1,000 and the published average values), the gem and jewelry
  value tables with the -10 adjustment below level 9, the magical item main
  table and subtables 1-9, and the missile talent subtable. Rolls post chat
  cards and never modify the Actor; even a monster's free-text treasure type
  is only shown as a hint.
- Reproduced the treasure types, value tables and magical item subtables in the
  `Chapter 16: Treasure` and `Core Rules Reference` journals, so the printed
  tables are available offline instead of only a short summary.

## 0.1.32

- Added an **Encounters** tab with the Rules Cyclopedia chapter 7 procedures:
  chance of encounter by area, terrain and night, 1d6 surprise per side with
  automatic initiative for an unsurprised group, encounter and wandering-monster
  distance, 2d6 reactions drawn from the `Monster Reactions (2d6)` RollTable,
  d100 evasion with terrain/speed/scout adjustments and chase rounds with the
  five-round morale reminder. All checks post chat cards; their inputs are
  transient sheet state and never become Actor data.
- Replaced the old reaction bands with the exact RC table (`2-3` attacks, `4-6`
  aggressive with `-4`, `7-9` cautious, `10-11` neutral with `+4`, `12` friendly).
  Charisma and PC actions apply from the second roll onward, with a maximum of
  three rolls and the third-roll-below-10 outcome.
- Corrected the Chapter 7 and Core Rules Reference prose for surprise, distance,
  evasion and pursuit, and updated the reaction table used by the compendium.

## 0.1.31

- Added a Rules Cyclopedia **XP Calculator** tab to character sheets. It takes
  monster XP (or looks it up from Hit Dice and asterisks), treasure value,
  goals, one role-playing award per session, exceptional actions/skill uses,
  participants and outcome, then shows every component and the final award.
- Applied the RC prime-requisite scale per class (`-20%/-10%/+5%/+10%`), the
  elf/halfling/mystic variations (including the acrobatic mystic's extra
  `-20%`), the 1/4 award for driven-off foes, the 10%-of-creation-cost cap on
  sold magic items, and the mystic donation rule. The calculator stops at one
  level per adventure and discards XP past one point below the next-next level.
  `xpNext` stays derived and read-only; calculator fields are never stored on
  the Actor, and only the final calculated XP can be awarded in edit mode.
- Replaced the inaccurate “13+ grants 5%, 9- grants 10%” text in the Core Rules
  Reference and Experience journal with the RC award and prime-requisite rules.

## 0.1.30

- Rebuilt the spell descriptions from the Rules Cyclopedia PDF text layer. The
  old two-column OCR interleaved stacked headings, so *Shield* carried the
  *Floating Disc* text and other spells had prose or stat lines from their
  neighbours. All 184 compendium spells now use the prose that belongs to their
  own heading, including *Stone to Flesh*, *Wall of Iron*, *Stoneform*,
  *Reverse Gravity*, *Timestop*, *Maze* and *Permanence*.
- Cleaned leaked prose out of the Range/Duration/Effect fields (for example
  *Shield*, *Stone to Flesh*, *Know Alignment* and *Massmorph*).
- Added `tools/extract-spell-prose.py` and `tools/repair-spell-prose.mjs` so the
  repair is reproducible from a local PDF, plus regression checks in
  `tools/test-spell-index.mjs` for mixed descriptions and stat leaks.

## 0.1.29

- Added the Rules Cyclopedia's optional **General Skills** as a per-character
  opt-in tab: all 61 sample skills from the RC ability table, trained flags,
  specialty notes, per-skill DM modifiers and 1d20 checks against the linked
  ability (natural 1 succeeds, natural 20 fails). Art can use Wisdom instead of
  Intelligence. Skill slots are derived from Intelligence, level and XP using
  the human and demihuman acquisition tables.
- The Chapter 5 reference journal now carries the sample-skill and slot tables.
- Tests cover the catalog, slot math, derived actor data, sheet actions and the
  use-mode read-only rule. Stale 0.1.27 example URLs in the README and publishing
  notes were corrected.

## 0.1.28

- The monster compendium now includes the 49 iconic Rules Cyclopedia creatures
  that were missing from the curated bestiary (beholder, basilisk, troll,
  ogre, dwarf, halfling, lycanthropes, planar spiders, great cats and many
  others), with the extra planar variants printed in the same monster list.
  The compendium grows from 311 to 369 actors.
- A new `npm run supplement` tool appends these actors from the page-based OCR
  export without touching the existing curated entries; the old extractor must
  not be run against that export because it uses different headings and line
  windows and would overwrite the bestiary.
- Monster tests now guard the restored roster and the corrected AC, HD, Save As
  and XP values, including the multi-column lycanthrope and great-cat tables.
- Sheet tests cover spent spell slots, owner-only spell rest and the Auto AC
  toggle in the target field.

## 0.1.27

- The spell compendium now matches the Rules Cyclopedia spell index: seven
  missing spells were restored (*Cure Light Wounds*, *Speak with Animals*,
  *Floating Disc*, *Wall of Iron*, *Reverse Gravity*, *Meteor Swarm*,
  *Shapechange*), prose swallowed by other spells was separated, three section
  headings are no longer listed as spells, and each spell records its level per
  class so clerics and magic-users can receive the same spell at different
  levels.
- Monster reaction text now matches the 2d6 RollTable bands.
- The Target AC field has an Auto mode that reads the targeted token's AC;
  manual AC remains available as a fallback.
- Initiative rolls now set the tracker value for any combatant, not only the
  active character. Spent spell slots can no longer be recast, and resting
  posts a chat log and requires actor ownership.

## 0.1.26

- Fixed cleric spell slots being read one level too low. The cleric table now
  starts at level 1 like the magic-user table, so paladins, avengers, druids and
  clerics use the Rules Cyclopedia progression exactly. The Core Rules
  Reference level table matches the sheets again.

## 0.1.25

- Name Level choices now persist through re-renders. Travelling paladins,
  avengers and knights use the cleric spell table at one-third level, and the
  alignment field shares the XP row without breaking the class selector.
- AC and saving-throw bonuses come from equipped items instead of manual actor
  fields. Weapons, armor and equipment have a Bonuses tab with per-save entries;
  legacy equipped magic rows still apply.
- Monsters have an Equipment tab and can own weapons. "By weapon" attacks use
  the first equipped weapon, and every roll (HP, initiative, morale, attack,
  damage, spell formula) has a button; monster HP rolls apply the result.
- Curated dice formulas were added to ten spells, including Fireball and
  Lightning Bolt at `@level d6`. Formulas resolve on the roll and are repaired
  on spells imported by earlier versions. Pack verification now checks them.

## 0.1.24

- Replaced the removed `Roll#evaluate({ async: true })` API with `await roll.evaluate()`.
  Every roll now runs cleanly on Foundry v13/v14 without deprecation warnings.

## 0.1.23

- Weapon Mastery is now an explicit optional rule for every character. The sheet
  has an always-visible toggle; trained weapon ranks apply to attack bonuses and
  damage only while the option is enabled. The grade dropdown labels are fixed.
- Reworked sheet theming so light mode always uses dark ink and dark mode always
  uses light ink, regardless of the Foundry core theme. Headings, labels, tables,
  native controls and chat cards now follow the BECMI tokens.
- Added parchment tones, focus rings, subtle row striping, badges and distinct
  hit/miss colors; chat cards follow the dark-mode setting.

## 0.1.22

- Fixed the ordinal text in the Name Level guidance: effective cleric levels now
  read `1st`, `2nd`, `3rd` and so on instead of `1th`, `2th`, `3th`.

## 0.1.21

- Added Name Level mechanics from the Rules Cyclopedia. At 9th level (8th for
  halflings), characters record Land Owner or Travelling, with holding style and
  fighter specialization (paladin, knight or avenger) as persistent sheet fields.
- The sheet derives the appropriate title and shows a two-column advantages /
  obligations panel for the chosen path, including stronghold retainers and the
  warning that changing paths requires a major campaign development.
- Travelling paladins and avengers use an effective cleric level of one-third
  their level for spells and turning undead. Wisdom 13 is required for spells;
  avengers buy spell levels for 10,000 gp each and may control turned undead.
- Paladin and avenger hireling limits follow the effective cleric level and the
  Charisma follower table. A `Detect Evil` button posts the 120-foot, once-per-round
  concentration rule to chat with the current combat round.

## 0.1.20

- Each monster attack now has two explicit roll buttons: one for the attack roll
  and one for its damage. Different natural attacks (for example claws versus
  bite) stay separate, and the old combined roll remains available internally.
- Spellcasting monsters have a Spells tab. Liches, sphinxes and devilfish
  matriarchs carry their character level/caster class in the bestiary, so their
  spell lists and normal spell casting flow work directly from the monster sheet.
- Rebuilt the remaining flattened variants: mermen are now 1 HD/2 HD/4 HD sheets
  separate from the Metamorph, and devilfish are split into normal, vampire and
  matriarch forms. Repaired truncated or misread statistics for Athach, bears,
  killer whales, undead beholder, Malfera, amber/obsidian golems and elephants.

## 0.1.19

- Monsters now derive saving-throw targets from their `Save As` entry using the
  Rules Cyclopedia character tables, including `Normal Man`, `F (level = HD)`,
  `F (level = 1/2 HD)`, `F (level = 2 X HD)` and class/level shorthand. Monster
  sheets show all five saves with roll buttons, plus one button per attack.
- Rebuilt flattened multi-column monster variants from the page-ordered oracle:
  dragons by age, gargantuas, giant fish/spiders/snakes/lizards, rocs, phantoms,
  spirits, salamanders, hydras, giants, hags, vampires, slugs, hordes, liches,
  aquatic dinosaurs, elementals, elemental rulers, hydraxes and herds. Each now
  carries its own HD/HP/AC/XP/save and damage; ambiguous OCR strings no longer
  leak into playable sheets.
- Added `tools/test-monsters.mjs` and expanded the rule, data-model and sheet
  tests to cover monster saves, HD formulas, THAC0, attack buttons and every
  curated variant.

## 0.1.18

- Fixed the character class selector: it is now a real form field, so choosing a
  class applies the RC snapshot immediately instead of reading the old value on
  click. The snapshot still never writes derived XP thresholds.
- Fixed manual level edits from the sheet: HP is rolled once by
  `advanceActorLevels` and the stale HP fields left in the form no longer
  overwrite the rolled maximum.

## 0.1.17

- "Next level XP" is now strictly derived from the RC class table. Forms,
  actions and external updates cannot write it; manual level edits use the same
  `advanceActorLevels` HP progression as XP level-ups.
- Current HP is always editable, including from the token bar in use mode, for
  characters and monsters. New actors bind their token bar to
  `attributes.hp.value` automatically.
- Every natural attack now has its own rollable button on monster sheets, with
  monster THAC0 taken from the fighter column by Hit Dice. OCR dice typos such
  as `ldl0` are normalized before rolling.
- The Bestiary rebuilds named sheets from the page-ordered Rules Cyclopedia
  oracle instead of synthetic `Form 1/2` entries. Lycanthropes, giants,
  pterosaurs, gemstone dragons, dragon rulers, manta rays, mystics, manticore,
  robber fly, yellow mold, thoul and wight now have individual statistics and
  descriptions.

## 0.1.16

- Added edit/use mode to actor and item sheets: use mode disables field edits and
  form submission while keeping every roll and item-use action available. A button
  on each sheet switches modes and toggles the black-and-white / dark theme.
- Rebuilt the Spell tab: spells are grouped by level, prepared/maximum slots are
  shown as bars, and the compendium importer adds the spell to the RC grimoire so
  it can be memorized immediately. Manual level edits now use the canonical
  `advanceActorLevels` HP progression, matching XP level-ups.
- Monster Hit Dice now count d8 (`11` → `11d8`, `3 + 1` → `3d8+1`) with average HP
  derived from the formula instead of treating the HD number as HP; token bars use
  the mirrored `attributes.hp.value`.
- Repaired monster descriptions from a page-ordered OCR export, including shared
  prose for dragons and gargantuas, without changing extracted statistics.
- Spell filters now update the spell list reliably through the sheet form.

## 0.1.15

- Fixed compendium folder nesting: level folders now use the `folder` field that
  Foundry reads, so Cleric/Druid/Magic-User folders contain their spell-level
  subfolders. Added sidebar `packFolders` grouping for all seven packs.
- Added a visible image-edit badge to actor and item sheets using the ApplicationV2
  `editImage` action.
- Dropping classes, equipment and other non-spell items onto an actor now uses the
  standard Foundry handler instead of being rejected; malformed drag payloads no
  longer raise an unhandled `fromDropData` error.
- Increased text contrast on class/racial abilities, locked features, hints, empty
  states and roll cards.
- An empty Target AC field again falls back to AC 9 instead of being read as AC 0.

## 0.1.14

- Added 18 curated random encounter RollTables from Rules Cyclopedia chapter 7:
  six dungeon tables (1d20), three wilderness main tables (1d8) and nine
  wilderness subtables (1d12). Multi-column tables keep every terrain column in
  the same result, so each die face appears once.
- Split the Tables compendium into Reactions, Dungeon Encounters and Wilderness
  Encounters folders; the compendium now has 19 documents.
- Castle/city procedures and magic-item creation remain rules text in the
  Rules Reference, because both are multi-step procedures rather than single
  static rolls.
- `npm run verify` now checks all seven compiled compendia, not only tables and
  journals.

## 0.1.13

- Foundry v13+ `system.json`, `TypeDataModel`s and `ApplicationV2` sheets.
- Spell folders by list and level, with spell drag-and-drop onto actors.
- Centralized OCR spell-math corrections and fixed class HP progression.
- Monster reactions kept as the only RollTable; other lookups moved to journals.
