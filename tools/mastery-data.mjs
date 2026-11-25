/**
 * Curated tables and reference text for the optional Weapon Mastery rules.
 * Source: D&D Rules Cyclopedia, Chapters 4, 5 and 8 (PDF pages 62-81 and 147).
 *
 * The small tables below are transcribed from selectable PDF text. The large
 * Weapons Mastery Table is a compact, level-by-level paraphrase recovered from
 * the scanned, rotated pages; the original page should be consulted for exact
 * cell alignment.
 */

const src = (category) => ({ source: "Rules Cyclopedia", category });

/**
 * Build a RollTable document. Every row becomes a single result so the table
 * can be rolled as a lookup with `1d<rows>`.
 */
export function rollTable(name, category, rows, extra = {}) {
  const formula = rows.length === 1 ? "1" : `1d${rows.length}`;
  return {
    name,
    flags: { becmi: src(category) },
    formula,
    ...extra,
    results: rows.map(([label, text], i) => ({
      _id: `${name.replace(/[^a-z0-9]/gi, "").slice(0, 12).toLowerCase()}${i}`.padEnd(16, "0"),
      type: "text",
      text: text ? `${label}: ${text}` : label,
      range: [i + 1, i + 1],
      weight: 1,
      drawn: false
    }))
  };
}

// ---------------------------------------------------------------------------
// Chapter 4: the basic Weapons Table (PDF p. 62).
// name, damage, range S/M/L, cost gp, enc cn, notes
// ---------------------------------------------------------------------------
export const BASIC_WEAPONS = [
  ["Axe, Battle", "1d8", "-", 7, 60, "r, 2H, M"],
  ["Axe, Hand", "1d6", "10/20/30", 4, 30, "t, S"],
  ["Bow, Short", "1d6", "50/100/150", 25, 20, "a, m, 2H, M"],
  ["Bow, Long", "1d6", "70/140/210", 40, 30, "a, m, 2H, L"],
  ["Crossbow, Light", "1d6", "60/120/180", 30, 50, "a, m, s, 2H, M"],
  ["Crossbow, Heavy", "2d4", "80/160/240", 50, 80, "a, m, s, 2H, L"],
  ["Blackjack", "1d2", "-", 5, 5, "c, r, s, S"],
  ["Club", "1d4", "-", 3, 50, "c, r, M"],
  ["Hammer, Throwing", "1d4", "10/20/30", 4, 25, "c, t, M"],
  ["Hammer, War", "1d6", "-", 5, 50, "c, r, M"],
  ["Mace", "1d6", "-", 5, 30, "c, r, M"],
  ["Staff", "1d6", "-", 5, 40, "c, r, w, 2H, M"],
  ["Torch", "1d4", "-", "-", 20, "c, r, S"],
  ["Dagger, Normal", "1d4", "10/20/30", 3, 10, "t, w, S"],
  ["Dagger, Silver", "1d4", "10/20/30", 30, 10, "t, w, S"],
  ["Halberd", "1d10", "-", 7, 150, "s, 2H, L"],
  ["Javelin", "1d6", "30/60/90", 1, 20, "t, M"],
  ["Lance", "1d10", "-", 10, 180, "s, v, L"],
  ["Pike", "1d10", "-", 3, 80, "s, v, 2H, L"],
  ["Polearm", "1d10", "-", 7, 150, "s, 2H, L"],
  ["Poleaxe", "1d10", "-", 5, 120, "s, 2H, L"],
  ["Spear", "1d6", "20/40/60", 3, 30, "t, v, L"],
  ["Trident", "1d6", "10/20/30", 5, 25, "s, t, M"],
  ["Shield, Horned", "1d2", "-", 15, 20, "s, S"],
  ["Shield, Knife", "1d4+1", "-", 65, 70, "s, S"],
  ["Shield, Sword", "1d4+2", "-", 200, 185, "s, v, M"],
  ["Shield, Tusked", "1d4+1", "-", 200, 275, "s, 2H, L"],
  ["Sword, Short", "1d6", "-", 7, 30, "r, S"],
  ["Sword, Normal", "1d8", "-", 10, 60, "r, M"],
  ["Sword, Bastard (1H)", "1d6+1", "-", 15, 80, "r, HH, L"],
  ["Sword, Bastard (2H)", "1d8+1", "-", 15, 80, "r, 2H, L"],
  ["Sword, Two-Handed", "1d10", "-", 15, 100, "2H, L"],
  ["Blowgun, up to 2'", "Nil", "10/20/30", 3, 6, "a, m, s, w, S"],
  ["Blowgun, 2'+", "Nil", "20/25/30", 6, 15, "a, m, s, w, 2H, M"],
  ["Bola", "1d2", "20/40/60", 5, 5, "s, t, M"],
  ["Cestus", "1d3", "-", 5, 10, "s, S"],
  ["Holy Water", "1d8", "10/30/50", 25, 1, "c, s, t, w, S"],
  ["Net", "Nil", "10/20/30", "1 sp/sq ft", "1 cn/sq ft", "s, t, w, M or L"],
  ["Oil, Burning", "1d8", "10/30/50", 2, 10, "c, s, t, w, S"],
  ["Rock, Thrown", "1d3", "10/30/50", "-", 10, "c, t, w, S"],
  ["Sling", "1d4", "40/80/160", 2, 20, "c, m, w, S"],
  ["Whip", "1d2", "-", "1 gp/ft", "10 cn/ft", "s, w, M"]
];

