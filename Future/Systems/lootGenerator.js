// Loot/lootGenerator.js
// Dynamic loot generation for Project: Mystic
// - Potions (HP + class-resource potions)
// - Weapons + single-piece Armor (not per-slot gear)
// - Leveled loot with rarities and item levels derived from stats
//
// Item shape matches the rest of the game code:
// { id, name, type: 'potion'|'weapon'|'armor', desc, price, ...bonuses..., rarity, itemLevel }
//
// Upgrade (procedural depth):
// - Affix system (extra stats beyond Attack/Magic/Armor/Max Resource)
// - Area-biased elements (frostpeak leans frost, catacombs leans shadow, etc.)
// - Material progression (iron -> steel -> starsteel -> etc.)
// - Unique, more flavorful item naming (prefixes/suffixes + named legendaries)

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary']

const RARITY_LABEL = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary'
}

// Stat/price multipliers by rarity
const RARITY_MULT = {
    common: 1.0,
    uncommon: 1.18,
    rare: 1.42,
    epic: 1.75,
    legendary: 2.2
}

// Baseline weights (bosses shift these in rollRarity)
const RARITY_WEIGHTS_NORMAL = [
    ['common', 60],
    ['uncommon', 25],
    ['rare', 11],
    ['epic', 3],
    ['legendary', 1]
]

const RARITY_WEIGHTS_BOSS = [
    ['common', 25],
    ['uncommon', 35],
    ['rare', 25],
    ['epic', 12],
    ['legendary', 3]
]

const RARITY_WEIGHTS_ELITE = [
    ['common', 40],
    ['uncommon', 32],
    ['rare', 20],
    ['epic', 7],
    ['legendary', 1]
]


const RARITY_PREFIX = {
    common: '',
    uncommon: 'Fine',
    rare: 'Enchanted',
    epic: 'Mythic',
    legendary: 'Legendary'
}

// ------------------------------
// Helpers
// ------------------------------

function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n))
}

function randint(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min
}

function round1(n) {
    return Math.round(n * 10) / 10
}

function cap(s) {
    if (!s) return s
    return s.charAt(0).toUpperCase() + s.slice(1)
}

function pickWeighted(pairs) {
    const total = pairs.reduce((a, [, w]) => a + w, 0)
    let r = Math.random() * total
    for (const [v, w] of pairs) {
        r -= w
        if (r <= 0) return v
    }
    return pairs[pairs.length - 1][0]
}

function makeId(prefix) {
    // stable-enough uniqueness for saves without requiring crypto
    return (
        prefix +
        '_' +
        Date.now().toString(36) +
        '_' +
        Math.floor(Math.random() * 1e9).toString(36)
    )
}

function uniqueSyllableName() {
    const a = [
        'va',
        'ka',
        'sha',
        'dra',
        'mor',
        'thal',
        'bel',
        'rin',
        'zor',
        'ly',
        'sae',
        'el',
        'ny',
        'vor',
        'gra'
    ]
    const b = [
        'en',
        'ar',
        'ir',
        'os',
        'un',
        'ael',
        'eth',
        'or',
        'ia',
        'uin',
        'ash',
        'yr',
        'ae',
        'ith',
        'aum'
    ]
    const c = ['d', 'th', 'r', 'n', 's', 'k', 'l', 'm', 'v', 'z']

    const p1 = pickWeighted(a.map((x) => [x, 1]))
    const p2 = pickWeighted(b.map((x) => [x, 1]))
    const tail = Math.random() < 0.55 ? pickWeighted(c.map((x) => [x, 1])) : ''

    // occasional apostrophe flavor
    const glue = Math.random() < 0.16 ? "'" : ''

    return cap(p1 + glue + p2 + tail)
}

// ------------------------------
// Elements + materials (area bias)
// ------------------------------

const ELEMENT_LABEL = {
    fire: 'Fire',
    frost: 'Frost',
    lightning: 'Lightning',
    shadow: 'Shadow',
    poison: 'Poison',
    nature: 'Nature',
    arcane: 'Arcane'
}

