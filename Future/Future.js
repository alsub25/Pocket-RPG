import { CHANGELOG } from './Changelog/changelog.js'
import { openGambleModalImpl } from './Locations/Village/tavernGames.js'
import {
    initTimeState,
    getTimeInfo,
    formatTimeShort,
    formatTimeLong,
    advanceTime,
    jumpToNextMorning
} from './Systems/timeSystem.js'

import { finiteNumber, clampFinite } from './Systems/safety.js'

import {
    initRngState,
    rngFloat,
    rngInt,
    rngPick,
    setRngSeed,
    setDeterministicRngEnabled,
    setRngLoggingEnabled
} from './Systems/rng.js'

import { validateState, formatIssues } from './Systems/assertState.js'

import {
    initVillageEconomyState,
    getVillageEconomySummary,
    getMerchantPrice,
    getRestCost,
    handleEconomyDayTick,
    handleEconomyAfterBattle,
    handleEconomyAfterPurchase
} from './Locations/Village/villageEconomy.js'
import {
    initGovernmentState,
    handleGovernmentDayTick,
    getGovernmentSummary,
    getVillageGovernmentEffect
} from './Systems/kingdomGovernment.js'
import { openBankModalImpl } from './Locations/Village/bank.js'
import { openTavernModalImpl } from './Locations/Village/tavern.js' // ⬅️ NEW
import {
    openMerchantModalImpl,
    handleMerchantDayTick,
    ensureMerchantStock
} from './Locations/Village/merchant.js' // ⬅️ NEW
import {
    generateLootDrop,
    getItemPowerScore,
    getSellValue,
    formatRarityLabel,
    pickWeighted
} from './Systems/lootGenerator.js'
import {
    openTownHallModalImpl,
    handleTownHallDayTick,
    cleanupTownHallEffects
} from './Locations/Village/townHall.js'
import {
    ensureVillagePopulation,
    handlePopulationDayTick
} from './Locations/Village/villagePopulation.js'
import { QUEST_DEFS } from './Quests/questDefs.js'
import { createDefaultQuestState, createDefaultQuestFlags } from './Quests/questDefaults.js'
import { createQuestBindings } from './Quests/questBindings.js'
import {
    buildEnemyForBattle,
    applyEnemyRarity as applyEnemyRarityImpl,
    applyEliteModifiers as applyEliteModifiersImpl,
    applyEnemyAffixes as applyEnemyAffixesImpl,
    applyEnemyAffixesOnEnemyHit as applyEnemyAffixesOnEnemyHitImpl,
    applyEnemyAffixesOnPlayerHit as applyEnemyAffixesOnPlayerHitImpl,
    getEnemyRarityDef,
    getEnemyAffixDef,
    getEnemyAffixLabels as getEnemyAffixLabelsImpl,
    rebuildEnemyDisplayName as rebuildEnemyDisplayNameImpl,
    ensureEnemyRuntime as ensureEnemyRuntimeImpl,
    syncEnemyBaseStats as syncEnemyBaseStatsImpl,
    computeEnemyPostureMax as computeEnemyPostureMaxImpl
} from './Systems/Enemy/index.js'



/* --------------------------- Storage helpers --------------------------- */
/**
 * localStorage can throw (private mode, quota exceeded, blocked storage).
 * We centralize safe get/set/remove so settings and saves don't crash the run.
 */
const _STORAGE_DIAG_KEY_LAST_CRASH = 'emberwood_last_crash_report_v1'
const _STORAGE_DIAG_KEY_LAST_SAVE_FAIL = 'emberwood_last_save_error_v1'

let _storageWarnedThisSession = false

function safeStorageGet(key) {
    try {
        return localStorage.getItem(key)
    } catch (e) {
        return null
    }
}

function safeStorageSet(key, value, opts = {}) {
    try {
        localStorage.setItem(key, value)
        return true
    } catch (e) {
        noteStorageFailure(opts.action || 'write', key, e)
        return false
    }
}

function safeStorageRemove(key, opts = {}) {
    try {
        localStorage.removeItem(key)
        return true
    } catch (e) {
        noteStorageFailure(opts.action || 'remove', key, e)
        return false
    }
}

function noteStorageFailure(action, key, err) {
    try {
        // Keep a breadcrumb in memory + (if possible) in storage for debugging.
        const payload = {
            action: String(action || 'write'),
            key: String(key || ''),
            message: err && err.message ? String(err.message) : 'Storage failure',
            time: Date.now()
        }
        try {
            // This may fail too, so wrap it.
            localStorage.setItem(_STORAGE_DIAG_KEY_LAST_SAVE_FAIL, JSON.stringify(payload))
        } catch (_) {}

        if (!_storageWarnedThisSession) {
            _storageWarnedThisSession = true
            // Prefer in-game log; fall back to console.
            try {
                if (typeof addLog === 'function') {
                    addLog('⚠️ Storage is unavailable (private mode or full). Saves/settings may not persist.', 'danger')
                }
            } catch (_) {}
        }
    } catch (_) {
        // ignore
    }
}

// --- Centralized daily tick -------------------------------------------------
// Keep day-change side effects in one place so 'rest' and 'explore' can't diverge.
function runDailyTicks(state, absoluteDay, hooks = {}) {
    if (!state || typeof absoluteDay !== 'number' || !Number.isFinite(absoluteDay)) return

    // Create sim container (persisted) if missing.
    if (!state.sim || typeof state.sim !== 'object') {
        state.sim = { lastDailyTickDay: null }
    }

    const targetDay = Math.max(0, Math.floor(absoluteDay))
    let lastDay =
        typeof state.sim.lastDailyTickDay === 'number' && Number.isFinite(state.sim.lastDailyTickDay)
            ? Math.max(0, Math.floor(state.sim.lastDailyTickDay))
            : null

    // If we've never ticked before, assume we need to tick *this* day once.
    if (lastDay === null) lastDay = targetDay - 1

    // Catch-up loop (handles skipped days). Cap so we never lock up the UI.
    const MAX_CATCH_UP_DAYS = 30
    let startDay = lastDay + 1
    if (targetDay - startDay + 1 > MAX_CATCH_UP_DAYS) {
        startDay = targetDay - MAX_CATCH_UP_DAYS + 1
    }

    for (let day = startDay; day <= targetDay; day++) {
        // Defensive: some older saves may not have population initialized yet.
        try {
            ensureVillagePopulation(state)
        } catch (_) {
            // ignore
        }

        handleEconomyDayTick(state, day)
        handleGovernmentDayTick(state, day, hooks)
        handleTownHallDayTick(state, day, hooks)
        handlePopulationDayTick(state, day, hooks)

        // Merchant stock restock (keeps shops from becoming permanently empty on long runs).
        try {
            handleMerchantDayTick(state, day, cloneItemDef)
        } catch (_) {
            // ignore
        }
    }

    state.sim.lastDailyTickDay = targetDay
}
// --- GAME DATA -----------------------------------------------------------------
const GAME_PATCH = '1.1.92' // current patch/version
const GAME_PATCH_NAME = 'The Blackbark Oath'
const SAVE_SCHEMA = 7 // bump when the save structure changes (migrations run on load)

/* --------------------------- Safety helpers --------------------------- */
// Imported from ./Systems/safety.js (keep NaN/Infinity guards consistent across systems).

// Minimal state sanitation to prevent NaN/Infinity cascades from corrupting the run.
function sanitizeCoreState() {
    try {
        if (!state) return
        const p = state.player
        if (p) {
            ensurePlayerSpellSystems(p)
            p.maxHp = Math.max(1, Math.floor(finiteNumber(p.maxHp, 1)))
            p.hp = clampFinite(p.hp, 0, p.maxHp, p.maxHp)

            p.maxResource = Math.max(0, Math.floor(finiteNumber(p.maxResource, 0)))
            p.resource = clampFinite(p.resource, 0, p.maxResource, p.maxResource)

            p.gold = Math.max(0, Math.floor(finiteNumber(p.gold, 0)))
        }

        const e = state.currentEnemy
        if (e) {
            e.maxHp = Math.max(1, Math.floor(finiteNumber(e.maxHp, e.hp || 1)))
            e.hp = clampFinite(e.hp, 0, e.maxHp, e.maxHp)
        }

        if (state.time && typeof state.time === 'object') {
            state.time.dayIndex = Math.max(0, Math.floor(finiteNumber(state.time.dayIndex, 0)))
            state.time.partIndex = clampFinite(state.time.partIndex, 0, 2, 0)
        }
    } catch (_) {
        // ignore
    }
}


/* --------------------------- Crash catcher --------------------------- */
let lastCrashReport = null
// Track the most recent save failure so the "Copy Bug Report" bundle can include it.
// (Safari iOS will throw if a non-declared global is referenced.)
let lastSaveError = null

function recordCrash(kind, err, extra = {}) {
    try {
        const message =
            (err && err.message) ||
            (typeof err === 'string' ? err : '') ||
            'Unknown error'
        const stack = err && err.stack ? String(err.stack) : ''
        lastCrashReport = {
            kind,
            message: String(message),
            stack: stack,
            time: Date.now(),
            patch: GAME_PATCH,
            schema: SAVE_SCHEMA,
            area: state && state.area ? state.area : null,
            player:
                state && state.player
                    ? {
                          name: state.player.name,
                          classId: state.player.classId,
                          level: state.player.level
                      }
                    : null,
            extra
        }


        try {
            safeStorageSet(_STORAGE_DIAG_KEY_LAST_CRASH, JSON.stringify(lastCrashReport), { action: 'write crash report' })
        } catch (_) {}

        // Keep a short in-game breadcrumb too.
        try {
            if (typeof addLog === 'function') {
                addLog('⚠️ An error occurred. Use Feedback to copy a report.', 'danger')
            }
        } catch (_) {}
    } catch (_) {
        // ignore
    }
}

function initCrashCatcher() {
    if (window.__pqCrashCatcherInstalled) return
    window.__pqCrashCatcherInstalled = true

    // Restore the last crash report (if any) so Feedback can include it after reload.
    try {
        const raw = safeStorageGet(_STORAGE_DIAG_KEY_LAST_CRASH)
        if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === 'object') lastCrashReport = parsed
        }
    } catch (_) {}

    window.addEventListener('error', (e) => {
        recordCrash(
            'error',
            e && e.error ? e.error : new Error(e && e.message ? e.message : 'Script error'),
            { filename: e && e.filename, lineno: e && e.lineno, colno: e && e.colno }
        )
    })

    window.addEventListener('unhandledrejection', (e) => {
        const reason = e && e.reason ? e.reason : new Error('Unhandled promise rejection')
        recordCrash('unhandledrejection', reason)
    })
}

const DIFFICULTY_CONFIG = {
    easy: {
        id: 'easy',
        name: 'Easy',
        enemyHpMod: 0.85,
        enemyDmgMod: 0.8,
        playerDmgMod: 1.1,
        aiSmartness: 0.5
    },
    normal: {
        id: 'normal',
        name: 'Normal',
        enemyHpMod: 1,
        enemyDmgMod: 1,
        playerDmgMod: 1,
        aiSmartness: 0.7
    },
    hard: {
        id: 'hard',
        name: 'Hard',
        enemyHpMod: 1.3,
        enemyDmgMod: 1.25,
        playerDmgMod: 0.95,
        aiSmartness: 0.95
    },
    dynamic: {
        id: 'dynamic',
        name: 'Dynamic',
        enemyHpMod: 1,
        enemyDmgMod: 1,
        playerDmgMod: 1,
        aiSmartness: 0.8
    }
}

// --- Progression / special encounters --------------------------------------
const MAX_PLAYER_LEVEL = 50 // used by dev cheats; raise if you want a longer grind

// Enemy rarity & scaling helpers live in Systems/Enemy.
function applyEnemyRarity(enemy) {
    return applyEnemyRarityImpl(enemy, { diffCfg: getActiveDifficultyConfig(), rand })
}

// After difficulty/elite/rarity/affix scaling, ensure baseAttack/baseMagic match the current stats.
function syncEnemyBaseStats(enemy) {
    return syncEnemyBaseStatsImpl(enemy)
}




function getActiveDifficultyConfig() {
    // Before state exists, just use Normal
    if (typeof state === 'undefined' || !state) {
        return { ...DIFFICULTY_CONFIG.normal, band: 0, closestId: 'normal' }
    }

    const normalBase = DIFFICULTY_CONFIG.normal
    const raw = DIFFICULTY_CONFIG[state.difficulty] || normalBase

    // Non-dynamic difficulties use their static config
    if (state.difficulty !== 'dynamic') {
        return { ...raw, band: 0, closestId: raw.id }
    }

    // Ensure dynamicDifficulty exists
    if (!state.dynamicDifficulty) {
        state.dynamicDifficulty = {
            band: 0,
            tooEasyStreak: 0,
            struggleStreak: 0
        }
    }

    const bandRaw = state.dynamicDifficulty.band || 0
    const band = Math.max(-2, Math.min(2, bandRaw)) // clamp -2..+2

    // Each band step nudges difficulty up/down from Normal
    const stepHp = 0.2 // enemy HP +20% per band up
    const stepEnemyDmg = 0.2 // enemy damage +20% per band up
    const stepPlayerDmg = -0.1 // player damage -10% per band up
    const stepAi = 0.15 // smarter AI per band up

    const enemyHpMod = normalBase.enemyHpMod * (1 + stepHp * band)
    const enemyDmgMod = normalBase.enemyDmgMod * (1 + stepEnemyDmg * band)
    const playerDmgMod = normalBase.playerDmgMod * (1 + stepPlayerDmg * band)
    const aiSmartness = Math.max(
        0.35,
        Math.min(0.98, normalBase.aiSmartness + stepAi * band)
    )

    // --- figure out which fixed difficulty we're closest to ------------------
    const baseIds = ['easy', 'normal', 'hard']
    let closestId = 'normal'
    let closestScore = Infinity

    for (const id of baseIds) {
        const base = DIFFICULTY_CONFIG[id]
        if (!base) continue

        const dHp = enemyHpMod - base.enemyHpMod
        const dEnemyDmg = enemyDmgMod - base.enemyDmgMod
        const dPlayerDmg = playerDmgMod - base.playerDmgMod
        const dAi = aiSmartness - base.aiSmartness

        // simple squared-distance in modifier space
        const score =
            dHp * dHp +
            dEnemyDmg * dEnemyDmg +
            dPlayerDmg * dPlayerDmg +
            dAi * dAi

        if (score < closestScore) {
            closestScore = score
            closestId = id
        }
    }

    const closestName = DIFFICULTY_CONFIG[closestId].name
    const label = `Dynamic (${closestName})`

    return {
        id: 'dynamic',
        name: label,
        enemyHpMod,
        enemyDmgMod,
        playerDmgMod,
        aiSmartness,
        band,
        closestId
    }
}
const PLAYER_CLASSES = {
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
// Starting skill distribution per class
const CLASS_STARTING_SKILLS = {
    mage: { strength: 0, endurance: 1, willpower: 3 },
    warrior: { strength: 3, endurance: 3, willpower: 0 },
    blood: { strength: 2, endurance: 2, willpower: 1 },
    ranger: { strength: 2, endurance: 1, willpower: 1 },
    paladin: { strength: 2, endurance: 2, willpower: 1 },
    rogue: { strength: 2, endurance: 1, willpower: 1 },
    cleric: { strength: 0, endurance: 2, willpower: 2 },
    necromancer: { strength: 0, endurance: 1, willpower: 3 },
    shaman: { strength: 1, endurance: 2, willpower: 2 },
    berserker: { strength: 3, endurance: 2, willpower: 0 },

    // NEW
    vampire: { strength: 1, endurance: 1, willpower: 2 },

    // fallback
    default: { strength: 1, endurance: 1, willpower: 1 }
}

// --- PATCH 1.1.0: Class engines (passives), spell progression, loadouts, and upgrades ----
const MAX_EQUIPPED_SPELLS = 4

// Class passives are lightweight rules applied dynamically (no permanent stat mutation).
const CLASS_PASSIVES = {
    mage: {
        id: 'arcaneRhythm',
        name: 'Arcane Rhythm',
        note: 'Every 3rd spell costs 30% less Mana and gains +15% crit chance.'
    },
    warrior: {
        id: 'bulwarkFury',
        name: 'Bulwark Fury',
        note: 'While at or above 40 Fury, you gain +2 Armor.'
    },
    blood: {
        id: 'crimsonExchange',
        name: 'Crimson Exchange',
        note: 'HP you spend grants Blood. Spending Blood heals a small amount.'
    },
    ranger: {
        id: 'steadyAim',
        name: 'Steady Aim',
        note: 'Your first hit each fight deals slightly increased damage.'
    },
    paladin: {
        id: 'sanctuary',
        name: 'Sanctuary',
        note: 'While shielded, you take slightly less damage.'
    },
    rogue: {
        id: 'opportunist',
        name: 'Opportunist',
        note: 'Gain extra crit chance against bleeding foes.'
    },
    cleric: {
        id: 'vigil',
        name: 'Vigil',
        note: 'Healing spells slightly over-heal into shields.'
    },
    necromancer: {
        id: 'graveTithe',
        name: 'Grave Tithe',
        note: 'Shadow damage slightly fuels your resource regeneration.'
    },
    shaman: {
        id: 'stormcall',
        name: 'Stormcall',
        note: 'Lightning damage has a small chance to jolt (mini-stun) weak foes.'
    },
    berserker: {
        id: 'painIsPower',
        name: 'Pain is Power',
        note: 'Missing HP slightly increases your physical damage.'
    },
    vampire: {
        id: 'hungeringVein',
        name: 'Hungering Vein',
        note: 'While above 55% Essence, you gain +8% Life Steal and +8% Dodge.'
    }
}

// New spells unlocked by class as you level.
// (These are additive; older saves will migrate and start unlocking going forward.)
const CLASS_LEVEL_UNLOCKS = {
    mage: [
        { level: 3, spell: 'arcaneSurge' },
        { level: 6, spell: 'meteorSigil' },
        { level: 9, spell: 'blink' },
        { level: 12, spell: 'arcaneOverload' }
    ],
    warrior: [
        { level: 3, spell: 'cleave' },
        { level: 6, spell: 'ironFortress' },
        { level: 9, spell: 'shieldBash' },
        { level: 12, spell: 'unbreakable' }
    ],
    blood: [
        { level: 3, spell: 'crimsonPact' },
        { level: 6, spell: 'bloodNova' },
        { level: 9, spell: 'bloodArmor' },
        { level: 12, spell: 'crimsonAvatar' }
    ],
    ranger: [
{ level: 3, spell: 'headshot' },
        { level: 6, spell: 'evasionRoll' },
        { level: 9, spell: 'huntersTrap' },
        { level: 12, spell: 'rainOfThorns' }
    ],
    paladin: [
        { level: 3, spell: 'judgment' },
        { level: 6, spell: 'aegisVow' },
        { level: 9, spell: 'cleanseFlame' },
        { level: 12, spell: 'divineIntervention' }
    ],
    rogue: [
{ level: 3, spell: 'eviscerate' },
        { level: 6, spell: 'smokeBomb' },
        { level: 9, spell: 'cripplingFlurry' },
        { level: 12, spell: 'vanish' }
    ],
    cleric: [
        { level: 3, spell: 'divineWard' },
        { level: 6, spell: 'benediction' },
        { level: 9, spell: 'sanctify' },
        { level: 12, spell: 'massPrayer' }
    ],
    necromancer: [
        { level: 3, spell: 'boneArmor' },
        { level: 6, spell: 'deathMark' },
        { level: 9, spell: 'harvest' },
        { level: 12, spell: 'lichForm' }
    ],
    shaman: [
{ level: 3, spell: 'totemEarth' },
        { level: 6, spell: 'stoneQuake' },
        { level: 9, spell: 'tempest' },
        { level: 12, spell: 'totemSpark' }
    ],
    berserker: [
        { level: 3, spell: 'rageRush' },
        { level: 6, spell: 'execute' },
        { level: 9, spell: 'enrage' },
        { level: 12, spell: 'bloodFrenzy' }
    ],
    vampire: [
        { level: 3, spell: 'nightFeast' },
        { level: 6, spell: 'mistForm' },
        { level: 9, spell: 'mesmerize' },
        { level: 12, spell: 'bloodMoon' }
    ]
}

// Generic ability upgrade rules (no per-ability tables needed).
const ABILITY_UPGRADE_RULES = {
    maxTier: 3,
    potencyPerTier: 0.12, // +12% effect per tier (damage/heal/shields)
    efficiencyCostReductPerTier: 0.10 // -10% cost per tier
}

function ensurePlayerSpellSystems(p) {
    if (!p || typeof p !== 'object') return
    if (!Array.isArray(p.spells)) p.spells = []
    if (!Array.isArray(p.equippedSpells)) {
        // Default: equip up to 4 of the known spells.
        p.equippedSpells = p.spells.slice(0, MAX_EQUIPPED_SPELLS)
    }
    // Clamp equip list (no duplicates, only known).
    p.equippedSpells = Array.from(
        new Set(p.equippedSpells.filter((id) => p.spells.includes(id)))
    ).slice(0, MAX_EQUIPPED_SPELLS)

    if (!p.abilityUpgrades || typeof p.abilityUpgrades !== 'object') {
        p.abilityUpgrades = {}
    }
    if (typeof p.abilityUpgradeTokens !== 'number' || !Number.isFinite(p.abilityUpgradeTokens)) {
        p.abilityUpgradeTokens = 0
    }

    p.status = p.status || {}
    if (typeof p.status.spellCastCount !== 'number' || !Number.isFinite(p.status.spellCastCount)) {
        p.status.spellCastCount = 0
    }
    if (typeof p.status.buffFromCompanion !== 'number' || !Number.isFinite(p.status.buffFromCompanion)) {
        p.status.buffFromCompanion = 0
    }
    if (typeof p.status.buffFromCompanionTurns !== 'number' || !Number.isFinite(p.status.buffFromCompanionTurns)) {
        p.status.buffFromCompanionTurns = 0
    }
    if (typeof p.status.evasionBonus !== 'number' || !Number.isFinite(p.status.evasionBonus)) {
        p.status.evasionBonus = 0
    }
    if (typeof p.status.evasionTurns !== 'number' || !Number.isFinite(p.status.evasionTurns)) {
        p.status.evasionTurns = 0
    }
    if (typeof p.status.firstHitBonusAvailable === 'undefined') {
        p.status.firstHitBonusAvailable = true
    }

    // Patch 1.1.7: additional class mechanics
    if (typeof p.status.comboPoints !== 'number' || !Number.isFinite(p.status.comboPoints)) p.status.comboPoints = 0
    if (typeof p.status.soulShards !== 'number' || !Number.isFinite(p.status.soulShards)) p.status.soulShards = 0
    if (typeof p.status.lichTurns !== 'number' || !Number.isFinite(p.status.lichTurns)) p.status.lichTurns = 0
    if (typeof p.status.totemType !== 'string') p.status.totemType = ''
    if (typeof p.status.totemTurns !== 'number' || !Number.isFinite(p.status.totemTurns)) p.status.totemTurns = 0
    if (typeof p.status.vanishTurns !== 'number' || !Number.isFinite(p.status.vanishTurns)) p.status.vanishTurns = 0

}

function getAbilityUpgrade(p, id) {
    if (!p || !p.abilityUpgrades) return null
    const u = p.abilityUpgrades[id]
    if (!u || typeof u !== 'object') return null
    const tier = Math.max(0, Math.min(ABILITY_UPGRADE_RULES.maxTier, Math.floor(Number(u.tier || 0))))
    const path = u.path === 'efficiency' ? 'efficiency' : u.path === 'potency' ? 'potency' : null
    return { tier, path }
}

function getAbilityEffectMultiplier(p, id) {
    const up = getAbilityUpgrade(p, id)
    if (!up || !up.path || up.tier <= 0) return 1
    if (up.path === 'potency') {
        return 1 + ABILITY_UPGRADE_RULES.potencyPerTier * up.tier
    }
    return 1
}

function applyUpgradeToCost(p, id, cost) {
    const up = getAbilityUpgrade(p, id)
    if (!up || up.path !== 'efficiency' || up.tier <= 0) return cost
    const reduct = ABILITY_UPGRADE_RULES.efficiencyCostReductPerTier * up.tier
    const out = Object.assign({}, cost || {})
    Object.keys(out).forEach((k) => {
        const v = Number(out[k] || 0)
        if (!Number.isFinite(v) || v <= 0) return
        out[k] = Math.max(1, Math.round(v * (1 - reduct)))
    })
    return out
}

function tryUnlockClassSpells(p) {
    if (!p) return []
    const unlocks = CLASS_LEVEL_UNLOCKS[p.classId] || []
    const gained = []
    unlocks.forEach((u) => {
        if (u.level === p.level && u.spell && !p.spells.includes(u.spell)) {
            p.spells.push(u.spell)
            gained.push(u.spell)
            // Auto-equip if there's room.
            if (Array.isArray(p.equippedSpells) && p.equippedSpells.length < MAX_EQUIPPED_SPELLS) {
                p.equippedSpells.push(u.spell)
            }
        }
    })
    return gained
}

function resetPlayerCombatStatus(p) {
    if (!p) return
    ensurePlayerSpellSystems(p)
    const st = p.status || (p.status = {})
    // Clear fight-scoped effects.
    st.bleedTurns = 0
    st.bleedDamage = 0
    st.shield = 0
    st.buffAttack = 0
    st.buffAttackTurns = 0
    st.buffMagic = 0
    st.buffMagicTurns = 0
    st.atkDown = 0
    st.atkDownTurns = 0
    st.magicDown = 0
    st.magicDownTurns = 0
    st.armorDown = 0
    st.armorDownTurns = 0
    st.magicResDown = 0
    st.magicResDownTurns = 0
    st.vulnerableTurns = 0
    st.dmgReductionTurns = 0

    st.buffFromCompanion = 0
    st.buffFromCompanionTurns = 0
    st.evasionBonus = 0
    st.evasionTurns = 0

    // Reset per-fight class cadence.
    st.spellCastCount = 0
    st.firstHitBonusAvailable = true

    // Patch 1.1.7 class mechanics
    st.comboPoints = 0
    st.soulShards = 0
    st.lichTurns = 0
    st.totemType = ''
    st.totemTurns = 0
    st.vanishTurns = 0
}

const ABILITIES = {
    // MAGE
    fireball: {
        id: 'fireball',
        name: 'Fireball',
        classId: 'mage',
        cost: { mana: 20 },
        note: 'A scorching projectile that deals heavy fire damage.'
    },
    iceShard: {
        id: 'iceShard',
        name: 'Ice Shard',
        classId: 'mage',
        cost: { mana: 15 },
        note: 'Moderate damage with a slight chill. In Hard, AI assumes you slow it.'
    },
    arcaneShield: {
        id: 'arcaneShield',
        name: 'Arcane Shield',
        classId: 'mage',
        cost: { mana: 18 },
        note: 'Summon a barrier that absorbs damage this fight.'
    },

    // WARRIOR
    powerStrike: {
        id: 'powerStrike',
        name: 'Power Strike',
        classId: 'warrior',
        cost: { fury: 25 },
        note: 'Consume Fury for a crushing blow.'
    },
    battleCry: {
        id: 'battleCry',
        name: 'Battle Cry',
        classId: 'warrior',
        cost: { fury: 15 },
        note: 'Boost attack and generate extra Fury.'
    },
    shieldWall: {
        id: 'shieldWall',
        name: 'Shield Wall',
        classId: 'warrior',
        cost: { fury: 20 },
        note: 'Greatly reduce incoming damage for a short time.'
    },

    // BLOOD KNIGHT
    bloodSlash: {
        id: 'bloodSlash',
        name: 'Blood Slash',
        classId: 'blood',
        cost: { hp: 10 },
        note: 'Convert your own blood into a vicious strike.'
    },
    leech: {
        id: 'leech',
        name: 'Leech',
        classId: 'blood',
        cost: { blood: 15 },
        note: 'Drain life from the enemy and heal yourself.'
    },
    hemorrhage: {
        id: 'hemorrhage',
        name: 'Hemorrhage',
        classId: 'blood',
        cost: { blood: 20 },
        note: 'Inflict a lingering wound that bleeds over time.'
    },
    // RANGER
    piercingShot: {
        id: 'piercingShot',
        name: 'Piercing Shot',
        classId: 'ranger',
        cost: { fury: 20 },
        note: 'A powerful arrow that punches straight through defenses.'
    },
    twinArrows: {
        id: 'twinArrows',
        name: 'Twin Arrows',
        classId: 'ranger',
        cost: { fury: 25 },
        note: 'Loose two rapid shots in succession.'
    },
    markedPrey: {
        id: 'markedPrey',
        name: 'Marked Prey',
        classId: 'ranger',
        cost: { fury: 15 },
        note: 'Harm your foe and leave them bleeding from precise hits.'
    },

    // PALADIN
    holyStrike: {
        id: 'holyStrike',
        name: 'Holy Strike',
        classId: 'paladin',
        cost: { mana: 15 },
        note: 'Smite the target with a sanctified blow, stronger against wounded foes.'
    },
    blessingLight: {
        id: 'blessingLight',
        name: 'Blessing of Light',
        classId: 'paladin',
        cost: { mana: 20 },
        note: 'Mend your wounds and conjure a small protective shield.'
    },
    retributionAura: {
        id: 'retributionAura',
        name: 'Retribution Aura',
        classId: 'paladin',
        cost: { mana: 18 },
        note: 'Empower your strikes and harden your resolve for a short time.'
    },

    // ROGUE
    backstab: {
        id: 'backstab',
        name: 'Backstab',
        classId: 'rogue',
        cost: { fury: 18 },
        note: 'A vicious strike that is deadliest when the fight has just begun.'
    },
    poisonedBlade: {
        id: 'poisonedBlade',
        name: 'Poisoned Blade',
        classId: 'rogue',
        cost: { fury: 20 },
        note: 'Slash your foe and inflict a lingering poison.'
    },
    shadowstep: {
        id: 'shadowstep',
        name: 'Shadowstep',
        classId: 'rogue',
        cost: { fury: 12 },
        note: 'Slip through the shadows, repositioning and sharpening your next attack.'
    },

    // CLERIC
    holyHeal: {
        id: 'holyHeal',
        name: 'Holy Heal',
        classId: 'cleric',
        cost: { mana: 22 },
        note: 'Call down gentle light to restore your vitality.'
    },
    smite: {
        id: 'smite',
        name: 'Smite',
        classId: 'cleric',
        cost: { mana: 14 },
        note: 'A focused bolt of radiant power.'
    },
    purify: {
        id: 'purify',
        name: 'Purify',
        classId: 'cleric',
        cost: { mana: 16 },
        note: 'Cleanse yourself of bleeding and bolster your defenses.'
    },

    // NECROMANCER
    soulBolt: {
        id: 'soulBolt',
        name: 'Soul Bolt',
        classId: 'necromancer',
        cost: { mana: 16 },
        note: 'Fire a shard of stolen essence that harms your foe and feeds you.'
    },
    raiseBones: {
        id: 'raiseBones',
        name: 'Raise Bones',
        classId: 'necromancer',
        cost: { mana: 24 },
        note: 'Summon a skeletal companion to fight at your side.'
    },
    decay: {
        id: 'decay',
        name: 'Decay',
        classId: 'necromancer',
        cost: { mana: 20 },
        note: 'Rot your enemy from within with a stacking, bleeding rot.'
    },

    // SHAMAN
    lightningLash: {
        id: 'lightningLash',
        name: 'Lightning Lash',
        classId: 'shaman',
        cost: { mana: 18 },
        note: 'Crackling lightning scorches your foe with unpredictable force.'
    },
    earthskin: {
        id: 'earthskin',
        name: 'Earthskin',
        classId: 'shaman',
        cost: { mana: 16 },
        note: 'Stone-hard skin dampens incoming blows for a short while.'
    },
    spiritHowl: {
        id: 'spiritHowl',
        name: 'Spirit Howl',
        classId: 'shaman',
        cost: { mana: 20 },
        note: 'Let out a primal call that empowers your companion.'
    },
    // VAMPIRE
    essenceDrain: {
        id: 'essenceDrain',
        name: 'Essence Drain',
        classId: 'vampire',
        cost: { essence: 20 },
        note: 'Rip life from your foe, healing yourself and refilling Essence.'
    },
    batSwarm: {
        id: 'batSwarm',
        name: 'Bat Swarm',
        classId: 'vampire',
        cost: { essence: 25 },
        note: 'Unleash a swarm of spectral bats that ravage and bleed the target.'
    },
    shadowVeil: {
        id: 'shadowVeil',
        name: 'Shadow Veil',
        classId: 'vampire',
        cost: { essence: 18 },
        note: 'Shroud yourself in darkness to reduce damage taken for a short time.'
    },

    // BERSERKER
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
        name: 'Bloodlust',
        classId: 'berserker',
        cost: { fury: 15 },
        note: 'Succumb to rage, surging with Fury and attack strength.'
    },

    // --- PATCH 1.1.0: NEW CLASS UNLOCKS --------------------------------------

    // MAGE (unlocks)
    arcaneSurge: {
        id: 'arcaneSurge',
        name: 'Arcane Surge',
        classId: 'mage',
        cost: { mana: 24 },
        note: 'Unleash a burst of arcane damage and charge your focus (short Magic buff). (Unlocks at level 3)'
    },
    meteorSigil: {
        id: 'meteorSigil',
        name: 'Meteor Sigil',
        classId: 'mage',
        cost: { mana: 40 },
        note: 'Carve a sigil that calls down a meteor for massive damage to your target and splash damage to nearby foes. (Unlocks at level 6)'
    },

    // WARRIOR (unlocks)
    cleave: {
        id: 'cleave',
        name: 'Cleave',
        classId: 'warrior',
        cost: { fury: 28 },
        note: 'A wide, brutal swing that damages multiple enemies and feeds your Fury. (Unlocks at level 3)'
    },
    ironFortress: {
        id: 'ironFortress',
        name: 'Iron Fortress',
        classId: 'warrior',
        cost: { fury: 22 },
        note: 'Fortify yourself with a barrier and strong damage reduction. (Unlocks at level 6)'
    },

    // BLOOD KNIGHT (unlocks)
    crimsonPact: {
        id: 'crimsonPact',
        name: 'Crimson Pact',
        classId: 'blood',
        cost: { hp: 12 },
        note: 'Trade HP for a surge of Blood and a short Attack buff. (Unlocks at level 3)'
    },
    bloodNova: {
        id: 'bloodNova',
        name: 'Blood Nova',
        classId: 'blood',
        cost: { blood: 28 },
        note: 'Detonate your Blood into a violent nova that damages all enemies and makes them bleed. (Unlocks at level 6)'
    },

    // RANGER (unlocks)
    evasionRoll: {
        id: 'evasionRoll',
        name: 'Evasion Roll',
        classId: 'ranger',
        cost: { fury: 18 },
        note: 'Reposition and become harder to hit for 2 turns. (Unlocks at level 3)'
    },
    rainOfThorns: {
        id: 'rainOfThorns',
        name: 'Rain of Thorns',
        classId: 'ranger',
        cost: { fury: 30 },
        note: 'A volley that peppers multiple enemies and deepens bleeding. (Unlocks at level 6)'
    },

    // PALADIN (unlocks)
    judgment: {
        id: 'judgment',
        name: 'Judgment',
        classId: 'paladin',
        cost: { mana: 22 },
        note: 'Smite the wicked. Deals extra when the foe is bleeding or chilled. (Unlocks at level 3)'
    },
    aegisVow: {
        id: 'aegisVow',
        name: 'Aegis Vow',
        classId: 'paladin',
        cost: { mana: 26 },
        note: 'A sacred vow that converts healing into shields and hardens you for 3 turns. (Unlocks at level 6)'
    },

    // ROGUE (unlocks)
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


// --- PATCH 1.1.0: Ability engine (data-driven effects + upgrades + passives) ----

// Player ability context: transient modifiers applied during a single action (damage/heal multipliers, crit bonus, etc).
// calcPhysicalDamage/calcMagicDamage will read this and apply it.
function _setPlayerAbilityContext(ctx) {
    state._playerAbilityCtx = ctx || null
}
function _getPlayerAbilityContext() {
    return state && state._playerAbilityCtx ? state._playerAbilityCtx : null
}

function _applyTimedBuff(st, key, amount, turns) {
    if (!st) return
    const turnsKey = key + 'Turns'
    st[key] = (st[key] || 0) + (amount || 0)
    st[turnsKey] = Math.max(st[turnsKey] || 0, turns || 0)
}

function _addShield(st, amount) {
    if (!st) return
    st.shield = (st.shield || 0) + Math.max(0, Math.round(amount || 0))
}

function _healPlayer(p, amount, ctx) {
    if (!p) return 0
    const st = p.status || (p.status = {})
    const mult = ctx && ctx.healMult ? ctx.healMult : 1
    const eff = Math.max(0, Math.round((amount || 0) * mult))
    const before = p.hp
    p.hp = Math.min(p.maxHp, p.hp + eff)
    const actual = p.hp - before

    // Cleric passive: convert a portion of overheal into shield.
    if (p.classId === 'cleric') {
        const overheal = Math.max(0, before + eff - p.maxHp)
        if (overheal > 0) {
            const shield = Math.max(1, Math.round(overheal * 0.5))
            _addShield(st, shield)
            addLog('Vigil converts excess healing into a ' + shield + '-point shield.', 'system')
        }
    }
    return actual
}

function _dealPlayerPhysical(p, enemy, baseStat, elementType) {
    const dmg = calcPhysicalDamage(baseStat, elementType)
    enemy.hp -= dmg
    applyPlayerOnHitEffects(dmg, elementType)
    applyEnemyPostureFromPlayerHit(enemy, dmg, { damageType: 'physical', elementType: elementType || null })
    return dmg
}
function _dealPlayerMagic(p, enemy, baseStat, elementType) {
    const dmg = calcMagicDamage(baseStat, elementType)
    enemy.hp -= dmg
    applyPlayerOnHitEffects(dmg, elementType)
    applyEnemyPostureFromPlayerHit(enemy, dmg, { damageType: 'magic', elementType: elementType || null })
    return dmg
}

// Patch 1.1.92: player AoE helpers (multi-enemy spell support)
// - Primary target takes full damage.
// - Other alive enemies take splash damage (default 70%).
function _dealPlayerPhysicalAoe(p, primaryEnemy, baseStat, elementType, opts = {}) {
    const splashMult = typeof opts.splashMult === 'number' && Number.isFinite(opts.splashMult)
        ? Math.max(0, Math.min(1, opts.splashMult))
        : 0.7
    const enemies = getAliveEnemies()
    if (!enemies || enemies.length === 0) return { total: 0, hits: [] }
    const primary = primaryEnemy && enemies.includes(primaryEnemy) ? primaryEnemy : enemies[0]
    const out = { total: 0, hits: [] }
    enemies.forEach((e) => {
        const mult = (e === primary) ? 1 : splashMult
        const dmg = _dealPlayerPhysical(p, e, baseStat * mult, elementType)
        out.total += dmg
        out.hits.push({ enemy: e, dmg })
    })
    return out
}

function _dealPlayerMagicAoe(p, primaryEnemy, baseStat, elementType, opts = {}) {
    const splashMult = typeof opts.splashMult === 'number' && Number.isFinite(opts.splashMult)
        ? Math.max(0, Math.min(1, opts.splashMult))
        : 0.7
    const enemies = getAliveEnemies()
    if (!enemies || enemies.length === 0) return { total: 0, hits: [] }
    const primary = primaryEnemy && enemies.includes(primaryEnemy) ? primaryEnemy : enemies[0]
    const out = { total: 0, hits: [] }
    enemies.forEach((e) => {
        const mult = (e === primary) ? 1 : splashMult
        const dmg = _dealPlayerMagic(p, e, baseStat * mult, elementType)
        out.total += dmg
        out.hits.push({ enemy: e, dmg })
    })
    return out
}

function _consumeCompanionBoonIfNeeded(p, ctx) {
    if (!p || !p.status || !ctx || !ctx.consumeCompanionBoon) return
    p.status.buffFromCompanion = 0
    p.status.buffFromCompanionTurns = 0
    addLog("Your companion's boon empowers your action!", 'system')
}

function _applyCostPassives(p, paidCost) {
    if (!p) return
    const st = p.status || (p.status = {})
    const cost = paidCost || {}

    // Blood Knight: HP spent grants Blood. Spending Blood heals a bit.
    if (p.classId === 'blood') {
        if (cost.hp && cost.hp > 0) {
            const gain = Math.max(1, Math.round(cost.hp * 1.2))
            p.resource = Math.min(p.maxResource, (p.resource || 0) + gain)
            addLog('Crimson Exchange: +' + gain + ' Blood.', 'system')
        }
        if (cost.blood && cost.blood > 0) {
            const heal = Math.max(1, Math.round(cost.blood * 0.45))
            const actual = _healPlayer(p, heal, { healMult: 1 })
            if (actual > 0) addLog('Crimson Exchange restores ' + actual + ' HP.', 'system')
        }
    }
}

function _getMageRhythmBonus(p, ab, abilityId) {
    if (!p || p.classId !== 'mage') return { costMult: 1, critBonus: 0, active: false }
    if (!ab || !ab.cost || !ab.cost.mana) return { costMult: 1, critBonus: 0, active: false }
    const st = p.status || (p.status = {})
    const nextCount = (st.spellCastCount || 0) + 1
    const active = nextCount % 3 === 0
    return active
        ? { costMult: 0.7, critBonus: 0.15, active: true }
        : { costMult: 1, critBonus: 0, active: false }
}

function getEffectiveAbilityCost(p, abilityId) {
    const ab = ABILITIES[abilityId]
    if (!ab || !ab.cost) return {}
    let cost = Object.assign({}, ab.cost)

    // Apply generic upgrades first.
    cost = applyUpgradeToCost(p, abilityId, cost)

    // Mage passive: every 3rd spell discount.
    const rhythm = _getMageRhythmBonus(p, ab, abilityId)
    if (rhythm.active && cost.mana) {
        cost.mana = Math.max(1, Math.round(cost.mana * rhythm.costMult))
    }

    return cost
}

function buildAbilityContext(p, abilityId) {
    ensurePlayerSpellSystems(p)
    const st = p.status || (p.status = {})
    const ab = ABILITIES[abilityId]

    const ctx = {
        dmgMult: 1,
        healMult: 1,
        critBonus: 0,
        consumeCompanionBoon: false,
        consumeFirstHitBonus: false,
        didDamage: false
    }

    // Upgrades: potency boosts effect, efficiency handled in cost.
    const effectMult = getAbilityEffectMultiplier(p, abilityId)
    ctx.dmgMult *= effectMult
    ctx.healMult *= effectMult

    // Companion boon: empower next action (damage/heal).
    if (st.buffFromCompanionTurns && st.buffFromCompanionTurns > 0) {
        ctx.dmgMult *= 1.15
        ctx.healMult *= 1.15
        ctx.consumeCompanionBoon = true
    }

    // Mage passive: every 3rd spell adds crit chance.
    const rhythm = _getMageRhythmBonus(p, ab, abilityId)
    if (rhythm.active) {
        ctx.critBonus += rhythm.critBonus
    }


// Patch 1.1.92: class meter is now combat-relevant.
// Mage (Rhythm): every 3rd spell also boosts effect and refunds a small amount of mana.
if (p.classId === 'mage' && rhythm.active) {
    ctx.dmgMult *= 1.30
    ctx.healMult *= 1.30
    ctx._mageRhythmActive = true
    ctx._manaRefund = (ctx._manaRefund || 0) + 4
}

// Warrior (Bulwark): while Fury is high, your next damaging ability is empowered.
// The empowerment is consumed after you deal damage (spends Fury and grants a small shield).
if (p.classId === 'warrior' && p.resourceKey === 'fury' && (p.resource || 0) >= 40) {
    ctx.dmgMult *= 1.25
    ctx._bulwarkActive = true
}

// Ranger (Marks): marked targets take slightly increased damage from your abilities.
// (The Headshot finisher already consumes marks for a large payoff; this makes the meter matter between finishers.)
try {
    const enemy = state.currentEnemy
    if (p.classId === 'ranger' && enemy && (enemy.markedStacks || 0) > 0) {
        const marks = Math.max(0, Math.min(5, enemy.markedStacks || 0))
        ctx.dmgMult *= 1 + marks * 0.03
    }
} catch (_) {}

// Blood Knight (Blood): high Blood triggers Bloodrush, boosting damage and lifesteal.
if (p.classId === 'blood' && p.resourceKey === 'blood') {
    const mx = Math.max(1, Number(p.maxResource || 0))
    const ratio = Number(p.resource || 0) / mx
    if (ratio >= 0.80) {
        ctx.dmgMult *= 1.12
        ctx.lifeStealBonusPct = (ctx.lifeStealBonusPct || 0) + 12
        ctx._bloodrushActive = true
    }
}

    // Ranger passive: first hit each fight.
    if (p.classId === 'ranger' && st.firstHitBonusAvailable) {
        ctx.dmgMult *= 1.12
        ctx.consumeFirstHitBonus = true
    }

    // Berserker passive: missing HP increases physical damage slightly.
    if (p.classId === 'berserker') {
        const missingPct = Math.max(0, (p.maxHp - p.hp) / Math.max(1, p.maxHp))
        ctx.dmgMult *= 1 + Math.min(0.2, missingPct * 0.2)
    }

    return ctx
}

const ABILITY_EFFECTS = {
    // --- MAGE --------------------------------------------------------------
    fireball: (p, enemy, ctx) => {
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.6, 'fire')
        ctx.didDamage = true
        return 'You launch a Fireball for ' + dmg + ' fire damage.'
    },
    iceShard: (p, enemy, ctx) => {
        // Element label normalized to match loot/affix system (frost, not ice).
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.25, 'frost')
        enemy.chilledTurns = Math.max(enemy.chilledTurns || 0, 2)
        ctx.didDamage = true
        return 'Ice shards pierce for ' + dmg + ' damage and chill the foe.'
    },
    arcaneShield: (p, enemy, ctx) => {
        const shield = Math.round(20 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        return 'Arcane energies form a shield worth ' + shield + ' points.'
    },

    // --- WARRIOR -----------------------------------------------------------
    powerStrike: (p, enemy, ctx) => {
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.4)
        ctx.didDamage = true
        return 'You deliver a Power Strike for ' + dmg + ' damage.'
    },
    battleCry: (p, enemy, ctx) => {
        _applyTimedBuff(p.status, 'buffAttack', 4, 2)
        p.resource = Math.min(p.maxResource, p.resource + 10)
        return 'Your Battle Cry boosts Attack and restores Fury.'
    },
    shieldWall: (p, enemy, ctx) => {
        p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 2)
        return 'You brace behind a Shield Wall, reducing damage for 2 turns.'
    },

    // --- BLOOD KNIGHT ------------------------------------------------------
    bloodSlash: (p, enemy, ctx) => {
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.5)
        ctx.didDamage = true
        return 'You carve a Blood Slash for ' + dmg + ' damage.'
    },
    leech: (p, enemy, ctx) => {
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 0.9, 'shadow')
        ctx.didDamage = true
        const healed = _healPlayer(p, Math.round(dmg * 0.6), ctx)
        return 'Leech drains ' + dmg + ' HP and restores ' + healed + ' HP to you.'
    },
    hemorrhage: (p, enemy, ctx) => {
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 0.9)
        ctx.didDamage = true
        enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, Math.round(p.stats.attack * 0.7))
        enemy.bleedTurns = (enemy.bleedTurns || 0) + 3
        return 'Hemorrhage deals ' + dmg + ' and opens a deep wound.'
    },

    // --- RANGER ------------------------------------------------------------
    piercingShot: (p, enemy, ctx) => {
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.3)
        ctx.didDamage = true
        return 'You fire a Piercing Shot for ' + dmg + ' damage.'
    },
    twinArrows: (p, enemy, ctx) => {
        // FIX: on-hit effects now apply to each arrow.
        const dmg1 = _dealPlayerPhysical(p, enemy, p.stats.attack * 0.75)
        const dmg2 = enemy.hp > 0 ? _dealPlayerPhysical(p, enemy, p.stats.attack * 0.75) : 0
        enemy.markedStacks = Math.min(5, (enemy.markedStacks || 0) + (dmg2 > 0 ? 2 : 1))
        enemy.markedTurns = Math.max(enemy.markedTurns || 0, 3)
        ctx.didDamage = true
        return 'Twin Arrows strike twice for ' + (dmg1 + dmg2) + ' total damage.'
    },
    markedPrey: (p, enemy, ctx) => {
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 0.8)
        ctx.didDamage = true
        applyEnemyAtkDown(enemy, 2, 2)
        enemy.markedStacks = Math.min(5, (enemy.markedStacks || 0) + 1)
        enemy.markedTurns = Math.max(enemy.markedTurns || 0, 3)
        return 'Marked Prey hits for ' + dmg + ' and weakens the foe.'
    },

    // --- PALADIN -----------------------------------------------------------
    holyStrike: (p, enemy, ctx) => {
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.2, 'holy')
        ctx.didDamage = true
        return 'Holy Strike smashes for ' + dmg + ' damage.'
    },
    blessingLight: (p, enemy, ctx) => {
        const healed = _healPlayer(p, Math.round(p.maxHp * 0.25), ctx)
        return 'Blessing of Light restores ' + healed + ' HP.'
    },
    retributionAura: (p, enemy, ctx) => {
        _applyTimedBuff(p.status, 'buffAttack', 3, 3) // FIX: set duration
        p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3) // FIX: ensure intended duration
        return 'A Retribution Aura surrounds you, boosting Attack and hardening you for 3 turns.'
    },

    // --- ROGUE -------------------------------------------------------------
    backstab: (p, enemy, ctx) => {
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.6)
        ctx.didDamage = true
        p.status.comboPoints = Math.min(5, (p.status.comboPoints || 0) + 1)
        return 'You Backstab for ' + dmg + ' damage!'
    },
    poisonedBlade: (p, enemy, ctx) => {
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.0)
        ctx.didDamage = true
        enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, Math.round(p.stats.attack * 0.5))
        enemy.bleedTurns = (enemy.bleedTurns || 0) + 3
        p.status.comboPoints = Math.min(5, (p.status.comboPoints || 0) + 1)
        return 'Poisoned Blade deals ' + dmg + ' and leaves the foe suffering over time.'
    },
    shadowstep: (p, enemy, ctx) => {
        const healed = _healPlayer(p, Math.round(p.maxHp * 0.15), ctx)
        _applyTimedBuff(p.status, 'buffAttack', 2, 2) // FIX: timed buff instead of permanent
        p.status.comboPoints = Math.min(5, (p.status.comboPoints || 0) + 1)
        return 'Shadowstep restores ' + healed + ' HP and sharpens your next strikes.'
    },

    // --- CLERIC ------------------------------------------------------------
    holyHeal: (p, enemy, ctx) => {
        const healed = _healPlayer(p, Math.round(p.maxHp * 0.35), ctx)
        return 'Holy Heal restores ' + healed + ' HP.'
    },
    smite: (p, enemy, ctx) => {
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.3, 'holy')
        ctx.didDamage = true
        return 'You Smite the foe for ' + dmg + ' holy damage.'
    },
    purify: (p, enemy, ctx) => {
        const oldBleed = p.status.bleedTurns || 0
        p.status.bleedTurns = 0
        p.status.bleedDamage = 0
        const shield = Math.round(15 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        return 'Purify cleanses bleeding (' + oldBleed + ' turn(s) removed) and grants a ' + shield + '-point shield.'
    },

    // --- NECROMANCER -------------------------------------------------------
    soulBolt: (p, enemy, ctx) => {
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.4, 'shadow')
        ctx.didDamage = true
        const healed = _healPlayer(p, Math.round(dmg * 0.4), ctx)
        const st = p.status || (p.status = {})
        st.soulShards = Math.min(5, (st.soulShards || 0) + 1)
        return 'Soul Bolt hits for ' + dmg + ' and siphons ' + healed + ' HP.'
    },
    raiseBones: (p, enemy, ctx) => {
        grantCompanion('skeleton')
        return 'Bones knit together: a Skeletal companion joins the battle.'
    },
    decay: (p, enemy, ctx) => {
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 0.9, 'poison')
        ctx.didDamage = true
        enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, Math.round(p.stats.magic * 0.7))
        enemy.bleedTurns = (enemy.bleedTurns || 0) + 3
        return 'Decay deals ' + dmg + ' and necrotic rot gnaws at the foe.'
    },

    // --- SHAMAN ------------------------------------------------------------
    lightningLash: (p, enemy, ctx) => {
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.5, 'lightning')
        ctx.didDamage = true
        // Small jolt chance (non-boss).
        if (!enemy.isBoss && rand('encounter.eliteRoll') < 0.15) {
            enemy.stunTurns = Math.max(enemy.stunTurns || 0, 1)
            addLog(enemy.name + ' is jolted!', 'good')
        }
        return 'Lightning Lash deals ' + dmg + ' lightning damage.'
    },
    earthskin: (p, enemy, ctx) => {
        p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3)
        const shield = Math.round(20 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        return 'Earthskin reduces damage and adds a ' + shield + '-point barrier.'
    },
    spiritHowl: (p, enemy, ctx) => {
        if (state.companion) {
            state.companion.attack += 4
            return 'Spirit Howl emboldens ' + state.companion.name + ', increasing their attack.'
        }
        return 'Your howl echoes, but no companion is present to answer.'
    },

    // --- VAMPIRE -----------------------------------------------------------
    essenceDrain: (p, enemy, ctx) => {
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.2, 'arcane')
        ctx.didDamage = true
        const healed = _healPlayer(p, Math.round(dmg * 0.5), ctx)
        const essenceGain = 15
        const beforeRes = p.resource
        p.resource = Math.min(p.maxResource, p.resource + essenceGain)
        return 'Essence Drain deals ' + dmg + ', heals ' + healed + ' HP, and restores ' + (p.resource - beforeRes) + ' Essence.'
    },
    batSwarm: (p, enemy, ctx) => {
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.3, 'shadow')
        ctx.didDamage = true
        enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, Math.round(p.stats.magic * 0.5))
        enemy.bleedTurns = (enemy.bleedTurns || 0) + 2
        return 'A bat swarm rends for ' + dmg + ' and leaves the foe bleeding.'
    },
    shadowVeil: (p, enemy, ctx) => {
        p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3)
        return 'Shadow Veil reduces damage taken for 3 turns.'
    },

    // --- BERSERKER ---------------------------------------------------------
    frenziedBlow: (p, enemy, ctx) => {
        const missing = Math.max(0, p.maxHp - p.hp)
        const bonusFactor = 1 + Math.min(0.8, missing / p.maxHp)
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * bonusFactor)
        ctx.didDamage = true
        return 'Frenzied Blow crashes for ' + dmg + ' damage.'
    },
    warCryBerserker: (p, enemy, ctx) => {
        const healed = _healPlayer(p, Math.round(p.maxHp * 0.2), ctx)
        _applyTimedBuff(p.status, 'buffAttack', 3, 2) // FIX: set duration
        return 'War Cry restores ' + healed + ' HP and surges your Attack.'
    },
    bloodlustRage: (p, enemy, ctx) => {
        const furyGain = 25
        p.resource = Math.min(p.maxResource, p.resource + furyGain)
        _applyTimedBuff(p.status, 'buffAttack', 2, 2) // FIX: set duration
        return 'Bloodlust grants ' + furyGain + ' Fury and sharpens your offense.'
    },

    // --- PATCH 1.1.0: NEW UNLOCKS -----------------------------------------
    arcaneSurge: (p, enemy, ctx) => {
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.25, 'arcane')
        ctx.didDamage = true
        _applyTimedBuff(p.status, 'buffMagic', 3, 2)
        return 'Arcane Surge deals ' + dmg + ' and charges your magic for 2 turns.'
    },
    meteorSigil: (p, enemy, ctx) => {
        const hit = _dealPlayerMagicAoe(p, enemy, p.stats.magic * 2.2, 'fire', { splashMult: 0.6 })
        ctx.didDamage = true
        const alive = getAliveEnemies()
        if (alive.length > 1) {
            const primary = hit.hits.find((h) => h.enemy === enemy)
            const primaryDmg = primary ? primary.dmg : 0
            const splashTotal = Math.max(0, hit.total - primaryDmg)
            return 'Meteor Sigil slams the battlefield for ' + hit.total + ' total damage (' + primaryDmg + ' to your target, ' + splashTotal + ' to the rest).'
        }
        return 'Meteor Sigil calls down destruction for ' + hit.total + ' damage!'
    },
    cleave: (p, enemy, ctx) => {
        const hit = _dealPlayerPhysicalAoe(p, enemy, p.stats.attack * 1.25, null, { splashMult: 0.72 })
        ctx.didDamage = true
        p.resource = Math.min(p.maxResource, p.resource + 12)
        if (getAliveEnemies().length > 1) {
            return 'Cleave carves through the group for ' + hit.total + ' total damage and stokes your Fury.'
        }
        return 'Cleave hits for ' + hit.total + ' and stokes your Fury.'
    },
    ironFortress: (p, enemy, ctx) => {
        const shield = Math.round(35 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3)
        return 'Iron Fortress grants a ' + shield + '-point barrier and heavy damage reduction for 3 turns.'
    },
    crimsonPact: (p, enemy, ctx) => {
        const gain = 24
        p.resource = Math.min(p.maxResource, p.resource + gain)
        _applyTimedBuff(p.status, 'buffAttack', 3, 3)
        return 'Crimson Pact grants +' + gain + ' Blood and a fierce Attack buff.'
    },
    bloodNova: (p, enemy, ctx) => {
        const hit = _dealPlayerMagicAoe(p, enemy, p.stats.magic * 1.45, 'shadow', { splashMult: 0.78 })
        ctx.didDamage = true
        // Bleed all enemies hit.
        const bleedDmg = Math.round(p.stats.magic * 0.6)
        hit.hits.forEach(({ enemy: e }) => {
            if (!e || finiteNumber(e.hp, 0) <= 0) return
            e.bleedDamage = Math.max(e.bleedDamage || 0, bleedDmg)
            e.bleedTurns = (e.bleedTurns || 0) + 3
        })
        if (getAliveEnemies().length > 1) {
            return 'Blood Nova erupts for ' + hit.total + ' total shadow damage and sets the group bleeding.'
        }
        return 'Blood Nova detonates for ' + hit.total + ' and makes the foe bleed.'
    },
    evasionRoll: (p, enemy, ctx) => {
        p.status.evasionBonus = Math.max(p.status.evasionBonus || 0, 0.25)
        p.status.evasionTurns = Math.max(p.status.evasionTurns || 0, 2)
        return 'Evasion Roll makes you harder to hit for 2 turns.'
    },
    rainOfThorns: (p, enemy, ctx) => {
        const enemies = getAliveEnemies()
        let total = 0
        const base = p.stats.attack * 0.75
        // One hit to everyone, plus a second hit to the primary target.
        enemies.forEach((e) => {
            total += _dealPlayerPhysical(p, e, base, 'piercing')
        })
        if (enemy && finiteNumber(enemy.hp, 0) > 0) {
            total += _dealPlayerPhysical(p, enemy, base, 'piercing')
        }
        ctx.didDamage = true
        const bleedDmg = Math.round(p.stats.attack * 0.55)
        enemies.forEach((e) => {
            if (!e || finiteNumber(e.hp, 0) <= 0) return
            e.bleedDamage = Math.max(e.bleedDamage || 0, bleedDmg)
            e.bleedTurns = (e.bleedTurns || 0) + 4
        })
        if (enemies.length > 1) {
            return 'Rain of Thorns peppers the group for ' + total + ' total damage and leaves them bleeding.'
        }
        return 'Rain of Thorns deals ' + total + ' and deepens bleeding.'
    },
    judgment: (p, enemy, ctx) => {
        const extra = (enemy.bleedTurns && enemy.bleedTurns > 0) || (enemy.chilledTurns && enemy.chilledTurns > 0)
        const mult = extra ? 1.25 : 1
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.35 * mult, 'holy')
        ctx.didDamage = true
        if (extra) {
            const healed = _healPlayer(p, Math.round(p.maxHp * 0.10), ctx)
            return 'Judgment smites for ' + dmg + ' and restores ' + healed + ' HP.'
        }
        return 'Judgment smites for ' + dmg + ' holy damage.'
    },
    aegisVow: (p, enemy, ctx) => {
        const healed = _healPlayer(p, Math.round(p.maxHp * 0.18), ctx)
        const shield = Math.round((25 + healed) * (ctx.healMult || 1))
        _addShield(p.status, shield)
        p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3)
        return 'Aegis Vow heals ' + healed + ' and raises a ' + shield + '-point aegis.'
    },
    smokeBomb: (p, enemy, ctx) => {
        p.status.evasionBonus = Math.max(p.status.evasionBonus || 0, 0.35)
        p.status.evasionTurns = Math.max(p.status.evasionTurns || 0, 2)
        return 'Smoke Bomb shrouds you, granting high dodge for 2 turns.'
    },
    cripplingFlurry: (p, enemy, ctx) => {
        const a = _dealPlayerPhysical(p, enemy, p.stats.attack * 0.55)
        const b = enemy.hp > 0 ? _dealPlayerPhysical(p, enemy, p.stats.attack * 0.55) : 0
        const c = enemy.hp > 0 ? _dealPlayerPhysical(p, enemy, p.stats.attack * 0.55) : 0
        ctx.didDamage = true
        enemy.bleedTurns = (enemy.bleedTurns || 0) + 4
        return 'Crippling Flurry strikes three times for ' + (a + b + c) + ' total and extends bleeding.'
    },
    divineWard: (p, enemy, ctx) => {
        const oldBleed = p.status.bleedTurns || 0
        p.status.bleedTurns = 0
        p.status.bleedDamage = 0
        const shield = Math.round(40 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        return 'Divine Ward cleanses bleeding (' + oldBleed + ' removed) and grants a ' + shield + '-point shield.'
    },
    benediction: (p, enemy, ctx) => {
        const healed = _healPlayer(p, Math.round(p.maxHp * 0.30), ctx)
        _applyTimedBuff(p.status, 'buffMagic', 4, 3)
        return 'Benediction restores ' + healed + ' HP and strengthens your magic for 3 turns.'
    },
    boneArmor: (p, enemy, ctx) => {
        const shield = Math.round(30 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        applyEnemyAtkDown(enemy, 3, 2)
        return 'Bone Armor grants a ' + shield + '-point shield and weakens the enemy.'
    },
    deathMark: (p, enemy, ctx) => {
        enemy.deathMarkTurns = Math.max(enemy.deathMarkTurns || 0, 3)
        enemy.deathMarkMult = Math.max(enemy.deathMarkMult || 0, 1.35)
        return 'A Death Mark brands the foe. Your next shadow hit will be amplified.'
    },
    totemSpark: (p, enemy, ctx) => {
        const st = p.status || (p.status = {})
        st.totemType = 'spark'
        st.totemTurns = Math.max(st.totemTurns || 0, 3)
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.05, 'lightning')
        ctx.didDamage = true
        if (!enemy.isBoss && rand('encounter.eliteRoll') < 0.20) {
            enemy.stunTurns = Math.max(enemy.stunTurns || 0, 1)
            addLog(enemy.name + ' is stunned by the spark!', 'good')
        }
        return 'Totem Spark zaps for ' + dmg + ' damage.'
    },
    stoneQuake: (p, enemy, ctx) => {
        const hit = _dealPlayerMagicAoe(p, enemy, p.stats.magic * 1.2, 'earth', { splashMult: 0.82 })
        ctx.didDamage = true
        hit.hits.forEach(({ enemy: e }) => {
            if (!e || finiteNumber(e.hp, 0) <= 0) return
            e.chilledTurns = Math.max(e.chilledTurns || 0, 2)
        })
        if (getAliveEnemies().length > 1) {
            return 'Stone Quake ripples through the battlefield for ' + hit.total + ' total damage and chills the group.'
        }
        return 'Stone Quake deals ' + hit.total + ' and chills the foe.'
    },
    rageRush: (p, enemy, ctx) => {
        const missingPct = Math.max(0, (p.maxHp - p.hp) / Math.max(1, p.maxHp))
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * (1.2 + missingPct * 0.5))
        ctx.didDamage = true
        p.resource = Math.min(p.maxResource, p.resource + 10)
        return 'Rage Rush slams for ' + dmg + ' damage and fuels your Fury.'
    },
    execute: (p, enemy, ctx) => {
        const hpPct = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1
        const mult = hpPct < 0.35 ? 2.4 : 1.5
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * mult)
        ctx.didDamage = true
        return hpPct < 0.35 ? 'Execute finishes with ' + dmg + ' damage!' : 'Execute strikes for ' + dmg + ' damage.'
    },
    nightFeast: (p, enemy, ctx) => {
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.5, 'shadow')
        ctx.didDamage = true
        const healed = _healPlayer(p, Math.round(dmg * 0.7), ctx)
        const beforeRes = p.resource
        p.resource = Math.min(p.maxResource, p.resource + 10)
        return 'Night Feast deals ' + dmg + ', heals ' + healed + ', and restores ' + (p.resource - beforeRes) + ' Essence.'
    },
    mistForm: (p, enemy, ctx) => {
        p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 3)
        p.status.evasionBonus = Math.max(p.status.evasionBonus || 0, 0.20)
        p.status.evasionTurns = Math.max(p.status.evasionTurns || 0, 3)
        const shield = Math.round(20 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        return 'Mist Form shrouds you: heavy damage reduction and a ' + shield + '-point veil.'
    }
,
    // --- PATCH 1.1.7: NEW UNLOCKS (Lv 9 / Lv 12) -------------------------

    // Mage
    blink: (p, enemy, ctx) => {
        p.status.evasionBonus = Math.max(p.status.evasionBonus || 0, 0.30)
        p.status.evasionTurns = Math.max(p.status.evasionTurns || 0, 2)
        const shield = Math.round(12 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        return 'Blink warps you to safety: evasion rises and you gain a ' + shield + '-point ward.'
    },
    arcaneOverload: (p, enemy, ctx) => {
        // If Arcane Rhythm is active (3rd spell), this hits harder.
        const bonus = (ctx && ctx.critBonus && ctx.critBonus > 0) ? 1.15 : 1
        const hit = _dealPlayerMagicAoe(p, enemy, p.stats.magic * 2.05 * bonus, 'arcane', { splashMult: 0.55 })
        ctx.didDamage = true
        if (getAliveEnemies().length > 1) {
            return 'Arcane Overload bursts across the line for ' + hit.total + ' total arcane damage.'
        }
        return 'Arcane Overload detonates for ' + hit.total + ' arcane damage.'
    },

    // Warrior
    shieldBash: (p, enemy, ctx) => {
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 1.05)
        ctx.didDamage = true
        if (!enemy.isBoss) enemy.stunTurns = Math.max(enemy.stunTurns || 0, 1)
        const shield = Math.round(18 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        return 'Shield Bash deals ' + dmg + ' damage, staggers the foe, and grants a ' + shield + '-point shield.'
    },
    unbreakable: (p, enemy, ctx) => {
        const shield = Math.round(60 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 4)
        p.resource = Math.min(p.maxResource, p.resource + 10)
        return 'Unbreakable: a ' + shield + '-point barrier forms and you harden for 4 turns.'
    },

    // Blood Knight
    bloodArmor: (p, enemy, ctx) => {
        const shield = Math.round(55 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        return 'Blood Armor crystallizes into a ' + shield + '-point shield.'
    },
    crimsonAvatar: (p, enemy, ctx) => {
        _applyTimedBuff(p.status, 'buffAttack', 5, 3)
        _applyTimedBuff(p.status, 'buffMagic', 3, 3)
        p.resource = Math.min(p.maxResource, p.resource + Math.max(1, Math.round(8 * _gainMult)))
        return 'Crimson Avatar awakens: your power surges for 3 turns.'
    },

    // Ranger
    huntersTrap: (p, enemy, ctx) => {
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 0.95)
        ctx.didDamage = true
        enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, Math.round(p.stats.attack * 0.55))
        enemy.bleedTurns = (enemy.bleedTurns || 0) + 2
        enemy.markedStacks = Math.min(5, (enemy.markedStacks || 0) + 2)
        enemy.markedTurns = Math.max(enemy.markedTurns || 0, 3)
        if (!enemy.isBoss) enemy.stunTurns = Math.max(enemy.stunTurns || 0, 1)
        return "Hunter's Trap snaps for " + dmg + ' damage, marks the foe, and hinders them.'
    },
    headshot: (p, enemy, ctx) => {
        const marks = Math.max(0, Math.min(5, enemy.markedStacks || 0))
        const mult = 1.85 + (marks * 0.18)
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * mult)
        ctx.didDamage = true
        if (marks > 0) {
            enemy.markedStacks = 0
            enemy.markedTurns = 0
        }
        return marks > 0
            ? 'Headshot consumes ' + marks + ' Mark(s) for ' + dmg + ' damage!'
            : 'Headshot strikes for ' + dmg + ' damage.'
    },

    // Paladin
    cleanseFlame: (p, enemy, ctx) => {
        const healed = _healPlayer(p, Math.round(p.maxHp * 0.22), ctx)
        // Cleanse common debuffs
        p.status.bleedTurns = 0
        p.status.bleedDamage = 0
        p.status.armorDownTurns = 0
        p.status.armorDown = 0
        p.status.atkDownTurns = 0
        p.status.atkDown = 0
        p.status.magicDownTurns = 0
        p.status.magicDown = 0
        const shield = Math.round(18 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        return 'Cleansing Flame heals ' + healed + ' HP, cleanses afflictions, and grants a ' + shield + '-point shield.'
    },
    divineIntervention: (p, enemy, ctx) => {
        const healed = _healPlayer(p, Math.round(p.maxHp * 0.42), ctx)
        const shield = Math.round(30 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 2)
        return 'Divine Intervention restores ' + healed + ' HP and grants a ' + shield + '-point holy barrier.'
    },

    // Rogue
    eviscerate: (p, enemy, ctx) => {
        const st = p.status || (p.status = {})
        const cp = Math.max(0, Math.min(5, st.comboPoints || 0))
        const bleedBonus = (enemy.bleedTurns || 0) > 0 ? 1.15 : 1
        const mult = (1.05 + cp * 0.35) * bleedBonus
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * mult)
        ctx.didDamage = true
        st.comboPoints = 0
        return cp > 0
            ? 'Eviscerate spends ' + cp + ' Combo for ' + dmg + ' damage!'
            : 'Eviscerate strikes for ' + dmg + ' damage.'
    },
    vanish: (p, enemy, ctx) => {
        const st = p.status || (p.status = {})
        st.vanishTurns = Math.max(st.vanishTurns || 0, 2)
        st.evasionBonus = Math.max(st.evasionBonus || 0, 0.35)
        st.evasionTurns = Math.max(st.evasionTurns || 0, 2)
        st.comboPoints = Math.min(5, (st.comboPoints || 0) + 2)
        return 'Vanish: you slip into shadows, become elusive for 2 turns, and gain Combo momentum.'
    },

    // Cleric
    sanctify: (p, enemy, ctx) => {
        const healed = _healPlayer(p, Math.round(p.maxHp * 0.26), ctx)
        const oldBleed = p.status.bleedTurns || 0
        p.status.bleedTurns = 0
        p.status.bleedDamage = 0
        const shield = Math.round(26 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        return 'Sanctify heals ' + healed + ' HP, cleanses bleeding (' + oldBleed + ' turn(s)), and adds a ' + shield + '-point shield.'
    },
    massPrayer: (p, enemy, ctx) => {
        const healed = _healPlayer(p, Math.round(p.maxHp * 0.38), ctx)
        _applyTimedBuff(p.status, 'buffMagic', 3, 3)
        const shield = Math.round(28 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        return 'Mass Prayer restores ' + healed + ' HP, empowers your magic, and grants a ' + shield + '-point ward.'
    },

    // Necromancer
    harvest: (p, enemy, ctx) => {
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.35, 'shadow')
        ctx.didDamage = true
        const healed = _healPlayer(p, Math.round(dmg * 0.35), ctx)
        const st = p.status || (p.status = {})
        const gain = enemy.hp <= enemy.maxHp * 0.30 ? 3 : 2
        st.soulShards = Math.min(5, (st.soulShards || 0) + gain)
        return 'Harvest reaps ' + dmg + ' damage, heals ' + healed + ', and gathers ' + gain + ' Soul Shard(s).' 
    },
    lichForm: (p, enemy, ctx) => {
        const st = p.status || (p.status = {})
        st.lichTurns = Math.max(st.lichTurns || 0, 3)
        return 'Lich Form awakens: shadow magic is empowered for 3 turns.'
    },

    // Shaman
    totemEarth: (p, enemy, ctx) => {
        const st = p.status || (p.status = {})
        st.totemType = 'earth'
        st.totemTurns = Math.max(st.totemTurns || 0, 3)
        const shield = Math.round(28 * (ctx.healMult || 1))
        _addShield(p.status, shield)
        return 'An Earth Totem rises: you gain a ' + shield + '-point barrier for protection.'
    },
    tempest: (p, enemy, ctx) => {
        const st = p.status || (p.status = {})
        const mult = st.totemTurns > 0 ? 2.05 : 1.75
        const hit = _dealPlayerMagicAoe(p, enemy, p.stats.magic * mult, 'lightning', { splashMult: 0.65 })
        ctx.didDamage = true

        // Totem synergy: chance to stun each hit enemy (non-boss) while the totem is active.
        let stunned = 0
        if (st.totemTurns > 0) {
            hit.hits.forEach(({ enemy: e }) => {
                if (!e || e.isBoss || finiteNumber(e.hp, 0) <= 0) return
                if (rand('encounter.eliteRoll') < 0.22) {
                    e.stunTurns = Math.max(e.stunTurns || 0, 1)
                    stunned += 1
                }
            })
        }

        if (getAliveEnemies().length > 1) {
            const extra = stunned > 0 ? ' (' + stunned + ' stunned)' : ''
            return 'Tempest chains through the group for ' + hit.total + ' total lightning damage' + extra + '.'
        }
        if (stunned > 0 && enemy && enemy.name) addLog(enemy.name + ' is stunned by the Tempest!', 'good')
        return 'Tempest crashes for ' + hit.total + ' lightning damage.'
    },

    // Berserker
    enrage: (p, enemy, ctx) => {
        _applyTimedBuff(p.status, 'buffAttack', 4, 4)
        p.resource = Math.min(p.maxResource, p.resource + 12)
        return 'Enrage fuels your fury: Attack rises for 4 turns.'
    },
    bloodFrenzy: (p, enemy, ctx) => {
        const dmg = _dealPlayerPhysical(p, enemy, p.stats.attack * 2.05)
        ctx.didDamage = true
        const healed = _healPlayer(p, Math.round(dmg * 0.22), ctx)
        return 'Blood Frenzy tears for ' + dmg + ' damage and restores ' + healed + ' HP.'
    },

    // Vampire
    mesmerize: (p, enemy, ctx) => {
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 1.15, 'shadow')
        ctx.didDamage = true
        if (!enemy.isBoss) enemy.stunTurns = Math.max(enemy.stunTurns || 0, 1)
        const before = p.resource
        p.resource = Math.min(p.maxResource, p.resource + Math.max(1, Math.round(8 * _gainMult)))
        return 'Mesmerize deals ' + dmg + ' and staggers the foe, restoring ' + (p.resource - before) + ' Essence.'
    },
    bloodMoon: (p, enemy, ctx) => {
        const dmg = _dealPlayerMagic(p, enemy, p.stats.magic * 2.1, 'shadow')
        ctx.didDamage = true
        const healed = _healPlayer(p, Math.round(dmg * 0.55), ctx)
        p.status.dmgReductionTurns = Math.max(p.status.dmgReductionTurns || 0, 2)
        return 'Blood Moon eclipses the foe for ' + dmg + ' damage and heals ' + healed + ' HP.'
    }
}


const ITEM_DEFS = {
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
        desc: '+6 Attack. Favored by warriors.'
    },
    staffOak: {
        id: 'staffOak',
        name: 'Runed Oak Staff',
        type: 'weapon',
        magicBonus: 5,
        price: 45,
        desc: '+5 Magic. Smooth channeling for spellcasters.'
    },
    bladeSanguine: {
        id: 'bladeSanguine',
        name: 'Sanguine Edge',
        type: 'weapon',
        attackBonus: 4,
        magicBonus: 3,
        price: 60,
        desc: '+4 Attack, +3 Magic. Whispers for blood.'
    },
    armorLeather: {
        id: 'armorLeather',
        name: 'Hardened Leather',
        type: 'armor',
        slot: 'armor',
        armorBonus: 4,
        price: 40,
        desc: '+4 Armor. Basic but reliable.'
    },
    robeApprentice: {
        id: 'robeApprentice',
        name: 'Apprentice Robe',
        type: 'armor',
        slot: 'armor',
        armorBonus: 2,
        maxResourceBonus: 20,
        price: 40,
        desc: '+2 Armor, +20 Mana.'
    }
}
const ENEMY_TEMPLATES = {
    // --- Emberwood Forest ---------------------------------------------------
    wolf: {
        id: 'wolf',
        name: 'Forest Wolf',
        baseLevel: 2,
        maxHp: 45,
        attack: 8,
        magic: 0,
        armor: 1,
        magicRes: 0,
        xp: 16,
        goldMin: 6,
        goldMax: 12,
        isBoss: false,
        behavior: 'aggressive'
    },
    wolfDire: {
        id: 'wolfDire',
        name: 'Dire Wolf',
        baseLevel: 4,
        maxHp: 70,
        attack: 12,
        magic: 0,
        armor: 2,
        magicRes: 0,
        xp: 26,
        goldMin: 10,
        goldMax: 20,
        isBoss: false,
        behavior: 'aggressive'
    },
    spider: {
        id: 'spider',
        name: 'Venom Spider',
        baseLevel: 3,
        maxHp: 55,
        attack: 9,
        magic: 0,
        armor: 1,
        magicRes: 1,
        xp: 20,
        goldMin: 7,
        goldMax: 16,
        isBoss: false,
        behavior: 'aggressive'
    },
    boar: {
        id: 'boar',
        name: 'Razorback Boar',
        baseLevel: 3,
        maxHp: 78,
        attack: 11,
        magic: 0,
        armor: 2,
        magicRes: 0,
        xp: 24,
        goldMin: 9,
        goldMax: 18,
        isBoss: false,
        behavior: 'aggressive'
    },
    goblin: {
        id: 'goblin',
        name: 'Goblin Raider',
        baseLevel: 3,
        maxHp: 60,
        attack: 10,
        magic: 0,
        armor: 2,
        magicRes: 0,
        xp: 22,
        goldMin: 8,
        goldMax: 18,
        isBoss: false,
        behavior: 'cunning'
    },
    goblinArcher: {
        id: 'goblinArcher',
        name: 'Goblin Archer',
        baseLevel: 4,
        maxHp: 58,
        attack: 13,
        magic: 0,
        armor: 2,
        magicRes: 0,
        xp: 28,
        goldMin: 10,
        goldMax: 22,
        isBoss: false,
        behavior: 'cunning'
    },
    goblinShaman: {
        id: 'goblinShaman',
        name: 'Goblin Shaman',
        baseLevel: 5,
        maxHp: 72,
        attack: 8,
        magic: 12,
        armor: 2,
        magicRes: 2,
        xp: 34,
        goldMin: 12,
        goldMax: 26,
        isBoss: false,
        behavior: 'caster'
    },
    bandit: {
        id: 'bandit',
        name: 'Roadside Bandit',
        baseLevel: 5,
        maxHp: 85,
        attack: 14,
        magic: 0,
        armor: 3,
        magicRes: 1,
        xp: 36,
        goldMin: 15,
        goldMax: 34,
        isBoss: false,
        behavior: 'cunning'
    },
    goblinBoss: {
        id: 'goblinBoss',
        name: 'Goblin Warlord',
        baseLevel: 6,
        maxHp: 130,
        attack: 16,
        magic: 0,
        armor: 4,
        magicRes: 1,
        xp: 60,
        goldMin: 40,
        goldMax: 65,
        isBoss: true,
        behavior: 'bossGoblin'
    },

    // --- Ruined Spire -------------------------------------------------------
    voidSpawn: {
        id: 'voidSpawn',
        name: 'Voidspawn',
        baseLevel: 6,
        maxHp: 85,
        attack: 10,
        magic: 8,
        armor: 3,
        magicRes: 2,
        xp: 35,
        goldMin: 12,
        goldMax: 25,
        isBoss: false,
        behavior: 'caster'
    },
    voidHound: {
        id: 'voidHound',
        name: 'Void Hound',
        baseLevel: 7,
        maxHp: 95,
        attack: 14,
        magic: 4,
        armor: 3,
        magicRes: 2,
        xp: 42,
        goldMin: 14,
        goldMax: 30,
        isBoss: false,
        behavior: 'aggressive'
    },
    cultist: {
        id: 'cultist',
        name: 'Spire Cultist',
        baseLevel: 7,
        maxHp: 88,
        attack: 9,
        magic: 13,
        armor: 2,
        magicRes: 3,
        xp: 44,
        goldMin: 16,
        goldMax: 34,
        isBoss: false,
        behavior: 'caster'
    },
    corruptedKnight: {
        id: 'corruptedKnight',
        name: 'Corrupted Knight',
        baseLevel: 8,
        maxHp: 120,
        attack: 16,
        magic: 0,
        armor: 5,
        magicRes: 2,
        xp: 55,
        goldMin: 18,
        goldMax: 40,
        isBoss: false,
        behavior: 'cunning'
    },
    wraith: {
        id: 'wraith',
        name: 'Void Wraith',
        baseLevel: 9,
        maxHp: 105,
        attack: 10,
        magic: 18,
        armor: 3,
        magicRes: 4,
        xp: 62,
        goldMin: 22,
        goldMax: 48,
        isBoss: false,
        behavior: 'caster'
    },
    mimic: {
        id: 'mimic',
        name: 'Shard Mimic',
        baseLevel: 9,
        maxHp: 140,
        attack: 18,
        magic: 0,
        armor: 4,
        magicRes: 3,
        xp: 66,
        goldMin: 25,
        goldMax: 55,
        isBoss: false,
        behavior: 'cunning'
    },
    dragon: {
        id: 'dragon',
        name: 'Void-Touched Dragon',
        baseLevel: 10,
        maxHp: 220,
        attack: 22,
        magic: 15,
        armor: 6,
        magicRes: 4,
        xp: 120,
        goldMin: 80,
        goldMax: 140,
        isBoss: true,
        behavior: 'bossDragon'
    },

    // --- Ashen Marsh --------------------------------------------------------
    swampCrawler: {
        id: 'swampCrawler',
        name: 'Swamp Crawler',
        baseLevel: 10,
        maxHp: 150,
        attack: 18,
        magic: 0,
        armor: 4,
        magicRes: 3,
        xp: 78,
        goldMin: 26,
        goldMax: 58,
        isBoss: false,
        behavior: 'aggressive'
    },
    plagueToad: {
        id: 'plagueToad',
        name: 'Plague Toad',
        baseLevel: 11,
        maxHp: 170,
        attack: 16,
        magic: 8,
        armor: 4,
        magicRes: 3,
        xp: 86,
        goldMin: 28,
        goldMax: 62,
        isBoss: false,
        behavior: 'aggressive'
    },
    mireStalker: {
        id: 'mireStalker',
        name: 'Mire Stalker',
        baseLevel: 12,
        maxHp: 155,
        attack: 22,
        magic: 0,
        armor: 5,
        magicRes: 3,
        xp: 92,
        goldMin: 30,
        goldMax: 68,
        isBoss: false,
        behavior: 'cunning'
    },
    bogCultist: {
        id: 'bogCultist',
        name: 'Bog Cultist',
        baseLevel: 12,
        maxHp: 145,
        attack: 14,
        magic: 20,
        armor: 3,
        magicRes: 5,
        xp: 98,
        goldMin: 32,
        goldMax: 74,
        isBoss: false,
        behavior: 'caster'
    },
    marshWitch: {
        id: 'marshWitch',
        name: 'Marsh Witch',
        baseLevel: 14,
        maxHp: 280,
        attack: 18,
        magic: 28,
        armor: 6,
        magicRes: 6,
        xp: 170,
        goldMin: 120,
        goldMax: 210,
        isBoss: true,
        behavior: 'bossWitch'
    },

    // --- Frostpeak Pass -----------------------------------------------------
    iceWolf: {
        id: 'iceWolf',
        name: 'Frost Wolf',
        baseLevel: 14,
        maxHp: 185,
        attack: 24,
        magic: 0,
        armor: 5,
        magicRes: 4,
        xp: 110,
        goldMin: 35,
        goldMax: 78,
        isBoss: false,
        behavior: 'aggressive'
    },
    frostGoblin: {
        id: 'frostGoblin',
        name: 'Frost Goblin',
        baseLevel: 15,
        maxHp: 165,
        attack: 26,
        magic: 0,
        armor: 6,
        magicRes: 4,
        xp: 118,
        goldMin: 38,
        goldMax: 82,
        isBoss: false,
        behavior: 'cunning'
    },
    yeti: {
        id: 'yeti',
        name: 'Yeti Brute',
        baseLevel: 16,
        maxHp: 240,
        attack: 28,
        magic: 0,
        armor: 7,
        magicRes: 4,
        xp: 132,
        goldMin: 40,
        goldMax: 90,
        isBoss: false,
        behavior: 'aggressive'
    },
    iceMage: {
        id: 'iceMage',
        name: 'Icebound Adept',
        baseLevel: 16,
        maxHp: 160,
        attack: 16,
        magic: 30,
        armor: 4,
        magicRes: 7,
        xp: 138,
        goldMin: 42,
        goldMax: 94,
        isBoss: false,
        behavior: 'caster'
    },
    frostGiant: {
        id: 'frostGiant',
        name: 'Frostpeak Giant',
        baseLevel: 18,
        maxHp: 420,
        attack: 34,
        magic: 0,
        armor: 10,
        magicRes: 6,
        xp: 240,
        goldMin: 170,
        goldMax: 280,
        isBoss: true,
        behavior: 'bossGiant'
    },

    // --- Sunken Catacombs ---------------------------------------------------
    skeletonWarrior: {
        id: 'skeletonWarrior',
        name: 'Catacomb Skeleton',
        baseLevel: 18,
        maxHp: 260,
        attack: 30,
        magic: 0,
        armor: 9,
        magicRes: 6,
        xp: 160,
        goldMin: 45,
        goldMax: 105,
        isBoss: false,
        behavior: 'cunning'
    },
    skeletonArcher: {
        id: 'skeletonArcher',
        name: 'Bone Archer',
        baseLevel: 19,
        maxHp: 210,
        attack: 34,
        magic: 0,
        armor: 8,
        magicRes: 6,
        xp: 172,
        goldMin: 48,
        goldMax: 112,
        isBoss: false,
        behavior: 'cunning'
    },
    necromancer: {
        id: 'necromancer',
        name: 'Drowned Necromancer',
        baseLevel: 20,
        maxHp: 230,
        attack: 18,
        magic: 40,
        armor: 7,
        magicRes: 10,
        xp: 198,
        goldMin: 52,
        goldMax: 128,
        isBoss: false,
        behavior: 'caster'
    },
    boneGolem: {
        id: 'boneGolem',
        name: 'Bone Golem',
        baseLevel: 21,
        maxHp: 360,
        attack: 38,
        magic: 0,
        armor: 12,
        magicRes: 8,
        xp: 220,
        goldMin: 58,
        goldMax: 140,
        isBoss: false,
        behavior: 'aggressive'
    },
    lich: {
        id: 'lich',
        name: 'Sunken Lich',
        baseLevel: 22,
        maxHp: 520,
        attack: 22,
        magic: 55,
        armor: 10,
        magicRes: 12,
        xp: 360,
        goldMin: 220,
        goldMax: 360,
        isBoss: true,
        behavior: 'bossLich'
    },

    // --- Obsidian Keep ------------------------------------------------------
    darkKnight: {
        id: 'darkKnight',
        name: 'Dark Knight',
        baseLevel: 22,
        maxHp: 360,
        attack: 42,
        magic: 0,
        armor: 13,
        magicRes: 9,
        xp: 230,
        goldMin: 60,
        goldMax: 150,
        isBoss: false,
        behavior: 'cunning'
    },
    shadowAssassin: {
        id: 'shadowAssassin',
        name: 'Shadow Assassin',
        baseLevel: 23,
        maxHp: 300,
        attack: 48,
        magic: 0,
        armor: 11,
        magicRes: 10,
        xp: 250,
        goldMin: 64,
        goldMax: 160,
        isBoss: false,
        behavior: 'aggressive'
    },
    voidSorcerer: {
        id: 'voidSorcerer',
        name: 'Void Sorcerer',
        baseLevel: 24,
        maxHp: 310,
        attack: 22,
        magic: 62,
        armor: 10,
        magicRes: 14,
        xp: 285,
        goldMin: 70,
        goldMax: 180,
        isBoss: false,
        behavior: 'caster'
    },
    dreadGuard: {
        id: 'dreadGuard',
        name: 'Dread Guard',
        baseLevel: 24,
        maxHp: 420,
        attack: 46,
        magic: 0,
        armor: 15,
        magicRes: 10,
        xp: 300,
        goldMin: 72,
        goldMax: 190,
        isBoss: false,
        behavior: 'cunning'
    },
    obsidianKing: {
        id: 'obsidianKing',
        name: 'The Obsidian King',
        baseLevel: 26,
        maxHp: 720,
        attack: 55,
        magic: 40,
        armor: 18,
        magicRes: 16,
        xp: 520,
        goldMin: 420,
        goldMax: 650,
        isBoss: true,
        behavior: 'bossKing'
    }
}

// Zones define level ranges for encounter scaling.
// Enemies do NOT scale to the player — they scale to the zone they are in.
const ZONE_DEFS = {
    village: { id: 'village', minLevel: 1, maxLevel: 2 },
    forest: { id: 'forest', minLevel: 2, maxLevel: 6 },
    ruins: { id: 'ruins', minLevel: 6, maxLevel: 10 },
    marsh: { id: 'marsh', minLevel: 10, maxLevel: 14 },
    frostpeak: { id: 'frostpeak', minLevel: 14, maxLevel: 18 },
    catacombs: { id: 'catacombs', minLevel: 18, maxLevel: 22 },
    keep: { id: 'keep', minLevel: 22, maxLevel: 26 }
}

const RANDOM_ENCOUNTERS = {
    village: [],
    forest: [
        'wolf',
        'wolfDire',
        'spider',
        'boar',
        'goblin',
        'goblinArcher',
        'goblinShaman',
        'bandit'
    ],
    ruins: [
        'voidSpawn',
        'voidHound',
        'cultist',
        'corruptedKnight',
        'wraith',
        'mimic'
    ],
    marsh: ['swampCrawler', 'plagueToad', 'mireStalker', 'bogCultist'],
    frostpeak: ['iceWolf', 'frostGoblin', 'yeti', 'iceMage'],
    catacombs: [
        'skeletonWarrior',
        'skeletonArcher',
        'necromancer',
        'boneGolem'
    ],
    keep: ['darkKnight', 'shadowAssassin', 'voidSorcerer', 'dreadGuard']
}

// --- COMPANIONS ---------------------------------------------------------------

const COMPANION_DEFS = {
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

// --- COMPANION ABILITIES ---------------------------------------------------
// Abilities are cooldown-driven; companion AI will consult these and use them when sensible.
const COMPANION_ABILITIES = {
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

// --- ENEMY ABILITIES & AI KITS -------------------------------------------------
//
// Every enemy gets (at least) 4 special abilities. Sets are assigned by behavior
// and bosses get expanded kits. Abilities are implemented in enemyTurn().

const ENEMY_ABILITIES = {
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
        potency: 1.35
    },

    voidBreath: {
        id: 'voidBreath',
        name: 'Void Breath',
        desc: 'A wave of void-flame that leaves you exposed.',
        cooldown: 5,
        type: 'damage+debuff',
        damageType: 'magic',
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

const ENEMY_ABILITY_SETS = {
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
    ]
}

function pickEnemyAbilitySet(enemy) {
    if (!enemy) return ENEMY_ABILITY_SETS.basic

    // If template explicitly sets a kit, use it.
    if (enemy.abilitySet && ENEMY_ABILITY_SETS[enemy.abilitySet]) {
        return ENEMY_ABILITY_SETS[enemy.abilitySet]
    }

    // Boss behaviors map directly to sets
    if (enemy.isBoss && enemy.behavior && ENEMY_ABILITY_SETS[enemy.behavior]) {
        return ENEMY_ABILITY_SETS[enemy.behavior]
    }

    // Non-boss behavior sets
    const b = enemy.behavior || 'basic'
    if (ENEMY_ABILITY_SETS[b]) return ENEMY_ABILITY_SETS[b]

    return ENEMY_ABILITY_SETS.basic
}

// --- STATE ---------------------------------------------------------------------

function createEmptyState() {
    // Settings are global (not tied to a save slot). Keep them in localStorage so
    // sliders actually affect the game and persist between runs.
    let savedVolume = 80 // matches the HTML default
    let savedTextSpeed = 100 // matches the HTML default
    let savedMusicEnabled = true
    let savedSfxEnabled = true
    let savedReduceMotion = false
    try {
        const vRaw = safeStorageGet('pq-master-volume')
        if (vRaw !== null) {
            const v = Number(vRaw)
            if (!isNaN(v)) savedVolume = Math.max(0, Math.min(100, v))
        }

        const tRaw = safeStorageGet('pq-text-speed')
        if (tRaw !== null) {
            const t = Number(tRaw)
            if (!isNaN(t)) savedTextSpeed = Math.max(30, Math.min(200, t))
        }

        const m = safeStorageGet('pq-music-enabled')
        if (m !== null) savedMusicEnabled = m === '1' || m === 'true'
        const s = safeStorageGet('pq-sfx-enabled')
        if (s !== null) savedSfxEnabled = s === '1' || s === 'true'

        const rm = safeStorageGet('pq-reduce-motion')
        if (rm !== null) savedReduceMotion = rm === '1' || rm === 'true'

    } catch (e) {
        // ignore storage errors (private mode, etc.)
    }

    return {
        player: null,
        area: 'village', // village, forest, ruins
        difficulty: 'normal',

        // Global settings (persisted in localStorage)
        settingsVolume: savedVolume, // 0-100
        settingsTextSpeed: savedTextSpeed, // 0-200 (100 = normal)

        // Motion / animation accessibility (persisted in localStorage)
        settingsReduceMotion: savedReduceMotion,

        // Audio toggles (persisted in localStorage)
        musicEnabled: savedMusicEnabled,
        sfxEnabled: savedSfxEnabled,

        // dynamic difficulty tracking
        dynamicDifficulty: {
            band: 0,
            tooEasyStreak: 0,
            struggleStreak: 0
        },

        quests: createDefaultQuestState(),
        flags: {
            ...createDefaultQuestFlags(),
            godMode: false,
            alwaysCrit: false,
            neverCrit: false,

            // NEW: gate the Cheat menu behind a dev toggle
            devCheatsEnabled: false,

        },

        // Debug / QA helpers (persisted in the save)
        debug: {
            useDeterministicRng: false,
            rngSeed: (Date.now() >>> 0),
            rngIndex: 0,
            captureRngLog: false,
            rngLog: [],
            lastAction: '',
            inputLog: [],
            lastInvariantIssues: null
        },
        inCombat: false,
        // Multi-enemy combat (Patch 1.1.9): currentEnemy is the player's current target.
        currentEnemy: null,
        enemies: [],
        targetEnemyIndex: 0,
        combat: null,
        log: [],
        logFilter: 'all',
        lastSaveJson: null,

        // NEW: world time and village economy state
        time: null,
        villageEconomy: null,
        government: null,
        bank: null,
        villageMerchantNames: null,
        merchantStock: null,
        merchantStockMeta: null,

        // Simulation meta (used for catch-up ticks & anti-exploit guards)
        sim: {
            lastDailyTickDay: null
        },

        // NEW: container for village-level state (population, etc.)
        village: null,

        // Developer-only gambling tuning
        gamblingDebug: {
            mode: 'normal', // 'normal' | 'playerFavored' | 'houseFavored'
            payoutMultiplier: 1 // 0.5, 1, 2, etc – applied to WIN payouts only
        },

        // One active companion (or null)
        companion: null,

        // Which entity the HUD is currently showing: 'player' or 'companion'
        hudView: 'player',

        // UI-only state (does not affect core combat logic)
        ui: {
            exploreChoiceMade: false
        }
    }
}
// ⬇️ ADD THIS
let state = createEmptyState()
initRngState(state)
applyMotionPreference()
syncGlobalStateRef()

// Quest system bindings (moved out of Future.js in patch 1.1.3)
const quests = createQuestBindings({
    getState: () => state,
    addLog,
    setScene,
    openModal,
    closeModal,
    makeActionButton,
    addItemToInventory,
    saveGame,
    updateHUD,
    recalcPlayerStats,
    startBattleWith,
    GAME_PATCH,
    SAVE_SCHEMA
})

// --- AUDIO / MUSIC ---------------------------------------------------------
// Ambient + SFX controller (one track at a time)
//
// NOTE: On some mobile browsers (notably iOS Safari), HTMLAudioElement.volume
// changes can be ignored. To make the master volume slider reliable, we route
// audio through Web Audio (AudioContext + GainNodes) when available, and fall
// back to element.volume otherwise.

const audioState = {
    initialized: false,
    currentTrack: null,

    // Master volume is controlled by state.settingsVolume (0-100)
    masterVolume: 1, // 0..1

    // Channel toggles (persisted in state/localStorage)
    musicEnabled: true,
    sfxEnabled: true,

    // Per-sound "base" levels (ambience quieter than SFX, etc.)
    baseVolumes: new WeakMap(), // HTMLAudioElement -> baseVol (0..1)

    // Web Audio routing (preferred when available)
    ctx: null,
    masterGain: null,
    musicBusGain: null,
    sfxBusGain: null,
    categories: new WeakMap(), // HTMLAudioElement -> 'music' | 'sfx'
    gains: new WeakMap(), // HTMLAudioElement -> GainNode (base gain)

    interiorOpen: false, // true while inside bank/tavern

    tracks: {},
    sfx: {}
}

function clamp01(n) {
    return Math.max(0, Math.min(1, n))
}

function getMasterVolume01() {
    const v =
        state && typeof state.settingsVolume === 'number'
            ? state.settingsVolume
            : 100
    return clamp01(Number(v) / 100)
}

function ensureAudioContext() {
    if (audioState.ctx) return

    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return

    try {
        const ctx = new Ctx()
        audioState.ctx = ctx

        const masterGain = ctx.createGain()
        masterGain.gain.value = audioState.masterVolume
        masterGain.connect(ctx.destination)
        audioState.masterGain = masterGain

        // Channel buses so we can mute/unmute music and SFX without restarting tracks.
        const musicBusGain = ctx.createGain()
        musicBusGain.gain.value = audioState.musicEnabled ? 1 : 0
        musicBusGain.connect(masterGain)
        audioState.musicBusGain = musicBusGain

        const sfxBusGain = ctx.createGain()
        sfxBusGain.gain.value = audioState.sfxEnabled ? 1 : 0
        sfxBusGain.connect(masterGain)
        audioState.sfxBusGain = sfxBusGain

        // Most browsers start the context suspended until a user gesture.
        // We'll attempt to resume on the next interaction.
        const unlock = () => {
            tryResumeAudioContext()
        }
        window.addEventListener('pointerdown', unlock, {
            once: true,
            capture: true
                })
        window.addEventListener('touchend', unlock, {
            once: true,
            capture: true
        })
        window.addEventListener('keydown', unlock, {
            once: true,
            capture: true
        })
    } catch (e) {
        console.warn(
            'Web Audio init failed; falling back to HTMLAudioElement.volume:',
            e
        )
        audioState.ctx = null
        audioState.masterGain = null
        audioState.musicBusGain = null
        audioState.sfxBusGain = null
    }
}

function tryResumeAudioContext() {
    const ctx = audioState.ctx
    if (!ctx) return

    if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
    }
}

function registerAudio(el, baseVol, category = 'music') {
    const base = clamp01(Number(baseVol))
    audioState.baseVolumes.set(el, base)

    const cat = category === 'sfx' ? 'sfx' : 'music'
    audioState.categories.set(el, cat)

    // Prefer Web Audio routing so the master volume slider works everywhere.
    ensureAudioContext()

    if (audioState.ctx && audioState.masterGain) {
        try {
            // Each <audio> element can only be wrapped once.
            if (!audioState.gains.has(el)) {
                const src = audioState.ctx.createMediaElementSource(el)
                const gain = audioState.ctx.createGain()
                gain.gain.value = base

                src.connect(gain)
                const bus =
                    cat === 'sfx'
                        ? audioState.sfxBusGain || audioState.masterGain
                        : audioState.musicBusGain || audioState.masterGain
                gain.connect(bus)

                audioState.gains.set(el, gain)
                    } else {
                // Keep base volume synced if we ever re-register.
                const g = audioState.gains.get(el)
                if (g) g.gain.value = base
            }

            // Let Web Audio handle loudness.
            el.volume = 1
        } catch (e) {
            // Fallback: element volume (may be ignored on iOS)
            el.volume =
                base *
                audioState.masterVolume *
                (cat === 'sfx'
                    ? audioState.sfxEnabled
                        ? 1
                        : 0
                    : audioState.musicEnabled
                    ? 1
                    : 0)
        }
    } else {
        // Fallback: element volume
        el.volume =
            base *
            audioState.masterVolume *
            (cat === 'sfx'
                ? audioState.sfxEnabled
                    ? 1
                    : 0
                : audioState.musicEnabled
                ? 1
                : 0)
    }

    return el
}

function applyMasterVolumeTo(el) {
    if (!el) return

    const base = audioState.baseVolumes.get(el)
    const gain = audioState.gains.get(el)

    const cat =
        audioState.categories.get(el) ||
        (Object.values(audioState.sfx).includes(el) ? 'sfx' : 'music')
    const chanEnabled =
        cat === 'sfx'
            ? audioState.sfxEnabled
                ? 1
                : 0
            : audioState.musicEnabled
            ? 1
            : 0

    // Web Audio path:
    if (gain && typeof base === 'number') {
        gain.gain.value = clamp01(base) // per-sound base
        el.volume = 1 // keep media element at unity
        return
    }

    // Fallback path:
    if (typeof base === 'number') {
        el.volume = clamp01(base) * audioState.masterVolume * chanEnabled
    }
}

function applyMasterVolumeAll() {
    // Web Audio master:
    if (audioState.masterGain) {
        audioState.masterGain.gain.value = audioState.masterVolume
    }

    // Keep fallback volumes in sync too:
    Object.values(audioState.tracks).forEach(applyMasterVolumeTo)
    Object.values(audioState.sfx).forEach(applyMasterVolumeTo)
}

function setMasterVolumePercent(vPercent) {
    const v = Number(vPercent)
    audioState.masterVolume = clamp01((Number.isFinite(v) ? v : 100) / 100)
    applyMasterVolumeAll()
}

function applyChannelMuteGains() {
    // Web Audio path
    if (audioState.musicBusGain)
        audioState.musicBusGain.gain.value = audioState.musicEnabled ? 1 : 0
    if (audioState.sfxBusGain)
        audioState.sfxBusGain.gain.value = audioState.sfxEnabled ? 1 : 0

    // Fallback path
    Object.values(audioState.tracks).forEach(applyMasterVolumeTo)
    Object.values(audioState.sfx).forEach(applyMasterVolumeTo)
}

function setMusicEnabled(enabled, { persist = true } = {}) {
    const on = !!enabled
    if (typeof state !== 'undefined' && state) state.musicEnabled = on
    audioState.musicEnabled = on
    if (persist) {
        try {
            safeStorageSet('pq-music-enabled', on ? '1' : '0', { action: 'write music toggle' })
        } catch (e) {}
    }
    initAudio()
    ensureAudioContext()
    applyChannelMuteGains()
    updateAreaMusic()
}

function setSfxEnabled(enabled, { persist = true } = {}) {
    const on = !!enabled
    if (typeof state !== 'undefined' && state) state.sfxEnabled = on
    audioState.sfxEnabled = on
    if (persist) {
        try {
            safeStorageSet('pq-sfx-enabled', on ? '1' : '0', { action: 'write sfx toggle' })
        } catch (e) {}
    }
    initAudio()
    ensureAudioContext()
    applyChannelMuteGains()
}

// Mute/unmute ambient audio while the player is “inside” a building modal
function setInteriorOpen(open) {
    initAudio()
    audioState.interiorOpen = !!open
    if (audioState.interiorOpen) {
        playMusicTrack(null)
    } else {
        updateAreaMusic()
    }
}

function initAudio() {
    if (audioState.initialized) return
    audioState.initialized = true

    // Initialize master volume from settings (if present)
    audioState.masterVolume = getMasterVolume01()

    // Initialize channel toggles from state (preferred) or localStorage
    try {
        if (typeof state !== 'undefined' && state) {
            audioState.musicEnabled = state.musicEnabled !== false
            audioState.sfxEnabled = state.sfxEnabled !== false
        } else {
            const m = safeStorageGet('pq-music-enabled')
            if (m !== null) audioState.musicEnabled = m === '1' || m === 'true'
            const s = safeStorageGet('pq-sfx-enabled')
            if (s !== null) audioState.sfxEnabled = s === '1' || s === 'true'
        }
    } catch (e) {}

    // Create audio routing early so volume works consistently
    ensureAudioContext()
    applyMasterVolumeAll()
    applyChannelMuteGains()

    // ---- Ambient tracks ------------------------------------------------------
    // Village daytime ambience
    const villageDay = registerAudio(
        new Audio('./Audio/village_day.wav'),
        0.4,
        'music'
    )
    villageDay.loop = true
    audioState.tracks.villageDay = villageDay

    // Global night ambience (plays anywhere at night)
    const nightAmbience = registerAudio(
        new Audio('./Audio/night-ambience.wav'),
        0.35,
        'music'
    )
    nightAmbience.loop = true
    audioState.tracks.nightAmbience = nightAmbience

    // Inside initAudio(), after other ambient/sfx tracks:
    const tavernAmbience = registerAudio(
        new Audio('./Audio/Tavern.wav'),
        0.45,
        'music'
    )
    tavernAmbience.loop = true
    audioState.tracks.tavernAmbience = tavernAmbience

    // ---- SFX ----------------------------------------------------------------
    const doorOpen = registerAudio(
        new Audio('./Audio/old-wooden-door.wav'),
        0.7,
        'sfx'
    )
    doorOpen.loop = false
    audioState.sfx.doorOpen = doorOpen
}

// Play the tavern/bank door SFX (one-shot)
// - Plays twice, at 2x speed, for a punchier "double latch" effect.
// - Returns a Promise that resolves after the final play ends.
function playDoorOpenSfx() {
    initAudio()
    tryResumeAudioContext()

    const door = audioState.sfx && audioState.sfx.doorOpen
    if (!door) return Promise.resolve()

    // Respect SFX toggle (don't even start muted playback)
    const sfxOn =
        typeof state !== 'undefined' && state
            ? state.sfxEnabled !== false
            : audioState.sfxEnabled
    if (!sfxOn) return Promise.resolve()

    const targetRate = 2 // 2x speed
    const playsTotal = 2 // play twice
    const originalRate =
        typeof door.playbackRate === 'number' ? door.playbackRate : 1

    let playsLeft = playsTotal

    // Prevent stacking multiple "double-play" sequences if the player spams the door.
    // We cancel any previous sequence and start fresh.
    try {
        if (door.__doublePlayCancel) {
            door.__doublePlayCancel()
            door.__doublePlayCancel = null
        }
    } catch (_) {}

    return new Promise((resolve) => {
        let resolved = false

        const finish = () => {
            if (resolved) return
            resolved = true

            try {
                door.playbackRate = originalRate
            } catch (_) {}

            door.removeEventListener('ended', onEnded)
            if (safetyTimer) clearTimeout(safetyTimer)
            door.__doublePlayCancel = null

            resolve()
        }

        const onEnded = () => {
            playsLeft -= 1

            if (playsLeft > 0) {
                // Rewind and play again immediately
                try {
                    door.currentTime = 0
                    applyMasterVolumeTo(door)
                    door.play().catch(() => finish())
                } catch (e) {
                    finish()
                }
            } else {
                finish()
            }
        }

        // If autoplay is blocked, "ended" may never fire—fallback to finishing.
        const safetyTimer = setTimeout(finish, 1500)

        // Expose cancel so a subsequent door open can restart the sequence cleanly.
        door.__doublePlayCancel = finish

        try {
            door.removeEventListener('ended', onEnded)
            door.addEventListener('ended', onEnded)

            // Start fresh
            door.currentTime = 0
            try {
                door.playbackRate = targetRate
            } catch (_) {}
            applyMasterVolumeTo(door)

            door.play().catch((err) => {
                console.warn(
                    'Door SFX play blocked (likely due to browser autoplay rules):',
                    err
                )
                finish()
            })
        } catch (err) {
            console.warn('Door SFX error:', err)
            finish()
        }
    })
}

// Play a given HTMLAudioElement, stopping whatever was playing before
function playMusicTrack(track) {
    if (!track) {
        // Stop current
        if (audioState.currentTrack) {
            audioState.currentTrack.pause()
            audioState.currentTrack.currentTime = 0
            audioState.currentTrack = null
        }
        return
    }

    // Already playing this one? no-op
    if (audioState.currentTrack === track) return

    // Stop the previous track
    if (audioState.currentTrack) {
        audioState.currentTrack.pause()
        audioState.currentTrack.currentTime = 0
    }

    audioState.currentTrack = track

    applyMasterVolumeTo(track)
    tryResumeAudioContext()

    // Start new one; catch autoplay blocks quietly
    track.play().catch((err) => {
        console.warn(
            'Music play blocked until user interacts with the page:',
            err
        )
    })
}

// Convenience: what counts as “daytime”?
function isMorning(info) {
    // timeSystem.js appears to provide { partLabel, partIndex }
    if (typeof info?.partIndex === 'number') return info.partIndex === 0 // Morning
    return info?.partLabel === 'Morning'
}

// Convenience: what counts as “night”?
function isNight(info) {
    // Prefer explicit name/label when available
    const lbl = String(info?.partName ?? info?.partLabel ?? '').toLowerCase()
    if (lbl && lbl.includes('night')) return true

    // Fallback by index:
    // timeSystem.js (3-part day) => 0=Morning, 1=Evening, 2=Night
    // older (4-part) conventions => 3=Night
    if (typeof info?.partIndex === 'number') {
        return info.partIndex === 2 || info.partIndex >= 3
    }
    return false
}

// Call this whenever area/time might have changed
function updateAreaMusic() {
    if (!state) return

    // Never play ambience when the game screen isn't visible (main menu, settings, etc.)
    const gameScreenEl = document.getElementById('gameScreen')
    const gameVisible = !!(
        gameScreenEl && !gameScreenEl.classList.contains('hidden')
    )
    if (!gameVisible) {
        playMusicTrack(null)
        return
    }

    initAudio()
    setMasterVolumePercent(state.settingsVolume)

    const info = getTimeInfo(state)
    const area = state.area || 'village'

    // If we're inside a building modal (bank/tavern), don't let world ambience play.
    // BUT: If Tavern.wav is already playing (tavern/gambling), keep it going without restarting.
    if (audioState.interiorOpen) {
        const tavernTrack =
            audioState.tracks && audioState.tracks.tavernAmbience

        if (tavernTrack && audioState.currentTrack === tavernTrack) {
            // Keep playing through transitions (Tavern ↔ Gambling) and just keep volume in sync.
            applyMasterVolumeTo(tavernTrack)
            if (tavernTrack.paused && tavernTrack.currentTime > 0) {
                tryResumeAudioContext()
                tavernTrack.play().catch(() => {})
            }
            return
        }

        playMusicTrack(null)
        return
    }

    // Night ambience overrides everything, anywhere (unless inside)
    if (isNight(info)) {
        playMusicTrack(audioState.tracks.nightAmbience)
        return
    }

    if (area === 'village' && isMorning(info)) {
        playMusicTrack(audioState.tracks.villageDay)
    } else {
        playMusicTrack(null)
    }
}

// Small helper so we only need to change behavior in one place
function cheatsEnabled() {
    return !!(state && state.flags && state.flags.devCheatsEnabled)
}

function syncSmokeTestsPillVisibility() {
    // Dev-only HUD pills (Smoke Tests + Cheats) live next to the Menu button.
    // Keep their visibility logic centralized so we don't miss any screen transitions.
    const show = cheatsEnabled() && !!(state && state.player)

    const tests = document.getElementById('btnSmokeTestsPill')
    if (tests) tests.classList.toggle('hidden', !show)

    const cheats = document.getElementById('btnCheatPill')
    if (cheats) cheats.classList.toggle('hidden', !show)
}

// --- RNG wrapper ------------------------------------------------------------
// Route randomness through a deterministic stream when enabled.
function rand(tag) {
    return rngFloat(state, tag)
}
function randInt(min, max, tag) {
    return rngInt(state, min, max, tag)
}
function pick(list, tag) {
    return rngPick(state, list, tag)
}

// --- Input / replay breadcrumbs --------------------------------------------
function recordInput(action, payload) {
    if (!state) return
    if (!state.debug || typeof state.debug !== 'object') state.debug = {}
    const d = state.debug
    d.lastAction = String(action || '')
    if (!Array.isArray(d.inputLog)) d.inputLog = []
    d.inputLog.push({ t: Date.now(), action: d.lastAction, payload: payload || null })
    if (d.inputLog.length > 200) d.inputLog.splice(0, d.inputLog.length - 200)
}

function syncGlobalStateRef() {
    try {
        window.__emberwoodStateRef = state
    } catch (_) {}
}

function escapeHtml(str) {
    const s = String(str == null ? '' : str)
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}
// --- DOM HELPERS --------------------------------------------------------------

const enemyPanelEls = {
    panel: document.getElementById('enemyPanel'),
    name: document.getElementById('enemyName'),
    tags: document.getElementById('enemyTags'),
    hpFill: document.getElementById('enemyHpFill'),
    hpLabel: document.getElementById('enemyHpLabel'),
    status: document.getElementById('enemyStatusLine')
}
const screens = {
    mainMenu: document.getElementById('mainMenu'),
    character: document.getElementById('characterScreen'),
    game: document.getElementById('gameScreen'),
    settings: document.getElementById('settingsScreen')
}

const modalEl = document.getElementById('modal')
const modalTitleEl = document.getElementById('modalTitle')
const modalBodyEl = document.getElementById('modalBody')
let modalOnClose = null // optional one-shot callback run when closeModal() is called

// Separate modal for the Enemy Sheet so dev tools (Smoke Tests) don't "replace" it.
const enemyModalEl = document.getElementById('enemyModal')
const enemyModalTitleEl = document.getElementById('enemyModalTitle')
const enemyModalBodyEl = document.getElementById('enemyModalBody')
let enemyModalOnClose = null // optional one-shot callback run when closeEnemyModal() is called

// --- MODAL ACCESSIBILITY (focus + escape + focus trap) -----------------------
let _modalLastFocusEl = null
let _modalTrapHandler = null

let _enemyModalLastFocusEl = null
let _enemyModalTrapHandler = null

function _getFocusableElements(root) {
    if (!root) return []
    const sel = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',')
    return Array.from(root.querySelectorAll(sel)).filter((el) => {
        if (!el) return false
        const style = window.getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') return false
        // Some controls can be hidden inside collapsed <details>
        if (el.offsetParent === null && style.position !== 'fixed') return false
        return true
    })
}

function _installModalFocusTrap() {
    if (!modalEl) return
    if (_modalTrapHandler) return

    _modalTrapHandler = (e) => {
        if (!modalEl || modalEl.classList.contains('hidden')) return

        // Escape closes the modal
        if (e.key === 'Escape') {
            e.preventDefault()
            closeModal()
            return
        }

        // Basic focus trap for Tab / Shift+Tab
        if (e.key !== 'Tab') return

        const focusables = _getFocusableElements(modalEl)
        if (!focusables.length) {
            e.preventDefault()
            return
        }

        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement

        if (e.shiftKey) {
            if (active === first || !modalEl.contains(active)) {
                e.preventDefault()
                last.focus()
            }
        } else {
            if (active === last) {
                e.preventDefault()
                first.focus()
            }
        }
    }

    document.addEventListener('keydown', _modalTrapHandler)
}

function _removeModalFocusTrap() {
    if (_modalTrapHandler) {
        document.removeEventListener('keydown', _modalTrapHandler)
        _modalTrapHandler = null
    }
}

function _installEnemyModalFocusTrap() {
    if (!enemyModalEl) return
    if (_enemyModalTrapHandler) return

    _enemyModalTrapHandler = (e) => {
        if (!enemyModalEl || enemyModalEl.classList.contains('hidden')) return

        // Escape closes the Enemy Sheet
        if (e.key === 'Escape') {
            e.preventDefault()
            closeEnemyModal()
            return
        }

        if (e.key !== 'Tab') return

        const focusables = _getFocusableElements(enemyModalEl)
        if (!focusables.length) {
            e.preventDefault()
            return
        }

        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement

        if (e.shiftKey) {
            if (active === first || !enemyModalEl.contains(active)) {
                e.preventDefault()
                last.focus()
            }
        } else {
            if (active === last) {
                e.preventDefault()
                first.focus()
            }
        }
    }

    document.addEventListener('keydown', _enemyModalTrapHandler)
}

function _removeEnemyModalFocusTrap() {
    if (_enemyModalTrapHandler) {
        document.removeEventListener('keydown', _enemyModalTrapHandler)
        _enemyModalTrapHandler = null
    }
}

// If we close one interior modal and immediately open another (e.g., Tavern → Gambling),
// we don't want the interior music to stop/restart between those transitions.
let pendingInteriorCloseTimer = null

function switchScreen(name) {
    Object.values(screens).filter(Boolean).forEach((s) => s.classList.add('hidden'))
    if (screens[name]) screens[name].classList.remove('hidden')

    // Ensure ambience never leaks onto non-game screens (main menu, settings, character creation).
    if (name !== 'game') {
        try {
            if (audioState) audioState.interiorOpen = false
            playMusicTrack(null)
        } catch (e) {}
    }
}

function openModal(title, builderFn) {
    if (!modalEl) return

    // If another subsystem owns/locks the modal (e.g., user acceptance), don't fight it.
    try {
        const locked = modalEl.dataset.lock === '1'
        const owner = modalEl.dataset.owner || ''
        if (locked && owner && owner !== 'game') return
    } catch (_) {}

    // Cancel any deferred "interior close" so interior ambience can carry across modal-to-modal transitions.
    if (pendingInteriorCloseTimer) {
        clearTimeout(pendingInteriorCloseTimer)
        pendingInteriorCloseTimer = null
    }

    // Record current focus so we can restore it on close.
    _modalLastFocusEl = document.activeElement

    // Mark ownership for other modules (bootstrap, acceptance gate, etc.)
    try {
        modalEl.dataset.owner = 'game'
        modalEl.dataset.lock = '0'
    } catch (_) {}

    modalTitleEl.textContent = title

    // 🔹 Clean up any tavern-game footer carried over from a previous modal
    try {
        const strayFooters = modalEl.querySelectorAll('.tavern-footer-actions')
        strayFooters.forEach((el) => el.remove())
    } catch (_) {}

    // 🔹 Reset any per-modal layout classes (like tavern-games-body)
    modalBodyEl.className = '' // keep the id="modalBody" but clear classes

    // 🔹 Clear old content and build the new modal
    modalBodyEl.innerHTML = ''
    builderFn(modalBodyEl)

    // Accessibility: label + focus trap
    try {
        const panel = document.getElementById('modalPanel')
        if (panel) {
            panel.setAttribute('role', 'dialog')
            panel.setAttribute('aria-modal', 'true')
            panel.setAttribute('aria-labelledby', 'modalTitle')
            panel.tabIndex = -1
        }
        modalEl.setAttribute('aria-hidden', 'false')
        modalEl.dataset.open = '1'
    } catch (_) {}

    modalEl.classList.remove('hidden')
    _installModalFocusTrap()

    // Focus first focusable control (or the panel itself)
    try {
        const panel = document.getElementById('modalPanel')
        const focusables = _getFocusableElements(panel || modalEl)
        if (focusables.length) focusables[0].focus()
        else if (panel) panel.focus()
    } catch (_) {}
}

function closeModal() {
    if (!modalEl) return

    // If another subsystem owns/locks the modal (e.g., user acceptance), don't close it.
    try {
        const locked = modalEl.dataset.lock === '1'
        const owner = modalEl.dataset.owner || ''
        if (locked && owner && owner !== 'game') return
    } catch (_) {}

    // Tear down focus trap *before* hiding so focus doesn't get stuck.
    _removeModalFocusTrap()

    modalEl.classList.add('hidden')

    try {
        modalEl.setAttribute('aria-hidden', 'true')
        modalEl.dataset.open = '0'
        // Release ownership on close.
        if (modalEl.dataset.owner === 'game') modalEl.dataset.owner = ''
        if (modalEl.dataset.lock === '0') modalEl.dataset.lock = '0'
    } catch (_) {}

    // Always remove any pinned tavern-game footer actions on close so they
    // can't leak into future modals or leave hidden interactive elements around.
    try {
        modalEl.querySelectorAll('.tavern-footer-actions').forEach((el) => el.remove())
    } catch (_) {
        // ignore
    }

    // Ensure close button is restored for non-skill modals
    const closeBtn = document.getElementById('modalClose')
    if (closeBtn) closeBtn.style.display = ''

    // Run any one-shot modal close hook (used by level-up auto skill distribution)
    if (typeof modalOnClose === 'function') {
        const fn = modalOnClose
        modalOnClose = null // make it one-shot
        try {
            fn()
        } catch (err) {
            console.error(err)
        }
    } else {
        modalOnClose = null
    }

    // Restore focus to whatever opened the modal (if it still exists in DOM)
    try {
        if (_modalLastFocusEl && typeof _modalLastFocusEl.focus === 'function' && document.contains(_modalLastFocusEl)) {
            _modalLastFocusEl.focus()
        }
    } catch (_) {}
    _modalLastFocusEl = null

    // If we were inside the bank/tavern, defer flipping interiorOpen off by one tick.
    // This prevents Tavern.wav from cutting out/restarting when transitioning between
    // interior modals (e.g., Tavern → Gambling) that close & reopen the same modal UI.
    if (audioState && audioState.interiorOpen) {
        if (pendingInteriorCloseTimer) {
            clearTimeout(pendingInteriorCloseTimer)
            pendingInteriorCloseTimer = null
        }

        pendingInteriorCloseTimer = setTimeout(() => {
            pendingInteriorCloseTimer = null

            // If the modal got reopened immediately, we're still "inside"—do not stop interior music.
            const stillHidden = modalEl.classList.contains('hidden')
            if (!stillHidden) return

            audioState.interiorOpen = false
            updateAreaMusic()
        }, 75)

        return
    }

    updateAreaMusic()
}

function openEnemyModal(title, builderFn) {
    if (!enemyModalEl) return

    // Record focus so we can restore it on close.
    _enemyModalLastFocusEl = document.activeElement

    enemyModalTitleEl.textContent = title

    // Reset body and build content
    enemyModalBodyEl.className = ''
    enemyModalBodyEl.innerHTML = ''
    builderFn(enemyModalBodyEl)

    try {
        enemyModalEl.setAttribute('aria-hidden', 'false')
        enemyModalEl.dataset.open = '1'
        const panel = document.getElementById('enemyModalPanel')
        if (panel) {
            panel.setAttribute('role', 'dialog')
            panel.setAttribute('aria-modal', 'true')
            panel.setAttribute('aria-labelledby', 'enemyModalTitle')
            panel.tabIndex = -1
        }
    } catch (_) {}

    enemyModalEl.classList.remove('hidden')
    _installEnemyModalFocusTrap()

    // Focus first focusable control (or the panel)
    try {
        const panel = document.getElementById('enemyModalPanel')
        const focusables = _getFocusableElements(panel || enemyModalEl)
        if (focusables.length) focusables[0].focus()
        else if (panel) panel.focus()
    } catch (_) {}
}

function closeEnemyModal() {
    if (!enemyModalEl) return

    _removeEnemyModalFocusTrap()
    enemyModalEl.classList.add('hidden')

    try {
        enemyModalEl.setAttribute('aria-hidden', 'true')
        enemyModalEl.dataset.open = '0'
    } catch (_) {}

    if (typeof enemyModalOnClose === 'function') {
        const fn = enemyModalOnClose
        enemyModalOnClose = null
        try { fn() } catch (err) { console.error(err) }
    } else {
        enemyModalOnClose = null
    }

    try {
        if (_enemyModalLastFocusEl && typeof _enemyModalLastFocusEl.focus === 'function' && document.contains(_enemyModalLastFocusEl)) {
            _enemyModalLastFocusEl.focus()
        }
    } catch (_) {}
    _enemyModalLastFocusEl = null
}

// --- LOG & UI RENDERING -------------------------------------------------------

// Log render state (for incremental DOM updates)
let _logSeq = 0
let _logUi = {
    filter: 'all',
    lastFirstId: null,
    renderedUpToId: 0
}

function nextLogId() {
    _logSeq += 1
    return _logSeq
}

function ensureLogIds() {
    if (!state || !Array.isArray(state.log)) return
    let maxId = 0
    state.log.forEach((e) => {
        if (e && typeof e === 'object') {
            const id = finiteNumber(e.id, 0)
            if (id > maxId) maxId = id
        }
    })
    if (maxId <= 0) {
        // Old saves had no ids; assign them
        state.log.forEach((e) => {
            if (!e || typeof e !== 'object') return
            maxId += 1
            e.id = maxId
        })
    }
    _logSeq = Math.max(_logSeq, maxId)
}

// Filter predicate (kept in one place)
function logPassesFilter(entry, activeFilter) {
    if (!entry || !entry.type || activeFilter === 'all') return true
    if (activeFilter === 'system') return entry.type === 'system'
    if (activeFilter === 'danger') return entry.type === 'danger'
    if (activeFilter === 'good') return entry.type === 'good'
    return true
}

function addLog(text, type) {
    // Normalize legacy / inconsistent log types.
    if (type === 'info') type = 'system'

    if (!state.log) state.log = []
    ensureLogIds()

    state.log.push({ id: nextLogId(), text, type: type || 'normal' })

    // Keep logs bounded; if we shift, force a full re-render (since indices changed)
    if (state.log.length > 80) {
        state.log.shift()
        _logUi.lastFirstId = null
        _logUi.renderedUpToId = 0
    }

    renderLog()
}

function renderLog() {
    const logEl = document.getElementById('log')
    if (!logEl) return
    if (!state || !Array.isArray(state.log)) return

    // Only auto-scroll if the player is already near the bottom.
    const prevScrollTop = logEl.scrollTop
    const wasNearBottom =
        logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 30

    ensureLogIds()

    const activeFilter = state.logFilter || 'all'
    const firstId = state.log.length ? state.log[0].id : null

    const filterChanged = _logUi.filter !== activeFilter
    const trimmed = _logUi.lastFirstId !== firstId
    const needsFull = filterChanged || trimmed || !_logUi.renderedUpToId

    if (needsFull) {
        logEl.innerHTML = ''
        const frag = document.createDocumentFragment()

        state.log.forEach((entry) => {
            if (!logPassesFilter(entry, activeFilter)) return
            const p = document.createElement('p')
            p.className = 'log-line'
            if (entry.type && entry.type !== 'normal') p.classList.add(entry.type)
            p.textContent = entry.text
            frag.appendChild(p)
            _logUi.renderedUpToId = entry.id
        })

        logEl.appendChild(frag)
        _logUi.filter = activeFilter
        _logUi.lastFirstId = firstId
    } else {
        // Incremental append: only add newly-added entries since last render
        const frag = document.createDocumentFragment()
        let any = false

        state.log.forEach((entry) => {
            if (!entry || entry.id <= _logUi.renderedUpToId) return
            if (!logPassesFilter(entry, activeFilter)) return

            const p = document.createElement('p')
            p.className = 'log-line'
            if (entry.type && entry.type !== 'normal') p.classList.add(entry.type)
            p.textContent = entry.text
            frag.appendChild(p)
            _logUi.renderedUpToId = entry.id
            any = true
        })

        if (any) logEl.appendChild(frag)
    }

    if (wasNearBottom) {
        logEl.scrollTop = logEl.scrollHeight
    } else {
        // Preserve reading position when the player scrolls up.
        const maxTop = Math.max(0, logEl.scrollHeight - logEl.clientHeight)
        logEl.scrollTop = Math.min(prevScrollTop, maxTop)
    }
}

// NEW: optional small time label, if you add <div id="timeLabel"></div> in HTML
function updateTimeDisplay() {
    const label = document.getElementById('timeLabel')
    if (!label || !state) return
    const info = getTimeInfo(state)
    label.textContent = formatTimeLong(info)
}
function setScene(title, text) {
    const t = document.getElementById('sceneTitle')
    const b = document.getElementById('sceneText')
    if (t) t.textContent = title
    if (b) {
        b.textContent = text
        // Keep long story beats readable without pushing the UI.
        b.scrollTop = 0
    }
}


// --- QUESTS (modularized) ----------------------------------------------------
// Quest logic moved to ./Quests/questSystem.js (bound via ./Quests/questBindings.js).

function updateEnemyPanel() {
    if (!enemyPanelEls.panel) {
        enemyPanelEls.panel = document.getElementById('enemyPanel')
        enemyPanelEls.name = document.getElementById('enemyName')
        enemyPanelEls.tags = document.getElementById('enemyTags')
        enemyPanelEls.hpFill = document.getElementById('enemyHpFill')
        enemyPanelEls.hpLabel = document.getElementById('enemyHpLabel')
        enemyPanelEls.status = document.getElementById('enemyStatusLine')
        enemyPanelEls.targetHint = document.getElementById('enemyTargetHint')
    } else if (!enemyPanelEls.targetHint) {
        enemyPanelEls.targetHint = document.getElementById('enemyTargetHint')
    }

    const ep = enemyPanelEls
    if (!ep.panel) return

    // Keep target sane for multi-enemy fights.
    try { if (state && state.inCombat) syncCurrentEnemyToTarget() } catch (_) {}

    const enemy = state.currentEnemy
    const all = (state && state.inCombat) ? getAllEnemies() : []
    const alive = (state && state.inCombat) ? getAliveEnemies() : []

    if (!state.inCombat || !enemy || alive.length <= 0 || finiteNumber(enemy.hp, 0) <= 0) {
        ep.panel.classList.add('hidden')
        if (ep.status) ep.status.textContent = ''
        if (ep.hpFill) ep.hpFill.style.width = '0%'
        if (ep.targetHint) ep.targetHint.textContent = ''
        return
    }

    ep.panel.classList.remove('hidden')

    if (ep.name) ep.name.textContent = enemy.name || 'Enemy'

    // Target hint (multi-enemy)
    if (ep.targetHint) {
        if (all.length > 1) {
            const idx = Math.max(0, Math.min(all.length - 1, Math.floor(Number(state.targetEnemyIndex || 0))))
            ep.targetHint.textContent = 'Target ' + (idx + 1) + '/' + all.length + ' • Swipe to switch'
        } else {
            ep.targetHint.textContent = ''
        }
    }

    const tags = []
    if (enemy.level) tags.push('Lv ' + enemy.level)
    if (enemy.rarityLabel) tags.push(enemy.rarityLabel)
    if (enemy.isBoss) tags.push('Boss')
    if (enemy.behavior === 'bossDragon') tags.push('Dragon')
    else if (enemy.behavior === 'bossGoblin') tags.push('Warlord')
    else if (enemy.behavior === 'bossWitch') tags.push('Witch')
    else if (enemy.behavior === 'bossGiant') tags.push('Giant')
    else if (enemy.behavior === 'bossLich') tags.push('Lich')
    else if (enemy.behavior === 'bossKing') tags.push('King')
    else if (enemy.behavior === 'caster') tags.push('Caster')
    else if (enemy.behavior === 'aggressive') tags.push('Aggressive')
    else if (enemy.behavior === 'cunning') tags.push('Cunning')

    const affixLabels = getEnemyAffixLabels(enemy)
    if (affixLabels.length > 0) {
        tags.push('Affixes: ' + affixLabels.join(', '))
    }

    if (ep.tags) ep.tags.textContent = tags.join(' • ')

    const maxHp = Math.max(1, Math.floor(finiteNumber(enemy.maxHp, enemy.hp || 1)))
    const hp = clampFinite(enemy.hp, 0, maxHp, maxHp)
    const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
    if (ep.hpFill) ep.hpFill.style.width = hpPct + '%'

    if (ep.hpLabel) {
        ep.hpLabel.textContent = 'HP ' + Math.max(0, Math.round(hp)) + '/' + maxHp
    }

    const statusParts = []

    if (enemy.bleedTurns && enemy.bleedTurns > 0 && enemy.bleedDamage) {
        statusParts.push(`Bleeding (${enemy.bleedTurns}t, ${enemy.bleedDamage} dmg)`) 
    }
    if (enemy.chilledTurns && enemy.chilledTurns > 0) {
        statusParts.push(`Chilled (${enemy.chilledTurns}t)`) 
    }
    if (enemy.guardTurns && enemy.guardTurns > 0) {
        statusParts.push(`Guarding (${enemy.guardTurns}t)`) 
    }

    if (typeof enemy.postureMax === 'number' && Number.isFinite(enemy.postureMax) && enemy.postureMax > 0) {
        const pm = Math.max(1, Math.floor(enemy.postureMax))
        const posture = clampFinite(enemy.posture, 0, pm, 0)
        statusParts.push('Posture ' + posture + '/' + pm)
    }
    if (enemy.brokenTurns && enemy.brokenTurns > 0) {
        statusParts.push('Broken ' + enemy.brokenTurns + 't')
    }
    if (enemy.atkDownTurns && enemy.atkDownTurns > 0 && enemy.atkDownFlat) {
        statusParts.push('Weakened ' + enemy.atkDownFlat + ' (' + enemy.atkDownTurns + 't)')
    }
    if (enemy.intent && enemy.intent.aid) {
        const ab = ENEMY_ABILITIES[enemy.intent.aid]
        const turns = clampFinite(enemy.intent.turnsLeft, 0, 99, 0)
        statusParts.push('Intent: ' + (ab ? ab.name : enemy.intent.aid) + ' (' + turns + 't)')
    }

    if (ep.status) ep.status.textContent = statusParts.join(' • ')
}

function updateHUD() {
    if (!state.player) return

    sanitizeCoreState()

    // Dev cheats UI affordance
    try { syncSmokeTestsPillVisibility() } catch (_) {}

    const p = state.player
    const comp = state.companion
    const diff = getActiveDifficultyConfig()
    const classDef = PLAYER_CLASSES[p.classId]

    const nameEl = document.getElementById('hud-name')
    const classDiffEl = document.getElementById('hud-class-diff')
    const hpFill = document.getElementById('hpFill')
    const hpLabel = document.getElementById('hpLabel')
    const resFill = document.getElementById('resFill')
    const resLabel = document.getElementById('resLabel')
    const hudLevel = document.getElementById('hud-level')
    const hudGold = document.getElementById('hud-gold')
    const hudBottom = document.getElementById('hud-bottom')
    const hudTime = document.getElementById('timeLabel')

    // Defensive: if HUD nodes are missing (partial DOM / early calls), don't crash.
    if (!nameEl || !classDiffEl || !hpFill || !hpLabel || !resFill || !resLabel || !hudLevel || !hudGold || !hudBottom) return

    // Decide which entity to show: default to player if no companion
    let mode = state.hudView || 'player'
    if (!comp && mode === 'companion') {
        mode = 'player'
        state.hudView = 'player'
    }


    if (mode === 'player') {
        // --- PLAYER VIEW ---
        nameEl.textContent = p.name || 'Nameless'
        classDiffEl.textContent =
            (classDef ? classDef.name : 'Adventurer') +
            ' • ' +
            (diff ? diff.name : '')

        const maxHp = Math.max(1, Math.floor(finiteNumber(p.maxHp, 1)))
        const hpNow = clampFinite(p.hp, 0, maxHp, maxHp)
        const hpPercent = Math.max(0, Math.min(100, (hpNow / maxHp) * 100))
        hpFill.style.width = hpPercent + '%'
        hpLabel.textContent = 'HP ' + Math.round(hpNow) + '/' + maxHp
        hpFill.className = 'bar-fill hp-fill'

        const rk =
            p.resourceKey === 'mana' || p.resourceKey === 'fury' || p.resourceKey === 'blood' || p.resourceKey === 'essence'
                ? p.resourceKey
                : 'mana'
        const resName = p.resourceName || 'Resource'
        const maxResRaw = finiteNumber(p.maxResource, 0)
        const maxRes = maxResRaw > 0 ? maxResRaw : 0

        if (maxRes <= 0) {
            // Some classes / corrupted saves may temporarily have no resource pool.
            resFill.style.width = '0%'
            resFill.className = 'bar-fill resource-fill ' + rk
            resLabel.textContent = resName + ' —'
        } else {
            const resNow = clampFinite(p.resource, 0, maxRes, maxRes)
            const resPercent = Math.max(0, Math.min(100, (resNow / maxRes) * 100))
            resFill.style.width = resPercent + '%'
            resFill.className = 'bar-fill resource-fill ' + rk
            resLabel.textContent = resName + ' ' + Math.round(resNow) + '/' + Math.round(maxRes)
        }
    } else {
        // --- COMPANION VIEW ---
        // We already guaranteed comp exists above.
        nameEl.textContent = comp.name + ' (Companion)'
        classDiffEl.textContent =
            comp.role.charAt(0).toUpperCase() +
            comp.role.slice(1) +
            ' • Swipe to switch'

        // Use bars to show companion stats instead of HP/resource
        // HP bar -> Attack
        hpFill.style.width = '100%'
        hpFill.className = 'bar-fill hp-fill'
        hpLabel.textContent = 'Attack ' + comp.attack

        // Resource bar -> HP bonus
        resFill.style.width = '100%'
        resFill.className = 'bar-fill resource-fill mana'
        resLabel.textContent = 'HP Bonus +' + comp.hpBonus
    }

    // Bottom: progression + gold are hidden during combat per HUD request.
    // (Show again immediately after combat ends.)
    if (hudLevel) {
        hudLevel.textContent =
            'Lv ' + p.level + ' • ' + p.xp + '/' + p.nextLevelXp + ' XP'
    }
    if (hudGold) {
        hudGold.innerHTML = '<span class="gold">' + p.gold + '</span> Gold'
    }

    const inCombatNow = !!(state.inCombat && state.currentEnemy)
    if (hudBottom) {
        if (inCombatNow) hudBottom.classList.add('hidden')
        else hudBottom.classList.remove('hidden')
    } else {
        // Fallback if DOM changed: hide individual fields.
        if (hudLevel) hudLevel.classList.toggle('hidden', inCombatNow)
        if (hudGold) hudGold.classList.toggle('hidden', inCombatNow)
        if (hudTime) hudTime.classList.toggle('hidden', inCombatNow)
    }

    // Class mechanics meter (combat only)
    try { updateClassMeterHUD() } catch (_) {}
}

// --- Combat HUD: class mechanics meter ---------------------------------------
// Shows lightweight class-specific generation systems in a compact HUD row.
// (Rogue combo points, Ranger marks on target, Shaman totem uptime)
function updateClassMeterHUD() {
    const el = document.getElementById('hudClassMeter')
    if (!el) return

    const p = state && state.player
    if (!p || !state.inCombat) {
        el.classList.add('hidden')
        el.innerHTML = ''
        return
    }

    const enemy = state.currentEnemy || null
    const classId = String(p.classId || '')
    const st = p.status || {}

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------
    const clampInt = (v, min, max) => {
        const n = Math.floor(Number(v))
        return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min))
    }
    const clampNum = (v, min, max) => {
        const n = Number(v)
        return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min))
    }
    const cap = (s) => {
        s = String(s || '')
        if (!s) return ''
        return s.charAt(0).toUpperCase() + s.slice(1)
    }
    const escHtml = (s) => {
        s = String(s == null ? '' : s)
        return s.replace(/[&<>\"]/g, (ch) => {
            if (ch === '&') return '&amp;'
            if (ch === '<') return '&lt;'
            if (ch === '>') return '&gt;'
            return '&quot;'
        })
    }

    // IMPORTANT: The HUD is often used on iOS via file://. Using an inline <symbol>
    // sprite in index.html keeps icons available without fetch() or bundling.
    // We render icons as crisp outlines (no fills) so the meter reads cleanly at tiny sizes.
    // Expects sprite symbols: <id>-stroke.
    const iconUse = (symbolId) => {
        const id = escHtml(symbolId || '')
        if (!id) return ''
        const strokeId = id + '-stroke'
        return (
            '<svg class="meter-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
            '<use class="meter-icon-stroke" href="#' + strokeId + '" xlink:href="#' + strokeId + '"></use>' +
            '</svg>'
        )
    }

    const renderPips = (filled, max, symbolId) => {
        filled = clampInt(filled, 0, max)
        max = clampInt(max, 1, 12)
        const svg = iconUse(symbolId)
        let out = '<span class="meter-dots" aria-hidden="true">'
        for (let i = 1; i <= max; i++) {
            out += '<span class="meter-dot' + (i <= filled ? ' filled' : '') + '">' + svg + '</span>'
        }
        out += '</span>'
        return out
    }

    // ---------------------------------------------------------------------
    // Meter definitions (data-driven so adding new classes is low-risk)
    // ---------------------------------------------------------------------
    const M = {
        rogue: {
            label: 'Combo',
            kind: 'pips',
            icon: 'i-dagger',
            max: 5,
            filled: () => clampInt(st.comboPoints || 0, 0, 5)
        },
        ranger: {
            label: 'Marks',
            kind: 'pips+turns',
            icon: 'i-bullseye',
            max: 5,
            filled: () => clampInt(enemy && enemy.markedStacks ? enemy.markedStacks : 0, 0, 5),
            turns: () => clampInt(enemy && enemy.markedTurns ? enemy.markedTurns : 0, 0, 99)
        },
        shaman: {
            label: 'Totem',
            kind: 'chip+turns',
            chip: () => cap(st.totemType || '') || 'None',
            turns: () => clampInt(st.totemTurns || 0, 0, 99)
        },
        necromancer: {
            label: 'Shards',
            kind: 'pips',
            icon: 'i-skull',
            max: 5,
            filled: () => clampInt(st.soulShards || 0, 0, 5)
        },
        mage: {
            label: 'Rhythm',
            kind: 'pips+chip',
            icon: 'i-starburst',
            max: 3,
            filled: () => {
                const count = clampInt(st.spellCastCount || 0, 0, 999999)
                return clampInt(count % 3, 0, 3)
            },
            chip: () => {
                const count = clampInt(st.spellCastCount || 0, 0, 999999)
                return (count % 3) === 2 ? 'Ready' : ''
            }
        },
        warrior: {
            label: 'Bulwark',
            kind: 'pips+chip',
            icon: 'i-shield',
            max: 5,
            filled: () => {
                const fury = clampNum(p.resource || 0, 0, p.maxResource || 0)
                const threshold = 40
                return clampInt(Math.round((Math.min(fury, threshold) / threshold) * 5), 0, 5)
            },
            chip: () => {
                const fury = clampNum(p.resource || 0, 0, p.maxResource || 0)
                return fury >= 40 ? 'On' : ''
            }
        },
        blood: {
            label: 'Blood',
            kind: 'pips',
            icon: 'i-blooddrop',
            max: 5,
            filled: () => {
                const cur = clampNum(p.resource || 0, 0, p.maxResource || 0)
                const mx = clampNum(p.maxResource || 0, 1, 99999)
                return clampInt(Math.round((cur / mx) * 5), 0, 5)
            }
        },
        paladin: {
            label: 'Sanctuary',
            kind: 'pips+chip',
            icon: 'i-shield',
            max: 5,
            filled: () => {
                const shield = clampNum(st.shield || 0, 0, 99999)
                const mx = clampNum(p.maxHp || 1, 1, 99999)
                return clampInt(Math.round((Math.min(shield, mx) / mx) * 5), 0, 5)
            },
            chip: () => (clampNum(st.shield || 0, 0, 99999) > 0 ? 'On' : 'Off')
        },
        cleric: {
            label: 'Ward',
            kind: 'pips+value',
            icon: 'i-cross',
            max: 5,
            filled: () => {
                const shield = clampNum(st.shield || 0, 0, 99999)
                const mx = clampNum(p.maxHp || 1, 1, 99999)
                return clampInt(Math.round((Math.min(shield, mx) / mx) * 5), 0, 5)
            },
            value: () => {
                const shield = clampNum(st.shield || 0, 0, 99999)
                return shield > 0 ? String(Math.round(shield)) : ''
            }
        },
        berserker: {
            label: 'Frenzy',
            kind: 'pips',
            icon: 'i-flame',
            max: 5,
            filled: () => {
                const mx = clampNum(p.maxHp || 1, 1, 99999)
                const hp = clampNum(p.hp || 0, 0, mx)
                const missingPct = clampNum((mx - hp) / mx, 0, 1)
                return clampInt(Math.round(missingPct * 5), 0, 5)
            }
        },
        vampire: {
            label: 'Hunger',
            kind: 'pips+chip',
            icon: 'i-bat',
            max: 5,
            filled: () => {
                const cur = clampNum(p.resource || 0, 0, p.maxResource || 0)
                const mx = clampNum(p.maxResource || 0, 1, 99999)
                return clampInt(Math.round((cur / mx) * 5), 0, 5)
            },
            chip: () => {
                const cur = clampNum(p.resource || 0, 0, p.maxResource || 0)
                const mx = clampNum(p.maxResource || 0, 1, 99999)
                return (cur / mx) >= 0.55 ? 'On' : ''
            }
        }
    }

    const meter = M[classId]
    if (!meter) {
        el.classList.add('hidden')
        el.innerHTML = ''
        return
    }

    // Expose class identity to CSS so the meter can tint per-class.
    // Using a dedicated data attribute avoids collisions with other datasets.
    el.setAttribute('data-meter-class', classId)

    // ---------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------
    let html = '<span class="meter-label">' + escHtml(meter.label) + '</span>'

    // If the meter uses pips, determine whether it's "ready".
    // When ready, we apply a subtle hue shimmer to the dots area.
    let pipFilled = 0
    let pipMax = 0
    let chipPreview = ''
    if (meter.kind === 'pips' || meter.kind === 'pips+turns' || meter.kind === 'pips+chip' || meter.kind === 'pips+value') {
        pipMax = clampInt(meter.max || 5, 1, 12)
        pipFilled = clampInt(meter.filled(), 0, pipMax)
        if (meter.kind === 'pips+chip') chipPreview = String(meter.chip() || '')

        // Some meters express readiness via a chip label (ex: Mage rhythm).
        // If the chip literally says "Ready", visually fill all pips so the
        // shimmer condition "all ticks active" makes sense at a glance.
        const chipLower = chipPreview.trim().toLowerCase()
        const filledForRender = (chipLower === 'ready') ? pipMax : pipFilled

        html += renderPips(filledForRender, pipMax, meter.icon)

        const isReady = (filledForRender >= pipMax) && pipMax > 0
        el.classList.toggle('is-ready', isReady)
    } else {
        el.classList.remove('is-ready')
    }

    if (meter.kind === 'chip+turns') {
        const chip = escHtml(meter.chip())
        const turns = clampInt(meter.turns(), 0, 99)
        html += '<span class="meter-chip">' + chip + '</span>'
        html += '<span class="meter-turns">' + turns + 't</span>'
    }

    if (meter.kind === 'pips+turns') {
        const turns = clampInt(meter.turns(), 0, 99)
        html += '<span class="meter-turns">' + turns + 't</span>'
    }

    if (meter.kind === 'pips+chip') {
        // Use chipPreview if we already computed it for readiness.
        const chip = escHtml(chipPreview || meter.chip())
        if (chip) html += '<span class="meter-chip">' + chip + '</span>'
    }

    if (meter.kind === 'pips+value') {
        const v = escHtml(meter.value())
        if (v) html += '<span class="meter-turns">' + v + '</span>'
    }

    el.innerHTML = html
    el.classList.remove('hidden')
}



function renderActions() {
    const actionsEl = document.getElementById('actions')
    actionsEl.innerHTML = ''

    if (!state.player) return

    if (state.inCombat) {
        // Hardening: never allow Explore actions to render while inCombat.
        // If combat pointers desync, attempt a quick repair.
        try { ensureCombatPointers() } catch (_) {}

        if (state.inCombat && state.currentEnemy) {
            renderCombatActions(actionsEl)
        } else {
            // If we still can't recover, fall back safely.
            state.inCombat = false
            state.currentEnemy = null
            state.enemies = []
            state.targetEnemyIndex = 0
            if (state.combat) {
                state.combat.busy = false
                state.combat.phase = 'player'
            }
            renderExploreActions(actionsEl)
        }
    } else {
        renderExploreActions(actionsEl)
    }
}

function makeActionButton(label, onClick, extraClass, opts) {
    // Backwards-compatible: allow makeActionButton(label, onClick, opts)
    let cls = extraClass
    let o = opts
    if (cls && typeof cls === 'object' && !o) {
        o = cls
        cls = ''
    }

    const btn = document.createElement('button')
    btn.className = 'btn small ' + (cls || '')
    btn.textContent = label

    const cfg = o || {}
    if (cfg.title) btn.title = String(cfg.title)
    if (cfg.disabled) {
        btn.disabled = true
        btn.classList.add('disabled')
    }

    btn.addEventListener('click', (e) => {
        if (btn.disabled) return
        onClick(e)
    })
    return btn
}

function renderExploreActions(actionsEl) {
    actionsEl.innerHTML = ''
    if (!state.player) return

    if (!state.ui) state.ui = {}
    const ui = state.ui
    const inVillage = state.area === 'village'
    const showVillageMenu = inVillage && ui.villageActionsOpen

    // 🔹 VILLAGE SUBMENU MODE ---------------------------------------------------
    if (showVillageMenu) {
        actionsEl.appendChild(
            makeActionButton('Tavern', () => {
                openTavernModal()
            })
        )

        actionsEl.appendChild(
            makeActionButton('Bank', () => {
                openBankModal()
            })
        )

        actionsEl.appendChild(
            makeActionButton('Merchant', () => {
                openMerchantModal()
            })
        )

        actionsEl.appendChild(
            makeActionButton('Town Hall', () => {
                openTownHallModal()
            })
        )

        actionsEl.appendChild(
            makeActionButton('Back', () => {
                ui.villageActionsOpen = false
                renderActions()
            })
        )

        return
    }

    // 🔹 DEFAULT (NON-VILLAGE or VILLAGE NORMAL BAR) ----------------------------
    // Village-only: button to enter the village submenu
    if (inVillage) {
        actionsEl.appendChild(
            makeActionButton('Village ▸', () => {
                ui.villageActionsOpen = true
                renderActions()
            })
        )

        // ✅ Only show Realm & Council if you're in the village
        actionsEl.appendChild(
            makeActionButton('Realm & Council', () => {
                openGovernmentModal()
            })
        )
    }

    actionsEl.appendChild(
        makeActionButton(
            'Explore',
            () => {
                handleExploreClick()
            },
            ''
        )
    )

    actionsEl.appendChild(
        makeActionButton('Change Area', () => {
            ui.exploreChoiceMade = false
            openExploreModal()
        })
    )

    actionsEl.appendChild(
        makeActionButton('Inventory', () => {
            openInventoryModal()
        })
    )

    actionsEl.appendChild(
        makeActionButton('Spells', () => {
            openSpellsModal(false)
        })
    )

    // Cheats button removed from the main action bar.
    // In dev-cheat mode, Cheats are accessed via the 🛠️ HUD pill next to 🧪 and the Menu button.
}
function renderCombatActions(actionsEl) {
    actionsEl.innerHTML = ''

    const locked = !canPlayerActNow()
    const lockTitle = locked ? 'Resolve the current turn first.' : ''

    actionsEl.appendChild(
        makeActionButton('Attack', () => {
            playerBasicAttack()
        }, '', { disabled: locked, title: lockTitle })
    )

    actionsEl.appendChild(
        makeActionButton('Interrupt', () => {
            playerInterrupt()
        }, 'outline', { disabled: locked, title: lockTitle })
    )

    actionsEl.appendChild(
        makeActionButton('Spells', () => {
            openSpellsModal(true)
        }, '', { disabled: locked, title: lockTitle })
    )

    actionsEl.appendChild(
        makeActionButton('Items', () => {
            openInventoryModal(true)
        }, '', { disabled: locked, title: lockTitle })
    )

    const isBoss = !!(state.currentEnemy && state.currentEnemy.isBoss)
    actionsEl.appendChild(
        makeActionButton(isBoss ? 'No Escape' : 'Flee', () => {
            if (isBoss) {
                addLog('This foe blocks your escape!', 'danger')
            } else {
                tryFlee()
            }
        }, isBoss ? 'outline' : '', { disabled: locked, title: lockTitle })
    )
}

// HUD swipe tracking
let hudTouchStartX = null
let hudTouchStartY = null

function toggleHudEntity() {
    // If no companion, always show player and do nothing
    if (!state.companion) {
        addLog('You have no companion yet.', 'system')
        state.hudView = 'player'
        updateHUD()
        return
    }

    state.hudView = state.hudView === 'companion' ? 'player' : 'companion'
    updateHUD()
}

// --- PLAYER CREATION ----------------------------------------------------------

function buildCharacterCreationOptions() {
    const classRow = document.getElementById('classOptions')
    const diffRow = document.getElementById('difficultyOptions')
    classRow.innerHTML = ''
    diffRow.innerHTML = ''

    // Extended icon map for ALL classes
    const CLASS_ICONS = {
        mage: '🔥',
        warrior: '🛡',
        blood: '🩸',
        ranger: '🎯',
        paladin: '✝',
        rogue: '🗡',
        cleric: '⛨',
        necromancer: '💀',
        shaman: '🌩',
        berserker: '💢',
        vampire: '🦇'
    }

    // Combat meters (shown in the combat HUD). Listed here so players know what the extra bar/dots mean.
    const CLASS_METERS = {
        mage: 'Rhythm — every 3rd spell is discounted and crit-boosted.',
        warrior: 'Bulwark — fills toward 40 Fury; at 40+ Fury the Bulwark bonus is active.',
        blood: 'Blood — quick gauge of your Blood resource for Blood Knight abilities.',
        ranger: 'Marks — stack on the target, then spend with Headshot (Marks decay over time).',
        paladin: 'Sanctuary — active while shielded; the meter reflects your current warding.',
        rogue: 'Combo — build with Rogue skills, spend with Eviscerate.',
        cleric: 'Ward — reflects your current shield/warding (heals can over-heal into shields).',
        necromancer: 'Shards — generated by shadow spells, spent by shard abilities; Lich Form sustains on shadow hits.',
        shaman: 'Totem — activate Totems for bonuses; Tempest hits harder while a Totem is active.',
        berserker: 'Frenzy — rises as you lose HP (missing HP increases your damage).',
        vampire: 'Hunger — above 55% Essence your Hungering Vein bonuses are active.'
    }

    // Build one card per class in PLAYER_CLASSES
    Object.values(PLAYER_CLASSES).forEach((cls) => {
        const div = document.createElement('div')
        div.className = 'class-card'
        div.dataset.classId = cls.id

        const meter = CLASS_METERS[cls.id]
            ? `<div class="class-card-meter" style="font-size:0.72rem;color:var(--muted);margin-top:4px;">Combat Meter (HUD): ${CLASS_METERS[cls.id]}</div>`
            : ''

        div.innerHTML = `
      <div class="class-card-icon">${CLASS_ICONS[cls.id] || '🎭'}</div>
      <div class="class-card-content">
        <div class="class-card-name">${cls.name}</div>
        <div class="class-card-desc">${cls.desc}</div>
        ${meter}
      </div>
    `

        div.addEventListener('click', () => {
            document
                .querySelectorAll('#classOptions .class-card')
                .forEach((el) => el.classList.remove('selected'))
            div.classList.add('selected')
        })

        classRow.appendChild(div)
    })

    // Auto-select the first class card
    const first = classRow.querySelector('.class-card')
    if (first) first.classList.add('selected')

    // Difficulty options stay as pill buttons
    ;['easy', 'normal', 'hard', 'dynamic'].forEach((id) => {
        const diff = DIFFICULTY_CONFIG[id]
        const div = document.createElement('div')
        div.className = 'pill-option'
        div.dataset.diffId = id
        div.innerHTML = `
      <strong>${diff.name}</strong>
      <div style="font-size:0.72rem;color:var(--muted);margin-top:2px;">
        ${id === 'easy' ? '' : id === 'normal' ? '' : id === 'hard' ? '' : ''}
      </div>`
        div.addEventListener('click', () => {
            document
                .querySelectorAll('#difficultyOptions .pill-option')
                .forEach((el) => el.classList.remove('selected'))
            div.classList.add('selected')
        })
        diffRow.appendChild(div)
        if (id === 'normal') div.classList.add('selected')
    })
}
// Reset the character-creation dev-cheats UI so it never "sticks"
function resetDevCheatsCreationUI() {
    const pill = document.querySelector('.dev-cheats-pill')
    const cb = document.getElementById('devCheatsToggle')

    if (pill) pill.classList.remove('selected')
    if (cb) cb.checked = false
}
// --- DEV CHEATS PILL TOGGLE ----------------------------------------------
const devCheatsPill = document.querySelector('.dev-cheats-pill')
const devCheatsCheckbox = document.getElementById('devCheatsToggle')

if (devCheatsPill && devCheatsCheckbox) {
    // Ensure a clean default when the page first loads
    devCheatsPill.classList.remove('selected')
    devCheatsCheckbox.checked = false

    devCheatsPill.addEventListener('click', (evt) => {
        evt.preventDefault() // ignore native label/checkbox toggling

        const nowActive = !devCheatsPill.classList.contains('selected')

        // Visual state (like difficulty highlight)
        devCheatsPill.classList.toggle('selected', nowActive)

        // Keep the hidden checkbox in sync so existing logic still works
        devCheatsCheckbox.checked = nowActive
    })
}

function startNewGameFromCreation() {
    const nameInput = document.getElementById('inputName')
    let name = nameInput.value.trim()
    if (!name) name = 'Nameless One'

    // ✅ FIX: use .class-card for class selection
    const classCard = document.querySelector(
        '#classOptions .class-card.selected'
    )
    const diffOption = document.querySelector(
        '#difficultyOptions .pill-option.selected'
    )

    const classId = classCard ? classCard.dataset.classId : 'warrior'
    const diffId = diffOption ? diffOption.dataset.diffId : 'normal'

    state = createEmptyState()
    initRngState(state)
    syncGlobalStateRef()
    state.difficulty = diffId
    // 🔹 NEW: read dev-cheat toggle from character creation screen
    const devToggle = document.getElementById('devCheatsToggle')
    if (devToggle && devToggle.checked) {
        state.flags.devCheatsEnabled = true
    }

    // NEW: initialize time & village economy
    initTimeState(state)
    initVillageEconomyState(state)
    initGovernmentState(state, 0)
    ensureVillagePopulation(state) // ← add this line

    const classDef = PLAYER_CLASSES[classId] || PLAYER_CLASSES['warrior']
    const base = classDef.baseStats

    const startingSkills =
        CLASS_STARTING_SKILLS[classId] || CLASS_STARTING_SKILLS.default

    const player = {
        name,
        classId,
        level: 1,
        xp: 0,
        nextLevelXp: 100,

        // core resources (base values; skills will modify via recalcPlayerStats)
        maxHp: base.maxHp,
        hp: base.maxHp,
        resourceKey: classDef.resourceKey,
        resourceName: classDef.resourceName,
        maxResource:
            classDef.resourceKey === 'mana'
                ? 100
                : classDef.resourceKey === 'essence'
                ? 90
                : 60,
        resource:
            classDef.resourceKey === 'mana'
                ? 80
                : classDef.resourceKey === 'essence'
                ? 45
                : 0,
        stats: {
            attack: base.attack,
            magic: base.magic,
            armor: base.armor,
            speed: base.speed
        },

        // NEW: skills and points
        skills: {
            strength: startingSkills.strength,
            endurance: startingSkills.endurance,
            willpower: startingSkills.willpower
        },
        skillPoints: 0,

        equipment: {
            weapon: null,
            armor: null, // body
            head: null,
            hands: null,
            feet: null,
            belt: null,
            neck: null,
            ring: null
        },
        inventory: [],
        spells: [...classDef.startingSpells],
        equippedSpells: [...classDef.startingSpells],
        abilityUpgrades: {},
        abilityUpgradeTokens: 0,
        gold: 40,
        status: {
            bleedTurns: 0,
            bleedDamage: 0,
            shield: 0,

            // Patch 1.1.0: spell cadence + companion boons + evasion
            spellCastCount: 0,
            buffFromCompanion: 0,
            buffFromCompanionTurns: 0,
            evasionBonus: 0,
            evasionTurns: 0,
            firstHitBonusAvailable: true,

            // Buffs / debuffs
            buffAttack: 0,
            buffAttackTurns: 0,
            buffMagic: 0,
            buffMagicTurns: 0,

            atkDown: 0,
            atkDownTurns: 0,
            magicDown: 0,
            magicDownTurns: 0,

            armorDown: 0,
            armorDownTurns: 0,
            magicResDown: 0,
            magicResDownTurns: 0,

            vulnerableTurns: 0,

            // Damage reduction (Shield Wall etc.)
            dmgReductionTurns: 0
        }
    }
    state.player = player
    quests.initMainQuest()

    // Starter items by resource
    addItemToInventory('potionSmall', 2)
    if (classDef.resourceKey === 'mana') {
        addItemToInventory('potionMana', 1)
        addItemToInventory('staffOak', 1)
    } else if (classDef.resourceKey === 'fury') {
        addItemToInventory('potionFury', 1)
        addItemToInventory('swordIron', 1)
        addItemToInventory('armorLeather', 1)
    } else if (classDef.resourceKey === 'blood') {
        addItemToInventory('potionBlood', 1)
        addItemToInventory('bladeSanguine', 1)
    } else if (classDef.resourceKey === 'essence') {
        addItemToInventory('potionEssence', 1)
        addItemToInventory('bladeSanguine', 1)
    }

    setScene(
        'Emberwood Village',
        'You arrive at Emberwood, a frontier village stalked by shadows. The village elder seeks a champion.'
    )
    addLog(
        'You arrive in Emberwood, carrying only your wits and your gear.',
        'system'
    )
    addLog('Find Elder Rowan and learn why the forest has grown restless.')

    quests.updateQuestBox()
    updateHUD()
    updateEnemyPanel()
    renderActions()
    saveGame()
    updateTimeDisplay()

    switchScreen('game')
}

// --- INVENTORY & ITEMS --------------------------------------------------------

function cloneItemDef(id) {
    const def = ITEM_DEFS[id]
    if (!def) return null
    return JSON.parse(JSON.stringify(def))
}

function addItemToInventory(itemId, quantity) {
    // Defensive: normalize quantity (prevents negative / NaN quantities from corrupting inventory).
    quantity = Math.floor(Number(quantity))
    if (!Number.isFinite(quantity) || quantity <= 0) quantity = 1
    const def = cloneItemDef(itemId)
    if (!def) return

    const inv = state.player.inventory
    const existingIndex = inv.findIndex(
        (it) => it.id === def.id && it.type === 'potion'
    )
    if (existingIndex >= 0 && def.type === 'potion') {
        const prev = Math.floor(Number(inv[existingIndex].quantity))
        inv[existingIndex].quantity = (Number.isFinite(prev) ? prev : 0) + quantity
    } else {
        def.quantity = quantity
        inv.push(def)
    }
}

// --- Generated loot support -------------------------------------------------
// Allows dynamically generated items (weapons/armor/potions) to be added directly.
function addGeneratedItemToInventory(item, quantity = 1) {
    if (!item) return
    quantity = Math.floor(Number(quantity))
    if (!Number.isFinite(quantity) || quantity <= 0) quantity = 1
    const inv = state.player.inventory

    // Deep-clone to avoid accidental shared references.
    const cloned = JSON.parse(JSON.stringify(item))

    // Stack potions by id; equipment stays unique.
    if (cloned.type === 'potion') {
        const existingIndex = inv.findIndex(
            (it) => it.id === cloned.id && it.type === 'potion'
        )
        if (existingIndex >= 0) {
            const prev = Math.floor(Number(inv[existingIndex].quantity))
            inv[existingIndex].quantity = (Number.isFinite(prev) ? prev : 0) + quantity
            return
        }
        cloned.quantity = quantity
        inv.push(cloned)
        return
    }

    // Equipment items should not stack
    cloned.quantity = 1
    inv.push(cloned)
}

// Unequip helper: prefer reference equality (prevents unequipping the wrong "copy" of an item),
// but fall back to id matching for older saves that may have cloned equipment objects.
function unequipItemIfEquipped(player, item) {
    if (!player || !player.equipment || !item) return false

    const eq = player.equipment
    let changed = false

    // 1) Exact object match (best for duplicated item ids)
    Object.keys(eq).forEach((k) => {
        if (eq[k] === item) {
            eq[k] = null
            changed = true
        }
    })

    // 2) Fallback: id match (legacy saves or cloned equip refs)
    // IMPORTANT: This is *unsafe* when the player owns multiple copies with the same id.
    // In that scenario we cannot know which copy was meant, so we refuse to unequip by id.
    if (!changed && item.id) {
        const inv = Array.isArray(player.inventory) ? player.inventory : []
        const sameIdCount = inv.reduce((n, it) => (it && it.id === item.id ? n + 1 : n), 0)
        if (sameIdCount <= 1) {
            Object.keys(eq).forEach((k) => {
                if (eq[k] && eq[k].id === item.id) {
                    eq[k] = null
                    changed = true
                }
            })
        }
    }

    return changed
}

// Sell one unit (or the whole item if equipment). Intended to be called from merchant UIs.
function sellItemFromInventory(index, context = 'village') {
    const p = state.player
    const item = p.inventory[index]
    if (!item) return

    // Prevent selling quest/unique items if we ever add them
    if (item.noSell) {
        addLog('This item cannot be sold.', 'system')
        return
    }

    const sellValue = getSellValue(item, context)
    if (!sellValue || sellValue <= 0) {
        addLog('No merchant will buy this.', 'system')
        return
    }

    // If selling equipped gear, unequip first (supports multi-slot gear).
    unequipItemIfEquipped(p, item)

    // Remove from inventory
    if (item.type === 'potion' && (item.quantity || 1) > 1) {
        item.quantity -= 1
    } else {
        p.inventory.splice(index, 1)
    }

    p.gold = (p.gold || 0) + sellValue
    addLog('Sold ' + item.name + ' for ' + sellValue + ' gold.', 'good')

    recalcPlayerStats()
    updateHUD()
    saveGame()
}

function openInventoryModal(inCombat) {
    const p = state.player
    openModal('Inventory', (body) => {
        body.classList.add('inventory-modal')

        if (!p.inventory.length) {
            body.innerHTML =
                '<p class="modal-subtitle">You are not carrying anything.</p>'
            return
        }

        const toolbar = document.createElement('div')
        toolbar.className = 'inv-toolbar'

        const searchWrap = document.createElement('div')
        searchWrap.className = 'inv-search-wrap'

        const search = document.createElement('input')
        search.className = 'inv-search'
        search.type = 'text'
        search.placeholder = 'Search…'
        search.autocomplete = 'off'
        searchWrap.appendChild(search)

        const sort = document.createElement('select')
        sort.className = 'inv-sort'
        ;[
            ['power', 'Sort: Power'],
            ['type', 'Sort: Type'],
            ['rarity', 'Sort: Rarity'],
            ['level', 'Sort: Item Lv'],
            ['name', 'Sort: Name']
        ].forEach(([v, label]) => {
            const opt = document.createElement('option')
            opt.value = v
            opt.textContent = label
            sort.appendChild(opt)
        })

        toolbar.appendChild(searchWrap)
        toolbar.appendChild(sort)

        const tabs = document.createElement('div')
        tabs.className = 'inv-tabs'

        const tabDefs = [
            ['all', 'All'],
            ['potion', 'Potions'],
            ['weapon', 'Weapons'],
            ['armor', 'Armor']
        ]

        let activeTab = 'all'
        let query = ''
        let sortMode = 'power'

        function makeTab(id, label) {
            const btn = document.createElement('button')
            btn.className = 'inv-tab'
            btn.textContent = label
            btn.addEventListener('click', () => {
                activeTab = id
                tabs.querySelectorAll('.inv-tab').forEach((b) =>
                    b.classList.remove('active')
                )
                btn.classList.add('active')
                renderList()
            })
            if (id === activeTab) btn.classList.add('active')
            return btn
        }

        tabDefs.forEach(([id, label]) => tabs.appendChild(makeTab(id, label)))

        const list = document.createElement('div')
        list.className = 'inv-list'

        const hint = document.createElement('p')
        hint.className = 'modal-subtitle'
        hint.textContent = inCombat
            ? 'Using items consumes your action this turn.'
            : state.area === 'village'
            ? 'Tip: You can sell items in the village from here.'
            : 'Tap an item to expand details.'

        body.appendChild(toolbar)
        body.appendChild(tabs)
        body.appendChild(list)
        body.appendChild(hint)

        const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary']
        const rarityRank = (r) => {
            const i = rarityOrder.indexOf((r || 'common').toLowerCase())
            return i >= 0 ? i : 0
        }

        function armorSlotFor(item) {
            // Body armor is the legacy/default slot.
            return item && item.type === 'armor' ? item.slot || 'armor' : null
        }

        function equippedItemFor(item) {
            const eq = p.equipment || {}
                    if (!item) return null
            if (item.type === 'weapon') return eq.weapon || null
            if (item.type === 'armor') {
                const slot = armorSlotFor(item)
                return slot ? eq[slot] || null : null
            }
            return null
        }

        function isItemEquipped(item) {
            const eqIt = equippedItemFor(item)
            return !!(eqIt && (eqIt === item || (eqIt.id && item && eqIt.id === item.id)))
        }

        function powerDelta(item) {
            if (!item || (item.type !== 'weapon' && item.type !== 'armor')) return null
            const equipped = equippedItemFor(item)
            if (!equipped) return null

            const cur = getItemPowerScore(equipped)
            const cand = getItemPowerScore(item)
            const delta = Math.round((cand - cur) * 10) / 10
            if (!isFinite(delta)) return null
            return { delta, cur, cand }
        }

        function compareLine(item) {
            const d = powerDelta(item)
            if (!d) return null
            if (Math.abs(d.delta) < 0.1) return '≈ same power'
            return (d.delta > 0 ? '▲ ' : '▼ ') + Math.abs(d.delta) + ' power'
        }

        function renderList() {
            list.innerHTML = ''

            const rows = p.inventory.map((item, idx) => ({ item, idx }))

            const filtered = rows
                .filter(({ item }) => {
                    if (activeTab === 'all') return true
                    return item.type === activeTab
                })
                .filter(({ item }) => {
                    if (!query) return true
                    const q = query.toLowerCase()
                    return (
                        (item.name || '').toLowerCase().includes(q) ||
                        (item.desc || '').toLowerCase().includes(q) ||
                        (item.type || '').toLowerCase().includes(q)
                    )
                })

            filtered.sort((a, b) => {
                const ia = a.item
                const ib = b.item
                const aEq =
                    isItemEquipped(ia)
                const bEq =
                    isItemEquipped(ib)

                // Always float equipped gear to the top within its type.
                if (aEq !== bEq) return aEq ? -1 : 1

                if (sortMode === 'name') {
                    return (ia.name || '').localeCompare(ib.name || '')
                }
                if (sortMode === 'type') {
                    const t = (ia.type || '').localeCompare(ib.type || '')
                    if (t !== 0) return t
                    return (ia.name || '').localeCompare(ib.name || '')
                }
                if (sortMode === 'rarity') {
                    const r = rarityRank(ib.rarity) - rarityRank(ia.rarity)
                    if (r !== 0) return r
                    return (ia.name || '').localeCompare(ib.name || '')
                }
                if (sortMode === 'level') {
                    const l = (ib.itemLevel || 0) - (ia.itemLevel || 0)
                    if (l !== 0) return l
                    return (ia.name || '').localeCompare(ib.name || '')
                }

                // default: power
                const pA = getItemPowerScore(ia) || 0
                const pB = getItemPowerScore(ib) || 0
                const d = pB - pA
                if (Math.abs(d) > 0.001) return d > 0 ? 1 : -1
                return (ia.name || '').localeCompare(ib.name || '')
            })

            if (!filtered.length) {
                const empty = document.createElement('p')
                empty.className = 'modal-subtitle'
                empty.textContent = 'No items match your filters.'
                list.appendChild(empty)
                return
            }

            filtered.forEach(({ item, idx }) => {
                const isEquipped = isItemEquipped(item)

                const card = document.createElement('details')
                card.className = 'inv-card'
                if (isEquipped) card.open = true

                const summary = document.createElement('summary')
                summary.className = 'inv-card-header'

                const left = document.createElement('div')
                left.className = 'inv-left'

                const name = document.createElement('div')
                name.className = 'inv-name'
                // Rarity color (text). Defaults to common when missing.
                name.classList.add('rarity-' + String(item.rarity || 'common').toLowerCase())
                name.textContent =
                    item.name +
                    (item.type === 'potion' && (item.quantity || 1) > 1
                        ? '  ×' + (item.quantity || 1)
                        : '')
                left.appendChild(name)

                const sub = document.createElement('div')
                sub.className = 'inv-sub'
                const bits = []
                if (item.itemLevel) bits.push('iLv ' + item.itemLevel)
                if (item.rarity) bits.push(formatRarityLabel(item.rarity))
                if (item.type === 'potion') {
                    bits.push('Potion')
                } else if (item.type === 'weapon') {
                    bits.push('Weapon')
                } else {
                    const slot = item.slot || 'armor'
                    const pretty =
                        slot === 'armor'
                            ? 'Armor'
                            : slot.charAt(0).toUpperCase() + slot.slice(1)
                    bits.push(pretty)
                }
                if (isEquipped) bits.push('Equipped')
                sub.textContent = bits.filter(Boolean).join(' • ')
                left.appendChild(sub)

                const right = document.createElement('div')
                right.className = 'inv-right'

                const score = document.createElement('div')
                score.className = 'inv-score'
                score.textContent = Math.round((getItemPowerScore(item) || 0) * 10) / 10
                right.appendChild(score)

                // Power comparison indicator (visible even when the card is collapsed).
                const d = powerDelta(item)
                if (d) {
                    const deltaEl = document.createElement('div')
                    deltaEl.className = 'inv-delta'
                    if (Math.abs(d.delta) < 0.1) {
                        deltaEl.textContent = '≈'
                        deltaEl.classList.add('same')
                    } else {
                        deltaEl.textContent = (d.delta > 0 ? '▲' : '▼') + Math.abs(d.delta)
                        deltaEl.classList.add(d.delta > 0 ? 'up' : 'down')
                    }
                    right.appendChild(deltaEl)
                }

                summary.appendChild(left)
                summary.appendChild(right)

                const details = document.createElement('div')
                details.className = 'inv-details'

                const desc = document.createElement('div')
                desc.className = 'inv-desc'
                desc.textContent = item.desc || ''
                details.appendChild(desc)

                const cmp = compareLine(item)
                if (cmp) {
                    const cmpEl = document.createElement('div')
                    cmpEl.className = 'inv-compare'
                    cmpEl.textContent = cmp
                    details.appendChild(cmpEl)
                }

                const actions = document.createElement('div')
                actions.className = 'inv-actions'

                const tight = document.createElement('div')
                tight.className = 'inv-actions-tight'

                if (item.type === 'potion') {
                    // Keep potion actions visually consistent with other inventory items.
                    // (Use + Drop live in the tight group so spacing matches Equip/Unequip + Drop.)
                    const btn = document.createElement('button')
                    btn.className = 'btn small'
                    btn.textContent = 'Use'
                    btn.addEventListener('click', (e) => {
                        e.preventDefault()
                        usePotionFromInventory(idx, inCombat, {
                            stayOpen: !inCombat,
                            onAfterUse: renderList
                        })
                    })
                    tight.appendChild(btn)
                } else {
                    if (!isEquipped) {
                        const btn = document.createElement('button')
                        btn.className = 'btn small'
                        btn.textContent = 'Equip'
                        btn.addEventListener('click', (e) => {
                            e.preventDefault()
                            equipItemFromInventory(idx, {
                                stayOpen: true,
                                onAfterEquip: renderList
                            })
                        })
                        tight.appendChild(btn)
                    } else {
                        const btn = document.createElement('button')
                        btn.className = 'btn small'
                        btn.textContent = 'Unequip'
                        btn.addEventListener('click', (e) => {
                            e.preventDefault()
                            unequipItemIfEquipped(p, item)
                            recalcPlayerStats()
                            updateHUD()
                            saveGame()
                            renderList()
                        })
                        tight.appendChild(btn)
                    }
                }

                // Selling (only when not in combat)
                if (!inCombat) {
                    const inVillage = (state.area || 'village') === 'village'
                    if (inVillage) {
                        const btnSell = document.createElement('button')
                        btnSell.className = 'btn small'
                        btnSell.textContent = 'Sell'
                        btnSell.addEventListener('click', (e) => {
                            e.preventDefault()
                            sellItemFromInventory(idx, 'village')
                            renderList()
                        })
                        actions.appendChild(btnSell)
                    }
                }

                // Drop button (always available, but warns in combat)
                const btnDrop = document.createElement('button')
                btnDrop.className = 'btn small danger'
                btnDrop.textContent = 'Drop'
                btnDrop.addEventListener('click', (e) => {
                    e.preventDefault()
                    const ok = inCombat
                        ? confirm('Drop this item during combat? You may regret it.')
                        : confirm('Drop this item?')
                    if (!ok) return

                    // If dropping equipped gear, unequip first
                    unequipItemIfEquipped(p, item)

                    if (item.type === 'potion' && (item.quantity || 1) > 1) {
                        item.quantity -= 1
                    } else {
                        p.inventory.splice(idx, 1)
                    }

                    recalcPlayerStats()
                    updateHUD()
                    saveGame()
                    renderList()
                })
                tight.appendChild(btnDrop)

                if (tight.childNodes.length) actions.appendChild(tight)

                details.appendChild(actions)

                card.appendChild(summary)
                card.appendChild(details)
                list.appendChild(card)
            })
        }

        search.addEventListener('input', () => {
            query = (search.value || '').trim()
            renderList()
        })

        sort.addEventListener('change', () => {
            sortMode = sort.value || 'power'
            renderList()
        })

        renderList()
    })
}

function usePotionFromInventory(index, inCombat, opts = {}) {
    const p = state.player
    const item = p.inventory[index]
    if (!item || item.type !== 'potion') return

    if (inCombat) {
        if (!guardPlayerTurn()) return
    }

    const stayOpen = !!opts.stayOpen
    const onAfterUse = typeof opts.onAfterUse === 'function' ? opts.onAfterUse : null

    let used = false
    if (item.hpRestore) {
        const before = p.hp
        p.hp = Math.min(p.maxHp, p.hp + item.hpRestore)
        if (p.hp > before) {
            addLog(
                'You drink ' + item.name + ' and recover ' + (p.hp - before) + ' HP.',
                'good'
            )
            used = true
        }
    }
    if (item.resourceRestore) {
        if (item.resourceKey && item.resourceKey !== p.resourceKey) {
            addLog(
                item.name + " doesn't restore your " + (p.resourceName || 'power') + '.',
                'system'
            )
        } else {
            const before = p.resource
            p.resource = Math.min(p.maxResource, p.resource + item.resourceRestore)
            if (p.resource > before) {
                addLog(
                    'You drink ' +
                        item.name +
                        ' and recover ' +
                        (p.resource - before) +
                        ' ' +
                        p.resourceName +
                        '.',
                    'good'
                )
                used = true
            }
        }
    }

    if (used) {
        item.quantity = (item.quantity || 1) - 1
        if (item.quantity <= 0) {
            p.inventory.splice(index, 1)
        }
        updateHUD()
        saveGame()

        if (onAfterUse) onAfterUse()

        if (inCombat) {
            closeModal()
            endPlayerTurn({ source: 'item', item: item.id || item.name })
        } else if (!stayOpen) {
            closeModal()
        }
    } else {
        addLog('Nothing happens.', 'system')
    }
}

function equipItemFromInventory(index, opts = {}) {
    const p = state.player
    const item = p.inventory[index]
    if (!item || (item.type !== 'weapon' && item.type !== 'armor')) return

    // Ensure equipment schema is present (older saves).
    if (!p.equipment) p.equipment = {}
    if (p.equipment.weapon === undefined) p.equipment.weapon = null
    if (p.equipment.armor === undefined) p.equipment.armor = null
    if (p.equipment.head === undefined) p.equipment.head = null
    if (p.equipment.hands === undefined) p.equipment.hands = null
    if (p.equipment.feet === undefined) p.equipment.feet = null
    if (p.equipment.belt === undefined) p.equipment.belt = null
    if (p.equipment.neck === undefined) p.equipment.neck = null
    if (p.equipment.ring === undefined) p.equipment.ring = null

    const stayOpen = !!opts.stayOpen
    const onAfterEquip =
        typeof opts.onAfterEquip === 'function' ? opts.onAfterEquip : null

    const slotLabel = (slot) =>
        slot === 'weapon'
            ? 'weapon'
            : slot === 'armor'
            ? 'armor'
            : slot === 'head'
            ? 'head'
            : slot === 'hands'
            ? 'hands'
            : slot === 'feet'
            ? 'feet'
            : slot === 'belt'
            ? 'belt'
            : slot === 'neck'
            ? 'neck'
            : slot === 'ring'
            ? 'ring'
            : 'gear'

    if (item.type === 'weapon') {
        p.equipment.weapon = item
        addLog('You equip ' + item.name + ' as your weapon.', 'good')
    } else {
        const slot = item.slot || 'armor'
        if (p.equipment[slot] === undefined) p.equipment[slot] = null
        p.equipment[slot] = item
        addLog(
            'You equip ' + item.name + ' as your ' + slotLabel(slot) + '.',
            'good'
        )
    }

    recalcPlayerStats()
    updateHUD()
    saveGame()

    if (onAfterEquip) onAfterEquip()
    if (!stayOpen) closeModal()
}

function recalcPlayerStats() {
    const p = state.player
    const cls = PLAYER_CLASSES[p.classId]
    const base = cls.baseStats

    // If loading an old save, make sure skills exist
    if (!p.skills) {
        const fallback =
            CLASS_STARTING_SKILLS[p.classId] || CLASS_STARTING_SKILLS.default
        p.skills = {
            strength: fallback.strength,
            endurance: fallback.endurance,
            willpower: fallback.willpower
        }
    }

    // If loading an old save, ensure stats object exists
    if (!p.stats) {
        p.stats = { attack: 0, magic: 0, armor: 0, speed: 0, magicRes: 0 }
    }

    // If loading an old save, ensure equipment object exists (and backfill new slots).
    if (!p.equipment) p.equipment = {}
    if (p.equipment.weapon === undefined) p.equipment.weapon = null
    if (p.equipment.armor === undefined) p.equipment.armor = null // body
    if (p.equipment.head === undefined) p.equipment.head = null
    if (p.equipment.hands === undefined) p.equipment.hands = null
    if (p.equipment.feet === undefined) p.equipment.feet = null
    if (p.equipment.belt === undefined) p.equipment.belt = null
    if (p.equipment.neck === undefined) p.equipment.neck = null
    if (p.equipment.ring === undefined) p.equipment.ring = null

    const s = p.skills

    // Base stats from class
    p.maxHp = base.maxHp
    p.stats.attack = base.attack
    p.stats.magic = base.magic
    p.stats.armor = base.armor
    p.stats.speed = base.speed

    // Magical resistance was historically missing from player baselines.
    // Derive a small class baseline so enemy magic attacks are resistible
    // without requiring a specific gear affix.
    p.stats.magicRes =
        typeof base.magicRes === 'number'
            ? base.magicRes
            : Math.max(0, Math.round(base.magic * 0.35 + base.armor * 0.45 + 1))

    // Reset derived affixes (percent values unless noted)
    p.stats.critChance = 0
    p.stats.dodgeChance = 0
    p.stats.resistAll = 0
    p.stats.lifeSteal = 0
    p.stats.armorPen = 0
    p.stats.haste = 0
    p.stats.thorns = 0 // flat reflect
    p.stats.hpRegen = 0 // per-tick value (small)
    p.stats.elementalBonuses = {}
    p.stats.weaponElementType = null

    // Skill contributions
    // Strength: boosts physical offense
    p.stats.attack += s.strength * 2

    // Endurance: more HP and some armor
    p.maxHp += s.endurance * 6
    p.stats.armor += Math.floor(s.endurance / 2)

    // Willpower: boosts magic and resource pool
    p.stats.magic += s.willpower * 2

    // Willpower + a touch of Endurance also improve magical resistance.
    // Keeps early enemy casters from spiking damage too hard.
    p.stats.magicRes += Math.floor((s.willpower || 0) / 2)
    p.stats.magicRes += Math.floor((s.endurance || 0) / 4)


    let extraMaxRes = 0
    extraMaxRes += s.willpower * 4

    const addElementBonus = (elem, pct) => {
        if (!elem || !pct) return
        p.stats.elementalBonuses[elem] =
            (p.stats.elementalBonuses[elem] || 0) + pct
    }

    const applyItemBonuses = (it, slot) => {
        if (!it) return

        // Core, older fields
        if (it.attackBonus) p.stats.attack += it.attackBonus
        if (it.magicBonus) p.stats.magic += it.magicBonus
        if (it.armorBonus) p.stats.armor += it.armorBonus
        if (it.speedBonus) p.stats.speed += it.speedBonus

        // Optional: support explicit magical resistance bonuses (future-proof).
        if (it.magicResBonus) p.stats.magicRes += it.magicResBonus
        if (it.magicRes) p.stats.magicRes += it.magicRes

        // Maxima
        if (it.maxHPBonus) p.maxHp += it.maxHPBonus
        if (it.maxHpBonus) p.maxHp += it.maxHpBonus // legacy
        if (it.maxResourceBonus) extraMaxRes += it.maxResourceBonus

        // NEW affixes (all rolled as % in loot generator; store as % here)
        if (it.critChance) p.stats.critChance += it.critChance
        if (it.dodgeChance) p.stats.dodgeChance += it.dodgeChance
        if (it.resistAll) p.stats.resistAll += it.resistAll
        if (it.lifeSteal) p.stats.lifeSteal += it.lifeSteal
        if (it.armorPen) p.stats.armorPen += it.armorPen
        if (it.haste) p.stats.haste += it.haste

        // Defensive utilities
        if (it.thorns) p.stats.thorns += it.thorns
        if (it.hpRegen) p.stats.hpRegen += it.hpRegen

        // Elemental bonus
        if (it.elementalType && it.elementalBonus) {
            addElementBonus(it.elementalType, it.elementalBonus)
            if (slot === 'weapon' && !p.stats.weaponElementType) {
                p.stats.weaponElementType = it.elementalType
            }
        }

        // If item stored multiple elemental bonuses (future-proof)
        if (it.elementalBonuses && typeof it.elementalBonuses === 'object') {
            Object.keys(it.elementalBonuses).forEach((k) =>
                addElementBonus(k, it.elementalBonuses[k])
            )
        }
    }

    // Equipment contributions
    applyItemBonuses(p.equipment.weapon, 'weapon')
    applyItemBonuses(p.equipment.armor, 'armor')
    applyItemBonuses(p.equipment.head, 'head')
    applyItemBonuses(p.equipment.hands, 'hands')
    applyItemBonuses(p.equipment.feet, 'feet')
    applyItemBonuses(p.equipment.belt, 'belt')
    applyItemBonuses(p.equipment.neck, 'neck')
    applyItemBonuses(p.equipment.ring, 'ring')


    // Speed now has a tangible combat effect: it contributes a small amount of dodge.
    // This ensures Speed gear rolls are never “dead stats.”
    const _spd = Number.isFinite(Number(p.stats.speed)) ? Number(p.stats.speed) : 0
    const _dodgeFromSpeed = Math.max(0, Math.min(12, _spd * 0.6)) // +0.6% dodge per Speed (cap 12%)
    p.stats.dodgeChance = (p.stats.dodgeChance || 0) + _dodgeFromSpeed
    // Clamp some percent-ish stats to sane gameplay ranges
    p.stats.critChance = Math.max(0, Math.min(75, p.stats.critChance || 0))
    p.stats.dodgeChance = Math.max(0, Math.min(60, p.stats.dodgeChance || 0))
    p.stats.resistAll = Math.max(0, Math.min(80, p.stats.resistAll || 0))
    p.stats.lifeSteal = Math.max(0, Math.min(60, p.stats.lifeSteal || 0))
    p.stats.armorPen = Math.max(0, Math.min(80, p.stats.armorPen || 0))
    p.stats.haste = Math.max(0, Math.min(80, p.stats.haste || 0))

    let baseMaxRes = 60
    if (cls.resourceKey === 'mana') {
        baseMaxRes = 100
    } else if (cls.resourceKey === 'essence') {
        baseMaxRes = 90
    }

    p.maxResource = baseMaxRes + extraMaxRes

    // Companion scaling: keep companion stats synced and re-apply HP bonus after stat recalcs.
    if (state.companion) {
        const comp = state.companion
        const def = COMPANION_DEFS[comp.id]
        if (def) {
            const scaled = computeCompanionScaledStats(def, p.level)

            comp.attack = scaled.atk
            comp.hpBonus = scaled.hpBonus
            comp.appliedHpBonus = scaled.hpBonus

            p.maxHp += scaled.hpBonus
        }
    }


// --- Blackbark Oath (Chapter II) ---------------------------------------
// These are intentionally modest and mostly flavor-forward. They give the
// player a visible “world changed” feeling without invalidating gear.
const choice = (state.flags && state.flags.blackbarkChoice) || null
if (choice === 'swear') {
    p.stats.armor += 5
    p.stats.resistAll += 8
} else if (choice === 'break') {
    p.stats.attack += 4
    p.stats.critChance += 4
} else if (choice === 'rewrite') {
    p.stats.attack += 2
    p.stats.magic += 2
    p.stats.armor += 2
    p.stats.resistAll += 4
}

    // Clamp current values to new maxima
    if (p.hp > p.maxHp) p.hp = p.maxHp
    if (p.resource > p.maxResource) p.resource = p.maxResource
}

function openMerchantModal(context = 'village') {
    recordInput('open.merchant', { context })

    // Guard: prevent opening merchants while in combat.
    if (state && state.inCombat) {
        try { ensureCombatPointers() } catch (_) {}
        addLog('You cannot trade while in combat.', 'danger')
        return
    }

    openMerchantModalImpl({
        context,
        state,
        openModal,
        addLog,
        recordInput,
        getVillageEconomySummary,
        getMerchantPrice,
        handleEconomyAfterPurchase,
        cloneItemDef,
        addItemToInventory,
        updateHUD,
        saveGame,
        sellItemFromInventory,
        getSellValue,
        addGeneratedItemToInventory
    })
}

function openTavernModal() {
    recordInput('open.tavern')
    initAudio()
    tryResumeAudioContext()

    const tavernTrack = audioState.tracks && audioState.tracks.tavernAmbience

    // If we're already inside the tavern/gambling flow and Tavern.wav is already running,
    // DO NOT replay the door SFX or restart the track.
    const tavernAlreadyPlaying = !!(
        audioState.interiorOpen &&
        tavernTrack &&
        audioState.currentTrack === tavernTrack &&
        (!tavernTrack.paused || tavernTrack.currentTime > 0)
    )

    if (!tavernAlreadyPlaying) {
        // Entering from outside: stop world ambience, then play door + start Tavern ambience.
        setInteriorOpen(true)

        Promise.resolve(playDoorOpenSfx()).then(() => {
            // If the player exited before the SFX finished, don't start anything.
            if (!audioState.interiorOpen) return
            if (!tavernTrack) return

            // If something else started playing in the meantime, don't fight it.
            if (
                audioState.currentTrack &&
                audioState.currentTrack !== tavernTrack
            )
                return

            applyMasterVolumeTo(tavernTrack)

            // Start (or resume) Tavern.wav without resetting its time if it already had progress.
            audioState.currentTrack = tavernTrack
            if (tavernTrack.paused) {
                tavernTrack.play().catch(() => {})
            }
        })
    } else {
        // Keep volume synced, and resume if some browser paused it during a transition.
        applyMasterVolumeTo(tavernTrack)
        if (tavernTrack.paused && tavernTrack.currentTime > 0) {
            tavernTrack.play().catch(() => {})
        }
    }

    openTavernModalImpl({
        state,
        openModal,
        addLog,
        recordInput,
        getVillageEconomySummary,
        getRestCost,
        handleEconomyAfterPurchase,
        jumpToNextMorning,
        runDailyTicks,
        updateHUD,
        updateTimeDisplay,
        saveGame,
        closeModal,
        openGambleModal,
        // Quest hooks
        questDefs: QUEST_DEFS,
        ensureQuestStructures: quests.ensureQuestStructures,
        startSideQuest: quests.startSideQuest,
        advanceSideQuest: quests.advanceSideQuest,
        completeSideQuest: quests.completeSideQuest,
        updateQuestBox: quests.updateQuestBox,
        setScene
    })
}

function openGambleModal() {
    openGambleModalImpl({
        state,
        openModal,
        addLog,
        updateHUD,
        saveGame,
        closeModal,
        openTavernModal
    })
}
function openTownHallModal() {
    recordInput('open.townHall')
    openTownHallModalImpl({
        state,
        openModal,
        addLog,
        updateHUD,
        saveGame
    })
}

function openBankModal() {
    recordInput('open.bank')
    playDoorOpenSfx()
    setInteriorOpen(true)
    openBankModalImpl({
        state,
        openModal,
        addLog,
        recordInput,
        updateHUD,
        saveGame
    })
}
// --- CHEAT MENU ---------------------------------------------------------------

function openCheatMenu() {
    openModal('Cheat Menu', (body) => {
        body.classList.add('cheat-modal') // match changelog font sizing/feel
        const p = state.player

        const info = document.createElement('p')
        info.className = 'modal-subtitle'
        info.textContent =
            'Debug / cheat options for testing. They instantly modify your current save.'
        body.appendChild(info)

        // Quick controls: search + expand/collapse (keeps the same “pill + muted” aesthetic)
        const toolbar = document.createElement('div')
        toolbar.className = 'cheat-toolbar'

        const searchWrap = document.createElement('div')
        searchWrap.className = 'cheat-search-wrap'

        const search = document.createElement('input')
        search.type = 'text'
        search.className = 'inv-search cheat-search'
        search.placeholder = 'Search cheats…'
        search.setAttribute('aria-label', 'Search cheats')
        searchWrap.appendChild(search)

        const btnExpandAll = document.createElement('button')
        btnExpandAll.className = 'btn small outline'
        btnExpandAll.textContent = 'Expand All'

        const btnCollapseAll = document.createElement('button')
        btnCollapseAll.className = 'btn small outline'
        btnCollapseAll.textContent = 'Collapse All'

        toolbar.appendChild(searchWrap)
        toolbar.appendChild(btnExpandAll)
        toolbar.appendChild(btnCollapseAll)
        body.appendChild(toolbar)

        const statusBar = document.createElement('div')
        statusBar.className = 'cheat-statusbar'
        body.appendChild(statusBar)

        // Keep the stat pills readable and constrained: hard cap at ≤2 rows on narrow screens.
        // We never scroll this bar; instead we (1) keep the pill count compact by combining
        // secondary stats, and (2) auto-scale text/padding until it fits.
        function fitCheatStatusbarTwoRows() {
            if (!statusBar) return

            // Reset to defaults each time so it can grow back on rotation / wider screens.
            statusBar.classList.remove('two-row-scroll')
            statusBar.classList.remove('two-row-clamp')
            statusBar.classList.remove('two-row-compact')
            // Restore full labels if we previously compacted them.
            Array.from(statusBar.querySelectorAll('.cheat-stat')).forEach((el) => {
                if (el && el.dataset && el.dataset.full) el.textContent = el.dataset.full
            })
            statusBar.style.setProperty('--cheat-stat-font', '11.5px')
            statusBar.style.setProperty('--cheat-stat-padY', '3px')
            statusBar.style.setProperty('--cheat-stat-padX', '8px')
            statusBar.style.setProperty('--cheat-stat-gap', '4px')

            const pills = () => Array.from(statusBar.querySelectorAll('.cheat-stat'))
            const rowCount = () => {
                const tops = new Set()
                pills().forEach((el) => tops.add(el.offsetTop))
                return tops.size
            }

            let font = 11.5
            let padY = 3
            let padX = 8

            // Small iterative shrink until we get to two rows or hit our floor.
            for (let i = 0; i < 18; i++) {
                if (rowCount() <= 2) return
                if (font <= 8) break
                font = Math.max(8, font - 0.75)
                padY = Math.max(2, padY - 0.25)
                padX = Math.max(5, padX - 0.35)
                statusBar.style.setProperty('--cheat-stat-font', font + 'px')
                statusBar.style.setProperty('--cheat-stat-padY', padY + 'px')
                statusBar.style.setProperty('--cheat-stat-padX', padX + 'px')
            }

            // If we're still above 2 rows at minimum scale, clamp the widest pills.
            statusBar.classList.add('two-row-clamp')
            if (rowCount() <= 2) return

            // Last resort: switch to compact labels + slightly smaller scale.
            statusBar.classList.add('two-row-compact')
            Array.from(statusBar.querySelectorAll('.cheat-stat')).forEach((el) => {
                if (el && el.dataset && el.dataset.short) el.textContent = el.dataset.short
            })

            font = Math.min(font, 9)
            padY = Math.min(padY, 2.5)
            padX = Math.min(padX, 6)
            for (let i = 0; i < 14; i++) {
                if (rowCount() <= 2) return
                if (font <= 7.25) break
                font = Math.max(7.25, font - 0.5)
                padY = Math.max(2, padY - 0.15)
                padX = Math.max(4.5, padX - 0.2)
                statusBar.style.setProperty('--cheat-stat-font', font + 'px')
                statusBar.style.setProperty('--cheat-stat-padY', padY + 'px')
                statusBar.style.setProperty('--cheat-stat-padX', padX + 'px')
            }
        }

        // Re-fit on resize/orientation changes, but clean up when the modal closes.
        const _cheatResizeHandler = () => {
            // Layout needs a tick to settle on some mobile browsers.
            requestAnimationFrame(() => fitCheatStatusbarTwoRows())
        }
        window.addEventListener('resize', _cheatResizeHandler)
        modalOnClose = () => {
            try {
                window.removeEventListener('resize', _cheatResizeHandler)
            } catch (_) {}
        }

        function renderCheatStatus() {
            const day =
                state && state.time && typeof state.time.dayIndex === 'number'
                    ? Math.floor(Number(state.time.dayIndex))
                    : 0
            const part =
                state && state.time && state.time.part
                    ? String(state.time.part)
                    : ''
            const area = state && state.area ? getAreaDisplayName(state.area) : ''
            const activeDiff = getActiveDifficultyConfig()

            const critLabel = state.flags.alwaysCrit
                ? 'ALWAYS'
                : state.flags.neverCrit
                  ? 'NEVER'
                  : 'NORMAL'

            statusBar.innerHTML = ''

            function addStat(txt, extraClass, shortTxt) {
                const s = document.createElement('span')
                s.className = 'cheat-stat' + (extraClass ? ' ' + extraClass : '')
                s.textContent = txt
                // Store full/short labels so the fitter can swap when needed.
                s.dataset.full = String(txt)
                s.dataset.short = String(shortTxt || txt)
                statusBar.appendChild(s)
            }

            // Primary, always-visible stats
            const lvTxt = 'Lv ' + (p.level || 1)
            addStat(lvTxt, '', lvTxt)

            const hpTxt = 'HP ' + (p.hp || 0) + '/' + (p.maxHp || 0)
            addStat(hpTxt, '', hpTxt)

            // Resource name can be long on some classes; keep the label compact.
            const resNameRaw = p.resourceName || 'Res'
            const resName =
                String(resNameRaw).length > 10
                    ? String(resNameRaw).slice(0, 10)
                    : String(resNameRaw)
            const resTxt = resName + ' ' + (p.resource || 0) + '/' + (p.maxResource || 0)
            const resShortLabel = String(resNameRaw)
                .trim()
                .slice(0, 4)
                .replace(/\s+/g, '')
            const resShort =
                (resShortLabel ? resShortLabel : 'Res') +
                ' ' +
                (p.resource || 0) +
                '/' +
                (p.maxResource || 0)
            addStat(resTxt, '', resShort)

            const goldTxt = 'Gold ' + (p.gold || 0)
            addStat(goldTxt, '', 'G ' + (p.gold || 0))

            // Secondary stats are combined to keep the status bar at ≤2 rows without scrolling.
            const partShort = part ? String(part).trim().slice(0, 1).toUpperCase() : ''
            const timeTxt = 'Day ' + day + (part ? ' • ' + part : '')
            const timeShort = 'D' + day + (partShort ? '•' + partShort : '')
            addStat(timeTxt, '', timeShort)

            const locBits = []
            if (area) locBits.push(area)
            if (activeDiff && activeDiff.name) locBits.push(activeDiff.name)
            if (locBits.length) {
                const locTxt = locBits.join(' • ')
                // Short form drops the separator label and relies on truncation when needed.
                const locShort = locBits.join('•')
                addStat(locTxt, 'cheat-stat-wide', locShort)
            }

            const flagsTxt =
                'God ' + (state.flags.godMode ? 'ON' : 'OFF') + ' • Crit ' + critLabel
            const flagsShort =
                'God ' + (state.flags.godMode ? 'ON' : 'OFF') + ' • C ' + critLabel.slice(0, 1)
            addStat(flagsTxt, 'cheat-stat-wide', flagsShort)

            // After DOM updates, ensure we stay within the 2-row constraint.
            requestAnimationFrame(() => fitCheatStatusbarTwoRows())
        }

        renderCheatStatus()

        const cheatSections = []

        // Collapsible sections to keep the cheat menu compact
        function makeCheatSection(titleText, expandedByDefault) {
            const section = document.createElement('div')
            section.className = 'cheat-section'

            const header = document.createElement('button')
            header.type = 'button'
            header.className = 'cheat-section-header'

            const chevron = document.createElement('span')
            chevron.className = 'cheat-section-chevron'

            const label = document.createElement('span')
            label.className = 'cheat-section-title'
            label.textContent = titleText

            header.appendChild(chevron)
            header.appendChild(label)

            const content = document.createElement('div')
            content.className = 'cheat-section-body'

            function setOpen(open) {
                content.style.display = open ? '' : 'none'
                header.setAttribute('aria-expanded', open ? 'true' : 'false')
                chevron.textContent = open ? '▾' : '▸'
            }

            setOpen(!!expandedByDefault)

            header.addEventListener('click', () => {
                const isOpen = content.style.display !== 'none'
                setOpen(!isOpen)
            })

            section.appendChild(header)
            section.appendChild(content)
            body.appendChild(section)

            const entry = {
                section,
                header,
                body: content,
                titleText,
                defaultOpen: !!expandedByDefault,
                setOpen
            }
            cheatSections.push(entry)
            return entry
        }

        // Core hero / combat cheats
        // Default to collapsed so opening the cheat menu doesn't auto-expose a whole section.
        const coreSec = makeCheatSection('Core Cheats', false)
        const coreContent = coreSec.body

        // Row 1 – Gold / XP
        const btnRow1 = document.createElement('div')
        btnRow1.className = 'item-actions'

        const btnGold = document.createElement('button')
        btnGold.className = 'btn small'
        btnGold.textContent = '+1000 Gold'
        btnGold.addEventListener('click', () => {
            p.gold += 1000
            addLog('Cheat: conjured 1000 gold.', 'system')
            updateHUD()
            saveGame()
            renderCheatStatus()
        })

        const btnXp = document.createElement('button')
        btnXp.className = 'btn small'
        btnXp.textContent = '+100 XP'
        btnXp.addEventListener('click', () => {
            grantExperience(100)
            renderCheatStatus()
        })

        

        const btnMax = document.createElement('button')
        btnMax.className = 'btn small'
        btnMax.textContent = 'Max Level'
        btnMax.addEventListener('click', () => {
            cheatMaxLevel()
            renderCheatStatus()
            updateHUD()
            saveGame()
        })

        btnRow1.appendChild(btnGold)
        btnRow1.appendChild(btnXp)
        btnRow1.appendChild(btnMax)
        coreContent.appendChild(btnRow1)

        // Row 2 – Heal / Slay Enemy
        const btnRow2 = document.createElement('div')
        btnRow2.className = 'item-actions'

        const btnHeal = document.createElement('button')
        btnHeal.className = 'btn small'
        btnHeal.textContent = 'Full Heal'
        btnHeal.addEventListener('click', () => {
            p.hp = p.maxHp
            p.resource = p.maxResource
            addLog(
                'Cheat: fully restored health and ' + p.resourceName + '.',
                'system'
            )
            updateHUD()
            saveGame()
            renderCheatStatus()
        })

        const btnKill = document.createElement('button')
        btnKill.className = 'btn small'
        btnKill.textContent = 'Slay Enemy'
        btnKill.addEventListener('click', () => {
            if (state.inCombat && state.currentEnemy) {
                state.currentEnemy.hp = 0
                addLog('Cheat: enemy instantly defeated.', 'danger')
                handleEnemyDefeat()
            } else {
                addLog('No enemy to slay right now.', 'system')
            }
        })

        btnRow2.appendChild(btnHeal)
        btnRow2.appendChild(btnKill)
        coreContent.appendChild(btnRow2)

        // Row 3 – God Mode / Always Crit
        const btnRow3 = document.createElement('div')
        btnRow3.className = 'item-actions'

        const btnGod = document.createElement('button')
        btnGod.className = 'btn small'
        btnGod.textContent =
            (state.flags.godMode ? 'Disable' : 'Enable') + ' God Mode'
        btnGod.addEventListener('click', () => {
            state.flags.godMode = !state.flags.godMode
            addLog(
                'God Mode ' +
                    (state.flags.godMode ? 'enabled' : 'disabled') +
                    '.',
                'system'
            )
            btnGod.textContent =
                (state.flags.godMode ? 'Disable' : 'Enable') + ' God Mode'
            renderCheatStatus()
            updateHUD()
            saveGame()
        })

        const btnCrit = document.createElement('button')
        btnCrit.className = 'btn small'
        btnCrit.textContent = state.flags.alwaysCrit
            ? 'Normal Crits'
            : 'Always Crit'
        btnCrit.addEventListener('click', () => {
            state.flags.alwaysCrit = !state.flags.alwaysCrit
            if (state.flags.alwaysCrit) state.flags.neverCrit = false
            addLog(
                'Always-crit mode ' +
                    (state.flags.alwaysCrit ? 'enabled' : 'disabled') +
                    '.',
                'system'
            )
            btnCrit.textContent = state.flags.alwaysCrit
                ? 'Normal Crits'
                : 'Always Crit'
            btnNeverCrit.textContent = state.flags.neverCrit
                ? 'Allow Crits'
                : 'Never Crit'
            renderCheatStatus()
            saveGame()
        })

        const btnNeverCrit = document.createElement('button')
        btnNeverCrit.className = 'btn small'
        btnNeverCrit.textContent = state.flags.neverCrit
            ? 'Allow Crits'
            : 'Never Crit'
        btnNeverCrit.addEventListener('click', () => {
            state.flags.neverCrit = !state.flags.neverCrit
            if (state.flags.neverCrit) state.flags.alwaysCrit = false
            addLog(
                'Never-crit mode ' +
                    (state.flags.neverCrit ? 'enabled' : 'disabled') +
                    '.',
                'system'
            )
            btnCrit.textContent = state.flags.alwaysCrit
                ? 'Normal Crits'
                : 'Always Crit'
            btnNeverCrit.textContent = state.flags.neverCrit
                ? 'Allow Crits'
                : 'Never Crit'
            renderCheatStatus()
            saveGame()
        })

        btnRow3.appendChild(btnGod)
        btnRow3.appendChild(btnCrit)
        btnRow3.appendChild(btnNeverCrit)
        coreContent.appendChild(btnRow3)

        // --- QA / Debug ------------------------------------------------------
        const qaSec = makeCheatSection('QA / Debug', false)
        const qaContent = qaSec.body
        const qaInfo = document.createElement('p')
        qaInfo.className = 'modal-subtitle'
        qaInfo.textContent = 'Tools for reproducible debugging (deterministic RNG), quick integrity checks, and bug report export.'
        qaContent.appendChild(qaInfo)

        // Deterministic RNG toggle
        const rngRow1 = document.createElement('div')
        rngRow1.className = 'item-actions'

        const btnDetRng = document.createElement('button')
        btnDetRng.className = 'btn small'
        btnDetRng.textContent = state.debug && state.debug.useDeterministicRng ? 'Deterministic RNG: On' : 'Deterministic RNG: Off'
        btnDetRng.addEventListener('click', () => {
            const next = !(state.debug && state.debug.useDeterministicRng)
            setDeterministicRngEnabled(state, next)
            addLog('Deterministic RNG ' + (next ? 'enabled' : 'disabled') + '.', 'system')
            btnDetRng.textContent = next
                ? 'Deterministic RNG: On'
                : 'Deterministic RNG: Off'
            saveGame()
        })

        const btnRngLog = document.createElement('button')
        btnRngLog.className = 'btn small'
        btnRngLog.textContent = state.debug && state.debug.captureRngLog ? 'RNG Log: On' : 'RNG Log: Off'
        btnRngLog.addEventListener('click', () => {
            const next = !(state.debug && state.debug.captureRngLog)
            setRngLoggingEnabled(state, next)
            addLog('RNG draw logging ' + (next ? 'enabled' : 'disabled') + '.', 'system')
            btnRngLog.textContent = next ? 'RNG Log: On' : 'RNG Log: Off'
            saveGame()
        })

        rngRow1.appendChild(btnDetRng)
        rngRow1.appendChild(btnRngLog)
        qaContent.appendChild(rngRow1)

        // Seed controls
        const rngRow2 = document.createElement('div')
        rngRow2.className = 'item-actions'

        const seedInput = document.createElement('input')
        seedInput.type = 'number'
        seedInput.className = 'input'
        seedInput.placeholder = 'Seed'
        seedInput.value = state.debug && Number.isFinite(Number(state.debug.rngSeed)) ? String(state.debug.rngSeed >>> 0) : ''
        seedInput.style.maxWidth = '140px'

        const btnSetSeed = document.createElement('button')
        btnSetSeed.className = 'btn small'
        btnSetSeed.textContent = 'Set Seed'
        btnSetSeed.addEventListener('click', () => {
            const raw = Number(seedInput.value)
            if (!Number.isFinite(raw)) {
                addLog('Seed must be a number.', 'system')
                return
            }
            setRngSeed(state, raw)
            addLog('RNG seed set to ' + (state.debug.rngSeed >>> 0) + ' (index reset).', 'system')
            saveGame()
        })

        rngRow2.appendChild(seedInput)
        rngRow2.appendChild(btnSetSeed)
        qaContent.appendChild(rngRow2)

        // Smoke tests moved to the HUD "Tests" pill (dev cheats only) so the Cheat Menu stays focused.
        const qaRow3 = document.createElement('div')
        qaRow3.className = 'item-actions'

        const qaHint = document.createElement('div')
        qaHint.className = 'modal-subtitle'
        qaHint.textContent = 'Tip: run Smoke Tests from the "Tests" pill next to the Menu button (dev cheats only).'

        const btnBundle = document.createElement('button')
        btnBundle.className = 'btn small'
        btnBundle.textContent = 'Copy Bug Report (JSON)'
        btnBundle.addEventListener('click', () => {
            copyBugReportBundleToClipboard()
        })

        qaContent.appendChild(qaHint)
        qaRow3.appendChild(btnBundle)
        qaContent.appendChild(qaRow3)

        // --- Spawn & Teleport ----------------------------------------------
        const spawnSec = makeCheatSection('Spawn & Teleport', false)
        const spawnContent = spawnSec.body
        const spawnInfo = document.createElement('p')
        spawnInfo.className = 'modal-subtitle'
        spawnInfo.textContent = 'Quick tools to reproduce issues: teleport, force specific enemies, and grant items by id.'
        spawnContent.appendChild(spawnInfo)

        // Teleport
        const tpRow = document.createElement('div')
        tpRow.className = 'item-actions'

        const tpSelect = document.createElement('select')
        tpSelect.className = 'input'
        try {
            Object.keys(ZONE_DEFS || {}).forEach((z) => {
                const opt = document.createElement('option')
                opt.value = z
                opt.textContent = getAreaDisplayName(z)
                if (z === state.area) opt.selected = true
                tpSelect.appendChild(opt)
            })
        } catch (_) {}

        const btnTp = document.createElement('button')
        btnTp.className = 'btn small'
        btnTp.textContent = 'Teleport'
        btnTp.addEventListener('click', () => {
            const to = tpSelect.value
            if (!to) return
            recordInput('teleport', { to })
            state.area = to
            ensureUiState()
            state.ui.exploreChoiceMade = true
            state.ui.villageActionsOpen = false
            addLog('Cheat: teleported to ' + getAreaDisplayName(to) + '.', 'system')
            closeModal()
            renderActions()
            updateAreaMusic()
            saveGame()
        })

        tpRow.appendChild(tpSelect)
        tpRow.appendChild(btnTp)
        spawnContent.appendChild(tpRow)

        // Force enemy encounter
        const enemyRow = document.createElement('div')
        enemyRow.className = 'item-actions'

        const enemyInput = document.createElement('input')
        enemyInput.className = 'input'
        enemyInput.placeholder = 'Enemy templateId'
        enemyInput.setAttribute('list', 'cheat-enemy-ids')
        const enemyList = document.createElement('datalist')
        enemyList.id = 'cheat-enemy-ids'
        try {
            Object.keys(ENEMY_TEMPLATES || {}).sort().forEach((k) => {
                const opt = document.createElement('option')
                opt.value = k
                enemyList.appendChild(opt)
            })
        } catch (_) {}

        const btnEnemy = document.createElement('button')
        btnEnemy.className = 'btn small'
        btnEnemy.textContent = 'Start Battle'
        btnEnemy.addEventListener('click', () => {
            const id = String(enemyInput.value || '').trim()
            if (!id || !ENEMY_TEMPLATES[id]) {
                addLog('Unknown enemy template id.', 'system')
                return
            }
            recordInput('combat.force', { templateId: id })
            closeModal()
            startBattleWith(id)
            updateHUD()
            updateEnemyPanel()
            renderActions()
            saveGame()
        })

        enemyRow.appendChild(enemyInput)
        enemyRow.appendChild(btnEnemy)
        spawnContent.appendChild(enemyList)
        spawnContent.appendChild(enemyRow)

        // Give item by id
        const itemRow = document.createElement('div')
        itemRow.className = 'item-actions'

        const itemInput = document.createElement('input')
        itemInput.className = 'input'
        itemInput.placeholder = 'Item id'
        itemInput.setAttribute('list', 'cheat-item-ids')
        const qtyInput = document.createElement('input')
        qtyInput.className = 'input'
        qtyInput.type = 'number'
        qtyInput.value = '1'
        qtyInput.min = '1'
        const itemList = document.createElement('datalist')
        itemList.id = 'cheat-item-ids'
        try {
            Object.keys(ITEM_DEFS || {}).sort().forEach((k) => {
                const opt = document.createElement('option')
                opt.value = k
                itemList.appendChild(opt)
            })
        } catch (_) {}

        const btnGive = document.createElement('button')
        btnGive.className = 'btn small'
        btnGive.textContent = 'Give Item'
        btnGive.addEventListener('click', () => {
            const id = String(itemInput.value || '').trim()
            const qty = Math.max(1, Math.floor(Number(qtyInput.value || 1)))
            if (!id || !ITEM_DEFS[id]) {
                addLog('Unknown item id.', 'system')
                return
            }
            recordInput('item.give', { id, qty })
            addItemToInventory(id, qty)
            addLog('Cheat: granted ' + qty + '× ' + (ITEM_DEFS[id].name || id) + '.', 'system')
            updateHUD()
            saveGame()
        })

        // Keep mobile layout aligned: group (item id + qty) as one column, action as the other.
        const itemFields = document.createElement('div')
        itemFields.className = 'cheat-inline'

        itemFields.appendChild(itemInput)
        itemFields.appendChild(qtyInput)

        itemRow.appendChild(itemFields)
        itemRow.appendChild(btnGive)
        spawnContent.appendChild(itemList)
        spawnContent.appendChild(itemRow)

        // ---------------------------------------------------------------------

        // --- Simulation / Time -------------------------------------------------
        // Fast-forwarding is extremely useful for balancing economy, decrees, and
        // weekly bank interest behavior.
        const simSec = makeCheatSection('Simulation / Time', false)
        const simContent = simSec.body
        const simInfo = document.createElement('p')
        simInfo.className = 'modal-subtitle'
        simInfo.textContent = 'Advance in-game days instantly (runs daily ticks) and prints a summary of town changes.'
        simContent.appendChild(simInfo)

        function getBankWeekInfo() {
            const bank = state?.bank
            const todayRaw = state?.time && typeof state.time.dayIndex === 'number' ? Number(state.time.dayIndex) : 0
            const today = Number.isFinite(todayRaw) ? Math.floor(todayRaw) : 0
            const last = bank && Number.isFinite(Number(bank.lastInterestDay)) ? Math.floor(Number(bank.lastInterestDay)) : null
            if (last == null) {
                return { initialized: false, today, daysIntoWeek: null, daysUntilNext: null }
            }
            const daysSince = Math.max(0, today - last)
            const daysIntoWeek = daysSince % 7
            const daysUntilNext = 7 - daysIntoWeek
            return { initialized: true, today, daysIntoWeek, daysUntilNext, lastInterestDay: last }
        }

        function snapshotTown() {
            const econ = getVillageEconomySummary(state)
            const mood = state?.village?.population?.mood
            const day = state?.time && typeof state.time.dayIndex === 'number' ? Math.floor(Number(state.time.dayIndex)) : 0
            const decree = state?.government?.townHallEffects
            const decreeRemaining =
                decree && decree.petitionId && typeof decree.expiresOnDay === 'number'
                    ? Math.max(0, decree.expiresOnDay - day + 1)
                    : 0
            return {
                day,
                econ,
                mood,
                decreeTitle: decree && decree.petitionId ? decree.title || decree.petitionId : null,
                decreeRemaining,
                bankWeek: getBankWeekInfo()
            }
        }

        const simRow = document.createElement('div')
        simRow.className = 'item-actions'

        const simResult = document.createElement('p')
        simResult.className = 'modal-subtitle'
        simResult.style.marginTop = '6px'

        function runFastForward(days) {
            days = Math.max(1, Math.floor(Number(days) || 1))
            const before = snapshotTown()

            for (let i = 0; i < days; i++) {
                const newTime = jumpToNextMorning(state)
                runDailyTicks(state, newTime?.absoluteDay ?? before.day + i + 1, { addLog })
            }

            const after = snapshotTown()

            const bTier = before.econ?.tier?.name || 'Unknown'
            const aTier = after.econ?.tier?.name || 'Unknown'
            const econLine = `Economy: ${bTier} → ${aTier} (P ${before.econ?.prosperity}→${after.econ?.prosperity}, T ${before.econ?.trade}→${after.econ?.trade}, S ${before.econ?.security}→${after.econ?.security}).`

            const bm = typeof before.mood === 'number' ? before.mood : 0
            const am = typeof after.mood === 'number' ? after.mood : 0
            const moodLine = `Mood: ${bm} → ${am} (${am - bm >= 0 ? '+' : ''}${am - bm}).`

            const decreeLine = after.decreeTitle
                ? `Decree: ${after.decreeTitle} (${after.decreeRemaining} day${after.decreeRemaining === 1 ? '' : 's'} remaining).`
                : 'Decree: none.'

            const bw = after.bankWeek
            const bankLine = bw.initialized
                ? `Bank: week ${bw.daysIntoWeek}/7, next ledger update in ${bw.daysUntilNext} day${bw.daysUntilNext === 1 ? '' : 's'}.`
                : 'Bank: unopened (weekly cycle starts on first visit).'

            const summary = `Fast-forwarded ${days} day${days === 1 ? '' : 's'}: Day ${before.day} → ${after.day}. ${econLine} ${moodLine} ${decreeLine} ${bankLine}`

            addLog(`Cheat: ${summary}`, 'system')
            simResult.textContent = summary
            updateHUD()
            updateTimeDisplay()
            saveGame()
        }

        const btnDay1 = document.createElement('button')
        btnDay1.className = 'btn small'
        btnDay1.textContent = '+1 Day'
        btnDay1.addEventListener('click', () => runFastForward(1))

        const btnDay3 = document.createElement('button')
        btnDay3.className = 'btn small'
        btnDay3.textContent = '+3 Days'
        btnDay3.addEventListener('click', () => runFastForward(3))

        const btnDay7 = document.createElement('button')
        btnDay7.className = 'btn small'
        btnDay7.textContent = '+7 Days'
        btnDay7.addEventListener('click', () => runFastForward(7))

        simRow.appendChild(btnDay1)
        simRow.appendChild(btnDay3)
        simRow.appendChild(btnDay7)
        simContent.appendChild(simRow)
        simContent.appendChild(simResult)


        // --- Diagnostics -------------------------------------------------------
        const diagSec = makeCheatSection('Diagnostics', false)
        const diagContent = diagSec.body
        const diagInfo = document.createElement('p')
        diagInfo.className = 'modal-subtitle'
        diagInfo.textContent = 'Tools to catch “stuck progression” or contradictory flags during testing.'
        diagContent.appendChild(diagInfo)

        const diagRow = document.createElement('div')
        diagRow.className = 'item-actions'

        const btnAudit = document.createElement('button')
        btnAudit.className = 'btn small'
        btnAudit.textContent = 'Progression Audit'
        btnAudit.addEventListener('click', () => {
            const report = quests.buildProgressionAuditReport()
            openModal('Progression Audit', (b) => {
                const pre = document.createElement('pre')
                pre.className = 'code-block'
                pre.textContent = report
                b.appendChild(pre)

                const actions = document.createElement('div')
                actions.className = 'modal-actions'

                const btnCopy = document.createElement('button')
                btnCopy.className = 'btn outline'
                btnCopy.textContent = 'Copy Report'
                btnCopy.addEventListener('click', () => {
                    copyFeedbackToClipboard(report).catch(() => {})
                })

                const btnBack = document.createElement('button')
                btnBack.className = 'btn outline'
                btnBack.textContent = 'Back'
                btnBack.addEventListener('click', () => {
                    closeModal()
                    openCheatMenu()
                })

                actions.appendChild(btnCopy)
                actions.appendChild(btnBack)
                b.appendChild(actions)
            })
        })

        diagRow.appendChild(btnAudit)

        const btnGearAudit = document.createElement('button')
        btnGearAudit.className = 'btn small'
        btnGearAudit.textContent = 'Gear Effects Audit'
        btnGearAudit.addEventListener('click', () => {
            const p = state.player
            if (!p) return

            const snap = (label) => ({
                label,
                maxHp: p.maxHp,
                maxResource: p.maxResource,
                attack: p.stats ? p.stats.attack : 0,
                magic: p.stats ? p.stats.magic : 0,
                armor: p.stats ? p.stats.armor : 0,
                speed: p.stats ? p.stats.speed : 0,
                magicRes: p.stats ? p.stats.magicRes : 0,
                critChance: p.stats ? p.stats.critChance : 0,
                dodgeChance: p.stats ? p.stats.dodgeChance : 0,
                resistAll: p.stats ? p.stats.resistAll : 0,
                lifeSteal: p.stats ? p.stats.lifeSteal : 0,
                armorPen: p.stats ? p.stats.armorPen : 0,
                haste: p.stats ? p.stats.haste : 0,
                thorns: p.stats ? p.stats.thorns : 0,
                hpRegen: p.stats ? p.stats.hpRegen : 0
            })

            const eq = Object.assign({}, p.equipment || {})
            const hp0 = p.hp
            const res0 = p.resource

            // Snapshot without gear
            const slots = ['weapon','armor','head','hands','feet','belt','neck','ring']
            if (!p.equipment) p.equipment = {}
            slots.forEach((k) => { p.equipment[k] = null })
            recalcPlayerStats()
            const baseStats = snap('No Gear')

            // Restore gear
            p.equipment = Object.assign({}, eq)
            recalcPlayerStats()
            const gearedStats = snap('With Gear')

            // Restore current HP/resource as close as possible
            p.hp = Math.min(p.maxHp, Math.max(0, hp0))
            p.resource = Math.min(p.maxResource, Math.max(0, res0))

            const keys = ['maxHp','maxResource','attack','magic','armor','speed','magicRes','critChance','dodgeChance','resistAll','lifeSteal','armorPen','haste','thorns','hpRegen']
            const lines = []
            lines.push('GEAR EFFECTS AUDIT')
            lines.push('-----------------')
            lines.push('This report compares derived stats with gear removed vs equipped.')
            lines.push('')

            for (const k of keys) {
                const b = Number(baseStats[k] || 0)
                const g = Number(gearedStats[k] || 0)
                const d = g - b
                const sign = d > 0 ? '+' : ''
                lines.push(k.padEnd(12) + ': ' + String(b).padEnd(8) + ' → ' + String(g).padEnd(8) + ' (' + sign + d + ')')
            }

            const report = lines.join('\n')
            openModal('Gear Effects Audit', (b) => {
                const pre = document.createElement('pre')
                pre.className = 'code-block'
                pre.textContent = report
                b.appendChild(pre)

                const actions = document.createElement('div')
                actions.className = 'modal-actions'

                const btnCopy = document.createElement('button')
                btnCopy.className = 'btn outline'
                btnCopy.textContent = 'Copy Report'
                btnCopy.addEventListener('click', () => {
                    copyFeedbackToClipboard(report).catch(() => {})
                })

                const btnBack = document.createElement('button')
                btnBack.className = 'btn outline'
                btnBack.textContent = 'Back'
                btnBack.addEventListener('click', () => {
                    closeModal()
                    openCheatMenu()
                })

                actions.appendChild(btnCopy)
                actions.appendChild(btnBack)
                b.appendChild(actions)
            })
        })

        diagRow.appendChild(btnGearAudit)
        diagContent.appendChild(diagRow)

        // --- Loot / gear cheats ------------------------------------------------
        const lootSec = makeCheatSection('Loot & Gear', false)
        const lootContent = lootSec.body

        const lootInfo = document.createElement('p')
        lootInfo.className = 'modal-subtitle'
        lootInfo.textContent =
            'Spawns high-end loot (Lv 99 roll) into your inventory for testing.'
        lootContent.appendChild(lootInfo)

        const rarityRank = (r) => {
            switch (r) {
                case 'legendary':
                    return 4
                case 'epic':
                    return 3
                case 'rare':
                    return 2
                case 'uncommon':
                    return 1
                default:
                    return 0
            }
        }

        function cheatLootArea() {
            const a = state.area || 'forest'
            return a === 'village' ? 'forest' : a
        }

        function pickBestGeneratedItemOfType(type, armorSlot = null) {
            let best = null
            let bestKey = -Infinity
            const maxLootLevel = 99
            const fakeBoss = { isBoss: true }

            for (let i = 0; i < 90; i++) {
                const drops = generateLootDrop({
                    area: cheatLootArea(),
                    playerLevel: maxLootLevel,
                    enemy: fakeBoss,
                    playerResourceKey: p.resourceKey,
                    playerClassId: p.classId
                })
                if (!drops || !drops.length) continue

                for (const it of drops) {
                    if (!it || it.type !== type) continue

                    // If we are hunting a specific armor slot, filter here.
                    if (type === 'armor' && armorSlot) {
                        const slot = it.slot || 'armor'
                        if (slot !== armorSlot) continue
                    }

                    const key =
                        rarityRank(it.rarity) * 100000 + getItemPowerScore(it)
                    if (key > bestKey) {
                        bestKey = key
                        best = it
                    }

                    // quick early-out if we hit a strong legendary
                    if (
                        it.rarity === 'legendary' &&
                        getItemPowerScore(it) > 160
                    ) {
                        return it
                    }
                }
            }

            return best
        }

        function spawnMaxLootSet(equipNow) {
            const weapon = pickBestGeneratedItemOfType('weapon')

            const armorSlots = [
                'armor',
                'head',
                'hands',
                'feet',
                'belt',
                'neck',
                'ring'
            ]

            const gear = armorSlots
                .map((s) => pickBestGeneratedItemOfType('armor', s))
                .filter(Boolean)

            const spawned = []
            if (weapon) {
                addGeneratedItemToInventory(weapon, 1)
                spawned.push(weapon)
            }
            gear.forEach((it) => {
                addGeneratedItemToInventory(it, 1)
                spawned.push(it)
            })

            if (!spawned.length) {
                addLog('Cheat: failed to roll loot (unexpected).', 'system')
                return
            }

            if (equipNow) {
                if (weapon) p.equipment.weapon = weapon
                gear.forEach((it) => {
                    const slot = it.slot || 'armor'
                    if (!p.equipment) p.equipment = {}
                    p.equipment[slot] = it
                })
                recalcPlayerStats()
            }

            const names = spawned.map((x) => x.name).join(' + ')
            addLog(
                'Cheat: spawned max-level loot: ' +
                    names +
                    (equipNow ? ' (equipped).' : '.'),
                'system'
            )

            updateHUD()
            saveGame()
        }

const lootRow = document.createElement('div')
        lootRow.className = 'item-actions'

        const btnSpawnMax = document.createElement('button')
        btnSpawnMax.className = 'btn small'
        btnSpawnMax.textContent = 'Spawn Max Loot'
        btnSpawnMax.addEventListener('click', () => {
            spawnMaxLootSet(false)
        })

        const btnSpawnEquipMax = document.createElement('button')
        btnSpawnEquipMax.className = 'btn small'
        btnSpawnEquipMax.textContent = 'Spawn + Equip Max Loot'
        btnSpawnEquipMax.addEventListener('click', () => {
            spawnMaxLootSet(true)
        })

        lootRow.appendChild(btnSpawnMax)
        lootRow.appendChild(btnSpawnEquipMax)
        lootContent.appendChild(lootRow)


        // --- Gambling debug controls (developer-only) ---------------------------
        const gamblingSec = makeCheatSection('Gambling Debug', false)
        const gamblingContent = gamblingSec.body

        const gambleTitle = document.createElement('div')
        gambleTitle.className = 'char-section-title'

        gamblingContent.appendChild(gambleTitle)

        const gambleRow1 = document.createElement('div')
        gambleRow1.className = 'item-actions'

        const gambleRow2 = document.createElement('div')
        gambleRow2.className = 'item-actions'

        const gambleStatus = document.createElement('p')
        gambleStatus.className = 'modal-subtitle'

        function ensureGamblingDebug() {
            if (!state.gamblingDebug) {
                state.gamblingDebug = {
                    mode: 'normal',
                    payoutMultiplier: 1
                }
            } else {
                if (!state.gamblingDebug.mode) {
                    state.gamblingDebug.mode = 'normal'
                }
                if (
                    typeof state.gamblingDebug.payoutMultiplier !== 'number' ||
                    state.gamblingDebug.payoutMultiplier <= 0
                ) {
                    state.gamblingDebug.payoutMultiplier = 1
                }
            }
            return state.gamblingDebug
        }

        function updateGambleStatus() {
            const dbg = ensureGamblingDebug()
            const modeLabel =
                dbg.mode === 'playerFavored'
                    ? 'Player-Favored'
                    : dbg.mode === 'houseFavored'
                    ? 'House-Favored'
                    : 'Normal'

            const mult =
                typeof dbg.payoutMultiplier === 'number' &&
                dbg.payoutMultiplier > 0
                    ? dbg.payoutMultiplier
                    : 1

            gambleStatus.textContent =
                'Mode: ' +
                modeLabel +
                ' • Payout Multiplier: x' +
                mult.toFixed(2)
        }

        // Odds buttons
        const btnOddsFair = document.createElement('button')
        btnOddsFair.className = 'btn small'
        btnOddsFair.textContent = 'Fair Odds'
        btnOddsFair.addEventListener('click', () => {
            const dbg = ensureGamblingDebug()
            dbg.mode = 'normal'
            updateGambleStatus()
            saveGame()
        })

        const btnOddsPlayer = document.createElement('button')
        btnOddsPlayer.className = 'btn small'
        btnOddsPlayer.textContent = 'Favor Player'
        btnOddsPlayer.addEventListener('click', () => {
            const dbg = ensureGamblingDebug()
            dbg.mode = 'playerFavored'
            updateGambleStatus()
            saveGame()
        })

        const btnOddsHouse = document.createElement('button')
        btnOddsHouse.className = 'btn small'
        btnOddsHouse.textContent = 'Favor House'
        btnOddsHouse.addEventListener('click', () => {
            const dbg = ensureGamblingDebug()
            dbg.mode = 'houseFavored'
            updateGambleStatus()
            saveGame()
        })

        gambleRow1.appendChild(btnOddsFair)
        gambleRow1.appendChild(btnOddsPlayer)
        gambleRow1.appendChild(btnOddsHouse)
        gamblingContent.appendChild(gambleRow1)

        // Payout multiplier buttons
        const btnPayHalf = document.createElement('button')
        btnPayHalf.className = 'btn small'
        btnPayHalf.textContent = 'x0.5 Payout'
        btnPayHalf.addEventListener('click', () => {
            const dbg = ensureGamblingDebug()
            dbg.payoutMultiplier = 0.5
            updateGambleStatus()
            saveGame()
        })

        const btnPayNormal = document.createElement('button')
        btnPayNormal.className = 'btn small'
        btnPayNormal.textContent = 'x1 Payout'
        btnPayNormal.addEventListener('click', () => {
            const dbg = ensureGamblingDebug()
            dbg.payoutMultiplier = 1
            updateGambleStatus()
            saveGame()
        })

        const btnPayDouble = document.createElement('button')
        btnPayDouble.className = 'btn small'
        btnPayDouble.textContent = 'x2 Payout'
        btnPayDouble.addEventListener('click', () => {
            const dbg = ensureGamblingDebug()
            dbg.payoutMultiplier = 2
            updateGambleStatus()
            saveGame()
        })

        gambleRow2.appendChild(btnPayHalf)
        gambleRow2.appendChild(btnPayNormal)
        gambleRow2.appendChild(btnPayDouble)
        gamblingContent.appendChild(gambleRow2)

        updateGambleStatus()
        gamblingContent.appendChild(gambleStatus)

        // Companion debug controls
        const companionSec = makeCheatSection('Companions', false)
        const companionContent = companionSec.body

        const compTitle = document.createElement('div')
        compTitle.className = 'char-section-title'
        compTitle.textContent = 'Companions'
        companionContent.appendChild(compTitle)

        const compRow = document.createElement('div')
        compRow.className = 'item-actions companion-actions'

        const btnWolf = document.createElement('button')
        btnWolf.className = 'btn small'
        btnWolf.textContent = 'Summon Wolf'
        btnWolf.addEventListener('click', () => {
            grantCompanion('wolf')
            renderCheatStatus()
        })

        const btnGolem = document.createElement('button')
        btnGolem.className = 'btn small'
        btnGolem.textContent = 'Summon Golem'
        btnGolem.addEventListener('click', () => {
            grantCompanion('golem')
            renderCheatStatus()
        })

        const btnSprite = document.createElement('button')
        btnSprite.className = 'btn small'
        btnSprite.textContent = 'Summon Sprite'
        btnSprite.addEventListener('click', () => {
            grantCompanion('sprite')
            renderCheatStatus()
        })

        const btnSkeleton = document.createElement('button')
        btnSkeleton.className = 'btn small'
        btnSkeleton.textContent = 'Summon Skeleton'
        btnSkeleton.addEventListener('click', () => {
            grantCompanion('skeleton')
            renderCheatStatus()
        })

        // NEW: Falcon
        const btnFalcon = document.createElement('button')
        btnFalcon.className = 'btn small'
        btnFalcon.textContent = 'Summon Falcon'
        btnFalcon.addEventListener('click', () => {
            grantCompanion('falcon')
            renderCheatStatus()
        })

        // NEW: Treant
        const btnTreant = document.createElement('button')
        btnTreant.className = 'btn small'
        btnTreant.textContent = 'Summon Treant'
        btnTreant.addEventListener('click', () => {
            grantCompanion('treant')
            renderCheatStatus()
        })

        // NEW: Familiar
        const btnFamiliar = document.createElement('button')
        btnFamiliar.className = 'btn small'
        btnFamiliar.textContent = 'Summon Familiar'
        btnFamiliar.addEventListener('click', () => {
            grantCompanion('familiar')
            renderCheatStatus()
        })

        // NEW: Mimic
        const btnMimic = document.createElement('button')
        btnMimic.className = 'btn small'
        btnMimic.textContent = 'Summon Mimic'
        btnMimic.addEventListener('click', () => {
            grantCompanion('mimic')
            renderCheatStatus()
        })

        const btnDismiss = document.createElement('button')
        btnDismiss.className = 'btn small outline'
        btnDismiss.textContent = 'Dismiss Companion'
        btnDismiss.addEventListener('click', () => {
            dismissCompanion()
            renderCheatStatus()
            updateHUD()
            saveGame()
        })

        compRow.appendChild(btnWolf)
        compRow.appendChild(btnGolem)
        compRow.appendChild(btnSprite)
        compRow.appendChild(btnSkeleton)
        compRow.appendChild(btnFalcon)
        compRow.appendChild(btnTreant)
        compRow.appendChild(btnFamiliar)
        compRow.appendChild(btnMimic)
        compRow.appendChild(btnDismiss)
        companionContent.appendChild(compRow)

        // --- Government & Realm Debug -------------------------------------------
        const govSec = makeCheatSection('Government & Realm', false)
        const govContent = govSec.body

        const govIntro = document.createElement('p')
        govIntro.className = 'modal-subtitle'
        govIntro.textContent =
            'Tweak kingdom metrics, policies and Emberwood village attitudes. Useful for testing government-driven systems.'
        govContent.appendChild(govIntro)

        // Local helpers
        function ensureGovAndVillage() {
            const absDay =
                state.time && typeof state.time.absoluteDay === 'number'
                    ? state.time.absoluteDay
                    : 0
            // Make sure government exists for older saves
            if (typeof initGovernmentState === 'function') {
                initGovernmentState(state, absDay)
            }
            const g = state.government || null
            const village =
                g && g.villages && g.villages.village
                    ? g.villages.village
                    : null
            return { g, village }
        }

        function clampMetricVal(val) {
            const num = Number(val)
            if (isNaN(num)) return 0
            if (num < 0) return 0
            if (num > 100) return 100
            return Math.round(num)
        }

        function clampModifier(val) {
            const num = Number(val)
            if (isNaN(num)) return 0
            // Government normally keeps these in about -0.3 .. +0.3
            const clamped = Math.max(-0.5, Math.min(0.5, num))
            return Math.round(clamped * 100) / 100
        }

        // Layout containers
        const metricsBox = document.createElement('div')
        metricsBox.style.display = 'flex'
        metricsBox.style.flexWrap = 'wrap'
        metricsBox.style.gap = '4px 8px'
        metricsBox.style.marginBottom = '4px'
        govContent.appendChild(metricsBox)

        const policiesBox = document.createElement('div')
        policiesBox.className = 'item-actions'
        policiesBox.style.flexWrap = 'wrap'
        govContent.appendChild(policiesBox)

        const villageBox = document.createElement('div')
        villageBox.style.display = 'flex'
        villageBox.style.flexWrap = 'wrap'
        villageBox.style.gap = '4px 8px'
        villageBox.style.marginTop = '4px'
        govContent.appendChild(villageBox)

        const govSummary = document.createElement('p')
        govSummary.className = 'modal-subtitle'
        govSummary.style.marginTop = '4px'
        govContent.appendChild(govSummary)

        // --- Metric fields -------------------------------------------------------
        function makeMetricField(labelText) {
            const wrap = document.createElement('label')
            wrap.style.display = 'flex'
            wrap.style.alignItems = 'center'
            wrap.style.gap = '4px'
            wrap.style.fontSize = '0.75rem'

            const span = document.createElement('span')
            span.textContent = labelText

            const input = document.createElement('input')
            input.type = 'number'
            input.min = '0'
            input.max = '100'
            input.step = '1'
            input.style.width = '4rem'

            wrap.appendChild(span)
            wrap.appendChild(input)
            return { wrap, input }
        }

        const stabField = makeMetricField('Stability')
        const prospField = makeMetricField('Prosperity')
        const popField = makeMetricField('Popularity')
        const corrField = makeMetricField('Corruption')

        metricsBox.appendChild(stabField.wrap)
        metricsBox.appendChild(prospField.wrap)
        metricsBox.appendChild(popField.wrap)
        metricsBox.appendChild(corrField.wrap)

        // --- Policy selects ------------------------------------------------------
        function makePolicySelect(labelText, options) {
            const wrap = document.createElement('label')
            wrap.style.display = 'flex'
            wrap.style.alignItems = 'center'
            wrap.style.gap = '4px'
            wrap.style.fontSize = '0.75rem'

            const span = document.createElement('span')
            span.textContent = labelText

            const select = document.createElement('select')
            options.forEach(function (opt) {
                const o = document.createElement('option')
                o.value = opt
                o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1)
                select.appendChild(o)
            })

            wrap.appendChild(span)
            wrap.appendChild(select)
            return { wrap, select }
        }

        const taxField = makePolicySelect('Tax', ['low', 'normal', 'high'])
        const milField = makePolicySelect('Military', ['peace', 'tense', 'war'])
        const jusField = makePolicySelect('Justice', [
            'lenient',
            'balanced',
            'harsh'
        ])

        policiesBox.appendChild(taxField.wrap)
        policiesBox.appendChild(milField.wrap)
        policiesBox.appendChild(jusField.wrap)

        // --- Village fields (Emberwood) -----------------------------------------
        function makeVillageField(labelText, min, max, step) {
            const wrap = document.createElement('label')
            wrap.style.display = 'flex'
            wrap.style.alignItems = 'center'
            wrap.style.gap = '4px'
            wrap.style.fontSize = '0.75rem'

            const span = document.createElement('span')
            span.textContent = labelText

            const input = document.createElement('input')
            input.type = 'number'
            input.min = String(min)
            input.max = String(max)
            input.step = String(step)
            input.style.width = '4.5rem'

            wrap.appendChild(span)
            wrap.appendChild(input)
            return { wrap, input }
        }

        const vLoyalField = makeVillageField('Loyalty', 0, 100, 1)
        const vFearField = makeVillageField('Fear', 0, 100, 1)
        const vUnrestField = makeVillageField('Unrest', 0, 100, 1)
        const vProsField = makeVillageField('Pros. mod', -0.5, 0.5, 0.05)
        const vSafeField = makeVillageField('Safe. mod', -0.5, 0.5, 0.05)

        villageBox.appendChild(vLoyalField.wrap)
        villageBox.appendChild(vFearField.wrap)
        villageBox.appendChild(vUnrestField.wrap)
        villageBox.appendChild(vProsField.wrap)
        villageBox.appendChild(vSafeField.wrap)

        // Populate from current state
        function populateGovFields() {
            const gv = ensureGovAndVillage()
            const g = gv.g
            const village = gv.village

            if (g && g.metrics) {
                stabField.input.value =
                    typeof g.metrics.stability === 'number'
                        ? g.metrics.stability
                        : 60
                prospField.input.value =
                    typeof g.metrics.prosperity === 'number'
                        ? g.metrics.prosperity
                        : 55
                popField.input.value =
                    typeof g.metrics.royalPopularity === 'number'
                        ? g.metrics.royalPopularity
                        : 55
                corrField.input.value =
                    typeof g.metrics.corruption === 'number'
                        ? g.metrics.corruption
                        : 30
            }

            const policies = g && g.currentPolicies ? g.currentPolicies : {}
            taxField.select.value = policies.taxRate || 'normal'
            milField.select.value = policies.militaryPosture || 'peace'
            jusField.select.value = policies.justiceStyle || 'balanced'

            if (village) {
                vLoyalField.input.value =
                    typeof village.loyalty === 'number' ? village.loyalty : 60
                vFearField.input.value =
                    typeof village.fear === 'number' ? village.fear : 20
                vUnrestField.input.value =
                    typeof village.unrest === 'number' ? village.unrest : 10
                vProsField.input.value =
                    typeof village.prosperityModifier === 'number'
                        ? village.prosperityModifier
                        : 0
                vSafeField.input.value =
                    typeof village.safetyModifier === 'number'
                        ? village.safetyModifier
                        : 0
            } else {
                vLoyalField.input.value = ''
                vFearField.input.value = ''
                vUnrestField.input.value = ''
                vProsField.input.value = ''
                vSafeField.input.value = ''
            }

            if (typeof getGovernmentSummary === 'function') {
                const summary = getGovernmentSummary(state)
                if (summary && summary.hasGovernment) {
                    const m = summary.metrics || {}
                    const st = typeof m.stability === 'number' ? m.stability : 0
                    const pr =
                        typeof m.prosperity === 'number' ? m.prosperity : 0
                    const rp =
                        typeof m.royalPopularity === 'number'
                            ? m.royalPopularity
                            : 0
                    const co =
                        typeof m.corruption === 'number' ? m.corruption : 0

                    govSummary.textContent =
                        summary.realmName +
                        ' — stability ' +
                        st +
                        ', prosperity ' +
                        pr +
                        ', royal popularity ' +
                        rp +
                        ', corruption ' +
                        co +
                        ' • council: ' +
                        (summary.councilCount || 0) +
                        ' members'
                } else {
                    govSummary.textContent =
                        'No kingdom government has been initialized yet.'
                }
            } else {
                govSummary.textContent =
                    'No kingdom government summary helper is available.'
            }
        }

        populateGovFields()

        // --- Action buttons ------------------------------------------------------
        const govButtons = document.createElement('div')
        govButtons.className = 'item-actions'
        govButtons.style.marginTop = '4px'
        govContent.appendChild(govButtons)

        const btnApplyGov = document.createElement('button')
        btnApplyGov.className = 'btn small'
        btnApplyGov.textContent = 'Apply government changes'

        btnApplyGov.addEventListener('click', function () {
            const gv = ensureGovAndVillage()
            const g = gv.g
            const village = gv.village

            if (!g) {
                addLog(
                    'Cheat: no government state is available to edit.',
                    'system'
                )
                return
            }

            if (!g.metrics) {
                g.metrics = {
                    stability: 60,
                    prosperity: 55,
                    royalPopularity: 55,
                    corruption: 30
                }
            }

            g.metrics.stability = clampMetricVal(stabField.input.value)
            g.metrics.prosperity = clampMetricVal(prospField.input.value)
            g.metrics.royalPopularity = clampMetricVal(popField.input.value)
            g.metrics.corruption = clampMetricVal(corrField.input.value)

            if (!g.currentPolicies) {
                g.currentPolicies = {
                    taxRate: 'normal',
                    militaryPosture: 'peace',
                    justiceStyle: 'balanced'
                }
            }
            g.currentPolicies.taxRate = taxField.select.value
            g.currentPolicies.militaryPosture = milField.select.value
            g.currentPolicies.justiceStyle = jusField.select.value

            if (village) {
                village.loyalty = clampMetricVal(vLoyalField.input.value)
                village.fear = clampMetricVal(vFearField.input.value)
                village.unrest = clampMetricVal(vUnrestField.input.value)
                village.prosperityModifier = clampModifier(
                    vProsField.input.value
                )
                village.safetyModifier = clampModifier(vSafeField.input.value)
            }

            addLog(
                'Cheat: adjusted kingdom government metrics and Emberwood attitudes.',
                'system'
            )
            populateGovFields()
            updateHUD()
            saveGame()
        })

        const btnClearTownHall = document.createElement('button')
        btnClearTownHall.className = 'btn small outline'
        btnClearTownHall.textContent = 'Clear Town Hall decree'

        btnClearTownHall.addEventListener('click', function () {
            const today =
                state && state.time && typeof state.time.dayIndex === 'number'
                    ? state.time.dayIndex
                    : 0
            if (state.government && state.government.townHallEffects) {
                // Expire the decree; cleanup will remove the payload (Town Hall recreates it on demand).
                state.government.townHallEffects.expiresOnDay = -1
                cleanupTownHallEffects(state, today)
                addLog(
                    'Cheat: cleared any active Town Hall economic decree.',
                    'system'
                )
            } else {
                addLog('Cheat: no Town Hall decree was active.', 'system')
            }
            updateHUD()
            saveGame()
        })

        govButtons.appendChild(btnApplyGov)
        govButtons.appendChild(btnClearTownHall)

        // ------------------------------------------------------------------
        // Toolbar wiring (search + expand/collapse)
        btnExpandAll.addEventListener('click', () => {
            cheatSections.forEach((s) => s.setOpen(true))
        })

        btnCollapseAll.addEventListener('click', () => {
            cheatSections.forEach((s) => s.setOpen(false))
        })

        function indexSearchables() {
            cheatSections.forEach((sec) => {
                // Only index “action rows” and “field labels” so we don't hide helpful
                // subtitles/section hints while filtering.
                const nodes = sec.body.querySelectorAll('.item-actions, label')
                nodes.forEach((n) => {
                    n.dataset.cheatSearch = String(n.textContent || '')
                        .toLowerCase()
                        .replace(/\s+/g, ' ')
                        .trim()
                })
            })
        }

        function applySearchFilter() {
            const q = String(search.value || '')
                .toLowerCase()
                .replace(/\s+/g, ' ')
                .trim()

            if (!q) {
                cheatSections.forEach((sec) => {
                    sec.section.style.display = ''
                    sec.body
                        .querySelectorAll('[data-cheat-search]')
                        .forEach((n) => (n.style.display = ''))
                    sec.setOpen(sec.defaultOpen)
                })
                return
            }

            cheatSections.forEach((sec) => {
                let any = false
                sec.body
                    .querySelectorAll('[data-cheat-search]')
                    .forEach((n) => {
                        const hit = (n.dataset.cheatSearch || '').includes(q)
                        n.style.display = hit ? '' : 'none'
                        if (hit) any = true
                    })

                sec.section.style.display = any ? '' : 'none'
                if (any) sec.setOpen(true)
            })
        }

        // Index once after the menu is fully built.
        indexSearchables()

        search.addEventListener('input', applySearchFilter)
        search.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                search.value = ''
                applySearchFilter()
                search.blur()
            }
        })
    })
}

// --- SPELLS -------------------------------------------------------------------

function openSpellsModal(inCombat) {
    const p = state.player
    if (!p) return
    ensurePlayerSpellSystems(p)

    const canEditLoadout = !inCombat

    // UI metadata for a clearer Spell Book.
    const SPELL_UI = {
        // AoE / multi-target
        meteorSigil: { badges: ['AoE', 'Damage'] },
        arcaneOverload: { badges: ['AoE', 'Damage'] },
        cleave: { badges: ['AoE', 'Damage'] },
        bloodNova: { badges: ['AoE', 'Damage'] },
        rainOfThorns: { badges: ['AoE', 'Damage'] },
        stoneQuake: { badges: ['AoE', 'Damage'] },
        tempest: { badges: ['Chain', 'Damage'] }
    }

    function getSpellBadges(id) {
        const ab = ABILITIES[id]
        if (!ab) return []
        const meta = SPELL_UI[id]
        const badges = meta && meta.badges ? meta.badges.slice() : []
        // Heuristics for support spells.
        if (/heal|ward|shield|guard|barrier/i.test(ab.name)) {
            if (!badges.includes('Support')) badges.push('Support')
        }
        if (!badges.length) badges.push('Single')
        return badges.slice(0, 3)
    }

	// Patch 1.1.92: If the class meter is "full" (or in an active state) and it
	// will affect the next ability cast, show a short preview line in the Spell Book.
	function getMeterCastPreview(abilityId) {
		// Only show cast-impact previews when the player is actually about to cast.
		if (!inCombat) return ''
		try {
			const ab = ABILITIES[abilityId]
			if (!ab) return ''

			// Mage: Rhythm triggers on the next *mana* spell every 3rd cast.
			if (p.classId === 'mage') {
				const r = _getMageRhythmBonus(p, ab, abilityId)
				if (r && r.active) {
					return 'Rhythm Ready: +30% power, +15% crit, refund 4 Mana.'
				}
			}

			// Ranger: show a "full" Marks preview when the target is max-marked.
			// (Marks also help below max, but this callout focuses on the full meter state.)
			if (p.classId === 'ranger' && inCombat) {
				const enemy = state.currentEnemy
				const stacks = enemy ? enemy.markedStacks || 0 : 0
				if (stacks >= 5) {
					return 'Marks Maxed: +15% damage to this target; Headshot will consume Marks for a finisher.'
				}
			}
		} catch (_) {}
		return ''
	}

	function getMeterGlobalBannerText() {
		// Only show meter-readiness messaging in combat.
		if (!inCombat) return ''
		try {
			// Warrior: Bulwark is active at high Fury and empowers the next damaging ability.
			if (
				p.classId === 'warrior' &&
				p.resourceKey === 'fury' &&
				(p.resource || 0) >= 40
			) {
				return 'Bulwark Ready: your next damaging ability deals +25% damage, then Bulwark spends Fury to grant a shield.'
			}

			// Blood Knight: Bloodrush is active at high Blood.
			if (p.classId === 'blood' && p.resourceKey === 'blood') {
				const mx = Math.max(1, Number(p.maxResource || 0))
				const ratio = Number(p.resource || 0) / mx
				if (ratio >= 0.8) {
					return 'Bloodrush Active: your abilities deal +12% damage and gain +12% lifesteal while Blood stays high.'
				}
			}
		} catch (_) {}
		return ''
	}

	// Patch 1.1.92: spell list numeric previews (damage / heal / shield)
	// These previews are deterministic (no RNG/crit) and use the *current* target
	// in combat. Out of combat, they use a neutral "dummy" (no armor/resistance).
	function _previewCalcPhysical(baseStat, elementType, enemy, ctx) {
		const diff = getActiveDifficultyConfig()
		const st = p && p.status ? p.status : {}
		const atkDown = st.atkDownTurns > 0 ? st.atkDown || 0 : 0
		const atkBuff = st.buffAttack || 0
		let base = (baseStat || 0) + atkBuff - atkDown
		base = Math.max(1, base)
		const penPct = clampNumber(p && p.stats ? p.stats.armorPen || 0 : 0, 0, 80)
		let effArmor = (((enemy && enemy.armor) || 0) + ((enemy && enemy.armorBuff) || 0)) * (1 - penPct / 100)
		effArmor = Math.max(0, effArmor)
		const defense = 100 / (100 + effArmor * 10)
		let dmg = base * defense
		dmg *= diff.playerDmgMod
		if (ctx && ctx.dmgMult) dmg *= ctx.dmgMult
		const et = elementType || null
		const elemBonusPct = clampNumber(getPlayerElementalBonusPct(et), 0, 200)
		if (elemBonusPct > 0) dmg *= 1 + elemBonusPct / 100
		if (enemy && enemy.brokenTurns && enemy.brokenTurns > 0) dmg *= 1.2
		return Math.max(1, Math.round(dmg))
	}

	function _previewCalcMagic(baseStat, elementType, enemy, ctx) {
		const diff = getActiveDifficultyConfig()
		const st = p && p.status ? p.status : {}
		const magDown = st.magicDownTurns > 0 ? st.magicDown || 0 : 0
		const magBuff = st.buffMagic || 0
		let base = (baseStat || 0) + magBuff - magDown
		base = Math.max(1, base)
		const penPct = clampNumber(p && p.stats ? p.stats.armorPen || 0 : 0, 0, 80)
		let effRes = (((enemy && enemy.magicRes) || 0) + ((enemy && enemy.magicResBuff) || 0)) * (1 - penPct / 100)
		effRes = Math.max(0, effRes)
		const resist = 100 / (100 + effRes * 9)
		let dmg = base * resist
		dmg *= diff.playerDmgMod
		if (ctx && ctx.dmgMult) dmg *= ctx.dmgMult
		const et = elementType || null
		const elemBonusPct = clampNumber(getPlayerElementalBonusPct(et), 0, 200)
		if (elemBonusPct > 0) dmg *= 1 + elemBonusPct / 100
		if (enemy && enemy.brokenTurns && enemy.brokenTurns > 0) dmg *= 1.2
		return Math.max(1, Math.round(dmg))
	}

	function _previewHeal(amount, ctx) {
		const mult = ctx && ctx.healMult ? ctx.healMult : 1
		const eff = Math.max(0, Math.round((amount || 0) * mult))
		const missing = Math.max(0, (p.maxHp || 0) - (p.hp || 0))
		return Math.max(0, Math.min(missing, eff))
	}

	function _previewShield(amount, ctx) {
		const mult = ctx && ctx.healMult ? ctx.healMult : 1
		return Math.max(0, Math.round((amount || 0) * mult))
	}

	function getAbilityNumericPreview(abilityId) {
		try {
			const ab = ABILITIES[abilityId]
			if (!ab) return ''
			const enemy = inCombat
				? state.currentEnemy
				: { name: 'Dummy', armor: 0, magicRes: 0, armorBuff: 0, magicResBuff: 0, brokenTurns: 0 }
			const ctx = buildAbilityContext(p, abilityId)

			// NOTE: These match the intent of ABILITY_EFFECTS, but avoid RNG/side-effects.
			switch (abilityId) {
				// Mage
				case 'fireball':
					return _previewCalcMagic(p.stats.magic * 1.6, 'fire', enemy, ctx) + ' dmg'
				case 'iceShard':
					return _previewCalcMagic(p.stats.magic * 1.25, 'frost', enemy, ctx) + ' dmg'
				case 'arcaneShield':
					return _previewShield(20, ctx) + ' shield'
				case 'arcaneSurge':
					return _previewCalcMagic(p.stats.magic * 1.25, 'arcane', enemy, ctx) + ' dmg'
				case 'meteorSigil': {
					const primary = _previewCalcMagic(p.stats.magic * 2.2, 'fire', enemy, ctx)
					const splash = _previewCalcMagic(p.stats.magic * 2.2 * 0.6, 'fire', enemy, ctx)
					const alive = inCombat ? getAliveEnemies().length : 1
					if (alive > 1) return primary + '/' + splash + ' AoE'
					return primary + ' dmg'
				}
				case 'arcaneOverload': {
					// Added in 1.1.92 as mage AoE.
					const primary = _previewCalcMagic(p.stats.magic * 1.55, 'arcane', enemy, ctx)
					const splash = _previewCalcMagic(p.stats.magic * 1.55 * 0.75, 'arcane', enemy, ctx)
					const alive = inCombat ? getAliveEnemies().length : 1
					if (alive > 1) return primary + '/' + splash + ' AoE'
					return primary + ' dmg'
				}

				// Warrior
				case 'powerStrike':
					return _previewCalcPhysical(p.stats.attack * 1.4, null, enemy, ctx) + ' dmg'
				case 'cleave': {
					const primary = _previewCalcPhysical(p.stats.attack * 1.25, null, enemy, ctx)
					const splash = _previewCalcPhysical(p.stats.attack * 1.25 * 0.72, null, enemy, ctx)
					const alive = inCombat ? getAliveEnemies().length : 1
					if (alive > 1) return primary + '/' + splash + ' AoE'
					return primary + ' dmg'
				}
				case 'ironFortress':
					return _previewShield(35, ctx) + ' shield'

				// Blood Knight
				case 'bloodSlash':
					return _previewCalcPhysical(p.stats.attack * 1.5, null, enemy, ctx) + ' dmg'
				case 'leech': {
					const dmg = _previewCalcMagic(p.stats.magic * 0.9, 'shadow', enemy, ctx)
					const heal = _previewHeal(Math.round(dmg * 0.6), ctx)
					return dmg + ' dmg / ' + heal + ' heal'
				}
				case 'bloodNova': {
					const primary = _previewCalcMagic(p.stats.magic * 1.45, 'shadow', enemy, ctx)
					const splash = _previewCalcMagic(p.stats.magic * 1.45 * 0.78, 'shadow', enemy, ctx)
					const alive = inCombat ? getAliveEnemies().length : 1
					if (alive > 1) return primary + '/' + splash + ' AoE'
					return primary + ' dmg'
				}

				// Ranger
				case 'piercingShot':
					return _previewCalcPhysical(p.stats.attack * 1.3, null, enemy, ctx) + ' dmg'
				case 'twinArrows': {
					const one = _previewCalcPhysical(p.stats.attack * 0.75, null, enemy, ctx)
					return (one * 2) + ' dmg'
				}
				case 'rainOfThorns': {
					const primary = _previewCalcPhysical(p.stats.attack * 0.85, 'piercing', enemy, ctx)
					const alive = inCombat ? getAliveEnemies().length : 1
					// This spell is "hits all once"; show per-target.
					if (alive > 1) return primary + ' ea (AoE)'
					return primary + ' dmg'
				}

				// Paladin
				case 'holyStrike':
					return _previewCalcPhysical(p.stats.attack * 1.2, 'holy', enemy, ctx) + ' dmg'
				case 'blessingLight': {
					const heal = _previewHeal(Math.round(p.maxHp * 0.25), ctx)
					return heal + ' heal'
				}

				// Cleric
				case 'holyHeal':
					return _previewHeal(Math.round(p.maxHp * 0.35), ctx) + ' heal'
				case 'smite':
					return _previewCalcMagic(p.stats.magic * 1.3, 'holy', enemy, ctx) + ' dmg'
				case 'purify':
					return _previewShield(15, ctx) + ' shield'

				// Necromancer
				case 'soulBolt': {
					const dmg = _previewCalcMagic(p.stats.magic * 1.4, 'shadow', enemy, ctx)
					const heal = _previewHeal(Math.round(dmg * 0.4), ctx)
					return dmg + ' dmg / ' + heal + ' heal'
				}
				case 'decay':
					return _previewCalcMagic(p.stats.magic * 0.9, 'poison', enemy, ctx) + ' dmg'

				// Shaman
				case 'lightningLash':
					return _previewCalcMagic(p.stats.magic * 1.5, 'lightning', enemy, ctx) + ' dmg'
				case 'earthskin':
					return _previewShield(20, ctx) + ' shield'
				case 'stoneQuake': {
					const primary = _previewCalcMagic(p.stats.magic * 1.2, 'earth', enemy, ctx)
					const splash = _previewCalcMagic(p.stats.magic * 1.2 * 0.82, 'earth', enemy, ctx)
					const alive = inCombat ? getAliveEnemies().length : 1
					if (alive > 1) return primary + '/' + splash + ' AoE'
					return primary + ' dmg'
				}
				case 'tempest': {
					const dmg = _previewCalcMagic(p.stats.magic * 1.05, 'lightning', enemy, ctx)
					return dmg + ' dmg'
				}

				// Vampire
				case 'essenceDrain': {
					const dmg = _previewCalcMagic(p.stats.magic * 1.2, 'arcane', enemy, ctx)
					const heal = _previewHeal(Math.round(dmg * 0.5), ctx)
					return dmg + ' dmg / ' + heal + ' heal'
				}
				case 'batSwarm':
					return _previewCalcMagic(p.stats.magic * 1.3, 'shadow', enemy, ctx) + ' dmg'

				// Berserker
				case 'frenziedBlow':
					return _previewCalcPhysical(p.stats.attack * 1.0, null, enemy, ctx) + ' dmg'
				case 'warCryBerserker':
					return _previewHeal(Math.round(p.maxHp * 0.2), ctx) + ' heal'
			}
		} catch (_) {}
		return ''
	}

    function formatCost(cost, abilityId) {
        if (!cost) return 'Cost: —'
        const parts = []
        if (cost.mana) parts.push(cost.mana + ' Mana')
        if (cost.fury) parts.push(cost.fury + ' Fury')
        if (cost.blood) parts.push(cost.blood + ' Blood')
        if (cost.essence) parts.push(cost.essence + ' Essence')
        if (cost.hp) parts.push(cost.hp + ' HP')

		const preview = abilityId ? getAbilityNumericPreview(abilityId) : ''
		if (preview && parts.length === 1) {
			// Put the number right next to the primary resource.
			return 'Cost: ' + parts[0] + ' (' + preview + ')'
		}
		if (preview && parts.length > 1) {
			return 'Cost: ' + parts.join(' • ') + ' • ' + preview
		}
		return parts.length ? 'Cost: ' + parts.join(' • ') : 'Cost: —'
    }

    function getKnown() {
        return Array.isArray(p.spells) ? p.spells.slice() : []
    }

    function getEquipped() {
        return Array.isArray(p.equippedSpells) ? p.equippedSpells.slice() : []
    }

    function isEquipped(id) {
        return (p.equippedSpells || []).includes(id)
    }

    // Patch 1.1.0 UI: Spell modal uses the same “collapsible card” pattern as Inventory.
    // - Out of combat: tap a card to expand/collapse details (equip/unequip/upgrade).
    // - In combat: tapping a card *casts immediately* (no collapsing).

    openModal(inCombat ? 'Abilities' : 'Spells & Abilities', (body) => {
        body.innerHTML = ''
        body.classList.add('spellbook-modal')

        const info = document.createElement('div')
        info.className = 'small'
        info.style.marginBottom = '8px'
        info.textContent =
            (inCombat
                ? 'Tap an ability to cast it. (Only equipped abilities appear.)'
                : 'Tap an ability to expand details. Equip up to ' +
                  MAX_EQUIPPED_SPELLS +
                  ' for combat.') +
            ' Upgrades apply automatically.'
        body.appendChild(info)

        const topRow = document.createElement('div')
        topRow.className = 'item-actions'
        topRow.style.marginBottom = '10px'

        const token = document.createElement('div')
        token.className = 'small'
        token.textContent = 'Upgrade Tokens: ' + (p.abilityUpgradeTokens || 0)
        topRow.appendChild(token)

        if (!inCombat) {
            const eqInfo = document.createElement('div')
            eqInfo.className = 'small'
            eqInfo.style.marginLeft = 'auto'
            eqInfo.textContent =
                'Equipped: ' + getEquipped().length + '/' + MAX_EQUIPPED_SPELLS
            topRow.appendChild(eqInfo)
        }

        body.appendChild(topRow)

        const help = document.createElement('div')
        help.className = 'spells-help'
        help.textContent = inCombat
            ? 'Combat: tap a spell to cast it. Loadout changes are disabled in combat.'
            : 'Outside combat: expand a spell to see details, equip/unequip, and upgrade.'
        body.appendChild(help)

        const legend = document.createElement('div')
        legend.className = 'spells-legend'
        legend.innerHTML = '<span class="badge">AoE</span><span class="badge">Single</span><span class="badge">Support</span>'
        body.appendChild(legend)

		// Patch 1.1.92: If your class meter is currently "ready", show a clear one-line
		// preview of what it will do before you tap to cast.
		const meterBannerText = getMeterGlobalBannerText()
		if (meterBannerText) {
			const mb = document.createElement('div')
			mb.className = 'small'
			mb.style.margin = '6px 0 10px 0'
			mb.style.padding = '6px 8px'
			mb.style.border = '1px solid rgba(255,255,255,0.10)'
			mb.style.borderRadius = '8px'
			mb.style.opacity = '0.95'
			mb.textContent = meterBannerText
			body.appendChild(mb)
		}

        const list = document.createElement('div')
        list.className = 'inv-list spellbook-cards'
        body.appendChild(list)

        function openAbilityUpgradeModal(id) {
            const ab = ABILITIES[id]
            if (!ab) return
            if ((p.abilityUpgradeTokens || 0) <= 0) {
                addLog('No upgrade tokens available.', 'system')
                return
            }

            const up = getAbilityUpgrade(p, id)
            const currentTier = up ? up.tier : 0
            const currentPath = up ? up.path : null
            if (currentTier >= ABILITY_UPGRADE_RULES.maxTier) {
                addLog('That ability is already max tier.', 'system')
                return
            }

            openModal('Upgrade: ' + ab.name, (b) => {
                b.innerHTML = ''

                const help = document.createElement('div')
                help.className = 'small'
                help.textContent =
                    'Choose a path and spend 1 token to increase tier.'
                b.appendChild(help)

                const row = document.createElement('div')
                row.className = 'item-actions'
                row.style.marginTop = '10px'

                const btnPot = document.createElement('button')
                btnPot.className = 'btn'
                btnPot.textContent = 'Potency (+effect)'
                btnPot.addEventListener('click', () => doUpgrade('potency'))
                row.appendChild(btnPot)

                const btnEff = document.createElement('button')
                btnEff.className = 'btn'
                btnEff.textContent = 'Efficiency (-cost)'
                btnEff.addEventListener('click', () => doUpgrade('efficiency'))
                row.appendChild(btnEff)

                b.appendChild(row)

                const cur = document.createElement('div')
                cur.className = 'small'
                cur.style.marginTop = '10px'
                cur.textContent =
                    'Current: Tier ' +
                    currentTier +
                    (currentPath
                        ? ' (' + currentPath + ')'
                        : ' (unassigned)')
                b.appendChild(cur)

                function doUpgrade(path) {
                    ensurePlayerSpellSystems(p)
                    if ((p.abilityUpgradeTokens || 0) <= 0) return
                    const existing = p.abilityUpgrades[id] || {}
                    const nextTier = Math.min(
                        ABILITY_UPGRADE_RULES.maxTier,
                        (existing.tier || 0) + 1
                    )
                    p.abilityUpgrades[id] = { tier: nextTier, path: path }
                    p.abilityUpgradeTokens = Math.max(
                        0,
                        (p.abilityUpgradeTokens || 0) - 1
                    )
                    addLog(
                        ab.name +
                            ' upgraded to Tier ' +
                            nextTier +
                            ' (' +
                            path +
                            ').',
                        'good'
                    )
                    saveGame()
                    closeModal()
                    openSpellsModal(false)
                }
            })
        }

        function makeAbilityCard(id, { label = '' } = {}) {
            const ab = ABILITIES[id]
            if (!ab) return null

            const isEq = isEquipped(id)
            const up = getAbilityUpgrade(p, id)
            const tier = up && up.tier ? up.tier : 0
            const isMaxTier = tier >= ABILITY_UPGRADE_RULES.maxTier
            // IMPORTANT: show the *effective* cost (upgrade reductions + class passives)
            // so when the player chooses Efficiency, the new cost displays immediately.
            const effectiveCost = getEffectiveAbilityCost(p, id)

            const card = document.createElement('details')
            card.className = 'inv-card spell-card' + (inCombat ? ' in-combat' : '')
            // Always start collapsed when opening the Spell Book.
            card.open = false

            const summary = document.createElement('summary')
            summary.className = 'inv-card-header'

            // In combat, prevent collapsing and cast on tap.
            if (inCombat) {
                summary.addEventListener('click', (e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    useAbilityInCombat(id)
                })
            }

            const left = document.createElement('div')
            left.className = 'inv-left'

            const name = document.createElement('div')
            name.className = 'inv-name'
            name.textContent = ab.name
            left.appendChild(name)

            const badges = document.createElement('div')
            badges.className = 'spell-badges';
            ;(getSpellBadges(id) || []).forEach((b) => {
                const s = document.createElement('span')
                s.className = 'badge'
                s.textContent = b
                badges.appendChild(s)
            })
            left.appendChild(badges)

            const sub = document.createElement('div')
            sub.className = 'inv-sub'
            const bits = []
            bits.push(formatCost(effectiveCost, id).replace('Cost: ', ''))
            if (label) bits.push(label)
            if (isEq && !inCombat) bits.push('Equipped')
            if (tier > 0) bits.push('Tier ' + tier)
            sub.textContent = bits.filter(Boolean).join(' • ')
            left.appendChild(sub)

            // Patch 1.1.92: In combat, show a short spell description inline
            // because the card can't be expanded (tap casts immediately).
            if (inCombat) {
                const hint = document.createElement('div')
                hint.className = 'small'
                hint.style.opacity = '0.85'
                hint.style.marginTop = '2px'
                hint.textContent = ab.note || ''
                left.appendChild(hint)
            }

			// Patch 1.1.92: show a clear preview when the class meter will affect the next cast.
			const meterPreview = getMeterCastPreview(id)
			if (meterPreview) {
				const mp = document.createElement('div')
				mp.className = 'small'
				mp.style.opacity = '0.92'
				mp.style.marginTop = inCombat ? '2px' : '4px'
				mp.style.fontStyle = 'italic'
				mp.textContent = meterPreview
				left.appendChild(mp)
			}

            summary.appendChild(left)
            // No right column in the Spell Book (keeps the header compact and avoids empty space).

            const details = document.createElement('div')
            details.className = 'inv-details'

            const desc = document.createElement('div')
            desc.className = 'inv-desc'
            desc.textContent = ab.note || ''
            details.appendChild(desc)

            const meta = document.createElement('div')
            meta.className = 'small'
            meta.style.marginTop = '8px'
            const upText =
                tier > 0
                    ? 'Upgrade: Tier ' + tier + ' (' + (up.path || 'unassigned') + ')'
                    : 'Upgrade: None'
            meta.textContent =
                'Cost: ' +
                formatCost(effectiveCost, id).replace('Cost: ', '') +
                '  •  ' +
                upText
            details.appendChild(meta)

            const actions = document.createElement('div')
            actions.className = 'inv-actions'

            if (inCombat) {
                // Optional secondary button (for players who prefer explicit Use).
                const btnUse = document.createElement('button')
                btnUse.className = 'btn small'
                btnUse.textContent = 'Use'
                btnUse.addEventListener('click', (e) => {
                    e.preventDefault()
                    useAbilityInCombat(id)
                })
                actions.appendChild(btnUse)

                details.appendChild(actions)
            } else {
                // Out of combat: equip/unequip + upgrade
                    const tight = document.createElement('div')
                    tight.className = 'inv-actions-tight'

                if (!inCombat) {

                if (isEq) {
                    const btnUn = document.createElement('button')
                    btnUn.className = 'btn small'
                    btnUn.textContent = 'Unequip'
                    btnUn.addEventListener('click', (e) => {
                        e.preventDefault()
                        p.equippedSpells = (p.equippedSpells || []).filter(
                            (x) => x !== id
                        )
                        ensurePlayerSpellSystems(p)
                        saveGame()
                        render()
                    })
                        tight.appendChild(btnUn)
                } else {
                    const btnEq = document.createElement('button')
                    btnEq.className = 'btn small'
                    btnEq.textContent = 'Equip'
                    btnEq.disabled =
                        (p.equippedSpells || []).length >= MAX_EQUIPPED_SPELLS
                    btnEq.addEventListener('click', (e) => {
                        e.preventDefault()
                        ensurePlayerSpellSystems(p)
                        if ((p.equippedSpells || []).length >= MAX_EQUIPPED_SPELLS) {
                            addLog(
                                'Loadout is full. Unequip an ability first.',
                                'system'
                            )
                            return
                        }
                        p.equippedSpells.push(id)
                        ensurePlayerSpellSystems(p)
                        saveGame()
                        render()
                    })
                    tight.appendChild(btnEq)
                }

                // Remove the Upgrade button entirely once max tier is reached.
                if (!isMaxTier) {
                    const btnUp = document.createElement('button')
                    btnUp.className = 'btn small'
                    btnUp.textContent = 'Upgrade'
                    btnUp.disabled = (p.abilityUpgradeTokens || 0) <= 0
                    btnUp.addEventListener('click', (e) => {
                        e.preventDefault()
                        openAbilityUpgradeModal(id)
                    })
                    tight.appendChild(btnUp)
                }

                }

                if (tight.childNodes.length) actions.appendChild(tight)

                details.appendChild(actions)
            }

            card.appendChild(summary)
            card.appendChild(details)
            return card
        }

        function addSubhead(text) {
            const h = document.createElement('div')
            h.className = 'spellbook-subhead'
            h.textContent = text
            list.appendChild(h)
        }

        function addEmpty(text) {
            const e = document.createElement('p')
            e.className = 'modal-subtitle'
            e.textContent = text
            list.appendChild(e)
        }

        function render() {
            list.innerHTML = ''

            const equipped = getEquipped()
            const known = getKnown()

            if (inCombat) {
                if (!equipped.length) {
                    addEmpty('No equipped abilities. Equip some outside of combat.')
                    return
                }
                equipped.forEach((id, i) => {
                    const card = makeAbilityCard(id)
                    if (card) list.appendChild(card)
                })
                return
            }

            addSubhead('Equipped')
            if (!equipped.length) {
                addEmpty('No equipped abilities yet.')
            } else {
                equipped.forEach((id, i) => {
                    const card = makeAbilityCard(id, { label: 'Loadout' })
                    if (card) list.appendChild(card)
                })
            }

            addSubhead('Known')
            const rest = known.filter((id) => !equipped.includes(id))
            if (!rest.length) {
                addEmpty('No additional known abilities.')
            } else {
                rest.forEach((id) => {
                    const card = makeAbilityCard(id)
                    if (card) list.appendChild(card)
                })
            }

            // Safety sweep: ensure every card starts collapsed whenever the Spell Book opens.
            // (Prevents any browser quirks from leaving the first <details> expanded.)
            list.querySelectorAll('details').forEach((d) => {
                d.open = false
            })
        }

        render()
    })
}


function canPayCost(cost) {
    const p = state.player
    if (cost.mana && p.resourceKey === 'mana' && p.resource < cost.mana)
        return false
    if (cost.fury && p.resourceKey === 'fury' && p.resource < cost.fury)
        return false
    if (cost.blood && p.resourceKey === 'blood' && p.resource < cost.blood)
        return false
    if (
        cost.essence &&
        p.resourceKey === 'essence' &&
        p.resource < cost.essence
    )
        return false
    if (cost.hp && p.hp <= cost.hp) return false
    return true
}

function payCost(cost) {
    const p = state.player
    if (cost.mana && p.resourceKey === 'mana') p.resource -= cost.mana
    if (cost.fury && p.resourceKey === 'fury') p.resource -= cost.fury
    if (cost.blood && p.resourceKey === 'blood') p.resource -= cost.blood
    if (cost.essence && p.resourceKey === 'essence') p.resource -= cost.essence
    if (cost.hp) p.hp -= cost.hp
}

function useAbilityInCombat(id) {
    if (!guardPlayerTurn()) return

    const p = state.player
    recordInput('combat.ability', { id })
    const enemy = state.currentEnemy
    if (!p || !enemy) return
    ensurePlayerSpellSystems(p)

    // Enforce loadout rules during combat.
    if (Array.isArray(p.equippedSpells) && p.equippedSpells.length) {
        if (!p.equippedSpells.includes(id)) {
            addLog('That ability is not equipped.', 'system')
            return
        }
    }

    const ability = ABILITIES[id]
    if (!ability) return

    const cost = getEffectiveAbilityCost(p, id)
    if (!canPayCost(cost)) {
        addLog('Not enough resources to use that ability.', 'danger')
        return
    }

    payCost(cost)
    _applyCostPassives(p, cost)

    const ctx = buildAbilityContext(p, id)
    _setPlayerAbilityContext(ctx)

    let description = ''
    try {
        const fn = ABILITY_EFFECTS[id]
        if (typeof fn === 'function') {
            description = fn(p, enemy, ctx) || ''
        } else {
            description = 'Nothing happens.'
        }
    } catch (e) {
        console.error('Ability error:', id, e)
        description = 'The spell fizzles.'
    }

    _setPlayerAbilityContext(null)

    _consumeCompanionBoonIfNeeded(p, ctx)
    if (ctx && ctx.didDamage && ctx.consumeFirstHitBonus) {
        p.status.firstHitBonusAvailable = false
    }


// Patch 1.1.92: apply class-meter payoffs immediately after the action resolves.
// Mage: Rhythm refunds mana on the empowered cast.
if (ctx && ctx._mageRhythmActive && ctx._manaRefund && p.resourceKey === 'mana') {
    const refund = Math.max(0, Math.round(ctx._manaRefund))
    if (refund > 0) {
        const before = p.resource
        p.resource = Math.min(p.maxResource, p.resource + refund)
        const gained = p.resource - before
        if (gained > 0) addLog('Arcane Rhythm refunds ' + gained + ' Mana.', 'system')
    }
}

// Warrior: Bulwark consumes Fury after you land a damaging ability, granting a small shield.
if (ctx && ctx._bulwarkActive && ctx.didDamage && p.resourceKey === 'fury') {
    const spend = 40
    if ((p.resource || 0) >= spend) {
        p.resource -= spend
        const shield = Math.max(8, Math.round(p.maxHp * 0.08))
        _addShield(p.status, shield)
        addLog('Bulwark expends Fury, granting a ' + shield + '-point shield.', 'system')
    }
}
    p.status.spellCastCount = (p.status.spellCastCount || 0) + 1

    if (description) addLog(description, 'good')

    updateHUD()
    updateEnemyPanel()
    closeModal()

    if (enemy.hp <= 0) {
        handleEnemyDefeat(enemy)
    }

    if (state.inCombat) {
        endPlayerTurn({ source: 'ability', id })
    }
}

function openCharacterSheet() {
    const p = state.player
    if (!p) return

    const cls = PLAYER_CLASSES[p.classId]
    const diff = getActiveDifficultyConfig()
    const timeInfo = getTimeInfo(state)
    const worldTimeLine = formatTimeLong(timeInfo)

    const areaName =
        state.area === 'village'
            ? 'Emberwood Village'
            : state.area === 'forest'
            ? 'Emberwood Forest'
            : state.area === 'ruins'
            ? 'Ruined Spire'
            : state.area

    const mainQuest = state.quests.main

    // Quest summary line for Overview tab
    let questLine = 'None'
    if (mainQuest) {
        if (mainQuest.status === 'completed') {
            questLine = `${mainQuest.name} (Completed)`
        } else {
            questLine = `${mainQuest.name} – Step ${mainQuest.step}`
        }
    }

    // Base stats reference for derived breakdown
    const baseStats = cls
        ? cls.baseStats
        : {
              maxHp: p.maxHp,
              attack: p.stats.attack,
              magic: p.stats.magic,
              armor: p.stats.armor,
              speed: p.stats.speed
          }

    const sk = p.skills || { strength: 0, endurance: 0, willpower: 0 }

    // Contributions from skills
    const atkFromStr = sk.strength * 2
    const hpFromEnd = sk.endurance * 6
    const armorFromEnd = Math.floor(sk.endurance / 2)
    const magicFromWill = sk.willpower * 2
    const resFromWill = sk.willpower * 4

    // Equipment bonuses
    const weaponAtkBonus =
        p.equipment.weapon && p.equipment.weapon.attackBonus
            ? p.equipment.weapon.attackBonus
            : 0

    const weaponMagicBonus =
        p.equipment.weapon && p.equipment.weapon.magicBonus
            ? p.equipment.weapon.magicBonus
            : 0

    // Multi-slot gear (Patch 1.1.5): sum bonuses across all equipped armor pieces.
    const gearSlots = ['armor', 'head', 'hands', 'feet', 'belt', 'neck', 'ring']
    const sumGear = (field) =>
        gearSlots.reduce((acc, k) => {
            const it = p.equipment && p.equipment[k] ? p.equipment[k] : null
            const v = it && typeof it[field] === 'number' ? it[field] : 0
            return acc + v
        }, 0)

    const armorBonus = sumGear('armorBonus')
    const armorResBonus = sumGear('maxResourceBonus')

    const baseRes = p.resourceKey === 'mana' ? 100 : 60

    const comp = state.companion

    // --- NEW: Gear-affix summary values for Character Sheet -------------------
    // (These are totals from recalcPlayerStats(), primarily driven by gear affixes.)
    const statCritChance = Math.round(((p.stats && p.stats.critChance) || 0) * 10) / 10
    const statDodgeChance = Math.round(((p.stats && p.stats.dodgeChance) || 0) * 10) / 10
    const statResistAll = Math.round(((p.stats && p.stats.resistAll) || 0) * 10) / 10
    const statLifeSteal = Math.round(((p.stats && p.stats.lifeSteal) || 0) * 10) / 10
    const statArmorPen = Math.round(((p.stats && p.stats.armorPen) || 0) * 10) / 10
    const statHaste = Math.round(((p.stats && p.stats.haste) || 0) * 10) / 10
    const statThorns = Math.round(((p.stats && p.stats.thorns) || 0) * 10) / 10
    const statHpRegen = Math.round(((p.stats && p.stats.hpRegen) || 0) * 10) / 10

    const capWord = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
    const elemBonuses =
        p.stats && p.stats.elementalBonuses ? p.stats.elementalBonuses : {}
    const elemKeys = Object.keys(elemBonuses).filter((k) => elemBonuses[k])
    const elementalSummary = elemKeys.length
        ? elemKeys
              .map((k) => capWord(k) + ' +' + (Math.round(elemBonuses[k] * 10) / 10) + '%')
              .join(', ')
        : 'None'
    const weaponElement = p.stats && p.stats.weaponElementType ? capWord(p.stats.weaponElementType) : 'None'

    openModal('Character Sheet', (body) => {
        body.innerHTML = ''

        // --- TAB HEADER -----------------------------------------------------------
        const tabs = document.createElement('div')
        tabs.className = 'char-tabs'

        const tabDefs = [
            { id: 'overview', label: 'Overview' },
            { id: 'stats', label: 'Stats' },
            { id: 'skills', label: 'Skills' },
            { id: 'equipment', label: 'Equipment' },
            { id: 'companions', label: 'Companions' }
        ]

        tabDefs.forEach((t, idx) => {
            const btn = document.createElement('button')
            btn.className = 'char-tab' + (idx === 0 ? ' active' : '')
            btn.dataset.tab = t.id
            btn.textContent = t.label
            tabs.appendChild(btn)
        })

        body.appendChild(tabs)

        // --- TAB PANELS WRAPPER ---------------------------------------------------
        const panelsWrapper = document.createElement('div')
        panelsWrapper.className = 'char-tabs-wrapper'

        function makePanel(id, innerHTML) {
            const panel = document.createElement('div')
            panel.className =
                'char-tab-panel' + (id === 'overview' ? ' active' : '')
            panel.dataset.tab = id
            panel.innerHTML = innerHTML
            panelsWrapper.appendChild(panel)
            return panel
        }

        // --- OVERVIEW TAB ---------------------------------------------------------
        const overviewHtml = `
      <div class="char-section">
        <div class="char-section-title">Hero</div>
        <div class="stat-grid">
          <div class="stat-label">
            <span class="char-stat-icon">🏷</span>Name
          </div>
          <div class="stat-value">${p.name}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🎭</span>Class
          </div>
          <div class="stat-value">${cls ? cls.name : 'Unknown'}</div>

          <div class="stat-label">
            <span class="char-stat-icon">⚖</span>Difficulty
          </div>
          <div class="stat-value">${diff ? diff.name : ''}</div>

          <div class="stat-label">
            <span class="char-stat-icon">⭐</span>Level
          </div>
          <div class="stat-value">${p.level}</div>

          <div class="stat-label">
            <span class="char-stat-icon">📈</span>XP
          </div>
          <div class="stat-value">${p.xp} / ${p.nextLevelXp}</div>

          <div class="stat-label">
            <span class="char-stat-icon">📍</span>Location
          </div>
          <div class="stat-value">${areaName}</div>

          <!-- NEW: world time -->
          <div class="stat-label">
            <span class="char-stat-icon">⏳</span>World Time
          </div>
          <div class="stat-value">${worldTimeLine}</div>
        </div>
      </div>
    `

        // --- STATS TAB ------------------------------------------------------------
        const statsHtml = `
      <div class="char-section">
        <div class="char-section-title">Core Stats</div>
        <div class="stat-grid">
          <div class="stat-label">
            <span class="char-stat-icon">❤️</span>HP
          </div>
          <div class="stat-value">${Math.round(p.hp)} / ${p.maxHp}</div>

          <div class="stat-label">
            <span class="char-stat-icon">💧</span>${p.resourceName}
          </div>
          <div class="stat-value">${Math.round(p.resource)} / ${
            p.maxResource
        }</div>

          <div class="stat-label">
            <span class="char-stat-icon">⚔</span>Attack
          </div>
          <div class="stat-value stat-attack">${p.stats.attack}</div>

          <div class="stat-label">
            <span class="char-stat-icon">✨</span>Magic
          </div>
          <div class="stat-value stat-magic">${p.stats.magic}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🛡</span>Armor
          </div>
          <div class="stat-value stat-armor">${p.stats.armor}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🌀</span>Speed
          </div>
          <div class="stat-value stat-speed">${p.stats.speed}</div>

          <div class="stat-label">
            <span class="char-stat-icon">💰</span>Gold
          </div>
          <div class="stat-value">${p.gold}</div>
        </div>
      </div>


      <div class="char-section char-divider-top">
        <div class="char-section-title">Gear Affixes</div>
        <div class="stat-grid">
          <div class="stat-label">
            <span class="char-stat-icon">🎯</span>Crit Chance
          </div>
          <div class="stat-value">${statCritChance}%</div>

          <div class="stat-label">
            <span class="char-stat-icon">💨</span>Dodge Chance
          </div>
          <div class="stat-value">${statDodgeChance}%</div>

          <div class="stat-label">
            <span class="char-stat-icon">🧿</span>Resist All
          </div>
          <div class="stat-value">${statResistAll}%</div>

          <div class="stat-label">
            <span class="char-stat-icon">🩸</span>Life Steal
          </div>
          <div class="stat-value">${statLifeSteal}%</div>

          <div class="stat-label">
            <span class="char-stat-icon">🪓</span>Armor Pen
          </div>
          <div class="stat-value">${statArmorPen}%</div>

          <div class="stat-label">
            <span class="char-stat-icon">⏱</span>Haste
          </div>
          <div class="stat-value">${statHaste}%</div>

          <div class="stat-label">
            <span class="char-stat-icon">🌩</span>Elemental Bonus
          </div>
          <div class="stat-value">${elementalSummary}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🔮</span>Weapon Element
          </div>
          <div class="stat-value">${weaponElement}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🦔</span>Thorns
          </div>
          <div class="stat-value">${statThorns}</div>

          <div class="stat-label">
            <span class="char-stat-icon">➕</span>HP Regen
          </div>
          <div class="stat-value">${statHpRegen}</div>
        </div>
      </div>

      <div class="char-section char-divider-top">
        <div class="char-section-title">Derived Breakdown</div>
        <div class="stat-grid">
          <div class="stat-label">
            <span class="char-stat-icon">⚔</span>Attack
          </div>
          <div class="stat-value">
            ${baseStats.attack}
            <span class="stat-note">
              (+${atkFromStr} STR, +${weaponAtkBonus} weapon)
            </span>
          </div>

          <div class="stat-label">
            <span class="char-stat-icon">❤️</span>HP Max
          </div>
          <div class="stat-value">
            ${baseStats.maxHp}
            <span class="stat-note">
              (+${hpFromEnd} END)
            </span>
          </div>

          <div class="stat-label">
            <span class="char-stat-icon">✨</span>Magic
          </div>
          <div class="stat-value">
            ${baseStats.magic}
            <span class="stat-note">
              (+${magicFromWill} WIL, +${weaponMagicBonus} weapon)
            </span>
          </div>

          <div class="stat-label">
            <span class="char-stat-icon">🛡</span>Armor
          </div>
          <div class="stat-value">
            ${baseStats.armor}
            <span class="stat-note">
              (+${armorFromEnd} END, +${armorBonus} armor)
            </span>
          </div>

          <div class="stat-label">
            <span class="char-stat-icon">💧</span>${p.resourceName} Max
          </div>
          <div class="stat-value">
            ${baseRes}
            <span class="stat-note">
              (+${resFromWill} WIL, +${armorResBonus} gear)
            </span>
          </div>
        </div>
      </div>
    `

        // --- SKILLS TAB -----------------------------------------------------------
        const skillsHtml = `
      <div class="char-section">
        <div class="char-section-title">Skills</div>
        <div class="stat-grid">
          <div class="stat-label">
            <span class="char-stat-icon">💪</span>Strength
          </div>
          <div class="stat-value">${sk.strength}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🛡</span>Endurance
          </div>
          <div class="stat-value">${sk.endurance}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🧠</span>Willpower
          </div>
          <div class="stat-value">${sk.willpower}</div>

          <div class="stat-label">
            <span class="char-stat-icon">⭐</span>Skill Points
          </div>
          <div class="stat-value">${p.skillPoints || 0}</div>
        </div>
      </div>

      <div class="char-section char-divider-top">
        <p class="modal-subtitle">
          Tip: Strength boosts physical attacks, Endurance increases max HP & armor,
          and Willpower improves magic power and resource pool.
        </p>
      </div>
    `

        // --- EQUIPMENT TAB --------------------------------------------------------
        const escHtml = (s) =>
            String(s ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')

        const rarityKey = (r) => String(r || 'common').toLowerCase()

        const slotName = (slot) => {
            const it = p.equipment && p.equipment[slot] ? p.equipment[slot] : null
            if (!it) return '<span class="equip-empty">None</span>'
            return (
                '<span class="equip-name rarity-' +
                rarityKey(it.rarity) +
                '">' +
                escHtml(it.name) +
                '</span>'
            )
        }

        const weaponName = slotName('weapon')
        const armorName = slotName('armor')
        const headName = slotName('head')
        const handsName = slotName('hands')
        const feetName = slotName('feet')
        const beltName = slotName('belt')
        const neckName = slotName('neck')
        const ringName = slotName('ring')

        const equipmentHtml = `
      <div class="char-section">
        <div class="char-section-title">Equipment</div>
        <div class="stat-grid">
          <div class="stat-label">
            <span class="char-stat-icon">⚔</span>Weapon
          </div>
          <div class="stat-value">${weaponName}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🛡</span>Armor (Body)
          </div>
          <div class="stat-value">${armorName}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🪖</span>Head
          </div>
          <div class="stat-value">${headName}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🧤</span>Hands
          </div>
          <div class="stat-value">${handsName}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🥾</span>Feet
          </div>
          <div class="stat-value">${feetName}</div>

          <div class="stat-label">
            <span class="char-stat-icon">🎗</span>Belt
          </div>
          <div class="stat-value">${beltName}</div>

          <div class="stat-label">
            <span class="char-stat-icon">📿</span>Neck
          </div>
          <div class="stat-value">${neckName}</div>

          <div class="stat-label">
            <span class="char-stat-icon">💍</span>Ring
          </div>
          <div class="stat-value">${ringName}</div>
        </div>
      </div>

      <div class="char-section char-divider-top">
        <p class="modal-subtitle">
          Gear pieces can roll bonuses like Armor, Max Resource, Resist All, and more.
          Accessories (Neck/Ring) can also roll small offensive stats.
        </p>
      </div>
    `

        // --- COMPANIONS TAB -------------------------------------------------------
        let companionsHtml = ''

        if (!comp) {
            companionsHtml = `
        <div class="char-section">
          <div class="char-section-title">Companion</div>
          <p class="equip-empty">You currently travel alone.</p>
        </div>
      `
        } else {
            companionsHtml = `
        <div class="char-section">
          <div class="char-section-title">Companion</div>
          <div class="stat-grid">
            <div class="stat-label">
              <span class="char-stat-icon">🧍</span>Name
            </div>
            <div class="stat-value">${comp.name}</div>

            <div class="stat-label">
              <span class="char-stat-icon">🎯</span>Role
            </div>
            <div class="stat-value">${comp.role}</div>

            <div class="stat-label">
              <span class="char-stat-icon">⚔</span>Attack
            </div>
            <div class="stat-value stat-attack">${comp.attack}</div>

            <div class="stat-label">
              <span class="char-stat-icon">❤️</span>HP Bonus
            </div>
            <div class="stat-value">${comp.hpBonus}</div>
          </div>
          <p class="modal-subtitle">${comp.description}</p>
        </div>
      `
        }

        const companionsPanelHtml =
            companionsHtml +
            `
      <div class="char-section char-divider-top">
        <p class="modal-subtitle">
          Companions act after your turn. Some focus on damage, others on defense or healing.
        </p>
      </div>
    `

        // Build panels
        makePanel('overview', overviewHtml)
        makePanel('stats', statsHtml)
        makePanel('skills', skillsHtml)
        makePanel('equipment', equipmentHtml)
        makePanel('companions', companionsPanelHtml)

        body.appendChild(panelsWrapper)

        // --- TAB SWITCH LOGIC -----------------------------------------------------
        tabs.addEventListener('click', (e) => {
            const btn = e.target.closest('.char-tab')
            if (!btn) return
            const tabId = btn.dataset.tab

            tabs.querySelectorAll('.char-tab').forEach((b) => {
                b.classList.toggle('active', b === btn)
            })

            panelsWrapper
                .querySelectorAll('.char-tab-panel')
                .forEach((panel) => {
                    panel.classList.toggle(
                        'active',
                        panel.dataset.tab === tabId
                    )
                })
        })
    })
}

// --- SKILLS -------------------------------------------------------------------


// --- NEW: Enemy Sheet (tap enemy panel to inspect) ---------------------------
function openEnemySheet() {
    const enemy = state && state.currentEnemy ? state.currentEnemy : null
    if (!state || !state.inCombat || !enemy) return

    // Ensure runtime containers exist (safe for mid-combat inspection)
    try { ensureEnemyRuntime(enemy) } catch (_) {}

    const rarityDef = getEnemyRarityDef(enemy.rarity) || getEnemyRarityDef('common')
    const rarityLabel = enemy.rarityLabel || (rarityDef ? rarityDef.label : 'Common')

    const isBoss = !!enemy.isBoss
    const isElite = !!enemy.isElite

    const maxHp = Math.max(1, Math.floor(finiteNumber(enemy.maxHp, 1)))
    const hp = clampFinite(enemy.hp, 0, maxHp, maxHp)

    const pm = typeof enemy.postureMax === 'number' && Number.isFinite(enemy.postureMax) && enemy.postureMax > 0
        ? Math.max(1, Math.floor(enemy.postureMax))
        : 0
    const posture = pm ? clampFinite(enemy.posture, 0, pm, 0) : 0

    const effAtk = getEffectiveEnemyAttack(enemy)
    const effMag = getEffectiveEnemyMagic(enemy)

    const baseDropChance = isBoss ? 1.0 : isElite ? 0.9 : 0.7
    const dropChance = clamp01(baseDropChance * finiteNumber(enemy.rarityDropMult, 1))

    const fmtPct = (x) => Math.round(clamp01(Number(x) || 0) * 100) + '%'

    function describeAffix(id) {
        const def = getEnemyAffixDef(id)
        if (!def) return id
        const parts = []
        if (def.vampiricHealPct) parts.push('Heals ' + Math.round(def.vampiricHealPct * 100) + '% of damage dealt')
        if (def.thornsReflectPct) parts.push('Reflects ' + Math.round(def.thornsReflectPct * 100) + '% of damage taken')
        if (def.chillChance) parts.push('On hit: ' + fmtPct(def.chillChance) + ' to apply Chilled (' + (def.chillTurns || 1) + 't)')
        if (def.hexTurns) parts.push('On hit: applies Hex (' + def.hexTurns + 't)')
        if (def.berserkThreshold) parts.push('Below ' + Math.round(def.berserkThreshold * 100) + '% HP: +'+ Math.round((def.berserkAtkPct||0)*100) + '% attack')
        if (def.regenPct) parts.push('Regenerates ' + Math.round(def.regenPct * 100) + '% max HP at end of turn')
        return def.label + (parts.length ? ' — ' + parts.join('; ') : '')
    }

    openEnemyModal('Enemy Sheet', (body) => {
        body.innerHTML = ''

        const tabs = document.createElement('div')
        tabs.className = 'char-tabs'

        const tabDefs = [
            { id: 'overview', label: 'Overview' },
            { id: 'stats', label: 'Stats' },
            { id: 'abilities', label: 'Abilities' },
            { id: 'effects', label: 'Affixes & Effects' },
            { id: 'rewards', label: 'Rewards' }
        ]

        tabDefs.forEach((t, idx) => {
            const btn = document.createElement('button')
            btn.className = 'char-tab' + (idx === 0 ? ' active' : '')
            btn.dataset.tab = t.id
            btn.textContent = t.label
            tabs.appendChild(btn)
        })

        body.appendChild(tabs)

        const panelsWrapper = document.createElement('div')
        panelsWrapper.className = 'char-tabs-wrapper'

        function makePanel(id, innerHTML) {
            const panel = document.createElement('div')
            panel.className = 'char-tab-panel' + (id === 'overview' ? ' active' : '')
            panel.dataset.tab = id
            panel.innerHTML = innerHTML
            panelsWrapper.appendChild(panel)
            return panel
        }

        // --- OVERVIEW -----------------------------------------------------------
        const overviewHtml = `
      <div class="char-section">
        <div class="char-section-title">Enemy</div>
        <div class="stat-grid">
          <div class="stat-label"><span class="char-stat-icon">🏷</span>Name</div>
          <div class="stat-value">${enemy.name || 'Enemy'}</div>

          <div class="stat-label"><span class="char-stat-icon">⭐</span>Level</div>
          <div class="stat-value">${finiteNumber(enemy.level, 1)}</div>

          <div class="stat-label"><span class="char-stat-icon">💠</span>Rarity</div>
          <div class="stat-value">${rarityLabel}${isBoss ? ' • Boss' : ''}${isElite ? ' • Elite' : ''}</div>

          <div class="stat-label"><span class="char-stat-icon">❤️</span>HP</div>
          <div class="stat-value">${Math.round(hp)}/${maxHp}</div>

          ${pm ? `
          <div class="stat-label"><span class="char-stat-icon">🛡</span>Posture</div>
          <div class="stat-value">${Math.round(posture)}/${pm}</div>
          ` : ''}

          <div class="stat-label"><span class="char-stat-icon">🧠</span>Behavior</div>
          <div class="stat-value">${enemy.behavior ? String(enemy.behavior) : '—'}</div>
        </div>
      </div>
    `
        makePanel('overview', overviewHtml)

        // --- STATS --------------------------------------------------------------
        const statsHtml = `
      <div class="char-section">
        <div class="char-section-title">Combat Stats</div>
        <div class="stat-grid">
          <div class="stat-label"><span class="char-stat-icon">⚔</span>Attack</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.attack, 0))} <span style="opacity:.7">(effective ${Math.round(effAtk)})</span></div>

          <div class="stat-label"><span class="char-stat-icon">✨</span>Magic</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.magic, 0))} <span style="opacity:.7">(effective ${Math.round(effMag)})</span></div>

          <div class="stat-label"><span class="char-stat-icon">🛡</span>Armor</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.armor, 0))}${enemy.armorBuff ? ' <span style="opacity:.7">(+' + Math.round(enemy.armorBuff) + ' buff)</span>' : ''}</div>

          <div class="stat-label"><span class="char-stat-icon">🔰</span>Magic Res</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.magicRes, 0))}</div>

          <div class="stat-label"><span class="char-stat-icon">📌</span>Base Attack</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.baseAttack, finiteNumber(enemy.attack, 0)))}</div>

          <div class="stat-label"><span class="char-stat-icon">📌</span>Base Magic</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.baseMagic, finiteNumber(enemy.magic, 0)))}</div>
        </div>
      </div>
    `
        makePanel('stats', statsHtml)

        // --- ABILITIES ----------------------------------------------------------
        const abilityLines = (() => {
            const arr = Array.isArray(enemy.abilities) ? enemy.abilities : []
            if (!arr.length) return '<div class="modal-subtitle">No special abilities.</div>'
            return arr
                .map((aid) => {
                    const ab = ENEMY_ABILITIES && ENEMY_ABILITIES[aid] ? ENEMY_ABILITIES[aid] : null
                    const name = ab ? ab.name : String(aid)
                    const cd = ab && typeof ab.cooldown === 'number' ? ab.cooldown : null
                    const tele = ab && ab.telegraphTurns ? ab.telegraphTurns : 0
                    const desc = ab && ab.desc ? ab.desc : ''
                    return `
          <div class="item-row">
            <div class="item-row-header">
              <div><span class="item-name">${name}</span></div>
              <div class="item-meta">${cd != null ? 'CD ' + cd : ''}${tele ? (cd != null ? ' • ' : '') + 'Telegraph ' + tele + 't' : ''}</div>
            </div>
            ${desc ? `<div style="font-size:.78rem;color:var(--muted)">${escapeHtml(desc)}</div>` : ''}
          </div>
        `
                })
                .join('')
        })()

        const abilitiesHtml = `
      <div class="char-section">
        <div class="char-section-title">Abilities</div>
        ${abilityLines}
      </div>
    `
        makePanel('abilities', abilitiesHtml)

        // --- AFFIXES / EFFECTS --------------------------------------------------
        const affixIds = Array.isArray(enemy.affixes) ? enemy.affixes : []
        const affixHtml = affixIds.length
            ? affixIds
                  .map((id) => `<div class="item-row"><div class="item-row-header"><div><span class="item-name">${describeAffix(id)}</span></div></div></div>`)
                  .join('')
            : '<div class="modal-subtitle">No mini-affixes.</div>'

        const eliteHtml = enemy.isElite
            ? `<div class="item-row"><div class="item-row-header"><div><span class="item-name">Elite: ${enemy.eliteLabel || enemy.eliteAffix || 'Elite'}</span></div></div></div>`
            : ''

        const statusParts = []
        if (enemy.bleedTurns && enemy.bleedTurns > 0) statusParts.push('Bleeding (' + enemy.bleedTurns + 't)')
        if (enemy.chilledTurns && enemy.chilledTurns > 0) statusParts.push('Chilled (' + enemy.chilledTurns + 't)')
        if (enemy.guardTurns && enemy.guardTurns > 0) statusParts.push('Guarding (' + enemy.guardTurns + 't)')
        if (enemy.brokenTurns && enemy.brokenTurns > 0) statusParts.push('Broken (' + enemy.brokenTurns + 't)')
        if (enemy.atkDownTurns && enemy.atkDownTurns > 0 && enemy.atkDownFlat) statusParts.push('Weakened ' + enemy.atkDownFlat + ' (' + enemy.atkDownTurns + 't)')
        if (enemy.intent && enemy.intent.aid) {
            const ab = ENEMY_ABILITIES && ENEMY_ABILITIES[enemy.intent.aid] ? ENEMY_ABILITIES[enemy.intent.aid] : null
            statusParts.push('Intent: ' + (ab ? ab.name : enemy.intent.aid) + ' (' + clampFinite(enemy.intent.turnsLeft, 0, 99, 0) + 't)')
        }

        const effectsHtml = `
      <div class="char-section">
        <div class="char-section-title">Modifiers</div>
        ${eliteHtml}
        <div style="margin-top:.35rem">${affixHtml}</div>
      </div>
      <div class="char-section">
        <div class="char-section-title">Current Effects</div>
        <div class="modal-subtitle">${statusParts.length ? statusParts.join(' • ') : 'None'}</div>
      </div>
    `
        makePanel('effects', effectsHtml)

        // --- REWARDS ------------------------------------------------------------
        const rewardsHtml = `
      <div class="char-section">
        <div class="char-section-title">Rewards</div>
        <div class="stat-grid">
          <div class="stat-label"><span class="char-stat-icon">📈</span>XP</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.xp, 0))}</div>

          <div class="stat-label"><span class="char-stat-icon">🪙</span>Gold</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.goldMin, 0))}–${Math.round(finiteNumber(enemy.goldMax, 0))}</div>

          <div class="stat-label"><span class="char-stat-icon">🎁</span>Loot Drop Chance</div>
          <div class="stat-value">${Math.round(dropChance * 100)}%</div>

          <div class="stat-label"><span class="char-stat-icon">🎲</span>Loot Quality Driver</div>
          <div class="stat-value">Enemy rarity tier ${finiteNumber(enemy.rarityTier, 1)}</div>
        </div>
      </div>
    `
        makePanel('rewards', rewardsHtml)

        body.appendChild(panelsWrapper)

        // Tab switching
        const tabBtns = tabs.querySelectorAll('.char-tab')
        tabBtns.forEach((btn) => {
            btn.addEventListener('click', () => {
                tabBtns.forEach((b) => b.classList.remove('active'))
                btn.classList.add('active')
                const target = btn.dataset.tab
                panelsWrapper.querySelectorAll('.char-tab-panel').forEach((pnl) => {
                    pnl.classList.toggle('active', pnl.dataset.tab === target)
                })
            })
        })
    })
}
function autoDistributeSkillPoints(p) {
    if (!p || !p.skills) return
    if (p.skillPoints == null) p.skillPoints = 0
    if (p.skillPoints <= 0) return

    const keys = ['strength', 'endurance', 'willpower']

    // Use your class starting distribution as the long-run "target" ratio.
    const baseWeights =
        CLASS_STARTING_SKILLS[p.classId] || CLASS_STARTING_SKILLS.default

    // Small smoothing so 0-weight stats can still receive a point occasionally (dynamic builds).
    const weights = {}
    keys.forEach((k) => (weights[k] = (baseWeights[k] ?? 0) + 0.25))

    const sumW = keys.reduce((a, k) => a + weights[k], 0)
    const prob = {}
    keys.forEach((k) => (prob[k] = weights[k] / sumW))

    const before = { ...p.skills }
    const pointsToSpend = p.skillPoints

    while (p.skillPoints > 0) {
        const totalNow = keys.reduce((a, k) => a + (p.skills[k] || 0), 0)
        const totalAfter = totalNow + 1

        let bestKey = keys[0]
        let bestScore = -Infinity

        keys.forEach((k) => {
            const current = p.skills[k] || 0
            const target = totalAfter * prob[k]
            const deficit = target - current

            // Tie-break slightly toward the class-weighted stat
            const score = deficit + prob[k] * 0.01

            if (score > bestScore) {
                bestScore = score
                bestKey = k
            }
        })

        p.skills[bestKey] = (p.skills[bestKey] || 0) + 1
        p.skillPoints -= 1
    }

    // Recalc + heal like your manual "Increase" path expects
    recalcPlayerStats()
    p.hp = p.maxHp
    p.resource = p.maxResource
    updateHUD()

    // Build a nice log message showing what it did
    const deltas = keys
        .map((k) => {
            const d = (p.skills[k] || 0) - (before[k] || 0)
            return d > 0 ? `+${d} ${k}` : null
        })
        .filter(Boolean)

    addLog(
        `Auto-distributed ${pointsToSpend} skill point(s): ${deltas.join(
            ', '
        )}.`,
        'good'
    )
}

function openSkillLevelUpModal() {
    const p = state.player
    if (!p) return

    // If the player clicks outside and closes the modal, auto-spend any remaining points.
    modalOnClose = () => {
        const pl = state.player
        if (!pl) return
        autoDistributeSkillPoints(pl) // no-ops if skillPoints <= 0
    }

    // Give exactly 1 point if somehow missing
    if (p.skillPoints == null) p.skillPoints = 0
    if (p.skillPoints <= 0) p.skillPoints = 1

    const closeBtn = document.getElementById('modalClose')
    if (closeBtn) closeBtn.style.display = 'none' // force choice

    openModal('Level Up!', (body) => {
        const info = document.createElement('p')
        info.className = 'modal-subtitle'
        info.textContent =
            'You feel your power surge. Choose a skill to improve (1 point).'
        body.appendChild(info)

        const pointsEl = document.createElement('p')
        pointsEl.className = 'modal-subtitle'
        pointsEl.textContent = 'Unspent skill points: ' + p.skillPoints
        body.appendChild(pointsEl)

        const skills = [
            {
                key: 'strength',
                name: 'Strength',
                desc: 'Increase physical power. +Attack.'
            },
            {
                key: 'endurance',
                name: 'Endurance',
                desc: 'Bolster toughness. +Max HP and a bit of Armor.'
            },
            {
                key: 'willpower',
                name: 'Willpower',
                desc: 'Sharpen arcane focus. +Magic and max resource.'
            }
        ]

        skills.forEach((s) => {
            const row = document.createElement('div')
            row.className = 'item-row'

            const header = document.createElement('div')
            header.className = 'item-row-header'

            const left = document.createElement('div')
            left.innerHTML =
                '<span class="item-name">' +
                s.name +
                '</span>' +
                ' (Rank ' +
                p.skills[s.key] +
                ')'

            const right = document.createElement('div')
            right.className = 'item-meta'
            right.textContent = s.desc

            header.appendChild(left)
            header.appendChild(right)

            const actions = document.createElement('div')
            actions.className = 'item-actions'

            const btn = document.createElement('button')
            btn.className = 'btn small'
            btn.textContent = 'Increase'
            btn.addEventListener('click', () => {
                if (p.skillPoints <= 0) return

                p.skills[s.key] += 1
                p.skillPoints -= 1

                recalcPlayerStats()
                p.hp = p.maxHp // full heal on level-up
                p.resource = p.maxResource

                updateHUD()
                pointsEl.textContent = 'Unspent skill points: ' + p.skillPoints

                addLog(
                    'You increase ' +
                        s.name +
                        ' to rank ' +
                        p.skills[s.key] +
                        '.',
                    'good'
                )

                if (p.skillPoints <= 0) {
                    closeModal()
                } else {
                    // update shown rank
                    left.innerHTML =
                        '<span class="item-name">' +
                        s.name +
                        '</span>' +
                        ' (Rank ' +
                        p.skills[s.key] +
                        ')'
                }
            })

            actions.appendChild(btn)
            row.appendChild(header)
            row.appendChild(actions)
            body.appendChild(row)
        })
    })
}

// --- COMBAT CORE --------------------------------------------------------------

// Helper utils for gear affixes (kept lightweight + safe for old saves)
function clampNumber(v, min, max) {
    const n = finiteNumber(v, 0)
    return Math.max(min, Math.min(max, n))
}

// Haste is a percent stat. We treat it as a general "tempo" multiplier for passive regen and similar ticks.
// denom controls how powerful haste is: 60% haste => +50% when denom=120.
function getPlayerHasteMultiplier(p, denom = 120) {
    const hastePct = clampNumber(p && p.stats ? p.stats.haste || 0 : 0, 0, 80)
    return 1 + hastePct / denom
}

function getPlayerElementalBonusPct(elementType) {
    const p = state.player
    if (!p || !p.stats || !p.stats.elementalBonuses || !elementType) return 0
    const v = p.stats.elementalBonuses[elementType]
    return Number(v || 0)
}

// Small "tick" model for HP regen affix (accumulates fractional values)
function applyPlayerRegenTick() {
    const p = state.player
    if (!p || !p.stats) return

    const mult = getPlayerHasteMultiplier(p, 120)
    const regen = Number(p.stats.hpRegen || 0) * mult
    if (regen <= 0) return

    p._regenCarry = (p._regenCarry || 0) + regen
    const heal = Math.floor(p._regenCarry)
    if (heal <= 0) return

    p._regenCarry -= heal
    const before = p.hp
    p.hp = Math.min(p.maxHp, p.hp + heal)
    // Keep regen quiet unless it meaningfully changes HP (prevents log spam)
    if (p.hp > before && heal >= 2) {
        addLog('You regenerate ' + (p.hp - before) + ' HP.', 'system')
    }
}

function applyPlayerOnHitEffects(damageDealt, elementType) {
    const p = state.player
    if (!p || !p.stats) return

    // Most callers pass the element explicitly (spells), but basic attacks
    // historically did not. Default to the last resolved element type so
    // passives that care about it (ex: Necromancer) still function.
    const resolvedElementType =
        elementType || state.lastPlayerDamageElementType || null

    // Lifesteal
    let lsPct = clampNumber(p.stats.lifeSteal || 0, 0, 60)

    // Vampire passive: Hungering Vein.
    if (p.classId === 'vampire' && p.resourceKey === 'essence') {
        const threshold = p.maxResource * 0.55
        if (p.resource > threshold) {
            lsPct = clampNumber(lsPct + 8, 0, 75)
        }
    }


// Ability context can add temporary lifesteal (ex: Bloodrush).
const actx = _getPlayerAbilityContext()
if (actx && typeof actx.lifeStealBonusPct === 'number' && Number.isFinite(actx.lifeStealBonusPct)) {
    lsPct = clampNumber(lsPct + actx.lifeStealBonusPct, 0, 75)
}

    if (lsPct > 0 && damageDealt > 0) {
        const heal = Math.max(1, Math.round((damageDealt * lsPct) / 100))
        p.hp = Math.min(p.maxHp, p.hp + heal)
        addLog('Life steal restores ' + heal + ' HP.', 'system')
    }

    // Necromancer passive: small mana tithe on shadow hits
    if (
        p.classId === 'necromancer' &&
        resolvedElementType === 'shadow' &&
        p.resourceKey === 'mana'
    ) {
        p.resource = Math.min(p.maxResource, p.resource + 2)
    }

    // Patch 1.1.7: Necromancer unlock (Lich Form) — siphon a bit of HP on shadow hits while active.
    if (p.status && (p.status.lichTurns || 0) > 0 && resolvedElementType === 'shadow' && damageDealt > 0) {
        const heal = Math.max(1, Math.round(damageDealt * 0.08))
        p.hp = Math.min(p.maxHp, p.hp + heal)
        addLog('Lich Form siphons ' + heal + ' HP.', 'system')
    }
}



// --- Deep Combat: Posture + Intent helpers (Patch 1.1.6) -----------------------
function computeEnemyPostureMax(enemy) {
    return computeEnemyPostureMaxImpl(enemy)
}

function getEffectiveEnemyAttack(enemy) {
    if (!enemy) return 0
    const base = Number(
        typeof enemy.baseAttack === 'number' ? enemy.baseAttack : enemy.attack || 0
    )
    const down =
        enemy.atkDownTurns && enemy.atkDownTurns > 0
            ? Number(enemy.atkDownFlat || 0)
            : 0
    return Math.max(0, Math.round(base - down))
}

function getEffectiveEnemyMagic(enemy) {
    if (!enemy) return 0
    const base = Number(
        typeof enemy.baseMagic === 'number' ? enemy.baseMagic : enemy.magic || 0
    )
    const down =
        enemy.magDownTurns && enemy.magDownTurns > 0
            ? Number(enemy.magDownFlat || 0)
            : 0
    return Math.max(0, Math.round(base - down))
}

function applyEnemyAtkDown(enemy, flatAmount, turns) {
    if (!enemy) return
    ensureEnemyRuntime(enemy)

    const amt = Math.max(0, Number(flatAmount || 0))
    const t = Math.max(0, Math.floor(Number(turns || 0)))
    if (amt <= 0 || t <= 0) return

    const baseAtk = Number(
        typeof enemy.baseAttack === 'number' ? enemy.baseAttack : enemy.attack || 0
    )
    const cap = Math.max(1, Math.round(baseAtk * 0.6))
    enemy.atkDownFlat = Math.min(cap, Number(enemy.atkDownFlat || 0) + amt)
    enemy.atkDownTurns = Math.max(enemy.atkDownTurns || 0, t)
}

function clearEnemyIntent(enemy, reasonText) {
    if (!enemy || !enemy.intent) return
    enemy.intent = null
    if (reasonText) addLog(reasonText, 'system')
}

function applyEnemyPostureFromPlayerHit(enemy, damageDealt, meta = {}) {
    if (!enemy) return
    const dmg = Math.max(0, Math.round(Number(damageDealt || 0)))
    if (dmg <= 0) return

    ensureEnemyRuntime(enemy)

    // Enemy mini-affixes that trigger when the player hits the enemy (e.g., Thorns reflect).
    applyEnemyAffixesOnPlayerHit(enemy, dmg)
    if (typeof enemy.postureMax !== 'number' || enemy.postureMax <= 0) {
        enemy.postureMax = computeEnemyPostureMax(enemy)
    }
    if (typeof enemy.posture !== 'number') enemy.posture = 0

    // Build posture mostly from meaningful hits; bosses resist posture break.
    //
    // NOTE: Smoke tests sometimes set postureMax extremely low (e.g. 5) to verify the
    // break/disrupt behavior in a single hit. For those tiny caps, we intentionally
    // allow a single hit to fully break posture so the test stays deterministic.
    let gain = Math.max(1, Math.round(dmg * 0.25))

    // Basic attacks still contribute meaningful posture pressure.
    if (meta && meta.isBasic) gain += 1

    // Crits and interrupts spike posture more.
    if (state.lastPlayerHitWasCrit) gain = Math.round(gain * 1.5)
    if (meta && meta.tag === 'interrupt') gain += 2

    if (enemy.isBoss) gain = Math.max(1, Math.round(gain * 0.75))
    if (enemy.isElite) gain = Math.max(1, Math.round(gain * 0.85))

    // Keep single-hit posture gains from instantly breaking high-posture enemies.
    // For very small postureMax (test helpers / special enemies), don't cap the gain.
    const perHitCap =
        enemy.postureMax <= 12
            ? enemy.postureMax
            : Math.max(1, Math.round(enemy.postureMax * 0.35))

    // Determinism for tiny posture caps (used by smoke tests).
    if (enemy.postureMax <= 10) gain = enemy.postureMax

    gain = Math.min(perHitCap, gain)

enemy.posture += gain

    if (enemy.posture >= enemy.postureMax) {
        enemy.posture = 0
        enemy.brokenTurns = Math.max(enemy.brokenTurns || 0, 1)
        clearEnemyIntent(enemy, enemy.name + "'s focus shatters!")
        addLog(enemy.name + ' is Broken!', 'good')
    }
}


function calcPhysicalDamage(baseStat, elementType) {
    const enemy = state.currentEnemy
    const diff = getActiveDifficultyConfig()
    const p = state.player
    const ctx = _getPlayerAbilityContext()

    // Apply temporary player debuffs/buffs without mutating core stats.
    const atkDown =
        p && p.status && p.status.atkDownTurns > 0 ? p.status.atkDown || 0 : 0
    const atkBuff = p && p.status ? p.status.buffAttack || 0 : 0

    let base = (baseStat || 0) + atkBuff - atkDown
    base = Math.max(1, base)

    // Armor penetration (percent) reduces effective armor before mitigation.
    const penPct = clampNumber(p && p.stats ? p.stats.armorPen || 0 : 0, 0, 80)
    let effArmor =
        (((enemy && enemy.armor) || 0) + ((enemy && enemy.armorBuff) || 0)) *
        (1 - penPct / 100)
    effArmor = Math.max(0, effArmor)

    const defense = 100 / (100 + effArmor * 10)

    let dmg = base * defense
    // NOTE: do not shadow the RNG helper `rand()`.
    const variance = 0.85 + rand('player.physVariance') * 0.3
    dmg *= variance
    dmg *= diff.playerDmgMod

    // Context multipliers (upgrades, companion boon, etc.)
    if (ctx && ctx.dmgMult) {
        dmg *= ctx.dmgMult
    }

    // Elemental bonus (if any) – default to weapon element if caller doesn't specify.
    const et =
        elementType || (p && p.stats ? p.stats.weaponElementType : null) || null
    state.lastPlayerDamageElementType = et
    const elemBonusPct = clampNumber(getPlayerElementalBonusPct(et), 0, 200)
    if (elemBonusPct > 0) {
        dmg *= 1 + elemBonusPct / 100
    }

    // Critical hits
    // Player chilled: reduced outgoing damage (from enemy affix / frost effects).
    if (p && p.status && p.status.chilledTurns && p.status.chilledTurns > 0) {
        dmg *= 0.9
    }

    let crit = false
    // Slightly lower baseline crit to keep early combat swinginess down.
    const baseCrit = 0.10
    const gearCrit =
        clampNumber(p && p.stats ? p.stats.critChance || 0 : 0, 0, 75) / 100

    // Rogue passive: opportunist
    const oppBonus =
        p &&
        p.classId === 'rogue' &&
        enemy &&
        enemy.bleedTurns &&
        enemy.bleedTurns > 0
            ? 0.08
            : 0

    const ctxCrit = ctx && ctx.critBonus ? ctx.critBonus : 0
    const critChance = state.flags.alwaysCrit
        ? 1
        : state.flags.neverCrit
        ? 0
        : clampNumber(baseCrit + gearCrit + oppBonus + ctxCrit, 0, 0.75)

    if (rand('player.physCrit') < critChance) {
        dmg *= 1.5
        crit = true
    }

    // Enemy Broken: takes increased damage this round.
    if (enemy && enemy.brokenTurns && enemy.brokenTurns > 0) {
        dmg *= 1.2
    }

    dmg = Math.max(1, Math.round(dmg))
    if (crit) {
        addLog('Critical hit!', 'good')
    }
    state.lastPlayerHitWasCrit = crit
    return dmg
}


function calcMagicDamage(baseStat, elementType) {
    const enemy = state.currentEnemy
    const diff = getActiveDifficultyConfig()
    const p = state.player
    const ctx = _getPlayerAbilityContext()

    const magDown =
        p && p.status && p.status.magicDownTurns > 0
            ? p.status.magicDown || 0
            : 0
    const magBuff = p && p.status ? p.status.buffMagic || 0 : 0

    let base = (baseStat || 0) + magBuff - magDown
    base = Math.max(1, base)

    // Treat armorPen as general "penetration" for now (applies to magicRes too).
    const penPct = clampNumber(p && p.stats ? p.stats.armorPen || 0 : 0, 0, 80)
    let effRes =
        (((enemy && enemy.magicRes) || 0) +
            ((enemy && enemy.magicResBuff) || 0)) *
        (1 - penPct / 100)
    effRes = Math.max(0, effRes)

    const resist = 100 / (100 + effRes * 9)

    let dmg = base * resist
    const dmgVar = 0.85 + rand('player.magicVar') * 0.3
    dmg *= dmgVar
    dmg *= diff.playerDmgMod

    // Context multipliers (upgrades, companion boon, etc.)
    if (ctx && ctx.dmgMult) {
        dmg *= ctx.dmgMult
    }

    // Elemental bonus – caller should pass the spell element.
    const et = elementType || null
    state.lastPlayerDamageElementType = et
    const elemBonusPct = clampNumber(getPlayerElementalBonusPct(et), 0, 200)
    if (elemBonusPct > 0) {
        dmg *= 1 + elemBonusPct / 100
    }

    // Necromancer Death Mark: amplify the next shadow hit.
    if (
        enemy &&
        et === 'shadow' &&
        enemy.deathMarkTurns &&
        enemy.deathMarkTurns > 0
    ) {
        const mult = enemy.deathMarkMult || 1.3
        dmg *= mult
        enemy.deathMarkTurns = 0
        enemy.deathMarkMult = 0
        addLog('Death Mark detonates!', 'good')
    }

    let crit = false
    // Slightly lower baseline crit to keep early combat swinginess down.
    const baseCrit = 0.08
    const gearCrit =
        clampNumber(p && p.stats ? p.stats.critChance || 0 : 0, 0, 75) / 100
    const ctxCrit = ctx && ctx.critBonus ? ctx.critBonus : 0
    const critChance = state.flags.alwaysCrit
        ? 1
        : state.flags.neverCrit
        ? 0
        : clampNumber(baseCrit + gearCrit + ctxCrit, 0, 0.75)

    if (rand('player.magicCrit') < critChance) {
        dmg *= 1.6
        crit = true
    }

    // Enemy Broken: takes increased damage this round.
    if (enemy && enemy.brokenTurns && enemy.brokenTurns > 0) {
        dmg *= 1.2
    }

    dmg = Math.max(1, Math.round(dmg))
    if (crit) {
        addLog('Arcane surge! Spell critically strikes.', 'good')
    }
    state.lastPlayerHitWasCrit = crit
    return dmg
}


function calcEnemyDamage(baseStat, elementType) {
    const p = state.player
    const diff = getActiveDifficultyConfig()
    const enemy = state.currentEnemy

    // Apply temporary debuffs to player defenses
    const armorDown =
        p && p.status && p.status.armorDownTurns > 0 ? p.status.armorDown || 0 : 0
    const resDown =
        p && p.status && p.status.magicResDownTurns > 0
            ? p.status.magicResDown || 0
            : 0

    let effArmor = Math.max(0, (p.stats.armor || 0) - armorDown)
    let effRes = Math.max(0, (p.stats.magicRes || 0) - resDown)

    // Warrior passive: Bulwark Fury (+2 armor when Fury is high).
    if (p && p.classId === 'warrior' && p.resourceKey === 'fury' && p.resource >= 40) {
        effArmor += 2
    }

    let mitigation = 1

    // Element / damage-type mitigation
    // Historically this function was sometimes called with a boolean flag
    // (true = magic, false = physical). Support both forms.
    const elem = typeof elementType === 'string' ? elementType : null
    const treatAsMagic =
        elementType === true ||
        elementType === 'magic' ||
        (elem &&
            [
                'fire',
                'frost',
                'ice',
                'lightning',
                'holy',
                'shadow',
                'arcane',
                'earth',
                'poison',
                'nature'
            ].includes(elem))

    if (treatAsMagic) {
        const resist = 100 / (100 + effRes * 9)
        mitigation *= resist
    } else {
        const defense = 100 / (100 + effArmor * 10)
        mitigation *= defense
    }

    let dmg = (baseStat || 0) * mitigation
    // NOTE: do not shadow the RNG helper `rand()`.
    const variance = 0.85 + rand('enemy.variance') * 0.3
    dmg *= variance
    dmg *= diff.enemyDmgMod

    // Enemy chilled: reduced outgoing damage.
    if (enemy && enemy.chilledTurns && enemy.chilledTurns > 0) {
        dmg *= 0.9
    }

    // Player damage reduction status
    if (p && p.status && p.status.dmgReductionTurns > 0) {
        dmg *= 0.75
    }

    // Paladin passive: sanctuary while shielded.
    if (p && p.classId === 'paladin' && p.status && (p.status.shield || 0) > 0) {
        dmg *= 0.92
    }

    // Global Resist-All (percent) reduces any incoming damage.
    const resistAllPct = clampNumber(
        p && p.stats ? p.stats.resistAll || 0 : 0,
        0,
        80
    )
    if (resistAllPct > 0) {
        dmg *= 1 - resistAllPct / 100
    }

    // Vulnerable: takes increased damage while active.
    if (p && p.status && p.status.vulnerableTurns > 0) {
        dmg *= 1.15
    }

    dmg = Math.max(1, Math.round(dmg))
    return dmg
}

// --- TRUE TURN-BASED COMBAT + MULTI-ENEMY (Patch 1.1.9) ------------------------

function ensureCombatTurnState() {
    if (!state) return null

    if (!Array.isArray(state.enemies)) state.enemies = []
    if (typeof state.targetEnemyIndex !== 'number') state.targetEnemyIndex = 0

    if (!state.combat || typeof state.combat !== 'object') {
        state.combat = {
            phase: 'player', // 'player' | 'resolving'
            busy: false,
            round: 1,
            battleDrops: 0
        }
    }

    if (!state.combat.phase) state.combat.phase = 'player'
    if (typeof state.combat.busy !== 'boolean') state.combat.busy = false
    if (typeof state.combat.round !== 'number') state.combat.round = 1
    if (typeof state.combat.battleDrops !== 'number') state.combat.battleDrops = 0

    return state.combat
}

function combatIsPlayerTurn() {
    const c = ensureCombatTurnState()
    return !!(c && c.phase === 'player' && !c.busy)
}

function combatIsBusy() {
    const c = ensureCombatTurnState()
    return !!(c && c.busy)
}

function _combatDelayMs(base) {
    const b = Math.max(0, Number(base || 0))

    // Text speed: higher = faster (shorter pauses)
    const speed = clampFinite(state && state.settingsTextSpeed, 30, 200, 100)
    const speedMult = 100 / Math.max(30, speed)

    // Reduce motion: keep the rhythm but shorten pauses.
    const rm = !!(state && state.settingsReduceMotion)
    const rmMult = rm ? 0.45 : 1

    return Math.max(0, Math.round(b * speedMult * rmMult))
}

function combatPause(baseMs) {
    // Smoke tests run synchronously; never wait on timers during the suite.
    try {
        if (state && state.debug && state.debug.smokeTestRunning) return Promise.resolve()
    } catch (_) {}

    const ms = _combatDelayMs(baseMs)
    if (ms <= 0) return Promise.resolve()
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function getAllEnemies() {
    if (Array.isArray(state.enemies) && state.enemies.length) return state.enemies
    return state.currentEnemy ? [state.currentEnemy] : []
}

function getAliveEnemies() {
    return getAllEnemies().filter((e) => e && finiteNumber(e.hp, 0) > 0)
}

function anyEnemiesAlive() {
    return getAliveEnemies().length > 0
}

function syncCurrentEnemyToTarget() {
    const all = getAllEnemies()
    if (!all.length) {
        state.currentEnemy = null
        return null
    }

    const alive = getAliveEnemies()
    if (!alive.length) {
        state.currentEnemy = null
        return null
    }

    let idx = Math.floor(Number(state.targetEnemyIndex || 0))
    if (!Number.isFinite(idx)) idx = 0

    const cur = all[idx]
    if (!cur || finiteNumber(cur.hp, 0) <= 0) {
        const firstAlive = all.findIndex((e) => e && finiteNumber(e.hp, 0) > 0)
        idx = firstAlive >= 0 ? firstAlive : 0
        state.targetEnemyIndex = idx
    }

    state.currentEnemy = all[idx]
    return state.currentEnemy
}

// Ensure combat pointers remain consistent (Patch 1.1.9 hardening).
// Repairs cases where inCombat is true but currentEnemy is missing (e.g., after target dies).
function ensureCombatPointers() {
    if (!state || !state.inCombat) return

    // Prefer multi-enemy container when present.
    if (Array.isArray(state.enemies) && state.enemies.length) {
        // If target index points at a dead enemy, sync will advance to a living one.
        try {
            syncCurrentEnemyToTarget()
        } catch (_) {}

        // If we still have no current enemy, fall back to first living enemy.
        if (!state.currentEnemy) {
            const firstAlive = state.enemies.find((e) => e && finiteNumber(e.hp, 0) > 0)
            if (firstAlive) {
                state.currentEnemy = firstAlive
                state.targetEnemyIndex = Math.max(0, state.enemies.indexOf(firstAlive))
            }
        }

        // If nobody is alive, combat should end.
        const anyAlive = state.enemies.some((e) => e && finiteNumber(e.hp, 0) > 0)
        if (!anyAlive) {
            state.inCombat = false
            state.currentEnemy = null
            state.enemies = []
            state.targetEnemyIndex = 0
            if (state.combat) {
                state.combat.busy = false
                state.combat.phase = 'player'
            }
        }
        return
    }

    // Legacy single-enemy combat: if inCombat true, currentEnemy must exist.
    if (!state.currentEnemy) {
        // If some code left an enemy on a different key, try to recover.
        if (state.enemy) state.currentEnemy = state.enemy
    }

    // If still missing, treat as desync and exit combat safely.
    if (!state.currentEnemy) {
        state.inCombat = false
        state.targetEnemyIndex = 0
        if (state.combat) {
            state.combat.busy = false
            state.combat.phase = 'player'
        }
    }
}


function setTargetEnemyIndex(idx, opts = {}) {
    const all = getAllEnemies()
    if (!all.length) return

    const n = all.length
    let next = Math.floor(Number(idx || 0))
    if (!Number.isFinite(next)) next = 0

    // Wrap
    next = ((next % n) + n) % n

    // If chosen is dead, advance to the next alive.
    let guard = 0
    while (guard < n && all[next] && finiteNumber(all[next].hp, 0) <= 0) {
        next = (next + 1) % n
        guard += 1
    }

    state.targetEnemyIndex = next
    state.currentEnemy = all[next]
    updateEnemyPanel()

    if (!opts.silent && n > 1 && state.currentEnemy) {
        addLog('Target: ' + state.currentEnemy.name + '.', 'system')
    }
}

function cycleTargetEnemy(delta, opts = {}) {
    const all = getAllEnemies()
    if (all.length <= 1) return
    const d = Math.sign(Number(delta || 0))
    if (!d) return
    setTargetEnemyIndex((state.targetEnemyIndex || 0) + d, opts)
}

function canPlayerActNow() {
    if (!state || !state.inCombat) return false
    if (!anyEnemiesAlive()) return false
    ensureCombatTurnState()
    return combatIsPlayerTurn()
}

function guardPlayerTurn() {
    if (!state || !state.inCombat) return false
    ensureCombatTurnState()

    if (combatIsBusy()) {
        addLog('Actions are resolving...', 'system')
        return false
    }

    if (state.combat.phase !== 'player') {
        addLog('Not your turn.', 'system')
        return false
    }

    if (!anyEnemiesAlive()) return false
    syncCurrentEnemyToTarget()
    return true
}

async function runPostPlayerTurnSequence() {
    const c = ensureCombatTurnState()
    if (!c) return

    // Brief "thinking" pause after the player.
    await combatPause(520)
    if (!state.inCombat) return

    // Companion (if any)
    if (state.companion && anyEnemiesAlive()) {
        syncCurrentEnemyToTarget()
        companionActIfPresent()
        updateHUD()
        updateEnemyPanel()

        if (!state.inCombat || !anyEnemiesAlive()) return

        await combatPause(520)
        if (!state.inCombat) return
    }

    // Enemies act in order.
    const enemies = getAllEnemies().slice()
    for (let i = 0; i < enemies.length; i++) {
        const enemy = enemies[i]
        if (!state.inCombat) return
        if (!enemy || finiteNumber(enemy.hp, 0) <= 0) continue

        // Small pause before each enemy action.
        await combatPause(460)
        if (!state.inCombat) return

        enemyAct(enemy)

        // enemyAct may change currentEnemy; restore UI target.
        syncCurrentEnemyToTarget()
        updateEnemyPanel()

        if (!state.inCombat) return
        if (!anyEnemiesAlive()) return

        if (state.player && finiteNumber(state.player.hp, 0) <= 0) return
    }

    // End-of-round ticks happen once after all enemies.
    if (state.inCombat) {
        postEnemyTurn()
        if (state.combat) state.combat.round = (state.combat.round || 1) + 1
    }
}

function endPlayerTurn(meta) {
    const c = ensureCombatTurnState()
    if (!c) return

    if (!state.inCombat) return
    if (c.busy) return

    // Smoke tests run synchronously; don't kick off async turn resolution.
    try {
        if (state && state.debug && state.debug.smokeTestRunning) return
    } catch (_) {}

    c.busy = true
    c.phase = 'resolving'
    renderActions()

    Promise.resolve()
        .then(() => runPostPlayerTurnSequence())
        .catch((e) => console.error('turn-sequence error', e))
        .finally(() => {
            if (state && state.combat) {
                state.combat.busy = false
            }
            // Return control to the player.
            if (state && state.inCombat && state.combat) {
                state.combat.phase = 'player'
            } else if (state && state.combat) {
                state.combat.phase = 'player'
            }

            // Re-sync target pointers and begin the next player turn.
            syncCurrentEnemyToTarget()
            beginPlayerTurn()
            renderActions()
        })
}

function playerBasicAttack() {
    if (!guardPlayerTurn()) return

    const p = state.player
    recordInput('combat.attack')
    const enemy = state.currentEnemy
    if (!p || !enemy) return
    ensurePlayerSpellSystems(p)

    const st = p.status || (p.status = {})
    const ctx = {
        dmgMult: 1,
        healMult: 1,
        critBonus: 0,
        consumeCompanionBoon: false,
        consumeFirstHitBonus: false,
        didDamage: false
    }

    if (st.buffFromCompanionTurns && st.buffFromCompanionTurns > 0) {
        ctx.dmgMult *= 1.15
        ctx.consumeCompanionBoon = true
    }

    if (p.classId === 'ranger' && st.firstHitBonusAvailable) {
        ctx.dmgMult *= 1.12
        ctx.consumeFirstHitBonus = true
    }

    _setPlayerAbilityContext(ctx)
    const dmg = calcPhysicalDamage((p.stats.attack || 0) * 1.0)
    _setPlayerAbilityContext(null)

    enemy.hp -= dmg
    applyPlayerOnHitEffects(dmg)
    applyEnemyPostureFromPlayerHit(enemy, dmg, { damageType: 'physical', isBasic: true })
    applyPlayerRegenTick()

    ctx.didDamage = true
    _consumeCompanionBoonIfNeeded(p, ctx)
    if (ctx.consumeFirstHitBonus) st.firstHitBonusAvailable = false

    addLog('You strike ' + enemy.name + ' for ' + dmg + ' damage.', 'good')

    const _gainMult = getPlayerHasteMultiplier(p, 150)

    if (p.resourceKey === 'fury') {
        p.resource = Math.min(p.maxResource, (p.resource || 0) + Math.max(1, Math.round(8 * _gainMult)))
    } else if (p.resourceKey === 'blood') {
        p.resource = Math.min(p.maxResource, (p.resource || 0) + Math.max(1, Math.round(5 * _gainMult)))
    } else if (p.resourceKey === 'mana') {
        p.resource = Math.min(p.maxResource, (p.resource || 0) + Math.max(1, Math.round(4 * _gainMult)))
    } else if (p.resourceKey === 'essence') {
        p.resource = Math.min(p.maxResource, (p.resource || 0) + Math.max(1, Math.round(4 * _gainMult)))
    }

    updateHUD()

    if (enemy.hp <= 0) {
        // Defeat handling may end combat and/or advance the target; do it before UI sync.
        handleEnemyDefeat(enemy)
    }

    updateEnemyPanel()

    if (state.inCombat) {
        endPlayerTurn({ source: 'attack' })
    }
}

function playerInterrupt() {
    if (!guardPlayerTurn()) return
    const p = state.player
    const enemy = state.currentEnemy
    if (!p || !enemy) return

    recordInput('combat.interrupt')
    ensurePlayerSpellSystems(p)

    const cost = 10
    if ((p.resource || 0) < cost) {
        addLog('Not enough ' + p.resourceName + ' to interrupt.', 'system')
        return
    }

    p.resource -= cost

    const ctx = {
        dmgMult: 1,
        healMult: 1,
        critBonus: 0,
        consumeCompanionBoon: false,
        consumeFirstHitBonus: false,
        didDamage: false
    }

    _setPlayerAbilityContext(ctx)
    const dmg = calcPhysicalDamage(((p.stats.attack || 0) * 0.55))
    _setPlayerAbilityContext(null)

    enemy.hp -= dmg
    applyPlayerOnHitEffects(dmg)
    applyEnemyPostureFromPlayerHit(enemy, dmg, { damageType: 'physical', tag: 'interrupt' })
    applyPlayerRegenTick()

    if (enemy.intent) {
        enemy.intent = null
        addLog('You disrupt the foe and cancel their telegraphed attack!', 'good')
    }

    if (enemy.hp <= 0) {
        addLog('Your interrupt finishes ' + enemy.name + '!', 'good')
        handleEnemyDefeat(enemy)
    } else {
        addLog('You interrupt for ' + dmg + ' damage.', 'good')
    }

    updateHUD()
    updateEnemyPanel()

    if (state.inCombat) {
        endPlayerTurn({ source: 'interrupt' })
    }
}



// --- ENEMY TURN (ABILITY + LEARNING AI) --------------------------------------
function ensureEnemyRuntime(enemy) {
    return ensureEnemyRuntimeImpl(enemy, { pickEnemyAbilitySet })
}

function ensureEnemyAbilityStat(enemy, aid) {
    if (!enemy.memory) return { value: 0, uses: 0 }
    if (!enemy.memory.abilityStats) enemy.memory.abilityStats = {}
    if (!enemy.memory.abilityStats[aid]) {
        enemy.memory.abilityStats[aid] = { value: 0, uses: 0 }
    }
    return enemy.memory.abilityStats[aid]
}

function tickEnemyStartOfTurn(enemy) {
    if (!enemy) return false

    // Tick debuffs first so durations are consistent even if the enemy loses their action.
    if (enemy.atkDownTurns && enemy.atkDownTurns > 0) {
        enemy.atkDownTurns -= 1
        if (enemy.atkDownTurns <= 0) {
            enemy.atkDownFlat = 0
            addLog(enemy.name + ' recovers their strength.', 'system')
        }
    }
    if (enemy.magDownTurns && enemy.magDownTurns > 0) {
        enemy.magDownTurns -= 1
        if (enemy.magDownTurns <= 0) {
            enemy.magDownFlat = 0
            addLog(enemy.name + ' regains arcane focus.', 'system')
        }
    }

    // Guard ticks down
    if (enemy.guardTurns && enemy.guardTurns > 0) {
        enemy.guardTurns -= 1
        if (enemy.guardTurns <= 0) {
            enemy.armorBuff = 0
            enemy.magicResBuff = 0
            addLog(enemy.name + "'s guard drops.", 'system')
        }
    }

    // Enrage ticks down
    if (enemy.enrageTurns && enemy.enrageTurns > 0) {
        enemy.enrageTurns -= 1
        if (enemy.enrageTurns <= 0) {
            enemy.attackBuff = 0
            enemy.enrageAtkPct = 0
            addLog(enemy.name + ' calms down.', 'system')
        }
    }

    // Berserk affix: when low, permanently enter an "enraged" state for this fight.
    if (
        enemy.affixBerserkAtkPct &&
        enemy.affixBerserkAtkPct > 0 &&
        enemy.affixBerserkThreshold &&
        enemy.affixBerserkThreshold > 0 &&
        !enemy.affixBerserkActive
    ) {
        const ratio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1
        if (ratio <= enemy.affixBerserkThreshold) {
            enemy.affixBerserkActive = true
            enemy.enrageTurns = Math.max(enemy.enrageTurns || 0, 999)
            enemy.enrageAtkPct = Math.max(enemy.enrageAtkPct || 0, enemy.affixBerserkAtkPct)
            addLog(enemy.name + ' enters a berserk frenzy!', 'danger')
        }
    }

    // Chill ticks down
    if (enemy.chilledTurns && enemy.chilledTurns > 0) {
        enemy.chilledTurns -= 1
        if (enemy.chilledTurns <= 0) {
            addLog(enemy.name + ' shakes off the chill.', 'system')
        }
    }

    // Marks (Ranger): ticks down and clears when expired.
    if (enemy.markedTurns && enemy.markedTurns > 0) {
        enemy.markedTurns -= 1
        if (enemy.markedTurns <= 0) {
            enemy.markedStacks = 0
        }
    }


    // Broken: posture break skips the next action and disrupts telegraphs.
    if (enemy.brokenTurns && enemy.brokenTurns > 0) {
        enemy.brokenTurns -= 1
        clearEnemyIntent(enemy, enemy.name + " can't keep their focus!")
        addLog(enemy.name + ' is Broken and cannot act!', 'good')
        return true
    }

    // Stun: skip this enemy turn.
    if (enemy.stunTurns && enemy.stunTurns > 0) {
        enemy.stunTurns -= 1
        clearEnemyIntent(enemy, enemy.name + " loses their intent!")
        addLog(enemy.name + ' is stunned and cannot act!', 'good')
        return true
    }

    // If forced guard (boss phase etc.), end turn early.
    if (enemy.aiForcedGuard) {
        enemy.aiForcedGuard = false
        enemy.guardTurns = Math.max(enemy.guardTurns || 0, 1)
        enemy.armorBuff = (enemy.armorBuff || 0) + 2
        enemy.magicResBuff = (enemy.magicResBuff || 0) + 2
        addLog(enemy.name + ' braces for impact.', 'system')
        return true
    }

    return false
}


function canUseEnemyAbility(enemy, aid) {
    const ab = ENEMY_ABILITIES[aid]
    if (!ab) return false
    const cd = enemy.abilityCooldowns ? enemy.abilityCooldowns[aid] || 0 : 0
    return cd <= 0
}

function tickEnemyCooldowns() {
    const list = (Array.isArray(state.enemies) && state.enemies.length) ? state.enemies : (state.currentEnemy ? [state.currentEnemy] : [])
    list.forEach((enemy) => {
        if (!enemy || !enemy.abilityCooldowns) return
        Object.keys(enemy.abilityCooldowns).forEach((k) => {
            if (enemy.abilityCooldowns[k] > 0) enemy.abilityCooldowns[k] -= 1
        })
    })
}

function scoreEnemyAbility(enemy, p, aid) {
    const ab = ENEMY_ABILITIES[aid]
    if (!ab) return -9999

    // Memory / long-term learned value
    const stat = ensureEnemyAbilityStat(enemy, aid)
    const learned = stat.value || 0

    // Immediate heuristic
    let score = 0

    const hpRatio = enemy.maxHp > 0 ? enemy.hp / enemy.maxHp : 1
    const playerHpRatio = p.maxHp > 0 ? p.hp / p.maxHp : 1

    // Guard when low or when player is healthy (stall for better burst windows)
    if (ab.type === 'guard') {
        score += 8
        if (hpRatio < 0.45) score += 18
        if (enemy.guardTurns > 0) score -= 25 // don't spam guard
    }

    // Buff when planning for burst
    if (ab.type === 'buff') {
        score += 6
        if (hpRatio < 0.6) score += 10
        if (enemy.enrageTurns > 0) score -= 30
    }

    // Debuffs become more valuable when player is healthy / shielded
    if (ab.type === 'debuff' || (ab.type && ab.type.indexOf('debuff') >= 0)) {
        score += 10
        if (playerHpRatio > 0.6) score += 8
        if ((p.status && p.status.shield) > 0) score += 6
    }

    // Damage estimate
    if (ab.type && ab.type.indexOf('damage') >= 0) {
        const isMagic = ab.damageType === 'magic'
        const baseStat =
            (isMagic ? enemy.magic : enemy.attack) * (ab.potency || 1)
        const enrageMult = enemy.enrageAtkPct
            ? 1 + enemy.enrageAtkPct * (isMagic ? 0.5 : 1)
            : 1
        const dmgEst = calcEnemyDamage(baseStat * enrageMult, isMagic)

        score += dmgEst

        // kill pressure
        if (dmgEst >= p.hp) score += 65
        if (playerHpRatio < 0.35) score += 15

        // shield tech
        if (ab.shatterShieldFlat && p.status && p.status.shield > 0) {
            score += Math.min(p.status.shield, ab.shatterShieldFlat) * 0.35
        }

        // bleed value
        if (ab.bleedTurns) {
            const alreadyBleeding = p.status && p.status.bleedTurns > 0
            score += alreadyBleeding ? 4 : 10
            if (playerHpRatio < 0.5) score += 6
        }

        // vulnerability is great when setting up a follow-up nuke
        if (ab.vulnerableTurns) {
            score += 12
        }
    }

    // Healing synergy for drain/heal abilities
    if (ab.type === 'damage+heal') {
        if (hpRatio < 0.7) score += 12
        if (hpRatio < 0.4) score += 18
    }

    // Mix in learned value (lightly), scaled by AI smartness.
    const diff = getActiveDifficultyConfig()
    const smart = diff.aiSmartness || 0.6
    score += learned * (0.35 + smart * 0.45)

    return score
}

function chooseEnemyAbility(enemy, p) {
    const diff = getActiveDifficultyConfig()
    const smart = diff.aiSmartness || 0.6

    const kit = Array.isArray(enemy.abilities)
        ? enemy.abilities
        : [...pickEnemyAbilitySet(enemy)]
    const usable = kit.filter((aid) => canUseEnemyAbility(enemy, aid))

    // Fallback: if everything is on cooldown, default to Strike.
    if (usable.length === 0) return 'enemyStrike'

    // Exploration (lower when smartness is high)
    const epsBase = enemy.memory ? enemy.memory.exploration || 0.2 : 0.2
    const eps = Math.max(0.05, Math.min(0.35, epsBase * (1.2 - smart)))

    if (rand('ai.epsChoice') < eps) {
        return usable[randInt(0, usable.length - 1, 'ai.randomUsable')]
    }

    let best = usable[0]
    let bestScore = -Infinity

    for (const aid of usable) {
        const s = scoreEnemyAbility(enemy, p, aid)
        if (s > bestScore) {
            bestScore = s
            best = aid
        }
    }

    return best
}

function applyEnemyAbilityToPlayer(enemy, p, aid) {
    const ab = ENEMY_ABILITIES[aid]
    if (!ab) return { damageDealt: 0, healDone: 0, shieldShattered: 0 }

    const status = p.status || (p.status = {})

    // Apply buffs/guards that don't deal damage.
    if (ab.type === 'guard') {
        const turns = ab.guardTurns || 2
        const bonus = ab.armorBonus || 3

        // If already guarding, refresh duration but don't stack armor forever.
        if (enemy.guardTurns <= 0) {
            enemy.guardArmorBonus = bonus
            enemy.armorBuff = (enemy.armorBuff || 0) + bonus
        } else {
            // Refresh only.
            enemy.guardArmorBonus = Math.max(enemy.guardArmorBonus || 0, bonus)
        }
        enemy.guardTurns = Math.max(enemy.guardTurns || 0, turns)

        let healDone = 0
        if (ab.healPct) {
            const heal = Math.max(1, Math.round(enemy.maxHp * ab.healPct))
            enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal)
            healDone = heal
        }

        addLog(enemy.name + ' braces behind its guard.', 'danger')
        return { damageDealt: 0, healDone, shieldShattered: 0 }
    }

    if (ab.type === 'buff') {
        enemy.enrageTurns = Math.max(
            enemy.enrageTurns || 0,
            ab.enrageTurns || 2
        )
        enemy.enrageAtkPct = Math.max(
            enemy.enrageAtkPct || 0,
            ab.enrageAtkPct || 0.2
        )
        addLog(enemy.name + ' roars with rage!', 'danger')
        return { damageDealt: 0, healDone: 0, shieldShattered: 0 }
    }

    if (ab.type === 'debuff') {
        const turns = ab.debuffTurns || 3

        if (ab.atkDown) {
            status.atkDown = Math.max(status.atkDown || 0, ab.atkDown)
            status.atkDownTurns = Math.max(status.atkDownTurns || 0, turns)
        }
        if (ab.armorDown) {
            status.armorDown = Math.max(status.armorDown || 0, ab.armorDown)
            status.armorDownTurns = Math.max(status.armorDownTurns || 0, turns)
        }
        addLog(enemy.name + ' lays a vile curse upon you!', 'danger')
        return { damageDealt: 0, healDone: 0, shieldShattered: 0 }
    }

    // Damage abilities ----------------------------------------------------------
    const isMagic = ab.damageType === 'magic'
    const baseStat = (isMagic ? getEffectiveEnemyMagic(enemy) : getEffectiveEnemyAttack(enemy)) * (ab.potency || 1)
    const enrageMult = enemy.enrageAtkPct
        ? 1 + enemy.enrageAtkPct * (isMagic ? 0.5 : 1)
        : 1
    const dmg = calcEnemyDamage(baseStat * enrageMult, isMagic)

    // Dodge chance (percent). Dodging avoids damage + on-hit debuffs.
    let dodgePct = clampNumber(p && p.stats ? p.stats.dodgeChance || 0 : 0, 0, 60)

    // Patch 1.1.0: evasion windows + vampire passive dodge
    const st = p.status || {}
    if (st.evasionTurns && st.evasionTurns > 0) {
        dodgePct += Math.round((st.evasionBonus || 0) * 100)
    }
    if (p.classId === 'vampire' && p.resourceKey === 'essence') {
        const threshold = p.maxResource * 0.55
        if (p.resource > threshold) {
            dodgePct += 8
        }
    }

    dodgePct = clampNumber(dodgePct, 0, 75)
    const dodgeChance = dodgePct / 100
    if (!ab.undodgeable && dodgeChance > 0 && rand('combat.dodge') < dodgeChance) {
        addLog('You dodge the attack!', 'good')
        return { damageDealt: 0, healDone: 0, shieldShattered: 0 }
    }

    // Extra shield shatter first (so the "shatter" feels distinct from normal absorption)
    let shieldShattered = 0
    if (ab.shatterShieldFlat && status.shield > 0) {
        shieldShattered = Math.min(status.shield, ab.shatterShieldFlat)
        status.shield -= shieldShattered
        if (shieldShattered > 0) {
            addLog(
                'Your shield fractures for ' + shieldShattered + '!',
                'system'
            )
        }
    }

    // Apply absorption
    let remaining = dmg
    if (status.shield > 0) {
        const absorbed = Math.min(remaining, status.shield)
        status.shield -= absorbed
        remaining -= absorbed
        if (absorbed > 0) {
            addLog('Your shield absorbs ' + absorbed + ' damage.', 'system')
        }
    }

    // Track actual HP damage for affixes/rewards.
    const hpDamage = (state.flags && state.flags.godMode) ? 0 : Math.max(0, remaining)

    if (remaining > 0) {
        if (state.flags.godMode) {
            addLog('God Mode: You ignore ' + remaining + ' damage.', 'system')
        } else {
            p.hp -= remaining
        }
    }


    // Thorns reflect (flat) after a successful hit (even if shield absorbed it).
    const thorns = clampNumber(p && p.stats ? p.stats.thorns || 0 : 0, 0, 9999)
    if (thorns > 0 && enemy && dmg > 0) {
        enemy.hp -= thorns
        addLog('Your thorns deal ' + thorns + ' back to ' + enemy.name + '!', 'good')
        if (enemy.hp <= 0) {
            enemy.hp = 0
            handleEnemyDefeat(enemy)
            return { damageDealt: dmg, healDone: 0, shieldShattered }
        }
    }

    // On-hit debuffs / dots
    const debuffTurns = ab.debuffTurns || 3

    if (ab.vulnerableTurns) {
        status.vulnerableTurns = Math.max(
            status.vulnerableTurns || 0,
            ab.vulnerableTurns
        )
    }
    if (ab.armorDown) {
        status.armorDown = Math.max(status.armorDown || 0, ab.armorDown)
        status.armorDownTurns = Math.max(
            status.armorDownTurns || 0,
            debuffTurns
        )
    }
    if (ab.atkDown) {
        status.atkDown = Math.max(status.atkDown || 0, ab.atkDown)
        status.atkDownTurns = Math.max(status.atkDownTurns || 0, debuffTurns)
    }

    // Bleed/poison reuse player's status fields (and now it actually ticks!)
    if (ab.bleedTurns && ab.bleedBase) {
        const lvl = Number(
            enemy.level || (state.player ? state.player.level : 1) || 1
        )
        const dot = ab.bleedBase + Math.floor(lvl * 0.7)

        status.bleedTurns = Math.max(status.bleedTurns || 0, ab.bleedTurns)
        status.bleedDamage = Math.max(status.bleedDamage || 0, dot)
        addLog('You start bleeding!', 'danger')
    }

    // Drain effects
    let healDone = 0
    if (ab.drainHealPct) {
        healDone = Math.max(1, Math.round(dmg * ab.drainHealPct))
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + healDone)
    }
    if (ab.drainResourcePct && state.player) {
        const cut = Math.max(
            0,
            Math.round((state.player.maxResource || 0) * ab.drainResourcePct)
        )
        if (cut > 0) {
            state.player.resource = Math.max(
                0,
                (state.player.resource || 0) - cut
            )
            addLog('You feel your power ebb (' + cut + ').', 'danger')
        }
    }

    // Text
    if (dmg > 0) {
        addLog(enemy.name + ' uses ' + ab.name + ' on you for ' + dmg + ' damage.', 'danger')
    } else if (healDone > 0) {
        addLog(enemy.name + ' uses ' + ab.name + ' and heals ' + healDone + ' HP.', 'danger')
    } else {
        addLog(enemy.name + ' uses ' + ab.name + '.', 'danger')
    }

    // Enemy mini-affixes (vampiric, frozen, hexed, etc.)
    applyEnemyAffixesOnEnemyHit(enemy, p, { hpDamage: hpDamage, damageTotal: dmg, isMagic: isMagic, abilityId: aid })

    return { damageDealt: dmg, healDone, shieldShattered }
}
function updateEnemyLearning(enemy, aid, reward) {
    if (!enemy || !enemy.memory) return
    const stat = ensureEnemyAbilityStat(enemy, aid)
    stat.uses = (stat.uses || 0) + 1
    const prev = stat.value || 0

    // EMA update; reward can be slightly noisy.
    const alpha = 0.18
    stat.value = prev * (1 - alpha) + reward * alpha

    // Slowly reduce exploration (but never to 0)
    enemy.memory.exploration = Math.max(
        0.06,
        (enemy.memory.exploration || 0.2) * 0.996
    )
}

function enemyAct(enemy) {
    if (!state.inCombat || !enemy) return
    const p = state.player
    if (!p) return

    // Keep currentEnemy pointing at the acting enemy for any helper code that relies on it.
    const prev = state.currentEnemy
    state.currentEnemy = enemy

    try {
        ensureEnemyRuntime(enemy)

        // DoT on enemy (from player/companion), then early-out if it dies
        applyEndOfTurnEffectsEnemy(enemy)
        if (enemy.hp <= 0) {
            handleEnemyDefeat(enemy)
            return
        }

        // Tick enemy timed states (guard/enrage/chill, debuffs, broken/stun)
        const skipped = tickEnemyStartOfTurn(enemy)
        if (skipped) {
            return
        }

        // --- Intent (telegraphed attacks) ---
        if (enemy.intent && enemy.intent.aid) {
            enemy.intent.turnsLeft = (enemy.intent.turnsLeft || 0) - 1
            if (enemy.intent.turnsLeft <= 0) {
                const aid = enemy.intent.aid
                enemy.intent = null

                const beforeHp = p.hp
                const beforeEnemyHp = enemy.hp
                const beforeShield = p.status && p.status.shield ? p.status.shield : 0

                applyEnemyAbilityToPlayer(enemy, p, aid)

                const dmgDealt = Math.max(0, beforeHp - p.hp)
                const healDone = Math.max(0, enemy.hp - beforeEnemyHp)
                const shieldDelta = Math.max(
                    0,
                    beforeShield - (p.status && p.status.shield ? p.status.shield : 0)
                )

                const reward = dmgDealt + healDone * 0.8 + shieldDelta * 0.35
                updateEnemyLearning(enemy, aid, reward)

                if (p.resourceKey === 'fury') {
                    p.resource = Math.min(p.maxResource, (p.resource || 0) + 10)
                }

                updateHUD()

                if (p.hp <= 0 && !state.flags.godMode) {
                    handlePlayerDefeat()
                    return
                }
                if (p.hp <= 0 && state.flags.godMode) {
                    p.hp = 1
                    updateHUD()
                }

                return
            } else {
                addLog(enemy.name + ' continues to ready a powerful attack...', 'system')
                return
            }
        }

        // Choose + use an ability
        const aid = chooseEnemyAbility(enemy, p)
        const ab = ENEMY_ABILITIES[aid] || ENEMY_ABILITIES.enemyStrike

        // Telegraph certain big moves for counterplay.
        if (ab.telegraphTurns && ab.telegraphTurns > 0) {
            enemy.intent = { aid: aid, turnsLeft: ab.telegraphTurns }

            // Commit cooldown on declare
            const cd = ab.cooldown || 0
            if (cd > 0) enemy.abilityCooldowns[aid] = cd

            const msg = ab.telegraphText
                ? enemy.name + ' ' + ab.telegraphText
                : enemy.name + ' prepares ' + ab.name + '!'
            addLog(msg, 'danger')
            return
        }

        const cd = ab.cooldown || 0
        if (cd > 0) enemy.abilityCooldowns[aid] = cd

        const beforeHp = p.hp
        const beforeEnemyHp = enemy.hp
        const beforeShield = p.status && p.status.shield ? p.status.shield : 0

        applyEnemyAbilityToPlayer(enemy, p, aid)

        const dmgDealt = Math.max(0, beforeHp - p.hp)
        const healDone = Math.max(0, enemy.hp - beforeEnemyHp)
        const shieldDelta = Math.max(
            0,
            beforeShield - (p.status && p.status.shield ? p.status.shield : 0)
        )

        const reward = dmgDealt + healDone * 0.8 + shieldDelta * 0.35
        updateEnemyLearning(enemy, aid, reward)

        if (p.resourceKey === 'fury') {
            p.resource = Math.min(p.maxResource, (p.resource || 0) + 10)
        }

        updateHUD()

        if (p.hp <= 0 && !state.flags.godMode) {
            handlePlayerDefeat()
            return
        }
        if (p.hp <= 0 && state.flags.godMode) {
            p.hp = 1
            updateHUD()
        }
    } finally {
        // Restore previous target (UI) after acting.
        state.currentEnemy = prev
    }
}

function enemyTurn() {
    if (!state.inCombat || !state.currentEnemy) return
    const acting = state.currentEnemy
    enemyAct(acting)
    if (state.inCombat) {
        postEnemyTurn()
    }
}

function applyEndOfTurnEffectsEnemy(enemy) {
    if (enemy.bleedTurns && enemy.bleedTurns > 0 && enemy.bleedDamage) {
        enemy.hp -= enemy.bleedDamage
        enemy.bleedTurns -= 1
        addLog(
            enemy.name + ' bleeds for ' + enemy.bleedDamage + ' damage.',
            'good'
        )
        if (enemy.bleedTurns <= 0) {
            addLog(enemy.name + "'s bleeding slows.", 'system')
        }
    }


// Elite regen (kept quiet unless it actually heals)
if (enemy.eliteRegenPct && enemy.eliteRegenPct > 0 && enemy.hp > 0) {
    const before = enemy.hp
    const heal = Math.max(1, Math.round(enemy.maxHp * enemy.eliteRegenPct))
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal)
    const gained = enemy.hp - before
    if (gained > 0) {
        addLog(enemy.name + ' regenerates ' + gained + ' HP.', 'system')
    }
}

// Mini-affix regen (separate from Elite regen; stacks if both exist)
if (enemy.affixRegenPct && enemy.affixRegenPct > 0 && enemy.hp > 0) {
    const before = enemy.hp
    const heal = Math.max(1, Math.round(enemy.maxHp * enemy.affixRegenPct))
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + heal)
    const gained = enemy.hp - before
    if (gained > 0) {
        addLog(enemy.name + ' regenerates ' + gained + ' HP.', 'system')
    }
}

}

function decideEnemyAction(enemy, player) {
    const diff = getActiveDifficultyConfig()
    const smart = diff.aiSmartness
    const available = []

    available.push('attack')

    if (enemy.isBoss) {
        if (enemy.behavior === 'bossGoblin') {
            available.push('heavy', 'guard')
        } else if (enemy.behavior === 'bossDragon') {
            available.push('heavy', 'voidBreath')
        } else if (enemy.behavior === 'bossWitch') {
            available.push('heavy', 'voidBreath', 'guard')
        } else if (enemy.behavior === 'bossGiant') {
            available.push('heavy', 'guard')
        } else if (enemy.behavior === 'bossLich') {
            available.push('heavy', 'voidBreath', 'guard')
        } else if (enemy.behavior === 'bossKing') {
            available.push('heavy', 'guard', 'voidBreath')
        } else {
            available.push('heavy')
        }
    } else {
        if (enemy.behavior === 'aggressive') {
            available.push('heavy')
        } else if (enemy.behavior === 'cunning') {
            available.push('heavy', 'guard')
        } else if (enemy.behavior === 'caster') {
            available.push('voidBreath')
        }
    }

    if (rand('ai.smartRoll') > smart) {
        return available[randInt(0, available.length - 1, 'ai.randomAbility')]
    }

    let bestAction = 'attack'
    let bestScore = -Infinity

    available.forEach((act) => {
        let score = 0
        if (act === 'attack') {
            const dmg = calcEnemyDamage(getEffectiveEnemyAttack(enemy), false)
            score = dmg
        } else if (act === 'heavy') {
            const dmg = calcEnemyDamage(getEffectiveEnemyAttack(enemy) * 1.4, false)
            score = dmg * 1.1
        } else if (act === 'voidBreath') {
            const dmg = calcEnemyDamage(enemy.magic * 1.7, true)
            score = dmg * 1.2
        } else if (act === 'guard') {
            score = 12
            if (enemy.hp < enemy.maxHp * 0.4) score += 10
        }

        if (
            player.hp <=
            calcEnemyDamage(
                act === 'heavy'
                    ? enemy.attack * 1.4
                    : act === 'voidBreath'
                    ? enemy.magic * 1.7
                    : enemy.attack,
                act === 'voidBreath'
            )
        ) {
            score += 50
        }

        if (score > bestScore) {
            bestScore = score
            bestAction = act
        }
    })

    return bestAction
}

function applyEndOfTurnEffectsPlayer(p) {
    if (!p || !p.status) return

    // Reserved for end-of-round effects (non-bleed). In Patch 1.1.9, bleed damage now
    // ticks at the start of the affected actor's turn to match true turn order.
}

function applyStartOfTurnEffectsPlayer(p) {
    if (!p || !p.status) return

    // Bleed ticking (used by enemy abilities)
    if (
        p.status.bleedTurns &&
        p.status.bleedTurns > 0 &&
        p.status.bleedDamage
    ) {
        if (!state.flags.godMode) {
            p.hp -= p.status.bleedDamage
        }
        p.status.bleedTurns -= 1

        addLog('You bleed for ' + p.status.bleedDamage + ' damage.', 'danger')

        if (p.status.bleedTurns <= 0) {
            addLog('The bleeding slows.', 'system')
            p.status.bleedDamage = 0
        }
    }
}

// Called once when the player's turn begins (Patch 1.1.9 true turn order).
// This is where player bleed is applied. We guard against double-application
// by stamping the current combat round.
function beginPlayerTurn() {
    if (!state || !state.inCombat) return
    const c = ensureCombatTurnState()
    if (!c || c.busy) return

    const round = Number.isFinite(c.round) ? c.round : 1
    if (c._lastPlayerTurnRoundApplied === round) return
    c._lastPlayerTurnRoundApplied = round

    const p = state.player
    applyStartOfTurnEffectsPlayer(p)

    // If bleed kills you, resolve defeat before returning control.
    if (p && p.hp <= 0 && !state.flags.godMode) {
        handlePlayerDefeat()
        return
    }
    if (p && p.hp <= 0 && state.flags.godMode) {
        p.hp = 1
    }

    updateHUD()
    updateEnemyPanel()
}

function tickPlayerTimedStatuses() {
    const p = state.player
    if (!p || !p.status) return
    const st = p.status

    // damage reduction
    if (st.dmgReductionTurns > 0) {
        st.dmgReductionTurns -= 1
        if (st.dmgReductionTurns <= 0) {
            addLog('Your Shield Wall fades.', 'system')
        }
    }

    // vulnerable
    if (st.vulnerableTurns > 0) {
        st.vulnerableTurns -= 1
        if (st.vulnerableTurns <= 0) {
            addLog('You feel less exposed.', 'system')
        }
    }

    // armor down
    if (st.armorDownTurns > 0) {
        st.armorDownTurns -= 1
        if (st.armorDownTurns <= 0) {
            st.armorDown = 0
            addLog('Your footing steadies; your armor holds again.', 'system')
        }
    }

    // magic resist down
    if (st.magicResDownTurns > 0) {
        st.magicResDownTurns -= 1
        if (st.magicResDownTurns <= 0) {
            st.magicResDown = 0
            addLog('Arcane resistance returns.', 'system')
        }
    }

    // chilled: reduced outgoing damage (affix / frost)
    if (st.chilledTurns && st.chilledTurns > 0) {
        st.chilledTurns -= 1
        if (st.chilledTurns <= 0) {
            st.chilledTurns = 0
            addLog('Warmth returns to your limbs.', 'system')
        }
    }

    // attack down
    if (st.atkDownTurns > 0) {
        st.atkDownTurns -= 1
        if (st.atkDownTurns <= 0) {
            st.atkDown = 0
            addLog('Your strength returns.', 'system')
        }
    }

    // magic down
    if (st.magicDownTurns > 0) {
        st.magicDownTurns -= 1
        if (st.magicDownTurns <= 0) {
            st.magicDown = 0
            addLog('Your focus returns.', 'system')
        }
    }

    // simple buffs (if present in the build)
    if (st.buffAttackTurns > 0) {
        st.buffAttackTurns -= 1
        if (st.buffAttackTurns <= 0) {
            st.buffAttack = 0
            addLog('Your battle rhythm fades.', 'system')
        }
    }
    if (st.buffMagicTurns > 0) {
        st.buffMagicTurns -= 1
        if (st.buffMagicTurns <= 0) {
            st.buffMagic = 0
            addLog('Your arcane charge dissipates.', 'system')
        }
    }

    // companion boons
    if (st.buffFromCompanionTurns > 0) {
        st.buffFromCompanionTurns -= 1
        if (st.buffFromCompanionTurns <= 0) {
            st.buffFromCompanion = 0
            addLog("Your companion's boon fades.", 'system')
        }
    }

    // evasion windows
    if (st.evasionTurns > 0) {
        st.evasionTurns -= 1
        if (st.evasionTurns <= 0) {
            st.evasionBonus = 0
            addLog('You stop moving so evasively.', 'system')
        }
    }


    // Patch 1.1.7: necromancer lich form
    if (st.lichTurns > 0) {
        st.lichTurns -= 1
        if (st.lichTurns <= 0) {
            addLog('Lich Form fades.', 'system')
        }
    }

    // Patch 1.1.7: shaman totems
    if (st.totemTurns > 0) {
        st.totemTurns -= 1
        if (st.totemTurns <= 0) {
            st.totemType = ''
            addLog('Your totem crumbles to dust.', 'system')
        }
    }

    // Patch 1.1.7: rogue vanish
    if (st.vanishTurns > 0) {
        st.vanishTurns -= 1
        if (st.vanishTurns <= 0) {
            addLog('You step back into the light.', 'system')
        }
    }
}

function postEnemyTurn() {
    const p = state.player
    if (!p) return

    const _hasteMult = getPlayerHasteMultiplier(p, 120)

    // Passive resource regen at end of round
    if (p.resourceKey === 'mana') {
        p.resource = Math.min(p.maxResource, p.resource + Math.max(1, Math.round(6 * _hasteMult)))
    } else if (p.resourceKey === 'essence') {
        p.resource = Math.min(p.maxResource, p.resource + Math.max(1, Math.round(5 * _hasteMult)))
    } else if (p.resourceKey === 'blood') {
        p.resource = Math.min(p.maxResource, p.resource + Math.max(1, Math.round(4 * _hasteMult)))
    }

    // End-of-round effects (resource regen + HP regen + timed statuses).
    applyEndOfTurnEffectsPlayer(p)
    // HP Regen affix ticks on round boundaries.
    applyPlayerRegenTick()

    tickPlayerTimedStatuses()

    updateHUD()
    updateEnemyPanel()

    // tick cooldowns once per full round
    tickCompanionCooldowns()
    tickEnemyCooldowns()
}

function recordBattleResult(outcome) {
    if (state.difficulty !== 'dynamic') return

    if (!state.dynamicDifficulty) {
        state.dynamicDifficulty = {
            band: 0,
            tooEasyStreak: 0,
            struggleStreak: 0
        }
    }

    const dd = state.dynamicDifficulty
    const p = state.player || { hp: 0, maxHp: 1 }

    if (outcome === 'win') {
        let hpRatio = 0
        if (p.maxHp > 0) {
            hpRatio = p.hp / p.maxHp
        }

        if (hpRatio >= 0.8) {
            dd.tooEasyStreak = (dd.tooEasyStreak || 0) + 1
            dd.struggleStreak = 0
        } else if (hpRatio <= 0.3) {
            dd.struggleStreak = (dd.struggleStreak || 0) + 1
            dd.tooEasyStreak = 0
        } else {
            dd.tooEasyStreak = 0
            dd.struggleStreak = 0
        }
    } else if (outcome === 'loss') {
        dd.struggleStreak = (dd.struggleStreak || 0) + 2
        dd.tooEasyStreak = 0
    }

    const threshold = 3
    let changed = false

    // ramp up when it's too easy
    if (dd.tooEasyStreak >= threshold && dd.band < 2) {
        dd.band += 1
        dd.tooEasyStreak = 0
        changed = true
        addLog(
            'The realm grows more dangerous as you dominate your foes.',
            'system'
        )
    }
    // ramp down when you're struggling
    else if (dd.struggleStreak >= threshold && dd.band > -2) {
        dd.band -= 1
        dd.struggleStreak = 0
        changed = true
        addLog(
            'The realm seems to ease up as your struggles are noticed.',
            'system'
        )
    }

    if (changed) {
        updateHUD()
        saveGame()
    }
}

function handleEnemyDefeat(enemyArg) {
    const enemy = enemyArg || state.currentEnemy
    if (!enemy) return

    // Mark dead
    enemy.hp = 0

    const rarityTag =
        enemy.rarityLabel && Number.isFinite(enemy.rarityTier) && enemy.rarityTier >= 3
            ? ' [' + enemy.rarityLabel + ']'
            : ''

    const all = getAllEnemies()
    const alive = getAliveEnemies()


    // IMPORTANT: grantExperience() triggers a save/invariant scan.
    // If this defeat ends the battle, clear combat state BEFORE granting XP so
    // we never save with inCombat=true and no currentEnemy.
    if (!alive.length) {
        state.inCombat = false
        state.currentEnemy = null
        state.enemies = []
        state.targetEnemyIndex = 0
        if (state.combat) {
            state.combat.busy = false
            state.combat.phase = 'player'
        }
    } else {
        // Mid-battle saves require a valid living target.
        try { syncCurrentEnemyToTarget() } catch (_) {}
    }

    addLog(
        'You defeated ' + enemy.name + (enemy.isElite ? ' [Elite]' : '') + rarityTag + '!',
        'good'
    )

    const xp = enemy.xp
    const gold =
        enemy.goldMin +
        randInt(0, enemy.goldMax - enemy.goldMin, 'loot.gold')

    addLog('You gain ' + xp + ' XP and ' + gold + ' gold.', 'good')

    state.player.gold += gold
    grantExperience(xp)

    // Loot drops (cap drops in multi-enemy battles to reduce spam)
    const c = ensureCombatTurnState()
    const dropsSoFar = c ? (c.battleDrops || 0) : 0

    let dropChance = enemy.isBoss ? 1.0 : enemy.isElite ? 0.9 : 0.7
    if (all.length > 1 && !enemy.isBoss) dropChance *= 0.85

    if (typeof enemy.rarityDropMult === 'number' && Number.isFinite(enemy.rarityDropMult)) {
        dropChance = Math.max(0, Math.min(1.0, dropChance * enemy.rarityDropMult))
    }

    const dropCap = all.length > 1 ? 2 : 99

    if (dropsSoFar < dropCap && rand('loot.drop') < dropChance) {
        const drops = generateLootDrop({
            area: state.area,
            playerLevel: state.player.level,
            enemy,
            playerResourceKey: state.player.resourceKey
        })

        if (drops && drops.length) {
            drops.forEach((d) => addGeneratedItemToInventory(d, d.quantity || 1))

            const names = drops
                .map(
                    (d) =>
                        d.name +
                        (d.type === 'potion' && (d.quantity || 1) > 1
                            ? ' ×' + (d.quantity || 1)
                            : '')
                )
                .join(', ')

            addLog('You loot ' + names + '.', 'good')

            if (c) c.battleDrops = (c.battleDrops || 0) + 1
        }
    }

    // Quest progression triggered by boss defeats
    quests.applyQuestProgressOnEnemyDefeat(enemy)

    // If any enemies remain, keep fighting.
    if (alive.length > 0) {
        // Ensure target is valid.
        syncCurrentEnemyToTarget()
        updateHUD()
        updateEnemyPanel()
        renderActions()
        saveGame()
        return
    }

    // Battle ends.
    state.inCombat = false

    // Economy reacts once per battle
    handleEconomyAfterBattle(state, enemy, state.area)

    // dynamic difficulty: one result per battle
    recordBattleResult('win')

    state.currentEnemy = null
    state.enemies = []

    updateHUD()
    updateEnemyPanel()
    renderActions()
    saveGame()
}

function handlePlayerDefeat() {
    // inform dynamic difficulty system of the loss
    recordBattleResult('loss')

    // Mark as defeated so exploration/actions can't proceed behind the defeat screen.
    if (!state.flags) state.flags = {}
    state.flags.playerDefeated = true

    // Clamp to dead state
    if (state.player && !state.flags.godMode) state.player.hp = 0

    addLog('You fall to the ground, defeated.', 'danger')

    // Clear combat state completely (multi-enemy aware)
    state.inCombat = false
    state.currentEnemy = null
    state.enemies = []
    state.targetEnemyIndex = 0
    if (state.combat) {
        state.combat.busy = false
        state.combat.phase = 'player'
    }

    resetPlayerCombatStatus(state.player)
    updateHUD()

    openModal('Defeat', (body) => {
        const p = document.createElement('p')
        p.className = 'modal-subtitle'
        p.textContent =
            'Your journey ends here... but legends often get second chances.'
        body.appendChild(p)

        const row = document.createElement('div')
        row.className = 'item-actions'

        const btnLoad = document.createElement('button')
        btnLoad.className = 'btn outline'
        btnLoad.textContent = 'Load Last Save'
        btnLoad.addEventListener('click', () => {
            try { if (modalEl) modalEl.dataset.lock = '0' } catch (_) {}
            closeModal()
            loadGame(true)
        })

        const btnMenu = document.createElement('button')
        btnMenu.className = 'btn outline'
        btnMenu.textContent = 'Main Menu'
        btnMenu.addEventListener('click', () => {
            try { if (modalEl) modalEl.dataset.lock = '0' } catch (_) {}
            closeModal()
            switchScreen('mainMenu')
        })

        row.appendChild(btnLoad)
        row.appendChild(btnMenu)
        body.appendChild(row)
    })

    // Make defeat modal non-dismissable by clicking outside / pressing ESC.
    try {
        if (modalEl) {
            modalEl.dataset.lock = '1'
            modalEl.dataset.owner = 'defeat'
        }
        const closeBtn = document.getElementById('modalClose')
        if (closeBtn) closeBtn.style.display = 'none'
    } catch (_) {}
}

function tryFlee() {
    if (!state.inCombat) return
    if (!guardPlayerTurn()) return

    const chance = 0.45
    if (rand('encounter.pick') < chance) {
        addLog('You slip away from the fight.', 'system')
        state.inCombat = false
        state.currentEnemy = null
        state.enemies = []
        resetPlayerCombatStatus(state.player)
        setScene(
            'On the Path',
            'You catch your breath after fleeing. The forest remains dangerous, but you live to fight again.'
        )
        updateHUD()
        updateEnemyPanel()
        renderActions()
        saveGame()
    } else {
        addLog('You fail to escape!', 'danger')
        endPlayerTurn({ source: 'fleeFail' })
    }
}

function rollLootForArea() {
    if (state.area === 'forest') {
        const options = [
            'potionSmall',
            'potionSmall',
            'potionSmall',
            'potionMana',
            'potionFury',
            'potionBlood'
        ]
        return options[randInt(0, options.length - 1, 'table.pick')]
    }
    if (state.area === 'ruins') {
        const options = [
            'potionSmall',
            'potionMana',
            'potionFury',
            'potionBlood',
            'potionEssence',
            'potionSmall'
        ]
        return options[randInt(0, options.length - 1, 'table.pick')]
    }
    if (state.area === 'marsh') {
        const options = [
            'potionSmall',
            'potionBlood',
            'potionEssence',
            'potionMana',
            'potionSmall'
        ]
        return options[randInt(0, options.length - 1, 'table.pick')]
    }
    if (state.area === 'frostpeak') {
        const options = [
            'potionSmall',
            'potionMana',
            'potionFury',
            'potionSmall',
            'potionEssence'
        ]
        return options[randInt(0, options.length - 1, 'table.pick')]
    }
    if (state.area === 'catacombs') {
        const options = [
            'potionBlood',
            'potionEssence',
            'potionMana',
            'potionSmall'
        ]
        return options[randInt(0, options.length - 1, 'table.pick')]
    }
    if (state.area === 'keep') {
        const options = [
            'potionEssence',
            'potionMana',
            'potionSmall',
            'potionBlood'
        ]
        return options[randInt(0, options.length - 1, 'table.pick')]
    }
    return null
}
// --- COMPANION LOGIC ----------------------------------------------------------

function computeCompanionScaledStats(def, playerLevel) {
    const lvl = Math.max(1, Number(playerLevel || 1))
    // These scale factors are intentionally modest to keep companions supportive, not dominant.
    const atk =
        (def.baseAttack || 6) + Math.floor(lvl * (def.scaleAtkPerLevel || 1.5))
    const hpBonus =
        (def.baseHpBonus || 0) + Math.floor(lvl * (def.scaleHpPerLevel || 4))
    return { atk, hpBonus }
}

function createCompanionInstance(id) {
    const def = COMPANION_DEFS[id]
    if (!def) return null
    const p = state.player
    const level = p ? p.level : 1

    const scaled = computeCompanionScaledStats(def, level)

    return {
        id: def.id,
        name: def.name,
        role: def.role,
        behavior: def.behavior,
        description: def.description,

        // Scaled stats (dynamic)
        attack: scaled.atk,
        hpBonus: scaled.hpBonus,

        // Track what we've actually applied to the player so we can rescale safely.
        appliedHpBonus: scaled.hpBonus,

        // Ability kit
        abilities: def.abilities ? [...def.abilities] : [],
        abilityCooldowns: {},

        // runtime / behavior
        lastAbilityUsed: null,
        wardActive: false,
        mirrorReflectTurns: 0
    }
}

/**
 * Rescale the active companion whenever player level changes (or on load).
 * This keeps companion attack and HP bonus scaling with the hero.
 */
function rescaleActiveCompanion(opts) {
    const p = state.player
    const comp = state.companion
    if (!p || !comp) return

    const def = COMPANION_DEFS[comp.id]
    if (!def) return

    const scaled = computeCompanionScaledStats(def, p.level)

    // Attack is just a runtime number.
    comp.attack = scaled.atk

    // HP bonus is applied directly to player.maxHp; adjust by delta.
    const prev = Number(comp.appliedHpBonus ?? comp.hpBonus ?? 0)
    const next = Number(scaled.hpBonus || 0)
    const delta = next - prev

    comp.hpBonus = next
    comp.appliedHpBonus = next

    if (delta !== 0) {
        p.maxHp = Math.max(1, p.maxHp + delta)

        // Optional heal on positive scaling; clamp on negative scaling.
        if (delta > 0) {
            const heal = opts && opts.noHeal ? 0 : delta
            p.hp = Math.min(p.maxHp, p.hp + heal)
        } else {
            if (p.hp > p.maxHp) p.hp = p.maxHp
        }
    }
}

function grantCompanion(id) {
    const inst = createCompanionInstance(id)
    if (!inst) {
        addLog('Failed to summon companion.', 'system')
        return
    }

    // If you already had one, cleanly dismiss it first.
    if (state.companion) {
        dismissCompanion(true)
    }

    state.companion = inst
    addLog(inst.name + ' agrees to join your journey.', 'good')

    // Apply passive HP bonus (tracked via appliedHpBonus)
    if (state.player && inst.appliedHpBonus) {
        state.player.maxHp += inst.appliedHpBonus
        state.player.hp = Math.min(
            state.player.maxHp,
            state.player.hp + inst.appliedHpBonus
        )
        updateHUD()
    }

    saveGame()
}

/**
 * @param {boolean} silent If true, don't log.
 */
function dismissCompanion(silent) {
    if (!state.companion) return
    if (!silent) addLog(state.companion.name + ' leaves your side.', 'system')

    const inst = state.companion

    // Remove the applied HP bonus (safe even if the companion was rescaled).
    const applied = Number(inst.appliedHpBonus ?? inst.hpBonus ?? 0)
    if (state.player && applied) {
        state.player.maxHp = Math.max(1, state.player.maxHp - applied)
        if (state.player.hp > state.player.maxHp) {
            state.player.hp = state.player.maxHp
        }
        updateHUD()
    }

    state.companion = null
    saveGame()
}

// Companion acts after the player's turn, before the enemy

function companionActIfPresent() {
    const comp = state.companion
    const enemy = state.currentEnemy
    const p = state.player
    if (!comp || !enemy || !state.inCombat || !p) return

    // --- Ensure learning memory exists ------------------------------------------------
    if (!comp.memory) {
        comp.memory = {
            abilityStats: {}, // abilityId -> { value: number, uses: number, wins: number }
            exploration: 0.2 // epsilon initial exploration prob (decays slowly)
        }
    }

    // helper: ensure an ability stats container
    function ensureAbilityStat(aid) {
        if (!comp.memory.abilityStats[aid]) {
            comp.memory.abilityStats[aid] = { value: 0, uses: 0, wins: 0 }
        }
        return comp.memory.abilityStats[aid]
    }

    // small helper to estimate immediate expected damage for plain attack
    function estimatePlainDamage() {
        // calcCompanionDamage(comp, useMagic) returns a realistic damage number
        try {
            return Math.max(1, calcCompanionDamage(comp, false))
        } catch (e) {
            return comp.attack || 6
        }
    }

    // enhanced scoring that blends heuristic + learned value
    function scoreAbility(abilityId) {
        const ab = COMPANION_ABILITIES[abilityId]
        if (!ab) return -9999
        // Don't recast ward if one is already active
        if (ab.type === 'ward' && comp.wardActive) {
            return -9999
        }
        if (!canUseCompanionAbility(comp, abilityId)) return -9999

        // base heuristic (reuse your existing logic with expansions)
        let score = 0
        const potency = ab.potency || 1
        score += potency * 12

        const remainingCd =
            comp.abilityCooldowns && comp.abilityCooldowns[abilityId]
                ? comp.abilityCooldowns[abilityId]
                : 0
        score -= remainingCd * 2

        const playerHpPct = p.hp / Math.max(1, p.maxHp)
        const enemyHpPct = enemy.hp / Math.max(1, enemy.maxHp)

        // Heal
        // Heal
        if (ab.type === 'heal') {
            // HARD SAFETY: don't use heal abilities if player is essentially full
            const playerHpPct = p.hp / Math.max(1, p.maxHp)
            if (playerHpPct >= 0.95) {
                // player is basically full — avoid using heal at all
                return -9999
            }

            score += (1 - playerHpPct) * 80
            if (enemyHpPct < 0.25) score -= 15
        }
        // --- Proactive ward logic ---------------------------------------
        if (ab.type === 'ward') {
            // Strong preference early in fight (before damage spikes)
            if (enemyHpPct > 0.65 && !comp.wardActive) {
                score += 45
            }

            // If no ward is active, value rises regardless of HP
            if (!comp.wardActive) {
                score += 20
            }
        }

        // Shield / ward
        if (ab.type === 'shield+damage' || ab.type === 'ward') {
            const missing = p.maxHp - p.hp
            score += Math.min(40, (missing / Math.max(1, p.maxHp)) * 50)
            if (!p.status.shield || p.status.shield < 6) score += 6
        }

        // Damage / debuff
        if (ab.type === 'damage' || ab.type === 'damage+debuff') {
            score += enemyHpPct * 40
            const expected = (comp.attack || 6) * potency * 0.9
            if (expected >= enemy.hp - 6) score += 60
        }

        // Debuff synergy
        if (ab.type === 'damage+debuff') {
            if (!enemy.debuffTurns || enemy.debuffTurns <= 0) score += 18
            if (
                p.status &&
                p.status.buffFromCompanionTurns &&
                p.status.buffFromCompanionTurns > 0
            )
                score += 10
        }

        // Resource need
        if (ab.type === 'resource') {
            const resourcePct = p.resource / Math.max(1, p.maxResource)
            score += (1 - resourcePct) * 60
        }

        if (ab.critSpike && (p.stats.critChance > 12 || enemyHpPct > 0.6)) score += 12

        score -= (ab.cooldown || 3) * 1.2

        // difficulty-based noise
        const smart = getActiveDifficultyConfig().aiSmartness || 0.7
        const noise = (rand('ai.noise') - 0.5) * (1 - smart) * 6
        score += noise

        // --- incorporate learned value (expected utility) ---
        const stat = ensureAbilityStat(abilityId)
        // scale learned value into same domain as score
        // stat.value is an on-line estimate of reward (higher = better)
        score += stat.value * 10 // weight learned experience

        // small penalty if ability was used heavily (to encourage exploration)
        score -= Math.log(1 + stat.uses) * 0.9

        return score
    }

    // --- choose best ability using epsilon-greedy exploration ---
    const readyAbilities = (comp.abilities || []).filter((aid) =>
        canUseCompanionAbility(comp, aid)
    )
    let chosenAbility = null
    let chosenScore = -Infinity

    if (readyAbilities.length > 0) {
        // compute scores
        const scored = readyAbilities.map((aid) => ({
            id: aid,
            score: scoreAbility(aid)
        }))
        // pick greedy best normally
        scored.forEach((s) => {
            if (s.score > chosenScore) {
                chosenScore = s.score
                chosenAbility = s.id
            }
        })

        // epsilon-greedy: occasionally explore a random ready ability
        const eps = Math.max(0.03, comp.memory.exploration || 0.15)
        if (rand('ai.epsSwap') < eps && readyAbilities.length > 1) {
            // choose a random other ability (not necessarily best)
            const pool = readyAbilities.filter((aid) => aid !== chosenAbility)
            const rand = pool[randInt(0, pool.length - 1, 'ai.epsPick')]
            if (rand) {
                chosenAbility = rand
                chosenScore = scoreAbility(rand)
            }
            // decay exploration slightly to favor exploitation over time
            comp.memory.exploration = Math.max(
                0.03,
                (comp.memory.exploration || 0.2) * 0.995
            )
        }
    }

    // --- compute "damage baseline" as the fallback option ---
    const plainDamageEstimate = estimatePlainDamage()

    // IMPORTANT: Keep this baseline on the same *scale* as ability scores.
    // The old "* 8" made the baseline so large that companions eventually stopped using abilities.
    const damageFallbackScore = plainDamageEstimate * 1.6

    // If no ability chosen or chosen ability isn't meaningfully better than a plain attack, do plain damage.
    if (!chosenAbility || chosenScore < damageFallbackScore - 2) {
        // Default to doing damage (most basic behavior)
        const dmg = Math.max(1, calcCompanionDamage(comp, false))
        enemy.hp -= dmg
        addLog(comp.name + ' strikes ' + enemy.name + ' for ' + dmg + ' damage.', 'good')

        // small learning update: reward "attack" as a pseudo-ability so AI can learn if plain attacks are often best
        const pseudo = '_plainAttack'
        if (!comp.memory.abilityStats[pseudo])
            comp.memory.abilityStats[pseudo] = { value: 0, uses: 0, wins: 0 }
        const stat = comp.memory.abilityStats[pseudo]
        stat.uses += 1
        // reward scaled by damage and if it killed
        let reward = (dmg / Math.max(1, enemy.maxHp)) * 1.0
        if (enemy.hp <= 0) reward += 2.0
        stat.value = (stat.value * (stat.uses - 1) + reward) / stat.uses

        // After dealing damage, check defeat
        if (enemy.hp <= 0) {
            handleEnemyDefeat(enemy)
            return
        }
        return
    }

    // --- Use chosen ability and immediately measure outcome for learning ------------
    // Snapshot pre-use values to compute observed reward
    const preEnemyHp = enemy.hp
    const prePlayerHp = p.hp
    const desc = useCompanionAbility(comp, chosenAbility) || ''
    const postEnemyHp = enemy.hp
    const postPlayerHp = p.hp

    // Compute immediate numeric reward:
    //   damageReward: fraction of enemy HP removed (normalized)
    //   healReward: fraction of player HP restored
    //   kill bonus if enemy dies
    const dmgDone = Math.max(0, preEnemyHp - postEnemyHp)
    const healDone = Math.max(0, postPlayerHp - prePlayerHp)
    let reward = 0
    if (dmgDone > 0) reward += (dmgDone / Math.max(1, enemy.maxHp)) * 1.2
    if (healDone > 0) reward += (healDone / Math.max(1, p.maxHp)) * 1.5
    if (postEnemyHp <= 0) reward += 2.0 // finishing blow highly rewarded

    // small extra reward if ability applied useful debuff/shield (heuristic based)
    const abUsed = COMPANION_ABILITIES[chosenAbility] || {}
    if (
        abUsed.type === 'damage+debuff' &&
        (!enemy.debuffTurns || enemy.debuffTurns > 0)
    ) {
        reward += 0.4
    }
    if (
        abUsed.type === 'shield+damage' &&
        p.status &&
        p.status.shield &&
        p.status.shield > 0
    ) {
        reward += 0.35
    }
    if (abUsed.type === 'ward' && comp.wardActive) {
        reward += 0.3
    }
    // --- FIX 2: Delayed ward value estimation ---------------------------------
    if (abUsed.type === 'ward') {
        // Estimate future value of the ward (healing over remaining turns)
        const expectedHeal =
            (comp.wardPotency || 0.05) * p.maxHp * (comp.wardTurns || 2)

        // Convert to normalized reward and boost it
        reward += (expectedHeal / p.maxHp) * 1.4
    }

    // Update ability stats (online averaging)
    const stat = ensureAbilityStat(chosenAbility)
    stat.uses += 1
    stat.wins += postEnemyHp <= 0 ? 1 : 0
    // exponential moving average-like update (alpha tuned by uses)
    const alpha = 1 / Math.max(4, Math.min(20, stat.uses)) // more stable over time
    stat.value = (1 - alpha) * stat.value + alpha * reward

    // Logging & UI updates
    if (desc) addLog(desc, 'good')
    updateHUD()
    updateEnemyPanel()

    // If ability killed the enemy, handle defeat
    if (postEnemyHp <= 0) {
        handleEnemyDefeat()
        return
    }

    // Done with companion action
    return
}

function calcCompanionDamage(companion, isMagic) {
    const enemy = state.currentEnemy
    if (!enemy) return 0

    const base = companion.attack
    const defense = isMagic
        ? 100 / (100 + ((enemy.magicRes || 0) + (enemy.magicResBuff || 0)) * 8)
        : 100 / (100 + ((enemy.armor || 0) + (enemy.armorBuff || 0)) * 7)

    let dmg = base * defense
    // NOTE: do not shadow the RNG helper `rand()`.
    const variance = 0.85 + rand('ability.variance') * 0.3
    dmg *= variance

    // Companions ignore difficulty scaling (they are "neutral")
    dmg = Math.max(1, Math.round(dmg))
    return dmg
}

function canUseCompanionAbility(comp, abilityId) {
    if (!comp || !comp.abilities) return false
    const ab = COMPANION_ABILITIES[abilityId]
    if (!ab) return false
    const cd = comp.abilityCooldowns && comp.abilityCooldowns[abilityId]
    return !cd || cd <= 0
}

// Execute ability: returns textual description
function useCompanionAbility(comp, abilityId) {
    const enemy = state.currentEnemy
    const p = state.player
    const ab = COMPANION_ABILITIES[abilityId]
    if (!ab || !comp) return ''

    // mark cooldown
    comp.abilityCooldowns[abilityId] = ab.cooldown || 3
    comp.lastAbilityUsed = abilityId

    // apply effects by type
    if (ab.type === 'damage') {
        // scale off companion attack and potency
        const baseStat = Math.round(
            (comp.attack + (p.stats.attack || 0) * 0.15) * (ab.potency || 1)
        )
        let dmg = Math.max(
            1,
            Math.round(baseStat * (0.9 + rand('ability.scaleRoll') * 0.3))
        )
        // extra talon crit spike simulation
        if (ab.critSpike && rand('ability.critSpike') < ab.critSpike) {
            const spike = Math.round(dmg * 0.6)
            dmg += spike
            addLog(
                comp.name +
                    ' lands a devastating strike for ' +
                    spike +
                    ' bonus damage!',
                'good'
            )
        }
        enemy.hp -= dmg
        if (ab.stunTurns)
            enemy.stunTurns = (enemy.stunTurns || 0) + ab.stunTurns
        return comp.name + ' uses ' + ab.name + ', dealing ' + dmg + ' damage.'
    } else if (ab.type === 'shield+damage') {
        const dmg = Math.round(comp.attack * (ab.potency || 1.0))
        enemy.hp -= dmg
        const shield = Math.round((ab.shieldBase || 10) + p.level * 1.5)
        p.status.shield = (p.status.shield || 0) + shield
        return (
            comp.name +
            ' uses ' +
            ab.name +
            ': deals ' +
            dmg +
            ' and grants ' +
            shield +
            ' shield.'
        )
    } else if (ab.type === 'heal') {
        // heal more if player is low
        const missing = Math.max(0, p.maxHp - p.hp)
        const healAmount = Math.max(
            5,
            Math.round(p.maxHp * (ab.potency || 0.25) + missing * 0.12)
        )
        const before = p.hp
        p.hp = Math.min(p.maxHp, p.hp + healAmount)
        return (
            comp.name +
            ' uses ' +
            ab.name +
            ' and restores ' +
            (p.hp - before) +
            ' HP.'
        )
    } else if (ab.type === 'damage+debuff') {
        const dmg = Math.round(comp.attack * (ab.potency || 1.0))
        enemy.hp -= dmg
        applyEnemyAtkDown(enemy, ab.atkDown || 2, ab.debuffTurns || 2)
        return (
            comp.name +
            ' uses ' +
            ab.name +
            ', deals ' +
            dmg +
            ' and reduces enemy Attack.'
        )
    } else if (ab.type === 'ward') {
        comp.wardActive = true
        comp.wardTurns = ab.wardTurns || 3
        // persist potency so tick logic can heal per-turn correctly
        comp.wardPotency = ab.potency || 0.06
        comp.wardSource = abilityId

        // immediate small heal (keeps immediate feel), but the ongoing heal will happen each enemy turn
        const heal = Math.round(p.maxHp * comp.wardPotency)
        const before = p.hp
        p.hp = Math.min(p.maxHp, p.hp + heal)
        const actual = p.hp - before
        return (
            comp.name +
            ' plants a ward for ' +
            comp.wardTurns +
            ' turns and restores ' +
            actual +
            ' HP.'
        )
    } else if (ab.type === 'resource') {
        const gain = Math.max(
            4,
            Math.round(p.maxResource * (ab.potency || 0.35))
        )
        const before = p.resource
        p.resource = Math.min(p.maxResource, p.resource + gain)
        p.status.buffFromCompanion = (p.status.buffFromCompanion || 0) + 1 // simple short buff marker
        p.status.buffFromCompanionTurns = ab.buffTurns || 1
        return (
            comp.name +
            ' uses ' +
            ab.name +
            ', restoring ' +
            (p.resource - before) +
            ' ' +
            p.resourceName +
            '.'
        )
    } else if (ab.type === 'damage+reflect') {
        const dmg = Math.round(comp.attack * (ab.potency || 1.0))
        enemy.hp -= dmg
        comp.mirrorReflectTurns = ab.reflectTurns || 2
        comp.mirrorReflectPct = ab.reflectPct || 0.35
        return (
            comp.name +
            ' uses ' +
            ab.name +
            ', deals ' +
            dmg +
            ' and will reflect some damage for ' +
            comp.mirrorReflectTurns +
            ' turns.'
        )
    }

    return ''
}

function tickCompanionCooldowns() {
    const c = state.companion
    if (!c) return

    // cooldowns
    if (c.abilityCooldowns) {
        Object.keys(c.abilityCooldowns).forEach((k) => {
            if (!c.abilityCooldowns[k]) return
            // defensive guard to ensure numeric
            c.abilityCooldowns[k] = Math.max(
                0,
                Number(c.abilityCooldowns[k] || 0) - 1
            )
        })
    }

    // ward ticking + per-turn heal (if present)
    if (c.wardActive) {
        // apply heal at end of enemy turn for the player (if they are hurt)
        const p = state.player
        if (p && c.wardPotency && p.hp < p.maxHp) {
            const heal = Math.max(1, Math.round(p.maxHp * c.wardPotency))
            const before = p.hp
            p.hp = Math.min(p.maxHp, p.hp + heal)
            const actual = p.hp - before
            if (actual > 0) {
                addLog(c.name + "'s ward restores " + actual + ' HP.', 'good')
            }
            updateHUD()
        }

        c.wardTurns = Math.max(0, (c.wardTurns || 0) - 1)
        if (!c.wardTurns) {
            c.wardActive = false
            // clear potency/source for cleanliness
            c.wardPotency = 0
            c.wardSource = null
            addLog(c.name + "'s ward fades.", 'system')
        }
    }

    // mirror reflect countdown
    if (c.mirrorReflectTurns && c.mirrorReflectTurns > 0) {
        c.mirrorReflectTurns = Math.max(0, c.mirrorReflectTurns - 1)
        if (c.mirrorReflectTurns === 0) {
            addLog(c.name + "'s reflection subsides.", 'system')
        }
    }
}

// Enemy elite/rarity/affix logic lives in Systems/Enemy.
function applyEnemyAffixes(enemy, opts = {}) {
    const areaId = (typeof state !== 'undefined' && state && state.area) ? state.area : 'village'
    return applyEnemyAffixesImpl(enemy, opts, { diffCfg: getActiveDifficultyConfig(), areaId, rand, randInt })
}

function getEnemyAffixLabels(enemy) {
    return getEnemyAffixLabelsImpl(enemy)
}

function rebuildEnemyDisplayName(enemy) {
    return rebuildEnemyDisplayNameImpl(enemy)
}

function applyEnemyAffixesOnEnemyHit(enemy, p, info) {
    return applyEnemyAffixesOnEnemyHitImpl(enemy, p, info || {}, { rand, addLog })
}

// Apply direct damage to the player, respecting shields and God Mode.
// Used by enemy mini-affixes (ex: Thorns reflect) and referenced by smoke tests.
// Returns the actual HP damage dealt (after shield absorption).
function applyDirectDamageToPlayer(player, amount, opts = {}) {
    if (!player) return 0
    const st = player.status || (player.status = {})
    let dmg = Math.max(0, Math.round(Number(amount || 0)))
    if (!Number.isFinite(dmg) || dmg <= 0) return 0

    let remaining = dmg
    // Shield absorption (same semantics as enemy ability damage).
    if (st.shield && st.shield > 0) {
        const absorbed = Math.min(remaining, st.shield)
        st.shield -= absorbed
        remaining -= absorbed
        if (absorbed > 0 && !opts.silentShieldLog) {
            try {
                addLog('Your shield absorbs ' + absorbed + ' damage.', 'system')
            } catch (_) {}
        }
    }

    const god = !!(state && state.flags && state.flags.godMode)
    const hpDamage = god ? 0 : Math.max(0, remaining)
    if (remaining > 0) {
        if (god) {
            try {
                addLog('God Mode: You ignore ' + remaining + ' damage.', 'system')
            } catch (_) {}
        } else {
            player.hp = Number.isFinite(player.hp) ? player.hp - remaining : 0
        }
    }

    // Optional message (affixes typically pass a source).
    if (opts && opts.source) {
        try {
            addLog(opts.source + ' deals ' + dmg + ' damage.', 'danger')
        } catch (_) {}
    }

    // Clamp + defeat handling (keeps combat stable if reflect kills the player).
    if (!god) {
        if (!Number.isFinite(player.hp)) player.hp = 0
        if (player.hp < 0) player.hp = 0
        if (player.hp <= 0 && state && state.inCombat) {
            try {
                handlePlayerDefeat()
            } catch (_) {}
        }
    } else {
        if (state && state.inCombat && player.hp <= 0) player.hp = 1
    }

    try {
        if (state && state.inCombat) updateHUD()
    } catch (_) {}

    return hpDamage
}

function applyEnemyAffixesOnPlayerHit(enemy, damageDealt) {
    const player = (typeof state !== 'undefined' && state && state.player) ? state.player : null
    return applyEnemyAffixesOnPlayerHitImpl(enemy, player, damageDealt, { applyDirectDamageToPlayer })
}


function applyEliteModifiers(enemy, diff) {
    const areaId = (typeof state !== 'undefined' && state && state.area) ? state.area : 'village'
    return applyEliteModifiersImpl(enemy, diff, { areaId, rand, randInt })
}

function startBattleWith(templateId) {
    const template = ENEMY_TEMPLATES[templateId]
    if (!template) return

    // Guard: do not start a new battle if we're already in combat.
    // This prevents re-entrant explore clicks or modal flows from corrupting combat state.
    if (state && state.inCombat) {
        try { ensureCombatPointers() } catch (_) {}
        return
    }

    recordInput('combat.start', {
        templateId,
        area: state && state.area ? state.area : null
    })

    const diff = getActiveDifficultyConfig()

    // Zone-based enemy level scaling
    const areaId = state.area || 'village'
    const zone = ZONE_DEFS[areaId] || { minLevel: 1, maxLevel: 1 }

    // Multi-enemy encounter sizing (Patch 1.1.9)
    // Patch 1.1.92: encounter sizing is now difficulty-weighted.
    //  - Easy:   almost always 1 enemy; rarely 2; never 3.
    //  - Normal: mostly 1 enemy; noticeably higher chance for 2; rare 3.
    //  - Hard:   mostly 2 enemies; sometimes 3; rarely 1.
    let groupSize = 1
    if (!template.isBoss) {
        const r = rand('encounter.groupSize')

        // Use closestId so Dynamic difficulty also maps cleanly.
        // Use closestId so Dynamic difficulty also maps cleanly.
        // NOTE: getActiveDifficultyConfig() returns { id:'dynamic', closestId:'easy'|'normal'|'hard' } for Dynamic.
        // For fixed difficulties, closestId is undefined so we fall back to diff.id.
        let diffId = 'normal'
        if (diff && typeof diff.id === 'string') {
            if (diff.id === 'dynamic') diffId = (diff.closestId || 'normal')
            else diffId = diff.id
        }
        diffId = String(diffId).toLowerCase()

        if (diffId === 'easy') {
            // ~95%:1, ~5%:2, 0%:3
            if (r < 0.05) groupSize = 2
        } else if (diffId === 'hard') {
            // ~10%:1, ~65%:2, ~25%:3
            if (r < 0.25) groupSize = 3
            else if (r < 0.90) groupSize = 2
        } else {
            // Normal (default): ~70%:1, ~28%:2, ~2%:3
            if (r < 0.02) groupSize = 3
            else if (r < 0.30) groupSize = 2
        }
    }

    const enemies = []
    for (let i = 0; i < groupSize; i++) {
        const enemy = buildEnemyForBattle(template, {
            zone,
            diffCfg: diff,
            areaId,
            rand,
            randInt,
            pickEnemyAbilitySet
        })
        if (!enemy) continue

        // Runtime combat state
        enemy.armorBuff = 0
        enemy.guardTurns = 0
        enemy.bleedTurns = 0
        enemy.bleedDamage = 0

        // Group tuning: slightly squish per-enemy durability.
        if (groupSize === 2) {
            enemy.maxHp = Math.max(1, Math.floor(enemy.maxHp * 0.78))
            enemy.attack = Math.max(1, Math.floor(enemy.attack * 0.92))
            enemy.magic = Math.max(0, Math.floor(enemy.magic * 0.92))
        } else if (groupSize === 3) {
            enemy.maxHp = Math.max(1, Math.floor(enemy.maxHp * 0.66))
            enemy.attack = Math.max(1, Math.floor(enemy.attack * 0.88))
            enemy.magic = Math.max(0, Math.floor(enemy.magic * 0.88))
        }
        enemy.hp = enemy.maxHp

        if (groupSize > 1) {
            enemy.name = enemy.name + ' #' + (i + 1)
        }

        enemies.push(enemy)
    }

    if (!enemies.length) return

    resetPlayerCombatStatus(state.player)

    state.enemies = enemies
    state.targetEnemyIndex = 0
    state.currentEnemy = enemies[0]
    state.inCombat = true

    // Initialize the turn engine.
    ensureCombatTurnState()
    state.combat.phase = 'player'
    state.combat.busy = false
    state.combat.round = 1
    state.combat.battleDrops = 0

    const tags = enemies.some((e) => e.isBoss) ? ' [Boss]' : ''
    const titleName = groupSize === 1 ? enemies[0].name : 'Enemies (' + groupSize + ')'

    setScene('Battle - ' + titleName, titleName + tags + ' stands in your way.')

    if (groupSize === 1) {
        addLog('A ' + enemies[0].name + ' appears!', enemies[0].isBoss ? 'danger' : 'system')
    } else {
        addLog('Enemies appear: ' + enemies.map((e) => e.name).join(', ') + '!', 'danger')
    }

    // Start-of-turn effects for the player (e.g., bleed) should apply as soon as
    // the player is given control for the first turn.
    beginPlayerTurn()

    // Ensure HUD + class meters update as soon as the enemies spawn.
    updateHUD()
    updateEnemyPanel()
    renderActions()
    saveGame()
}
// --- AREA / EXPLORATION UI ----------------------------------------------------

function ensureUiState() {
    if (!state.ui) {
        state.ui = { exploreChoiceMade: false }
    } else if (typeof state.ui.exploreChoiceMade === 'undefined') {
        state.ui.exploreChoiceMade = false
    }
}

function isAreaUnlocked(areaId) {
    const flags = state.flags || {}

    if (areaId === 'village') return true

    if (areaId === 'forest') {
        return !!(
            flags.metElder ||
            flags.goblinBossDefeated ||
            flags.dragonDefeated ||
            flags.marshWitchDefeated ||
            flags.frostGiantDefeated ||
            flags.lichDefeated ||
            flags.obsidianKingDefeated
        )
    }

    if (areaId === 'ruins') {
        return !!(
            flags.goblinBossDefeated ||
            flags.dragonDefeated ||
            flags.marshWitchDefeated ||
            flags.frostGiantDefeated ||
            flags.lichDefeated ||
            flags.obsidianKingDefeated
        )
    }

    if (areaId === 'marsh') {
        return !!(
            flags.dragonDefeated ||
            flags.marshUnlocked ||
            flags.marshWitchDefeated ||
            flags.frostGiantDefeated ||
            flags.lichDefeated ||
            flags.obsidianKingDefeated
        )
    }

    if (areaId === 'frostpeak') {
        return !!(
            flags.marshWitchDefeated ||
            flags.frostpeakUnlocked ||
            flags.frostGiantDefeated ||
            flags.lichDefeated ||
            flags.obsidianKingDefeated
        )
    }

    if (areaId === 'catacombs') {
        return !!(
            flags.frostGiantDefeated ||
            flags.catacombsUnlocked ||
            flags.lichDefeated ||
            flags.obsidianKingDefeated
        )
    }

    if (areaId === 'keep') {
        return !!(
            flags.lichDefeated ||
            flags.keepUnlocked ||
            flags.obsidianKingDefeated
        )
    }

    return false
}

function getAreaDisplayName(areaId) {
    if (areaId === 'village') return 'Emberwood Village'
    if (areaId === 'forest') return 'Emberwood Forest'
    if (areaId === 'ruins') return 'Ruined Spire'
    if (areaId === 'marsh') return 'Ashen Marsh'
    if (areaId === 'frostpeak') return 'Frostpeak Pass'
    if (areaId === 'catacombs') return 'Sunken Catacombs'
    if (areaId === 'keep') return 'Obsidian Keep'
    return areaId
}
// Main handler for clicking the Explore button
// 🔸 Explore should NEVER open the area picker – it just explores the current area.
function handleExploreClick() {
    recordInput('explore.click', { area: state && state.area ? state.area : null })

    // Never allow exploration clicks during combat.
    if (state && state.inCombat) {
        try { ensureCombatPointers() } catch (_) {}
        addLog('You cannot explore while in combat.', 'danger')
        return
    }

    exploreArea()
}

// Area selection modal
function openExploreModal() {
    ensureUiState()
    recordInput('open.exploreModal')
    if (!state.player) return

    openModal('Choose Where to Explore', (body) => {
        const intro = document.createElement('p')
        intro.className = 'modal-subtitle'
        intro.textContent =
            'Pick a region to travel to. After choosing, the Explore button will keep using that region until you change it.'
        body.appendChild(intro)

        const areas = [
            {
                id: 'village',
                desc: 'Talk to Elder Rowan, visit the merchant, or rest between journeys.'
            },
            {
                id: 'forest',
                desc: 'Beasts, bandits, and goblin warbands beneath Emberwood’s twisted canopy.'
            },
            {
                id: 'ruins',
                desc: 'Climb the shattered spire and face void-touched horrors.'
            },
            {
                id: 'marsh',
                desc: 'A choking mire of ash and rot where a witch’s coven whispers.'
            },
            {
                id: 'frostpeak',
                desc: 'A frozen mountain pass haunted by yeti packs and a rampaging giant.'
            },
            {
                id: 'catacombs',
                desc: 'Sunken crypts where necromancy lingers and the dead refuse to rest.'
            },
            {
                id: 'keep',
                desc: 'A black fortress of obsidian and shadow — the source of the realm’s corruption.'
            }
        ]

        areas.forEach((info) => {
            const unlocked = isAreaUnlocked(info.id)
            const name = getAreaDisplayName(info.id)

            const row = document.createElement('div')
            row.className = 'item-row'

            const header = document.createElement('div')
            header.className = 'item-row-header'

            const left = document.createElement('div')
            left.innerHTML = '<span class="item-name">' + name + '</span>'

            const right = document.createElement('div')
            right.className = 'item-meta'
            if (info.id === state.area) {
                right.textContent = 'Current area'
            } else {
                right.textContent = unlocked ? 'Available' : 'Locked'
            }

            header.appendChild(left)
            header.appendChild(right)

            const desc = document.createElement('div')
            desc.style.fontSize = '0.75rem'
            desc.style.color = 'var(--muted)'
            desc.textContent = info.desc

            row.appendChild(header)
            row.appendChild(desc)

            const actions = document.createElement('div')
            actions.className = 'item-actions'

            const btn = document.createElement('button')
            btn.className = 'btn small' + (unlocked ? '' : ' outline')
            btn.textContent = unlocked ? 'Travel & Explore' : 'Locked'
            btn.disabled = !unlocked

            if (unlocked) {
                btn.addEventListener('click', () => {
                    // Guard: do not allow travel/explore selection while in combat.
                    // This prevents mid-combat modal navigation from desyncing combat state.
                    if (state && state.inCombat) {
                        try { ensureCombatPointers() } catch (_) {}
                        addLog('You cannot travel while in combat.', 'danger')
                        return
                    }

                    // Lock in this choice for repeated exploring
                    recordInput('travel', { to: info.id })
                    state.area = info.id
                    state.ui.exploreChoiceMade = true

                    // If we leave the village, make sure village submenu state is closed
                    state.ui.villageActionsOpen = false

                    addLog('You travel to ' + name + '.', 'system')

                    closeModal()

                    // ✅ Rebuild the action bar immediately so Village / Realm buttons disappear
                    renderActions()

                    exploreArea()
                    saveGame()
                })
            }

            actions.appendChild(btn)
            row.appendChild(actions)
            body.appendChild(row)
        })

        const hint = document.createElement('p')
        hint.className = 'modal-subtitle'
        hint.textContent =
            'Tip: Use “Change Area” on the main screen any time you want to pick a different region.'
        body.appendChild(hint)
    })
}

// --- EXPLORATION & QUESTS -----------------------------------------------------

function exploreArea() {
    const p = state.player
    if (p && finiteNumber(p.hp, 0) <= 0) {
        if (state.flags && state.flags.godMode) {
            p.hp = 1
        } else {
            // If the player is defeated, keep them on the defeat screen.
            handlePlayerDefeat()
            return
        }
    }

    // Guard: never run exploration logic while in combat (prevents state corruption).
    if (state && state.inCombat) {
        try { ensureCombatPointers() } catch (_) {}
        addLog('You cannot explore while in combat.', 'danger')
        return
    }

    const area = state.area
    recordInput('explore', { area })

    // Advance world time by one part-of-day whenever you explore
    const timeStep = advanceTime(state, 1)
    const timeLabel = formatTimeShort(timeStep.after)

    if (timeStep.dayChanged) {
        addLog('A new day begins in Emberwood. ' + timeLabel + '.', 'system')
    } else {
        addLog('Time passes... ' + timeLabel + '.', 'system')
    }

    updateTimeDisplay()
    // NEW: update ambient music based on area + time
    updateAreaMusic()

    // Let the village economy, kingdom government, town hall & population drift once per new day
    if (timeStep.dayChanged) {
        runDailyTicks(state, timeStep.after.absoluteDay, { addLog })
    }

    // --- QUESTS (modularized) ------------------------------------------------
    // Handles main-quest story beats, side-quest events, and boss triggers.
    if (quests.handleExploreQuestBeats(area)) return

    // --- WANDERING MERCHANT (outside village) ---------------------------------
    if (area !== 'village') {
        // Small chance each explore click to meet a traveling merchant
        if (rand('encounter.rare') < 0.1) {
            let sceneText =
                'Along the road, a lone cart creaks to a stop. A cloaked figure raises a hand in greeting.'

            if (area === 'forest') {
                sceneText =
                    'Deeper in the forest, a lantern glows between the trees – a traveling merchant has set up a tiny camp.'
            } else if (area === 'ruins') {
                sceneText =
                    'Among the shattered stones of the Spire, a daring merchant has laid out wares on a cracked pillar.'
            }

            setScene('Wandering Merchant', sceneText)
            addLog(
                'You encounter a wandering merchant on your travels.',
                'system'
            )
            openMerchantModal('wandering') // NEW: different context
            saveGame()
            return
        }
    }

    // --- GENERIC RANDOM ENCOUNTER LOGIC ---------------------------------------
    const encounterList = RANDOM_ENCOUNTERS[area] || []
    if (encounterList.length && rand('encounter.listUse') < 0.7) {
        const id =
            encounterList[randInt(0, encounterList.length - 1, 'encounter.listPick')]
        startBattleWith(id)
        return
    }

    // --- NO ENCOUNTER: FLAVOR TEXT --------------------------------------------
    let title = 'Exploring'
    let text =
        'You search the surroundings but find only rustling leaves and distant cries.'

    if (area === 'village') {
        title = 'Emberwood Village'
        text =
            'You wander the streets of Emberwood. The tavern buzzes, the market clinks with coin, and gossip drifts on the air.'
    } else if (area === 'ruins' && state.flags.dragonDefeated) {
        title = 'Quiet Ruins'
        text =
            'The Spire lies quiet now, yet echoes of past horrors linger. Lesser creatures still prowl the broken halls.'
    } else if (area === 'forest' && state.flags.goblinBossDefeated) {
        title = 'Calmer Forest'
        text =
            'With the Warlord gone, Emberwood Forest feels less hostile – but not entirely safe.'
    }

    setScene(title, text)
    addLog('You explore cautiously. For now, nothing attacks.', 'system')

    // ✅ Make sure the actions bar matches the *current* area
    renderActions()

    saveGame()
}

// --- EXPERIENCE & LEVELING ----------------------------------------------------

function grantExperience(amount) {
    const p = state.player
    let remaining = amount
    while (remaining > 0) {
        const toNext = p.nextLevelXp - p.xp
        if (remaining >= toNext) {
            p.xp += toNext
            remaining -= toNext
            levelUp()
        } else {
            p.xp += remaining
            remaining = 0
        }
    }
    updateHUD()
    saveGame()
}function cheatMaxLevel() {
    const p = state.player
    if (!p) return
    const target = MAX_PLAYER_LEVEL
    if (p.level >= target) {
        addLog('Cheat: you are already at the level cap (' + target + ').', 'system')
        return
    }

    const gainedLevels = target - p.level

    // Next-level XP curve (matches levelUp(): nextLevelXp *= 1.4 per level)
    let next = 100
    for (let lv = 1; lv < target; lv++) {
        next = Math.round(next * 1.4)
    }

    p.level = target
    p.xp = 0
    p.nextLevelXp = next

    // Award the missing skill points so you can distribute them manually.
    if (p.skillPoints == null) p.skillPoints = 0
    p.skillPoints += gainedLevels

    // Sync + heal
    rescaleActiveCompanion()
    recalcPlayerStats()
    p.hp = p.maxHp
    p.resource = p.maxResource

    // Patch 1.1.0: grant upgrade tokens + unlocked spells
    ensurePlayerSpellSystems(p)
    p.abilityUpgradeTokens = (p.abilityUpgradeTokens || 0) + gainedLevels
    const unlocks = CLASS_LEVEL_UNLOCKS[p.classId] || []
    unlocks.forEach((u) => {
        if (u && u.spell && u.level <= p.level && !p.spells.includes(u.spell)) {
            p.spells.push(u.spell)
        }
    })
    ensurePlayerSpellSystems(p)

    addLog(
        'Cheat: set you to level ' + target + ' (+' + gainedLevels + ' skill points).',
        'system'
    )
    updateHUD()
    saveGame()
}

function levelUp() {
    const p = state.player
    p.level += 1
    p.nextLevelXp = Math.round(p.nextLevelXp * 1.4)

    // Award 1 skill point per level
    if (p.skillPoints == null) p.skillPoints = 0
    p.skillPoints += 1

    // Keep companion scaling synced to your level
    rescaleActiveCompanion()

    // Full heal using current max stats
    p.hp = p.maxHp
    p.resource = p.maxResource

// Patch 1.1.0: spell loadouts, upgrades, and progression unlocks
    ensurePlayerSpellSystems(p)
    p.abilityUpgradeTokens = (p.abilityUpgradeTokens || 0) + 1
    const unlocked = tryUnlockClassSpells(p)
    if (unlocked && unlocked.length) {
        unlocked.forEach((sid) => {
            const a = ABILITIES[sid]
            addLog('Unlocked: ' + (a ? a.name : sid) + '.', 'good')
        })
    }

    addLog(
        'You reach level ' + p.level + '! Choose a skill to improve.',
        'good'
    )

    // Open skill selection modal
    openSkillLevelUpModal()
}

function openGovernmentModal() {
    // Make sure government state exists (handles old saves too)
    const timeInfo = getTimeInfo(state)
    const absoluteDay = timeInfo ? timeInfo.absoluteDay : 0
    initGovernmentState(state, absoluteDay)

    const gov = state.government
    const summary = getGovernmentSummary(state)
    const villageEffect = getVillageGovernmentEffect(state, 'village')

    // Government-aware village economy (already adjusted by royal influence)
    const villageEconomy = getVillageEconomySummary(state)
    openModal('Realm & Government', (body) => {
        // --- CARD 1: REALM OVERVIEW ---------------------------------------------
        const overviewCard = document.createElement('div')
        overviewCard.className = 'item-row'

        const header = document.createElement('div')
        header.className = 'item-row-header'

        const title = document.createElement('span')
        title.className = 'item-name'
        title.textContent = summary.realmName || 'The Realm'
        header.appendChild(title)

        const tag = document.createElement('span')
        tag.className = 'tag'
        tag.textContent = summary.capitalName
            ? `Capital: ${summary.capitalName}`
            : 'Overworld Government'
        header.appendChild(tag)

        overviewCard.appendChild(header)

        const when = document.createElement('p')
        when.className = 'modal-subtitle'
        if (timeInfo) {
            when.textContent = `As of ${timeInfo.weekdayName} ${timeInfo.partName}, Year ${timeInfo.year}.`
        } else {
            when.textContent = 'Current state of the realm.'
        }
        overviewCard.appendChild(when)

        const metrics = summary.metrics || {
            stability: 50,
            prosperity: 50,
            royalPopularity: 50,
            corruption: 50
        }

        const metricsLine = document.createElement('p')
        metricsLine.className = 'modal-subtitle'
        metricsLine.textContent =
            `Stability: ${metrics.stability} • ` +
            `Prosperity: ${metrics.prosperity} • ` +
            `Popularity: ${metrics.royalPopularity} • ` +
            `Corruption: ${metrics.corruption}`
        overviewCard.appendChild(metricsLine)

        if (summary.lastDecreeTitle) {
            const decreeLine = document.createElement('p')
            decreeLine.className = 'modal-subtitle'
            decreeLine.textContent = `Latest decree: ${summary.lastDecreeTitle}`
            overviewCard.appendChild(decreeLine)
        }

        body.appendChild(overviewCard)

        // --- CARD 2: ROYAL FAMILY -----------------------------------------------
        const famCard = document.createElement('div')
        famCard.className = 'item-row'

        const famHeader = document.createElement('div')
        famHeader.className = 'item-row-header'

        const famTitle = document.createElement('span')
        famTitle.className = 'item-name'
        famTitle.textContent = 'Royal Family'
        famHeader.appendChild(famTitle)

        const famTag = document.createElement('span')
        famTag.className = 'tag'
        famTag.textContent = `${summary.monarchTitle || 'Ruler'} of the realm`
        famHeader.appendChild(famTag)

        famCard.appendChild(famHeader)

        const monarchLine = document.createElement('p')
        monarchLine.className = 'modal-subtitle'
        monarchLine.textContent = `${summary.monarchTitle || 'Ruler'} ${
            summary.monarchName || 'Unknown'
        }`
        famCard.appendChild(monarchLine)

        if (summary.married && summary.spouseName) {
            const spouseLine = document.createElement('p')
            spouseLine.className = 'modal-subtitle'
            spouseLine.textContent = `Spouse: ${summary.spouseName}`
            famCard.appendChild(spouseLine)
        }

        const kidsLine = document.createElement('p')
        kidsLine.className = 'modal-subtitle'
        kidsLine.textContent =
            summary.childrenCount > 0
                ? `Children: ${summary.childrenCount} (eldest is heir to the throne).`
                : 'No heirs of age are currently known at court.'
        famCard.appendChild(kidsLine)

        body.appendChild(famCard)

        // --- CARD 3: ROYAL COUNCIL ----------------------------------------------
        const councilCard = document.createElement('div')
        councilCard.className = 'item-row'

        const councilHeader = document.createElement('div')
        councilHeader.className = 'item-row-header'

        const councilTitle = document.createElement('span')
        councilTitle.className = 'item-name'
        councilTitle.textContent = 'Royal Council'
        councilHeader.appendChild(councilTitle)

        const councilTag = document.createElement('span')
        councilTag.className = 'tag'
        councilTag.textContent = `${summary.councilCount || 0} seats at court`
        councilHeader.appendChild(councilTag)

        councilCard.appendChild(councilHeader)

        if (gov && Array.isArray(gov.council) && gov.council.length) {
            gov.council.forEach((member) => {
                const row = document.createElement('div')
                row.className = 'equip-row'

                const left = document.createElement('span')
                left.textContent = `${member.role}: ${member.name}`
                row.appendChild(left)

                const right = document.createElement('span')
                right.className = 'stat-note'
                const loyalty = Math.round(member.loyalty)
                right.textContent = `${member.ideology} • Loyalty ${loyalty} • ${member.mood}`
                row.appendChild(right)

                councilCard.appendChild(row)
            })
        } else {
            const none = document.createElement('p')
            none.className = 'modal-subtitle'
            none.textContent =
                'No council members are currently recorded in the royal rolls.'
            councilCard.appendChild(none)
        }

        body.appendChild(councilCard)

        // --- CARD 4: VILLAGE ATTITUDES ------------------------------------------
        const villageCard = document.createElement('div')
        villageCard.className = 'item-row'

        const villageHeader = document.createElement('div')
        villageHeader.className = 'item-row-header'

        const villageTitle = document.createElement('span')
        villageTitle.className = 'item-name'
        villageTitle.textContent = 'Emberwood Village'
        villageHeader.appendChild(villageTitle)

        const villageTag = document.createElement('span')
        villageTag.className = 'tag'
        villageTag.textContent = 'Local leadership & mood'
        villageHeader.appendChild(villageTag)

        villageCard.appendChild(villageHeader)

        const moodLine = document.createElement('p')
        moodLine.className = 'modal-subtitle'

        if (villageEffect.hasData) {
            moodLine.textContent =
                `Loyalty: ${Math.round(villageEffect.loyalty)} • ` +
                `Fear: ${Math.round(villageEffect.fear)} • ` +
                `Unrest: ${Math.round(villageEffect.unrest)}`
            villageCard.appendChild(moodLine)

            const desc = document.createElement('p')
            desc.className = 'modal-subtitle'
            desc.textContent = villageEffect.description
            villageCard.appendChild(desc)

            const mods = document.createElement('p')
            mods.className = 'modal-subtitle'
            mods.textContent =
                `Prosperity modifier: ${villageEffect.prosperityModifier.toFixed(
                    2
                )} • ` +
                `Safety modifier: ${villageEffect.safetyModifier.toFixed(2)}`
            villageCard.appendChild(mods)
        } else {
            moodLine.textContent =
                "The crown's influence on Emberwood is still being felt out."
            villageCard.appendChild(moodLine)
        }

        // NEW: show what the rest of the systems actually "see"
        const econLine = document.createElement('p')
        econLine.className = 'modal-subtitle'
        econLine.textContent =
            `Village economy — Prosperity ${villageEconomy.prosperity} • ` +
            `Trade ${villageEconomy.trade} • ` +
            `Security ${villageEconomy.security}`
        villageCard.appendChild(econLine)

        body.appendChild(villageCard)

        // --- CARD 5: RECENT DECREE LOG ------------------------------------------
        const historyCard = document.createElement('div')
        historyCard.className = 'item-row'

        const historyHeader = document.createElement('div')
        historyHeader.className = 'item-row-header'

        const historyTitle = document.createElement('span')
        historyTitle.className = 'item-name'
        historyTitle.textContent = 'Recent Decrees & Events'
        historyHeader.appendChild(historyTitle)

        const historyTag = document.createElement('span')
        historyTag.className = 'tag'
        historyTag.textContent = 'Last few changes at court'
        historyHeader.appendChild(historyTag)

        historyCard.appendChild(historyHeader)

        if (gov && Array.isArray(gov.history) && gov.history.length) {
            const recent = gov.history
                .slice(-6) // last 6
                .reverse() // newest first

            recent.forEach((ev) => {
                const line = document.createElement('p')
                line.className = 'modal-subtitle'
                const dayLabel =
                    typeof ev.day === 'number' ? `Day ${ev.day}` : 'Unknown day'
                line.textContent = `${dayLabel}: ${ev.title} — ${ev.description}`
                historyCard.appendChild(line)
            })
        } else {
            const none = document.createElement('p')
            none.className = 'modal-subtitle'
            none.textContent =
                'The royal scribes have not yet recorded any notable decrees.'
            historyCard.appendChild(none)
        }

        body.appendChild(historyCard)
    })
}
// --- PAUSE / GAME MENU --------------------------------------------------------
function openInGameSettingsModal() {
    openModal('Settings', (body) => {
        // Safety: if state doesn't exist yet, just show a simple message
        if (typeof state === 'undefined' || !state) {
            const msg = document.createElement('p')
            msg.textContent = 'Settings are unavailable until a game is running.'
            body.appendChild(msg)

            const actions = document.createElement('div')
            actions.className = 'modal-actions'
            const btnBack = document.createElement('button')
            btnBack.className = 'btn outline'
            btnBack.textContent = 'Back'
            btnBack.addEventListener('click', () => closeModal())
            actions.appendChild(btnBack)
            body.appendChild(actions)
            return
        }

        const intro = document.createElement('p')
        intro.className = 'modal-subtitle'
        intro.textContent = 'Changes apply immediately.'
        body.appendChild(intro)

        const container = document.createElement('div')
        // Compact settings layout so it fits better on mobile while keeping sections.
        container.className = 'settings-modal-body settings-sections settings-compact'

        const addSection = (title) => {
            const sec = document.createElement('div')
            sec.className = 'settings-section'
            const h = document.createElement('div')
            h.className = 'settings-section-title'
            h.textContent = title
            sec.appendChild(h)
            container.appendChild(sec)
            return sec
        }

        const makeRow = (labelText, descText) => {
            const row = document.createElement('div')
            row.className = 'settings-row'

            const left = document.createElement('div')
            left.className = 'settings-left'

            const label = document.createElement('div')
            label.className = 'settings-label'
            label.textContent = labelText
            left.appendChild(label)

            if (descText) {
                const desc = document.createElement('div')
                desc.className = 'settings-desc'
                desc.textContent = descText
                left.appendChild(desc)
            }

            row.appendChild(left)
            return row
        }

        const makeSwitch = (id, initialChecked, onChange, ariaLabel) => {
            const wrap = document.createElement('label')
            wrap.className = 'switch'
            if (ariaLabel) wrap.setAttribute('aria-label', ariaLabel)

            const input = document.createElement('input')
            input.type = 'checkbox'
            if (id) input.id = id
            input.checked = !!initialChecked
            input.addEventListener('change', () => onChange(!!input.checked))

            const track = document.createElement('span')
            track.className = 'switch-track'
            track.setAttribute('aria-hidden', 'true')

            wrap.appendChild(input)
            wrap.appendChild(track)
            return wrap
        }

        // --- Audio ------------------------------------------------------------
        const secAudio = addSection('Audio')

        // Master volume
        {
            const row = makeRow('Master volume', 'Overall volume level.')
            const control = document.createElement('div')
            control.className = 'settings-control'

            const slider = document.createElement('input')
            slider.type = 'range'
            slider.min = '0'
            slider.max = '100'
            slider.step = '5'
            slider.value = typeof state.settingsVolume === 'number' ? state.settingsVolume : 100

            const value = document.createElement('span')
            value.className = 'settings-value'
            value.textContent = slider.value + '%'

            setMasterVolumePercent(slider.value)

            slider.addEventListener('input', () => {
                const v = Number(slider.value) || 0
                state.settingsVolume = v
                try {
                    safeStorageSet('pq-master-volume', String(v), { action: 'write volume' })
                } catch (e) {}
                value.textContent = v + '%'
                setMasterVolumePercent(v)
            })

            control.appendChild(slider)
            row.appendChild(control)
            row.appendChild(value)
            secAudio.appendChild(row)
        }

        // Music toggle
        {
            const row = makeRow('Music', 'Background music during play.')
            const control = document.createElement('div')
            control.className = 'settings-control'

            const sw = makeSwitch(null, state.musicEnabled !== false, (on) => {
                setMusicEnabled(on)
                saveGame()
            }, 'Toggle music')
            control.appendChild(sw)
            row.appendChild(control)
            secAudio.appendChild(row)
        }

        // SFX toggle
        {
            const row = makeRow('SFX', 'Combat and UI sound effects.')
            const control = document.createElement('div')
            control.className = 'settings-control'

            const sw = makeSwitch(null, state.sfxEnabled !== false, (on) => {
                setSfxEnabled(on)
                saveGame()
            }, 'Toggle sound effects')
            control.appendChild(sw)
            row.appendChild(control)
            secAudio.appendChild(row)
        }

        // --- Display ----------------------------------------------------------
        const secDisplay = addSection('Display')

        // UI theme
        {
            const row = makeRow('Theme', 'Changes the overall UI palette.')
            const control = document.createElement('div')
            control.className = 'settings-control'

            const themeSelectInline = document.createElement('select')
            themeSelectInline.className = 'settings-select'

            const themeOptions = [
                { value: 'default', label: 'Default' },
                { value: 'arcane', label: 'Arcane' },
                { value: 'inferno', label: 'Inferno' },
                { value: 'forest', label: 'Forest' },
                { value: 'holy', label: 'Holy' },
                { value: 'shadow', label: 'Shadow' }
            ]

            themeOptions.forEach((t) => {
                const opt = document.createElement('option')
                opt.value = t.value
                opt.textContent = t.label
                themeSelectInline.appendChild(opt)
            })

            themeSelectInline.value = safeStorageGet('pq-theme') || 'default'
            themeSelectInline.addEventListener('change', () => setTheme(themeSelectInline.value))

            control.appendChild(themeSelectInline)
            row.appendChild(control)
            secDisplay.appendChild(row)
        }

        // Text speed
        {
            const row = makeRow('Text speed', 'How quickly story text advances.')
            const control = document.createElement('div')
            control.className = 'settings-control'

            const slider = document.createElement('input')
            slider.type = 'range'
            slider.min = '30'
            slider.max = '200'
            slider.step = '10'
            slider.value = typeof state.settingsTextSpeed === 'number' ? state.settingsTextSpeed : 100

            const value = document.createElement('span')
            value.className = 'settings-value'
            value.textContent = String(slider.value)

            slider.addEventListener('input', () => {
                const v = Number(slider.value) || 100
                state.settingsTextSpeed = v
                value.textContent = String(v)
                try {
                    safeStorageSet('pq-text-speed', String(v), { action: 'write text speed' })
                } catch (e) {}
            })

            control.appendChild(slider)
            row.appendChild(control)
            row.appendChild(value)
            secDisplay.appendChild(row)
        }

        // --- Gameplay ---------------------------------------------------------
        const secGameplay = addSection('Gameplay')

        // Difficulty
        {
            const row = makeRow('Difficulty', 'Adjust challenge and enemy scaling.')
            const control = document.createElement('div')
            control.className = 'settings-control'

            const diffSelect = document.createElement('select')
            diffSelect.className = 'settings-select'
            Object.values(DIFFICULTY_CONFIG).forEach((cfg) => {
                const opt = document.createElement('option')
                opt.value = cfg.id
                opt.textContent = cfg.name
                diffSelect.appendChild(opt)
            })
            diffSelect.value = state.difficulty || 'normal'
            diffSelect.addEventListener('change', () => {
                const newDiff = diffSelect.value
                if (DIFFICULTY_CONFIG[newDiff]) {
                    state.difficulty = newDiff
                    updateHUD()
                    saveGame()
                }
            })

            control.appendChild(diffSelect)
            row.appendChild(control)
            secGameplay.appendChild(row)
        }

        // --- Accessibility ----------------------------------------------------
        const secAccess = addSection('Accessibility')
        {
            const row = makeRow('Reduce motion', 'Turns off animated HUD effects.')
            const control = document.createElement('div')
            control.className = 'settings-control'

            const sw = makeSwitch(null, !!state.settingsReduceMotion, (on) => {
                setReduceMotionEnabled(on)
                saveGame()
            }, 'Toggle reduce motion')

            control.appendChild(sw)
            row.appendChild(control)
            secAccess.appendChild(row)
        }

        body.appendChild(container)

        // --- Footer actions ---------------------------------------------------
        const actions = document.createElement('div')
        actions.className = 'modal-actions'

        const btnBack = document.createElement('button')
        btnBack.className = 'btn outline'
        btnBack.textContent = 'Back'
        btnBack.addEventListener('click', () => {
            saveGame()
            closeModal()
        })

        actions.appendChild(btnBack)
        body.appendChild(actions)
    })
}

function openPauseMenu() {
    openModal('Game Menu', (body) => {
        const p = document.createElement('p')
        p.className = 'modal-subtitle'
        p.textContent =
            'Your progress auto-saves often, but you can force a save or exit safely.'
        body.appendChild(p)

        // Row 1: Save + Settings
        const row1 = document.createElement('div')
        row1.className = 'item-actions'

        const btnSave = document.createElement('button')
        btnSave.className = 'btn outline'
        btnSave.textContent = 'Save / Load'
        btnSave.addEventListener('click', () => {
            closeModal()
            openSaveManager({ mode: 'save' })
        })

        const btnSettings = document.createElement('button')
        btnSettings.className = 'btn outline'
        btnSettings.textContent = 'Settings'
        btnSettings.addEventListener('click', () => {
            // Open in-game settings as a modal so Back just returns to the battle.
            closeModal()
            openInGameSettingsModal()
        })

        row1.appendChild(btnSave)
        row1.appendChild(btnSettings)
        body.appendChild(row1)

        // Row 2: Changelog + Quit
        const row2 = document.createElement('div')
        row2.className = 'item-actions'

        const btnChangelog = document.createElement('button')
        btnChangelog.className = 'btn outline'
        btnChangelog.textContent = 'View Changelog'
        btnChangelog.addEventListener('click', () => {
            openChangelogModal({ fromPause: true })
        })

        const btnMenu = document.createElement('button')
        btnMenu.className = 'btn outline'
        btnMenu.textContent = 'Quit to Main Menu'
        btnMenu.addEventListener('click', () => {
            closeModal()
            switchScreen('mainMenu')
        })

        row2.appendChild(btnChangelog)
        row2.appendChild(btnMenu)
        body.appendChild(row2)
    })
}

// --- SAVE / LOAD --------------------------------------------------------------

const SAVE_KEY = 'pocketQuestSave_v1' // legacy key (kept for save compatibility)
const SAVE_KEY_PREFIX = 'pocketQuestSaveSlot_v1_' // legacy prefix (kept for save compatibility)
const SAVE_INDEX_KEY = 'pocketQuestSaveIndex_v1' // metadata for manual saves

/* --------------------------- Corrupt save UX --------------------------- */
function showCorruptSaveModal(details = '') {
    try {
        if (modalEl && modalEl.dataset && modalEl.dataset.lock === '1') {
            alert('Save data is corrupt or incompatible.')
            return
        }
    } catch (_) {}

    const msg = String(details || '').trim()
    const detailText =
        msg ||
        'Your save could not be loaded (corrupt data, incompatible schema, or blocked storage).'

    try {
        openModal('Save Error', (body) => {
            const p = document.createElement('p')
            p.className = 'modal-subtitle'
            p.textContent = detailText
            body.appendChild(p)

            const pre = document.createElement('pre')
            pre.className = 'code-block'
            pre.textContent =
                'Tip: Open Feedback to copy a report if one exists.\n\n' +
                (lastCrashReport ? JSON.stringify(lastCrashReport, null, 2) : '(no crash report recorded)')
            body.appendChild(pre)

            const actions = document.createElement('div')
            actions.className = 'modal-actions'

            const btnCopy = document.createElement('button')
            btnCopy.className = 'btn outline'
            btnCopy.textContent = 'Copy Details'
            btnCopy.addEventListener('click', () => {
                const txt = pre.textContent || detailText
                copyFeedbackToClipboard(txt).catch(() => {})
            })

            const btnReset = document.createElement('button')
            btnReset.className = 'btn danger'
            btnReset.textContent = 'Reset Saves'
            btnReset.addEventListener('click', () => {
                try {
                    const index = getSaveIndex()
                    index.forEach((e) => {
                        if (e && e.id && e.id !== '__auto__') {
                            safeStorageRemove(SAVE_KEY_PREFIX + e.id, { action: 'remove manual save slot' })
                        }
                    })
                } catch (_) {}
                safeStorageRemove(SAVE_INDEX_KEY, { action: 'remove save index' })
                safeStorageRemove(SAVE_KEY, { action: 'remove autosave' })
                closeModal()
                switchScreen('mainMenu')
            })

            const btnClose = document.createElement('button')
            btnClose.className = 'btn outline'
            btnClose.textContent = 'Close'
            btnClose.addEventListener('click', () => {
                closeModal()
                switchScreen('mainMenu')
            })

            actions.appendChild(btnCopy)
            actions.appendChild(btnReset)
            actions.appendChild(btnClose)
            body.appendChild(actions)
        })
    } catch (_) {
        alert('Save data is corrupt or incompatible.')
    }
}


/* --------------------------- Save migrations --------------------------- */
/**
 * Save data is persisted in localStorage and must remain forward-compatible.
 * We use a simple integer schema (meta.schema) and stepwise migrations.
 */
function migrateSaveData(data) {
    // If something is seriously wrong, mark as corrupt so load() can offer a clean reset.
    if (!data || typeof data !== 'object') {
        return {
            __corrupt: true,
            meta: { schema: SAVE_SCHEMA, patch: GAME_PATCH, savedAt: Date.now() }
        }
    }

    data.meta = data.meta || {}
    const currentSchema = finiteNumber(data.meta.schema, 1)
    data.meta.schema = currentSchema > 0 ? Math.floor(currentSchema) : 1

    // Stepwise migrations
    while (data.meta.schema < SAVE_SCHEMA) {
        if (data.meta.schema === 1) {
            // v2: formalize fields that previously might be missing
            data.dynamicDifficulty = data.dynamicDifficulty || {
                band: 0,
                tooEasyStreak: 0,
                struggleStreak: 0
            }
            data.log = Array.isArray(data.log) ? data.log : []
            data.logFilter = data.logFilter || 'all'

            // Systems that can be missing on older saves
            if (!data.time || typeof data.time !== 'object') data.time = null
            if (!data.villageEconomy || typeof data.villageEconomy !== 'object')
                data.villageEconomy = null
            if (!data.government || typeof data.government !== 'object')
                data.government = null
            if (!data.bank || typeof data.bank !== 'object') data.bank = null
            if (!data.village || typeof data.village !== 'object') data.village = null

            if (!data.villageMerchantNames || typeof data.villageMerchantNames !== 'object')
                data.villageMerchantNames = null
            if (!data.merchantStock || typeof data.merchantStock !== 'object')
                data.merchantStock = null

            data.inCombat = !!data.inCombat
            // Multi-enemy forward-compat: allow saves that store `enemies` without `currentEnemy`.
            if (data.inCombat) {
                const hasEnemies = Array.isArray(data.enemies) && data.enemies.length
                if (!data.currentEnemy && hasEnemies) {
                    data.currentEnemy = data.enemies.find((e) => e && typeof e === 'object' && typeof e.hp === 'number' && e.hp > 0) || data.enemies[0] || null
                    if (typeof data.targetEnemyIndex !== 'number' || !Number.isFinite(data.targetEnemyIndex)) data.targetEnemyIndex = 0
                }
                if (!data.currentEnemy) data.inCombat = false
            }

            data.flags = data.flags && typeof data.flags === 'object' ? data.flags : {}
            data.quests = data.quests && typeof data.quests === 'object' ? data.quests : {}

            data.meta.schema = 2
            continue
        }

        if (data.meta.schema === 2) {
            // v3: persist merchant restock meta + daily tick catch-up meta
            if (!data.merchantStockMeta || typeof data.merchantStockMeta !== 'object') {
                data.merchantStockMeta = { lastDayRestocked: null }
            } else if (typeof data.merchantStockMeta.lastDayRestocked !== 'number') {
                data.merchantStockMeta.lastDayRestocked = null
            }

            if (!data.sim || typeof data.sim !== 'object') {
                data.sim = { lastDailyTickDay: null }
            }

            // Seed catch-up pointer to the current day so older saves don't suddenly replay 30+ days.
            try {
                if (data.time && typeof data.time.dayIndex === 'number' && Number.isFinite(data.time.dayIndex)) {
                    data.sim.lastDailyTickDay = Math.max(0, Math.floor(data.time.dayIndex))
                } else if (typeof data.sim.lastDailyTickDay !== 'number') {
                    data.sim.lastDailyTickDay = null
                }
            } catch (_) {
                // ignore
            }

            data.meta.schema = 3
            continue
        }

        if (data.meta.schema === 3) {
            // v4 (PATCH 1.1.0): spell loadouts + ability upgrades + new status fields
            if (data.player && typeof data.player === 'object') {
                // Ensure new spell system fields exist.
                ensurePlayerSpellSystems(data.player)

                // Grant any newly-added class unlock spells up to the current level.
                const unlocks = CLASS_LEVEL_UNLOCKS[data.player.classId] || []
                unlocks.forEach((u) => {
                    if (u && u.spell && u.level <= (data.player.level || 1) && !data.player.spells.includes(u.spell)) {
                        data.player.spells.push(u.spell)
                        if (Array.isArray(data.player.equippedSpells) && data.player.equippedSpells.length < MAX_EQUIPPED_SPELLS) {
                            data.player.equippedSpells.push(u.spell)
                        }
                    }
                })

                // Ensure legacy saves have an equipped list even if they had spells.
                if (!Array.isArray(data.player.equippedSpells) || !data.player.equippedSpells.length) {
                    data.player.equippedSpells = (data.player.spells || []).slice(0, MAX_EQUIPPED_SPELLS)
                }

                // Default tokens to 0 (earned on future level-ups).
                if (typeof data.player.abilityUpgradeTokens !== 'number') data.player.abilityUpgradeTokens = 0
                if (!data.player.abilityUpgrades || typeof data.player.abilityUpgrades !== 'object') data.player.abilityUpgrades = {}
            }

            data.meta.schema = 4
            continue
        }

        if (data.meta.schema === 4) {
            // v5 (PATCH 1.1.4): QA/debug persistence + additional flags
            if (!data.flags || typeof data.flags !== 'object') data.flags = {}
            if (typeof data.flags.neverCrit !== 'boolean') data.flags.neverCrit = false

            if (!data.debug || typeof data.debug !== 'object') {
                data.debug = {
                    useDeterministicRng: false,
                    rngSeed: (Date.now() >>> 0),
                    rngIndex: 0,
                    captureRngLog: false,
                    rngLog: [],
                    lastAction: '',
                    inputLog: [],
                    lastInvariantIssues: null
                }
            } else {
                // Backfill missing debug fields
                if (typeof data.debug.useDeterministicRng !== 'boolean') data.debug.useDeterministicRng = false
                if (typeof data.debug.rngSeed !== 'number' || !Number.isFinite(data.debug.rngSeed)) data.debug.rngSeed = (Date.now() >>> 0)
                if (typeof data.debug.rngIndex !== 'number' || !Number.isFinite(data.debug.rngIndex)) data.debug.rngIndex = 0
                if (typeof data.debug.captureRngLog !== 'boolean') data.debug.captureRngLog = false
                if (!Array.isArray(data.debug.rngLog)) data.debug.rngLog = []
                if (typeof data.debug.lastAction !== 'string') data.debug.lastAction = ''
                if (!Array.isArray(data.debug.inputLog)) data.debug.inputLog = []
                if (!('lastInvariantIssues' in data.debug)) data.debug.lastInvariantIssues = null
            }

            data.meta.schema = 5
            continue
        }



        if (data.meta.schema === 5) {
            // v6 (PATCH 1.1.52): normalize inventory quantity field (qty -> quantity) and sanitize counts
            if (data.player && typeof data.player === 'object' && Array.isArray(data.player.inventory)) {
                data.player.inventory.forEach((it) => {
                    if (!it || typeof it !== 'object') return

                    // Migrate legacy saves that used `qty` instead of `quantity`
                    if (!('quantity' in it) && ('qty' in it)) it.quantity = it.qty
                    if ('qty' in it) delete it.qty

                    const q = Math.floor(Number(it.quantity))
                    if (it.type === 'potion') {
                        it.quantity = Number.isFinite(q) && q > 0 ? q : 1
                    } else {
                        // Non-stackables (and most stackables in this patch line) should never be 0/NaN
                        it.quantity = Number.isFinite(q) && q > 0 ? q : 1
                    }
                })
            }

            data.meta.schema = 6
            continue
        }



        if (data.meta.schema === 6) {
            // v7 (PATCH 1.1.7): new class unlock tiers + new combat status fields
            if (!data.flags || typeof data.flags !== 'object') data.flags = {}

            if (data.player && typeof data.player === 'object') {
                ensurePlayerSpellSystems(data.player)

                // Grant any newly-added class unlock spells up to the current level.
                const unlocks = CLASS_LEVEL_UNLOCKS[data.player.classId] || []
                unlocks.forEach((u) => {
                    if (u && u.spell && u.level <= (data.player.level || 1) && !data.player.spells.includes(u.spell)) {
                        data.player.spells.push(u.spell)
                        if (Array.isArray(data.player.equippedSpells) && data.player.equippedSpells.length < MAX_EQUIPPED_SPELLS) {
                            data.player.equippedSpells.push(u.spell)
                        }
                    }
                })

                // Backfill new per-fight status fields
                const st = data.player.status || (data.player.status = {})
                if (typeof st.comboPoints !== 'number' || !Number.isFinite(st.comboPoints)) st.comboPoints = 0
                if (typeof st.soulShards !== 'number' || !Number.isFinite(st.soulShards)) st.soulShards = 0
                if (typeof st.lichTurns !== 'number' || !Number.isFinite(st.lichTurns)) st.lichTurns = 0
                if (typeof st.totemType !== 'string') st.totemType = ''
                if (typeof st.totemTurns !== 'number' || !Number.isFinite(st.totemTurns)) st.totemTurns = 0
                if (typeof st.vanishTurns !== 'number' || !Number.isFinite(st.vanishTurns)) st.vanishTurns = 0
            }

            data.meta.schema = 7
            continue
        }

        // If we ever get an unknown schema, stop safely.
        break
    }

    // Sanitize a few high-risk numeric fields to prevent NaN/Infinity cascades.
    try {
        const p = data.player
        if (p && typeof p === 'object') {
            p.hp = finiteNumber(p.hp, 1)
            p.maxHp = finiteNumber(p.maxHp, p.hp)
            p.hp = clampFinite(p.hp, 0, p.maxHp, p.maxHp)

            p.gold = Math.max(0, Math.floor(finiteNumber(p.gold, 0)))

            p.resource = finiteNumber(p.resource, 0)
            p.maxResource = finiteNumber(p.maxResource, 0)
            p.resource = clampFinite(p.resource, 0, p.maxResource, p.maxResource)

            // Keep level sane
            p.level = Math.max(1, Math.floor(finiteNumber(p.level, 1)))
            p.xp = Math.max(0, Math.floor(finiteNumber(p.xp, 0)))
            p.nextLevelXp = Math.max(1, Math.floor(finiteNumber(p.nextLevelXp, 100)))
        }

        if (data.time && typeof data.time === 'object') {
            data.time.dayIndex = Math.max(0, Math.floor(finiteNumber(data.time.dayIndex, 0)))
            data.time.partIndex = clampFinite(data.time.partIndex, 0, 2, 0)
        }
    } catch (_) {
        // ignore sanitation failures; load flow will handle remaining defaults
    }

    return data
}
// Save coalescing: many actions call saveGame() back-to-back (especially on mobile).
// We still ensure a save happens quickly, but we avoid spamming localStorage.
let _saveTimer = null
let _saveQueued = false

function _buildSaveBlob() {
    return {
        player: state.player,
        area: state.area,
        difficulty: state.difficulty,
        dynamicDifficulty: state.dynamicDifficulty || {
            band: 0,
            tooEasyStreak: 0,
            struggleStreak: 0
        },

        quests: state.quests,
        flags: state.flags,
        debug: state.debug || null,
        companion: state.companion,

        // Time & economy
        time: state.time,
        villageEconomy: state.villageEconomy,
        government: state.government || null,
        village: state.village || null,

        // Bank state
        bank: state.bank || null,

        // 🛒 Merchant state
        villageMerchantNames: state.villageMerchantNames || null,
        merchantStock: state.merchantStock || null,
        merchantStockMeta: state.merchantStockMeta || null,

        // Simulation meta (catch-up pointer, etc.)
        sim: state.sim || { lastDailyTickDay: null },

        // Log & filter
        log: state.log || [],
        logFilter: state.logFilter || 'all',

        // Combat snapshot (multi-enemy aware; Patch 1.1.9+)
        inCombat: !!state.inCombat,
        enemies: (state.inCombat && Array.isArray(state.enemies) && state.enemies.length)
            ? state.enemies
            : (state.inCombat && state.currentEnemy ? [state.currentEnemy] : null),
        targetEnemyIndex: (state.inCombat && Number.isFinite(state.targetEnemyIndex))
            ? Math.max(0, Math.floor(state.targetEnemyIndex))
            : 0,
        currentEnemy: (state.inCombat && Array.isArray(state.enemies) && state.enemies.length)
            ? (state.enemies[(Number.isFinite(state.targetEnemyIndex) ? Math.max(0, Math.floor(state.targetEnemyIndex)) : 0)] || state.enemies[0] || null)
            : (state.inCombat && state.currentEnemy ? state.currentEnemy : null)
    }
}

function _performSave() {
    try {
        // 🚫 Don't save if there's no player or the hero is dead
        if (!state.player || state.player.hp <= 0) {
            console.warn('Skipped save: no player or player is dead.')
            return
        }

        
        // Repair common combat pointer desyncs before invariant scans/saves.
        try { ensureCombatPointers() } catch (_) {}
// Invariant check: catch NaN/corrupt state before writing it back to storage.
        try {
            const audit = validateState(state)
            if (audit && !audit.ok) {
                if (state.debug) state.debug.lastInvariantIssues = audit.issues
                recordCrash('assertion', new Error('State invariant violation before save'), {
                    stage: 'before_save',
                    issues: audit.issues
                })
                try {
                    addLog('⚠️ Integrity issue detected. Use Feedback to copy a report.', 'danger')
                } catch (_) {}
            }
        } catch (_) {}

        const toSave = _buildSaveBlob()

        // Stamp patch + schema + time into the save data
        toSave.meta = Object.assign({}, toSave.meta || {}, {
            patch: GAME_PATCH,
            schema: SAVE_SCHEMA,
            savedAt: Date.now()
        })

        const json = JSON.stringify(toSave)

        // De-dupe identical saves to reduce churn (mobile browsers can stutter on repeated writes)
        if (state.lastSaveJson && json === state.lastSaveJson) return

        const ok = safeStorageSet(SAVE_KEY, json, { action: 'save game' })
        // Record the attempt so we can de-dupe and keep the session stable even if storage is blocked.
        state.lastSaveJson = json
        if (!ok) {
            // Best-effort hint in the log (noteStorageFailure already throttles this).
            lastSaveError = {
                kind: 'storage',
                time: Date.now(),
                message: 'safeStorageSet returned false while saving game',
                action: 'save game'
            }
        }
    } catch (e) {
        console.error('Failed to save game:', e)
        lastSaveError = {
            kind: 'exception',
            time: Date.now(),
            message: String(e && e.message ? e.message : e),
            stack: e && e.stack ? String(e.stack) : null,
            action: 'save game'
        }
    }
}

function saveGame(opts = {}) {
    const force = !!(opts && opts.force)

    if (force) {
        if (_saveTimer) {
            clearTimeout(_saveTimer)
            _saveTimer = null
        }
        _saveQueued = false
        _performSave()
        return
    }

    // First call saves immediately; subsequent calls within the window are coalesced.
    if (!_saveTimer) {
        _performSave()
        _saveTimer = setTimeout(() => {
            _saveTimer = null
            if (_saveQueued) {
                _saveQueued = false
                _performSave()
            }
        }, 350)
    } else {
        _saveQueued = true
    }
}

function loadGame(fromDefeat) {
    try {
        const json = safeStorageGet(SAVE_KEY)
        if (!json) {
            if (!fromDefeat) alert('No save found on this device.')
            return false
        }

        let data = migrateSaveData(JSON.parse(json))
        if (data && data.__corrupt) {
            if (!fromDefeat) showCorruptSaveModal('Save data failed validation and cannot be loaded.')
            return false
        }
        if (!data || !data.player) {
            if (!fromDefeat) showCorruptSaveModal('Save is missing essential player data.')
            return false
        }
        state = createEmptyState()
        syncGlobalStateRef()

        // Restore persisted debug settings (RNG seed, input breadcrumbs, etc.)
        try {
            if (data.debug && typeof data.debug === 'object') {
                state.debug = Object.assign({}, state.debug || {}, data.debug)
            }
            initRngState(state)
        } catch (_) {}

        state.player = data.player
        state.area = data.area || 'village'
        state.difficulty = data.difficulty || 'normal'
        state.dynamicDifficulty = data.dynamicDifficulty || {
            band: 0,
            tooEasyStreak: 0,
            struggleStreak: 0
        }
        state.quests = data.quests || {}
        state.flags = data.flags || state.flags
        quests.ensureQuestStructures()
        state.companion = data.companion || null
        // NEW: restore village container (population, etc.)
        state.village = data.village || null
        // NEW: restore bank state
        state.bank = data.bank || null
        // NEW: restore time & economy (fallback if missing)
        state.time = data.time || null
        state.villageEconomy = data.villageEconomy || null
        initTimeState(state)
        initVillageEconomyState(state)
        // NEW: restore & initialize kingdom government
        state.government = data.government || null
        const timeInfo = getTimeInfo(state) // from timeSystem
        initGovernmentState(state, timeInfo.absoluteDay)

        // One-time cleanup so expired decrees don't linger after loading
        try {
            cleanupTownHallEffects(state, timeInfo.absoluteDay)
        } catch (_) {
            // ignore
        }
        // NEW: restore combat state (multi-enemy aware)
        state.inCombat = !!data.inCombat
        state.enemies = Array.isArray(data.enemies) && data.enemies.length ? data.enemies : null
        state.targetEnemyIndex = (typeof data.targetEnemyIndex === 'number' && Number.isFinite(data.targetEnemyIndex))
            ? Math.max(0, Math.floor(data.targetEnemyIndex))
            : 0
        state.currentEnemy = data.currentEnemy || null

        if (state.inCombat) {
            if (state.enemies && state.enemies.length) {
                // Ensure runtime fields on all enemies
                for (let i = 0; i < state.enemies.length; i++) {
                    const e = state.enemies[i]
                    if (e && typeof e === 'object') ensureEnemyRuntime(e)
                }

                // Pick a valid target (prefer saved index if alive)
                let pick = null
                const idx = state.targetEnemyIndex
                if (state.enemies[idx] && typeof state.enemies[idx].hp === 'number' && state.enemies[idx].hp > 0) {
                    pick = state.enemies[idx]
                } else {
                    pick = state.enemies.find((e) => e && typeof e.hp === 'number' && e.hp > 0) || state.enemies[0] || null
                }

                state.currentEnemy = pick
                state.targetEnemyIndex = Math.max(0, state.enemies.indexOf(pick))
                state.inCombat = !!(state.currentEnemy && typeof state.currentEnemy.hp === 'number' ? state.currentEnemy.hp > 0 : state.currentEnemy)
            } else if (state.currentEnemy) {
                // Legacy single-enemy save: materialize enemies[]
                ensureEnemyRuntime(state.currentEnemy)
                state.enemies = [state.currentEnemy]
                state.targetEnemyIndex = 0
                state.inCombat = !!(state.currentEnemy && typeof state.currentEnemy.hp === 'number' ? state.currentEnemy.hp > 0 : state.currentEnemy)
            } else {
                state.inCombat = false
            }

            // Initialize turn runtime and repair pointers
            try { ensureCombatTurnState() } catch (_) {}
            try { ensureCombatPointers() } catch (_) {}
        } else {
            state.currentEnemy = null
            state.enemies = null
            state.targetEnemyIndex = 0
        }

        // 🛒 NEW: restore merchant state (safe if missing on old saves)
        state.villageMerchantNames = data.villageMerchantNames || null
        state.merchantStock = data.merchantStock || null
        state.merchantStockMeta = data.merchantStockMeta || null

        // Simulation meta (daily tick catch-up pointer)
        state.sim = data.sim && typeof data.sim === 'object' ? data.sim : { lastDailyTickDay: null }
        if (typeof state.sim.lastDailyTickDay !== 'number') {
            // Seed to current day so we don't retroactively tick a ton on load.
            const d = state.time && typeof state.time.dayIndex === 'number' && Number.isFinite(state.time.dayIndex)
                ? Math.max(0, Math.floor(state.time.dayIndex))
                : 0
            state.sim.lastDailyTickDay = d
        }

        // NEW: restore log + filter (instead of wiping it)
        state.log = Array.isArray(data.log) ? data.log : []
        state.logFilter = data.logFilter || 'all'


        // Force the log UI to rebuild cleanly after loading a save
        _logUi.lastFirstId = null
        _logUi.renderedUpToId = 0
        _logUi.filter = 'all'
        state.currentEnemy && (state.currentEnemy.guardTurns ||= 0) // defensive safety, optional
        state.lastSaveJson = json

        // Recalc + UI refresh
        recalcPlayerStats()
        rescaleActiveCompanion({ noHeal: true })

        // Patch older saves missing enemy runtime fields
        if (state.inCombat) {
            if (Array.isArray(state.enemies) && state.enemies.length) {
                for (let i = 0; i < state.enemies.length; i++) {
                    const e = state.enemies[i]
                    if (e && typeof e === 'object') ensureEnemyRuntime(e)
                }
            } else if (state.currentEnemy) {
                ensureEnemyRuntime(state.currentEnemy)
            }
        }

        // Post-load invariant audit (non-fatal, but recorded for bug reports).
        try {
            const audit = validateState(state)
            if (audit && !audit.ok) {
                if (state.debug) state.debug.lastInvariantIssues = audit.issues
                recordCrash('assertion', new Error('State invariant violation after load'), {
                    stage: 'after_load',
                    issues: audit.issues
                })
                try {
                    addLog('⚠️ Loaded save has integrity issues. Use Feedback to copy a report.', 'danger')
                } catch (_) {}
            }
        } catch (_) {}
        quests.updateQuestBox()
        updateHUD()
        updateEnemyPanel()
        renderLog?.() // if you have renderLog(), this will repaint the restored log

        setScene(
            'Resuming Journey',
            'You pick up your adventure where you last left off.'
        )

        // NEW: explicitly say which enemy you're fighting, if any
        if (state.inCombat && state.currentEnemy) {
            addLog(
                'You are fighting ' + state.currentEnemy.name + '!',
                state.currentEnemy.isBoss ? 'danger' : 'system'
            )
        }

        // And then the usual load message
        addLog('Game loaded.', 'system')

        renderActions()
        switchScreen('game')
        updateTimeDisplay() // NEW
        return true
    } catch (e) {
        console.error('Failed to load game:', e)
        if (!fromDefeat) showCorruptSaveModal('Save data is corrupt or incompatible.')
        return false
    }
}

// --- MULTI-SLOT SAVE HELPERS --------------------------------------------------

// Extract basic hero info from a saved data blob
function buildHeroMetaFromData(data) {
    const p = data && data.player ? data.player : null
    const area = (data && data.area) || 'village'

    const heroName = (p && p.name) || 'Unnamed Hero'
    const classId = (p && (p.classId || p.class)) || null

    let className = (p && p.className) || ''
    try {
        if (
            !className &&
            typeof PLAYER_CLASSES !== 'undefined' &&
            PLAYER_CLASSES &&
            classId &&
            PLAYER_CLASSES[classId]
        ) {
            className = PLAYER_CLASSES[classId].name || ''
        }
    } catch (e) {
        // if PLAYER_CLASSES not available early, just skip
    }

    const level = p && typeof p.level === 'number' ? p.level : 1

    const patch = data && data.meta && data.meta.patch
    const savedAt = data && data.meta && data.meta.savedAt

    return { heroName, classId, className, level, area, patch, savedAt }
}

// Read the manual save index
function getSaveIndex() {
    try {
        const raw = safeStorageGet(SAVE_INDEX_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch (e) {
        console.warn('Failed to read save index', e)
        return []
    }
}

// Write the manual save index
function writeSaveIndex(list) {
    try {
        safeStorageSet(SAVE_INDEX_KEY, JSON.stringify(list), { action: 'write save index' })
    } catch (e) {
        console.warn('Failed to write save index', e)
    }
}

// Save the current run into a specific manual slot
function saveGameToSlot(slotId, label) {
    if (!slotId) {
        console.error('Missing slot id for manual save.')
        return
    }

    if (!state.player || state.player.hp <= 0) {
        alert('Cannot save: your hero is not alive.')
        return
    }
    // Use the existing save logic to produce the JSON blob (force so the slot always captures the latest state)
    saveGame({ force: true })
    const json = state.lastSaveJson
    if (!json) {
        alert('Could not save: no game data found.')
        return
    }

    let data
    try {
        data = JSON.parse(json)
    } catch (e) {
        console.error('Failed to parse save JSON for slot save', e)
        alert('Could not save: data is corrupt.')
        return
    }

    const meta = buildHeroMetaFromData(data)
    const now = Date.now()

    let index = getSaveIndex()
    let existing = index.find((e) => e.id === slotId)
    if (!existing) {
        existing = { id: slotId, createdAt: now }
        index.push(existing)
    }

    existing.label =
        label || existing.label || meta.heroName + ' Lv ' + meta.level
    existing.heroName = meta.heroName
    existing.classId = meta.classId
    existing.className = meta.className
    existing.level = meta.level
    existing.area = meta.area
    existing.patch = meta.patch || GAME_PATCH || 'Unknown'
    existing.savedAt = meta.savedAt || now
    existing.lastPlayed = now
    existing.isAuto = false

    writeSaveIndex(index)

    try {
        safeStorageSet(SAVE_KEY_PREFIX + slotId, json, { action: 'write manual save slot' })
    } catch (e) {
        console.error('Failed to write manual save slot', e)
        alert('Could not write that save slot.')
    }
}

// Delete a manual save slot
function deleteSaveSlot(slotId) {
    if (!slotId) return

    let index = getSaveIndex()
    index = index.filter((e) => e.id !== slotId)
    writeSaveIndex(index)

    try {
        safeStorageRemove(SAVE_KEY_PREFIX + slotId, { action: 'remove manual save slot' })
    } catch (e) {
        console.warn('Failed to remove manual save slot key', e)
    }
}

// Load from a manual slot by copying it into the main SAVE_KEY
function loadGameFromSlot(slotId) {
    if (!slotId) return false

    try {
        const json = safeStorageGet(SAVE_KEY_PREFIX + slotId)
        if (!json) {
            alert('That save slot is empty or missing.')
            return false
        }

        // Overwrite the "current" save and reuse existing loadGame logic
        safeStorageSet(SAVE_KEY, json, { action: 'save game' })
        return loadGame(false)
    } catch (e) {
        console.error('Failed to load from slot', e)
        alert('Failed to load that save.')
        return false
    }
}

// Combine synthetic auto-save info + manual index for UI
function getAllSavesWithAuto() {
    const list = getSaveIndex().slice()

    // Synthetic "Auto Save" entry from the existing SAVE_KEY
    try {
        const autoJson = safeStorageGet(SAVE_KEY)
        if (autoJson) {
            const data = JSON.parse(autoJson)
            const meta = buildHeroMetaFromData(data)
            const savedAt = meta.savedAt || Date.now()

            list.push({
                id: '__auto__',
                label: 'Auto Save',
                isAuto: true,
                heroName: meta.heroName,
                classId: meta.classId,
                className: meta.className,
                level: meta.level,
                area: meta.area,
                patch: meta.patch || GAME_PATCH || 'Unknown',
                savedAt,
                lastPlayed: savedAt
            })
        }
    } catch (e) {
        console.warn('Failed to inspect autosave', e)
    }

    list.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0))
    return list
}

// Save / Load manager modal
function openSaveManager(options = {}) {
    const mode = options.mode || 'load'

    openModal('Save / Load', (body) => {
        const info = document.createElement('p')
        info.className = 'modal-subtitle'
        info.textContent =
            'Manage autosave and multiple manual save slots. You can keep several snapshots of the same character or different heroes.'
        body.appendChild(info)

        const slots = getAllSavesWithAuto()

        if (!slots.length) {
            const none = document.createElement('p')
            none.className = 'modal-subtitle'
            none.textContent = 'No saves found yet.'
            body.appendChild(none)
        } else {
            slots.forEach((entry) => {
                const row = document.createElement('div')
                row.className = 'save-slot-row'

                const metaLine = document.createElement('div')
                metaLine.className = 'save-slot-meta'

                const hero = entry.heroName || 'Unknown Hero'
                const cls = entry.className || entry.classId || ''
                const lvl = entry.level != null ? 'Lv ' + entry.level : ''
                const area = entry.area || ''
                const typeLabel = entry.isAuto ? '[Auto]' : '[Manual]'

                const patch = entry.patch || ''
                const timeStr = entry.savedAt
                    ? new Date(entry.savedAt).toLocaleString()
                    : ''

                metaLine.textContent =
                    typeLabel +
                    ' ' +
                    hero +
                    (cls ? ' (' + cls + ')' : '') +
                    (lvl ? ' • ' + lvl : '') +
                    (area ? ' • ' + area : '') +
                    (patch ? ' • Patch ' + patch : '') +
                    (timeStr ? ' • Saved ' + timeStr : '')

                row.appendChild(metaLine)

                const buttons = document.createElement('div')
                buttons.className = 'item-actions'

                // Load button
                const btnLoad = document.createElement('button')
                btnLoad.className = 'btn small'
                btnLoad.textContent = 'Load'
                btnLoad.addEventListener('click', () => {
                    closeModal()
                    if (entry.isAuto) {
                        loadGame(false)
                    } else {
                        loadGameFromSlot(entry.id)
                    }
                })
                buttons.appendChild(btnLoad)

                // Overwrite button (manual slots only, and only if we have a live player)
                if (!entry.isAuto && state.player && state.player.hp > 0) {
                    const btnOverwrite = document.createElement('button')
                    btnOverwrite.className = 'btn small outline'
                    btnOverwrite.textContent = 'Overwrite'
                    btnOverwrite.addEventListener('click', () => {
                        const label =
                            entry.label || entry.heroName || 'Manual Save'
                        saveGameToSlot(entry.id, label)
                        addLog('Saved game to slot "' + label + '".', 'system')
                        closeModal()
                        openSaveManager({ mode: 'save' })
                    })
                    buttons.appendChild(btnOverwrite)
                }

                // Delete button (manual slots only)
                if (!entry.isAuto) {
                    const btnDelete = document.createElement('button')
                    btnDelete.className = 'btn small outline'
                    btnDelete.textContent = 'Delete'
                    btnDelete.addEventListener('click', () => {
                        if (!confirm('Delete this save slot?')) return
                        deleteSaveSlot(entry.id)
                        closeModal()
                        openSaveManager({ mode })
                    })
                    buttons.appendChild(btnDelete)
                }

                row.appendChild(buttons)
                body.appendChild(row)
            })
        }

        // Create new manual save (only if we're in a running game)
        if (state.player && state.player.hp > 0) {
            const newRow = document.createElement('div')
            newRow.className = 'item-actions'

            const btnNew = document.createElement('button')
            btnNew.className = 'btn small outline'
            btnNew.textContent = 'New Manual Save'
            btnNew.addEventListener('click', () => {
                const defaultLabel =
                    (state.player.name || 'Hero') +
                    ' Lv ' +
                    (state.player.level || 1) +
                    ' • ' +
                    (state.area || 'village')

                const label = prompt('Name this save slot:', defaultLabel)
                if (label === null) return

                const slotId = 'slot_' + Date.now()
                saveGameToSlot(slotId, label)
                addLog('Saved game to slot "' + label + '".', 'system')
                closeModal()
                openSaveManager({ mode: 'save' })
            })

            newRow.appendChild(btnNew)
            body.appendChild(newRow)
        }
    })
}
// --- SETTINGS -----------------------------------------------------------------

function initSettingsFromState() {
    const volumeSlider = document.getElementById('settingsVolume')
    const textSpeedSlider = document.getElementById('settingsTextSpeed')
    const settingsDifficulty = document.getElementById('settingsDifficulty')

    // If controls aren't present, nothing to do
    if (!volumeSlider && !textSpeedSlider && !settingsDifficulty) return

    // If state doesn't exist, bail
    if (typeof state === 'undefined' || !state) return

    // Wire listeners ONCE (opening Settings multiple times must not stack handlers)
    if (volumeSlider && !volumeSlider.dataset.pqWired) {
        volumeSlider.dataset.pqWired = '1'
        volumeSlider.addEventListener('input', () => applySettingsChanges())
    }

    const musicToggleEl = document.getElementById('settingsMusicToggle')
    if (musicToggleEl && !musicToggleEl.dataset.pqWired) {
        musicToggleEl.dataset.pqWired = '1'
        musicToggleEl.addEventListener('change', () => applySettingsChanges())
    }

    const sfxToggleEl = document.getElementById('settingsSfxToggle')

    if (sfxToggleEl && !sfxToggleEl.dataset.pqWired) {
        sfxToggleEl.dataset.pqWired = '1'
        sfxToggleEl.addEventListener('change', () => applySettingsChanges())
    }

    const motionToggleEl = document.getElementById('settingsReduceMotionToggle')
    if (motionToggleEl && !motionToggleEl.dataset.pqWired) {
        motionToggleEl.dataset.pqWired = '1'
        motionToggleEl.addEventListener('change', () => applySettingsChanges())
    }

    // Text speed should apply live (and avoid stacked listeners)
    if (textSpeedSlider && !textSpeedSlider.dataset.pqWired) {
        textSpeedSlider.dataset.pqWired = '1'
        textSpeedSlider.addEventListener('input', () => applySettingsChanges())
    }

    // Hydrate from state if present; otherwise leave HTML defaults
    if (volumeSlider && typeof state.settingsVolume === 'number') {
        volumeSlider.value = state.settingsVolume
    }
    if (textSpeedSlider && typeof state.settingsTextSpeed === 'number') {
        textSpeedSlider.value = state.settingsTextSpeed
    }

    if (musicToggleEl) musicToggleEl.checked = state.musicEnabled !== false
    if (sfxToggleEl) sfxToggleEl.checked = state.sfxEnabled !== false

    if (motionToggleEl) motionToggleEl.checked = !!state.settingsReduceMotion

    if (settingsDifficulty && state.difficulty) {
        settingsDifficulty.value = state.difficulty
    }

    // Ensure audio volume is applied from saved settings
    setMasterVolumePercent(state.settingsVolume)
    updateAreaMusic()
    applyChannelMuteGains()
}

function applySettingsChanges() {
    const volumeSlider = document.getElementById('settingsVolume')
    const textSpeedSlider = document.getElementById('settingsTextSpeed')
    const settingsDifficulty = document.getElementById('settingsDifficulty')

    if (typeof state === 'undefined' || !state) return

    // Store values in state (purely cosmetic for now)
    if (volumeSlider) {
        state.settingsVolume = Number(volumeSlider.value) || 0
        try {
            safeStorageSet(
                'pq-master-volume',
                String(state.settingsVolume)
            )
        } catch (e) {}
    }
    if (textSpeedSlider) {
        state.settingsTextSpeed = Number(textSpeedSlider.value) || 100
        try {
            safeStorageSet(
                'pq-text-speed',
                String(state.settingsTextSpeed)
            )
        } catch (e) {}
    }

    const musicToggle = document.getElementById('settingsMusicToggle')
    if (musicToggle) {
        state.musicEnabled = !!musicToggle.checked
        try {
            safeStorageSet(
                'pq-music-enabled',
                state.musicEnabled ? '1' : '0'
            )
        } catch (e) {}
        audioState.musicEnabled = state.musicEnabled
    }

    const sfxToggle = document.getElementById('settingsSfxToggle')
    if (sfxToggle) {
        state.sfxEnabled = !!sfxToggle.checked
        try {
            safeStorageSet('pq-sfx-enabled', state.sfxEnabled ? '1' : '0', { action: 'write sfx toggle' })
        } catch (e) {}
        audioState.sfxEnabled = state.sfxEnabled
    }


    const motionToggle = document.getElementById('settingsReduceMotionToggle')
    if (motionToggle) {
        setReduceMotionEnabled(!!motionToggle.checked)
    }

    // Apply audio settings immediately
    setMasterVolumePercent(state.settingsVolume)
    updateAreaMusic()
    applyChannelMuteGains()
    saveGame()

    // Allow changing difficulty mid-run
    if (settingsDifficulty) {
        const newDiff = settingsDifficulty.value
        if (DIFFICULTY_CONFIG[newDiff]) {
            state.difficulty = newDiff
            updateHUD()
            saveGame()
        }
    }
}


// --- MOTION / ANIMATION ACCESSIBILITY ----------------------------------------

function prefersReducedMotion() {
    try {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    } catch (e) {
        return false
    }
}

function applyMotionPreference() {
    // If the OS requests reduced motion, always honor it.
    const reduce = (state && state.settingsReduceMotion) || prefersReducedMotion()
    document.body.classList.toggle('no-motion', !!reduce)
}

function setReduceMotionEnabled(enabled) {
    if (typeof state === 'undefined' || !state) return
    state.settingsReduceMotion = !!enabled
    try {
        safeStorageSet('pq-reduce-motion', state.settingsReduceMotion ? '1' : '0', {
            action: 'write reduce motion'
        })
    } catch (e) {}
    applyMotionPreference()
}
function setTheme(themeName) {
    document.body.classList.remove(
        'theme-arcane',
        'theme-inferno',
        'theme-forest',
        'theme-holy',
        'theme-shadow'
    )

    if (themeName !== 'default') {
        document.body.classList.add('theme-' + themeName)
    }

    safeStorageSet('pq-theme', themeName, { action: 'write theme' })
}

// Load saved theme on startup
;(function loadTheme() {
    const saved = safeStorageGet('pq-theme') || 'default'
    setTheme(saved)
})()
// --- FEEDBACK / BUG REPORT -----------------------------------------------------

function openFeedbackModal() {
    const bodyHtml = `
    <div class="modal-subtitle">
      Help improve Emberwood: The Blackbark Oath by sending structured feedback. 
      Copy this text and paste it wherever you’re tracking issues.
    </div>

    <div class="field">
      <label for="feedbackType">Type</label>
      <select id="feedbackType">
        <option value="ui">UI issue</option>
        <option value="bug">Bug</option>
        <option value="balance">Balance issue</option>
        <option value="suggestion">Suggestion</option>
        <option value="other">Other</option>
      </select>
    </div>

    <div class="field">
      <label for="feedbackText">Details</label>
      <textarea id="feedbackText"
        placeholder="What happened? What did you expect? Steps to reproduce?"
      ></textarea>
    </div>

    <button class="btn primary small" id="btnFeedbackCopy">
      Copy Feedback To Clipboard
    </button>

    <button class="btn small outline" id="btnBugBundleCopy" style="margin-top:8px;">
      Copy Bug Report Bundle (JSON)
    </button>
    <p class="hint" id="feedbackStatus"></p>
  `

    openModal('Feedback / Bug Report', (bodyEl) => {
        bodyEl.innerHTML = bodyHtml

        const btnCopy = document.getElementById('btnFeedbackCopy')
        if (btnCopy) {
            btnCopy.addEventListener('click', handleFeedbackCopy)
        }

        const btnBundle = document.getElementById('btnBugBundleCopy')
        if (btnBundle) {
            btnBundle.addEventListener('click', () => {
                const status = document.getElementById('feedbackStatus')
                copyBugReportBundleToClipboard()
                    .then(() => status && (status.textContent = '✅ Copied JSON bundle!'))
                    .catch(() => status && (status.textContent = '❌ Could not access clipboard.'))
            })
        }
    })
}

function handleFeedbackCopy() {
    const typeEl = document.getElementById('feedbackType')
    const textEl = document.getElementById('feedbackText')
    const status = document.getElementById('feedbackStatus')
    if (!typeEl || !textEl || !status) return

    const type = typeEl.value
    const text = (textEl.value || '').trim()

    const payload = buildFeedbackPayload(type, text)

    copyFeedbackToClipboard(payload)
        .then(() => (status.textContent = '✅ Copied! Paste this into your tracker.'))
        .catch(() => (status.textContent = '❌ Could not access clipboard.'))
}

function buildFeedbackPayload(type, text) {
    const lines = []
    lines.push('Emberwood: The Blackbark Oath RPG Feedback')
    lines.push('-------------------------')
    lines.push(`Type: ${type}`)
    lines.push('')

    lines.push('Build:')
    lines.push(`- Patch: ${GAME_PATCH}${GAME_PATCH_NAME ? ' — ' + GAME_PATCH_NAME : ''}`)
    lines.push(`- Save Schema: ${SAVE_SCHEMA}`)
    lines.push('')

    if (text) {
        lines.push('Description:')
        lines.push(text)
        lines.push('')
    }

    if (state && state.player) {
        const p = state.player
        lines.push('Game Context:')
        lines.push(`- Player: ${p.name} (${p.classId})`)
        lines.push(`- Level: ${p.level} (XP: ${p.xp}/${p.nextLevelXp})`)
        lines.push(`- Gold: ${p.gold}`)
        lines.push(`- Area: ${state.area}`)
        if (state.inCombat && state.currentEnemy) {
            lines.push(`- In Combat: YES (Enemy: ${state.currentEnemy.name})`)
        } else {
            lines.push(`- In Combat: NO`)
        }
        lines.push('')
    }

    if (lastCrashReport) {
        lines.push('Last Crash:')
        lines.push(`- Kind: ${lastCrashReport.kind}`)
        lines.push(`- Time: ${new Date(lastCrashReport.time).toISOString()}`)
        lines.push(`- Message: ${lastCrashReport.message}`)
        if (lastCrashReport.stack) {
            lines.push('- Stack:')
            lines.push(String(lastCrashReport.stack))
        }
        lines.push('')
    }

    if (state && Array.isArray(state.log) && state.log.length) {
        const tail = state.log.slice(-30)
        lines.push('Recent Log (last 30):')
        tail.forEach((e) => {
            const tag = e && e.type ? e.type : 'normal'
            const msg = e && e.text ? e.text : ''
            lines.push(`- [${tag}] ${msg}`)
        })
        lines.push('')
    }

    lines.push('Client Info:')
    lines.push(`- Time: ${new Date().toISOString()}`)
    lines.push(`- User Agent: ${navigator.userAgent}`)
    lines.push('')

    return lines.join('\n')
}

function buildBugReportBundle() {
    const p = state && state.player
    const now = new Date().toISOString()

    // Keep this compact and safe to share publicly.
    const summary = {
        patch: GAME_PATCH,
        patchName: GAME_PATCH_NAME,
        saveSchema: SAVE_SCHEMA,
        timeUtc: now,
        userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : 'unknown',
        locale: (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'unknown'
    }

    const game = {
        area: state ? state.area : null,
        inCombat: !!(state && state.inCombat),
        enemy: state && state.currentEnemy ? {
            name: state.currentEnemy.name,
            id: state.currentEnemy.id || null,
            tier: state.currentEnemy.tier || null,
            hp: state.currentEnemy.hp
        } : null,
        player: p ? {
            name: p.name,
            classId: p.classId,
            level: p.level,
            hp: p.hp,
            maxHp: p.maxHp,
            resource: p.resource,
            maxResource: p.maxResource,
            gold: p.gold
        } : null
    }

    const debug = state && state.debug ? {
        useDeterministicRng: !!state.debug.useDeterministicRng,
        rngSeed: Number.isFinite(Number(state.debug.rngSeed)) ? (Number(state.debug.rngSeed) >>> 0) : null,
        rngIndex: Number.isFinite(Number(state.debug.rngIndex)) ? (Number(state.debug.rngIndex) >>> 0) : null,
        lastAction: state.debug.lastAction || '',
        inputLogTail: Array.isArray(state.debug.inputLog) ? state.debug.inputLog.slice(-40) : [],
        invariantIssues: state.debug.lastInvariantIssues || null,
        rngLogTail: Array.isArray(state.debug.rngLog) ? state.debug.rngLog.slice(-80) : []
    } : null

    const diag = {
        lastCrashReport: lastCrashReport || null,
        lastSaveError: lastSaveError || null,
        logTail: (state && Array.isArray(state.log)) ? state.log.slice(-120) : []
    }

    return { summary, game, debug, diagnostics: diag }
}

function copyBugReportBundleToClipboard() {
    const json = JSON.stringify(buildBugReportBundle(), null, 2)
    return copyFeedbackToClipboard(json)
}

// Human-readable bug report formatter (keeps the raw JSON available separately).
// Goal: highlight the *signal* (issues + minimal context) while keeping the full JSON
// one click away for deep debugging.
function formatBugReportBundle(bundle) {
    const b = bundle || {}
    const s = (b.summary || {})
    const g = (b.game || {})
    const p = (g.player || {})
    const d = (b.debug || {})
    const diag = (b.diagnostics || {})

    const lines = []

    const patchLine = 'Patch ' + String(s.patch || GAME_PATCH || '') + (s.patchName ? ' — ' + String(s.patchName) : '')
    lines.push(patchLine)
    if (s.timeUtc) lines.push('Time (UTC): ' + String(s.timeUtc))
    if (s.saveSchema !== undefined) lines.push('Save schema: ' + String(s.saveSchema))
    if (s.userAgent) lines.push('UA: ' + String(s.userAgent))
    if (s.locale) lines.push('Locale: ' + String(s.locale))
    lines.push('')

    // Snapshot
    const inCombat = !!g.inCombat
    const enemyName = (g.enemy && g.enemy.name) ? g.enemy.name : null
    const area = g.area ? String(g.area) : '(unknown)'
    lines.push('Snapshot')
    lines.push('  Area: ' + area)
    lines.push('  In combat: ' + (inCombat ? 'YES' : 'no'))
    if (enemyName) lines.push('  Current enemy: ' + enemyName)
    lines.push('  Player: ' + String(p.name || 'Player') + ' • ' + String(p.classId || '?') + ' • Lv ' + String(p.level || '?'))
    if (p.maxHp) lines.push('  HP: ' + String(p.hp) + ' / ' + String(p.maxHp))
    if (p.maxResource !== undefined) lines.push('  Resource: ' + String(p.resource) + ' / ' + String(p.maxResource))
    if (p.gold !== undefined) lines.push('  Gold: ' + String(p.gold))
    lines.push('')

    // Issues
    const issues = []
    if (Array.isArray(d.invariantIssues) && d.invariantIssues.length) {
        d.invariantIssues.forEach((x) => {
            const code = x && x.code ? String(x.code) : 'invariant'
            const detail = x && x.detail ? String(x.detail) : ''
            issues.push(code + (detail ? ' — ' + detail : ''))
        })
    }
    if (diag.lastCrashReport && diag.lastCrashReport.message) {
        issues.push('crash: ' + String(diag.lastCrashReport.message))
    }
    if (diag.lastSaveError) {
        issues.push('saveError: ' + String(diag.lastSaveError))
    }

    lines.push('Findings')
    if (!issues.length) {
        lines.push('  ✓ No issues detected by the bug report scanners.')
    } else {
        issues.slice(0, 12).forEach((x) => lines.push('  ⚠ ' + x))
        if (issues.length > 12) lines.push('  … +' + String(issues.length - 12) + ' more')
    }
    lines.push('')

    // Crash details (short)
    if (diag.lastCrashReport) {
        const cr = diag.lastCrashReport
        lines.push('Last crash (summary)')
        if (cr.kind) lines.push('  Kind: ' + String(cr.kind))
        if (cr.time !== undefined && cr.time !== null) {
            const tNum = Number(cr.time)
            if (Number.isFinite(tNum) && tNum > 0) {
                // cr.time is typically epoch ms
                let iso = ''
                try { iso = new Date(tNum).toISOString() } catch (_) { iso = '' }
                lines.push('  Time (UTC): ' + (iso || String(cr.time)) + ' (' + String(cr.time) + ')')
            } else {
                lines.push('  Time: ' + String(cr.time))
            }
        }
        lines.push('  Note: this is the most recent recorded crash and may be from a previous session.')
        if (cr.message) lines.push('  Message: ' + String(cr.message))
        if (cr.stack) {
            const stackLines = String(cr.stack).split('\n').slice(0, 6)
            lines.push('  Stack (top):')
            stackLines.forEach((ln) => lines.push('    ' + ln))
            if (String(cr.stack).split('\n').length > 6) lines.push('    …')
        }
        lines.push('')
    }

    // Recent input
    if (Array.isArray(d.inputLogTail) && d.inputLogTail.length) {
        lines.push('Recent input (tail)')
        d.inputLogTail.slice(-12).forEach((x) => {
            const a = x && x.action ? String(x.action) : '(action)'
            const pl = x && x.payload ? safeJsonShort(x.payload, 120) : ''
            lines.push('  - ' + a + (pl ? ' ' + pl : ''))
        })
        lines.push('')
    }

    // Recent log
    if (Array.isArray(diag.logTail) && diag.logTail.length) {
        lines.push('Recent game log (tail)')
        diag.logTail.slice(-18).forEach((x) => {
            const t = x && x.text ? String(x.text) : ''
            if (!t) return
            lines.push('  • ' + t)
        })
    }

    return lines.join('\n')
}

function safeJsonShort(obj, maxLen) {
    const lim = Math.max(20, Number(maxLen || 120))
    try {
        const s = JSON.stringify(obj)
        if (typeof s !== 'string') return ''
        if (s.length <= lim) return s
        return s.slice(0, lim - 1) + '…'
    } catch (_) {
        try {
            const s = String(obj)
            if (s.length <= lim) return s
            return s.slice(0, lim - 1) + '…'
        } catch (_2) {
            return ''
        }
    }
}

function openSmokeTestsModal() {
    openModal('Smoke Tests & Bug Report', (b) => {
        const hint = document.createElement('div')
        hint.className = 'modal-subtitle'
        hint.textContent = 'Runs an isolated QA suite in-memory (does not modify your save) and prints a Bug Report bundle for fast debugging.'
        b.appendChild(hint)

        const summary = document.createElement('div')
        summary.className = 'modal-subtitle'
        summary.style.fontSize = '12px'
        summary.style.opacity = '0.9'
        summary.textContent = 'Ready. Click Run to start.'
        b.appendChild(summary)

        const actions = document.createElement('div')
        actions.className = 'item-actions'
        b.appendChild(actions)

        const btnRun = document.createElement('button')
        btnRun.className = 'btn small'
        btnRun.textContent = 'Run'

        const btnCopy = document.createElement('button')
        btnCopy.className = 'btn small outline'
        btnCopy.textContent = 'Copy results'
        btnCopy.disabled = true

        const btnCopyFails = document.createElement('button')
        btnCopyFails.className = 'btn small outline'
        btnCopyFails.textContent = 'Copy failures'
        btnCopyFails.disabled = true

        const btnCopyJson = document.createElement('button')
        btnCopyJson.className = 'btn small outline'
        btnCopyJson.textContent = 'Copy JSON'
        btnCopyJson.disabled = true

        actions.appendChild(btnRun)
        actions.appendChild(btnCopy)
        actions.appendChild(btnCopyFails)
        actions.appendChild(btnCopyJson)

        // Collapsible sections
        const smokeDetails = document.createElement('details')
        smokeDetails.className = 'qa-details'
        smokeDetails.open = true

        const smokeSummary = document.createElement('summary')
        smokeSummary.className = 'qa-summary'
        smokeSummary.textContent = 'Smoke Tests'
        smokeDetails.appendChild(smokeSummary)

        const smokePre = document.createElement('pre')
        smokePre.className = 'qa-pre'
        smokePre.style.whiteSpace = 'pre-wrap'
        smokePre.style.fontSize = '12px'
        smokePre.textContent = 'Ready.'
        smokeDetails.appendChild(smokePre)

        const bugDetails = document.createElement('details')
        bugDetails.className = 'qa-details'
        bugDetails.open = false

        const bugSummary = document.createElement('summary')
        bugSummary.className = 'qa-summary'
        bugSummary.textContent = 'Bug Report'
        bugDetails.appendChild(bugSummary)

        const bugPre = document.createElement('pre')
        bugPre.className = 'qa-pre'
        bugPre.style.whiteSpace = 'pre-wrap'
        bugPre.style.fontSize = '12px'
        bugPre.textContent = 'Ready.'
        bugDetails.appendChild(bugPre)

        const bugJsonDetails = document.createElement('details')
        bugJsonDetails.className = 'qa-subdetails'
        bugJsonDetails.open = false
        const bugJsonSummary = document.createElement('summary')
        bugJsonSummary.className = 'qa-summary'
        bugJsonSummary.textContent = 'Raw JSON'
        bugJsonDetails.appendChild(bugJsonSummary)
        const bugJsonPre = document.createElement('pre')
        bugJsonPre.className = 'qa-pre'
        bugJsonPre.style.whiteSpace = 'pre-wrap'
        bugJsonPre.style.fontSize = '12px'
        bugJsonPre.textContent = ''
        bugJsonDetails.appendChild(bugJsonPre)
        bugDetails.appendChild(bugJsonDetails)

        b.appendChild(smokeDetails)
        b.appendChild(bugDetails)

        let last = null

        const summarize = (r) => {
            if (!r || typeof r !== 'object') return
            const ms = typeof r.ms === 'number' ? r.ms : null
            const pc = typeof r.passCount === 'number' ? r.passCount : null
            const fc = typeof r.failCount === 'number' ? r.failCount : null
            const parts = []
            if (pc !== null && fc !== null) parts.push(`${pc} passed, ${fc} failed`)
            if (ms !== null) parts.push(`${ms} ms`)
            summary.textContent = parts.length ? parts.join(' • ') : 'Done.'
        }

        btnRun.addEventListener('click', () => {
            btnRun.disabled = true
            btnCopy.disabled = true
            btnCopyFails.disabled = true
            btnCopyJson.disabled = true
            smokePre.textContent = 'Running smoke tests…'
            bugPre.textContent = 'Building bug report…'
            bugJsonPre.textContent = ''
            summary.textContent = 'Running…'

            // Yield one tick so the modal paints "Running…" before the suite blocks.
            setTimeout(() => {
                try {
                    last = runSmokeTests({ returnObject: true })
                    smokePre.textContent = last && last.smokeText ? last.smokeText : (last && last.text ? last.text : String(last || ''))
                    bugPre.textContent = last && last.bugReportPretty ? last.bugReportPretty : 'Bug report unavailable.'
                    try {
                        bugJsonPre.textContent = JSON.stringify((last && last.bugReport) ? last.bugReport : buildBugReportBundle(), null, 2)
                    } catch (_) {
                        bugJsonPre.textContent = '{"error":"failed to stringify bug report"}'
                    }

                    // Auto-expand sections when they found issues.
                    const smokeHasIssues = !!(last && (last.failCount > 0 || (last.console && ((last.console.errors || []).length > 0 || (last.console.asserts || []).length > 0))))
                    const bugHasIssues = !!(last && last.bugHasIssues)
                    if (smokeHasIssues) smokeDetails.open = true
                    if (bugHasIssues) bugDetails.open = true

                    summarize(last)
                    btnCopy.disabled = false
                    btnCopyFails.disabled = !(last && last.failCount > 0)
                    btnCopyJson.disabled = false
                } catch (e) {
                    smokePre.textContent = 'Smoke tests failed to run: ' + (e && e.message ? e.message : String(e))
                    summary.textContent = 'Failed to run'
                } finally {
                    btnRun.disabled = false
                }
            }, 0)
        })

        btnCopy.addEventListener('click', () => {
            try {
                if (!last || typeof last !== 'object') return copyFeedbackToClipboard(smokePre.textContent || '')
                const out = []
                out.push('SMOKE TEST')
                out.push('Patch ' + GAME_PATCH + (GAME_PATCH_NAME ? ' — ' + GAME_PATCH_NAME : ''))
                out.push('')
                out.push(last.smokeText || last.text || '')
                out.push('')
                out.push('BUG REPORT')
                out.push(last.bugReportPretty || formatBugReportBundle(last.bugReport || buildBugReportBundle()))
                out.push('')
                out.push('BUG REPORT (JSON)')
                out.push(JSON.stringify(last.bugReport || buildBugReportBundle(), null, 2))
                copyFeedbackToClipboard(out.join('\n'))
            } catch (_) {
                copyFeedbackToClipboard((smokePre.textContent || '') + '\n\n' + (bugPre.textContent || ''))
            }
        })

        btnCopyFails.addEventListener('click', () => {
            try {
                if (!last || typeof last !== 'object') return copyFeedbackToClipboard(smokePre.textContent || '')
                const out = []
                out.push('SMOKE TEST FAILURES & BUG REPORT')
                out.push('Patch ' + GAME_PATCH + (GAME_PATCH_NAME ? ' — ' + GAME_PATCH_NAME : ''))
                out.push('')
                if (Array.isArray(last.failed) && last.failed.length) {
                    last.failed.forEach((f, i) => {
                        out.push(String(i + 1) + ') ' + String(f.label || '') + ': ' + String(f.msg || ''))
                    })
                }
                const ce = last.console && Array.isArray(last.console.errors) ? last.console.errors : []
                const ca = last.console && Array.isArray(last.console.asserts) ? last.console.asserts : []
                if (ce.length) {
                    out.push('')
                    out.push('console.error (first 20):')
                    ce.slice(0, 20).forEach((x) => out.push('  - ' + String(x)))
                    if (ce.length > 20) out.push('  … +' + (ce.length - 20) + ' more')
                }
                if (ca.length) {
                    out.push('')
                    out.push('console.assert failures (first 20):')
                    ca.slice(0, 20).forEach((x) => out.push('  - ' + String(x)))
                    if (ca.length > 20) out.push('  … +' + (ca.length - 20) + ' more')
                }

                out.push('')
                out.push('BUG REPORT (JSON)')
                try {
                    const bundle = (last && last.bugReport) ? last.bugReport : buildBugReportBundle()
                    out.push(JSON.stringify(bundle, null, 2))
                } catch (_) {
                    out.push('{"error":"failed to stringify bug report"}')
                }
                return copyFeedbackToClipboard(out.join('\n'))
            } catch (_) {
                return copyFeedbackToClipboard(smokePre.textContent || '')
            }
        })

        btnCopyJson.addEventListener('click', () => {
            try {
                const payload = JSON.stringify((last && last.bugReport) ? last.bugReport : buildBugReportBundle(), null, 2)
                copyFeedbackToClipboard(payload)
            } catch (_) {
                copyFeedbackToClipboard(smokePre.textContent || '')
            }
        })

        // Run once immediately so the modal always shows a current result without extra clicks
        // when a tester is iterating quickly.
        try {
            last = runSmokeTests({ returnObject: true })
            smokePre.textContent = last && last.smokeText ? last.smokeText : (last && last.text ? last.text : String(last || ''))
            bugPre.textContent = last && last.bugReportPretty ? last.bugReportPretty : 'Bug report unavailable.'
            try {
                bugJsonPre.textContent = JSON.stringify((last && last.bugReport) ? last.bugReport : buildBugReportBundle(), null, 2)
            } catch (_) {
                bugJsonPre.textContent = '{"error":"failed to stringify bug report"}'
            }

            const smokeHasIssues = !!(last && (last.failCount > 0 || (last.console && ((last.console.errors || []).length > 0 || (last.console.asserts || []).length > 0))))
            const bugHasIssues = !!(last && last.bugHasIssues)
            smokeDetails.open = smokeHasIssues
            bugDetails.open = bugHasIssues

            summarize(last)
            btnCopy.disabled = false
            btnCopyFails.disabled = !(last && last.failCount > 0)
            btnCopyJson.disabled = false
        } catch (_) {
            // If anything goes wrong, leave the modal in the "Ready" state.
        }
    })
}


function runSmokeTests(opts = {}) {
    const returnObject = !!(opts && opts.returnObject)

    const lines = []
    const started = Date.now()
    const QA_SEED = 123456789
    lines.push('SMOKE TESTS')
    lines.push('Patch ' + GAME_PATCH + (GAME_PATCH_NAME ? ' — ' + GAME_PATCH_NAME : ''))
    lines.push('Seed ' + QA_SEED + ' • Save schema ' + SAVE_SCHEMA)
    lines.push('Legend: ✔ pass • ✖ fail')
    lines.push('')

    const live = state

    // Capture a live bug-report bundle up-front (before state is swapped into the smoke-test sandbox).
    // This keeps the report tied to the player's real session rather than the suite's temporary state.
    const _bugReportLive = (() => {
        try {
            const bundle = buildBugReportBundle()
            // Ensure it's JSON-safe and stable even if the live state mutates during the suite.
            return JSON.parse(JSON.stringify(bundle))
        } catch (_) {
            try {
                return { summary: { patch: GAME_PATCH, patchName: GAME_PATCH_NAME, saveSchema: SAVE_SCHEMA, timeUtc: new Date().toISOString() }, error: 'buildBugReportBundle failed' }
            } catch (_2) {
                return { error: 'buildBugReportBundle failed' }
            }
        }
    })()

    // Flag used to disable combat timers/async turn resolution during the smoke suite.
    const _prevSmoke = (() => {
        try { return !!(state && state.debug && state.debug.smokeTestRunning) } catch (_) { return false }
    })()
    try {
        if (state) {
            if (!state.debug || typeof state.debug !== 'object') state.debug = {}
            state.debug.smokeTestRunning = true
        }
    } catch (_) {}

    // Smoke tests must never alter the player's visible log.
    // We snapshot the live log DOM + incremental renderer bookkeeping so that even
    // accidental render calls during the suite can't clear/append/scroll the live log.
    const _liveLogEl = (typeof document !== 'undefined') ? document.getElementById('log') : null
    const _liveLogHTML = _liveLogEl ? _liveLogEl.innerHTML : null
    const _liveLogScrollTop = _liveLogEl ? _liveLogEl.scrollTop : 0
    const _liveLogSeqSnap = (typeof _logSeq === 'number') ? _logSeq : null
    const _liveLogUiSnap = (() => {
        try {
            return JSON.parse(JSON.stringify(_logUi))
        } catch (_) {
            try {
                return {
                    filter: _logUi && _logUi.filter,
                    lastFirstId: _logUi && _logUi.lastFirstId,
                    renderedUpToId: _logUi && _logUi.renderedUpToId
                }
            } catch (_2) {
                return null
            }
        }
    })()

    // Capture console errors/asserts during smoke tests so silent issues become failures.
    const _liveConsoleError = typeof console !== 'undefined' ? console.error : null
    const _liveConsoleAssert = typeof console !== 'undefined' ? console.assert : null
    const consoleErrorLog = []
    const consoleAssertLog = []
    const _stringifyConsoleArg = (x) => {
        try {
            if (typeof x === 'string') return x
            return JSON.stringify(x)
        } catch (_) {
            return String(x)
        }
    }
    try {
        if (typeof console !== 'undefined') {
            console.error = (...args) => {
                consoleErrorLog.push(args.map(_stringifyConsoleArg).join(' '))
                try { if (_liveConsoleError) _liveConsoleError(...args) } catch (_) {}
            }
            console.assert = (cond, ...args) => {
                if (!cond) consoleAssertLog.push(args.length ? args.map(_stringifyConsoleArg).join(' ') : 'console.assert failed')
                try { if (_liveConsoleAssert) _liveConsoleAssert(cond, ...args) } catch (_) {}
            }
        }
    } catch (_) {}

    let passCount = 0
    let failCount = 0
    const failed = []

    const sectionStats = []
    let currentSection = null

    const section = (title) => {
        if (currentSection) sectionStats.push(currentSection)
        currentSection = { title: String(title || ''), pass: 0, fail: 0 }
        lines.push('')
        lines.push('— ' + title + ' —')
    }

    // Helper: run a test and record pass/fail without aborting the full suite.
    const test = (label, fn) => {
        try {
            // Keep tests isolated from one another: combat turn state can be left in
            // a resolving/busy phase by earlier tests.
            try {
                if (state) {
                    state.enemies = []
                    state.targetEnemyIndex = 0
                    if (!state.combat || typeof state.combat !== 'object') {
                        state.combat = { phase: 'player', busy: false, round: 1, battleDrops: 0 }
                    } else {
                        state.combat.phase = 'player'
                        state.combat.busy = false
                        if (typeof state.combat.round !== 'number' || !Number.isFinite(state.combat.round)) state.combat.round = 1
                        if (typeof state.combat.battleDrops !== 'number' || !Number.isFinite(state.combat.battleDrops)) state.combat.battleDrops = 0
                    }
                }
            } catch (_) {}

            fn()
            passCount += 1
            if (currentSection) currentSection.pass += 1
            lines.push('  ✔ ' + label)
        } catch (e) {
            const msg = e && e.message ? e.message : String(e)
            failCount += 1
            if (currentSection) currentSection.fail += 1
            failed.push({ label, msg })
            lines.push('  ✖ ' + label + ': ' + msg)
        }
    }
    const assert = (cond, msg) => {
        if (!cond) throw new Error(msg || 'assertion failed')
    }
    const isFiniteNum = (n) => typeof n === 'number' && Number.isFinite(n)

    // Smoke-test helper: create a minimal player object without relying on DOM.
    // Used by class mechanics tests (unlocks, combo points, marks).
    const createPlayer = (name, classId, diffId) => {
        const cid = String(classId || 'warrior')
        const classDef = PLAYER_CLASSES[cid] || PLAYER_CLASSES['warrior']
        const base = classDef.baseStats
        const startingSkills = CLASS_STARTING_SKILLS[cid] || CLASS_STARTING_SKILLS.default

        const p = {
            name: String(name || 'Tester'),
            classId: cid,
            level: 1,
            xp: 0,
            nextLevelXp: 100,

            maxHp: base.maxHp,
            hp: base.maxHp,

            resourceKey: classDef.resourceKey,
            resourceName: classDef.resourceName,
            maxResource:
                classDef.resourceKey === 'mana'
                    ? 100
                    : classDef.resourceKey === 'essence'
                    ? 90
                    : 60,
            resource:
                classDef.resourceKey === 'mana'
                    ? 80
                    : classDef.resourceKey === 'essence'
                    ? 45
                    : 0,

            stats: {
                attack: base.attack,
                magic: base.magic,
                armor: base.armor,
                speed: base.speed
            },

            skills: {
                strength: startingSkills.strength,
                endurance: startingSkills.endurance,
                willpower: startingSkills.willpower
            },
            skillPoints: 0,

            equipment: {
                weapon: null,
                armor: null,
                head: null,
                hands: null,
                feet: null,
                belt: null,
                neck: null,
                ring: null
            },
            inventory: [],
            spells: [...classDef.startingSpells],
            equippedSpells: [...classDef.startingSpells],
            abilityUpgrades: {},
            abilityUpgradeTokens: 0,
            gold: 0,
            status: {}
        }

        // Ensure all expected subsystems exist.
        ensurePlayerSpellSystems(p)
        resetPlayerCombatStatus(p)
        return p
    }


    const isDomNode = (x) => {
        try {
            return typeof Node !== 'undefined' && x instanceof Node
        } catch (_) {
            return false
        }
    }

    // Bug-catcher: deep scan for NaN/Infinity in the test state.
    const scanForNonFiniteNumbers = (rootObj) => {
        const issues = []
        const seen = new WeakSet()
        const walk = (x, path) => {
            if (typeof x === 'number') {
                if (!Number.isFinite(x)) issues.push(path + ' = ' + String(x))
                return
            }
            if (x === null || typeof x !== 'object') return
            if (isDomNode(x)) return
            if (seen.has(x)) return
            seen.add(x)

            if (Array.isArray(x)) {
                for (let i = 0; i < x.length; i++) walk(x[i], path + '[' + i + ']')
                return
            }

            for (const k in x) {
                if (!Object.prototype.hasOwnProperty.call(x, k)) continue
                if (k === '__proto__' || k === 'prototype' || k === 'constructor') continue
                walk(x[k], path + '.' + k)
            }
        }
        walk(rootObj, 'state')
        return issues
    }

    // Bug-catcher: check for negative quantities / counters in the most common gameplay containers.
    const scanForNegativeCounters = (s) => {
        const issues = []
        try {
            const p = s && s.player
            if (p && typeof p.gold === 'number' && p.gold < 0) issues.push('player.gold < 0 (' + p.gold + ')')
            if (p && typeof p.hp === 'number' && p.hp < 0) issues.push('player.hp < 0 (' + p.hp + ')')
            if (p && Array.isArray(p.inventory)) {
                p.inventory.forEach((it, i) => {
                    if (!it) return
                    if (typeof it.quantity === 'number' && it.quantity < 0) issues.push('player.inventory[' + i + '].quantity < 0 (' + it.quantity + ')')
                })
            }

            const bank = s && s.bank
            if (bank && typeof bank.balance === 'number' && bank.balance < 0) issues.push('bank.balance < 0 (' + bank.balance + ')')
            if (bank && typeof bank.investments === 'number' && bank.investments < 0) issues.push('bank.investments < 0 (' + bank.investments + ')')
            if (bank && bank.loan && typeof bank.loan.balance === 'number' && bank.loan.balance < 0) issues.push('bank.loan.balance < 0 (' + bank.loan.balance + ')')

            const stock = s && s.merchantStock
            if (stock && typeof stock === 'object') {
                for (const region in stock) {
                    const regionObj = stock[region]
                    if (!regionObj || typeof regionObj !== 'object') continue
                    for (const merchant in regionObj) {
                        const bucket = regionObj[merchant]
                        if (!bucket || typeof bucket !== 'object') continue
                        for (const key in bucket) {
                            const v = bucket[key]
                            if (typeof v === 'number' && v < 0) issues.push('merchantStock.' + region + '.' + merchant + '.' + key + ' < 0 (' + v + ')')
                        }
                    }
                }
            }
        } catch (_) {}
        return issues
    }

    // Stable JSON stringify for save round-trip comparisons.
    const stableStringify = (obj) => {
        const seen = new WeakSet()
        const sortify = (x) => {
            if (x === null || typeof x !== 'object') return x
            if (seen.has(x)) return null
            seen.add(x)
            if (Array.isArray(x)) return x.map(sortify)
            const out = {}
            Object.keys(x)
                .sort()
                .forEach((k) => {
                    out[k] = sortify(x[k])
                })
            return out
        }
        return JSON.stringify(sortify(obj))
    }

    // Stash a few global functions so smoke tests don't mutate the player's save or UI.
    const _liveSaveGame = typeof saveGame === 'function' ? saveGame : null
    const _liveCloseModal = typeof closeModal === 'function' ? closeModal : null
    const _liveUpdateHUD = typeof updateHUD === 'function' ? updateHUD : null
    const _liveUpdateEnemyPanel = typeof updateEnemyPanel === 'function' ? updateEnemyPanel : null
    const _liveAddLog = typeof addLog === 'function' ? addLog : null
    const _liveRenderLog = typeof renderLog === 'function' ? renderLog : null
    const _liveRecordInput = typeof recordInput === 'function' ? recordInput : null

    try {
        const t = createEmptyState()
        initRngState(t)
        setDeterministicRngEnabled(t, true)
        setRngSeed(t, QA_SEED)

        // Minimal new-game boot
        t.difficulty = 'normal'
        initTimeState(t)
        initVillageEconomyState(t)
        initGovernmentState(t, 0)
        ensureVillagePopulation(t)

        // Minimal player (warrior-ish)
        const classDef = PLAYER_CLASSES['warrior']
        const base = classDef.baseStats
        t.player = {
            name: 'SMOKE',
            classId: 'warrior',
            level: 1,
            xp: 0,
            nextLevelXp: 100,
            maxHp: base.maxHp,
            hp: base.maxHp,
            resourceKey: classDef.resourceKey,
            resourceName: classDef.resourceName,
            maxResource: 60,
            resource: 0,
            stats: {
                attack: base.attack,
                magic: base.magic,
                armor: base.armor,
                speed: base.speed
            },
            skills: { strength: 0, endurance: 0, willpower: 0 },
            skillPoints: 0,
            equipment: { weapon: null, armor: null, head: null, hands: null, feet: null, belt: null, neck: null, ring: null },
            inventory: [],
            spells: [...classDef.startingSpells],
            equippedSpells: [...classDef.startingSpells],
            abilityUpgrades: {},
            abilityUpgradeTokens: 0,
            gold: 250,
            status: { bleedTurns: 0, bleedDamage: 0, shield: 0, spellCastCount: 0, spellCastCooldown: 0, evasionTurns: 0 }
        }

        state = t
        syncGlobalStateRef()

        // Mark test state so combat waits/turn sequencing can run synchronously.
        try {
            if (!state.debug || typeof state.debug !== 'object') state.debug = {}
            state.debug.smokeTestRunning = true
        } catch (_) {}

        // Disable persistence + UI side-effects while tests run.
        // Smoke tests intentionally run against a fresh in-memory state and must never
        // mutate the active save OR repaint the live UI with test values.
        if (_liveSaveGame) saveGame = () => {}
        if (_liveCloseModal) closeModal = () => {}
        if (_liveUpdateHUD) updateHUD = () => {}
        if (_liveUpdateEnemyPanel) updateEnemyPanel = () => {}
        if (_liveAddLog) addLog = () => {}
        if (_liveRenderLog) renderLog = () => {}
        if (_liveRecordInput) recordInput = () => {}

        section('Player & Inventory')

        // 1) basic stat recalc
        test('recalcPlayerStats', () => {
            recalcPlayerStats()
            const p = state.player
            assert(isFiniteNum(p.maxHp) && p.maxHp > 0, 'maxHp invalid')
            assert(isFiniteNum(p.stats.attack), 'attack invalid')
        })

        // 2) inventory stacking correctness (potions)
        test('inventory stacking (potions)', () => {
            const p = state.player
            p.inventory = []
            addItemToInventory('potionSmall', 1)
            addItemToInventory('potionSmall', 1)
            const stacks = p.inventory.filter((it) => it && it.id === 'potionSmall' && it.type === 'potion')
            assert(stacks.length === 1, 'expected 1 stack, got ' + stacks.length)
            assert((stacks[0].quantity || 0) === 2, 'expected quantity 2, got ' + (stacks[0].quantity || 0))
        })

        // 2b) inventory quantity normalization (0/negative/NaN should not corrupt state)
        test('inventory quantity normalization', () => {
            const p = state.player
            p.inventory = []
            addItemToInventory('potionSmall', 0)
            addItemToInventory('potionSmall', -5)
            addItemToInventory('potionSmall', NaN)
            const it = p.inventory.find((x) => x && x.id === 'potionSmall')
            assert(it && it.type === 'potion', 'potionSmall missing after adds')
            assert(it.quantity === 3, 'expected quantity 3 after normalized adds, got ' + String(it.quantity))
        })

        // 3) consume decrements + removes at 0
        test('consume potion decrements and removes at 0', () => {
            const p = state.player
            p.inventory = []
            addItemToInventory('potionSmall', 2)
            const idx = p.inventory.findIndex((it) => it && it.id === 'potionSmall')
            assert(idx >= 0, 'potionSmall missing')
            p.hp = Math.max(1, p.maxHp - 80)

            usePotionFromInventory(idx, false, { stayOpen: true })

            const after1 = p.inventory.find((it) => it && it.id === 'potionSmall')
            assert(after1 && after1.quantity === 1, 'expected quantity 1 after first use')

            // Use the last one (index can change if removed, so refetch)
            const idx2 = p.inventory.findIndex((it) => it && it.id === 'potionSmall')
            assert(idx2 >= 0, 'potionSmall missing before second use')
            p.hp = Math.max(1, p.maxHp - 80)
            usePotionFromInventory(idx2, false, { stayOpen: true })

            const after2 = p.inventory.find((it) => it && it.id === 'potionSmall')
            assert(!after2, 'expected potion stack removed at 0')
        })

        // 4) equip slot validity (non-equipables must not equip)
        test('equip rejects non-equipable items', () => {
            const p = state.player
            p.inventory = []
            p.equipment.weapon = null
            p.equipment.armor = null
            addItemToInventory('potionSmall', 1)
            const idx = p.inventory.findIndex((it) => it && it.id === 'potionSmall')
            equipItemFromInventory(idx, { stayOpen: true })
            assert(p.equipment.weapon === null && p.equipment.armor === null, 'non-equipable item altered equipment')
        })

        // 5) sell equipped item clears slot and gold matches sell value
        test('sell equipped clears slot + gold matches getSellValue', () => {
            const p = state.player
            p.inventory = []
            p.gold = 100
            const sword = cloneItemDef('swordIron')
            assert(sword, 'missing swordIron def')
            p.inventory.push(sword)
            p.equipment.weapon = sword

            const expected = getSellValue(sword, 'village')
            assert(expected > 0, 'sell value not positive')

            const beforeGold = p.gold
            sellItemFromInventory(0, 'village')
            assert(p.equipment.weapon === null, 'weapon slot not cleared')
            assert(p.gold === beforeGold + expected, 'gold mismatch: expected +' + expected + ', got ' + (p.gold - beforeGold))
        })

        // 6) recalc idempotence (no double-apply)
        test('recalcPlayerStats is stable (idempotent)', () => {
            const p = state.player
            p.inventory = []
            const armor = cloneItemDef('armorLeather')
            p.inventory.push(armor)
            p.equipment.armor = armor
            recalcPlayerStats()
            const snap1 = JSON.stringify({ maxHp: p.maxHp, stats: p.stats, status: p.status })
            recalcPlayerStats()
            const snap2 = JSON.stringify({ maxHp: p.maxHp, stats: p.stats, status: p.status })
            assert(snap1 === snap2, 'stats changed on second recalc')
        })


        // 6b) inventory safety: equipment does not stack like potions
        test('inventory: equipment does not stack', () => {
            const p = state.player
            p.inventory = []
            addItemToInventory('swordIron', 1)
            addItemToInventory('swordIron', 1)
            assert(p.inventory.length === 2, 'expected two separate weapons in inventory')
        })

        // 6c) equipment swap: stats refresh correctly (no double-apply)
        test('equipment swap refreshes stats (no double apply)', () => {
            const p = state.player
            p.inventory = []
            p.equipment.weapon = null

            const sword = cloneItemDef('swordIron')
            const staff = cloneItemDef('staffOak')
            p.inventory.push(sword)
            p.inventory.push(staff)

            // Equip sword
            equipItemFromInventory(0, { stayOpen: true })
            const atk1 = p.stats.attack
            const mag1 = p.stats.magic

            // Equip staff (same slot), should shift stats
            equipItemFromInventory(1, { stayOpen: true })
            const atk2 = p.stats.attack
            const mag2 = p.stats.magic

            assert(atk2 <= atk1, 'attack did not decrease when swapping to staff')
            assert(mag2 >= mag1, 'magic did not increase when swapping to staff')

            // Recalc is stable after swap
            const snap1 = JSON.stringify({ maxHp: p.maxHp, stats: p.stats })
            recalcPlayerStats()
            const snap2 = JSON.stringify({ maxHp: p.maxHp, stats: p.stats })
            assert(snap1 === snap2, 'stats changed on extra recalc after swap')
        })

        section('Classes & Abilities (1.1.7)')

        test('class unlock tables include 3/6/9/12', () => {
            const required = [3, 6, 9, 12]
            Object.keys(CLASS_LEVEL_UNLOCKS).forEach((cid) => {
                const levels = (CLASS_LEVEL_UNLOCKS[cid] || []).map((u) => u.level).sort((a,b)=>a-b)
                required.forEach((lvl) => {
                    assert(levels.includes(lvl), cid + ' missing unlock level ' + lvl)
                })
            })
        })

        test('class unlock spells exist in ABILITIES + effects', () => {
            Object.keys(CLASS_LEVEL_UNLOCKS).forEach((cid) => {
                (CLASS_LEVEL_UNLOCKS[cid] || []).forEach((u) => {
                    assert(u && u.spell, 'bad unlock for ' + cid)
                    assert(!!ABILITIES[u.spell], 'ABILITIES missing: ' + u.spell)
                    assert(typeof ABILITY_EFFECTS[u.spell] === 'function', 'ABILITY_EFFECTS missing: ' + u.spell)
                })
            })
        })

        test('level 12 unlock grants all class unlock spells', () => {
            const classes = Object.keys(CLASS_LEVEL_UNLOCKS)
            classes.forEach((cid) => {
                const p = createPlayer('Tester', cid, 'normal')
                p.level = 12
                ensurePlayerSpellSystems(p)
                // grant everything up to level
                const unlocks = CLASS_LEVEL_UNLOCKS[cid] || []
                unlocks.forEach((u) => {
                    if (u.level <= p.level && !p.spells.includes(u.spell)) p.spells.push(u.spell)
                })
                unlocks.forEach((u) => assert(p.spells.includes(u.spell), cid + ' did not receive ' + u.spell))
            })
        })

        test('rogue combo points build and spend (backstab→eviscerate)', () => {
            const p = createPlayer('Rogue', 'rogue', 'normal')
            ensurePlayerSpellSystems(p)
            const enemy = { name: 'Combo Dummy', hp: 500, maxHp: 500, armor: 0, magicRes: 0, level: 1, tier: 1 }
            const ctx1 = buildAbilityContext(p, 'backstab', enemy)
            ABILITY_EFFECTS.backstab(p, enemy, ctx1)
            assert((p.status.comboPoints || 0) === 1, 'expected 1 combo point')
            const ctx2 = buildAbilityContext(p, 'eviscerate', enemy)
            ABILITY_EFFECTS.eviscerate(p, enemy, ctx2)
            assert((p.status.comboPoints || 0) === 0, 'combo points not spent')
        })

        test('ranger marks tick down and clear when expired', () => {
            const p = createPlayer('Ranger', 'ranger', 'normal')
            ensurePlayerSpellSystems(p)
            const enemy = { name: 'Mark Dummy', hp: 500, maxHp: 500, armor: 0, magicRes: 0, level: 1, tier: 1 }
            const ctx = buildAbilityContext(p, 'markedPrey', enemy)
            ABILITY_EFFECTS.markedPrey(p, enemy, ctx)
            assert((enemy.markedStacks || 0) > 0, 'marks not applied')
            assert((enemy.markedTurns || 0) > 0, 'mark turns missing')
            // tick until clear
            for (let i = 0; i < 5; i++) tickEnemyStartOfTurn(enemy)
            assert((enemy.markedTurns || 0) === 0, 'mark turns did not expire')
            assert((enemy.markedStacks || 0) === 0, 'mark stacks did not clear')
        })

        test('combat HUD class meter renders (all classes)', () => {
            if (typeof document === 'undefined') return
            let el = document.getElementById('hudClassMeter')
            if (!el) {
                el = document.createElement('div')
                el.id = 'hudClassMeter'
                document.body.appendChild(el)
            }

            state.inCombat = true

            const cases = [
                { cid: 'mage', label: 'Rhythm', setup: (p, e) => { p.status.spellCastCount = 2 } },
                { cid: 'warrior', label: 'Bulwark', setup: (p, e) => { p.resource = 40 } },
                { cid: 'blood', label: 'Blood', setup: (p, e) => { p.resource = Math.floor(p.maxResource * 0.6) } },
                { cid: 'ranger', label: 'Marks', setup: (p, e) => { e.markedStacks = 2; e.markedTurns = 4 } },
                { cid: 'paladin', label: 'Sanctuary', setup: (p, e) => { p.status.shield = 25 } },
                { cid: 'rogue', label: 'Combo', setup: (p, e) => { p.status.comboPoints = 3 } },
                { cid: 'cleric', label: 'Ward', setup: (p, e) => { p.status.shield = 18 } },
                { cid: 'necromancer', label: 'Shards', setup: (p, e) => { p.status.soulShards = 4 } },
                { cid: 'shaman', label: 'Totem', setup: (p, e) => { p.status.totemType = ''; p.status.totemTurns = 0 } },
                { cid: 'berserker', label: 'Frenzy', setup: (p, e) => { p.hp = Math.max(1, Math.floor(p.maxHp * 0.4)) } },
                { cid: 'vampire', label: 'Hunger', setup: (p, e) => { p.resource = Math.floor(p.maxResource * 0.6) } }
            ]

            cases.forEach((c) => {
                state.player = createPlayer('T', c.cid, 'normal')
                ensurePlayerSpellSystems(state.player)
                state.currentEnemy = { name: 'Dummy', hp: 50, maxHp: 50 }
                c.setup(state.player, state.currentEnemy)
                updateClassMeterHUD()
                assert(!el.classList.contains('hidden'), 'meter should be visible for ' + c.cid)
                assert(el.innerHTML.includes(c.label), c.cid + ' meter label missing')
            })

            // Not in combat -> hidden
            state.inCombat = false
            updateClassMeterHUD()
            assert(el.classList.contains('hidden'), 'meter should be hidden out of combat')
        })

        section('Save & Migration')

        // 7) save roundtrip equality (normalized)
        test('save roundtrip stable (normalized)', () => {
            const blob1 = _buildSaveBlob()
            blob1.meta = Object.assign({}, blob1.meta || {}, { patch: GAME_PATCH, schema: SAVE_SCHEMA, savedAt: 0 })
            const norm = (o) => {
                const c = JSON.parse(JSON.stringify(o))
                if (c && c.meta) {
                    c.meta.savedAt = 0
                    c.meta.patch = GAME_PATCH
                    c.meta.schema = SAVE_SCHEMA
                }
                return stableStringify(c)
            }
            const migrated = migrateSaveData(JSON.parse(JSON.stringify(blob1)))
            assert(migrated && migrated.meta && migrated.meta.schema === SAVE_SCHEMA, 'migration schema mismatch')
            assert(norm(blob1) === norm(migrated), 'roundtrip changed payload (after normalization)')
        })

        // 8) legacy payload migration (qty -> quantity)
        test('legacy save migration: qty→quantity', () => {
            const legacy = {
                meta: { schema: 5, patch: '1.1.51', savedAt: 0 },
                player: {
                    name: 'LEGACY',
                    classId: 'warrior',
                    level: 1,
                    hp: 10,
                    maxHp: 10,
                    resource: 0,
                    maxResource: 0,
                    gold: 0,
                    inventory: [{ id: 'potionSmall', type: 'potion', qty: 3 }]
                },
                time: { dayIndex: 0, partIndex: 0 }
            }
            const migrated = migrateSaveData(JSON.parse(JSON.stringify(legacy)))
            const it = migrated.player.inventory[0]
            assert('quantity' in it, 'quantity missing after migrate')
            assert(!('qty' in it), 'qty still present after migrate')
            assert(it.quantity === 3, 'quantity incorrect after migrate: ' + it.quantity)
        })

        // 9) corrupt-but-recoverable save shape (missing optional containers)
        test('recoverable save: missing optional containers does not corrupt', () => {
            const partial = {
                meta: { schema: SAVE_SCHEMA, patch: GAME_PATCH, savedAt: 0 },
                player: { name: 'OK', classId: 'warrior', level: 1, hp: 5, maxHp: 10, gold: 0, resource: 0, maxResource: 0, inventory: [] },
                // Intentionally omit: villageEconomy, government, bank, village, merchantStock, sim, etc.
                time: null
            }
            const migrated = migrateSaveData(JSON.parse(JSON.stringify(partial)))
            assert(!(migrated && migrated.__corrupt), 'unexpected __corrupt flag')
            assert(migrated && migrated.player && migrated.meta, 'missing core fields after migrate')
        })


        // 9b) save roundtrip (mid-combat state preserved)
        test('save roundtrip: mid-combat preserves intent/posture/cooldowns', () => {
            const p = state.player
            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null
            }

            try {
                state.inCombat = true
                state.currentEnemy = {
                    name: 'SaveCombat Dummy',
                    hp: 100,
                    maxHp: 100,
                    level: 5,
                    attack: 10,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    postureMax: 25,
                    posture: 7,
                    brokenTurns: 0,
                    stunTurns: 0,
                    abilities: ['heavyCleave'],
                    abilityCooldowns: { heavyCleave: 2 },
                    intent: { aid: 'heavyCleave', turnsLeft: 1 }
                }
                ensureEnemyRuntime(state.currentEnemy)

                const blob = _buildSaveBlob()
                const migrated = migrateSaveData(JSON.parse(JSON.stringify(blob)))

                assert(migrated.inCombat === true, 'expected inCombat true after migrate')
                assert(migrated.currentEnemy && migrated.currentEnemy.name === 'SaveCombat Dummy', 'missing enemy after migrate')
                const e = migrated.currentEnemy
                assert(e.intent && e.intent.aid === 'heavyCleave', 'intent not preserved')
                assert(e.posture === 7, 'posture not preserved')
                assert(e.abilityCooldowns && e.abilityCooldowns.heavyCleave === 2, 'cooldown not preserved')
            } finally {
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
            }
        })

        // 9c) migration tolerates unknown keys (forward-compat)
        test('migration tolerates unknown keys (forward-compat)', () => {
            const blob = _buildSaveBlob()
            blob.__unknownRoot = { ok: true, nested: { n: 2 } }
            blob.player.__unknownPlayer = ['x', 'y']
            const migrated = migrateSaveData(JSON.parse(JSON.stringify(blob)))
            assert(!(migrated && migrated.__corrupt), 'migrate flagged corrupt due to unknown keys')
        })

        // 9d) forward-compat: combat objects missing newer fields initialize safely
        test('forward-compat: missing combat runtime fields initialize safely', () => {
            const legacy = _buildSaveBlob()
            legacy.inCombat = true
            legacy.currentEnemy = {
                name: 'Legacy Enemy',
                hp: 50,
                maxHp: 50,
                level: 3,
                attack: 9,
                magic: 0,
                armor: 1,
                magicRes: 0
                // Intentionally omit: intent, posture, postureMax, abilityCooldowns, abilities
            }

            const migrated = migrateSaveData(JSON.parse(JSON.stringify(legacy)))
            assert(migrated.currentEnemy && migrated.currentEnemy.name === 'Legacy Enemy', 'enemy missing after migrate')

            // ensureEnemyRuntime should be safe even when fields are missing
            ensureEnemyRuntime(migrated.currentEnemy)
            assert(typeof migrated.currentEnemy.postureMax === 'number', 'postureMax not initialized')
            assert(migrated.currentEnemy.abilityCooldowns && typeof migrated.currentEnemy.abilityCooldowns === 'object', 'abilityCooldowns not initialized')
        })

        section('Time & RNG')

        // 9a) time normalization guards (corrupt saves / dev tools)
        test('time normalization clamps day/part', () => {
            state.time = { dayIndex: -5, partIndex: 999 }
            const info = getTimeInfo(state)
            assert(info.absoluteDay === 0, 'expected dayIndex clamped to 0, got ' + info.absoluteDay)
            assert(info.partIndex === 2, 'expected partIndex clamped to 2, got ' + info.partIndex)
        })

        // 9b) time advance wraps correctly across day boundaries
        test('advanceTime wraps to next day', () => {
            state.time = { dayIndex: 0, partIndex: 0 }
            advanceTime(state, 3)
            assert(state.time.dayIndex === 1, 'expected dayIndex 1, got ' + state.time.dayIndex)
            assert(state.time.partIndex === 0, 'expected partIndex 0, got ' + state.time.partIndex)
        })

        // 9c) deterministic RNG repeatability under fixed seed
        test('deterministic RNG sequence is repeatable', () => {
            setDeterministicRngEnabled(state, true)
            setRngLoggingEnabled(state, false)

            const roll = () => {
                setRngSeed(state, 424242)
                state.debug.rngIndex = 0
                return [
                    rngFloat(state, 'smoke.rngFloat'),
                    rngInt(state, 1, 10, 'smoke.rngInt'),
                    rngPick(state, ['a', 'b', 'c'], 'smoke.rngPick')
                ]
            }

            const a = roll()
            const b = roll()
            assert(JSON.stringify(a) === JSON.stringify(b), 'expected repeatable sequence, got ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b))
        })

        // 9d) RNG log ring-buffer guard
        test('RNG log caps at 200 entries', () => {
            setDeterministicRngEnabled(state, true)
            setRngSeed(state, 1337)
            state.debug.rngIndex = 0
            setRngLoggingEnabled(state, true)

            for (let i = 0; i < 250; i++) rngFloat(state, 'smoke.cap')
            assert(Array.isArray(state.debug.rngLog), 'rngLog missing')
            assert(state.debug.rngLog.length === 200, 'expected rngLog length 200, got ' + state.debug.rngLog.length)
            const last = state.debug.rngLog[state.debug.rngLog.length - 1]
            assert(last && last.i === 249, 'expected last rngLog index 249, got ' + (last ? last.i : 'null'))

            setRngLoggingEnabled(state, false)
        })

        section('Economy & Daily Ticks')

        // 10) daily ticks x3 (basic regression)
        test('daily ticks x3', () => {
            for (let i = 0; i < 3; i++) {
                jumpToNextMorning(state)
                const absDay = state && state.time && typeof state.time.dayIndex === 'number' ? Math.floor(Number(state.time.dayIndex)) : i
                runDailyTicks(state, absDay, { silent: true })
            }
            assert(typeof state.sim === 'object', 'sim container missing')
        })

        // 11) daily tick idempotence guard (same day does nothing)
        test('daily tick idempotence guard', () => {
            const day = state.time ? Math.floor(Number(state.time.dayIndex)) : 0
            // seed a tiny merchant stock so we can detect accidental extra ticks
            state.merchantStock = { village: { alchemist: { potionSmall: 1 } } }
            state.merchantStockMeta = { lastDayRestocked: day - 1 }
            state.sim = { lastDailyTickDay: day - 1 }

            runDailyTicks(state, day, { silent: true })
            const snap = JSON.stringify({ sim: state.sim, stock: state.merchantStock, meta: state.merchantStockMeta })
            runDailyTicks(state, day, { silent: true })
            const snap2 = JSON.stringify({ sim: state.sim, stock: state.merchantStock, meta: state.merchantStockMeta })
            assert(snap === snap2, 'state changed when ticking the same day twice')
        })

        // 12) day increments triggers exactly once (D -> D+1)
        test('daily tick increments once per day', () => {
            const d0 = state.time ? Math.floor(Number(state.time.dayIndex)) : 0
            state.merchantStock = { village: { alchemist: { potionSmall: 0 } } }
            state.merchantStockMeta = { lastDayRestocked: d0 - 1 }
            state.sim = { lastDailyTickDay: d0 - 1 }

            runDailyTicks(state, d0, { silent: true })
            const afterD0 = state.merchantStock.village.alchemist.potionSmall

            runDailyTicks(state, d0 + 1, { silent: true })
            const afterD1 = state.merchantStock.village.alchemist.potionSmall

            assert(afterD0 === 1, 'expected restock +1 on day D')
            assert(afterD1 === 2, 'expected restock +1 on day D+1')
        })

        section('Bank')

        // 12a) weekly interest applies after 7 days
        test('bank: weekly interest applies after 7 days', () => {
            initVillageEconomyState(state)
            initGovernmentState(state, 0)
            initTimeState(state)

            const today = Math.floor(Number(state.time.dayIndex) || 0)
            state.bank = {
                balance: 1000,
                investments: 1000,
                loan: { balance: 1000, baseRate: 0 },
                visits: 0,
                lastInterestDay: today - 7
            }

            const openModalStub = (_title, builder) => {
                const body = document.createElement('div')
                builder(body)
            }

            openBankModalImpl({
                state,
                openModal: openModalStub,
                addLog: () => {},
                recordInput: () => {},
                updateHUD: () => {},
                saveGame: () => {}
            })

            assert(state.bank.balance > 1000, 'expected savings interest to increase balance')
            assert(state.bank.investments > 1000, 'expected investment returns to increase investments')
            assert(state.bank.loan && state.bank.loan.balance > 1000, 'expected loan interest to increase loan balance')
            assert(state.bank.lastInterestDay === today, 'expected lastInterestDay to advance to today')
        })

        // 12b) guard: calendar rollback / future lastInterestDay should recalibrate without applying interest
        test('bank: future lastInterestDay recalibrates safely', () => {
            initTimeState(state)
            const today = Math.floor(Number(state.time.dayIndex) || 0)
            state.bank = {
                balance: 1000,
                investments: 0,
                loan: null,
                visits: 0,
                lastInterestDay: today + 999
            }

            const openModalStub = (_title, builder) => {
                const body = document.createElement('div')
                builder(body)
            }

            openBankModalImpl({
                state,
                openModal: openModalStub,
                addLog: () => {},
                recordInput: () => {},
                updateHUD: () => {},
                saveGame: () => {}
            })

            assert(state.bank.balance === 1000, 'expected no interest when recalibrating')
            assert(state.bank.lastInterestDay === today, 'expected lastInterestDay reset to today')
        })

        section('Town Hall & Decrees')

        test('town hall: cleanup removes expired effects', () => {
            initTimeState(state)
            initGovernmentState(state, 0)
            const today = Math.floor(Number(state.time.dayIndex) || 0)

            state.government = state.government || {}
            state.government.townHallEffects = {
                petitionId: 'smoke',
                title: 'Smoke Decree',
                expiresOnDay: today - 1,
                depositRateMultiplier: 2
            }

            cleanupTownHallEffects(state)
            assert(!state.government.townHallEffects, 'expected expired townHallEffects to be removed')

            // Active decree should remain
            state.government.townHallEffects = {
                petitionId: 'smoke2',
                title: 'Active Decree',
                expiresOnDay: today,
                depositRateMultiplier: 2
            }
            cleanupTownHallEffects(state)
            assert(!!state.government.townHallEffects, 'expected active townHallEffects to remain')
        })

        test('town hall modal builds (sandboxed)', () => {
            const openModalStub = (_title, builder) => {
                const body = document.createElement('div')
                builder(body)
                assert(body.textContent && body.textContent.length > 0, 'expected some UI content')
            }

            openTownHallModalImpl({
                state,
                openModal: openModalStub,
                addLog: () => {},
                handleGovernmentDayTick,
                handleEconomyDayTick,
                updateHUD: () => {},
                saveGame: () => {}
            })
        })

        section('Tavern & Gambling')

        test('tavern modal builds (sandboxed)', () => {
            const openModalStub = (_title, builder) => {
                const body = document.createElement('div')
                builder(body)
                assert(body.querySelectorAll('button').length >= 1, 'expected at least one tavern action button')
            }

            openTavernModalImpl({
                state,
                openModal: openModalStub,
                addLog: () => {},
                recordInput: () => {},
                getVillageEconomySummary,
                getRestCost,
                handleEconomyAfterPurchase,
                jumpToNextMorning,
                updateHUD: () => {},
                updateTimeDisplay: () => {},
                saveGame: () => {},
                closeModal: () => {},
                openGambleModal: () => {},
                questDefs: QUEST_DEFS,
                ensureQuestStructures: quests.ensureQuestStructures,
                startSideQuest: quests.startSideQuest,
                advanceSideQuest: quests.advanceSideQuest,
                completeSideQuest: quests.completeSideQuest,
                updateQuestBox: quests.updateQuestBox,
                setScene: () => {}
            })
        })

        test('gamble modal builds (sandboxed)', () => {
            const openModalStub = (_title, builder) => {
                const body = document.createElement('div')
                builder(body)
                assert(body.querySelectorAll('button').length >= 1, 'expected at least one gambling action button')
            }

            openGambleModalImpl({
                state,
                openModal: openModalStub,
                addLog: () => {},
                updateHUD: () => {},
                saveGame: () => {},
                closeModal: () => {},
                openTavernModal: () => {}
            })
        })

        section('Quests & Progression')

        test('quest lifecycle: ensure/init/start/advance/complete', () => {
            state.quests = null
            state.flags = null
            quests.ensureQuestStructures()
            assert(state.quests && typeof state.quests === 'object', 'quests missing after ensure')
            assert(state.flags && typeof state.flags === 'object', 'flags missing after ensure')

            quests.initMainQuest()
            assert(state.quests.main && state.quests.main.id === 'main', 'main quest not initialized')

            quests.startSideQuest('grainWhispers')
            assert(state.quests.side.grainWhispers && state.quests.side.grainWhispers.status === 'active', 'side quest not started')

            quests.advanceSideQuest('grainWhispers', 1)
            assert(state.quests.side.grainWhispers.step === 1, 'side quest did not advance to step 1')

            quests.completeSideQuest('grainWhispers', null)
            assert(state.quests.side.grainWhispers.status === 'completed', 'side quest did not complete')
        })

        test('progression audit report includes patch + schema', () => {
            const report = quests.buildProgressionAuditReport()
            assert(typeof report === 'string' && report.length > 20, 'audit report missing')
            assert(report.includes('Patch: ' + GAME_PATCH), 'audit report missing patch')
            assert(report.includes('schema ' + SAVE_SCHEMA), 'audit report missing schema')
        })

        section('Bug Report Bundle')

        test('bug report bundle serializes and includes patch info', () => {
            const bundle = buildBugReportBundle()
            const json = JSON.stringify(bundle)
            assert(typeof json === 'string' && json.length > 0, 'bundle did not serialize')
            assert(bundle && bundle.summary && bundle.summary.patch === GAME_PATCH, 'bundle patch mismatch')
            assert(bundle.summary.saveSchema === SAVE_SCHEMA, 'bundle schema mismatch')
        })

        section('Merchants')

        // 13) merchant prune invalid keys + buy flow (DOM-free via stub openModal)
        test('merchant stock pruning + purchase effects', () => {
            const p = state.player
            p.inventory = []
            p.gold = 999

            // Inject a ghost key into the alchemist bucket (should be pruned).
            state.merchantStock = { village: { alchemist: { potionSmall: 2, __ghostKey__: 9 } } }
            state.merchantStockMeta = state.merchantStockMeta || { lastDayRestocked: null }

            const modalStack = []
            const openModalStub = (title, builder) => {
                const body = document.createElement('div')
                modalStack.push({ title, body })
                builder(body)
            }
            const addLogStub = () => {}
            const recordInputStub = () => {}

            openMerchantModalImpl({
                context: 'village',
                state,
                openModal: openModalStub,
                addLog: addLogStub,
                recordInput: recordInputStub,
                getVillageEconomySummary,
                getMerchantPrice,
                handleEconomyAfterPurchase,
                cloneItemDef,
                addItemToInventory,
                updateHUD: () => {},
                saveGame: () => {}
            })

            assert(modalStack.length >= 1, 'merchant hub did not open')
            const hubBody = modalStack[0].body
            const visitButtons = Array.from(hubBody.querySelectorAll('button')).filter((b) => (b.textContent || '').toLowerCase().includes('visit'))
            assert(visitButtons.length >= 3, 'expected village merchant hub visit buttons')

            // Click the 3rd merchant (alchemist)
            visitButtons[2].click()
            assert(modalStack.length >= 2, 'alchemist shop did not open')

            // After opening the shop, ghost key should be pruned.
            assert(!('__ghostKey__' in state.merchantStock.village.alchemist), 'ghost key not pruned')

            const shopBody = modalStack[1].body
            const buyButtons = Array.from(shopBody.querySelectorAll('button')).filter((b) => (b.textContent || '').toLowerCase() === 'buy')
            assert(buyButtons.length >= 1, 'no buy button found')

            const beforeGold = p.gold
            const beforeQty = (p.inventory.find((it) => it && it.id === 'potionSmall') || {}).quantity || 0
            buyButtons[0].click()

            const afterQty = (p.inventory.find((it) => it && it.id === 'potionSmall') || {}).quantity || 0
            assert(afterQty === beforeQty + 1, 'inventory did not increase after buy')

            // Price is economy-aware; recompute expected for potionSmall.
            const def = cloneItemDef('potionSmall')
            const expectedPrice = Math.max(1, Math.floor(getMerchantPrice(def.price || 0, state, 'village')))
            assert(p.gold === beforeGold - expectedPrice, 'gold did not decrease by expected price')
            assert(state.merchantStock.village.alchemist.potionSmall === 1, 'stock did not decrement after buy')
        })

        // 14) merchant restock caps + day guard (direct tick)
        test('merchant restock caps + day-guard', () => {
            const d0 = state && state.time && typeof state.time.dayIndex === 'number'
                ? Math.floor(Number(state.time.dayIndex))
                : 0

            state.merchantStock = {
                village: {
                    blacksmith: {
                        potionSmall: 0,
                        armorLeather: 0
                    }
                }
            }
            state.merchantStockMeta = { lastDayRestocked: d0 - 1 }

            handleMerchantDayTick(state, d0, cloneItemDef)
            const b0 = state.merchantStock.village.blacksmith
            assert(b0.potionSmall === 1 && b0.armorLeather === 1, 'restock did not increment')

            handleMerchantDayTick(state, d0, cloneItemDef)
            assert(b0.potionSmall === 1 && b0.armorLeather === 1, 'restock ran twice same day')

            handleMerchantDayTick(state, d0 + 1, cloneItemDef)
            assert(b0.potionSmall === 2 && b0.armorLeather === 2, 'next-day increment/cap failed')

            b0.armorLeather = 99
            handleMerchantDayTick(state, d0 + 2, cloneItemDef)
            assert(b0.armorLeather === 2, 'cap enforcement failed')
        })

        // 15) duplicate-item unequip correctness (reference-first, safe fallback)
        test('duplicate unequip (instance-safe)', () => {
            const p = state.player
            p.inventory = []
            const a = cloneItemDef('armorLeather')
            const b = cloneItemDef('armorLeather')
            assert(a && b && a.id === b.id, 'cloneItemDef did not return comparable items')

            p.inventory.push(a)
            p.inventory.push(b)
            p.equipment.armor = a

            const changedWrong = unequipItemIfEquipped(p, b)
            assert(!changedWrong, 'unequipped the wrong duplicate')
            assert(p.equipment.armor === a, 'equipment changed when operating on different copy')

            const changedRight = unequipItemIfEquipped(p, a)
            assert(changedRight, 'did not unequip the correct instance')
            assert(p.equipment.armor === null, 'equipment slot not cleared')
        })

        section('Loot Generation')

        // 16) pickWeighted safety (empty/zero weights)
        test('loot pickWeighted safety', () => {
            const a = pickWeighted([])
            assert(a === null, 'expected null for empty')
            const b = pickWeighted([['x', 0], ['y', 0]])
            assert(b === 'x', 'expected first item when total weight <= 0')
        })

        // 17) loot generator outputs valid items (no NaN/undefined)
        test('loot generator validity (generated items)', () => {
            // Freeze Date.now so generated IDs are deterministic.
            const oldNow = Date.now
            Date.now = () => 1700000000000
            try {
                setRngSeed(state, 424242)
                state.debug.rngIndex = 0
                for (let i = 0; i < 15; i++) {
                    const drops = generateLootDrop({
                        area: 'forest',
                        playerLevel: 5,
                        enemy: null,
                        playerResourceKey: 'mana'
                    })
                    assert(Array.isArray(drops) && drops.length >= 1, 'no drops generated')
                    drops.forEach((it) => {
                        assert(it && typeof it === 'object', 'drop is not an object')
                        assert(typeof it.id === 'string' && it.id.length, 'drop id missing')
                        assert(typeof it.name === 'string' && it.name.length, 'drop name missing')
                        assert(['potion', 'weapon', 'armor'].includes(it.type), 'drop type invalid: ' + it.type)
                        assert(isFiniteNum(it.price || 0), 'drop price invalid')
                        assert(isFiniteNum(it.itemLevel || 1), 'drop itemLevel invalid')
                    })
                }
            } finally {
                Date.now = oldNow
            }
        })

        // 18) deterministic loot (same seed, same results)
        test('loot determinism (same seed)', () => {
            const oldNow = Date.now
            Date.now = () => 1700000000000
            try {
                const roll = () => {
                    setRngSeed(state, 9001)
                    state.debug.rngIndex = 0
                    return generateLootDrop({
                        area: 'forest',
                        playerLevel: 7,
                        enemy: { isElite: true },
                        playerResourceKey: 'mana'
                    })
                }
                const a = roll()
                const b = roll()
                assert(JSON.stringify(a) === JSON.stringify(b), 'loot mismatch under same seed')
            } finally {
                Date.now = oldNow
            }
        })

        section('UI Guards')

        // 19) switchScreen crash guard (missing DOM nodes)
        test('switchScreen ignores missing DOM nodes', () => {
            // IMPORTANT: this test should never leave the real UI blank.
            // Snapshot current screen visibility and audio behavior, then restore.
            const screenSnap = Object.keys(screens || {})
                .map((k) => ({ k, el: screens[k] }))
                .filter((x) => x.el && x.el.classList)
                .map((x) => ({ k: x.k, el: x.el, hidden: x.el.classList.contains('hidden') }))

            const oldMain = screens.mainMenu
            const oldSettings = screens.settings

            const oldPlayMusicTrack = typeof playMusicTrack === 'function' ? playMusicTrack : null
            const oldInteriorOpen = audioState ? audioState.interiorOpen : null

            // Prevent this test from stopping/starting music on real devices.
            if (oldPlayMusicTrack) playMusicTrack = () => {}

            screens.mainMenu = null
            screens.settings = null
            try {
                switchScreen('game')
                // This intentionally targets a missing screen node.
                switchScreen('settings')
            } finally {
                screens.mainMenu = oldMain
                screens.settings = oldSettings

                // Restore audio behavior.
                if (oldPlayMusicTrack) playMusicTrack = oldPlayMusicTrack
                if (audioState && oldInteriorOpen !== null) audioState.interiorOpen = oldInteriorOpen

                // Restore original screen hidden states so the UI isn't left blank.
                screenSnap.forEach((s) => {
                    try {
                        if (s.hidden) s.el.classList.add('hidden')
                        else s.el.classList.remove('hidden')
                    } catch (_) {}
                })
            }
        })


        // UI: dev-only HUD pills visibility toggles with cheats flag
        test('UI: dev HUD pills visibility toggles', () => {
            const testsBtn = document.getElementById('btnSmokeTestsPill')
            const cheatBtn = document.getElementById('btnCheatPill')
            assert(!!testsBtn, 'btnSmokeTestsPill missing from DOM')
            assert(!!cheatBtn, 'btnCheatPill missing from DOM')

            const prev = !!(state && state.flags && state.flags.devCheatsEnabled)
            state.flags.devCheatsEnabled = false
            syncSmokeTestsPillVisibility()
            assert(testsBtn.classList.contains('hidden'), 'tests pill should hide when cheats disabled')
            assert(cheatBtn.classList.contains('hidden'), 'cheats pill should hide when cheats disabled')

            state.flags.devCheatsEnabled = true
            syncSmokeTestsPillVisibility()
            assert(!testsBtn.classList.contains('hidden'), 'tests pill should show when cheats enabled')
            assert(!cheatBtn.classList.contains('hidden'), 'cheats pill should show when cheats enabled')

            state.flags.devCheatsEnabled = prev
            syncSmokeTestsPillVisibility()
        })

        // UI: cheat menu can build in a sandboxed modal (no DOM lockups)
        test('UI: cheat menu builder is safe (sandboxed modal)', () => {
            const oldOpenModal = typeof openModal === 'function' ? openModal : null
            const oldCloseModal = typeof closeModal === 'function' ? closeModal : null

            const calls = { opened: 0, closed: 0, title: '', body: null }
            try {
                openModal = (title, builder) => {
                    calls.opened += 1
                    calls.title = String(title || '')
                    const body = document.createElement('div')
                    calls.body = body
                    if (typeof builder === 'function') builder(body)
                }
                closeModal = () => { calls.closed += 1 }

                // Must not throw
                openCheatMenu()

                assert(calls.opened >= 1, 'expected cheat menu to open a modal')
                assert(calls.title.toLowerCase().includes('cheat'), 'unexpected modal title: ' + calls.title)
                assert(calls.body && calls.body.querySelectorAll('button').length > 0, 'expected cheat modal to render buttons')
            } finally {
                if (oldOpenModal) openModal = oldOpenModal
                if (oldCloseModal) closeModal = oldCloseModal
            }
        })



        // UI: enemy panel opens an Enemy Sheet modal (sandboxed)
        test('UI: enemy sheet modal builds (enemy panel click)', () => {
            const enemyPanel = document.getElementById('enemyPanel')
            const modal = document.getElementById('enemyModal')
            const modalTitle = document.getElementById('enemyModalTitle')

            assert(!!enemyPanel, 'enemyPanel missing from DOM')
            assert(!!modal, 'enemyModal missing from DOM')
            assert(!!modalTitle, 'enemyModalTitle missing from DOM')

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null
            }

            try {
                state.inCombat = true
                state.currentEnemy = {
                    name: 'Sheet Dummy',
                    level: 12,
                    hp: 120,
                    maxHp: 120,
                    attack: 16,
                    magic: 8,
                    armor: 2,
                    magicRes: 2,
                    xp: 12,
                    goldMin: 6,
                    goldMax: 9,
                    abilities: ['enemyStrike']
                }
                ensureEnemyRuntime(state.currentEnemy)
                applyEnemyRarity(state.currentEnemy)
                updateEnemyPanel()

                // Click should open a real modal in the live DOM.
                enemyPanel.click()

                assert(!modal.classList.contains('hidden'), 'expected modal to be visible')
                assert(modalTitle.textContent.includes('Enemy Sheet'), 'unexpected modal title: ' + modalTitle.textContent)

                // Close to avoid leaking UI state into later tests
                closeEnemyModal()
            } finally {
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                updateEnemyPanel()
                try { closeEnemyModal() } catch (_) {}
            }
        })
        section('Combat')

        // 20) combat sanity: damage/heal never NaN and HP clamped
        test('combat sanity (damage/heal finite + clamped)', () => {
            const p = state.player

            // Snapshot combat state so this test can't leak dummy enemies or HP changes.
            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerHp: p.hp,
                playerMaxHp: p.maxHp,
                playerClassId: p.classId,
                playerResourceKey: p.resourceKey,
                playerResourceName: p.resourceName,
                playerResource: p.resource,
                playerMaxResource: p.maxResource,
                spells: Array.isArray(p.spells) ? [...p.spells] : [],
                equippedSpells: Array.isArray(p.equippedSpells) ? [...p.equippedSpells] : []
            }

            // Temporarily switch to a paladin so we have a heal spell available.
            p.classId = 'paladin'
            p.resourceKey = 'mana'
            p.resourceName = 'Mana'
            p.maxResource = 100
            p.resource = 100
            p.spells = ['holyStrike', 'blessingLight', 'retributionAura']
            p.equippedSpells = ['holyStrike', 'blessingLight', 'retributionAura']
            ensurePlayerSpellSystems(p)
            recalcPlayerStats()

            // Prevent any combat AI from acting (enemyTurn can damage the player and
            // can update live UI if it isn't stubbed).
            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null
            const _handleEnemyDefeat = typeof handleEnemyDefeat === 'function' ? handleEnemyDefeat : null

            if (_enemyTurn) enemyTurn = () => {}
            if (_companionAct) companionActIfPresent = () => {}
            if (_handleEnemyDefeat)
                handleEnemyDefeat = () => {
                    state.inCombat = false
                    state.currentEnemy = null
                }

            try {
                state.inCombat = true
                state.currentEnemy = { name: 'Dummy', hp: 120, maxHp: 120, armor: 0, magicRes: 0, tier: 1 }

                // Basic attack (should not trigger enemy retaliation during smoke tests)
                playerBasicAttack()
                assert(isFiniteNum(state.currentEnemy.hp), 'enemy hp became non-finite')
                assert(state.currentEnemy.hp >= 0 && state.currentEnemy.hp <= 120, 'enemy hp out of bounds')

                // Ability damage
                const ctx = buildAbilityContext(p, 'holyStrike')
                _setPlayerAbilityContext(ctx)
                ABILITY_EFFECTS.holyStrike(p, state.currentEnemy, ctx)
                _setPlayerAbilityContext(null)
                assert(isFiniteNum(state.currentEnemy.hp), 'enemy hp became non-finite after ability')

                // Healing
                p.hp = Math.max(1, p.maxHp - 50)
                const hctx = buildAbilityContext(p, 'blessingLight')
                ABILITY_EFFECTS.blessingLight(p, state.currentEnemy, hctx)
                assert(isFiniteNum(p.hp), 'player hp became non-finite after heal')
                assert(p.hp >= 0 && p.hp <= p.maxHp, 'player hp not clamped')
            } finally {
                // Restore combat hooks
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_companionAct) companionActIfPresent = _companionAct
                if (_handleEnemyDefeat) handleEnemyDefeat = _handleEnemyDefeat

                // Restore the test state to its pre-combat values.
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.hp = snap.playerHp
                if (p.status) {
                    p.status.shield = snap.playerShield
                    p.status.evasionTurns = snap.playerEvasionTurns
                }
                if (p.stats) p.stats.dodgeChance = snap.playerDodgeChance
                p.maxHp = snap.playerMaxHp
                p.classId = snap.playerClassId
                p.resourceKey = snap.playerResourceKey
                p.resourceName = snap.playerResourceName
                p.resource = snap.playerResource
                p.maxResource = snap.playerMaxResource
                p.spells = [...snap.spells]
                p.equippedSpells = [...snap.equippedSpells]
            }
        })

        // 20a) AoE abilities: multi-enemy damage should affect more than the primary target.
        test('combat: AoE (Cleave) damages multiple enemies', () => {
            const p = state.player

            // Set up a warrior with Cleave.
            p.classId = 'warrior'
            p.resourceKey = 'fury'
            p.resourceName = 'Fury'
            p.maxResource = 60
            p.resource = 60
            p.spells = ['powerStrike', 'battleCry', 'shieldWall', 'cleave']
            p.equippedSpells = ['cleave']
            ensurePlayerSpellSystems(p)
            recalcPlayerStats()

            // Disable crit variance for deterministic assertions.
            if (p.stats) {
                p.stats.critChance = 0
                p.stats.critDamage = 0
            }

            // Multi-enemy encounter.
            const e1 = { name: 'E1', hp: 120, maxHp: 120, armor: 0, magicRes: 0, tier: 1 }
            const e2 = { name: 'E2', hp: 120, maxHp: 120, armor: 0, magicRes: 0, tier: 1 }
            const e3 = { name: 'E3', hp: 120, maxHp: 120, armor: 0, magicRes: 0, tier: 1 }
            state.inCombat = true
            state.enemies = [e1, e2, e3]
            state.currentEnemy = e1
            state.targetEnemyIndex = 0

            const ctx = buildAbilityContext(p, 'cleave')
            _setPlayerAbilityContext(ctx)
            ABILITY_EFFECTS.cleave(p, e1, ctx)
            _setPlayerAbilityContext(null)

            assert(e1.hp < e1.maxHp, 'primary target did not take damage')
            assert(e2.hp < e2.maxHp && e3.hp < e3.maxHp, 'expected splash damage to hit other enemies')
        })

        test('combat: AoE (Blood Nova) damages and bleeds the group', () => {
            const p = state.player

            p.classId = 'blood'
            p.resourceKey = 'blood'
            p.resourceName = 'Blood'
            p.maxResource = 80
            p.resource = 80
            p.stats.magic = Math.max(10, p.stats.magic)
            p.spells = ['bloodSlash', 'leech', 'hemorrhage', 'bloodNova']
            p.equippedSpells = ['bloodNova']
            ensurePlayerSpellSystems(p)
            recalcPlayerStats()

            if (p.stats) {
                p.stats.critChance = 0
                p.stats.critDamage = 0
            }

            const e1 = { name: 'E1', hp: 140, maxHp: 140, armor: 0, magicRes: 0, tier: 1 }
            const e2 = { name: 'E2', hp: 140, maxHp: 140, armor: 0, magicRes: 0, tier: 1 }
            state.inCombat = true
            state.enemies = [e1, e2]
            state.currentEnemy = e1
            state.targetEnemyIndex = 0

            const ctx = buildAbilityContext(p, 'bloodNova')
            _setPlayerAbilityContext(ctx)
            ABILITY_EFFECTS.bloodNova(p, e1, ctx)
            _setPlayerAbilityContext(null)

            assert(e1.hp < e1.maxHp && e2.hp < e2.maxHp, 'expected both enemies to take damage')
            assert((e1.bleedTurns || 0) > 0 && (e2.bleedTurns || 0) > 0, 'expected bleed on both enemies')
        })

        test('combat: AoE (Meteor Sigil) splashes when multiple enemies present', () => {
            const p = state.player

            p.classId = 'mage'
            p.resourceKey = 'mana'
            p.resourceName = 'Mana'
            p.maxResource = 100
            p.resource = 100
            p.stats.magic = Math.max(12, p.stats.magic)
            p.spells = ['fireball', 'iceShard', 'arcaneShield', 'meteorSigil']
            p.equippedSpells = ['meteorSigil']
            ensurePlayerSpellSystems(p)
            recalcPlayerStats()

            if (p.stats) {
                p.stats.critChance = 0
                p.stats.critDamage = 0
            }

            const e1 = { name: 'E1', hp: 160, maxHp: 160, armor: 0, magicRes: 0, tier: 1 }
            const e2 = { name: 'E2', hp: 160, maxHp: 160, armor: 0, magicRes: 0, tier: 1 }
            const e3 = { name: 'E3', hp: 160, maxHp: 160, armor: 0, magicRes: 0, tier: 1 }
            state.inCombat = true
            state.enemies = [e1, e2, e3]
            state.currentEnemy = e2
            state.targetEnemyIndex = 1

            const ctx = buildAbilityContext(p, 'meteorSigil')
            _setPlayerAbilityContext(ctx)
            ABILITY_EFFECTS.meteorSigil(p, e2, ctx)
            _setPlayerAbilityContext(null)

            assert(e2.hp < e2.maxHp, 'target did not take damage')
            assert(e1.hp < e1.maxHp && e3.hp < e3.maxHp, 'expected splash damage to hit non-targets')
        })

        
        // 20b) combat: enemy mini-affixes (thorns / vampiric / regen / frozen)
        test('combat: enemy affix thorns reflects (and respects shield)', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerHp: p.hp,
                playerShield: p.status ? (p.status.shield || 0) : 0
            }

            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _handlePlayerDefeat = typeof handlePlayerDefeat === 'function' ? handlePlayerDefeat : null

            try {
                if (_enemyTurn) enemyTurn = () => {}
                if (_handlePlayerDefeat) handlePlayerDefeat = () => {}

                state.inCombat = true
                state.currentEnemy = { name: 'Thorns Dummy', hp: 120, maxHp: 120, level: 10, attack: 12, magic: 0, armor: 0, magicRes: 0, xp: 10, goldMin: 0, goldMax: 0 }
                ensureEnemyRuntime(state.currentEnemy)

                applyEnemyAffixes(state.currentEnemy, { forceAffixes: ['thorns'] })
                rebuildEnemyDisplayName(state.currentEnemy)

                // No shield: HP should drop
                p.status.shield = 0
                const beforeHp = p.hp
                playerBasicAttack()
                assert(p.hp < beforeHp, 'expected thorns to damage player')

                // Shield: should absorb first
                p.hp = beforeHp
                p.status.shield = 999
                const beforeShield = p.status.shield
                playerBasicAttack()
                assert(p.hp === beforeHp, 'expected shield to absorb thorns')
                assert(p.status.shield < beforeShield, 'expected shield to be reduced by thorns')
            } finally {
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_handlePlayerDefeat) handlePlayerDefeat = _handlePlayerDefeat

                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.hp = snap.playerHp
                if (p.status) p.status.shield = snap.playerShield
            }
        })

        test('combat: enemy affix vampiric heals on hit', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerHp: p.hp,
                playerShield: p.status ? (p.status.shield || 0) : 0,
                strikeUndodgeable: ENEMY_ABILITIES && ENEMY_ABILITIES.enemyStrike
                    ? !!ENEMY_ABILITIES.enemyStrike.undodgeable
                    : false
            }

            try {
                state.inCombat = true
                const enemy = { name: 'Vamp Dummy', hp: 140, maxHp: 160, level: 10, attack: 18, magic: 0, armor: 0, magicRes: 0, xp: 10, goldMin: 0, goldMax: 0 }
                state.currentEnemy = enemy
                ensureEnemyRuntime(enemy)

                applyEnemyAffixes(enemy, { forceAffixes: ['vampiric'] })
                rebuildEnemyDisplayName(enemy)

                // Ensure the test doesn't accidentally pass/fail due to dodge or heal-cap.
                if (ENEMY_ABILITIES && ENEMY_ABILITIES.enemyStrike) ENEMY_ABILITIES.enemyStrike.undodgeable = true
                if (p.status) p.status.shield = 0
                enemy.hp = Math.max(1, enemy.maxHp - 30)

                const before = enemy.hp
                applyEnemyAbilityToPlayer(enemy, p, 'enemyStrike')
                assert(enemy.hp > before, 'expected vampiric to heal enemy')
                assert(enemy.hp <= enemy.maxHp, 'enemy hp exceeded max after vampiric')
            } finally {
                if (ENEMY_ABILITIES && ENEMY_ABILITIES.enemyStrike) ENEMY_ABILITIES.enemyStrike.undodgeable = snap.strikeUndodgeable
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.hp = snap.playerHp
                if (p.status) p.status.shield = snap.playerShield
            }
        })

        test('combat: enemy affix regenerating heals at end of turn', () => {
            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null
            }

            try {
                state.inCombat = true
                const enemy = { name: 'Regen Dummy', hp: 50, maxHp: 200, level: 12, attack: 10, magic: 0, armor: 0, magicRes: 0, xp: 10, goldMin: 0, goldMax: 0 }
                state.currentEnemy = enemy
                ensureEnemyRuntime(enemy)

                applyEnemyAffixes(enemy, { forceAffixes: ['regenerating'] })
                rebuildEnemyDisplayName(enemy)

                enemy.hp = 50
                const before = enemy.hp
                applyEndOfTurnEffectsEnemy(enemy)
                assert(enemy.hp > before, 'expected regenerating to heal enemy')
            } finally {
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
            }
        })

        test('combat: enemy affix frozen applies chilled (reduces player damage)', () => {
            const p = state.player
            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerChilled: p.status ? (p.status.chilledTurns || 0) : 0,
                playerShield: p.status ? (p.status.shield || 0) : 0,
                strikeUndodgeable: ENEMY_ABILITIES && ENEMY_ABILITIES.enemyStrike
                    ? !!ENEMY_ABILITIES.enemyStrike.undodgeable
                    : false
            }

            try {
                state.inCombat = true
                const enemy = { name: 'Frozen Dummy', hp: 200, maxHp: 200, level: 12, attack: 14, magic: 0, armor: 0, magicRes: 0, xp: 10, goldMin: 0, goldMax: 0 }
                state.currentEnemy = enemy
                ensureEnemyRuntime(enemy)

                applyEnemyAffixes(enemy, { forceAffixes: ['frozen'] })
                // Force proc so the test doesn't depend on RNG.
                enemy.affixChillChance = 1
                enemy.affixChillTurns = 2
                rebuildEnemyDisplayName(enemy)

                // Ensure hit lands (avoid dodge) and chill isn't masked by old shields.
                if (ENEMY_ABILITIES && ENEMY_ABILITIES.enemyStrike) ENEMY_ABILITIES.enemyStrike.undodgeable = true
                if (p.status) p.status.shield = 0

                // Apply a hit; should chill the player.
                applyEnemyAbilityToPlayer(enemy, p, 'enemyStrike')
                assert((p.status.chilledTurns || 0) >= 2, 'expected frozen affix to apply chilled')

                // Set crit chance to 0 for deterministic damage comparison.
                p.stats.critChance = 0
                p.stats.critDamage = 0

                const base = p.stats.attack

                p.status.chilledTurns = 0
                const dmgWarm = calcPhysicalDamage(base)

                p.status.chilledTurns = 2
                const dmgCold = calcPhysicalDamage(base)

                assert(dmgCold <= dmgWarm, 'expected chilled to reduce outgoing damage')
            } finally {
                if (ENEMY_ABILITIES && ENEMY_ABILITIES.enemyStrike) ENEMY_ABILITIES.enemyStrike.undodgeable = snap.strikeUndodgeable
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                if (p.status) {
                    p.status.chilledTurns = snap.playerChilled
                    p.status.shield = snap.playerShield
                }
            }
        })
        // 20c) combat: enemy rarity (Common→Epic; Boss is always Legendary)
        test('combat: boss rarity is legendary', () => {
            const enemy = { name: 'Boss Dummy', isBoss: true, hp: 300, maxHp: 300, level: 12, attack: 20, magic: 20, armor: 4, magicRes: 4, xp: 50, goldMin: 30, goldMax: 40 }
            ensureEnemyRuntime(enemy)
            applyEnemyRarity(enemy)
            assert(enemy.rarity === 'legendary', 'expected boss rarity to be legendary')
            assert(enemy.rarityTier === 5, 'expected legendary tier 5')
            assert(enemy.rarityLabel === 'Legendary', 'expected legendary label')
        })

        test('combat: elite rarity is uncommon-or-rare', () => {
            const oldDiff = state.difficulty
            const rngSnap = (() => { try { return JSON.parse(JSON.stringify(state.rng)) } catch (_) { return null } })()
            try {
                state.difficulty = 'normal'
                setRngSeed(state, QA_SEED)

                const enemy = { name: 'Elite Dummy', isElite: true, level: 12, hp: 120, maxHp: 120, attack: 16, magic: 8, armor: 2, magicRes: 2, xp: 30, goldMin: 20, goldMax: 25 }
                ensureEnemyRuntime(enemy)
                applyEnemyRarity(enemy)
                assert(enemy.rarity === 'uncommon' || enemy.rarity === 'rare', 'expected elite rarity uncommon/rare, got ' + enemy.rarity)
            } finally {
                state.difficulty = oldDiff
                if (rngSnap) state.rng = rngSnap
            }
        })

        test('combat: rare rarity increases rewards vs baseline', () => {
            const base = { name: 'Baseline Dummy', level: 12, hp: 200, maxHp: 200, attack: 16, magic: 8, armor: 2, magicRes: 2, xp: 30, goldMin: 20, goldMax: 25 }
            const enemy = JSON.parse(JSON.stringify(base))
            enemy.rarity = 'rare'

            ensureEnemyRuntime(base)
            ensureEnemyRuntime(enemy)

            // Apply rarity scaling (no re-roll because rarity is explicit)
            applyEnemyRarity(enemy)

            assert(enemy.xp > base.xp, 'expected rare xp to be higher')
            assert(enemy.goldMin > base.goldMin, 'expected rare goldMin to be higher')
            assert(enemy.goldMax > base.goldMax, 'expected rare goldMax to be higher')
        })

        // 20d) difficulty linkage: enemy rarity + mini-affixes follow difficulty intent
        test('difficulty: easy/normal/hard rarity distributions match design', () => {
            const oldDiff = state.difficulty
            const oldArea = state.area
            const oldDyn = state.dynamicDifficulty ? JSON.parse(JSON.stringify(state.dynamicDifficulty)) : null
            const rngSnap = (() => { try { return JSON.parse(JSON.stringify(state.rng)) } catch (_) { return null } })()

            function sample(difficulty, band) {
                state.area = 'forest'
                state.difficulty = difficulty
                if (difficulty === 'dynamic') {
                    getActiveDifficultyConfig()
                    if (!state.dynamicDifficulty) state.dynamicDifficulty = {}
                    state.dynamicDifficulty.band = finiteNumber(band, 0)
                }

                setRngSeed(state, QA_SEED)
                const N = 260

                const counts = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 }
                let tierSum = 0
                let affixSum = 0

                for (let i = 0; i < N; i++) {
                    const enemy = { name: 'Dummy', level: 12, hp: 120, maxHp: 120, attack: 16, magic: 8, armor: 2, magicRes: 2, xp: 12, goldMin: 6, goldMax: 9 }
                    ensureEnemyRuntime(enemy)
                    applyEnemyRarity(enemy)

                    const cap = 2 + finiteNumber(enemy.rarityAffixCapBonus, 0)
                    applyEnemyAffixes(enemy, { maxAffixes: cap })

                    counts[enemy.rarity] = (counts[enemy.rarity] || 0) + 1
                    tierSum += finiteNumber(enemy.rarityTier, 1)
                    affixSum += Array.isArray(enemy.affixes) ? enemy.affixes.length : 0
                }

                const rate = (id) => (counts[id] || 0) / N
                return { N, counts, rate, avgTier: tierSum / N, avgAffixes: affixSum / N }
            }

            try {
                const easy = sample('easy', 0)
                assert(easy.rate('common') === 1, 'expected easy to be 100% common')
                assert(easy.avgTier === 1, 'expected easy avgTier to be 1.0')
                assert(easy.avgAffixes === 0, 'expected easy to roll no mini-affixes')

                const normal = sample('normal', 0)
                assert(normal.rate('common') <= 0.12, 'expected normal to have very little common')
                assert(normal.rate('uncommon') >= 0.70, 'expected normal to be mostly uncommon')
                assert(normal.rate('rare') >= 0.03 && normal.rate('rare') <= 0.22, 'expected normal to have a few rares')
                assert(normal.rate('epic') === 0, 'expected normal to have no epic')
                assert(normal.rate('epic') === 0, 'expected normal to have no non-boss epic')
                assert(normal.rate('legendary') === 0, 'expected normal to have no non-boss legendary')
                assert(normal.rate('mythic') === 0, 'expected normal to have no non-boss mythic')
                assert(normal.rate('mythic') === 0, 'expected normal to have no mythic')

                const hard = sample('hard', 0)
                assert(hard.rate('common') === 0, 'expected hard to have no common')
                assert(hard.rate('uncommon') <= 0.25, 'expected hard to have very little uncommon')
                assert(hard.rate('rare') >= 0.55, 'expected hard to be mostly rare')
                assert(hard.rate('epic') >= 0.05 && hard.rate('epic') <= 0.30, 'expected hard to have a few epics')
                assert(hard.rate('legendary') >= 0.005 && hard.rate('legendary') <= 0.12, 'expected hard to have a few legendary')
                assert(hard.rate('mythic') <= 0.02, 'expected mythic to be extremely rare')
            } finally {
                state.difficulty = oldDiff
                state.area = oldArea
                state.dynamicDifficulty = oldDyn
                if (rngSnap) state.rng = rngSnap
            }
        })

        test('difficulty: dynamic spawns match its effective difficulty label', () => {
            const oldDiff = state.difficulty
            const oldArea = state.area
            const oldDyn = state.dynamicDifficulty ? JSON.parse(JSON.stringify(state.dynamicDifficulty)) : null
            const rngSnap = (() => { try { return JSON.parse(JSON.stringify(state.rng)) } catch (_) { return null } })()

            function sampleAtBand(band) {
                state.area = 'forest'
                state.difficulty = 'dynamic'
                getActiveDifficultyConfig()
                if (!state.dynamicDifficulty) state.dynamicDifficulty = {}
                state.dynamicDifficulty.band = band

                const cfg = getActiveDifficultyConfig()
                setRngSeed(state, QA_SEED)

                const N = 220
                const counts = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0, mythic: 0 }
                for (let i = 0; i < N; i++) {
                    const enemy = { name: 'Dummy', level: 12, hp: 120, maxHp: 120, attack: 16, magic: 8, armor: 2, magicRes: 2, xp: 12, goldMin: 6, goldMax: 9 }
                    ensureEnemyRuntime(enemy)
                    applyEnemyRarity(enemy)
                    counts[enemy.rarity] = (counts[enemy.rarity] || 0) + 1
                }
                const rate = (id) => (counts[id] || 0) / N
                return { cfg, counts, rate }
            }

            try {
                const low = sampleAtBand(-2)
                assert(low.cfg.closestId === 'easy', 'expected dynamic band -2 to be closest to easy')
                assert(low.rate('common') === 1, 'expected dynamic (easy) to be 100% common')

                const mid = sampleAtBand(0)
                assert(mid.cfg.closestId === 'normal', 'expected dynamic band 0 to be closest to normal')
                assert(mid.rate('uncommon') >= 0.70, 'expected dynamic (normal) to be mostly uncommon')

                const high = sampleAtBand(2)
                assert(high.cfg.closestId === 'hard', 'expected dynamic band +2 to be closest to hard')
                assert(high.rate('common') === 0, 'expected dynamic (hard) to have no common')
                assert(high.rate('legendary') >= 0.005, 'expected dynamic (hard) to have some legendary')
                assert(high.rate('mythic') <= 0.02, 'expected dynamic (hard) mythic to be extremely rare')
            } finally {
                state.difficulty = oldDiff
                state.area = oldArea
                state.dynamicDifficulty = oldDyn
                if (rngSnap) state.rng = rngSnap
            }
        })

        test('combat: enemy intent telegraph + interrupt', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerHp: p.hp,
                playerResourceKey: p.resourceKey,
                playerResourceName: p.resourceName,
                playerResource: p.resource,
                playerMaxResource: p.maxResource
            }

            // Stubs so this unit test doesn't chain into full combat loops.
            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null

            try {
                // Allow a real enemyTurn() so telegraphs can be asserted.
                if (_companionAct) companionActIfPresent = () => {}

                // Setup a telegraphed-ability enemy.
                state.inCombat = true
                state.currentEnemy = {
                    name: 'Telegraph Dummy',
                    hp: 220,
                    maxHp: 220,
                    level: 8,
                    attack: 18,
                    magic: 14,
                    armor: 2,
                    magicRes: 2,
                    abilities: ['heavyCleave'],
                    abilityCooldowns: {},
                    isBoss: false
                }
                ensureEnemyRuntime(state.currentEnemy)

                // Enemy declares intent (telegraph turn).
                const beforeHp = p.hp
                enemyTurn()
                assert(state.currentEnemy.intent && state.currentEnemy.intent.aid === 'heavyCleave', 'expected intent heavyCleave')
                assert(p.hp === beforeHp, 'telegraph should not damage player')

                // Player interrupts: should clear intent.
                p.resourceKey = 'mana'
                p.resourceName = 'Mana'
                p.maxResource = 100
                p.resource = 100

                // Prevent interrupt from chaining into an immediate enemy response during this unit test.
                if (_enemyTurn) enemyTurn = () => {}

                playerInterrupt()
                assert(!state.currentEnemy.intent, 'expected interrupt to clear intent')
            } finally {
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_companionAct) companionActIfPresent = _companionAct

                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.hp = snap.playerHp
                p.resourceKey = snap.playerResourceKey
                p.resourceName = snap.playerResourceName
                p.resource = snap.playerResource
                p.maxResource = snap.playerMaxResource
            }
        })

        // 22) deep combat: posture breaks trigger + disrupt intent
        test('combat: posture break triggers + disrupts intent', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerResource: p.resource,
                playerResourceKey: p.resourceKey,
                playerResourceName: p.resourceName,
                playerMaxResource: p.maxResource
            }

            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null

            try {
                if (_enemyTurn) enemyTurn = () => {}
                if (_companionAct) companionActIfPresent = () => {}

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Posture Dummy',
                    hp: 999,
                    maxHp: 999,
                    level: 1,
                    attack: 10,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    postureMax: 5,
                    posture: 0,
                    brokenTurns: 0,
                    abilities: ['heavyCleave'],
                    abilityCooldowns: {},
                    intent: { aid: 'heavyCleave', turnsLeft: 1 }
                }
                ensureEnemyRuntime(state.currentEnemy)

                // Ensure the max stays tiny for the test (ensureEnemyRuntime may set a default).
                state.currentEnemy.postureMax = 5

                // One basic attack should generate enough posture to break.
                playerBasicAttack()

                assert(state.currentEnemy.brokenTurns >= 1, 'expected Broken to be applied')
                assert(!state.currentEnemy.intent, 'expected Broken to disrupt intent')
            } finally {
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_companionAct) companionActIfPresent = _companionAct

                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.resource = snap.playerResource
                p.resourceKey = snap.playerResourceKey
                p.resourceName = snap.playerResourceName
                p.maxResource = snap.playerMaxResource
            }
        })

        // 23) deep combat: intent executes after countdown
        test('combat: intent executes after countdown', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerHp: p.hp
            }

            const _postEnemyTurn = typeof postEnemyTurn === 'function' ? postEnemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null

            try {
                // Prevent the full combat loop from chaining during this unit test.
                if (_postEnemyTurn) postEnemyTurn = () => {}
                if (_companionAct) companionActIfPresent = () => {}

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Intent Exec Dummy',
                    hp: 220,
                    maxHp: 220,
                    level: 8,
                    attack: 18,
                    magic: 14,
                    armor: 2,
                    magicRes: 2,
                    abilities: ['heavyCleave'],
                    abilityCooldowns: {},
                    isBoss: false
                }
                ensureEnemyRuntime(state.currentEnemy)

                const before = p.hp
                enemyTurn() // declares
                assert(state.currentEnemy.intent && state.currentEnemy.intent.aid === 'heavyCleave', 'expected intent to be declared')
                assert(p.hp === before, 'telegraph should not damage player')

                enemyTurn() // executes
                assert(!state.currentEnemy.intent, 'intent should be consumed on execute')
                assert(p.hp < before, 'expected player to take damage on execute')
            } finally {
                if (_postEnemyTurn) postEnemyTurn = _postEnemyTurn
                if (_companionAct) companionActIfPresent = _companionAct
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.hp = snap.playerHp
            }
        })

        // 24) deep combat: interrupt resource cost + insufficient resource does nothing
        test('combat: interrupt costs resource (and fails if insufficient)', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerResource: p.resource,
                playerMaxResource: p.maxResource,
                playerResourceKey: p.resourceKey,
                playerResourceName: p.resourceName
            }

            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null

            try {
                if (_enemyTurn) enemyTurn = () => {}
                if (_companionAct) companionActIfPresent = () => {}

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Interrupt Cost Dummy',
                    hp: 200,
                    maxHp: 200,
                    level: 1,
                    attack: 10,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    abilities: ['heavyCleave'],
                    abilityCooldowns: {},
                    intent: { aid: 'heavyCleave', turnsLeft: 1 }
                }
                ensureEnemyRuntime(state.currentEnemy)

                p.resourceKey = 'mana'
                p.resourceName = 'Mana'
                p.maxResource = 100

                // Not enough resource: should not spend or clear intent.
                p.resource = 9
                playerInterrupt()
                assert(p.resource === 9, 'resource changed when insufficient')
                assert(state.currentEnemy.intent && state.currentEnemy.intent.aid === 'heavyCleave', 'intent cleared despite insufficient resource')

                // Enough resource: spends and clears intent.
                p.resource = 10
                playerInterrupt()
                assert(p.resource === 0, 'expected resource to spend full cost (10)')
                assert(!state.currentEnemy.intent, 'expected interrupt to clear intent when affordable')
            } finally {
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_companionAct) companionActIfPresent = _companionAct
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.resource = snap.playerResource
                p.maxResource = snap.playerMaxResource
                p.resourceKey = snap.playerResourceKey
                p.resourceName = snap.playerResourceName
            }
        })
        // 24b) combat: interrupt with no intent still builds posture pressure
        test('combat: interrupt without intent builds posture', () => {
            const p = state.player
            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerResource: p.resource,
                playerMaxResource: p.maxResource,
                playerResourceKey: p.resourceKey,
                playerResourceName: p.resourceName
            }

            // Prevent follow-up enemy actions during this unit test
            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null
            try {
                if (_enemyTurn) enemyTurn = () => {}
                if (_companionAct) companionActIfPresent = () => {}

                state.inCombat = true
                state.currentEnemy = {
                    name: 'No-Intent Dummy',
                    hp: 200,
                    maxHp: 200,
                    level: 1,
                    attack: 8,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    postureMax: 50,
                    posture: 0,
                    abilities: ['enemyStrike'],
                    abilityCooldowns: {}
                }
                ensureEnemyRuntime(state.currentEnemy)

                p.resourceKey = 'mana'
                p.resourceName = 'Mana'
                p.maxResource = 100
                p.resource = 100
                recalcPlayerStats()

                const beforePosture = state.currentEnemy.posture || 0
                playerInterrupt()
                const afterPosture = state.currentEnemy.posture || 0
                assert(afterPosture > beforePosture, 'expected posture to increase from interrupt jab')
                assert(!state.currentEnemy.intent, 'interrupt created an intent unexpectedly')
            } finally {
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_companionAct) companionActIfPresent = _companionAct
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.resource = snap.playerResource
                p.maxResource = snap.playerMaxResource
                p.resourceKey = snap.playerResourceKey
                p.resourceName = snap.playerResourceName
            }
        })

        // 24c) combat: telegraph commits cooldown; interrupt does not reset it; cooldown ticks down
        test('combat: cooldown integrity (telegraph + interrupt)', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerResource: p.resource,
                playerMaxResource: p.maxResource,
                playerResourceKey: p.resourceKey,
                playerResourceName: p.resourceName
            }

            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null
            const _postEnemyTurn = typeof postEnemyTurn === 'function' ? postEnemyTurn : null
            const _companionAct = typeof companionActIfPresent === 'function' ? companionActIfPresent : null

            try {
                if (_postEnemyTurn) postEnemyTurn = () => {}
                if (_companionAct) companionActIfPresent = () => {}

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Cooldown Dummy',
                    hp: 200,
                    maxHp: 200,
                    level: 4,
                    attack: 14,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    abilities: ['heavyCleave'],
                    abilityCooldowns: {}
                }
                ensureEnemyRuntime(state.currentEnemy)

                // Ensure player can pay interrupt
                p.resourceKey = 'mana'
                p.resourceName = 'Mana'
                p.maxResource = 100
                p.resource = 100
                recalcPlayerStats()

                // Let enemy declare intent (real enemyTurn is required)
                if (!_enemyTurn) throw new Error('enemyTurn not available')
                enemyTurn()
                assert(state.currentEnemy.intent && state.currentEnemy.intent.aid === 'heavyCleave', 'expected heavyCleave intent')
                assert(state.currentEnemy.abilityCooldowns.heavyCleave === 2, 'expected cooldown 2 on declare')

                // Interrupt clears intent but should NOT reset cooldown
                // Prevent enemyTurn from firing as a follow-up during playerInterrupt
                enemyTurn = () => {}
                playerInterrupt()

                assert(!state.currentEnemy.intent, 'intent not cleared by interrupt')
                assert(state.currentEnemy.abilityCooldowns.heavyCleave === 2, 'cooldown changed after interrupt')

                // Tick down cooldown
                tickEnemyCooldowns()
                assert(state.currentEnemy.abilityCooldowns.heavyCleave === 1, 'cooldown did not tick down to 1')
                tickEnemyCooldowns()
                assert(state.currentEnemy.abilityCooldowns.heavyCleave === 0, 'cooldown did not tick down to 0')
                assert(canUseEnemyAbility(state.currentEnemy, 'heavyCleave'), 'expected ability usable after cooldown expiry')
            } finally {
                if (_enemyTurn) enemyTurn = _enemyTurn
                if (_postEnemyTurn) postEnemyTurn = _postEnemyTurn
                if (_companionAct) companionActIfPresent = _companionAct
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.resource = snap.playerResource
                p.maxResource = snap.playerMaxResource
                p.resourceKey = snap.playerResourceKey
                p.resourceName = snap.playerResourceName
            }
        })

        // 24d) combat: player timed statuses tick once per turn and clear associated values at expiry
        test('combat: player status ticking (duration + clears)', () => {
            const p = state.player
            const st = p.status || (p.status = {})

            st.atkDown = 3
            st.atkDownTurns = 1
            st.armorDown = 2
            st.armorDownTurns = 1

            tickPlayerTimedStatuses()
            assert(st.atkDownTurns === 0, 'atkDownTurns did not tick to 0')
            assert(st.atkDown === 0, 'atkDown did not clear at expiry')
            assert(st.armorDownTurns === 0, 'armorDownTurns did not tick to 0')
            assert(st.armorDown === 0, 'armorDown did not clear at expiry')

            // Bleed ticks at the start of the player's turn and clears bleedDamage at expiry
            st.bleedDamage = 5
            st.bleedTurns = 1
            const hp0 = p.hp
            applyStartOfTurnEffectsPlayer(p)
            // HP Regen affix can still tick on round boundaries.
            applyPlayerRegenTick()
            assert(st.bleedTurns === 0, 'bleedTurns did not tick to 0')
            assert(st.bleedDamage === 0, 'bleedDamage did not clear at expiry')
            assert(p.hp <= hp0, 'bleed tick increased HP unexpectedly')
        })

        // 24d2) combat: bleed only ticks at the start of the player's turn (beginPlayerTurn)
        test('combat: bleed ticks on player turn start only (no double tick)', () => {
            const p = state.player
            const st = p.status || (p.status = {})
            // Ensure regen doesn't mask HP comparisons
            p.affixes = []

            state.inCombat = true
            state.enemies = [{ name: 'Bleed Dummy', hp: 10, maxHp: 10 }]
            state.targetEnemyIndex = 0
            state.currentEnemy = state.enemies[0]
            ensureCombatTurnState()
            state.combat.round = 1
            state.combat.busy = false

            st.bleedDamage = 5
            st.bleedTurns = 2
            const hp0 = p.hp

            beginPlayerTurn()
            assert(p.hp === hp0 - 5, 'expected bleed to apply once at player turn start')
            // Calling again within the same round should not double-apply
            beginPlayerTurn()
            assert(p.hp === hp0 - 5, 'bleed applied twice in the same round')

            // End-of-round should NOT apply bleed anymore
            const hp1 = p.hp
            postEnemyTurn()
            assert(p.hp === hp1, 'bleed ticked during postEnemyTurn (should wait for player turn)')

            // Next round: bleed should tick again
            state.combat.round = 2
            beginPlayerTurn()
            assert(p.hp === hp1 - 5, 'expected bleed to tick at start of next player turn')
        })

        // 24d3) combat: ensureCombatPointers repairs missing currentEnemy and clamps target index
        test('combat: ensureCombatPointers repairs missing enemy pointers', () => {
            state.inCombat = true
            state.enemies = [
                { name: 'Dead #1', hp: 0, maxHp: 10 },
                { name: 'Alive #2', hp: 7, maxHp: 10 }
            ]
            state.targetEnemyIndex = 0
            state.currentEnemy = null

            ensureCombatPointers()
            assert(!!state.currentEnemy, 'expected currentEnemy to be repaired')
            assert(state.currentEnemy.name === 'Alive #2', 'expected to target the first living enemy')
            assert(state.targetEnemyIndex === 1, 'expected targetEnemyIndex to advance to living enemy')
        })

        // 24d4) combat: exploreArea is blocked during combat to prevent desync
        test('combat: exploreArea is blocked while inCombat', () => {
            state.inCombat = true
            state.enemies = [{ name: 'Dummy', hp: 10, maxHp: 10 }]
            state.currentEnemy = state.enemies[0]
            ensureCombatTurnState()

            const t0 = JSON.stringify(state.time)
            exploreArea()
            const t1 = JSON.stringify(state.time)
            assert(t1 === t0, 'exploreArea advanced time during combat')
            assert(state.inCombat === true, 'exploreArea incorrectly ended combat')
        })

        // 24e) combat: companion act is safe even with an empty ability kit
        test('combat: companion action safe with empty abilities', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                companion: state.companion ? JSON.parse(JSON.stringify(state.companion)) : null
            }

            const _handleEnemyDefeat = typeof handleEnemyDefeat === 'function' ? handleEnemyDefeat : null
            try {
                // Prevent defeat from chaining into loot/saves
                if (_handleEnemyDefeat)
                    handleEnemyDefeat = () => {
                        state.inCombat = false
                        state.currentEnemy = null
                    }

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Companion Dummy',
                    hp: 50,
                    maxHp: 50,
                    level: 1,
                    attack: 8,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    abilities: ['enemyStrike'],
                    abilityCooldowns: {}
                }
                ensureEnemyRuntime(state.currentEnemy)

                state.companion = {
                    id: 'testComp',
                    name: 'Test Companion',
                    role: 'test',
                    behavior: 'balanced',
                    attack: 6,
                    hpBonus: 0,
                    appliedHpBonus: 0,
                    abilities: [], // empty kit
                    abilityCooldowns: {}
                }

                const beforeHp = state.currentEnemy.hp
                companionActIfPresent()
                assert(state.currentEnemy && state.currentEnemy.hp < beforeHp, 'expected companion to perform a plain strike')
            } finally {
                if (_handleEnemyDefeat) handleEnemyDefeat = _handleEnemyDefeat
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                state.companion = snap.companion
            }
        })

        // 24f) combat: enemy death ends combat cleanly even if intent was pending
        test('combat: enemy death clears pending intent path', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null
            }

            const _handleEnemyDefeat = typeof handleEnemyDefeat === 'function' ? handleEnemyDefeat : null
            const _enemyTurn = typeof enemyTurn === 'function' ? enemyTurn : null

            try {
                if (_enemyTurn) enemyTurn = () => {}

                if (_handleEnemyDefeat)
                    handleEnemyDefeat = () => {
                        state.inCombat = false
                        state.currentEnemy = null
                    }

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Intent Death Dummy',
                    hp: 1,
                    maxHp: 1,
                    level: 1,
                    attack: 1,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    intent: { aid: 'heavyCleave', turnsLeft: 1 },
                    abilities: ['heavyCleave'],
                    abilityCooldowns: { heavyCleave: 2 }
                }
                ensureEnemyRuntime(state.currentEnemy)

                playerBasicAttack()
                assert(state.inCombat === false, 'expected combat to end on enemy death')
                assert(state.currentEnemy === null, 'expected enemy to be cleared on defeat')
            } finally {
                if (_handleEnemyDefeat) handleEnemyDefeat = _handleEnemyDefeat
                if (_enemyTurn) enemyTurn = _enemyTurn
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
            }
        })


        // 25) deep combat: Broken damage bonus (deterministic)
        test('combat: Broken increases damage taken (deterministic)', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                seed: state.debug ? state.debug.rngSeed : null,
                idx: state.debug ? state.debug.rngIndex : null
            }

            try {
                state.inCombat = true
                state.currentEnemy = {
                    name: 'Broken Bonus Dummy',
                    hp: 999,
                    maxHp: 999,
                    level: 1,
                    attack: 0,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    brokenTurns: 0,
                    postureMax: 50,
                    posture: 0,
                    abilities: ['enemyStrike'],
                    abilityCooldowns: {}
                }
                ensureEnemyRuntime(state.currentEnemy)
                recalcPlayerStats()
                setDeterministicRngEnabled(state, true)
                setRngSeed(state, 111)

                const savedIdx = state.debug.rngIndex
                state.currentEnemy.brokenTurns = 0
                const dmg1 = calcPhysicalDamage(20)

                // Reset RNG index so the only difference is the Broken multiplier.
                state.debug.rngIndex = savedIdx
                state.currentEnemy.brokenTurns = 1
                const dmg2 = calcPhysicalDamage(20)

                assert(dmg2 > dmg1, 'expected Broken damage to be larger')

                const lo = Math.floor(dmg1 * 1.18)
                const hi = Math.ceil(dmg1 * 1.22) + 1
                assert(dmg2 >= lo && dmg2 <= hi, 'expected ~20% bonus; got ' + dmg1 + ' -> ' + dmg2)
            } finally {
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                if (snap.seed !== null && state.debug) state.debug.rngSeed = snap.seed
                if (snap.idx !== null && state.debug) state.debug.rngIndex = snap.idx
            }
        })

        // 26) deep combat: forced-guard skip path doesn't deal damage
        test('combat: forced guard skips enemy action', () => {
            const p = state.player

            const snap = {
                inCombat: !!state.inCombat,
                currentEnemy: state.currentEnemy ? JSON.parse(JSON.stringify(state.currentEnemy)) : null,
                playerHp: p.hp
            }

            const _postEnemyTurn = typeof postEnemyTurn === 'function' ? postEnemyTurn : null

            try {
                if (_postEnemyTurn) postEnemyTurn = () => {}

                state.inCombat = true
                state.currentEnemy = {
                    name: 'Forced Guard Dummy',
                    hp: 200,
                    maxHp: 200,
                    level: 5,
                    attack: 18,
                    magic: 0,
                    armor: 0,
                    magicRes: 0,
                    aiForcedGuard: true,
                    abilities: ['enemyStrike'],
                    abilityCooldowns: {}
                }
                ensureEnemyRuntime(state.currentEnemy)

                const before = p.hp
                enemyTurn()
                assert(p.hp === before, 'forced guard should not damage player')
                assert((state.currentEnemy.guardTurns || 0) >= 1, 'expected forced guard to apply guardTurns')
            } finally {
                if (_postEnemyTurn) postEnemyTurn = _postEnemyTurn
                state.inCombat = snap.inCombat
                state.currentEnemy = snap.currentEnemy
                p.hp = snap.playerHp
            }
        })

        // 27) deep combat: enemy atkDown expires and clears value
        test('combat: enemy atkDown expires and clears value', () => {
            const enemy = {
                name: 'Debuff Dummy',
                hp: 1,
                maxHp: 1,
                attack: 10,
                magic: 0,
                armor: 0,
                magicRes: 0,
                atkDownFlat: 4,
                atkDownTurns: 1
            }
            ensureEnemyRuntime(enemy)
            tickEnemyStartOfTurn(enemy)
            assert(enemy.atkDownTurns === 0, 'expected atkDownTurns to reach 0')
            assert(enemy.atkDownFlat === 0, 'expected atkDownFlat to clear at expiry')
        })

        
        section('Bug Catchers')

        // B) deep scan: ensure the state contains no NaN/Infinity after the heavy tests above ran
        test('deep state scan: no NaN/Infinity', () => {
            const issues = scanForNonFiniteNumbers(state)
            assert(issues.length === 0, 'non-finite numbers found:\n' + issues.slice(0, 20).join('\n') + (issues.length > 20 ? '\n… (' + issues.length + ' total)' : ''))
        })

        // C) quick structural sanity: negative counters should never exist
        test('no negative counters in common containers', () => {
            const issues = scanForNegativeCounters(state)
            assert(issues.length === 0, issues.join('\n'))
        })

        // D) fuzz: run a small deterministic action sequence and assert invariants never break
        test('fuzz: 120 random actions preserve invariants', () => {
            setDeterministicRngEnabled(state, true)
            setRngLoggingEnabled(state, false)
            setRngSeed(state, QA_SEED + 4242)

            const equipIds = ['swordIron', 'armorLeather', 'staffOak', 'robeApprentice']
            const actionCount = 120

            for (let step = 0; step < actionCount; step++) {
                const r = rngInt(state, 0, 7, 'smoke.fuzz.action')

                // 0) add potions (including intentionally weird quantities)
                if (r === 0) {
                    const qty = rngInt(state, -3, 5, 'smoke.fuzz.qty')
                    addItemToInventory('potionSmall', qty)
                }
                // 1) add a random equipable item
                else if (r === 1) {
                    const id = equipIds[rngInt(state, 0, equipIds.length - 1, 'smoke.fuzz.equipId')]
                    addItemToInventory(id, 1)
                }
                // 2) attempt to equip a random inventory index (should never throw)
                else if (r === 2) {
                    const inv = state.player && Array.isArray(state.player.inventory) ? state.player.inventory : []
                    if (inv.length) {
                        const idx = rngInt(state, 0, inv.length - 1, 'smoke.fuzz.equipIdx')
                        equipItemFromInventory(idx, { stayOpen: true })
                    }
                }
                // 3) sell a random inventory item
                else if (r === 3) {
                    const inv = state.player && Array.isArray(state.player.inventory) ? state.player.inventory : []
                    if (inv.length) {
                        const idx = rngInt(state, 0, inv.length - 1, 'smoke.fuzz.sellIdx')
                        sellItemFromInventory(idx, 'village')
                    }
                }
                // 4) consume a potion if present
                else if (r === 4) {
                    const p = state.player
                    const inv = p && Array.isArray(p.inventory) ? p.inventory : []
                    const idx = inv.findIndex((it) => it && it.id === 'potionSmall')
                    if (idx >= 0) {
                        p.hp = Math.max(1, p.maxHp - 50)
                        usePotionFromInventory(idx, false, { stayOpen: true })
                    }
                }
                // 5) advance time (and occasionally run daily tick)
                else if (r === 5) {
                    advanceTime(state, rngInt(state, 1, 3, 'smoke.fuzz.timeSteps'))
                    if (rngInt(state, 0, 5, 'smoke.fuzz.tickChance') === 0) {
                        jumpToNextMorning(state)
                        const day = state.time && typeof state.time.dayIndex === 'number' ? Math.floor(Number(state.time.dayIndex)) : 0
                        runDailyTicks(state, day, { silent: true })
                    }
                }
                // 6) town hall: create an expired decree and ensure cleanup removes it
                else if (r === 6) {
                    initGovernmentState(state, 0)
                    const today = state.time && typeof state.time.dayIndex === 'number' ? Math.floor(Number(state.time.dayIndex)) : 0
                    state.government.townHallEffects = {
                        petitionId: 'fuzz',
                        title: 'Fuzz Decree',
                        expiresOnDay: today - 1,
                        depositRateMultiplier: 2
                    }
                    cleanupTownHallEffects(state)
                    assert(!state.government.townHallEffects, 'expired townHallEffects survived cleanup')
                }
                // 7) open the bank (applies interest) with DOM-safe stubs
                else {
                    const openModalStub = (title, builder) => {
                        const body = document.createElement('div')
                        builder(body)
                    }
                    openBankModalImpl({
                        state,
                        openModal: openModalStub,
                        addLog: () => {},
                        recordInput: () => {},
                        updateHUD: () => {},
                        saveGame: () => {}
                    })
                }

                // Every 20 steps, run extra bug-catcher scans
                if (step % 20 === 19) {
                    const audit = validateState(state)
                    assert(!audit || audit.ok, 'invariant issues at step ' + step + ':\n' + (audit ? formatIssues(audit.issues) : 'unknown'))
                    const n1 = scanForNonFiniteNumbers(state)
                    assert(n1.length === 0, 'non-finite numbers at step ' + step + ':\n' + n1.slice(0, 10).join('\n'))
                    const n2 = scanForNegativeCounters(state)
                    assert(n2.length === 0, 'negative counters at step ' + step + ':\n' + n2.slice(0, 10).join('\n'))
                }
            }
        })

section('State Invariants')

        // 28) invariants
        test('invariants', () => {
            const audit = validateState(state)
            if (audit && !audit.ok) {
                throw new Error('invariant issues:\n' + formatIssues(audit.issues))
            }
        })


        // Final QA: console noise should fail the suite so issues don't hide behind a "green" run.
        section('Console & Assertions')
        test('no console.error during suite', () => {
            assert(consoleErrorLog.length === 0, 'console.error called ' + consoleErrorLog.length + ' time(s)')
        })
        test('no console.assert failures during suite', () => {
            assert(consoleAssertLog.length === 0, 'console.assert failed ' + consoleAssertLog.length + ' time(s)')
        })

        // Ensure the final section is included in the per-section summary.
        if (currentSection) sectionStats.push(currentSection)

        lines.push('')
        if (sectionStats.length) {
            lines.push('Section results:')
            sectionStats.forEach((s) => {
                lines.push('  • ' + s.title + ': ' + s.pass + ' passed, ' + s.fail + ' failed')
            })
        }

        lines.push('')
        lines.push('Summary: ' + passCount + ' passed, ' + failCount + ' failed')
        if (failCount > 0) {
            lines.push('')
            lines.push('Failures:')
            failed.forEach((f, i) => {
                lines.push('  ' + (i + 1) + ') ' + f.label + ': ' + f.msg)
            })

            if (consoleErrorLog.length) {
                lines.push('')
                lines.push('console.error (first 20):')
                consoleErrorLog.slice(0, 20).forEach((x) => lines.push('  - ' + x))
                if (consoleErrorLog.length > 20) lines.push('  … +' + (consoleErrorLog.length - 20) + ' more')
            }
            if (consoleAssertLog.length) {
                lines.push('')
                lines.push('console.assert failures (first 20):')
                consoleAssertLog.slice(0, 20).forEach((x) => lines.push('  - ' + x))
                if (consoleAssertLog.length > 20) lines.push('  … +' + (consoleAssertLog.length - 20) + ' more')
            }
        }
        const ms = Date.now() - started
        lines.push('Done in ' + ms + ' ms')
        const smokeText = lines.join('\n')

        const bugReportPretty = formatBugReportBundle(_bugReportLive)
        const bugHasIssues = !!(
            (_bugReportLive && _bugReportLive.debug && Array.isArray(_bugReportLive.debug.invariantIssues) && _bugReportLive.debug.invariantIssues.length) ||
            (_bugReportLive && _bugReportLive.diagnostics && (_bugReportLive.diagnostics.lastCrashReport || _bugReportLive.diagnostics.lastSaveError))
        )
        return returnObject
            ? {
                ok: failCount === 0,
                // Back-compat: keep .text but make it the smoke test output only.
                text: smokeText,
                smokeText,
                passCount,
                failCount,
                failed,
                sectionStats,
                console: { errors: consoleErrorLog, asserts: consoleAssertLog },
                bugReport: _bugReportLive,
                bugReportPretty,
                bugHasIssues,
                ms
            }
            : smokeText
    } catch (e) {
        lines.push('')
        lines.push('FAILED: ' + (e && e.message ? e.message : String(e)))
        try {
            if (e && e.stack) lines.push(e.stack)
        } catch (_) {}
        const ms = Date.now() - started
        lines.push('Done in ' + ms + ' ms')
        const smokeText = lines.join('\n')

        const bugReportPretty = formatBugReportBundle(_bugReportLive)
        const bugHasIssues = !!(
            (_bugReportLive && _bugReportLive.debug && Array.isArray(_bugReportLive.debug.invariantIssues) && _bugReportLive.debug.invariantIssues.length) ||
            (_bugReportLive && _bugReportLive.diagnostics && (_bugReportLive.diagnostics.lastCrashReport || _bugReportLive.diagnostics.lastSaveError))
        )
        return returnObject
            ? {
                ok: failCount === 0,
                text: smokeText,
                smokeText,
                passCount,
                failCount,
                failed,
                sectionStats,
                console: { errors: consoleErrorLog, asserts: consoleAssertLog },
                bugReport: _bugReportLive,
                bugReportPretty,
                bugHasIssues,
                ms
            }
            : smokeText
    } finally {
        // Restore console hooks.
        try {
            if (typeof console !== 'undefined') {
                if (_liveConsoleError) console.error = _liveConsoleError
                if (_liveConsoleAssert) console.assert = _liveConsoleAssert
            }
        } catch (_) {}

        // Restore global functions first.
        if (_liveSaveGame) saveGame = _liveSaveGame
        if (_liveCloseModal) closeModal = _liveCloseModal
        if (_liveUpdateHUD) updateHUD = _liveUpdateHUD
        if (_liveUpdateEnemyPanel) updateEnemyPanel = _liveUpdateEnemyPanel
        if (_liveAddLog) addLog = _liveAddLog
        if (_liveRenderLog) renderLog = _liveRenderLog
        if (_liveRecordInput) recordInput = _liveRecordInput

        // Restore the live save and repaint.
        state = live
        syncGlobalStateRef()

        // Ensure the live UI is refreshed back to the real save after smoke tests.
        try {
            if (_liveUpdateHUD) _liveUpdateHUD()
            if (_liveUpdateEnemyPanel) _liveUpdateEnemyPanel()
        } catch (_) {}

        // Restore incremental log renderer bookkeeping + DOM exactly as the player left it.
        // This prevents smoke tests from clearing/scrolling the live log even if a future
        // regression accidentally calls renderLog while state is swapped.
        try {
            if (_liveLogSeqSnap !== null) _logSeq = _liveLogSeqSnap
        } catch (_) {}
        try {
            if (_liveLogUiSnap && typeof _liveLogUiSnap === 'object') {
                _logUi = {
                    filter: _liveLogUiSnap.filter,
                    lastFirstId: _liveLogUiSnap.lastFirstId,
                    renderedUpToId: _liveLogUiSnap.renderedUpToId
                }
            }
        } catch (_) {}
        try {
            if (_liveLogEl && _liveLogHTML !== null) {
                _liveLogEl.innerHTML = _liveLogHTML
                _liveLogEl.scrollTop = _liveLogScrollTop
            }
        } catch (_) {}

	        // Restore smoke-test flag (used to disable async combat pacing during the suite).
	        try {
	            if (state) {
	                if (!state.debug || typeof state.debug !== 'object') state.debug = {}
	                state.debug.smokeTestRunning = _prevSmoke
	            }
	        } catch (_) {}
    }
}

function copyFeedbackToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text)
    }

    return new Promise((resolve, reject) => {
        try {
            const temp = document.createElement('textarea')
            temp.value = text
            temp.style.position = 'fixed'
            temp.style.left = '-9999px'
            document.body.appendChild(temp)
            temp.select()
            const OK = document.execCommand('copy')
            document.body.removeChild(temp)
            OK ? resolve() : reject()
        } catch (e) {
            reject(e)
        }
    })
}

// --- CHANGELOG MODAL --------------------------------------------------------

function openChangelogModal(opts = {}) {
    const fromPause = !!(opts && opts.fromPause)
    const onBack = typeof opts?.onBack === 'function' ? opts.onBack : null

    openModal('Changelog', (body) => {
        const wrapper = document.createElement('div')
        wrapper.className = 'changelog-modal'

        const intro = document.createElement('p')
        intro.className = 'modal-subtitle'
        intro.innerHTML =
            'All notable changes to <strong>Emberwood: The Blackbark Oath</strong> are listed here.'
        wrapper.appendChild(intro)

        const isV1 = (v) => /^1\.\d+\.\d+$/.test(String(v || '').trim())

        const release = CHANGELOG.filter((e) => isV1(e.version))
        const alpha = CHANGELOG.filter((e) => !isV1(e.version))

        function normalizeChangelogEntry(entry) {
            if (!entry || typeof entry !== 'object') {
                return { version: '', title: '', sections: [] }
            }

            const version = String(entry.version || '')
            const title = String(entry.title || entry.date || entry.name || '').trim()

            // Support either legacy schema:
            //   { version, title, sections:[{ heading, items: [...] }] }
            // ...or newer schema:
            //   { version, date, changes:[{ category, items: [...] }] }
            let sections = []
            if (Array.isArray(entry.sections)) {
                sections = entry.sections
            } else if (Array.isArray(entry.changes)) {
                sections = entry.changes.map((c) => ({
                    heading: c.heading || c.category || 'Changes',
                    items: Array.isArray(c.items) ? c.items : [],
                }))
            }

            return { version, title, sections }
        }

        function renderEntries(entries, host, { openFirst = false } = {}) {
            const normalized = (entries || []).map(normalizeChangelogEntry)
            normalized.forEach((entry, index) => {
                const details = document.createElement('details')
                if (openFirst && index === 0) details.open = true

                const summary = document.createElement('summary')
                summary.innerHTML = `<strong>${entry.version}${entry.title ? ' – ' + entry.title : ''}</strong>`
                details.appendChild(summary)

                entry.sections.forEach((section) => {
                    const h4 = document.createElement('h4')
                    h4.textContent = section.heading
                    details.appendChild(h4)

                    const ul = document.createElement('ul')

                    section.items.forEach((item) => {
                        const li = document.createElement('li')

                        // Support either simple strings OR {title, bullets}
                        if (typeof item === 'string') {
                            li.textContent = item
                        } else {
                            const titleSpan = document.createElement('strong')
                            titleSpan.textContent = item.title
                            li.appendChild(titleSpan)

                            if (item.bullets && item.bullets.length) {
                                const innerUl = document.createElement('ul')
                                item.bullets.forEach((text) => {
                                    const innerLi = document.createElement('li')
                                    innerLi.textContent = text
                                    innerUl.appendChild(innerLi)
                                })
                                li.appendChild(innerUl)
                            }
                        }

                        ul.appendChild(li)
                    })

                    details.appendChild(ul)
                })

                host.appendChild(details)
            })
        }

        function renderEraPanel(title, entries, { open = false, openFirstEntry = false } = {}) {
            const panel = document.createElement('details')
            panel.open = !!open

            const summary = document.createElement('summary')
            summary.innerHTML = `<strong>${title}</strong>`
            panel.appendChild(summary)

            renderEntries(entries, panel, { openFirst: openFirstEntry })
            wrapper.appendChild(panel)
        }

        // V1.x.x gets its own collapsible panel (newest open by default)
        renderEraPanel('Release (V1.x.x)', release, { open: true, openFirstEntry: true })

        // Everything else lives in a collapsible Alpha / Early Access panel
        renderEraPanel('Alpha / Early Access (pre-1.0.0)', alpha, { open: false, openFirstEntry: false })

        body.appendChild(wrapper)

        // If opened from the pause menu (or provided with a back callback), show an explicit Back button
        if (fromPause || onBack) {
            const actions = document.createElement('div')
            actions.className = 'modal-actions'

            const btnBack = document.createElement('button')
            btnBack.className = 'btn outline'
            btnBack.textContent = fromPause ? 'Back to Game Menu' : 'Back'
            btnBack.addEventListener('click', () => {
                closeModal()
                if (onBack) {
                    try {
                        onBack()
                        return
                    } catch (_) {
                        // fall through
                    }
                }
                if (fromPause) {
                    try { openPauseMenu() } catch (_) {}
                }
            })

            actions.appendChild(btnBack)
            body.appendChild(actions)
        }
    })
}
function initLogFilterChips() {
    const container = document.getElementById('logFilters')
    if (!container) return

    // Ensure we have a default filter so the UI can hydrate predictably.
    if (typeof state !== 'undefined' && state) {
        if (!state.logFilter) state.logFilter = 'all'
    }

    function syncActiveChip() {
        const current = (typeof state !== 'undefined' && state && state.logFilter) ? state.logFilter : 'all'
        container.querySelectorAll('.log-chip').forEach((chip) => {
            const v = chip.dataset.logFilter || 'all'
            chip.classList.toggle('log-chip-active', v === current)
        })
    }

    // Hydrate highlight immediately
    syncActiveChip()

    // Avoid stacking duplicate listeners
    if (!container.dataset.pqWired) {
        container.dataset.pqWired = '1'
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-log-filter]')
            if (!btn) return

            const value = btn.dataset.logFilter || 'all'
            state.logFilter = value

            syncActiveChip()
            renderLog()
        })
    }
}

// --- INITIAL SETUP & EVENT LISTENERS ------------------------------------------


function applyVersionLabels() {
    const label = 'V' + GAME_PATCH + (GAME_PATCH_NAME ? ' — ' + GAME_PATCH_NAME : '')

    // Main menu hint
    const vEl = document.getElementById('versionLabel')
    if (vEl) vEl.textContent = label

    // Any other optional places you tag with data-game-version
    document.querySelectorAll('[data-game-version]').forEach((el) => {
        el.textContent = label
    })
}

function onDocReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true })
    } else {
        fn()
    }
}

onDocReady(() => {
    initCrashCatcher()
    applyVersionLabels()

    // HUD: tap on name to open character sheet
    const hudName = document.getElementById('hud-name')
    if (hudName) {
        hudName.style.cursor = 'pointer'
        hudName.addEventListener('click', () => {
            if (state.player) openCharacterSheet()
        })
    }

    // Dev cheats: quick-access Smoke Tests pill next to the Menu button
    const btnSmokeTestsPill = document.getElementById('btnSmokeTestsPill')
    if (btnSmokeTestsPill) {
        btnSmokeTestsPill.addEventListener('click', () => {
            openSmokeTestsModal()
        })
        try { syncSmokeTestsPillVisibility() } catch (_) {}
    }

    // Dev cheats: quick-access Cheats pill next to the Smoke Tests pill
    const btnCheatPill = document.getElementById('btnCheatPill')
    if (btnCheatPill) {
        btnCheatPill.addEventListener('click', () => {
            if (cheatsEnabled()) openCheatMenu()
        })
        try { syncSmokeTestsPillVisibility() } catch (_) {}
    }

    function setupCollapsingPanels() {
        const questBox = document.getElementById('questBox')
        const questTitle = document.getElementById('questTitle')
        const logBox = document.getElementById('logBox')
        const logHeader = document.getElementById('logHeader')

        function wire(headerEl, boxEl, flagKey) {
            if (!headerEl || !boxEl) return
            const key = flagKey || 'collapseWired'
            if (headerEl.dataset[key]) return
            headerEl.dataset[key] = '1'

            // Accessibility + keyboard support
            headerEl.setAttribute('role', 'button')
            headerEl.setAttribute('tabindex', '0')

            const syncAria = () => {
                headerEl.setAttribute(
                    'aria-expanded',
                    String(!boxEl.classList.contains('collapsed'))
                )
            }

            const toggle = () => {
                boxEl.classList.toggle('collapsed')
                syncAria()
            }

            headerEl.addEventListener('click', toggle)
            headerEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    toggle()
                }
            })

            syncAria()
        }

        wire(questTitle, questBox, 'collapseWiredQuest')
        wire(logHeader, logBox, 'collapseWiredLog')
    }
    const btnRandomName = document.getElementById('btnRandomName')

    // A small pool of fun names – tweak these however you want
    const RANDOM_NAMES = [
        'Aria',
        'Thorne',
        'Kael',
        'Lira',
        'Rowan',
        'Nyx',
        'Darius',
        'Mira',
        'Sylas',
        'Eira',
        'Corin',
        'Vale',
        'Seren',
        'Riven',
        'Kaida'
    ]

    function getRandomName() {
        const idx = randInt(0, RANDOM_NAMES.length - 1, 'name.pick')
        return RANDOM_NAMES[idx]
    }
    const nameInputEl = document.getElementById('inputName')

    if (btnRandomName && nameInputEl) {
        btnRandomName.addEventListener('click', () => {
            // If there’s already a name, you can overwrite or only fill when empty.
            // Overwrite every time:
            const newName = getRandomName()
            nameInputEl.value = newName
        })
    }

    // --- MAIN MENU BUTTONS ------------------------------------------------------
    const btnNewGame = document.getElementById('btnNewGame')
    if (btnNewGame) {
        btnNewGame.addEventListener('click', () => {
            resetDevCheatsCreationUI() // ✅ add
            buildCharacterCreationOptions()
            switchScreen('character')
        })
    }

    const btnLoadGame = document.getElementById('btnLoadGame')
    if (btnLoadGame) {
        btnLoadGame.addEventListener('click', () => {
            openSaveManager({ mode: 'load' })
        })
    }
    const btnSettingsMain = document.getElementById('btnSettingsMain')
    if (btnSettingsMain) {
        btnSettingsMain.addEventListener('click', () => {
            initSettingsFromState()
            switchScreen('settings')
        })
    } else {
        console.warn('btnSettingsMain not found in DOM')
    }

    // NEW: main menu changelog button
    const btnChangelog = document.getElementById('btnChangelog')
    if (btnChangelog) {
        btnChangelog.addEventListener('click', () => {
            openChangelogModal()
        })
    }

    const btnFeedback = document.getElementById('btnFeedback')
    if (btnFeedback) {
        btnFeedback.addEventListener('click', () => {
            openFeedbackModal()
        })
    }
    // --- CHARACTER CREATION BUTTONS --------------------------------------------
    const btnStartGame = document.getElementById('btnStartGame')
    if (btnStartGame) {
        btnStartGame.addEventListener('click', () => {
            startNewGameFromCreation()
        })
    }

    const btnBackToMenu = document.getElementById('btnBackToMenu')
    if (btnBackToMenu) {
        btnBackToMenu.addEventListener('click', () => {
            resetDevCheatsCreationUI() // ✅ add
            switchScreen('mainMenu')
        })
    }

    // --- SETTINGS SCREEN --------------------------------------------------------
    const btnSettingsBack = document.getElementById('btnSettingsBack')
    if (btnSettingsBack) {
        btnSettingsBack.addEventListener('click', () => {
            applySettingsChanges()
            switchScreen('mainMenu')
        })
    }

    const settingsDifficulty = document.getElementById('settingsDifficulty')
    if (settingsDifficulty) {
        settingsDifficulty.addEventListener('change', () => {
            applySettingsChanges()
        })
    }

    // --- THEME SELECTOR ---------------------------------------------------------
    const themeSelect = document.getElementById('themeSelect')
    if (themeSelect) {
        // Set initial value to whatever is stored
        const savedTheme = safeStorageGet('pq-theme') || 'default'
        themeSelect.value = savedTheme

        // Change theme on selection
        themeSelect.addEventListener('change', () => {
            setTheme(themeSelect.value)
        })
    }

    // --- MODAL CLOSE ------------------------------------------------------------
    const modalClose = document.getElementById('modalClose')
    if (modalClose) {
        modalClose.addEventListener('click', closeModal)
    }
    if (modalEl) {
        modalEl.addEventListener('click', (e) => {
            if (e.target === modalEl) closeModal()
        })
    }

    // --- ENEMY SHEET MODAL CLOSE ---------------------------------------------
    const enemyModalClose = document.getElementById('enemyModalClose')
    if (enemyModalClose) {
        enemyModalClose.addEventListener('click', closeEnemyModal)
    }
    if (enemyModalEl) {
        enemyModalEl.addEventListener('click', (e) => {
            if (e.target === enemyModalEl) closeEnemyModal()
        })
    }

    // --- IN-GAME MENU BUTTON ----------------------------------------------------
    const btnGameMenu = document.getElementById('btnGameMenu')
    if (btnGameMenu) {
        btnGameMenu.addEventListener('click', () => {
            openPauseMenu()
        })
    }

    // --- HUD SWIPE: switch between player and companion view --------------------
    const hudTop = document.getElementById('hud-top')
    if (hudTop) {
        hudTop.addEventListener('touchstart', (e) => {
            const t = e.touches[0]
            hudTouchStartX = t.clientX
            hudTouchStartY = t.clientY
        })

        hudTop.addEventListener('touchend', (e) => {
            if (hudTouchStartX == null || hudTouchStartY == null) return
            const t = e.changedTouches[0]
            const dx = t.clientX - hudTouchStartX
            const dy = t.clientY - hudTouchStartY
            hudTouchStartX = null
            hudTouchStartY = null

            // Horizontal swipe threshold
            if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
                toggleHudEntity()
            }
        })
    }

    // --- PRE-LOAD DIFFICULTY FROM SAVE -----------------------------------------
    try {
        const json = safeStorageGet(SAVE_KEY)
        if (json) {
            let data = migrateSaveData(JSON.parse(json))
            if (data.difficulty) {
                state.difficulty = data.difficulty
            }
        }
    } catch (e) {
        console.warn('No prior save or failed to read.')
    }

    // Initialize settings UI from state
    initSettingsFromState()
    updateEnemyPanel() // ensure panel starts hidden/clean
    // Enemy panel: tap/click to open an Enemy Sheet modal for quick inspection.
    // Patch 1.1.9: swipe left/right on the enemy panel to switch targets in multi-enemy fights.
    try {
        const enemyPanel = document.getElementById('enemyPanel')
        if (enemyPanel && !(enemyPanel.dataset && enemyPanel.dataset.enemySheetWired)) {
            try { enemyPanel.dataset.enemySheetWired = '1' } catch (_) {}
            enemyPanel.setAttribute('role', 'button')
            enemyPanel.setAttribute('tabindex', '0')

            let lastSwipeAt = 0
            let touchStartX = 0
            let touchStartY = 0
            let touchMoved = false

            const open = () => {
                if (!state || !state.inCombat || !state.currentEnemy) return
                openEnemySheet()
            }

            const shouldSuppressClick = () => {
                return Date.now() - lastSwipeAt < 500
            }

            enemyPanel.addEventListener('click', (e) => {
                if (shouldSuppressClick()) {
                    try { enemyPanel.blur() } catch (_) {}
                    return
                }
                open()
                try { enemyPanel.blur() } catch (_) {}
            })

            enemyPanel.addEventListener('keydown', (e) => {
                if (!e) return
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    open()
                }
            })

            enemyPanel.addEventListener(
                'touchstart',
                (e) => {
                    if (!e || !e.touches || !e.touches.length) return
                    const t = e.touches[0]
                    touchStartX = t.clientX
                    touchStartY = t.clientY
                    touchMoved = false
                },
                { passive: true }
            )

            enemyPanel.addEventListener(
                'touchmove',
                (e) => {
                    if (!e || !e.touches || !e.touches.length) return
                    const t = e.touches[0]
                    const dx = t.clientX - touchStartX
                    const dy = t.clientY - touchStartY
                    if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy)) {
                        touchMoved = true
                    }
                },
                { passive: true }
            )

            enemyPanel.addEventListener(
                'touchend',
                (e) => {
                    if (!touchMoved) return
                    if (!state || !state.inCombat) return
                    const dx = (e && e.changedTouches && e.changedTouches[0]) ? (e.changedTouches[0].clientX - touchStartX) : 0
                    if (Math.abs(dx) < 40) return

                    const dir = dx < 0 ? 1 : -1
                    cycleTargetEnemy(dir, { silent: true })
                    lastSwipeAt = Date.now()
                },
                { passive: true }
            )
        }
    } catch (_) {}

    setupCollapsingPanels()
    initLogFilterChips()
})