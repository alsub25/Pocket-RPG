// js/game/data/enemyAbilities.js
// Enemy ability definitions + curated ability sets by behavior/boss.
// Extracted from engine.js in Patch 1.2.72 to isolate balance-tuning data from orchestration logic.

export const ENEMY_ABILITIES = {
    enemyStrike: {
        id: 'enemyStrike',
        name: 'Strike',
        desc: 'A quick weapon strike.',
        cooldown: 0,
        type: 'damage',
        damageType: 'physical',
        potency: 1.0
    },

    heavyCleave: {
        id: 'heavyCleave',
        name: 'Heavy Cleave',
        desc: 'A committed blow that hits harder.',
        cooldown: 2,
        type: 'damage',
        damageType: 'physical',
        potency: 1.45,
        telegraphTurns: 1,
        telegraphText: 'winds up a Heavy Cleave!'
    },

    guardUp: {
        id: 'guardUp',
        name: 'Guard Up',
        desc: 'Raises defenses for a couple turns.',
        cooldown: 4,
        type: 'guard',
        guardTurns: 2,
        armorBonus: 3
    },

    skewerBleed: {
        id: 'skewerBleed',
        name: 'Skewer',
        desc: 'Piercing attack that causes bleeding.',
        cooldown: 4,
        type: 'damage+bleed',
        damageType: 'physical',
        potency: 1.35,
        bleedTurns: 3,
        bleedBase: 4
    },

    poisonSpit: {
        id: 'poisonSpit',
        name: 'Poison Spit',
        desc: 'Corrosive venom that lingers.',
        cooldown: 4,
        type: 'damage+bleed',
        damageType: 'magic',
        elementType: 'poison',
        potency: 1.05,
        bleedTurns: 4,
        bleedBase: 3
    },

    sunderArmor: {
        id: 'sunderArmor',
        name: 'Sunder Armor',
        desc: 'Hits and reduces armor for a few turns.',
        cooldown: 4,
        type: 'damage+debuff',
        damageType: 'physical',
        potency: 1.1,
        armorDown: 3,
        debuffTurns: 3
    },

    shatterShield: {
        id: 'shatterShield',
        name: 'Shatter Shield',
        desc: 'Smashes protective wards, removing extra shield.',
        cooldown: 4,
        type: 'damage+utility',
        damageType: 'physical',
        potency: 1.05,
        shatterShieldFlat: 18
    },

    enrageHowl: {
        id: 'enrageHowl',
        name: 'Enrage',
        desc: 'Rages, increasing attack for a short time.',
        cooldown: 6,
        type: 'buff',
        enrageTurns: 2,
        enrageAtkPct: 0.25
    },

    arcaneBurst: {
        id: 'arcaneBurst',
        name: 'Arcane Burst',
        desc: 'A focused blast of magic.',
        cooldown: 3,
        type: 'damage',
        damageType: 'magic',
        elementType: 'arcane',
        potency: 1.35
    },

    voidBreath: {
        id: 'voidBreath',
        name: 'Void Breath',
        desc: 'A wave of void-flame that leaves you exposed.',
        cooldown: 5,
        type: 'damage+debuff',
        damageType: 'magic',
        elementType: 'shadow',
        potency: 1.7,
        vulnerableTurns: 2,
        telegraphTurns: 1,
        telegraphText: 'draws in void-flame...'
    },

    lifeDrain: {
        id: 'lifeDrain',
        name: 'Life Drain',
        desc: 'Drains vitality and restores the enemy.',
        cooldown: 6,
        type: 'damage+heal',
        damageType: 'magic',
        elementType: 'shadow',
        potency: 1.2,
        drainHealPct: 0.45,
        drainResourcePct: 0.12
    },

    boneArmor: {
        id: 'boneArmor',
        name: 'Bone Armor',
        desc: 'Reinforces itself with ossified plating.',
        cooldown: 6,
        type: 'guard',
        guardTurns: 3,
        armorBonus: 4,
        healPct: 0.08
    },

    witchHex: {
        id: 'witchHex',
        name: 'Hex',
        desc: 'A vile curse that weakens your offense.',
        cooldown: 5,
        type: 'debuff',
        elementType: 'shadow',
        atkDown: 3,
        debuffTurns: 3
    },

    giantStomp: {
        id: 'giantStomp',
        name: 'Seismic Stomp',
        desc: 'Shakes the ground, battering you and leaving you off-balance.',
        cooldown: 5,
        type: 'damage+debuff',
        damageType: 'physical',
        potency: 1.25,
        armorDown: 2,
        debuffTurns: 2,
        vulnerableTurns: 1,
        telegraphTurns: 1,
        telegraphText: 'raises a massive foot for a stomp!'
    },

    tailSwipe: {
        id: 'tailSwipe',
        name: 'Tail Swipe',
        desc: 'Sweeping tail strike that punishes shields.',
        cooldown: 4,
        type: 'damage+utility',
        damageType: 'physical',
        potency: 1.2,
        shatterShieldFlat: 22,
        telegraphTurns: 1,
        telegraphText: 'coils for a sweeping tail swipe!'
    },

    dragonInferno: {
        id: 'dragonInferno',
        name: 'Inferno',
        desc: 'A blazing inferno that scorches flesh for several turns.',
        cooldown: 6,
        type: 'damage+bleed',
        damageType: 'magic',
        elementType: 'fire',
        potency: 1.55,
        bleedTurns: 4,
        bleedBase: 5,
        vulnerableTurns: 1,
        telegraphTurns: 1,
        telegraphText: 'inhales deeply—flames gather in its throat...'
    },

    lichCurse: {
        id: 'lichCurse',
        name: 'Withering Curse',
        desc: 'Necrotic rot that reduces both attack and armor.',
        cooldown: 6,
        type: 'debuff',
        atkDown: 3,
        armorDown: 2,
        debuffTurns: 3
    },

    royalThrust: {
        id: 'royalThrust',
        name: 'Royal Thrust',
        desc: 'A precise thrust that finds weak points.',
        cooldown: 3,
        type: 'damage+debuff',
        damageType: 'physical',
        potency: 1.25,
        vulnerableTurns: 2
    },

    royalAegis: {
        id: 'royalAegis',
        name: 'Royal Aegis',
        desc: 'Raises a commanding defense and regains composure.',
        cooldown: 6,
        type: 'guard',
        guardTurns: 2,
        armorBonus: 5,
        healPct: 0.1
    }
}