const AREA_ELEMENT_BIAS = {
    forest: [
        ['nature', 30],
        ['poison', 16],
        ['fire', 14],
        ['frost', 10],
        ['arcane', 10],
        ['shadow', 10],
        ['lightning', 10]
    ],
    ruins: [
        ['arcane', 30],
        ['shadow', 20],
        ['fire', 14],
        ['frost', 12],
        ['lightning', 12],
        ['poison', 6],
        ['nature', 6]
    ],
    marsh: [
        ['poison', 45],
        ['nature', 20],
        ['shadow', 14],
        ['arcane', 10],
        ['fire', 6],
        ['lightning', 3],
        ['frost', 2]
    ],
    frostpeak: [
        ['frost', 55],
        ['lightning', 12],
        ['shadow', 10],
        ['arcane', 10],
        ['nature', 7],
        ['fire', 4],
        ['poison', 2]
    ],
    catacombs: [
        ['shadow', 55],
        ['arcane', 15],
        ['poison', 12],
        ['frost', 8],
        ['fire', 5],
        ['lightning', 3],
        ['nature', 2]
    ],
    keep: [
        ['lightning', 26],
        ['fire', 18],
        ['arcane', 18],
        ['shadow', 14],
        ['frost', 12],
        ['nature', 7],
        ['poison', 5]
    ]
}

function rollElement(area) {
    const bias = AREA_ELEMENT_BIAS[area] || [
        ['fire', 15],
        ['frost', 15],
        ['lightning', 15],
        ['shadow', 15],
        ['poison', 15],
        ['nature', 12],
        ['arcane', 13]
    ]
    return pickWeighted(bias)
}

const MATERIAL_TIERS = [
    {
        maxLevel: 6,
        picks: [
            ['Iron', 45],
            ['Bronze', 25],
            ['Oak', 18],
            ['Bone', 12]
        ]
    },
    {
        maxLevel: 16,
        picks: [
            ['Steel', 42],
            ['Ashwood', 20],
            ['Obsidian', 18],
            ['Silvered', 20]
        ]
    },
    {
        maxLevel: 28,
        picks: [
            ['Tempered Steel', 34],
            ['Blacksteel', 22],
            ['Runesteel', 22],
            ['Moonstone', 22]
        ]
    },
    {
        maxLevel: 45,
        picks: [
            ['Starsteel', 28],
            ['Voidiron', 22],
            ['Sunsilver', 22],
            ['Aetherwood', 28]
        ]
    },
    {
        maxLevel: 99,
        picks: [
            ['Mythril', 30],
            ['Dragonbone', 25],
            ['Ethershard', 25],
            ['Worldforged', 20]
        ]
    }
]

function rollMaterial(level, rarity) {
    // rarity nudges you slightly upward in tier selection
    const rarityTierNudge = Math.max(0, RARITY_ORDER.indexOf(rarity) - 1)
    const effectiveLevel = clamp((level || 1) + rarityTierNudge * 3, 1, 99)

    const tier =
        MATERIAL_TIERS.find((t) => effectiveLevel <= t.maxLevel) ||
        MATERIAL_TIERS[MATERIAL_TIERS.length - 1]
    return pickWeighted(tier.picks)
}

// ------------------------------
// Public helpers
// ------------------------------

export function formatRarityLabel(rarity) {
    return RARITY_LABEL[rarity] || 'Common'
}

