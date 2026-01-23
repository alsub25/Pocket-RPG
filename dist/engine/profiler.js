// js/engine/profiler.js
// Lightweight profiler + slow-frame watchdog (engine-agnostic).
function _now() {
    try {
        if (typeof performance !== 'undefined' && performance.now)
            return performance.now();
    }
    catch (_) { }
    return Date.now();
}
export function createProfiler({ slowFrameMs = 28, maxRecords = 200, emit = null, logger = null } = {}) {
    const records = []; // { t, name, ms }
    let rafId = null;
    let lastFrameT = null;
    let enabled = false;
    function _log(lvl, msg, data) {
        try {
            if (logger && logger[lvl])
                logger[lvl]('perf', msg, data);
        }
        catch (_) { }
    }
    function mark(name, ms) {
        records.push({ t: Date.now(), name: String(name || ''), ms: Number(ms) || 0 });
        if (records.length > maxRecords)
            records.splice(0, records.length - maxRecords);
    }
    function begin(name) {
        const start = _now();
        return () => {
            const end = _now();
            const ms = end - start;
            mark(name, ms);
            if (ms > slowFrameMs) {
                _log('warn', 'slow scope', { name, ms });
                try {
                    if (emit)
                        emit('perf:slowScope', { name, ms });
                }
                catch (_) { }
            }
            return ms;
        };
    }
    function _frameLoop() {
        const t = _now();
        if (lastFrameT != null) {
            const dt = t - lastFrameT;
            if (dt > slowFrameMs) {
                mark('frame', dt);
                try {
                    if (emit)
                        emit('perf:slowFrame', { dt });
                }
                catch (_) { }
            }
        }
        lastFrameT = t;
        try {
            rafId = requestAnimationFrame(_frameLoop);
        }
        catch (_) {
            rafId = null;
        }
    }
    function startWatchdog() {
        if (enabled)
            return;
        enabled = true;
        if (typeof requestAnimationFrame !== 'function')
            return;
        lastFrameT = _now();
        rafId = requestAnimationFrame(_frameLoop);
    }
    function stopWatchdog() {
        enabled = false;
        if (rafId != null && typeof cancelAnimationFrame === 'function') {
            try {
                cancelAnimationFrame(rafId);
            }
            catch (_) { }
        }
        rafId = null;
    }
    return {
        begin,
        mark,
        getRecords() { return records.slice(); },
        clear() { records.length = 0; },
        startWatchdog,
        stopWatchdog
    };
}
//# sourceMappingURL=profiler.js.map