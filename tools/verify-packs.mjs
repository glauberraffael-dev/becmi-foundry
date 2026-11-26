/**
 * Read compiled LevelDB packs and report document/embedded-key counts.
 * Workaround for the `fvtt package unpack` iterator error on this machine.
 *
 * Usage: node tools/verify-packs.mjs [pack ...]
 */
import { ClassicLevel } from "classic-level";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ENCOUNTER_TABLES, REACTION_TABLE } from "./encounter-tables.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const packs = process.argv.slice(2).length ? process.argv.slice(2) : ["tables", "journals"];

for (const pack of packs) {
  const db = new ClassicLevel(join(root, "packs", pack), {
    keyEncoding: "utf8",
    valueEncoding: "json"
  });
  await db.open();
  const docs = [];
  const embedded = [];
  for await (const [key, value] of db.iterator()) {
    if (key.startsWith("!tables!") || key.startsWith("!journal!") ||
        key.startsWith("!items!") || key.startsWith("!actors!")) docs.push(value);
    else embedded.push([key, value]);
  }
  const folders = embedded.filter(([key]) => key.startsWith("!folders!")).map(([, value]) => value.name);
  console.log(`${pack}: ${docs.length} documents, ${embedded.length} embedded keys${folders.length ? `, folders: ${folders.join(", ")}` : ""}`);

  if (!docs.length) throw new Error(`${pack}: compiled pack has no documents`);
  // The Foundry CLI stores the key in the LevelDB key, not in the document.
  if (docs.some((doc) => !doc._id || !doc.name)) {
    throw new Error(`${pack}: compiled document without _id or name`);
  }
  if (["monsters", "spells", "equipment", "classes", "treasure"].includes(pack) && !folders.length) {
    throw new Error(`${pack}: compiled pack has no folders`);
  }

  if (pack === "monsters") {
    const categories = ["Normal Animal", "Lowlife", "Construct", "Dragon", "Humanoid", "Monster", "Planar Monster", "Undead", "Unclassified"];
    const folderNames = ["Normal Animals", "Lowlife", "Constructs", "Dragons", "Humanoids", "Monsters", "Planar Monsters", "Undead", "Unclassified"];
    for (let i = 0; i < categories.length; i++) {
      if (!folders.includes(folderNames[i])) throw new Error(`monsters: missing folder ${folderNames[i]}`);
      if (i < categories.length - 1 && !docs.some((doc) => doc.flags?.becmi?.category === categories[i])) {
        throw new Error(`monsters: no document in ${categories[i]}`);
      }
    }
    for (const doc of docs) {
      if (doc.system?.morale < 2 || doc.system?.morale > 12 || !(doc.system?.xpValue > 0)) {
        throw new Error(`monsters: invalid stats on ${doc.name}`);
      }
    }
  }

  if (pack === "tables") {
    const expected = [REACTION_TABLE, ...ENCOUNTER_TABLES];
    if (docs.length !== expected.length) {
      throw new Error(`tables: expected ${expected.length} documents, found ${docs.length}`);
    }
    for (const wanted of expected) {
      const table = docs.find((doc) => doc.name === wanted.name);
      if (!table) throw new Error(`tables: missing ${wanted.name}`);
      if (table.formula !== wanted.formula) {
        throw new Error(`tables: ${wanted.name} must roll ${wanted.formula}, found ${table.formula}`);
      }
      const results = embedded.filter(([key]) =>
        key.startsWith(`!tables.results!${table._id}.`)).length;
      if (results !== wanted.results.length) {
        throw new Error(`tables: ${wanted.name} expected ${wanted.results.length} results, found ${results}`);
      }
      console.log(`  ${table.name}: ${results} results (${table.formula})`);
    }
    for (const folder of ["Reactions", "Dungeon Encounters", "Wilderness Encounters"]) {
      if (!folders.includes(folder)) throw new Error(`tables: missing folder ${folder}`);
    }
  }

  if (pack === "journals") {
    for (let chapter = 1; chapter <= 19; chapter++) {
      if (!docs.some((doc) => doc.name.startsWith(`Chapter ${chapter}:`))) {
        throw new Error(`journals: missing Chapter ${chapter} in compiled pack`);
      }
    }
    for (let appendix = 1; appendix <= 4; appendix++) {
      if (!docs.some((doc) => doc.name.startsWith(`Appendix ${appendix}:`))) {
        throw new Error(`journals: missing Appendix ${appendix} in compiled pack`);
      }
    }
    const mastery = docs.find((doc) => doc.name === "Weapon Mastery (Optional)");
    const pageNames = (mastery?.pages ?? []).map((id) =>
      embedded.find(([key]) => key === `!journal.pages!${mastery._id}.${id}`)?.[1]?.name ??
      `<missing ${id}>`
    );
    console.log(`  mastery pages: ${pageNames.length} (${pageNames.join(", ")})`);
    const variant = docs.find((doc) => doc.name.startsWith("Chapter 19:"));
    const variantPages = (variant?.pages ?? []).map((id) =>
      embedded.find(([key]) => key === `!journal.pages!${variant._id}.${id}`)?.[1]?.name ??
      `<missing ${id}>`
    );
    console.log(`  chapter 19 pages: ${variantPages.length} (${variantPages.join(", ")})`);
    if (variantPages.length < 3) throw new Error("journals: Chapter 19 progression tables are missing");
    const equipment = docs.find((doc) => doc.name === "Equipment Tables");
    const equipmentPages = (equipment?.pages ?? []).map((id) =>
      embedded.find(([key]) => key === `!journal.pages!${equipment._id}.${id}`)?.[1]?.name ??
      `<missing ${id}>`
    );
    console.log(`  equipment pages: ${equipmentPages.length} (${equipmentPages.join(", ")})`);
    if (equipmentPages.length !== 9) throw new Error("journals: Equipment Tables pages are missing");
    const core = docs.find((doc) => doc.name === "Core Rules Reference");
    if (!core?.pages?.some((id) =>
      embedded.find(([key]) => key === `!journal.pages!${core._id}.${id}`)?.[1]?.name === "Encounters and Reaction Rolls"
    )) throw new Error("journals: random encounter guidance is missing");
  }

  await db.close();
}
