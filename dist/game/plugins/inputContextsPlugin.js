// js/game/plugins/inputContextsPlugin.js
// Pushes/pops Engine input contexts for screens and modals.
export function createInputContextsPlugin() {
    return {
        id: 'ew.inputContexts',
        requires: ['ew.uiRuntime'],
        start(engine) {
            if (!engine || !engine.input)
                return;
            // Base bindings that make sense across the whole game.
            engine.input.pushContext({
                id: 'global',
                consume: false,
                bindings: {
                    escape: 'UI_ESCAPE',
                    c: 'UI_OPEN_CHARACTER',
                    j: 'UI_OPEN_QUEST_JOURNAL',
                    q: 'UI_OPEN_QUEST_JOURNAL',
                    f1: 'UI_TOGGLE_DIAGNOSTICS'
                },
            });
            const onScreenEnter = (p) => {
                const name = p && p.screen ? String(p.screen) : '';
                if (!name)
                    return;
                engine.input.pushContext({
                    id: `screen:${name}`,
                    consume: false,
                    bindings: { escape: 'UI_ESCAPE' },
                    meta: { kind: 'screen', screen: name }
                });
            };
            const onScreenLeave = (p) => {
                const name = p && p.screen ? String(p.screen) : '';
                if (!name)
                    return;
                engine.input.removeContext(`screen:${name}`);
            };
            const onModalOpen = (p) => {
                const owner = p && p.owner ? String(p.owner) : '';
                if (!owner)
                    return;
                engine.input.pushContext({
                    id: owner,
                    consume: true,
                    bindings: { escape: 'UI_ESCAPE' },
                    meta: { kind: 'modal', owner }
                });
            };
            const onModalClose = (p) => {
                const owner = p && p.owner ? String(p.owner) : '';
                if (!owner)
                    return;
                engine.input.removeContext(owner);
            };
            engine.__ewInputContextsHandlers = { onScreenEnter, onScreenLeave, onModalOpen, onModalClose };
            engine.on('screen:enter', onScreenEnter);
            engine.on('screen:leave', onScreenLeave);
            engine.on('modal:open', onModalOpen);
            engine.on('modal:close', onModalClose);
        },
        stop(engine) {
            try {
                const h = engine.__ewInputContextsHandlers;
                if (h && h.onScreenEnter)
                    engine.off('screen:enter', h.onScreenEnter);
                if (h && h.onScreenLeave)
                    engine.off('screen:leave', h.onScreenLeave);
                if (h && h.onModalOpen)
                    engine.off('modal:open', h.onModalOpen);
                if (h && h.onModalClose)
                    engine.off('modal:close', h.onModalClose);
            }
            catch (_) { }
            try {
                delete engine.__ewInputContextsHandlers;
            }
            catch (_) { }
            try {
                engine.input.removeContext('global');
            }
            catch (_) { }
        }
    };
}
//# sourceMappingURL=inputContextsPlugin.js.map