// ---------------------------------------------------------------------------
// Chapter 5: mastery procedure tables, transcribed from selectable PDF text.
// ---------------------------------------------------------------------------
export const MASTERY_CHOICES = [
  ["Level 1", "Fighter 4 choices; all other classes 2"],
  ["Level 3", "Fighter 5; all others 3"],
  ["Level 6", "Fighter 6; all others 4"],
  ["Level 9", "Fighter 7; all others 5"],
  ["Level 11", "Fighter 8; all others 6"],
  ["Level 15", "Fighter 9; all others 7"],
  ["Level 19", "Fighter 10; all others 7"],
  ["Level 23", "Fighter 11; all others 8"],
  ["Level 27", "Fighter 12; all others 8"],
  ["Level 30", "Fighter 13; all others 9"],
  ["Level 33", "Fighter 14; all others 9"],
  ["Level 36", "Fighter 15; all others 10; +1 per 200,000 XP above maximum level"]
];

export const MASTERY_LEVELS = [
  ["Unskilled", "0 weapon choices spent; half damage with any weapon"],
  ["Basic", "1 choice; normal weapon characteristics"],
  ["Skilled", "2 choices; first attack and damage bonuses"],
  ["Expert", "3 choices; improved damage, range and special effects"],
  ["Master", "4 choices; stronger damage and defense"],
  ["Grand Master", "5 choices; best bonuses and special effects"]
];

export const TRAINING_COSTS = [
  ["Basic (new weapon)", "1 week, 100 gp per week"],
  ["Skilled", "2 weeks, 250 gp per week"],
  ["Expert", "4 weeks, 500 gp per week"],
  ["Master", "8 weeks, 750 gp per week"],
  ["Grand Master", "12 weeks, 1,000 gp per week"]
];

export const TRAINING_SUCCESS = [
  ["Student: None", "Basic 60%, Skilled 80%, Expert 95%, Master 99%, Grand Master 99%"],
  ["Student: Basic", "Basic 1%, Skilled 50%, Expert 70%, Master 90%, Grand Master 95%"],
  ["Student: Skilled", "Skilled 1%, Expert 40%, Master 60%, Grand Master 80%"],
  ["Student: Expert", "Expert 1%, Master 30%, Grand Master 50%"],
  ["Student: Master", "Master 1%, Grand Master 20%"],
  ["Student: Grand Master", "Grand Master 1%"]
];

export const ATTACK_BONUSES = [
  ["Unskilled", "No bonus vs. primary or secondary"],
  ["Basic", "No bonus vs. primary or secondary"],
  ["Skilled", "+2 vs. primary, +1 vs. secondary"],
  ["Expert", "+4 vs. primary, +2 vs. secondary"],
  ["Master", "+6 vs. primary, +4 vs. secondary"],
  ["Grand Master", "+8 vs. primary, +6 vs. secondary"]
];

export const DESPAIR_EFFECT = [
  ["Basic", "No despair effect"],
  ["Skilled", "Up to 4 Hit Dice or levels"],
  ["Expert", "Up to 8 Hit Dice or levels"],
  ["Master", "Up to 12 Hit Dice or levels"],
  ["Grand Master", "Up to 16 Hit Dice or levels"]
];

export const MONSTER_MASTERY_LIMITS = [
  ["Intelligence up to 11", "Basic"],
  ["Intelligence 12-15", "Skilled"],
  ["Intelligence 16-17", "Expert"],
  ["Intelligence 18+", "Master (never Grand Master)"]
];

export const WEAPON_PENALTIES = [
  ["Basic second weapon", "Cannot be reduced below Basic"],
  ["Unskilled second weapon", "Cannot be used for the second attack"],
  ["Second attack", "-4 attack roll and -1 mastery level"],
  ["Cestus / shield weapons", "No off-hand penalty (horned, knife, sword shield)"],
  ["Tusked shield", "Two attacks, neither at an off-hand penalty"],
  ["Maximum extra attacks", "+1 attack per round from all optional rules combined"]
];

