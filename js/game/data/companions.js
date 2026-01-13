// js/game/data/companions.js
// Companion definitions + companion ability kits.
// Extracted from engine.js in Patch 1.2.72 for maintainability and to keep engine.js lean.

export const COMPANION_DEFS = {
    wolf: {
        id: 'wolf',
        name: 'Ember Wolf',
        role: 'DPS',
        description: 'A loyal hunter that tears into enemies.',
        baseAttack: 10,
        baseHpBonus: 0,
        behavior: 'aggressive',
        abilities: ['pounce', 'ripAndTear', 'howlOfFury', 'savageBleed']
    },
    golem: {
        id: 'golem',
        name: 'Stone Golem',
        role: 'Tank',
        description: 'A sturdy construct that shields you from harm.',
        baseAttack: 6,
        baseHpBonus: 20,
        behavior: 'protective',
        abilities: ['guardSmash', 'seismicStomp', 'ironResolve', 'pulverize']
    },
    sprite: {
        id: 'sprite',
        name: 'Moonlit Sprite',
        role: 'Healer',
        description: 'A tiny spirit that mends your wounds.',
        baseAttack: 4,
        baseHpBonus: 0,
        behavior: 'healer',
        abilities: [
            'gulfHeal',
            'soothingBreeze',
            'restorativeChorus',
            'lullaby'
        ]
    },
    skeleton: {
        id: 'skeleton',
        name: 'Bound Skeleton',
        role: 'Bleed',
        description: 'A reanimated warrior that inflicts bleeding wounds.',
        baseAttack: 8,
        baseHpBonus: 0,
        behavior: 'bleeder',
        abilities: [
            'enfeebleStrike',
            'boneCrush',
            'marrowDrain',
            'plaguedBlade'
        ]
    },
    falcon: {
        id: 'falcon',
        name: 'Skyhunter Falcon',
        role: 'Ranged',
        description:
            'A swift predator that harasses foes from above, often causing bleeding strikes.',
        baseAttack: 9,
        baseHpBonus: 0,
        behavior: 'ranged',
        abilities: ['talonVolley', 'skyDive', 'pinningStrike', 'scoutingCry']
    },
    treant: {
        id: 'treant',
        name: 'Ancient Treant',
        role: 'support-tank',
        description:
            'A walking tree that shields you and slowly restores your vitality.',
        baseAttack: 6,
        baseHpBonus: 25,
        behavior: 'guardian',
        abilities: [
            'rootWard',
            'regenerativeBark',
            'entanglingRoots',
            'oakMight'
        ]
    },
    familiar: {
        id: 'familiar',
        name: 'Arcane Familiar',
        role: 'Battery',
        description:
            'A floating mote of magic that replenishes your combat resources.',
        baseAttack: 5,
        baseHpBonus: 0,
        behavior: 'battery',
        abilities: [
            'overcharge',
            'manaConduit',
            'arcaneBarrage',
            'tetheredWard'
        ]
    },
    mimic: {
        id: 'mimic',
        name: 'Shadow Mimic',
        role: 'Mimic',
        description:
            'A copy of your fighting spirit that mirrors your power in attacks.',
        baseAttack: 8,
        baseHpBonus: 0,
        behavior: 'mimic',
        abilities: ['mirrorBurst', 'echoStrike', 'shadowLatch', 'mimicSurge']
    }
}

