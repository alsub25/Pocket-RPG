// Systems/rng.js
// Deterministic RNG utilities for reproducible debugging.
//
// Default behavior uses Math.random(). When deterministic mode is enabled,
// RNG draws come from a simple 32-bit hash stream keyed by a persisted seed
// and a monotonically increasing draw index.

function _ensureDebug(state) {
  // Allow callers to omit state by relying on the global game state ref.
  if (!state) {
    try {
      if (typeof window !== 'undefined' && window.__emberwoodStateRef) {
        state = window.__emberwoodStateRef;
      }
    } catch (_) {}
  }
  if (!state) return null;
  if (!state.debug || typeof state.debug !== 'object') state.debug = {};
  const d = state.debug;

  if (typeof d.useDeterministicRng !== 'boolean') d.useDeterministicRng = false;
  if (typeof d.rngSeed !== 'number' || !Number.isFinite(d.rngSeed)) {
    // Make it stable-ish across reloads for a single save, but still varied.
    d.rngSeed = (Date.now() >>> 0);
  }
  if (typeof d.rngIndex !== 'number' || !Number.isFinite(d.rngIndex)) d.rngIndex = 0;

  if (typeof d.captureRngLog !== 'boolean') d.captureRngLog = false;
  if (!Array.isArray(d.rngLog)) d.rngLog = [];

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
  if (!d) return;
  // Force to uint32.
  d.rngSeed = (Number(seed) >>> 0);
  d.rngIndex = 0;
}

export function setDeterministicRngEnabled(state, enabled) {
  const d = _ensureDebug(state);
  if (!d) return;
  d.useDeterministicRng = !!enabled;
}

export function setRngLoggingEnabled(state, enabled) {
  const d = _ensureDebug(state);
  if (!d) return;
  d.captureRngLog = !!enabled;
  if (!d.captureRngLog) d.rngLog = [];
}

export function rngFloat(state, tag) {
  const d = _ensureDebug(state);
  if (!d) return Math.random();

  if (!d.useDeterministicRng) {
    const i = (d.rngIndex >>> 0);
    d.rngIndex = i + 1;
    const v = Math.random();
    if (d.captureRngLog) {
      d.rngLog.push({ i, tag: String(tag || ''), v });
      if (d.rngLog.length > 200) d.rngLog.splice(0, d.rngLog.length - 200);
    }
    return v;
  }

  const i = (d.rngIndex >>> 0);
  d.rngIndex = i + 1;

  // Mix seed + index into a single 32-bit stream.
  const mixed = _hash32((d.rngSeed ^ _hash32(i + 0x9e3779b9)) >>> 0);
  const v = (mixed >>> 0) / 4294967296;

  if (d.captureRngLog) {
    d.rngLog.push({ i, tag: String(tag || ''), v });
    if (d.rngLog.length > 200) d.rngLog.splice(0, d.rngLog.length - 200);
  }

  return v;
}

export function rngInt(state, min, max, tag) {
  const a = Math.floor(Number(min));
  const b = Math.floor(Number(max));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const r = rngFloat(state, tag);
  return Math.floor(r * (hi - lo + 1)) + lo;
}

export function rngPick(state, list, tag) {
  if (!Array.isArray(list) || list.length === 0) return null;
  const idx = rngInt(state, 0, list.length - 1, tag);
  return list[idx];
}
