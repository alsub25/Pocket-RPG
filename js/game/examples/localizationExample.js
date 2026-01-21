// js/game/examples/localizationExample.js
// Example integration of AI-powered localization system

/**
 * Example: Adding language selector to settings screen
 */

import { createLanguageSelector, applyTranslations } from '../ui/languageSelector.js'
import { showLanguageChangeToast } from '../utils/localizationHelpers.js'
import { SUPPORTED_LANGUAGES } from '../services/aiTranslationService.js'

export function addLanguageSelectorToSettings(engine) {
  const settingsContainer = document.getElementById('settings-language-section')
  
  if (!settingsContainer) {
    console.warn('Settings container not found')
    return
  }

  createLanguageSelector(engine, settingsContainer, (newLocale) => {
    console.log('Language changed to:', newLocale)
    const languageName = SUPPORTED_LANGUAGES[newLocale]?.nativeName || newLocale
    showLanguageChangeToast(languageName)
    applyTranslations(engine)
    
    const settings = engine.getService?.('settings')
    if (settings) {
      settings.set('localization.language', newLocale, { persist: true })
    }
  })
}

/**
 * Example: Initializing localization on game start
 */

export function initializeLocalization(engine) {
  const i18n = engine.getService?.('i18n') || engine.i18n
  const settings = engine.getService?.('settings')
  
  if (!i18n || !settings) {
    console.warn('i18n or settings service not available')
    return
  }

  const savedLanguage = settings.get('localization.language', 'en-US')
  i18n.setLocale(savedLanguage)
  
  setTimeout(() => {
    applyTranslations(engine)
  }, 100)
}
