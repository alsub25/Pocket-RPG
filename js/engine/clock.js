// js/engine/clock.js
// Deterministic clock (optional fixed timestep) and time scaling.

export function createClock({
  fixedDtMs = null,     // number | null
  timeScale = 1,
  startMs = 0
} = {}) {
  let nowMs = Number(startMs) || 0
  let scale = Number(timeScale)
  if (!Number.isFinite(scale) || scale <= 0) scale = 1

  const api = {
    get nowMs() { return nowMs },
    get timeScale() { return scale },
    setTimeScale(v) {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) scale = n
    },
    /**
     * Advance time by dtMs. If fixedDtMs is set, dtMs is ignored and fixedDtMs is used.
     * Returns the dtMs actually used (after scaling).
     */
    tick(dtMs) {
      const raw = (fixedDtMs == null) ? Number(dtMs) : Number(fixedDtMs)
      const step = (Number.isFinite(raw) ? raw : 0) * scale
      nowMs += step
      return step
    }
  }

  return api
}
