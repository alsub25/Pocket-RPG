// js/game/plugins/i18nPlugin.js
// Game plugin: seed localization dictionary.

export function createI18nPlugin({
  locale = null,
  dictByLocale = null
} = {}) {
  return {
    id: 'ew.i18n',
    init(engine) {
      const i18n = engine?.getService?.('i18n') || engine?.i18n || null
      if (!i18n) return

      const dicts = dictByLocale || {
        'en-US': {
          'toast.saved': 'Saved.',
          'toast.saving': 'Saving…',
          'toast.replay.recording': 'Recording replay…',
          'toast.replay.stopped': 'Replay captured.',
          'toast.replay.playing': 'Playing replay…'
        }
      }
      try {
        Object.keys(dicts).forEach((loc) => {
          try { i18n.register(loc, dicts[loc]) } catch (_) {}
        })
      } catch (_) {}

      const chosen = locale || (typeof navigator !== 'undefined' ? navigator.language : null)
      if (chosen) {
        try { i18n.setLocale(chosen) } catch (_) {}
      }
    }
  }
}
