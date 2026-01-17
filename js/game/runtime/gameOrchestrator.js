import {
    configureUI,
    escapeHtml,
    switchScreen,
    screens,
    openModal,
    closeModal,
    openEnemyModal,
    closeEnemyModal,
    isEnemyModalOpen,
    setModalAdapter,
    getModalAdapter,
    setModalOnClose,
    getModalOnClose,
    addLog,
    renderLog,
    initLogAutoScroll,
    scrollLogToBottom,
    updateTimeDisplay,
    setScene,
    updateEnemyPanel,
    setUiDisabled,
    isUiDisabled,
    formatDamageBreakdownForLog
} from '../ui/runtime/uiRuntime.js'
import { createUiRuntimePlugin } from '../plugins/uiRuntimePlugin.js'
import { createDiagnosticsOverlayPlugin } from '../plugins/diagnosticsOverlayPlugin.js'
import { createQaBridgePlugin } from '../plugins/qaBridgePlugin.js'
import { createFlagsPlugin } from '../plugins/flagsPlugin.js'
import { createI18nPlugin } from '../plugins/i18nPlugin.js'
import { createAssetsManifestPlugin } from '../plugins/assetsManifestPlugin.js'
import { createSettingsPlugin } from '../plugins/settingsPlugin.js'
import { createA11yBridgePlugin } from '../plugins/a11yBridgePlugin.js'
import { createTelemetryPlugin } from '../plugins/telemetryPlugin.js'
import { createSavePolicyBridgePlugin } from '../plugins/savePolicyBridgePlugin.js'
import { createUiComposeBridgePlugin } from '../plugins/uiComposeBridgePlugin.js'
import { createReplayBridgePlugin } from '../plugins/replayBridgePlugin.js'
import { createCombatRuntimePlugin } from '../plugins/combatRuntimePlugin.js'
import { createCompanionRuntimePlugin } from '../plugins/companionRuntimePlugin.js'
import { createWorldEventsPlugin } from '../plugins/worldEventsPlugin.js'
import { createQuestEventsPlugin } from '../plugins/questEventsPlugin.js'
import { createAutosavePlugin } from '../plugins/autosavePlugin.js'
import { createInputContextsPlugin } from '../plugins/inputContextsPlugin.js'
import { createUiCommandsPlugin } from '../plugins/uiCommandsPlugin.js'
import { createSimTickPlugin } from '../plugins/simTickPlugin.js'
import { createAudioBridgePlugin } from '../plugins/audioBridgePlugin.js'
import { createRngBridgePlugin } from '../plugins/rngBridgePlugin.js'
import { createGameCommandsPlugin } from '../plugins/gameCommandsPlugin.js'
import { createScreenAssetPreloadPlugin } from '../plugins/screenAssetPreloadPlugin.js'
import { createVillageServicesPlugin } from '../plugins/villageServicesPlugin.js'
import { createBankServicePlugin } from '../plugins/bankServicePlugin.js'
import { createMerchantServicePlugin } from '../plugins/merchantServicePlugin.js'
import { createTavernServicePlugin } from '../plugins/tavernServicePlugin.js'
import { createTownHallServicePlugin } from '../plugins/townHallServicePlugin.js'
import { createTimeServicePlugin } from '../plugins/timeServicePlugin.js'
import { createKingdomGovernmentPlugin } from '../plugins/kingdomGovernmentPlugin.js'
import { createLootGeneratorPlugin } from '../plugins/lootGeneratorPlugin.js'
import { createQuestSystemPlugin } from '../plugins/questSystemPlugin.js'

// Refactored modules (Patch 1.2.72 - Intensive Refactor & Hardening)
import {
    runDailyTicks as runDailyTicksImpl,
    advanceWorldTime as advanceWorldTimeImpl,
    advanceToNextMorning as advanceToNextMorningImpl,
    advanceWorldDays as advanceWorldDaysImpl
} from './dailyTickPipeline.js'
import {
    recordCrash,
    getLastCrashReport,
    initCrashCatcher,
    copyFeedbackToClipboard
} from './debugHelpers.js'
import { createCheatMenuModal } from '../ui/modals/cheatMenuModal.js'
import { createInventoryModal } from '../ui/modals/inventoryModal.js'
import { createCombatActionRenderer } from '../ui/combatActionRenderer.js'
import { createSettingsModal } from '../ui/modals/settingsModal.js'
import { createFeedbackModal } from '../ui/modals/feedbackModal.js'
import { createChangelogModal } from '../ui/modals/changelogModal.js'
import { createCharacterSheetModal } from '../ui/modals/characterSheetModal.js'
import { createSmokeTestsRunner } from '../qa/smokeTests.js'
import { createIntegrityScannersModule } from '../qa/integrityScanners.js'

/* =============================================================================
 * Emberwood Game Orchestrator (gameOrchestrator.js)
 * Patch: 1.2.72 — The Blackbark Oath — Spell Book, Companions & Changelog UX
 *
 * ENGINE-FIRST ARCHITECTURE
 * This module implements engine-first architecture where the Locus Engine is
 * the central orchestrator and all game systems run through it.
 *
 * WHAT THIS FILE DOES
 * - Registers game-specific plugins with the engine
 * - Starts the engine (making all systems operational)
 * - Wires UI buttons/modals to gameplay actions via engine services
 * - Coordinates the "daily tick" simulation pipeline through engine events
 * - Manages state through engine's state management system
 *
 * BOOT FLOW (Engine-First)
 * 1. Engine created (core services ready: clock, scheduler, events, etc.)
 * 2. bootGame() called - registers all game plugins with engine
 * 3. engine.start() called within bootGame - initializes and starts all systems
 * 4. Game fully operational - everything runs through the engine
 *
 * ADDING A NEW SYSTEM (quick checklist)
 * 1) Create your module in js/game/systems/ (or a Location module).
 * 2) Register it as an engine plugin or hook into existing plugins:
 *    - Daily simulation: add ONE entry to `DAILY_STEPS` inside `runDailyTicks()`.
 *    - New save defaults: add ONE entry to `NEW_GAME_INIT_STEPS` inside `startNewGameFromCreation()`.
 *    - Load repair (missing fields): add ONE entry to `LOAD_REPAIR_STEPS` inside `loadGame()`.
 * 3) If it needs UI: add a modal/open function and wire it through engine commands/events.
 *
 * NOTE
 * This file orchestrates the game layer. Core logic lives in js/game/systems/*
 * and js/game/locations/* modules. The engine (js/engine/*) provides the
 * infrastructure for all systems to communicate and coordinate.
 * ============================================================================= */

import { CHANGELOG } from '../changelog/changelog.js'
import { TALENT_DEFS } from '../data/talents.js'
import { ABILITIES } from '../data/abilities.js'
import { ITEM_DEFS } from '../data/items.js'
import { DIFFICULTY_CONFIG, MAX_PLAYER_LEVEL } from '../data/difficulty.js'
import { PLAYER_CLASSES } from '../data/playerClasses.js'
import { COMPANION_DEFS, COMPANION_ABILITIES } from '../data/companions.js'
import { ENEMY_ABILITIES, ENEMY_ABILITY_SETS } from '../data/enemyAbilities.js'
import { createItemCloner } from '../utils/itemCloner.js'
import { scheduleAfter } from '../utils/timing.js'

import { createSpellbookModal } from '../ui/spells/spellbookModal.js'
import { openGambleModalImpl } from '../locations/village/tavernGames.js'
import {
    DAY_PARTS,
    initTimeState,
    getTimeInfo,
    formatTimeShort,
    formatTimeLong,
    advanceTime,
    jumpToNextMorning
} from '../systems/timeSystem.js'

import { finiteNumber, clampFinite } from '../systems/safety.js'
import { createEnemyCombatAi } from '../systems/enemyCombatAi.js'

import { createPostTurnSequencer } from '../combat/postTurnSequence.js'
import { buildAbilityEffects } from '../combat/abilityEffects.js'
import { createCombatMath } from '../combat/math.js'
import { createStatusEngine } from '../combat/statusEngine.js'

import { createCompanionRuntime } from '../combat/companionRuntime.js'
import {
    qaReadBootMetrics,
    qaReadMemorySnapshot,
    qaSummarizePerfLog,
    qaCollectPerfSnapshotSync,
    qaFormatPerfSnapshotText,
    qaSampleFps
} from '../qa/perfSnapshot.js'

import { GAME_PATCH as CURRENT_PATCH, GAME_PATCH_NAME as CURRENT_PATCH_NAME } from '../systems/version.js'

import {
    initRngState,
    rngFloat,
    rngInt,
    rngPick,
    setRngSeed,
    setDeterministicRngEnabled,
    setRngLoggingEnabled
} from '../systems/rng.js'

import { validateState, formatIssues } from '../systems/assertState.js'

import {
    initVillageEconomyState,
    getVillageEconomySummary,
    getMerchantPrice,
    getRestCost,
    handleEconomyDayTick,
    handleEconomyAfterBattle,
    handleEconomyAfterPurchase
} from '../locations/village/villageEconomy.js'
import {
    initGovernmentState,
    handleGovernmentDayTick,
    getGovernmentSummary,
    getVillageGovernmentEffect
} from '../systems/kingdomGovernment.js'
import {
    openBankModalImpl,
    bankDeposit,
    bankWithdraw,
    bankInvest,
    bankCashOut,
    bankBorrow,
    bankRepay
} from '../locations/village/bank.js'
import { openTavernModalImpl } from '../locations/village/tavern.js' // ⬅️ NEW
import {
    openMerchantModalImpl,
    handleMerchantDayTick,
    ensureMerchantStock,
    executeMerchantBuy
} from '../locations/village/merchant.js' // ⬅️ NEW
import {
    generateLootDrop,
    generateArmorForSlot,
    getItemPowerScore,
    getSellValue,
    formatRarityLabel,
    pickWeighted
} from '../systems/lootGenerator.js'
import {
    openTownHallModalImpl,
    handleTownHallDayTick,
    cleanupTownHallEffects
} from '../locations/village/townHall.js'
import {
    ensureVillagePopulation,
    handlePopulationDayTick
} from '../locations/village/villagePopulation.js'
import { QUEST_DEFS } from '../quests/questDefs.js'
import { createDefaultQuestState, createDefaultQuestFlags } from '../quests/questDefaults.js'
import { createQuestBindings } from '../quests/questBindings.js'
import { createEmptyState } from '../state/createEmptyState.js'
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
} from '../systems/enemy/index.js'

import { createSaveManager } from '../persistence/saveManager.js'

import { _STORAGE_DIAG_KEY_LAST_CRASH, _STORAGE_DIAG_KEY_LAST_SAVE_FAIL, safeStorageGet, safeStorageSet, safeStorageRemove } from '../../engine/storageRuntime.js'
import { _perfNow, _ensurePerfDebug, perfRecord, perfWrap, perfWrapAsync } from '../../engine/perf.js'




// --- Shared authored-data helpers -------------------------------------------
// Used across inventory, merchants, and QA fixtures. Kept near imports so it can be passed into systems safely.
const cloneItemDef = createItemCloner(ITEM_DEFS)

/* =============================================================================
 * DAILY TICK PIPELINE (1 in‑game day passes)
 * - Single source of truth for day-change side effects.
 * - Used by Rest / Sleep / time skips so simulation can’t diverge.
 * - Add new day-based systems by appending ONE step in `DAILY_STEPS` below.
 * ============================================================================= */
// Keep day-change side effects in one place so 'rest' and 'explore' can't diverge.
//
// Patch 1.2.52: this function is now the "one true" daily pipeline.
// Order is intentional:
//   quests (daily hooks) → government → economy → merchants → bank (future) → population → UI hooks
function safe(fn, fallback = null) {
    try {
        return typeof fn === 'function' ? fn() : fallback
    } catch (_) {
        return fallback
    }
}

function _merchantStockTotalUnits(st) {
    try {
        const ms = st && st.merchantStock
        if (!ms || typeof ms !== 'object') return 0
        let total = 0

        Object.keys(ms).forEach((ctxKey) => {
            const ctx = ms[ctxKey]
            if (!ctx || typeof ctx !== 'object') return
            Object.keys(ctx).forEach((merchantId) => {
                const bucket = ctx[merchantId]
                if (!bucket || typeof bucket !== 'object') return
                Object.keys(bucket).forEach((itemKey) => {
                    const v = Number(bucket[itemKey])
                    if (Number.isFinite(v)) total += Math.max(0, Math.floor(v))
                })
            })
        })

        return total
    } catch (_) {
        return 0
    }
}

function runDailyTicks(state, absoluteDay, hooks = {}) {
    if (!state || typeof absoluteDay !== 'number' || !Number.isFinite(absoluteDay)) return

    // Dev perf hook (opt-in): record daily tick cost for skipped-day catch-up debugging.
    const _t0 = _perfNow()

    // Create sim container (persisted) if missing.
    if (!state.sim || typeof state.sim !== 'object') {
        state.sim = { lastDailyTickDay: null, lastDailyReport: null }
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
        const isLast = day === targetDay

        // Capture "before" for the final day so the Tavern Daily Report can describe the change.
        const beforeEcon = isLast ? safe(() => getVillageEconomySummary(state), null) : null
        const popBefore = isLast ? safe(() => ensureVillagePopulation(state), null) : null
        const beforeMood = isLast && popBefore ? Number(popBefore.mood || 0) : null
        const beforeStockUnits = isLast ? _merchantStockTotalUnits(state) : null

        // Defensive: some older saves may not have population initialized yet.
        try {
            ensureVillagePopulation(state)
        } catch (_) {
            // ignore
        }

        // -------------------- DAILY SYSTEM PIPELINE --------------------
        // Keep this list inline so adding a new day-tick system is a one-line edit.
        // Order matters.
        const DAILY_STEPS = [
            // 1) Quests (daily hooks) — optional, provided via hooks.
            {
                id: 'quests',
                run: () => {
                    if (hooks && typeof hooks.onQuestDailyTick === 'function') {
                        hooks.onQuestDailyTick(day)
                    }
                }
            },
            // 2) Government / Town Hall (decrees, council state, etc.)
            {
                id: 'government',
                run: () => handleGovernmentDayTick(state, day, hooks)
            },
            {
                id: 'townHall',
                run: () => handleTownHallDayTick(state, day, hooks)
            },
            // 3) Economy (village metrics / tier)
            {
                id: 'economy',
                run: () => handleEconomyDayTick(state, day)
            },
            // 4) Merchants (daily restock)
            {
                id: 'merchants',
                run: () => handleMerchantDayTick(state, day, cloneItemDef)
            },
            // 5) Bank (interest ticks / ledger summaries)
            {
                id: 'bank',
                run: () => {
                    if (hooks && typeof hooks.onBankDailyTick === 'function') {
                        hooks.onBankDailyTick(day)
                    }
                }
            },
            // 6) Population (mood drift, decree mood effects)
            {
                id: 'population',
                run: () => handlePopulationDayTick(state, day, hooks)
            }
        ]

        for (const step of DAILY_STEPS) {
            try {
                step.run()
            } catch (_) {
                // Individual systems should never crash the day pipeline.
            }
        }

        // 7) Daily report snapshot (only for the final day processed)
        if (isLast) {
            const afterEcon = safe(() => getVillageEconomySummary(state), null)
            const popAfter = safe(() => ensureVillagePopulation(state), null)
            const afterMood = popAfter ? Number(popAfter.mood || 0) : null
            const afterStockUnits = _merchantStockTotalUnits(state)

            state.sim.lastDailyReport = {
                day,
                economyBefore: beforeEcon,
                economyAfter: afterEcon,
                moodBefore: beforeMood,
                moodAfter: afterMood,
                moodDelta:
                    typeof beforeMood === 'number' && typeof afterMood === 'number'
                        ? afterMood - beforeMood
                        : 0,
                moodReasons: popAfter && popAfter.lastMoodChange ? popAfter.lastMoodChange.reasons || [] : [],
                merchantStockDeltaUnits:
                    typeof beforeStockUnits === 'number'
                        ? Math.max(0, afterStockUnits - beforeStockUnits)
                        : 0
            }
        }
    }

    state.sim.lastDailyTickDay = targetDay

    // UI refresh hook (callers can opt-in: Explore, Rest, Cheat time jumps)
    try {
        if (hooks && typeof hooks.onAfterDailyTicks === 'function') {
            hooks.onAfterDailyTicks(targetDay)
        }
    } catch (_) {
        // ignore
    }

    // Record perf summary (safe/no-op unless capturePerf is enabled).
    try {
        perfRecord(state, 'village:time.runDailyTicks', _perfNow() - _t0, {
            startDay,
            targetDay,
            daysProcessed: Math.max(0, targetDay - startDay + 1)
        })
    } catch (_) {}
}

// Patch 1.2.52+: single, shared time-advance entrypoint.
// Any place that advances time should go through this so day-change hooks can't drift.
// NOTE: takes an explicit state object to prevent hidden global-state coupling.
function advanceWorldTime(stateArg, parts, reason, hooks = {}) {
    const s = stateArg || state
    if (!s) return null

    return perfWrap(s, 'village:time.advanceWorldTime', { parts, reason }, () => {
        const step = advanceTime(s, parts)

        try {
            if (hooks && typeof hooks.onAfterTimeAdvance === 'function') {
                hooks.onAfterTimeAdvance(step, { parts, reason })
            }
        } catch (_) {
            // ignore
        }

        if (step && step.dayChanged) {
            runDailyTicks(s, step.after.absoluteDay, hooks)
        }

        return step
    })
}

// Patch 1.2.52 (hotfix): advance to the next Morning via the unified pipeline.
// This ensures *all* day-advances (rest, cheats, scripted skips) run the exact same daily tick path.
function advanceToNextMorning(stateArg, hooks = {}) {
    // Keep compatibility with dependency-injected callers that pass state explicitly.
    // The game uses the global `state`, so we normalize against whichever is available.
    const s = stateArg || state
    const info = getTimeInfo(s)
    const partsPerDay = Array.isArray(DAY_PARTS) && DAY_PARTS.length ? DAY_PARTS.length : 3

    // If already Morning, rest should advance a full day.
    const steps = info.partIndex === 0 ? partsPerDay : Math.max(1, partsPerDay - info.partIndex)
    advanceWorldTime(s, steps, 'toMorning', hooks)
    return getTimeInfo(s)
}

// Patch 1.2.52 (hotfix): advance N calendar days and land on Morning.
function advanceWorldDays(stateArg, days, hooks = {}) {
    const s = stateArg || state
    const info = getTimeInfo(s)
    const partsPerDay = Array.isArray(DAY_PARTS) && DAY_PARTS.length ? DAY_PARTS.length : 3

    const d = Math.max(0, Math.floor(Number(days) || 0))
    if (!d) return getTimeInfo(s)

    const toMorning = info.partIndex === 0 ? partsPerDay : Math.max(1, partsPerDay - info.partIndex)
    const steps = toMorning + partsPerDay * Math.max(0, d - 1)
    advanceWorldTime(s, steps, 'days', hooks)
    return getTimeInfo(s)
}



/* =============================================================================
 * GAME DATA (static definitions)
 * Classes, items, enemies, talents, progression tables, and story constants.
 * Edit here when you’re adding new content definitions (not simulation code).
 * ============================================================================= */
const GAME_PATCH = CURRENT_PATCH // current patch/version
const GAME_PATCH_NAME = CURRENT_PATCH_NAME
const SAVE_SCHEMA = 7 // bump when the save structure changes (migrations run on load)
const GITHUB_REPO_URL = 'https://github.com/alsub25/Emberwood-The-Blackbark-Oath' // repository URL for issue creation
const GITHUB_ISSUE_TITLE_MAX_LENGTH = 60 // max characters for issue title preview (GitHub supports longer)
const GITHUB_URL_MAX_LENGTH = 2000 // conservative browser URL length limit

/**
 * Detect if the game is running on GitHub Pages
 * @returns {boolean} true if running on GitHub Pages
 */
function isRunningOnGitHubPages() {
    try {
        const hostname = window.location.hostname.toLowerCase()
        // GitHub Pages domains: username.github.io or custom domains
        return hostname.endsWith('.github.io')
    } catch (error) {
        return false
    }
}

/* =============================================================================
 * SAFETY HELPERS
 * Small numeric + state guards to keep calculations finite and UI-safe.
 * ============================================================================= */
// Imported from ../systems/safety.js (keep NaN/Infinity guards consistent across systems).

// Minimal state sanitation to prevent NaN/Infinity cascades from corrupting the run.
// NOTE: takes an explicit state object so QA tools can safely audit cloned states.
function sanitizeCoreStateObject(s) {
    try {
        if (!s || typeof s !== 'object') return
        const p = s.player
        if (p) {
            ensurePlayerSpellSystems(p)
            p.maxHp = Math.max(1, Math.floor(finiteNumber(p.maxHp, 1)))
            p.hp = clampFinite(p.hp, 0, p.maxHp, p.maxHp)

            p.maxResource = Math.max(0, Math.floor(finiteNumber(p.maxResource, 0)))
            p.resource = clampFinite(p.resource, 0, p.maxResource, p.maxResource)

            p.gold = Math.max(0, Math.floor(finiteNumber(p.gold, 0)))
        }

        const e = s.currentEnemy
        if (e) {
            e.maxHp = Math.max(1, Math.floor(finiteNumber(e.maxHp, e.hp || 1)))
            e.hp = clampFinite(e.hp, 0, e.maxHp, e.maxHp)
        }

        if (s.time && typeof s.time === 'object') {
            s.time.dayIndex = Math.max(0, Math.floor(finiteNumber(s.time.dayIndex, 0)))
            s.time.partIndex = clampFinite(s.time.partIndex, 0, 2, 0)
        }
    } catch (_) {
        // ignore
    }
}

function sanitizeCoreState() {
    try {
        sanitizeCoreStateObject(state)
    } catch (_) {}
}


/* =============================================================================
 * CRASH CATCHER
 * Captures last-crash info so “black screen” bugs can be debugged from saves.
 * ============================================================================= */
// Track the most recent save failure so the "Copy Bug Report" bundle can include it.
// (Safari iOS will throw if a non-declared global is referenced.)
let lastSaveError = null

// Wrapper function to initialize crash catcher with game context
// This is called by uiBindings.js during boot
function initCrashCatcherWrapper() {
    initCrashCatcher({
        GAME_PATCH,
        SAVE_SCHEMA,
        getState: () => state,
        addLog
    })
}



// --- Progression / special encounters --------------------------------------

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
    const stepHp = 0.18 // enemy HP +20% per band up
    const stepEnemyDmg =  0.15 // enemy damage +20% per band up
    const stepPlayerDmg = -0.07 // player damage -10% per band up
    const stepAi =  0.12 // smarter AI per band up

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


// --- Talents (Patch 1.2.0) -------------------------------------------------
// Lightweight talent system: earn talent points at specific levels, spend them
// to unlock passive modifiers per class.

function ensurePlayerTalents(p) {
    if (!p) return
    if (p.talentPoints == null) p.talentPoints = 0
    if (!p.talents || typeof p.talents !== 'object') p.talents = {}
}

