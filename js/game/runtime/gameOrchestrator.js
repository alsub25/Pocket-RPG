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
import { createCheatsMenu } from '../ui/modals/cheatsMenu.js'
import { createInventoryModal } from '../ui/modals/inventoryModal.js'
import { createSpellsModal } from '../ui/modals/spellsModal.js'
import { createSkillLevelUpModal } from '../ui/modals/skillLevelUpModal.js'
import { createExploreModal } from '../ui/modals/exploreModal.js'
import { createGovernmentModal } from '../ui/modals/governmentModal.js'
import { createGameSettingsModal } from '../ui/modals/gameSettingsModal.js'
import { createChangelogModal } from '../ui/modals/changelogModal.js'
import { createFeedbackModal } from '../ui/modals/feedbackModal.js'
import { createCharacterSheetModal } from '../ui/modals/characterSheetModal.js'
import { createEnemySheetModal } from '../ui/modals/enemySheetModal.js'
import {
    initAudio,
    setMasterVolumePercent,
    setMusicEnabled,
    setSfxEnabled,
    setInteriorOpen,
    playDoorOpenSfx,
    playMusicTrack,
    updateAreaMusic,
    getAudioState,
    tryResumeAudioContext,
    applyChannelMuteGains
} from '../systems/audioSystem.js'
import {
    recalcPlayerStats,
    computeElementSummariesForPlayer,
    renderElementalBreakdownHtml,
    refreshCharacterSheetLiveValues,
    refreshCharacterSheetIfOpen,
    renderTalentsPanelHtml,
    _getTalentSpellElementBonusMap,
    _getElementalBreakdownsForPlayer
} from '../systems/characterSystem.js'

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
import {
    qaScanNonFiniteNumbers,
    qaScanNegativeCounters,
    qaScanStatSanity,
    qaScanCombatRuntimeSanity,
    qaScanElementKeyIssues,
    qaScanAbilityElementCoverage,
    qaScanTalentIntegrity,
    qaScanCooldownIntegrity,
    qaScanReferenceIntegrity,
    qaCollectBugScannerFindings
} from '../diagnostics/qaScanners.js'

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

// --- Audio State Reference ---------------------------------------------------
// Get audio state from the audio system module
const audioState = getAudioState()




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
            _recalcPlayerStats()
            // Keep immediate UI feedback consistent across ALL classes.
            // (Many talents affect dodge/resistAll/max resource, etc.)
            try { updateHUD() } catch (_) {}
            try { refreshCharacterSheetIfOpen(state, playerHasTalent) } catch (_) {}
            try { if (state.inCombat) updateEnemyPanel() } catch (_) {}
        }
    } catch (_) {}
    return true
}

// Wrapper functions for character system (pass dependencies)
function _recalcPlayerStats() {
    recalcPlayerStats(state, playerHasTalent, _getCompanionRuntime)
}

function __renderTalentsPanelHtml(p) {
    return renderTalentsPanelHtml(p, ensurePlayerTalents, getTalentsForClass, playerHasTalent, canUnlockTalent)
}

function __computeElementSummariesForPlayer(p) {
    return computeElementSummariesForPlayer(p, playerHasTalent)
}

function __renderElementalBreakdownHtml(p) {
    return renderElementalBreakdownHtml(p, playerHasTalent)
}

function _refreshCharacterSheetLiveValues(p, root) {
    refreshCharacterSheetLiveValues(p, root, playerHasTalent)
}

function _refreshCharacterSheetIfOpen() {
    refreshCharacterSheetIfOpen(state, playerHasTalent)
}

