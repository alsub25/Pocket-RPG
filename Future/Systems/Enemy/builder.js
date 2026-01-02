// Systems/Enemy/builder.js
// Build a battle-ready enemy instance from a template (zone scaling + difficulty + elite/rarity/affixes).

import { finiteNumber } from '../safety.js'
import { ensureEnemyRuntime, syncEnemyBaseStats } from './runtime.js'
import { applyEliteModifiers } from './elite.js'
import { applyEnemyRarity } from './rarity.js'
import { applyEnemyAffixes } from './affixes.js'
import { rebuildEnemyDisplayName } from './display.js'

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
    const hpFactor = Math.pow(1.14, delta)
    const atkFactor = Math.pow(1.11, delta)
    const magFactor = Math.pow(1.11, delta)
    const armorFactor = Math.pow(1.05, delta)
    const resFactor = Math.pow(1.05, delta)
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

    // After all scaling (difficulty, elite, rarity, affixes), resync base stats.
    syncEnemyBaseStats(enemy)

    // Rebuild the display name after elite + mini-affix modifiers.
    rebuildEnemyDisplayName(enemy)

    return enemy
}
