// Loot/lootGenerator.js
// Dynamic loot generation for Emberwood: The Blackbark Oath
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
import { rngInt, rngFloat } from "./rng.js";
// Rarity progression (lowest -> highest)
// NOTE: "mythic" is a true rarity ABOVE legendary (not just a name prefix).
const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
const RARITY_LABEL = {
    common: 'Common',
    uncommon: 'Uncommon',
    rare: 'Rare',
    epic: 'Epic',
    legendary: 'Legendary',
    mythic: 'Mythic'
};
// Stat/price multipliers by rarity
const RARITY_MULT = {
    common: 1.0,
    uncommon: 1.18,
    rare: 1.42,
    epic: 1.75,
    legendary: 2.2,
    mythic: 2.75
};
// Baseline weights (bosses shift these in rollRarity)
const RARITY_WEIGHTS_NORMAL = [
    ['common', 60],
    ['uncommon', 25],
    ['rare', 11],
    ['epic', 3],
    ['legendary', 1],
    // Mythic is not expected from normal mobs (enabled via bosses / tier 6 enemies)
    ['mythic', 0]
];
const RARITY_WEIGHTS_BOSS = [
    ['common', 25],
    ['uncommon', 35],
    ['rare', 25],
    ['epic', 12],
    ['legendary', 3],
    // Bosses have a small chance to drop Mythic.
    ['mythic', 1]
];
const RARITY_WEIGHTS_ELITE = [
    ['common', 40],
    ['uncommon', 32],
    ['rare', 20],
    ['epic', 7],
    ['legendary', 1],
    ['mythic', 0]
];
const RARITY_PREFIX = {
    common: '',
    uncommon: 'Fine',
    rare: 'Enchanted',
    epic: 'Epic',
    legendary: 'Legendary',
    mythic: 'Mythic'
};
// ------------------------------
// Helpers
// ------------------------------
function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}
function rarityIndex(r) {
    const id = String(r || 'common').toLowerCase();
    const i = RARITY_ORDER.indexOf(id);
    return i >= 0 ? i : 0;
}
function applyMinRarity(current, minRarity) {
    if (!minRarity)
        return current;
    const cur = rarityIndex(current);
    const min = rarityIndex(minRarity);
    return cur < min ? RARITY_ORDER[min] : current;
}
function randint(min, max) {
    return rngInt(null, min, max, 'loot.randint');
}
function round1(n) {
    return Math.round(n * 10) / 10;
}
function cap(s) {
    if (!s)
        return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}