// ---------------------------------------------------------------------------
// Chapter 4/8: small reference tables.
// ---------------------------------------------------------------------------
export const BASIC_SPECIAL_EFFECTS = [
  ["Up to 1 HD", "Save bonus None; Blackjack Knockout; Bola/Net/Whip Entangle; Blowgun By poison"],
  ["1+1 to 3 HD", "Save +1; Knockout; Entangle; By poison"],
  ["3+1 to 6 HD", "Save +2; Stun; Slow; By poison"],
  ["6+1 to 9 HD", "Save +3; Stun; Slow; By poison"],
  ["9+1 to 12 HD", "Save +4; Delay; Delay; By poison"],
  ["12+ HD", "Save +5; Delay; Delay; By poison"]
];

export const AMMUNITION = [
  ["Blowgun dart", "5 shots, 1 gp, 5 shots/cn"],
  ["Bow arrow", "20 shots, 5 gp, 2 shots/cn"],
  ["Silver-tipped arrow", "1 shot, 5 gp, 2 shots/cn"],
  ["Crossbow quarrel", "30 shots, 10 gp, 3 shots/cn"],
  ["Silver-tipped quarrel", "1 shot, 5 gp, 3 shots/cn"],
  ["Sling stone or pellet", "30 shots, 1 gp, 5 shots/cn"],
  ["Silver pellet", "1 shot, 5 gp, 5 shots/cn"]
];

export const ARMOR = [
  ["Shield", "AC -1, 10 gp, 100 cn"],
  ["Leather Armor", "AC 7, 20 gp, 200 cn; druid/thief allowed with conditions"],
  ["Scale Mail", "AC 6, 30 gp, 300 cn"],
  ["Chain Mail", "AC 5, 40 gp, 400 cn"],
  ["Banded Mail", "AC 4, 50 gp, 450 cn"],
  ["Plate Mail", "AC 3, 60 gp, 500 cn"],
  ["Suit Armor", "AC 0, 250 gp, 750 cn; -5 to missile attacks"]
];

export const BARDING = [
  ["Leather", "AC 7, 40 gp, 250 cn"],
  ["Scale", "AC 6, 75 gp, 400 cn"],
  ["Chain", "AC 5, 150 gp, 600 cn"],
  ["Banded", "AC 4, 400 gp, 1,500 cn"],
  ["Plate", "AC 3, 500 gp, 3,000 cn"],
  ["Field", "AC 2, 600 gp, 4,000 cn"],
  ["Joust", "AC 0, 700 gp, 5,000 cn"]
];

export const NETS = [
  ["Very small", "Up to 1'; 2' x 2' net"],
  ["Small", "1'+ to 3'; 4' x 4' net"],
  ["Medium", "3'+ to 6'; 6' x 6' net"],
  ["Large", "6'+ to 10'; 9' x 9' net"],
  ["Very large", "10'+ to 15'; 12' x 12' net"],
  ["Huge", "15'+ to 20'; 16' x 16' net"],
  ["Mammoth", "20'+ to 30'; 25' x 25' net"]
];

export const SIEGE_WEAPONS = [
  ["Ballista", "75 gp, 6,000 cn, AC 4, 9 hp, crew 4, 100/200/300, d10+6, 1/2 rounds"],
  ["Catapult, Light", "150 gp, 12,000 cn, AC 4, 18 hp, crew 6, 200/250/300, d8+8, 1/5 rounds"],
  ["Catapult, Heavy", "250 gp, 18,000 cn, AC 0, 27 hp, crew 8, 250/325/400, d10+10, 1/6 rounds"],
  ["Trebuchet", "400 gp, 24,000 cn, AC 0, 36 hp, crew 12, 250/400/500, d12+13, 1/6 rounds"],
  ["Bore", "150 gp, 3,000 cn, AC -4, 50 hp, crew 10, d6+14, 1/2 rounds"],
  ["Ram, Battering", "100 gp, 3,000 cn, AC -4, 50 hp, crew 10, d6+8, 1/2 rounds"]
];

export const SIEGE_EQUIPMENT = [
  ["Belfry", "25 gp per foot, 30' tall, AC 0, AC -8, 75 hp"],
  ["Gallery Shed", "15 gp per foot, 10' x 10' x 20', AC 4, AC -12, 40 hp"],
  ["Hoist", "5 gp per foot, 30' tall, AC 4, 15 hp"],
  ["Ladder", "1 gp per 10', 30' tall, AC 4, 3 hp"],
  ["Mantlet", "2 gp per foot, 8' long, AC 0, AC -4, 16 hp"],
  ["Timber Fort", "4 gp per foot, 8' long, AC 0, AC -8, 32 hp"]
];

