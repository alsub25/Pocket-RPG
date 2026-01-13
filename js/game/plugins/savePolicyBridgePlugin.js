// js/game/plugins/savePolicyBridgePlugin.js
// Game plugin: connect engine.savePolicy to the game's saveGame() implementation.

export function createSavePolicyBridgePlugin({
  saveGame = null,
  getState = null,
  isUiDisabled = null
} = {}) {
  return {
    id: 'ew.savePolicyBridge',
    init(engine) {
      const savePolicy = engine?.getService?.('savePolicy') || engine?.savePolicy || null
      if (!savePolicy) return

      // Writer: call the orchestrator's saveGame() function.
      if (typeof saveGame === 'function') {
        try {
          savePolicy.setWriter(() => {
            // Force writer to be synchronous from savePolicy's POV.
            // If saveGame is async in the future, wrap in a sync shim that
            // schedules async work and throws on immediate failures.
            saveGame()
          })
        } catch (_) {}
      }

      // Safe-to-save predicate: avoid saving in combat or when UI is disabled
      // (smoke tests/sandbox modals).
      try {
        savePolicy.setSafePredicate(() => {
          const s = typeof getState === 'function' ? getState() : engine?.getState?.()
          if (s && s.inCombat) return false
          try { if (typeof isUiDisabled === 'function' && isUiDisabled()) return false } catch (_) {}
          return true
        })
      } catch (_) {}
    }
  }
}
