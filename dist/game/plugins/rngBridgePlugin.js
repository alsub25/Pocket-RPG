// js/game/plugins/rngBridgePlugin.js
// Bridges the game's deterministic RNG helpers into an engine service.
import { rngFloat, rngInt, rngPick } from '../systems/rng.js';
export function createRngBridgePlugin({ getState } = {}) {
    return {
        id: 'ew.rngBridge',
        init(engine) {
            const getS = typeof getState === 'function' ? getState : () => engine.getState();
            engine.registerService('gameRng', {
                seed() {
                    try {
                        const s = getS();
                        return (s && s.debug) ? s.debug.rngSeed : null;
                    }
                    catch (_) {
                        return null;
                    }
                },
                float(tag) {
                    try {
                        return rngFloat(getS(), tag);
                    }
                    catch (_) {
                        return 0;
                    }
                },
                int(min, max, tag) {
                    try {
                        return rngInt(getS(), min, max, tag);
                    }
                    catch (_) {
                        return min;
                    }
                },
                pick(arr, tag) {
                    try {
                        return rngPick(getS(), arr, tag);
                    }
                    catch (_) {
                        return Array.isArray(arr) ? arr[0] : null;
                    }
                }
            });
        }
    };
}
//# sourceMappingURL=rngBridgePlugin.js.map