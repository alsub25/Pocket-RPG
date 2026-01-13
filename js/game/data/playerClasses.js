// js/game/data/playerClasses.js
// Player class definitions (base stats + starting spell loadouts).
// Extracted from engine.js in Patch 1.2.72 to reduce engine.js surface area.

export const PLAYER_CLASSES = {
    mage: {
        id: 'mage',
        name: 'Mage',
        desc: 'Fragile spellcaster with high burst damage. Uses Mana.',
        resourceKey: 'mana',
        resourceName: 'Mana',
        baseStats: { maxHp: 80, attack: 6, magic: 16, armor: 2, speed: 10 },
        startingSpells: ['fireball', 'iceShard', 'arcaneShield']
    },
    warrior: {
        id: 'warrior',
        name: 'Warrior',
        desc: 'Durable frontline fighter. Builds Fury when hit or attacking.',
        resourceKey: 'fury',
        resourceName: 'Fury',
        baseStats: { maxHp: 120, attack: 14, magic: 4, armor: 6, speed: 8 },
        startingSpells: ['powerStrike', 'battleCry', 'shieldWall']
    },
    blood: {
        id: 'blood',
        name: 'Blood Knight',
        desc: 'Risks health for brutal abilities. Uses Blood as resource.',
        resourceKey: 'blood',
        resourceName: 'Blood',
        baseStats: { maxHp: 100, attack: 12, magic: 8, armor: 4, speed: 9 },
        startingSpells: ['bloodSlash', 'leech', 'hemorrhage']
    },

    // 1) RANGER – uses Fury (adrenaline)
    ranger: {
        id: 'ranger',
        name: 'Ranger',
        desc: 'Swift ranged fighter who bleeds and kites foes. Uses Fury.',
        resourceKey: 'fury',
        resourceName: 'Fury',
        baseStats: { maxHp: 95, attack: 13, magic: 5, armor: 4, speed: 12 },
        startingSpells: ['piercingShot', 'twinArrows', 'markedPrey']
    },

    // 2) PALADIN – uses Mana (holy power)
    paladin: {
        id: 'paladin',
        name: 'Paladin',
        desc: 'Holy warrior mixing sturdy defense with healing. Uses Mana.',
        resourceKey: 'mana',
        resourceName: 'Mana',
        baseStats: { maxHp: 130, attack: 11, magic: 9, armor: 8, speed: 7 },
        startingSpells: ['holyStrike', 'blessingLight', 'retributionAura']
    },

    // 3) ROGUE – uses Fury (combo-like resource)
    rogue: {
        id: 'rogue',
        name: 'Rogue',
        desc: 'High-crit skirmisher relying on burst and poisons. Uses Fury.',
        resourceKey: 'fury',
        resourceName: 'Fury',
        baseStats: { maxHp: 85, attack: 15, magic: 3, armor: 3, speed: 13 },
        startingSpells: ['backstab', 'poisonedBlade', 'shadowstep']
    },

    // 4) CLERIC – uses Mana
    cleric: {
        id: 'cleric',
        name: 'Cleric',
        desc: 'Support caster specializing in healing and cleansing. Uses Mana.',
        resourceKey: 'mana',
        resourceName: 'Mana',
        baseStats: { maxHp: 100, attack: 7, magic: 14, armor: 3, speed: 8 },
        startingSpells: ['holyHeal', 'smite', 'purify']
    },

    // 5) NECROMANCER – uses Mana
    necromancer: {
        id: 'necromancer',
        name: 'Necromancer',
        desc: 'Dark mage that drains life and calls skeletal allies. Uses Mana.',
        resourceKey: 'mana',
        resourceName: 'Mana',
        baseStats: { maxHp: 80, attack: 5, magic: 17, armor: 2, speed: 8 },
        startingSpells: ['soulBolt', 'raiseBones', 'decay']
    },

    // 6) SHAMAN – uses Mana
    shaman: {
        id: 'shaman',
        name: 'Shaman',
        desc: 'Hybrid caster channeling storm and earth. Uses Mana.',
        resourceKey: 'mana',
        resourceName: 'Mana',
        baseStats: { maxHp: 105, attack: 10, magic: 10, armor: 5, speed: 9 },
        startingSpells: ['lightningLash', 'earthskin', 'spiritHowl', 'totemSpark']
    },

    // 7) BERSERKER – uses Fury
    berserker: {
        id: 'berserker',
        name: 'Berserker',
        desc: 'Reckless bruiser who grows stronger as they bleed. Uses Fury.',
        resourceKey: 'fury',
        resourceName: 'Fury',
        baseStats: { maxHp: 130, attack: 17, magic: 2, armor: 5, speed: 9 },
        startingSpells: ['frenziedBlow', 'warCryBerserker', 'bloodlustRage']
    },

    // 8) VAMPIRE – uses Essence (its own special mana type)
    vampire: {
        id: 'vampire',
        name: 'Vampire',
        desc: 'Night-stalking caster that steals Essence from foes.',
        resourceKey: 'essence',
        resourceName: 'Essence',
        baseStats: { maxHp: 95, attack: 9, magic: 14, armor: 3, speed: 11 },
        startingSpells: ['essenceDrain', 'batSwarm', 'shadowVeil']
    }
}
