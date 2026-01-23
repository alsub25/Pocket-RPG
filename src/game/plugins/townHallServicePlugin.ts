// js/game/plugins/townHallServicePlugin.js
// Plugin to register town hall service with the engine
//
// This plugin exposes town hall operations (announcements, proposals) as an engine
// service and handles town hall events through the engine.

import { createTownHallService } from '../services/townHallService.js';

export function createTownHallServicePlugin() {
  let townHallService = null;
  let dayTickHandler = null;

  return {
    id: 'ew.townHallService',
    requires: ['ew.timeService'], // Needs time for daily processing

    init(engine) {
      try {
        // Create and register town hall service
        townHallService = createTownHallService(engine);
        engine.registerService('townHall', townHallService);

        // Initialize town hall state
        townHallService.initTownHall();

        engine.log?.info?.('townHall', 'Town Hall service registered with engine', {
          service: !!townHallService
        });
      } catch (e) {
        engine.log?.error?.('townHall', 'Failed to register town hall service', { error: e.message });
      }
    },

    start(engine) {
      // Listen for time advancement to process daily events
      dayTickHandler = (payload) => {
        if (townHallService && typeof payload.newDay === 'number') {
          townHallService.handleDayTick(payload.newDay);
        }
      };
      engine.on('time:dayChanged', dayTickHandler);

      engine.log?.info?.('townHall', 'Town Hall service started and listening for events');
    },

    stop(engine) {
      // Cleanup event listeners
      if (dayTickHandler) {
        engine.off('time:dayChanged', dayTickHandler);
        dayTickHandler = null;
      }

      engine.log?.info?.('townHall', 'Town Hall service stopped');
    },

    dispose(engine) {
      // Service cleanup (engine doesn't have unregisterService method)
      townHallService = null;
    }
  };
}
