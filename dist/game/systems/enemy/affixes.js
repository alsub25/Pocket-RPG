// Systems/Enemy/affixes.js
// Enemy elite modifiers + mini-affixes (including on-hit hooks).
import { finiteNumber, clampFinite } from '../safety.js';
import { computeEnemyPostureMax } from './runtime.js';
export const ELITE_AFFIXES = [
    {
        id: 'enraged',
        label: 'Enraged',
        hpMult: 1.15,
        atkMult: 1.25,
        magMult: 1.25,
        armorMult: 1.05,
        resMult: 1.05,
        xpMult: 1.45,
        goldMult: 1.35
    },
    {
        id: 'bulwark',
        label: 'Bulwark',
        hpMult: 1.35,
        atkMult: 1.10,
        magMult: 1.10,
        armorMult: 1.30,
        resMult: 1.30,
        xpMult: 1.55,
        goldMult: 1.45
    }
];
/**
 * Enemy Affixes (mini-modifiers)
 * - Can roll on any non-boss encounter outside the village.
 * - Elites always roll at least one mini-affix (in addition to their Elite modifier).
 * - Affixes are stored as IDs in enemy.affixes and set a few runtime knobs on the enemy.
 */
export const ENEMY_AFFIX_DEFS = [
    {
        id: 'vampiric',
        label: 'Vampiric',
        weight: 1.0,
        minLevel: 4,
        hpMult: 1.08,
        atkMult: 1.05,
        magMult: 1.05,
        xpMult: 1.15,
        goldMult: 1.10,
        vampiricHealPct: 0.18
    },
    {
        id: 'thorns',
        label: 'Thorned',
        weight: 1.0,
        minLevel: 2,
        hpMult: 1.12,
        armorMult: 1.10,
        resMult: 1.05,
        xpMult: 1.15,
        goldMult: 1.10,
        thornsReflectPct: 0.12
    },
    {
        id: 'hexed',
        label: 'Hexed',
        weight: 0.9,
        minLevel: 6,
        hpMult: 1.07,
        atkMult: 1.05,
        magMult: 1.05,
        xpMult: 1.18,
        goldMult: 1.12,
        hexTurns: 3,
        hexAtkDown: 2,
        hexArmorDown: 2,
        hexResDown: 2
    },
    {
        id: 'frozen',
        label: 'Frozen',
        weight: 0.8,
        minLevel: 10,
        hpMult: 1.10,
        atkMult: 1.05,
        magMult: 1.05,
        xpMult: 1.20,
        goldMult: 1.12,
        chillChance: 0.35,
        chillTurns: 2
    },
    {
        id: 'berserk',
        label: 'Berserk',
        weight: 0.8,
        minLevel: 8,
        hpMult: 1.10,
        atkMult: 1.10,
        magMult: 1.05,
        xpMult: 1.18,
        goldMult: 1.12,
        berserkThreshold: 0.40,
        berserkAtkPct: 0.25
    },
    {
        id: 'regenerating',
        label: 'Regenerating',
        weight: 0.7,
        minLevel: 12,
        hpMult: 1.20,
        atkMult: 1.05,
        magMult: 1.05,
        xpMult: 1.22,
        goldMult: 1.16,
        regenPct: 0.04
    }
];
const ENEMY_AFFIX_BY_ID = (() => {
    const m = {};
    ENEMY_AFFIX_DEFS.forEach((a) => {
        if (a && a.id)
            m[a.id] = a;
    });
    return m;
})();
export function getEnemyAffixDef(id) {
    return id ? (ENEMY_AFFIX_BY_ID[id] || null) : null;
}
function _pickEnemyAffixWeighted(eligible, rand, tag) {
    if (!eligible || eligible.length === 0)
        return null;
    const rfn = typeof rand === 'function' ? rand : (() => Math.random());
    let total = 0;
    eligible.forEach((a) => {
        total += Math.max(0.0001, Number(a.weight || 1));
    });
    let r = rfn(tag || 'affix.pick') * total;
    for (let i = 0; i < eligible.length; i++) {
        const w = Math.max(0.0001, Number(eligible[i].weight || 1));
        r -= w;
        if (r <= 0)
            return eligible[i];
    }
    return eligible[eligible.length - 1];
}
function _applySingleEnemyAffix(enemy, def) {
    if (!enemy || !def || !def.id)
        return;
    if (!Array.isArray(enemy.affixes))
        enemy.affixes = [];
    if (enemy.affixes.includes(def.id))
        return;
    enemy.affixes.push(def.id);
    // Runtime knobs (kept as flat fields for speed + save resilience)
    if (def.thornsReflectPct)
        enemy.affixThornsPct = Math.max(enemy.affixThornsPct || 0, def.thornsReflectPct);
    if (def.vampiricHealPct)
        enemy.affixVampiricHealPct = Math.max(enemy.affixVampiricHealPct || 0, def.vampiricHealPct);
    if (def.regenPct)
        enemy.affixRegenPct = Math.max(enemy.affixRegenPct || 0, def.regenPct);
    if (def.chillChance)
        enemy.affixChillChance = Math.max(enemy.affixChillChance || 0, def.chillChance);
    if (def.chillTurns)
        enemy.affixChillTurns = Math.max(enemy.affixChillTurns || 0, def.chillTurns);
    if (def.hexTurns)
        enemy.affixHexTurns = Math.max(enemy.affixHexTurns || 0, def.hexTurns);
    if (def.hexAtkDown)
        enemy.affixHexAtkDown = Math.max(enemy.affixHexAtkDown || 0, def.hexAtkDown);
    if (def.hexArmorDown)
        enemy.affixHexArmorDown = Math.max(enemy.affixHexArmorDown || 0, def.hexArmorDown);
    if (def.hexResDown)
        enemy.affixHexResDown = Math.max(enemy.affixHexResDown || 0, def.hexResDown);
    if (def.berserkThreshold)
        enemy.affixBerserkThreshold = Math.max(enemy.affixBerserkThreshold || 0, def.berserkThreshold);
    if (def.berserkAtkPct)
        enemy.affixBerserkAtkPct = Math.max(enemy.affixBerserkAtkPct || 0, def.berserkAtkPct);
    // Stat bumps
    enemy.maxHp = Math.max(1, Math.round(finiteNumber(enemy.maxHp, 1) * finiteNumber(def.hpMult, 1)));
    enemy.hp = enemy.maxHp;
    enemy.attack = Math.max(0, Math.round(finiteNumber(enemy.attack, 0) * finiteNumber(def.atkMult, 1)));
    enemy.magic = Math.max(0, Math.round(finiteNumber(enemy.magic, 0) * finiteNumber(def.magMult, 1)));
    enemy.armor = Math.max(0, Math.round(finiteNumber(enemy.armor, 0) * finiteNumber(def.armorMult, 1)));
    enemy.magicRes = Math.max(0, Math.round(finiteNumber(enemy.magicRes, 0) * finiteNumber(def.resMult, 1)));
    // Rewards
    enemy.xp = Math.max(1, Math.round(finiteNumber(enemy.xp, 1) * finiteNumber(def.xpMult, 1)));
    enemy.goldMin = Math.max(0, Math.round(finiteNumber(enemy.goldMin, 0) * finiteNumber(def.goldMult, 1)));
    enemy.goldMax = Math.max(enemy.goldMin, Math.round(finiteNumber(enemy.goldMax, enemy.goldMin) * finiteNumber(def.goldMult, 1)));
}
/**
 * Rolls 0–2 mini-affixes and applies them.
 *
 * opts:
 *   - forceAffixes: string[] (exact affix IDs)
 *   - maxAffixes: number
 *
 * ctx:
 *   - diffCfg: difficulty config (supports Dynamic via closestId/band)
 *   - areaId: current area id
 *   - rand(tag)
 *   - randInt(min,max,tag)
 */
