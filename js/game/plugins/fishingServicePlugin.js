// js/game/plugins/fishingServicePlugin.js
// Plugin to register fishing service with the engine

import { createFishingService } from '../services/fishingService.js';

export function createFishingServicePlugin() {
  let fishingService = null;

  return {
    id: 'ew.fishingService',
    requires: ['ew.uiRuntime'],

    init(engine) {
      try {
        fishingService = createFishingService(engine);
        engine.registerService('fishing', fishingService);

        // Initialize fishing state
        const state = engine.getState();
        const initializedState = fishingService.init(state);
        engine.setState(initializedState);

        engine.log?.info?.('fishing', 'Fishing service registered with engine');
      } catch (e) {
        engine.log?.error?.('fishing', 'Failed to register fishing service', { 
          error: e.message 
        });
      }
    },

    start(engine) {
      engine.log?.info?.('fishing', 'Fishing service started');
    },

    stop(engine) {
      engine.log?.info?.('fishing', 'Fishing service stopped');
    },

    dispose(engine) {
      try {
        if (fishingService) {
          engine.unregisterService('fishing');
        }
      } catch (e) {
        engine.log?.error?.('fishing', 'Failed to unregister fishing service', { 
          error: e.message 
        });
      }

      fishingService = null;
    }
  };
}
