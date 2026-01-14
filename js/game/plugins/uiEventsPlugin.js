// js/game/plugins/uiEventsPlugin.js
// UI Events Plugin
//
// Listens to engine events and updates the UI accordingly.
// This ensures UI updates are event-driven rather than called directly.
//
// Replaces direct calls to:
// - addLog() -> engine.emit('ui:log', ...)
// - updateTimeDisplay() -> engine.emit('ui:timeUpdate', ...)
// - updateEnemyPanel() -> engine.emit('ui:enemyUpdate', ...)
// - setScene() -> engine.emit('ui:sceneChange', ...)

export function createUiEventsPlugin({ uiRuntime }) {
  return {
    id: 'ew.uiEvents',
    requires: ['ew.uiRuntime'],
    
    init(engine) {
      // Listen for UI log events
      engine.on('ui:log', ({ type, message, meta }) => {
        if (uiRuntime && uiRuntime.addLog) {
          uiRuntime.addLog(type, message, meta)
        }
      })
      
      // Listen for time update events
      engine.on('ui:timeUpdate', ({ timeLabel }) => {
        if (uiRuntime && uiRuntime.updateTimeDisplay) {
          uiRuntime.updateTimeDisplay(timeLabel)
        }
      })
      
      // Listen for enemy panel update events
      engine.on('ui:enemyUpdate', ({ enemyData }) => {
        if (uiRuntime && uiRuntime.updateEnemyPanel) {
          uiRuntime.updateEnemyPanel(enemyData)
        }
      })
      
      // Listen for scene change events
      engine.on('ui:sceneChange', ({ title, text }) => {
        if (uiRuntime && uiRuntime.setScene) {
          uiRuntime.setScene(title, text)
        }
      })
      
      // Listen for HUD update events
      engine.on('ui:hudUpdate', (data) => {
        // Update HUD elements based on data
        if (data.hp !== undefined && uiRuntime && uiRuntime.updateHpBar) {
          uiRuntime.updateHpBar(data.hp, data.maxHp)
        }
        if (data.resource !== undefined && uiRuntime && uiRuntime.updateResourceBar) {
          uiRuntime.updateResourceBar(data.resource, data.maxResource)
        }
        if (data.gold !== undefined && uiRuntime && uiRuntime.updateGold) {
          uiRuntime.updateGold(data.gold)
        }
        if (data.level !== undefined && uiRuntime && uiRuntime.updateLevel) {
          uiRuntime.updateLevel(data.level, data.xp, data.xpNext)
        }
      })
      
      // Listen for player state changes and update HUD
      engine.on('player:goldChanged', ({ new: newGold }) => {
        engine.emit('ui:hudUpdate', { gold: newGold })
      })
      
      engine.on('player:hpChanged', ({ new: newHp }) => {
        const state = engine.getState()
        if (state && state.player) {
          engine.emit('ui:hudUpdate', { 
            hp: newHp, 
            maxHp: state.player.maxHp 
          })
        }
      })
      
      engine.on('player:levelUp', ({ new: newLevel }) => {
        const state = engine.getState()
        if (state && state.player) {
          engine.emit('ui:log', {
            type: 'good',
            message: `Level Up! You are now level ${newLevel}.`
          })
          engine.emit('ui:hudUpdate', { 
            level: newLevel,
            xp: state.player.xp,
            xpNext: state.player.xpNext
          })
        }
      })
      
      // Listen for time changes and update display
      engine.on('time:dayChanged', () => {
        const state = engine.getState()
        if (state && state.time && uiRuntime && uiRuntime.formatTimeLong) {
          const timeLabel = uiRuntime.formatTimeLong(state.time)
          engine.emit('ui:timeUpdate', { timeLabel })
        }
      })
      
      engine.on('time:stateChanged', () => {
        const state = engine.getState()
        if (state && state.time && uiRuntime && uiRuntime.formatTimeLong) {
          const timeLabel = uiRuntime.formatTimeLong(state.time)
          engine.emit('ui:timeUpdate', { timeLabel })
        }
      })
      
      // Listen for combat events and log them
      engine.on('combat:damage', ({ source, target, damage, breakdown }) => {
        let message = `${source} dealt ${damage} damage to ${target}`
        if (breakdown) {
          message += ` (${breakdown})`
        }
        engine.emit('ui:log', {
          type: 'combat',
          message,
          meta: { damage, source, target, breakdown }
        })
      })
      
      engine.on('combat:heal', ({ source, target, amount }) => {
        engine.emit('ui:log', {
          type: 'good',
          message: `${source} healed ${target} for ${amount} HP`
        })
      })
      
      engine.on('combat:stateChanged', () => {
        const state = engine.getState()
        if (state && state.combat && state.combat.currentEnemy) {
          engine.emit('ui:enemyUpdate', { enemyData: state.combat.currentEnemy })
        }
      })
      
      // Listen for village events and log them
      engine.on('village:economyChanged', ({ updates }) => {
        if (updates.inflationRate) {
          engine.emit('ui:log', {
            type: 'system',
            message: `The village economy has shifted.`
          })
        }
      })
      
      engine.on('merchant:stateChanged', () => {
        engine.emit('ui:log', {
          type: 'system',
          message: 'The merchant has restocked their inventory.'
        })
      })
      
      // Listen for inventory events
      engine.on('inventory:itemAdded', ({ item, quantity }) => {
        const qtyText = quantity > 1 ? ` x${quantity}` : ''
        engine.emit('ui:log', {
          type: 'good',
          message: `Gained: ${item.name}${qtyText}`
        })
      })
      
      engine.on('inventory:itemRemoved', ({ itemId, quantity }) => {
        const qtyText = quantity > 1 ? ` x${quantity}` : ''
        engine.emit('ui:log', {
          type: 'info',
          message: `Lost: ${itemId}${qtyText}`
        })
      })
      
      // Listen for world events
      engine.on('world:itemGained', ({ itemId, quantity }) => {
        // Already handled by inventory:itemAdded, but keep for legacy
      })
      
      engine.on('world:battleStarted', ({ enemyCount }) => {
        engine.emit('ui:log', {
          type: 'combat',
          message: `Combat started! ${enemyCount} ${enemyCount > 1 ? 'enemies' : 'enemy'} approach!`
        })
      })
      
      engine.on('world:battleEnded', ({ result }) => {
        if (result === 'win') {
          engine.emit('ui:log', {
            type: 'good',
            message: 'Victory! All enemies defeated.'
          })
        } else {
          engine.emit('ui:log', {
            type: 'danger',
            message: 'Defeated...'
          })
        }
      })
      
      engine.on('world:enemyDefeated', ({ enemy }) => {
        engine.emit('ui:log', {
          type: 'good',
          message: `${enemy.name} defeated!`
        })
      })
      
      // Register service for manual UI updates if needed
      const uiEvents = {
        log(type, message, meta) {
          engine.emit('ui:log', { type, message, meta })
        },
        updateTime(timeLabel) {
          engine.emit('ui:timeUpdate', { timeLabel })
        },
        updateEnemy(enemyData) {
          engine.emit('ui:enemyUpdate', { enemyData })
        },
        setScene(title, text) {
          engine.emit('ui:sceneChange', { title, text })
        },
        updateHud(data) {
          engine.emit('ui:hudUpdate', data)
        }
      }
      
      engine.registerService('uiEvents', uiEvents)
    }
  }
}
