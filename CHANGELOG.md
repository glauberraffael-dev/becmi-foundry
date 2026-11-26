# Changelog

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
