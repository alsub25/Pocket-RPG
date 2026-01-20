// js/game/services/companionSystemService.js
// Engine-integrated companion system service
//
// This service manages companion state including loyalty, unlocking,
// and progression through immutable state updates and event emissions.

/**
 * Creates an engine-integrated companion system service.
 * All companion state mutations go through engine.setState() with immutable updates.
 * All companion changes emit events for other systems to react.
 */
export function createCompanionSystemService(engine) {
  if (!engine) throw new Error('CompanionSystemService requires engine instance');

  /**
   * Initialize companion state
   */
  function initializeState() {
    const state = engine.getState();
    if (!state.companions) {
      const newState = {
        ...state,
        companions: {
          unlocked: [],
          active: null,
          loyalty: {}
        }
      };
      engine.setState(newState);
      engine.emit('companion:initialized', {
        companions: newState.companions
      });
    }
  }

  /**
   * Unlock a companion
   */
  function unlockCompanion(companionId) {
    const state = engine.getState();
    const companions = state.companions || { unlocked: [], active: null, loyalty: {} };
    
    if (companions.unlocked.includes(companionId)) {
      engine.log?.warn?.('companion', 'Companion already unlocked', { companionId });
      return state;
    }

    const newCompanions = {
      ...companions,
      unlocked: [...companions.unlocked, companionId],
      loyalty: {
        ...companions.loyalty,
        [companionId]: {
          level: 0,
          points: 0,
          maxPoints: 100
        }
      }
    };

    const newState = {
      ...state,
      companions: newCompanions
    };

    engine.setState(newState);
    engine.emit('companion:unlocked', {
      companionId,
      companions: newCompanions
    });

    return newState;
  }

  /**
   * Set active companion
   */
  function setActiveCompanion(companionId) {
    const state = engine.getState();
    const companions = state.companions || { unlocked: [], active: null, loyalty: {} };
    
    if (companionId && !companions.unlocked.includes(companionId)) {
      engine.log?.warn?.('companion', 'Cannot activate locked companion', { companionId });
      return state;
    }

    const previousActive = companions.active;
    const newCompanions = {
      ...companions,
      active: companionId
    };

    const newState = {
      ...state,
      companions: newCompanions
    };

    engine.setState(newState);
    engine.emit('companion:activeChanged', {
      previousActive,
      newActive: companionId
    });

    return newState;
  }

  /**
   * Add loyalty points to a companion
   */
  function addLoyalty(companionId, points) {
    const state = engine.getState();
    const companions = state.companions || { unlocked: [], active: null, loyalty: {} };
    
    if (!companions.unlocked.includes(companionId)) {
      engine.log?.warn?.('companion', 'Cannot add loyalty to locked companion', { companionId });
      return state;
    }

    const currentLoyalty = companions.loyalty[companionId] || { level: 0, points: 0, maxPoints: 100 };
    const newPoints = currentLoyalty.points + points;
    const newLevel = currentLoyalty.level;
    let leveledUp = false;

    let updatedLoyalty = {
      ...currentLoyalty,
      points: Math.min(newPoints, currentLoyalty.maxPoints)
    };

    // Check for level up
    if (newPoints >= currentLoyalty.maxPoints && currentLoyalty.level < 10) {
      updatedLoyalty = {
        level: currentLoyalty.level + 1,
        points: newPoints - currentLoyalty.maxPoints,
        maxPoints: Math.floor(currentLoyalty.maxPoints * 1.2)
      };
      leveledUp = true;
    }

    const newCompanions = {
      ...companions,
      loyalty: {
        ...companions.loyalty,
        [companionId]: updatedLoyalty
      }
    };

    const newState = {
      ...state,
      companions: newCompanions
    };

    engine.setState(newState);
    engine.emit('companion:loyaltyChanged', {
      companionId,
      points,
      newLoyalty: updatedLoyalty,
      leveledUp
    });

    if (leveledUp) {
      engine.emit('companion:levelUp', {
        companionId,
        newLevel: updatedLoyalty.level
      });
    }

    return newState;
  }

  /**
   * Get companion data
   */
  function getCompanion(companionId) {
    const state = engine.getState();
    const companions = state.companions || { unlocked: [], active: null, loyalty: {} };
    
    return {
      id: companionId,
      unlocked: companions.unlocked.includes(companionId),
      active: companions.active === companionId,
      loyalty: companions.loyalty[companionId] || { level: 0, points: 0, maxPoints: 100 }
    };
  }

  /**
   * Get all companions
   */
  function getAllCompanions() {
    const state = engine.getState();
    return state.companions || { unlocked: [], active: null, loyalty: {} };
  }

  /**
   * Get active companion
   */
  function getActiveCompanion() {
    const state = engine.getState();
    const companions = state.companions || { unlocked: [], active: null, loyalty: {} };
    return companions.active;
  }

  // Public API
  return {
    initializeState,
    unlockCompanion,
    setActiveCompanion,
    addLoyalty,
    getCompanion,
    getAllCompanions,
    getActiveCompanion
  };
}
