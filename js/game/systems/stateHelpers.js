// js/game/systems/stateHelpers.js
// State Management Helpers
//
// Provides convenience functions for managing state through the engine.
// These helpers ensure all state changes are properly routed and tracked.
//
// Usage:
//   import { withEngine, updatePlayerGold, logToUi } from '../systems/stateHelpers.js'
//   
//   function myFunction(engine, state) {
//     updatePlayerGold(engine, state, state.player.gold + 100)
//     logToUi(engine, 'good', 'You gained 100 gold!')
//   }

/**
 * Store a reference to the engine for global access
 * This is set during boot and used by legacy modules
 */
let _engineRef = null

export function setEngineRef(engine) {
  _engineRef = engine
}

export function getEngineRef() {
  return _engineRef
}

/**
 * Get the state mutation service
 */
function getStateMutation(engine) {
  const eng = engine || _engineRef
  if (!eng || typeof eng.getService !== 'function') return null
  return eng.getService('stateMutation')
}

/**
 * Get the UI events service
 */
function getUiEvents(engine) {
  const eng = engine || _engineRef
  if (!eng || typeof eng.getService !== 'function') return null
  return eng.getService('uiEvents')
}

/**
 * Update player state
 */
export function updatePlayer(engine, state, updates) {
  const sm = getStateMutation(engine)
  if (sm && sm.updatePlayer) {
    return sm.updatePlayer(state, updates)
  }
  // Fallback for compatibility
  if (state && state.player) {
    state.player = { ...state.player, ...updates }
  }
  return state
}

/**
 * Update player gold
 */
export function updatePlayerGold(engine, state, newGold) {
  return updatePlayer(engine, state, { gold: newGold })
}

/**
 * Update player HP
 */
export function updatePlayerHp(engine, state, newHp) {
  return updatePlayer(engine, state, { hp: newHp })
}

/**
 * Update village economy
 */
export function updateVillageEconomy(engine, state, updates) {
  const sm = getStateMutation(engine)
  if (sm && sm.updateVillageEconomy) {
    return sm.updateVillageEconomy(state, updates)
  }
  // Fallback
  if (state) {
    if (!state.villageEconomy) state.villageEconomy = {}
    state.villageEconomy = { ...state.villageEconomy, ...updates }
  }
  return state
}

/**
 * Update bank state
 */
export function updateBank(engine, state, updates) {
  const sm = getStateMutation(engine)
  if (sm && sm.updateBank) {
    return sm.updateBank(state, updates)
  }
  // Fallback
  if (state) {
    if (!state.bank) state.bank = {}
    state.bank = { ...state.bank, ...updates }
  }
  return state
}

/**
 * Update population state
 */
export function updatePopulation(engine, state, updates) {
  const sm = getStateMutation(engine)
  if (sm && sm.updatePopulation) {
    return sm.updatePopulation(state, updates)
  }
  // Fallback
  if (state && state.village) {
    if (!state.village.population) state.village.population = {}
    state.village.population = { ...state.village.population, ...updates }
  }
  return state
}

/**
 * Update government state
 */
export function updateGovernment(engine, state, updates) {
  const sm = getStateMutation(engine)
  if (sm && sm.updateGovernment) {
    return sm.updateGovernment(state, updates)
  }
  // Fallback
  if (state) {
    if (!state.government) state.government = {}
    state.government = { ...state.government, ...updates }
  }
  return state
}

/**
 * Update time state
 */
export function updateTime(engine, state, updates) {
  const sm = getStateMutation(engine)
  if (sm && sm.updateTime) {
    return sm.updateTime(state, updates)
  }
  // Fallback
  if (state && state.time) {
    state.time = { ...state.time, ...updates }
  }
  return state
}

/**
 * Update flags
 */
export function updateFlags(engine, state, updates) {
  const sm = getStateMutation(engine)
  if (sm && sm.updateFlags) {
    return sm.updateFlags(state, updates)
  }
  // Fallback
  if (state) {
    if (!state.flags) state.flags = {}
    state.flags = { ...state.flags, ...updates }
  }
  return state
}

/**
 * Add item to inventory
 */
export function addItemToInventory(engine, state, item, quantity = 1) {
  const sm = getStateMutation(engine)
  if (sm && sm.addItem) {
    return sm.addItem(state, item, quantity)
  }
  // Fallback
  if (state && state.player && state.player.inventory) {
    state.player.inventory.push({ ...item, quantity })
  }
  return state
}

/**
 * Remove item from inventory
 */
export function removeItemFromInventory(engine, state, itemId, quantity = 1) {
  const sm = getStateMutation(engine)
  if (sm && sm.removeItem) {
    return sm.removeItem(state, itemId, quantity)
  }
  // Fallback
  if (state && state.player && state.player.inventory) {
    const idx = state.player.inventory.findIndex(i => i.id === itemId)
    if (idx >= 0) {
      const item = state.player.inventory[idx]
      if (item.quantity && item.quantity > quantity) {
        item.quantity -= quantity
      } else {
        state.player.inventory.splice(idx, 1)
      }
    }
  }
  return state
}

/**
 * Log message to UI
 */
export function logToUi(engine, type, message, meta = null) {
  const eng = engine || _engineRef
  if (eng && typeof eng.emit === 'function') {
    eng.emit('ui:log', { type, message, meta })
  }
}

/**
 * Update time display in UI
 */
export function updateUiTime(engine, timeLabel) {
  const eng = engine || _engineRef
  if (eng && typeof eng.emit === 'function') {
    eng.emit('ui:timeUpdate', { timeLabel })
  }
}

/**
 * Update enemy panel in UI
 */
export function updateUiEnemy(engine, enemyData) {
  const eng = engine || _engineRef
  if (eng && typeof eng.emit === 'function') {
    eng.emit('ui:enemyUpdate', { enemyData })
  }
}

/**
 * Set scene in UI
 */
export function setUiScene(engine, title, text) {
  const eng = engine || _engineRef
  if (eng && typeof eng.emit === 'function') {
    eng.emit('ui:sceneChange', { title, text })
  }
}

/**
 * Emit an engine event
 */
export function emitEvent(engine, eventName, payload) {
  const eng = engine || _engineRef
  if (eng && typeof eng.emit === 'function') {
    eng.emit(eventName, payload)
  }
}

/**
 * Dispatch a command through the engine
 */
export function dispatchCommand(engine, type, payload) {
  const eng = engine || _engineRef
  if (eng && typeof eng.dispatch === 'function') {
    eng.dispatch({ type, payload })
  }
}
