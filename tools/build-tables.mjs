/**
 * Rebuild the encounter RollTable data from the curated RC chapter 7 tables.
 *
 * Usage: node tools/build-tables.mjs
 *
 * This is the OCR-free counterpart of the table section of
 * tools/extract-extras.mjs. Keeping it separate lets `npm run pack` refresh
 * dungeon and wilderness tables without re-extracting treasure or monsters.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { ENCOUNTER_TABLES, REACTION_TABLE } from "./encounter-tables.mjs";
import { sortDocuments } from "./pack-layout.mjs";

const tables = sortDocuments("tables", [REACTION_TABLE, ...ENCOUNTER_TABLES]);
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../data/tables.json", import.meta.url),
  JSON.stringify(tables, null, 2)
);
console.log(`tables: ${tables.length} entries`);