export function getItemPowerScore(item) {
    if (!item) return 0

    if (item.type === 'weapon') {
        const atk = item.attackBonus || 0
        const mag = item.magicBonus || 0
        const crit = item.critChance || 0
        const haste = item.haste || 0
        const ls = item.lifeSteal || 0
        const elem = item.elementalBonus || 0
        const pen = item.armorPen || 0

        // Weight affixes lightly so itemLevel/price doesn't explode.
        return (
            atk +
            mag +
            crit * 0.9 +
            haste * 0.6 +
            ls * 1.0 +
            elem * 0.8 +
            pen * 0.7
        )
    }

    if (item.type === 'armor') {
        const armor = item.armorBonus || 0
        const maxRes = item.maxResourceBonus || 0
        const hp = item.maxHPBonus || 0
        const resist = item.resistAll || 0
        const dodge = item.dodgeChance || 0
        const thorns = item.thorns || 0
        const regen = item.hpRegen || 0

        return (
            armor +
            maxRes / 10 +
            hp / 8 +
            resist * 0.9 +
            dodge * 0.7 +
            thorns / 12 +
            regen * 1.2
        )
    }

    if (item.type === 'potion') {
        return (item.hpRestore || 0) + (item.resourceRestore || 0)
    }

    return 0
}

function estimateItemLevelFromStats(item, fallbackLevel = 1) {
    const score = getItemPowerScore(item)

    if (item.type === 'weapon') {
        return clamp(Math.round(score * 0.8), 1, 99)
    }
    if (item.type === 'armor') {
        return clamp(Math.round(score * 1.05), 1, 99)
    }
    if (item.type === 'potion') {
        return clamp(Math.round(score / 12), 1, 99)
    }
    return clamp(fallbackLevel, 1, 99)
}

// ------------------------------
// Area tiering + rarity
// ------------------------------

function areaTier(area) {
    // Small nudge so later areas tend to drop slightly stronger loot.
    // (Safe default if unknown)
    switch (area) {
        case 'forest':
            return 0
        case 'ruins':
            return 1
        case 'marsh':
            return 2
        case 'frostpeak':
            return 3
        case 'catacombs':
            return 4
        case 'keep':
            return 5
        default:
            return 0
    }
}

function rollRarity(isBoss, isElite) {
    if (isBoss) return pickWeighted(RARITY_WEIGHTS_BOSS)
    if (isElite) return pickWeighted(RARITY_WEIGHTS_ELITE)
    return pickWeighted(RARITY_WEIGHTS_NORMAL)
}
function rollBaseLevel(playerLevel, area, isBoss) {
    const tier = areaTier(area)
    const base = Math.max(1, (playerLevel || 1) + Math.floor(tier / 2))

    if (isBoss) return base + randint(2, 5)
    return base + randint(-1, 2)
}

// ------------------------------
// Affixes
// ------------------------------

function affixCountFor(rarity, isBoss) {
    // Common is mostly “clean” items, with a rare chance at 1 affix.
    let base =
        rarity === 'common'
            ? Math.random() < 0.18
                ? 1
                : 0
            : rarity === 'uncommon'
            ? 1
            : rarity === 'rare'
            ? 2
            : rarity === 'epic'
            ? 3
            : 4

    // Bosses have a chance to add one extra affix (cap at 5).
    if (isBoss && Math.random() < 0.35) base += 1
    return clamp(base, 0, 5)
}

const ELEMENT_SUFFIX = {
    fire: ['of Embers', 'of the Pyre', 'of Ash'],
    frost: ['of Rime', 'of the Glacier', 'of Winter'],
    lightning: ['of Storms', 'of Thunder', 'of the Tempest'],
    shadow: ['of Dusk', 'of the Void', 'of Night'],
    poison: ['of Venom', 'of the Mire', 'of Toxins'],
    nature: ['of Thorns', 'of the Grove', 'of Bloom'],
    arcane: ['of Sigils', 'of the Aether', 'of Runes']
}

