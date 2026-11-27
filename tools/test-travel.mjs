/**
 * Foundry-independent tests for Rules Cyclopedia chapter 6 travel rules.
 *
 * Usage: node tools/test-travel.mjs
 */
import assert from "node:assert/strict";
import {
  GAME_TIME_UNITS, MOVEMENT_RATES, TERRAIN_MODIFIERS, TRAVEL_MODES,
  aerialMilesPerDay, breathRounds, drowningGraceRounds, drowningTarget, forageCheck,
  lostCheck, movementForLoad, overlandMilesPerDay, seaWeather, swimMovement,
  travelFatigue, travelMilesPerDay
} from "../scripts/rules-rc.mjs";

const check = (name, fn) => {
  fn();
  console.log(`ok - ${name}`);
};

check("RC time units match the movement chapter", () => {
  assert.deepEqual(GAME_TIME_UNITS, { roundSeconds: 10, turnMinutes: 10, turnsPerDay: 144 });
});

check("character speed bands follow the encumbrance table", () => {
  assert.deepEqual(MOVEMENT_RATES.map((row) => row.max), [400, 800, 1200, 1600, 2400, Infinity]);
  assert.deepEqual(movementForLoad(0), {
    load: 0, band: "none", normal: 120, encounter: 40, running: 120
  });
  assert.equal(movementForLoad(400).band, "none");
  assert.equal(movementForLoad(401).band, "light");
  assert.equal(movementForLoad(800).normal, 90);
  assert.equal(movementForLoad(801).encounter, 20);
  assert.equal(movementForLoad(1200).running, 60);
  assert.equal(movementForLoad(1601).band, "veryHeavy");
  assert.equal(movementForLoad(2401).band, "immobile");
  assert.equal(movementForLoad(2401).normal, 0);
});

check("terrain modifiers use the worst single condition", () => {
  assert.equal(TERRAIN_MODIFIERS.trail, 1.5);
  assert.equal(TERRAIN_MODIFIERS.clear, 1);
  assert.equal(TERRAIN_MODIFIERS.grasslands, 1);
  assert.equal(TERRAIN_MODIFIERS.forest, 2 / 3);
  assert.equal(TERRAIN_MODIFIERS.hills, 2 / 3);
  assert.equal(TERRAIN_MODIFIERS.desert, 2 / 3);
  assert.equal(TERRAIN_MODIFIERS.mountains, 0.5);
  assert.equal(TERRAIN_MODIFIERS.swamp, 0.5);
  assert.equal(TERRAIN_MODIFIERS.ice, 0.5);
});

check("travel rates reproduce the printed daily distances", () => {
  for (const [terrain, miles] of Object.entries({
    clear: 24, trail: 36, hills: 16, mountains: 12, desert: 16
  })) {
    assert.equal(travelMilesPerDay({ mode: "foot", terrain }).miles, miles, terrain);
  }
  assert.equal(travelMilesPerDay({ mode: "footLight", terrain: "clear" }).miles, 12);
  assert.equal(travelMilesPerDay({ mode: "footHeavy", terrain: "desert" }).miles, 6);
  assert.equal(travelMilesPerDay({ mode: "ridingHorse", terrain: "trail" }).miles, 72);
  assert.equal(travelMilesPerDay({ mode: "ox", terrain: "mountains" }).miles, 8);
  assert.equal(travelMilesPerDay({ mode: "foot", forage: true }).miles, 16);
  assert.equal(overlandMilesPerDay(120), 24);
  assert.equal(overlandMilesPerDay(120, "trail"), 36);
});

check("all printed travel modes are exposed to the sheet", () => {
  assert.deepEqual(TRAVEL_MODES.map((entry) => entry.key), [
    "foot", "footLight", "footHeavy", "camel", "elephant", "ridingHorse",
    "donkey", "warHorse", "draftHorse", "ox"
  ]);
  assert.equal(TRAVEL_MODES.length, 10);
});

check("roads, rivers and guides prevent the daily lost check", () => {
  assert.deepEqual(lostCheck({ terrain: "clear", roll: 1, road: true }), {
    terrain: "clear", roll: 1, target: { min: 1, max: 1 },
    formula: "1d6 <= 1", checked: false, lost: false
  });
  assert.equal(lostCheck({ terrain: "desert", roll: 3, guide: true }).lost, false);
});

check("lost targets follow the terrain list", () => {
  assert.equal(lostCheck({ terrain: "clear", roll: 1 }).lost, true);
  assert.equal(lostCheck({ terrain: "clear", roll: 2 }).lost, false);
  assert.equal(lostCheck({ terrain: "grasslands", roll: 1 }).lost, true);
  assert.equal(lostCheck({ terrain: "swamp", roll: 3 }).lost, true);
  assert.equal(lostCheck({ terrain: "jungle", roll: 4 }).lost, false);
  assert.equal(lostCheck({ terrain: "forest", roll: 2 }).lost, true);
  assert.equal(lostCheck({ terrain: "forest", roll: 3 }).lost, false);
});

check("foraging is 1-3 on 1d6 and hunting is automatic in fertile ground", () => {
  assert.equal(forageCheck({ roll: 3 }).success, true);
  assert.equal(forageCheck({ roll: 4 }).success, false);
  assert.equal(forageCheck({ roll: 6, hunting: true, fertile: true }).success, true);
  assert.equal(forageCheck({ roll: 1, hunting: true, fertile: false }).success, true);
});

check("one rest day per six travelled days removes the cumulative penalty", () => {
  assert.deepEqual(travelFatigue(12, 1), {
    owedRestDays: 2, remainingRestDays: 1, attackPenalty: -1, damagePenalty: -1
  });
  assert.deepEqual(travelFatigue(12, 2), {
    owedRestDays: 2, remainingRestDays: 0, attackPenalty: 0, damagePenalty: 0
  });
  assert.equal(travelFatigue(13, 0).attackPenalty, -2);
});

check("swimming uses one fifth of outdoor speed and Constitution breath", () => {
  assert.deepEqual(swimMovement(120), {
    surfaceYardsPerRound: 24, underwaterFeetPerRound: 24
  });
  assert.equal(breathRounds(10), 10);
  assert.equal(breathRounds(10, true), 5);
  assert.equal(drowningTarget(1, 10), 10);
  assert.equal(drowningTarget(3, 10), 8);
  assert.equal(drowningGraceRounds(10), 4);
});

check("sea weather maps every 2d6 result to its printed modifier", () => {
  const expected = {
    2: [0, 1 / 3], 3: [1 / 3, undefined], 4: [1 / 3, undefined],
    5: [2 / 3, undefined], 6: [1, undefined], 8: [1, undefined],
    9: [4 / 3, undefined], 10: [3 / 2, undefined],
    11: [2, undefined], 12: [3, undefined]
  };
  for (const [roll, [multiplier, oars]] of Object.entries(expected)) {
    const weather = seaWeather(Number(roll));
    assert.equal(weather.multiplier, multiplier, `weather ${roll}`);
    assert.equal(weather.oarsMultiplier, oars, `oars ${roll}`);
  }
  assert.equal(seaWeather(12).randomDirection, true);
  assert.equal(seaWeather(12).sinkingChance, 80);
  assert.equal(seaWeather(13).roll, 12);
});

check("aerial mounts and devices use the printed daily distances", () => {
  assert.equal(aerialMilesPerDay("mount"), 72);
  assert.equal(aerialMilesPerDay("device"), 120);
  assert.equal(aerialMilesPerDay(), 72);
});
