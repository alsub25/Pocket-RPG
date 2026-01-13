// js/game/plugins/settingsPlugin.js
// Seeds + loads engine.settings and keeps key preferences mirrored into game state.

import { safeStorageGet } from '../../engine/storageRuntime.js'

function _num(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

export function createSettingsPlugin({ getState } = {}) {
  return {
    id: 'ew.settings',
    start(engine) {
      const settings = engine && engine.getService ? engine.getService('settings') : null
      if (!settings) return

      // Defaults are intentionally conservative so existing saves behave the same.
      settings.defineDefaults({
        ui: {
          theme: 'default',
          colorScheme: 'auto',
          scale: 1,
          // 0–200 (UI log pacing)
          textSpeed: 100
        },
        a11y: {
          // tri-state: true | false | 'auto'
          reduceMotion: 'auto',
          highContrast: 'auto',
          // scales rem-based typography
          textScale: 1
        },
        audio: {
          // 0–100
          masterVolume: 100,
          musicEnabled: true,
          sfxEnabled: true
        },
        gameplay: {
          autoEquipLoot: false
        }
      })

      // If no unified settings record exists yet, migrate legacy keys.
      const hadUnified = !!safeStorageGet('locus_settings_v1')
      const loaded = settings.load()

      if (!hadUnified) {
        try {
          const theme = safeStorageGet('pq-theme')
          if (theme) settings.set('ui.theme', String(theme), { persist: false })
        } catch (_) {}
        try {
          const rm = safeStorageGet('pq-reduce-motion')
          if (rm === '1') settings.set('a11y.reduceMotion', true, { persist: false })
          else if (rm === '0') settings.set('a11y.reduceMotion', false, { persist: false })
        } catch (_) {}
        try {
          // Legacy builds used both pq-volume and pq-master-volume.
          const vol = safeStorageGet('pq-master-volume') ?? safeStorageGet('pq-volume')
          if (vol != null && vol !== '') settings.set('audio.masterVolume', _num(vol, 100), { persist: false })
        } catch (_) {}

        try {
          const ts = safeStorageGet('pq-text-speed')
          if (ts != null && ts !== '') settings.set('ui.textSpeed', _num(ts, 100), { persist: false })
        } catch (_) {}

        try {
          const m = safeStorageGet('pq-music-enabled')
          if (m === '1') settings.set('audio.musicEnabled', true, { persist: false })
          else if (m === '0') settings.set('audio.musicEnabled', false, { persist: false })
        } catch (_) {}

        try {
          const s = safeStorageGet('pq-sfx-enabled')
          if (s === '1') settings.set('audio.sfxEnabled', true, { persist: false })
          else if (s === '0') settings.set('audio.sfxEnabled', false, { persist: false })
        } catch (_) {}

        try {
          const ae = safeStorageGet('pq-auto-equip-loot')
          if (ae === '1') settings.set('gameplay.autoEquipLoot', true, { persist: false })
          else if (ae === '0') settings.set('gameplay.autoEquipLoot', false, { persist: false })
        } catch (_) {}

        // Persist migrated snapshot.
        settings.save()
      }

      // Mirror key settings into game state for backwards compatibility.
      const state = (typeof getState === 'function') ? getState() : (engine.getState ? engine.getState() : null)
      if (state) {
        try {
          const vol = settings.get('audio.masterVolume', state.settingsVolume)
          if (typeof vol === 'number' && Number.isFinite(vol)) state.settingsVolume = Math.max(0, Math.min(100, vol))
        } catch (_) {}

        try {
          const ts = settings.get('ui.textSpeed', state.settingsTextSpeed)
          if (typeof ts === 'number' && Number.isFinite(ts)) state.settingsTextSpeed = Math.max(0, Math.min(200, ts))
        } catch (_) {}

        try {
          const me = settings.get('audio.musicEnabled', state.musicEnabled)
          if (typeof me === 'boolean') state.musicEnabled = me
        } catch (_) {}

        try {
          const se = settings.get('audio.sfxEnabled', state.sfxEnabled)
          if (typeof se === 'boolean') state.sfxEnabled = se
        } catch (_) {}

        try {
          const ae = settings.get('gameplay.autoEquipLoot', state.settingsAutoEquipLoot)
          if (typeof ae === 'boolean') state.settingsAutoEquipLoot = ae
        } catch (_) {}

        // reduceMotion is still stored in state; keep it in sync.
        try {
          const rmPref = settings.get('a11y.reduceMotion', 'auto')
          if (rmPref === true) state.settingsReduceMotion = true
          else if (rmPref === false) state.settingsReduceMotion = false
          // 'auto' leaves state as-is; a11y service will compute the effective preference.
        } catch (_) {}
      }

      // Keep state mirrored when settings change.
      try {
        engine.listen('system:settings', 'settings:changed', (evt) => {
          const k = evt && evt.key ? String(evt.key) : ''
          const v = evt ? evt.value : undefined
          const st = (typeof getState === 'function') ? getState() : (engine.getState ? engine.getState() : null)
          if (!st) return

          if (k === 'audio.masterVolume') {
            const nv = _num(v, st.settingsVolume)
            if (Number.isFinite(nv)) st.settingsVolume = Math.max(0, Math.min(100, nv))
          }
          if (k === 'ui.textSpeed') {
            const nv = _num(v, st.settingsTextSpeed)
            if (Number.isFinite(nv)) st.settingsTextSpeed = Math.max(0, Math.min(200, nv))
          }
          if (k === 'audio.musicEnabled') {
            if (typeof v === 'boolean') st.musicEnabled = v
          }
          if (k === 'audio.sfxEnabled') {
            if (typeof v === 'boolean') st.sfxEnabled = v
          }
          if (k === 'gameplay.autoEquipLoot') {
            if (typeof v === 'boolean') st.settingsAutoEquipLoot = v
          }
          if (k === 'a11y.reduceMotion') {
            if (v === true) st.settingsReduceMotion = true
            else if (v === false) st.settingsReduceMotion = false
            // 'auto' => don't force a stored bool
          }
        })
      } catch (_) {}
    },

    stop(engine) {
      try {
        if (engine && typeof engine.disposeOwner === 'function') engine.disposeOwner('system:settings')
      } catch (_) {}
    },

    dispose(engine) {
      try {
        if (engine && typeof engine.disposeOwner === 'function') engine.disposeOwner('system:settings')
      } catch (_) {}
    }
  }
}
