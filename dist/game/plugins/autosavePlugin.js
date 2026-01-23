// js/game/plugins/autosavePlugin.js
// Event-driven autosave that coalesces rapid world events.
export function createAutosavePlugin({ saveGame } = {}) {
    return {
        id: 'ew.autosave',
        requires: ['ew.worldEvents'],
        init(engine) {
            engine.registerService('autosave', {
                request(reason = 'unknown') {
                    try {
                        engine.emit('autosave:request', { reason: String(reason || '') });
                    }
                    catch (_) { }
                    const savePolicy = engine.getService ? engine.getService('savePolicy') : null;
                    if (savePolicy && typeof savePolicy.markDirty === 'function') {
                        try {
                            savePolicy.markDirty('autosave:' + String(reason || 'unknown'));
                        }
                        catch (_) { }
                        try {
                            savePolicy.flush({ reason: 'autosave' });
                        }
                        catch (_) { }
                        return;
                    }
                    if (typeof saveGame !== 'function')
                        return;
                    // Coalesce requests into one save call.
                    try {
                        if (engine.__ewAutosaveTimer && engine.schedule && typeof engine.schedule.cancel === 'function') {
                            engine.schedule.cancel(engine.__ewAutosaveTimer);
                        }
                    }
                    catch (_) { }
                    try {
                        if (engine.schedule && typeof engine.schedule.after === 'function') {
                            engine.__ewAutosaveTimer = engine.schedule.after(700, () => {
                                engine.__ewAutosaveTimer = null;
                                try {
                                    saveGame();
                                }
                                catch (_) { }
                            }, { owner: 'system:autosave' });
                        }
                        else {
                            try {
                                saveGame();
                            }
                            catch (_) { }
                        }
                    }
                    catch (_) {
                        try {
                            saveGame();
                        }
                        catch (_) { }
                    }
                }
            });
        },
        start(engine) {
            const svc = engine.getService('autosave');
            if (!svc)
                return;
            const req = (reason) => { try {
                svc.request(reason);
            }
            catch (_) { } };
            const onLoot = () => req('loot');
            const onDefeat = () => req('enemyDefeated');
            const onBattleEnd = () => req('battleEnded');
            engine.__ewAutosaveHandlers = { onLoot, onDefeat, onBattleEnd };
            engine.on('world:itemGained', onLoot);
            engine.on('world:enemyDefeated', onDefeat);
            engine.on('world:battleEnded', onBattleEnd);
            // Autosave is silent by design: no popups, toasts, or banners.
            // (Manual saves already have explicit UX in the Save/Load UI.)
            // Periodic safety autosave (low frequency).
            try {
                if (engine.schedule && typeof engine.schedule.every === 'function') {
                    engine.__ewAutosavePeriodic = engine.schedule.every(120000, () => req('periodic'), {
                        owner: 'system:autosave'
                    });
                }
            }
            catch (_) { }
        },
        stop(engine) {
            try {
                const h = engine.__ewAutosaveHandlers;
                if (h && h.onLoot)
                    engine.off('world:itemGained', h.onLoot);
                if (h && h.onDefeat)
                    engine.off('world:enemyDefeated', h.onDefeat);
                if (h && h.onBattleEnd)
                    engine.off('world:battleEnded', h.onBattleEnd);
            }
            catch (_) { }
            try {
                delete engine.__ewAutosaveHandlers;
            }
            catch (_) { }
            try {
                if (engine.__ewAutosaveTimer && engine.schedule && typeof engine.schedule.cancel === 'function') {
                    engine.schedule.cancel(engine.__ewAutosaveTimer);
                }
            }
            catch (_) { }
            engine.__ewAutosaveTimer = null;
        }
    };
}
//# sourceMappingURL=autosavePlugin.js.map