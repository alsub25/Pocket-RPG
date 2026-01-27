// js/game/services/worldEventsService.js
// Engine-integrated world events service
// 
// This service wraps the world events system to ensure all state changes
// go through the engine properly with immutable updates and event emissions.

import {
  initWorldEvents,
  tickWorldEvents,
  triggerRandomEvent,
  activateEvent,
  endWorldEvent,
  getActiveEvent,
  isEffectActive,
  getEffectValue,
  applyEventModifier,
  getEventStats,
  debugTriggerEvent
} from '../systems/worldEventsSystem.js';

/**
 * Creates an engine-integrated world events service.
 * All world event state mutations go through engine.setState() with immutable updates.
 * All event changes emit events for other systems to react.
 */
export function createWorldEventsService(engine) {
  if (!engine) throw new Error('WorldEventsService requires engine instance');

  /**
   * Initialize world events structures in state if missing
   */
  function initService(state) {
    const tempState = JSON.parse(JSON.stringify(state));
    initWorldEvents(tempState);
    return tempState;
  }

  /**
   * Tick world events system (called on daily tick)
   */
  function tick() {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    // Use proper 0-1 range for RNG
    const rng = engine.rng?.roll ? () => engine.rng.roll(1, 100) / 100 : Math.random;
    
    // Tick the system
    tickWorldEvents(tempState, rng);
    
    // Check if a new event was activated
    const activeEvent = getActiveEvent(tempState);
    const wasActive = getActiveEvent(state);
    
    // Update state
    engine.setState(tempState);
    
    // Emit events if status changed
    if (activeEvent && !wasActive) {
      // New event activated
      engine.emit('worldEvent:activated', { event: activeEvent });
      engine.log?.info?.('worldEvents', `World event activated: ${activeEvent.name}`);
    } else if (!activeEvent && wasActive) {
      // Event ended
      engine.emit('worldEvent:ended', { event: wasActive });
      engine.log?.info?.('worldEvents', `World event ended: ${wasActive.name}`);
    }
  }

  /**
   * Trigger a random event (for testing or special occasions)
   */
  function triggerRandom() {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    // Use proper 0-1 range for RNG
    const rng = engine.rng?.roll ? () => engine.rng.roll(1, 100) / 100 : Math.random;
    const event = triggerRandomEvent(tempState, rng);
    
    engine.setState(tempState);
    
    if (event) {
      engine.emit('worldEvent:activated', { event });
      engine.log?.info?.('worldEvents', `World event triggered: ${event.name}`);
    }
    
    return event;
  }

  /**
   * Activate a specific event
   */
  function activate(eventId) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    const success = activateEvent(tempState, eventId);
    
    if (success) {
      engine.setState(tempState);
      const event = getActiveEvent(tempState);
      engine.emit('worldEvent:activated', { event });
      engine.log?.info?.('worldEvents', `World event activated: ${event.name}`);
    }
    
    return success;
  }

  /**
   * End the current event
   */
  function endCurrent() {
    const state = engine.getState();
    const activeEvent = getActiveEvent(state);
    
    if (!activeEvent) {
      return false;
    }
    
    const tempState = JSON.parse(JSON.stringify(state));
    endWorldEvent(tempState);
    engine.setState(tempState);
    
    engine.emit('worldEvent:ended', { event: activeEvent });
    engine.log?.info?.('worldEvents', `World event ended: ${activeEvent.name}`);
    
    return true;
  }

  /**
   * Get active world event
   */
  function getActive() {
    const state = engine.getState();
    return getActiveEvent(state);
  }

  /**
   * Check if a specific effect is active
   */
  function hasEffect(effectName) {
    const state = engine.getState();
    return isEffectActive(state, effectName);
  }

  /**
   * Get effect value
   */
  function getEffect(effectName) {
    const state = engine.getState();
    return getEffectValue(state, effectName);
  }

  /**
   * Apply event modifier to a value
   */
  function applyModifier(effectName, baseValue) {
    const state = engine.getState();
    return applyEventModifier(state, effectName, baseValue);
  }

  /**
   * Get event statistics
   */
  function getStats() {
    const state = engine.getState();
    return getEventStats(state);
  }

  /**
   * Debug: trigger specific event
   */
  function debugTrigger(eventId) {
    return activate(eventId);
  }

  // Public API
  return {
    init: initService,
    tick,
    triggerRandom,
    activate,
    endCurrent,
    getActive,
    hasEffect,
    getEffect,
    applyModifier,
    getStats,
    debugTrigger
  };
}
