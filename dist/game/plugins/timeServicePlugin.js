// js/game/plugins/timeServicePlugin.js
// Plugin to register time service with the engine
//
// This plugin ensures time-related operations run through the engine properly
// with immutable state updates and event emissions.
import { createTimeService } from '../services/timeService.js';
export function createTimeServicePlugin() {
    let timeService = null;
    return {
        id: 'ew.timeService',
        init(engine) {
            // Create and register time service
            try {
                timeService = createTimeService(engine);
                engine.registerService('time', timeService);
                // Initialize time state
                timeService.initTime();
                engine.log?.info?.('time', 'Time service registered with engine');
            }
            catch (e) {
                engine.log?.error?.('time', 'Failed to register time service', { error: e.message });
            }
        },
        start(engine) {
            // Subscribe to events that need time updates
            // (This allows other systems to trigger time advancement through events)
            engine.log?.info?.('time', 'Time service started');
        },
        stop(engine) {
            engine.log?.info?.('time', 'Time service stopped');
        },
        dispose(engine) {
            // Unregister service
            try {
                engine.unregisterService('time');
            }
            catch (_) { }
            timeService = null;
        }
    };
}
//# sourceMappingURL=timeServicePlugin.js.map