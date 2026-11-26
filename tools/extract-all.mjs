/**
 * Run every extractor with the same OCR markdown path.
 *
 * Usage:
 *   node tools/extract-all.mjs "path/to/BECMI MARKDOWN.txt"
 *   $env:BECMI_OCR="path/to/BECMI MARKDOWN.txt"; npm run extract
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defaultOraclePath } from "./order-ocr.mjs";
import { resolveBuildInput } from "./ocr-input.mjs";

const input = await resolveBuildInput();
const scripts = [
  "extract-monsters.mjs",
  "extract-spells.mjs",
  "extract-equipment.mjs",
  "extract-classes.mjs",
  "extract-extras.mjs"
];

function run(file, args = []) {
  const path = fileURLToPath(new URL(file, import.meta.url));
  const result = spawnSync(process.execPath, [path, ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

for (const file of scripts) run(file, [input]);

// The ordered scratch copy keeps extractor anchors stable; descriptions are
// then replaced by the page-ordered oracle so every name keeps its own lore.
run("repair-monster-prose.mjs", [process.env.BECMI_OCR_ORACLE || defaultOraclePath()]);
