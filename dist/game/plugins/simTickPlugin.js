// js/game/plugins/simTickPlugin.js
// Ensures daily tick processing doesn't fall behind (especially after legacy loads).
export function createSimTickPlugin({ getState, runDailyTicks } = {}) {
    return {
        id: 'ew.simTick',
        start(engine) {
            if (!engine)
                return;
            const check = () => {
                const state = typeof getState === 'function' ? getState() : engine.getState();
                if (!state || !state.time)
                    return;
                const day = Math.floor(Number(state.time.dayIndex || 0));
                state.sim = state.sim || {};
                const last = Math.floor(Number(state.sim.lastDailyTickDay ?? day));
                if (day <= last)
                    return;
                if (typeof runDailyTicks === 'function') {
                    for (let d = last + 1; d <= day; d++) {
                        try {
                            runDailyTicks(state, d);
                        }
                        catch (_) { }
                    }
                }
                state.sim.lastDailyTickDay = day;
                try {
                    engine.emit('sim:dailyTicksCatchUp', { from: last, to: day });
                }
                catch (_) { }
            };
            engine.__ewSimTickCheck = check;
            // Periodic check (lightweight).
            try {
                if (engine.schedule && typeof engine.schedule.every === 'function') {
                    engine.__ewSimTickTimer = engine.schedule.every(1500, check, { owner: 'system:simTick' });
                }
            }
            catch (_) { }
            // Also check on load events.
            try {
                engine.on('save:loaded', check);
            }
            catch (_) { }
            // Run once immediately.
            try {
                check();
            }
            catch (_) { }
        },
        stop(engine) {
            try {
                if (engine && engine.__ewSimTickCheck)
                    engine.off('save:loaded', engine.__ewSimTickCheck);
            }
            catch (_) { }
            try {
                if (engine && engine.__ewSimTickTimer && engine.schedule && typeof engine.schedule.cancel === 'function') {
                    engine.schedule.cancel(engine.__ewSimTickTimer);
                }
            }
            catch (_) { }
            engine.__ewSimTickTimer = null;
            try {
                delete engine.__ewSimTickCheck;
            }
            catch (_) { }
        }
    };
}
//# sourceMappingURL=simTickPlugin.js.map