// Systems/timeSystem.js

// 3-part day: matches your request (morning – evening – night)
export const DAY_PARTS = ['Morning', 'Evening', 'Night'];

// Fantasy week names
export const FANTASY_WEEKDAYS = [
  'Dawnsday',
  'Moonsday',
  'Stormday',
  'Emberday',
  'Dusksday',
  'Starfall',
  'Restday'
];

const DAYS_PER_YEAR = 360;

/* --------------------------------------------------------------------------
 * Internal normalization
 * --------------------------------------------------------------------------
 * Some systems read state.time.dayIndex / partIndex directly.
 * So we normalize the stored values (not just the derived display info).
 */

function normalizeTimeObject(time) {
  if (!time || typeof time !== 'object') return { dayIndex: 0, partIndex: 0 };

  const rawDay = Number(time.dayIndex);
  const rawPart = Number(time.partIndex);

  // Clamp dayIndex to a non-negative integer
  const dayIndex = Number.isFinite(rawDay) && rawDay >= 0 ? Math.floor(rawDay) : 0;

  // Clamp partIndex to valid range
  const maxPart = Math.max(0, DAY_PARTS.length - 1);
  let partIndex = Number.isFinite(rawPart) && rawPart >= 0 ? Math.floor(rawPart) : 0;
  if (partIndex > maxPart) partIndex = maxPart;

  time.dayIndex = dayIndex;
  time.partIndex = partIndex;
  return time;
}

// Ensure state.time exists (and is normalized)
export function initTimeState(state) {
  if (!state.time || typeof state.time !== 'object') {
    state.time = {
      // absolute day count from the start of the game (0-based)
      dayIndex: 0,
      // which part of the current day we are in (0..DAY_PARTS.length-1)
      partIndex: 0
    };
  }
  normalizeTimeObject(state.time);
  return state.time;
}

// Compute a full time breakdown from state
export function getTimeInfo(state) {
  const time = initTimeState(state);
  // initTimeState already normalized dayIndex/partIndex
  const dayIndex = time.dayIndex;
  const partIndex = time.partIndex;

  const year = 1 + Math.floor(dayIndex / DAYS_PER_YEAR);
  const dayOfYear = (dayIndex % DAYS_PER_YEAR) + 1;
  const weekdayIndex = dayIndex % FANTASY_WEEKDAYS.length;
  const weekdayName = FANTASY_WEEKDAYS[weekdayIndex];
  const partName = DAY_PARTS[partIndex] || DAY_PARTS[0];

  return {
    year,
    dayOfYear,
    absoluteDay: dayIndex,
    weekdayIndex,
    weekdayName,
    partIndex,
    partName
  };
}

// Long “flavor” line
export function formatTimeLong(infoOrState) {
  const info =
    infoOrState && infoOrState.year
      ? infoOrState
      : getTimeInfo(infoOrState);
  return `Year ${info.year}, ${info.weekdayName} – Day ${info.dayOfYear} (${info.partName})`;
}

// Short “HUD” line
export function formatTimeShort(infoOrState) {
  const info =
    infoOrState && infoOrState.year
      ? infoOrState
      : getTimeInfo(infoOrState);
  return `${info.weekdayName} (${info.partName})`;
}

// Advance time by N parts-of-day
export function advanceTime(state, steps = 1) {
  const time = initTimeState(state);
  const before = getTimeInfo(state);

  const partsPerDay = DAY_PARTS.length;
  let remaining = Math.max(0, steps | 0);

  while (remaining > 0) {
    time.partIndex++;
    if (time.partIndex >= partsPerDay) {
      time.partIndex = 0;
      time.dayIndex++;
    }
    remaining--;
  }

  // Normalize in case anything weird happened (dev tools, hacked saves, etc.)
  normalizeTimeObject(time);

  const after = getTimeInfo(state);

  return {
    before,
    after,
    partChanged:
      before.partIndex !== after.partIndex ||
      before.absoluteDay !== after.absoluteDay,
    dayChanged:
      before.dayOfYear !== after.dayOfYear ||
      before.year !== after.year,
    yearChanged: before.year !== after.year
  };
}

// Skip forward to the next morning
export function jumpToNextMorning(state) {
  const time = initTimeState(state);

  if (time.partIndex === 0) {
    // already morning – push one full day
    time.dayIndex++;
  } else {
    // move to the next day, morning
    time.dayIndex++;
    time.partIndex = 0;
  }

  normalizeTimeObject(time);
  return getTimeInfo(state);
}