const WEAPON_AFFIX_POOL = [
    {
        id: 'keen',
        weight: 16,
        namePrefix: 'Keen',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = round1((1.0 + level * 0.06) * mult)
            return { mods: { critChance: v }, desc: [`+${v}% Crit`] }
        }
    },
    {
        id: 'vampiric',
        weight: 8,
        namePrefix: 'Vampiric',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = round1((0.6 + level * 0.03) * mult)
            return { mods: { lifeSteal: v }, desc: [`+${v}% Life Steal`] }
        }
    },
    {
        id: 'swift',
        weight: 12,
        namePrefix: 'Swift',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = round1((1.5 + level * 0.08) * mult)
            return { mods: { haste: v }, desc: [`+${v}% Haste`] }
        }
    },
    {
        id: 'sundering',
        weight: 10,
        namePrefix: 'Sundering',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = round1((0.8 + level * 0.05) * mult)
            return { mods: { armorPen: v }, desc: [`+${v}% Armor Pen`] }
        }
    },
    {
        id: 'brutal',
        weight: 14,
        namePrefix: 'Brutal',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = Math.max(1, Math.round((1 + level * 0.35) * mult))
            return { mods: { attackBonus: v }, desc: [`+${v} Attack`] }
        }
    },
    {
        id: 'sage',
        weight: 14,
        namePrefix: 'Sage',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = Math.max(1, Math.round((1 + level * 0.35) * mult))
            return { mods: { magicBonus: v }, desc: [`+${v} Magic`] }
        }
    },
    {
        id: 'elemental',
        weight: 18,
        // suffix will be set dynamically from chosen element
        apply: ({ level, rarity, element }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = Math.max(1, Math.round((2 + level * 0.5) * mult))
            const suffixList = ELEMENT_SUFFIX[element] || ['of Power']
            const nameSuffix = pickWeighted(suffixList.map((s) => [s, 1]))

            return {
                mods: { elementalType: element, elementalBonus: v },
                nameSuffix,
                desc: [`+${v} ${ELEMENT_LABEL[element] || cap(element)} Damage`]
            }
        }
    }
]

const ARMOR_AFFIX_POOL = [
    {
        id: 'stalwart',
        weight: 14,
        namePrefix: 'Stalwart',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = Math.max(1, Math.round((6 + level * 1.2) * mult))
            return { mods: { maxHPBonus: v }, desc: [`+${v} Max HP`] }
        }
    },
    {
        id: 'warded',
        weight: 14,
        namePrefix: 'Warded',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = round1((1.0 + level * 0.08) * mult)
            return { mods: { resistAll: v }, desc: [`+${v}% Resist All`] }
        }
    },
    {
        id: 'fleet',
        weight: 12,
        namePrefix: 'Fleet',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = round1((1.0 + level * 0.07) * mult)
            return { mods: { dodgeChance: v }, desc: [`+${v}% Dodge`] }
        }
    },
    {
        id: 'spined',
        weight: 10,
        namePrefix: 'Spined',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = Math.max(1, Math.round((2 + level * 0.55) * mult))
            return { mods: { thorns: v }, desc: [`${v} Thorns`] }
        }
    },
    {
        id: 'rejuvenating',
        weight: 10,
        namePrefix: 'Rejuvenating',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = round1((0.2 + level * 0.03) * mult)
            return { mods: { hpRegen: v }, desc: [`+${v} HP Regen`] }
        }
    },
    {
        id: 'focused',
        weight: 14,
        namePrefix: 'Focused',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = Math.max(1, Math.round((4 + level * 0.75) * mult))
            return {
                mods: { maxResourceBonus: v },
                desc: [`+${v} Max Resource`]
            }
        }
    },
    {
        id: 'fortified',
        weight: 16,
        namePrefix: 'Fortified',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1
            const v = Math.max(1, Math.round((2 + level * 0.45) * mult))
            return { mods: { armorBonus: v }, desc: [`+${v} Armor`] }
        }
    }
]

