/**
 * Extract monster stat blocks from the OCR'd Rules Cyclopedia markdown.
 * Writes data/monsters.json (Foundry Actor documents).
 *
 * Usage: node tools/extract-monsters.mjs [path-to-markdown]
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  fixDice,
  fixOnes,
  flatten,
  parseHitDice,
  parseMovement,
  parseStatLine,
  parseStatTable,
  stripPictureText,
  summary,
  toFirstNumber,
  toNumber
} from "./normalize.mjs";
import { ocrInput } from "./ocr-input.mjs";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));
const input = ocrInput();

// 1-based line range of the alphabetical Monster List in the OCR export.
const LIST_FROM = 13791;
const LIST_TO = 18472;

const KEY_MAP = {
  "Armor Class": "ac",
  "Hit Dice": "hd",
  Move: "move",
  Attacks: "attacks",
  Damage: "damage",
  "No. Appearing": "appearing",
  "Save As": "saveAs",
  Morale: "morale",
  "Treasure Type": "treasure",
  Intelligence: "intelligence",
  Alignment: "alignment",
  "XP Value": "xpValue"
};

function cleanName(raw) {
  return flatten(raw)
    .replace(/\*+$/, "")
    .replace(/^_\s*|\s*_$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function estimateHp(hd) {
  const cleaned = fixDice(String(hd ?? ""));
  if (/^\d+\/\d+$/.test(cleaned)) return 1;
  const m = cleaned.match(/(\d+)d(\d+)/);
  if (!m) return toNumber(cleaned, 1) ?? 1;
  return Math.round((Number(m[1]) * (Number(m[2]) + 1)) / 2);
}

function normaliseStats(raw) {
  const stats = {};
  for (const [label, value] of Object.entries(raw)) {
    const key = KEY_MAP[label];
    if (!key) continue;
    stats[key] = value;
  }
  return stats;
}

// Stat lines are tables, not prose. Keeping them out of `description` is what
// makes the compendium readable and lets the sheet show one field per stat.
const STAT_TEXT = "Armor Class|Hit Dice|Move|Flying|Attacks|Damage|No\\. Appearing|Save As|Morale|Treasure Type|Intelligence|Alignment|XP Value|Load";
// OCR stat rows often begin with a variant label (for example
// "_Normal Giant_ Armor Class: ..."), so matching only at the start of the
// line leaves entire stat tables inside the prose. Match them anywhere.
const STAT_LINE_RE = new RegExp(`(?:${STAT_TEXT})\\s*:`, "i");
const LORE_SKIP_RE = /^(?:_?(?:Monster Type|Terrain)\s*:|\|)/i;
const SPECIAL_RE = /^\*\*(Special Attacks|Special Defenses|Attacks|Defenses):\*\*\s*(.*)$/i;

function loreFrom(bodyLines) {
  return bodyLines
    .filter((line) => !LORE_SKIP_RE.test(line.trim())
      && !STAT_LINE_RE.test(line)
      && !SPECIAL_RE.test(line.trim()))
    .join("\n");
}

/** Pull labelled combat notes out of the prose and keep them in their own field. */
function specialFrom(bodyLines) {
  const sections = [];
  let current = null;
  for (const line of bodyLines) {
    const match = line.trim().match(SPECIAL_RE);
    if (match) {
      current = { label: match[1], parts: [match[2]] };
      sections.push(current);
      continue;
    }
    if (!current) continue;
    if (!line.trim()) {
      current = null;
      continue;
    }
    current.parts.push(line.trim());
  }
  return sections
    .map((section) => `${section.label}: ${section.parts.join(" ").trim()}`)
    .filter((text) => text.split(":")[1]?.trim())
    .join("\n");
}

