// js/game/character/statsManager.js
// Player stats management and calculations
//
// Extracted from gameOrchestrator.js to improve modularity and maintainability.
// This module handles player stat initialization, validation, and calculations.

/**
 * Ensures player stats object has all required default fields
 * @param {Object} p - Player object
 */
export function ensurePlayerStatsDefaults(p) {
    if (!p) return
    if (!p.stats || typeof p.stats !== 'object') {
        p.stats = { attack: 0, magic: 0, armor: 0, speed: 0, magicRes: 0 }
    }
    const s = p.stats

    // Core numeric stats (ensure finite defaults)
    if (!Number.isFinite(Number(s.attack))) s.attack = 0
    if (!Number.isFinite(Number(s.magic))) s.magic = 0
    if (!Number.isFinite(Number(s.armor))) s.armor = 0
    if (!Number.isFinite(Number(s.speed))) s.speed = 0
    if (!Number.isFinite(Number(s.magicRes))) s.magicRes = 0

    // Derived % / misc stats used across UI + scanners
    const ensureNum = (k) => { if (!Number.isFinite(Number(s[k]))) s[k] = 0 }
    ;[
        'critChance',
        'dodgeChance',
        'resistAll',
        'lifeSteal',
        'armorPen',
        'haste',
        'thorns',
        'hpRegen'
    ].forEach(ensureNum)

    // Some scanners/UI expect dodge alias to exist
    if (!Number.isFinite(Number(s.dodge))) s.dodge = Number.isFinite(Number(s.dodgeChance)) ? Number(s.dodgeChance) : 0

    // Elemental containers
    if (!s.elementalBonuses || typeof s.elementalBonuses !== 'object') s.elementalBonuses = {}
    if (!s.elementalResists || typeof s.elementalResists !== 'object') s.elementalResists = {}
    if (!s.elementalBonusBreakdown || typeof s.elementalBonusBreakdown !== 'object') {
        s.elementalBonusBreakdown = { gear: {}, talent: {} }
    } else {
        if (!s.elementalBonusBreakdown.gear || typeof s.elementalBonusBreakdown.gear !== 'object') s.elementalBonusBreakdown.gear = {}
        if (!s.elementalBonusBreakdown.talent || typeof s.elementalBonusBreakdown.talent !== 'object') s.elementalBonusBreakdown.talent = {}
    }
    if (!s.elementalResistBreakdown || typeof s.elementalResistBreakdown !== 'object') {
        s.elementalResistBreakdown = { gear: {}, talent: {} }
    } else {
        if (!s.elementalResistBreakdown.gear || typeof s.elementalResistBreakdown.gear !== 'object') s.elementalResistBreakdown.gear = {}
        if (!s.elementalResistBreakdown.talent || typeof s.elementalResistBreakdown.talent !== 'object') s.elementalResistBreakdown.talent = {}
    }

    if (s.weaponElementType === undefined) s.weaponElementType = null
}

// --- Utility functions for stat calculations ---

/**
 * Capitalizes first letter of a word
 * @param {string} s - String to capitalize
 * @returns {string} Capitalized string
 */
export function capWord(s) {
    return s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : ''
}

/**
 * Rounds number to 1 decimal place
 * @param {number} x - Number to round
 * @returns {number} Rounded number
 */
export function round1(x) {
    return Math.round((Number(x) || 0) * 10) / 10
}

/**
 * Stable integer rounding for combat numbers
 * JS floating-point math can produce values like 57.49999999999999 for what is
 * conceptually 57.5; without a tiny epsilon this would round down incorrectly.
 * @param {number} x - Number to round
 * @returns {number} Rounded integer
 */
export function roundIntStable(x) {
    const n = Number(x)
    if (!Number.isFinite(n)) return 0
    const eps = 1e-9
    return Math.round(n + (n >= 0 ? eps : -eps))
}

/**
 * Converts value to numeric percentage, ensuring it's finite
 * @param {*} x - Value to convert
 * @returns {number} Numeric percentage
 */
export function numPct(x) {
    const n = typeof x === "number" ? x : parseFloat(x)
    return Number.isFinite(n) ? n : 0
}

/**
 * Gets icon emoji for an element type
 * @param {string} k - Element key
 * @returns {string} Element icon emoji
 */
export function elementIcon(k) {
    switch (k) {
        case 'fire':
            return '🔥'
        case 'frost':
            return '🧊'
        case 'lightning':
            return '⚡'
        case 'holy':
            return '✨'
        case 'shadow':
            return '🕸️'
        case 'arcane':
            return '🔮'
        case 'poison':
            return '☠️'
        case 'earth':
            return '🪨'
        case 'nature':
            return '🌿'
        default:
            return '•'
    }
}

/**
 * Standard element type order for consistent display
 * @constant
 */
export const ELEMENT_ORDER = ['fire', 'frost', 'lightning', 'holy', 'shadow', 'arcane', 'poison', 'earth', 'nature']

/**
 * Orders element keys in a standard sequence
 * @param {Array} keys - Element keys to order
 * @param {Function} normalizeElementTypeFn - Function to normalize element type strings
 * @returns {Array} Ordered element keys
 */
export function orderedElementKeys(keys, normalizeElementTypeFn) {
    const uniq = {}
    ;(keys || []).forEach((k) => {
        const nk = (normalizeElementTypeFn ? normalizeElementTypeFn(k) : k) || (k !== null && k !== undefined ? String(k).trim() : null)
        if (nk) uniq[nk] = 1
    })
    return Object.keys(uniq).sort((a, b) => {
        const ia = ELEMENT_ORDER.indexOf(a)
        const ib = ELEMENT_ORDER.indexOf(b)
        if (ia < 0 && ib < 0) return String(a).localeCompare(String(b))
        if (ia < 0) return 1
        if (ib < 0) return -1
        return ia - ib
    })
}

/**
 * Normalizes an element map, ensuring all values are numeric
 * @param {Object} obj - Element map to normalize
 * @returns {Object} Normalized element map
 */
export function normalizeElemMap(obj) {
    const out = {}
    if (!obj || typeof obj !== 'object') return out
    Object.keys(obj).forEach((k) => {
        const nk = String(k).trim()
        if (!nk) return
        const v = numPct(obj[k])
        if (!v) return
        out[nk] = (out[nk] || 0) + v
    })
    return out
}