export const PASSAGE = [
  ["First class", "1 mile per sp, minimum 35 sp"],
  ["Second class", "5 miles per sp, minimum 10 sp"],
  ["Third class", "20 miles per sp, minimum 2 sp"]
];

// ---------------------------------------------------------------------------
// The five "§" special-effects tables (PDF pp. 80-81).
// ---------------------------------------------------------------------------
export const EFFECTS_BLOWGUN_NET = [
  ["Up to 1 HD", "Save None; Blowgun death; Net entangle"],
  ["1+1 to 3 HD", "Save +1; Blowgun lose 75% hp + paralysis; Net entangle"],
  ["3+1 to 6 HD", "Save +2; Blowgun lose 50% hp + paralysis; Net slow"],
  ["6+1 to 9 HD", "Save +3; Blowgun lose 50% hp; Net slow"],
  ["9+1 to 12 HD", "Save +4; Blowgun lose 25% hp; Net delay"],
  ["12+1 to 16 HD", "Save +5; Blowgun lose 25% hp; Net delay"],
  ["16+1 HD", "Save +5; Blowgun lose 10% hp; Net delay"]
];

export const EFFECTS_BLACKJACK = [
  ["Up to 1 HD", "Save None; knockout at all mastery levels"],
  ["1+1 to 3 HD", "Save +1; knockout at all mastery levels"],
  ["3+1 to 6 HD", "Save +2; Basic/Skilled stun, Expert/GM knockout"],
  ["6+1 to 9 HD", "Save +3; Basic/Skilled stun, Expert stun, GM knockout"],
  ["9+1 to 12 HD", "Save +4; Basic/Skilled delay, Expert stun, GM stun"],
  ["12+1 to 16 HD", "Save +5; Basic/Skilled delay, Expert delay, GM stun"],
  ["16+1 HD", "Save +5; delay at all mastery levels"]
];

export const EFFECTS_BOLA_WHIP = [
  ["Up to 1 HD", "Save None; entangle at all mastery levels"],
  ["1+1 to 3 HD", "Save +1; entangle at all mastery levels"],
  ["3+1 to 6 HD", "Save +2; Basic/Skilled slow, Expert/GM entangle"],
  ["6+1 to 9 HD", "Save +3; Basic/Skilled slow, Expert slow, GM entangle"],
  ["9+1 to 12 HD", "Save +4; Basic/Skilled delay, Expert slow, GM slow"],
  ["12+1 to 16 HD", "Save +5; Basic/Skilled delay, Expert delay, GM slow"],
  ["16+1 HD", "Save +5; delay at all mastery levels"]
];

