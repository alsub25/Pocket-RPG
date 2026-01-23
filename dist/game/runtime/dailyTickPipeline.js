/* =============================================================================
 * Daily Tick Pipeline
 * Patch: 1.2.72 — The Blackbark Oath — Refactored from gameOrchestrator.js
 *
 * Extracted from monolithic gameOrchestrator to improve testability and reduce
 * orchestration risk. Owns the single source of truth for day-change side effects.
 * ============================================================================= */
import { _perfNow, perfRecord, perfWrap } from '../../engine/perf.js';
function safe(fn, fallback = null) {
    try {
        return typeof fn === 'function' ? fn() : fallback;
    }
    catch (_) {
        return fallback;
    }
}
function _merchantStockTotalUnits(st) {
    try {
        const ms = st && st.merchantStock;
        if (!ms || typeof ms !== 'object')
            return 0;
        let total = 0;
        Object.keys(ms).forEach((ctxKey) => {
            const ctx = ms[ctxKey];
            if (!ctx || typeof ctx !== 'object')
                return;
            Object.keys(ctx).forEach((merchantId) => {
                const bucket = ctx[merchantId];
                if (!bucket || typeof bucket !== 'object')
                    return;
                Object.keys(bucket).forEach((itemKey) => {
                    const v = Number(bucket[itemKey]);
                    if (Number.isFinite(v))
                        total += Math.max(0, Math.floor(v));
                });
            });
        });
        return total;
    }
    catch (_) {
        return 0;
    }
}
/**
 * Run daily tick pipeline (1 in-game day passes).
 * Single source of truth for day-change side effects.
 * Used by Rest / Sleep / time skips so simulation can't diverge.
 *
 * @param {Object} state - Game state
 * @param {number} absoluteDay - Target day to tick to
 * @param {Object} hooks - Optional hooks for callbacks
 */
export function runDailyTicks(state, absoluteDay, hooks = {}) {
    if (!state || typeof absoluteDay !== 'number' || !Number.isFinite(absoluteDay))
        return;
    // Dev perf hook (opt-in): record daily tick cost for skipped-day catch-up debugging.
    const _t0 = _perfNow();
    // Create sim container (persisted) if missing.
    if (!state.sim || typeof state.sim !== 'object') {
        state.sim = { lastDailyTickDay: null, lastDailyReport: null };
    }
    const targetDay = Math.max(0, Math.floor(absoluteDay));
    let lastDay = typeof state.sim.lastDailyTickDay === 'number' && Number.isFinite(state.sim.lastDailyTickDay)
        ? Math.max(0, Math.floor(state.sim.lastDailyTickDay))
        : null;
    // If we've never ticked before, assume we need to tick *this* day once.
    if (lastDay === null)
        lastDay = targetDay - 1;
    // Catch-up loop (handles skipped days). Cap so we never lock up the UI.
    const MAX_CATCH_UP_DAYS = 30;
    let startDay = lastDay + 1;
    if (targetDay - startDay + 1 > MAX_CATCH_UP_DAYS) {
        startDay = targetDay - MAX_CATCH_UP_DAYS + 1;
    }
    for (let day = startDay; day <= targetDay; day++) {
        const isLast = day === targetDay;
        // Capture "before" for the final day so the Tavern Daily Report can describe the change.
        const beforeEcon = isLast ? safe(() => hooks.getVillageEconomySummary && hooks.getVillageEconomySummary(state), null) : null;
        const popBefore = isLast ? safe(() => hooks.ensureVillagePopulation && hooks.ensureVillagePopulation(state), null) : null;
        const beforeMood = isLast && popBefore ? Number(popBefore.mood || 0) : null;
        const beforeStockUnits = isLast ? _merchantStockTotalUnits(state) : null;
        // Defensive: some older saves may not have population initialized yet.
        try {
            hooks.ensureVillagePopulation && hooks.ensureVillagePopulation(state);
        }
        catch (_) {
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
                        hooks.onQuestDailyTick(day);
                    }
                }
            },
            // 2) Government / Town Hall (decrees, council state, etc.)
            {
                id: 'government',
                run: () => hooks.handleGovernmentDayTick && hooks.handleGovernmentDayTick(state, day, hooks)
            },
            {
                id: 'townHall',
                run: () => hooks.handleTownHallDayTick && hooks.handleTownHallDayTick(state, day, hooks)
            },
            // 3) Economy (village metrics / tier)
            {
                id: 'economy',
                run: () => hooks.handleEconomyDayTick && hooks.handleEconomyDayTick(state, day)
            },
            // 4) Merchants (daily restock)
            {
                id: 'merchants',
                run: () => hooks.handleMerchantDayTick && hooks.handleMerchantDayTick(state, day, hooks.cloneItemDef)
            },
            // 5) Bank (interest ticks / ledger summaries)
            {
                id: 'bank',
                run: () => {
                    if (hooks && typeof hooks.onBankDailyTick === 'function') {
                        hooks.onBankDailyTick(day);
                    }
                }
            },
            // 6) Population (mood drift, decree mood effects)
            {
                id: 'population',
                run: () => hooks.handlePopulationDayTick && hooks.handlePopulationDayTick(state, day, hooks)
            }
        ];
        for (const step of DAILY_STEPS) {
            try {
                step.run();
            }
            catch (_) {
                // Individual systems should never crash the day pipeline.
            }
        }
        // 7) Daily report snapshot (only for the final day processed)
        if (isLast) {
            const afterEcon = safe(() => hooks.getVillageEconomySummary && hooks.getVillageEconomySummary(state), null);
            const popAfter = safe(() => hooks.ensureVillagePopulation && hooks.ensureVillagePopulation(state), null);
            const afterMood = popAfter ? Number(popAfter.mood || 0) : null;
            const afterStockUnits = _merchantStockTotalUnits(state);
            state.sim.lastDailyReport = {
                day,
                economyBefore: beforeEcon,
                economyAfter: afterEcon,
                moodBefore: beforeMood,
                moodAfter: afterMood,
                moodDelta: typeof beforeMood === 'number' && typeof afterMood === 'number'
                    ? afterMood - beforeMood
                    : 0,
                moodReasons: popAfter && popAfter.lastMoodChange ? popAfter.lastMoodChange.reasons || [] : [],
                merchantStockDeltaUnits: typeof beforeStockUnits === 'number'
                    ? Math.max(0, afterStockUnits - beforeStockUnits)
                    : 0
            };
        }
    }
    state.sim.lastDailyTickDay = targetDay;
    // UI refresh hook (callers can opt-in: Explore, Rest, Cheat time jumps)
    try {
        if (hooks && typeof hooks.onAfterDailyTicks === 'function') {
            hooks.onAfterDailyTicks(targetDay);
        }
    }
    catch (_) {
        // ignore
    }
    // Record perf summary (safe/no-op unless capturePerf is enabled).
    try {
        perfRecord(state, 'village:time.runDailyTicks', _perfNow() - _t0, {
            startDay,
            targetDay,
            daysProcessed: Math.max(0, targetDay - startDay + 1)
        });
    }
    catch (_) { }
}
/**
 * Single, shared time-advance entrypoint.
 * Any place that advances time should go through this so day-change hooks can't drift.
 *
 * @param {Object} stateArg - Game state (or defaults to global state)
 * @param {number} parts - Number of time parts to advance
 * @param {string} reason - Reason for time advance
 * @param {Object} hooks - Optional hooks for callbacks
 */
