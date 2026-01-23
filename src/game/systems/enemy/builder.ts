// Systems/Enemy/builder.js
// Build a battle-ready enemy instance from a template (zone scaling + difficulty + elite/rarity/affixes).

import { finiteNumber } from '../safety.js'
import { ensureEnemyRuntime, syncEnemyBaseStats } from './runtime.js'
import { applyEliteModifiers } from './elite.js'
import { applyEnemyRarity } from './rarity.js'
import { applyEnemyAffixes } from './affixes.js'
import { rebuildEnemyDisplayName } from './display.js'


function _getDiffId(diff) {
    // Dynamic difficulty uses closestId; fixed difficulties use id.
    if (!diff) return 'normal'
    const id = String(diff.id || 'normal').toLowerCase()
    if (id === 'dynamic') return String(diff.closestId || 'normal').toLowerCase()
    return id
}

// --- Elemental scaling ------------------------------------------------------
// Notes:
// - Affinities are multipliers (weak > 1, resist < 1).
// - elementalResists are flat %-reductions versus incoming elemental damage.
// - We keep these modest and bounded so enemies never become immune purely from scaling.

function _clamp(n, lo, hi) {
    if (!Number.isFinite(n)) return lo
    return Math.max(lo, Math.min(hi, n))
}

function _pickWeighted(pairs, rand, tag) {
    const rfn = typeof rand === 'function' ? rand : (() => Math.random())
    if (!Array.isArray(pairs) || pairs.length === 0) return null
    let total = 0
    for (let i = 0; i < pairs.length; i++) total += Math.max(0.0001, Number(pairs[i][1] || 0))
    let r = rfn(tag || 'pickWeighted') * total
    for (let i = 0; i < pairs.length; i++) {
        r -= Math.max(0.0001, Number(pairs[i][1] || 0))
        if (r <= 0) return pairs[i][0]
    }
    return pairs[pairs.length - 1][0]
}

function _areaElementBias(areaId) {
    // Keep in sync with loot generator's feel, but don't hard-couple modules.
    const a = String(areaId || '').toLowerCase()
    const map = {
        forest: [['nature', 28], ['poison', 18], ['frost', 10], ['fire', 10], ['lightning', 10], ['shadow', 12], ['arcane', 12]],
        marsh: [['poison', 32], ['nature', 22], ['shadow', 16], ['frost', 10], ['fire', 8], ['arcane', 12]],
        ruins: [['arcane', 26], ['shadow', 18], ['fire', 12], ['lightning', 14], ['frost', 10], ['holy', 10], ['earth', 10]],
        frostpeak: [['frost', 34], ['lightning', 14], ['earth', 14], ['shadow', 12], ['arcane', 12], ['fire', 8], ['holy', 6]],
        catacombs: [['shadow', 34], ['holy', 16], ['poison', 12], ['arcane', 14], ['frost', 10], ['fire', 6], ['earth', 8]],
        keep: [['holy', 22], ['arcane', 20], ['fire', 14], ['lightning', 14], ['earth', 12], ['shadow', 10], ['frost', 8]]
    }
    return map[a] || [['arcane', 18], ['shadow', 18], ['fire', 12], ['frost', 12], ['lightning', 12], ['nature', 10], ['poison', 10], ['holy', 8], ['earth', 8]]
}

function _opposingElement(elem) {
    const e = String(elem || '').toLowerCase()
    const opp = {
        fire: 'frost',
        frost: 'fire',
        lightning: 'earth',
        earth: 'lightning',
        poison: 'holy',
        holy: 'poison',
        nature: 'shadow',
        shadow: 'nature',
        arcane: 'shadow'
    }
    return opp[e] || 'fire'
}