export const ENEMY_ABILITY_SETS = {
    basic: ['enemyStrike', 'heavyCleave', 'guardUp', 'sunderArmor'],
    aggressive: ['heavyCleave', 'skewerBleed', 'enrageHowl', 'shatterShield'],
    cunning: ['enemyStrike', 'poisonSpit', 'sunderArmor', 'guardUp'],
    caster: ['arcaneBurst', 'voidBreath', 'lifeDrain', 'witchHex'],

    bossGoblin: [
        'heavyCleave',
        'skewerBleed',
        'enrageHowl',
        'guardUp',
        'shatterShield',
        'sunderArmor'
    ],
    bossDragon: [
        'voidBreath',
        'dragonInferno',
        'tailSwipe',
        'guardUp',
        'lifeDrain',
        'enrageHowl'
    ],
    bossWitch: [
        'witchHex',
        'arcaneBurst',
        'voidBreath',
        'lifeDrain',
        'guardUp',
        'sunderArmor'
    ],
    bossGiant: [
        'giantStomp',
        'heavyCleave',
        'shatterShield',
        'guardUp',
        'enrageHowl',
        'skewerBleed'
    ],
    bossLich: [
        'arcaneBurst',
        'lichCurse',
        'lifeDrain',
        'boneArmor',
        'voidBreath',
        'sunderArmor'
    ],
    bossKing: [
        'royalThrust',
        'royalAegis',
        'heavyCleave',
        'sunderArmor',
        'shatterShield',
        'enrageHowl'
    ],

    // Chapter III (Patch 1.2.42): The Hollow Regent
    bossRegent: [
        'royalThrust',
        'royalAegis',
        'voidBreath',
        'lichCurse',
        'lifeDrain',
        'shatterShield'
    ]
}
