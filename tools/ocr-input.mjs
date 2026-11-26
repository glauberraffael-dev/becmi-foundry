/**
 * Shared resolver for the OCR markdown input used by the extraction scripts.
 * The OCR export is a development input and is never distributed with the system.
 */
import { access } from "node:fs/promises";
import { createOrderedOcr, defaultOraclePath, defaultOrderedPath } from "./order-ocr.mjs";

export function ocrInput(argv = process.argv) {
  const input = argv[2] ?? process.env.BECMI_OCR;
  if (!input) {
    throw new Error(
      "Missing OCR markdown path. Pass it as the first argument or set BECMI_OCR.\n" +
      'Example: node tools/extract-monsters.mjs "path/to/BECMI MARKDOWN.txt"'
    );
  }
  return input;
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the source OCR, then optionally generate a column-ordered scratch
 * copy using the newer page-based export as a read-only ordering oracle.
 *
 * The scratch copy lives in the system temp directory, never in the repository,
 * so no OCR text is shipped inside the Foundry system ZIP.
 */
export async function resolveBuildInput(argv = process.argv) {
  const source = ocrInput(argv);
  const oracle = process.env.BECMI_OCR_ORACLE || defaultOraclePath();
  if (!(await exists(oracle))) return source;
  if (process.env.BECMI_OCR_NO_ORDER === "1") return source;
  const output = process.env.BECMI_OCR_ORDERED || defaultOrderedPath(source);
  try {
    return await createOrderedOcr(source, oracle, output);
  } catch (error) {
    console.warn(`BECMI | Could not order OCR columns; using the original export.`, error);
    return source;
  }
}