function applyLevelElementalScaling(enemy, delta) {
    if (!enemy) return
    const d = Number.isFinite(delta) ? delta : 0
    if (d <= 0) return

    // Flat elemental resists: +2% per 5 levels above template, capped.
    const flatFactor = _clamp(1 + (0.02 * (d / 5)), 1, 1.25)
    if (enemy.elementalResists && typeof enemy.elementalResists === 'object') {
        for (const k in enemy.elementalResists) {
            const v = Number(enemy.elementalResists[k] || 0)
            if (!Number.isFinite(v) || v <= 0) continue
            enemy.elementalResists[k] = _clamp(Math.round(v * flatFactor), 0, 75)
        }
    }

    if (enemy.affinities && typeof enemy.affinities === 'object') {
        // Resist multipliers: increase the *reduction* from 1.0 slightly with level.
        if (enemy.affinities.resist && typeof enemy.affinities.resist === 'object') {
            const r = enemy.affinities.resist
            for (const k in r) {
                const m = Number(r[k] || 1)
                if (!Number.isFinite(m) || m >= 1) continue
                const reduction = 1 - m
                const scaled = 1 - (reduction * _clamp(1 + 0.01 * d, 1, 1.25))
                r[k] = _clamp(Math.round(scaled * 1000) / 1000, 0.4, 1)
            }
        }
        // Weak multipliers: increase the *excess* over 1.0 slightly with level.
        if (enemy.affinities.weak && typeof enemy.affinities.weak === 'object') {
            const w = enemy.affinities.weak
            for (const k in w) {
                const m = Number(w[k] || 1)
                if (!Number.isFinite(m) || m <= 1) continue
                const excess = m - 1
                const scaled = 1 + (excess * _clamp(1 + 0.01 * d, 1, 1.25))
                w[k] = _clamp(Math.round(scaled * 1000) / 1000, 1, 2.5)
            }
        }
    }
}

function applyDifficultyElementalResists(enemy, diff) {
    const diffId = _getDiffId(diff)
    let factor = 1.0
    if (diffId === 'easy') factor = 0.85
    else if (diffId === 'hard') factor = 1.25

    if (!enemy) return

    // Flat elemental resists (percent reduction)
    if (enemy.elementalResists && typeof enemy.elementalResists === 'object') {
        for (const k in enemy.elementalResists) {
            const v = Number(enemy.elementalResists[k] || 0)
            if (!Number.isFinite(v) || v <= 0) continue
            enemy.elementalResists[k] = Math.max(0, Math.min(75, Math.round(v * factor)))
        }
    }

    // Affinity resist multipliers (e.g., frost: 0.85). Lower = stronger resist.
    // Scale the *reduction from 1.0* so it behaves well for different bases.
    if (enemy.affinities && enemy.affinities.resist && typeof enemy.affinities.resist === 'object') {
        const r = enemy.affinities.resist
        for (const k in r) {
            const m = Number(r[k] || 1)
            if (!Number.isFinite(m)) continue
            if (m >= 1) continue // not a resist multiplier
            const reduction = 1 - m
            const scaled = 1 - (reduction * factor)
            // Keep within sane bounds (never immune from this scaling alone).
            r[k] = Math.max(0.4, Math.min(1, Math.round(scaled * 1000) / 1000))
        }
    }
}

