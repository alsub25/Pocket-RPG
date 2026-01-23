// js/game/plugins/merchantServicePlugin.js
// Plugin to register merchant service with the engine
//
// This plugin exposes commerce operations (buying, selling, restocking)
// as an engine service and handles merchant commands through the engine.
import { createMerchantService } from '../services/merchantService.js';
export function createMerchantServicePlugin() {
    let merchantService = null;
    let dayTickHandler = null;
    return {
        id: 'ew.merchantService',
        requires: ['ew.timeService'], // Needs time for restocking
        init(engine) {
            try {
                // Create and register merchant service
                merchantService = createMerchantService(engine);
                engine.registerService('merchant', merchantService);
                // Initialize merchant state
                merchantService.initMerchant();
                engine.log?.info?.('merchant', 'Merchant service registered with engine', {
                    service: !!merchantService
                });
            }
            catch (e) {
                engine.log?.error?.('merchant', 'Failed to register merchant service', { error: e.message });
            }
        },
        start(engine) {
            // Listen for time advancement to restock
            dayTickHandler = (payload) => {
                if (merchantService && typeof payload.newDay === 'number') {
                    merchantService.handleDayTick(payload.newDay);
                }
            };
            engine.on('time:dayChanged', dayTickHandler);
            engine.log?.info?.('merchant', 'Merchant service started and listening for events');
        },
        stop(engine) {
            // Cleanup event listeners
            if (dayTickHandler) {
                engine.off('time:dayChanged', dayTickHandler);
                dayTickHandler = null;
            }
            engine.log?.info?.('merchant', 'Merchant service stopped');
        },
        dispose(engine) {
            // Service cleanup (engine doesn't have unregisterService method)
            merchantService = null;
        }
    };
}
//# sourceMappingURL=merchantServicePlugin.js.map