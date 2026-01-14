# Engine Integration Guide - v1.2.82

## Overview

Patch 1.2.82 introduces comprehensive engine integration to ensure all game operations flow through the Locus Engine properly. This provides better event tracking, debugging, replay functionality, and maintainability.

## New Architecture

### State Management Plugin (`stateMutationPlugin.js`)

All state mutations now go through the state mutation service, which:
- Emits granular events for each type of state change
- Provides a centralized audit trail
- Enables proper state change tracking
- Supports debugging and replay features

**Available Methods:**
- `updatePlayer(state, updates)` - Update player state
- `updateVillageEconomy(state, updates)` - Update village economy
- `updateBank(state, updates)` - Update bank state
- `updatePopulation(state, updates)` - Update population
- `updateGovernment(state, updates)` - Update government
- `updateMerchant(state, updates)` - Update merchant
- `updateTime(state, updates)` - Update time
- `updateCombat(state, updates)` - Update combat
- `updateQuest(state, questId, updates)` - Update quest
- `addItem(state, item, quantity)` - Add inventory item
- `removeItem(state, itemId, quantity)` - Remove inventory item
- `updateFlags(state, updates)` - Update flags
- `mutatePath(state, path, value)` - Generic path-based mutation

**Events Emitted:**
- `player:goldChanged` - When player gold changes
- `player:hpChanged` - When player HP changes
- `player:levelUp` - When player levels up
- `player:stateChanged` - General player state change
- `village:economyChanged` - When village economy changes
- `bank:balanceChanged` - When bank balance changes
- `bank:stateChanged` - General bank state change
- `village:populationChanged` - When population changes
- `government:stateChanged` - When government changes
- `merchant:stateChanged` - When merchant changes
- `time:dayChanged` - When day changes
- `time:stateChanged` - General time change
- `combat:stateChanged` - When combat state changes
- `quest:stateChanged` - When quest changes
- `inventory:itemAdded` - When item is added
- `inventory:itemRemoved` - When item is removed
- `flags:updated` - When flags change
- `state:pathMutated` - Generic path mutation

### UI Events Plugin (`uiEventsPlugin.js`)

All UI updates are now event-driven:
- Listens to engine events and updates UI accordingly
- Replaces direct UI function calls
- Enables UI updates from any system without tight coupling

**Event Triggers:**
- `ui:log` - Add log entry
- `ui:timeUpdate` - Update time display
- `ui:enemyUpdate` - Update enemy panel
- `ui:sceneChange` - Change scene
- `ui:hudUpdate` - Update HUD elements

**Auto-Connected Events:**
The plugin automatically connects game events to UI updates:
- `player:goldChanged` → Updates gold display
- `player:hpChanged` → Updates HP bar
- `player:levelUp` → Shows level up message and updates display
- `time:dayChanged` → Updates time display
- `combat:damage` → Logs damage to combat log
- `combat:heal` → Logs healing
- `world:battleStarted` → Logs battle start
- `world:battleEnded` → Logs battle end
- `inventory:itemAdded` → Logs item gain

### State Helpers (`stateHelpers.js`)

Convenience functions for common state operations:
- Provides simple API for state mutations
- Works with or without engine reference
- Backwards compatible fallbacks

**Usage Example:**
```javascript
import { updatePlayerGold, logToUi } from '../systems/stateHelpers.js'

function giveGold(engine, state, amount) {
  const newGold = state.player.gold + amount
  updatePlayerGold(engine, state, newGold)
  logToUi(engine, 'good', `You gained ${amount} gold!`)
}
```

