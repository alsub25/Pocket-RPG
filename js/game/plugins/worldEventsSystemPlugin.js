// js/game/plugins/worldEventsSystemPlugin.js
// Plugin to register world events system service with the engine
//
// This plugin ensures the world events system runs through the engine
// properly with immutable state updates and event emissions.

import { createWorldEventsService } from '../services/worldEventsService.js';

export function createWorldEventsSystemPlugin() {
  let worldEventsService = null;
  let dailyTickHandler = null;

  return {
    id: 'ew.worldEventsSystem',
    requires: ['ew.uiRuntime'],

    init(engine) {
      try {
        worldEventsService = createWorldEventsService(engine);
        engine.registerService('worldEvents', worldEventsService);

        // Initialize world events state
        const state = engine.getState();
        const initializedState = worldEventsService.init(state);
        engine.setState(initializedState);

        engine.log?.info?.('worldEvents', 'World events system service registered with engine');
      } catch (e) {
        engine.log?.error?.('worldEvents', 'Failed to register world events system service', { 
          error: e.message 
        });
      }
    },

    start(engine) {
      // Listen for daily tick to process world events
      dailyTickHandler = (payload) => {
        if (worldEventsService) {
          worldEventsService.tick();
        }
      };
      engine.on('time:dayChanged', dailyTickHandler);

      // Listen for world event activations to show UI notifications
      engine.on('worldEvent:activated', (payload) => {
        if (payload.event) {
          const ui = engine.get('ui');
          if (ui && ui.addLog) {
            ui.addLog(`🌍 ${payload.event.message}`, 'worldEvent');
          }
        }
      });

      // Listen for world event endings
      engine.on('worldEvent:ended', (payload) => {
        if (payload.event) {
          const ui = engine.get('ui');
          if (ui && ui.addLog) {
            ui.addLog(`🌍 The ${payload.event.name} has ended.`, 'worldEvent');
          }
        }
      });

      engine.log?.info?.('worldEvents', 'World events system service started and listening for events');
    },

    stop(engine) {
      // Cleanup event listeners
      if (dailyTickHandler) {
        engine.off('time:dayChanged', dailyTickHandler);
        dailyTickHandler = null;
      }

      engine.log?.info?.('worldEvents', 'World events system service stopped');
    },

    dispose(engine) {
      // Unregister service
      try {
        if (worldEventsService) {
          engine.unregisterService('worldEvents');
        }
      } catch (e) {
        engine.log?.error?.('worldEvents', 'Failed to unregister world events system service', { 
          error: e.message 
        });
      }

      worldEventsService = null;
    }
  };
}