function rollAffixes({ itemType, count, ctx }) {
    const pool = itemType === 'weapon' ? WEAPON_AFFIX_POOL : ARMOR_AFFIX_POOL
    const picked = []
    const usedIds = new Set()

    let namePrefix = null
    let nameSuffix = null
    const mods = {}
    const descParts = []

    for (let i = 0; i < count; i++) {
        // pick something not already used
        const options = pool.filter((a) => !usedIds.has(a.id))
        if (!options.length) break

        const affix = pickWeighted(options.map((a) => [a, a.weight || 1]))
        usedIds.add(affix.id)

        const res = affix.apply(ctx) || {}
        if (res.mods) {
            for (const [k, v] of Object.entries(res.mods)) {
                if (v === undefined || v === null) continue
                // additive stacking if repeated fields happen (rare if we avoid duplicates)
                mods[k] = (mods[k] || 0) + v
            }
        }

        if (res.desc) descParts.push(...res.desc)
        if (!namePrefix && (res.namePrefix || affix.namePrefix))
            namePrefix = res.namePrefix || affix.namePrefix
        if (!nameSuffix && res.nameSuffix) nameSuffix = res.nameSuffix

        picked.push(affix.id)
    }

    return { picked, mods, descParts, namePrefix, nameSuffix }
}

// ------------------------------
// Naming
// ------------------------------

const LEGENDARY_TITLES = [
    'Oath',
    'Vow',
    'Requiem',
    'Promise',
    'Dirge',
    'Edict',
    'Covenant',
    'Judgment',
    'Beacon',
    'Warden'
]

const LEGENDARY_EPITHETS = [
    'the Eclipse',
    'the Dawn',
    'the Hollow Star',
    'the Shattered Gate',
    'the Last Winter',
    'the Umbral King',
    'the Silent Grove',
    'the Storm-Crowned',
    'the Ashen Pact',
    'the Black Tide'
]

function composeName({
    rarity,
    material,
    baseName,
    affixPrefix,
    affixSuffix,
    isLegendary
}) {
    const rarityPrefix = RARITY_PREFIX[rarity]
        ? `${RARITY_PREFIX[rarity]} `
        : ''
    const core = `${material} ${baseName}`

    if (isLegendary) {
        const owner = uniqueSyllableName()
        const title = pickWeighted(LEGENDARY_TITLES.map((t) => [t, 1]))
        const epithet = pickWeighted(LEGENDARY_EPITHETS.map((t) => [t, 1]))

        // Allow the elemental suffix to still show up sometimes, otherwise use epithet.
        const tail =
            affixSuffix && Math.random() < 0.45 ? affixSuffix : `of ${epithet}`

        // Legendary items: Named + comma subtitle. Example: “Vaelor’s Oath, Starsteel Longsword of the Eclipse”
        return `${owner}s ${title}, ${core} ${tail}`.replace(/\s+/g, ' ').trim()
    }

    // Non-legendary: keep readable (avoid stacking too many prefixes)
    const maybeAffix = affixPrefix ? `${affixPrefix} ` : ''
    const maybeSuffix = affixSuffix ? ` ${affixSuffix}` : ''
    return `${rarityPrefix}${maybeAffix}${core}${maybeSuffix}`
        .replace(/\s+/g, ' ')
        .trim()
}

// ------------------------------
// Gear builders
// ------------------------------

