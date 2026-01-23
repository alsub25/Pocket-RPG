/* =============================================================================
 * Save Manager (saveManager.js)
 * Patch: 1.2.70 — The Blackbark Oath — Hardening & Bug Squash
 *
 * This module owns:
 * - Save data migrations (schema-based)
 * - Auto-save coalescing
 * - Load/save to the legacy localStorage keys
 * - Manual save slots (index + CRUD)
 *
 * IMPORTANT
 * We keep this module dependency-injected to avoid circular imports with engine.js.
 * Engine passes runtime callbacks (UI hooks, integrity audit, state reset, etc.).
 * ============================================================================= */

import { finiteNumber, clampFinite } from '../systems/safety.js'
import { safeStorageGet, safeStorageSet, safeStorageRemove } from '../../engine/storageRuntime.js'
import { _perfNow, perfWrap } from '../../engine/perf.js'
import { scheduleAfter } from '../utils/timing.js'
import { fnv1a32, stableStringify } from '../../engine/snapshots.js'

function safe(fn, fallback = null) {
    try {
        return typeof fn === 'function' ? fn() : fallback
    } catch (_) {
        return fallback
    }
}

// -----------------------------------------------------------------------------
// Engine snapshot validation helpers
// -----------------------------------------------------------------------------
// SaveManager can persist using Engine Core snapshots (engine.save), which wrap
// game state in an envelope that includes a lightweight checksum. Historically
// loadGame() trusted the snapshot and skipped schema migrations; that made older
// snapshots brittle across patches.
//
// We now use the shared checksum helpers from js/engine/snapshots.js to:
// 1) validate the snapshot without mutating engine state, and
// 2) treat snapshot.state as the *legacy* save blob input to migrateSaveData(),
//    ensuring schema migrations always run.

function _validateEngineSnapshot(snapshot) {
    try {
        if (!snapshot || typeof snapshot !== 'object') return { ok: false, reason: 'invalid_snapshot' }
        if (!snapshot.state || typeof snapshot.state !== 'object') return { ok: false, reason: 'missing_state' }
        if (!snapshot.checksum || !snapshot.checksumAlg) return { ok: false, reason: 'missing_checksum' }

        const json = stableStringify({
            version: snapshot.version,
            state: snapshot.state,
            meta: snapshot.meta || {},
            savedAt: snapshot.savedAt || ''
        })
        const expected = fnv1a32(json)
        if (snapshot.checksum !== expected) return { ok: false, reason: 'checksum_mismatch', expected }
        return { ok: true }
    } catch (e) {
        return { ok: false, reason: 'validate_exception', error: (e && e.message) ? e.message : String(e) }
    }
}

/**
 * Factory: creates a save manager bound to the engine runtime.
 */
