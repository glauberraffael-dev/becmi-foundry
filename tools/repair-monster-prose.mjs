/**
 * Repair monster descriptions from the page-ordered OCR export.
 *
 * The build OCR interleaves two columns, so a monster's prose can end up under
 * another monster's heading. The newer page export keeps columns in reading
 * order; this helper uses it only to replace `description` text. Names, stats,
 * counts and every other extracted field are left untouched.
 *
 * Usage: node tools/repair-monster-prose.mjs [oracle.md]
 */
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { defaultOraclePath } from "./order-ocr.mjs";

const root = new URL("..", import.meta.url);
const dataFile = new URL("data/monsters.json", root);

const STAT_LABEL = /^(?:Armor Class|Hit Dice|Move|Flying|Swimming|Attacks|Damage|No\. Appearing|Save As|Morale|Treasure Type|Intelligence|Alignment|XP Value|Load|Monster Type|Terrain)\s*:/i;
const TABLE_HEADING = /^(?:Lich Spellcaster|Magic-User Lich|Cleric Lich|Hit Points|XP Value|Dragon (?:Damage|Breath)|Type of Animal)\b/i;

const normalize = (value) => String(value ?? "")
  .replace(/\*+$/, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();

/** Candidate spellings used to find a monster's heading in the oracle. */
export function oracleKeysFor(name) {
  const full = normalize(name);
  const base = full.replace(/\s*\([^)]*\)\s*$/, "");
  const first = base.split(/, /)[0];
  const keys = [full, base, first];
  // The extractor splits some table variants into standalone names.
  if (/^(?:black|blue|green|red|gold)\s*$/.test(base)) keys.push("dragon");
  if (base.startsWith("golem (")) keys.push("golem");
  if (base.startsWith("manticore (")) keys.push("manticore");
  if (base.startsWith("pterosaur (")) keys.push("pterosaur");
  return [...new Set(keys.filter(Boolean))];
}

export function findHeading(lines, normalized, range, name) {
  for (const key of oracleKeysFor(name)) {
    let loose = null;
    let afterTable = null;
    for (let index = range.from; index < range.to; index++) {
      if (normalized[index] !== key) continue;
      // A real heading is followed by its stat block within a few lines. A
      // name that also appears as a row of the previous monster's summary
      // table is only a fallback, even when a stat label follows much later.
      for (let look = index + 1; look < Math.min(index + 140, range.to); look++) {
        if (normalized[look] === key && look > index) break;
        if (STAT_LABEL.test(lines[look].trim())) {
          if (look <= index + 8) return index;
          if (afterTable === null) afterTable = index;
          break;
        }
      }
      if (loose === null) loose = index;
    }
    if (afterTable !== null) return afterTable;
    if (loose !== null) return loose;
  }
  return null;
}

function proseBetween(lines, from, to) {
  const parts = [];
  let started = false;
  for (let index = from; index < to; index++) {
    const line = lines[index].trim();
    if (!line || line === "---" || /^<!--/.test(line)) continue;
    if (!/^[A-Za-z"“]/.test(line)) continue; // bullet glyphs and OCR artifacts
    if (STAT_LABEL.test(line) || TABLE_HEADING.test(line)) continue;
    if (/^(?:height|hit dice|movement rate|number appearing|save as|morale|treasure type)\s*:/i.test(line)) continue;
    if (/^the statistics for any gargantuan monster are/i.test(line)) continue;
    if (/^[.\s\d,'()=-]+$/.test(line)) continue;
    if (/[.]{3,}/.test(line) || /\|/.test(line) || /:$/.test(line)) continue;

    const words = line.split(/\s+/).join(" ");
    if (!started) {
      // A prose paragraph starts with a capitalised sentence of at least four
      // words. Stat values and single-word table variants never pass this.
      if (!/^[A-Z]/.test(words) || words.split(" ").length < 4) continue;
      started = true;
    }
    if (parts[parts.length - 1] !== words) parts.push(words);
  }
  return parts.join(" ")
    .replace(/\s*-\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const escapeHtml = (value) => String(value)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

/** Replace interleaved descriptions with the page-ordered ones, by name. */
export async function repairMonsterProse(oraclePath = defaultOraclePath()) {
  let oracleLines;
  try {
    oracleLines = (await readFile(oraclePath, "utf8")).split(/\r?\n/);
  } catch {
    return 0;
  }

  const normalized = oracleLines.map(normalize);
  const from = normalized.findIndex((line, index) => index > 30000 && line === "actaeon (elk centaur)");
  if (from < 0) return 0;
  const chapter = oracleLines.findIndex((line, index) => index > from && /^(?:chapter\s+15|index)\b/i.test(line.trim()));
  const range = { from, to: chapter > from ? chapter : oracleLines.length };

  const monsters = JSON.parse(await readFile(dataFile, "utf8"));
  const proseFirst = new Map([
    ["lich", [/^A lich is a powerful undead monster/i, -1]],
    ["spectral hound", [/^Spectral hounds are creatures from the Di-/i, -1]],
    ["dragon", [/^Dragons are a very old race of huge winged liz-/i, -1]],
    ["gargantua", [/^A gargantua is a very large variety/i, -1]]
  ]);
  const positions = new Map();
  for (const monster of monsters) {
    const key = oracleKeysFor(monster.name).find((candidate) => proseFirst.has(candidate));
    let at;
    if (key) {
      const [pattern, offset] = proseFirst.get(key);
      const found = oracleLines.findIndex((line) => pattern.test(line.trim()));
      at = found < 0 ? null : found + offset;
    } else {
      at = findHeading(oracleLines, normalized, range, monster.name);
    }
    if (at !== null && at >= 0) positions.set(monster.name, at);
  }
  const extra = ["Medusa"]
    .map((name) => findHeading(oracleLines, normalized, range, name))
    .filter((at) => at !== null);
  const ghostAt = oracleLines.findIndex((line) => /^The ghostly spectres are among the mightiest/i.test(line.trim()));
  if (ghostAt > 0) extra.push(ghostAt - 1);
  const boundaries = [...new Set([...positions.values(), ...extra])].sort((a, b) => a - b);

  let repaired = 0;
  for (const monster of monsters) {
    const at = positions.get(monster.name);
    if (at === undefined) continue;
    const next = boundaries.find((value) => value > at) ?? range.to;
    const prose = proseBetween(oracleLines, at + 1, Math.min(next, at + 240));
    if (prose.length < 20) continue;
    monster.system.description = escapeHtml(prose.slice(0, 1200));
    repaired++;
  }

  if (repaired) await writeFile(dataFile, JSON.stringify(monsters, null, 2) + "\n", "utf8");
  return repaired;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const count = await repairMonsterProse(process.argv[2] ?? defaultOraclePath());
  console.log(`Repaired ${count} monster descriptions from the page-ordered OCR.`);
}
