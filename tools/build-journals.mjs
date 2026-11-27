/**
 * Rebuild the reference journals from structured Rules Cyclopedia data.
 *
 * Usage: node tools/build-journals.mjs
 *
 * This is the OCR-free part of tools/extract-extras.mjs. Keeping it separate
 * lets `npm run pack` refresh journal text without re-extracting treasure from
 * the scanned source or touching the monster compendium.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { EQUIPMENT_JOURNAL, MASTERY_JOURNAL } from "./mastery-data.mjs";
import { buildReferenceJournals } from "./reference-rules.mjs";

const journals = [...buildReferenceJournals(MASTERY_JOURNAL), EQUIPMENT_JOURNAL];
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../data/journals.json", import.meta.url),
  JSON.stringify(journals, null, 2)
);
console.log(`journals: ${journals.length} entries`);