function buildWeapon(level, rarity, area = 'forest', isBoss = false) {
    const mult = RARITY_MULT[rarity] || 1.0

    const archetype = pickWeighted([
        ['war', 45],
        ['mage', 35],
        ['hybrid', 20]
    ])

    // Base numbers: tuned to roughly align with existing ITEM_DEFS progression
    let atk = 0
    let mag = 0

    if (archetype === 'war') {
        atk = Math.round((4 + level * 1.25) * mult)
        mag = Math.round(level * 0.25 * mult)
    } else if (archetype === 'mage') {
        atk = Math.round(level * 0.25 * mult)
        mag = Math.round((4 + level * 1.25) * mult)
    } else {
        atk = Math.round((3 + level * 0.9) * mult)
        mag = Math.round((3 + level * 0.9) * mult)
    }

    const element = rollElement(area)
    const material = rollMaterial(level, rarity)

    const baseName = pickWeighted(
        (archetype === 'war'
            ? [
                  ['Longsword', 18],
                  ['War Axe', 12],
                  ['Halberd', 10],
                  ['Mace', 10],
                  ['Greatsword', 10],
                  ['Spear', 12],
                  ['Hookblade', 6],
                  ['Flanged Hammer', 6],
                  ['Gladius', 8],
                  ['Falchion', 8]
              ]
            : archetype === 'mage'
            ? [
                  ['Staff', 18],
                  ['Wand', 14],
                  ['Spellblade', 10],
                  ['Runic Dagger', 10],
                  ['Scepter', 12],
                  ['Cane', 8],
                  ['Sigil Rod', 10],
                  ['Hexknife', 8],
                  ['Orb Focus', 6],
                  ['Aether Staff', 4]
              ]
            : [
                  ['Spear', 14],
                  ['Longsword', 12],
                  ['Saber', 10],
                  ['Dagger', 10],
                  ['War Pike', 8],
                  ['Twinblade', 8],
                  ['Glaive', 8],
                  ['Shortsword', 10],
                  ['Staff', 10],
                  ['War Axe', 10]
              ]
        ).map((x) => [x[0], x[1]])
    )

    // Affixes
    const affixCount = affixCountFor(rarity, isBoss)
    const rolled = rollAffixes({
        itemType: 'weapon',
        count: affixCount,
        ctx: { level, rarity, area, element }
    })

    // Apply affix mods (some affixes add flat Attack/Magic)
    atk += rolled.mods.attackBonus || 0
    mag += rolled.mods.magicBonus || 0

    const name = composeName({
        rarity,
        material,
        baseName,
        affixPrefix: rolled.namePrefix,
        affixSuffix: rolled.nameSuffix,
        isLegendary: rarity === 'legendary'
    })

    const item = {
        id: makeId('gen_weapon'),
        name,
        type: 'weapon',
        attackBonus: atk || undefined,
        magicBonus: mag || undefined,

        // optional affix stats:
        critChance: rolled.mods.critChance || undefined,
        haste: rolled.mods.haste || undefined,
        lifeSteal: rolled.mods.lifeSteal || undefined,
        armorPen: rolled.mods.armorPen || undefined,
        elementalType: rolled.mods.elementalType || undefined,
        elementalBonus: rolled.mods.elementalBonus || undefined,

        // metadata:
        rarity,
        generated: true,
        affixes: rolled.picked.length ? rolled.picked : undefined
    }

    item.itemLevel = estimateItemLevelFromStats(item, level)

    // Price scales off power; rarity already baked into stats, but rarity still nudges price.
    const raw = Math.max(1, getItemPowerScore(item)) * 8
    item.price = Math.max(
        5,
        Math.round(raw * (1 + RARITY_ORDER.indexOf(rarity) * 0.15))
    )

    const descParts = []
    if (item.attackBonus) descParts.push(`+${item.attackBonus} Attack`)
    if (item.magicBonus) descParts.push(`+${item.magicBonus} Magic`)
    if (rolled.descParts.length) descParts.push(...rolled.descParts)
    descParts.push(`iLv ${item.itemLevel}`, formatRarityLabel(rarity))

    item.desc = descParts.filter(Boolean).join(', ') + '.'

    return item
}

