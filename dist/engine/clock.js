// js/engine/clock.js
// Deterministic clock (optional fixed timestep) and time scaling.
export function createClock({ fixedDtMs = null, // number | null
timeScale = 1, startMs = 0 } = {}) {
    let nowMs = Number(startMs) || 0;
    let scale = Number(timeScale);
    if (!Number.isFinite(scale) || scale <= 0)
        scale = 1;
    const api = {
        get nowMs() { return nowMs; },
        get timeScale() { return scale; },
        setTimeScale(v) {
            const n = Number(v);
            if (Number.isFinite(n) && n > 0)
                scale = n;
        },
        /**
         * Advance time by dtMs. If fixedDtMs is set, dtMs is ignored and fixedDtMs is used.
         * Returns the dtMs actually used (after scaling).
         */
        tick(dtMs) {
            const raw = (fixedDtMs == null) ? Number(dtMs) : Number(fixedDtMs);
            // Validate and clamp raw value
            if (!Number.isFinite(raw)) {
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn(`[Clock] tick() received non-finite dtMs: ${dtMs}, using 0`);
                }
                nowMs += 0;
                return 0;
            }
            if (raw < 0) {
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn(`[Clock] tick() received negative dtMs: ${raw}, using 0`);
                }
                nowMs += 0;
                return 0;
            }
            const step = raw * scale;
            nowMs += step;
            return step;
        }
    };
    return api;
}
//# sourceMappingURL=clock.js.map