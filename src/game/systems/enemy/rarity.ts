// Systems/Enemy/rarity.js
// Enemy rarity definitions + difficulty-linked rarity rolls.

import { finiteNumber } from '../safety.js'
import { pickWeighted } from '../lootGenerator.js'

// NOTE: Enemy rarities are distinct from loot item rarities.
// Bosses are always Legendary.
export const ENEMY_RARITY_DEFS = [
    { id: 'common', label: 'Common', tier: 1, minLevel: 1, weight: 60, hpMult: 1.0, atkMult: 1.0, magMult: 1.0, armorMult: 1.0, resMult: 1.0, xpMult: 1.0, goldMult: 1.0, dropMult: 1.0, affixCapBonus: 0 },
    { id: 'uncommon', label: 'Uncommon', tier: 2, minLevel: 1, weight: 25, hpMult: 1.08, atkMult: 1.05, magMult: 1.05, armorMult: 1.04, resMult: 1.04, xpMult: 1.08, goldMult: 1.10, dropMult: 1.05, affixCapBonus: 0 },
    { id: 'rare', label: 'Rare', tier: 3, minLevel: 5, weight: 12, hpMult: 1.18, atkMult: 1.12, magMult: 1.12, armorMult: 1.08, resMult: 1.08, xpMult: 1.18, goldMult: 1.25, dropMult: 1.10, affixCapBonus: 0 },
    { id: 'epic', label: 'Epic', tier: 4, minLevel: 10, weight: 3, hpMult: 1.35, atkMult: 1.25, magMult: 1.25, armorMult: 1.16, resMult: 1.16, xpMult: 1.40, goldMult: 1.55, dropMult: 1.20, affixCapBonus: 1 },
    { id: 'legendary', label: 'Legendary', tier: 5, minLevel: 1, weight: 0, hpMult: 1.60, atkMult: 1.40, magMult: 1.40, armorMult: 1.22, resMult: 1.22, xpMult: 1.75, goldMult: 2.00, dropMult: 1.35, affixCapBonus: 2 },
    { id: 'mythic', label: 'Mythic', tier: 6, minLevel: 20, weight: 0, hpMult: 1.95, atkMult: 1.65, magMult: 1.65, armorMult: 1.30, resMult: 1.30, xpMult: 2.20, goldMult: 2.75, dropMult: 1.55, affixCapBonus: 3 }
]

const ENEMY_RARITY_BY_ID = (() => {
    const m = {}
    ENEMY_RARITY_DEFS.forEach((r) => {
        if (r && r.id) m[r.id] = r
    })
    return m
})()

export function getEnemyRarityDef(id) {
    return id ? (ENEMY_RARITY_BY_ID[id] || null) : null
}

function _pickEnemyRarityWeighted(enemy, diffCfg) {
    const diffId = typeof diffCfg === 'string'
        ? diffCfg
        : ((diffCfg && (diffCfg.closestId || diffCfg.id)) || 'normal')

    // Easy: keep things simple — no rarity rolls above Common.
    if (diffId === 'easy') return 'common'

    const lvl = finiteNumber(enemy && enemy.level, 1)

    // NOTE:
    // - Bosses are handled elsewhere (always Legendary).
    // - Non-boss Legendary/Epic/Mythic appear on Hard (level-gated).
    let weights = null

    if (diffId === 'hard') {
        // Hard: no common; very little uncommon; mostly rare; a few epic; a few legendary; mythic is the rarest.
        weights = [
            ['uncommon', 12],
            ['rare', 73],
            ['epic', 10],
            ['legendary', 4],
            ['mythic', 0.2]
        ]
        // Gates to keep early Hard from spiking.
        if (lvl < 8) weights = weights.filter(([id]) => id !== 'epic')
        if (lvl < 10) weights = weights.filter(([id]) => id !== 'legendary')
        if (lvl < 20) weights = weights.filter(([id]) => id !== 'mythic')
    } else {
        // Normal (and any unknown modes): very little Common; mostly Uncommon; a few Rares.
        weights = [
            ['common', 5],
            ['uncommon', 88],
            ['rare', 7]
        ]

        // Early levels: damp rare chance slightly.
        if (lvl < 4) {
            const w = { common: 5, uncommon: 88, rare: 7 }
            const shift = Math.min(3, w.rare)
            w.rare -= shift
            w.uncommon += shift
            weights = Object.entries(w).map(([id, v]) => [id, v])
        }
    }

    weights = (weights || []).filter(([, w]) => (Number(w) || 0) > 0)
    if (!weights.length) return diffId === 'hard' ? 'rare' : 'uncommon'
    return pickWeighted(weights) || (diffId === 'hard' ? 'rare' : 'uncommon')
}

/**
 * Apply rarity to an enemy once per spawn.
 *
 * ctx:
 *  - diffCfg: difficulty config object (supports Dynamic via closestId/band)
 *  - rand(tag): deterministic RNG wrapper
 */
