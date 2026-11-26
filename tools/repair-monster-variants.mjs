/**
 * Apply the curated named-variant repair after the OCR extraction.
 *
 * Usage: node tools/repair-monster-variants.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { repairMonsterVariants } from "./monster-variants.mjs";

const root = new URL("..", import.meta.url);
const dataFile = new URL("data/monsters.json", root);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const monsters = JSON.parse(await readFile(dataFile, "utf8"));
  const repaired = repairMonsterVariants(monsters);
  await writeFile(dataFile, JSON.stringify(repaired, null, 2) + "\n", "utf8");
  console.log(`Monster variants: ${repaired.length} documents, curated named sheets applied.`);
}
