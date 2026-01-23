// js/game/services/villagePopulationService.js
// Engine-integrated village population service
// 
// This service wraps the village population system to ensure all state changes
// go through the engine properly with immutable updates and event emissions.
// Constants
const MOOD_DRIFT_AMOUNT = 1; // How much mood drifts toward neutral per day
const MOOD_DRIFT_MESSAGE = 'Villager tempers settle toward neutral overnight.';
/**
 * Creates an engine-integrated village population service.
 * All state mutations go through engine.setState() with immutable updates.
 * All significant changes emit events for other systems to react.
 */
export function createVillagePopulationService(engine) {
    if (!engine)
        throw new Error('VillagePopulationService requires engine instance');
    const rng = engine.get('rng');
    if (!rng)
        throw new Error('VillagePopulationService requires RNG service');
    /**
     * Initialize population state if missing
     */
    function initPopulation(state) {
        if (!state.village) {
            state = { ...state, village: {} };
        }
        if (!state.village.population) {
            const size = Math.floor(rng.random() * (1600 - 900) + 900);
            return {
                ...state,
                village: {
                    ...state.village,
                    population: {
                        size,
                        mood: 0, // -100..+100, 0 = neutral
                        lastDayUpdated: null,
                        lastMoodChange: null
                    }
                }
            };
        }
        return state;
    }
    /**
     * Adjust population size (immutable)
     */
    function adjustSize(delta) {
        const state = engine.getState();
        const stateWithPop = initPopulation(state);
        const pop = stateWithPop.village.population;
        const newSize = Math.max(0, pop.size + delta);
        const newState = {
            ...stateWithPop,
            village: {
                ...stateWithPop.village,
                population: {
                    ...pop,
                    size: newSize
                }
            }
        };
        engine.setState(newState);
        engine.emit('village:populationSizeChanged', {
            delta,
            newSize,
            oldSize: pop.size
        });
        return newSize;
    }
    /**
     * Adjust population mood (immutable)
     */
    function adjustMood(delta, reason = null) {
        const state = engine.getState();
        const stateWithPop = initPopulation(state);
        const pop = stateWithPop.village.population;
        const oldMood = pop.mood;
        const newMood = Math.max(-100, Math.min(100, oldMood + delta));
        const newState = {
            ...stateWithPop,
            village: {
                ...stateWithPop.village,
                population: {
                    ...pop,
                    mood: newMood
                }
            }
        };
        engine.setState(newState);
        engine.emit('village:populationMoodChanged', {
            delta,
            newMood,
            oldMood,
            reason
        });
        return newMood;
    }
    /**
     * Handle daily population tick (mood drift, decree effects)
     */
    function handleDayTick(absoluteDay) {
        const state = engine.getState();
        const stateWithPop = initPopulation(state);
        const pop = stateWithPop.village.population;
        // Guard against double-ticking
        if (pop.lastDayUpdated === absoluteDay)
            return;
        const reasons = [];
        const before = pop.mood;
        let newMood = before;
        // Mood naturally drifts toward neutral
        if (newMood > 0) {
            newMood -= MOOD_DRIFT_AMOUNT;
            reasons.push(MOOD_DRIFT_MESSAGE);
        }
        else if (newMood < 0) {
            newMood += MOOD_DRIFT_AMOUNT;
            reasons.push(MOOD_DRIFT_MESSAGE);
        }
        // Active Town Hall decrees can push mood daily
        const eff = state?.government?.townHallEffects;
        const today = typeof absoluteDay === 'number' ? Math.floor(absoluteDay) : 0;
        const isActive = eff &&
            eff.petitionId &&
            typeof eff.expiresOnDay === 'number' &&
            today <= eff.expiresOnDay;
        if (isActive) {
            const md = Number(eff.moodDailyDelta);
            const moodDeltaDaily = Number.isFinite(md) ? Math.round(md) : 0;
            if (moodDeltaDaily) {
                newMood = Math.max(-100, Math.min(100, newMood + moodDeltaDaily));
                if (eff.title) {
                    reasons.push(`"${eff.title}" sways the village mood.`);
                }
                else {
                    reasons.push('A Town Hall decree sways the village mood.');
                }
            }
        }
        const delta = newMood - before;
        // Create immutable update with shared base properties
        const baseChange = { day: absoluteDay };
        const lastMoodChange = delta
            ? { ...baseChange, delta, reasons }
            : { ...baseChange, delta: 0, reasons: [] };
        const newState = {
            ...stateWithPop,
            village: {
                ...stateWithPop.village,
                population: {
                    ...pop,
                    mood: newMood,
                    lastDayUpdated: absoluteDay,
                    lastMoodChange
                }
            }
        };
        engine.setState(newState);
        // Emit event
        engine.emit('village:populationTick', {
            day: absoluteDay,
            moodDelta: delta,
            newMood,
            reasons
        });
    }
    /**
     * Get current population state
     */
    function getPopulation() {
        const state = engine.getState();
        const stateWithPop = initPopulation(state);
        if (stateWithPop !== state) {
            engine.setState(stateWithPop);
        }
        return stateWithPop.village.population;
    }
    // Public API
    return {
        initPopulation: () => {
            const state = engine.getState();
            const newState = initPopulation(state);
            if (newState !== state) {
                engine.setState(newState);
            }
        },
        getPopulation,
        adjustSize,
        adjustMood,
        handleDayTick
    };
}
//# sourceMappingURL=villagePopulationService.js.map