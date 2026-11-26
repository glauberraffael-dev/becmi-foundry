/**
 * Manual corrections for spell maths lost or obscured by the PDF OCR.
 *
 * The Rules Cyclopedia sometimes prints only the range of a dice roll (for
 * example Sleep's "2-16 Hit Dice") while the prose states the actual dice.
 * These overrides keep the compendium text faithful to the printed rules and
 * give the sheet a rollable formula. Shared by the extractor and validator so
 * rebuilding the data cannot silently undo the fixes.
 */

const sleepNote = "Your Dungeon Master will roll 2d8 to find the total Hit Dice or experience levels of monsters affected by the spell.";

export const SPELL_MATH_OVERRIDES = Object.freeze({
  sleep: {
    fields: { effect: "2d8 (2-16) Hit Dice of living creatures within a 40' square area" },
    descriptionAppend: sleepNote,
    rollFormula: "2d8"
  },
  "snake charm": {
    fields: { duration: "1d4 + 1 (2-5) rounds or 1d4 + 1 (2-5) turns" },
    descriptionReplace: [["1d4 +1", "1d4 + 1"]],
    rollFormula: "1d4 + 1"
  },
  "cure disease": {
    descriptionReplace: [
      ["llth level", "11th level"],
      ["2dl2 (224) days", "2d12 (2-24) days"]
    ],
    rollFormula: "2d12"
  },
  barrier: {
    descriptionReplace: [["7dl0 (7-70)", "7d10 (7-70)"]],
    rollFormula: "7d10"
  },
  "holy word": {
    descriptionReplace: [["Stunned 2dl0 turns", "Stunned 2d10 turns"]],
    notes: "Level 6-8: stunned 2d10 turns; level 9-12: deafened 1d6 turns; level 13+: stunned 1d10 rounds.",
    rollFormula: "2d10"
  },
  restore: {
    descriptionReplace: [["2dl0 (2-20) days", "2d10 (2-20) days"]],
    rollFormula: "2d10"
  },
  "mirror image": {
    fields: {
      effect: "Creates 1d4 (1-4) additional images which look and act exactly like the spellcaster"
    },
    descriptionReplace: [["1d4 (14) additional images", "1d4 (1-4) additional images"]],
    rollFormula: "1d4"
  },
  "hold monster": {
    fields: { effect: "Paralyzes 1d4 creatures" },
    descriptionReplace: [["Effect: Paralyzes 1-4 creatures", "Effect: Paralyzes 1d4 creatures"]],
    rollFormula: "1d4"
  },
  "lower water": {
    descriptionReplace: [["1dl2 + 20 (21-32)", "1d12 + 20 (21-32)"]],
    rollFormula: "1d12 + 20"
  },
  "power word blind": {
    fields: { duration: "1d4 days or 2d4 hours (see below)" },
    descriptionReplace: [["blinded for ld4 days", "blinded for 1d4 days"]],
    notes: "1-40 HP: blinded for 1d4 days; 41-80 HP: blinded for 2d4 hours.",
    rollFormula: "1d4"
  },
  gate: {
    fields: { duration: "1d10 x 10 (10-100) turns or 1 turn" },
    descriptionReplace: [
      ["x 10(l-l00) turns", "x 10 (10-100) turns"],
      ["x 10 (1-100) turns", "x 10 (10-100) turns"]
    ],
    rollFormula: "1d10 * 10"
  },
  timestop: {
    fields: { duration: "1d4 + 1 (2-5) rounds" },
    descriptionReplace: [["1d4 + l (2-5)", "1d4 + 1 (2-5)"]],
    rollFormula: "1d4 + 1"
  },
  fireball: {
    rollFormula: "@level d6",
    notes: "1d6 fire damage per caster level; a successful save halves the total."
  },
  "lightning bolt": {
    rollFormula: "@level d6",
    notes: "1d6 lightning damage per caster level; a successful save halves the total."
  },
  "cure serious wounds": { rollFormula: "2d6 + 2" },
  "cure critical wounds": { rollFormula: "3d6 + 3" },
  "sticks to snakes": { rollFormula: "2d8" },
  "call lightning": { rollFormula: "8d6" },
  web: { rollFormula: "2d4" },
  "wall of stone": { rollFormula: "10d10" },
  "death spell": { rollFormula: "4d8" },
  "power word stun": { rollFormula: "2d6" }
});

/** Apply the OCR/math corrections to one extracted spell record, in place. */
export function applySpellMathOverrides(spell) {
  const override = SPELL_MATH_OVERRIDES[String(spell?.name ?? "").toLowerCase()];
  if (!override) return spell;

  const system = spell.system ?? (spell.system = {});
  Object.assign(system, override.fields ?? {});
  let description = String(system.description ?? "");
  for (const [from, to] of override.descriptionReplace ?? []) {
    description = description.split(from).join(to);
  }
  if (override.descriptionAppend && !description.includes(override.descriptionAppend)) {
    description = `${description} ${override.descriptionAppend}`.trim();
  }
  system.description = description;
  if (override.rollFormula) system.rollFormula = override.rollFormula;
  if (override.notes && !system.notes) system.notes = override.notes;
  return spell;
}
