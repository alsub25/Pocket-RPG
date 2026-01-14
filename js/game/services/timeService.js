// js/game/services/timeService.js
// Engine-integrated time service
// 
// This service wraps the time system to ensure all state changes
// go through the engine properly with immutable updates and event emissions.

import {
  DAY_PARTS,
  FANTASY_WEEKDAYS,
  getTimeInfo,
  formatTimeLong,
  formatTimeShort
} from '../systems/timeSystem.js';

function normalizeTimeObject(time) {
  if (!time || typeof time !== 'object') return { dayIndex: 0, partIndex: 0 };

  const rawDay = Number(time.dayIndex);
  const rawPart = Number(time.partIndex);

  const dayIndex = Number.isFinite(rawDay) && rawDay >= 0 ? Math.floor(rawDay) : 0;

  const maxPart = Math.max(0, DAY_PARTS.length - 1);
  let partIndex = Number.isFinite(rawPart) && rawPart >= 0 ? Math.floor(rawPart) : 0;
  if (partIndex > maxPart) partIndex = maxPart;

  return { dayIndex, partIndex };
}

/**
 * Creates an engine-integrated time service.
 * All time state mutations go through engine.setState() with immutable updates.
 * All time changes emit events for other systems to react.
 */
export function createTimeService(engine) {
  if (!engine) throw new Error('TimeService requires engine instance');

  /**
   * Initialize time state if missing
   */
  function initTime(state) {
    if (!state.time || typeof state.time !== 'object') {
      return {
        ...state,
        time: {
          dayIndex: 0,
          partIndex: 0
        }
      };
    }

    // Normalize and ensure valid values
    const normalized = normalizeTimeObject(state.time);
    if (normalized.dayIndex !== state.time.dayIndex || normalized.partIndex !== state.time.partIndex) {
      return {
        ...state,
        time: normalized
      };
    }

    return state;
  }

  /**
   * Advance time by N parts-of-day (immutable)
   */
  function advanceTime(steps = 1) {
    const state = engine.getState();
    const stateWithTime = initTime(state);
    const time = stateWithTime.time;

    const before = getTimeInfo(stateWithTime);

    const partsPerDay = DAY_PARTS.length;
    let remaining = Math.max(0, Math.floor(steps));

    let newDayIndex = time.dayIndex;
    let newPartIndex = time.partIndex;

    while (remaining > 0) {
      newPartIndex++;
      if (newPartIndex >= partsPerDay) {
        newPartIndex = 0;
        newDayIndex++;
      }
      remaining--;
    }

    // Create immutable update
    const normalized = normalizeTimeObject({ dayIndex: newDayIndex, partIndex: newPartIndex });

    const newState = {
      ...stateWithTime,
      time: normalized
    };

    engine.setState(newState);

    const after = getTimeInfo(newState);

    const result = {
      before,
      after,
      partChanged: before.partIndex !== after.partIndex || before.absoluteDay !== after.absoluteDay,
      dayChanged: before.dayOfYear !== after.dayOfYear || before.year !== after.year,
      yearChanged: before.year !== after.year
    };

    // Emit events for time changes
    engine.emit('time:advanced', {
      steps,
      before,
      after,
      ...result
    });

    if (result.partChanged) {
      engine.emit('time:partChanged', {
        oldPart: before.partName,
        newPart: after.partName,
        partIndex: after.partIndex
      });
    }

    if (result.dayChanged) {
      engine.emit('time:dayChanged', {
        oldDay: before.absoluteDay,
        newDay: after.absoluteDay,
        dayOfYear: after.dayOfYear,
        year: after.year
      });
    }

    if (result.yearChanged) {
      engine.emit('time:yearChanged', {
        oldYear: before.year,
        newYear: after.year
      });
    }

    return result;
  }

  /**
   * Jump to next morning (immutable)
   */
  function jumpToNextMorning() {
    const state = engine.getState();
    const stateWithTime = initTime(state);
    const time = stateWithTime.time;

    const before = getTimeInfo(stateWithTime);

    let newDayIndex = time.dayIndex;
    let newPartIndex = 0;

    if (time.partIndex === 0) {
      // Already morning – push one full day
      newDayIndex++;
    } else {
      // Move to the next day, morning
      newDayIndex++;
    }

    const normalized = normalizeTimeObject({ dayIndex: newDayIndex, partIndex: newPartIndex });

    const newState = {
      ...stateWithTime,
      time: normalized
    };

    engine.setState(newState);

    const after = getTimeInfo(newState);

    // Always emit day change when jumping to morning
    engine.emit('time:jumpedToMorning', {
      before,
      after
    });

    engine.emit('time:dayChanged', {
      oldDay: before.absoluteDay,
      newDay: after.absoluteDay,
      dayOfYear: after.dayOfYear,
      year: after.year
    });

    if (before.year !== after.year) {
      engine.emit('time:yearChanged', {
        oldYear: before.year,
        newYear: after.year
      });
    }

    return after;
  }

  /**
   * Get current time information
   */
  function getCurrentTime() {
    const state = engine.getState();
    const stateWithTime = initTime(state);
    if (stateWithTime !== state) {
      engine.setState(stateWithTime);
    }
    return getTimeInfo(stateWithTime);
  }

  // Public API
  return {
    // Constants
    DAY_PARTS,
    FANTASY_WEEKDAYS,

    // State initialization
    initTime: () => {
      const state = engine.getState();
      const newState = initTime(state);
      if (newState !== state) {
        engine.setState(newState);
      }
    },

    // Read-only accessors
    getCurrentTime,
    formatTimeLong: () => formatTimeLong(engine.getState()),
    formatTimeShort: () => formatTimeShort(engine.getState()),

    // State-modifying operations (engine-integrated)
    advanceTime,
    jumpToNextMorning
  };
}