export function advanceWorldTime(stateArg, parts, reason, hooks = {}) {
    const s = stateArg;
    if (!s)
        return null;
    return perfWrap(s, 'village:time.advanceWorldTime', { parts, reason }, () => {
        const step = hooks.advanceTime && hooks.advanceTime(s, parts);
        try {
            if (hooks && typeof hooks.onAfterTimeAdvance === 'function') {
                hooks.onAfterTimeAdvance(step, { parts, reason });
            }
        }
        catch (_) {
            // ignore
        }
        if (step && step.dayChanged) {
            runDailyTicks(s, step.after.absoluteDay, hooks);
        }
        return step;
    });
}
/**
 * Advance to the next Morning via the unified pipeline.
 * This ensures *all* day-advances (rest, cheats, scripted skips) run the exact same daily tick path.
 *
 * @param {Object} stateArg - Game state
 * @param {Object} hooks - Optional hooks for callbacks
 */
export function advanceToNextMorning(stateArg, hooks = {}) {
    const s = stateArg;
    const info = hooks.getTimeInfo && hooks.getTimeInfo(s);
    const partsPerDay = Array.isArray(hooks.DAY_PARTS) && hooks.DAY_PARTS.length ? hooks.DAY_PARTS.length : 3;
    // If already Morning, rest should advance a full day.
    const steps = info.partIndex === 0 ? partsPerDay : Math.max(1, partsPerDay - info.partIndex);
    advanceWorldTime(s, steps, 'toMorning', hooks);
    return hooks.getTimeInfo && hooks.getTimeInfo(s);
}
/**
 * Advance N calendar days and land on Morning.
 *
 * @param {Object} stateArg - Game state
 * @param {number} days - Number of days to advance
 * @param {Object} hooks - Optional hooks for callbacks
 */
export function advanceWorldDays(stateArg, days, hooks = {}) {
    const s = stateArg;
    const info = hooks.getTimeInfo && hooks.getTimeInfo(s);
    const partsPerDay = Array.isArray(hooks.DAY_PARTS) && hooks.DAY_PARTS.length ? hooks.DAY_PARTS.length : 3;
    const d = Math.max(0, Math.floor(Number(days) || 0));
    if (!d)
        return hooks.getTimeInfo && hooks.getTimeInfo(s);
    const toMorning = info.partIndex === 0 ? partsPerDay : Math.max(1, partsPerDay - info.partIndex);
    const steps = toMorning + partsPerDay * Math.max(0, d - 1);
    advanceWorldTime(s, steps, 'days', hooks);
    return hooks.getTimeInfo && hooks.getTimeInfo(s);
}
//# sourceMappingURL=dailyTickPipeline.js.map