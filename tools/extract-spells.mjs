/**
 * Extract spell entries from the OCR'd Rules Cyclopedia markdown.
 * Writes data/spells.json (Foundry Item documents of type "spell").
 *
 * Usage: node tools/extract-spells.mjs [path-to-markdown]
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { fixDice, fixOnes, flatten, stripPictureText, summary } from "./normalize.mjs";
import { ocrInput } from "./ocr-input.mjs";
import { applySpellMathOverrides } from "./spell-math.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const input = ocrInput();

const SECTIONS = [
  { from: 3109, to: 3718, list: "cleric", label: "Clerical" },
  { from: 3719, to: 4012, list: "druid", label: "Druidic" },
  { from: 4074, to: 5706, list: "magic-user", label: "Magical" }
];

const LEVEL_RE = /^\s*#{3,6}\s*\*\*(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth) Level (?:Clerical|Druidic|Magical) Spells\*\*\s*$/i;
const ORDINALS = { First: 1, Second: 2, Third: 3, Fourth: 4, Fifth: 5, Sixth: 6, Seventh: 7, Eighth: 8, Ninth: 9 };

function isNoise(name) {
  return /^(Reversible Spells|List of .*|Reading Spell Descriptions|Number and Types of Spells|Casting Magical Spells|Spell Books|The|Notes|Terrain|Range:)/i.test(name) ||
    /^(First|Second|Third|Fourth|Fifth|Sixth|Seventh|Eighth|Ninth)$/i.test(name);
}

function cleanName(raw) {
  return flatten(raw)
    .replace(/\*+$/, "")
    .replace(/^_\s*|\s*_$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseStats(text) {
  const flat = fixDice(flatten(text));
  const range = flat.match(/\bRange:\s*(.*?)(?=\s+Duration:|$)/i)?.[1] ?? "";
  const duration = flat.match(/\bDuration:\s*(.*?)(?=\s+Effect:|$)/i)?.[1] ?? "";
  const effect = flat.match(/\bEffect:\s*(.*)$/i)?.[1] ?? "";
  return {
    range: range.trim(),
    duration: duration.trim(),
    effect: effect.replace(/\s+(?:When|Upon|A|An|The|If|This|Each|Any|In|All|For)\s.*$/, "").trim()
  };
}

function main() {
  const lines = awaitLines(readFileSync(input)).split(/\r?\n/);
  const spells = [];

  for (const section of SECTIONS) {
    let level = 0;
    let current = null;

    const flush = () => {
      if (!current) return;
      const body = current.lines.join("\n");
      const statText = current.statLines.join(" ");
      const fullText = `${statText} ${body}`;
      const stats = parseStats(fullText.slice(0, 900));
      const description = fixDice(fixOnes(summary(body, 700)));
      if (current.name && description.length > 20) {
        spells.push({
          name: current.name,
          type: "spell",
          flags: { becmi: { source: "Rules Cyclopedia", list: section.list } },
          system: {
            spellLevel: level || 1,
            spellLists: [section.list],
            range: stats.range,
            duration: stats.duration,
            effect: stats.effect,
            reversible: current.reversible,
            description,
            source: "Rules Cyclopedia",
            page: 0,
            notes: ""
          }
        });
      }
      current = null;
    };

    const sectionLines = stripPictureText(lines.slice(section.from - 1, section.to).join("\n")).split(/\r?\n/);
    for (let i = 0; i < sectionLines.length; i++) {
      const line = sectionLines[i];
      const levelMatch = line.match(LEVEL_RE);
      if (levelMatch) {
        flush();
        level = ORDINALS[levelMatch[1]];
        continue;
      }

      const heading = line.match(/^\s*#{3,6}\s*\*\*(.+?)\*\*\s*\*?\s*$/);
      const boldStat = line.match(/^\s*\*\*([^*]+)\*{1,3}\s+(.*Range:.*)$/i);
      if (heading || boldStat) {
        flush();
        const rawName = boldStat ? boldStat[1] : heading[1];
        const name = cleanName(rawName);
        if (!name || isNoise(name)) continue;
        current = {
          name,
          reversible: /\*/.test(rawName) || /\*$/.test(heading?.[1] ?? ""),
          statLines: boldStat ? [boldStat[2]] : [],
          lines: []
        };
        continue;
      }

      if (!current) continue;
      if (/\bRange:\s*/i.test(line) && current.statLines.length < 4) {
        current.statLines.push(line);
      } else {
        current.lines.push(line);
      }
    }
    flush();
  }

  // Merge duplicate spell names across lists (druids share cleric spells).
  const merged = new Map();
  for (const spell of spells) {
    const key = spell.name.toLowerCase();
    const prev = merged.get(key);
    if (!prev) {
      merged.set(key, spell);
      continue;
    }
    const lists = new Set([...prev.system.spellLists, ...spell.system.spellLists]);
    prev.system.spellLists = [...lists];
    if (prev.system.description.length < spell.system.description.length) {
      prev.system.description = spell.system.description;
      prev.system.range = spell.system.range || prev.system.range;
      prev.system.duration = spell.system.duration || prev.system.duration;
      prev.system.effect = spell.system.effect || prev.system.effect;
    }
    prev.system.reversible ||= spell.system.reversible;
  }
  return [...merged.values()].map(applySpellMathOverrides);
}

function readFileSync(path) {
  // eslint-disable-next-line no-undef
  return require("node:fs").readFileSync(path, "utf8");
}
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function awaitLines(text) {
  return text;
}

const spells = main();
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/spells.json", import.meta.url), JSON.stringify(spells, null, 2));
console.log(`Extracted ${spells.length} spells.`);
console.log(spells.slice(0, 6).map((s) => `${s.name} (${s.system.spellLists.join("/")} ${s.system.spellLevel}): ${s.system.range}`).join("\n"));