function buildArmor(level, rarity, area = 'forest', isBoss = false) {
    const mult = RARITY_MULT[rarity] || 1.0

    const style = pickWeighted([
        ['plate', 35],
        ['leather', 40],
        ['robe', 25]
    ])

    let armor = 0
    let maxRes = 0

    if (style === 'plate') {
        armor = Math.round((4 + level * 1.15) * mult)
        maxRes = Math.round(level * 1.0 * mult)
    } else if (style === 'leather') {
        armor = Math.round((3 + level * 1.0) * mult)
        maxRes = Math.round(level * 1.5 * mult)
    } else {
        armor = Math.round((2 + level * 0.85) * mult)
        maxRes = Math.round((10 + level * 4.0) * mult)
    }

    const baseName =
        style === 'plate'
            ? pickWeighted([
                  ['Plate Harness', 20],
                  ['Knight Cuirass', 14],
                  ['Bulwark Mail', 12],
                  ['Warplate', 10],
                  ['Ironward Brigandine', 8]
              ])
            : style === 'leather'
            ? pickWeighted([
                  ['Leather Jerkin', 20],
                  ['Hunter Mantle', 14],
                  ['Shadowstitch Coat', 12],
                  ['Ranger Vest', 10],
                  ['Nightweave Jerkin', 8]
              ])
            : pickWeighted([
                  ['Runed Robe', 20],
                  ['Sigil Vestments', 14],
                  ['Aetherweave Robe', 12],
                  ['Hexed Raiment', 10],
                  ['Arcanist Mantle', 8]
              ])

    const element = rollElement(area)
    const material = rollMaterial(level, rarity)

    // Affixes
    const affixCount = affixCountFor(rarity, isBoss)
    const rolled = rollAffixes({
        itemType: 'armor',
        count: affixCount,
        ctx: { level, rarity, area, element }
    })

    // Apply affix mods (some affixes add flat Armor/Max Resource)
    armor += rolled.mods.armorBonus || 0
    maxRes += rolled.mods.maxResourceBonus || 0

    const name = composeName({
        rarity,
        material,
        baseName,
        affixPrefix: rolled.namePrefix,
        affixSuffix: rolled.nameSuffix,
        isLegendary: rarity === 'legendary'
    })

    const item = {
        id: makeId('gen_armor'),
        name,
        type: 'armor',
        armorBonus: armor || undefined,
        maxResourceBonus: maxRes || undefined,

        // optional affix stats:
        maxHPBonus: rolled.mods.maxHPBonus || undefined,
        resistAll: rolled.mods.resistAll || undefined,
        dodgeChance: rolled.mods.dodgeChance || undefined,
        thorns: rolled.mods.thorns || undefined,
        hpRegen: rolled.mods.hpRegen || undefined,

        rarity,
        generated: true,
        affixes: rolled.picked.length ? rolled.picked : undefined
    }

    item.itemLevel = estimateItemLevelFromStats(item, level)

    const raw = Math.max(1, getItemPowerScore(item)) * 7.5
    item.price = Math.max(
        5,
        Math.round(raw * (1 + RARITY_ORDER.indexOf(rarity) * 0.15))
    )

    const descParts = []
    if (item.armorBonus) descParts.push(`+${item.armorBonus} Armor`)
    if (item.maxResourceBonus)
        descParts.push(`+${item.maxResourceBonus} Max Resource`)
    if (rolled.descParts.length) descParts.push(...rolled.descParts)
    descParts.push(`iLv ${item.itemLevel}`, formatRarityLabel(rarity))

    item.desc = descParts.filter(Boolean).join(', ') + '.'

    return item
}

