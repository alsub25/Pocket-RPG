// js/game/data/statusEffects.js
// Status effect definitions for combat
// Patch 1.2.90: Added new status effects

export const STATUS_EFFECTS = {
    // Existing status effects (for reference)
    bleed: {
        id: 'bleed',
        name: 'Bleeding',
        type: 'debuff',
        description: 'Takes damage over time',
        tickDamage: 5
    },
    stun: {
        id: 'stun',
        name: 'Stunned',
        type: 'debuff',
        description: 'Cannot act for a turn',
        preventAction: true
    },
    shield: {
        id: 'shield',
        name: 'Shield',
        type: 'buff',
        description: 'Absorbs incoming damage',
        absorbDamage: true
    },
    
    // Patch 1.2.90: New status effects
    exposed: {
        id: 'exposed',
        name: 'Exposed',
        type: 'debuff',
        description: 'Next attack deals 50% bonus damage (single-use)',
        damageMultiplier: 1.5,
        consumeOnHit: true,
        icon: '🎯'
    },
    fortified: {
        id: 'fortified',
        name: 'Fortified',
        type: 'buff',
        description: 'Reduced incoming damage by 25% (stacks)',
        damageReduction: 0.25,
        stackable: true,
        maxStacks: 3,
        icon: '🛡️'
    },
    cursed: {
        id: 'cursed',
        name: 'Cursed',
        type: 'debuff',
        description: 'Cannot be healed',
        preventHealing: true,
        icon: '💀'
    },
    blessed: {
        id: 'blessed',
        name: 'Blessed',
        type: 'buff',
        description: 'Increased healing received by 50%',
        healingMultiplier: 1.5,
        icon: '✨'
    },
    dazed: {
        id: 'dazed',
        name: 'Dazed',
        type: 'debuff',
        description: 'Reduced accuracy by 30%',
        accuracyReduction: 0.3,
        icon: '💫'
    },
    burning: {
        id: 'burning',
        name: 'Burning',
        type: 'debuff',
        description: 'Takes fire damage over time',
        tickDamage: 8,
        element: 'fire',
        icon: '🔥'
    },
    poisoned: {
        id: 'poisoned',
        name: 'Poisoned',
        type: 'debuff',
        description: 'Takes poison damage over time (stacks)',
        tickDamage: 6,
        stackable: true,
        maxStacks: 5,
        icon: '☠️'
    },
    vanished: {
        id: 'vanished',
        name: 'Vanished',
        type: 'buff',
        description: 'Avoiding all damage',
        evasion: 1.0,
        icon: '👤'
    }
};

/**
 * Apply status effect damage/effects at turn start
 */
export function applyStatusEffectTick(target, statusEffect, state) {
    const effect = STATUS_EFFECTS[statusEffect.id];
    if (!effect) return 0;

    let damage = 0;
    
    // Apply tick damage
    if (effect.tickDamage) {
        const stacks = statusEffect.stacks || 1;
        damage = effect.tickDamage * stacks;
    }

    return damage;
}

/**
 * Check if status effect should be consumed
 */
export function shouldConsumeStatus(statusEffect) {
    const effect = STATUS_EFFECTS[statusEffect.id];
    return effect && effect.consumeOnHit;
}

/**
 * Calculate damage modifier from status effects
 */
export function calculateStatusDamageModifier(attacker, defender) {
    let multiplier = 1.0;
    
    // Check defender for exposed
    if (defender.statusEffects) {
        const exposed = defender.statusEffects.find(s => s.id === 'exposed');
        if (exposed) {
            multiplier *= STATUS_EFFECTS.exposed.damageMultiplier;
        }
    }
    
    // Check attacker for dazed (reduces accuracy/damage)
    if (attacker.statusEffects) {
        const dazed = attacker.statusEffects.find(s => s.id === 'dazed');
        if (dazed) {
            multiplier *= (1 - STATUS_EFFECTS.dazed.accuracyReduction);
        }
    }
    
    return multiplier;
}

/**
 * Calculate damage reduction from fortified stacks
 */
export function calculateFortifiedReduction(target) {
    if (!target.statusEffects) return 0;
    
    const fortified = target.statusEffects.filter(s => s.id === 'fortified');
    if (fortified.length === 0) return 0;
    
    const stacks = Math.min(fortified.length, STATUS_EFFECTS.fortified.maxStacks);
    return STATUS_EFFECTS.fortified.damageReduction * stacks;
}

/**
 * Check if target can be healed
 */
export function canBeHealed(target) {
    if (!target.statusEffects) return true;
    
    const cursed = target.statusEffects.find(s => s.id === 'cursed');
    return !cursed;
}

/**
 * Calculate healing modifier from blessed
 */
export function calculateHealingModifier(target) {
    if (!target.statusEffects) return 1.0;
    
    const blessed = target.statusEffects.find(s => s.id === 'blessed');
    if (blessed) {
        return STATUS_EFFECTS.blessed.healingMultiplier;
    }
    
    return 1.0;
}

/**
 * Check if target is vanished (avoiding all damage)
 */
export function isVanished(target) {
    if (!target.statusEffects) return false;
    
    const vanished = target.statusEffects.find(s => s.id === 'vanished');
    return !!vanished;
}
