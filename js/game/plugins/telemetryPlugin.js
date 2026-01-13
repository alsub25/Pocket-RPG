// js/game/plugins/telemetryPlugin.js
// Game plugin: start telemetry and provide compact game context.

export function createTelemetryPlugin({ getState } = {}) {
  return {
    id: 'ew.telemetry',
    requires: ['ew.flags'],
    init(engine) {
      const telemetry = engine?.getService?.('telemetry') || engine?.telemetry || null
      if (!telemetry) return
      try {
        telemetry.setContextProvider(() => {
          const s = typeof getState === 'function' ? getState() : engine?.getState?.()
          if (!s || typeof s !== 'object') return null
          return {
            area: s.area || null,
            inCombat: !!s.inCombat,
            player: s.player ? { name: s.player.name, classId: s.player.classId, level: s.player.level } : null
          }
        })
      } catch (_) {}
    },
    start(engine) {
      const telemetry = engine?.getService?.('telemetry') || engine?.telemetry || null
      try { telemetry?.start?.() } catch (_) {}
    },
    stop(engine) {
      const telemetry = engine?.getService?.('telemetry') || engine?.telemetry || null
      try { telemetry?.stop?.() } catch (_) {}
    }
  }
}
