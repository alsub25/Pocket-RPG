/* =============================================================================
 * Ability Definitions (abilities.js)
 * Patch: 1.2.65 — The Protocol
 *
 * Extracted from engine.js as part of the 1.2.65 modularization overhaul.
 * This file is intentionally DATA-ONLY (no side effects).
 * ============================================================================= */

export const ABILITIES = {
    // TECH SPECIALIST
    fireball: {
        id: 'fireball',
        name: 'Plasma Blast',
        classId: 'mage',
        cost: { mana: 20 },
        note: 'A scorching plasma projectile that deals heavy thermal damage.'
    },
    iceShard: {
        id: 'iceShard',
        name: 'Cryo Shot',
        classId: 'mage',
        cost: { mana: 15 },
        note: 'Moderate damage with a freezing effect. In Hard, AI assumes you slow it.'
    },
    arcaneShield: {
        id: 'arcaneShield',
        name: 'Energy Shield',
        classId: 'mage',
        cost: { mana: 18 },
        note: 'Deploy a barrier that absorbs damage this fight.'
    },

    // SOLDIER
    powerStrike: {
        id: 'powerStrike',
        name: 'Power Strike',
        classId: 'warrior',
        cost: { fury: 25 },
        note: 'Consume Adrenaline for a crushing blow.'
    },
    battleCry: {
        id: 'battleCry',
        name: 'War Shout',
        classId: 'warrior',
        cost: { fury: 15 },
        note: 'Boost attack and generate extra Adrenaline.'
    },
    shieldWall: {
        id: 'shieldWall',
        name: 'Barrier Deploy',
        classId: 'warrior',
        cost: { fury: 20 },
        note: 'Greatly reduce incoming damage for a short time.'
    },

    // CYBORG
    bloodSlash: {
        id: 'bloodSlash',
        name: 'Bio-Blade',
        classId: 'blood',
        cost: { hp: 10 },
        note: 'Convert your own vitality into a vicious strike.'
    },
    leech: {
        id: 'leech',
        name: 'Life Drain',
        classId: 'blood',
        cost: { blood: 15 },
        note: 'Siphon energy from the enemy and heal yourself.'
    },
    hemorrhage: {
        id: 'hemorrhage',
        name: 'Trauma Protocol',
        classId: 'blood',
        cost: { blood: 20 },
        note: 'Inflict a lingering wound that bleeds over time.'
    },
    // SCOUT
    piercingShot: {
        id: 'piercingShot',
        name: 'Armor-Piercing Round',
        classId: 'ranger',
        cost: { fury: 20 },
        note: 'A powerful shot that punches straight through defenses.'
    },
    twinArrows: {
        id: 'twinArrows',
        name: 'Dual Shot',
        classId: 'ranger',
        cost: { fury: 25 },
        note: 'Fire two rapid shots in succession.'
    },
    markedPrey: {
        id: 'markedPrey',
        name: 'Target Designator',
        classId: 'ranger',
        cost: { fury: 15 },
        note: 'Mark your foe and cause bleeding from precise hits.'
    },

    // SHIELD OPERATIVE
    holyStrike: {
        id: 'holyStrike',
        name: 'Concussive Strike',
        classId: 'paladin',
        cost: { mana: 15 },
        note: 'Strike the target with a powerful blow, stronger against wounded foes.'
    },
    blessingLight: {
        id: 'blessingLight',
        name: 'Med-Kit Deploy',
        classId: 'paladin',
        cost: { mana: 20 },
        note: 'Mend your wounds and deploy a small protective shield.'
    },
    retributionAura: {
        id: 'retributionAura',
        name: 'Combat Stim',
        classId: 'paladin',
        cost: { mana: 18 },
        note: 'Empower your strikes and harden your resolve for a short time.'
    },

    // INFILTRATOR
    backstab: {
        id: 'backstab',
        name: 'Backstab',
        classId: 'rogue',
        cost: { fury: 18 },
        note: 'A vicious strike that is deadliest when the fight has just begun.'
    },
    poisonedBlade: {
        id: 'poisonedBlade',
        name: 'Toxin Blade',
        classId: 'rogue',
        cost: { fury: 20 },
        note: 'Slash your foe and inflict a lingering toxin.'
    },
    shadowstep: {
        id: 'shadowstep',
        name: 'Phase Shift',
        classId: 'rogue',
        cost: { fury: 12 },
        note: 'Teleport through space, repositioning and sharpening your next attack.'
    },

    // MEDIC
    holyHeal: {
        id: 'holyHeal',
        name: 'Emergency Heal',
        classId: 'cleric',
        cost: { mana: 22 },
        note: 'Deploy medical nanites to restore your vitality.'
    },
    smite: {
        id: 'smite',
        name: 'Shock Bolt',
        classId: 'cleric',
        cost: { mana: 14 },
        note: 'A focused bolt of electrical power.'
    },
    purify: {
        id: 'purify',
        name: 'Cleanse',
        classId: 'cleric',
        cost: { mana: 16 },
        note: 'Cleanse yourself of bleeding and bolster your defenses.'
    },

    // DRONE MASTER
    soulBolt: {
        id: 'soulBolt',
        name: 'Drone Strike',
        classId: 'necromancer',
        cost: { mana: 16 },
        note: 'Fire a shard of stolen energy that harms your foe and feeds you.'
    },
    raiseBones: {
        id: 'raiseBones',
        name: 'Deploy Combat Drone',
        classId: 'necromancer',
        cost: { mana: 24 },
        note: 'Summon an automated drone to fight at your side.'
    },
    decay: {
        id: 'decay',
        name: 'Corrosion',
        classId: 'necromancer',
        cost: { mana: 20 },
        note: 'Corrode your enemy from within with a stacking, bleeding effect.'
    },

    // PSIONIC
    lightningLash: {
        id: 'lightningLash',
        name: 'Lightning Lash',
        classId: 'shaman',
        cost: { mana: 18 },
        note: 'Crackling lightning scorches your foe with unpredictable force.'
    },
    earthskin: {
        id: 'earthskin',
        name: 'Kinetic Barrier',
        classId: 'shaman',
        cost: { mana: 16 },
        note: 'Force field dampens incoming blows for a short while.'
    },
    spiritHowl: {
        id: 'spiritHowl',
        name: 'Battle Cry',
        classId: 'shaman',
        cost: { mana: 20 },
        note: 'Let out a primal call that empowers your companion.'
    },
    // ENERGY SIPHON
    essenceDrain: {
        id: 'essenceDrain',
        name: 'Power Drain',
        classId: 'vampire',
        cost: { essence: 20 },
        note: 'Rip energy from your foe, healing yourself and refilling Essence.'
    },
    batSwarm: {
        id: 'batSwarm',
        name: 'Nano Swarm',
        classId: 'vampire',
        cost: { essence: 25 },
        note: 'Unleash a swarm of nanobots that ravage and bleed the target.'
    },
    shadowVeil: {
        id: 'shadowVeil',
        name: 'Cloak Field',
        classId: 'vampire',
        cost: { essence: 18 },
        note: 'Shroud yourself in a cloaking field to reduce damage taken for a short time.'
    },

    // HEAVY TROOPER
    frenziedBlow: {
        id: 'frenziedBlow',
        name: 'Frenzied Blow',
        classId: 'berserker',
        cost: { fury: 25 },
        note: 'A reckless swing that grows stronger the more wounded you are.'
    },
    warCryBerserker: {
        id: 'warCryBerserker',
        name: 'War Cry',
        classId: 'berserker',
        cost: { fury: 18 },
        note: 'Roar yourself into a frenzy, restoring some vitality and power.'
    },
    bloodlustRage: {
        id: 'bloodlustRage',
        name: 'Combat Stim',
        classId: 'berserker',
        cost: { fury: 15 },
        note: 'Inject combat stimulants, surging with Adrenaline and attack strength.'
    },

    // --- PATCH 1.1.0: NEW CLASS UNLOCKS --------------------------------------

    // TECH SPECIALIST (unlocks)
    arcaneSurge: {
        id: 'arcaneSurge',
        name: 'Overcharge',
        classId: 'mage',
        cost: { mana: 24 },
        note: 'Unleash a burst of energy damage and charge your focus (short Tech buff). (Unlocks at level 3)'
    },
    meteorSigil: {
        id: 'meteorSigil',
        name: 'Orbital Strike',
        classId: 'mage',
        cost: { mana: 40 },
        note: 'Call down an orbital strike for massive damage to your target and splash damage to nearby foes. (Unlocks at level 6)'
    },

    // SOLDIER (unlocks)
    cleave: {
        id: 'cleave',
        name: 'Cleave',
        classId: 'warrior',
        cost: { fury: 28 },
        note: 'A wide, brutal swing that damages multiple enemies and feeds your Adrenaline. (Unlocks at level 3)'
    },
    ironFortress: {
        id: 'ironFortress',
        name: 'Fortress Protocol',
        classId: 'warrior',
        cost: { fury: 22 },
        note: 'Fortify yourself with a barrier and strong damage reduction. (Unlocks at level 6)'
    },

    // CYBORG (unlocks)
    crimsonPact: {
        id: 'crimsonPact',
        name: 'Bio-Surge',
        classId: 'blood',
        cost: { hp: 12 },
        note: 'Trade HP for a surge of Bio-Energy and a short Attack buff. (Unlocks at level 3)'
    },
    bloodNova: {
        id: 'bloodNova',
        name: 'Bio-Detonation',
        classId: 'blood',
        cost: { blood: 28 },
        note: 'Detonate your Bio-Energy into a violent nova that damages all enemies and makes them bleed. (Unlocks at level 6)'
    },

    // SCOUT (unlocks)
    evasionRoll: {
        id: 'evasionRoll',
        name: 'Evasion Roll',
        classId: 'ranger',
        cost: { fury: 18 },
        note: 'Reposition and become harder to hit for 2 turns. (Unlocks at level 3)'
    },
    rainOfThorns: {
        id: 'rainOfThorns',
        name: 'Flechette Barrage',
        classId: 'ranger',
        cost: { fury: 30 },
        // Explicitly non-elemental: it's a physical projectile volley that can still
        // interact with weapon-based systems.
        tags: ['physical'],
        note: 'A volley that peppers multiple enemies and deepens bleeding. (Unlocks at level 6)'
    },

    // SHIELD OPERATIVE (unlocks)
    judgment: {
        id: 'judgment',
        name: 'Judgment Strike',
        classId: 'paladin',
        cost: { mana: 22 },
        note: 'Strike with force. Deals extra when the foe is bleeding or chilled. (Unlocks at level 3)'
    },
    aegisVow: {
        id: 'aegisVow',
        name: 'Aegis Protocol',
        classId: 'paladin',
        cost: { mana: 26 },
        note: 'A defensive protocol that converts healing into shields and hardens you for 3 turns. (Unlocks at level 6)'
    },

    // INFILTRATOR (unlocks)
    smokeBomb: {
        id: 'smokeBomb',
        name: 'Smoke Bomb',
        classId: 'rogue',
        cost: { fury: 16 },
        note: 'Blind and confuse: gain high dodge for 2 turns. (Unlocks at level 3)'
    },
    cripplingFlurry: {
        id: 'cripplingFlurry',
        name: 'Crippling Flurry',
        classId: 'rogue',
        cost: { fury: 28 },
        note: 'A flurry of strikes that heavily extends bleeding. (Unlocks at level 6)'
    },

    // CLERIC (unlocks)
    divineWard: {
        id: 'divineWard',
        name: 'Divine Ward',
        classId: 'cleric',
        cost: { mana: 22 },
        note: 'Ward yourself with light: cleanse and gain a strong shield. (Unlocks at level 3)'
    },
    benediction: {
        id: 'benediction',
        name: 'Benediction',
        classId: 'cleric',
        cost: { mana: 30 },
        note: 'A powerful blessing that heals and grants a longer Magic buff. (Unlocks at level 6)'
    },

    // NECROMANCER (unlocks)
    boneArmor: {
        id: 'boneArmor',
        name: 'Bone Armor',
        classId: 'necromancer',
        cost: { mana: 24 },
        note: 'Raise bone plates to gain a shield and reduce enemy Attack. (Unlocks at level 3)'
    },
    deathMark: {
        id: 'deathMark',
        name: 'Death Mark',
        classId: 'necromancer',
        cost: { mana: 32 },
        note: 'Brand the foe: your next hit deals amplified shadow damage. (Unlocks at level 6)'
    },

    // SHAMAN (unlocks)
    totemSpark: {
        id: 'totemSpark',
        name: 'Totem Spark',
        classId: 'shaman',
        cost: { mana: 20 },
        note: 'A crackling spark that jolts and may briefly stun. (Unlocks at level 3)'
    },
    stoneQuake: {
        id: 'stoneQuake',
        name: 'Stone Quake',
        classId: 'shaman',
        cost: { mana: 30 },
        note: 'Shake the ground to damage and chill multiple enemies. (Unlocks at level 6)'
    },

    // BERSERKER (unlocks)
    rageRush: {
        id: 'rageRush',
        name: 'Rage Rush',
        classId: 'berserker',
        cost: { fury: 22 },
        note: 'Rush forward with a brutal strike; stronger when wounded. (Unlocks at level 3)'
    },
    execute: {
        id: 'execute',
        name: 'Execute',
        classId: 'berserker',
        cost: { fury: 35 },
        note: 'Attempt to finish a weakened enemy with enormous damage. (Unlocks at level 6)'
    },

    // VAMPIRE (unlocks)
    nightFeast: {
        id: 'nightFeast',
        name: 'Night Feast',
        classId: 'vampire',
        cost: { essence: 22 },
        note: 'Feast on the foe: heavy shadow damage and strong healing. (Unlocks at level 3)'
    },
    mistForm: {
        id: 'mistForm',
        name: 'Mist Form',
        classId: 'vampire',
        cost: { essence: 30 },
        note: 'Become misty and elusive, heavily reducing damage taken for 3 turns. (Unlocks at level 6)'
    },


    // --- PATCH 1.1.7: NEW CLASS UNLOCKS (Lv 9 / Lv 12) --------------------

    // MAGE
    blink: {
        id: 'blink',
        name: 'Blink',
        classId: 'mage',
        cost: { mana: 18 },
        note: 'Slip through space, gaining high evasion for 2 turns. (Unlocks at level 9)'
    },
    arcaneOverload: {
        id: 'arcaneOverload',
        name: 'Arcane Overload',
        classId: 'mage',
        cost: { mana: 48 },
        note: 'Overcharge arcane power for massive damage and splash damage to other foes. (Unlocks at level 12)'
    },

    // WARRIOR
    shieldBash: {
        id: 'shieldBash',
        name: 'Shield Bash',
        classId: 'warrior',
        cost: { fury: 20 },
        note: 'Bash with your shield to stagger and shield yourself. (Unlocks at level 9)'
    },
    unbreakable: {
        id: 'unbreakable',
        name: 'Unbreakable',
        classId: 'warrior',
        cost: { fury: 36 },
        note: 'Become a fortress: huge barrier and damage reduction. (Unlocks at level 12)'
    },

    // BLOOD KNIGHT
    bloodArmor: {
        id: 'bloodArmor',
        name: 'Blood Armor',
        classId: 'blood',
        cost: { blood: 22 },
        note: 'Condense blood into armor, granting a heavy shield. (Unlocks at level 9)'
    },
    crimsonAvatar: {
        id: 'crimsonAvatar',
        name: 'Crimson Avatar',
        classId: 'blood',
        cost: { hp: 18 },
        note: 'Sacrifice HP to enter a brutal stance, empowering your attacks. (Unlocks at level 12)'
    },

    // RANGER
    huntersTrap: {
        id: 'huntersTrap',
        name: "Hunter's Trap",
        classId: 'ranger',
        cost: { fury: 22 },
        note: 'Set a trap that wounds and hinders the foe. (Unlocks at level 9)'
    },
    headshot: {
        id: 'headshot',
        name: 'Headshot',
        classId: 'ranger',
        cost: { fury: 38 },
        note: 'Spend Marks to deliver devastating precision damage. (Unlocks at level 12)'
    },

    // PALADIN
    cleanseFlame: {
        id: 'cleanseFlame',
        name: 'Cleansing Flame',
        classId: 'paladin',
        cost: { mana: 18 },
        note: 'Cleanse harmful effects and restore health. (Unlocks at level 9)'
    },
    divineIntervention: {
        id: 'divineIntervention',
        name: 'Divine Intervention',
        classId: 'paladin',
        cost: { mana: 44 },
        note: 'A miracle of healing and shielding. (Unlocks at level 12)'
    },

    // ROGUE
    eviscerate: {
        id: 'eviscerate',
        name: 'Eviscerate',
        classId: 'rogue',
        cost: { fury: 32 },
        note: 'Spend Combo Points for burst damage. (Unlocks at level 9)'
    },
    vanish: {
        id: 'vanish',
        name: 'Vanish',
        classId: 'rogue',
        cost: { fury: 24 },
        note: 'Disappear into shadows, gaining huge evasion and combo momentum. (Unlocks at level 12)'
    },

    // CLERIC
    sanctify: {
        id: 'sanctify',
        name: 'Sanctify',
        classId: 'cleric',
        cost: { mana: 26 },
        note: 'Cleanse and shield yourself with holy light. (Unlocks at level 9)'
    },
    massPrayer: {
        id: 'massPrayer',
        name: 'Mass Prayer',
        classId: 'cleric',
        cost: { mana: 46 },
        note: 'A deep prayer that heals and empowers your magic. (Unlocks at level 12)'
    },

    // NECROMANCER
    harvest: {
        id: 'harvest',
        name: 'Harvest',
        classId: 'necromancer',
        cost: { mana: 26 },
        note: 'Reap life and gather Soul Shards for later power. (Unlocks at level 9)'
    },
    lichForm: {
        id: 'lichForm',
        name: 'Lich Form',
        classId: 'necromancer',
        cost: { mana: 40 },
        note: 'Ascend briefly, empowering shadow magic and siphoning life. (Unlocks at level 12)'
    },

    // SHAMAN
    totemEarth: {
        id: 'totemEarth',
        name: 'Totem: Earth',
        classId: 'shaman',
        cost: { mana: 24 },
        note: 'Call an earth totem for protection. (Unlocks at level 9)'
    },
    tempest: {
        id: 'tempest',
        name: 'Tempest',
        classId: 'shaman',
        cost: { mana: 40 },
        note: 'Unleash a storm burst that chains through multiple enemies; stronger with an active totem. (Unlocks at level 12)'
    },

    // BERSERKER
    enrage: {
        id: 'enrage',
        name: 'Enrage',
        classId: 'berserker',
        cost: { fury: 20 },
        note: 'Fan the flames: longer attack buff and Fury flow. (Unlocks at level 9)'
    },
    bloodFrenzy: {
        id: 'bloodFrenzy',
        name: 'Blood Frenzy',
        classId: 'berserker',
        cost: { fury: 40 },
        note: 'A violent finisher that heals based on damage dealt. (Unlocks at level 12)'
    },

    // VAMPIRE
    mesmerize: {
        id: 'mesmerize',
        name: 'Mesmerize',
        classId: 'vampire',
        cost: { essence: 24 },
        note: 'Charm and stagger the foe with shadow magic. (Unlocks at level 9)'
    },
    bloodMoon: {
        id: 'bloodMoon',
        name: 'Blood Moon',
        classId: 'vampire',
        cost: { essence: 45 },
        note: 'A brutal eclipse: huge shadow damage and healing. (Unlocks at level 12)'
    },
}

