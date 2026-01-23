// villagePopulation.js

import { rngInt } from "../../systems/rng.js";

function randInt(min, max) {
  return rngInt(null, min, max, 'population.randInt');
}

export function ensureVillagePopulation(state) {
  if (!state.village) state.village = {};
  if (!state.village.population) {
    state.village.population = {
      size: randInt(900, 1600),
      mood: 0,          // -100..+100, 0 = neutral
      lastDayUpdated: null,
      // Breadcrumb for UI: why did mood change today?
      // { day, delta, reasons: string[] }
      lastMoodChange: null
    };
  }
  return state.village.population;
}

export function adjustPopulation(state, delta) {
  const pop = ensureVillagePopulation(state);
  pop.size = Math.max(0, pop.size + delta);
  return pop;
}

export function adjustPopulationMood(state, delta) {
  const pop = ensureVillagePopulation(state);
  pop.mood = Math.max(-100, Math.min(100, pop.mood + delta));
  return pop;
}

// Optional: daily drift, events, etc.
export function handlePopulationDayTick(state, absoluteDay, hooks = {}) {
  const pop = ensureVillagePopulation(state);

  // Guard against double-running in the same day (e.g., multiple callers advancing time).
  // This mirrors villageEconomy.handleEconomyDayTick so mood drift doesn't apply twice.
  if (pop.lastDayUpdated === absoluteDay) return;
  pop.lastDayUpdated = absoluteDay;

  const reasons = [];
  const before = pop.mood;

  // Example tiny drift back toward neutral mood:
  if (pop.mood > 0) {
    pop.mood -= 1;
    reasons.push('Villager tempers settle toward neutral overnight.');
  } else if (pop.mood < 0) {
    pop.mood += 1;
    reasons.push('Villager tempers settle toward neutral overnight.');
  }

  // Active Town Hall decrees can also push mood a little each day.
  // (This keeps “Festival Week”, curfews, etc. feeling alive after the vote.)
  const eff = state?.government?.townHallEffects;
  // Use the tick day passed in so catch-up loops apply effects correctly.
  const today = typeof absoluteDay === 'number' ? Math.floor(absoluteDay) : 0;
  const isActive =
    eff &&
    eff.petitionId &&
    typeof eff.expiresOnDay === 'number' &&
    today <= eff.expiresOnDay;

  if (isActive) {
    const md = Number(eff.moodDailyDelta);
    const moodDeltaDaily = Number.isFinite(md) ? Math.round(md) : 0;
    if (moodDeltaDaily) {
      pop.mood = Math.max(-100, Math.min(100, pop.mood + moodDeltaDaily));
      if (eff.title) reasons.push(`“${eff.title}” sways the village mood.`);
      else reasons.push('A Town Hall decree sways the village mood.');
    }
  }

  const after = pop.mood;
  const delta = after - before;
  pop.lastMoodChange = delta
    ? { day: absoluteDay, delta, reasons }
    : { day: absoluteDay, delta: 0, reasons: [] };
}