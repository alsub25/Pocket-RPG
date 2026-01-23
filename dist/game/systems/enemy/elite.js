// Systems/Enemy/elite.js
// Elite encounter modifier (separate from mini-affixes).
import { finiteNumber } from '../safety.js';
import { ELITE_AFFIXES } from './affixes.js';
// non-boss elite chance (tuned per difficulty)
export const ELITE_BASE_CHANCE = 0.08;
/**
 * Applies an Elite modifier to a non-boss enemy (chance-based).
 *
 * ctx:
 *  - areaId: current area id
 *  - rand(tag)
 *  - randInt(min,max,tag)
 */
export function applyEliteModifiers(enemy, diffCfg, ctx = {}) {
    if (!enemy || enemy.isBoss)
        return;
    const areaId = ctx.areaId || 'village';
    // Avoid elites in the village/tutorial area
    if (areaId === 'village')
        return;
    const diffId = typeof diffCfg === 'string'
        ? diffCfg
        : ((diffCfg && (diffCfg.closestId || diffCfg.id)) || 'normal');
    // Easy: no elite modifiers.
    if (diffId === 'easy')
        return;
    const rand = typeof ctx.rand === 'function' ? ctx.rand : (() => Math.random());
    const randInt = typeof ctx.randInt === 'function' ? ctx.randInt : ((a, b) => Math.floor(Math.random() * (b - a + 1)) + a);
    const chance = diffId === 'easy'
        ? ELITE_BASE_CHANCE * 0.7
        : diffId === 'hard'
            ? ELITE_BASE_CHANCE * 1.35
            : ELITE_BASE_CHANCE;
    if (rand('elite.affixChance') >= chance)
        return;
    const affix = ELITE_AFFIXES[randInt(0, ELITE_AFFIXES.length - 1, 'elite.affixPick')];
    enemy.isElite = true;
    enemy.eliteAffix = affix.id;
    enemy.eliteLabel = affix.label;
    enemy.eliteRegenPct = affix.regenPct || 0;
    // Stat bumps (done after base scaling)
    enemy.maxHp = Math.max(1, Math.round(finiteNumber(enemy.maxHp, 1) * finiteNumber(affix.hpMult, 1)));
    enemy.hp = enemy.maxHp;
    enemy.attack = Math.max(0, Math.round(finiteNumber(enemy.attack, 0) * finiteNumber(affix.atkMult, 1)));
    enemy.magic = Math.max(0, Math.round(finiteNumber(enemy.magic, 0) * finiteNumber(affix.magMult, 1)));
    enemy.armor = Math.max(0, Math.round(finiteNumber(enemy.armor, 0) * finiteNumber(affix.armorMult, 1)));
    enemy.magicRes = Math.max(0, Math.round(finiteNumber(enemy.magicRes, 0) * finiteNumber(affix.resMult, 1)));
    enemy.xp = Math.max(1, Math.round(finiteNumber(enemy.xp, 1) * finiteNumber(affix.xpMult, 1)));
    enemy.goldMin = Math.max(0, Math.round(finiteNumber(enemy.goldMin, 0) * finiteNumber(affix.goldMult, 1)));
    enemy.goldMax = Math.max(enemy.goldMin, Math.round(finiteNumber(enemy.goldMax, enemy.goldMin) * finiteNumber(affix.goldMult, 1)));
}
//# sourceMappingURL=elite.js.map