// ---------------------------------------------------------------------------
// Compact level-by-level mastery reference, grouped by weapon.
// Each level string: damage; defense; special effect (and range if relevant).
// ---------------------------------------------------------------------------
export const MASTERY_REFERENCE = [
  {
    group: "Hand-held weapons",
    weapons: [
      ["Blackjack", "1d2; § knockout", "2d2; § knockout (save -1)", "1d4+1; § knockout (save -2)", "P 1d4+3 / S 1d6+1; § knockout (save -3)", "P 1d4+5 / S 1d6+2; § knockout (save -4)"],
      ["Cestus", "1d3; no off-hand penalty", "1d4+1; no off-hand penalty", "2d4; no off-hand penalty", "P 2d4 / S 1d4+3; no off-hand penalty", "P 3d4 / S 2d4+3; no off-hand penalty"],
      ["Club or Torch", "1d8; M -2AC/2; delay", "1d8+2; M -3AC/2; delay", "1d8+4; M -3AC/3; delay + stun", "P 1d8+8 / S 1d8+6; M -4AC/4; delay + stun", "P 1d10+10 / S 1d8+8; M -5AC/4; delay + stun"],
      ["Halberd", "1d10", "1d10+2; H -1AC/1; hook (save +1) + disarm", "1d10+5; H -2AC/1; hook (save -2) + disarm", "P 1d8+10 / S 1d6+15; H -2AC/2; deflect (1) + disarm", "P 1d10+14 / S 1d6+12; H -3AC/2; hook (save -4) + disarm"],
      ["Hammer, War", "1d6", "1d6+2; H -1AC/1; second attack + breaks", "1d8+2; H -2AC/2; second attack + breaks", "P 1d8+5 / S 1d4+5; H -3AC/2; second attack + breaks", "P 1d8+7 / S 1d6+4; H -3AC/2; second attack + breaks"],
      ["Lance", "1d10; A -2AC; charge", "1d10+3; M -2AC/1; charge", "1d10+7; M -3AC/1; charge", "P 1d8+12 / S 1d6+5; M -3AC/2; charge", "P 1d8+16 / S 1d6+12; M -4AC/2; charge"],
      ["Mace", "1d6", "2d4; H -1AC/1; deflect (1)", "2d4+2; H -2AC/2; deflect (1)", "2d4+4; H -3AC/3; deflect (2)", "2d4+6; H -4AC/4; deflect (2)"],
      ["Pike", "1d10; A -1AC/2; deflect (1)", "1d12+2; H -2AC/1; deflect (1)", "1d12+5; H -2AC/2; deflect (3)", "P 1d12+9 / S 1d6+4; A -3AC/3; deflect (2)", "P 1d10+14 / S 1d6+7; A -4AC/4; deflect (4)"],
      ["Polearm, Other", "Uses halberd / pike / poleaxe stats", "Uses halberd / pike / poleaxe stats", "2d6+1; stun + deflect (1)", "P 3d6+3 / S 2d8+2; stun + deflect (2)", "P 3d6+6 / S 3d6+2; stun + deflect (3)"],
      ["Poleaxe", "1d10", "1d10+3; H -1AC/1; deflect (1)", "1d10+6; H -2AC/1; deflect (2)", "P 1d8+10 / S 3d6+2; H -2AC/2; deflect (2)", "P 1d8+16 / S 1d10+8; H -3AC/2; deflect (2)"],
      ["Shield, Horned", "1d2; A -1AC/1; second attack", "2d2; A -1AC/1; second attack", "1d4+1; A -1AC/2; second attack", "P 1d4+3 / S 1d6+1; A -1AC/4; second attack", "P 1d4+5 / S 1d6+2; A -1AC/6; second attack"],
      ["Shield, Knife", "1d4+1; A -1AC; second attack + breaks", "1d6+1; A -1AC; second attack + breaks", "2d4+1; A -2AC; second attack + breaks", "P 3d4 / S 2d4+2; A -2AC; second attack + breaks", "P 4d4 / S 3d4+1; A -2AC; second attack + breaks"],
      ["Shield, Sword", "1d4+2; A -1AC/2; second attack + breaks", "1d6+3; A -1AC/2; second attack + breaks", "1d6+4; A -2AC/3; second attack + breaks", "P 1d6+7 / S 1d4+7; A -2AC/3; second attack + breaks", "P 1d6+9 / S 1d4+9; A -3AC/4; second attack + breaks"],
      ["Shield, Tusked", "1d4+1; A -1AC; two attacks + breaks", "1d6+2; A -2AC; two attacks + breaks", "2d4+2; A -2AC; two attacks + breaks", "P 2d4+4 / S 2d4+1; A -3AC; two attacks + breaks", "P 2d4+6 / S 3d4+1; A -3AC; two attacks + breaks"],
      ["Staff", "1d6", "1d8+2; H -1AC/1; deflect (1)", "1d8+5; H -2AC/2; deflect (1)", "P 1d8+8 / S 1d6+7; H -2AC/3; deflect (2)", "P 1d8+10 / S 1d6+8; H -3AC/2; deflect (3)"],
      ["Sword, Bastard (1H)", "1d6+1; A -1AC/2; second attack", "1d6+3; H -1AC/1; deflect (1)", "1d8+5; H -2AC/2; deflect (1)", "P 1d10+8 / S 1d6+7; H -2AC/2; deflect (2)", "P 1d10+8 / S 1d6+7; H -2AC/3; deflect (2)"],
      ["Sword, Bastard (2H)", "1d8+1; H -1AC/1; deflect (1)", "1d8+3; H -2AC/2; deflect (1)", "1d8+5; H -2AC/2; deflect (1)", "P 1d10+8 / S 1d8+8; H -2AC/2; deflect (2)", "P 1d10+10 / S 1d10+8; H -3AC/2; deflect (3)"],
      ["Sword, Normal", "1d8; H -1AC/1; deflect (1)", "1d12; H -2AC/1; deflect (1) + disarm", "2d8; H -2AC/2; deflect (2) + disarm", "P 2d8+4 / S 2d6+4; H -3AC/3; deflect (2) + disarm", "P 2d6+8 / S 1d8+8; H -3AC/3; deflect (3) + disarm"],
      ["Sword, Short", "1d6; H -1AC/1; deflect (1) + disarm", "1d6+2; H -2AC/2; deflect (2) + disarm", "1d6+4; H -2AC/2; deflect (2) + disarm", "P 1d6+7 / S 1d4+7; H -2AC/3; deflect (3) + disarm", "P 1d6+9 / S 1d4+9; H -3AC/4; deflect (3) + disarm"],
      ["Sword, Two-Handed", "2d8; H -1AC/1; deflect (1)", "2d8+2; H -2AC/2; deflect (1)", "2d8+4; H -2AC/2; deflect (2)", "P 2d8+6 / S 1d10+8; H -3AC/2; deflect (2)", "P 1d12+10 / S 1d10+8; H -3AC/2; deflect (3)"],
      ["Whip", "1d2; M -2AC/2; § entangle", "1d4; M -3AC/3; § entangle (save -1)", "1d4+1; M -3AC/3; § entangle (save -2)", "P 1d4+3 / S 1d3+2; M -4AC/3; § entangle (save -3)", "P 1d4+5 / S 1d3+3; M -4AC/4; § entangle (save -4)"]
    ]
  },
  {
    group: "Hand-held weapons rarely thrown",
    weapons: [
      ["Axe, Battle", "1d8", "1d8+2, range -/5/10", "1d8+4, range -/5/10", "P 1d8+8 / S 1d8+6, range 5/10/15", "P 1d10+10 / S 1d8+8, range 5/10/15"],
      ["Club or Torch", "1d4", "1d6+1, range -/15/25", "1d8+2, range -/15/25", "P 1d6+5 / S 1d4+5, range 10/25/40", "P 1d6+6 / S 1d4+6, range 10/25/40"]
    ]
  },
  {
    group: "Hand-held weapons easily thrown",
    weapons: [
      ["Axe, Hand", "1d6, 10/20/30", "1d6+2, 15/25/35; M -1AC/1", "1d6+3, 25/35/45; M -2AC/2", "P 2d4+4 / S 1d6+4, 30/40/50; M -3AC/3", "P 2d4+7 / S 1d6+4, 40/50/60; M -3AC/3"],
      ["Dagger", "1d4, 10/20/30", "1d6, 15/25/35; H -1AC/1; double damage (20)", "2d4, 20/30/45; H -2AC/2; double damage (19-20)", "P 3d4 / S 2d4+2, 25/35/50; H -2AC/2; double damage (18-20)", "P 4d4 / S 3d4+1, 30/40/50; H -3AC/3; double damage (17-20)"],
      ["Hammer, Throwing", "1d4, 10/20/30", "1d4+2, 10/20/30; stun (s/m)", "1d6+2, 20/30/45; M -2AC/3; stun (s/m)", "P 1d6+4 / S 1d4+4, 20/30/45; M -3AC/4; stun (s/m)", "S 1d6+6, 20/30/45; M -4AC/5; stun (s/m)"],
      ["Javelin", "1d6, 30/60/90", "1d6+2, 30/60/90; H -1AC/1; delay (s/m)", "1d6+4, 40/80/120; H -2AC/2; delay (s/m)", "P 1d6+6 / S 1d10+6, 40/80/120; H -3AC/3; delay (s/m)", "P 1d6+9 / S 1d10+6, 50/100/150; H -4AC/4; delay (s/m)"],
      ["Spear", "1d6, 20/40/60; set", "1d6+2, 20/40/60; set", "2d4+2, 40/60/75; set + stun", "2d4+4, 40/60/75; M -3AC/2; set + stun", "2d4+6, 60/75/90; M -3AC/3; set + stun"],
      ["Trident", "1d6, 10/20/30", "1d8+1, 10/20/30; skewer up to 4 HD", "1d8+4, 20/30/45; skewer up to 7 HD", "P 1d8+6 / S 2d4+5, 20/30/45; skewer up to 10 HD", "P 1d8+7 / S 1d6+6, 25/35/50; skewer up to 15 HD"]
    ]
  },
  {
    group: "Missile weapons",
    weapons: [
      ["Blowgun, up to 2'", "Nil, 10/20/30; § by poison", "Nil, 15/20/30; § by poison (save -1)", "Nil, 15/25/35; § by poison (save -2)", "Nil, 20/25/35; § by poison (save -3)", "Nil, 25/30/40; § by poison (save -4)"],
      ["Blowgun, over 2'", "Nil, 20/25/30; § by poison", "Nil, 20/25/30; § by poison (save -1)", "Nil, 25/30/40; § by poison (save -2)", "Nil, 30/35/40; § by poison (save -3)", "Nil, 25/30/40; § by poison (save -4)"],
      ["Bola", "1d2, 20/40/60; strangle (20)", "1d3, 25/40/60; H -1AC/1; strangle (20) (save -1)", "1d3+1, 30/50/70; H -2AC/2; strangle (19-20) (save -2)", "S 3d4+1, 35/50/70; H -3AC/3; strangle (18-20)", "P 4d4 / S 3d4+1, 30/50/60; H -3AC/3; strangle (17-20)"],
      ["Bow, Long", "1d6, 70/140/210", "1d8+1, 90/150/220; H -1AC/1; delay (s/m)", "1d10+2, 110/170/230; H -2AC/1; delay (s/m)", "S 1d4+6, 110/170/230; H -3AC/2; delay (s/m)", "P 1d6+6 / S 1d6+6, 130/190/250; M -4AC/5; delay (s/m)"],
      ["Bow, Short", "1d6, 50/100/150", "1d6+2, 60/110/160; H -1AC/1; delay (s)", "1d6+4, 80/130/170; H -1AC/2; delay (s)", "P 1d6+7 / S 1d4+8, 90/130/180; H -2AC/2; delay (s)", "P 1d6+9 / S 1d4+8, 110/140/190; H -2AC/2; delay (s)"],
      ["Crossbow, Heavy", "2d4, 80/160/240", "2d6, 90/160/240; M -1AC/1; stun (s/m)", "2d6+2, 100/170/240; M -2AC/2; stun (s/m)", "P 1d8+6 / S 1d4+6, 75/130/180; M -2AC/3; stun (s)", "P 1d8+6 / S 1d6+7, 75/130/180; M -2AC/3; stun (s)"],
      ["Crossbow, Light", "1d6, 60/120/180", "1d6+2, 60/120/180; M -1AC/1; stun (s)", "1d6+4, 75/130/180; M -2AC/2; stun (s)", "P 1d8+6 / S 1d4+6, 75/130/180; M -2AC/3; stun (s)", "P 1d8+6 / S 1d6+7, 75/130/180; M -2AC/3; stun (s)"],
      ["Net", "Nil, 10/20/30; § entangle", "Nil, 15/25/35; A -2AC/1; entangle (save -1)", "Nil, 20/30/40; A -4AC/2; entangle (save -2)", "Nil, 25/35/45; A -6AC/3; entangle (save -4)", "Nil, 30/40/50; A -8AC/4; entangle (save -6)"],
      ["Sling", "1d4, 40/80/160", "1d6, 40/80/160; H -1AC/2; stun (s/m)", "2d4, 60/110/170; H -2AC/3; stun (s/m)", "P 3d4 / S 1d8+2, 60/110/170; H -3AC/3; stun (s/m)", "P 4d4 / S 1d10+2, 80/130/180; H -4AC/4; stun (s/m)"],
      ["Stone, Thrown", "1d3, 10/30/50; stun (s)", "Stone 1d3, 10/30/50; stun (s)", "1d6+2, 10/30/50; ignite", "P 1d8+6, 75/130/180; stun (s)", "P 1d8+6 / S 1d6+7, 75/130/180; stun (s)"],
      ["Holy Water", "1d8, 10/30/50; ignite", "1d8, 10/30/50; stun (s)", "1d8+4, 10/30/50; stun (s)", "P 1d8+6, 75/130/180; stun (s)", "P 1d8+6 / S 1d6+7, 75/130/180; stun (s)"]
    ]
  }
];

