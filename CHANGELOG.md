# Changelog

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
