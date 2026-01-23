// js/game/services/kingdomGovernmentService.js
// Engine-integrated kingdom government service
// 
// This service wraps the kingdom government system to ensure all state changes
// go through the engine properly with immutable updates and event emissions.
import { initGovernmentState as initGovState, handleGovernmentDayTick as handleGovDayTick, getGovernmentSummary as getGovSummary, getVillageGovernmentEffect } from '../systems/kingdomGovernment.js';
/**
 * Creates an engine-integrated kingdom government service.
 * All kingdom state mutations go through engine.setState() with immutable updates.
 * All kingdom changes emit events for other systems to react.
 */
export function createKingdomGovernmentService(engine) {
    if (!engine)
        throw new Error('KingdomGovernmentService requires engine instance');
    /**
     * Initialize kingdom government state if missing
     */
    function initKingdom(state) {
        if (!state.kingdomGovernment || typeof state.kingdomGovernment !== 'object') {
            const timeState = state.time || { dayIndex: 0 };
            const absoluteDay = timeState.dayIndex || 0;
            // Use the original initGovernmentState function to create initial state
            // but in a pure way - create a temporary object
            const tempState = { flags: state.flags || {} };
            initGovState(tempState, absoluteDay);
            return {
                ...state,
                kingdomGovernment: tempState.kingdomGovernment
            };
        }
        return state;
    }
    /**
     * Handle daily government tick with immutable state updates
     */
    function handleDayTick(absoluteDay) {
        const state = engine.getState();
        const stateWithKingdom = initKingdom(state);
        if (stateWithKingdom !== state) {
            engine.setState(stateWithKingdom);
        }
        const currentState = engine.getState();
        // Create a mutable copy for the legacy function to work with
        // Note: Deep clone required because legacy kingdom system mutates state
        const tempState = JSON.parse(JSON.stringify(currentState));
        // Run the day tick on the copy
        const hooks = {
            addLog: (msg, category) => {
                try {
                    const ui = engine.get('ui');
                    if (ui && ui.addLog) {
                        ui.addLog(msg, category);
                    }
                }
                catch (err) {
                    // Log service access failed - not critical for kingdom tick
                    engine.log?.warn?.('kingdom', 'Failed to add log during tick', { error: err.message });
                }
            }
        };
        handleGovDayTick(tempState, absoluteDay, hooks);
        // Now update the real state immutably
        const newState = {
            ...currentState,
            kingdomGovernment: tempState.kingdomGovernment,
            flags: tempState.flags
        };
        engine.setState(newState);
        // Emit event for kingdom government tick
        engine.emit('kingdom:dayTick', {
            day: absoluteDay,
            government: newState.kingdomGovernment
        });
    }
    /**
     * Get kingdom government summary
     */
    function getSummary() {
        const state = engine.getState();
        const stateWithKingdom = initKingdom(state);
        if (stateWithKingdom !== state) {
            engine.setState(stateWithKingdom);
        }
        return getGovSummary(engine.getState());
    }
    /**
     * Get village government effect for an area
     */
    function getVillageEffect(areaId) {
        const state = engine.getState();
        const stateWithKingdom = initKingdom(state);
        if (stateWithKingdom !== state) {
            engine.setState(stateWithKingdom);
        }
        return getVillageGovernmentEffect(engine.getState(), areaId);
    }
    /**
     * Initialize kingdom state in the engine
     */
    function initializeState() {
        const state = engine.getState();
        const newState = initKingdom(state);
        if (newState !== state) {
            engine.setState(newState);
            engine.emit('kingdom:initialized', {
                government: newState.kingdomGovernment
            });
        }
    }
    // Public API
    return {
        initializeState,
        handleDayTick,
        getSummary,
        getVillageEffect
    };
}
//# sourceMappingURL=kingdomGovernmentService.js.map