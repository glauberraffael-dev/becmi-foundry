/**
 * Turns extracted JSON arrays in /data into one JSON document per file in
 * /source/<pack>, ready for `fvtt package pack`.
 *
 * Usage: node tools/build-packs.mjs
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dataDir = join(root, "data");
const sourceDir = join(root, "source");
const packs = {
  monsters: "Actor",
  spells: "Item",
  equipment: "Item",
  classes: "Item",
  treasure: "Item",
  tables: "RollTable",
  journals: "JournalEntry"
};

// Collection names used by Foundry compendium LevelDB keys (`!collection!id`).
const collections = {
  Actor: "actors",
  Item: "items",
  RollTable: "tables",
  JournalEntry: "journal"
};

const iconFor = {
  monsters: "icons/svg/mystery-man.svg",
  spells: "icons/svg/book.svg",
  equipment: "icons/svg/item-bag.svg",
  classes: "icons/svg/upgrade.svg",
  treasure: "icons/svg/coins.svg",
  tables: "icons/svg/d20-grey.svg",
  journals: "icons/svg/book.svg"
};

function stableId(name) {
  return createHash("sha1").update(name).digest("base64url").slice(0, 16);
}

async function main() {
  const files = (await readdir(dataDir)).filter((f) => f.endsWith(".json"));
  await rm(sourceDir, { recursive: true, force: true });

  for (const file of files) {
    const pack = file.replace(/\.json$/, "");
    if (!(pack in packs)) continue;
    const docs = JSON.parse(await readFile(join(dataDir, file), "utf8"));
    const outDir = join(sourceDir, pack);
    await mkdir(outDir, { recursive: true });

    const seen = new Set();
    let written = 0;
    for (const doc of docs) {
      const name = doc.name || doc.flags?.becmi?.key || `unnamed-${written}`;
      let id = stableId(`${pack}:${name}`);
      if (seen.has(id)) id = stableId(`${pack}:${name}:${written}`);
      seen.add(id);

      const output = {
        _id: id,
        _key: `!${collections[packs[pack]]}!${id}`,
        name,
        type: doc.type ?? (packs[pack] === "Item" ? "equipment" : undefined),
        img: doc.img ?? iconFor[pack],
        system: (() => {
          const system = doc.system ?? {};
          if (pack === "monsters" && Number.isFinite(system.hp)) {
            system.attributes = { hp: { value: system.hp, max: system.hp } };
          }
          return system;
        })(),
        flags: doc.flags ?? {},
        ownership: { default: 0 },
        ...(doc.folder ? { folder: doc.folder } : {}),
        ...(doc.text ? { text: doc.text } : {}),
        ...(doc.pages ? { pages: doc.pages } : {}),
        ...(doc.results ? { results: doc.results } : {}),
        ...(doc.formula ? { formula: doc.formula } : {})
      };

      // Embedded documents (table results, journal pages) are stored in
      // sublevels of the LevelDB pack and need their own keys.
      for (const embeddedName of ["results", "pages"]) {
        if (!Array.isArray(output[embeddedName])) continue;
        output[embeddedName] = output[embeddedName].map((embedded, i) => {
          const embeddedId = stableId(`${pack}:${name}:${embeddedName}:${i}:${embedded.name ?? ""}`);
          return {
            ...embedded,
            _id: embeddedId,
            _key: `!${collections[packs[pack]]}.${embeddedName}!${id}.${embeddedId}`
          };
        });
      }

      const safeName = name.replace(/[^\w\-]+/g, "_").slice(0, 60);
      await writeFile(join(outDir, `${safeName}_${id}.json`), JSON.stringify(output, null, 2));
      written++;
    }
    console.log(`${pack}: ${written} documents -> source/${pack}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