function buildActor(name, stats, bodyLines, variant) {
  const body = bodyLines.join("\n");
  const move = parseMovement(stats.move);
  const terrain = body.match(/_Terrain:_\s*([^\n]+)/i)?.[1];
  const typeLine = body.match(/_Monster Type:_\s*([^\n]+)/i)?.[1];
  const cleanVariant = variant ? cleanName(variant).replace(/^_+|_+$/g, "") : "";
  const fullName = cleanVariant ? `${name} (${cleanVariant})` : name;
  const hd = parseHitDice(stats.hd ?? "1");
  const lore = loreFrom(bodyLines);
  const statSummary = [
    `AC ${flatten(stats.ac ?? "")}`.trim(),
    `HD ${flatten(stats.hd ?? "")}`.trim(),
    `attacks ${flatten(stats.attacks ?? "")}`.trim(),
    `damage ${flatten(stats.damage ?? "")}`.trim()
  ].filter((part) => !/\s$/.test(part) && part.split(" ").length > 1).join("; ");

  return {
    name: fullName,
    type: "monster",
    flags: { becmi: { source: "Rules Cyclopedia", variant: variant ?? "", key: fullName } },
    system: {
      ac: toFirstNumber(stats.ac, 9),
      hd,
      hp: estimateHp(hd),
      move: { dungeon: move.dungeon, outdoor: move.outdoor },
      attacks: fixDice(fixOnes(flatten(stats.attacks ?? ""))),
      damage: fixDice(fixOnes(flatten(stats.damage ?? ""))),
      appearing: fixDice(fixOnes(flatten(stats.appearing ?? ""))),
      saveAs: fixOnes(flatten(stats.saveAs ?? "")),
      morale: toNumber(stats.morale, 7),
      treasure: flatten(stats.treasure ?? ""),
      intelligence: toNumber(stats.intelligence, 5),
      alignment: flatten(stats.alignment ?? "Neutral"),
      xpValue: toFirstNumber(stats.xpValue, 0),
      terrain: flatten(terrain ?? ""),
      monsterType: flatten(typeLine ?? ""),
      description: summary(lore || statSummary, 900),
      special: specialFrom(bodyLines),
      notes: "",
      source: "Rules Cyclopedia",
      page: 0
    }
  };
}

/** Group markdown table rows into {variants, stats} blocks. */
function parseTableBlocks(lines) {
  const rows = lines.filter((l) => /^\s*\|/.test(l));
  if (rows.length < 3) return [];

  const blocks = [];
  let current = null;
  for (const row of rows) {
    const headerCells = row.split("|").map((c) => flatten(c)).filter(Boolean);
    const isHeader = /^\|\|/.test(row) && headerCells.length >= 2 && headerCells.every((c) => /^_?[A-Za-z][\w\s\-]*_?$/.test(c));
    if (isHeader) {
      current = { variants: headerCells.slice(0, headerCells.length), rows: [] };
      blocks.push(current);
      continue;
    }
    if (current) current.rows.push(row);
  }

  return blocks.map((block) => {
    const parsed = parseStatTable([`||${block.variants.join("|")}|`, ...block.rows]);
    return { variants: block.variants, stats: normaliseStats(parsed) };
  }).filter((b) => b.variants.length > 0 && Object.keys(b.stats).length > 0);
}

/** Parse a flattened multi-variant stat line (several repeated field labels). */
function parseFlattenedVariants(line, parentName = "") {
  const text = fixOnes(flatten(line));
  const segments = text.split(/(?=\b(?:Armor Class):)/).filter((s) => /Armor Class:/i.test(s));

  // Case A: each variant repeats the whole set of labels.
  if (segments.length >= 2) {
    const variants = [];
    const stats = {};
    for (const segment of segments) {
      const nameMatch = segment.match(/^\*\*([^*]+)\*\*/) ?? segment.match(/^_([^_]+)_/);
      const label = String(nameMatch?.[1] ?? "").split(/\s+/)[0];
      const form = label && label.toLowerCase() !== parentName.toLowerCase()
        ? label
        : `Form ${variants.length + 1}`;
      const variantName = cleanName(`${parentName} (${form})`);
      variants.push(variants.includes(variantName) ? `${variantName} ${variants.length + 1}` : variantName);
      const parsed = parseStatLine(segment.replace(/^\*\*[^*]+\*\*\s*/, "").replace(/^_[^_]+\_\s*/, ""));
      for (const [key, value] of Object.entries(parsed)) {
        stats[key] = Array.isArray(stats[key]) ? stats[key] : [];
        stats[key].push(value);
      }
    }
    return { variants, stats };
  }

  // Case B: one label set, several values, variants listed in italics up front.
  const prefix = text.match(/^_([^_]+)_\s+Armor Class:/);
  if (!prefix) return null;
  const variants = prefix[1].split(/\s+(?:and\s+)?/).filter(Boolean).map((v) => `${parentName} (${v})`);
  if (variants.length < 2) return null;
  const parsed = parseStatLine(text.replace(/^_[^_]+\_\s*/, ""));
  const stats = {};
  const numeric = new Set(["ac", "hd", "morale", "intelligence", "xpValue"]);
  for (const [key, value] of Object.entries(parsed)) {
    if (numeric.has(key)) {
      const pattern = key === "hd" ? /\d+(?:\/\d+)?(?:\s*[-+]\s*\d+)?/g : key === "move" ? /(\d+)'/g : /\d+/g;
      const numbers = [...String(value).matchAll(pattern)].map((m) => m[1] ?? m[0]);
      stats[key] = variants.map((_, i) => numbers[i] ?? numbers[0] ?? "");
    } else if (key === "alignment") {
      const words = String(value).split(/\s+/).filter((w) => /^[A-Z]/.test(w));
      stats[key] = variants.map((_, i) => words[i] ?? words[0] ?? "Neutral");
    } else {
      stats[key] = variants.map(() => value);
    }
  }
  return { variants, stats };
}

