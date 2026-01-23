// js/game/plugins/companionRuntimePlugin.js
// Engine plugin: Companion runtime (AI, cooldowns, scaling, ability execution)
import { createCompanionRuntime } from '../combat/companionRuntime.js';
export function createCompanionRuntimePlugin(opts = {}) {
    const deps = (opts && typeof opts.deps === 'object') ? opts.deps : {};
    let runtime = null;
    return {
        id: 'ew.companionRuntime',
        init(engine) {
            runtime = createCompanionRuntime(deps);
            try {
                engine.registerService('companionRuntime', runtime);
            }
            catch (_) { }
            try {
                engine.registerService('combat.companion', runtime);
            }
            catch (_) { }
        },
        dispose() {
            runtime = null;
        }
    };
}
//# sourceMappingURL=companionRuntimePlugin.js.map