export function applyEnemyAffixes(enemy, opts = {}, ctx = {}) {
    if (!enemy || enemy.isBoss)
        return;
    const force = Array.isArray(opts.forceAffixes) ? opts.forceAffixes.filter(Boolean) : null;
    const diffCfg = ctx.diffCfg || 'normal';
    const diffId = typeof diffCfg === 'string' ? diffCfg : ((diffCfg && (diffCfg.closestId || diffCfg.id)) || 'normal');
    const band = diffCfg && typeof diffCfg === 'object' ? finiteNumber(diffCfg.band, 0) : 0;
    // Easy: keep fights straightforward (no mini-affixes unless explicitly forced).
    if (diffId === 'easy' && !force)
        return;
    const areaId = ctx.areaId || 'village';
    // Avoid affixes in the village/tutorial area (unless explicitly forced, ex: smoke tests).
    if (areaId === 'village' && !force)
        return;
    if (!Array.isArray(enemy.affixes))
        enemy.affixes = [];
    if (!enemy.baseName)
        enemy.baseName = enemy.name || 'Enemy';
    const maxAffixes = Number.isFinite(opts.maxAffixes) ? Math.max(0, Math.min(3, opts.maxAffixes)) : 2;
    const rand = typeof ctx.rand === 'function' ? ctx.rand : (() => Math.random());
    // Determine how many to roll.
    let count = 0;
    if (force) {
        count = Math.min(maxAffixes, force.length);
    }
    else {
        const tier = clampFinite(enemy.rarityTier, 1, 6, 1);
        // Baseline affix roll chance (difficulty-scaled), then nudged upward for higher-rarity enemies.
        let baseChance = diffId === 'easy' ? 0.12 : diffId === 'hard' ? 0.25 : 0.18;
        baseChance += 0.02 * clampFinite(band, -2, 6, 0);
        if (tier >= 3)
            baseChance += 0.08; // Rare+
        if (tier >= 4)
            baseChance += 0.18; // Epic+
        if (tier >= 5)
            baseChance += 0.10; // Legendary+
        if (tier >= 6)
            baseChance += 0.06; // Mythic+
        baseChance = Math.max(0, Math.min(0.85, baseChance));
        const rolled = rand('affix.roll') < baseChance;
        if (enemy.isElite) {
            count = 1;
            let extraChance = diffId === 'hard' ? 0.45 : 0.30;
            extraChance += 0.03 * clampFinite(band, -2, 6, 0);
            if (tier >= 4)
                extraChance += 0.10;
            if (tier >= 6)
                extraChance += 0.05;
            if (rand('affix.extra') < extraChance)
                count += 1;
        }
        else if (rolled) {
            count = 1;
            let extraChance = (enemy.level || 1) >= 14 ? 0.10 : 0.06;
            extraChance += 0.01 * clampFinite(band, -2, 6, 0);
            if (tier >= 3)
                extraChance += 0.04;
            if (tier >= 4)
                extraChance += 0.06;
            if (tier >= 6)
                extraChance += 0.04;
            if (rand('affix.extra') < extraChance)
                count += 1;
        }
        // Epic+ enemies should almost always have at least one modifier outside the village.
        if (tier >= 4 && count < 1)
            count = 1;
        if (tier >= 5 && count < 1)
            count = 1;
    }
    count = Math.max(0, Math.min(maxAffixes, count));
    if (count <= 0)
        return;
    const picked = [];
    for (let i = 0; i < count; i++) {
        const id = force ? force[i] : null;
        if (id) {
            const def = getEnemyAffixDef(id);
            if (def)
                picked.push(def);
            continue;
        }
        const eligible = ENEMY_AFFIX_DEFS.filter((a) => {
            if (!a || !a.id)
                return false;
            if (picked.find((p) => p && p.id === a.id))
                return false;
            const minL = Number(a.minLevel || 1);
            return (enemy.level || 1) >= minL;
        });
        const def = _pickEnemyAffixWeighted(eligible, rand, 'affix.pick.' + i);
        if (def)
            picked.push(def);
    }
    picked.forEach((def) => _applySingleEnemyAffix(enemy, def));
    // Labels for UI + naming
    const labels = (enemy.affixes || [])
        .map((id) => {
        const d = getEnemyAffixDef(id);
        return d ? d.label : String(id);
    })
        .filter(Boolean);
    enemy.affixLabels = labels;
    // Recompute posture cap if the elite flag changed.
    enemy.postureMax = computeEnemyPostureMax(enemy);
    enemy.posture = clampFinite(enemy.posture, 0, enemy.postureMax, 0);
}
export function getEnemyAffixLabels(enemy) {
    if (!enemy)
        return [];
    if (Array.isArray(enemy.affixLabels) && enemy.affixLabels.length)
        return enemy.affixLabels;
    if (!Array.isArray(enemy.affixes))
        return [];
    return enemy.affixes
        .map((id) => {
        const d = getEnemyAffixDef(id);
        return d ? d.label : String(id);
    })
        .filter(Boolean);
}
/**
 * Apply affix effects that trigger when the enemy successfully hits the player.
 *
 * ctx:
 *  - rand(tag)
 *  - addLog(msg, kind)
 */
