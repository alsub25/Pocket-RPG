// js/game/plugins/achievementSystemPlugin.js
// Plugin to register achievement system service with the engine
//
// This plugin ensures the achievement system runs through the engine
// properly with immutable state updates and event emissions.

import { createAchievementService } from '../services/achievementService.js';

export function createAchievementSystemPlugin() {
  let achievementService = null;
  let combatVictoryHandler = null;
  let levelUpHandler = null;
  let itemAcquiredHandler = null;

  return {
    id: 'ew.achievementSystem',
    requires: ['ew.uiRuntime'],

    init(engine) {
      try {
        achievementService = createAchievementService(engine);
        engine.registerService('achievement', achievementService);

        // Initialize achievement state
        const state = engine.getState();
        const initializedState = achievementService.init(state);
        engine.setState(initializedState);

        engine.log?.info?.('achievement', 'Achievement system service registered with engine');
      } catch (e) {
        engine.log?.error?.('achievement', 'Failed to register achievement system service', { 
          error: e.message 
        });
      }
    },

    start(engine) {
      // Listen for game events to check achievements
      
      // Check achievements after combat victories
      combatVictoryHandler = (payload) => {
        if (achievementService) {
          // Update combat stats
          const state = engine.getState();
          const stats = {
            victories: (state.player?.combatStats?.victories || 0) + 1
          };
          
          // Check for boss or perfect victory
          if (payload.isBoss) {
            stats.bossesDefeated = (state.player?.combatStats?.bossesDefeated || 0) + 1;
          }
          if (payload.isPerfect) {
            stats.perfectVictories = (state.player?.combatStats?.perfectVictories || 0) + 1;
          }
          
          achievementService.updateCombatStats(stats);
        }
      };
      engine.on('combat:victory', combatVictoryHandler);

      // Check achievements on level up
      levelUpHandler = () => {
        if (achievementService) {
          achievementService.check();
        }
      };
      engine.on('player:levelUp', levelUpHandler);

      // Check achievements when items are acquired
      itemAcquiredHandler = (payload) => {
        if (achievementService && payload.item) {
          // Update loot stats based on item rarity
          const rarity = payload.item.rarity;
          const stats = {
            itemsFound: 1
          };
          
          if (rarity === 'rare' || rarity === 'epic' || rarity === 'legendary') {
            stats.raresFound = 1;
          }
          if (rarity === 'legendary') {
            stats.legendariesFound = 1;
          }
          
          achievementService.updateLootStats(stats);
        }
      };
      engine.on('world:itemGained', itemAcquiredHandler);

      // Check achievements periodically
      engine.on('time:dayChanged', () => {
        if (achievementService) {
          achievementService.check();
        }
      });

      engine.log?.info?.('achievement', 'Achievement system service started and listening for events');
    },

    stop(engine) {
      // Cleanup event listeners
      if (combatVictoryHandler) {
        engine.off('combat:victory', combatVictoryHandler);
        combatVictoryHandler = null;
      }
      if (levelUpHandler) {
        engine.off('player:levelUp', levelUpHandler);
        levelUpHandler = null;
      }
      if (itemAcquiredHandler) {
        engine.off('world:itemGained', itemAcquiredHandler);
        itemAcquiredHandler = null;
      }

      engine.log?.info?.('achievement', 'Achievement system service stopped');
    },

    dispose(engine) {
      // Unregister service
      try {
        if (achievementService) {
          engine.unregisterService('achievement');
        }
      } catch (e) {
        engine.log?.error?.('achievement', 'Failed to unregister achievement system service', { 
          error: e.message 
        });
      }

      achievementService = null;
    }
  };
}
