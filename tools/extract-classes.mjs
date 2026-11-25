/**
 * Extract class progression data from the OCR'd Rules Cyclopedia markdown.
 * Writes data/classes.json (Foundry Item documents of type "class").
 *
 * Usage: node tools/extract-classes.mjs [path-to-markdown]
 */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { flatten, stripPictureText, summary, toNumber } from "./normalize.mjs";
import { ocrInput } from "./ocr-input.mjs";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("..", import.meta.url));
const input = ocrInput();

const CLASSES = [
  { name: "Cleric", from: 1059, to: 1318, prime: "Wisdom", hd: "1d6", max: 36, req: "" },
  { name: "Fighter", from: 1319, to: 1513, prime: "Strength", hd: "1d8", max: 36, req: "" },
  { name: "Magic-User", from: 1514, to: 1681, prime: "Intelligence", hd: "1d4", max: 36, req: "" },
  { name: "Thief", from: 1682, to: 1868, prime: "Dexterity", hd: "1d4", max: 36, req: "" },
  { name: "Dwarf", from: 1869, to: 2009, prime: "Strength", hd: "1d8", max: 12, req: "Constitution 9+" },
  { name: "Elf", from: 2010, to: 2103, prime: "Strength and Intelligence", hd: "1d6", max: 10, req: "Intelligence 9+", xpRange: [2104, 2128] },
  { name: "Halfling", from: 2136, to: 2301, prime: "Strength and Dexterity", hd: "1d6", max: 8, req: "Dexterity and Constitution 9+" },
  { name: "Druid", from: 2302, to: 2423, prime: "Wisdom", hd: "1d6", max: 36, req: "Neutral alignment" },
  { name: "Mystic", from: 2424, to: 2623, prime: "Strength and Dexterity", hd: "1d6", max: 16, req: "Wisdom and Dexterity 13+" }
];

// Standard BECMI progression, used only to fill levels lost in the OCR tables.
const STANDARD_XP = [0, 2000, 4000, 8000, 16000, 32000, 64000, 120000, 240000,
  360000, 480000, 600000, 720000, 840000, 960000, 1080000, 1200000, 1320000,
  1440000, 1560000, 1680000, 1800000, 1920000, 2040000, 2160000, 2280000,
  2400000, 2520000, 2640000, 2760000, 2880000, 3000000, 3120000, 3240000,
  3360000, 3480000];

// The OCR interleaves the Druid and Mystic tables; the Mystic progression is
// the first 16 rows of the standard table and must be forced explicitly.
const XP_OVERRIDES = { Mystic: STANDARD_XP.slice(0, 16) };

function parseXpTable(lines) {
  const table = {};
  for (const line of lines) {
    if (!/^\s*\|/.test(line)) continue;
    // A cell can hold several values separated by <br>; keep them separate.
    const cells = line.split("|").slice(1, -1)
      .map((cell) => cell.split(/<br\s*\/?>/i).map(flatten).filter(Boolean));
    for (let i = 0; i < cells.length - 1; i++) {
      const levels = cells[i].map((v) => toNumber(v, null)).filter((n) => n !== null && n >= 1 && n <= 36);
      const xps = cells[i + 1].map((v) => toNumber(v, null)).filter((n) => n !== null && n > 0);
      if (!levels.length || levels.length !== xps.length) continue;
      for (let j = 0; j < levels.length; j++) {
        if (xps[j] > (table[levels[j]] ?? 0)) table[levels[j]] = xps[j];
      }
      break; // the first level/XP column pair in the row wins
    }
  }
  return table;
}

function main() {
  const lines = require("node:fs").readFileSync(input, "utf8").split(/\r?\n/);
  return CLASSES.map((cls) => {
    const section = stripPictureText(lines.slice(cls.from - 1, cls.to).join("\n")).split(/\r?\n/);
    const prose = section
      .filter((l) => !/^\s*\|/.test(l) && !/^#{1,6}\s/.test(l))
      .join(" ");
    const xpLines = cls.xpRange
      ? [...section, ...lines.slice(cls.xpRange[0] - 1, cls.xpRange[1])]
      : section;
    const xpTable = parseXpTable(xpLines);
    const override = XP_OVERRIDES[cls.name];
    if (override) {
      for (const level of Object.keys(xpTable)) delete xpTable[level];
      override.forEach((xp, index) => { xpTable[index + 1] = xp; });
    }
    for (let level = 1; level <= cls.max; level++) {
      if (!xpTable[level]) xpTable[level] = STANDARD_XP[level - 1];
    }
    xpTable[1] = 0;
    for (const level of Object.keys(xpTable)) {
      if (Number(level) > cls.max) delete xpTable[level];
    }
    return {
      name: cls.name,
      type: "class",
      flags: { becmi: { source: "Rules Cyclopedia", xpLevels: Object.keys(xpTable).length } },
      system: {
        primeRequisite: cls.prime,
        hitDice: cls.hd,
        maxLevel: cls.max,
        requirements: cls.req,
        xpTable,
        saves: {},
        description: summary(prose, 700),
        source: "Rules Cyclopedia",
        page: 0,
        notes: ""
      }
    };
  });
}

const classes = main();
await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(new URL("../data/classes.json", import.meta.url), JSON.stringify(classes, null, 2));
console.log(`Extracted ${classes.length} classes.`);
console.log(classes.map((c) => `${c.name}: HD ${c.system.hitDice}, ${Object.keys(c.system.xpTable).length} XP levels`).join("\n"));
