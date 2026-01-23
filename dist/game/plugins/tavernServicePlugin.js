// js/game/plugins/tavernServicePlugin.js
// Plugin to register tavern service with the engine
//
// This plugin exposes tavern operations (resting, rumors) as an engine service
// and handles tavern events through the engine.
import { createTavernService } from '../services/tavernService.js';
export function createTavernServicePlugin() {
    let tavernService = null;
    return {
        id: 'ew.tavernService',
        requires: ['ew.timeService'], // Needs time for rest mechanics
        init(engine) {
            try {
                // Create and register tavern service
                tavernService = createTavernService(engine);
                engine.registerService('tavern', tavernService);
                // Initialize tavern state
                tavernService.initTavern();
                engine.log?.info?.('tavern', 'Tavern service registered with engine', {
                    service: !!tavernService
                });
            }
            catch (e) {
                engine.log?.error?.('tavern', 'Failed to register tavern service', { error: e.message });
            }
        },
        start(engine) {
            // Tavern service is now ready and can be accessed via engine.getService('tavern')
            engine.log?.info?.('tavern', 'Tavern service started and ready');
        },
        stop(engine) {
            engine.log?.info?.('tavern', 'Tavern service stopped');
        },
        dispose(engine) {
            // Service cleanup (engine doesn't have unregisterService method)
            tavernService = null;
        }
    };
}
//# sourceMappingURL=tavernServicePlugin.js.map