// ---------------------------------------------------------------------------
// Journal reference pages.
// ---------------------------------------------------------------------------
const p = (content) => ({ name: "Reference", type: "text", text: { content } });
const table = (headers, rows) =>
  `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>` +
  rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("") +
  "</tbody></table>";

export const MASTERY_JOURNAL = {
  name: "Weapon Mastery (Optional)",
  flags: { becmi: { source: "Rules Cyclopedia", category: "Optional Rules", page: 75 } },
  pages: [
    {
      ...p(`<h2>Weapon Mastery (Optional)</h2>
<p>Weapon mastery lets a character study one weapon in depth, or several weapons less intensely. It is optional: the DM decides whether to use it. All characters, not only fighters, can learn it.</p>
<p>With these rules a human starts with no weapon skill and receives <strong>weapon choices</strong>. Demihumans start with Basic skill in all weapons allowed to their class, but do not gain weapon choices; they improve through training at levels 4, 8 and 12 (dwarves) and after maximum level.</p>
<p>A weapon choice buys one weapon used in one fashion. A bastard sword used one-handed and the same sword used two-handed are two separate choices. The net is a single exception.</p>
<p><em>Short paraphrase of Rules Cyclopedia, Chapter 5. The full text remains in the source PDF.</em></p>`),
      name: "Overview"
    },
    {
      ...p(`<h2>Weapon Choices and Training</h2>
<h3>Weapon choices by experience level</h3>
${table(["Level", "Choices"], MASTERY_CHOICES)}
<h3>Levels of mastery</h3>
${table(["Weapon choices spent", "Level"], MASTERY_LEVELS)}
<h3>Training time and cost</h3>
${table(["Mastery sought", "Time and cost"], TRAINING_COSTS)}
<h3>Chance of training success</h3>
${table(["Student knowledge", "Chance by trainer knowledge"], TRAINING_SUCCESS)}
<p>Success is checked halfway through training. A failed student may continue with the same teacher, or stop and get a half refund; a second attempt with a different teacher gains +10%. Training can only advance one rank at a time.</p>`),
      name: "Choices and Training"
    },
    {
      ...p(`<h2>Benefits of Weapon Mastery</h2>
<h3>Attack roll bonuses</h3>
${table(["Mastery", "Bonus vs. primary", "Bonus vs. secondary"], [
  ["Unskilled", "None", "None"], ["Basic", "None", "None"], ["Skilled", "+2", "+1"],
  ["Expert", "+4", "+2"], ["Master", "+6", "+4"], ["Grand Master", "+8", "+6"]
])}
<h3>Despair effect</h3>
${table(["Mastery", "HD or levels affected"], DESPAIR_EFFECT)}
<h3>Monster mastery limits</h3>
${table(["Intelligence", "Maximum mastery"], MONSTER_MASTERY_LIMITS)}
<p>Primary (P) targets are missile-fire or natural weapons (M); secondary (S) targets use hand-held or thrown weapons (H). Some weapons are [P=A] and work equally against all targets. Ranged weapons improve at Skilled and better; some melee weapons can be thrown at Expert or better. AC bonuses apply to a limited number of attacks per round as shown in the mastery table.</p>
<p><strong>Unskilled:**</strong> half damage, and -1 to attack with missile weapons.</p>`),
      name: "Benefits"
    },
    {
      ...p(`<h2>Weapon Mastery Table - Hand-Held Weapons</h2>
<p>Compact level-by-level reference: Basic / Skilled / Expert / Master / Grand Master. P = primary target, S = secondary target, H = hand-held attacker, M = missile or monster attacker, A = all. "§" refers to the special-effects tables.</p>
${MASTERY_REFERENCE.filter((g) => g.group !== "Missile weapons" && g.group !== "Hand-held weapons easily thrown")
  .map((g) => `<h3>${g.group}</h3>` + table(["Weapon", "BS", "SK", "EX", "MS", "GM"],
    g.weapons.map(([name, ...levels]) => [name, ...levels]))).join("")}
<p><em>Condensed from the scanned table on PDF page 78; check the original for exact cell alignment.</em></p>`),
      name: "Mastery - Hand-Held"
    },
    {
      ...p(`<h2>Weapon Mastery Table - Thrown and Missile Weapons</h2>
<p>Compact level-by-level reference: Basic / Skilled / Expert / Master / Grand Master. Ranges are listed in feet indoors and yards outdoors.</p>
${MASTERY_REFERENCE.filter((g) => g.group === "Missile weapons" || g.group === "Hand-held weapons easily thrown")
  .map((g) => `<h3>${g.group}</h3>` + table(["Weapon", "BS", "SK", "EX", "MS", "GM"],
    g.weapons.map(([name, ...levels]) => [name, ...levels]))).join("")}
<p><em>Condensed from the scanned table on PDF page 79; check the original for exact cell alignment.</em></p>`),
      name: "Mastery - Missile"
    },
    {
      ...p(`<h2>Special Effects and Two-Weapon Penalties</h2>
<h3>Blowgun and net</h3>
${table(["Victim HD", "Effect on failed save"], EFFECTS_BLOWGUN_NET)}
<h3>Blackjack</h3>
${table(["Victim HD", "Effect on failed save"], EFFECTS_BLACKJACK)}
<h3>Bola and whip</h3>
${table(["Victim HD", "Effect on failed save"], EFFECTS_BOLA_WHIP)}
<h3>Weapon mastery penalties with two weapons</h3>
${table(["Case", "Result"], WEAPON_PENALTIES)}
<p>With the optional Two Weapons Combat rule, the second attack is at -4 to hit and is treated as one mastery level lower. A Basic second weapon stays Basic; an Unskilled weapon cannot be used as the second attack. Cestus, horned shield, knife shield and sword shield ignore the off-hand penalty; the tusked shield allows two attacks with no off-hand penalty. All optional sources together can add at most +1 attack per round.</p>`),
      name: "Effects and Penalties"
    }
  ]
};
