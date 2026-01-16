// js/game/services/tavernService.js
// Tavern service - handles rest operations through the engine
//
// This service provides tavern operations (resting, rumors) through the engine's
// event system for better modularity.

export function createTavernService(engine) {
  const getState = () => engine.getState();
  const setState = (newState, reason) => engine.commit(newState, reason);
  const emit = (event, payload) => engine.emit(event, payload);
  const log = engine.log;

  // Helper to ensure tavern state exists
  function ensureTavernState(state) {
    if (!state.tavern) {
      state.tavern = {
        lastVisitDay: state.time?.day || 1,
        rumorsHeard: [],
        timesRested: 0
      };
    }
    return state;
  }

  // Initialize tavern state
  function initTavern() {
    const state = getState();
    if (!state.tavern) {
      const newState = { ...state };
      ensureTavernState(newState);
      setState(newState, 'tavern:init');
      log?.info?.('tavern', 'Tavern state initialized');
    }
  }

  // Calculate rest cost based on economy
  function getRestCost() {
    const state = getState();
    const baseRestCost = 10; // Base cost to rest
    
    // Get economy multiplier if village economy exists
    const economy = state.village?.economy;
    const multiplier = economy?.priceMultiplier || 1.0;
    
    return Math.floor(baseRestCost * multiplier);
  }

  // Rest at tavern (advance to next morning)
  function rest() {
    const state = getState();
    const player = state.player;
    
    if (!player) {
      return { success: false, error: 'No player state' };
    }

    const restCost = getRestCost();
    
    if (player.gold < restCost) {
      return { success: false, error: 'Insufficient gold', cost: restCost };
    }

    const newState = { ...state };
    ensureTavernState(newState);
    
    // Deduct gold
    newState.player = { ...player, gold: player.gold - restCost };
    
    // Restore health and energy
    if (newState.player.hp !== undefined && newState.player.maxHp) {
      newState.player.hp = newState.player.maxHp;
    }
    if (newState.player.energy !== undefined && newState.player.maxEnergy) {
      newState.player.energy = newState.player.maxEnergy;
    }
    
    // Update tavern stats
    newState.tavern = {
      ...newState.tavern,
      lastVisitDay: state.time?.day || 1,
      timesRested: (newState.tavern.timesRested || 0) + 1
    };

    setState(newState, 'tavern:rest');
    
    // Emit event for purchase (for economy tracking)
    emit('merchant:purchase', { goldSpent: restCost, context: 'tavern' });
    
    // Emit rest event
    emit('tavern:rested', { cost: restCost, restored: true });
    
    // Request time advancement (other systems will handle the actual time change)
    emit('tavern:requestMorning', { reason: 'rest' });
    
    log?.info?.('tavern', `Player rested for ${restCost} gold`);
    return { success: true, cost: restCost };
  }

  // Hear a rumor (free)
  function hearRumor(rumorText) {
    const state = getState();
    
    if (!rumorText) {
      return { success: false, error: 'No rumor provided' };
    }

    const newState = { ...state };
    ensureTavernState(newState);
    
    const rumor = {
      text: rumorText,
      heardOn: state.time?.day || 1,
      timestamp: Date.now()
    };
    
    newState.tavern = {
      ...newState.tavern,
      rumorsHeard: [...(newState.tavern.rumorsHeard || []), rumor]
    };

    setState(newState, 'tavern:rumor');
    emit('tavern:rumorHeard', { rumor });
    
    log?.info?.('tavern', 'Player heard a rumor');
    return { success: true, rumor };
  }

  // Get tavern summary
  function getSummary() {
    const state = getState();
    const tavern = state.tavern || {};
    
    return {
      lastVisitDay: tavern.lastVisitDay || 1,
      timesRested: tavern.timesRested || 0,
      rumorsHeard: tavern.rumorsHeard?.length || 0,
      currentRestCost: getRestCost()
    };
  }

  return {
    initTavern,
    getRestCost,
    rest,
    hearRumor,
    getSummary
  };
}
