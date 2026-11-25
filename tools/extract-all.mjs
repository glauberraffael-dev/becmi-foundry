/**
 * Run every extractor with the same OCR markdown path.
 *
 * Usage:
 *   node tools/extract-all.mjs "path/to/BECMI MARKDOWN.txt"
 *   $env:BECMI_OCR="path/to/BECMI MARKDOWN.txt"; npm run extract
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { ocrInput } from "./ocr-input.mjs";

const input = ocrInput();
const scripts = [
  "extract-monsters.mjs",
  "extract-spells.mjs",
  "extract-equipment.mjs",
  "extract-classes.mjs",
  "extract-extras.mjs"
];

for (const file of scripts) {
  const path = fileURLToPath(new URL(file, import.meta.url));
  const result = spawnSync(process.execPath, [path, input], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
