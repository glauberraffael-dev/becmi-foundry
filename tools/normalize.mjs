/** OCR cleanup helpers for the Rules Cyclopedia markdown export. */

/** Remove the image-OCR comments and their (usually garbled) contents. */
export function stripPictureText(text) {
  return text.replace(/<!--\s*Start of picture text\s*-->[\s\S]*?<!--\s*End of picture text\s*-->/gi, "");
}

/** Replace HTML line breaks with spaces and collapse whitespace. */
export function flatten(text) {
  return String(text ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Repair common OCR damage in dice notation:
 *   dl10 / d l10 / 3dl10 / ld6 / 2 d6 / 3 dI0  ->  1d10 / 1d10 / 3d10 / 1d6 / 2d6 / 3d10
 */
export function fixDice(text) {
  return String(text ?? "")
    .replace(/\b(\d+)\s*d\s*[lI|]\s*(\d+)\b/gi, (_m, count, faces) => `${count}d${faces}`)
    .replace(/\bd\s*[lI|]\s*(\d+)\b/gi, (_m, faces) => `d${faces}`)
    .replace(/\bl\s*d\s*(\d+)\b/gi, (_m, faces) => `1d${faces}`)
    .replace(/\b(\d+)\s+d\s*(\d+)\b/gi, (_m, count, faces) => `${count}d${faces}`);
}

/** Repair the OCR habit of turning the digit 1 into a lowercase L. */
export function fixOnes(text) {
  return String(text ?? "")
    .replace(/\+\s*l\b/g, "+ 1")
    .replace(/\bld(\d+)\b/gi, "1d$1")
    .replace(/\b([FM])l\b/g, "$11");
}

/** Clean a numeric value such as "1,200", "1 1 5" or "5" into a number. */
export function toNumber(value, fallback = null) {
  if (value === null || value === undefined) return fallback;
  const s = String(value).replace(/[^\d.-]/g, "");
  if (!s || !/\d/.test(s)) return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

/** Take the first numeric token, e.g. "10 20 35 75" -> 10. */
export function toFirstNumber(value, fallback = null) {
  const token = String(value ?? "").match(/\d[\d,]*/)?.[0];
  return token ? toNumber(token, fallback) : fallback;
}

/** Parse "90' (30')" or "120'" into { dungeon, outdoor } feet. */
export function parseMovement(text) {
  const nums = String(text ?? "").match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return { dungeon: 0, outdoor: 0 };
  return { dungeon: nums[0], outdoor: nums[1] ?? Math.round(nums[0] * 3) };
}

/** Parse "1-1", "2 + 2", "6*", "10**" into a rollable BECMI hit-dice string. */
export function parseHitDice(text) {
  const raw = fixOnes(flatten(text).replace(/\([^)]*\)/g, "")).trim();
  const match = raw.match(/(\d+(?:\/\d+)?(?:\s*[-+]\s*\d+)?\s*\**)/);
  if (!match) return "1";
  return match[1].replace(/\s+/g, "").replace(/\*+$/, "") || "1";
}

/** Split a monster stat line that has all labels on one physical line. */
const STAT_LABELS = [
  "Armor Class", "Hit Dice", "Move", "Flying", "Swimming", "Attacks", "Damage",
  "No. Appearing", "Save As", "Morale", "Treasure Type", "Intelligence",
  "Alignment", "XP Value"
];

export function parseStatLine(line) {
  const pattern = new RegExp(`\\s*(${STAT_LABELS.map((l) => l.replace(/\./g, "\\.")).join("|")}):`, "g");
  const text = fixOnes(flatten(line)).replace(pattern, "\n$1:");
  const result = {};
  const keys = {
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
  for (const part of text.split("\n").map((s) => s.trim()).filter(Boolean)) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const label = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    const key = keys[label];
    if (key && value) result[key] = value;
  }
  return result;
}

/** Turn markdown table rows into objects keyed by the first column. */
export function parseStatTable(rows) {
  const result = {};
  for (const row of rows) {
    const cells = row.split("|").map((c) => flatten(c)).filter((c, i, arr) => i > 0 && i < arr.length - 1);
    if (cells.length < 2) continue;
    const key = cells[0].replace(/:$/, "").trim();
    if (!key || /^-+$/.test(key)) continue;
    const values = cells.slice(1).filter((v) => v && !/^-+$/.test(v));
    result[key] = values.length === 1 ? values[0] : values;
  }
  return result;
}

/** Short, safe HTML description: first sentences only, no OCR picture text. */
export function summary(text, maxChars = 480) {
  const clean = flatten(stripPictureText(text))
    .replace(/\*\*/g, "")
    .replace(/_/g, "");
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const lastPeriod = cut.lastIndexOf(".");
  return (lastPeriod > maxChars * 0.5 ? cut.slice(0, lastPeriod + 1) : cut).trim();
}