export function pickWeighted(pairs) {
    if (!Array.isArray(pairs) || pairs.length === 0)
        return null;
    const total = pairs.reduce((a, [, w]) => a + (Number(w) || 0), 0);
    if (!Number.isFinite(total) || total <= 0)
        return pairs[0] ? pairs[0][0] : null;
    let r = rngFloat(null, 'loot.pickWeighted') * total;
    for (const [v, w] of pairs) {
        r -= (Number(w) || 0);
        if (r <= 0)
            return v;
    }
    return pairs[pairs.length - 1][0];
}
function makeId(prefix) {
    // stable-enough uniqueness for saves without requiring crypto
    return (prefix +
        '_' +
        Date.now().toString(36) +
        '_' +
        Math.floor(rngFloat(null, 'loot.makeId') * 1e9).toString(36));
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
    ];
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
    ];
    const c = ['d', 'th', 'r', 'n', 's', 'k', 'l', 'm', 'v', 'z'];
    const p1 = pickWeighted(a.map((x) => [x, 1]));
    const p2 = pickWeighted(b.map((x) => [x, 1]));
    const tail = rngFloat(null, 'loot.nameTail') < 0.55 ? pickWeighted(c.map((x) => [x, 1])) : '';
    // occasional apostrophe flavor
    const glue = rngFloat(null, 'loot.nameGlue') < 0.16 ? "'" : '';
    return cap(p1 + glue + p2 + tail);
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
    arcane: 'Arcane',
    earth: 'Earth',
    holy: 'Holy'
};
const AREA_ELEMENT_BIAS = {
    forest: [
        ['nature', 28],
        ['poison', 15],
        ['fire', 13],
        ['frost', 9],
        ['arcane', 9],
        ['shadow', 9],
        ['lightning', 9],
        ['earth', 5],
        ['holy', 3]
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
        ['frost', 50],
        ['lightning', 12],
        ['shadow', 10],
        ['arcane', 9],
        ['nature', 7],
        ['fire', 4],
        ['poison', 2],
        ['earth', 4],
        ['holy', 2]
    ],
    catacombs: [
        ['shadow', 52],
        ['arcane', 14],
        ['poison', 10],
        ['frost', 7],
        ['fire', 5],
        ['lightning', 3],
        ['nature', 2],
        ['earth', 4],
        ['holy', 3]
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
};
function rollElement(area) {
    const bias = AREA_ELEMENT_BIAS[area] || [
        ['fire', 13],
        ['frost', 13],
        ['lightning', 13],
        ['shadow', 13],
        ['poison', 13],
        ['nature', 11],
        ['arcane', 12],
        ['earth', 6],
        ['holy', 6]
    ];
    return pickWeighted(bias);
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
];
function rollMaterial(level, rarity) {
    // rarity nudges you slightly upward in tier selection
    const rarityTierNudge = Math.max(0, RARITY_ORDER.indexOf(rarity) - 1);
    const effectiveLevel = clamp((level || 1) + rarityTierNudge * 3, 1, 99);
    const tier = MATERIAL_TIERS.find((t) => effectiveLevel <= t.maxLevel) ||
        MATERIAL_TIERS[MATERIAL_TIERS.length - 1];
    return pickWeighted(tier.picks);
}
// ------------------------------
// Public helpers
// ------------------------------
export function formatRarityLabel(rarity) {
    return RARITY_LABEL[rarity] || 'Common';
}
export function getItemPowerScore(item) {
    if (!item)
        return 0;
    if (item.type === 'weapon') {
        const atk = item.attackBonus || 0;
        const mag = item.magicBonus || 0;
        const crit = item.critChance || 0;
        const haste = item.haste || 0;
        const ls = item.lifeSteal || 0;
        const elem = item.elementalBonus || 0;
        const pen = item.armorPen || 0;
        // Weight affixes lightly so itemLevel/price doesn't explode.
        return (atk +
            mag +
            crit * 0.9 +
            haste * 0.6 +
            ls * 1.0 +
            elem * 0.8 +
            pen * 0.7);
    }
    if (item.type === 'armor') {
        const armor = item.armorBonus || 0;
        const maxRes = item.maxResourceBonus || 0;
        const hp = item.maxHPBonus || 0;
        const resist = item.resistAll || 0;
        // Patch 1.2.0: most generated armor carries an elemental ward (single-element resist).
        // Account for this so itemLevel/price track actual defensive power.
        const elemRes = item.elementalResist || 0;
        const dodge = item.dodgeChance || 0;
        const thorns = item.thorns || 0;
        const regen = item.hpRegen || 0;
        // Some armor pieces (notably accessories) can also grant offense/utility.
        const atk = item.attackBonus || 0;
        const mag = item.magicBonus || 0;
        const spd = item.speedBonus || 0;
        const crit = item.critChance || 0;
        const haste = item.haste || 0;
        const ls = item.lifeSteal || 0;
        const pen = item.armorPen || 0;
        const elem = item.elementalBonus || 0;
        return (armor +
            maxRes / 10 +
            hp / 8 +
            resist * 0.9 +
            elemRes * 0.5 +
            dodge * 0.7 +
            thorns / 12 +
            regen * 1.2 +
            atk * 0.9 +
            mag * 0.9 +
            spd * 0.8 +
            crit * 0.8 +
            haste * 0.6 +
            ls * 1.0 +
            pen * 0.5 +
            elem * 0.6);
    }
    if (item.type === 'potion') {
        return (item.hpRestore || 0) + (item.resourceRestore || 0);
    }
    return 0;
}
function estimateItemLevelFromStats(item, fallbackLevel = 1) {
    const score = getItemPowerScore(item);
    if (item.type === 'weapon') {
        return clamp(Math.round(score * 0.8), 1, 99);
    }
    if (item.type === 'armor') {
        return clamp(Math.round(score * 1.05), 1, 99);
    }
    if (item.type === 'potion') {
        return clamp(Math.round(score / 12), 1, 99);
    }
    return clamp(fallbackLevel, 1, 99);
}
// ------------------------------
// Area tiering + rarity
// ------------------------------
function areaTier(area) {
    // Small nudge so later areas tend to drop slightly stronger loot.
    // (Safe default if unknown)
    switch (area) {
        case 'forest':
            return 0;
        case 'ruins':
            return 1;
        case 'marsh':
            return 2;
        case 'frostpeak':
            return 3;
        case 'catacombs':
            return 4;
        case 'keep':
            return 5;
        default:
            return 0;
    }
}
function rollRarity(isBoss, isElite, enemyRarityTier = 1) {
    if (isBoss)
        return pickWeighted(RARITY_WEIGHTS_BOSS);
    // Start with the baseline table (elite vs normal)...
    const base = isElite ? RARITY_WEIGHTS_ELITE : RARITY_WEIGHTS_NORMAL;
    // ...then nudge weights upward based on enemy rarity.
    const tier = clamp(Number(enemyRarityTier) || 1, 1, 6);
    // Convert to a mutable map
    const m = {};
    base.forEach(([id, w]) => { m[id] = (Number(w) || 0); });
    if (tier === 2) {
        m.common = Math.max(0, m.common - 8);
        m.uncommon = (m.uncommon || 0) + 8;
    }
    else if (tier === 3) {
        m.common = Math.max(0, m.common - 10);
        m.uncommon = (m.uncommon || 0) + 4;
        m.rare = (m.rare || 0) + 6;
    }
    else if (tier === 4) {
        m.common = Math.max(0, m.common - 15);
        m.uncommon = (m.uncommon || 0) + 4;
        m.rare = (m.rare || 0) + 8;
        m.epic = (m.epic || 0) + 3;
    }
    else if (tier >= 5) {
        // High-tier enemies drop better loot, but keep legendaries special.
        m.common = Math.max(0, m.common - 16);
        m.uncommon = (m.uncommon || 0) + 2;
        m.rare = (m.rare || 0) + 9;
        m.epic = (m.epic || 0) + 4;
        // Legendary weight is handled mostly by bosses; tier 5+ enemies only nudge it slightly.
        m.legendary = (m.legendary || 0) + 0;
        m.mythic = (m.mythic || 0) + 0;
        // Mythic enemies (tier 6) can very rarely drop Mythic loot.
        if (tier >= 6) {
            m.common = Math.max(0, m.common - 5);
            m.uncommon = Math.max(0, (m.uncommon || 0) - 2);
            m.rare = (m.rare || 0) + 4;
            m.epic = (m.epic || 0) + 4;
            m.legendary = (m.legendary || 0) + 1;
            m.mythic = (m.mythic || 0) + 1;
        }
    }
    const weights = RARITY_ORDER.map((id) => [id, Math.max(0, Math.round(m[id] || 0))]);
    // Guard: ensure something is positive
    if (!weights.some(([, w]) => w > 0))
        return 'common';
    return pickWeighted(weights);
}
function rollBaseLevel(playerLevel, area, isBoss) {
    const tier = areaTier(area);
    const base = Math.max(1, (playerLevel || 1) + Math.floor(tier / 2));
    if (isBoss)
        return base + randint(2, 5);
    return base + randint(-1, 2);
}
// ------------------------------
// Affixes
// ------------------------------
function affixCountFor(rarity, isBoss) {
    // Common is mostly “clean” items, with a rare chance at 1 affix.
    let base = rarity === 'common'
        ? rngFloat(null, 'loot.rareMat') < 0.18
            ? 1
            : 0
        : rarity === 'uncommon'
            ? 1
            : rarity === 'rare'
                ? 2
                : rarity === 'epic'
                    ? 3
                    : rarity === 'legendary'
                        ? 4
                        : 5;
    // Bosses have a chance to add one extra affix.
    if (isBoss && rngFloat(null, 'loot.bossBump') < 0.35)
        base += 1;
    // Mythic items can reach 6 affixes at the very top end.
    return clamp(base, 0, 6);
}
const ELEMENT_SUFFIX = {
    fire: ['of Embers', 'of the Pyre', 'of Ash'],
    frost: ['of Rime', 'of the Glacier', 'of Winter'],
    lightning: ['of Storms', 'of Thunder', 'of the Tempest'],
    shadow: ['of Dusk', 'of the Void', 'of Night'],
    poison: ['of Venom', 'of the Mire', 'of Toxins'],
    nature: ['of Thorns', 'of the Grove', 'of Bloom'],
    arcane: ['of Sigils', 'of the Aether', 'of Runes']
};
const WEAPON_AFFIX_POOL = [
    {
        id: 'keen',
        weight: 16,
        namePrefix: 'Keen',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = round1((1.0 + level * 0.06) * mult);
            return { mods: { critChance: v }, desc: [`+${v}% Crit`] };
        }
    },
    {
        id: 'vampiric',
        weight: 8,
        namePrefix: 'Vampiric',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = round1((0.6 + level * 0.03) * mult);
            return { mods: { lifeSteal: v }, desc: [`+${v}% Life Steal`] };
        }
    },
    {
        id: 'swift',
        weight: 12,
        namePrefix: 'Swift',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = round1((1.5 + level * 0.08) * mult);
            return { mods: { haste: v }, desc: [`+${v}% Haste`] };
        }
    },
    {
        id: 'sundering',
        weight: 10,
        namePrefix: 'Sundering',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = round1((0.8 + level * 0.05) * mult);
            return { mods: { armorPen: v }, desc: [`+${v}% Armor Pen`] };
        }
    },
    {
        id: 'brutal',
        weight: 14,
        namePrefix: 'Brutal',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = Math.max(1, Math.round((1 + level * 0.35) * mult));
            return { mods: { attackBonus: v }, desc: [`+${v} Attack`] };
        }
    },
    {
        id: 'sage',
        weight: 14,
        namePrefix: 'Sage',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = Math.max(1, Math.round((1 + level * 0.35) * mult));
            return { mods: { magicBonus: v }, desc: [`+${v} Magic`] };
        }
    },
    {
        id: 'elemental',
        weight: 18,
        // suffix will be set dynamically from chosen element
        apply: ({ level, rarity, element }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = Math.max(1, Math.round((2 + level * 0.5) * mult));
            const suffixList = ELEMENT_SUFFIX[element] || ['of Power'];
            const nameSuffix = pickWeighted(suffixList.map((s) => [s, 1]));
            return {
                mods: { elementalType: element, elementalBonus: v },
                nameSuffix,
                desc: [`+${v} ${ELEMENT_LABEL[element] || cap(element)} Damage`]
            };
        }
    },
    // Combo-style affixes: slightly rarer, but add more distinct feel.
    {
        id: 'balanced',
        weight: 7,
        namePrefix: 'Balanced',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = Math.max(1, Math.round((1 + level * 0.22) * mult));
            return {
                mods: { attackBonus: v, magicBonus: v },
                desc: [`+${v} Attack`, `+${v} Magic`]
            };
        }
    },
    {
        id: 'berserking',
        weight: 6,
        namePrefix: 'Berserking',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const atk = Math.max(1, Math.round((1 + level * 0.28) * mult));
            const haste = round1((0.6 + level * 0.03) * mult);
            return {
                mods: { attackBonus: atk, haste },
                desc: [`+${atk} Attack`, `+${haste}% Haste`]
            };
        }
    },
    {
        id: 'spellwoven',
        weight: 6,
        namePrefix: 'Spellwoven',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const mag = Math.max(1, Math.round((1 + level * 0.28) * mult));
            const crit = round1((0.5 + level * 0.03) * mult);
            return {
                mods: { magicBonus: mag, critChance: crit },
                desc: [`+${mag} Magic`, `+${crit}% Crit`]
            };
        }
    },
    {
        id: 'stormforged',
        weight: 5,
        namePrefix: 'Stormforged',
        apply: ({ level, rarity, element }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const haste = round1((0.8 + level * 0.04) * mult);
            const v = Math.max(1, Math.round((1 + level * 0.3) * mult));
            // Uses chosen element if available; otherwise defaults to lightning.
            const elem = element || 'lightning';
            const suffixList = ELEMENT_SUFFIX[elem] || ['of Storms'];
            const nameSuffix = pickWeighted(suffixList.map((s) => [s, 1]));
            return {
                mods: { haste, elementalType: elem, elementalBonus: v },
                nameSuffix,
                desc: [`+${haste}% Haste`, `+${v} ${ELEMENT_LABEL[elem] || cap(elem)} Damage`]
            };
        }
    }
];
const ARMOR_AFFIX_POOL = [
    {
        id: 'stalwart',
        weight: 14,
        namePrefix: 'Stalwart',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = Math.max(1, Math.round((6 + level * 1.2) * mult));
            return { mods: { maxHPBonus: v }, desc: [`+${v} Max HP`] };
        }
    },
    {
        id: 'warded',
        weight: 14,
        namePrefix: 'Warded',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = round1((1.0 + level * 0.08) * mult);
            return { mods: { resistAll: v }, desc: [`+${v}% Resist All`] };
        }
    },
    {
        id: 'elementalWard',
        weight: 16,
        namePrefix: 'Warded',
        // Grants resistance to an element (percent reduction to incoming elemental magic)
        apply: ({ level, rarity, element }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const elem = element || 'arcane';
            const v = Math.max(1, Math.round((3 + level * 0.55) * mult));
            const suffixList = ELEMENT_SUFFIX[elem] || ['of Warding'];
            const nameSuffix = pickWeighted(suffixList.map((s) => [s, 1]));
            return {
                mods: { elementalResistType: elem, elementalResist: v },
                nameSuffix,
                desc: [`+${v}% ${ELEMENT_LABEL[elem] || cap(elem)} Resist`]
            };
        }
    },
    {
        id: 'fleet',
        weight: 12,
        namePrefix: 'Fleet',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = round1((1.0 + level * 0.07) * mult);
            return { mods: { dodgeChance: v }, desc: [`+${v}% Dodge`] };
        }
    },
    {
        id: 'spined',
        weight: 10,
        namePrefix: 'Spined',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = Math.max(1, Math.round((2 + level * 0.55) * mult));
            return { mods: { thorns: v }, desc: [`${v} Thorns`] };
        }
    },
    {
        id: 'rejuvenating',
        weight: 10,
        namePrefix: 'Rejuvenating',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = round1((0.2 + level * 0.03) * mult);
            return { mods: { hpRegen: v }, desc: [`+${v} HP Regen`] };
        }
    },
    {
        id: 'focused',
        weight: 14,
        namePrefix: 'Focused',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = Math.max(1, Math.round((4 + level * 0.75) * mult));
            return {
                mods: { maxResourceBonus: v },
                desc: [`+${v} Max Resource`]
            };
        }
    },
    {
        id: 'fortified',
        weight: 16,
        namePrefix: 'Fortified',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = Math.max(1, Math.round((2 + level * 0.45) * mult));
            return { mods: { armorBonus: v }, desc: [`+${v} Armor`] };
        }
    },
    {
        id: 'bulwark',
        weight: 7,
        namePrefix: 'Bulwark',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const armor = Math.max(1, Math.round((1 + level * 0.35) * mult));
            const resist = round1((0.6 + level * 0.035) * mult);
            return {
                mods: { armorBonus: armor, resistAll: resist },
                desc: [`+${armor} Armor`, `+${resist}% Resist All`]
            };
        }
    },
    {
        id: 'quickstep',
        weight: 7,
        namePrefix: 'Quickstep',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const spd = Math.max(1, Math.round((0.6 + level * 0.05) * mult));
            const dodge = round1((0.6 + level * 0.03) * mult);
            return {
                mods: { speedBonus: spd, dodgeChance: dodge },
                desc: [`+${spd} Speed`, `+${dodge}% Dodge`]
            };
        }
    },
    {
        id: 'predatory',
        weight: 6,
        namePrefix: 'Predatory',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const atk = Math.max(1, Math.round((1 + level * 0.18) * mult));
            const crit = round1((0.5 + level * 0.025) * mult);
            return {
                mods: { attackBonus: atk, critChance: crit },
                desc: [`+${atk} Attack`, `+${crit}% Crit`]
            };
        }
    },
    {
        id: 'sorcerous',
        weight: 6,
        namePrefix: 'Sorcerous',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const mag = Math.max(1, Math.round((1 + level * 0.18) * mult));
            const res = Math.max(1, Math.round((2 + level * 0.4) * mult));
            return {
                mods: { magicBonus: mag, maxResourceBonus: res },
                desc: [`+${mag} Magic`, `+${res} Max Resource`]
            };
        }
    },
    {
        id: 'energized',
        weight: 6,
        namePrefix: 'Energized',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const haste = round1((0.7 + level * 0.03) * mult);
            const regen = round1((0.15 + level * 0.02) * mult);
            return {
                mods: { haste, hpRegen: regen },
                desc: [`+${haste}% Haste`, `+${regen} HP Regen`]
            };
        }
    }
];
// Accessories (Neck / Ring) can roll a slightly broader stat palette.
// This pool is intentionally modest so accessories feel meaningful without eclipsing weapons.
const ACCESSORY_AFFIX_POOL = [
    ...ARMOR_AFFIX_POOL,
    {
        id: 'vicious',
        weight: 12,
        namePrefix: 'Vicious',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = Math.max(1, Math.round((1 + level * 0.22) * mult));
            return { mods: { attackBonus: v }, desc: [`+${v} Attack`] };
        }
    },
    {
        id: 'savant',
        weight: 12,
        namePrefix: 'Savant',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = Math.max(1, Math.round((1 + level * 0.22) * mult));
            return { mods: { magicBonus: v }, desc: [`+${v} Magic`] };
        }
    },
    {
        id: 'precise',
        weight: 10,
        namePrefix: 'Precise',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = round1((0.7 + level * 0.035) * mult);
            return { mods: { critChance: v }, desc: [`+${v}% Crit`] };
        }
    },
    {
        id: 'quickened',
        weight: 10,
        namePrefix: 'Quickened',
        apply: ({ level, rarity }) => {
            const mult = RARITY_MULT[rarity] || 1;
            const v = round1((0.9 + level * 0.04) * mult);
            return { mods: { haste: v }, desc: [`+${v}% Haste`] };
        }
    }
];
function rollAffixes({ itemType, count, ctx }) {
    const pool = itemType === 'weapon'
        ? WEAPON_AFFIX_POOL
        : itemType === 'accessory'
            ? ACCESSORY_AFFIX_POOL
            : ARMOR_AFFIX_POOL;
    const picked = [];
    const usedIds = new Set();
    let namePrefix = null;
    let nameSuffix = null;
    const mods = {};
    const descParts = [];
    for (let i = 0; i < count; i++) {
        // pick something not already used
        const options = pool.filter((a) => !usedIds.has(a.id));
        if (!options.length)
            break;
        const affix = pickWeighted(options.map((a) => [a, a.weight || 1]));
        usedIds.add(affix.id);
        const res = affix.apply(ctx) || {};
        if (res.mods) {
            for (const [k, v] of Object.entries(res.mods)) {
                if (v === undefined || v === null)
                    continue;
                // additive stacking if repeated fields happen (rare if we avoid duplicates)
                mods[k] = (mods[k] || 0) + v;
            }
        }
        if (res.desc)
            descParts.push(...res.desc);
        if (!namePrefix && (res.namePrefix || affix.namePrefix))
            namePrefix = res.namePrefix || affix.namePrefix;
        if (!nameSuffix && res.nameSuffix)
            nameSuffix = res.nameSuffix;
        picked.push(affix.id);
    }
    return { picked, mods, descParts, namePrefix, nameSuffix };
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
];
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
];
// Curated legendary names (in addition to procedural naming).
// These are intentionally rare(ish) so they feel special.
//
// NOTE: All stats use fields that already exist elsewhere in the combat/inventory code.
const UNIQUE_LEGENDARIES = {
    weapon: {
        forest: [
            {
                name: 'Thornspire',
                baseName: 'Spear',
                element: 'nature',
                mods: { critChance: 2.2, haste: 2.0 }
            },
            {
                name: 'Ashwake',
                baseName: 'Greatsword',
                element: 'fire',
                mods: { armorPen: 3.0, lifeSteal: 1.4 }
            }
        ],
        ruins: [
            {
                name: 'Glyphbinder',
                baseName: 'Staff',
                element: 'arcane',
                mods: { critChance: 2.0, armorPen: 2.2 }
            },
            {
                name: 'Star-Index',
                baseName: 'Orb Focus',
                element: 'arcane',
                mods: { haste: 2.8, lifeSteal: 1.0 }
            }
        ],
        marsh: [
            {
                name: 'Mirefang',
                baseName: 'Dagger',
                element: 'poison',
                mods: { lifeSteal: 2.0, armorPen: 2.0 }
            }
        ],
        frostpeak: [
            {
                name: 'Rimebrand',
                baseName: 'Longsword',
                element: 'frost',
                mods: { critChance: 2.4, haste: 1.8 }
            },
            {
                name: 'Tempest Pike',
                baseName: 'War Pike',
                element: 'lightning',
                mods: { armorPen: 3.4, haste: 2.2 }
            }
        ],
        catacombs: [
            {
                name: 'Nightglass',
                baseName: 'Runic Dagger',
                element: 'shadow',
                mods: { critChance: 2.6, lifeSteal: 1.6 }
            }
        ],
        keep: [
            {
                name: 'Oathbreaker’s Edge',
                baseName: 'Greatsword',
                element: 'fire',
                mods: { armorPen: 3.6, critChance: 2.0 }
            },
            {
                name: 'Storm-Crowned Scepter',
                baseName: 'Scepter',
                element: 'lightning',
                mods: { haste: 3.0, armorPen: 2.4 }
            }
        ]
    },
    armor: {
        forest: [
            {
                name: 'Grovewarden Mantle',
                slot: 'armor',
                mods: { resistAll: 2.0, dodgeChance: 1.6, hpRegen: 0.8 }
            }
        ],
        ruins: [
            {
                name: 'Runesigil Cuirass',
                slot: 'armor',
                mods: { resistAll: 2.2, maxResourceBonus: 18, armorBonus: 3 }
            }
        ],
        marsh: [
            {
                name: 'Bogskin Wraps',
                slot: 'hands',
                mods: { dodgeChance: 2.0, thorns: 14, maxHPBonus: 10 }
            }
        ],
        frostpeak: [
            {
                name: 'Glacierbound Greaves',
                slot: 'feet',
                mods: { resistAll: 2.4, armorBonus: 4, speedBonus: 2 }
            }
        ],
        catacombs: [
            {
                name: 'Shroudweave Hood',
                slot: 'head',
                mods: { dodgeChance: 2.2, resistAll: 1.8, maxResourceBonus: 14 }
            }
        ],
        keep: [
            {
                name: 'Warden’s Bulwarkplate',
                slot: 'armor',
                mods: { armorBonus: 6, resistAll: 2.0, maxHPBonus: 18 }
            }
        ]
    }
};
const FLAVOR_PREFIX = [
    'Weathered',
    'Etched',
    'Gilded',
    'Carved',
    'Stitched',
    'Rune-Scored',
    'Frost-Kissed',
    'Ash-Touched',
    'Moonlit',
    'Graveworn'
];
// Implicit traits by base weapon. These add tiny, consistent identity per base type.
// Uses existing stat fields only.
const WEAPON_IMPLICITS = {
    Dagger: { critChance: 0.8, label: '+0.8% Crit' },
    Shortsword: { haste: 0.7, label: '+0.7% Haste' },
    Saber: { critChance: 0.6, label: '+0.6% Crit' },
    Rapier: { critChance: 1.0, label: '+1.0% Crit' },
    Gladius: { haste: 0.8, label: '+0.8% Haste' },
    Falchion: { armorPen: 0.9, label: '+0.9% Armor Pen' },
    'War Axe': { armorPen: 1.1, label: '+1.1% Armor Pen' },
    Greatsword: { lifeSteal: 0.7, label: '+0.7% Life Steal' },
    Halberd: { armorPen: 1.2, label: '+1.2% Armor Pen' },
    Spear: { armorPen: 1.0, label: '+1.0% Armor Pen' },
    Trident: { armorPen: 1.0, label: '+1.0% Armor Pen' },
    Mace: { lifeSteal: 0.6, label: '+0.6% Life Steal' },
    'Flanged Hammer': { lifeSteal: 0.9, label: '+0.9% Life Steal' },
    Maul: { lifeSteal: 1.0, label: '+1.0% Life Steal' },
    Staff: { haste: 0.7, label: '+0.7% Haste' },
    'Aether Staff': { haste: 1.0, label: '+1.0% Haste' },
    Wand: { critChance: 0.7, label: '+0.7% Crit' },
    Scepter: { armorPen: 0.7, label: '+0.7% Armor Pen' },
    'Runic Dagger': { critChance: 0.9, label: '+0.9% Crit' },
    Hexknife: { critChance: 1.0, label: '+1.0% Crit' },
    Spellblade: { haste: 0.6, label: '+0.6% Haste' },
    'Orb Focus': { armorPen: 0.6, label: '+0.6% Armor Pen' },
    'Sigil Rod': { critChance: 0.6, label: '+0.6% Crit' }
};
function composeName({ rarity, material, baseName, affixPrefix, affixSuffix, isLegendary }) {
    const rarityPrefix = RARITY_PREFIX[rarity]
        ? `${RARITY_PREFIX[rarity]} `
        : '';
    const core = `${material} ${baseName}`;
    if (isLegendary) {
        const owner = uniqueSyllableName();
        const title = pickWeighted(LEGENDARY_TITLES.map((t) => [t, 1]));
        const epithet = pickWeighted(LEGENDARY_EPITHETS.map((t) => [t, 1]));
        // Allow the elemental suffix to still show up sometimes, otherwise use epithet.
        const tail = affixSuffix && rngFloat(null, 'loot.suffixChance') < 0.45 ? affixSuffix : `of ${epithet}`;
        // Legendary items: Named + comma subtitle. Example: “Vaelor’s Oath, Starsteel Longsword of the Eclipse”
        return `${owner}s ${title}, ${core} ${tail}`.replace(/\s+/g, ' ').trim();
    }
    // Non-legendary: keep readable (avoid stacking too many prefixes)
    const maybeFlavor = !affixPrefix && rngFloat(null, 'loot.flavorPrefix') < 0.28
        ? `${pickWeighted(FLAVOR_PREFIX.map((t) => [t, 1]))} `
        : '';
    const maybeAffix = affixPrefix ? `${affixPrefix} ` : '';
    const maybeSuffix = affixSuffix ? ` ${affixSuffix}` : '';
    return `${rarityPrefix}${maybeFlavor}${maybeAffix}${core}${maybeSuffix}`
        .replace(/\s+/g, ' ')
        .trim();
}
function pickUniqueLegendary(type, area) {
    const byArea = (UNIQUE_LEGENDARIES[type] || {})[area];
    const any = Object.values(UNIQUE_LEGENDARIES[type] || {}).flat();
    const list = (byArea && byArea.length ? byArea : any) || [];
    if (!list.length)
        return null;
    return pickWeighted(list.map((it) => [it, 1]));
}
function scalePct(p, level, rarity) {
    const r = Math.max(0, RARITY_ORDER.indexOf(rarity));
    const s = (0.95 + (level || 1) * 0.015) * (1 + r * 0.08);
    return round1(p * s);
}
function scaleFlat(n, level, rarity) {
    const r = Math.max(0, RARITY_ORDER.indexOf(rarity));
    const s = (0.95 + (level || 1) * 0.02) * (1 + r * 0.08);
    return Math.max(1, Math.round(n * s));
}
// ------------------------------
// Gear builders
// ------------------------------
function buildWeapon(level, rarity, area = 'forest', isBoss = false) {
    const mult = RARITY_MULT[rarity] || 1.0;
    const isMythic = rarity === 'mythic';
    const isHighRarity = rarity === 'legendary' || isMythic;
    // Patch 1.2.0: ensure ALL generated weapons carry an elemental damage bonus.
    let forcedElemental = false;
    // Some high-rarity drops become curated "named" items for extra variety.
    // Mythic has a higher chance to be curated.
    const uniqueLegendary = isHighRarity &&
        rngFloat(null, isMythic ? 'loot.uniqueMythicWeapon' : 'loot.uniqueLegendary') <
            (isMythic ? 0.85 : 0.6)
        ? pickUniqueLegendary('weapon', area)
        : null;
    const archetype = pickWeighted([
        ['war', 45],
        ['mage', 35],
        ['hybrid', 20]
    ]);
    // Base numbers: tuned to roughly align with existing ITEM_DEFS progression
    let atk = 0;
    let mag = 0;
    if (archetype === 'war') {
        atk = Math.round((4 + level * 1.25) * mult);
        mag = Math.round(level * 0.25 * mult);
    }
    else if (archetype === 'mage') {
        atk = Math.round(level * 0.25 * mult);
        mag = Math.round((4 + level * 1.25) * mult);
    }
    else {
        atk = Math.round((3 + level * 0.9) * mult);
        mag = Math.round((3 + level * 0.9) * mult);
    }
    const element = uniqueLegendary && uniqueLegendary.element
        ? uniqueLegendary.element
        : rollElement(area);
    const material = rollMaterial(level, rarity);
    const baseName = uniqueLegendary && uniqueLegendary.baseName
        ? uniqueLegendary.baseName
        : pickWeighted((archetype === 'war'
            ? [
                ['Longsword', 14],
                ['War Axe', 10],
                ['Halberd', 8],
                ['Mace', 8],
                ['Greatsword', 8],
                ['Spear', 10],
                ['Rapier', 7],
                ['Scimitar', 7],
                ['Claymore', 6],
                ['Maul', 6],
                ['Flail', 6],
                ['Morningstar', 5],
                ['Trident', 5],
                ['Hookblade', 5],
                ['Flanged Hammer', 5],
                ['Gladius', 6],
                ['Falchion', 6]
            ]
            : archetype === 'mage'
                ? [
                    ['Staff', 14],
                    ['Wand', 12],
                    ['Spellblade', 10],
                    ['Runic Dagger', 8],
                    ['Scepter', 10],
                    ['Cane', 8],
                    ['Sigil Rod', 9],
                    ['Hexknife', 7],
                    ['Orb Focus', 7],
                    ['Aether Staff', 4],
                    ['Crystal Wand', 6],
                    ['Grimoire', 5],
                    ['Runed Tome', 5],
                    ['Astral Lens', 4],
                    ['Spirit Staff', 6]
                ]
                : [
                    ['Spear', 12],
                    ['Longsword', 10],
                    ['Saber', 9],
                    ['Dagger', 9],
                    ['War Pike', 7],
                    ['Twinblade', 7],
                    ['Glaive', 7],
                    ['Shortsword', 9],
                    ['Staff', 8],
                    ['War Axe', 8],
                    ['Rapier', 6],
                    ['Scimitar', 6],
                    ['Trident', 5],
                    ['Flail', 5]
                ]).map((x) => [x[0], x[1]]));
    // Implicit identity traits per base type (tiny, consistent).
    const implicit = WEAPON_IMPLICITS[baseName] || null;
    const implicitMods = {};
    const implicitDesc = [];
    if (implicit) {
        for (const [k, v] of Object.entries(implicit)) {
            if (k === 'label')
                continue;
            implicitMods[k] = scalePct(Number(v) || 0, level, rarity);
        }
        // rebuild label so it matches scaled number
        if (implicitMods.critChance)
            implicitDesc.push(`+${implicitMods.critChance}% Crit (Implicit)`);
        if (implicitMods.haste)
            implicitDesc.push(`+${implicitMods.haste}% Haste (Implicit)`);
        if (implicitMods.lifeSteal)
            implicitDesc.push(`+${implicitMods.lifeSteal}% Life Steal (Implicit)`);
        if (implicitMods.armorPen)
            implicitDesc.push(`+${implicitMods.armorPen}% Armor Pen (Implicit)`);
    }
    // Affixes
    const affixCount = uniqueLegendary
        ? clamp(affixCountFor(rarity, isBoss) - 1, 1, 3)
        : affixCountFor(rarity, isBoss);
    const rolled = rollAffixes({
        itemType: 'weapon',
        count: affixCount,
        ctx: { level, rarity, area, element }
    });
    // Apply affix mods (some affixes add flat Attack/Magic)
    atk += rolled.mods.attackBonus || 0;
    mag += rolled.mods.magicBonus || 0;
    let name = composeName({
        rarity,
        material,
        baseName,
        affixPrefix: rolled.namePrefix,
        affixSuffix: rolled.nameSuffix,
        isLegendary: isHighRarity
    });
    if (uniqueLegendary) {
        const suffixList = ELEMENT_SUFFIX[element] || ['of Legends'];
        const tail = pickWeighted(suffixList.map((s) => [s, 1]));
        name = `${uniqueLegendary.name}, ${material} ${baseName} ${tail}`
            .replace(/\s+/g, ' ')
            .trim();
    }
    const item = {
        id: makeId('gen_weapon'),
        name,
        type: 'weapon',
        attackBonus: atk || undefined,
        magicBonus: mag || undefined,
        // optional affix stats:
        critChance: (implicitMods.critChance || 0) + (rolled.mods.critChance || 0) ||
            undefined,
        haste: (implicitMods.haste || 0) + (rolled.mods.haste || 0) || undefined,
        lifeSteal: (implicitMods.lifeSteal || 0) + (rolled.mods.lifeSteal || 0) ||
            undefined,
        armorPen: (implicitMods.armorPen || 0) + (rolled.mods.armorPen || 0) ||
            undefined,
        elementalType: rolled.mods.elementalType || undefined,
        elementalBonus: rolled.mods.elementalBonus || undefined,
        // metadata:
        rarity,
        generated: true,
        unique: uniqueLegendary ? true : undefined,
        isLegendary: isHighRarity,
        isMythic: isMythic || undefined,
        affixes: rolled.picked.length ? rolled.picked : undefined
    };
    // Curated legendary mods (scaled). Uses existing fields only.
    if (uniqueLegendary && uniqueLegendary.mods) {
        for (const [k, v] of Object.entries(uniqueLegendary.mods)) {
            if (v === undefined || v === null)
                continue;
            const isPct = ['critChance', 'haste', 'lifeSteal', 'armorPen', 'dodgeChance', 'resistAll'].includes(k);
            const add = isPct ? scalePct(Number(v) || 0, level, rarity) : scaleFlat(Number(v) || 0, level, rarity);
            item[k] = (item[k] || 0) + add;
        }
        // Ensure a unique legendary always has an elemental identity.
        if (!item.elementalType)
            item.elementalType = element;
        if (!item.elementalBonus)
            item.elementalBonus = clamp(Math.round((3 + (level || 1) * 0.48) * mult), 1, 160);
    }
    // Patch 1.2.0: ensure ALL generated weapons carry an elemental identity.
    // Older loot rules could roll zero elemental affixes; we always want at least one element mod so builds have direction.
    if (!item.elementalType) {
        item.elementalType = element;
        forcedElemental = true;
    }
    if (!item.elementalBonus) {
        // Scale strongly with level and rarity; this is flat bonus damage added to matching-element spells/attacks.
        item.elementalBonus = clamp(Math.round((2 + (level || 1) * 0.45) * mult), 1, 140);
        forcedElemental = true;
    }
    item.itemLevel = estimateItemLevelFromStats(item, level);
    // Price scales off power; rarity already baked into stats, but rarity still nudges price.
    const raw = Math.max(1, getItemPowerScore(item)) * 8;
    item.price = Math.max(5, Math.round(raw * (1 + RARITY_ORDER.indexOf(rarity) * 0.15)));
    const descParts = [];
    if (item.attackBonus)
        descParts.push(`+${item.attackBonus} Attack`);
    if (item.magicBonus)
        descParts.push(`+${item.magicBonus} Magic`);
    if (implicitDesc.length)
        descParts.push(...implicitDesc);
    if (rolled.descParts.length)
        descParts.push(...rolled.descParts);
    if (forcedElemental && item.elementalType && item.elementalBonus) {
        const lbl = ELEMENT_LABEL[item.elementalType] || cap(item.elementalType);
        descParts.push(`+${item.elementalBonus} ${lbl} Damage`);
    }
    if (uniqueLegendary)
        descParts.push('Unique');
    descParts.push(`iLv ${item.itemLevel}`, formatRarityLabel(rarity));
    item.desc = descParts.filter(Boolean).join(', ') + '.';
    return item;
}
// NOTE: `forcedSlot` is primarily for dev/cheat tooling. Normal drops pass null.
function buildArmor(level, rarity, area = 'forest', isBoss = false, forcedSlot = null) {
    const mult = RARITY_MULT[rarity] || 1.0;
    const isMythic = rarity === 'mythic';
    const isHighRarity = rarity === 'legendary' || isMythic;
    // Patch 1.2.0: ensure ALL generated armor carries an elemental resistance.
    let forcedWard = false;
    // Some high-rarity drops become curated "named" items for extra variety.
    // Mythic has a higher chance to be curated.
    const uniqueLegendary = isHighRarity &&
        rngFloat(null, isMythic ? 'loot.uniqueMythicArmor' : 'loot.uniqueLegendaryArmor') <
            (isMythic ? 0.85 : 0.55)
        ? pickUniqueLegendary('armor', area)
        : null;
    // Slot weights: body armor is most common; jewelry is rarer.
    // If a forced slot is supplied (debug/cheat), honor it.
    let slot = forcedSlot;
    if (!slot) {
        slot = pickWeighted([
            ['armor', 34],
            ['head', 16],
            ['hands', 14],
            ['feet', 14],
            ['belt', 12],
            ['neck', 6],
            ['ring', 4]
        ]);
    }
    // Curated uniques can override slot in normal generation, but never when forced.
    if (!forcedSlot && uniqueLegendary && uniqueLegendary.slot)
        slot = uniqueLegendary.slot;
    const element = rollElement(area);
    const material = rollMaterial(level, rarity);
    // Base stats by slot (then affixes add on top)
    let armor = 0;
    let maxRes = 0;
    let maxHP = 0;
    let resistAll = 0;
    let speedBonus = 0;
    // Aesthetic style influences naming and (for body armor) baseline scaling.
    const style = pickWeighted([
        ['plate', 35],
        ['leather', 40],
        ['robe', 25]
    ]);
    // --- Base names by slot/style ------------------------------------------
    const bodyName = style === 'plate'
        ? pickWeighted([
            ['Plate Harness', 20],
            ['Knight Cuirass', 14],
            ['Bulwark Mail', 12],
            ['Warplate', 10],
            ['Ironward Brigandine', 8],
            ['Steel Hauberk', 8],
            ['Lamellar Coat', 7],
            ['Sentinel Cuirass', 6]
        ])
        : style === 'leather'
            ? pickWeighted([
                ['Leather Jerkin', 20],
                ['Hunter Mantle', 14],
                ['Shadowstitch Coat', 12],
                ['Ranger Vest', 10],
                ['Nightweave Jerkin', 8],
                ['Scout Coat', 8],
                ['Brigand Vest', 7],
                ['Wanderer Leathers', 6]
            ])
            : pickWeighted([
                ['Runed Robe', 20],
                ['Sigil Vestments', 14],
                ['Aetherweave Robe', 12],
                ['Hexed Raiment', 10],
                ['Arcanist Mantle', 8],
                ['Mystic Vestments', 7],
                ['Silken Robes', 7],
                ['Elderweave Garb', 6]
            ]);
    const headName = style === 'plate'
        ? pickWeighted([
            ['Greathelm', 18],
            ['Visored Helm', 14],
            ['Warden Helm', 12],
            ['Iron Crown', 10],
            ['Sallet', 10],
            ['Horned Helm', 8]
        ])
        : style === 'leather'
            ? pickWeighted([
                ['Leather Cap', 18],
                ['Hunter Hood', 14],
                ['Nightmask', 12],
                ['Ranger Hood', 10],
                ['Scout Cowl', 10],
                ['Stalker Hood', 8]
            ])
            : pickWeighted([
                ['Runed Cowl', 18],
                ['Aether Hood', 14],
                ['Sigil Circlet', 12],
                ['Hexed Veil', 10],
                ['Moon Circlet', 10],
                ['Oracle Veil', 8]
            ]);
    const handsName = style === 'plate'
        ? pickWeighted([
            ['Gauntlets', 20],
            ['Iron Grips', 14],
            ['Warden Gauntlets', 12],
            ['Templar Gloves', 10],
            ['Braced Gauntlets', 8],
            ['Chain Mitts', 8]
        ])
        : style === 'leather'
            ? pickWeighted([
                ['Leather Gloves', 20],
                ['Shadow Grips', 14],
                ['Hunter Wraps', 12],
                ['Ranger Gloves', 10],
                ['Scout Gloves', 8],
                ['Stitched Wraps', 8]
            ])
            : pickWeighted([
                ['Spellwraps', 20],
                ['Sigil Gloves', 14],
                ['Aether Wraps', 12],
                ['Arcanist Mitts', 10],
                ['Runewoven Gloves', 8],
                ['Mystic Wraps', 8]
            ]);
    const feetName = style === 'plate'
        ? pickWeighted([
            ['Greaves', 20],
            ['War Treads', 14],
            ['Bulwark Greaves', 12],
            ['Iron Boots', 10],
            ['Sabatons', 10],
            ['Steel Striders', 8]
        ])
        : style === 'leather'
            ? pickWeighted([
                ['Leather Boots', 20],
                ['Ranger Boots', 14],
                ['Night Treads', 12],
                ['Hunter Boots', 10],
                ['Scout Boots', 10],
                ['Stalker Treads', 8]
            ])
            : pickWeighted([
                ['Runed Slippers', 20],
                ['Aether Steps', 14],
                ['Sigil Shoes', 12],
                ['Hexed Sandals', 10],
                ['Mystic Slippers', 10],
                ['Moonlit Steps', 8]
            ]);
    const beltName = style === 'plate'
        ? pickWeighted([
            ['War Belt', 22],
            ['Iron Girdle', 14],
            ['Warden Belt', 12],
            ['Knight Sash', 10]
        ])
        : style === 'leather'
            ? pickWeighted([
                ['Leather Belt', 22],
                ['Ranger Belt', 14],
                ['Hunter Strap', 12],
                ['Shadow Cinch', 10]
            ])
            : pickWeighted([
                ['Runed Sash', 22],
                ['Aether Sash', 14],
                ['Sigil Cord', 12],
                ['Arcanist Girdle', 10]
            ]);
    const neckName = pickWeighted([
        ['Amulet', 22],
        ['Talisman', 16],
        ['Pendant', 16],
        ['Charm', 12],
        ['Locket', 10]
    ]);
    const ringName = pickWeighted([
        ['Ring', 28],
        ['Band', 18],
        ['Signet', 14],
        ['Loop', 10],
        ['Seal', 8]
    ]);
    const baseName = slot === 'armor'
        ? bodyName
        : slot === 'head'
            ? headName
            : slot === 'hands'
                ? handsName
                : slot === 'feet'
                    ? feetName
                    : slot === 'belt'
                        ? beltName
                        : slot === 'neck'
                            ? neckName
                            : ringName;
    // --- Baseline stat scaling ---------------------------------------------
    // Body armor retains the original progression curve; other slots are smaller.
    if (slot === 'armor') {
        if (style === 'plate') {
            armor = Math.round((4 + level * 1.15) * mult);
            maxRes = Math.round(level * 1.0 * mult);
        }
        else if (style === 'leather') {
            armor = Math.round((3 + level * 1.0) * mult);
            maxRes = Math.round(level * 1.5 * mult);
        }
        else {
            armor = Math.round((2 + level * 0.85) * mult);
            maxRes = Math.round((10 + level * 4.0) * mult);
        }
    }
    else if (slot === 'head') {
        armor = Math.round((2 + level * 0.6) * mult);
        maxRes = Math.round((4 + level * 1.0) * mult);
        maxHP = Math.round((1 + level * 0.25) * mult);
    }
    else if (slot === 'hands') {
        armor = Math.round((1 + level * 0.45) * mult);
        maxRes = Math.round((3 + level * 0.8) * mult);
    }
    else if (slot === 'feet') {
        armor = Math.round((1 + level * 0.45) * mult);
        maxRes = Math.round((3 + level * 0.8) * mult);
        speedBonus = Math.max(0, Math.round((0.5 + level * 0.04) * mult));
    }
    else if (slot === 'belt') {
        armor = Math.round((1 + level * 0.35) * mult);
        maxRes = Math.round((8 + level * 1.4) * mult);
        maxHP = Math.round((2 + level * 0.55) * mult);
    }
    else if (slot === 'neck') {
        armor = 0;
        maxRes = Math.round((10 + level * 1.8) * mult);
        maxHP = Math.round((4 + level * 0.8) * mult);
        resistAll = round1((0.8 + level * 0.05) * mult);
    }
    else if (slot === 'ring') {
        armor = 0;
        maxRes = Math.round((8 + level * 1.5) * mult);
        maxHP = Math.round((2 + level * 0.6) * mult);
        resistAll = round1((0.6 + level * 0.04) * mult);
    }
    // --- Affixes -------------------------------------------------------------
    const affixCount = uniqueLegendary
        ? clamp(affixCountFor(rarity, isBoss) - 1, 1, 3)
        : affixCountFor(rarity, isBoss);
    const affixType = slot === 'neck' || slot === 'ring' ? 'accessory' : 'armor';
    const rolled = rollAffixes({
        itemType: affixType,
        count: affixCount,
        ctx: { level, rarity, area, element }
    });
    // Apply affix mods (some affixes add flat Armor/Max Resource/etc.)
    armor += rolled.mods.armorBonus || 0;
    maxRes += rolled.mods.maxResourceBonus || 0;
    maxHP += rolled.mods.maxHPBonus || 0;
    resistAll += rolled.mods.resistAll || 0;
    speedBonus += rolled.mods.speedBonus || 0;
    let name = composeName({
        rarity,
        material,
        baseName,
        affixPrefix: rolled.namePrefix,
        affixSuffix: rolled.nameSuffix,
        isLegendary: isHighRarity
    });
    if (uniqueLegendary) {
        name = `${uniqueLegendary.name}, ${material} ${baseName}`
            .replace(/\s+/g, ' ')
            .trim();
    }
    const item = {
        id: makeId('gen_gear'),
        name,
        type: 'armor',
        slot, // 'armor' | 'head' | 'hands' | 'feet' | 'belt' | 'neck' | 'ring'
        // Core stats
        armorBonus: armor || undefined,
        maxResourceBonus: maxRes || undefined,
        maxHPBonus: maxHP || undefined,
        resistAll: resistAll || undefined,
        speedBonus: speedBonus || undefined,
        // Optional affix stats:
        attackBonus: rolled.mods.attackBonus || undefined,
        magicBonus: rolled.mods.magicBonus || undefined,
        critChance: rolled.mods.critChance || undefined,
        haste: rolled.mods.haste || undefined,
        lifeSteal: rolled.mods.lifeSteal || undefined,
        armorPen: rolled.mods.armorPen || undefined,
        dodgeChance: rolled.mods.dodgeChance || undefined,
        thorns: rolled.mods.thorns || undefined,
        hpRegen: rolled.mods.hpRegen || undefined,
        // Elemental bonus support (mostly weapons, but safe)
        elementalType: rolled.mods.elementalType || undefined,
        elementalBonus: rolled.mods.elementalBonus || undefined,
        // Elemental resistance support (Patch 1.2.0)
        elementalResistType: rolled.mods.elementalResistType || undefined,
        elementalResist: rolled.mods.elementalResist || undefined,
        rarity,
        generated: true,
        isLegendary: isHighRarity,
        isMythic: isMythic || undefined,
        unique: uniqueLegendary ? true : undefined,
        affixes: rolled.picked.length ? rolled.picked : undefined
    };
    // Curated legendary mods (scaled). Uses existing fields only.
    if (uniqueLegendary && uniqueLegendary.mods) {
        for (const [k, v] of Object.entries(uniqueLegendary.mods)) {
            if (v === undefined || v === null)
                continue;
            const isPct = ['critChance', 'haste', 'lifeSteal', 'armorPen', 'dodgeChance', 'resistAll'].includes(k);
            // hpRegen is a small per-turn number; keep it in decimal land.
            if (k === 'hpRegen') {
                const add = round1(scalePct(Number(v) || 0, level, rarity));
                item[k] = round1((item[k] || 0) + add);
                continue;
            }
            const add = isPct
                ? scalePct(Number(v) || 0, level, rarity)
                : scaleFlat(Number(v) || 0, level, rarity);
            item[k] = (item[k] || 0) + add;
        }
    }
    // Patch 1.2.0: ensure ALL generated armor carries an elemental resistance.
    if (!item.elementalResistType) {
        item.elementalResistType = element;
        forcedWard = true;
    }
    if (!item.elementalResist) {
        // Percent reduction versus incoming elemental magic of this type.
        // Scales with item level and rarity.
        item.elementalResist = clamp(Math.round((4 + (level || 1) * 0.45) * mult), 1, 60);
        forcedWard = true;
    }
    item.itemLevel = estimateItemLevelFromStats(item, level);
    const raw = Math.max(1, getItemPowerScore(item)) * 7.5;
    item.price = Math.max(5, Math.round(raw * (1 + RARITY_ORDER.indexOf(rarity) * 0.15)));
    const descParts = [];
    if (item.attackBonus)
        descParts.push(`+${item.attackBonus} Attack`);
    if (item.magicBonus)
        descParts.push(`+${item.magicBonus} Magic`);
    if (item.armorBonus)
        descParts.push(`+${item.armorBonus} Armor`);
    if (item.speedBonus)
        descParts.push(`+${item.speedBonus} Speed`);
    if (item.maxHPBonus)
        descParts.push(`+${item.maxHPBonus} Max HP`);
    if (item.maxResourceBonus)
        descParts.push(`+${item.maxResourceBonus} Max Resource`);
    if (rolled.descParts.length)
        descParts.push(...rolled.descParts);
    if (forcedWard && item.elementalResistType && item.elementalResist) {
        const lbl = ELEMENT_LABEL[item.elementalResistType] || cap(item.elementalResistType);
        descParts.push(`+${item.elementalResist}% ${lbl} Resist`);
    }
    if (uniqueLegendary)
        descParts.push('Unique');
    descParts.push(`iLv ${item.itemLevel}`, formatRarityLabel(rarity));
    item.desc = descParts.filter(Boolean).join(', ') + '.';
    return item;
}
// Dev/cheat helper: generate one armor piece for a specific equipment slot.
// This avoids relying on category RNG in `generateLootDrop()` when a tool needs
// to guarantee a complete set of gear (head/hands/feet/belt/neck/ring).
export function generateArmorForSlot({ area = 'forest', level = 1, rarity = 'common', isBoss = false, slot = 'armor' } = {}) {
    const s = String(slot || 'armor').toLowerCase();
    const valid = ['armor', 'head', 'hands', 'feet', 'belt', 'neck', 'ring'];
    const forced = valid.includes(s) ? s : 'armor';
    return buildArmor(level, rarity, area, !!isBoss, forced);
}
function buildPotion(level, rarity, resourceKey, area = 'forest') {
    // Potions are meant to be stackable, so ID must be stable by potion type/tier.
    const mult = RARITY_MULT[rarity] || 1.0;
    // Decide potion subtype
    // Rare+ can roll hybrid elixirs (restores HP + resource) for extra variety.
    const canHybrid = ['rare', 'epic', 'legendary', 'mythic'].includes(rarity);
    const subtype = pickWeighted(canHybrid
        ? [
            ['hp', 45],
            ['resource', 40],
            ['hybrid', 15]
        ]
        : [
            ['hp', 55],
            ['resource', 45]
        ]);
    // Tier based on rarity (common/uncommon -> small; rare+ -> strong)
    const tier = rarity === 'common' || rarity === 'uncommon'
        ? 'small'
        : rarity === 'rare'
            ? 'standard'
            : 'greater';
    const tierLabel = tier === 'small'
        ? 'Small'
        : tier === 'standard'
            ? 'Standard'
            : 'Greater';
    const item = {
        type: 'potion',
        rarity,
        generated: true
    };
    // Tiny “flavor” without breaking stacking names
    const element = rollElement(area);
    const flavor = rngFloat(null, 'loot.potionRoll') < 0.25
        ? `Brewed with ${ELEMENT_LABEL[element] || cap(element)} salts.`
        : null;
    if (subtype === 'hp') {
        const restore = Math.round((18 + level * 5) *
            mult *
            (tier === 'small' ? 0.85 : tier === 'standard' ? 1.0 : 1.25));
        item.id = `potion_hp_${tier}`;
        item.name = `${tierLabel} Health Potion`;
        item.hpRestore = restore;
        item.itemLevel = estimateItemLevelFromStats({ ...item, hpRestore: restore }, level);
        item.price = Math.max(3, Math.round(restore * 0.55));
        item.desc = [`Restore ${restore} HP.`, flavor].filter(Boolean).join(' ');
    }
    else if (subtype === 'resource') {
        const key = resourceKey || 'mana';
        const restore = Math.round((16 + level * 5) *
            mult *
            (tier === 'small' ? 0.85 : tier === 'standard' ? 1.0 : 1.25));
        item.id = `potion_${key}_${tier}`;
        const prettyKey = key.charAt(0).toUpperCase() + key.slice(1);
        item.name = `${tierLabel} ${prettyKey} Potion`;
        item.resourceKey = key;
        item.resourceRestore = restore;
        item.itemLevel = estimateItemLevelFromStats({ ...item, resourceRestore: restore }, level);
        item.price = Math.max(3, Math.round(restore * 0.55));
        item.desc = [`Restore ${restore} ${prettyKey}.`, flavor]
            .filter(Boolean)
            .join(' ');
    }
    else {
        // Hybrid elixir: restores both HP and the player resource.
        const key = resourceKey || 'mana';
        const hpRestore = Math.round((18 + level * 5) *
            mult *
            (tier === 'small' ? 0.65 : tier === 'standard' ? 0.8 : 1.0));
        const resRestore = Math.round((16 + level * 5) *
            mult *
            (tier === 'small' ? 0.65 : tier === 'standard' ? 0.8 : 1.0));
        item.id = `elixir_${key}_${tier}`;
        const prettyKey = key.charAt(0).toUpperCase() + key.slice(1);
        item.name = `${tierLabel} Reprieve Elixir`;
        item.resourceKey = key;
        item.hpRestore = hpRestore;
        item.resourceRestore = resRestore;
        item.itemLevel = estimateItemLevelFromStats({ ...item, hpRestore: hpRestore, resourceRestore: resRestore }, level);
        item.price = Math.max(5, Math.round((hpRestore + resRestore) * 0.42));
        item.desc = [
            `Restore ${hpRestore} HP and ${resRestore} ${prettyKey}.`,
            flavor
        ]
            .filter(Boolean)
            .join(' ');
    }
    return item;
}
export function getSellValue(item, context = 'village') {
    if (!item)
        return 0;
    const base = typeof item.price === 'number' && item.price > 0
        ? item.price
        : Math.max(1, Math.round(getItemPowerScore(item) * 6));
    // Wandering merchant generally offers worse prices.
    const factor = context === 'wandering' ? 0.45 : 0.6;
    // Sell one unit for potions
    return Math.max(1, Math.floor(base * factor));
}
// ------------------------------
// Main drop function
// ------------------------------
export function generateLootDrop({ area = 'forest', playerLevel = 1, enemy = null, playerResourceKey = null, forceGearMinRarity = null, forceGearRarity = null } = {}) {
    const isBoss = !!(enemy && enemy.isBoss);
    const isElite = !!(enemy && enemy.isElite);
    // Favor gear on bosses; favor potions on trash mobs.
    const categoryWeights = isBoss
        ? [
            ['weapon', 42],
            ['armor', 43],
            ['potion', 15]
        ]
        : isElite
            ? [
                ['weapon', 38],
                ['armor', 37],
                ['potion', 25]
            ]
            : [
                ['potion', 35],
                ['weapon', 35],
                ['armor', 30]
            ];
    const drops = [];
    const baseLevel = rollBaseLevel(playerLevel, area, isBoss || isElite);
    // Bosses can drop multiple items.
    const dropCount = isBoss
        ? (rngFloat(null, 'loot.qtyA') < 0.55 ? 2 : 3)
        : isElite
            ? (rngFloat(null, 'loot.qtyB') < 0.35 ? 2 : 1)
            : 1;
    // Prefer dropping a resource potion that the player can actually use.
    const preferredResourceKey = playerResourceKey || null;
    for (let i = 0; i < dropCount; i++) {
        const enemyTier = enemy && typeof enemy.rarityTier === 'number' ? enemy.rarityTier : 1;
        let rarity = rollRarity(isBoss, isElite, enemyTier);
        const category = pickWeighted(categoryWeights);
        // Cheat/debug hooks: optionally force (or floor) gear rarity.
        if (category === 'weapon' || category === 'armor') {
            if (forceGearRarity) {
                rarity = String(forceGearRarity).toLowerCase();
            }
            else if (forceGearMinRarity) {
                rarity = applyMinRarity(rarity, forceGearMinRarity);
            }
        }
        if (category === 'weapon') {
            drops.push(buildWeapon(baseLevel, rarity, area, isBoss || isElite));
        }
        else if (category === 'armor') {
            drops.push(buildArmor(baseLevel, rarity, area, isBoss || isElite));
        }
        else {
            drops.push(buildPotion(baseLevel, rarity, preferredResourceKey, area));
        }
    }
    // Small post-pass: ensure at least 1 potion on bosses only if no potion rolled.
    if (isBoss && !drops.some((d) => d.type === 'potion')) {
        drops.push(buildPotion(baseLevel, rollRarity(true, false, enemy && enemy.rarityTier ? enemy.rarityTier : 1), preferredResourceKey, area));
    }
    return drops;
}
//# sourceMappingURL=lootGenerator.js.map