export function applyEnemyRarity(enemy, ctx = {}) {
    if (!enemy) return

    const rand = typeof ctx.rand === 'function' ? ctx.rand : (() => Math.random())
    const diffCfg = ctx.diffCfg || 'normal'
    const diffId = typeof diffCfg === 'string'
        ? diffCfg
        : ((diffCfg && (diffCfg.closestId || diffCfg.id)) || 'normal')

    // Runtime flag: helps prevent accidental re-rolls on already-spawned enemies.
    if (typeof enemy._rarityRolled !== 'boolean') enemy._rarityRolled = false
    if (typeof enemy._rarityApplied !== 'boolean') enemy._rarityApplied = !!enemy._rarityApplied

    // Enforce boss rule.
    if (enemy.isBoss) {
        enemy.rarity = 'legendary'
        enemy._rarityRolled = true
    }

    // If rarity has already been applied (stats/rewards already bumped), never re-roll.
    if (enemy._rarityApplied) {
        enemy._rarityRolled = true
    }

    // Decide whether we should roll rarity now.
    // - Fresh spawns typically have no rarity.
    // - Some templates/tests might prefill "common"; allow a first-roll upgrade.
    const hasRarity = !!enemy.rarity
    const looksDefault = hasRarity && (String(enemy.rarity).toLowerCase() === 'common' || String(enemy.rarity).toLowerCase() === 'uncommon')
    const shouldRoll = !enemy._rarityRolled && (!hasRarity || looksDefault)

    if (shouldRoll) {
        // Easy: no rarity above Common.
        if (diffId === 'easy') {
            enemy.rarity = 'common'
        } else if (enemy.isElite) {
            // Elites skew upward, but still respect the difficulty feel.
            if (diffId === 'hard') {
                const lvl = finiteNumber(enemy.level, 1)
                const r = rand('enemy.rarity.elite')

                // Mythic is the rarest and level-gated.
                if (lvl >= 20 && r < 0.02) enemy.rarity = 'mythic'
                // Legendary is rare; also level-gated.
                else if (lvl >= 10 && r < 0.10) enemy.rarity = 'legendary'
                // Epic is uncommon but present.
                else if (lvl >= 8 && r < 0.28) enemy.rarity = 'epic'
                // Mostly Rare; a little Uncommon.
                else enemy.rarity = r < 0.38 ? 'uncommon' : 'rare'
            } else {
                const r = rand('enemy.rarity.elite')
                // Normal: elites are usually Rare, sometimes Uncommon.
                enemy.rarity = r < 0.22 ? 'uncommon' : 'rare'
            }
        } else {
            enemy.rarity = _pickEnemyRarityWeighted(enemy, diffCfg)
        }

        enemy._rarityRolled = true
    }

    // If a rarity was supplied explicitly (e.g. a scripted encounter), lock it.
    if (enemy.rarity && !enemy._rarityRolled) enemy._rarityRolled = true

    // If someone forces an invalid rarity, normalize.
    const def = getEnemyRarityDef(enemy.rarity) || getEnemyRarityDef('common')
    enemy.rarity = def.id
    enemy.rarityLabel = def.label
    enemy.rarityTier = def.tier
    enemy.rarityDropMult = finiteNumber(def.dropMult, 1)
    enemy.rarityAffixCapBonus = finiteNumber(def.affixCapBonus, 0)

    // Apply stat bumps once. Guard against double-apply by stamping.
    // IMPORTANT: on fresh spawns we want enemies to remain at full health after rarity scaling.
    // But on loaded saves / mid-combat enemies we must NOT "heal" them.
    if (!enemy._rarityApplied) {
        const oldMaxHp = finiteNumber(enemy.maxHp, 1)
        const oldHp = finiteNumber(enemy.hp, oldMaxHp)
        const wasFullBefore = oldHp >= oldMaxHp - 0.5

        enemy.maxHp = Math.max(1, Math.round(oldMaxHp * finiteNumber(def.hpMult, 1)))
        enemy.hp = wasFullBefore ? enemy.maxHp : Math.min(enemy.maxHp, oldHp)
        enemy.attack = Math.max(0, Math.round(finiteNumber(enemy.attack, 0) * finiteNumber(def.atkMult, 1)))
        enemy.magic = Math.max(0, Math.round(finiteNumber(enemy.magic, 0) * finiteNumber(def.magMult, 1)))
        enemy.armor = Math.max(0, Math.round(finiteNumber(enemy.armor, 0) * finiteNumber(def.armorMult, 1)))
        enemy.magicRes = Math.max(0, Math.round(finiteNumber(enemy.magicRes, 0) * finiteNumber(def.resMult, 1)))

        enemy.xp = Math.max(1, Math.round(finiteNumber(enemy.xp, 1) * finiteNumber(def.xpMult, 1)))
        enemy.goldMin = Math.max(0, Math.round(finiteNumber(enemy.goldMin, 0) * finiteNumber(def.goldMult, 1)))
        enemy.goldMax = Math.max(enemy.goldMin, Math.round(finiteNumber(enemy.goldMax, enemy.goldMin) * finiteNumber(def.goldMult, 1)))

        enemy._rarityApplied = true
    }
}
