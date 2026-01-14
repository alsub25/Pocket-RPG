// js/game/plugins/stateMutationPlugin.js
// State Mutation Service Plugin
//
// Provides a centralized service for all state mutations with proper event emission.
// Ensures all state changes go through the engine and are properly tracked.
//
// Usage:
//   const stateMutation = engine.getService('stateMutation')
//   stateMutation.updatePlayer(state, { gold: state.player.gold + 100 })
//   stateMutation.updateVillageEconomy(state, { inflationRate: 1.05 })

export function createStateMutationPlugin() {
  return {
    id: 'ew.stateMutation',
    requires: [],
    
    init(engine) {
      const stateMutation = {
        /**
         * Update player state and emit appropriate events
         */
        updatePlayer(state, updates) {
          if (!state || !state.player || !updates) return state
          
          const oldGold = state.player.gold
          const oldHp = state.player.hp
          const oldLevel = state.player.level
          
          // Apply updates
          state.player = { ...state.player, ...updates }
          
          // Emit specific events for tracking
          if (updates.gold !== undefined && updates.gold !== oldGold) {
            engine.emit('player:goldChanged', { 
              old: oldGold, 
              new: state.player.gold,
              delta: state.player.gold - oldGold 
            })
          }
          
          if (updates.hp !== undefined && updates.hp !== oldHp) {
            engine.emit('player:hpChanged', { 
              old: oldHp, 
              new: state.player.hp 
            })
          }
          
          if (updates.level !== undefined && updates.level !== oldLevel) {
            engine.emit('player:levelUp', { 
              old: oldLevel, 
              new: state.player.level 
            })
          }
          
          // General player state changed event
          engine.emit('player:stateChanged', { updates })
          
          return state
        },
        
        /**
         * Update village economy state
         */
        updateVillageEconomy(state, updates) {
          if (!state || !updates) return state
          
          if (!state.villageEconomy) {
            state.villageEconomy = {}
          }
          
          state.villageEconomy = { ...state.villageEconomy, ...updates }
          engine.emit('village:economyChanged', { updates })
          
          return state
        },
        
        /**
         * Update bank state
         */
        updateBank(state, updates) {
          if (!state || !updates) return state
          
          if (!state.bank) {
            state.bank = {}
          }
          
          const oldBalance = state.bank.balance
          state.bank = { ...state.bank, ...updates }
          
          if (updates.balance !== undefined && updates.balance !== oldBalance) {
            engine.emit('bank:balanceChanged', { 
              old: oldBalance, 
              new: state.bank.balance 
            })
          }
          
          engine.emit('bank:stateChanged', { updates })
          
          return state
        },
        
        /**
         * Update village population state
         */
        updatePopulation(state, updates) {
          if (!state || !state.village || !updates) return state
          
          if (!state.village.population) {
            state.village.population = {}
          }
          
          state.village.population = { ...state.village.population, ...updates }
          engine.emit('village:populationChanged', { updates })
          
          return state
        },
        
        /**
         * Update government state
         */
        updateGovernment(state, updates) {
          if (!state || !updates) return state
          
          if (!state.government) {
            state.government = {}
          }
          
          state.government = { ...state.government, ...updates }
          engine.emit('government:stateChanged', { updates })
          
          return state
        },
        
        /**
         * Update merchant state
         */
        updateMerchant(state, updates) {
          if (!state || !state.merchant || !updates) return state
          
          state.merchant = { ...state.merchant, ...updates }
          engine.emit('merchant:stateChanged', { updates })
          
          return state
        },
        
        /**
         * Update time state
         */
        updateTime(state, updates) {
          if (!state || !state.time || !updates) return state
          
          const oldDay = state.time.dayIndex
          state.time = { ...state.time, ...updates }
          
          if (updates.dayIndex !== undefined && updates.dayIndex !== oldDay) {
            engine.emit('time:dayChanged', { 
              old: oldDay, 
              new: state.time.dayIndex 
            })
          }
          
          engine.emit('time:stateChanged', { updates })
          
          return state
        },
        
        /**
         * Update combat state
         */
        updateCombat(state, updates) {
          if (!state || !updates) return state
          
          if (!state.combat) {
            state.combat = {}
          }
          
          state.combat = { ...state.combat, ...updates }
          engine.emit('combat:stateChanged', { updates })
          
          return state
        },
        
        /**
         * Update quest state
         */
        updateQuest(state, questId, updates) {
          if (!state || !state.quests || !questId || !updates) return state
          
          if (!state.quests[questId]) {
            state.quests[questId] = {}
          }
          
          state.quests[questId] = { ...state.quests[questId], ...updates }
          engine.emit('quest:stateChanged', { questId, updates })
          
          return state
        },
        
        /**
         * Update inventory - add item
         */
        addItem(state, item, quantity = 1) {
          if (!state || !state.player || !state.player.inventory || !item) return state
          
          state.player.inventory.push({ ...item, quantity })
          engine.emit('inventory:itemAdded', { item, quantity })
          engine.emit('world:itemGained', { itemId: item.id, quantity })
          
          return state
        },
        
        /**
         * Update inventory - remove item
         */
        removeItem(state, itemId, quantity = 1) {
          if (!state || !state.player || !state.player.inventory || !itemId) return state
          
          const idx = state.player.inventory.findIndex(i => i.id === itemId)
          if (idx >= 0) {
            const item = state.player.inventory[idx]
            if (item.quantity && item.quantity > quantity) {
              item.quantity -= quantity
            } else {
              state.player.inventory.splice(idx, 1)
            }
            engine.emit('inventory:itemRemoved', { itemId, quantity })
          }
          
          return state
        },
        
        /**
         * Update flags
         */
        updateFlags(state, updates) {
          if (!state || !updates) return state
          
          if (!state.flags) {
            state.flags = {}
          }
          
          state.flags = { ...state.flags, ...updates }
          engine.emit('flags:updated', { updates })
          
          return state
        },
        
        /**
         * Generic state mutation with path
         * Example: mutatePath(state, 'player.gold', 100)
         */
        mutatePath(state, path, value) {
          if (!state || !path) return state
          
          const parts = path.split('.')
          let current = state
          
          // Navigate to parent
          for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]]) {
              current[parts[i]] = {}
            }
            current = current[parts[i]]
          }
          
          // Set value
          const lastKey = parts[parts.length - 1]
          const oldValue = current[lastKey]
          current[lastKey] = value
          
          engine.emit('state:pathMutated', { path, oldValue, newValue: value })
          
          return state
        }
      }
      
      // Register the service
      engine.registerService('stateMutation', stateMutation)
    }
  }
}
