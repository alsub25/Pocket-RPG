// js/game/plugins/questSystemPlugin.js
// Plugin to register quest system service with the engine
//
// This plugin ensures the quest system runs through the engine
// properly with immutable state updates and event emissions.
import { createQuestSystemService } from '../services/questSystemService.js';
export function createQuestSystemPlugin() {
    let questService = null;
    let itemGainedHandler = null;
    let enemyDefeatedHandler = null;
    return {
        id: 'ew.questSystem',
        requires: ['ew.uiRuntime'], // Needs UI service for logging
        init(engine) {
            try {
                questService = createQuestSystemService(engine);
                engine.registerService('quest.system', questService);
                // Initialize quest state
                questService.initializeState();
                engine.log?.info?.('quest', 'Quest system service registered with engine');
            }
            catch (e) {
                engine.log?.error?.('quest', 'Failed to register quest system service', {
                    error: e.message
                });
            }
        },
        start(engine) {
            // Listen for world events to update quest progress
            itemGainedHandler = (payload) => {
                if (questService && payload.itemId) {
                    const quantity = payload.quantity || payload.qty || 1;
                    questService.applyItemProgress(payload.itemId, quantity);
                }
            };
            engine.on('world:itemGained', itemGainedHandler);
            enemyDefeatedHandler = (payload) => {
                if (questService && payload.enemy) {
                    questService.applyEnemyProgress(payload.enemy);
                }
            };
            engine.on('world:enemyDefeated', enemyDefeatedHandler);
            engine.log?.info?.('quest', 'Quest system service started and listening for events');
        },
        stop(engine) {
            // Cleanup event listeners
            if (itemGainedHandler) {
                engine.off('world:itemGained', itemGainedHandler);
                itemGainedHandler = null;
            }
            if (enemyDefeatedHandler) {
                engine.off('world:enemyDefeated', enemyDefeatedHandler);
                enemyDefeatedHandler = null;
            }
            engine.log?.info?.('quest', 'Quest system service stopped');
        },
        dispose(engine) {
            // Unregister service
            try {
                if (questService) {
                    engine.unregisterService('quest.system');
                }
            }
            catch (e) {
                engine.log?.error?.('quest', 'Failed to unregister quest system service', {
                    error: e.message
                });
            }
            questService = null;
        }
    };
}
//# sourceMappingURL=questSystemPlugin.js.map