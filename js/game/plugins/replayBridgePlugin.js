// js/game/plugins/replayBridgePlugin.js
// Game plugin: optional bridge for deterministic replay helpers.

export function createReplayBridgePlugin({ getState } = {}) {
  return {
    id: 'ew.replayBridge',
    requires: ['ew.flags', 'ew.rngBridge'],
    init(engine) {
      const replay = engine?.getService?.('replay') || engine?.replay || null
      if (!replay) return

      // Expose replay helper in services
      try { engine.registerService('replay', replay) } catch (_) {}
    },
    start(engine) {
      // Optional dev hotkeys: Shift+R to toggle recording.
      const flags = engine?.getService?.('flags') || engine?.flags || null
      const enabled = (() => {
        try { return !!flags?.isEnabled?.('replay.enableDevHotkeys') } catch (_) { return false }
      })()
      if (!enabled) return

      const handler = (e) => {
        try {
          if (!e) return
          if (!e.shiftKey) return
          const k = (e.key || '').toLowerCase()
          if (k !== 'r') return
          const r = engine?.getService?.('replay') || engine?.replay
          if (!r) return
          if (r.isRecording()) r.stopRecording()
          else r.startRecording({ name: 'hotkey' })
        } catch (_) {}
      }
      engine.__ewReplayHotkey = handler
      try { window.addEventListener('keydown', handler) } catch (_) {}
    },
    stop(engine) {
      const handler = engine.__ewReplayHotkey
      if (handler) {
        try { window.removeEventListener('keydown', handler) } catch (_) {}
      }
      engine.__ewReplayHotkey = null
    }
  }
}
