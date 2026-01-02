export { buildEnemyForBattle } from './builder.js'
export { applyEnemyRarity, getEnemyRarityDef, ENEMY_RARITY_DEFS } from './rarity.js'
export { applyEliteModifiers, ELITE_BASE_CHANCE } from './elite.js'
export {
    applyEnemyAffixes,
    applyEnemyAffixesOnEnemyHit,
    applyEnemyAffixesOnPlayerHit,
    getEnemyAffixDef,
    getEnemyAffixLabels,
    ENEMY_AFFIX_DEFS,
    ELITE_AFFIXES
} from './affixes.js'
export { rebuildEnemyDisplayName } from './display.js'
export { ensureEnemyRuntime, syncEnemyBaseStats, computeEnemyPostureMax } from './runtime.js'