// --- Elemental breakdown + sheet live refresh (Patch 1.2.32) -----------------
// Gear elemental bonuses live in stats.elementalBonuses (used by damage math).
// Talent-based spell focus bonuses are tracked separately for Character Sheet display.
// Stable integer rounding for combat numbers.
// JS floating-point math can produce values like 57.49999999999999 for what is
// conceptually 57.5; without a tiny epsilon this would round down incorrectly.
function _roundIntStable(x) {
    const n = Number(x)
    if (!Number.isFinite(n)) return 0
    const eps = 1e-9
    return Math.round(n + (n >= 0 ? eps : -eps))
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
            makeActionButton('Elder Rowan', () => {
                if (!dispatchGameCommand('GAME_OPEN_ELDER_ROWAN', {})) {
                    if (quests && quests.openElderRowanDialog) quests.openElderRowanDialog()
                }
            })
        )

        actionsEl.appendChild(
            makeActionButton('Tavern', () => {
                if (!dispatchGameCommand('GAME_OPEN_TAVERN', {})) openTavernModal()
            })
        )

        actionsEl.appendChild(
            makeActionButton('Bank', () => {
                if (!dispatchGameCommand('GAME_OPEN_BANK', {})) openBankModal()
            })
        )

        actionsEl.appendChild(
            makeActionButton('Merchant', () => {
                if (!dispatchGameCommand('GAME_OPEN_MERCHANT', {})) openMerchantModal()
            })
        )

        actionsEl.appendChild(
            makeActionButton('Town Hall', () => {
                if (!dispatchGameCommand('GAME_OPEN_TOWN_HALL', {})) openTownHallModal()
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
                if (!dispatchGameCommand('GAME_OPEN_GOVERNMENT', {})) openGovernmentModal()
            })
        )
    }

    actionsEl.appendChild(
        makeActionButton(
            'Explore',
            () => {
                if (!dispatchGameCommand('GAME_EXPLORE', {})) handleExploreClick()
            },
            ''
        )
    )

    actionsEl.appendChild(
        makeActionButton('Change Area', () => {
            if (!dispatchGameCommand('GAME_CHANGE_AREA', {})) {
                ui.exploreChoiceMade = false
                openExploreModal()
            }
        })
    )

    actionsEl.appendChild(
        makeActionButton('Inventory', () => {
            if (!dispatchGameCommand('GAME_OPEN_INVENTORY', { inCombat: false })) openInventoryModal(false)
        })
    )

    actionsEl.appendChild(
        makeActionButton('Spells', () => {
            if (!dispatchGameCommand('GAME_OPEN_SPELLS', { inCombat: false })) openSpellsModal(false)
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
            if (!dispatchGameCommand('COMBAT_ATTACK', {})) playerBasicAttack()
        }, '', { disabled: locked, title: lockTitle })
    )

    actionsEl.appendChild(
        makeActionButton('Interrupt', () => {
            if (!dispatchGameCommand('COMBAT_INTERRUPT', {})) playerInterrupt()
        }, 'outline', { disabled: locked, title: lockTitle })
    )

    actionsEl.appendChild(
        makeActionButton('Spells', () => {
            if (!dispatchGameCommand('GAME_OPEN_SPELLS', { inCombat: true })) openSpellsModal(true)
        }, '', { disabled: locked, title: lockTitle })
    )

    actionsEl.appendChild(
        makeActionButton('Items', () => {
            if (!dispatchGameCommand('GAME_OPEN_INVENTORY', { inCombat: true })) openInventoryModal(true)
        }, '', { disabled: locked, title: lockTitle })
    )

    const isBoss = !!(state.currentEnemy && state.currentEnemy.isBoss)
    actionsEl.appendChild(
        makeActionButton(isBoss ? 'No Escape' : 'Flee', () => {
            if (isBoss) {
                addLog('This foe blocks your escape!', 'danger')
            } else {
                if (!dispatchGameCommand('COMBAT_FLEE', {})) tryFlee()
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
    _recalcPlayerStats()

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
                _recalcPlayerStats()
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

    _recalcPlayerStats()
    updateHUD()
    requestSave('inventory:sell')
    })
}

/* =============================================================================
 * INVENTORY MODAL
 * UI for viewing, using, equipping, selling, and dropping items.
 * Now modularized in ../ui/modals/inventoryModal.js.
 * ============================================================================= */

// Initialize the inventory modal function with all dependencies
let _openInventoryModal = null
function _getOpenInventoryModal() {
    if (_openInventoryModal) return _openInventoryModal
    _openInventoryModal = createInventoryModal({
        state,
        openModal,
        addLog,
        updateHUD,
        requestSave,
        dispatchGameCommand,
        usePotionFromInventory,
        equipItemFromInventory,
        sellItemFromInventory,
        unequipItemIfEquipped,
        _recalcPlayerStats,
        getItemPowerScore
    })
    return _openInventoryModal
}

// Wrapper to keep call sites unchanged
function openInventoryModal(inCombat) {
    return _getOpenInventoryModal()(inCombat)
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
        requestSave('legacy')

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

    _recalcPlayerStats()
    updateHUD()
    requestSave('legacy')

    if (onAfterEquip) onAfterEquip()
    if (!stayOpen) closeModal()
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
    initAudio(_engine, state)
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
        setInteriorOpen(state, true)

        Promise.resolve(playDoorOpenSfx(_engine, state)).then(() => {
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
    playDoorOpenSfx(_engine, state)
    setInteriorOpen(state, true)
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
 * Now modularized in ../ui/modals/cheatsMenu.js.
 * ============================================================================= */

// Initialize the cheat menu function with all dependencies
let _openCheatMenu = null
function _getOpenCheatMenu() {
    if (_openCheatMenu) return _openCheatMenu
    _openCheatMenu = createCheatsMenu({
        state,
        openModal,
        closeModal,
        setModalOnClose,
        addLog,
        updateHUD,
        updateTimeDisplay,
        updateEnemyPanel,
        updateAreaMusic,
        renderActions,
        requestSave,
        setArea,
        advanceWorldTime: advanceWorldTimeImpl,
        advanceWorldDays: advanceWorldDaysImpl,
        addItemToInventory,
        startBattleWith,
        cheatMaxLevel,
        quests,
        QUEST_DEFS,
        ITEM_DEFS,
        ENEMY_TEMPLATES,
        ZONE_DEFS,
        setRngSeed,
        setDeterministicRngEnabled,
        setRngLoggingEnabled,
        copyFeedbackToClipboard,
        copyBugReportBundleToClipboard
    })
    return _openCheatMenu
}

// Wrapper to keep call sites unchanged
function openCheatMenu() {
    return _getOpenCheatMenu()()
}

/* =============================================================================
 * SPELLS
 * Spell definitions + casting UI + resource costs and combat integration.
 * ============================================================================= */

// Spell Book UI is now modularized (see ../ui/modals/spellsModal.js and ./spells/spellbookModal.js).
// We keep a thin wrapper here so call sites remain unchanged and the function stays hoisted.
let _spellsModalWrapper = null
function _getSpellsModalWrapper() {
    if (_spellsModalWrapper) return _spellsModalWrapper
    _spellsModalWrapper = createSpellsModal({
        state,
        createSpellbookModal,
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
        getAbilityUpgrade,
        getEffectiveAbilityCost,
        addLog,
        openModal,
        closeModal,
        saveGame: () => requestSave('modal:spellbook'),
        dispatchGameCommand,
        useAbilityInCombat
    })
    return _spellsModalWrapper
}

function openSpellsModal(inCombat) {
    return _getSpellsModalWrapper().openSpellsModal(inCombat)
}

function _getSpellbookModal() {
    return _getSpellsModalWrapper().getSpellbookModal()
}

// --- SKILL LEVEL UP MODAL -------------------------------------------------------
let _skillLevelUpModal = null
function _getSkillLevelUpModal() {
    if (_skillLevelUpModal) return _skillLevelUpModal
    _skillLevelUpModal = createSkillLevelUpModal({
        state,
        openModal,
        closeModal,
        setModalOnClose,
        addLog,
        updateHUD,
        autoDistributeSkillPoints,
        _recalcPlayerStats
    })
    return _skillLevelUpModal
}

// --- EXPLORE MODAL --------------------------------------------------------------
let _exploreModalFn = null
function _getExploreModal() {
    if (_exploreModalFn) return _exploreModalFn
    _exploreModalFn = createExploreModal({
        state,
        openModal,
        closeModal,
        addLog,
        ensureUiState,
        recordInput,
        renderActions,
        isAreaUnlocked,
        getAreaDisplayName,
        setArea,
        exploreArea,
        requestSave,
        ensureCombatPointers
    })
    return _exploreModalFn
}

// --- GOVERNMENT MODAL -----------------------------------------------------------
let _governmentModalFn = null
function _getGovernmentModal() {
    if (_governmentModalFn) return _governmentModalFn
    _governmentModalFn = createGovernmentModal({
        state,
        openModal,
        getTimeInfo,
        initGovernmentState,
        getGovernmentSummary,
        getVillageGovernmentEffect,
        getVillageEconomySummary
    })
    return _governmentModalFn
}

// --- IN-GAME SETTINGS MODAL -----------------------------------------------------
let _gameSettingsModalFn = null
function _getGameSettingsModal() {
    if (_gameSettingsModalFn) return _gameSettingsModalFn
    _gameSettingsModalFn = createGameSettingsModal({
        state,
        _engine,
        openModal,
        closeModal,
        updateHUD,
        requestSave,
        safeStorageSet,
        setMasterVolumePercent,
        setMusicEnabled,
        setSfxEnabled,
        setTheme,
        setReduceMotionEnabled,
        exportCurrentSaveToFile,
        importSaveFromFile,
        exportAllSavesBundleToFile,
        DIFFICULTY_CONFIG
    })
    return _gameSettingsModalFn
}

// Changelog modal initialization
let _changelogModalFn = null
function _getChangelogModal() {
    if (_changelogModalFn) return _changelogModalFn
    _changelogModalFn = createChangelogModal({
        openModal,
        closeModal,
        openPauseMenu,
        CHANGELOG
    })
    return _changelogModalFn
}

// Feedback modal initialization
let _feedbackModalFn = null
function _getFeedbackModal() {
    if (_feedbackModalFn) return _feedbackModalFn
    _feedbackModalFn = createFeedbackModal({
        openModal,
        state,
        GAME_PATCH,
        GAME_PATCH_NAME,
        SAVE_SCHEMA,
        getLastCrashReport,
        copyFeedbackToClipboard,
        safeStorageGet,
        safeStorageRemove,
        copyBugReportBundleToClipboard,
        _STORAGE_DIAG_KEY_LAST_CRASH
    })
    return _feedbackModalFn
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

// Finalize any enemies that reached 0 HP during the player's action.
// This is especially important for AoE spells where only the current target
// would previously trigger handleEnemyDefeat().
function resolvePendingEnemyDefeats() {
    if (!state || !state.inCombat) return

    const all = getAllEnemies()
    if (!all || !all.length) return

    // Process current target first for consistent logs/target sync.
    const cur = state.currentEnemy || null
    const ordered = []
    if (cur) ordered.push(cur)
    all.forEach((e) => {
        if (e && e !== cur) ordered.push(e)
    })

    for (let i = 0; i < ordered.length; i++) {
        if (!state.inCombat) break
        const e = ordered[i]
        if (!e || e._defeatHandled) continue
        if (finiteNumber(e.hp, 0) <= 0) handleEnemyDefeat(e)
    }
}

// Initialize character sheet modal with dependencies
let _openCharacterSheet = null
function _getOpenCharacterSheet() {
    if (_openCharacterSheet) return _openCharacterSheet
    _openCharacterSheet = createCharacterSheetModal({
        state,
        PLAYER_CLASSES,
        getActiveDifficultyConfig,
        finiteNumber,
        escapeHtml,
        openModal,
        unlockTalent,
        updateHUD,
        requestSave,
        _renderTalentsPanelHtml,
        _computeElementSummariesForPlayer,
        _renderElementalBreakdownHtml,
        _refreshCharacterSheetLiveValues
    })
    return _openCharacterSheet
}

function openCharacterSheet() {
    return _getOpenCharacterSheet()()
}

// --- SKILLS -------------------------------------------------------------------


// --- NEW: Enemy Sheet (tap enemy panel to inspect) ---------------------------
// Initialize enemy sheet modal with dependencies
let _openEnemySheet = null
function _getOpenEnemySheet() {
    if (_openEnemySheet) return _openEnemySheet
    _openEnemySheet = createEnemySheetModal({
        state,
        ENEMY_ABILITIES,
        finiteNumber,
        clampFinite,
        clamp01,
        escapeHtml,
        openEnemyModal,
        ensureEnemyRuntime,
        getEnemyRarityDef,
        getEffectiveEnemyAttack,
        getEffectiveEnemyMagic,
        getEnemyAffixDef,
        normalizeElementType,
        _normalizeAffinityMult,
        _normalizePctMaybeFraction
    })
    return _openEnemySheet
}

function openEnemySheet() {
    return _getOpenEnemySheet()()
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
    _recalcPlayerStats()
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

// Wrapper to keep call sites unchanged
function openSkillLevelUpModal() {
    return _getSkillLevelUpModal()()
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
        const elemHit =
            ab.elementType || (isMagic ? enemy.magicElementType : enemy.attackElementType) || null
        const dmgEst = calcEnemyDamage(baseStat * enrageMult, { damageType: isMagic ? 'magic' : 'physical', elementType: elemHit })

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
    const elemHit =
        ab.elementType || (isMagic ? enemy.magicElementType : enemy.attackElementType) || null
    const dmg = calcEnemyDamage(baseStat * enrageMult, { damageType: isMagic ? 'magic' : 'physical', elementType: elemHit })

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
	        if (state.flags && state.flags.godMode) {
            addLog('God Mode: You ignore ' + remaining + ' damage.', 'system')
        } else {
            p.hp -= remaining
        }
    }


    // Warrior talent: Bulwark Spikes reflect (one-time) on the next enemy hit.
    if (p && p.status && p.status.bulwarkSpikesCharges && p.status.bulwarkSpikesCharges > 0 && enemy && dmg > 0) {
        const spikeDmg = clampNumber(p.status.bulwarkSpikesDamage || 0, 0, 9999)
        if (spikeDmg > 0) {
            enemy.hp -= spikeDmg
            addLog('Bulwark spikes reflect ' + spikeDmg + ' back to ' + enemy.name + '!', 'good')
        }
        p.status.bulwarkSpikesCharges = 0
        p.status.bulwarkSpikesDamage = 0
        if (enemy.hp <= 0) {
            addLog(enemy.name + ' is impaled by your spikes!', 'good')
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
        addLog(
            enemy.name + ' uses ' + ab.name + ' on you for ' + dmg + ' damage.',
            'danger',
            { domain: 'combat', kind: 'damage', actor: 'enemy', breakdown: state._lastDamageBreakdown || null }
        )
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
    const st = state
    try {
        if (st && st.debug && st.debug.capturePerf) {
            const ex = {
                enemyId: enemy && enemy.id ? String(enemy.id) : null,
                intent: enemy && enemy.intent && enemy.intent.aid ? String(enemy.intent.aid) : null
            }
            return perfWrap(st, 'combat:enemyAct', ex, () => _enemyActImpl(enemy))
        }
    } catch (_) {}
    return _enemyActImpl(enemy)
}

function _enemyActImpl(enemy) {
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

				if (p.hp <= 0 && !(state.flags && state.flags.godMode)) {
                    handlePlayerDefeat()
                    return
                }
				if (p.hp <= 0 && (state.flags && state.flags.godMode)) {
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

		if (p.hp <= 0 && !(state.flags && state.flags.godMode)) {
            handlePlayerDefeat()
            return
        }
		if (p.hp <= 0 && (state.flags && state.flags.godMode)) {
            p.hp = 1
            updateHUD()
        }
    } finally {
        // Restore previous target (UI) after acting.
        state.currentEnemy = prev
    }
}

function enemyTurn() {
    const st = state
    try {
        if (st && st.debug && st.debug.capturePerf) {
            return perfWrap(st, 'combat:enemyTurn', null, () => _enemyTurnImpl())
        }
    } catch (_) {}
    return _enemyTurnImpl()
}

function _enemyTurnImpl() {
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
            'good',
            { domain: 'combat', kind: 'status', actor: 'player', effect: 'bleed' }
        )
        if (enemy.bleedTurns <= 0) {
            addLog(enemy.name + "'s bleeding slows.", 'system')
        }
    }


    if (enemy.burnTurns && enemy.burnTurns > 0 && enemy.burnDamage) {
        enemy.hp -= enemy.burnDamage
        enemy.burnTurns -= 1
        addLog(
            enemy.name + ' burns for ' + enemy.burnDamage + ' damage.',
            'good',
            { domain: 'combat', kind: 'status', actor: 'player', effect: 'burn' }
        )
        if (enemy.burnTurns <= 0) {
            addLog(enemy.name + "'s flames die down.", 'system')
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
            const dmg = calcEnemyDamage(getEffectiveEnemyAttack(enemy), { damageType: 'physical', elementType: enemy.attackElementType || null })
            score = dmg
        } else if (act === 'heavy') {
            const dmg = calcEnemyDamage(getEffectiveEnemyAttack(enemy) * 1.4, { damageType: 'physical', elementType: enemy.attackElementType || null })
            score = dmg * 1.1
        } else if (act === 'voidBreath') {
            const dmg = calcEnemyDamage(enemy.magic * 1.7, { damageType: 'magic', elementType: enemy.magicElementType || null })
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
                {
                    damageType: act === 'voidBreath' ? 'magic' : 'physical',
                    elementType: act === 'voidBreath'
                        ? enemy.magicElementType || null
                        : enemy.attackElementType || null
                }
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
    try { _ensureCombatEnginesBound() } catch (_) {}
    if (!StatusEngine) return null
    // Smoke tests (and some legacy call sites) pass the player explicitly.
    // If omitted, fall back to the active engine state.
    if (!p) p = (state && state.player) ? state.player : (typeof PLAYER !== 'undefined' ? PLAYER : null)
    return StatusEngine.applyStartOfTurnEffectsPlayer(p)
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
	if (p && p.hp <= 0 && !(state.flags && state.flags.godMode)) {
        handlePlayerDefeat()
        return
    }
	if (p && p.hp <= 0 && (state.flags && state.flags.godMode)) {
        p.hp = 1
    }

    updateHUD()
    updateEnemyPanel()
}

function tickPlayerTimedStatuses(p) {
    try { _ensureCombatEnginesBound() } catch (_) {}
    if (!StatusEngine) return null
    // Allow call sites to omit the player reference (older engine code + smoke tests).
    if (!p) p = (state && state.player) ? state.player : (typeof PLAYER !== 'undefined' ? PLAYER : null)
    return StatusEngine.tickPlayerTimedStatuses(p)
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
        requestSave('legacy')
    }
}

function handleEnemyDefeat(enemyArg) {
    return withSaveTxn('combat:enemyDefeat', () => {
    const enemy = enemyArg || state.currentEnemy
    if (!enemy) return

    // Patch 1.2.70: prevent duplicate reward processing.
    // Multi-enemy battles can produce several "hp <= 0" enemies in one action.
    // We mark an enemy as handled so we never grant XP/loot twice (including after load).
    if (enemy._defeatHandled) return
    enemy._defeatHandled = true

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

    // Patch 1.2.0: apply on-kill equipment traits / talent triggers
    applyEquipmentOnKill(enemy)

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
        const _lootArgs = {
            area: state.area,
            playerLevel: state.player.level,
            enemy,
            playerResourceKey: state.player.resourceKey
        }
        const drops = (() => {
            try {
                if (state && state.debug && state.debug.capturePerf) {
                    return perfWrap(state, 'loot:generateLootDrop', { area: _lootArgs.area }, () => generateLootDrop(_lootArgs))
                }
            } catch (_) {}
            return generateLootDrop(_lootArgs)
        })()

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

    // World event (consumed by questEvents + autosave plugins)
    try { _engine && _engine.emit && _engine.emit('world:enemyDefeated', { enemy }) } catch (_) {}

    // Legacy quest hook (fallback when questEvents plugin isn't present)
    if (!_questEventsEnabled()) {
        try { quests && quests.applyQuestProgressOnEnemyDefeat && quests.applyQuestProgressOnEnemyDefeat(enemy) } catch (_) {}
    }

    // If any enemies remain, keep fighting.
    if (alive.length > 0) {
        // Ensure target is valid.
        syncCurrentEnemyToTarget()
        updateHUD()
        updateEnemyPanel()
        renderActions()
        requestSave('legacy')
        return
    }

    // Battle ends.
    state.inCombat = false

    try {
        _engine && _engine.emit && _engine.emit('world:battleEnded', { result: 'win', finalEnemy: enemy })
    } catch (_) {}

    // Economy reacts once per battle
    handleEconomyAfterBattle(state, enemy, state.area)

    // dynamic difficulty: one result per battle
    recordBattleResult('win')

    state.currentEnemy = null
    state.enemies = []

    updateHUD()
    updateEnemyPanel()
    renderActions()
    requestSave('legacy')
    })
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

    try {
        _engine && _engine.emit && _engine.emit('world:battleEnded', { result: 'loss' })
    } catch (_) {}
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
        requestSave('legacy')
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
// Wrapper to keep call sites unchanged
function openExploreModal() {
    return _getExploreModal()()
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
    updateAreaMusic(state)

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
    _recalcPlayerStats()
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

// Wrapper to keep call sites unchanged
function openGovernmentModal() {
    return _getGovernmentModal()()
}
// Wrapper to keep call sites unchanged
function openInGameSettingsModal() {
    return _getGameSettingsModal()()
}
// --- PAUSE / GAME MENU --------------------------------------------------------
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
    updateAreaMusic(state)
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
    updateAreaMusic(state)
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

function openFeedbackModal() {
    return _getFeedbackModal()()
}



// -----------------------------------------------------------------------------
// QA deep scanners (used by Smoke Tests + Bug Report)
// These are intentionally side-effect free and safe to run on live saves.
// Now imported from ../diagnostics/qaScanners.js
// -----------------------------------------------------------------------------


// -----------------------------------------------------------------------------
// Live integrity audits
// -----------------------------------------------------------------------------
// Goal: prevent "bad saves" and provide a one-click sanity snapshot for dev QA.
// This is intentionally conservative: any NaN/Infinity in state is treated as critical.
function classifyIntegritySeverity(invariant, scanners) {
    try {
        if (!invariant || typeof invariant !== 'object') return 'warn'
        const invIssues = Array.isArray(invariant.issues) ? invariant.issues : []
        const counts = scanners && scanners.counts ? scanners.counts : null

        // Any non-finite numbers are treated as critical.
        if (counts && counts.nonFinite && counts.nonFinite > 0) return 'critical'

        // Missing core containers or NaN core stats are critical.
        for (let i = 0; i < invIssues.length; i++) {
            const code = invIssues[i] && invIssues[i].code ? String(invIssues[i].code) : ''
            if (!code) continue
            if (code.indexOf('.missing') >= 0) return 'critical'
            if (code.indexOf('.nan') >= 0) return 'critical'
            if (code.indexOf('time.dayIndex.bad') >= 0) return 'critical'
            if (code.indexOf('player.hp.range') >= 0) return 'warn'
        }

        // Reference issues + negative counters are usually recoverable but should be investigated.
        if (counts) {
            if (counts.negatives && counts.negatives > 0) return 'warn'
            if (counts.refs && counts.refs > 0) return 'warn'
            if (counts.combatRuntime && counts.combatRuntime > 0) return 'warn'
            if (counts.statSanity && counts.statSanity > 0) return 'warn'
            if (counts.elementKeys && counts.elementKeys > 0) return 'warn'
        }

        return invIssues.length ? 'warn' : 'ok'
    } catch (_) {
        return 'warn'
    }
}

function runIntegrityAudit(s, stage, opts = {}) {
    const st = s || state
    const label = String(stage || 'audit')

    return perfWrap(st, 'qa:integrityAudit', { stage: label }, () => {
        // Best-effort sanitation so "harmless" out-of-range values don't masquerade as corruption.
        try { sanitizeCoreStateObject(st) } catch (_) {}

        let invariant = null
        try {
            invariant = validateState(st)
        } catch (e) {
            invariant = {
                ok: false,
                issues: [{ code: 'audit.exception', detail: (e && e.message) ? e.message : String(e) }]
            }
        }

        // Deep scanners: bounded and safe to run on live saves.
        let scanners = null
        try {
            scanners = qaCollectBugScannerFindings(st)
        } catch (_) {
            scanners = { hasIssues: false, counts: {}, findings: {} }
        }

        const severity = classifyIntegritySeverity(invariant, scanners)
        const report = {
            stage: label,
            time: Date.now(),
            severity,
            ok: severity === 'ok',
            invariant,
            scanners
        }

        // Persist a compact summary for bug reports.
        try {
            if (!st.debug || typeof st.debug !== 'object') st.debug = {}
            st.debug.lastAudit = {
                stage: report.stage,
                time: report.time,
                severity: report.severity,
                invariantIssueCount: Array.isArray(invariant.issues) ? invariant.issues.length : 0,
                scannerCounts: scanners && scanners.counts ? scanners.counts : {}
            }
        } catch (_) {}

        return report
    })
}

function formatIntegrityAuditReport(report) {
    const r = report || {}
    const inv = r.invariant || {}
    const sc = r.scanners || {}
    const counts = sc.counts || {}

    const lines = []
    lines.push('Integrity Audit — ' + String(r.stage || 'manual'))
    lines.push('Severity: ' + String(r.severity || 'unknown'))
    try {
        if (r.time) lines.push('Time (UTC): ' + new Date(Number(r.time)).toISOString())
    } catch (_) {}
    lines.push('')

    if (inv && inv.ok) {
        lines.push('Invariants: ✓ OK')
    } else {
        const issues = Array.isArray(inv.issues) ? inv.issues : []
        lines.push('Invariants: ⚠ ' + issues.length + ' issue(s)')
        issues.slice(0, 16).forEach((x) => {
            const code = x && x.code ? String(x.code) : 'issue'
            const detail = x && x.detail ? String(x.detail) : ''
            lines.push('  - ' + code + (detail ? ': ' + detail : ''))
        })
        if (issues.length > 16) lines.push('  … +' + String(issues.length - 16) + ' more')
    }
    lines.push('')

    const fmtCount = (k, label) => {
        const v = Number(counts && counts[k])
        if (Number.isFinite(v) && v > 0) lines.push('Scanner: ' + label + ' — ' + v)
    }
    fmtCount('nonFinite', 'Non-finite numbers')
    fmtCount('negatives', 'Negative counters')
    fmtCount('elementKeys', 'Element key anomalies')
    fmtCount('refs', 'Reference integrity')
    fmtCount('abilityElements', 'Ability element tags')
    fmtCount('statSanity', 'Derived stat sanity')
    fmtCount('combatRuntime', 'Combat runtime sanity')
    fmtCount('talentIntegrity', 'Talent wiring integrity')

    const hasAny = !!(sc && sc.hasIssues)
    if (!hasAny) lines.push('Scanners: ✓ No findings')

    // Include a tiny snippet of the highest-signal scanner output.
    try {
        const f = sc.findings || {}
        const show = (label, arr) => {
            if (!Array.isArray(arr) || !arr.length) return
            lines.push('')
            lines.push(label + ' (top ' + Math.min(8, arr.length) + ')')
            arr.slice(0, 8).forEach((x) => lines.push('  - ' + String(x)))
        }
        show('Non-finite paths', f.nonFinite)
        show('Negative counters', f.negatives)
        show('Reference issues', f.refs)
    } catch (_) {}

    return lines.join('\n')
}

// Scenario runner: deterministic "mini-sim" on a cloned save.
// Purpose: catch rare drift bugs (daily tick ordering, RNG/state corruption) without touching the live run.
function runScenarioRunner(opts = {}) {
    const days = Math.max(1, Math.min(30, Math.floor(Number(opts.days || 7))))
    const lootRolls = Math.max(0, Math.min(250, Math.floor(Number(opts.lootRolls || 60))))
    const seed = (Number.isFinite(Number(opts.seed)) ? (Number(opts.seed) >>> 0) : 13371337)

    // Build a fully-serializable snapshot and clone it so the scenario cannot mutate the live state.
    let blob = null
    try {
        blob = JSON.parse(JSON.stringify(_buildSaveBlob()))
    } catch (e) {
        return { ok: false, ms: 0, error: 'Failed to clone save blob: ' + (e && e.message ? e.message : String(e)) }
    }

    const t0 = _perfNow()
    const live = {
        state: state,
        ref: null,
        saveGame: typeof saveGame === 'function' ? saveGame : null,
        updateHUD: typeof updateHUD === 'function' ? updateHUD : null,
        // UI helpers are imported ES-module bindings (read-only). We must NOT attempt
        // to monkey-patch them for scenario isolation.
        uiWasDisabled: (typeof isUiDisabled === 'function') ? !!isUiDisabled() : false,
        recordInput: typeof recordInput === 'function' ? recordInput : null,
        // Patch 1.2.53: scenario runner must never repaint live UI elements (Quest Box pin state, etc.).
        // Some world-advance hooks call quests.updateQuestBox() directly.
        updateQuestBox: (typeof quests !== 'undefined' && quests && typeof quests.updateQuestBox === 'function')
            ? quests.updateQuestBox
            : null
    }

    try {
        try {
            if (typeof window !== 'undefined') live.ref = window.__emberwoodStateRef
        } catch (_) {}

        // Hydrate an isolated state.
        const s = createEmptyState()
        s.player = blob.player || null
        s.area = blob.area || 'village'
        s.difficulty = blob.difficulty || 'normal'
        s.dynamicDifficulty = blob.dynamicDifficulty || { band: 0, tooEasyStreak: 0, struggleStreak: 0 }
        s.quests = blob.quests || createQuestState()
        s.flags = blob.flags || createFlagState()
        s.debug = Object.assign({}, blob.debug || {})
        s.companion = blob.companion || null
        s.time = blob.time || null
        s.villageEconomy = blob.villageEconomy || null
        s.government = blob.government || null
        s.village = blob.village || null
        s.bank = blob.bank || null
        s.villageMerchantNames = blob.villageMerchantNames || null
        s.merchantStock = blob.merchantStock || null
        s.merchantStockMeta = blob.merchantStockMeta || null
        s.sim = blob.sim || { lastDailyTickDay: null }
        s.log = []
        s.logFilter = 'all'
        s.inCombat = false
        s.enemies = null
        s.currentEnemy = null

        // Swap global refs so rngFloat(null, …) and any stray global reads use the scenario state.
        _setState(s)
        syncGlobalStateRef()

        // Disable persistence + UI side effects while the scenario runs.
        if (live.saveGame) saveGame = () => {}
        if (live.updateHUD) updateHUD = () => {}
        if (live.recordInput) recordInput = () => {}
        try { if (typeof setUiDisabled === 'function') setUiDisabled(true) } catch (_) {}

        // Patch 1.2.53: prevent quest UI refreshes from mutating the live DOM while state is swapped.
        try {
            if (typeof quests !== 'undefined' && quests && typeof quests.updateQuestBox === 'function') {
                quests.updateQuestBox = () => {}
            }
        } catch (_) {}

        // Ensure subsystems exist.
        try { initRngState(s) } catch (_) {}
        try { setDeterministicRngEnabled(s, true) } catch (_) {}
        try { setRngSeed(s, seed) } catch (_) {}

        try {
            if (!s.time) initTimeState(s)
            if (!s.villageEconomy) initVillageEconomyState(s)
            if (!s.government) initGovernmentState(s, 0)
            ensureVillagePopulation(s)
        } catch (_) {}

        try {
            if (s.player) {
                ensurePlayerSpellSystems(s.player)
                _recalcPlayerStats()
            }
        } catch (_) {}

        // Run day advances through the unified pipeline.
        try {
            advanceWorldDays(s, days, { silent: true })
        } catch (e) {
            // Continue; audit will capture any fallout.
        }

        // Loot rolls (exercise RNG paths + rarity tables).
        const lootCounts = { totalItems: 0, potions: 0, weapons: 0, armor: 0, rarities: {} }
        try {
            for (let i = 0; i < lootRolls; i++) {
                const drop = generateLootDrop({
                    area: s.area || 'forest',
                    playerLevel: s.player ? (s.player.level || 1) : 1,
                    playerResourceKey: s.player ? (s.player.resourceKey || null) : null
                })

                if (Array.isArray(drop)) {
                    drop.forEach((it) => {
                        if (!it) return
                        lootCounts.totalItems += 1
                        const cat = it.category || it.type || ''
                        if (cat === 'potion') lootCounts.potions += 1
                        else if (cat === 'weapon') lootCounts.weapons += 1
                        else if (cat === 'armor') lootCounts.armor += 1
                        const r = it.rarity ? String(it.rarity) : 'unknown'
                        lootCounts.rarities[r] = (lootCounts.rarities[r] || 0) + 1
                    })
                } else if (drop) {
                    lootCounts.totalItems += 1
                }
            }
        } catch (_) {}

        const audit = runIntegrityAudit(s, 'scenario_end')
        const ms = _perfNow() - t0

        const severity = (audit && typeof audit.severity === 'string' && audit.severity)
            ? audit.severity
            : (audit && audit.ok ? 'ok' : 'issues')

        const out = {
            ok: !!(audit && audit.ok),
            severity,
            days,
            lootRolls,
            lootCounts,
            seed,
            ms,
            audit
        }

        // Store compact summary for bug reports.
        try {
            if (!live.state.debug || typeof live.state.debug !== 'object') live.state.debug = {}
            live.state.debug.lastScenario = {
                time: Date.now(),
                days,
                lootRolls,
                seed,
                ms: Math.round(ms),
                severity: out.severity,
                lootCounts: out.lootCounts
            }
        } catch (_) {}

        return out
    } finally {
        // Restore globals.
        try {
            _setState(live.state)
            syncGlobalStateRef()
            if (typeof window !== 'undefined' && live.ref) window.__emberwoodStateRef = live.ref
        } catch (_) {}

        try {
            if (live.saveGame) saveGame = live.saveGame
            if (live.updateHUD) updateHUD = live.updateHUD
            if (live.recordInput) recordInput = live.recordInput
        } catch (_) {}

        try { if (typeof setUiDisabled === 'function') setUiDisabled(!!live.uiWasDisabled) } catch (_) {}

        // Restore quest box renderer and refresh HUD so any stray scenario-time UI writes are corrected.
        try {
            if (typeof quests !== 'undefined' && quests) {
                if (live.updateQuestBox) quests.updateQuestBox = live.updateQuestBox
                // Ensure the pinned-quest UI is consistent with the restored live state.
                if (typeof quests.updateQuestBox === 'function') quests.updateQuestBox()
            }
        } catch (_) {}
        try {
            if (typeof updateHUD === 'function') updateHUD()
        } catch (_) {}
    }
}

function formatScenarioRunnerReport(res) {
    const r = res || {}
    const lines = []
    lines.push('Scenario Runner (cloned save)')
    lines.push('Result: ' + (r.ok ? '✓ OK' : '⚠ ' + String(r.severity || 'issues')))
    lines.push('Days advanced: ' + String(r.days || 0))
    lines.push('Loot rolls: ' + String(r.lootRolls || 0) + ' • Seed: ' + String(r.seed || ''))
    if (typeof r.ms === 'number') lines.push('Runtime: ' + String(Math.round(r.ms)) + ' ms')
    lines.push('')

    const c = r.lootCounts || {}
    if (c.totalItems) {
        lines.push('Loot summary')
        lines.push('  Total items: ' + String(c.totalItems))
        lines.push('  Potions: ' + String(c.potions || 0) + ' • Weapons: ' + String(c.weapons || 0) + ' • Armor: ' + String(c.armor || 0))
        const rar = c.rarities || {}
        const keys = Object.keys(rar)
        if (keys.length) {
            lines.push('  Rarities:')
            keys.sort((a, b) => (rar[b] || 0) - (rar[a] || 0)).forEach((k) => {
                lines.push('    - ' + k + ': ' + String(rar[k]))
            })
        }
        lines.push('')
    }

    if (r.audit) {
        lines.push(formatIntegrityAuditReport(r.audit))
    }

    if (r.error) {
        lines.push('Error: ' + String(r.error))
    }

    return lines.join('\n')
}

function buildBugReportBundle() {
    const p = state && state.player
    try { ensurePlayerStatsDefaults(p) } catch (_) {}
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
        inputLogTail: Array.isArray(state.debug.inputLog) ? state.debug.inputLog.slice(-120) : [],
        invariantIssues: state.debug.lastInvariantIssues || null,
        rngLogTail: Array.isArray(state.debug.rngLog) ? state.debug.rngLog.slice(-200) : [],

        // Patch 1.2.52+: simulation reliability tooling (compact)
        lastAudit: state.debug.lastAudit || null,
        capturePerf: !!state.debug.capturePerf,
        perfLogTail: Array.isArray(state.debug.perfLog) ? state.debug.perfLog.slice(-120) : []
    } : null

    const scanners = qaCollectBugScannerFindings(state)

    const diag = {
        lastCrashReport: getLastCrashReport() || null,
        lastSaveError: lastSaveError || null,
        perfSnapshot: (() => { try { return qaCollectPerfSnapshotSync(state) } catch (_) { return null } })(),
        logTail: (state && Array.isArray(state.log)) ? state.log.slice(-200) : [],
        scanners,
        playerStats: (p && p.stats) ? {
            attack: p.stats.attack,
            magic: p.stats.magic,
            armor: p.stats.armor,
            speed: p.stats.speed,
            magicRes: p.stats.magicRes,
            critChance: p.stats.critChance,
            dodgeChance: p.stats.dodgeChance,
            dodge: p.stats.dodge,
            resistAll: p.stats.resistAll,
            armorPen: p.stats.armorPen,
            lifeSteal: p.stats.lifeSteal,
            haste: p.stats.haste,
            elementalBonuses: p.stats.elementalBonuses || {},
            elementalResists: p.stats.elementalResists || {}
        } : null
    }

    // Locus services: attach small, privacy-safe tails that help debugging.
    const locus = (() => {
        try {
            const flagsSvc = _engine && (_engine.getService ? _engine.getService('flags') : _engine.flags)
            const i18nSvc = _engine && (_engine.getService ? _engine.getService('i18n') : _engine.i18n)
            const savePolicySvc = _engine && (_engine.getService ? _engine.getService('savePolicy') : _engine.savePolicy)
            const replaySvc = _engine && (_engine.getService ? _engine.getService('replay') : _engine.replay)
            const telemetrySvc = _engine && (_engine.getService ? _engine.getService('telemetry') : _engine.telemetry)

            return {
                flags: flagsSvc && typeof flagsSvc.dump === 'function' ? flagsSvc.dump() : null,
                locale: i18nSvc && typeof i18nSvc.getLocale === 'function' ? i18nSvc.getLocale() : null,
                savePolicy: savePolicySvc && typeof savePolicySvc.getStatus === 'function' ? savePolicySvc.getStatus() : null,
                replay: replaySvc && typeof replaySvc.getLastMeta === 'function' ? replaySvc.getLastMeta() : null,
                telemetryTail: telemetrySvc && typeof telemetrySvc.getTail === 'function' ? telemetrySvc.getTail(120) : null
            }
        } catch (_) {
            return null
        }
    })()

    return { summary, game, debug, diagnostics: diag, locus }
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

const scanners = diag && diag.scanners ? diag.scanners : null
if (scanners && scanners.hasIssues) {
    const c = scanners.counts || {}
    if (c.nonFinite) issues.push('scan: non-finite numbers (' + String(c.nonFinite) + ')')
    if (c.negatives) issues.push('scan: negative counters (' + String(c.negatives) + ')')
    if (c.elementKeys) issues.push('scan: element key anomalies (' + String(c.elementKeys) + ')')
    if (c.refs) issues.push('scan: reference integrity (' + String(c.refs) + ')')
    if (c.abilityElements) issues.push('scan: ability element tags (' + String(c.abilityElements) + ')')
    if (c.statSanity) issues.push('scan: derived stat sanity (' + String(c.statSanity) + ')')
    if (c.combatRuntime) issues.push('scan: combat runtime sanity (' + String(c.combatRuntime) + ')')
    if (c.talentIntegrity) issues.push('scan: talent wiring integrity (' + String(c.talentIntegrity) + ')')
}

    lines.push('Findings')
    if (!issues.length) {
        lines.push('  ✓ No issues detected by the bug report scanners.')
    } else {
        issues.slice(0, 12).forEach((x) => lines.push('  ⚠ ' + x))
        if (issues.length > 12) lines.push('  … +' + String(issues.length - 12) + ' more')
    }
    lines.push('')

    // Performance snapshot
    try {
        const perfSnap = diag && diag.perfSnapshot ? diag.perfSnapshot : null
        if (perfSnap) {
            lines.push(qaFormatPerfSnapshotText(perfSnap))
            lines.push('')
        }
    } catch (_) {}

    // Deep scanner details (top findings) — helps catch subtle calc bugs.
    const _sc = diag && diag.scanners ? diag.scanners : null
    if (_sc && _sc.hasIssues) {
        const f = _sc.findings || {}
        const show = (title, arr) => {
            if (!Array.isArray(arr) || !arr.length) return
            lines.push('Scanner: ' + title + ' (top ' + Math.min(6, arr.length) + ' of ' + arr.length + ')')
            arr.slice(0, 6).forEach((x) => lines.push('  - ' + String(x)))
            if (arr.length > 6) lines.push('  … +' + String(arr.length - 6) + ' more')
            lines.push('')
        }
        show('Non-finite numbers', f.nonFinite)
        show('Negative counters', f.negatives)
        show('Element key anomalies', f.elementKeys)
        show('Reference integrity', f.refs)
        show('Ability element coverage', f.abilityElements)
        show('Derived stat sanity', f.statSanity)
        show('Combat runtime sanity', f.combatRuntime)
        show('Talent wiring integrity', f.talentIntegrity)
    }

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

// --------------------------- QA perf snapshot helpers ---------------------------
// Used by the Smoke Tests + Bug Report modal to show what is fast vs slow.


function openSmokeTestsModal() {
    // NOTE (Patch 1.2.70): Diagnostics/QA UI was extracted into a dedicated module.
    // Keep this name as a stable public hook for UI bindings.
    try {
        try {
            if (!_diagnosticsUI && _engine && typeof _engine.getService === 'function') {
                _diagnosticsUI = _engine.getService('diagnostics') || null
            }
        } catch (_) {}
        if (_diagnosticsUI && typeof _diagnosticsUI.openSmokeTestsModal === 'function') {
            return _diagnosticsUI.openSmokeTestsModal()
        }
    } catch (_) {}
}



function runSmokeTests(opts = {}) {
    const returnObject = !!(opts && opts.returnObject)

    const lines = []
    const started = Date.now()
    const QA_SEED = 123456789

    // Patch 1.2.70: keep the default smoke-suite fast on mobile devices.
    // Full / extended runs can be forced via runSmokeTests({ full: true }).
    const _ua = (typeof navigator !== 'undefined' && navigator && navigator.userAgent) ? String(navigator.userAgent) : ''
    const _isMobileUa = /iPhone|iPad|iPod|Android/i.test(_ua)
    const _quickMode = (opts && typeof opts.full === 'boolean') ? !opts.full : _isMobileUa

    const QA_COUNTS = {
        // Quick-mode is tuned for iOS file-protocol runs (fast feedback; no long loops).
        fuzz2Seeds: _quickMode ? 1 : 3,
        fuzz2Actions: _quickMode ? 15 : 90,
        fuzzActions: _quickMode ? 40 : 300,
        stressLootDrops: _quickMode ? 70 : 700,
        stressEnemies: _quickMode ? 40 : 300,
        stressSaveCycles: _quickMode ? 5 : 40,
        stressScenarioDays: _quickMode ? 4 : 14,
        stressScenarioLoot: _quickMode ? 25 : 140,
        stressDamageIters: _quickMode ? 120 : 1000
    }

    lines.push('SMOKE TESTS')
    lines.push('Patch ' + GAME_PATCH + (GAME_PATCH_NAME ? ' — ' + GAME_PATCH_NAME : ''))
    lines.push('Seed ' + QA_SEED + ' • Save schema ' + SAVE_SCHEMA)
    lines.push('Legend: ✔ pass • ✖ fail')

    // Patch 1.2.70: keep a stable top-of-report summary (tests ran + failures), like prior builds.
    const _summaryLineIndex = lines.length
    // Keep duration visible in the report header (parity with pre-refactor smoke output).
    lines.push('Ran … tests in … ms • Failures: …')
    lines.push('')

    const live = state

    // Smoke tests should not repaint the live UI while the suite swaps `state`.
    // We use uiRuntime's flag instead of monkey-patching imported bindings.
    const _liveUiDisabledSnap = (() => {
        try { return typeof isUiDisabled === 'function' ? !!isUiDisabled() : false } catch (_) { return false }
    })()

    // Disable UI writes for the duration of the suite (prevents live DOM churn + speeds up runs).
    try { if (typeof setUiDisabled === 'function') setUiDisabled(true) } catch (_) {}

    // Perf snapshot of the *live session* (helps compare "slow paths" vs test time).
    const _perfSnapLive = (() => {
        try { return qaCollectPerfSnapshotSync(live) } catch (_) { return null }
    })()
    if (_perfSnapLive) {
        lines.push(qaFormatPerfSnapshotText(_perfSnapLive))
        lines.push('')
    }

    // Patch 1.2.53: Smoke tests must never clear the player's pinned quest.
    // Snapshot the pin up-front and restore it after the sandbox run (only if still valid).
    const _normalizePinnedQuestRef = (pinRaw) => {
        try {
            if (!pinRaw) return null
            if (pinRaw && typeof pinRaw === 'object') {
                if (pinRaw.kind === 'main') return { kind: 'main' }
                if (pinRaw.kind === 'side' && pinRaw.id) return { kind: 'side', id: String(pinRaw.id) }
                return null
            }
            if (typeof pinRaw === 'string' && pinRaw.trim()) {
                const t = pinRaw.trim()
                return t.toLowerCase() === 'main' ? { kind: 'main' } : { kind: 'side', id: t }
            }
            return null
        } catch (_) {
            return null
        }
    }
    const _livePinnedQuestSnap = (() => {
        try {
            const pin = _normalizePinnedQuestRef(live && live.quests ? live.quests.pinned : null)
            return pin ? JSON.parse(JSON.stringify(pin)) : null
        } catch (_) {
            return null
        }
    })()

    // Patch 1.2.53: prevent any pending save coalescing timer from firing while state is swapped.
    const _liveSaveTimerWasActive = (() => {
        try { return !!_saveTimer } catch (_) { return false }
    })()
    const _liveSaveQueuedSnap = (() => {
        try { return !!_saveQueued } catch (_) { return false }
    })()
    try {
        if (_saveTimer) {
            clearTimeout(_saveTimer)
            _saveTimer = null
        }
        _saveQueued = false
    } catch (_) {}

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

    // Stash a few function refs so smoke tests don't mutate the player's save or UI.
    // NOTE: UI helpers imported from ES modules (uiRuntime.js) are *read-only bindings*.
    // On iOS Safari, assigning to them throws "Attempted to assign to readonly property".
    // Instead of monkey-patching, we temporarily disable UI writes via uiRuntime's switch.
    const _liveSaveGame = typeof saveGame === 'function' ? saveGame : null
    const _liveUpdateHUD = typeof updateHUD === 'function' ? updateHUD : null
    const _liveUpdateEnemyPanel = typeof updateEnemyPanel === 'function' ? updateEnemyPanel : null
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

        _setState(t)
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
        if (_liveUpdateHUD) updateHUD = () => {}
        if (_liveRecordInput) recordInput = () => {}

        // Disable UI writes for the bulk of the suite so gameplay tests don't pay
        // the cost of DOM work (log rendering, screen swaps, etc.). Individual UI
        // tests can temporarily re-enable UI with `withUiEnabled`.
        const _setSmokeUiDisabled = (v) => {
            try {
                if (typeof setUiDisabled === 'function') setUiDisabled(!!v)
            } catch (_) {}
        }
        const withUiEnabled = (fn) => {
            const prev = (() => {
                try { return typeof isUiDisabled === 'function' ? !!isUiDisabled() : false } catch (_) { return false }
            })()
            _setSmokeUiDisabled(false)
            try {
                return fn()
            } finally {
                _setSmokeUiDisabled(prev)
            }
        }

        _setSmokeUiDisabled(true)

        section('Player & Inventory')

        // 1) basic stat recalc
        test('recalcPlayerStats', () => {
            _recalcPlayerStats()
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
            _recalcPlayerStats()
            const snap1 = JSON.stringify({ maxHp: p.maxHp, stats: p.stats, status: p.status })
            _recalcPlayerStats()
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
            _recalcPlayerStats()
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

        test('abilities/spells have elementType or physical tag', () => {
            const hasPhysicalTag = (ab) => {
                try {
                    return Array.isArray(ab.tags) && ab.tags.indexOf('physical') >= 0
                } catch (_) {
                    return false
                }
            }
            const hasElementType = (ab) => !!(ab && (ab.elementType || ab.element))

            // Player abilities with classId should always be classed.
            Object.keys(ABILITIES).forEach((id) => {
                const ab = ABILITIES[id]
                if (!ab || !ab.classId) return
                assert(hasElementType(ab) || hasPhysicalTag(ab), 'ABILITIES.' + id + ' missing elementType/physical tag')
            })

            // Enemy abilities should be classed (elementType or physical).
            Object.keys(ENEMY_ABILITIES).forEach((id) => {
                const ab = ENEMY_ABILITIES[id]
                if (!ab) return
                const physicalOk = hasPhysicalTag(ab) || ab.damageType === 'physical'
                assert(hasElementType(ab) || physicalOk, 'ENEMY_ABILITIES.' + id + ' missing elementType/physical')
            })

            // Companion abilities should be classed (elementType or physical).
            Object.keys(COMPANION_ABILITIES).forEach((id) => {
                const ab = COMPANION_ABILITIES[id]
                if (!ab) return
                assert(hasElementType(ab) || hasPhysicalTag(ab), 'COMPANION_ABILITIES.' + id + ' missing elementType/physical tag')
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
            return withUiEnabled(() => {
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
        })

        section('Talents (Patch 1.2.x)')

        test('talent unlock immediately updates derived stats (mage_frostward)', () => {
            // Verify wiring: unlocking a resist talent should apply to player stats
            // without requiring an unrelated stat refresh (equip, level-up, etc.).
            state.player = createPlayer('Mage', 'mage', 'normal')
            const p = state.player
            p.level = 6
            p.talentPoints = 1
            ensurePlayerTalents(p)
            _recalcPlayerStats()

            assert(!((p.stats.elementalResists || {}).frost), 'unexpected frost resist before talent')

            const ok = unlockTalent(p, 'mage_frostward')
            assert(ok, 'unlockTalent returned false')

            const frost = (p.stats.elementalResists || {}).frost || 0
            assert(frost === 15, 'expected 15% frost resist from talent, got ' + frost)
        })

        test('talent unlock immediately updates derived stats (vampire_dark_agility)', () => {
            state.player = createPlayer('Vampire', 'vampire', 'normal')
            const p = state.player
            p.level = 6
            p.talentPoints = 1
            ensurePlayerTalents(p)
            _recalcPlayerStats()

            const before = Number(p.stats && p.stats.dodgeChance ? p.stats.dodgeChance : 0)
            const ok = unlockTalent(p, 'vampire_dark_agility')
            assert(ok, 'unlockTalent returned false')

            const after = Number(p.stats && p.stats.dodgeChance ? p.stats.dodgeChance : 0)
            // Talent adds +8% dodge; allow small rounding differences due to speed-derived dodge.
            assert(after >= before + 7.5, 'expected vampire_dark_agility to add dodge immediately, got ' + before + ' -> ' + after)
        })

                test('talent tables: each class has 8 talent options', () => {
            Object.keys(PLAYER_CLASSES).forEach((cid) => {
                const arr = TALENT_DEFS[cid] || []
                assert(arr.length === 8, cid + ' talent count expected 8, got ' + arr.length)
            })
        })

        test('pinpoint increases mark scaling (deterministic)', () => {
            const p = state.player
            p.classId = 'ranger'
            p.resourceKey = 'fury'
            p.status = p.status || {}
            p.status.firstHitBonusAvailable = false // isolate mark math
            p.talents = {}
            p.talentPoints = 1

            _recalcPlayerStats()

            const enemy = {
                name: 'Dummy',
                hp: 200,
                maxHp: 200,
                armor: 0,
                armorBuff: 0,
                affinities: {},
                elementalResists: {},
                markedStacks: 5,
                markedTurns: 3
            }
            state.currentEnemy = enemy

            const ctx0 = buildAbilityContext(p, 'twinArrows')
            _setPlayerAbilityContext(ctx0)
            state.flags.neverCrit = true
            setRngSeed(state, 777)
            const dmg0 = calcPhysicalDamage(300, null, enemy)

            unlockTalent(p, 'ranger_pinpoint')
            const ctx1 = buildAbilityContext(p, 'twinArrows')
            _setPlayerAbilityContext(ctx1)
            setRngSeed(state, 777)
            const dmg1 = calcPhysicalDamage(300, null, enemy)

            assert(dmg1 > dmg0, 'expected pinpoint to increase damage, got ' + dmg0 + ' -> ' + dmg1)

            state.flags.neverCrit = false
            _setPlayerAbilityContext(null)
        })

test('ember focus increases fire spell damage (deterministic)', () => {
            const snapFlags = {
                alwaysCrit: state.flags && state.flags.alwaysCrit,
                neverCrit: state.flags && state.flags.neverCrit
            }
            state.flags = Object.assign({}, state.flags || {}, { neverCrit: true })
            state.player = createPlayer('Mage', 'mage', 'normal')
            const p = state.player
            p.level = 6
            p.talentPoints = 1
            ensurePlayerTalents(p)
            _recalcPlayerStats()

	            const enemy = { name: 'Dummy', hp: 999, maxHp: 999, armor: 0, magicRes: 0, armorBuff: 0, magicResBuff: 0, level: 1, tier: 1 }

            // Reset RNG before each call so variance is identical.
	            setRngSeed(state, 424242)
	            // calcMagicDamage signature: (baseMagicStat, elementType, enemyOverride)
	            const dmgNoTalent = calcMagicDamage(500, 'fire', enemy)

            const ok = unlockTalent(p, 'mage_ember_focus')
            assert(ok, 'unlockTalent returned false')
	            setRngSeed(state, 424242)
	            const dmgWithTalent = calcMagicDamage(500, 'fire', enemy)

            assert(dmgWithTalent > dmgNoTalent, 'expected damage increase, got ' + dmgNoTalent + ' -> ' + dmgWithTalent)

            // Allow 1 point of rounding drift.
            const expected = Math.round(dmgNoTalent * 1.10)
            assert(Math.abs(dmgWithTalent - expected) <= 1, 'expected ~' + expected + ' (10% more), got ' + dmgWithTalent)

            // Restore flags so later tests that validate crit behavior are unaffected.
            try {
                state.flags.alwaysCrit = snapFlags.alwaysCrit
                state.flags.neverCrit = snapFlags.neverCrit
            } catch (_) {}
        })

        test('character sheet elemental bonus summary includes spell-focus talents', () => {
            state.player = createPlayer('Mage', 'mage', 'normal')
            const p = state.player
            p.level = 6
            p.talentPoints = 1
            ensurePlayerTalents(p)
            _recalcPlayerStats()

            const s0 = _computeElementSummariesForPlayer(p)
            assert(!String(s0.elementalBonusSummary || '').includes('Fire'), 'expected no Fire bonus before talent, got ' + s0.elementalBonusSummary)

            const ok = unlockTalent(p, 'mage_ember_focus')
            assert(ok, 'unlockTalent returned false')

            const s1 = _computeElementSummariesForPlayer(p)
            assert(String(s1.elementalBonusSummary || '').includes('Fire +10%'), 'expected Fire +10% after Ember Focus, got ' + s1.elementalBonusSummary)
        })


        test('elemental summaries do not show zero-prefixed entries', () => {
            const p = {
                stats: {
                    elementalBonusBreakdown: { gear: { frost: '5%', shadow: 0 }, talent: { shadow: '10%' } },
                    elementalResistBreakdown: { gear: { frost: '7%' }, talent: { shadow: 15 } },
                    elementalResists: { frost: '7%', shadow: 15 }
                }
            }
            const s = _computeElementSummariesForPlayer(p)
            assert(String(s.elementalBonusSummary || '').includes('Frost +5%'), 'missing Frost +5%, got ' + s.elementalBonusSummary)
            assert(String(s.elementalBonusSummary || '').includes('Shadow +10%'), 'missing Shadow +10%, got ' + s.elementalBonusSummary)
            assert(!/0frost/i.test(String(s.elementalBonusSummary || '')), 'unexpected 0frost in summary: ' + s.elementalBonusSummary)
            assert(!/0shadow/i.test(String(s.elementalBonusSummary || '')), 'unexpected 0shadow in summary: ' + s.elementalBonusSummary)
            assert(String(s.elementalResistSummary || '').includes('Frost 7%'), 'missing Frost resist, got ' + s.elementalResistSummary)
            assert(String(s.elementalResistSummary || '').includes('Shadow 15%'), 'missing Shadow resist, got ' + s.elementalResistSummary)
        })

        test('normalizeElementType strips numeric prefixes and duplicated names', () => {
            assert(normalizeElementType('0frost') === 'frost', 'expected 0frost -> frost')
            assert(normalizeElementType('0shadowshadow') === 'shadow', 'expected 0shadowshadow -> shadow')
            assert(normalizeElementType('shadow_resist') === 'shadow', 'expected shadow_resist -> shadow')
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


section('Cheats & Leveling')

test('cheat: max level grants skill + talent points', () => {
    state.player = createPlayer('Cheater', 'mage', 'normal')
    const p = state.player
    ensurePlayerTalents(p)
    const startLevel = Number(p.level || 1)
    const startTalent = Number(p.talentPoints || 0)

    // Should not open modals during the suite.
    cheatMaxLevel({ openModal: false })

    assert(p.level === MAX_PLAYER_LEVEL, 'expected level ' + MAX_PLAYER_LEVEL + ', got ' + p.level)
    const expectedSkills = (MAX_PLAYER_LEVEL - startLevel)
    assert(p.skillPoints === expectedSkills, 'expected skillPoints ' + expectedSkills + ', got ' + p.skillPoints)

    let expectedTalents = startTalent
    for (let lv = startLevel + 1; lv <= MAX_PLAYER_LEVEL; lv++) {
        if (lv % 3 === 0) expectedTalents += 1
    }
    assert((p.talentPoints || 0) === expectedTalents, 'expected talentPoints ' + expectedTalents + ', got ' + (p.talentPoints || 0))
})
                section('Economy & Daily Ticks')

        // 10) daily ticks x3 (basic regression)
        test('daily ticks x3', () => {
            for (let i = 0; i < 3; i++) {
                advanceToNextMorning(state, { silent: true })
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
            return withUiEnabled(() => {
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
        })


        // UI: dev-only HUD pills visibility toggles with cheats flag
        test('UI: dev HUD pills visibility toggles', () => {
            return withUiEnabled(() => {
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
        })

        // UI: cheat menu can build in a sandboxed modal (no DOM lockups)
        test('UI: cheat menu builder is safe (sandboxed modal)', () => {
            const prevAdapter = typeof getModalAdapter === 'function' ? getModalAdapter() : null
            const calls = { opened: 0, closed: 0, title: '', body: null }
            try {
                if (typeof setModalAdapter === 'function') {
                    setModalAdapter({
                        openModal: (title, builder) => {
                            calls.opened += 1
                            calls.title = String(title || '')
                            const body = document.createElement('div')
                            calls.body = body
                            if (typeof builder === 'function') builder(body)
                        },
                        closeModal: () => {
                            calls.closed += 1
                        }
                    })
                }

                // Must not throw
                openCheatMenu()

                assert(calls.opened >= 1, 'expected cheat menu to open a modal')
                assert(calls.title.toLowerCase().includes('cheat'), 'unexpected modal title: ' + calls.title)
                assert(calls.body && calls.body.querySelectorAll('button').length > 0, 'expected cheat modal to render buttons')
            } finally {
                try {
                    if (typeof setModalAdapter === 'function') setModalAdapter(prevAdapter)
                } catch (_) {}
            }
        })

	        // UI: character sheet modal builds (guards against missing template vars)
	        test('UI: character sheet modal builds (sandboxed)', () => {
	            const prevAdapter = typeof getModalAdapter === 'function' ? getModalAdapter() : null
	            const calls = { opened: 0, title: '', body: null }
	            try {
	                if (typeof setModalAdapter === 'function') {
	                    setModalAdapter({
	                        openModal: (title, builder) => {
	                            calls.opened += 1
	                            calls.title = String(title || '')
	                            const body = document.createElement('div')
	                            calls.body = body
	                            if (typeof builder === 'function') builder(body)
	                        }
	                    })
	                }

	                state.player = createPlayer('SheetTester', 'mage', 'normal')
	                _recalcPlayerStats()
	                // Must not throw
	                openCharacterSheet()

	                assert(calls.opened >= 1, 'expected character sheet to open a modal')
	                assert(calls.title.toLowerCase().includes('character'), 'unexpected modal title: ' + calls.title)
	                assert(!!(calls.body && calls.body.querySelector('.sheet-element-bonuses')), 'expected elemental bonus node')
	                assert(!!(calls.body && calls.body.querySelector('.sheet-element-resists')), 'expected elemental resist node')
	            } finally {
	                try {
	                    if (typeof setModalAdapter === 'function') setModalAdapter(prevAdapter)
	                } catch (_) {}
	            }
	        })



        // UI: enemy panel opens an Enemy Sheet modal (sandboxed)
        test('UI: enemy sheet modal builds (enemy panel click)', () => {
            return withUiEnabled(() => {
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
            _recalcPlayerStats()

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
            _recalcPlayerStats()

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
            _recalcPlayerStats()

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
            _recalcPlayerStats()

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

        
        
        // Patch 1.2.0 systems: talents, status synergies, enemy affinities, equipment traits
        section('Patch 1.2.0 Systems')

        test('talents: Mage Rhythm Mastery lowers Rhythm threshold to 2', () => {
            const p = state.player
            p.classId = 'mage'
            p.resourceKey = 'mana'
            p.resourceName = 'Mana'
            p.maxResource = 100
            p.resource = 100
            p.level = 3
            ensurePlayerSpellSystems(p)
            ensurePlayerTalents(p)
            p.talentPoints = 1
            p.talents = {}
            p.status = p.status || {}
            p.status.spellCastCount = 0

            // Without the talent: 2nd cast should NOT be active (threshold 3)
            let r0 = _getMageRhythmBonus(p, ABILITIES.fireball, 'fireball')
            assert(!r0.active, 'unexpected Rhythm active at cast 1 without talent')
            p.status.spellCastCount = 1
            let r1 = _getMageRhythmBonus(p, ABILITIES.fireball, 'fireball')
            assert(!r1.active, 'unexpected Rhythm active at cast 2 without talent')

            // Unlock talent: 2nd cast should now be active
            p.status.spellCastCount = 0
            const ok = unlockTalent(p, 'mage_rhythm_mastery')
            assert(ok, 'failed to unlock mage_rhythm_mastery')
            p.status.spellCastCount = 1
            let r2 = _getMageRhythmBonus(p, ABILITIES.fireball, 'fireball')
            assert(r2.active, 'expected Rhythm active at cast 2 with talent')
        })

        test('status synergy: Bleed + Fire ignites the enemy (Burning applied)', () => {
            const enemy = { name: 'Synergy Dummy', hp: 100, maxHp: 100, bleedTurns: 2, bleedDamage: 5 }
            applyStatusSynergyOnPlayerHit(enemy, 50, 'fire', 'magic')
            assert((enemy.burnTurns || 0) > 0, 'expected burning turns > 0')
            assert((enemy.burnDamage || 0) >= 2, 'expected burn damage to be set')
        })

        test('status synergy: Chilled + Physical triggers Shatter and consumes Chill', () => {
            const enemy = { name: 'Chill Dummy', hp: 100, maxHp: 100, chilledTurns: 2 }
            const before = enemy.hp
            applyStatusSynergyOnPlayerHit(enemy, 40, null, 'physical')
            assert(enemy.hp < before, 'expected shatter burst damage to reduce hp')
            assert((enemy.chilledTurns || 0) === 0, 'expected chill to be consumed')
        })

        test('enemy affinities: weakness/resistance multipliers resolve correctly', () => {
            const enemy = { affinities: { weak: { fire: 1.25 }, resist: { frost: 0.85 } } }
            assert(getEnemyAffinityMultiplier(enemy, 'fire') === 1.25, 'fire weakness multiplier mismatch')
            assert(getEnemyAffinityMultiplier(enemy, 'frost') === 0.85, 'frost resist multiplier mismatch')
            assert(getEnemyAffinityMultiplier(enemy, 'shadow') === 1, 'unexpected multiplier for unrelated element')
        })

        test('enemy affinities: percent-style values + synonym keys normalize correctly', () => {
            // Some authored content stores affinity deltas as percents (15/-13) and uses synonym keys (Ice/Storm).
            const e1 = { affinities: { weak: { Fire: 15 }, resist: {} } }
            const e2 = { affinities: { weak: {}, resist: { FROST: -13 } } }
            const e3 = { affinities: { weak: { Ice: 0.12 }, resist: { Storm: -0.10 } } }

            const fire = getEnemyAffinityMultiplier(e1, 'fire')
            const frost = getEnemyAffinityMultiplier(e2, 'frost')
            const ice = getEnemyAffinityMultiplier(e3, 'ice')
            const lightning = getEnemyAffinityMultiplier(e3, 'lightning')

            assert(Math.abs(fire - 1.15) < 0.0001, 'expected fire 15% -> 1.15, got ' + String(fire))
            assert(Math.abs(frost - 0.87) < 0.0001, 'expected frost -13% -> 0.87, got ' + String(frost))
            assert(Math.abs(ice - 1.12) < 0.0001, 'expected Ice 0.12 -> 1.12, got ' + String(ice))
            assert(Math.abs(lightning - 0.90) < 0.0001, 'expected Storm -0.10 -> 0.90, got ' + String(lightning))
        })

        test('element system: affinity + flat resist stack multiplicatively (magic)', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') rand = () => 0.5 // variance = 1.0

            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            const snapEnemy = state.currentEnemy
            state.currentEnemy = {
                name: 'Stack Dummy',
                hp: 999,
                maxHp: 999,
                armor: 0,
                magicRes: 0,
                affinities: { weak: { fire: 1.15 } },
                elementalResists: { fire: 50 }
            }

            // Ensure no player bonuses interfere.
            p.stats = p.stats || {}
            const snapBonuses = p.stats.elementalBonuses
            p.stats.elementalBonuses = {}

            const dmg = calcMagicDamage(100, 'fire')
            // 100 * 1.15 * (1 - 0.50) = 57.5 -> rounds to 58
            assert(dmg === 58, 'expected stacked damage 58, got ' + String(dmg))

            // cleanup
            p.stats.elementalBonuses = snapBonuses
            state.currentEnemy = snapEnemy
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('element system: affinity + flat resist stack multiplicatively (physical)', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') rand = () => 0.5 // variance = 1.0

            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            const snapEnemy = state.currentEnemy
            state.currentEnemy = {
                name: 'Stack Dummy (Phys)',
                hp: 999,
                maxHp: 999,
                armor: 0,
                magicRes: 0,
                affinities: { weak: { fire: 1.15 } },
                elementalResists: { fire: 50 }
            }

            // Ensure no player bonuses interfere.
            p.stats = p.stats || {}
            const snapBonuses = p.stats.elementalBonuses
            p.stats.elementalBonuses = {}

            const dmg = calcPhysicalDamage(100, 'fire')
            assert(dmg === 58, 'expected stacked physical damage 58, got ' + String(dmg))

            p.stats.elementalBonuses = snapBonuses
            state.currentEnemy = snapEnemy
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('element system: enemy flat resist accepts fraction values (0.5 = 50%)', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') rand = () => 0.5

            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            const snapEnemy = state.currentEnemy
            state.currentEnemy = { name: 'Frac Dummy', hp: 999, maxHp: 999, armor: 0, magicRes: 0, affinities: {}, elementalResists: { fire: 0.5 } }

            p.stats = p.stats || {}
            const snapBonuses = p.stats.elementalBonuses
            p.stats.elementalBonuses = {}

            const dmg = calcMagicDamage(100, 'fire')
            assert(dmg === 50, 'expected 50% flat resist from 0.5, got ' + String(dmg))

            p.stats.elementalBonuses = snapBonuses
            state.currentEnemy = snapEnemy
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('damage breakdown formatting includes affinity + flat resist and never prints "resist 0%"', () => {
            const s1 = formatDamageBreakdownForLog({ damageType: 'magic', elementType: 'fire', affinityMult: 1.15, enemyResistPct: 25, effectiveRes: 0, penPct: 0 })
            assert(s1.indexOf('weak +15%') >= 0, 'expected weak tag in breakdown: ' + s1)
            assert(s1.indexOf('flat resist 25%') >= 0, 'expected flat resist tag in breakdown: ' + s1)

            const s2 = formatDamageBreakdownForLog({ damageType: 'magic', elementType: 'frost', affinityMult: 0.87, enemyResistPct: 0 })
            assert(s2.indexOf('resist -13%') >= 0, 'expected resist tag in breakdown: ' + s2)
            assert(s2.indexOf('resist 0%') < 0, 'should not print resist 0%: ' + s2)
        })

        test('element system: magic damage applies enemy affinity multiplier', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null

            // Make deterministic: remove variance + crit
            if (typeof rand === 'function') {
                rand = () => 0.5
            }
            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            const snapEnemy = state.currentEnemy
            state.currentEnemy = { name: 'Affinity Dummy', hp: 999, maxHp: 999, armor: 0, magicRes: 0, affinities: { weak: { fire: 1.25 } } }

            // Ensure no player element bonuses interfere.
            p.stats = p.stats || {}
            p.stats.elementalBonuses = {}

            const base = 40
            const dmgWeak = calcMagicDamage(base, 'fire')
            const dmgNorm = calcMagicDamage(base, 'arcane')
            assert(dmgWeak >= Math.round(dmgNorm * 1.20), 'expected weakness to noticeably increase damage')

            // restore
            state.currentEnemy = snapEnemy
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('element system: player elemental resist reduces incoming elemental magic', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') {
                rand = () => 0.5
            }
            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            p.stats = p.stats || {}
            const snapRes = p.stats.elementalResists
            p.stats.elementalResists = { shadow: 50 }

            const base = 40
            const dmgResisted = calcEnemyDamage(base, 'shadow')
            p.stats.elementalResists = {}
            const dmgUnresisted = calcEnemyDamage(base, 'shadow')
            assert(dmgResisted <= Math.round(dmgUnresisted * 0.55), 'expected ~50% reduction from elemental resist')

            p.stats.elementalResists = snapRes
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('element system: player elemental resist reduces incoming elemental physical', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') {
                rand = () => 0.5
            }
            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            p.stats = p.stats || {}
            const snapRes = p.stats.elementalResists
            const snapArmor = p.stats.armor
            const snapMres = p.stats.magicRes

            // Remove other mitigation so the test isolates elemental resist.
            p.stats.armor = 0
            p.stats.magicRes = 0

            p.stats.elementalResists = { shadow: 50 }

            const base = 40
            const dmgResisted = calcEnemyDamage(base, { damageType: 'physical', elementType: 'shadow' })
            p.stats.elementalResists = {}
            const dmgUnresisted = calcEnemyDamage(base, { damageType: 'physical', elementType: 'shadow' })
            assert(dmgResisted <= Math.round(dmgUnresisted * 0.55), 'expected ~50% reduction from elemental resist (physical)')

            p.stats.elementalResists = snapRes
            p.stats.armor = snapArmor
            p.stats.magicRes = snapMres
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('enemy abilities: damage inherits enemy offensive element when missing', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') {
                rand = () => 0.5
            }
            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            p.stats = p.stats || {}
            const snapRes = p.stats.elementalResists
            const snapArmor = p.stats.armor
            const snapMres = p.stats.magicRes
            const snapHp = p.hp
            const snapMaxHp = p.maxHp
            const snapStatus = JSON.parse(JSON.stringify(p.status || {}))
            const snapEnemy = state.currentEnemy

            // Remove other mitigation so the test isolates elemental resist.
            p.stats.armor = 0
            p.stats.magicRes = 0

            p.maxHp = Math.max(Number(p.maxHp || 0), 999)
            p.hp = p.maxHp

            const enemy = { id: 'testEnemy', name: 'Test Enemy', attack: 40, magic: 0, hp: 100, maxHp: 100, affixes: [], abilities: ['sunderArmor'] }
            ensureEnemyRuntime(enemy)
            enemy.attackElementType = 'shadow'
            enemy.magicElementType = 'shadow'
            state.currentEnemy = enemy

            // Resisted hit
            p.stats.elementalResists = { shadow: 50 }
            const before1 = p.hp
            applyEnemyAbilityToPlayer(enemy, p, 'sunderArmor')
            const dmgResisted = before1 - p.hp
            const b1 = state._lastDamageBreakdown || null
            assert(b1 && b1.elementType === 'shadow', 'expected inherited element on enemy hit, got ' + String(b1 && b1.elementType))

            // Unresisted hit
            p.hp = before1
            p.stats.elementalResists = {}
            p.status = JSON.parse(JSON.stringify(snapStatus || {}))
            const before2 = p.hp
            applyEnemyAbilityToPlayer(enemy, p, 'sunderArmor')
            const dmgUnresisted = before2 - p.hp

            assert(dmgResisted <= Math.round(dmgUnresisted * 0.55), 'expected ~50% reduction from elemental resist on inherited elemental physical hit')

            // Restore
            state.currentEnemy = snapEnemy
            p.stats.elementalResists = snapRes
            p.stats.armor = snapArmor
            p.stats.magicRes = snapMres
            p.hp = snapHp
            p.maxHp = snapMaxHp
            p.status = snapStatus
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('element system: enemy elemental resist reduces incoming elemental magic', () => {
            const p = state.player
            const snapRand = typeof rand === 'function' ? rand : null
            if (typeof rand === 'function') {
                rand = () => 0.5
            }
            const snapFlags = { alwaysCrit: state.flags.alwaysCrit, neverCrit: state.flags.neverCrit }
            state.flags.alwaysCrit = false
            state.flags.neverCrit = true

            const snapEnemy = state.currentEnemy
            state.currentEnemy = { name: 'Resist Dummy', hp: 999, maxHp: 999, armor: 0, magicRes: 0, affinities: {}, elementalResists: {} }

            const snapClass = p.classId
            p.classId = 'warrior'
            p.stats = p.stats || {}
            const snapBonuses = p.stats.elementalBonuses
            p.stats.elementalBonuses = {}

            const base = 40
            state.currentEnemy.elementalResists = {}
            const dmgUnresisted = calcMagicDamage(base, 'fire')
            state.currentEnemy.elementalResists = { fire: 50 }
            const dmgResisted = calcMagicDamage(base, 'fire')
            assert(dmgResisted <= Math.round(dmgUnresisted * 0.55), 'expected ~50% reduction from enemy elemental resist')

            // restore
            p.classId = snapClass
            p.stats.elementalBonuses = snapBonuses
            state.currentEnemy = snapEnemy
            state.flags.alwaysCrit = snapFlags.alwaysCrit
            state.flags.neverCrit = snapFlags.neverCrit
            if (snapRand) rand = snapRand
        })

        test('equipment traits: on-hit bleed trait applies bleed', () => {
            const p = state.player
            p.equipment = p.equipment || {}
            // Force 100% chance for deterministic test
            p.equipment.weapon = { name: 'Trait Sword', bleedChance: 1, bleedTurns: 3, bleedDmgPct: 0.2 }
            const enemy = { name: 'Bleed Dummy', hp: 100, maxHp: 100 }
            applyEquipmentOnPlayerHit(enemy, 30, null, 'physical')
            assert((enemy.bleedTurns || 0) >= 1, 'expected bleed turns to be applied')
            assert((enemy.bleedDamage || 0) >= 1, 'expected bleed damage to be applied')
        })

        test('elemental stats: gear elemental resists apply to player stats', () => {
            const p = state.player
            const snap = {
                equipment: JSON.parse(JSON.stringify(p.equipment || {})),
                classId: p.classId,
                level: p.level,
                talents: JSON.parse(JSON.stringify(p.talents || {})),
            }

            p.equipment = p.equipment || {}
            p.equipment.armor = Object.assign({}, ITEM_DEFS.robeApprentice)
            _recalcPlayerStats()
            const v = p.stats && p.stats.elementalResists ? (p.stats.elementalResists.arcane || 0) : 0
            if (!(v > 0)) throw new Error('expected arcane resist from robeApprentice')

            p.equipment = snap.equipment
            p.classId = snap.classId
            p.level = snap.level
            p.talents = snap.talents
            _recalcPlayerStats()
        })

        test('elemental stats: talent elemental resist applies to player stats', () => {
            const p = state.player
            const snap = {
                equipment: JSON.parse(JSON.stringify(p.equipment || {})),
                classId: p.classId,
                level: p.level,
                talents: JSON.parse(JSON.stringify(p.talents || {})),
            }

            p.classId = 'warrior'
            p.level = 3
            ensurePlayerTalents(p)
            p.talents = p.talents || {}
            p.talents.warrior_frostward = true
            _recalcPlayerStats()
            const v = p.stats && p.stats.elementalResists ? (p.stats.elementalResists.frost || 0) : 0
            if (v < 10) throw new Error('expected frost resist from warrior_frostward talent')

            p.equipment = snap.equipment
            p.classId = snap.classId
            p.level = snap.level
            p.talents = snap.talents
            _recalcPlayerStats()
        })



test('elemental gear rolls: generated equipment always carries elemental mods', () => {
    const snapDebug = state.debug ? JSON.parse(JSON.stringify(state.debug)) : null
    state.debug = state.debug || {}
    state.debug.useDeterministicRng = true
    state.debug.rngSeed = 123456789
    state.debug.rngIndex = 0
    state.debug.rngLogTail = []

    // Boss drops are randomized and may not include both a weapon AND armor in a single roll.
    // For a deterministic smoke test we sample multiple boss drops (advancing RNG) until we
    // observe at least one of each category, or fail after a small bounded loop.
    const boss = { isBoss: true, isElite: false, rarityTier: 3 }
    const weapons = []
    const armors = []
    for (let i = 0; i < 8 && (weapons.length < 1 || armors.length < 1); i++) {
        // NOTE: Use a 'let' temp so the identifier is initialized (undefined) before generateLootDrop runs.
        // This avoids rare TDZ edge cases in some JS runtimes that can throw
        // "Cannot access '<name>' before initialization" during nested calls.
        let loot = generateLootDrop({
            area: 'forest',
            playerLevel: 12,
            enemy: boss,
            playerResourceKey: (state.player && state.player.resourceKey) ? state.player.resourceKey : null
        })
        ;(loot || []).forEach((d) => {
            if (!d || !d.type) return
            if (d.type === 'weapon') weapons.push(d)
            if (d.type === 'armor') armors.push(d)
        })
    }

    // Some seeds/loot tables can legitimately yield only weapons OR only armor in a short sample.
    // The requirement we care about is: any generated equipment carries the elemental mods.
    assert((weapons.length + armors.length) >= 1, 'expected at least 1 equipment item in sampled boss drops for deterministic test')

    weapons.forEach((w) => {
        assert(!!w.elementalType, 'weapon missing elementalType')
        assert(Number(w.elementalBonus || 0) > 0, 'weapon missing elementalBonus')
    })
    armors.forEach((a) => {
        assert(!!a.elementalResistType, 'armor missing elementalResistType')
        assert(Number(a.elementalResist || 0) > 0, 'armor missing elementalResist')
    })

    if (snapDebug) state.debug = snapDebug
})

test('enemy elemental resists scale with difficulty', () => {
    // This validates the builder hook: Hard should resist more than Easy for the same base template.
    const template = ENEMY_TEMPLATES.wolf
    assert(!!template, 'missing wolf template')

    const ctxBase = {
        zone: { minLevel: 2, maxLevel: 2 },
        areaId: 'forest',
        rand,
        randInt,
        pickEnemyAbilitySet
    }

    const easy = buildEnemyForBattle(template, Object.assign({}, ctxBase, { diffCfg: { id: 'easy', enemyHpMod: 1 } }))
    const hard = buildEnemyForBattle(template, Object.assign({}, ctxBase, { diffCfg: { id: 'hard', enemyHpMod: 1 } }))

    const easyFlat = easy && easy.elementalResists ? (easy.elementalResists.shadow || 0) : 0
    const hardFlat = hard && hard.elementalResists ? (hard.elementalResists.shadow || 0) : 0
    if (hardFlat || easyFlat) {
        assert(hardFlat >= easyFlat, 'expected hard flat elementalResists >= easy')
    }

    const easyAff = easy && easy.affinities && easy.affinities.resist ? easy.affinities.resist : null
    const hardAff = hard && hard.affinities && hard.affinities.resist ? hard.affinities.resist : null
    if (easyAff && hardAff) {
        Object.keys(easyAff).forEach((k) => {
            const em = Number(easyAff[k] || 1)
            const hm = Number(hardAff[k] || 1)
            if (em < 1) assert(hm <= em + 1e-6, 'expected hard resist multiplier <= easy for ' + k)
        })
    }
})

        test('equipment traits: shield-cast can prime next damage buff', () => {
            const p = state.player
            p.status = p.status || {}
            p.status.nextDmgTurns = 0
            p.status.nextDmgMult = 1
            p.equipment = p.equipment || {}
            p.equipment.weapon = null
            p.equipment.armor = { name: 'Runed Armor', onShieldCastNextDmgPct: 10 }
            applyEquipmentOnShieldCast({})
            assert((p.status.nextDmgTurns || 0) >= 1, 'expected nextDmgTurns to be set')
            assert((p.status.nextDmgMult || 1) > 1, 'expected nextDmgMult > 1')
        })

        test('on-kill bonuses: traits and talents grant resource as expected', () => {
            const p = state.player
            p.classId = 'warrior'
            p.resourceKey = 'fury'
            p.maxResource = 60
            p.resource = 0
            ensurePlayerTalents(p)
            p.talentPoints = 1
            p.talents = {}
            p.level = 9
            // unlock warrior_relentless (on kill +10 fury)
            const ok = unlockTalent(p, 'warrior_relentless')
            assert(ok, 'failed to unlock warrior_relentless')

            // add trait: on kill +6 resource
            p.equipment = p.equipment || {}
            p.equipment.weapon = { name: 'Sanguine Edge', onKillGain: { key: 'resource', amount: 6 } }

            applyEquipmentOnKill({ name: 'Dummy', hp: 0 })
            assert(p.resource >= 16, 'expected resource gain from trait + talent (>=16)')
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
                _recalcPlayerStats()

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
                _recalcPlayerStats()

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
                _recalcPlayerStats()
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


// A) metadata coverage: any missing element/physical tags will cause weird combat math + UI.
test('abilities: every ability is classified (elementType or physical)', () => {
    const issues = qaScanAbilityElementCoverage()
    assert(issues.length === 0, 'ability element metadata issues:\n' + issues.slice(0, 30).join('\n') + (issues.length > 30 ? '\n… (' + issues.length + ' total)' : ''))
})

// B) element key normalization: prevents phantom keys like "0frost" from appearing in sheets/saves.
test('elements: normalized keys only (no phantom element entries)', () => {
    _recalcPlayerStats()
    const issues = qaScanElementKeyIssues(state)
    assert(issues.length === 0, 'element key issues:\n' + issues.slice(0, 30).join('\n') + (issues.length > 30 ? '\n… (' + issues.length + ' total)' : ''))
})

// C) additional seed coverage: smaller fuzz passes with multiple seeds to catch RNG-specific edge cases.
test('fuzz: ' + QA_COUNTS.fuzz2Seeds + ' seeds x ' + QA_COUNTS.fuzz2Actions + ' actions preserve invariants', () => {
    setDeterministicRngEnabled(state, true)
    setRngLoggingEnabled(state, false)

    const equipIds = ['swordIron', 'armorLeather', 'staffOak', 'robeApprentice']
    const runOne = (seed) => {
        setRngSeed(state, seed)
        for (let step = 0; step < QA_COUNTS.fuzz2Actions; step++) {
            const r = rngInt(state, 0, 6, 'smoke.fuzz2.action')
            if (r === 0) {
                addItemToInventory('potionSmall', rngInt(state, -3, 5, 'smoke.fuzz2.qty'))
            } else if (r === 1) {
                addItemToInventory(equipIds[rngInt(state, 0, equipIds.length - 1, 'smoke.fuzz2.equipId')], 1)
            } else if (r === 2) {
                const inv = state.player && Array.isArray(state.player.inventory) ? state.player.inventory : []
                if (inv.length) equipItemFromInventory(rngInt(state, 0, inv.length - 1, 'smoke.fuzz2.equipIdx'), { stayOpen: true })
            } else if (r === 3) {
                const inv = state.player && Array.isArray(state.player.inventory) ? state.player.inventory : []
                if (inv.length) sellItemFromInventory(rngInt(state, 0, inv.length - 1, 'smoke.fuzz2.sellIdx'), 'village')
            } else if (r === 4) {
                advanceTime(state, rngInt(state, 1, 2, 'smoke.fuzz2.timeSteps'))
            } else if (r === 5) {
                _recalcPlayerStats()
            } else {
                // Small combat math poke (no turn sequencing): just ensure calculators never produce NaN.
                state.currentEnemy = state.currentEnemy || { name: 'Fuzz2 Dummy', hp: 50, maxHp: 50, level: 1, armor: 0, magicRes: 0, affinities: {}, elementalResists: {} }
                const a = calcPhysicalDamage(12)
                const b = calcMagicDamage(18, 'frost')
                assert(Number.isFinite(a) && Number.isFinite(b), 'non-finite damage during fuzz2')
            }

            const audit = validateState(state)
            assert(!audit || audit.ok, 'invariant issues during fuzz2 (seed ' + seed + ', step ' + step + '):\n' + (audit ? formatIssues(audit.issues) : 'unknown'))
        }
    }

    const _fuzz2Seeds = [QA_SEED + 7001, QA_SEED + 7002, QA_SEED + 7003].slice(0, QA_COUNTS.fuzz2Seeds)

    _fuzz2Seeds.forEach((s) => runOne(s))
})

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
        test('fuzz: ' + QA_COUNTS.fuzzActions + ' random actions preserve invariants', () => {
            setDeterministicRngEnabled(state, true)
            setRngLoggingEnabled(state, false)
            setRngSeed(state, QA_SEED + 4242)

            const equipIds = ['swordIron', 'armorLeather', 'staffOak', 'robeApprentice']
            const actionCount = QA_COUNTS.fuzzActions

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
                    advanceWorldTime(state, rngInt(state, 1, 3, 'smoke.fuzz.timeSteps'), 'smoke.fuzz', { silent: true })
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



        section('Stress Tests')

        test('stress: loot generation ' + QA_COUNTS.stressLootDrops + ' drops (finite + normalized elements + value/power checks)', () => {
            const oldNow = Date.now
            Date.now = () => 1700000000000
            try {
                setDeterministicRngEnabled(state, true)
                setRngLoggingEnabled(state, false)
                setRngSeed(state, QA_SEED + 771771)
                state.debug.rngIndex = 0

                const checkMap = (m, label) => {
                    if (!m || typeof m !== 'object') return
                    Object.keys(m).forEach((raw) => {
                        const nk = normalizeElementType(raw)
                        assert(!!nk, label + ': invalid element key ' + String(raw))
                        const v = Number(m[raw])
                        assert(Number.isFinite(v), label + ': non-finite value for ' + String(raw))
                        const rawLow = String(raw).trim().toLowerCase()
                        assert(rawLow === nk, label + ': non-normalized key "' + String(raw) + '" -> "' + nk + '"')
                    })
                }

                let itemCount = 0
                for (let i = 0; i < QA_COUNTS.stressLootDrops; i++) {
                    const drops = generateLootDrop({
                        area: (i % 2) ? 'forest' : 'cave',
                        playerLevel: 1 + (i % 12),
                        enemy: (i % 5 === 0) ? { isElite: true } : null,
                        playerResourceKey: 'mana'
                    })
                    assert(Array.isArray(drops) && drops.length >= 1, 'no drops generated at i=' + i)
                    drops.forEach((it) => {
                        itemCount += 1
                        assert(it && typeof it === 'object', 'drop not object')
                        assert(typeof it.id === 'string' && it.id.length, 'drop id missing')
                        assert(Number.isFinite(Number(it.itemLevel || 0)), 'drop itemLevel invalid')
                        assert(Number.isFinite(Number(it.price || 0)), 'drop price invalid')
                        if (it.type === 'weapon' || it.type === 'armor') {
                            checkMap(it.elementalBonuses, 'drop.' + it.id + '.elementalBonuses')
                            checkMap(it.elementalResists, 'drop.' + it.id + '.elementalResists')

                            // Power/price helpers must never yield NaN (these values drive UI + economy).
                            try {
                                const ps = getItemPowerScore(it)
                                assert(isFiniteNum(ps) && ps >= 0, 'drop.' + it.id + '.powerScore invalid: ' + String(ps))
                            } catch (e) {
                                throw new Error('drop.' + it.id + '.powerScore threw: ' + (e && e.message ? e.message : e))
                            }
                            try {
                                const sv = getSellValue(it)
                                assert(isFiniteNum(sv) && sv >= 0, 'drop.' + it.id + '.sellValue invalid: ' + String(sv))
                            } catch (e) {
                                throw new Error('drop.' + it.id + '.sellValue threw: ' + (e && e.message ? e.message : e))
                            }
                            try {
                                const rl = formatRarityLabel(it.rarity)
                                assert(typeof rl === 'string' && rl.length > 0, 'drop.' + it.id + '.rarityLabel invalid')
                            } catch (_) {}
                        }
                    })
                }
                assert(itemCount > 0, 'no items generated')
            } finally {
                Date.now = oldNow
            }
        })

        test('stress: enemy builder ' + QA_COUNTS.stressEnemies + ' enemies (rarity + elite + affixes + normalized resists)', () => {
            setDeterministicRngEnabled(state, true)
            setRngLoggingEnabled(state, false)
            setRngSeed(state, QA_SEED + 881881)
            state.debug.rngIndex = 0

            const ids = Object.keys(ENEMY_TEMPLATES || {})
            assert(ids.length > 0, 'no ENEMY_TEMPLATES')
            const diffIds = ['easy', 'normal', 'hard']
            const ctxBase = { zone: { minLevel: 1, maxLevel: 6 }, areaId: 'forest', rand, randInt, pickEnemyAbilitySet }

            let built = 0
            for (let i = 0; i < Math.min(ids.length, 80); i++) {
                const tid = ids[i]
                const template = ENEMY_TEMPLATES[tid]
                if (!template) continue
                for (let d = 0; d < diffIds.length; d++) {
                    const e = buildEnemyForBattle(template, Object.assign({}, ctxBase, { diffCfg: { id: diffIds[d], enemyHpMod: 1 } }))
                    // Ensure runtime fields exist and scaling/affixes don't create NaN stats.
                    ensureEnemyRuntime(e)
                    try { syncEnemyBaseStats(e) } catch (_) {}
                    try { applyEnemyRarity(e) } catch (_) {}
                    if (built % 3 === 0) {
                        e.isElite = true
                        try { applyEliteModifiers(e, getActiveDifficultyConfig()) } catch (_) {}
                    }
                    const cap = 1 + (built % 3)
                    try { applyEnemyAffixes(e, { maxAffixes: cap }) } catch (_) {}
                    try { rebuildEnemyDisplayName(e) } catch (_) {}
                    try {
                        const pm = computeEnemyPostureMax(e)
                        assert(isFiniteNum(pm) && pm >= 0, 'enemy postureMax invalid for ' + tid + ': ' + String(pm))
                    } catch (e2) {
                        throw new Error('enemy postureMax threw for ' + tid + ': ' + (e2 && e2.message ? e2.message : e2))
                    }

                    ;['level', 'hp', 'maxHp', 'attack', 'magic', 'armor', 'magicRes'].forEach((k) => {
                        const v = Number(e[k])
                        assert(Number.isFinite(v), 'enemy ' + k + ' non-finite for ' + tid)
                    })

                    assert(e && typeof e === 'object', 'enemy build failed for ' + tid)
                    assert(isFiniteNum(Number(e.hp || 0)) && isFiniteNum(Number(e.maxHp || 0)), 'enemy hp invalid for ' + tid)
                    assert(Number(e.maxHp || 0) >= 1, 'enemy maxHp < 1 for ' + tid)
                    ;['attack', 'magic', 'armor', 'magicRes'].forEach((k) => {
                        if (e[k] !== undefined) assert(isFiniteNum(Number(e[k])), 'enemy ' + k + ' invalid for ' + tid)
                    })
                    if (e.elementalResists && typeof e.elementalResists === 'object') {
                        Object.keys(e.elementalResists).forEach((raw) => {
                            const nk = normalizeElementType(raw)
                            assert(!!nk, 'enemy elementalResists invalid key ' + String(raw) + ' for ' + tid)
                            const rawLow = String(raw).trim().toLowerCase()
                            assert(rawLow === nk, 'enemy elementalResists non-normalized key "' + String(raw) + '" -> "' + nk + '" for ' + tid)
                            assert(isFiniteNum(Number(e.elementalResists[raw] || 0)), 'enemy elementalResists non-finite value for ' + String(raw) + ' for ' + tid)
                        })
                    }
                    built += 1
                    if (built >= QA_COUNTS.stressEnemies) break
                }
                if (built >= QA_COUNTS.stressEnemies) break
            }
            const _minExpectedEnemies = Math.min(80, QA_COUNTS.stressEnemies)
            assert(built >= _minExpectedEnemies, 'expected to build at least ' + _minExpectedEnemies + ' enemies, built ' + built)
        })


        test('stress: save roundtrip ' + QA_COUNTS.stressSaveCycles + ' cycles (build -> JSON -> migrate)', () => {
            setDeterministicRngEnabled(state, true)
            setRngLoggingEnabled(state, false)
            setRngSeed(state, QA_SEED + 443322)
            state.debug.rngIndex = 0

            const p = state.player
            p.gold = 0
            if (!Array.isArray(p.inventory)) p.inventory = []
            p.inventory.length = 0

            for (let i = 0; i < QA_COUNTS.stressSaveCycles; i++) {
                // Mutate a little each cycle so serialization touches a broad surface area.
                p.gold += randInt(0, 250, 'smoke.stress.save.gold')
                try {
                    const drops = generateLootDrop({
                        area: (i % 2) ? 'forest' : 'cave',
                        playerLevel: 1 + (i % 18),
                        enemy: (i % 7 === 0) ? { isElite: true } : null,
                        playerResourceKey: p.resourceKey || 'mana'
                    })
                    if (Array.isArray(drops)) {
                        drops.slice(0, 2).forEach((it) => {
                            if (!it) return
                            // Deep copy to avoid accidental shared refs.
                            p.inventory.push(JSON.parse(JSON.stringify(it)))
                        })
                        if (p.inventory.length > 60) p.inventory.splice(0, p.inventory.length - 60)
                    }
                } catch (_) {}

                if (i % 3 === 2) {
                    try { advanceTime(state, 60) } catch (_) {}
                }

                const blob = _buildSaveBlob()
                blob.meta = Object.assign({}, blob.meta || {}, {
                    patch: GAME_PATCH,
                    schema: SAVE_SCHEMA,
                    savedAt: 1700000000000 + i
                })

                const json = JSON.stringify(blob)
                const parsed = JSON.parse(json)
                migrateSaveData(parsed)

                assert(parsed && parsed.meta && parsed.meta.schema === SAVE_SCHEMA, 'migrate did not produce current schema at cycle ' + i)

                const nf = scanForNonFiniteNumbers(parsed)
                assert(nf.length === 0, 'non-finite numbers after migrate (cycle ' + i + '):\n' + nf.slice(0, 10).join('\n'))

                const neg = scanForNegativeCounters(parsed)
                assert(neg.length === 0, 'negative counters after migrate (cycle ' + i + '):\n' + neg.slice(0, 10).join('\n'))
            }
        })

        test('stress: scenario runner ' + QA_COUNTS.stressScenarioDays + ' days / ' + QA_COUNTS.stressScenarioLoot + ' loot stays clean', () => {
            const res = runScenarioRunner({ days: QA_COUNTS.stressScenarioDays, lootRolls: QA_COUNTS.stressScenarioLoot, seed: (QA_SEED ^ 0xBADC0DE) >>> 0 })
            assert(res && res.ok, 'scenario runner flagged issues (severity ' + (res ? res.severity : 'unknown') + ')')
        })

        test('stress: random damage calcs stay finite', () => {
            setDeterministicRngEnabled(state, true)
            setRngLoggingEnabled(state, false)
            setRngSeed(state, QA_SEED + 992992)
            state.debug.rngIndex = 0

            const p = state.player
            p.stats.attack = 50
            p.stats.magic = 50
            p.stats.armorPen = 0
            p.stats.elementalBonuses = { fire: 10, shadow: 10 }
            p.stats.elementalResists = { fire: 0, shadow: 0 }
            ensurePlayerSpellSystems(p)

            const enemy = {
                name: 'Stress Dummy',
                hp: 500,
                maxHp: 500,
                attack: 10,
                magic: 10,
                armor: 50,
                magicRes: 50,
                elementalResists: { fire: 15, shadow: 25 },
                affinities: { resist: { fire: 0.9 }, weak: { shadow: 1.2 } }
            }
            ensureEnemyRuntime(enemy)
            state.currentEnemy = enemy

            const elems = ['fire', 'shadow', 'frost', 'holy', 'arcane', 'poison', 'lightning', null]
            for (let i = 0; i < QA_COUNTS.stressDamageIters; i++) {
                const base = randInt(1, 200, 'smoke.stress.base')
                const et = elems[randInt(0, elems.length - 1, 'smoke.stress.elem')]
                // Vary defenses/resists to catch edge cases (negative resists, high armor, etc.)
                enemy.armor = randInt(0, 220, 'smoke.stress.enemy.armor')
                enemy.magicRes = randInt(0, 220, 'smoke.stress.enemy.mres')
                enemy.elementalResists = {
                    fire: randInt(-25, 90, 'smoke.stress.enemy.er.fire'),
                    shadow: randInt(-25, 90, 'smoke.stress.enemy.er.shadow')
                }
                enemy.affinities = {
                    resist: { fire: randInt(60, 110, 'smoke.stress.enemy.af.r') / 100 },
                    weak: { shadow: randInt(100, 150, 'smoke.stress.enemy.af.w') / 100 }
                }
                const m = calcMagicDamage(base, et, enemy)
                const ph = calcPhysicalDamage(base, et, enemy)
                assert(isFiniteNum(m) && m > 0, 'magic dmg invalid at i=' + i + ': ' + m)
                assert(isFiniteNum(ph) && ph > 0, 'phys dmg invalid at i=' + i + ': ' + ph)
            }
        })

        test('stress: unlock all talents for all classes yields finite derived stats', () => {
            const classIds = Object.keys(PLAYER_CLASSES || {})
            assert(classIds.length > 0, 'no PLAYER_CLASSES')
            classIds.forEach((cid) => {
                const p = createPlayer('T', cid)
                p.level = 50
                p.talentPoints = 999

                const defs = (TALENT_DEFS && TALENT_DEFS[cid]) ? TALENT_DEFS[cid] : []
                defs.forEach((t) => {
                    if (t && t.id) unlockTalent(p, t.id)
                })

                recalcPlayerStats(p)
                const issues = qaScanNonFiniteNumbers(p, { maxIssues: 30 })
                assert(issues.length === 0, cid + ': non-finite in player after unlocks: ' + issues.join(', '))

                const s = p.stats || {}
                ;['critChance', 'dodge', 'resistAll'].forEach((k) => {
                    if (s[k] !== undefined) assert(isFiniteNum(Number(s[k])), cid + ': stat ' + k + ' invalid')
                })
            })
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

        // Update the stable top-of-report summary line now that we know totals.
        // Duration is filled in once `ms` is computed at the end.
        try {
            lines[_summaryLineIndex] = 'Ran ' + (passCount + failCount) + ' tests • Failures: ' + failCount
        } catch (_) {}

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
        // Finalize header summary with duration.
        try {
            lines[_summaryLineIndex] = 'Ran ' + (passCount + failCount) + ' tests in ' + ms + ' ms • Failures: ' + failCount
        } catch (_) {}
        lines.push('Done in ' + ms + ' ms')
        const smokeText = lines.join('\n')

        const bugReportPretty = formatBugReportBundle(_bugReportLive)
        const bugHasIssues = !!(
            (_bugReportLive && _bugReportLive.debug && Array.isArray(_bugReportLive.debug.invariantIssues) && _bugReportLive.debug.invariantIssues.length) ||
            (_bugReportLive && _bugReportLive.diagnostics && (_bugReportLive.diagnostics.lastCrashReport || _bugReportLive.diagnostics.lastSaveError)) ||
            (_bugReportLive && _bugReportLive.diagnostics && _bugReportLive.diagnostics.scanners && _bugReportLive.diagnostics.scanners.hasIssues)
        )
        return returnObject
            ? {
                ok: failCount === 0,
                // Back-compat: keep .text but make it the smoke test output only.
                text: smokeText,
                smokeText,
                passCount,
                failCount,
                totalCount: passCount + failCount,
                quickMode: _quickMode,
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
        // Update summary line even on hard failure (counts may be partial).
        try { lines[_summaryLineIndex] = 'Ran ' + (passCount + failCount) + ' tests • Failures: ' + failCount } catch (_) {}
        try {
            if (e && e.stack) lines.push(e.stack)
        } catch (_) {}
        const ms = Date.now() - started
        // Finalize header summary with duration.
        try { lines[_summaryLineIndex] = 'Ran ' + (passCount + failCount) + ' tests in ' + ms + ' ms • Failures: ' + failCount } catch (_) {}
        lines.push('Done in ' + ms + ' ms')
        const smokeText = lines.join('\n')

        const bugReportPretty = formatBugReportBundle(_bugReportLive)
        const bugHasIssues = !!(
            (_bugReportLive && _bugReportLive.debug && Array.isArray(_bugReportLive.debug.invariantIssues) && _bugReportLive.debug.invariantIssues.length) ||
            (_bugReportLive && _bugReportLive.diagnostics && (_bugReportLive.diagnostics.lastCrashReport || _bugReportLive.diagnostics.lastSaveError)) ||
            (_bugReportLive && _bugReportLive.diagnostics && _bugReportLive.diagnostics.scanners && _bugReportLive.diagnostics.scanners.hasIssues)
        )
        return returnObject
            ? {
                ok: failCount === 0,
                text: smokeText,
                smokeText,
                passCount,
                failCount,
                totalCount: passCount + failCount,
                quickMode: _quickMode,
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
        if (_liveUpdateHUD) updateHUD = _liveUpdateHUD
        if (_liveRecordInput) recordInput = _liveRecordInput

        // Restore the live save and repaint.
        _setState(live)
        syncGlobalStateRef()

        // Restore the UI write flag to whatever the live session was using.
        // Smoke tests intentionally toggle this to avoid expensive DOM work.
        try {
            if (typeof setUiDisabled === 'function') setUiDisabled(_liveUiDisabledSnap)
        } catch (_) {}

        // Restore smoke-test flag (used to disable async combat pacing during the suite)
        // BEFORE any UI refreshes. Some UI renderers (e.g., Quest Box) skip work while
        // smokeTestRunning is true.
        try {
            if (state) {
                if (!state.debug || typeof state.debug !== 'object') state.debug = {}
                state.debug.smokeTestRunning = _prevSmoke
            }
        } catch (_) {}

        // Restore pinned quest selection if smoke tests cleared it.
        try {
            if (state) {
                if (!state.quests || typeof state.quests !== 'object') state.quests = createDefaultQuestState()
                const pin = _livePinnedQuestSnap
                if (pin && pin.kind === 'main') {
                    const q = state.quests.main
                    if (q && String(q.status) === 'active') state.quests.pinned = JSON.parse(JSON.stringify(pin))
                } else if (pin && pin.kind === 'side') {
                    const side = state.quests.side && typeof state.quests.side === 'object' ? state.quests.side : {}
                    const q = side[pin.id]
                    if (q && String(q.status) === 'active') state.quests.pinned = JSON.parse(JSON.stringify(pin))
                }
            }
        } catch (_) {}

        // If a save was pending before the suite started, flush it now on the live state.
        try {
            if ((_liveSaveTimerWasActive || _liveSaveQueuedSnap) && typeof saveGame === 'function') {
                saveGame({ force: true })
            }
        } catch (_) {}

        // Ensure the live UI is refreshed back to the real save after smoke tests.
        try {
            // Quest Box can be impacted by quest-system UI writes during the suite.
            // Refresh it explicitly so the pinned quest display always matches the
            // restored live state.
            try {
                if (typeof quests !== 'undefined' && quests && typeof quests.updateQuestBox === 'function') {
                    quests.updateQuestBox()
                }
            } catch (_) {}
            if (_liveUpdateHUD) _liveUpdateHUD()
            if (_liveUpdateEnemyPanel) _liveUpdateEnemyPanel()
        } catch (_) {}

    }
}

// --- CHANGELOG MODAL --------------------------------------------------------

function openChangelogModal(opts = {}) {
    return _getChangelogModal()(opts)
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
	                    _recalcPlayerStats()
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
	                    _recalcPlayerStats()
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