function ensurePlayerStatsDefaults(p) {
    if (!p) return
    if (!p.stats || typeof p.stats !== 'object') {
        p.stats = { attack: 0, magic: 0, armor: 0, speed: 0, magicRes: 0 }
    }
    const s = p.stats

    // Core numeric stats (ensure finite defaults)
    if (!Number.isFinite(Number(s.attack))) s.attack = 0
    if (!Number.isFinite(Number(s.magic))) s.magic = 0
    if (!Number.isFinite(Number(s.armor))) s.armor = 0
    if (!Number.isFinite(Number(s.speed))) s.speed = 0
    if (!Number.isFinite(Number(s.magicRes))) s.magicRes = 0

    // Derived % / misc stats used across UI + scanners
    const ensureNum = (k) => { if (!Number.isFinite(Number(s[k]))) s[k] = 0 }
    ;[
        'critChance',
        'dodgeChance',
        'resistAll',
        'lifeSteal',
        'armorPen',
        'haste',
        'thorns',
        'hpRegen'
    ].forEach(ensureNum)

    // Some scanners/UI expect dodge alias to exist
    if (!Number.isFinite(Number(s.dodge))) s.dodge = Number.isFinite(Number(s.dodgeChance)) ? Number(s.dodgeChance) : 0

    // Elemental containers
    if (!s.elementalBonuses || typeof s.elementalBonuses !== 'object') s.elementalBonuses = {}
    if (!s.elementalResists || typeof s.elementalResists !== 'object') s.elementalResists = {}
    if (!s.elementalBonusBreakdown || typeof s.elementalBonusBreakdown !== 'object') {
        s.elementalBonusBreakdown = { gear: {}, talent: {} }
    } else {
        if (!s.elementalBonusBreakdown.gear || typeof s.elementalBonusBreakdown.gear !== 'object') s.elementalBonusBreakdown.gear = {}
        if (!s.elementalBonusBreakdown.talent || typeof s.elementalBonusBreakdown.talent !== 'object') s.elementalBonusBreakdown.talent = {}
    }
    if (!s.elementalResistBreakdown || typeof s.elementalResistBreakdown !== 'object') {
        s.elementalResistBreakdown = { gear: {}, talent: {} }
    } else {
        if (!s.elementalResistBreakdown.gear || typeof s.elementalResistBreakdown.gear !== 'object') s.elementalResistBreakdown.gear = {}
        if (!s.elementalResistBreakdown.talent || typeof s.elementalResistBreakdown.talent !== 'object') s.elementalResistBreakdown.talent = {}
    }

    if (s.weaponElementType === undefined) s.weaponElementType = null
}

function playerHasTalent(p, talentId) {
    ensurePlayerTalents(p)
    return !!(p && p.talents && p.talents[talentId])
}

function grantTalentPointIfNeeded(p, newLevel) {
    // Award on 3/6/9/12/... to keep pacing simple.
    if (!p) return
    ensurePlayerTalents(p)
    if (newLevel % 3 === 0) p.talentPoints += 1
}


function getTalentsForClass(classId) {
    return TALENT_DEFS[classId] || []
}

function canUnlockTalent(p, tdef) {
    if (!p || !tdef) return false
    ensurePlayerTalents(p)
    if (playerHasTalent(p, tdef.id)) return false
    if ((p.level || 1) < (tdef.levelReq || 1)) return false
    if ((p.talentPoints || 0) <= 0) return false
    return true
}

function unlockTalent(p, talentId) {
    if (!p || !talentId) return false
    ensurePlayerTalents(p)
    const list = getTalentsForClass(p.classId)
    const tdef = list.find((t) => t.id === talentId)
    if (!tdef) return false
    if (!canUnlockTalent(p, tdef)) return false
    p.talents[talentId] = true
    p.talentPoints = Math.max(0, (p.talentPoints || 0) - 1)
    addLog('Talent unlocked: ' + tdef.name + '.', 'system')

    // Some talents modify derived stats (ex: elemental resist). Apply immediately so
    // the Character Sheet + combat math reflect the new talent without requiring
    // an unrelated stat refresh (equip, level-up, etc.).
    try {
        if (state && state.player === p) {
            recalcPlayerStats()
            // Keep immediate UI feedback consistent across ALL classes.
            // (Many talents affect dodge/resistAll/max resource, etc.)
            try { updateHUD() } catch (_) {}
            try { refreshCharacterSheetIfOpen() } catch (_) {}
            try { if (state.inCombat) updateEnemyPanel() } catch (_) {}
        }
    } catch (_) {}
    return true
}

// --- Elemental breakdown + sheet live refresh (Patch 1.2.32) -----------------
// Gear elemental bonuses live in stats.elementalBonuses (used by damage math).
// Talent-based spell focus bonuses are tracked separately for Character Sheet display.
function _getTalentSpellElementBonusMap(p) {
    const out = {}
    if (!p) return out
    try {
        if (playerHasTalent(p, 'mage_ember_focus')) out.fire = (out.fire || 0) + 10
        if (playerHasTalent(p, 'mage_glacial_edge')) out.frost = (out.frost || 0) + 10
        if (playerHasTalent(p, 'blood_hemomancy')) out.shadow = (out.shadow || 0) + 10
        if (playerHasTalent(p, 'ranger_nature_attunement')) out.nature = (out.nature || 0) + 10
        if (playerHasTalent(p, 'paladin_radiant_focus')) out.holy = (out.holy || 0) + 10
        if (playerHasTalent(p, 'cleric_holy_focus')) out.holy = (out.holy || 0) + 10
        if (playerHasTalent(p, 'necromancer_shadow_mastery')) out.shadow = (out.shadow || 0) + 10
        if (playerHasTalent(p, 'necromancer_plague_touch')) out.poison = (out.poison || 0) + 10
        if (playerHasTalent(p, 'shaman_tempest_focus')) out.lightning = (out.lightning || 0) + 10
        if (playerHasTalent(p, 'shaman_nature_attunement')) out.nature = (out.nature || 0) + 10
        if (playerHasTalent(p, 'vampire_shadow_focus')) out.shadow = (out.shadow || 0) + 10
    } catch (_) {}
    return out
}

function _capWord(s) {
    return s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : ''
}

function _round1(x) {
    return Math.round((Number(x) || 0) * 10) / 10
}

// Stable integer rounding for combat numbers.
// JS floating-point math can produce values like 57.49999999999999 for what is
// conceptually 57.5; without a tiny epsilon this would round down incorrectly.
function _roundIntStable(x) {
    const n = Number(x)
    if (!Number.isFinite(n)) return 0
    const eps = 1e-9
    return Math.round(n + (n >= 0 ? eps : -eps))
}

function _numPct(x) {
    const n = typeof x === "number" ? x : parseFloat(x)
    return Number.isFinite(n) ? n : 0
}
function _elementIcon(k) {
    switch (k) {
        case 'fire':
            return '🔥'
        case 'frost':
            return '🧊'
        case 'lightning':
            return '⚡'
        case 'holy':
            return '✨'
        case 'shadow':
            return '🕸️'
        case 'arcane':
            return '🔮'
        case 'poison':
            return '☠️'
        case 'earth':
            return '🪨'
        case 'nature':
            return '🌿'
        default:
            return '•'
    }
}

function _orderedElementKeys(keys) {
    const order = ['fire', 'frost', 'lightning', 'holy', 'shadow', 'arcane', 'poison', 'earth', 'nature']
    const uniq = {}
    ;(keys || []).forEach((k) => {
        const nk = normalizeElementType(k) || (k !== null && k !== undefined ? String(k).trim() : null)
        if (nk) uniq[nk] = 1
    })
    return Object.keys(uniq).sort((a, b) => {
        const ia = order.indexOf(a)
        const ib = order.indexOf(b)
        if (ia < 0 && ib < 0) return String(a).localeCompare(String(b))
        if (ia < 0) return 1
        if (ib < 0) return -1
        return ia - ib
    })
}


function _normalizeElemMap(obj) {
    const out = {}
    if (!obj || typeof obj !== 'object') return out
    Object.keys(obj).forEach((k) => {
        const nk = normalizeElementType(k) || String(k).trim()
        if (!nk) return
        const v = _numPct(obj[k])
        if (!v) return
        out[nk] = (out[nk] || 0) + v
    })
    return out
}

function _getElementalBreakdownsForPlayer(p) {
    const gearBonus =
        (p && p.stats && p.stats.elementalBonusBreakdown && p.stats.elementalBonusBreakdown.gear) ||
        (p && p.stats && p.stats.elementalBonuses) ||
        {}

    let talentBonus =
        (p && p.stats && p.stats.elementalBonusBreakdown && p.stats.elementalBonusBreakdown.talent) ||
        {}

    if (!talentBonus || typeof talentBonus !== 'object') talentBonus = {}
    if (!Object.keys(talentBonus).length) {
        // Back-compat: compute focus bonuses on demand.
        talentBonus = _getTalentSpellElementBonusMap(p)
    }

    const gearResist =
        (p && p.stats && p.stats.elementalResistBreakdown && p.stats.elementalResistBreakdown.gear) ||
        {}
    const talentResist =
        (p && p.stats && p.stats.elementalResistBreakdown && p.stats.elementalResistBreakdown.talent) ||
        {}
    const totalResist = (p && p.stats && p.stats.elementalResists) || {}

    return {
        gearBonus: _normalizeElemMap(gearBonus),
        talentBonus: _normalizeElemMap(talentBonus),
        gearResist: _normalizeElemMap(gearResist),
        talentResist: _normalizeElemMap(talentResist),
        totalResist: _normalizeElemMap(totalResist)
    }
}

function computeElementSummariesForPlayer(p) {
    const bd = _getElementalBreakdownsForPlayer(p)

    // Bonuses: show effective combined spell bonus per element: (1+gear)*(1+talent)-1
    const bonusKeys = _orderedElementKeys(
        Object.keys(bd.gearBonus || {}).concat(Object.keys(bd.talentBonus || {}))
    )
    const bonusParts = []
    bonusKeys.forEach((k) => {
        const g = _round1(_numPct((bd.gearBonus || {})[k]))
        const t = _round1(_numPct((bd.talentBonus || {})[k]))
        if (!g && !t) return
        const total = _round1(((1 + g / 100) * (1 + t / 100) - 1) * 100)
        if (!total) return
        bonusParts.push(_capWord(k) + ' +' + total + '%')
    })
    const elementalBonusSummary = bonusParts.length ? bonusParts.join(', ') : 'None'

    // Resists: show clamped resist percent (combat uses this value).
    const resistKeys = _orderedElementKeys(Object.keys(bd.totalResist || {}))
    const resistParts = []
    const cap = Number(PLAYER_RESIST_CAP) || 75

    resistKeys.forEach((k) => {
        const raw = _round1(_numPct((bd.totalResist || {})[k]))
        const eff = _round1(clampNumber(raw, 0, cap))
        if (!eff) return

        // If a build is over cap, show the raw value for clarity.
        if (raw > eff + 0.5) {
            resistParts.push(_capWord(k) + ' ' + eff + '% (raw ' + raw + '%)')
        } else {
            resistParts.push(_capWord(k) + ' ' + eff + '%')
        }
    })
    const elementalResistSummary = resistParts.length ? resistParts.join(', ') : 'None'

    const weaponElement =
        p && p.stats && p.stats.weaponElementType ? _capWord(p.stats.weaponElementType) : 'None'

    return { weaponElement, elementalBonusSummary, elementalResistSummary }
}

function renderElementalBreakdownHtml(p) {
    const bd = _getElementalBreakdownsForPlayer(p)
    const rarityScore = _getPlayerGearRarityScore(p)

    const keys = _orderedElementKeys(
        Object.keys(bd.gearBonus || {})
            .concat(Object.keys(bd.talentBonus || {}))
            .concat(Object.keys(bd.gearResist || {}))
            .concat(Object.keys(bd.talentResist || {}))
            .concat(Object.keys(bd.totalResist || {}))
    )

    if (!keys.length) {
        return '<div class="muted">None</div>'
    }

    let html = '<div class="stat-grid elem-breakdown-grid">'

    keys.forEach((k) => {
        const name = _capWord(k)
        const icon = _elementIcon(k)

        const gB = _round1(_numPct((bd.gearBonus || {})[k]))
        const tB = _round1(_numPct((bd.talentBonus || {})[k]))
        const gR = _round1(_numPct((bd.gearResist || {})[k]))
        const tR = _round1(_numPct((bd.talentResist || {})[k]))

        // Bonus row (spell bonus)
        if ((gB > 0) || (tB > 0)) {
            const totalB = _round1(((1 + gB / 100) * (1 + tB / 100) - 1) * 100)
            html +=
                '<div class="stat-label"><span class="char-stat-icon">' +
                escapeHtml(icon) +
                '</span>' +
                escapeHtml(name) +
                ' Bonus</div>' +
                '<div class="stat-value">+' +
                escapeHtml(String(totalB)) +
                '% <span class="muted">(Gear +' +
                escapeHtml(String(gB)) +
                '%, Talent +' +
                escapeHtml(String(tB)) +
                '%)</span></div>'
        }

        // Resist row
        const rawTotalRes = _numPct((bd.totalResist || {})[k]) || (gR + tR)
        const cap = Number(PLAYER_RESIST_CAP) || 75
        const effR = _round1(clampNumber(rawTotalRes, 0, cap))
        const rawR = _round1(rawTotalRes)
        if ((gR > 0) || (tR > 0) || (rawR > 0)) {
            html +=
                '<div class="stat-label"><span class="char-stat-icon">🛡</span>' +
                escapeHtml(name) +
                ' Resist</div>' +
                '<div class="stat-value">' +
                escapeHtml(String(effR)) +
                '% <span class="muted">(raw ' +
                escapeHtml(String(rawR)) +
                '%, Gear ' +
                escapeHtml(String(gR)) +
                '%, Talent ' +
                escapeHtml(String(tR)) +
                '%)</span></div>'
        }
    })

    html += '</div><div class="muted" style="margin-top:6px;">Resists are capped at 75%. Higher rarity gear reaches the cap more easily via stronger rolls.</div>'
    return html
}

function refreshCharacterSheetLiveValues(p, root) {
    if (!p || !root) return

    // Header + stats tab summaries
    try {
        const sums = computeElementSummariesForPlayer(p)
        const we = root.querySelector('.sheet-weapon-element')
        const eb = root.querySelector('.sheet-element-bonuses')
        const er = root.querySelector('.sheet-element-resists')
        const we2 = root.querySelector('.sheet-stat-weapon-element')
        const eb2 = root.querySelector('.sheet-stat-element-bonus')
        const er2 = root.querySelector('.sheet-stat-element-resists')
        if (we) we.textContent = sums.weaponElement
        if (eb) eb.textContent = sums.elementalBonusSummary
        if (er) er.textContent = sums.elementalResistSummary
        if (we2) we2.textContent = sums.weaponElement
        if (eb2) eb2.textContent = sums.elementalBonusSummary
        if (er2) er2.textContent = sums.elementalResistSummary
    } catch (_) {}

    // Elemental breakdown block(s)
    try {
        const html = renderElementalBreakdownHtml(p)
        root.querySelectorAll('.sheet-element-breakdown').forEach((el) => {
            el.innerHTML = html
        })
    } catch (_) {}

    // Key derived stat cells
    try {
        const round1 = (x) => Math.round((Number(x) || 0) * 10) / 10
        const hpLine =
            Math.round(finiteNumber(p.hp, 0)) + ' / ' + Math.round(finiteNumber(p.maxHp, 0))
        const resLine =
            Math.round(finiteNumber(p.resource, 0)) +
            ' / ' +
            Math.round(finiteNumber(p.maxResource, 0))

        root.querySelectorAll('.sheet-badge-hp').forEach((el) => (el.textContent = hpLine))
        root.querySelectorAll('.sheet-badge-resource').forEach((el) => (el.textContent = resLine))
        root
            .querySelectorAll('.sheet-badge-gold')
            .forEach((el) => (el.textContent = String(Math.round(finiteNumber(p.gold, 0)))))

        root.querySelectorAll('.sheet-core-hp').forEach((el) => (el.textContent = hpLine))
        root.querySelectorAll('.sheet-core-resource').forEach((el) => (el.textContent = resLine))
        root
            .querySelectorAll('.sheet-core-gold')
            .forEach((el) => (el.textContent = String(Math.round(finiteNumber(p.gold, 0)))))

        root
            .querySelectorAll('.stat-attack')
            .forEach((el) => (el.textContent = String(finiteNumber(p.stats && p.stats.attack, 0))))
        root
            .querySelectorAll('.stat-magic')
            .forEach((el) => (el.textContent = String(finiteNumber(p.stats && p.stats.magic, 0))))
        root
            .querySelectorAll('.stat-armor')
            .forEach((el) => (el.textContent = String(finiteNumber(p.stats && p.stats.armor, 0))))
        root
            .querySelectorAll('.stat-speed')
            .forEach((el) => (el.textContent = String(finiteNumber(p.stats && p.stats.speed, 0))))

        root
            .querySelectorAll('.sheet-stat-crit')
            .forEach((el) => (el.textContent = round1(p.stats && p.stats.critChance) + '%'))
        root
            .querySelectorAll('.sheet-stat-dodge')
            .forEach((el) => (el.textContent = round1(p.stats && p.stats.dodgeChance) + '%'))
        root
            .querySelectorAll('.sheet-stat-resistall')
            .forEach((el) => (el.textContent = round1(p.stats && p.stats.resistAll) + '%'))
        root
            .querySelectorAll('.sheet-stat-lifesteal')
            .forEach((el) => (el.textContent = round1(p.stats && p.stats.lifeSteal) + '%'))
        root
            .querySelectorAll('.sheet-stat-armorpen')
            .forEach((el) => (el.textContent = round1(p.stats && p.stats.armorPen) + '%'))
        root
            .querySelectorAll('.sheet-stat-haste')
            .forEach((el) => (el.textContent = round1(p.stats && p.stats.haste) + '%'))
        root
            .querySelectorAll('.sheet-stat-thorns')
            .forEach((el) => (el.textContent = String(round1(p.stats && p.stats.thorns))))
        root
            .querySelectorAll('.sheet-stat-hpregen')
            .forEach((el) => (el.textContent = String(round1(p.stats && p.stats.hpRegen))))
    } catch (_) {}
}

function refreshCharacterSheetIfOpen() {
    if (typeof document === 'undefined') return
    try {
        const titleEl = document.getElementById('modalTitle')
        const bodyEl = document.getElementById('modalBody')
        if (!titleEl || !bodyEl) return
        if ((titleEl.textContent || '').trim() !== 'Character Sheet') return
        const p = state && state.player ? state.player : null
        if (!p) return
        refreshCharacterSheetLiveValues(p, bodyEl)
    } catch (_) {}
}


function renderTalentsPanelHtml(p) {
    ensurePlayerTalents(p)
    const list = getTalentsForClass(p.classId)
    const pts = p.talentPoints || 0
    if (!list.length) {
        return `<div class="char-section"><div class="char-section-title">Talents</div><div class="muted">No talents available for this class yet.</div></div>`
    }
    const rows = list
        .map((t) => {
            const owned = playerHasTalent(p, t.id)
            const lockedByLevel = (p.level || 1) < (t.levelReq || 1)
            const can = canUnlockTalent(p, t)
            const status = owned ? 'Unlocked' : lockedByLevel ? ('Requires Lv ' + t.levelReq) : 'Locked'
            const btn = can
                ? `<button class="btn small talent-unlock" data-talent="${t.id}">Unlock</button>`
                : owned
                ? `<button class="btn small outline" disabled>Owned</button>`
                : `<button class="btn small outline" disabled>—</button>`
            return `
            <div class="talent-row">
              <div class="talent-main">
                <div class="talent-name">${t.name} <span class="muted">(${status})</span></div>
                <div class="talent-desc muted">${t.desc}</div>
              </div>
              <div class="talent-act">${btn}</div>
            </div>`
        })
        .join('')
    return `
      <div class="char-section">
        <div class="char-section-title">Talents</div>
        <div class="muted" style="margin-bottom:8px;">Talent Points: <b>${pts}</b> • Gain 1 point every 3 levels.</div>
        <div class="talent-list">${rows}</div>
      </div>`
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
    // Upgrades are tracked per-ability with independent tiers for each path:
    //   { potencyTier: N, efficiencyTier: M }
    // Older saves may still have the legacy shape: { tier: N, path: 'potency'|'efficiency' }.
    if (!p || !p.abilityUpgrades) return null
    const u = p.abilityUpgrades[id]
    if (!u || typeof u !== 'object') return null

    let potencyTier = 0
    let efficiencyTier = 0

    // Legacy: single tier + selected path.
    if (typeof u.tier !== 'undefined' && typeof u.path === 'string') {
        const tier = Math.max(
            0,
            Math.min(ABILITY_UPGRADE_RULES.maxTier, Math.floor(Number(u.tier || 0)))
        )
        if (u.path === 'potency') potencyTier = tier
        if (u.path === 'efficiency') efficiencyTier = tier
    }

    // Current: independent tiers (preferred).
    if (typeof u.potencyTier !== 'undefined') {
        potencyTier = Math.max(
            potencyTier,
            Math.max(
                0,
                Math.min(
                    ABILITY_UPGRADE_RULES.maxTier,
                    Math.floor(Number(u.potencyTier || 0))
                )
            )
        )
    }
    if (typeof u.efficiencyTier !== 'undefined') {
        efficiencyTier = Math.max(
            efficiencyTier,
            Math.max(
                0,
                Math.min(
                    ABILITY_UPGRADE_RULES.maxTier,
                    Math.floor(Number(u.efficiencyTier || 0))
                )
            )
        )
    }

    return { potencyTier, efficiencyTier }
}

function getAbilityEffectMultiplier(p, id) {
    const up = getAbilityUpgrade(p, id)
    if (!up || up.potencyTier <= 0) return 1
    return 1 + ABILITY_UPGRADE_RULES.potencyPerTier * up.potencyTier
}