function main() {
  const rawLines = require("node:fs").readFileSync(input, "utf8").split(/\r?\n/);
  const section = rawLines.slice(LIST_FROM - 1, LIST_TO).join("\n");
  const lines = stripPictureText(section).split(/\r?\n/);
  const headingRe = /^#{3,6}\s*\*\*(.+?)\*\*\s*$/;
  const boldStatRe = /^\s*\*\*([^*]+)\*{1,3}\s+(?=Armor Class:)/i;

  const entries = [];
  let current = null;
  const flush = () => {
    if (!current) return;
    const block = current.lines;
    const output = [];
    const statIdx = block.findIndex((l) => /Armor Class:/i.test(l) && /Hit Dice:/i.test(l));

    if (statIdx >= 0) {
      const flat = parseFlattenedVariants(block[statIdx], current.name);
      if (flat) {
        for (let i = 0; i < flat.variants.length; i++) {
          const stats = {};
          for (const [key, values] of Object.entries(flat.stats)) stats[key] = values[i] ?? values[0];
          output.push(buildActor(flat.variants[i], stats, block, null));
        }
      } else {
        const stats = parseStatLine(block[statIdx]);
        for (const extra of block.slice(statIdx + 1, statIdx + 5)) {
          if (!/\b[A-Z][A-Za-z.]*:/.test(extra)) continue;
          const more = parseStatLine(extra);
          for (const [key, value] of Object.entries(more)) if (!stats[key]) stats[key] = value;
        }
        output.push(buildActor(current.name, stats, block, null));
      }
    } else {
      for (const table of parseTableBlocks(block)) {
        for (const variant of table.variants) {
          const stats = {};
          for (const [key, values] of Object.entries(table.stats)) {
            stats[key] = Array.isArray(values) ? values[table.variants.indexOf(variant)] ?? values[0] : values;
          }
          output.push(buildActor(current.name, stats, block, variant));
        }
      }
    }
    entries.push(...output.filter((e) => e.name && e.system.ac !== null));
    current = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const heading = line.match(headingRe);
    const boldStat = line.match(boldStatRe);
    if (heading || boldStat) {
      flush();
      const name = cleanName(boldStat ? boldStat[1] : heading[1]);
      if (name && !/^DM Checklist\b/i.test(name)) current = { name, lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();

  const unique = new Map();
  for (const entry of entries) {
    const prev = unique.get(entry.name);
    if (!prev || JSON.stringify(entry.system).length > JSON.stringify(prev.system).length) unique.set(entry.name, entry);
  }
  return [...unique.values()];
}

const monsters = main();
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/monsters.json", import.meta.url), JSON.stringify(monsters, null, 2));
console.log(`Extracted ${monsters.length} monster entries.`);
console.log(monsters.slice(0, 8).map((m) => `${m.name}: AC ${m.system.ac}, HD ${m.system.hd}, XP ${m.system.xpValue}`).join("\n"));
