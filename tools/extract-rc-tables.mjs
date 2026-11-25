/**
 * Extract the RC rules tables from the standalone HTML sheet into versionable data.
 *
 * Usage:
 *   BECMI_RC_HTML="C:\path\ficha_becmi_rc_3.html" node tools/extract-rc-tables.mjs
 *
 * The HTML is used only at build time. It is never copied into the system or
 * published; only the derived JSON/JS data files are committed.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const htmlPath = process.env.BECMI_RC_HTML
  ?? "C:\\Users\\Usuário\\Downloads\\ficha_becmi_rc_3.html";
const root = path.resolve(import.meta.dirname, "..");
const html = fs.readFileSync(htmlPath, "utf8");
const script = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));

function extractJsonConst(name) {
  const marker = `const ${name} = `;
  const start = script.indexOf(marker);
  if (start < 0) throw new Error(`Missing const ${name}`);
  let i = start + marker.length;
  while (/\s/.test(script[i])) i++;
  const begin = i;
  const open = script[i];
  if (open !== "[" && open !== "{") throw new Error(`const ${name} is not JSON`);
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (; i < script.length; i++) {
    const ch = script[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === "[" || ch === "{") depth++;
    else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  return JSON.parse(script.slice(begin, i));
}

const DADOS = extractJsonConst("DADOS");
const ARMAS_MAESTRIA = extractJsonConst("ARMAS_MAESTRIA");
const MAGIAS = extractJsonConst("MAGIAS");

const blockStart = script.indexOf("function linear(");
const blockEnd = script.indexOf("/* Banco de magias");
if (blockStart < 0 || blockEnd < 0) throw new Error("Could not locate the rules block");
const sandbox = { ARMAS_MAESTRIA, console };
vm.createContext(sandbox);
vm.runInContext(`${script.slice(blockStart, blockEnd)}
;globalThis.__out = {
  CLASSES, SV_IDS, NOMES_SV, SEQ, ATK_F, ATK_CTD, ATK_MU, RANK_T,
  ESCOLHAS_F, ESCOLHAS_O, ATRIBUTOS, NOMES_ATR, SEGUIDORES, IDIOMAS,
  ARMADURAS, ARM_PESO, PESO_ESCUDO, MOV, MAESTRIA, GRAUS, MV, MV_COLS
};`, sandbox);
const raw = sandbox.__out;

const CLASS_KEYS = {
  guerreiro: "fighter", clerigo: "cleric", ladrao: "thief", mago: "magic-user",
  anao: "dwarf", elfo: "elf", halfling: "halfling"
};

function englishLabel(rotulo) {
  const match = String(rotulo).match(/\(([^)]+)\)\s*$/);
  return match ? match[1] : rotulo;
}

const classes = {};
for (const [key, c] of Object.entries(raw.CLASSES)) {
  const outKey = CLASS_KEYS[key] ?? key;
  classes[outKey] = {
    key: outKey,
    name: englishLabel(c.rotulo),
    namePt: c.nome,
    maxLevel: c.max,
    xp: c.xp,
    hitDie: c.vida?.d ?? 8,
    hpAfterFixed: c.vida?.apos ?? 0,
    primeRequisites: c.primarios ?? [],
    requirements: c.exigencias ?? [],
    saves: { thresholds: c.saves?.ate ?? [], rows: c.saves?.v ?? [] },
    attack: c.atk ?? [],
    attackColumn: c.colAtk ?? "",
    choices: c.escolhas ?? [],
    resources: c.recursos ?? [],
    spells: c.magias ? {
      table: c.magias.tabela,
      list: c.magias.lista === "clerigo" ? "cleric" : c.magias.lista === "mago" ? "magic-user" : c.magias.lista,
      levels: c.magias.niveis
    } : null,
    armor: c.armaduras ?? null,
    ranks: c.ranks ?? [],
    milestones: c.marcos ?? [],
    demiTraining: c.treinoDemi ?? []
  };
}

function normalizeMovement(row) {
  const [limit, turn, round] = row;
  return [limit === null || limit === undefined ? null : Number(limit), Number(turn), Number(round)];
}

const masteryWeapons = ARMAS_MAESTRIA.map((w) => {
  const match = String(w.n).match(/^(.*?)\s*\((.*)\)$/);
  return {
    name: match ? match[2] : w.n,
    namePt: match ? match[1] : w.n,
    primary: w.p,
    cost: w.c,
    weight: w.e,
    canSet: Boolean(w.f),
    hasRange: Boolean(w.a),
    ranks: w.r,
    notes: w.nt ?? ""
  };
});

const spells = MAGIAS.map((m) => ({
  class: m.c === "clerigo" ? "cleric" : m.c === "druida" ? "druid" : "magic-user",
  level: Number(m.l),
  name: m.n,
  namePt: m.p,
  range: m.r ?? "",
  duration: m.d ?? "",
  effect: m.e ?? "",
  reverse: m.rv ?? "",
  save: m.sv ?? ""
}));

const data = {
  meta: {
    format: 1,
    source: "ficha_becmi_rc_3.html",
    note: "Rules reference data extracted at build time. The source HTML is not distributed."
  },
  saveIds: ["deathRay", "magicWand", "paralysis", "breath", "spells"],
  attack: {
    sequence: raw.SEQ,
    anchors: { ...raw.RANK_T },
    bands: { fighter: raw.ATK_F, "cleric/thief": raw.ATK_CTD, "magic-user": raw.ATK_MU }
  },
  ability: {
    keys: ["str", "int", "wis", "dex", "con", "cha"],
    followers: raw.SEGUIDORES,
    illiteracy: raw.IDIOMAS
  },
  classes,
  thief: DADOS.thief,
  spellSlots: { cleric: DADOS.cleric, "magic-user": DADOS.mago },
  turnUndead: {
    columns: raw.MV_COLS,
    rows: raw.MV.map(([name, values]) => ({ name, values: String(values).split(/\s+/) }))
  },
  armor: {
    types: Object.fromEntries(Object.entries(raw.ARMADURAS).map(([k, v]) => [k, { name: v[0], ac: Number(v[1]) }])),
    weights: raw.ARM_PESO,
    shieldWeight: raw.PESO_ESCUDO,
    movement: raw.MOV.map(normalizeMovement)
  },
  mastery: {
    grades: raw.MAESTRIA,
    order: raw.GRAUS,
    weapons: masteryWeapons
  },
  spells
};

const jsonPath = path.join(root, "data", "rc-tables.json");
fs.writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`);

const jsPath = path.join(root, "scripts", "rc-data.mjs");
fs.writeFileSync(jsPath, `/* Generated by tools/extract-rc-tables.mjs — do not edit by hand. */\nexport const RC = ${JSON.stringify(data)};\n`);

console.log(`Wrote ${path.relative(root, jsonPath)} and ${path.relative(root, jsPath)}`);
console.log(`classes: ${Object.keys(classes).length}, spells: ${spells.length}, mastery weapons: ${masteryWeapons.length}, undead: ${raw.MV.length}`);