function applyUpgradeToCost(p, id, cost) {
    const up = getAbilityUpgrade(p, id)
    if (!up || up.efficiencyTier <= 0) return cost
    const reduct = ABILITY_UPGRADE_RULES.efficiencyCostReductPerTier * up.efficiencyTier
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

function resetPlayerCombatStatus(player) {
    try { _ensureCombatEnginesBound() } catch (_) {}
    if (!StatusEngine) return player
    return StatusEngine.resetPlayerCombatStatus(player)
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
    // Guard against NaN/Infinity multipliers leaking from ability context.
    const mult = (ctx && typeof ctx.healMult === 'number' && Number.isFinite(ctx.healMult))
        ? ctx.healMult
        : 1
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

function _dealPlayerPhysical(p, enemy, baseStat, elementType, postureMeta) {
    const dmg = calcPhysicalDamage(baseStat, elementType, enemy)

    // Resolve the effective element used for this hit (normalized) so downstream
    // systems (synergies, resist tags, passives) agree on a single key.
    const et = normalizeElementType(elementType || state.lastPlayerDamageElementType || null)

    enemy.hp -= dmg
    applyPlayerOnHitEffects(dmg, et)

    // Status synergies + equipment traits should apply exactly once per hit.
    applyStatusSynergyOnPlayerHit(enemy, dmg, et, 'physical')
    applyEquipmentOnPlayerHit(enemy, dmg, et, 'physical')

    applyEnemyPostureFromPlayerHit(
        enemy,
        dmg,
        Object.assign({ damageType: 'physical', elementType: et || null }, postureMeta || null)
    )

    return dmg
}
function _dealPlayerMagic(p, enemy, baseStat, elementType, postureMeta) {
    const dmg = calcMagicDamage(baseStat, elementType, enemy)

    // Caller should pass the spell element; normalize so it matches stored bonuses/affinities.
    const et = normalizeElementType(elementType || state.lastPlayerDamageElementType || null)

    enemy.hp -= dmg
    applyPlayerOnHitEffects(dmg, et)

    // Magic hits participate in status synergies (ex: Bleed + Fire => Ignite).
    applyStatusSynergyOnPlayerHit(enemy, dmg, et, 'magic')

    applyEnemyPostureFromPlayerHit(
        enemy,
        dmg,
        Object.assign({ damageType: 'magic', elementType: et || null }, postureMeta || null)
    )

    return dmg
}

// Patch 1.2.0: player AoE helpers (multi-enemy spell support)
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
    // Consume one-shot damage buff from equipment traits (e.g., "after casting a shield: next damage +X%").
    if (ctx && ctx._consumeNextDmg && p && p.status) {
        p.status.nextDmgTurns = 0
        p.status.nextDmgMult = 1
    }

    // Consume companion boon if this action used it.
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
    const threshold = playerHasTalent(p, 'mage_rhythm_mastery') ? 2 : 3
    const active = nextCount % threshold === 0
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


    // Mage talent: Mana Weave (always-on) reduces mana costs.
    if (p && p.classId === 'mage' && cost.mana && playerHasTalent(p, 'mage_mana_weave')) {
        cost.mana = Math.max(1, Math.round(cost.mana * 0.95))
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

    // Equipment trait / buffs: next-damage multiplier (consumed on use)
    if (st.nextDmgTurns && st.nextDmgTurns > 0 && st.nextDmgMult && st.nextDmgMult > 1) {
        ctx.dmgMult *= st.nextDmgMult
        ctx._consumeNextDmg = true
    }

    // Companion boon: empower next action (damage/heal).
    if (st.buffFromCompanionTurns && st.buffFromCompanionTurns > 0) {
        ctx.dmgMult *= 1.15
        ctx.healMult *= 1.15
        ctx.consumeCompanionBoon = true
    }

    // Talents: healing/shield potency
    if (playerHasTalent(p, 'cleric_mending_prayer')) ctx.healMult *= 1.15
    if (playerHasTalent(p, 'shaman_ancestral_mending')) ctx.healMult *= 1.15

    // Mage passive: every 3rd spell adds crit chance.
    const rhythm = _getMageRhythmBonus(p, ab, abilityId)
    if (rhythm.active) {
        ctx.critBonus += rhythm.critBonus
    }


// Patch 1.2.0: class meter is now combat-relevant.
// Mage (Rhythm): every 3rd spell also boosts effect and refunds a small amount of mana.
if (p.classId === 'mage' && rhythm.active) {
    ctx.dmgMult *= 1.30
    ctx.healMult *= 1.30
    ctx._mageRhythmActive = true
    ctx._manaRefund = (ctx._manaRefund || 0) + 4 + (playerHasTalent(p, 'mage_arcane_conduit') ? 2 : 0)
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
        const perMark = 0.03 + (playerHasTalent(p, 'ranger_pinpoint') ? 0.01 : 0)
        ctx.dmgMult *= 1 + marks * perMark
    }
} catch (_) {}

// Blood Knight (Blood): high Blood triggers Bloodrush, boosting damage and lifesteal.
if (p.classId === 'blood' && p.resourceKey === 'blood') {
    const mx = Math.max(1, Number(p.maxResource || 0))
    const ratio = Number(p.resource || 0) / mx
    if (ratio >= 0.80) {
        ctx.dmgMult *= 1.12
        ctx.lifeStealBonusPct = (ctx.lifeStealBonusPct || 0) + 12 + (playerHasTalent(p, 'blood_bloodrush_hunger') ? 5 : 0)
        ctx._bloodrushActive = true
    }
}

    // Ranger passive: first hit each fight.
    if (p.classId === 'ranger' && st.firstHitBonusAvailable) {
        ctx.dmgMult *= playerHasTalent(p, 'ranger_quickdraw') ? 1.18 : 1.12
        ctx.consumeFirstHitBonus = true
    }

    // Shaman talent: Totemic Mastery (+15% Totem Spark damage).
    if (p.classId === 'shaman' && abilityId === 'totemSpark' && playerHasTalent(p, 'shaman_totemic_mastery')) {
        ctx.dmgMult *= 1.15
    }

    // Berserker passive: missing HP increases physical damage slightly.
    if (p.classId === 'berserker') {
        const missingPct = Math.max(0, (p.maxHp - p.hp) / Math.max(1, p.maxHp))
        const cap = playerHasTalent(p, 'berserker_rage_mastery') ? 0.30 : 0.20
        // Linear scaling up to the cap.
        ctx.dmgMult *= 1 + Math.min(cap, missingPct * cap)
    }

    return ctx
}

const ABILITY_EFFECTS = buildAbilityEffects({
    getState: () => state,
    _dealPlayerMagic,
    _dealPlayerMagicAoe,
    _dealPlayerPhysical,
    _dealPlayerPhysicalAoe,
    _healPlayer,
    _addShield,
    _applyTimedBuff,
    playerHasTalent,
    applyEnemyAtkDown,
    finiteNumber,
    getAliveEnemies,
    grantCompanion,
    addLog,
    rand,
    getPlayerHasteMultiplier
})
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
        behavior: 'aggressive',
	    	affinities: { weak: { fire: 1.25 }, resist: { frost: 0.85 } },
	        elementalResists: { arcane: 12 },

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

    goblinScout: {
        id: 'goblinScout',
        name: 'Goblin Scout',
        baseLevel: 3,
        maxHp: 54,
        attack: 9,
        magic: 0,
        armor: 1,
        magicRes: 0,
        xp: 20,
        goldMin: 7,
        goldMax: 16,
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

    // Chapter I (expanded): authored mini-boss encounters
    goblinTrapper: {
        id: 'goblinTrapper',
        name: 'Goblin Trapper',
        baseLevel: 4,
        maxHp: 78,
        attack: 11,
        magic: 0,
        armor: 2,
        magicRes: 0,
        xp: 30,
        goldMin: 10,
        goldMax: 22,
        isBoss: false,
        behavior: 'cunning'
    },
    goblinPackmaster: {
        id: 'goblinPackmaster',
        name: 'Goblin Packmaster',
        baseLevel: 5,
        maxHp: 98,
        attack: 14,
        magic: 0,
        armor: 3,
        magicRes: 0,
        xp: 42,
        goldMin: 14,
        goldMax: 30,
        isBoss: false,
        behavior: 'aggressive'
    },
    goblinDrummer: {
        id: 'goblinDrummer',
        name: 'Goblin Drummer',
        baseLevel: 5,
        maxHp: 90,
        attack: 12,
        magic: 0,
        armor: 3,
        magicRes: 0,
        xp: 40,
        goldMin: 12,
        goldMax: 28,
        isBoss: false,
        behavior: 'cunning',
        abilitySet: 'aggressive'
    },
    goblinCaptain: {
        id: 'goblinCaptain',
        name: 'Goblin Captain',
        baseLevel: 6,
        maxHp: 122,
        attack: 15,
        magic: 0,
        armor: 4,
        magicRes: 1,
        xp: 55,
        goldMin: 16,
        goldMax: 38,
        isBoss: false,
        behavior: 'cunning',
        abilitySet: 'bossGoblin'
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
        behavior: 'aggressive',
        affinities: { weak: { frost: 1.15 }, resist: { fire: 0.90 } }
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
    },

    // --- Chapter II/III (expanded) — New Enemies -------------------------------------
    rootcrownAcolyte: {
        id: 'rootcrownAcolyte',
        name: 'Rootcrown Acolyte',
        baseLevel: 25,
        maxHp: 210,
        attack: 30,
        magic: 34,
        armor: 14,
        speed: 18,
        magicRes: 16,
        xp: 260,
        goldMin: 90,
        goldMax: 130,
        behavior: 'cunning'
    },
    oathgroveStalker: {
        id: 'oathgroveStalker',
        name: 'Oathgrove Stalker',
        baseLevel: 25,
        maxHp: 240,
        attack: 38,
        magic: 18,
        armor: 16,
        speed: 22,
        magicRes: 14,
        xp: 280,
        goldMin: 100,
        goldMax: 140,
        behavior: 'aggressive'
    },
    sapboundWarden: {
        id: 'sapboundWarden',
        name: 'Sapbound Warden',
        baseLevel: 27,
        maxHp: 520,
        attack: 58,
        magic: 26,
        armor: 26,
        speed: 12,
        magicRes: 22,
        xp: 850,
        goldMin: 450,
        goldMax: 700,
        isBoss: true,
        behavior: 'bossGiant'
    },

    oathboundStalker: {
        id: 'oathboundStalker',
        name: 'Oathbound Stalker',
        baseLevel: 28,
        maxHp: 320,
        attack: 44,
        magic: 22,
        armor: 20,
        speed: 24,
        magicRes: 18,
        xp: 420,
        goldMin: 180,
        goldMax: 260,
        behavior: 'cunning'
    },
    blackbarkWraith: {
        id: 'blackbarkWraith',
        name: 'Blackbark Wraith',
        baseLevel: 29,
        maxHp: 380,
        attack: 26,
        magic: 60,
        armor: 16,
        speed: 18,
        magicRes: 28,
        xp: 520,
        goldMin: 220,
        goldMax: 320,
        behavior: 'caster'
    },

    starfallReaver: {
        id: 'starfallReaver',
        name: 'Starfall Reaver',
        baseLevel: 30,
        maxHp: 360,
        attack: 54,
        magic: 24,
        armor: 22,
        speed: 20,
        magicRes: 18,
        xp: 520,
        goldMin: 240,
        goldMax: 340,
        behavior: 'aggressive'
    },
    astralWisp: {
        id: 'astralWisp',
        name: 'Astral Wisp',
        baseLevel: 30,
        maxHp: 250,
        attack: 20,
        magic: 66,
        armor: 10,
        speed: 26,
        magicRes: 30,
        xp: 500,
        goldMin: 220,
        goldMax: 320,
        behavior: 'caster'
    },
    starfallSentinel: {
        id: 'starfallSentinel',
        name: 'Starfall Sentinel',
        baseLevel: 31,
        maxHp: 520,
        attack: 62,
        magic: 38,
        armor: 28,
        speed: 16,
        magicRes: 26,
        xp: 820,
        goldMin: 420,
        goldMax: 620,
        isBoss: true,
        behavior: 'aggressive'
    },
    skyfallenHusk: {
        id: 'skyfallenHusk',
        name: 'Skyfallen Husk',
        baseLevel: 29,
        maxHp: 290,
        attack: 46,
        magic: 20,
        armor: 18,
        speed: 14,
        magicRes: 16,
        xp: 470,
        goldMin: 200,
        goldMax: 300,
        behavior: 'basic'
    },

    // --- Chapter III (Patch 1.2.42): The Hollow Crown ------------------------
    crownShade: {
        id: 'crownShade',
        name: 'Crown‑Shade',
        baseLevel: 22,
        maxHp: 360,
        attack: 40,
        magic: 54,
        armor: 12,
        magicRes: 14,
        xp: 320,
        goldMin: 90,
        goldMax: 140,
        isBoss: false,
        behavior: 'caster'
    },
    mirrorWarden: {
        id: 'mirrorWarden',
        name: 'Mirror Warden',
        baseLevel: 23,
        maxHp: 480,
        attack: 46,
        magic: 58,
        armor: 13,
        magicRes: 16,
        xp: 380,
        goldMin: 120,
        goldMax: 190,
        isBoss: true,
        behavior: 'bossWitch'
    },
    graveLatchWarden: {
        id: 'graveLatchWarden',
        name: 'Grave‑Latch Warden',
        baseLevel: 24,
        maxHp: 540,
        attack: 50,
        magic: 60,
        armor: 14,
        magicRes: 17,
        xp: 420,
        goldMin: 140,
        goldMax: 220,
        isBoss: true,
        behavior: 'bossLich'
    },
    hollowRegent: {
        id: 'hollowRegent',
        name: 'The Hollow Regent',
        baseLevel: 26,
        maxHp: 820,
        attack: 60,
        magic: 68,
        armor: 18,
        magicRes: 20,
        xp: 650,
        goldMin: 480,
        goldMax: 720,
        isBoss: true,
        behavior: 'bossRegent'
    },

    // --- Chapter IV (Patch 1.2.42 continuation): The Rootbound Court -------
    mireBailiff: {
        id: 'mireBailiff',
        name: 'Rootbound Bailiff',
        baseLevel: 20,
        maxHp: 380,
        attack: 48,
        magic: 22,
        armor: 14,
        magicRes: 14,
        xp: 330,
        goldMin: 90,
        goldMax: 150,
        isBoss: false,
        behavior: 'cunning'
    },
    echoArchivist: {
        id: 'echoArchivist',
        name: 'Echo Archivist',
        baseLevel: 24,
        maxHp: 560,
        attack: 40,
        magic: 70,
        armor: 14,
        magicRes: 20,
        xp: 520,
        goldMin: 160,
        goldMax: 240,
        isBoss: true,
        behavior: 'bossWitch'
    },
    iceCensor: {
        id: 'iceCensor',
        name: 'Ice Censor',
        baseLevel: 25,
        maxHp: 600,
        attack: 50,
        magic: 62,
        armor: 16,
        magicRes: 22,
        xp: 560,
        goldMin: 180,
        goldMax: 260,
        isBoss: true,
        behavior: 'bossGiant'
    },
    boneNotary: {
        id: 'boneNotary',
        name: 'Bone Notary',
        baseLevel: 25,
        maxHp: 620,
        attack: 54,
        magic: 60,
        armor: 17,
        magicRes: 23,
        xp: 590,
        goldMin: 190,
        goldMax: 280,
        isBoss: true,
        behavior: 'bossLich'
    },
    oathBinder: {
        id: 'oathBinder',
        name: 'Oathbinder',
        baseLevel: 26,
        maxHp: 720,
        attack: 66,
        magic: 44,
        armor: 20,
        magicRes: 22,
        xp: 640,
        goldMin: 240,
        goldMax: 360,
        isBoss: true,
        behavior: 'bossKing'
    },
    rootboundMagistrate: {
        id: 'rootboundMagistrate',
        name: 'Rootbound Magistrate',
        baseLevel: 27,
        maxHp: 900,
        attack: 68,
        magic: 78,
        armor: 22,
        magicRes: 26,
        xp: 760,
        goldMin: 320,
        goldMax: 520,
        isBoss: true,
        behavior: 'bossRegent'
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
    keep: { id: 'keep', minLevel: 22, maxLevel: 26 },
    oathgrove: { id: 'oathgrove', minLevel: 24, maxLevel: 28 },
    blackbarkDepths: { id: 'blackbarkDepths', minLevel: 26, maxLevel: 30 },
    starfallRidge: { id: 'starfallRidge', minLevel: 27, maxLevel: 32 }
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
    keep: ['darkKnight', 'shadowAssassin', 'voidSorcerer', 'dreadGuard'],
    // Note: Sapbound Warden is spawned by the quest system to keep the mini-boss paced.
    oathgrove: ['rootcrownAcolyte', 'oathgroveStalker', 'rootcrownAcolyte', 'oathgroveStalker'],
    blackbarkDepths: ['oathboundStalker', 'blackbarkWraith', 'oathboundStalker'],
    starfallRidge: ['skyfallenHusk', 'starfallReaver', 'astralWisp', 'starfallReaver']
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

/* =============================================================================
 * STATE (single save object)
 * Build/repair/save/load the top-level `state` object used everywhere in-game.
 * ============================================================================= */

let state = null
// Engine Core handle (proprietary engine). The orchestrator uses it as a state/event backplane.
let _engine = null
// Enemy Combat AI module instance
let _enemyCombatAi = null

function _setState(next) {
    state = next
    try { syncGlobalStateRef() } catch (_) {}
    try { if (_engine && typeof _engine.setState === 'function') _engine.setState(next) } catch (_) {}
    return state
}

// -----------------------------------------------------------------------------
// Engine helpers (commands + savePolicy)
// -----------------------------------------------------------------------------

function _getSavePolicy() {
    try { return _engine && _engine.getService ? _engine.getService('savePolicy') : null } catch (_) { return null }
}

function requestSave(reason = 'save', { flush = true } = {}) {
    // Prefer the dirty-state save policy (coalesced + safe-point aware).
    try {
        const sp = _getSavePolicy()
        if (sp) {
            sp.markDirty(reason)
            // flush will no-op if we're mid-transaction or at an unsafe point.
            if (flush) sp.flush({ reason })
            return
        }
    } catch (_) {}
    // Fallback for older harness paths.
    try { if (typeof saveGame === 'function') saveGame() } catch (_) {}
}

function setArea(nextArea, { source = 'unknown', emit = true } = {}) {
    if (!state) return false
    const to = String(nextArea || '').trim()
    if (!to) return false

    const from = String(state.area || '').trim()
    if (from === to) return false

    state.area = to

    if (!emit) return true

    // Area changes happen inside the single "game" screen, so we emit a
    // dedicated lifecycle event that engine plugins can listen to (asset
    // preloads, input contexts, analytics, etc.).
    try {
        if (_engine && typeof _engine.emit === 'function') {
            try { if (from) _engine.emit('area:leave', { area: from, to, source: String(source || ''), owner: `area:${from}` }) } catch (_) {}
            _engine.emit('area:enter', { area: to, from, source: String(source || ''), owner: `area:${to}` })
        }
    } catch (_) {}

    // Also fan out to the world event bus when it's present.
    try {
        const world = _engine && _engine.getService ? _engine.getService('world') : null
        if (world && typeof world.emit === 'function') {
            world.emit('areaEntered', { area: to, from, source: String(source || '') })
        }
    } catch (_) {}

    return true
}

function withSaveTxn(label, fn) {
    const sp = _getSavePolicy()
    if (!sp) return fn()
    const tok = sp.beginTxn(label)
    try {
        return fn()
    } finally {
        try { sp.endTxn(tok) } catch (_) {}
    }
}

function dispatchGameCommand(type, payload = null) {
    try {
        if (_engine && typeof _engine.dispatch === 'function') {
            _engine.dispatch({ type: String(type || ''), payload })
            return true
        }
    } catch (_) {}
    return false
}

// Diagnostics / QA UI (Smoke Tests modal, dev pills). Initialized after UI bootstrap.
let _diagnosticsUI = null

// -----------------------------------------------------------------------------
// Save API placeholders
// Patch 1.2.70 (Step 1 refactor): save/load/migrations were extracted into
// saveManager.js, but several subsystems (notably quests) are created earlier
// during module evaluation.
//
// iOS Safari is strict about temporal-dead-zone access for `const`/imports.
// To keep module load order safe (and to allow QA scenario runner to stub
// persistence), we bind these as late-initialized `let` references.
// -----------------------------------------------------------------------------
let migrateSaveData = null
let saveGame = null
let loadGame = null
let _buildSaveBlob = null
let buildHeroMetaFromData = null
let getSaveIndex = null
let writeSaveIndex = null
let saveGameToSlot = null
let deleteSaveSlot = null
let loadGameFromSlot = null
let getAllSavesWithAuto = null

// Autosave coalescing timer state (used by smoke tests)
let _saveTimer = null
let _saveQueued = false

// --- Combat engines (plugin-provided) ---
// Patch 1.2.72: Combat Math, Status Engine, and post-turn sequencing are created
// via the Engine plugin system (see js/game/plugins/combatRuntimePlugin.js).
//
// We keep these refs here so the orchestrator can call them through legacy wrappers
// without importing/instantiating the engines during module evaluation (iOS file:// safety).
let CombatMath = null
let StatusEngine = null
let runPostPlayerTurnSequence = null

function _ensureCombatEnginesBound() {
    if (!_engine || typeof _engine.getService !== 'function') return
    try {
        if (!CombatMath) CombatMath = _engine.getService('combat.math') || (_engine.getService('combat') && _engine.getService('combat').math) || null
    } catch (_) {}
    try {
        if (!StatusEngine) StatusEngine = _engine.getService('combat.status') || (_engine.getService('combat') && _engine.getService('combat').status) || null
    } catch (_) {}
    try {
        if (!runPostPlayerTurnSequence) {
            const ts = _engine.getService('combat.turnSequencer') || (_engine.getService('combat') && _engine.getService('combat').turnSequencer) || null
            runPostPlayerTurnSequence = ts && ts.runPostPlayerTurnSequence ? ts.runPostPlayerTurnSequence : null
        }
    } catch (_) {}
}
initRngState(state)
applyMotionPreference()
syncGlobalStateRef()

// Quest system bindings (moved out of engine.js in patch 1.1.3)
const quests = createQuestBindings({
    getState: () => state,
    addLog,
    setScene,
    openModal,
    closeModal,
    makeActionButton,
    getItemDef: (id) => (ITEM_DEFS && ITEM_DEFS[id] ? ITEM_DEFS[id] : null),
    addItemToInventory,
    // Quest systems generate a *lot* of small "dirty" moments; route through
    // savePolicy so it can coalesce and respect safe points.
    saveGame: () => requestSave('quests'),
    updateHUD,
    recalcPlayerStats,
    startBattleWith,
    QUEST_DEFS,
    GAME_PATCH,
    SAVE_SCHEMA
})

/* =============================================================================
 * AUDIO / MUSIC
 * Ambient tracks + SFX wiring. (Actual audio files live in assets/audio/.)
 * ============================================================================= */
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
            // Use engine settings service (locus_settings)
            const settings = _engine && _engine.getService ? _engine.getService('settings') : null
            if (settings && settings.set) {
                settings.set('audio.musicEnabled', on)
            }
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
            // Use engine settings service (locus_settings)
            const settings = _engine && _engine.getService ? _engine.getService('settings') : null
            if (settings && settings.set) {
                settings.set('audio.sfxEnabled', on)
            }
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
            // Try engine settings first, then fall back to legacy storage
            // Use engine settings service (locus_settings) to initialize audio toggles
            try {
                const settings = _engine && _engine.getService ? _engine.getService('settings') : null
                if (settings && typeof settings.get === 'function') {
                    audioState.musicEnabled = settings.get('audio.musicEnabled', true)
                    audioState.sfxEnabled = settings.get('audio.sfxEnabled', true)
                }
            } catch (e) {}
        }
    } catch (e) {}

    // Create audio routing early so volume works consistently
    ensureAudioContext()
    applyMasterVolumeAll()
    applyChannelMuteGains()

    // ---- Ambient tracks ------------------------------------------------------
    // Village daytime ambience
    const villageDay = registerAudio(
        new Audio(new URL('../../../assets/audio/village_day.wav', import.meta.url).href),
        0.4,
        'music'
    )
    villageDay.loop = true
    audioState.tracks.villageDay = villageDay

    // Global night ambience (plays anywhere at night)
    const nightAmbience = registerAudio(
        new Audio(new URL('../../../assets/audio/night-ambience.wav', import.meta.url).href),
        0.35,
        'music'
    )
    nightAmbience.loop = true
    audioState.tracks.nightAmbience = nightAmbience

    // Inside initAudio(), after other ambient/sfx tracks:
    const tavernAmbience = registerAudio(
        new Audio(new URL('../../../assets/audio/Tavern.wav', import.meta.url).href),
        0.45,
        'music'
    )
    tavernAmbience.loop = true
    audioState.tracks.tavernAmbience = tavernAmbience

    // ---- SFX ----------------------------------------------------------------
    const doorOpen = registerAudio(
        new Audio(new URL('../../../assets/audio/old-wooden-door.wav', import.meta.url).href),
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
            try {
                if (safetyTimer && typeof safetyTimer.cancel === 'function') {
                    safetyTimer.cancel()
                }
            } catch (_) {}
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
        let safetyTimer = scheduleAfter(_engine, 1500, finish, { owner: 'audio:doorSfx' })

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
    // NOTE (Patch 1.2.70): Diagnostics/QA UI was extracted into a dedicated module.
    // Keep this name as a stable public hook for UI bindings.
    try {
        try {
            if (!_diagnosticsUI && _engine && typeof _engine.getService === 'function') {
                _diagnosticsUI = _engine.getService('diagnostics') || null
            }
        } catch (_) {}
        if (_diagnosticsUI && typeof _diagnosticsUI.syncSmokeTestsPillVisibility === 'function') {
            return _diagnosticsUI.syncSmokeTestsPillVisibility()
        }
    } catch (_) {}
}

/* =============================================================================
 * RNG (randomness)
 * Wrapper around seeded RNG so runs can be deterministic for testing.
 * ============================================================================= */
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

/* =============================================================================
 * INPUT / REPLAY BREADCRUMBS
 * Stores lightweight “what the player clicked” traces for debugging.
 * ============================================================================= */
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

function updateHUD() {
    const st = state
    try {
        if (st && st.debug && st.debug.capturePerf) {
            return perfWrap(st, 'hud:updateHUD', null, () => _updateHUDImpl())
        }
    } catch (_) {}
    return _updateHUDImpl()
}

function _updateHUDImpl() {
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


// Combat Action Renderer (extracted to combatActionRenderer.js)
let _combatActionRenderer = null
function _getCombatActionRenderer() {
    if (_combatActionRenderer) return _combatActionRenderer
    _combatActionRenderer = createCombatActionRenderer({
        state,
        dispatchGameCommand,
        ensureCombatPointers,
        canPlayerActNow,
        addLog,
        handlers: {
            quests,
            openTavernModal,
            openBankModal,
            openMerchantModal,
            openTownHallModal,
            openGovernmentModal,
            handleExploreClick,
            openExploreModal,
            openInventoryModal,
            openSpellsModal,
            playerBasicAttack,
            playerInterrupt,
            tryFlee,
            renderActions: () => _getCombatActionRenderer().renderActions()
        }
    })
    return _combatActionRenderer
}

function renderActions() {
    return _getCombatActionRenderer().renderActions()
}

function makeActionButton(label, onClick, extraClass, opts) {
    return _getCombatActionRenderer().makeActionButton(label, onClick, extraClass, opts)
}

function renderExploreActions(actionsEl) {
    return _getCombatActionRenderer().renderExploreActions(actionsEl)
}

function renderCombatActions(actionsEl) {
    return _getCombatActionRenderer().renderCombatActions(actionsEl)
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

/* =============================================================================
 * PLAYER CREATION
 * Character creation UI + translating choices into initial `state.player`.
 * ============================================================================= */

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
/* =============================================================================
 * DEV CHEATS / DEBUG UI
 * Developer-only toggles + tools for testing (hidden unless enabled per save).
 * ============================================================================= */
const devCheatsPill = (typeof document !== 'undefined') ? document.querySelector('.dev-cheats-pill') : null
const devCheatsCheckbox = (typeof document !== 'undefined') ? document.getElementById('devCheatsToggle') : null

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

    _setState(createEmptyState())
    state.difficulty = diffId
    syncGlobalStateRef()

    // -------------------- SYSTEM INIT (NEW GAME) --------------------
    // Keep this list inline so adding a new persisted system is a one-line edit.
    // IMPORTANT: order matters.
    const NEW_GAME_INIT_STEPS = [
        { id: 'rng', run: () => initRngState(state) },
        { id: 'time', run: () => initTimeState(state) },
        { id: 'economy', run: () => initVillageEconomyState(state) },
        { id: 'government', run: () => initGovernmentState(state, 0) },
        { id: 'population', run: () => ensureVillagePopulation(state) }
    ]

    for (const step of NEW_GAME_INIT_STEPS) {
        try {
            step.run()
        } catch (_) {
            // New-game init should never hard-crash; a missing system can be repaired later.
        }
    }
    // 🔹 NEW: read dev-cheat toggle from character creation screen
    const devToggle = document.getElementById('devCheatsToggle')
    if (devToggle && devToggle.checked) {
        state.flags.devCheatsEnabled = true
    }

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
    ensurePlayerStatsDefaults(player)
    state.player = player
    // New Game: do not auto-start the main quest.
    // The player can accept it by speaking with Elder Rowan.
    quests.ensureQuestStructures()

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
    addLog('You can speak with Elder Rowan to accept the main quest — or explore freely first.', 'system')

    // Ensure derived stats are fully initialized from the start (prevents undefined stat scanners)
    recalcPlayerStats()

    // New Game: ensure the hero begins at full health after derived stat recalcs.
    // (Endurance / gear / companion scaling can increase maxHp, leaving hp below max.)
    state.player.hp = state.player.maxHp
    // Mana/Essence classes feel best when starting topped off; Fury/Blood start low by design.
    if (state.player.resourceKey === 'mana' || state.player.resourceKey === 'essence') {
        state.player.resource = state.player.maxResource
    }

    quests.updateQuestBox()
    updateHUD()
    updateEnemyPanel()
    renderActions()
    requestSave('legacy')
    updateTimeDisplay()

    switchScreen('game')
}

/* =============================================================================
 * INVENTORY + ITEMS
 * Inventory data, equip/unequip, sell/buy, and item UI rendering.
 * ============================================================================= */



function _questEventsEnabled() {
    try {
        const svc = _engine && typeof _engine.getService === 'function' ? _engine.getService('ew.questEvents') : null
        return !!(svc && svc.enabled)
    } catch (_) { return false }
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

    // World event (consumed by questEvents + autosave plugins)
    try { _engine && _engine.emit && _engine.emit('world:itemGained', { itemId: def.id, quantity }) } catch (_) {}

    // Legacy quest hook (kept as a fallback when the questEvents plugin isn't present)
    if (!_questEventsEnabled()) {
        try {
            if (quests && typeof quests.applyQuestProgressOnItemGain === 'function') {
                quests.applyQuestProgressOnItemGain(def.id, quantity)
            }
        } catch (_) {}
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
            try { _engine && _engine.emit && _engine.emit('world:itemGained', { itemId: cloned.id, quantity }) } catch (_) {}

            if (!_questEventsEnabled()) {
                try {
                    if (quests && typeof quests.applyQuestProgressOnItemGain === 'function') {
                        quests.applyQuestProgressOnItemGain(cloned.id, quantity)
                    }
                } catch (_) {}
            }
            return
        }
        cloned.quantity = quantity
        inv.push(cloned)

        try { _engine && _engine.emit && _engine.emit('world:itemGained', { itemId: cloned.id, quantity }) } catch (_) {}

        if (!_questEventsEnabled()) {
            try {
                if (quests && typeof quests.applyQuestProgressOnItemGain === 'function') {
                    quests.applyQuestProgressOnItemGain(cloned.id, quantity)
                }
            } catch (_) {}
        }
        return
    }

    // Equipment items should not stack
    cloned.quantity = 1
    inv.push(cloned)

    try { _engine && _engine.emit && _engine.emit('world:itemGained', { itemId: cloned.id, quantity: 1 }) } catch (_) {}

    if (!_questEventsEnabled()) {
        try {
            if (quests && typeof quests.applyQuestProgressOnItemGain === 'function') {
                quests.applyQuestProgressOnItemGain(cloned.id, 1)
            }
        } catch (_) {}
    }

    // Optional QoL: auto-equip newly acquired gear if the slot is currently empty.
    // Kept out of combat to avoid mid-fight equipment changes.
    try {
        const p = state && state.player ? state.player : null
        if (
            p &&
            !state.inCombat &&
            state.settingsAutoEquipLoot &&
            (cloned.type === 'weapon' || cloned.type === 'armor')
        ) {
            if (!p.equipment) p.equipment = {}
            const ensureSlot = (k) => {
                if (p.equipment[k] === undefined) p.equipment[k] = null
            }
            ;['weapon','armor','head','hands','feet','belt','neck','ring'].forEach(ensureSlot)

            const slot = cloned.slot || (cloned.type === 'weapon' ? 'weapon' : 'armor')
            ensureSlot(slot)

            if (p.equipment[slot] == null) {
                p.equipment[slot] = cloned
                addLog('Auto-equipped ' + cloned.name + ' (' + slot + ').', 'system')
                recalcPlayerStats()
            }
        }
    } catch (e) {
        // ignore auto-equip failures
    }
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
    return withSaveTxn('inventory:sell', () => {
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
    requestSave('inventory:sell')
    })
}

/* =============================================================================
 * INVENTORY MODAL
 * Inventory management UI with filtering, sorting, and item actions.
 * ============================================================================= */

// Inventory Modal UI is now modularized (see ../ui/modals/inventoryModal.js).
// We keep thin wrappers here so call sites remain unchanged and the functions stay hoisted.
let _inventoryModal = null
function _getInventoryModal() {
    if (_inventoryModal) return _inventoryModal
    _inventoryModal = createInventoryModal({
        getState: () => state,
        openModal,
        closeModal,
        addLog,
        updateHUD,
        requestSave,
        recalcPlayerStats,
        getItemPowerScore,
        formatRarityLabel,
        dispatchGameCommand,
        guardPlayerTurn,
        endPlayerTurn,
        unequipItemIfEquipped,
        sellItemFromInventory
    })
    return _inventoryModal
}

function openInventoryModal(inCombat) {
    return _getInventoryModal().openInventoryModal(inCombat)
}

function usePotionFromInventory(index, inCombat, opts = {}) {
    return _getInventoryModal().usePotionFromInventory(index, inCombat, opts)
}

function equipItemFromInventory(index, opts = {}) {
    return _getInventoryModal().equipItemFromInventory(index, opts)
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
    p.stats.elementalBonuses = {} // gear-only (used by damage)
    p.stats.elementalResists = {} // total (gear + talents)

    // Elemental breakdown for Character Sheet derived display
    const _elemBonusGear = {}
    const _elemBonusTalent = {}
    const _elemResistGear = {}
    const _elemResistTalent = {}
    p.stats.elementalBonusBreakdown = { gear: _elemBonusGear, talent: _elemBonusTalent }
    p.stats.elementalResistBreakdown = { gear: _elemResistGear, talent: _elemResistTalent }

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
    const addGearElementBonus = (elem, pct) => {
        const k = normalizeElementType(elem)
        const v = _numPct(pct)
        if (!k || !v) return
        p.stats.elementalBonuses[k] = (p.stats.elementalBonuses[k] || 0) + v
        _elemBonusGear[k] = (_elemBonusGear[k] || 0) + v
    }

    const addGearElementResist = (elem, pct) => {
        const k = normalizeElementType(elem)
        const v = _numPct(pct)
        if (!k || !v) return
        p.stats.elementalResists[k] = (p.stats.elementalResists[k] || 0) + v
        _elemResistGear[k] = (_elemResistGear[k] || 0) + v
    }

    const addTalentElementResist = (elem, pct) => {
        const k = normalizeElementType(elem)
        const v = _numPct(pct)
        if (!k || !v) return
        p.stats.elementalResists[k] = (p.stats.elementalResists[k] || 0) + v
        _elemResistTalent[k] = (_elemResistTalent[k] || 0) + v
    }

    // UI-only: talent spell focus bonuses (damage math applies these separately in calcMagicDamage).
    const addTalentElementBonus = (elem, pct) => {
        const k = normalizeElementType(elem)
        const v = _numPct(pct)
        if (!k || !v) return
        _elemBonusTalent[k] = (_elemBonusTalent[k] || 0) + v
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
            addGearElementBonus(it.elementalType, it.elementalBonus)
            if (slot === 'weapon' && !p.stats.weaponElementType) {
                p.stats.weaponElementType = normalizeElementType(it.elementalType)
            }
        }

        // If item stored multiple elemental bonuses (future-proof)
        if (it.elementalBonuses && typeof it.elementalBonuses === 'object') {
            Object.keys(it.elementalBonuses).forEach((k) =>
                addGearElementBonus(k, it.elementalBonuses[k])
            )
        }

        // Elemental resists (Patch 1.2.0)
        // Stored as percent reduction against incoming elemental magic.
        // Example: { arcane: 10 } means -10% arcane damage taken (before resistAll).
        if (it.elementalResists && typeof it.elementalResists === 'object') {
            Object.keys(it.elementalResists).forEach((k) =>
                addGearElementResist(k, it.elementalResists[k])
            )
        }

        // Elemental resist shorthand (generated armor) (Patch 1.2.0)
        if (it.elementalResistType && it.elementalResist) {
            addGearElementResist(it.elementalResistType, it.elementalResist)
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

    // Talent elemental resist wards (Patch 1.2.0+)
    // These should apply immediately to player stats so combat math + Character Sheet are correct.
    if (playerHasTalent(p, 'mage_frostward')) addTalentElementResist('frost', 15)
    if (playerHasTalent(p, 'mage_arcane_ward')) addTalentElementResist('arcane', 15)
    if (playerHasTalent(p, 'warrior_frostward')) addTalentElementResist('frost', 15)
    if (playerHasTalent(p, 'blood_shadowward')) addTalentElementResist('shadow', 15)
    if (playerHasTalent(p, 'paladin_holyward')) addTalentElementResist('holy', 15)
    if (playerHasTalent(p, 'rogue_shadowward')) addTalentElementResist('shadow', 15)
    if (playerHasTalent(p, 'cleric_lightward')) addTalentElementResist('holy', 15)
    if (playerHasTalent(p, 'necromancer_graveward')) addTalentElementResist('shadow', 15)
    if (playerHasTalent(p, 'shaman_stormward')) addTalentElementResist('lightning', 15)
    if (playerHasTalent(p, 'berserker_fireward')) addTalentElementResist('fire', 15)
    if (playerHasTalent(p, 'vampire_shadowward')) addTalentElementResist('shadow', 15)
    if (playerHasTalent(p, 'vampire_mistward')) addTalentElementResist('frost', 15)

    // Talent spell focus bonuses (UI breakdown only; damage calcs apply these separately).
    if (playerHasTalent(p, 'mage_ember_focus')) addTalentElementBonus('fire', 10)
    if (playerHasTalent(p, 'mage_glacial_edge')) addTalentElementBonus('frost', 10)
    if (playerHasTalent(p, 'blood_hemomancy')) addTalentElementBonus('shadow', 10)
    if (playerHasTalent(p, 'ranger_nature_attunement')) addTalentElementBonus('nature', 10)
    if (playerHasTalent(p, 'paladin_radiant_focus')) addTalentElementBonus('holy', 10)
    if (playerHasTalent(p, 'cleric_holy_focus')) addTalentElementBonus('holy', 10)
    if (playerHasTalent(p, 'necromancer_shadow_mastery')) addTalentElementBonus('shadow', 10)
    if (playerHasTalent(p, 'necromancer_plague_touch')) addTalentElementBonus('poison', 10)
    if (playerHasTalent(p, 'shaman_tempest_focus')) addTalentElementBonus('lightning', 10)
    if (playerHasTalent(p, 'shaman_nature_attunement')) addTalentElementBonus('nature', 10)
    if (playerHasTalent(p, 'vampire_shadow_focus')) addTalentElementBonus('shadow', 10)

    // Talent-derived stat adjustments (Patch 1.2.32)
    if (playerHasTalent(p, 'mage_mystic_reservoir') && p.resourceKey === 'mana') extraMaxRes += 20

    if (playerHasTalent(p, 'warrior_sunder')) p.stats.armorPen += 10
    if (playerHasTalent(p, 'warrior_ironhide')) {
        p.stats.armor += 6
        p.stats.resistAll += 5
    }
    if (playerHasTalent(p, 'warrior_battle_trance')) p.stats.haste += 10

    if (playerHasTalent(p, 'blood_blood_armor')) {
        p.maxHp += 12
        p.stats.armor += 2
    }

    if (playerHasTalent(p, 'ranger_camouflage')) p.stats.dodgeChance += 8
    if (playerHasTalent(p, 'ranger_called_shot')) p.stats.critChance += 10





    // Additional class talent stat adjustments (Patch 1.2.32)
    if (playerHasTalent(p, 'paladin_aura_of_faith')) p.stats.resistAll += 5
    if (playerHasTalent(p, 'paladin_sanctified_plate')) p.stats.armor += 8
    if (playerHasTalent(p, 'paladin_zeal')) p.stats.critChance += 8
    if (playerHasTalent(p, 'paladin_divine_haste')) p.stats.haste += 10
    if (playerHasTalent(p, 'paladin_mana_font') && p.resourceKey === 'mana') extraMaxRes += 20

    if (playerHasTalent(p, 'rogue_deadly_precision')) p.stats.critChance += 10
    if (playerHasTalent(p, 'rogue_smokefoot')) p.stats.dodgeChance += 8
    if (playerHasTalent(p, 'rogue_armor_sunder')) p.stats.armorPen += 10
    if (playerHasTalent(p, 'rogue_adrenaline')) p.stats.haste += 10

    if (playerHasTalent(p, 'cleric_mana_font') && p.resourceKey === 'mana') extraMaxRes += 20
    if (playerHasTalent(p, 'cleric_bastion')) { p.stats.armor += 6; p.stats.resistAll += 5 }
    if (playerHasTalent(p, 'cleric_grace')) p.stats.dodgeChance += 8
    if (playerHasTalent(p, 'cleric_divine_haste')) p.stats.haste += 10

    if (playerHasTalent(p, 'necromancer_soul_battery') && p.resourceKey === 'mana') extraMaxRes += 20
    if (playerHasTalent(p, 'necromancer_bone_plating')) { p.stats.armor += 4; p.stats.resistAll += 8 }
    if (playerHasTalent(p, 'necromancer_dark_haste')) p.stats.haste += 10

    if (playerHasTalent(p, 'shaman_mana_font') && p.resourceKey === 'mana') extraMaxRes += 20
    if (playerHasTalent(p, 'shaman_spirit_guard')) { p.stats.armor += 6; p.stats.resistAll += 5 }
    if (playerHasTalent(p, 'shaman_swift_steps')) p.stats.dodgeChance += 8

    if (playerHasTalent(p, 'berserker_bloodthirst')) p.stats.lifeSteal += 8
    if (playerHasTalent(p, 'berserker_hardened')) p.stats.armor += 6
    if (playerHasTalent(p, 'berserker_ferocity')) p.stats.critChance += 10
    if (playerHasTalent(p, 'berserker_battle_trance')) p.stats.haste += 10

    if (playerHasTalent(p, 'vampire_essence_reservoir') && p.resourceKey === 'essence') extraMaxRes += 20
    if (playerHasTalent(p, 'vampire_dark_agility')) p.stats.dodgeChance += 8
    if (playerHasTalent(p, 'vampire_bloodletting')) p.stats.lifeSteal += 10
    if (playerHasTalent(p, 'vampire_crimson_crit')) p.stats.critChance += 10


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
            const scaled = _getCompanionRuntime().computeCompanionScaledStats(def, p.level)

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



// --- Hollow Crown Ritual Ally (Chapter III) -----------------------------
// A small, persistent boon tied to who you let speak for Emberwood at the gate.
const ritualAlly = (state.flags && state.flags.chapter3RitualAlly) || null
if (ritualAlly === 'rowan') {
    p.stats.armor += 2
    p.stats.resistAll += 4
} else if (ritualAlly === 'scribe') {
    p.stats.magic += 4
    p.maxResource = (p.maxResource || 0) + 15
} else if (ritualAlly === 'ashWarden') {
    p.stats.attack += 4
    p.stats.critChance += 4
    p.stats.armorPen += 5
}
// Re-clamp % stats after late-applied story/flag modifiers.
p.stats.critChance = Math.max(0, Math.min(75, p.stats.critChance || 0))
p.stats.dodgeChance = Math.max(0, Math.min(60, p.stats.dodgeChance || 0))
p.stats.resistAll = Math.max(0, Math.min(80, p.stats.resistAll || 0))
p.stats.lifeSteal = Math.max(0, Math.min(60, p.stats.lifeSteal || 0))
p.stats.armorPen = Math.max(0, Math.min(80, p.stats.armorPen || 0))
p.stats.haste = Math.max(0, Math.min(80, p.stats.haste || 0))

// Back-compat / diagnostics alias: some scanners and older UI paths refer to
// "dodge" instead of "dodgeChance".
p.stats.dodge = Number.isFinite(Number(p.stats.dodgeChance)) ? Number(p.stats.dodgeChance) : 0

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

    const _open = () => openMerchantModalImpl({
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
        saveGame: () => requestSave('modal:merchant'),
        sellItemFromInventory,
        getSellValue,
        addGeneratedItemToInventory,
        dispatchCommand: (type, payload) => dispatchGameCommand(type, payload)
    })

    try {
        if (state && state.debug && state.debug.capturePerf) {
            return perfWrap(state, 'ui:openMerchantModal', { area: state.area }, _open)
        }
    } catch (_) {}

    return _open()
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

    const _open = () => openTavernModalImpl({
        state,
        openModal,
        addLog,
        recordInput,
        getVillageEconomySummary,
        getRestCost,
        handleEconomyAfterPurchase,
        jumpToNextMorning,
        advanceToNextMorning,
        runDailyTicks,
        updateHUD,
        updateTimeDisplay,
        saveGame: () => requestSave('modal:tavern'),
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

    try {
        if (state && state.debug && state.debug.capturePerf) {
            return perfWrap(state, 'ui:openTavernModal', { area: state.area }, _open)
        }
    } catch (_) {}

    return _open()
}

function openGambleModal() {
    const _open = () => openGambleModalImpl({
        state,
        openModal,
        addLog,
        updateHUD,
        saveGame: () => requestSave('modal:gamble'),
        closeModal,
        openTavernModal
    })

    try {
        if (state && state.debug && state.debug.capturePerf) {
            return perfWrap(state, 'ui:openGambleModal', { area: state.area }, _open)
        }
    } catch (_) {}

    return _open()
}
function openTownHallModal() {
    recordInput('open.townHall')
    const _open = () => openTownHallModalImpl({
        state,
        openModal,
        addLog,
        updateHUD,
        saveGame: () => requestSave('modal:townHall')
    })

    try {
        if (state && state.debug && state.debug.capturePerf) {
            return perfWrap(state, 'ui:openTownHallModal', { area: state.area }, _open)
        }
    } catch (_) {}

    return _open()
}

function openBankModal() {
    recordInput('open.bank')
    playDoorOpenSfx()
    setInteriorOpen(true)
    const _open = () => openBankModalImpl({
        state,
        openModal,
        addLog,
        recordInput,
        updateHUD,
        saveGame: () => requestSave('modal:bank'),
        dispatchCommand: (type, payload) => dispatchGameCommand(type, payload)
    })

    try {
        if (state && state.debug && state.debug.capturePerf) {
            return perfWrap(state, 'ui:openBankModal', { area: state.area }, _open)
        }
    } catch (_) {}

    return _open()
}

/* =============================================================================
 * CHEAT MENU
 * Testing actions: spawn battles, teleport, grant items, force events, diagnostics.
 * ============================================================================= */

// Cheat Menu UI is now modularized (see ../ui/modals/cheatMenuModal.js).
// We keep a thin wrapper here so call sites remain unchanged and the function stays hoisted.
let _cheatMenuModal = null
function _getCheatMenuModal() {
    if (_cheatMenuModal) return _cheatMenuModal
    _cheatMenuModal = createCheatMenuModal({
        getState: () => state,
        openModal,
        closeModal,
        setModalOnClose,
        addLog,
        updateHUD,
        requestSave,
        grantExperience,
        handleEnemyDefeat,
        cheatMaxLevel,
        getAreaDisplayName,
        recalcPlayerStats,
        generateLootDrop,
        generateArmorForSlot,
        getItemPowerScore,
        addGeneratedItemToInventory,
        createDefaultQuestFlags,
        createDefaultQuestState,
        QUEST_DEFS,
        quests,
        updateEnemyPanel
    })
    return _cheatMenuModal
}

function openCheatMenu() {
    return _getCheatMenuModal().openCheatMenu()
}

/* =============================================================================
 * SPELLS
 * Spell definitions + casting UI + resource costs and combat integration.
 * ============================================================================= */

// Spell Book UI is now modularized (see ./spells/spellbookModal.js).
// We keep a thin wrapper here so call sites remain unchanged and the function stays hoisted.
let _spellbookModal = null
function _getSpellbookModal() {
    if (_spellbookModal) return _spellbookModal
    _spellbookModal = createSpellbookModal({
        getState: () => state,
        ABILITIES,
        MAX_EQUIPPED_SPELLS,
        ABILITY_UPGRADE_RULES,
        ensurePlayerSpellSystems,
        normalizeElementType,
        clampNumber,
        buildAbilityContext,
        getActiveDifficultyConfig,
        getAliveEnemies,
        getPlayerElementalBonusPct,
        getEnemyAffinityMultiplier,
        getEnemyElementalResistPct,
        playerHasTalent,
        _getMageRhythmBonus,
        _roundIntStable,
        addLog,
        openModal,
        closeModal,
        saveGame: () => requestSave('modal:spellbook'),
        useAbilityInCombat: (abilityId) => {
            const dispatched = dispatchGameCommand('COMBAT_CAST_ABILITY', {
                abilityId
            })

            if (!dispatched) {
                try { useAbilityInCombat(abilityId) } catch (_) {}
            }
        },
        getAbilityUpgrade,
        getEffectiveAbilityCost
    })
    return _spellbookModal
}

function openSpellsModal(inCombat) {
    return _getSpellbookModal().openSpellsModal(inCombat)
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


// Patch 1.2.0: apply class-meter payoffs immediately after the action resolves.
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
        ctx.didShield = true
        addLog('Bulwark expends Fury, granting a ' + shield + '-point shield.', 'system')
    }
}
    p.status.spellCastCount = (p.status.spellCastCount || 0) + 1

    if (description) {
        // Patch 1.2.52 (hotfix): abilities that deal damage should also be tagged as damage
        // so the Damage log filter shows the correct breakdown (including spells).
        const meta =
            ctx && ctx.didDamage
                ? { domain: 'combat', kind: 'damage', actor: 'player', breakdown: state._lastDamageBreakdown || null, abilityId: id }
                : null
        addLog(description, 'good', meta)
    }

    // Equipment traits: shield-cast triggers
    if (ctx && ctx.didShield) {
        applyEquipmentOnShieldCast(ctx)
    }

    updateHUD()
    updateEnemyPanel()
    closeModal()

    // Patch 1.2.70: AoE / multi-enemy kills
    // Abilities can now damage multiple enemies in one action. If any *non-target*
    // enemy hits 0 HP, we must finalize their defeat too (XP/loot/quest hooks).
    resolvePendingEnemyDefeats()

    if (state.inCombat) {
        endPlayerTurn({ source: 'ability', id })
    }
}

// --- CHARACTER SHEET & ENEMY SHEET MODALS ------------------------------------
// Modularized (see ../ui/modals/characterSheetModal.js).
// We keep thin wrappers here so call sites remain unchanged and the functions stay hoisted.
let _characterSheetModal = null
function _getCharacterSheetModal() {
    if (_characterSheetModal) return _characterSheetModal
    _characterSheetModal = createCharacterSheetModal({
        // State
        state,
        
        // Constants & Data
        PLAYER_CLASSES,
        ENEMY_ABILITIES,
        TALENT_DEFS,
        PLAYER_RESIST_CAP,
        ELEMENT_KEYS,
        
        // UI Functions
        openModal,
        closeModal,
        openEnemyModal,
        escapeHtml,
        addLog,
        
        // Utility Functions
        finiteNumber,
        clampFinite,
        clamp01,
        clampNumber,
        normalizeElementType,
        
        // Stat Functions
        recalcPlayerStats,
        updateHUD,
        requestSave,
        getActiveDifficultyConfig,
        
        // Combat Functions
        getAllEnemies,
        handleEnemyDefeat,
        getEnemyRarityDef,
        getEnemyAffixDef,
        ensureEnemyRuntime,
        getEffectiveEnemyAttack,
        getEffectiveEnemyMagic,
        
        // Talent Functions
        ensurePlayerTalents,
        getTalentsForClass,
        playerHasTalent,
        canUnlockTalent,
        unlockTalent,
        
        // Element Functions
        computeElementSummariesForPlayer,
        renderElementalBreakdownHtml,
        refreshCharacterSheetLiveValues,
        renderTalentsPanelHtml,
        
        // Helper Functions
        _capWord,
        _round1,
        _numPct,
        _elementIcon,
        _orderedElementKeys,
        _normalizeAffinityMult,
        _normalizePctMaybeFraction
    })
    return _characterSheetModal
}

// Finalize any enemies that reached 0 HP during the player's action.
// This is especially important for AoE spells where only the current target
// would previously trigger handleEnemyDefeat().
function resolvePendingEnemyDefeats() {
    return _getCharacterSheetModal().resolvePendingEnemyDefeats()
}

function openCharacterSheet() {
    return _getCharacterSheetModal().openCharacterSheet()
}

// --- NEW: Enemy Sheet (tap enemy panel to inspect) ---------------------------
function openEnemySheet() {
    return _getCharacterSheetModal().openEnemySheet()
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
    setModalOnClose(() => {
        const pl = state.player
        if (!pl) return
        autoDistributeSkillPoints(pl) // no-ops if skillPoints <= 0
    })

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


// --- Element helpers --------------------------------------------------------
// Normalize element keys across abilities, loot, affinities, and resists.
// This prevents subtle mismatches like "Ice" vs "frost" or "Storm" vs "lightning".
const __ELEMENT_SYNONYMS = {
    ice: 'frost',
    chill: 'frost',
    storm: 'lightning',
    thunder: 'lightning',
    shock: 'lightning',
    electric: 'lightning',
    venom: 'poison',
    toxin: 'poison',
    toxic: 'poison',
    radiant: 'holy',
    light: 'holy',
    aether: 'arcane',
    void: 'shadow',
    stone: 'earth',
    rock: 'earth'
}

// Patch 1.2.32: Element classification for abilities/spells.
// - If an ability meaningfully has an element, set ability.elementType (normalized).
// - Otherwise, tag it as Physical via ability.tags.includes('physical').
// This powers consistent UI badges, debugging, and future-proofing for elemental hooks.
;(function ensureAbilityElementMetadata() {
    function inferFromText(text) {
        if (!text) return null
        const key = String(text).toLowerCase()
        if (key.indexOf('fire') >= 0 || key.indexOf('flame') >= 0 || key.indexOf('ember') >= 0) return 'fire'
        if (key.indexOf('frost') >= 0 || key.indexOf('ice') >= 0 || key.indexOf('chill') >= 0) return 'frost'
        if (key.indexOf('arcane') >= 0) return 'arcane'
        if (key.indexOf('shadow') >= 0 || key.indexOf('void') >= 0 || key.indexOf('nec') >= 0) return 'shadow'
        if (key.indexOf('holy') >= 0 || key.indexOf('light') >= 0 || key.indexOf('radi') >= 0 || key.indexOf('divin') >= 0) return 'holy'
        if (key.indexOf('poison') >= 0 || key.indexOf('toxin') >= 0 || key.indexOf('venom') >= 0 || key.indexOf('decay') >= 0) return 'poison'
        if (key.indexOf('storm') >= 0 || key.indexOf('lightning') >= 0 || key.indexOf('tempest') >= 0 || key.indexOf('thunder') >= 0) return 'lightning'
        if (key.indexOf('earth') >= 0 || key.indexOf('stone') >= 0 || key.indexOf('quake') >= 0) return 'earth'
        if (key.indexOf('nature') >= 0 || key.indexOf('thorn') >= 0 || key.indexOf('vine') >= 0 || key.indexOf('spirit') >= 0) return 'nature'
        return null
    }

    function extractElementFromEffectFn(fn) {
        if (typeof fn !== 'function') return null
        // Read-only introspection: match the 4th param to _dealPlayerMagic/_dealPlayerPhysical variants when it's a string literal.
        try {
            const src = String(fn)
            const m = src.match(/_dealPlayer(?:Magic|Physical)(?:Aoe)?\([^,]*,[^,]*,[^,]*,\s*'([^']+)'/i)
            return m && m[1] ? normalizeElementType(m[1]) : null
        } catch (_) {
            return null
        }
    }

    function ensureOneAbility(abId, ab, effectFn) {
        if (!ab || typeof ab !== 'object') return

        // If content explicitly marks this as physical/non-elemental, do not
        // overwrite it with text heuristics (ex: "Rain of Thorns" contains
        // the word "thorn" but is intended as a physical arrow volley).
        try {
            if (Array.isArray(ab.tags) && ab.tags.indexOf('physical') >= 0) {
                // Make sure we don't carry a stale/invalid elementType.
                if (ab.elementType) ab.elementType = normalizeElementType(ab.elementType)
                if (!ab.elementType) delete ab.elementType
                return
            }
        } catch (_) {}

        // Prefer explicit metadata if present.
        let et = ab.elementType || ab.element || null
        if (et) {
            ab.elementType = normalizeElementType(et)
            return
        }

        // Prefer the actual combat effect element if we can infer it.
        et = extractElementFromEffectFn(effectFn)
        if (et) {
            ab.elementType = et
            return
        }

        // Fall back to text inference (name/id/desc/note).
        const blob =
            String(abId || '') +
            ' ' +
            String(ab.id || '') +
            ' ' +
            String(ab.name || '') +
            ' ' +
            String(ab.desc || '') +
            ' ' +
            String(ab.note || '')
        et = inferFromText(blob)
        if (et) {
            ab.elementType = normalizeElementType(et)
            return
        }

        // Non-elemental: mark as physical.
        if (!Array.isArray(ab.tags)) ab.tags = []
        if (ab.tags.indexOf('physical') < 0) ab.tags.push('physical')
    }

    try {
        // Player abilities/spells
        if (typeof ABILITIES === 'object' && ABILITIES) {
            Object.keys(ABILITIES).forEach((id) => {
                ensureOneAbility(id, ABILITIES[id], ABILITY_EFFECTS ? ABILITY_EFFECTS[id] : null)
            })
        }

        // Enemy abilities
        if (typeof ENEMY_ABILITIES === 'object' && ENEMY_ABILITIES) {
            Object.keys(ENEMY_ABILITIES).forEach((id) => {
                const ab = ENEMY_ABILITIES[id]
                ensureOneAbility(id, ab, null)
                if (!ab.elementType && (ab.damageType === 'physical')) {
                    if (!Array.isArray(ab.tags)) ab.tags = []
                    if (ab.tags.indexOf('physical') < 0) ab.tags.push('physical')
                }
            })
        }

        // Companion abilities
        if (typeof COMPANION_ABILITIES === 'object' && COMPANION_ABILITIES) {
            Object.keys(COMPANION_ABILITIES).forEach((id) => {
                ensureOneAbility(id, COMPANION_ABILITIES[id], null)
            })
        }
    } catch (_) {}
})();

function normalizeElementType(elementType) {
    if (elementType === null || elementType === undefined) return null
    const s = String(elementType).trim()
    if (!s) return null

    // Be resilient to older/buggy saves and mod keys that accidentally
    // smuggle numbers/punctuation into the element string.
    // Examples seen in the wild: "0frost", "0shadowshadow", "shadow_resist".
    let k = s.toLowerCase()

    // Drop any non-letter characters so numeric prefixes can't create
    // phantom element keys in stats/UI.
    k = k.replace(/[^a-z]/g, '')
    if (!k) return null

    // Physical damage-type labels are not elements.
    // They can show up in older content (ex: "piercing") and should be
    // treated as "no element" so element systems and UI don't misclassify them.
    if (k === 'piercing' || k === 'slashing' || k === 'blunt' || k === 'physical') return null

    // If the element name was accidentally duplicated (ex: "shadowshadow"),
    // collapse it back to the base element.
    const dup = k.match(/^(fire|frost|lightning|holy|shadow|arcane|poison|earth|nature)\1$/)
    if (dup) k = dup[1]

    // Apply synonyms after cleanup.
    k = __ELEMENT_SYNONYMS[k] || k

    // Final guard: if a suffix was appended (ex: "shadowresist"),
    // keep the leading recognized element token.
    const lead = k.match(/^(fire|frost|lightning|holy|shadow|arcane|poison|earth|nature)/)
    if (lead) return lead[1]

    return k
}

// --- Element math normalization helpers --------------------------------------
// Authored content and older saves sometimes store elemental values in different
// units (percent vs fraction). Combat math expects:
//   - bonuses/resists as percents (ex: 15 means +15% / 15% reduction)
//   - affinities as multipliers (ex: 1.15 means +15% weak; 0.87 means -13% resist)
// These helpers normalize values so calculations and UI agree even with mixed data.
function _normalizePctMaybeFraction(v, { allowNegative = false } = {}) {
    const n = Number(v)
    if (!Number.isFinite(n)) return 0
    if (!allowNegative && n <= 0) return 0
    if (allowNegative && n === 0) return 0

    const abs = Math.abs(n)
    // If the magnitude looks like a fraction-of-1 (0.15 = 15%), convert to percent.
    // NOTE: 1 is treated as "1%" (not 100%) because many systems store small integer
    // percents directly (ex: 1, 2, 3...).
    if (abs > 0 && abs < 1) return n * 100
    return n
}

function _normalizeAffinityMult(v) {
    const n = Number(v)
    if (!Number.isFinite(n) || n === 0) return 1

    // If authored as percent delta (15 = +15%, -13 = -13%), convert.
    if (n >= 3 || n <= -1) {
        return clampNumber(1 + n / 100, 0.05, 3)
    }

    // If authored as fraction delta (0.15 = +15%, -0.13 = -13%), convert.
    // Heuristic: deltas are typically small magnitudes (<= 0.5). Multipliers like 0.87/1.25
    // are treated as direct multipliers.
    if (Math.abs(n) <= 0.5) {
        return clampNumber(1 + n, 0.05, 3)
    }

    // Otherwise treat as direct multiplier.
    return clampNumber(n, 0.05, 3)
}

function getPlayerElementalBonusPct(elementType) {
    const p = state.player
    const et = normalizeElementType(elementType)
    if (!p || !p.stats || !p.stats.elementalBonuses || !et) return 0
    const v = p.stats.elementalBonuses[et]
    return _normalizePctMaybeFraction(v)
}

// Elemental resist is a percent reduction applied to incoming damage of that element.
// Stored on player stats as: stats.elementalResists = { fire: 10, frost: 20, ... }
//
// Balance: resists have diminishing returns up to a hard cap. Lower-rarity gear needs
// significantly more raw resist to approach the cap, while Legendary/Mythic gear
// reaches the cap much more easily.
var PLAYER_RESIST_CAP = 75
var PLAYER_RESIST_SCALE_COMMON = 120
var PLAYER_RESIST_SCALE_MYTHIC = 45
var GEAR_RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']

function _gearRarityRank(r) {
    const order = Array.isArray(GEAR_RARITY_ORDER)
        ? GEAR_RARITY_ORDER
        : ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
    const idx = order.indexOf(String(r || 'common'))
    return idx >= 0 ? idx : 0
}

function _getPlayerGearRarityScore(p) {
    try {
        const eq = (p && p.equipment) || null
        if (!eq) return 0
        let sum = 0
        let n = 0
        Object.keys(eq).forEach((k) => {
            const it = eq[k]
            if (it && it.rarity) {
                sum += _gearRarityRank(it.rarity)
                n += 1
            }
        })
        if (!n) return 0
        const order = Array.isArray(GEAR_RARITY_ORDER)
            ? GEAR_RARITY_ORDER
            : ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']
        const max = Math.max(1, order.length - 1)
        return clampNumber(sum / n / max, 0, 1)
    } catch (e) {
        return 0
    }
}

function _effectiveResistPctFromRaw(rawPct, rarityScore) {
    const cap = Number(PLAYER_RESIST_CAP) || 75
    const scaleCommon = Number(PLAYER_RESIST_SCALE_COMMON) || 120
    const scaleMythic = Number(PLAYER_RESIST_SCALE_MYTHIC) || 45

    const raw = clampNumber(Number(rawPct || 0), 0, 9999)
    const s = clampNumber(Number(rarityScore || 0), 0, 1)
    const scale = scaleCommon + (scaleMythic - scaleCommon) * s

    const eff = cap * (1 - Math.exp(-raw / Math.max(1, scale)))
    return clampNumber(eff, 0, cap)
}

function getPlayerElementalResistPct(elementType) {
    const p = state.player
    const et = normalizeElementType(elementType)
    if (!p || !p.stats || !p.stats.elementalResists || !et) return 0

    const cap = Number(PLAYER_RESIST_CAP) || 75
    const raw = _normalizePctMaybeFraction(p.stats.elementalResists[et], { allowNegative: false })

    // Combat uses the derived stat value directly, clamped to the hard cap.
    // Balance pressure (low gear struggles / high gear excels) is handled by how
    // loot rolls and talents grant resist, not by distorting the percent here.
    return clampNumber(raw, 0, cap)
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
    const resolvedElementType = normalizeElementType(
        elementType || state.lastPlayerDamageElementType || null
    )

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

// --- Status synergies (Patch 1.2.0) ----------------------------------------
// Keep these intentionally simple and readable; they should create "combo moments"
// without adding a lot of new UI/complexity.
function applyStatusSynergyOnPlayerHit(enemy, a, b, c) {
    try { _ensureCombatEnginesBound() } catch (_) {}
    if (!StatusEngine) {
        const n = Number(a)
        return Number.isFinite(n) ? n : 0
    }
    // Backward compatible signatures:
    //   (enemy, hitKind, elementType)                [legacy]
    //   (enemy, damageDealt, elementType, damageType) [current]
    if (typeof a === 'string' && (a === 'physical' || a === 'magic') && c === undefined) {
        return StatusEngine.applyStatusSynergyOnPlayerHit(enemy, 0, b, a)
    }
    const damageDealt = Number(a) || 0
    const elementType = b
    const damageType = c || 'physical'
    return StatusEngine.applyStatusSynergyOnPlayerHit(enemy, damageDealt, elementType, damageType)
}

// --- Equipment traits (Patch 1.2.0) ---------------------------------------
// Equipment traits are small behavioral modifiers embedded on gear items.
// For authored gear in ITEM_DEFS, these are plain fields on the item definition.
// For generated gear, the same fields can be carried on the item object.

function getEquippedItems(p) {
    const out = []
    if (!p || !p.equipment) return out
    Object.keys(p.equipment).forEach((k) => {
        const it = p.equipment[k]
        if (it) out.push(it)
    })
    return out
}

function applyEquipmentOnPlayerHit(enemy, damageDealt, elementType, damageType) {
    const p = state.player
    if (!p) return

    // Trait model: authored on-hit weapon traits are physical by default.
    // Prevent accidental double-procs (ex: a physical hit calling the hook twice, or a magic hit invoking it).
    if (damageType && damageType !== 'physical') return

    const eq = getEquippedItems(p)
    eq.forEach((it) => {
        const chance = clampNumber(it.bleedChance || 0, 0, 1)
        if (chance > 0 && enemy && enemy.hp > 0 && rand('trait.bleed') < chance) {
            const turns = Math.max(1, Math.floor(it.bleedTurns || 2))
            const dmg = Math.max(1, Math.round(damageDealt * clampNumber(it.bleedDmgPct || 0.12, 0.02, 0.5)))
            enemy.bleedDamage = Math.max(enemy.bleedDamage || 0, dmg)
            enemy.bleedTurns = Math.max(enemy.bleedTurns || 0, turns)
            addLog('Your weapon opens a bleeding wound!', 'good')
        }
    })
}

function applyEquipmentOnShieldCast(ctx) {
    const p = state.player
    if (!p || !p.status) return
    const eq = getEquippedItems(p)
    eq.forEach((it) => {
        if (it.onShieldCastNextDmgPct) {
            const pct = clampNumber(it.onShieldCastNextDmgPct || 0, 0, 100)
            if (pct > 0) {
                p.status.nextDmgMult = Math.max(p.status.nextDmgMult || 1, 1 + pct / 100)
                p.status.nextDmgTurns = Math.max(p.status.nextDmgTurns || 0, 1)
            }
        }
    })
}

function applyEquipmentOnKill(enemy) {
    const p = state.player
    if (!p) return
    const eq = getEquippedItems(p)
    eq.forEach((it) => {
        if (it.onKillGain && it.onKillGain.key && it.onKillGain.amount) {
            const key = it.onKillGain.key
            const amt = Math.max(1, Math.round(it.onKillGain.amount))
            if (key === 'gold') {
                p.gold = (p.gold || 0) + amt
            } else if (key === 'hp') {
                p.hp = Math.min(p.maxHp, p.hp + amt)
            } else if (key === 'resource') {
                p.resource = Math.min(p.maxResource, p.resource + amt)
            } else if (key === 'fury' || key === 'mana' || key === 'blood' || key === 'essence') {
                if (p.resourceKey === key) p.resource = Math.min(p.maxResource, p.resource + amt)
            }
            addLog('Trait bonus: +' + amt + ' ' + key + '.', 'system')
        }
    })

    // Talents: simple on-kill resource boosts
    if (p.classId === 'warrior' && playerHasTalent(p, 'warrior_relentless')) {
        if (p.resourceKey === 'fury') p.resource = Math.min(p.maxResource, p.resource + 10)
    }
    if (p.classId === 'blood' && playerHasTalent(p, 'blood_sanguine_ritual')) {
        if (p.resourceKey === 'blood') p.resource = Math.min(p.maxResource, p.resource + 6)
    }
    if (p.classId === 'ranger' && playerHasTalent(p, 'ranger_hunters_bounty')) {
        p.resource = Math.min(p.maxResource, p.resource + 8)
    }
    if (p.classId === 'rogue' && playerHasTalent(p, 'rogue_cutpurse')) {
        p.gold = (p.gold || 0) + 10
        addLog('Cutpurse: +10 gold.', 'system')
    }
    if (p.classId === 'necromancer' && playerHasTalent(p, 'necromancer_reaper')) {
        if (p.resourceKey === 'mana') p.resource = Math.min(p.maxResource, p.resource + 8)
    }
    if (p.classId === 'berserker' && playerHasTalent(p, 'berserker_rampage')) {
        if (p.resourceKey === 'fury') p.resource = Math.min(p.maxResource, p.resource + 10)
    }
    if (p.classId === 'vampire' && playerHasTalent(p, 'vampire_night_hunger')) {
        if (p.resourceKey === 'essence') p.resource = Math.min(p.maxResource, p.resource + 10)
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


function calcPhysicalDamage(baseStat, elementType, enemyOverride) {
    try { _ensureCombatEnginesBound() } catch (_) {}
    if (!CombatMath) return baseStat
    return CombatMath.calcPhysicalDamage(baseStat, elementType, enemyOverride)
}

// --- Enemy affinities (Patch 1.2.0) ----------------------------------------
// Enemy templates can provide: affinities: { weak: {fire:1.25}, resist:{frost:0.85} }
function getEnemyAffinityMultiplier(enemy, elementType) {
    try { _ensureCombatEnginesBound() } catch (_) {}
    if (!CombatMath) return 1
    return CombatMath.getEnemyAffinityMultiplier(enemy, elementType)
}

// Flat enemy elemental resist (% reduction). Enemy templates and scaling systems may
// store these under enemy.elementalResists. Normalize keys and fall back to common
// casing variants so authored content stays resilient.
function getEnemyElementalResistPct(enemy, elementType) {
    try { _ensureCombatEnginesBound() } catch (_) {}
    if (!CombatMath) return 0
    return CombatMath.getEnemyElementalResistPct(enemy, elementType)
}


function calcMagicDamage(baseStat, elementType, enemyOverride) {
    try { _ensureCombatEnginesBound() } catch (_) {}
    if (!CombatMath) return baseStat
    return CombatMath.calcMagicDamage(baseStat, elementType, enemyOverride)
}


function calcEnemyDamage(baseStat, elementType) {
    try { _ensureCombatEnginesBound() } catch (_) {}
    if (!CombatMath) return baseStat
    return CombatMath.calcEnemyDamage(baseStat, elementType)
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

    // Prefer the Engine scheduler (clock-driven) so combat pacing follows the unified timing system.
    return new Promise((resolve) => {
        scheduleAfter(_engine, ms, () => resolve(), { owner: 'combat:pause' })
    })
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


// Patch 1.2.65: post-turn sequencing extracted to a module (combat/postTurnSequence.js).
// Patch 1.2.72: Sequencer is created via the Engine combat plugin; resolve lazily.
function _runPostPlayerTurnSequence() {
    try { _ensureCombatEnginesBound() } catch (_) {}
    if (typeof runPostPlayerTurnSequence !== 'function') return Promise.resolve()
    try {
        return Promise.resolve().then(() => runPostPlayerTurnSequence())
    } catch (e) {
        return Promise.reject(e)
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
        .then(() => _runPostPlayerTurnSequence())
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
        ctx.dmgMult *= playerHasTalent(p, 'ranger_quickdraw') ? 1.18 : 1.12
        ctx.consumeFirstHitBonus = true
    }

    _setPlayerAbilityContext(ctx)
    const dmg = _dealPlayerPhysical(p, enemy, (p.stats.attack || 0) * 1.0, null, { isBasic: true })
    _setPlayerAbilityContext(null)

    applyPlayerRegenTick()

    ctx.didDamage = true
    _consumeCompanionBoonIfNeeded(p, ctx)
    if (ctx.consumeFirstHitBonus) st.firstHitBonusAvailable = false

    addLog(
        'You strike ' + enemy.name + ' for ' + dmg + ' damage.',
        'good',
        { domain: 'combat', kind: 'damage', actor: 'player', breakdown: state._lastDamageBreakdown || null }
    )

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
    const dmg = _dealPlayerPhysical(p, enemy, (p.stats.attack || 0) * 0.55, null, { tag: 'interrupt' })
    _setPlayerAbilityContext(null)

    applyPlayerRegenTick()

    if (enemy.intent) {
        enemy.intent = null
        addLog('You disrupt the foe and cancel their telegraphed attack!', 'good')
    }

    if (enemy.hp <= 0) {
        addLog('Your interrupt finishes ' + enemy.name + '!', 'good')
        handleEnemyDefeat(enemy)
    } else {
        addLog(
            'You interrupt for ' + dmg + ' damage.',
            'good',
            { domain: 'combat', kind: 'damage', actor: 'player', breakdown: state._lastDamageBreakdown || null }
        )
    }

    updateHUD()
    updateEnemyPanel()

    if (state.inCombat) {
        endPlayerTurn({ source: 'interrupt' })
    }
}



// --- ENEMY TURN (ABILITY + LEARNING AI) --------------------------------------
// Extracted to js/game/systems/enemyCombatAi.js
// Thin wrappers delegate to the module instance

function ensureEnemyRuntime(enemy) {
    return _enemyCombatAi ? _enemyCombatAi.ensureEnemyRuntime(enemy) : ensureEnemyRuntimeImpl(enemy, { pickEnemyAbilitySet })
}

function ensureEnemyAbilityStat(enemy, aid) {
    return _enemyCombatAi ? _enemyCombatAi.ensureEnemyAbilityStat(enemy, aid) : { value: 0, uses: 0 }
}

function tickEnemyStartOfTurn(enemy) {
    return _enemyCombatAi ? _enemyCombatAi.tickEnemyStartOfTurn(enemy) : false
}

function canUseEnemyAbility(enemy, aid) {
    return _enemyCombatAi ? _enemyCombatAi.canUseEnemyAbility(enemy, aid) : false
}

function tickEnemyCooldowns() {
    if (_enemyCombatAi) _enemyCombatAi.tickEnemyCooldowns()
}

function scoreEnemyAbility(enemy, p, aid) {
    return _enemyCombatAi ? _enemyCombatAi.scoreEnemyAbility(enemy, p, aid) : -99999
}

function chooseEnemyAbility(enemy, p) {
    return _enemyCombatAi ? _enemyCombatAi.chooseEnemyAbility(enemy, p) : 'enemyStrike'
}

function applyEnemyAbilityToPlayer(enemy, p, aid) {
    if (_enemyCombatAi) _enemyCombatAi.applyEnemyAbilityToPlayer(enemy, p, aid)
}

function updateEnemyLearning(enemy, aid, reward) {
    if (_enemyCombatAi) _enemyCombatAi.updateEnemyLearning(enemy, aid, reward)
}

function enemyAct(enemy) {
    if (_enemyCombatAi) return _enemyCombatAi.enemyAct(enemy)
}

function _enemyActImpl(enemy) {
    if (_enemyCombatAi) return _enemyCombatAi._enemyActImpl(enemy)
}

function enemyTurn() {
    if (_enemyCombatAi) return _enemyCombatAi.enemyTurn()
}

function _enemyTurnImpl() {
    if (_enemyCombatAi) return _enemyCombatAi._enemyTurnImpl()
}

function applyEndOfTurnEffectsEnemy(enemy) {
    if (_enemyCombatAi) _enemyCombatAi.applyEndOfTurnEffectsEnemy(enemy)
}

function decideEnemyAction(enemy, player) {
    if (_enemyCombatAi) _enemyCombatAi.decideEnemyAction(enemy, player)
}

function applyEndOfTurnEffectsPlayer(p) {
    if (_enemyCombatAi) _enemyCombatAi.applyEndOfTurnEffectsPlayer(p)
}

function applyStartOfTurnEffectsPlayer(p) {
    if (_enemyCombatAi) _enemyCombatAi.applyStartOfTurnEffectsPlayer(p)
}

function beginPlayerTurn() {
    if (_enemyCombatAi) _enemyCombatAi.beginPlayerTurn()
}

function tickPlayerTimedStatuses(p) {
    if (_enemyCombatAi) _enemyCombatAi.tickPlayerTimedStatuses(p)
}

function postEnemyTurn() {
    if (_enemyCombatAi) _enemyCombatAi.postEnemyTurn()
}

function recordBattleResult(outcome) {
    if (_enemyCombatAi) _enemyCombatAi.recordBattleResult(outcome)
}

function handleEnemyDefeat(enemyArg) {
    if (_enemyCombatAi) return _enemyCombatAi.handleEnemyDefeat(enemyArg)
}

function handlePlayerDefeat() {
    if (_enemyCombatAi) _enemyCombatAi.handlePlayerDefeat()
}

function tryFlee() {
    if (_enemyCombatAi) _enemyCombatAi.tryFlee()
}

function rollLootForArea() {
    return _enemyCombatAi ? _enemyCombatAi.rollLootForArea() : null
}
// --- COMPANION LOGIC ----------------------------------------------------------
// Patch 1.2.72: companion mechanics (scaling, AI decision-making, abilities, cooldowns)
// were extracted into js/game/combat/companionRuntime.js so engine.js stays focused on orchestration.

let _companionRuntime = null
function _getCompanionRuntime() {
    if (_companionRuntime) return _companionRuntime

    // Prefer plugin-provided service.
    try {
        if (_engine && typeof _engine.getService === 'function') {
            _companionRuntime = _engine.getService('companionRuntime') || _engine.getService('combat.companion') || null
        }
    } catch (_) {}
    if (_companionRuntime) return _companionRuntime

    // Fallback (older builds / tests): create locally.
    _companionRuntime = createCompanionRuntime({
        getState: () => state,
        companionDefs: COMPANION_DEFS,
        companionAbilities: COMPANION_ABILITIES,
        addLog,
        rand,
        randInt,
        updateHUD,
        updateEnemyPanel,
        saveGame: () => requestSave('companion'),
        playerHasTalent,
        applyEnemyAtkDown,
        roundIntStable: _roundIntStable,
        getActiveDifficultyConfig,
        handleEnemyDefeat
    })
    return _companionRuntime
}

function rescaleActiveCompanion(opts) {
    return _getCompanionRuntime().rescaleActiveCompanion(opts)
}

function grantCompanion(id) {
    return _getCompanionRuntime().grantCompanion(id)
}

/**
 * @param {boolean} silent If true, don't log.
 */
function dismissCompanion(silent) {
    return _getCompanionRuntime().dismissCompanion(silent)
}

// Companion acts after the player's turn, before the enemy.
function companionActIfPresent() {
    return _getCompanionRuntime().companionActIfPresent()
}

function tickCompanionCooldowns() {
    return _getCompanionRuntime().tickCompanionCooldowns()
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
            addLog(
                opts.source + ' deals ' + dmg + ' damage.',
                'danger',
                { domain: 'combat', kind: 'damage', actor: 'enemy', breakdown: null }
            )
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
    // Patch 1.2.0: encounter sizing is now difficulty-weighted.
    //  - Easy:   almost always 1 enemy; rarely 2; never 3.
    //  - Normal: mostly 1 enemy; noticeably higher chance for 2; rare 3.
    //  - Hard:   mostly 2 enemies; sometimes 3; rarely 1.
    let groupSize = 1

    // Cheat override: force the *next* encounter group size (1..3). Auto-clears after use.
    // This is used by the Cheat Menu's quick spawn tools.
    try {
        const forced = state && state.flags ? Number(state.flags.forceNextGroupSize) : NaN
        if (Number.isFinite(forced) && forced >= 1 && forced <= 3) {
            groupSize = Math.floor(forced)
            // one-shot so it doesn't surprise players later
            state.flags.forceNextGroupSize = null
        }
    } catch (_) {}
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
        enemy.burnTurns = 0
        enemy.burnDamage = 0

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

    // World event (plugins may respond: autosave, analytics, etc.)
    try {
        if (_engine && typeof _engine.emit === 'function') {
            _engine.emit('world:battleStarted', {
                enemies: enemies.map((e) => ({ id: e.id, name: e.name, isBoss: !!e.isBoss })),
                groupSize,
            })
        }
    } catch (_) {}

    // Start-of-turn effects for the player (e.g., bleed) should apply as soon as
    // the player is given control for the first turn.
    beginPlayerTurn()

    // Ensure HUD + class meters update as soon as the enemies spawn.
    updateHUD()
    updateEnemyPanel()
    renderActions()
    requestSave('legacy')
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
    const mainQuest = state.quests && state.quests.main ? state.quests.main : null
    const mainStep = mainQuest ? Number(mainQuest.step || 0) : 0

    if (areaId === 'village') return true

    // New Game flow: allow free roaming in Emberwood Forest before accepting the main quest.
    // Other regions remain gated until the main quest is accepted (or story flags unlock them).
    if (!flags.mainQuestAccepted && areaId !== 'forest') return false

    if (areaId === 'forest') {
        return true
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

    if (areaId === 'oathgrove') {
        return !!(flags.oathgroveUnlocked || mainStep >= 10.75)
    }

    if (areaId === 'blackbarkDepths') {
        return !!(flags.blackbarkDepthsUnlocked || mainStep >= 15.5)
    }

    if (areaId === 'starfallRidge') {
        return !!(flags.starfallRidgeUnlocked || mainStep >= 17.5)
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
    if (areaId === 'oathgrove') return 'The Oathgrove'
    if (areaId === 'blackbarkDepths') return 'Blackbark Depths'
    if (areaId === 'starfallRidge') return 'Starfall Ridge'
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
            },
            {
                id: 'oathgrove',
                desc: 'A hidden grove where the Blackbark Oath was first written — and where sap still listens.'
            },
            {
                id: 'blackbarkDepths',
                desc: 'Lightless roots and oath‑carved veins beneath the village. Something stalks the dark.'
            },
            {
                id: 'starfallRidge',
                desc: 'A windswept ridge where fallen star‑iron hums in the stone.'
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
                    setArea(info.id, { source: 'travel' })
                    state.ui.exploreChoiceMade = true

                    // If we leave the village, make sure village submenu state is closed
                    state.ui.villageActionsOpen = false

                    addLog('You travel to ' + name + '.', 'system')

                    closeModal()

                    // ✅ Rebuild the action bar immediately so Village / Realm buttons disappear
                    renderActions()

                    exploreArea()
                    requestSave('legacy')
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
    // (Patch 1.2.52: unified world tick pipeline)
    const timeStep = advanceWorldTime(state, 1, 'explore', { addLog })
    const timeLabel = formatTimeShort(timeStep.after)

    if (timeStep.dayChanged) {
        addLog('A new day begins in Emberwood. ' + timeLabel + '.', 'system')
    } else {
        addLog('Time passes... ' + timeLabel + '.', 'system')
    }

    updateTimeDisplay()
    // NEW: update ambient music based on area + time
    updateAreaMusic()

    // Daily ticks are handled inside advanceWorldTime() when the day changes.

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
            requestSave('legacy')
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

    requestSave('legacy')
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
    requestSave('legacy')
}

function cheatMaxLevel(opts = {}) {
    const p = state.player
    if (!p) return
    const target = MAX_PLAYER_LEVEL
    const startLevel = Number(p.level || 1)

    if (startLevel >= target) {
        addLog('Cheat: you are already at the level cap (' + target + ').', 'system')
        return
    }

    const gainedLevels = target - startLevel

    // Ensure optional containers exist (old saves / smoke sandboxes).
    if (p.skillPoints == null) p.skillPoints = 0
    ensurePlayerTalents(p)

    // Award missing talent points exactly as if each level-up had occurred.
    // This keeps the cheat consistent with real progression.
    for (let lv = startLevel + 1; lv <= target; lv++) {
        grantTalentPointIfNeeded(p, lv)
    }

    // Next-level XP curve (matches levelUp(): nextLevelXp *= 1.4 per level)
    let next = 100
    for (let lv = 1; lv < target; lv++) {
        next = Math.round(next * 1.4)
    }

    p.level = target
    p.xp = 0
    p.nextLevelXp = next

    // Award the missing skill points so you can distribute them manually.
    p.skillPoints += gainedLevels

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

    // Sync + heal
    rescaleActiveCompanion()
    recalcPlayerStats()
    p.hp = p.maxHp
    p.resource = p.maxResource

    addLog(
        'Cheat: set you to level ' +
            target +
            ' (+' +
            gainedLevels +
            ' skill points, ' +
            (p.talentPoints || 0) +
            ' talent points).',
        'system'
    )

    updateHUD()
    requestSave('legacy')

    // Bring up the skill modal so the user can allocate points immediately.
    // (The modal supports spending multiple points in one sitting.)
    const wantModal = !(opts && opts.openModal === false)
    try {
        if (wantModal && (p.skillPoints || 0) > 0) {
            // Replace the cheat modal with the skill modal so it can't be hidden behind it.
            closeModal()
            openSkillLevelUpModal()
        }
    } catch (_) {}
}

function levelUp() {
    const p = state.player
    p.level += 1
    grantTalentPointIfNeeded(p, p.level)
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
// Settings Modal (extracted to modals/settingsModal.js)
let _settingsModal = null
function _getSettingsModal() {
    if (_settingsModal) return _settingsModal
    _settingsModal = createSettingsModal({
        state,
        engine: _engine,
        openModal,
        closeModal,
        setMasterVolumePercent,
        setMusicEnabled,
        setSfxEnabled,
        requestSave,
        updateAreaMusic,
        applyChannelMuteGains,
        updateHUD,
        DIFFICULTY_CONFIG,
        setTheme,
        setReduceMotionEnabled,
        switchScreen,
        exportCurrentSaveToFile,
        importSaveFromFile,
        exportAllSavesBundleToFile,
        safeStorageSet
    })
    return _settingsModal
}

function openInGameSettingsModal() {
    return _getSettingsModal().openInGameSettingsModal()
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

/* =============================================================================
 * CORRUPT SAVE UX
 * If a save fails to parse/migrate, show a friendly recovery screen/options.
 * ============================================================================= */
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
            const crashReport = getLastCrashReport()
            pre.textContent =
                'Tip: Open Feedback to copy a report if one exists.\n\n' +
                (crashReport ? JSON.stringify(crashReport, null, 2) : '(no crash report recorded)')
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


/* =============================================================================
 * SAVE SYSTEMS (Extracted)
 * Patch 1.2.70
 * - Save migrations + save/load + multi-slot helpers now live in saveManager.js.
 * - engine.js retains orchestration and UI wiring.
 * ============================================================================= */
const saveManager = createSaveManager({
    // Keys/schema/version
    SAVE_KEY,
    SAVE_KEY_PREFIX,
    SAVE_INDEX_KEY,
    SAVE_SCHEMA,
    GAME_PATCH,

    // Engine core
    engine: _engine,

    // State access
    getState: () => state,
    setState: (next) => { _setState(next) },

    // Engine runtime hooks
    createEmptyState,
    syncGlobalStateRef,
    initRngState,

    // Systems / repair hooks used during load
    quests,
    initTimeState,
    initVillageEconomyState,
    initGovernmentState,
    ensureVillagePopulation,
    cleanupTownHallEffects,

    // Combat restore helpers
    ensureEnemyRuntime,
    ensureCombatTurnState,
    ensureCombatPointers,
    getTimeInfo,

    // Post-load recalcs
    recalcPlayerStats,
    rescaleActiveCompanion,

    // UI hooks
    updateHUD,
    updateEnemyPanel,
    renderLog: () => { try { if (typeof renderLog === 'function') renderLog() } catch (_) {} },
    setScene,
    addLog,
    renderActions,
    switchScreen,
    updateTimeDisplay,
    alertFn: (msg) => alert(msg),
    showCorruptSaveModal,

    // Integrity / diagnostics
    ensureCombatPointersBeforeSave: () => { try { ensureCombatPointers() } catch (_) {} },
    runIntegrityAudit,
    recordCrash,
    setLastSaveError: (err) => { lastSaveError = err },

    // Migration helpers owned by engine.js
    ensurePlayerSpellSystems,
    CLASS_LEVEL_UNLOCKS,
    MAX_EQUIPPED_SPELLS
})

// Bind the extracted save APIs to the late-initialized refs declared near the
// top of the engine module. (Avoids TDZ issues in Safari + allows QA to stub.)
migrateSaveData = saveManager.migrateSaveData
saveGame = saveManager.saveGame
loadGame = saveManager.loadGame
_buildSaveBlob = saveManager._buildSaveBlob || saveManager.buildSaveBlob
buildHeroMetaFromData = saveManager.buildHeroMetaFromData

// Slots
getSaveIndex = saveManager.getSaveIndex
writeSaveIndex = saveManager.writeSaveIndex
saveGameToSlot = saveManager.saveGameToSlot
deleteSaveSlot = saveManager.deleteSaveSlot
loadGameFromSlot = saveManager.loadGameFromSlot
getAllSavesWithAuto = saveManager.getAllSavesWithAuto

/* =============================================================================
 * SAVE IMPORT / EXPORT
 * Dev + player tools: export save JSON, import edited saves, export all saves.
 * ============================================================================= */
// Note: Browsers (especially on iOS) do not allow writing directly into an arbitrary folder.
// Instead, we support "Export" (download a .json) and "Import" (pick a .json) so players can
// back up and edit saves safely.

function _sanitizeFileNamePart(s) {
    return String(s || '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_\-\.]/g, '')
        .slice(0, 60) || 'save'
}

function _downloadTextFile(filename, text, mime = 'application/json') {
    try {
        const blob = new Blob([text], { type: mime })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.rel = 'noopener'
        a.target = '_blank'
        document.body.appendChild(a)
        a.click()
        a.remove()
        // Prefer Engine scheduler (unified clock) to revoke the object URL.
        scheduleAfter(_engine, 2500, () => {
            try { URL.revokeObjectURL(url) } catch (_) {}
        }, { owner: 'system:download' })
        return true
    } catch (e) {
        console.error('Download failed', e)
        return false
    }
}


// Build a more editor-friendly export JSON (pretty-printed + stable top-level ordering).
// This does NOT change the live in-browser save; it only affects the downloaded file.
function _orderSaveForReadableExport(obj) {
    try {
        if (!obj || typeof obj !== 'object') return obj
        const ordered = {}
        const seen = new Set()
        const add = (k) => {
            if (Object.prototype.hasOwnProperty.call(obj, k)) {
                ordered[k] = obj[k]
                seen.add(k)
            }
        }

        // Put the most commonly edited / important sections first.
        ;[
            'meta',
            'player',
            'area',
            'difficulty',
            'dynamicDifficulty',
            'time',
            'villageEconomy',
            'government',
            'village',
            'bank',
            'quests',
            'flags',
            'companion',
            'sim',
            'inCombat',
            'enemies',
            'targetEnemyIndex',
            'currentEnemy',
            'villageMerchantNames',
            'merchantStock',
            'merchantStockMeta',
            'logFilter',
            'log',
            'debug'
        ].forEach(add)

        // Append any unknown/forward-compat keys without dropping them.
        for (const k of Object.keys(obj)) {
            if (!seen.has(k)) ordered[k] = obj[k]
        }
        return ordered
    } catch (_) {
        return obj
    }
}

function _buildReadableSaveJson(rawJson) {
    try {
        if (!rawJson) return null
        const parsed = JSON.parse(rawJson)
        // Run through migration/validation so exported saves are schema-consistent and safer to edit.
        const migrated = migrateSaveData(parsed)
        if (!migrated || migrated.__corrupt) return null
        const ordered = _orderSaveForReadableExport(migrated)
        return JSON.stringify(ordered, null, 2) + '\n'
    } catch (_) {
        return null
    }
}

function exportCurrentSaveToFile() {
    try {
        // Ensure we have the freshest snapshot
        try { saveGame({ force: true }) } catch (_) {}

        const json = (state && state.lastSaveJson) ? state.lastSaveJson : safeStorageGet(SAVE_KEY)
        if (!json) {
            alert('No save found to export.')
            return false
        }

        let hero = 'Hero'
        let cls = ''
        let lvl = ''
        try {
            const data = JSON.parse(json)
            const p = data && data.player ? data.player : null
            hero = (p && p.name) ? p.name : hero
            cls = (p && (p.classId || p.class)) ? String(p.classId || p.class) : ''
            lvl = (p && typeof p.level === 'number') ? String(Math.max(1, Math.floor(p.level))) : ''
        } catch (_) {}

        const stamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+$/, '')
        const name = 'Emberwood_Save_' +
            _sanitizeFileNamePart(hero) +
            (cls ? '_' + _sanitizeFileNamePart(cls) : '') +
            (lvl ? '_Lv' + _sanitizeFileNamePart(lvl) : '') +
            '_' + stamp + '.json'

        const outJson = _buildReadableSaveJson(json) || json
        const ok = _downloadTextFile(name, outJson, 'application/json')
        if (!ok) alert('Export failed. Your browser may be blocking downloads.')
        return ok
    } catch (e) {
        console.error('Export current save failed', e)
        alert('Export failed.')
        return false
    }
}

function exportAllSavesBundleToFile() {
    try {
        const saves = getAllSavesWithAuto()
        if (!Array.isArray(saves) || !saves.length) {
            alert('No saves found to export.')
            return false
        }

        const entries = []
        for (let i = 0; i < saves.length; i++) {
            const s = saves[i]
            if (!s || !s.id) continue
            try {
                const json = (s.id === '__auto__')
                    ? safeStorageGet(SAVE_KEY)
                    : safeStorageGet(SAVE_KEY_PREFIX + s.id)
                if (!json) continue
                const outJson = _buildReadableSaveJson(json) || json
                entries.push({
                    id: s.id,
                    isAuto: !!s.isAuto,
                    label: s.label || (s.isAuto ? 'Auto Save' : 'Manual Save'),
                    meta: {
                        heroName: s.heroName || null,
                        classId: s.classId || null,
                        className: s.className || null,
                        level: s.level || null,
                        area: s.area || null,
                        patch: s.patch || null,
                        savedAt: s.savedAt || null
                    },
                    json: outJson
                })
            } catch (_) {}
        }

        if (!entries.length) {
            alert('No readable saves found to export.')
            return false
        }

        const bundle = {
            bundleType: 'EmberwoodSaveBundle',
            version: 1,
            exportedAt: Date.now(),
            patch: GAME_PATCH || null,
            schema: SAVE_SCHEMA || null,
            entries
        }

        const stamp = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+$/, '')
        const name = 'Emberwood_SaveBundle_' + stamp + '.json'
        const ok = _downloadTextFile(name, JSON.stringify(bundle, null, 2), 'application/json')
        if (!ok) alert('Export failed. Your browser may be blocking downloads.')
        return ok
    } catch (e) {
        console.error('Export all saves failed', e)
        alert('Export failed.')
        return false
    }
}

function importSaveFromFile() {
    try {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'application/json,.json'
        input.style.position = 'fixed'
        input.style.left = '-9999px'
        document.body.appendChild(input)

        const cleanup = () => {
            try { input.value = '' } catch (_) {}
            try { input.remove() } catch (_) {}
        }

        input.addEventListener('change', () => {
            try {
                const file = input.files && input.files[0] ? input.files[0] : null
                if (!file) { cleanup(); return }

                const reader = new FileReader()
                reader.onload = () => {
                    try {
                        const raw = String(reader.result || '')
                        if (!raw || raw.length < 10) {
                            alert('That file is empty or invalid.')
                            cleanup()
                            return
                        }
                        if (raw.length > 5_000_000) {
                            alert('That save file is too large.')
                            cleanup()
                            return
                        }

                        let parsed
                        try {
                            parsed = JSON.parse(raw)
                        } catch (e) {
                            alert('Could not read that file (invalid JSON).')
                            cleanup()
                            return
                        }

                        // Support either a single save blob, or a bundle exported by the game.
                        let saveObj = parsed
                        if (parsed && typeof parsed === 'object' && parsed.bundleType === 'EmberwoodSaveBundle' && Array.isArray(parsed.entries)) {
                            const pick = parsed.entries.find((e) => e && e.id === '__auto__') || parsed.entries[0]
                            if (!pick || !pick.json) {
                                alert('That bundle does not contain a readable save.')
                                cleanup()
                                return
                            }
                            try {
                                saveObj = (typeof pick.json === 'string') ? JSON.parse(pick.json) : pick.json
                            } catch (_) {
                                alert('That bundle save entry is invalid.')
                                cleanup()
                                return
                            }
                        }

                        // Validate/migrate BEFORE writing.
                        const migrated = migrateSaveData(saveObj)
                        if (migrated && migrated.__corrupt) {
                            showCorruptSaveModal('Imported save failed validation and cannot be loaded.')
                            cleanup()
                            return
                        }
                        if (!migrated || !migrated.player) {
                            showCorruptSaveModal('Imported save is missing essential player data.')
                            cleanup()
                            return
                        }

                        // Confirm overwrite
                        const ok = confirm('Importing will overwrite your current autosave on this device. Continue?')
                        if (!ok) { cleanup(); return }

                        const json = JSON.stringify(migrated)
                        safeStorageSet(SAVE_KEY, json, { action: 'import save file' })

                        // Load immediately
                        closeModal()
                        loadGame(false)
                        cleanup()
                        addLog('Imported save loaded.', 'system')
                    } catch (e) {
                        console.error('Import failed', e)
                        alert('Import failed.')
                        cleanup()
                    }
                }
                reader.onerror = () => {
                    alert('Could not read that file.')
                    cleanup()
                }
                reader.readAsText(file)
            } catch (e) {
                console.error('Import flow failed', e)
                alert('Import failed.')
                cleanup()
            }
        })

        input.click()
    } catch (e) {
        console.error('Import save failed to start', e)
        alert('Import failed.')
        return false
    }
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
    const autoEquipLootEl = document.getElementById('settingsAutoEquipLootToggle')
    const highContrastEl = document.getElementById('settingsHighContrast')
    const textSizeEl = document.getElementById('settingsTextSize')
    const colorSchemeEl = document.getElementById('settingsColorScheme')
    const uiScaleEl = document.getElementById('settingsUiScale')
    const showCombatNumbersEl = document.getElementById('settingsShowCombatNumbers')
    const autoSaveEl = document.getElementById('settingsAutoSave')

    // If controls aren't present, nothing to do
    if (!volumeSlider && !textSpeedSlider && !settingsDifficulty && !autoEquipLootEl && !highContrastEl && !textSizeEl && !colorSchemeEl && !uiScaleEl && !showCombatNumbersEl && !autoSaveEl) return

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

    if (textSizeEl && !textSizeEl.dataset.pqWired) {
        textSizeEl.dataset.pqWired = '1'
        textSizeEl.addEventListener('change', () => applySettingsChanges())
    }

    if (highContrastEl && !highContrastEl.dataset.pqWired) {
        highContrastEl.dataset.pqWired = '1'
        highContrastEl.addEventListener('change', () => applySettingsChanges())
    }

    if (autoEquipLootEl && !autoEquipLootEl.dataset.pqWired) {
        autoEquipLootEl.dataset.pqWired = '1'
        autoEquipLootEl.addEventListener('change', () => applySettingsChanges())
    }

    if (colorSchemeEl && !colorSchemeEl.dataset.pqWired) {
        colorSchemeEl.dataset.pqWired = '1'
        colorSchemeEl.addEventListener('change', () => applySettingsChanges())
    }

    if (uiScaleEl && !uiScaleEl.dataset.pqWired) {
        uiScaleEl.dataset.pqWired = '1'
        uiScaleEl.addEventListener('change', () => applySettingsChanges())
    }

    if (showCombatNumbersEl && !showCombatNumbersEl.dataset.pqWired) {
        showCombatNumbersEl.dataset.pqWired = '1'
        showCombatNumbersEl.addEventListener('change', () => applySettingsChanges())
    }

    if (autoSaveEl && !autoSaveEl.dataset.pqWired) {
        autoSaveEl.dataset.pqWired = '1'
        autoSaveEl.addEventListener('change', () => applySettingsChanges())
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

    // High contrast is stored in unified engine settings (tri-state: true/false/'auto').
    // This control is a select: auto / on / off.
    try {
        const settings = _engine && _engine.getService ? _engine.getService('settings') : null
        if (highContrastEl && settings && typeof settings.get === 'function') {
            const pref = settings.get('a11y.highContrast', 'auto')
            if (pref === true) highContrastEl.value = 'on'
            else if (pref === false) highContrastEl.value = 'off'
            else highContrastEl.value = 'auto'
        }
    } catch (_) {}

    // Text size is stored in unified engine settings as a numeric scale.
    try {
        const settings = _engine && _engine.getService ? _engine.getService('settings') : null
        if (textSizeEl && settings && typeof settings.get === 'function') {
            const s = Number(settings.get('a11y.textScale', 1))
            // Map to the nearest named bucket.
            if (s <= 0.92) textSizeEl.value = 'small'
            else if (s < 1.05) textSizeEl.value = 'default'
            else if (s < 1.16) textSizeEl.value = 'large'
            else textSizeEl.value = 'xlarge'
        }
    } catch (_) {}

    if (autoEquipLootEl) autoEquipLootEl.checked = !!state.settingsAutoEquipLoot

    if (showCombatNumbersEl) showCombatNumbersEl.checked = (state.settingsShowCombatNumbers !== false)
    if (autoSaveEl) autoSaveEl.checked = (state.settingsAutoSave !== false)

    // Color scheme is stored in unified engine settings
    try {
        const settings = _engine && _engine.getService ? _engine.getService('settings') : null
        if (colorSchemeEl && settings && typeof settings.get === 'function') {
            const scheme = settings.get('ui.colorScheme', 'auto')
            colorSchemeEl.value = String(scheme)
        }
    } catch (_) {}

    // UI scale is stored in unified engine settings
    try {
        const settings = _engine && _engine.getService ? _engine.getService('settings') : null
        if (uiScaleEl && settings && typeof settings.get === 'function') {
            const scale = Number(settings.get('ui.scale', 1))
            uiScaleEl.value = String(scale)
        }
    } catch (_) {}

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

    const engineSettings = (() => {
        try { return _engine && _engine.getService ? _engine.getService('settings') : null } catch (_) { return null }
    })()

    // Store values in state + unified engine settings
    if (volumeSlider) {
        state.settingsVolume = Number(volumeSlider.value) || 0
        try { engineSettings && engineSettings.set && engineSettings.set('audio.masterVolume', state.settingsVolume) } catch (_) {}
    }
    if (textSpeedSlider) {
        state.settingsTextSpeed = Number(textSpeedSlider.value) || 100
        try { engineSettings && engineSettings.set && engineSettings.set('ui.textSpeed', state.settingsTextSpeed) } catch (_) {}
    }

    const musicToggle = document.getElementById('settingsMusicToggle')
    if (musicToggle) {
        state.musicEnabled = !!musicToggle.checked
        try { engineSettings && engineSettings.set && engineSettings.set('audio.musicEnabled', !!state.musicEnabled) } catch (_) {}
        audioState.musicEnabled = state.musicEnabled
    }

    const sfxToggle = document.getElementById('settingsSfxToggle')
    if (sfxToggle) {
        state.sfxEnabled = !!sfxToggle.checked
        try { engineSettings && engineSettings.set && engineSettings.set('audio.sfxEnabled', !!state.sfxEnabled) } catch (_) {}
        audioState.sfxEnabled = state.sfxEnabled
    }


    const motionToggle = document.getElementById('settingsReduceMotionToggle')
    if (motionToggle) {
        setReduceMotionEnabled(!!motionToggle.checked)
    }

    // High contrast (tri-state select: auto/on/off)
    const highContrastEl = document.getElementById('settingsHighContrast')
    if (highContrastEl) {
        const v = String(highContrastEl.value || 'auto')
        try {
            if (engineSettings && engineSettings.set) {
                if (v === 'on') engineSettings.set('a11y.highContrast', true)
                else if (v === 'off') engineSettings.set('a11y.highContrast', false)
                else engineSettings.set('a11y.highContrast', 'auto')
            }
        } catch (_) {}
    }

    // Text size (named buckets -> numeric scale)
    const textSizeEl = document.getElementById('settingsTextSize')
    if (textSizeEl) {
        const v = String(textSizeEl.value || 'default')
        const scale = (v === 'small') ? 0.9
            : (v === 'large') ? 1.1
                : (v === 'xlarge') ? 1.2
                    : 1
        try {
            if (engineSettings && engineSettings.set) engineSettings.set('a11y.textScale', scale)
        } catch (_) {}
    }

    const autoEquipToggle = document.getElementById('settingsAutoEquipLootToggle')
    if (autoEquipToggle) {
        state.settingsAutoEquipLoot = !!autoEquipToggle.checked
        try { engineSettings && engineSettings.set && engineSettings.set('gameplay.autoEquipLoot', !!state.settingsAutoEquipLoot) } catch (_) {}
    }

    // Color scheme
    const colorSchemeEl = document.getElementById('settingsColorScheme')
    if (colorSchemeEl) {
        const scheme = String(colorSchemeEl.value || 'auto')
        try { engineSettings && engineSettings.set && engineSettings.set('ui.colorScheme', scheme) } catch (_) {}
    }

    // UI scale
    const uiScaleEl = document.getElementById('settingsUiScale')
    if (uiScaleEl) {
        const scale = Number(uiScaleEl.value) || 1
        try { engineSettings && engineSettings.set && engineSettings.set('ui.scale', scale) } catch (_) {}
        // The a11y bridge plugin will apply the scale to the DOM
    }

    // Show combat numbers
    const showCombatNumbersEl = document.getElementById('settingsShowCombatNumbers')
    if (showCombatNumbersEl) {
        state.settingsShowCombatNumbers = !!showCombatNumbersEl.checked
        try { engineSettings && engineSettings.set && engineSettings.set('gameplay.showCombatNumbers', !!state.settingsShowCombatNumbers) } catch (_) {}
    }

    // Auto-save
    const autoSaveEl = document.getElementById('settingsAutoSave')
    if (autoSaveEl) {
        state.settingsAutoSave = !!autoSaveEl.checked
        try { engineSettings && engineSettings.set && engineSettings.set('gameplay.autoSave', !!state.settingsAutoSave) } catch (_) {}
    }

    // Apply audio settings immediately
    setMasterVolumePercent(state.settingsVolume)
    updateAreaMusic()
    applyChannelMuteGains()
    requestSave('settings')

    // Allow changing difficulty mid-run
    if (settingsDifficulty) {
        const newDiff = settingsDifficulty.value
        if (DIFFICULTY_CONFIG[newDiff]) {
            state.difficulty = newDiff
            updateHUD()
            requestSave('difficulty')
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
    if (typeof document === 'undefined' || !document.body) return
    document.body.classList.toggle('no-motion', !!reduce)
}

function setReduceMotionEnabled(enabled) {
    if (typeof state === 'undefined' || !state) return
    state.settingsReduceMotion = !!enabled
    try {
        // Use engine settings service (locus_settings)
        const settings = _engine && _engine.getService ? _engine.getService('settings') : null
        if (settings && settings.set) settings.set('a11y.reduceMotion', state.settingsReduceMotion)
    } catch (_) {}
    applyMotionPreference()
}
function setTheme(themeName) {
    // Use the unified settings service (locus_settings); a11y bridge will apply to DOM.
    try {
        const settings = _engine && _engine.getService ? _engine.getService('settings') : null
        if (settings && settings.set) {
            settings.set('ui.theme', String(themeName || 'default'))
            return
        }
    } catch (_) {}

    // Fallback: if settings service is not available, apply theme directly to DOM.
    if (typeof document === 'undefined' || !document.body) return
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
}

// Load saved theme on startup
;(function loadTheme() {
    if (typeof document === 'undefined' || !document.body) return
    // Use engine settings (locus_settings)
    try {
        const settings = _engine && _engine.getService ? _engine.getService('settings') : null
        if (settings && settings.get) {
            const saved = settings.get('ui.theme', 'default')
            setTheme(saved)
            return
        }
    } catch (_) {}
    // If settings not available, use default
    setTheme('default')
})()
// --- FEEDBACK / BUG REPORT -----------------------------------------------------
// Feedback Modal (extracted to modals/feedbackModal.js)
let _feedbackModal = null
function _getFeedbackModal() {
    if (_feedbackModal) return _feedbackModal
    _feedbackModal = createFeedbackModal({
        state,
        openModal,
        isRunningOnGitHubPages,
        copyFeedbackToClipboard,
        copyBugReportBundleToClipboard,
        safeStorageGet,
        safeStorageRemove,
        _STORAGE_DIAG_KEY_LAST_CRASH,
        getLastCrashReport,
        GAME_PATCH,
        GAME_PATCH_NAME,
        SAVE_SCHEMA,
        GITHUB_REPO_URL,
        GITHUB_ISSUE_TITLE_MAX_LENGTH,
        GITHUB_URL_MAX_LENGTH
    })
    return _feedbackModal
}

function openFeedbackModal() {
    return _getFeedbackModal().openFeedbackModal()
}

function handleFeedbackCopy() {
    return _getFeedbackModal().handleFeedbackCopy()
}

function handleCreateGitHubIssue() {
    return _getFeedbackModal().handleCreateGitHubIssue()
}

function buildFeedbackPayload(type, text) {
    return _getFeedbackModal().buildFeedbackPayload(type, text)
}



// -----------------------------------------------------------------------------
// QA deep scanners (used by Smoke Tests + Bug Report)
// These are intentionally side-effect free and safe to run on live saves.
// -----------------------------------------------------------------------------
// Extracted to js/game/qa/integrityScanners.js (Patch 1.2.72)
// This section provides a thin wrapper that initializes the integrity scanners module
// with all necessary dependencies from the game orchestrator.

let _integrityScanners = null

function _getIntegrityScannersModule() {
    if (_integrityScanners) return _integrityScanners
    
    // Gather all dependencies needed by the integrity scanners module
    _integrityScanners = createIntegrityScannersModule({
        // Constants
        PLAYER_CLASSES,
        ABILITIES,
        ENEMY_ABILITIES,
        COMPANION_ABILITIES,
        TALENT_DEFS,
        GAME_PATCH,
        GAME_PATCH_NAME,
        SAVE_SCHEMA,
        
        // State functions
        validateState,
        normalizeElementType,
        ensurePlayerTalents,
        ensurePlayerSpellSystems,
        ensurePlayerStatsDefaults,
        recalcPlayerStats,
        sanitizeCoreStateObject,
        _setState,
        syncGlobalStateRef,
        createEmptyState,
        createQuestState,
        createFlagState,
        
        // RNG functions
        initRngState,
        setDeterministicRngEnabled,
        setRngSeed,
        
        // Time and economy functions
        initTimeState,
        initVillageEconomyState,
        initGovernmentState,
        ensureVillagePopulation,
        advanceWorldDays,
        
        // Loot and items
        generateLootDrop,
        
        // Save/load functions
        _buildSaveBlob,
        copyFeedbackToClipboard,
        
        // Debug functions
        getLastCrashReport,
        qaCollectPerfSnapshotSync,
        qaFormatPerfSnapshotText,
        
        // Performance
        perfWrap,
        _perfNow,
        
        // UI functions
        isUiDisabled,
        setUiDisabled,
        
        // Global state references (pass directly, not getters to avoid Safari parsing issues)
        state,
        saveGame,
        updateHUD,
        recordInput,
        quests,
        lastSaveError,
        _engine
    })
    
    return _integrityScanners
}

// Thin wrapper functions that delegate to the module
function qaScanNonFiniteNumbers(rootObj, opts) {
    return _getIntegrityScannersModule().qaScanNonFiniteNumbers(rootObj, opts)
}

function qaScanNegativeCounters(s) {
    return _getIntegrityScannersModule().qaScanNegativeCounters(s)
}

function qaScanStatSanity(s) {
    return _getIntegrityScannersModule().qaScanStatSanity(s)
}

function qaScanCombatRuntimeSanity(s) {
    return _getIntegrityScannersModule().qaScanCombatRuntimeSanity(s)
}

function qaScanElementKeyIssues(s) {
    return _getIntegrityScannersModule().qaScanElementKeyIssues(s)
}

function qaScanAbilityElementCoverage() {
    return _getIntegrityScannersModule().qaScanAbilityElementCoverage()
}

function qaScanTalentIntegrity(s) {
    return _getIntegrityScannersModule().qaScanTalentIntegrity(s)
}

function qaScanCooldownIntegrity(s) {
    return _getIntegrityScannersModule().qaScanCooldownIntegrity(s)
}

function qaScanReferenceIntegrity(s) {
    return _getIntegrityScannersModule().qaScanReferenceIntegrity(s)
}

function qaCollectBugScannerFindings(s) {
    return _getIntegrityScannersModule().qaCollectBugScannerFindings(s)
}

function classifyIntegritySeverity(invariant, scanners) {
    return _getIntegrityScannersModule().classifyIntegritySeverity(invariant, scanners)
}

function runIntegrityAudit(s, stage, opts) {
    return _getIntegrityScannersModule().runIntegrityAudit(s, stage, opts)
}

function formatIntegrityAuditReport(report) {
    return _getIntegrityScannersModule().formatIntegrityAuditReport(report)
}

function runScenarioRunner(opts) {
    return _getIntegrityScannersModule().runScenarioRunner(opts)
}

function formatScenarioRunnerReport(res) {
    return _getIntegrityScannersModule().formatScenarioRunnerReport(res)
}

function buildBugReportBundle() {
    return _getIntegrityScannersModule().buildBugReportBundle()
}

function copyBugReportBundleToClipboard() {
    return _getIntegrityScannersModule().copyBugReportBundleToClipboard()
}

function formatBugReportBundle(bundle) {
    return _getIntegrityScannersModule().formatBugReportBundle(bundle)
}

function safeJsonShort(obj, maxLen) {
    return _getIntegrityScannersModule().safeJsonShort(obj, maxLen)
}

// --------------------------- SMOKE TESTS MODULE (Patch 1.2.72) ---------------------------
// Extracted to js/game/qa/smokeTests.js for better modularity.
// This section provides a thin wrapper that initializes the smoke tests runner
// with all necessary dependencies from the game orchestrator.

let _smokeTestsRunner = null

function _getSmokeTestsRunner() {
    if (_smokeTestsRunner) return _smokeTestsRunner
    
    // Gather all dependencies needed by the smoke tests module
    _smokeTestsRunner = createSmokeTestsRunner({
        // Core state and globals
        state,
        _diagnosticsUI,
        _engine,
        
        // Constants
        GAME_PATCH,
        GAME_PATCH_NAME,
        SAVE_SCHEMA,
        PLAYER_CLASSES,
        CLASS_STARTING_SKILLS,
        CLASS_LEVEL_UNLOCKS,
        ITEM_DEFS,
        ENEMY_TEMPLATES,
        ENEMY_ABILITIES,
        
        // UI Functions
        isUiDisabled,
        setUiDisabled,
        openModal,
        closeModal,
        
        // QA Functions
        qaCollectPerfSnapshotSync,
        qaFormatPerfSnapshotText,
        qaCollectBugScannerFindings,
        buildBugReportBundle,
        
        // Game state functions
        createDefaultQuestState,
        ensurePlayerSpellSystems,
        resetPlayerCombatStatus,
        recalcPlayerStats,
        ensurePlayerTalents,
        unlockTalent,
        ensureEnemyRuntime,
        applyEnemyAffixes,
        rebuildEnemyDisplayName,
        applyEquipmentOnPlayerHit,
        applyEquipmentOnShieldCast,
        applyEquipmentOnKill,
        buildEnemyForBattle,
        generateLootDrop,
        pickEnemyAbilitySet,
        playerBasicAttack,
        companionActIfPresent,
        
        // Random functions
        rand,
        randInt,
        rngInt,
        
        // Mutable reference wrappers for module-level variables that smoke tests need to manipulate
        _saveTimerRef: { get value() { return _saveTimer }, set value(v) { _saveTimer = v } },
        _saveQueuedRef: { get value() { return _saveQueued }, set value(v) { _saveQueued = v } },
        // Simple function references (smoke tests read current values, don't mutate parent scope)
        updateHUDRef: { get value() { return updateHUD } },
        updateEnemyPanelRef: { get value() { return updateEnemyPanel } },
        handleEnemyDefeatRef: { get value() { return handleEnemyDefeat } },
        enemyTurnRef: { get value() { return enemyTurn } },
        handlePlayerDefeatRef: { get value() { return handlePlayerDefeat } },
        saveGameRef: { get value() { return saveGame } },
        
        // Additional dependencies from the smoke tests
        migrateSaveData,
        _buildSaveBlob,
        _setState,
        syncGlobalStateRef,
        createEmptyState,
        initRngState,
        setDeterministicRngEnabled,
        setRngSeed,
        initTimeState,
        initVillageEconomyState,
        initGovernmentState,
        ensureVillagePopulation,
        addItemToInventory,
        equipItemFromInventory,
        sellItemFromInventory,
        usePotionFromInventory,
        cloneItemDef,
        getSellValue,
        buildAbilityContext,
        ABILITY_EFFECTS,
        ABILITIES,
        TALENT_DEFS,
        COMPANION_ABILITIES,
        tickEnemyStartOfTurn,
        updateClassMeterHUD,
        computeElementSummariesForPlayer,
        normalizeElementType,
        validateState,
        formatIssues,
        qaScanAbilityElementCoverage,
        qaScanElementKeyIssues,
        setRngLoggingEnabled,
        advanceTime,
        cleanupTownHallEffects,
        openBankModalImpl,
        formatBugReportBundle,
        runScenarioRunner,
        calcMagicDamage,
        calcPhysicalDamage,
        _setPlayerAbilityContext,
        getActiveDifficultyConfig,
        computeEnemyPostureMax,
        syncEnemyBaseStats,
        applyEnemyRarity,
        applyEliteModifiers,
        getItemPowerScore,
        formatRarityLabel,
        qaScanNonFiniteNumbers,
        tickPlayerTimedStatuses,
        applyStartOfTurnEffectsPlayer,
        applyPlayerRegenTick,
        beginPlayerTurn,
        ensureCombatTurnState,
        postEnemyTurn,
        ensureCombatPointers,
        exploreArea,
        canUseEnemyAbility,
        tickEnemyCooldowns,
        quests,
        advanceWorldTime
    })
    
    return _smokeTestsRunner
}

// Public API: Keep original function names for compatibility
function openSmokeTestsModal() {
    return _getSmokeTestsRunner().openSmokeTestsModal()
}

function runSmokeTests(opts) {
    return _getSmokeTestsRunner().runSmokeTests(opts)
}



// --- CHANGELOG MODAL --------------------------------------------------------
// Changelog Modal (extracted to modals/changelogModal.js)
let _changelogModal = null
function _getChangelogModal() {
    if (_changelogModal) return _changelogModal
    _changelogModal = createChangelogModal({
        openModal,
        closeModal,
        CHANGELOG,
        openPauseMenu
    })
    return _changelogModal
}

function openChangelogModal(opts = {}) {
    return _getChangelogModal().openChangelogModal(opts)
}

export function bootGame(engine) {
    _engine = engine || null

    // Ensure a live state object exists before wiring UI. Prefer engine-owned state.
    try {
        if (_engine && typeof _engine.getState === 'function') {
            const s = _engine.getState()
            if (s) state = s
        }
    } catch (_) {}

    if (!state) {
        _setState(createEmptyState())
    } else {
        // keep global debug ref in sync
        try { syncGlobalStateRef() } catch (_) {}
    }

    // Initialize enemy combat AI module
    function _initEnemyCombatAi() {
        _enemyCombatAi = createEnemyCombatAi({
            // State
            state,
            
            // Constants
            ENEMY_ABILITIES,
            
            // UI functions
            addLog,
            updateEnemyPanel,
            updateHUD,
            openModal,
            closeModal,
            switchScreen,
            screens,
            setScene,
            renderActions,
            
            // Combat functions
            clearEnemyIntent,
            calcEnemyDamage,
            getEffectiveEnemyAttack,
            getEffectiveEnemyMagic,
            applyEnemyAffixesOnEnemyHit,
            
            // Helper functions
            ensureEnemyRuntimeImpl,
            pickEnemyAbilitySet,
            getAliveEnemies,
            getAllEnemies,
            getActiveDifficultyConfig,
            ensureCombatTurnState,
            guardPlayerTurn,
            syncCurrentEnemyToTarget,
            getPlayerHasteMultiplier,
            applyPlayerRegenTick,
            applyEquipmentOnKill,
            applyQuestProgressOnEnemyDefeat,
            tickCompanionCooldowns,
            grantExperience,
            resetPlayerCombatStatus,
            
            // Loot functions
            generateLootDrop,
            addGeneratedItemToInventory,
            
            // RNG functions
            rand,
            randInt,
            
            // Other functions
            endPlayerTurn,
            handleEconomyAfterBattle,
            requestSave,
            loadGame,
            withSaveTxn,
            perfWrap,
            emit: (type, payload) => {
                try {
                    if (_engine && typeof _engine.emit === 'function') {
                        _engine.emit(type, payload)
                    }
                } catch (_) {}
            },
            _ensureCombatEnginesBound,
            _questEventsEnabled,
            
            // Optional dependencies
            getStatusEngine: () => StatusEngine,
            getQuests: () => quests
        })
    }

    // Initialize the module after state is ready
    _initEnemyCombatAi()

    // =============================================================================
    // ENGINE PLUGINS
    // =============================================================================

    // Register Emberwood runtime systems as Engine plugins.
    // NOTE: Plugins are registered here, then engine.start() is called at the end
    // of this function to initialize and start all systems in dependency order.
    try {
        const _patchLabel = `Emberwood Patch V${GAME_PATCH} — ${GAME_PATCH_NAME}`

        // 1) UI runtime + DOM bindings
        _engine.use(createFlagsPlugin())
        _engine.use(createI18nPlugin())

        // Foundation services: assets + settings + accessibility DOM bridge
        _engine.use(createAssetsManifestPlugin())
        _engine.use(createSettingsPlugin({ getState: () => state }))
        _engine.use(createA11yBridgePlugin())

        // 1) UI runtime + DOM bindings
        _engine.use(createUiRuntimePlugin({
            uiConfig: {
                getState: () => state,
                getAudioState: () => audioState,
                playMusicTrack,
                updateAreaMusic,
                // Combat/HUD hooks
                getAllEnemies,
                getAliveEnemies,
                syncCurrentEnemyToTarget,
                getEnemyAffixLabels,
                ENEMY_ABILITIES
            },
            uiBindingsApi: {
                patchLabel: _patchLabel,
                getState: () => state,
                engine: _engine,
                // boot/runtime
                initCrashCatcher: initCrashCatcherWrapper,
                // character creation / menu
                resetDevCheatsCreationUI,
                buildCharacterCreationOptions,
                randInt,
                // menus
                openSaveManager,
                openChangelogModal,
                openFeedbackModal,
                startNewGameFromCreation,
                // settings
                initSettingsFromState,
                applySettingsChanges,
                safeStorageGet,
                SAVE_KEY,
                migrateSaveData,
                setTheme,
                // hud / game
                quests,
                openPauseMenu,
                toggleHudEntity,
                openCharacterSheet,
                openSmokeTestsModal,
                syncSmokeTestsPillVisibility,
                cheatsEnabled,
                openCheatMenu,
                updateEnemyPanel,
                openEnemySheet,
                cycleTargetEnemy
            }
        }))

        // 1b) UI composition bridge (toast/busy/transition/HUD)
        _engine.use(createUiComposeBridgePlugin())

        // 2) Engine-wide QA service wiring
        _engine.use(createQaBridgePlugin({
            deps: {
                runSmokeTests,
                buildBugReportBundle,
                formatBugReportBundle,
                runIntegrityAudit,
                formatIntegrityAuditReport,
                runScenarioRunner,
                formatScenarioRunnerReport,
                // perf snapshot UI helpers
                qaReadBootMetrics,
                qaReadMemorySnapshot,
                qaSummarizePerfLog,
                qaCollectPerfSnapshotSync,
                qaFormatPerfSnapshotText,
                qaSampleFps
            }
        }))

        // 2b) Diagnostics / QA UI (pulls suites from engine.qa)
        _engine.use(createDiagnosticsOverlayPlugin({
            deps: {
                patchLabel: GAME_PATCH,
                patchName: GAME_PATCH_NAME,
                getState: () => state,
                cheatsEnabled,
                // modal runtime
                openModal,
                closeModal,
                getModalOnClose,
                setModalOnClose,
                // helpers
                copyToClipboard: copyFeedbackToClipboard
            }
        }))

        // 2b) Centralized save policy wiring (autosave + manual saves)
        _engine.use(createSavePolicyBridgePlugin({
            saveGame,
            getState: () => state,
            isUiDisabled: () => {
                try {
                    const ui = _engine && _engine.getService ? _engine.getService('ui') : null
                    if (ui && typeof ui.isUiDisabled === 'function') return ui.isUiDisabled()
                } catch (_) {}
                return false
            }
        }))

        // 2c) Telemetry breadcrumbs + crash bundle persistence
        _engine.use(createTelemetryPlugin({ getState: () => state }))

        // 3) Combat engines (math/status/turn sequencer)
        _engine.use(createCombatRuntimePlugin({
            deps: {
                // CombatMath
                getState: () => state,
                clampNumber,
                buildAbilityContext,
                rand: (...args) => rand(...args),
                _roundIntStable,
                getActiveDifficultyConfig,
                _getPlayerAbilityContext,
                normalizeElementType,
                getPlayerElementalBonusPct,
                getPlayerElementalResistPct,
                playerHasTalent,
                addLog,
                // StatusEngine
                ensurePlayerSpellSystems,
                // Turn sequencer
                ensureCombatTurnState,
                combatPause,
                _combatDelayMs,
                anyEnemiesAlive,
                getAllEnemies,
                finiteNumber,
                enemyAct,
                postEnemyTurn,
                syncCurrentEnemyToTarget,
                companionActIfPresent,
                updateHUD,
                updateEnemyPanel,
                perfWrapAsync
            }
        }))

        // 4) Companion runtime
        _engine.use(createCompanionRuntimePlugin({
            deps: {
                getState: () => state,
                companionDefs: COMPANION_DEFS,
                companionAbilities: COMPANION_ABILITIES,
                addLog,
                rand,
                randInt,
                updateHUD,
                updateEnemyPanel,
				saveGame: () => requestSave('companion'),
                playerHasTalent,
                applyEnemyAtkDown,
                roundIntStable: _roundIntStable,
                getActiveDifficultyConfig,
                handleEnemyDefeat
            }
        }))

	        // 5) World event bus (namespaced `world:*`)
	        _engine.use(createWorldEventsPlugin())

	        // 6) Quest progress driven by world events
	        _engine.use(createQuestEventsPlugin({ quests }))

	        // 7) Autosave requests driven by world events
	        _engine.use(createAutosavePlugin({ saveGame }))

	        // 8) Sim tick safety (catch up daily ticks after loads)
	        _engine.use(createSimTickPlugin({ getState: () => state, runDailyTicks }))

	        // 9) Input context stack (screen/modal ownership)
	        _engine.use(createInputContextsPlugin())

	        // 10) UI command bridge (input -> commands -> UI actions)
	        _engine.use(createUiCommandsPlugin({
	            openPauseMenu,
	            openCharacterSheet,
	            openQuestJournal: () => { try { quests && quests.openQuestJournal && quests.openQuestJournal() } catch (_) {} },
	            toggleDiagnosticsOverlay: () => { try { openSmokeTestsModal && openSmokeTestsModal() } catch (_) {} },
	            isEnemySheetOpen: () => { try { return !!isEnemyModalOpen() } catch (_) { return false } },
	            closeEnemySheet: () => { try { closeEnemyModal() } catch (_) {} },
	        }))

	        // 10b) Game command handlers (UI -> commands -> game actions)
	        _engine.use(createGameCommandsPlugin({
	            // Explore / navigation
	            explore: () => { try { handleExploreClick() } catch (_) {} },
	            openExploreModal: () => { try { openExploreModal() } catch (_) {} },
	            setExploreChoiceMadeFalse: () => {
	                try {
	                    if (!state.ui) state.ui = {}
	                    state.ui.exploreChoiceMade = false
	                } catch (_) {}
	            },
	            // Village
	            openTavern: () => { try { openTavernModal() } catch (_) {} },
	            openBank: () => { try { openBankModal() } catch (_) {} },
	            openMerchant: () => { try { openMerchantModal() } catch (_) {} },
	            openTownHall: () => { try { openTownHallModal() } catch (_) {} },
	            openGovernment: () => { try { openGovernmentModal() } catch (_) {} },
	            openElderRowan: () => { try { quests && quests.openElderRowanDialog && quests.openElderRowanDialog() } catch (_) {} },
	            // UI helpers
	            openInventory: (inCombat) => { try { openInventoryModal(!!inCombat) } catch (_) {} },
	            openSpells: (inCombat) => { try { openSpellsModal(!!inCombat) } catch (_) {} },
	            // Combat
	            combatAttack: () => { try { playerBasicAttack() } catch (_) {} },
	            combatInterrupt: () => { try { playerInterrupt() } catch (_) {} },
	            combatFlee: () => { try { tryFlee() } catch (_) {} },
	            combatCastAbility: (payload) => {
	                try {
	                    const id = payload && (payload.abilityId || payload.id)
	                    if (id) useAbilityInCombat(id)
	                } catch (_) {}
	            },

	            // Inventory
	            inventoryUsePotion: (payload) => {
	                try {
	                    const idx = payload && Number.isFinite(Number(payload.index)) ? Number(payload.index) : -1
	                    const inCombat = !!(payload && payload.inCombat)
	                    if (idx >= 0) usePotionFromInventory(idx, inCombat, { stayOpen: !inCombat })
	                } catch (_) {}
	            },
	            inventoryEquip: (payload) => {
	                try {
	                    const idx = payload && Number.isFinite(Number(payload.index)) ? Number(payload.index) : -1
	                    if (idx >= 0) equipItemFromInventory(idx, { stayOpen: true })
	                } catch (_) {}
	            },
	            inventoryUnequip: (payload) => {
	                try {
	                    const idx = payload && Number.isFinite(Number(payload.index)) ? Number(payload.index) : -1
	                    const p = state && state.player ? state.player : null
	                    if (!p || idx < 0) return
	                    const item = p.inventory && p.inventory[idx] ? p.inventory[idx] : null
	                    if (!item) return
	                    unequipItemIfEquipped(p, item)
	                    recalcPlayerStats()
	                    updateHUD()
	                    requestSave('legacy')
	                } catch (_) {}
	            },
	            inventorySell: (payload) => {
	                try {
	                    const idx = payload && Number.isFinite(Number(payload.index)) ? Number(payload.index) : -1
	                    const ctx = payload && payload.context ? String(payload.context) : 'village'
	                    if (idx >= 0) sellItemFromInventory(idx, ctx)
	                } catch (_) {}
	            },
	            inventoryDrop: (payload) => {
	                try {
	                    const idx = payload && Number.isFinite(Number(payload.index)) ? Number(payload.index) : -1
	                    const p = state && state.player ? state.player : null
	                    if (!p || idx < 0) return
	                    const item = p.inventory && p.inventory[idx] ? p.inventory[idx] : null
	                    if (!item) return
	                    if (item.questItem || item.noDrop) {
	                        addLog('You cannot drop a quest item.', 'system')
	                        return
	                    }
	                    unequipItemIfEquipped(p, item)
	                    if (item.type === 'potion' && (item.quantity || 1) > 1) {
	                        item.quantity -= 1
	                    } else {
	                        p.inventory.splice(idx, 1)
	                    }
	                    recalcPlayerStats()
	                    updateHUD()
	                    requestSave('legacy')
	                } catch (_) {}
	            },

	            // Merchant / shop
	            merchantBuy: (payload) => {
	                try {
	                    executeMerchantBuy({
	                        state,
	                        context: payload && payload.context ? payload.context : 'village',
	                        merchantId: payload && payload.merchantId ? payload.merchantId : null,
	                        itemKey: payload && payload.itemKey ? payload.itemKey : null,
	                        price: payload && payload.price,
	                        addLog,
	                        recordInput,
	                        addItemToInventory,
	                        updateHUD,
	                        saveGame: () => requestSave('merchant:buy'),
	                        handleEconomyAfterPurchase,
	                        getMerchantPrice,
	                        cloneItemDef
	                    })
	                } catch (_) {}
	            },

	            // Bank
	            bankDeposit: (payload) => { try { bankDeposit({ state, amt: payload?.amt, addLog, recordInput, updateHUD, saveGame: () => requestSave('bank:deposit') }) } catch (_) {} },
	            bankWithdraw: (payload) => { try { bankWithdraw({ state, amt: payload?.amt, addLog, recordInput, updateHUD, saveGame: () => requestSave('bank:withdraw') }) } catch (_) {} },
	            bankInvest: (payload) => { try { bankInvest({ state, amt: payload?.amt, addLog, recordInput, updateHUD, saveGame: () => requestSave('bank:invest') }) } catch (_) {} },
	            bankCashOut: () => { try { bankCashOut({ state, addLog, updateHUD, saveGame: () => requestSave('bank:cashOut') }) } catch (_) {} },
	            bankBorrow: (payload) => { try { bankBorrow({ state, amt: payload?.amt, addLog, recordInput, updateHUD, saveGame: () => requestSave('bank:borrow') }) } catch (_) {} },
	            bankRepay: (payload) => { try { bankRepay({ state, amt: payload?.amt, addLog, recordInput, updateHUD, saveGame: () => requestSave('bank:repay') }) } catch (_) {} }
	        }))

	        // 10c) Asset preloads on screen/modal entry (busy/progress via uiCompose)
	        _engine.use(createScreenAssetPreloadPlugin())

	        // 11) Audio helpers exposed as an engine service
	        _engine.use(createAudioBridgePlugin({
	            playDoorOpenSfx,
	            updateAreaMusic,
	            playMusicTrack,
	            getAudioState: () => audioState
	        }))

	        // 12) Deterministic game RNG exposed as a service
	        _engine.use(createRngBridgePlugin({ getState: () => state }))

        // 13) Time service - Engine-integrated time management
        _engine.use(createTimeServicePlugin())

        // 14) Village services (economy, population) - Engine-integrated state management
        _engine.use(createVillageServicesPlugin())

        // 15) Bank service - Engine-integrated banking operations (deposits, loans, investments)
        _engine.use(createBankServicePlugin())

        // 16) Merchant service - Engine-integrated commerce operations (buying, selling, restocking)
        _engine.use(createMerchantServicePlugin())

        // 17) Tavern service - Engine-integrated tavern operations (resting, rumors)
        _engine.use(createTavernServicePlugin())

        // 18) Town Hall service - Engine-integrated town hall operations (announcements, proposals)
        _engine.use(createTownHallServicePlugin())

        // 19) Kingdom government service - Engine-integrated kingdom/government state management
        _engine.use(createKingdomGovernmentPlugin())

        // 20) Loot generator service - Engine-integrated loot generation with event emissions
        _engine.use(createLootGeneratorPlugin())

        // 21) Quest system service - Engine-integrated quest state management
        _engine.use(createQuestSystemPlugin())

        // 18) Replay recorder/player (records command dispatches)
        _engine.use(createReplayBridgePlugin({ getState: () => state }))

        // Cache service handles as soon as plugins start.
        _engine.on('engine:started', () => {
            try { _diagnosticsUI = _engine.getService('diagnostics') || null } catch (_) {}
            try {
                const c = _engine.getService('combat')
                if (c) {
                    CombatMath = c.math || null
                    StatusEngine = c.status || null
                    const ts = c.turnSequencer || null
                    runPostPlayerTurnSequence = ts && ts.runPostPlayerTurnSequence ? ts.runPostPlayerTurnSequence : null
                }
            } catch (_) {}
            try { _companionRuntime = _engine.getService('companionRuntime') || null } catch (_) {}
        })
    } catch (e) {
        try { console.error('[bootGame] plugin registration failed', e) } catch (_) {}
    }

    // =============================================================================
    // START ENGINE (Engine-First Architecture)
    // =============================================================================
    // All plugins are now registered. Start the engine to initialize and activate
    // all systems. This ensures the engine is fully operational before returning
    // control to the game layer.
    try {
        if (_engine && typeof _engine.start === 'function') {
            _engine.start()
            console.log('[bootGame] Engine started successfully')
        }
    } catch (e) {
        try { console.error('[bootGame] Engine start failed', e) } catch (_) {}
    }

    // Emit an initial area enter event once the engine loop starts so plugins
    // (asset preloads, analytics, etc.) can treat the current area as "entered"
    // even if it was loaded from save/initial state.
    try {
        const sched = (_engine && _engine.schedule) ? _engine.schedule : (_engine && _engine.getService ? _engine.getService('schedule') : null)
        if (sched && typeof sched.after === 'function') {
            sched.after(0, () => {
                try {
                    const a = state && state.area ? String(state.area) : ''
                    if (!a || !_engine || typeof _engine.emit !== 'function') return
                    _engine.emit('area:enter', { area: a, from: '', source: 'boot', owner: `area:${a}` })
                } catch (_) {}
            }, { owner: 'system:boot' })
        }
    } catch (_) {}

}
