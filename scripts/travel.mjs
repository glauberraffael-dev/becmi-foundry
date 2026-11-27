/**
 * Foundry-facing travel procedures from Rules Cyclopedia chapter 6.
 *
 * The pure rules live in rules-rc.mjs; this module only rolls dice and posts
 * the results to chat. Travel inputs are transient sheet state and are never
 * written to the Actor.
 */
import {
  aerialMilesPerDay, breathRounds, drowningGraceRounds, drowningTarget, forageCheck,
  lostCheck, movementForLoad, seaWeather, swimMovement, travelFatigue, travelMilesPerDay
} from "./rules-rc.mjs";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

async function roll(formula) {
  return new Roll(formula).evaluate();
}

async function postCard(actor, { title, lines, roll: rollDoc, rollMode }) {
  const content = `<div class="becmi-roll-card becmi-travel-card">`
    + `<h3 class="becmi-roll-card__title">${escapeHtml(title)}</h3>`
    + lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")
    + `</div>`;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: title,
    content,
    rollMode: rollMode ?? game.settings?.get?.("core", "rollMode") ?? "publicroll",
    rolls: rollDoc ? [rollDoc] : []
  });
  return content;
}

const t = (key, data) => data === undefined
  ? game.i18n.localize(key) : game.i18n.format(key, data);

/** RC p. 88: daily distance from the slowest pace and terrain. */
export async function rollTravelDay(actor, input = {}, { rollMode } = {}) {
  const movement = movementForLoad(input.load);
  const travel = travelMilesPerDay(input);
  const fatigue = travelFatigue(input.daysTraveled, input.restDays);
  const days = Math.max(1, Math.round(Number(input.days) || 1));
  await postCard(actor, {
    title: t("BECMI.travel.dayTitle"),
    rollMode,
    lines: [
      t("BECMI.travel.loadDetail", {
        load: movement.load,
        normal: movement.normal,
        encounter: movement.encounter,
        running: movement.running
      }),
      t("BECMI.travel.distanceDetail", {
        mode: travel.label,
        terrain: t(`BECMI.travel.terrain.${travel.terrain}`),
        daily: travel.miles,
        days,
        total: Math.round(travel.miles * days * 100) / 100
      }),
      travel.forage ? t("BECMI.travel.foragingPace") : null,
      fatigue.remainingRestDays > 0
        ? t("BECMI.travel.fatigueDetail", {
          owed: fatigue.remainingRestDays,
          penalty: fatigue.attackPenalty
        })
        : null,
      input.aerial ? t("BECMI.travel.aerialDetail", { miles: aerialMilesPerDay(input.aerial) }) : null
    ].filter(Boolean)
  });
  return { movement, travel, fatigue };
}

/** RC p. 89: 1d6 before movement; roads, rivers and guides are safe. */
export async function rollLostCheck(actor, input = {}, { rollMode } = {}) {
  if (input.road || input.guide) {
    await postCard(actor, {
      title: t("BECMI.travel.lostTitle"),
      rollMode,
      lines: [t("BECMI.travel.lostSkipped")]
    });
    return { checked: false, lost: false };
  }
  const die = await roll("1d6");
  const result = lostCheck({ ...input, roll: die.total });
  await postCard(actor, {
    title: t("BECMI.travel.lostTitle"),
    roll: die,
    rollMode,
    lines: [
      t("BECMI.travel.lostDetail", {
        terrain: t(`BECMI.travel.terrain.${result.terrain}`),
        target: result.target.max
      }),
      t("BECMI.travel.rollResult", { roll: die.total }),
      result.lost ? t("BECMI.travel.lostYes") : t("BECMI.travel.lostNo")
    ]
  });
  return result;
}

/** RC p. 89: foraging at 2/3 pace, 1-3 on 1d6 in good conditions. */
export async function rollForageCheck(actor, input = {}, { rollMode } = {}) {
  const die = await roll("1d6");
  const result = forageCheck({ ...input, roll: die.total });
  await postCard(actor, {
    title: t("BECMI.travel.forageTitle"),
    roll: die,
    rollMode,
    lines: [
      t("BECMI.travel.rollResult", { roll: die.total }),
      result.success ? t("BECMI.travel.forageYes") : t("BECMI.travel.forageNo"),
      t("BECMI.travel.forageNote")
    ]
  });
  return result;
}

/** RC p. 90: 2d6 weather at sea and its movement modifier. */
export async function rollSeaWeather(actor, input = {}, { rollMode } = {}) {
  const dice = await roll("2d6");
  const weather = seaWeather(dice.total);
  const lines = [
    t("BECMI.travel.rollResult", { roll: dice.total }),
    t("BECMI.travel.weatherDetail", {
      name: t(`BECMI.travel.weather.${weather.key}`),
      multiplier: weather.multiplier
    })
  ];
  if (weather.oarsMultiplier !== undefined) {
    lines.push(t("BECMI.travel.weatherOars", { multiplier: weather.oarsMultiplier }));
  }
  if (weather.randomDirection) {
    lines.push(t("BECMI.travel.weatherGale", { chance: weather.sinkingChance }));
    lines.push(t("BECMI.travel.weatherCoast"));
  }
  await postCard(actor, {
    title: t("BECMI.travel.weatherTitle"),
    roll: dice,
    rollMode,
    lines
  });
  return weather;
}

/** RC p. 90: breath held and drowning checks for a swimming character. */
export async function rollSwimCheck(actor, input = {}, { rollMode } = {}) {
  const constitution = Number(input.constitution) || 10;
  const movement = swimMovement(input.outdoorSpeed);
  const held = breathRounds(constitution, Boolean(input.exerting));
  const attempt = Math.max(1, Math.round(Number(input.attempt) || 1));
  const target = drowningTarget(attempt, constitution);
  const lines = [
    t("BECMI.travel.swimDetail", {
      surface: movement.surfaceYardsPerRound,
      underwater: movement.underwaterFeetPerRound
    }),
    t("BECMI.travel.breathDetail", {
      calm: breathRounds(constitution, false),
      exerting: breathRounds(constitution, true)
    }),
    t("BECMI.travel.drowningDetail", { attempt, target, grace: drowningGraceRounds(constitution) })
  ];
  if (input.drowning) {
    const die = await roll("1d20");
    lines.push(t("BECMI.travel.rollResult", { roll: die.total }));
    lines.push(die.total <= target
      ? t("BECMI.travel.drowningSurvive")
      : t("BECMI.travel.drowningFail"));
    await postCard(actor, {
      title: t("BECMI.travel.swimTitle"),
      roll: die,
      rollMode,
      lines
    });
    return { held, target, roll: die.total, survived: die.total <= target };
  }
  await postCard(actor, { title: t("BECMI.travel.swimTitle"), rollMode, lines });
  return { held, target };
}