export function createSaveManager(deps) {
    if (!deps || typeof deps !== 'object') throw new Error('createSaveManager: missing deps')

    const {
        // Keys/schema/version
        SAVE_KEY,
        SAVE_KEY_PREFIX,
        SAVE_INDEX_KEY,
        SAVE_SCHEMA,
        GAME_PATCH,

        // Engine core (optional): engine.save/load + scheduler
        engine,

        // State access
        getState,
        setState,

        // Engine runtime hooks (behavior preserved)
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
        renderLog,
        setScene,
        addLog,
        renderActions,
        switchScreen,
        updateTimeDisplay,
        alertFn,
        showCorruptSaveModal,

        // Integrity / diagnostics
        ensureCombatPointersBeforeSave,
        runIntegrityAudit,
        recordCrash,
        setLastSaveError,

        // Migration helpers owned by engine.js
        ensurePlayerSpellSystems,
        CLASS_LEVEL_UNLOCKS,
        MAX_EQUIPPED_SPELLS
    } = deps

    // -------------------- MIGRATION --------------------
    function _normalizeAnyItemQuantity(it) {
        if (!it || typeof it !== 'object') return

        // Legacy: some early saves used `qty` instead of `quantity`.
        // Prefer explicit `quantity`, but if it's missing/invalid and `qty` exists, migrate.
        try {
            const hasQty = Object.prototype.hasOwnProperty.call(it, 'qty')
            const hasQuantity = Object.prototype.hasOwnProperty.call(it, 'quantity')
            const qv = Number(hasQuantity ? it.quantity : NaN)

            if (hasQty && (!hasQuantity || !Number.isFinite(qv) || qv <= 0)) {
                it.quantity = it.qty
            }
            if (hasQty) delete it.qty

            const q = Math.floor(Number(it.quantity))
            it.quantity = Number.isFinite(q) && q > 0 ? q : 1
        } catch (_) {
            // Fallback: never allow invalid quantities to survive migration.
            it.quantity = 1
            try { if (Object.prototype.hasOwnProperty.call(it, 'qty')) delete it.qty } catch (_) {}
        }
    }

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
                if (!data.villageEconomy || typeof data.villageEconomy !== 'object') data.villageEconomy = null
                if (!data.government || typeof data.government !== 'object') data.government = null
                if (!data.village || typeof data.village !== 'object') data.village = null
                if (!data.bank || typeof data.bank !== 'object') data.bank = null

                // Merchant state
                if (!data.villageMerchantNames || typeof data.villageMerchantNames !== 'object') data.villageMerchantNames = null
                if (!data.merchantStock || typeof data.merchantStock !== 'object') data.merchantStock = null
                if (!data.merchantStockMeta || typeof data.merchantStockMeta !== 'object') data.merchantStockMeta = null

                // Sim meta (daily tick pointer)
                if (!data.sim || typeof data.sim !== 'object') data.sim = { lastDailyTickDay: null }

                data.meta.schema = 2
                continue
            }

            if (data.meta.schema === 2) {
                // v3 (PATCH 1.1.2): introduce quests/flags containers
                data.quests = data.quests && typeof data.quests === 'object' ? data.quests : {}
                data.flags = data.flags && typeof data.flags === 'object' ? data.flags : {}

                // Combat snapshot normalization
                if (typeof data.inCombat !== 'boolean') data.inCombat = false
                if (data.inCombat) {
                    if (Array.isArray(data.enemies) && data.enemies.length) {
                        // ok
                    } else if (data.currentEnemy) {
                        data.enemies = [data.currentEnemy]
                        data.targetEnemyIndex = 0
                    } else {
                        data.inCombat = false
                    }
                }

                data.meta.schema = 3
                continue
            }

            if (data.meta.schema === 3) {
                // v4 (PATCH 1.1.4): ensure companion container exists
                if (!data.companion || typeof data.companion !== 'object') data.companion = null
                data.meta.schema = 4
                continue
            }

            if (data.meta.schema === 4) {
                // v5 (PATCH 1.1.5): normalize inventory quantities, add debug container
                if (!data.debug || typeof data.debug !== 'object') data.debug = null

                // Normalize player inventory quantities (defensive)
                try {
                    const inv = data.player && Array.isArray(data.player.inventory) ? data.player.inventory : null
                    if (inv) {
                        inv.forEach((it) => {
                            _normalizeAnyItemQuantity(it)
                        })
                    }
                } catch (_) {}

                data.meta.schema = 5
                continue
            }

            if (data.meta.schema === 5) {
                // v6 (PATCH 1.1.6): additional inventory safety + status fields
                try {
                    const inv = data.player && Array.isArray(data.player.inventory) ? data.player.inventory : null
                    if (inv) {
                        inv.forEach((it) => {
                            _normalizeAnyItemQuantity(it)
                        })
                    }
                } catch (_) {}

                data.meta.schema = 6
                continue
            }

            if (data.meta.schema === 6) {
                // v7 (PATCH 1.1.7): new class unlock tiers + new combat status fields
                if (!data.flags || typeof data.flags !== 'object') data.flags = {}

                if (data.player && typeof data.player === 'object') {
                    try {
                        ensurePlayerSpellSystems && ensurePlayerSpellSystems(data.player)
                    } catch (_) {}

                    // Grant any newly-added class unlock spells up to the current level.
                    try {
                        const unlocks = (CLASS_LEVEL_UNLOCKS && data.player.classId) ? (CLASS_LEVEL_UNLOCKS[data.player.classId] || []) : []
                        unlocks.forEach((u) => {
                            if (!u || !u.spell) return
                            if (u.level <= (data.player.level || 1) && !data.player.spells.includes(u.spell)) {
                                data.player.spells.push(u.spell)
                                if (
                                    Array.isArray(data.player.equippedSpells) &&
                                    data.player.equippedSpells.length < (MAX_EQUIPPED_SPELLS || 0)
                                ) {
                                    data.player.equippedSpells.push(u.spell)
                                }
                            }
                        })

                        if (!Array.isArray(data.player.equippedSpells)) {
                            data.player.equippedSpells = (data.player.spells || []).slice(0, MAX_EQUIPPED_SPELLS || 0)
                        }
                    } catch (_) {}

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
        } catch (_) {}

        // Legacy safety: ensure no `qty` fields survive migration, even if schema jumps.
        try {
            const inv = data.player && Array.isArray(data.player.inventory) ? data.player.inventory : null
            if (inv) inv.forEach(_normalizeAnyItemQuantity)

            // Merchant stock entries sometimes embed item-like objects.
            const ms = data.merchantStock
            if (ms && typeof ms === 'object') {
                Object.keys(ms).forEach((k) => {
                    const entry = ms[k]
                    if (Array.isArray(entry)) {
                        entry.forEach(_normalizeAnyItemQuantity)
                    } else if (entry && typeof entry === 'object') {
                        if (Array.isArray(entry.items)) entry.items.forEach(_normalizeAnyItemQuantity)
                    }
                })
            }
        } catch (_) {}

        // Patch 1.2.70: save migration hardening.
        try {
            if (!data.flags || typeof data.flags !== 'object') data.flags = {}

            const markDeadHandled = (e) => {
                if (!e || typeof e !== 'object') return
                if (finiteNumber(e.hp, 0) <= 0) e._defeatHandled = true
            }
            if (data.inCombat) {
                if (Array.isArray(data.enemies)) data.enemies.forEach(markDeadHandled)
                markDeadHandled(data.currentEnemy)
            }
        } catch (_) {}

        return data
    }

    // -------------------- SAVE (auto-save coalescing) --------------------
    // Coalesced save handle (Engine scheduler preferred; rAF fallback in tests)
    let _saveTimer = null
    let _saveQueued = false

    function _buildSaveBlob() {
        const state = getState()
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

            // Merchant state
            villageMerchantNames: state.villageMerchantNames || null,
            merchantStock: state.merchantStock || null,
            merchantStockMeta: state.merchantStockMeta || null,

            // Simulation meta
            sim: state.sim || { lastDailyTickDay: null },

            // Log & filter
            log: state.log || [],
            logFilter: state.logFilter || 'all',

            // Combat snapshot (multi-enemy aware)
            inCombat: !!state.inCombat,
            enemies:
                state.inCombat && Array.isArray(state.enemies) && state.enemies.length
                    ? state.enemies
                    : state.inCombat && state.currentEnemy
                        ? [state.currentEnemy]
                        : null,
            targetEnemyIndex:
                state.inCombat && Number.isFinite(state.targetEnemyIndex)
                    ? Math.max(0, Math.floor(state.targetEnemyIndex))
                    : 0,
            currentEnemy:
                state.inCombat && Array.isArray(state.enemies) && state.enemies.length
                    ? (
                        state.enemies[
                            Number.isFinite(state.targetEnemyIndex)
                                ? Math.max(0, Math.floor(state.targetEnemyIndex))
                                : 0
                        ] || state.enemies[0] || null
                    )
                    : state.inCombat && state.currentEnemy
                        ? state.currentEnemy
                        : null
        }
    }

    function _performSave() {
        const state = getState()
        return perfWrap(state || null, 'save:_performSave', null, () => {
            try {
                // Don't save if there's no player or the hero is dead
                if (!state.player || state.player.hp <= 0) {
                    console.warn('Skipped save: no player or player is dead.')
                    return
                }

                // Repair common combat pointer desyncs before audits/saves.
                try {
                    ;(ensureCombatPointersBeforeSave || ensureCombatPointers) && (ensureCombatPointersBeforeSave || ensureCombatPointers)()
                } catch (_) {}

                // Integrity audit: refuse to overwrite the user's save if we detect corruption.
                try {
                    if (typeof runIntegrityAudit === 'function') {
                        const rep = runIntegrityAudit(state, 'before_save')
                        const invIssues = rep && rep.invariant && Array.isArray(rep.invariant.issues) ? rep.invariant.issues : []
                        if (state.debug) state.debug.lastInvariantIssues = invIssues.length ? invIssues : null

                        if (rep && rep.severity === 'critical') {
                            setLastSaveError && setLastSaveError({
                                kind: 'integrity',
                                time: Date.now(),
                                message: 'Save blocked due to critical integrity issues',
                                stage: 'before_save',
                                invariantIssues: invIssues,
                                scannerCounts: rep.scanners && rep.scanners.counts ? rep.scanners.counts : null
                            })

                            try {
                                recordCrash && recordCrash('assertion', new Error('Blocked save: critical integrity issues'), {
                                    stage: 'before_save',
                                    issues: invIssues,
                                    scannerCounts: rep.scanners && rep.scanners.counts ? rep.scanners.counts : null
                                })
                            } catch (_) {}

                            // Throttle the in-game warning so it doesn't spam the log.
                            try {
                                if (!state.debug || typeof state.debug !== 'object') state.debug = {}
                                if (!state.debug._saveIntegrityWarned) {
                                    state.debug._saveIntegrityWarned = true
                                    addLog && addLog('⚠️ Save blocked due to integrity issues. Use Feedback → Bug Report.', 'danger')
                                }
                            } catch (_) {}

                            return
                        }
                    }
                } catch (_) {}

                
let json = null

// Patch 1.2.72: Prefer Engine Core snapshots (engine.save/load) for persistence.
// Fallback to legacy blob builder if engine is unavailable (headless tests).
try {
    if (engine && typeof engine.save === 'function') {
        const snap = engine.save({
            kind: 'auto',
            patch: GAME_PATCH,
            schema: SAVE_SCHEMA,
            savedAt: Date.now()
        })
        json = JSON.stringify(snap)
    }
} catch (e) {
    try {
        recordCrash && recordCrash({
            kind: 'save',
            time: Date.now(),
            message: 'Engine snapshot save failed',
            error: e && e.message ? String(e.message) : String(e)
        })
    } catch (_) {}
}

if (!json) {
    const toSave = _buildSaveBlob()

    // Stamp patch + schema + time into the legacy save data
    toSave.meta = Object.assign({}, toSave.meta || {}, {
        patch: GAME_PATCH,
        schema: SAVE_SCHEMA,
        savedAt: Date.now()
    })

    json = JSON.stringify(toSave)
}

// De-dupe identical saves to reduce churn
const ok = safeStorageSet(SAVE_KEY, json, { action: 'save game' })
                state.lastSaveJson = json

                if (!ok) {
                    setLastSaveError && setLastSaveError({
                        kind: 'storage',
                        time: Date.now(),
                        message: 'safeStorageSet returned false while saving game',
                        action: 'save game'
                    })
                }
            } catch (e) {
                console.error('Failed to save game:', e)
                setLastSaveError && setLastSaveError({
                    kind: 'exception',
                    time: Date.now(),
                    message: String(e && e.message ? e.message : e),
                    stack: e && e.stack ? String(e.stack) : null,
                    action: 'save game'
                })
            }
        })
    }

    function saveGame(opts = {}) {
        const force = !!(opts && opts.force)

        if (force) {
            if (_saveTimer && typeof _saveTimer.cancel === 'function') {
                try { _saveTimer.cancel() } catch (_) {}
                _saveTimer = null
            }
            _saveQueued = false
            _performSave()
            return
        }

	if (!_saveTimer) {
	    _performSave()
	    _saveTimer = scheduleAfter(engine, 350, () => {
	        _saveTimer = null
	        if (_saveQueued) {
	            _saveQueued = false
	            _performSave()
	        }
	    }, { owner: 'system:autosave' })
	} else {
            _saveQueued = true
        }
    }

    // -------------------- LOAD --------------------
    function loadGame(fromDefeat) {
        try {
            const json = safeStorageGet(SAVE_KEY)
            if (!json) {
                if (!fromDefeat) (alertFn || alert)('No save found on this device.')
                return false
            }

            
let parsed = JSON.parse(json)

// Patch 1.2.72+: Engine Core snapshot path (preferred).
// IMPORTANT: snapshot.state must still be migrated by SAVE_SCHEMA.
// Earlier builds skipped schema migrations on snapshot loads, which could
// break older saves as the state structure evolves.
try {
    const isSnapshot = parsed && typeof parsed === 'object' && parsed.state && parsed.checksum && parsed.checksumAlg
    if (isSnapshot) {
        const v = _validateEngineSnapshot(parsed)
        if (!v.ok) {
            // Treat as corrupt save (checksum mismatch / malformed envelope).
            try {
                if (!fromDefeat) showCorruptSaveModal && showCorruptSaveModal('Save data failed integrity validation and cannot be loaded.')
            } catch (_) {}
            return false
        }

        const snapState = (parsed.state && typeof parsed.state === 'object') ? parsed.state : null
        const snapMeta = (parsed.meta && typeof parsed.meta === 'object') ? parsed.meta : {}

        // Treat snapshot.state as the legacy blob input to migrations.
        parsed = Object.assign({}, snapState)
        parsed.meta = Object.assign({}, parsed.meta || {}, snapMeta || {})

        // If the snapshot envelope is missing schema/patch (shouldn't happen),
        // force reasonable defaults so migrateSaveData can run.
        if (!parsed.meta || typeof parsed.meta !== 'object') parsed.meta = {}
        if (!Number.isFinite(Number(parsed.meta.schema))) parsed.meta.schema = SAVE_SCHEMA
        if (!parsed.meta.patch) parsed.meta.patch = GAME_PATCH
    }
} catch (_) {}

let data = migrateSaveData(parsed)

            if (data && data.__corrupt) {
                if (!fromDefeat) showCorruptSaveModal && showCorruptSaveModal('Save data failed validation and cannot be loaded.')
                return false
            }
            if (!data || !data.player) {
                if (!fromDefeat) showCorruptSaveModal && showCorruptSaveModal('Save is missing essential player data.')
                return false
            }

            setState(createEmptyState())
            syncGlobalStateRef && syncGlobalStateRef()
            const state = getState()

            // Restore persisted debug settings (RNG seed, input breadcrumbs, etc.)
            try {
                if (data.debug && typeof data.debug === 'object') {
                    state.debug = Object.assign({}, state.debug || {}, data.debug)
                }
                initRngState && initRngState(state)
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
            quests && quests.ensureQuestStructures && quests.ensureQuestStructures()
            state.companion = data.companion || null
            state.village = data.village || null
            state.bank = data.bank || null
            state.time = data.time || null
            state.villageEconomy = data.villageEconomy || null
            state.government = data.government || null

            const LOAD_REPAIR_STEPS = [
                { id: 'time', run: () => initTimeState && initTimeState(state) },
                { id: 'economy', run: () => initVillageEconomyState && initVillageEconomyState(state) },
                {
                    id: 'government',
                    run: () => {
                        const ti = getTimeInfo ? getTimeInfo(state) : { absoluteDay: 0 }
                        initGovernmentState && initGovernmentState(state, ti.absoluteDay)
                    }
                },
                { id: 'population', run: () => ensureVillagePopulation && ensureVillagePopulation(state) }
            ]

            for (const step of LOAD_REPAIR_STEPS) {
                try {
                    step.run()
                } catch (_) {}
            }

            const timeInfo = safe(() => (getTimeInfo ? getTimeInfo(state) : null), { absoluteDay: 0 })
            try {
                cleanupTownHallEffects && cleanupTownHallEffects(state, timeInfo.absoluteDay)
            } catch (_) {}

            // Combat restore
            state.inCombat = !!data.inCombat
            state.enemies = Array.isArray(data.enemies) && data.enemies.length ? data.enemies : null
            state.targetEnemyIndex =
                typeof data.targetEnemyIndex === 'number' && Number.isFinite(data.targetEnemyIndex)
                    ? Math.max(0, Math.floor(data.targetEnemyIndex))
                    : 0
            state.currentEnemy = data.currentEnemy || null

            if (state.inCombat) {
                if (state.enemies && state.enemies.length) {
                    for (let i = 0; i < state.enemies.length; i++) {
                        const e = state.enemies[i]
                        if (e && typeof e === 'object') ensureEnemyRuntime && ensureEnemyRuntime(e)
                    }

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
                    ensureEnemyRuntime && ensureEnemyRuntime(state.currentEnemy)
                    state.enemies = [state.currentEnemy]
                    state.targetEnemyIndex = 0
                    state.inCombat = !!(state.currentEnemy && typeof state.currentEnemy.hp === 'number' ? state.currentEnemy.hp > 0 : state.currentEnemy)
                } else {
                    state.inCombat = false
                }

                try { ensureCombatTurnState && ensureCombatTurnState() } catch (_) {}
                try { ensureCombatPointers && ensureCombatPointers() } catch (_) {}
            } else {
                state.currentEnemy = null
                state.enemies = null
                state.targetEnemyIndex = 0
            }

            // Merchant restore
            state.villageMerchantNames = data.villageMerchantNames || null
            state.merchantStock = data.merchantStock || null
            state.merchantStockMeta = data.merchantStockMeta || null

            // Simulation meta
            state.sim = data.sim && typeof data.sim === 'object' ? data.sim : { lastDailyTickDay: null }
            if (typeof state.sim.lastDailyTickDay !== 'number') {
                const d = state.time && typeof state.time.dayIndex === 'number' && Number.isFinite(state.time.dayIndex)
                    ? Math.max(0, Math.floor(state.time.dayIndex))
                    : 0
                state.sim.lastDailyTickDay = d
            }

            // Log restore
            state.log = Array.isArray(data.log) ? data.log : []
            state.logFilter = data.logFilter || 'all'

            state.lastSaveJson = json

            // Recalc + UI refresh
            recalcPlayerStats && recalcPlayerStats()
            rescaleActiveCompanion && rescaleActiveCompanion({ noHeal: true })

            // Patch older saves missing enemy runtime fields
            if (state.inCombat) {
                if (Array.isArray(state.enemies) && state.enemies.length) {
                    for (let i = 0; i < state.enemies.length; i++) {
                        const e = state.enemies[i]
                        if (e && typeof e === 'object') ensureEnemyRuntime && ensureEnemyRuntime(e)
                    }
                } else if (state.currentEnemy) {
                    ensureEnemyRuntime && ensureEnemyRuntime(state.currentEnemy)
                }
            }

            // Post-load integrity audit (non-fatal, but recorded for bug reports).
            try {
                if (typeof runIntegrityAudit === 'function') {
                    const rep = runIntegrityAudit(state, 'after_load')
                    const invIssues = rep && rep.invariant && Array.isArray(rep.invariant.issues) ? rep.invariant.issues : []
                    if (state.debug) state.debug.lastInvariantIssues = invIssues.length ? invIssues : null

                    if (rep && rep.severity !== 'ok') {
                        try {
                            recordCrash && recordCrash('assertion', new Error('State integrity issues after load'), {
                                stage: 'after_load',
                                severity: rep.severity,
                                issues: invIssues,
                                scannerCounts: rep.scanners && rep.scanners.counts ? rep.scanners.counts : null
                            })
                        } catch (_) {}
                        try {
                            addLog && addLog('⚠️ Loaded save has integrity issues. Use Feedback → Bug Report.', 'danger')
                        } catch (_) {}
                    }
                }
            } catch (_) {}

            quests && quests.updateQuestBox && quests.updateQuestBox()
            updateHUD && updateHUD()
            updateEnemyPanel && updateEnemyPanel()
            if (typeof renderLog === 'function') renderLog()

            setScene && setScene('Resuming Journey', 'You pick up your adventure where you last left off.')
            if (state.inCombat && state.currentEnemy) {
                addLog && addLog('You are fighting ' + state.currentEnemy.name + '!', state.currentEnemy.isBoss ? 'danger' : 'system')
            }
            addLog && addLog('Game loaded.', 'system')

            renderActions && renderActions()
            switchScreen && switchScreen('game')
            updateTimeDisplay && updateTimeDisplay()

	            // Notify engine-level listeners (sim tick catch-up, analytics, etc.)
	            try {
	                if (engine && typeof engine.emit === 'function') {
	                    engine.emit('save:loaded', { legacy: true })
	                }
	            } catch (_) {}
            return true
        } catch (e) {
            console.error('Failed to load game:', e)
            if (!fromDefeat) showCorruptSaveModal && showCorruptSaveModal('Save data is corrupt or incompatible.')
            return false
        }
    }

    // -------------------- MANUAL SAVE SLOTS --------------------
    function buildHeroMetaFromData(data) {
        const root = (data && data.state && typeof data.state === 'object') ? data.state : data
        const p = root && root.player ? root.player : null
        const area = (root && root.area) || 'village'

        const heroName = (p && p.name) || 'Unnamed Hero'
        const classId = (p && (p.classId || p.class)) || null

        let className = (p && p.className) || ''
        try {
            if (!className && typeof PLAYER_CLASSES !== 'undefined' && PLAYER_CLASSES && classId && PLAYER_CLASSES[classId]) {
                className = PLAYER_CLASSES[classId].name || ''
            }
        } catch (_) {}

        const level = p && typeof p.level === 'number' ? p.level : 1
        const patch = (data && data.meta && data.meta.patch) || (root && root.meta && root.meta.patch) || null
        const savedAt = (data && data.meta && data.meta.savedAt) || (root && root.meta && root.meta.savedAt) || (data && data.savedAt) || null

        return { heroName, classId, className, level, area, patch, savedAt }
    }

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

    function writeSaveIndex(list) {
        try {
            safeStorageSet(SAVE_INDEX_KEY, JSON.stringify(list), { action: 'write save index' })
        } catch (e) {
            console.warn('Failed to write save index', e)
        }
    }

    function saveGameToSlot(slotId, label) {
        const state = getState()
        if (!slotId) {
            console.error('Missing slot id for manual save.')
            return
        }
        if (!state.player || state.player.hp <= 0) {
            ;(alertFn || alert)('Cannot save: your hero is not alive.')
            return
        }

        saveGame({ force: true })
        const json = state.lastSaveJson
        if (!json) {
            ;(alertFn || alert)('Could not save: no game data found.')
            return
        }

        let data
        try {
            data = JSON.parse(json)
        } catch (e) {
            console.error('Failed to parse save JSON for slot save', e)
            ;(alertFn || alert)('Could not save: data is corrupt.')
            return
        }

        const meta = buildHeroMetaFromData(data)
        const now = Date.now()

        const slotLabel = String(label || '').trim() || 'Manual Save'
        const entry = {
            id: String(slotId),
            label: slotLabel,
            isAuto: false,
            heroName: meta.heroName,
            classId: meta.classId,
            className: meta.className,
            level: meta.level,
            area: meta.area,
            patch: meta.patch || GAME_PATCH || 'Unknown',
            savedAt: meta.savedAt || now,
            lastPlayed: now
        }

        let index = getSaveIndex()
        const existing = index.find((e) => e && e.id === slotId)
        if (existing) {
            Object.assign(existing, entry)
        } else {
            index.push(entry)
        }
        writeSaveIndex(index)

        try {
            safeStorageSet(SAVE_KEY_PREFIX + slotId, json, { action: 'write manual save slot' })
        } catch (e) {
            console.error('Failed to write manual save slot', e)
            ;(alertFn || alert)('Could not write that save slot.')
        }
    }

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

    function loadGameFromSlot(slotId) {
        if (!slotId) return false

        try {
            const json = safeStorageGet(SAVE_KEY_PREFIX + slotId)
            if (!json) {
                ;(alertFn || alert)('That save slot is empty or missing.')
                return false
            }
            safeStorageSet(SAVE_KEY, json, { action: 'save game' })
            return loadGame(false)
        } catch (e) {
            console.error('Failed to load from slot', e)
            ;(alertFn || alert)('Failed to load that save.')
            return false
        }
    }

    function getAllSavesWithAuto() {
        const list = getSaveIndex().slice()

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

    return {
        migrateSaveData,
        saveGame,
        loadGame,
        // Expose for QA + scenario runner (engine smoke tests expect this identifier).
        _buildSaveBlob,
        buildSaveBlob: _buildSaveBlob,
        buildHeroMetaFromData,
        // Slots
        getSaveIndex,
        writeSaveIndex,
        saveGameToSlot,
        deleteSaveSlot,
        loadGameFromSlot,
        getAllSavesWithAuto
    }
}