**Available Functions:**
- `setEngineRef(engine)` - Store global engine reference
- `getEngineRef()` - Get global engine reference
- `updatePlayer(engine, state, updates)`
- `updatePlayerGold(engine, state, newGold)`
- `updatePlayerHp(engine, state, newHp)`
- `updateVillageEconomy(engine, state, updates)`
- `updateBank(engine, state, updates)`
- `updatePopulation(engine, state, updates)`
- `updateGovernment(engine, state, updates)`
- `updateTime(engine, state, updates)`
- `updateFlags(engine, state, updates)`
- `addItemToInventory(engine, state, item, quantity)`
- `removeItemFromInventory(engine, state, itemId, quantity)`
- `logToUi(engine, type, message, meta)`
- `updateUiTime(engine, timeLabel)`
- `updateUiEnemy(engine, enemyData)`
- `setUiScene(engine, title, text)`
- `emitEvent(engine, eventName, payload)`
- `dispatchCommand(engine, type, payload)`

## Migration Guide

### Before (Direct State Mutation)
```javascript
// ❌ Old way - Direct mutation
state.player.gold += 100
addLog('You gained 100 gold!')
```

### After (Engine-Routed)
```javascript
// ✅ New way - Through engine
const stateMutation = engine.getService('stateMutation')
stateMutation.updatePlayer(state, { 
  gold: state.player.gold + 100 
})
// Log is automatically emitted via player:goldChanged event
```

### Or Using Helpers
```javascript
// ✅ Alternative - Using helpers
import { updatePlayerGold } from '../systems/stateHelpers.js'
updatePlayerGold(engine, state, state.player.gold + 100)
```

## Benefits

1. **Event Tracking**: Every state change emits events that can be logged, tracked, or responded to
2. **Debugging**: Complete audit trail of all state mutations
3. **Replay**: Can replay game sessions by recording and replaying events
4. **Decoupling**: UI doesn't need to know about game logic; it just listens to events
5. **Testing**: Easy to test by capturing emitted events
6. **Maintainability**: Single source of truth for how state changes
7. **Extensions**: Other systems can react to state changes without tight coupling

## Backwards Compatibility

The new system includes fallbacks to ensure existing code continues to work:
- State mutation helpers include fallback logic
- Engine reference can be stored globally for legacy code
- Direct state mutations still work but won't emit events

## Best Practices

1. **Always pass engine**: When writing new code, always pass engine as first parameter
2. **Use helpers for common operations**: Leverage stateHelpers for common mutations
3. **Emit events for important actions**: Use `engine.emit()` for custom events
4. **Listen to events for side effects**: Use `engine.on()` to react to changes
5. **Avoid direct state access**: Always go through engine services when possible
6. **Use service registry**: Access cross-module functionality via `engine.getService()`

## Example: Complete Combat Action

```javascript
// Combat action that properly goes through engine
function performAttack(engine, state, targetId) {
  const stateMutation = engine.getService('stateMutation')
  const combatMath = engine.getService('combat.math')
  
  // Calculate damage
  const damage = combatMath.calculateDamage(state.player, target)
  
  // Apply damage through engine
  const newHp = Math.max(0, target.hp - damage)
  stateMutation.updateCombat(state, {
    enemies: state.combat.enemies.map(e => 
      e.id === targetId ? { ...e, hp: newHp } : e
    )
  })
  
  // Engine automatically emits combat:stateChanged
  // UI plugin listens and updates display
  // Combat log is automatically updated
  
  // Check for defeat
  if (newHp <= 0) {
    engine.emit('world:enemyDefeated', { enemy: target })
  }
}
```

## Testing

```javascript
// Test by capturing events
const events = []
engine.on('player:goldChanged', (e) => events.push(e))

updatePlayerGold(engine, state, 100)

// Verify event was emitted
assert(events.length === 1)
assert(events[0].new === 100)
```

## Future Enhancements

The new architecture enables:
- Command pattern for all actions (undo/redo)
- Time travel debugging
- Network multiplayer (event synchronization)
- Save state at any event
- Performance profiling per operation
- A/B testing of game mechanics
- Analytics without code changes

## Questions?

For questions or issues with the new architecture, please:
1. Check this guide first
2. Review example code in `stateHelpers.js`
3. Look at plugin implementations
4. Open an issue on GitHub
