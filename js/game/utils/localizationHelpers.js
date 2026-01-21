// js/game/utils/localizationHelpers.js
// Helper utilities for localizing game content

/**
 * Translate game content dynamically
 * @param {Object} engine - Game engine instance
 * @param {string} key - Translation key
 * @param {Object} params - Optional parameters for interpolation
 * @returns {string} Translated text
 */
export function translate(engine, key, params = null) {
  const i18n = engine?.getService?.('i18n') || engine?.i18n
  if (!i18n) return key
  return i18n.t(key, params)
}

/**
 * Translate with AI if enabled
 * @param {Object} engine - Game engine instance
 * @param {string} text - Text to translate
 * @param {string} targetLang - Target language (optional, uses current locale)
 * @returns {Promise<string>} Translated text
 */
export async function translateWithAI(engine, text, targetLang = null) {
  const i18n = engine?.getService?.('i18n') || engine?.i18n
  if (!i18n || !i18n.translateWithAI) return text
  return await i18n.translateWithAI(text, targetLang)
}

/**
 * Translate item names and descriptions
 * @param {Object} engine - Game engine instance
 * @param {Object} item - Item object with name and description
 * @returns {Promise<Object>} Item with translated fields
 */
export async function translateItem(engine, item) {
  if (!item) return item

  const i18n = engine?.getService?.('i18n') || engine?.i18n
  const locale = i18n?.getLocale?.() || 'en-US'
  
  // If English, return as-is
  if (locale === 'en-US') return item

  const translatedItem = { ...item }

  // Try to translate name and description
  if (item.name) {
    translatedItem.name = await translateWithAI(engine, item.name)
  }
  
  if (item.description) {
    translatedItem.description = await translateWithAI(engine, item.description)
  }

  return translatedItem
}

/**
 * Translate ability names and descriptions
 * @param {Object} engine - Game engine instance
 * @param {Object} ability - Ability object with name and description
 * @returns {Promise<Object>} Ability with translated fields
 */
export async function translateAbility(engine, ability) {
  if (!ability) return ability

  const i18n = engine?.getService?.('i18n') || engine?.i18n
  const locale = i18n?.getLocale?.() || 'en-US'
  
  // If English, return as-is
  if (locale === 'en-US') return ability

  const translatedAbility = { ...ability }

  // Translate ability fields
  if (ability.name) {
    translatedAbility.name = await translateWithAI(engine, ability.name)
  }
  
  if (ability.description) {
    translatedAbility.description = await translateWithAI(engine, ability.description)
  }

  if (ability.tooltip) {
    translatedAbility.tooltip = await translateWithAI(engine, ability.tooltip)
  }

  return translatedAbility
}

/**
 * Translate quest data
 * @param {Object} engine - Game engine instance
 * @param {Object} quest - Quest object with name and description
 * @returns {Promise<Object>} Quest with translated fields
 */
export async function translateQuest(engine, quest) {
  if (!quest) return quest

  const i18n = engine?.getService?.('i18n') || engine?.i18n
  const locale = i18n?.getLocale?.() || 'en-US'
  
  // If English, return as-is
  if (locale === 'en-US') return quest

  const translatedQuest = { ...quest }

  // Translate quest fields
  if (quest.name) {
    translatedQuest.name = await translateWithAI(engine, quest.name)
  }
  
  if (quest.description) {
    translatedQuest.description = await translateWithAI(engine, quest.description)
  }

  if (quest.objective) {
    translatedQuest.objective = await translateWithAI(engine, quest.objective)
  }

  return translatedQuest
}

/**
 * Translate class information
 * @param {Object} engine - Game engine instance
 * @param {Object} classInfo - Class object with name and description
 * @returns {Promise<Object>} Class with translated fields
 */
