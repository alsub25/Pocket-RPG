// js/game/data/locales/index.js
// Localization data index - exports all language translations

import { translations as enUS } from './en-US.js'
import { translations as esES } from './es-ES.js'

// Export all translations by language code
export const localeData = {
  'en-US': enUS,
  'es-ES': esES
}

// Export function to get translations for a specific locale
export function getLocaleTranslations(locale) {
  return localeData[locale] || localeData['en-US']
}

// Export list of available locales
export function getAvailableLocales() {
  return Object.keys(localeData)
}
