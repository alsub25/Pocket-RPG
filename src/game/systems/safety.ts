// Systems/safety.js
// Shared numeric safety helpers used across systems.
// Keep all "NaN/Infinity/negative" guards in one place so rules stay consistent.

export function finiteNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function finiteInt(v, fallback = 0) {
  const n = finiteNumber(v, fallback);
  return Math.floor(n);
}

export function clampFinite(v, min, max, fallback = min) {
  const n = finiteNumber(v, fallback);
  return Math.max(min, Math.min(max, n));
}

export function clampInt(v, min, max, fallback = min) {
  const n = finiteInt(v, fallback);
  if (n < min) return min;
  if (n > max) return max;
  return n;
}

// NaN/Infinity-safe gold sanitizer (integer, never negative)
export function sanitizeGold(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}
