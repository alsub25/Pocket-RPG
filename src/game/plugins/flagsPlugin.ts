// js/game/plugins/flagsPlugin.js
// Game plugin: define + load feature flags.

export function createFlagsPlugin({ defaults = null } = {}) {
  return {
    id: 'ew.flags',
    init(engine) {
      const flags = engine?.getService?.('flags') || engine?.flags || null
      if (!flags) return

      // Defaults are safe even if some aren't used yet.
      const baseDefaults = {
        'telemetry.persistCrashes': true,
        'telemetry.includeStateInCrash': false,
        'ui.toastAutosave': true,
        'replay.enableDevHotkeys': false
      }
      try { flags.defineDefaults({ ...baseDefaults, ...(defaults || {}) }) } catch (_) {}
      try { flags.load() } catch (_) {}
    }
  }
}
