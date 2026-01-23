// js/game/plugins/combatRuntimePlugin.js
// Engine plugin: Combat runtime engines (math, status, post-turn sequencer)
//
// This plugin creates and exposes:
// - CombatMath (damage / affinity / resist helpers)
// - StatusEngine (status ticking + synergy helpers)
// - TurnSequencer (post-player-turn async pipeline)
import { createCombatMath } from '../combat/math.js';
import { createStatusEngine } from '../combat/statusEngine.js';
import { createPostTurnSequencer } from '../combat/postTurnSequence.js';
export function createCombatRuntimePlugin(opts = {}) {
    const deps = (opts && typeof opts.deps === 'object') ? opts.deps : {};
    let combatMath = null;
    let statusEngine = null;
    let turnSequencer = null;
    return {
        id: 'ew.combatRuntime',
        init(engine) {
            // Build engines (these are pure JS helpers; no DOM).
            combatMath = createCombatMath(deps.combatMath || deps);
            statusEngine = createStatusEngine(deps.statusEngine || deps);
            turnSequencer = createPostTurnSequencer(deps.turnSequencer || deps);
            const combat = {
                math: combatMath,
                status: statusEngine,
                turnSequencer
            };
            try {
                engine.registerService('combat', combat);
            }
            catch (_) { }
            try {
                engine.registerService('combat.math', combatMath);
            }
            catch (_) { }
            try {
                engine.registerService('combat.status', statusEngine);
            }
            catch (_) { }
            try {
                engine.registerService('combat.turnSequencer', turnSequencer);
            }
            catch (_) { }
        },
        dispose() {
            combatMath = null;
            statusEngine = null;
            turnSequencer = null;
        }
    };
}
//# sourceMappingURL=combatRuntimePlugin.js.map