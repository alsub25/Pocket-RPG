// js/game/plugins/combatSystemPlugin.js
// Plugin to register combat system service with the engine
//
// This plugin ensures the combat system runs through the engine
// properly with immutable state updates and event emissions.

import { createCombatSystemService } from '../services/combatSystemService.js';

export function createCombatSystemPlugin() {
  let combatService = null;
  let enemyDefeatedHandler = null;
  let playerDefeatedHandler = null;

  return {
    id: 'ew.combatSystem',
    requires: ['ew.uiRuntime'], // Needs UI service for logging

    init(engine) {
      try {
        combatService = createCombatSystemService(engine);
        engine.registerService('combat.system', combatService);

        engine.log?.info?.('combat', 'Combat system service registered with engine');
      } catch (e) {
        engine.log?.error?.('combat', 'Failed to register combat system service', { 
          error: e.message 
        });
      }
    },

    start(engine) {
      // Listen for combat events to trigger side effects
      enemyDefeatedHandler = (payload) => {
        if (payload.enemy) {
          engine.emit('world:enemyDefeated', payload);
        }
      };
      engine.on('combat:enemyDefeated', enemyDefeatedHandler);

      playerDefeatedHandler = () => {
        engine.emit('world:playerDefeated', {});
      };
      engine.on('combat:playerDefeated', playerDefeatedHandler);

      engine.log?.info?.('combat', 'Combat system service started and listening for events');
    },

    stop(engine) {
      // Cleanup event listeners
      if (enemyDefeatedHandler) {
        engine.off('combat:enemyDefeated', enemyDefeatedHandler);
        enemyDefeatedHandler = null;
      }
      if (playerDefeatedHandler) {
        engine.off('combat:playerDefeated', playerDefeatedHandler);
        playerDefeatedHandler = null;
      }

      engine.log?.info?.('combat', 'Combat system service stopped');
    },

    dispose(engine) {
      // Unregister service
      try {
        if (combatService) {
          engine.unregisterService('combat.system');
        }
      } catch (e) {
        engine.log?.error?.('combat', 'Failed to unregister combat system service', { 
          error: e.message 
        });
      }

      combatService = null;
    }
  };
}