export const COMPANION_ABILITIES = {
    // WOLF
    pounce: {
        id: 'pounce',
        name: 'Pounce',
        desc: 'A heavy leap that deals high physical damage and briefly stuns the target.',
        cooldown: 3, // turns
        type: 'damage',
        potency: 1.6,
        stunTurns: 1
    },
    // GOLEM
    guardSmash: {
        id: 'guardSmash',
        name: 'Guard Smash',
        desc: 'Smashes the ground, dealing damage and granting a shield to the player.',
        cooldown: 4,
        type: 'shield+damage',
        potency: 1.1,
        shieldBase: 18
    },
    // SPRITE
    gulfHeal: {
        id: 'gulfHeal',
        name: 'Gulf Heal',
        desc: 'Large single-target heal for the player (stronger when player is low).',
        cooldown: 4,
        type: 'heal',
        potency: 0.35
    },
    // SKELETON
    enfeebleStrike: {
        id: 'enfeebleStrike',
        name: 'Enfeeble Strike',
        desc: 'Deal damage and reduce enemy attack for a few turns.',
        cooldown: 3,
        type: 'damage+debuff',
        potency: 1.0,
        atkDown: 3,
        debuffTurns: 2
    },
    // FALCON
    talonVolley: {
        id: 'talonVolley',
        name: 'Talon Volley',
        desc: 'Rapid strafing strike with high crit chance (simulated by extra random spike).',
        cooldown: 3,
        type: 'damage',
        potency: 1.2,
        critSpike: 0.45
    },
    // TREANT
    rootWard: {
        id: 'rootWard',
        name: 'Root Ward',
        desc: 'Place a ward that heals the player a bit each turn and blocks one enemy heavy action when present.',
        cooldown: 6,
        type: 'ward',
        potency: 0.08,
        wardTurns: 3
    },
    // FAMILIAR
    overcharge: {
        id: 'overcharge',
        name: 'Overcharge',
        desc: 'Restore a large chunk of the player resource and empower next player spell (simple buff).',
        cooldown: 5,
        type: 'resource',
        potency: 0.4,
        buffTurns: 1
    },
    // MIMIC
    mirrorBurst: {
        id: 'mirrorBurst',
        name: 'Mirror Burst',
        desc: 'Reflects a portion of next incoming damage back to the attacker for a short time and deals burst damage now.',
        cooldown: 5,
        type: 'damage+reflect',
        potency: 1.0,
        reflectTurns: 2,
        reflectPct: 0.35
    },
    // --- Additional companion abilities (3 per companion) --------------------
    // WOLF extras
    ripAndTear: {
        id: 'ripAndTear',
        name: 'Rip & Tear',
        desc: 'A vicious tearing combo that deals two quick hits (simulated as a single stronger strike).',
        cooldown: 3,
        type: 'damage',
        potency: 1.9
    },
    howlOfFury: {
        id: 'howlOfFury',
        name: 'Howl of Fury',
        desc: 'A rallying howl that temporarily increases companion damage and slightly boosts player attack for 2 turns.',
        cooldown: 5,
        type: 'damage',
        potency: 1.0,
        buffTurns: 2
        // note: we store buff marker on comp to let AI score it; actual buff application can be a simple p.status flag
    },
    savageBleed: {
        id: 'savageBleed',
        name: 'Savage Bleed',
        desc: 'A brutal strike that deals damage and applies a bleed (DoT) for a few turns.',
        cooldown: 4,
        type: 'damage+debuff',
        potency: 1.05,
        atkDown: 0,
        debuffTurns: 3
        // reuse enemy.bleedTurns/bleedDamage semantics in useCompanionAbility
    },

    // GOLEM extras
    seismicStomp: {
        id: 'seismicStomp',
        name: 'Seismic Stomp',
        desc: 'Heavy area stomp that deals damage and briefly lowers enemy speed/agility (simulated as reduced crit chance).',
        cooldown: 5,
        type: 'damage',
        potency: 1.4
    },
    ironResolve: {
        id: 'ironResolve',
        name: 'Iron Resolve',
        desc: 'Fortifies the player: large temporary shield plus small armor buff for 3 turns.',
        cooldown: 6,
        type: 'shield+damage',
        potency: 0.7,
        shieldBase: 28
    },
    pulverize: {
        id: 'pulverize',
        name: 'Pulverize',
        desc: 'A devastating smash that deals heavy damage and reduces enemy armor for a few turns.',
        cooldown: 6,
        type: 'damage+debuff',
        potency: 1.6,
        atkDown: 0,
        debuffTurns: 3
    },

    // SPRITE extras
    soothingBreeze: {
        id: 'soothingBreeze',
        name: 'Soothing Breeze',
        desc: 'Small immediate heal plus a mild heal-over-time for 3 turns.',
        cooldown: 3,
        type: 'heal',
        potency: 0.18
    },
    restorativeChorus: {
        id: 'restorativeChorus',
        name: 'Restorative Chorus',
        desc: 'Medium heal and grants a small resource restore to the player.',
        cooldown: 5,
        type: 'heal',
        potency: 0.25
    },
    lullaby: {
        id: 'lullaby',
        name: 'Lullaby',
        desc: 'Soothes the enemy, reducing their damage output for a couple turns (debuff).',
        cooldown: 4,
        type: 'damage+debuff',
        potency: 0.6,
        atkDown: 4,
        debuffTurns: 2
    },

    // SKELETON extras
    boneCrush: {
        id: 'boneCrush',
        name: 'Bone Crush',
        desc: 'Heavy single-target physical blow that has a small chance to stun.',
        cooldown: 4,
        type: 'damage',
        potency: 1.35,
        stunChance: 0.18
    },
    marrowDrain: {
        id: 'marrowDrain',
        name: 'Marrow Drain',
        desc: 'Deals moderate damage and transfers a small heal to the companion (self-sustain).',
        cooldown: 4,
        type: 'damage',
        potency: 0.95
    },
    plaguedBlade: {
        id: 'plaguedBlade',
        name: 'Plagued Blade',
        desc: 'Deals damage and applies a stacking poison/DoT (use enemy.bleed fields to reuse logic).',
        cooldown: 5,
        type: 'damage+debuff',
        potency: 1.05,
        debuffTurns: 3
    },

    // FALCON extras
    skyDive: {
        id: 'skyDive',
        name: 'Sky Dive',
        desc: 'A high-velocity dive that deals big damage; more likely to trigger a critSpike-like bonus.',
        cooldown: 4,
        type: 'damage',
        potency: 1.6,
        critSpike: 0.35
    },
    pinningStrike: {
        id: 'pinningStrike',
        name: 'Pinning Strike',
        desc: 'Deals damage and pins the enemy briefly, lowering their speed or action frequency (use stunTurns as proxy).',
        cooldown: 4,
        type: 'damage+debuff',
        potency: 1.05,
        atkDown: 0,
        debuffTurns: 2,
        stunTurns: 1
    },
    scoutingCry: {
        id: 'scoutingCry',
        name: 'Scouting Cry',
        desc: 'Marks the enemy, increasing damage taken from player and companion for 2 turns (buff on player/enemy flag).',
        cooldown: 6,
        type: 'damage+debuff',
        potency: 0.4,
        debuffTurns: 2
    },

    // TREANT extras
    regenerativeBark: {
        id: 'regenerativeBark',
        name: 'Regenerative Bark',
        desc: 'Small heal to player each turn for 3 turns (ward-like persistent heal).',
        cooldown: 5,
        type: 'ward',
        potency: 0.06,
        wardTurns: 3
    },
    entanglingRoots: {
        id: 'entanglingRoots',
        name: 'Entangling Roots',
        desc: 'Apply a slow root (simulated as repeated small DoT + reduced enemy actions) for a few turns.',
        cooldown: 5,
        type: 'damage+debuff',
        potency: 0.55,
        debuffTurns: 3
    },
    oakMight: {
        id: 'oakMight',
        name: 'Oak Might',
        desc: 'A supportive slam that grants a medium shield and increases player armor for a few turns.',
        cooldown: 6,
        type: 'shield+damage',
        potency: 0.9,
        shieldBase: 22
    },

    // FAMILIAR extras
    manaConduit: {
        id: 'manaConduit',
        name: 'Mana Conduit',
        desc: 'Restores a sizeable portion of player resource and grants a short spell-power buff.',
        cooldown: 5,
        type: 'resource',
        potency: 0.45,
        buffTurns: 1
    },
    arcaneBarrage: {
        id: 'arcaneBarrage',
        name: 'Arcane Barrage',
        desc: 'Rapid arcane bolts that do repeated small magic damage (simulated as one stronger hit).',
        cooldown: 3,
        type: 'damage',
        potency: 1.15
    },
    tetheredWard: {
        id: 'tetheredWard',
        name: 'Tethered Ward',
        desc: 'Places a ward that heals player slightly each turn and absorbs a small amount of damage.',
        cooldown: 6,
        type: 'ward',
        potency: 0.05,
        wardTurns: 3
    },

    // MIMIC extras
    echoStrike: {
        id: 'echoStrike',
        name: 'Echo Strike',
        desc: 'Copies the last player action style and deals damage accordingly.',
        cooldown: 4,
        type: 'damage',
        potency: 1.2
    },
    shadowLatch: {
        id: 'shadowLatch',
        name: 'Shadow Latch',
        desc: 'Binds to the enemy: reduces enemy healing and increases damage taken for a few turns.',
        cooldown: 5,
        type: 'damage+debuff',
        potency: 0.6,
        debuffTurns: 3
    },
    mimicSurge: {
        id: 'mimicSurge',
        name: 'Mimic Surge',
        desc: "A burst that scales off the player's last damage and attempts to secure a kill.",
        cooldown: 6,
        type: 'damage',
        potency: 1.8
    }
}
