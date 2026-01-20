// js/game/plugins/companionSystemPlugin.js
// Plugin to register companion system service with the engine
//
// This plugin ensures the companion system runs through the engine
// properly with immutable state updates and event emissions.

import { createCompanionSystemService } from '../services/companionSystemService.js';

export function createCompanionSystemPlugin() {
  let companionService = null;
  let combatEndedHandler = null;
  let enemyDefeatedHandler = null;

  return {
    id: 'ew.companionSystem',
    requires: ['ew.uiRuntime'], // Needs UI service for logging

    init(engine) {
      try {
        companionService = createCompanionSystemService(engine);
        engine.registerService('companion.system', companionService);

        // Initialize companion state
        companionService.initializeState();

        engine.log?.info?.('companion', 'Companion system service registered with engine');
      } catch (e) {
        engine.log?.error?.('companion', 'Failed to register companion system service', { 
          error: e.message 
        });
      }
    },

    start(engine) {
      // Listen for combat events to update companion loyalty
      combatEndedHandler = (payload) => {
        if (companionService && payload.reason === 'victory') {
          const activeCompanion = companionService.getActiveCompanion();
          if (activeCompanion) {
            // Award loyalty for combat victory
            companionService.addLoyalty(activeCompanion, 5);
          }
        }
      };
      engine.on('combat:ended', combatEndedHandler);

      enemyDefeatedHandler = (payload) => {
        if (companionService && payload.enemy) {
          const activeCompanion = companionService.getActiveCompanion();
          if (activeCompanion) {
            // Award loyalty for enemy defeated (bonus for bosses)
            const loyaltyPoints = payload.enemy.isBoss ? 10 : 2;
            companionService.addLoyalty(activeCompanion, loyaltyPoints);
          }
        }
      };
      engine.on('combat:enemyDefeated', enemyDefeatedHandler);

      engine.log?.info?.('companion', 'Companion system service started and listening for events');
    },

    stop(engine) {
      // Cleanup event listeners
      if (combatEndedHandler) {
        engine.off('combat:ended', combatEndedHandler);
        combatEndedHandler = null;
      }
      if (enemyDefeatedHandler) {
        engine.off('combat:enemyDefeated', enemyDefeatedHandler);
        enemyDefeatedHandler = null;
      }

      engine.log?.info?.('companion', 'Companion system service stopped');
    },

    dispose(engine) {
      // Unregister service
      try {
        if (companionService) {
          engine.unregisterService('companion.system');
        }
      } catch (e) {
        engine.log?.error?.('companion', 'Failed to unregister companion system service', { 
          error: e.message 
        });
      }

      companionService = null;
    }
  };
}