function rollEnemyElementalTrait(enemy, ctx = {}) {
    // Adds a small chance for any non-boss enemy to roll an extra elemental resist/weakness package.
    // This is what makes higher difficulties *more likely* to spawn elementally-themed enemies.
    if (!enemy || enemy.isBoss) return

    const areaId = ctx.areaId || 'village'
    if (String(areaId).toLowerCase() === 'village') return

    const diffCfg = ctx.diffCfg || { id: 'normal' }
    const diffId = _getDiffId(diffCfg)
    const band = diffCfg && typeof diffCfg === 'object' ? finiteNumber(diffCfg.band, 0) : 0

    const rand = typeof ctx.rand === 'function' ? ctx.rand : (() => Math.random())

    // Base chances by difficulty.
    let chance = diffId === 'easy' ? 0.05 : diffId === 'hard' ? 0.18 : 0.10
    chance += 0.01 * _clamp(band, -2, 6) // dynamic difficulty nudges

    // Level contributes: after level 5, +0.5% per level (cap +12%).
    const lvl = Math.max(1, Number(enemy.level || 1))
    chance += _clamp((lvl - 5) * 0.005, 0, 0.12)

    // Rarity/elite contributes.
    const tier = _clamp(Number(enemy.rarityTier || 1), 1, 6)
    if (tier >= 3) chance += 0.05
    if (tier >= 4) chance += 0.08
    if (tier >= 5) chance += 0.10
    if (tier >= 6) chance += 0.12
    if (enemy.isElite) chance += 0.05

    chance = _clamp(chance, 0, 0.55)
    if (rand('enemy.elemTrait.roll') >= chance) return

    // Choose a themed element based on area.
    const bias = _areaElementBias(areaId)

    let chosen = null
    for (let tries = 0; tries < 4; tries++) {
        const e = _pickWeighted(bias, rand, 'enemy.elemTrait.pick.' + tries)
        if (!e) break
        // Avoid stacking the same resist repeatedly.
        const alreadyFlat = enemy.elementalResists && Number(enemy.elementalResists[e] || 0) > 0
        const alreadyAff = enemy.affinities && enemy.affinities.resist && Number(enemy.affinities.resist[e] || 1) < 1
        if (!alreadyFlat && !alreadyAff) { chosen = e; break }
        chosen = e
    }
    if (!chosen) return

    const weakElem = _opposingElement(chosen)

    // Magnitudes (bounded). Hard makes the resist a touch stronger, but also slightly increases weakness.
    const hard = diffId === 'hard'
    const easy = diffId === 'easy'
    const delta = _clamp((lvl - 1), 0, 30)

    let resistMult = easy ? 0.94 : hard ? 0.90 : 0.92
    resistMult -= _clamp(delta * 0.002, 0, 0.06) // stronger resist at higher level
    resistMult = _clamp(Math.round(resistMult * 1000) / 1000, 0.75, 0.98)

    let weakMult = easy ? 1.08 : hard ? 1.12 : 1.10
    weakMult += _clamp(delta * 0.002, 0, 0.06)
    weakMult = _clamp(Math.round(weakMult * 1000) / 1000, 1.05, 1.30)

    let flat = easy ? 6 : hard ? 10 : 8
    flat += Math.round(_clamp(delta * 0.25, 0, 10))
    flat = _clamp(flat, 0, 75)

    enemy.affinities = enemy.affinities || { weak: {}, resist: {} }
    enemy.affinities.weak = enemy.affinities.weak || {}
    enemy.affinities.resist = enemy.affinities.resist || {}
    enemy.elementalResists = enemy.elementalResists || {}

    // Apply: keep the stronger of existing resist multipliers.
    const existingRes = Number(enemy.affinities.resist[chosen] || 1)
    if (!Number.isFinite(existingRes) || existingRes >= 1) enemy.affinities.resist[chosen] = resistMult
    else enemy.affinities.resist[chosen] = Math.min(existingRes, resistMult)

    // Apply weakness: keep the stronger weakness.
    const existingWeak = Number(enemy.affinities.weak[weakElem] || 1)
    if (!Number.isFinite(existingWeak) || existingWeak <= 1) enemy.affinities.weak[weakElem] = weakMult
    else enemy.affinities.weak[weakElem] = Math.max(existingWeak, weakMult)

    enemy.elementalResists[chosen] = _clamp(Math.round((Number(enemy.elementalResists[chosen] || 0) || 0) + flat), 0, 75)

    const cap = (diffId === 'hard') ? 2 : 1
    if (!Array.isArray(enemy.elementalTraits)) enemy.elementalTraits = []
    if (enemy.elementalTraits.length < cap) {
        const label = (chosen.charAt(0).toUpperCase() + chosen.slice(1)) + '-Touched'
        enemy.elementalTraits.push({ element: chosen, label, flatResist: flat, weak: weakElem })
    }
}


/**
 * buildEnemyForBattle(template, ctx)
 *
 * ctx:
 *  - zone: { minLevel, maxLevel }
 *  - diffCfg: difficulty config (expects enemyHpMod)
 *  - areaId: current area id
 *  - rand(tag)
 *  - randInt(min,max,tag)
 *  - pickEnemyAbilitySet(enemy): array of abilities
 */


