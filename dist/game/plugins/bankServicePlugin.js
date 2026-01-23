// js/game/plugins/bankServicePlugin.js
// Plugin to register bank service with the engine
//
// This plugin exposes banking operations (deposits, withdrawals, loans, investments)
// as an engine service and handles bank commands through the engine.
import { createBankService } from '../services/bankService.js';
export function createBankServicePlugin() {
    let bankService = null;
    let dayTickHandler = null;
    return {
        id: 'ew.bankService',
        requires: ['ew.rngBridge', 'ew.timeService'], // Needs RNG and time
        init(engine) {
            try {
                // Create and register bank service
                bankService = createBankService(engine);
                engine.registerService('bank', bankService);
                // Initialize bank state
                bankService.initBank();
                engine.log?.info?.('bank', 'Bank service registered with engine', {
                    service: !!bankService
                });
            }
            catch (e) {
                engine.log?.error?.('bank', 'Failed to register bank service', { error: e.message });
            }
        },
        start(engine) {
            // Listen for time advancement to process daily interest
            dayTickHandler = (payload) => {
                if (bankService && typeof payload.newDay === 'number') {
                    bankService.handleDayTick(payload.newDay);
                }
            };
            engine.on('time:dayChanged', dayTickHandler);
            engine.log?.info?.('bank', 'Bank service started and listening for events');
        },
        stop(engine) {
            // Cleanup event listeners
            if (dayTickHandler) {
                engine.off('time:dayChanged', dayTickHandler);
                dayTickHandler = null;
            }
            engine.log?.info?.('bank', 'Bank service stopped');
        },
        dispose(engine) {
            // Service cleanup (engine doesn't have unregisterService method)
            bankService = null;
        }
    };
}
//# sourceMappingURL=bankServicePlugin.js.map