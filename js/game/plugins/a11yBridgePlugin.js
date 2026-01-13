// js/game/plugins/a11yBridgePlugin.js
// Applies engine.settings + engine.a11y to the DOM (theme, reduced motion, text scale, contrast).

import { safeStorageSet } from '../../engine/storageRuntime.js'

function _clamp(n, lo, hi) {
  const v = Number(n)
  if (!Number.isFinite(v)) return lo
  return Math.max(lo, Math.min(hi, v))
}

function _applyTheme(theme) {
  if (typeof document === 'undefined' || !document.body) return
  const t = String(theme || 'default')
  document.body.classList.remove('theme-arcane','theme-inferno','theme-forest','theme-holy','theme-shadow')
  if (t && t !== 'default') document.body.classList.add('theme-' + t)
}

export function createA11yBridgePlugin() {
  return {
    id: 'ew.a11yBridge',
    requires: ['ew.settings'],

    start(engine) {
      const settings = engine && engine.getService ? engine.getService('settings') : null
      const a11y = engine && engine.getService ? engine.getService('a11y') : null
      if (!settings || !a11y) return

      const apply = () => {
        if (typeof document === 'undefined' || !document.body) return
        const derived = a11y.compute()
        try {
          document.body.classList.toggle('no-motion', !!derived.reduceMotion)
          document.body.classList.toggle('high-contrast', !!derived.highContrast)
          document.body.dataset.colorScheme = String(derived.colorScheme || 'light')

          // Theme (separate from color scheme)
          const theme = settings.get('ui.theme', 'default')
          _applyTheme(theme)

          // Text scaling: scale rem-based tokens by adjusting the root font-size.
          const scale = _clamp(derived.textScale || 1, 0.85, 1.25)
          try { document.documentElement.style.fontSize = String(16 * scale) + 'px' } catch (_) {}

          // Persist legacy keys for backwards compatibility with older builds.
          try { safeStorageSet('pq-theme', theme, { action: 'write theme' }) } catch (_) {}
          try {
            const pref = settings.get('a11y.reduceMotion', 'auto')
            if (pref === true) safeStorageSet('pq-reduce-motion', '1', { action: 'write reduce motion' })
            else if (pref === false) safeStorageSet('pq-reduce-motion', '0', { action: 'write reduce motion' })
          } catch (_) {}
        } catch (_) {}
      }

      // Apply once.
      apply()

      // Track OS-level changes.
      try {
        const disposeEnv = a11y.startEnvListeners({ owner: 'system:a11y' })
        engine.own('system:a11y', disposeEnv)
      } catch (_) {}

      // Re-apply when settings/env changes.
      try {
        engine.listen('system:a11y', 'settings:changed', () => apply())
        engine.listen('system:a11y', 'a11y:changed', () => apply())
        engine.listen('system:a11y', 'a11y:envChanged', () => apply())
      } catch (_) {}
    },

    stop(engine) {
      try { if (engine && engine.disposeOwner) engine.disposeOwner('system:a11y') } catch (_) {}
    },

    dispose(engine) {
      try { if (engine && engine.disposeOwner) engine.disposeOwner('system:a11y') } catch (_) {}
    }
  }
}