export async function translateClass(engine, classInfo) {
  if (!classInfo) return classInfo

  const i18n = engine?.getService?.('i18n') || engine?.i18n
  const locale = i18n?.getLocale?.() || 'en-US'
  
  // If English, return as-is
  if (locale === 'en-US') return classInfo

  const translatedClass = { ...classInfo }

  // Translate class fields
  if (classInfo.name) {
    translatedClass.name = await translateWithAI(engine, classInfo.name)
  }
  
  if (classInfo.description) {
    translatedClass.description = await translateWithAI(engine, classInfo.description)
  }

  if (classInfo.passive) {
    translatedClass.passive = await translateWithAI(engine, classInfo.passive)
  }

  return translatedClass
}

/**
 * Translate an array of items in batch
 * @param {Object} engine - Game engine instance
 * @param {Array} items - Array of items to translate
 * @param {Function} translateFn - Translation function to use
 * @returns {Promise<Array>} Array of translated items
 */
export async function translateBatch(engine, items, translateFn) {
  if (!Array.isArray(items) || items.length === 0) return items
  
  const translated = await Promise.all(
    items.map(item => translateFn(engine, item))
  )
  
  return translated
}

/**
 * Get localized date format
 * @param {Object} engine - Game engine instance
 * @param {Date} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(engine, date) {
  const i18n = engine?.getService?.('i18n') || engine?.i18n
  const locale = i18n?.getLocale?.() || 'en-US'
  
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date)
  } catch (e) {
    return date.toLocaleDateString()
  }
}

/**
 * Get localized number format
 * @param {Object} engine - Game engine instance
 * @param {number} number - Number to format
 * @param {Object} options - Formatting options
 * @returns {string} Formatted number string
 */
export function formatNumber(engine, number, options = {}) {
  const i18n = engine?.getService?.('i18n') || engine?.i18n
  const locale = i18n?.getLocale?.() || 'en-US'
  
  try {
    return new Intl.NumberFormat(locale, options).format(number)
  } catch (e) {
    return number.toString()
  }
}

/**
 * Get localized currency format
 * @param {Object} engine - Game engine instance
 * @param {number} amount - Amount in gold
 * @returns {string} Formatted currency string
 */
export function formatGold(engine, amount) {
  const goldText = translate(engine, 'inv.gold', null) || 'Gold'
  const formatted = formatNumber(engine, amount)
  return `${formatted} ${goldText}`
}

/**
 * Show language change notification toast
 * @param {string} languageName - Name of the new language
 */
export function showLanguageChangeToast(languageName) {
  // Remove existing toasts
  const existing = document.querySelectorAll('.language-change-toast')
  existing.forEach(toast => toast.remove())

  // Create new toast
  const toast = document.createElement('div')
  toast.className = 'language-change-toast'
  toast.textContent = `Language changed to ${languageName}`
  
  document.body.appendChild(toast)

  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0'
    setTimeout(() => toast.remove(), 300)
  }, 3000)
}

/**
 * Cache helper to store and retrieve translated content
 */
export class TranslationCache {
  constructor() {
    this.cache = new Map()
  }

  /**
   * Get cached translation
   * @param {string} key - Cache key
   * @param {string} locale - Locale code
   * @returns {any} Cached value or null
   */
  get(key, locale) {
    const cacheKey = `${locale}:${key}`
    return this.cache.get(cacheKey) || null
  }

  /**
   * Set cached translation
   * @param {string} key - Cache key
   * @param {string} locale - Locale code
   * @param {any} value - Value to cache
   */
  set(key, locale, value) {
    const cacheKey = `${locale}:${key}`
    this.cache.set(cacheKey, value)
  }

  /**
   * Clear all cached translations
   */
  clear() {
    this.cache.clear()
  }

  /**
   * Clear translations for a specific locale
   * @param {string} locale - Locale code
   */
  clearLocale(locale) {
    const keysToDelete = []
    for (const [key] of this.cache.entries()) {
      if (key.startsWith(`${locale}:`)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.cache.delete(key))
  }
}
