/**
 * Repair and categorize extracted monster actors.
 *
 * The OCR stat blocks interleave variants and glue values together, so the
 * raw extractor output cannot be published as-is. This module keeps every
 * Rules Cyclopedia stat in its canonical order, clamps impossible values and
 * turns the long "Monster Type" paragraph into useful notes.
 */
import { monsterCategory } from "./pack-layout.mjs";
import { monsterHpFromHitDice } from "../scripts/rules-rc.mjs";

const NAME_FIXES = new Map([
  ["Shark (Great_ _White)", "Shark (Great White)"],
  ["Variant 1", "Mystic"],
  ["Variant 2", "Mystic (Leader)"]
]);

const XP_BY_HD = {
  1: 16, 2: 30, 3: 65, 4: 175, 5: 425, 6: 950, 7: 1650, 8: 2850,
  9: 3700, 10: 4750, 11: 5100, 12: 6500
};

const STAT_LABELS = [
  "Armor Class", "Hit Dice", "Move", "Flying", "Attacks", "Damage",
  "No. Appearing", "Save As", "Morale", "Treasure Type", "Intelligence",
  "Alignment", "XP Value"
];
const LABEL_PATTERN = STAT_LABELS
  .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
  .join("|");
const TRAILING_LABEL = new RegExp(`\\s+(?:${LABEL_PATTERN})\\s*:.*$`, "is");

const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const escapeHtml = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;");

function cleanName(value) {
  return clean(value)
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s*:\s*$/, "")
    .trim();
}

/** Remove the next stat label that the OCR appended to this field's value. */
function trimLabels(value) {
  return clean(value).replace(TRAILING_LABEL, "").trim();
}

function numberInRange(value, min, max, fallback) {
  const direct = Number(String(value ?? "").replace(/,/g, "").trim());
  if (Number.isInteger(direct) && direct >= min && direct <= max) return direct;

  // Concatenated OCR values such as "8910" mean "8 or 10"; "711" means 7.
  const digits = String(value ?? "").replace(/\D/g, "");
  if (!digits) return fallback;
  for (let size = 1; size <= Math.min(2, digits.length); size++) {
    const prefix = Number(digits.slice(0, size));
    if (prefix >= min && prefix <= max) return prefix;
  }
  const whole = Number(digits);
  return Number.isInteger(whole) && whole >= min && whole <= max ? whole : fallback;
}

function hdNumber(hd) {
  const match = String(hd ?? "").match(/(\d+)/);
  return match ? Math.min(12, Math.max(1, Number(match[1]))) : 1;
}

function xpForHd(hd) {
  return XP_BY_HD[hdNumber(hd)] ?? 16;
}

function alignmentFor(value) {
  const match = clean(value).match(/\b(lawful|neutral|chaotic|any)\b/i);
  if (!match) return "Neutral";
  return match[1][0].toUpperCase() + match[1].slice(1).toLowerCase();
}

function splitMonsterType(value) {
  const text = clean(value);
  if (!text) return { short: "", notes: "" };
  const stop = text.search(/[.!?](?:\s|$)/);
  if (stop < 0) return { short: text.slice(0, 80), notes: "" };
  return {
    short: text.slice(0, stop + 1).trim().slice(0, 80),
    notes: text.slice(stop + 1).trim()
  };
}

function captureSpecial(label, source) {
  const stop = `(?=\\s+(?:${LABEL_PATTERN}|Monster Type|Terrain)\\s*:|$)`;
  const match = new RegExp(`${label}\\s*:\\s*([\\s\\S]*?)${stop}`, "i").exec(source);
  return match ? clean(match[1]) : "";
}

function specialFor(raw) {
  // Curated repairs provide ready-made plain-text bullets as an array. Keep
  // them separate so each ability stays on its own paragraph.
  if (Array.isArray(raw.special)) {
    return raw.special
      .map((line) => clean(line))
      .filter(Boolean)
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join("");
  }
  const extracted = clean(raw.special);
  if (extracted) {
    return extracted.split(/\n+/).map((line) => {
      const [label, ...rest] = line.split(":");
      return rest.length
        ? `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(rest.join(":").trim())}</p>`
        : `<p>${escapeHtml(line)}</p>`;
    }).join("");
  }
  const source = String(raw.description ?? "");
  const parts = [];
  for (const [label, text] of [
    ["Attacks", captureSpecial("Attacks", source)],
    ["Defenses", captureSpecial("Defenses", source)],
    ["Special Attacks", captureSpecial("Special Attacks", source)],
    ["Special Defenses", captureSpecial("Special Defenses", source)]
  ]) {
    if (text) parts.push(`<p><strong>${label}:</strong> ${escapeHtml(text)}</p>`);
  }
  const mechanics = mechanicsFrom(source);
  if (mechanics) parts.push(`<p>${mechanics}</p>`);
  return parts.join("");
}

const MECHANIC_WORDS = /\b(?:immune|immunity|resistant|resistance|poison|paraly|petrif|energy drain|breath|gaze|regenerat|invisib|ethereal|charm|sleep|fear|web|constrict|swallow|camouflage|surprise|undetect|magic|spell|silver|fire|cold|lightning|electric|acid)\w*\b/i;

