// js/game/plugins/uiComposeBridgePlugin.js
// Game plugin: installs a DOM adapter for engine.uiCompose.
import { showToast, setBusyOverlay, applyUiTransition, applyHudState } from '../ui/runtime/uiRuntime.js';
export function createUiComposeBridgePlugin() {
    return {
        id: 'ew.uiComposeBridge',
        requires: ['ew.uiRuntime'],
        init(engine) {
            const uiCompose = engine?.getService?.('uiCompose') || engine?.uiCompose || null;
            if (!uiCompose || typeof uiCompose.setAdapter !== 'function')
                return;
            try {
                uiCompose.setAdapter({
                    toast: (msg, opts) => { try {
                        showToast(msg, opts);
                    }
                    catch (_) { } },
                    setBusy: (busy, opts) => { try {
                        setBusyOverlay(busy, opts);
                    }
                    catch (_) { } },
                    transition: (name, opts) => { try {
                        applyUiTransition(name, opts);
                    }
                    catch (_) { } },
                    clearTransition: (name) => { try {
                        applyUiTransition(null, { clear: true, name });
                    }
                    catch (_) { } },
                    setHudState: (st) => { try {
                        applyHudState(st);
                    }
                    catch (_) { } }
                });
            }
            catch (_) { }
        }
    };
}
//# sourceMappingURL=uiComposeBridgePlugin.js.map