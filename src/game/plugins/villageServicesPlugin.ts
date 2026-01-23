// js/game/plugins/villageServicesPlugin.js
// Plugin to register village services with the engine
//
// This plugin ensures all village-related systems (economy, population, etc.)
// run through the engine properly with immutable state updates and event emissions.

import { createVillageEconomyService } from '../services/villageEconomyService.js';
import { createVillagePopulationService } from '../services/villagePopulationService.js';

export function createVillageServicesPlugin() {
  let economyService = null;
  let populationService = null;
  
  // Store handler references for proper cleanup
  let combatVictoryHandler = null;
  let merchantPurchaseHandler = null;
  let timeDayChangedHandler = null;

  return {
    id: 'ew.villageServices',
    requires: ['ew.rngBridge'], // Needs RNG service

    init(engine) {
      // Create and register village services
      try {
        economyService = createVillageEconomyService(engine);
        engine.registerService('village.economy', economyService);

        populationService = createVillagePopulationService(engine);
        engine.registerService('village.population', populationService);

        // Initialize village state
        economyService.initEconomy();
        populationService.initPopulation();

        engine.log?.info?.('village', 'Village services registered with engine', {
          economy: !!economyService,
          population: !!populationService
        });
      } catch (e) {
        engine.log?.error?.('village', 'Failed to register village services', { error: e.message });
      }
    },

    start(engine) {
      // Subscribe to relevant events that trigger village system updates
      // Store handler references for proper cleanup

      // Economy: handle after battle
      combatVictoryHandler = (payload) => {
        if (economyService && payload.enemy && payload.area) {
          economyService.handleAfterBattle(payload.enemy, payload.area);
        }
      };
      engine.on('combat:victory', combatVictoryHandler);

      // Economy: handle after purchase
      merchantPurchaseHandler = (payload) => {
        if (economyService && payload.goldSpent) {
          economyService.handleAfterPurchase(payload.goldSpent, payload.context);
        }
      };
      engine.on('merchant:purchase', merchantPurchaseHandler);

      // Listen for time advancement events to trigger daily ticks
      timeDayChangedHandler = (payload) => {
        if (economyService && typeof payload.newDay === 'number') {
          economyService.handleDayTick(payload.newDay);
        }
        if (populationService && typeof payload.newDay === 'number') {
          populationService.handleDayTick(payload.newDay);
        }
      };
      engine.on('time:dayChanged', timeDayChangedHandler);

      engine.log?.info?.('village', 'Village services started and listening for events');
    },

    stop(engine) {
      // Cleanup event listeners with specific handlers
      if (combatVictoryHandler) {
        engine.off('combat:victory', combatVictoryHandler);
        combatVictoryHandler = null;
      }
      if (merchantPurchaseHandler) {
        engine.off('merchant:purchase', merchantPurchaseHandler);
        merchantPurchaseHandler = null;
      }
      if (timeDayChangedHandler) {
        engine.off('time:dayChanged', timeDayChangedHandler);
        timeDayChangedHandler = null;
      }

      engine.log?.info?.('village', 'Village services stopped');
    },

    dispose(engine) {
      // Unregister services
      try {
        if (economyService) {
          engine.unregisterService('village.economy');
        }
        if (populationService) {
          engine.unregisterService('village.population');
        }
      } catch (e) {
        engine.log?.error?.('village', 'Failed to unregister services', { error: e.message });
      }

      economyService = null;
      populationService = null;
    }
  };
}
