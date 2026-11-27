/**
 * Foundry-facing encounter procedures from Rules Cyclopedia chapter 7.
 *
 * The pure rules live in rules-rc.mjs; this module only rolls dice, looks up
 * RollTable documents and posts the results to chat.
 */
import {
  encounterChance, encounterDistance, evasionChance, pursuitRound, reactionBand,
  reactionStep, surpriseCheck, wanderingMonsterDistance
} from "./rules-rc.mjs";

const REACTION_TABLE_NAME = "Monster Reactions (2d6)";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function plainText(value) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function roll(formula) {
  return new Roll(formula).evaluate();
}

async function allTables() {
  const tables = new Map();
  for (const table of game.tables ?? []) tables.set(table.name, table);
  const pack = game.packs?.get("becmi.tables");
  if (pack?.getDocuments) {
    for (const table of await pack.getDocuments()) {
      if (!tables.has(table.name)) tables.set(table.name, table);
    }
  }
  return tables;
}

/** Table options used by the DM encounter panel. */
export async function availableTables() {
  const tables = await allTables();
  return [...tables.values()]
    .filter((table) => table?.name)
    .map((table) => ({ name: table.name, uuid: table.uuid, formula: table.formula ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
}

async function tableByName(nameOrUuid) {
  if (!nameOrUuid) return null;
  const tables = await allTables();
  if (tables.has(nameOrUuid)) return tables.get(nameOrUuid);
  for (const table of tables.values()) {
    if (table.uuid === nameOrUuid) return table;
  }
  return globalThis.fromUuid?.(nameOrUuid) ?? null;
}

async function postCard(actor, { title, lines, roll: rollDoc, rollMode }) {
  const content = `<div class="becmi-roll-card becmi-encounter-card">`
    + `<h3 class="becmi-roll-card__title">${escapeHtml(title)}</h3>`
    + lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")
    + `</div>`;
  const data = {
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: title,
    content,
    rollMode: rollMode ?? game.settings?.get?.("core", "rollMode") ?? "publicroll",
    rolls: rollDoc ? [rollDoc] : []
  };
  await ChatMessage.create(data);
  return content;
}

/** RC p. 92 wandering monster check. */
export async function rollEncounterCheck(actor, input, { rollMode } = {}) {
  const chance = encounterChance(input);
  const dice = await roll(chance.formula);
  const result = {
    ...chance,
    roll: dice.total,
    encounter: dice.total <= chance.threshold
  };
  await postCard(actor, {
    title: game.i18n.localize("BECMI.encounter.check"),
    roll: dice,
    rollMode,
    lines: [
      game.i18n.format("BECMI.encounter.checkDetail", {
        formula: chance.formula,
        target: chance.target,
        frequency: chance.frequency
      }),
      game.i18n.format("BECMI.encounter.rollResult", { roll: dice.total }),
      result.encounter
        ? game.i18n.localize("BECMI.encounter.found")
        : game.i18n.localize("BECMI.encounter.notFound"),
      ...(result.note ? [result.note] : [])
    ]
  });
  return result;
}

/** RC pp. 91-93: surprise per side, then initiative unless surprised. */
export async function rollSurprise(actor, { rollMode } = {}) {
  const partyDie = await roll("1d6");
  const monsterDie = await roll("1d6");
  const input = { partyRoll: partyDie.total, monsterRoll: monsterDie.total };
  if (partyDie.total > 2 && monsterDie.total > 2) {
    input.partyInitiativeRoll = (await roll("1d6")).total;
    input.monsterInitiativeRoll = (await roll("1d6")).total;
  }
  const result = surpriseCheck(input);
  const label = game.i18n.localize(`BECMI.encounter.surprise.${result.state}`);
  const initiative = result.initiative.first === "party"
    ? game.i18n.localize("BECMI.encounter.party")
    : result.initiative.first === "monsters"
      ? game.i18n.localize("BECMI.encounter.monsters")
      : game.i18n.localize("BECMI.encounter.tie");
  await postCard(actor, {
    title: game.i18n.localize("BECMI.encounter.surpriseCheck"),
    roll: partyDie,
    rollMode,
    lines: [
      game.i18n.format("BECMI.encounter.surpriseDetail", {
        party: partyDie.total,
        monsters: monsterDie.total
      }),
      label,
      result.lostRound
        ? game.i18n.localize("BECMI.encounter.lostRound")
        : result.freeRound
          ? game.i18n.localize("BECMI.encounter.freeRound")
          : game.i18n.localize("BECMI.encounter.noAdvantage"),
      result.initiative.automatic
        ? game.i18n.format("BECMI.encounter.initiativeAutomatic", { side: initiative })
        : game.i18n.format("BECMI.encounter.initiativeRolled", {
          party: result.initiative.partyRoll,
          monsters: result.initiative.monsterRoll,
          side: initiative
        })
    ]
  });
  return result;
}

/** RC pp. 92-93: encounter distance, including the surprise override. */
export async function rollEncounterDistance(actor, input, { rollMode } = {}) {
  const info = encounterDistance(input);
  const dice = info.formula ? await roll(info.formula) : null;
  if (dice) {
    info.roll = dice.total;
    info.distance = dice.total * 10;
    if (info.surprisedDistance !== null) info.surprisedDistance = info.distance / 2;
  }
  await postCard(actor, {
    title: game.i18n.localize("BECMI.encounter.distance"),
    roll: dice,
    rollMode,
    lines: [
      game.i18n.format("BECMI.encounter.distanceDetail", {
        distance: info.distance,
        unit: info.unit
      }),
      ...(info.surprisedDistance !== null
        ? [game.i18n.format("BECMI.encounter.surprisedDistance", { distance: info.surprisedDistance })]
        : [])
    ]
  });
  return info;
}

/** RC p. 91: wandering monsters are detected at 2d6 x 10 ft. */
export async function rollWanderingDistance(actor, { rollMode } = {}) {
  const dice = await roll("2d6");
  const info = wanderingMonsterDistance({ roll: dice.total });
  await postCard(actor, {
    title: game.i18n.localize("BECMI.encounter.wanderingDistance"),
    roll: dice,
    rollMode,
    lines: [game.i18n.format("BECMI.encounter.distanceDetail", {
      distance: info.distance,
      unit: info.unit
    })]
  });
  return info;
}

/**
 * RC p. 93 reaction roll. The BECMI Tables RollTable supplies the 2d6 result
 * and its text; the pure RC helper applies Charisma, actions and rerolls.
 */
export async function rollReaction(actor, state, input, { rollMode } = {}) {
  const table = await tableByName(input?.table ?? REACTION_TABLE_NAME);
  let dice;
  let tableText = "";
  let source = table?.name ?? "";
  if (table?.draw) {
    const options = {
      displayChat: false,
      recursive: false,
      rollMode: rollMode ?? game.settings?.get?.("core", "rollMode") ?? "publicroll"
    };
    const draw = await table.draw(options);
    dice = draw?.roll;
    tableText = plainText(draw?.results?.[0]?.text ?? "");
    if (!Number.isFinite(dice?.total)) dice = null;
  }
  if (!dice) dice = await roll("2d6");
  if (!tableText) tableText = reactionBand(dice.total).label;

  const result = reactionStep({
    roll: dice.total,
    attempt: state?.attempt ?? 1,
    charisma: input?.charisma,
    action: input?.action,
    pendingModifier: state?.pendingModifier ?? 0
  });
  const nextState = result.state;
  await postCard(actor, {
    title: game.i18n.localize("BECMI.rolls.reaction"),
    roll: dice,
    rollMode,
    lines: [
      game.i18n.format("BECMI.encounter.reactionDetail", {
        attempt: result.attempt,
        raw: result.raw,
        modifier: result.modifier
      }),
      tableText,
      result.forcedOutcome
        ? game.i18n.localize("BECMI.encounter.reactionForced")
        : result.reroll
          ? game.i18n.format("BECMI.encounter.reactionReroll", { modifier: nextState.pendingModifier })
          : game.i18n.localize("BECMI.encounter.reactionDone"),
      ...(source ? [game.i18n.format("BECMI.encounter.tableSource", { table: source })] : [])
    ]
  });
  return { ...result, tableText, source, state: nextState };
}

/** Draw any encounter or reaction table by name/uuid without duplicating chat. */
export async function drawEncounterTable(actor, nameOrUuid, { rollMode } = {}) {
  const table = await tableByName(nameOrUuid);
  if (!table?.draw) {
    ui.notifications.warn(game.i18n.localize("BECMI.notification.tableMissing"));
    return null;
  }
  const options = {
    displayChat: false,
    recursive: false,
    rollMode: rollMode ?? game.settings?.get?.("core", "rollMode") ?? "publicroll"
  };
  const draw = await table.draw(options);
  const results = (draw?.results ?? []).map((result) => plainText(result.text));
  await postCard(actor, {
    title: table.name,
    roll: draw?.roll,
    rollMode,
    lines: results.length ? results : [game.i18n.localize("BECMI.encounter.emptyTable")]
  });
  return { table, results, roll: draw?.roll };
}

/** RC p. 99 evasion attempt with terrain/speed/scout adjustments. */
export async function rollEvasion(actor, input, { rollMode } = {}) {
  const chance = evasionChance(input);
  const dice = await roll("1d100");
  const success = dice.total <= chance.chance;
  await postCard(actor, {
    title: game.i18n.localize("BECMI.encounter.evasion"),
    roll: dice,
    rollMode,
    lines: [
      game.i18n.format("BECMI.encounter.evasionChance", {
        party: chance.partyBand,
        monsters: chance.monsterBand,
        base: chance.base,
        adjustment: chance.totalAdjustment,
        chance: chance.chance
      }),
      game.i18n.format("BECMI.encounter.rollResult", { roll: dice.total }),
      success
        ? game.i18n.localize("BECMI.encounter.evasionSuccess")
        : game.i18n.localize("BECMI.encounter.evasionFailure")
    ]
  });
  return { ...chance, roll: dice.total, success };
}

/** RC p. 99: each chase round uses 1d6 initiative per side and periodic morale. */
export async function rollPursuitRound(actor, input = {}, { rollMode } = {}) {
  const partyDie = await roll("1d6");
  const monsterDie = await roll("1d6");
  const result = pursuitRound({
    ...input,
    partyRoll: partyDie.total,
    monsterRoll: monsterDie.total
  });
  const side = result.first === "party"
    ? game.i18n.localize("BECMI.encounter.party")
    : result.first === "monsters"
      ? game.i18n.localize("BECMI.encounter.monsters")
      : game.i18n.localize("BECMI.encounter.tie");
  await postCard(actor, {
    title: game.i18n.localize("BECMI.encounter.pursuit"),
    roll: partyDie,
    rollMode,
    lines: [
      game.i18n.format("BECMI.encounter.pursuitDetail", {
        round: result.round,
        party: partyDie.total,
        monsters: monsterDie.total
      }),
      game.i18n.format("BECMI.encounter.pursuitFirst", { side }),
      result.moraleCheckDue
        ? game.i18n.localize("BECMI.encounter.moraleCheckDue")
        : game.i18n.localize("BECMI.encounter.moraleCheckLater")
    ]
  });
  return result;
}
