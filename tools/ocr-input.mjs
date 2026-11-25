/**
 * Shared resolver for the OCR markdown input used by the extraction scripts.
 * The OCR export is a development input and is never distributed with the system.
 */
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
