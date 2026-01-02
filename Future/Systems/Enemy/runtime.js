// Systems/Enemy/runtime.js
// Enemy runtime initialization + base stat helpers.

import { finiteNumber, clampFinite } from '../safety.js'
import { getEnemyRarityDef } from './rarity.js'

export function computeEnemyPostureMax(enemy) {
    if (!enemy) return 0
    const lvl = clampFinite(enemy.level, 1, 200, 1)
    let base = 34 + lvl * 6
    if (enemy.isElite) base *= 1.2
    if (enemy.isBoss) base *= 1.6
    return clampFinite(Math.round(base), 25, 420, 25)
}

// After difficulty/elite/rarity/affix scaling, ensure baseAttack/baseMagic match the current stats.
// These base stats are used by atkDown/magDown debuffs. If they don't match, difficulty scaling won't
// actually affect enemy damage output.
export function syncEnemyBaseStats(enemy) {
    if (!enemy) return
    enemy.baseAttack = finiteNumber(enemy.attack, 0)
    enemy.baseMagic = finiteNumber(enemy.magic, 0)
}

/**
 * ensureEnemyRuntime(enemy, deps)
 *
 * deps:
 *  - pickEnemyAbilitySet(enemy): returns array of ability IDs
 */
export function ensureEnemyRuntime(enemy, deps = {}) {
    if (!enemy) return

    if (!enemy.abilityCooldowns) enemy.abilityCooldowns = {}

    // Preserve explicitly provided ability kits (including small kits used by unit tests).
    // Only auto-assign a kit when abilities are missing or empty.
    const pickEnemyAbilitySet = typeof deps.pickEnemyAbilitySet === 'function' ? deps.pickEnemyAbilitySet : null
    if ((!Array.isArray(enemy.abilities) || enemy.abilities.length === 0) && pickEnemyAbilitySet) {
        try {
            enemy.abilities = [...pickEnemyAbilitySet(enemy)]
        } catch (_) {
            enemy.abilities = Array.isArray(enemy.abilities) ? enemy.abilities : []
        }
    }

    if (!Number.isFinite(enemy.guardTurns)) enemy.guardTurns = 0
    if (!Number.isFinite(enemy.guardArmorBonus)) enemy.guardArmorBonus = 0
    if (!Number.isFinite(enemy.enrageTurns)) enemy.enrageTurns = 0
    if (!Number.isFinite(enemy.enrageAtkPct)) enemy.enrageAtkPct = 0

    if (!Number.isFinite(enemy.baseAttack)) enemy.baseAttack = finiteNumber(enemy.attack, 0)
    if (!Number.isFinite(enemy.baseMagic)) enemy.baseMagic = finiteNumber(enemy.magic, 0)

    if (!Number.isFinite(enemy.atkDownTurns)) enemy.atkDownTurns = 0
    if (!Number.isFinite(enemy.atkDownFlat)) enemy.atkDownFlat = 0
    if (!Number.isFinite(enemy.magDownTurns)) enemy.magDownTurns = 0
    if (!Number.isFinite(enemy.magDownFlat)) enemy.magDownFlat = 0

    if (!Number.isFinite(enemy.brokenTurns)) enemy.brokenTurns = 0
    if (!Number.isFinite(enemy.postureMax) || enemy.postureMax <= 0) {
        enemy.postureMax = computeEnemyPostureMax(enemy)
    }
    if (!Number.isFinite(enemy.posture)) enemy.posture = 0

    if (!('intent' in enemy)) enemy.intent = null

    // Enemy affixes (mini-modifiers): ensure save-safe defaults.
    if (!Array.isArray(enemy.affixes)) enemy.affixes = []
    if (!enemy.baseName && enemy.name) enemy.baseName = enemy.name

    // Enemy rarity:
    // IMPORTANT: don't default non-boss enemies to "common" here.
    // Rarity is rolled during spawn. Here we only normalize boss rarity + make sure runtime fields exist for loaded saves.
    if (enemy.isBoss) enemy.rarity = 'legendary'
    if (enemy.rarity) {
        const _rdef = getEnemyRarityDef(enemy.rarity) || getEnemyRarityDef('common')
        enemy.rarity = _rdef.id
        enemy.rarityLabel = _rdef.label
        enemy.rarityTier = _rdef.tier
        if (!Number.isFinite(enemy.rarityDropMult)) enemy.rarityDropMult = finiteNumber(_rdef.dropMult, 1)
        if (!Number.isFinite(enemy.rarityAffixCapBonus)) enemy.rarityAffixCapBonus = finiteNumber(_rdef.affixCapBonus, 0)
    }
    if (typeof enemy._rarityApplied !== 'boolean') enemy._rarityApplied = !!enemy._rarityApplied

    if (!Number.isFinite(enemy.affixThornsPct)) enemy.affixThornsPct = 0
    if (!Number.isFinite(enemy.affixVampiricHealPct)) enemy.affixVampiricHealPct = 0
    if (!Number.isFinite(enemy.affixRegenPct)) enemy.affixRegenPct = 0

    if (!Number.isFinite(enemy.affixChillChance)) enemy.affixChillChance = 0
    if (!Number.isFinite(enemy.affixChillTurns)) enemy.affixChillTurns = 0

    if (!Number.isFinite(enemy.affixHexTurns)) enemy.affixHexTurns = 0
    if (!Number.isFinite(enemy.affixHexAtkDown)) enemy.affixHexAtkDown = 0
    if (!Number.isFinite(enemy.affixHexArmorDown)) enemy.affixHexArmorDown = 0
    if (!Number.isFinite(enemy.affixHexResDown)) enemy.affixHexResDown = 0

    if (!Number.isFinite(enemy.affixBerserkThreshold)) enemy.affixBerserkThreshold = 0
    if (!Number.isFinite(enemy.affixBerserkAtkPct)) enemy.affixBerserkAtkPct = 0
    if (typeof enemy.affixBerserkActive !== 'boolean') enemy.affixBerserkActive = false

    // Learning memory (similar vibe to companion AI)
    if (!enemy.memory) {
        enemy.memory = {
            abilityStats: {}, // abilityId -> { value, uses }
            exploration: 0.22 // epsilon (decays slowly)
        }
    }
}