export function applyEnemyAffixesOnEnemyHit(enemy, player, info = {}, ctx = {}) {
    if (!enemy || !player || !player.status)
        return;
    const rand = typeof ctx.rand === 'function' ? ctx.rand : (() => Math.random());
    const addLog = typeof ctx.addLog === 'function' ? ctx.addLog : (() => { });
    const hpDamage = Math.max(0, Number(info.hpDamage || 0));
    // Vampiric: heal based on HP damage dealt.
    if (enemy.affixVampiricHealPct && enemy.affixVampiricHealPct > 0 && hpDamage > 0) {
        const heal = Math.max(1, Math.round(hpDamage * enemy.affixVampiricHealPct));
        const before = enemy.hp;
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal);
        const gained = enemy.hp - before;
        if (gained > 0)
            addLog(enemy.name + ' siphons ' + gained + ' HP.', 'system');
    }
    // Frozen: chance to apply a short "chilled" debuff (reduces player damage).
    if (enemy.affixChillChance && enemy.affixChillChance > 0 && enemy.affixChillTurns && enemy.affixChillTurns > 0) {
        if (rand('affix.frozen.proc') < enemy.affixChillChance) {
            player.status.chilledTurns = Math.max(player.status.chilledTurns || 0, enemy.affixChillTurns);
            addLog('Cold bites into you (' + player.status.chilledTurns + 't).', 'danger');
        }
    }
    // Hexed: apply light debuffs (reuses existing status fields).
    if (enemy.affixHexTurns && enemy.affixHexTurns > 0) {
        const turns = enemy.affixHexTurns;
        if (enemy.affixHexAtkDown) {
            player.status.atkDown = Math.max(player.status.atkDown || 0, enemy.affixHexAtkDown);
            player.status.atkDownTurns = Math.max(player.status.atkDownTurns || 0, turns);
        }
        if (enemy.affixHexArmorDown) {
            player.status.armorDown = Math.max(player.status.armorDown || 0, enemy.affixHexArmorDown);
            player.status.armorDownTurns = Math.max(player.status.armorDownTurns || 0, turns);
        }
        if (enemy.affixHexResDown) {
            player.status.magicResDown = Math.max(player.status.magicResDown || 0, enemy.affixHexResDown);
            player.status.magicResDownTurns = Math.max(player.status.magicResDownTurns || 0, turns);
        }
        if (hpDamage > 0 && rand('affix.hex.log') < 0.25)
            addLog('A lingering hex weakens you.', 'system');
    }
}
/**
 * Apply affix effects that trigger when the player hits the enemy.
 *
 * ctx:
 *  - applyDirectDamageToPlayer(player, amount, opts)
 */
export function applyEnemyAffixesOnPlayerHit(enemy, player, damageDealt, ctx = {}) {
    if (!enemy || !player || !player.status)
        return;
    const dmg = Math.max(0, Number(damageDealt || 0));
    if (dmg <= 0)
        return;
    const applyDirectDamageToPlayer = typeof ctx.applyDirectDamageToPlayer === 'function'
        ? ctx.applyDirectDamageToPlayer
        : (() => 0);
    // Enemy Thorns: reflect a portion of damage dealt back to the player.
    if (enemy.affixThornsPct && enemy.affixThornsPct > 0) {
        const reflect = Math.max(1, Math.round(dmg * enemy.affixThornsPct));
        applyDirectDamageToPlayer(player, reflect, { source: enemy.name + ' thorns' });
    }
}
//# sourceMappingURL=affixes.js.map