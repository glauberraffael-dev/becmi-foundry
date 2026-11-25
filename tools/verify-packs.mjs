/**
 * Read compiled LevelDB packs and report document/embedded-key counts.
 * Workaround for the `fvtt package unpack` iterator error on this machine.
 *
 * Usage: node tools/verify-packs.mjs [pack ...]
 */
import { ClassicLevel } from "classic-level";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
  console.log(`${pack}: ${docs.length} documents, ${embedded.length} embedded keys`);

  if (pack === "tables") {
    const names = ["Weapons (Basic Stats)", "Weapon Choices by Experience Level",
      "Weapon Mastery Lookup", "Chance of Training Success"];
    for (const name of names) {
      const table = docs.find((doc) => doc.name === name);
      const results = table
        ? embedded.filter(([key]) => key.startsWith(`!tables.results!${table._id}.`)).length
        : 0;
      console.log(`  ${name}: ${results} results`);
    }
  }

  if (pack === "journals") {
    const mastery = docs.find((doc) => doc.name === "Weapon Mastery (Optional)");
    const pageNames = (mastery?.pages ?? []).map((id) =>
      embedded.find(([key]) => key === `!journal.pages!${mastery._id}.${id}`)?.[1]?.name ??
      `<missing ${id}>`
    );
    console.log(`  mastery pages: ${pageNames.length} (${pageNames.join(", ")})`);
  }

  await db.close();
}