function buildPotion(level, rarity, resourceKey, area = 'forest') {
    // Potions are meant to be stackable, so ID must be stable by potion type/tier.
    const mult = RARITY_MULT[rarity] || 1.0

    // Decide potion subtype
    const subtype = pickWeighted([
        ['hp', 55],
        ['resource', 45]
    ])

    // Tier based on rarity (common/uncommon -> small; rare+ -> strong)
    const tier =
        rarity === 'common' || rarity === 'uncommon'
            ? 'small'
            : rarity === 'rare'
            ? 'standard'
            : 'greater'

    const tierLabel =
        tier === 'small'
            ? 'Small'
            : tier === 'standard'
            ? 'Standard'
            : 'Greater'

    const item = {
        type: 'potion',
        rarity,
        generated: true
    }

    // Tiny “flavor” without breaking stacking names
    const element = rollElement(area)
    const flavor =
        Math.random() < 0.25
            ? `Brewed with ${ELEMENT_LABEL[element] || cap(element)} salts.`
            : null

    if (subtype === 'hp') {
        const restore = Math.round(
            (18 + level * 6) *
                mult *
                (tier === 'small' ? 0.85 : tier === 'standard' ? 1.0 : 1.25)
        )
        item.id = `potion_hp_${tier}`
        item.name = `${tierLabel} Health Potion`
        item.hpRestore = restore
        item.itemLevel = estimateItemLevelFromStats(
            { ...item, hpRestore: restore },
            level
        )
        item.price = Math.max(3, Math.round(restore * 0.55))
        item.desc = [`Restore ${restore} HP.`, flavor].filter(Boolean).join(' ')
    } else {
        const key = resourceKey || 'mana'
        const restore = Math.round(
            (16 + level * 6) *
                mult *
                (tier === 'small' ? 0.85 : tier === 'standard' ? 1.0 : 1.25)
        )
        item.id = `potion_${key}_${tier}`
        const prettyKey = key.charAt(0).toUpperCase() + key.slice(1)
        item.name = `${tierLabel} ${prettyKey} Potion`
        item.resourceKey = key
        item.resourceRestore = restore
        item.itemLevel = estimateItemLevelFromStats(
            { ...item, resourceRestore: restore },
            level
        )
        item.price = Math.max(3, Math.round(restore * 0.55))
        item.desc = [`Restore ${restore} ${prettyKey}.`, flavor]
            .filter(Boolean)
            .join(' ')
    }

    return item
}

export function getSellValue(item, context = 'village') {
    if (!item) return 0

    const base =
        typeof item.price === 'number' && item.price > 0
            ? item.price
            : Math.max(1, Math.round(getItemPowerScore(item) * 6))

    // Wandering merchant generally offers worse prices.
    const factor = context === 'wandering' ? 0.45 : 0.6

    // Sell one unit for potions
    return Math.max(1, Math.floor(base * factor))
}

// ------------------------------
// Main drop function
// ------------------------------

export function generateLootDrop({
    area = 'forest',
    playerLevel = 1,
    enemy = null,
    playerResourceKey = null
} = {}) {
    const isBoss = !!(enemy && enemy.isBoss)
    const isElite = !!(enemy && enemy.isElite)
    // Favor gear on bosses; favor potions on trash mobs.
    const categoryWeights = isBoss
        ? [
              ['weapon', 38],
              ['armor', 38],
              ['potion', 24]
          ]
        : isElite
        ? [
              ['weapon', 35],
              ['armor', 35],
              ['potion', 30]
          ]
        : [
              ['potion', 45],
              ['weapon', 30],
              ['armor', 25]
          ]

const drops = []
    const baseLevel = rollBaseLevel(playerLevel, area, isBoss || isElite)

    // Bosses can drop multiple items.
    const dropCount = isBoss
        ? (Math.random() < 0.55 ? 2 : 3)
        : isElite
        ? (Math.random() < 0.35 ? 2 : 1)
        : 1

    // Prefer dropping a resource potion that the player can actually use.
    const preferredResourceKey = playerResourceKey || null

    for (let i = 0; i < dropCount; i++) {
        const rarity = rollRarity(isBoss, isElite)
        const category = pickWeighted(categoryWeights)

        if (category === 'weapon') {
            drops.push(buildWeapon(baseLevel, rarity, area, isBoss || isElite))
        } else if (category === 'armor') {
            drops.push(buildArmor(baseLevel, rarity, area, isBoss || isElite))
        } else {
            drops.push(
                buildPotion(baseLevel, rarity, preferredResourceKey, area)
            )
        }
    }

    // Small post-pass: ensure at least 1 potion on bosses only if no potion rolled.
    if (isBoss && !drops.some((d) => d.type === 'potion')) {
        drops.push(
            buildPotion(baseLevel, rollRarity(true), preferredResourceKey, area)
        )
    }

    return drops
}