function assignEnemyOffenseElements(enemy, ctx = {}) {
    if (!enemy) return

    // Respect explicit overrides provided by templates/spawners.
    const hasAttack = typeof enemy.attackElementType === 'string' && enemy.attackElementType.trim()
    const hasMagic = typeof enemy.magicElementType === 'string' && enemy.magicElementType.trim()

    // Normalize user/author-provided casing.
    if (hasAttack) enemy.attackElementType = String(enemy.attackElementType).trim().toLowerCase()
    if (hasMagic) enemy.magicElementType = String(enemy.magicElementType).trim().toLowerCase()

    if (hasAttack && hasMagic) return

    let primary = null

    // Prefer explicit elemental trait packages (rolled or templated).
    if (Array.isArray(enemy.elementalTraits) && enemy.elementalTraits.length > 0) {
        let best = null
        for (let i = 0; i < enemy.elementalTraits.length; i++) {
            const t = enemy.elementalTraits[i]
            const e = t && typeof t.element === 'string' ? String(t.element).trim().toLowerCase() : null
            if (!e) continue
            const weight = Number(t.flatResist || 0) || 0
            if (!best || weight > best.weight) best = { e, weight }
        }
        if (best) primary = best.e
    }

    // Fallback: strongest affinity resist multiplier (lower = stronger resist).
    if (!primary && enemy.affinities && enemy.affinities.resist && typeof enemy.affinities.resist === 'object') {
        let bestE = null
        let bestM = 1
        for (const k in enemy.affinities.resist) {
            const m = Number(enemy.affinities.resist[k])
            if (!Number.isFinite(m)) continue
            const e = String(k).trim().toLowerCase()
            if (m < bestM) { bestM = m; bestE = e }
        }
        if (bestE) primary = bestE
    }

    // Fallback: highest flat elemental resist.
    if (!primary && enemy.elementalResists && typeof enemy.elementalResists === 'object') {
        let bestE = null
        let bestV = 0
        for (const k in enemy.elementalResists) {
            const v = Number(enemy.elementalResists[k])
            if (!Number.isFinite(v)) continue
            const e = String(k).trim().toLowerCase()
            if (v > bestV) { bestV = v; bestE = e }
        }
        if (bestE) primary = bestE
    }

    // Fallback: keyword heuristics (name/id/affixes + area hint).
    if (!primary) {
        const areaId = String(ctx.areaId || '').toLowerCase()
        const name = String(enemy.baseName || enemy.name || '').toLowerCase()
        const id = String(enemy.id || '').toLowerCase()
        const aff = Array.isArray(enemy.affixes) ? enemy.affixes.join(' ').toLowerCase() : ''
        const corpus = (name + ' ' + id + ' ' + aff + ' ' + areaId).toLowerCase()

        if (/(frozen|frost|ice|chill|glacier|snow)/.test(corpus)) primary = 'frost'
        else if (/(ember|flame|fire|burn|cinder|dragon)/.test(corpus)) primary = 'fire'
        else if (/(lightning|storm|thunder|shock|spark)/.test(corpus)) primary = 'lightning'
        else if (/(holy|radiant|sun|blessed)/.test(corpus)) primary = 'holy'
        else if (/(void|shadow|wraith|nec|vampir|curse)/.test(corpus)) primary = 'shadow'
        else if (/(arcane|mage|witch|sorcer|mystic)/.test(corpus)) primary = 'arcane'
        else if (/(poison|toxic|venom|plague|spit)/.test(corpus)) primary = 'poison'
        else if (/(thorn|vine|nature|mire|swamp|bog|marsh)/.test(corpus)) primary = 'nature'
        else if (/(earth|stone|golem|rock|sand)/.test(corpus)) primary = 'earth'
    }

    if (!primary) return

    if (!hasAttack) enemy.attackElementType = primary
    if (!hasMagic) enemy.magicElementType = primary
}
export function buildEnemyForBattle(template, ctx = {}) {
    if (!template) return null

    const zone = ctx.zone || { minLevel: 1, maxLevel: 1 }
    const diff = ctx.diffCfg || { enemyHpMod: 1, id: 'normal' }
    const areaId = ctx.areaId || 'village'

    const randInt = typeof ctx.randInt === 'function'
        ? ctx.randInt
        : ((min, max) => Math.floor(Math.random() * (max - min + 1)) + min)

    const minL = Math.max(1, Number(zone.minLevel || 1))
    const maxL = Math.max(minL, Number(zone.maxLevel || minL))

    const chosenLevel = template.isBoss
        ? maxL
        : randInt(minL, maxL, 'loot.levelRoll')

    const baseLevel = Math.max(1, Number(template.baseLevel || minL))
    const delta = chosenLevel - baseLevel

    // Exponential growth curve keeps early scaling gentle, late scaling meaningful.
    const hpFactor = Math.pow(1.12, delta)
    const atkFactor = Math.pow(1.09, delta)
    const magFactor = Math.pow(1.09, delta)
    const armorFactor = Math.pow(1.045, delta)
    const resFactor = Math.pow(1.045, delta)
    const xpFactor = Math.pow(1.16, delta)
    const goldFactor = Math.pow(1.13, delta)

    const enemy = JSON.parse(JSON.stringify(template))
    enemy.level = chosenLevel

    // HP is difficulty-scaled here.
    enemy.maxHp = Math.max(1, Math.round(finiteNumber(enemy.maxHp, 1) * hpFactor * finiteNumber(diff.enemyHpMod, 1)))
    enemy.hp = enemy.maxHp

    // Build runtime fields (abilities, cooldowns, AI memory, etc.)
    ensureEnemyRuntime(enemy, { pickEnemyAbilitySet: ctx.pickEnemyAbilitySet })

    // Enemy damage is difficulty-scaled elsewhere in calcEnemyDamage().
    enemy.attack = Math.max(0, Math.round(finiteNumber(enemy.attack, 0) * atkFactor))
    enemy.magic = Math.max(0, Math.round(finiteNumber(enemy.magic, 0) * magFactor))
    enemy.armor = Math.max(0, Math.round(finiteNumber(enemy.armor, 0) * armorFactor))
    enemy.magicRes = Math.max(0, Math.round(finiteNumber(enemy.magicRes, 0) * resFactor))

    enemy.xp = Math.max(1, Math.round(finiteNumber(enemy.xp, 1) * xpFactor))
    enemy.goldMin = Math.max(0, Math.round(finiteNumber(enemy.goldMin, 0) * goldFactor))
    enemy.goldMax = Math.max(enemy.goldMin, Math.round(finiteNumber(enemy.goldMax, enemy.goldMin) * goldFactor))

    // Optional: roll a non-boss Elite variant (harder fight, better rewards)
    applyEliteModifiers(enemy, diff, { areaId, rand: ctx.rand, randInt: ctx.randInt })

    // Enemy rarity (Common → Mythic; Boss is always Legendary).
    applyEnemyRarity(enemy, { diffCfg: diff, rand: ctx.rand })

    // Roll 0–2 Enemy Affixes (mini-modifiers), with a small cap bump on higher rarities.
    const affixCap = 2 + finiteNumber(enemy.rarityAffixCapBonus, 0)
    applyEnemyAffixes(enemy, { maxAffixes: affixCap }, { diffCfg: diff, areaId, rand: ctx.rand, randInt: ctx.randInt })

    // Elemental tuning:
    // - Scale existing template elemental resists/affinities a bit with enemy level.
    // - Scale those same values with difficulty (Hard slightly stronger, Easy slightly weaker).
    // - Roll an additional elemental trait more often on higher difficulties/levels.
    applyLevelElementalScaling(enemy, delta)
    applyDifficultyElementalResists(enemy, diff)
    rollEnemyElementalTrait(enemy, { areaId, diffCfg: diff, rand: ctx.rand })

    // Offensive element tags (used to apply player elemental resist to enemy hits).
    assignEnemyOffenseElements(enemy, { areaId })

    // After all scaling (difficulty, elite, rarity, affixes), resync base stats.
    syncEnemyBaseStats(enemy)

    // Rebuild the display name after elite + mini-affix modifiers.
    rebuildEnemyDisplayName(enemy)

    return enemy
}
