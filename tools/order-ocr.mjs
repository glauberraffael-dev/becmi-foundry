/**
 * Deterministic column-order repair for the OCR export used by the builders.
 *
 * The old `BECMI MARKDOWN.txt` export serializes two-column pages in interleaved
 * blocks. A newer export keeps columns in reading order but has a different,
 * parser-incompatible layout. This tool uses the newer export only as an
 * ordering oracle: it permutes blocks *inside* the fixed line windows read by
 * the extractors, without adding or removing a single line. The extractors keep
 * their existing line anchors and parsers.
 *
 * Usage:
 *   node tools/order-ocr.mjs <ocr.md> <oracle.md> [output.txt]
 */
import { readFile, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

/** 1-based inclusive line windows consumed by the extractors. */
export const PROTECTED_WINDOWS = Object.freeze([
  { name: "monsters", from: 13791, to: 18472, proseOnly: true }
]);

const GRAM = 20;

function splitLines(text) {
  return text.split(/\r?\n/);
}

function normalize(text) {
  return String(text ?? "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/[*_~`#|]/g, " ")
    .replace(/-\s+/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Map 20-character fingerprints to the earliest oracle line containing them. */
function oracleIndex(lines) {
  const normalized = lines.map(normalize);
  const lineAt = [];
  normalized.forEach((text, index) => {
    for (let i = 0; i <= text.length + 1; i++) lineAt.push(index);
  });

  const joined = normalized.join(" ");
  const index = new Map();
  for (let at = 0; at + GRAM <= joined.length; at++) {
    const gram = joined.slice(at, at + GRAM);
    const line = lineAt[at] ?? 0;
    const previous = index.get(gram);
    if (previous === undefined || line < previous) index.set(gram, line);
  }
  return index;
}

function ordinalFor(block, index, fallback) {
  const text = normalize(block.lines.join(" "));
  if (text.length < GRAM) return fallback;
  const hits = [];
  for (let at = 0; at + GRAM <= text.length; at += 3) {
    const line = index.get(text.slice(at, at + GRAM));
    if (line !== undefined) hits.push(line);
  }
  if (!hits.length) return fallback;
  hits.sort((a, b) => a - b);
  return hits[Math.min(hits.length - 1, Math.floor(hits.length / 4))];
}

const STAT_LABELS = "Armor Class|Hit Dice|Move|Flying|Swimming|Attacks|Damage|No\\. Appearing|Save As|Morale|Treasure Type|Intelligence|Alignment|XP Value|Load|Monster Type|Terrain";
const STRUCTURAL_RE = new RegExp(
  `^(?:#{1,6}\\s|\\s*\\||\\s*<!--)|(?:${STAT_LABELS})\\s*:|^\\*\\*[^*]+\\*\\*\\s+Armor Class:`,
  "i"
);

/** Group atomic blocks; blank lines travel with the preceding block. */
function atomicBlocks(lines) {
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const start = index;
    let picture = false;
    let table = false;
    if (/^\s*<!--\s*Start of picture text\s*-->/i.test(line)) {
      picture = true;
      while (index < lines.length && !/End of picture text/i.test(lines[index])) index++;
      if (index < lines.length) index++;
    } else if (/^\s*\|/.test(line)) {
      table = true;
      while (index < lines.length && /^\s*\|/.test(lines[index])) index++;
    } else {
      index++;
    }
    while (index < lines.length && !lines[index].trim()) index++;
    const raw = lines.slice(start, index);
    // Headings, stat lines and tables anchor the extractors. Moving them would
    // change how many monsters are recognised, so only prose paragraphs move.
    const structural = picture || table || raw.some((text) => STRUCTURAL_RE.test(text));
    blocks.push({ lines: raw, ordinal: 0, movable: !structural });
  }
  return blocks;
}

function reorderWindow(lines, from, to, index, { proseOnly = false } = {}) {
  const start = from - 1;
  const end = to; // exclusive
  if (end - start <= 2) return lines;
  const head = lines.slice(start, start + 1);
  const body = lines.slice(start + 1, end - 1);
  const tail = lines.slice(end - 1, end);

  const blocks = atomicBlocks(body);
  if (!proseOnly) {
    let last = -1;
    for (const block of blocks) {
      const ordinal = ordinalFor(block, index, last + 1);
      block.ordinal = ordinal;
      if (ordinal > last) last = ordinal;
    }
    blocks.sort((a, b) => a.ordinal - b.ordinal);
  } else {
    let last = -1;
    for (const block of blocks) {
      if (!block.movable) continue;
      const ordinal = ordinalFor(block, index, last + 1);
      block.ordinal = ordinal;
      if (ordinal > last) last = ordinal;
    }
    const movable = blocks.filter((block) => block.movable).sort((a, b) => a.ordinal - b.ordinal);
    const stream = movable.flatMap((block) => block.lines);
    let cursor = 0;
    for (const block of blocks) {
      if (!block.movable) continue;
      const size = block.lines.length;
      block.lines = stream.slice(cursor, cursor + size);
      cursor += size;
    }
    if (cursor !== stream.length) throw new Error(`Prose slots changed in window ${from}-${to}`);
  }

  const ordered = blocks.flatMap((block) => block.lines);
  if (ordered.length !== body.length) {
    throw new Error(`Column ordering changed the line count in window ${from}-${to}`);
  }
  return [...lines.slice(0, start), ...head, ...ordered, ...tail, ...lines.slice(end)];
}

/** Default location of the column-ordered oracle on this machine. */
export function defaultOraclePath() {
  return join(homedir(), "OneDrive", "Documents", "Rules_Cyclopedia.md");
}

/** Default scratch location: never inside the published system directory. */
export function defaultOrderedPath(source) {
  return join(tmpdir(), `becmi-ocr-ordered-${basename(source, ".txt")}.txt`);
}

export async function createOrderedOcr(source, oracle = defaultOraclePath(), output = defaultOrderedPath(source)) {
  const [sourceText, oracleText] = await Promise.all([
    readFile(source, "utf8"),
    readFile(oracle, "utf8")
  ]);
  let lines = splitLines(sourceText);
  const index = oracleIndex(splitLines(oracleText));
  for (const { from, to, proseOnly } of PROTECTED_WINDOWS) {
    if (to <= lines.length) lines = reorderWindow(lines, from, to, index, { proseOnly });
  }
  await writeFile(output, lines.join("\n"), "utf8");
  return output;
}

const invokedDirectly = Boolean(process.argv[1])
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const source = process.argv[2];
  if (!source) {
    console.error("Usage: node tools/order-ocr.mjs <ocr.md> <oracle.md> [output.txt]");
    process.exitCode = 1;
  } else {
    const output = await createOrderedOcr(source, process.argv[3] ?? defaultOraclePath(), process.argv[4]);
    console.log(`Ordered OCR written to ${output}`);
  }
}
