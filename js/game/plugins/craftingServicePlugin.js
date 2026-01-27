// js/game/plugins/craftingServicePlugin.js
// Plugin to register crafting service with the engine

import { createCraftingService } from '../services/craftingService.js';

export function createCraftingServicePlugin() {
  let craftingService = null;

  return {
    id: 'ew.craftingService',
    requires: ['ew.uiRuntime'],

    init(engine) {
      try {
        craftingService = createCraftingService(engine);
        engine.registerService('crafting', craftingService);

        // Initialize crafting state
        const state = engine.getState();
        const initializedState = craftingService.init(state);
        engine.setState(initializedState);

        engine.log?.info?.('crafting', 'Crafting service registered with engine');
      } catch (e) {
        engine.log?.error?.('crafting', 'Failed to register crafting service', { 
          error: e.message 
        });
      }
    },

    start(engine) {
      engine.log?.info?.('crafting', 'Crafting service started');
    },

    stop(engine) {
      engine.log?.info?.('crafting', 'Crafting service stopped');
    },

    dispose(engine) {
      try {
        if (craftingService) {
          engine.unregisterService('crafting');
        }
      } catch (e) {
        engine.log?.error?.('crafting', 'Failed to unregister crafting service', { 
          error: e.message 
        });
      }

      craftingService = null;
    }
  };
}
