// js/game/services/fishingService.js
// Engine-integrated fishing service

import {
  initFishing,
  attemptFishing as attemptFishingImpl,
  getFishingStats,
  unlockLocation
} from '../systems/fishingSystem.js';

/**
 * Creates an engine-integrated fishing service
 */
export function createFishingService(engine) {
  if (!engine) throw new Error('FishingService requires engine instance');

  /**
   * Initialize fishing structures in state if missing
   */
  function initService(state) {
    const tempState = JSON.parse(JSON.stringify(state));
    initFishing(tempState);
    return tempState;
  }

  /**
   * Attempt to catch a fish
   */
  function attemptFishing(locationId) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    // Use engine RNG if available
    const rng = engine.rng?.roll ? () => engine.rng.roll(1, 100) / 100 : Math.random;
    
    const result = attemptFishingImpl(tempState, locationId, rng);
    
    if (result.success) {
      engine.setState(tempState);
      engine.emit('fish:caught', { fish: result.fish, location: locationId });
      engine.log?.info?.('fishing', `Caught: ${result.fish.name}`);
    }
    
    return result;
  }

  /**
   * Get fishing statistics
   */
  function getStats() {
    const state = engine.getState();
    return getFishingStats(state);
  }

  /**
   * Unlock a fishing location
   */
  function unlock(locationId) {
    const state = engine.getState();
    const tempState = JSON.parse(JSON.stringify(state));
    
    const wasUnlocked = unlockLocation(tempState, locationId);
    
    if (wasUnlocked) {
      engine.setState(tempState);
      engine.emit('fishing:locationUnlocked', { locationId });
      engine.log?.info?.('fishing', `Location unlocked: ${locationId}`);
    }
    
    return wasUnlocked;
  }

  // Public API
  return {
    init: initService,
    attemptFishing,
    getStats,
    unlock
  };
}
