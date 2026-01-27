/**
 * World Events System
 * Handles triggering and managing random world events
 */

import { worldEvents, eventRarityWeights } from '../data/worldEvents.js';

/**
 * Configuration constants
 */
const MIN_COOLDOWN_DAYS = 3;
const MAX_COOLDOWN_DAYS = 7;
const TRIGGER_CHANCE_PER_DAY = 0.3; // 30% chance when cooldown is up

/**
 * Initialize world events state
 */
export function initWorldEvents(state) {
  if (!state.worldEvents) {
    state.worldEvents = {
      active: null, // Current active event
      history: [], // Past events
      daysUntilNext: 0, // Countdown to next event
      totalEventsTriggered: 0
    };
  }
  return state;
}

/**
 * Tick world events system (called on daily tick)
 * May trigger a new event or progress active event
 */
export function tickWorldEvents(state, rngFunction = Math.random) {
  if (!state.worldEvents) {
    initWorldEvents(state);
  }
  
  // Check if there's an active event
  if (state.worldEvents.active) {
    // Decrement duration
    state.worldEvents.active.remainingDays--;
    
    // End event if duration expired
    if (state.worldEvents.active.remainingDays <= 0) {
      endWorldEvent(state);
    }
  } else {
    // No active event - check if we should trigger one
    if (state.worldEvents.daysUntilNext <= 0) {
      // Try to trigger an event (not guaranteed)
      if (rngFunction() < TRIGGER_CHANCE_PER_DAY) {
        triggerRandomEvent(state, rngFunction);
      } else {
        // Didn't trigger, set new cooldown
        const cooldownRange = MAX_COOLDOWN_DAYS - MIN_COOLDOWN_DAYS;
        state.worldEvents.daysUntilNext = Math.floor(rngFunction() * cooldownRange) + MIN_COOLDOWN_DAYS;
      }
    } else {
      // Countdown to next possible event
      state.worldEvents.daysUntilNext--;
    }
  }
  
  return state;
}

/**
 * Trigger a random world event
 */
export function triggerRandomEvent(state, rngFunction = Math.random) {
  // Select event by rarity
  const eventsList = Object.values(worldEvents);
  const weights = eventsList.map(event => {
    return eventRarityWeights[event.rarity] || 1;
  });
  
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  let random = rngFunction() * totalWeight;
  
  let selectedEvent = null;
  for (let i = 0; i < eventsList.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      selectedEvent = eventsList[i];
      break;
    }
  }
  
  if (!selectedEvent) {
    selectedEvent = eventsList[0];
  }
  
  // Activate the event
  activateEvent(state, selectedEvent.id);
  
  return selectedEvent;
}

/**
 * Activate a specific world event
 */
export function activateEvent(state, eventId) {
  const event = worldEvents[eventId];
  if (!event) {
    console.warn(`World event ${eventId} not found`);
    return false;
  }
  
  // End any current event first
  if (state.worldEvents.active) {
    endWorldEvent(state);
  }
  
  // Activate new event
  state.worldEvents.active = {
    id: event.id,
    name: event.name,
    remainingDays: event.duration,
    effects: { ...event.effects },
    reward: event.reward,
    challengeText: event.challengeText,
    startDay: state.time?.dayIndex || 0
  };
  
  state.worldEvents.totalEventsTriggered++;
  
  return true;
}

/**
 * End the current world event
 */
export function endWorldEvent(state) {
  if (!state.worldEvents.active) {
    return;
  }
  
  // Move to history
  state.worldEvents.history.push({
    ...state.worldEvents.active,
    endDay: state.time?.dayIndex || 0
  });
  
  // Keep only last 10 events in history
  if (state.worldEvents.history.length > 10) {
    state.worldEvents.history.shift();
  }
  
  // Clear active event
  state.worldEvents.active = null;
  
  // Set cooldown until next event
  const cooldownRange = MAX_COOLDOWN_DAYS - MIN_COOLDOWN_DAYS;
  state.worldEvents.daysUntilNext = Math.floor(Math.random() * cooldownRange) + MIN_COOLDOWN_DAYS;
}

/**
 * Get active world event
 */
export function getActiveEvent(state) {
  const activeEventData = state.worldEvents?.active;
  if (!activeEventData) {
    return null;
  }
  
  // Merge with full event definition
  const fullEvent = worldEvents[activeEventData.id];
  return {
    ...fullEvent,
    ...activeEventData
  };
}

/**
 * Check if a specific effect is active
 */
export function isEffectActive(state, effectName) {
  const active = state.worldEvents?.active;
  if (!active || !active.effects) {
    return false;
  }
  
  return effectName in active.effects;
}

/**
 * Get effect value
 */
export function getEffectValue(state, effectName) {
  const active = state.worldEvents?.active;
  if (!active || !active.effects) {
    return 0;
  }
  
  return active.effects[effectName] || 0;
}

/**
 * Apply event effects to a calculation
 * Example: applyEventModifier(state, 'merchantPriceReduction', basePrice)
 */
export function applyEventModifier(state, effectName, baseValue) {
  const effectValue = getEffectValue(state, effectName);
  
  if (!effectValue) {
    return baseValue;
  }
  
  // Handle different effect types
  if (effectName.includes('Reduction') || effectName.includes('Discount')) {
    return baseValue * (1 - effectValue);
  } else if (effectName.includes('Increase') || effectName.includes('Bonus')) {
    return baseValue * (1 + effectValue);
  } else if (effectName.includes('Penalty')) {
    return baseValue + effectValue; // effectValue is negative
  }
  
  return baseValue;
}

/**
 * Get event statistics
 */
export function getEventStats(state) {
  return {
    totalTriggered: state.worldEvents?.totalEventsTriggered || 0,
    activeEvent: getActiveEvent(state),
    daysUntilNext: state.worldEvents?.daysUntilNext || 0,
    historyCount: state.worldEvents?.history?.length || 0
  };
}

/**
 * Force trigger an event (for testing/cheats)
 */
export function debugTriggerEvent(state, eventId) {
  return activateEvent(state, eventId);
}
