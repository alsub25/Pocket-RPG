// js/game/plugins/lootGeneratorPlugin.js
// Plugin to register loot generator service with the engine
//
// This plugin ensures the loot generation system runs through the engine
// with proper event emissions for telemetry and tracking.
import { createLootGeneratorService } from '../services/lootGeneratorService.js';
export function createLootGeneratorPlugin() {
    let lootService = null;
    return {
        id: 'ew.lootGenerator',
        requires: ['ew.rngBridge'], // Needs RNG service
        init(engine) {
            try {
                lootService = createLootGeneratorService(engine);
                engine.registerService('loot.generator', lootService);
                engine.log?.info?.('loot', 'Loot generator service registered with engine');
            }
            catch (e) {
                engine.log?.error?.('loot', 'Failed to register loot generator service', {
                    error: e.message
                });
            }
        },
        start(engine) {
            engine.log?.info?.('loot', 'Loot generator service started');
        },
        stop(engine) {
            engine.log?.info?.('loot', 'Loot generator service stopped');
        },
        dispose(engine) {
            // Unregister service
            try {
                if (lootService) {
                    engine.unregisterService('loot.generator');
                }
            }
            catch (e) {
                engine.log?.error?.('loot', 'Failed to unregister loot generator service', {
                    error: e.message
                });
            }
            lootService = null;
        }
    };
}
//# sourceMappingURL=lootGeneratorPlugin.js.map