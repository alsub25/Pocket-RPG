/* =============================================================================
 * Item Definitions (items.js)
 * Patch: 1.2.65 — The Blackbark Oath Patch
 *
 * Authored item catalog extracted from engine.js for modularization.
 * ============================================================================= */

export const ITEM_DEFS = {
    potionSmall: {
        id: 'potionSmall',
        name: 'Minor Healing Potion',
        type: 'potion',
        hpRestore: 40,
        price: 18,
        desc: 'Restore 40 HP.'
    },
    potionMana: {
        id: 'potionMana',
        name: 'Small Mana Potion',
        type: 'potion',
        resourceKey: 'mana',
        resourceRestore: 35,
        price: 20,
        desc: 'Restore 35 Mana.'
    },
    potionFury: {
        id: 'furyDraft',
        name: 'Draft of Rage',
        type: 'potion',
        resourceKey: 'fury',
        resourceRestore: 40,
        price: 22,
        desc: 'Instantly generate 40 Fury.'
    },
    potionEssence: {
        id: 'essenceVial',
        name: 'Shadowed Essence Vial',
        type: 'potion',
        resourceKey: 'essence',
        resourceRestore: 30,
        price: 24,
        desc: 'Distilled soul energy that restores 30 Essence.'
    },
    potionBlood: {
        id: 'bloodVial',
        name: 'Crimson Vial',
        type: 'potion',
        resourceKey: 'blood',
        resourceRestore: 30,
        price: 22,
        desc: 'Condensed blood to fuel your arts.'
    },
    swordIron: {
        id: 'swordIron',
        name: 'Iron Longsword',
        type: 'weapon',
        attackBonus: 6,
        price: 45,
        desc: '+6 Attack. Favored by warriors.',
        bleedChance: 0.18,
        bleedTurns: 2,
        bleedDmgPct: 0.12,
        elementalBonuses: { fire: 6 },
    },
    staffOak: {
        id: 'staffOak',
        name: 'Runed Oak Staff',
        type: 'weapon',
        magicBonus: 5,
        price: 45,
        desc: '+5 Magic. Smooth channeling for spellcasters.',
        onShieldCastNextDmgPct: 10,
        elementalBonuses: { arcane: 8 },
    },
    bladeSanguine: {
        id: 'bladeSanguine',
        name: 'Sanguine Edge',
        type: 'weapon',
        attackBonus: 4,
        magicBonus: 3,
        price: 60,
        desc: '+4 Attack, +3 Magic. Whispers for blood.',
        onKillGain: { key: 'resource', amount: 6 },
        elementalBonuses: { shadow: 6 },
    },
    armorLeather: {
        id: 'armorLeather',
        name: 'Hardened Leather',
        type: 'armor',
        slot: 'armor',
        armorBonus: 4,
        price: 40,
        desc: '+4 Armor. Basic but reliable.',
        elementalResists: { nature: 10 },
    },
    robeApprentice: {
        id: 'robeApprentice',
        name: 'Apprentice Robe',
        type: 'armor',
        slot: 'armor',
        armorBonus: 2,
        maxResourceBonus: 20,
        price: 40,
        desc: '+2 Armor, +20 Mana.',
        elementalResists: { arcane: 10 }
    },

    // --- Quest Items -------------------------------------------------------
    // These are stored as "potion" items so they reuse the existing inventory
    // renderer without needing a new item tab. They are NOT usable/sellable/droppable.
    stolenGrainPouch: {
        id: 'stolenGrainPouch',
        name: 'Stolen Grain Pouch',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A pouch of Emberwood grain taken by goblin thieves. (Quest Item)'
    },
    runnersSatchel: {
        id: 'runnersSatchel',
        name: 'Runner\'s Satchel',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A satchel with a village clasp — proof someone intercepted the runner. (Quest Item)'
    },

    // --- Main Quest Proof Items -------------------------------------------
    goblinTrailMark: {
        id: 'goblinTrailMark',
        name: 'Goblin Trail‑Mark',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A crude charm used by goblin raiders to mark safe routes. (Quest Item)'
    },
    // Chapter I (expanded) proof items
    bitterleaf: {
        id: 'bitterleaf',
        name: 'Bitterleaf',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A sharp, resinous leaf used in warding salves. (Quest Item)'
    },
    huntersBrooch: {
        id: 'huntersBrooch',
        name: 'Hunter\'s Brooch',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A tarnished brooch bearing Emberwood\'s hunt‑knot. Proof the snareline was set. (Quest Item)'
    },
    supplyTag: {
        id: 'supplyTag',
        name: 'Supply Tag',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A leather tag punched with crude symbols and smeared pitch. It reeks of stolen stores. (Quest Item)'
    },
    cacheLedger: {
        id: 'cacheLedger',
        name: 'Cache Ledger',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A greasy tally‑scrap listing stolen goods and trail turns. The ink crawls like ants. (Quest Item)'
    },
    drumskinBanner: {
        id: 'drumskinBanner',
        name: 'Drumskin Banner',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A strip of drumskin painted with a war‑mark. It still trembles faintly. (Quest Item)'
    },
    warlordSigil: {
        id: 'warlordSigil',
        name: 'Warlord Sigil',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A stamped bone token used to pass the Warlord\'s sentries. Cold to the touch. (Quest Item)'
    },
    voidShard: {
        id: 'voidShard',
        name: 'Void‑Shard',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A splinter of void‑sick crystal. It hums when the Spire is near. (Quest Item)'
    },
    witchFocusTotem: {
        id: 'witchFocusTotem',
        name: 'Witch‑Focus Totem',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A bog‑carved focus bound with reed‑knots. It smells like wet ash. (Quest Item)'
    },
    giantRuneStone: {
        id: 'giantRuneStone',
        name: 'Giant Rune‑Stone',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A heavy rune‑stone etched with Frostpeak script. It feels like a challenge. (Quest Item)'
    },
    phylacteryFragment: {
        id: 'phylacteryFragment',
        name: 'Phylactery Fragment',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A cracked shard from a drowned phylactery. Cold enough to bruise the air. (Quest Item)'
    },
    keepSeal: {
        id: 'keepSeal',
        name: 'Keep Seal',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A stamped seal taken from the Obsidian King\'s guard. It grants passage — or provokes it. (Quest Item)'
    },

    // --- Chapter II: Oath Splinters (interactive) --------------------------
    oathSplinterSapRun: {
        id: 'oathSplinterSapRun',
        name: 'Oath‑Splinter: Sap‑Run',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'Living heartwood that pulses with old vows. (Quest Item)'
    },
    oathSplinterWitchReed: {
        id: 'oathSplinterWitchReed',
        name: 'Oath‑Splinter: Witch‑Reed',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A reed‑bound splinter that smells of marsh‑lanterns and regret. (Quest Item)'
    },
    oathSplinterBoneChar: {
        id: 'oathSplinterBoneChar',
        name: 'Oath‑Splinter: Bone‑Char',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'Charred heartwood light as ash and heavy as guilt. (Quest Item)'
    },

    // --- Chapter II (expanded): Quiet Ink ----------------------------------------------
    quietInkResin: {
        id: 'quietInkResin',
        name: 'Quiet Ink Resin',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A tarry bead that drinks light. The Bark‑Scribe calls it “ink that remembers what was erased.” (Quest Item)'
    },

    // --- Chapter III (expanded): Field Proofs ------------------------------------------
    charcoalRubbing: {
        id: 'charcoalRubbing',
        name: 'Charcoal Rubbing',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A rough rubbing of carved veins and forbidden sigils, smudged with soot. (Quest Item)'
    },
    starIronShard: {
        id: 'starIronShard',
        name: 'Star‑Iron Shard',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
	        desc: 'A splinter of meteoric iron that hums when the sky is quiet. (Quest Item)'
	    },

    // --- Chapter III: Relics ----------------------------------------------
    crownEcho: {
        id: 'crownEcho',
        name: 'Crown‑Echo',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'Not an object — a memory with teeth. Cold as a promise kept by someone else. (Quest Item)'
    },
    starIronPin: {
        id: 'starIronPin',
        name: 'Star‑Iron Pin',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A cold weight that can anchor a vow — or a lie. (Quest Item)'
    },
    graveLatch: {
        id: 'graveLatch',
        name: 'Grave‑Latch',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A key that was never meant to be carried. The catacombs still taste it. (Quest Item)'
    },
    hollowCrownRemnant: {
        id: 'hollowCrownRemnant',
        name: 'Hollow Crown Remnant',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A sliver of crown‑absence. It refuses to reflect light. (Quest Item)'
    }

    // --- Chapter IV: The Rootbound Court ----------------------------------
    ,verdantLens: {
        id: 'verdantLens',
        name: 'Verdant Lens',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A damp shard of green‑glass that makes lies flare like mold. (Quest Item)'
    },
    courtWritMarsh: {
        id: 'courtWritMarsh',
        name: 'Marsh Writ',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A wet summons stamped in sap. The ink smells like reeds. (Quest Item)'
    },
    courtWritFrost: {
        id: 'courtWritFrost',
        name: 'Frozen Writ',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'Paper rimed with cold authority. The seal bites your fingers. (Quest Item)'
    },
    courtWritBone: {
        id: 'courtWritBone',
        name: 'Bone Writ',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A record written in silence and signed where the dead keep accounts. (Quest Item)'
    },
    sealOfVerdict: {
        id: 'sealOfVerdict',
        name: 'Seal of Verdict',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'A heavy stamp of obsidian links. It can close a case — or open one. (Quest Item)'
    },
    magistrateSigil: {
        id: 'magistrateSigil',
        name: 'Magistrate’s Sigil',
        type: 'potion',
        price: 0,
        rarity: 'common',
        questItem: true,
        usable: false,
        noSell: true,
        noDrop: true,
        desc: 'Warm with judgement. It refuses to cool until you decide what law means. (Quest Item)'
    }
};
