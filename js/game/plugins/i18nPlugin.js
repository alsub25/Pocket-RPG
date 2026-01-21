// js/game/plugins/i18nPlugin.js
// Game plugin: seed localization dictionary with AI translation support

import { getLocaleTranslations, getAvailableLocales } from '../data/locales/index.js'
import { createAiTranslationService, SUPPORTED_LANGUAGES } from '../services/aiTranslationService.js'

export function createI18nPlugin({
  locale = null,
  dictByLocale = null,
  aiTranslationEnabled = false,
  translationProvider = 'local',
  translationApiKey = null
} = {}) {
  return {
    id: 'ew.i18n',
    init(engine) {
      const i18n = engine?.getService?.('i18n') || engine?.i18n || null
      if (!i18n) return

      // Initialize AI translation service
      const aiTranslation = createAiTranslationService({
        apiProvider: translationProvider,
        apiKey: translationApiKey
      })

      // Store AI translation service on engine for access by other systems
      if (engine.setService) {
        engine.setService('aiTranslation', aiTranslation)
      } else if (engine) {
        engine.aiTranslation = aiTranslation
      }

      // Load base translations from locale data
      const baseTranslations = {
        'en-US': getLocaleTranslations('en-US'),
        'es-ES': getLocaleTranslations('es-ES')
      }

      // Merge with custom dictionaries if provided
      const dicts = dictByLocale || baseTranslations

      try {
        Object.keys(dicts).forEach((loc) => {
          try { i18n.register(loc, dicts[loc]) } catch (_) {}
        })
      } catch (_) {}

      // Set initial locale
      const chosen = locale || (typeof navigator !== 'undefined' ? navigator.language : null)
      if (chosen) {
        try { i18n.setLocale(chosen) } catch (_) {}
      }

      // Add helper method to translate with AI if enabled
      if (i18n && !i18n.translateWithAI) {
        i18n.translateWithAI = async function(text, targetLang = null) {
          if (!aiTranslationEnabled) {
            // Try translation key first, then return text as-is
            const translated = i18n.t(text)
            return translated !== text ? translated : text
          }

          const target = targetLang || i18n.getLocale()
          if (target === 'en-US') {
            return i18n.t(text)
          }

          try {
            const translated = await aiTranslation.translate(text, target, 'en-US')
            return translated
          } catch (error) {
            console.warn('AI translation failed, using fallback:', error)
            return i18n.t(text)
          }
        }
      }

      // Add method to get supported languages
      if (i18n && !i18n.getSupportedLanguages) {
        i18n.getSupportedLanguages = function() {
          return SUPPORTED_LANGUAGES
        }
      }

      // Add method to toggle AI translation
      if (i18n && !i18n.setAITranslationEnabled) {
        i18n.setAITranslationEnabled = function(enabled) {
          aiTranslationEnabled = enabled
          // Persist to settings if available
          if (engine.getService) {
            const settings = engine.getService('settings')
            if (settings) {
              settings.set('localization.aiTranslationEnabled', enabled, { persist: true })
            }
          }
        }
      }
    }
  }
}
