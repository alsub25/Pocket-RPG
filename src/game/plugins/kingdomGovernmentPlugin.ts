// js/game/plugins/kingdomGovernmentPlugin.js
// Plugin to register kingdom government service with the engine
//
// This plugin ensures the kingdom government system runs through the engine
// properly with immutable state updates and event emissions.

import { createKingdomGovernmentService } from '../services/kingdomGovernmentService.js';

export function createKingdomGovernmentPlugin() {
  let governmentService = null;
  let timeDayChangedHandler = null;

  return {
    id: 'ew.kingdomGovernment',
    requires: ['ew.rngBridge'], // Needs RNG service

    init(engine) {
      try {
        governmentService = createKingdomGovernmentService(engine);
        engine.registerService('kingdom.government', governmentService);

        // Initialize kingdom government state
        governmentService.initializeState();

        engine.log?.info?.('kingdom', 'Kingdom government service registered with engine');
      } catch (e) {
        engine.log?.error?.('kingdom', 'Failed to register kingdom government service', { 
          error: e.message 
        });
      }
    },

    start(engine) {
      // Listen for time advancement events to trigger daily ticks
      timeDayChangedHandler = (payload) => {
        if (governmentService && typeof payload.newDay === 'number') {
          governmentService.handleDayTick(payload.newDay);
        }
      };
      engine.on('time:dayChanged', timeDayChangedHandler);

      engine.log?.info?.('kingdom', 'Kingdom government service started and listening for events');
    },

    stop(engine) {
      // Cleanup event listeners
      if (timeDayChangedHandler) {
        engine.off('time:dayChanged', timeDayChangedHandler);
        timeDayChangedHandler = null;
      }

      engine.log?.info?.('kingdom', 'Kingdom government service stopped');
    },

    dispose(engine) {
      // Unregister service
      try {
        if (governmentService) {
          engine.unregisterService('kingdom.government');
        }
      } catch (e) {
        engine.log?.error?.('kingdom', 'Failed to unregister kingdom government service', { 
          error: e.message 
        });
      }

      governmentService = null;
    }
  };
}