/** Highlight rules-bearing sentences when the OCR has no labelled special section. */
function mechanicsFrom(description) {
  const sentences = clean(description)
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter((sentence) => sentence.length > 30 && MECHANIC_WORDS.test(sentence));
  return escapeHtml(sentences.slice(0, 3).join(" ").slice(0, 700));
}

function descriptionFor(value, name) {
  let text = clean(value);
  if (text.startsWith("||")) {
    const cut = text.search(/\s(?:Monster Type|_Terrain:)/i);
    if (cut > 0) text = text.slice(cut + 1);
  }
  const leadingStat = new RegExp(`^\\s*(?:${LABEL_PATTERN})\\s*:\\s*[^\\n]*(?:\\n|$)`, "i");
  for (let guard = 0; guard < 20 && leadingStat.test(text); guard++) {
    text = text.replace(leadingStat, "");
  }
  text = text.replace(/^_?(?:Monster Type|Terrain):?_?[^.]*\.\s*/i, "");
  // The OCR sometimes leaves the tail of the previous entry at the top of a
  // new stat block (for example "Panther: ..." under "Carrion Crawler").
  const lead = text.match(/^\*{0,2}([A-Z][\w '\-]{1,40}?)\*{0,2}:\s*/);
  if (lead && !name.toLowerCase().includes(lead[1].toLowerCase().split(/\s+/)[0])) {
    text = text.replace(/^\*{0,2}[A-Z][\w '\-]{1,40}?\*{0,2}:\s*[^.]*(?:\.\s*)?/, "");
  }
  return escapeHtml(text.slice(0, 1200));
}

/** A few OCR headings lose their group name; restore it before filing. */
function categoryFor(name, raw, type, doc = {}) {
  const declared = doc.flags?.becmi?.category;
  if (declared) return declared;
  if (/^(?:black|blue|green|red|white|gold|silver|bronze|copper|brass)\s*\(/i.test(name)) return "Dragon";
  if (/^phantom\s*\(/i.test(name)) return "Undead";
  if (/^dinosaur\b|^plesiosaurus\b|^pterosaur\b|^ape, white\b/i.test(name)) return "Normal Animal";
  if (/^carrion crawler\b/i.test(name)) return "Monster";
  return monsterCategory({
    name,
    system: { monsterType: type.short, description: String(raw.description ?? "") }
  });
}

/** Normalize one extracted monster. Returns null for unusable OCR headings. */
export function normalizeMonsterDocument(doc) {
  const sourceName = cleanName(doc.name);
  const name = NAME_FIXES.get(sourceName) ?? sourceName;
  if (!name || /^(?:DM Checklist|Variant \d+)$/i.test(name)) return null;

  const raw = doc.system ?? {};
  const hd = clean(raw.hd) || "1";
  const type = splitMonsterType(raw.monsterType);
  const statFallback = [
    `AC ${numberInRange(raw.ac, -10, 20, 9)}`,
    `HD ${hd}`,
    `Attacks: ${trimLabels(raw.attacks) || "1 attack"}`,
    `Damage: ${trimLabels(raw.damage) || "By weapon"}`
  ].join("; ");
  const description = descriptionFor(raw.description, name) || escapeHtml(statFallback);
  const category = categoryFor(name, raw, type, doc);

  return {
    ...doc,
    name,
    type: "monster",
    flags: {
      ...(doc.flags ?? {}),
      becmi: {
        ...(doc.flags?.becmi ?? {}),
        source: "Rules Cyclopedia", key: name, category,
        variant: doc.flags?.becmi?.variant ?? ""
      }
    },
    system: {
      ...raw,
      ac: numberInRange(raw.ac, -10, 20, 9),
      hd,
      // HD is a d8 count, so HP must be derived from it — OCR often stored
      // the HD number (or a concatenated "3+1" -> 31) directly in this field.
      hp: monsterHpFromHitDice(hd),
      move: {
        dungeon: numberInRange(raw.move?.dungeon, 0, 1000, 120),
        outdoor: numberInRange(raw.move?.outdoor, 0, 1000, 40)
      },
      attacks: trimLabels(raw.attacks) || "1 attack",
      damage: trimLabels(raw.damage) || "By weapon",
      appearing: trimLabels(raw.appearing) || "1",
      saveAs: trimLabels(raw.saveAs) || `F${hdNumber(hd)}`,
      morale: numberInRange(raw.morale, 2, 12, 7),
      treasure: trimLabels(raw.treasure) || "Nil",
      intelligence: numberInRange(raw.intelligence, 0, 20, 5),
      alignment: alignmentFor(raw.alignment),
      xpValue: Math.max(1, Number(raw.xpValue) || xpForHd(hd)),
      terrain: clean(raw.terrain) || "Any",
      monsterType: type.short && !/^unclassified$/i.test(type.short) ? type.short : category,
      special: specialFor(raw),
      description,
      notes: escapeHtml(type.notes),
      source: "Rules Cyclopedia",
      page: Number(raw.page) || 0
    }
  };
}
