// Systems/rng.js
// Deterministic RNG utilities for reproducible debugging.
//
// Default behavior uses Math.random(). When deterministic mode is enabled,
// RNG draws prefer the Engine RNG streams (engine.rng.stream(name)) when available.
// If the engine RNG is unavailable, we fall back to a local 32-bit hash stream
// keyed by a persisted seed and a monotonically increasing draw index.
function _getEngine() {
    try {
        if (typeof window !== 'undefined' && window) {
            return window.__emberwoodEngine || null;
        }
    }
    catch (_) { }
    return null;
}
function _streamKey(tag) {
    const t = String(tag || '');
    if (!t)
        return 'default';
    // Keep streams coarse to avoid unbounded map growth.
    // Examples: loot.*, quest.*, government.*
    const m = t.split(/[.:]/);
    return (m && m[0]) ? String(m[0] || 'default') : 'default';
}
function _syncEngineSeed(seedUint32) {
    try {
        const eng = _getEngine();
        const rng = eng && eng.rng;
        if (rng && typeof rng.setSeed === 'function') {
            rng.setSeed(seedUint32 >>> 0);
            return true;
        }
    }
    catch (_) { }
    return false;
}
function _ensureDebug(state) {
    // Allow callers to omit state by relying on the global game state ref.
    if (!state) {
        try {
            if (typeof window !== 'undefined' && window.__emberwoodStateRef) {
                state = window.__emberwoodStateRef;
            }
        }
        catch (_) { }
    }
    // Prefer Engine Core state when available (avoids relying on the global ref).
    if (!state) {
        try {
            const eng = _getEngine();
            if (eng && typeof eng.getState === 'function')
                state = eng.getState();
        }
        catch (_) { }
    }
    if (!state)
        return null;
    if (!state.debug || typeof state.debug !== 'object')
        state.debug = {};
    const d = state.debug;
    if (typeof d.useDeterministicRng !== 'boolean')
        d.useDeterministicRng = false;
    if (typeof d.rngSeed !== 'number' || !Number.isFinite(d.rngSeed)) {
        // Make it stable-ish across reloads for a single save, but still varied.
        d.rngSeed = (Date.now() >>> 0);
    }
    if (typeof d.rngIndex !== 'number' || !Number.isFinite(d.rngIndex))
        d.rngIndex = 0;
    if (typeof d.captureRngLog !== 'boolean')
        d.captureRngLog = false;
    if (!Array.isArray(d.rngLog))
        d.rngLog = [];
    // Sync engine RNG seed once when deterministic mode is enabled.
    // Stored on debug for repeat calls without re-seeding every draw.
    if (d.useDeterministicRng) {
        try {
            const seeded = (d.__engineRngSeed >>> 0);
            const want = (Number(d.rngSeed) >>> 0);
            if (!Number.isFinite(seeded) || seeded !== want) {
                if (_syncEngineSeed(want))
                    d.__engineRngSeed = want;
            }
        }
        catch (_) { }
    }
    return d;
}
// 32-bit avalanche hash (fast, good-enough for deterministic gameplay randomness).
function _hash32(x) {
    x = (x >>> 0);
    x ^= x >>> 16;
    x = Math.imul(x, 0x7feb352d) >>> 0;
    x ^= x >>> 15;
    x = Math.imul(x, 0x846ca68b) >>> 0;
    x ^= x >>> 16;
    return x >>> 0;
}
export function initRngState(state) {
    _ensureDebug(state);
}
export function setRngSeed(state, seed) {
    const d = _ensureDebug(state);
    if (!d)
        return;
    // Force to uint32.
    d.rngSeed = (Number(seed) >>> 0);
    d.rngIndex = 0;
    // Keep engine RNG aligned when deterministic mode is enabled.
    if (d.useDeterministicRng) {
        try {
            if (_syncEngineSeed(d.rngSeed))
                d.__engineRngSeed = (d.rngSeed >>> 0);
        }
        catch (_) { }
    }
}
export function setDeterministicRngEnabled(state, enabled) {
    const d = _ensureDebug(state);
    if (!d)
        return;
    d.useDeterministicRng = !!enabled;
    if (d.useDeterministicRng) {
        try {
            const want = (Number(d.rngSeed) >>> 0);
            if (_syncEngineSeed(want))
                d.__engineRngSeed = want;
        }
        catch (_) { }
    }
}
export function setRngLoggingEnabled(state, enabled) {
    const d = _ensureDebug(state);
    if (!d)
        return;
    d.captureRngLog = !!enabled;
    if (!d.captureRngLog)
        d.rngLog = [];
}
export function rngFloat(state, tag) {
    const d = _ensureDebug(state);
    if (!d)
        return Math.random();
    const i = (d.rngIndex >>> 0);
    d.rngIndex = i + 1;
    // Non-deterministic mode: preserve original behavior (Math.random).
    if (!d.useDeterministicRng) {
        const v = Math.random();
        if (d.captureRngLog) {
            d.rngLog.push({ i, tag: String(tag || ''), v });
            if (d.rngLog.length > 200)
                d.rngLog.splice(0, d.rngLog.length - 200);
        }
        return v;
    }
    // Deterministic mode: prefer Engine RNG streams when available.
    let v = null;
    try {
        const eng = _getEngine();
        const rng = eng && eng.rng;
        if (rng && typeof rng.stream === 'function') {
            // Ensure seed aligned (in case state seed changed without calling setRngSeed).
            const want = (Number(d.rngSeed) >>> 0);
            if ((d.__engineRngSeed >>> 0) !== want && typeof rng.setSeed === 'function') {
                rng.setSeed(want);
                d.__engineRngSeed = want;
            }
            const stream = rng.stream(_streamKey(tag));
            if (stream && typeof stream.float === 'function')
                v = stream.float();
        }
    }
    catch (_) { }
    // Fallback deterministic stream (keeps determinism even without engine RNG).
    if (!Number.isFinite(v)) {
        const mixed = _hash32((d.rngSeed ^ _hash32(i + 0x9e3779b9)) >>> 0);
        v = (mixed >>> 0) / 4294967296;
    }
    if (d.captureRngLog) {
        d.rngLog.push({ i, tag: String(tag || ''), v });
        if (d.rngLog.length > 200)
            d.rngLog.splice(0, d.rngLog.length - 200);
    }
    return v;
}
export function rngInt(state, min, max, tag) {
    const a = Math.floor(Number(min));
    const b = Math.floor(Number(max));
    if (!Number.isFinite(a) || !Number.isFinite(b))
        return 0;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const r = rngFloat(state, tag);
    return Math.floor(r * (hi - lo + 1)) + lo;
}
export function rngPick(state, list, tag) {
    if (!Array.isArray(list) || list.length === 0)
        return null;
    const idx = rngInt(state, 0, list.length - 1, tag);
    return list[idx];
}
//# sourceMappingURL=rng.js.map