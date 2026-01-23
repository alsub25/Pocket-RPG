// js/engine/a11y.js
// Accessibility preferences + environment sensing (engine-agnostic).
//
// Notes:
// - This service does NOT touch the DOM. A game/plugin can provide a DOM adapter.
// - User preferences are expected to live in engine.settings.
// - OS-level hints are read via matchMedia when available.
function _safeMatch(query) {
    try {
        if (typeof window === 'undefined' || !window.matchMedia)
            return null;
        return window.matchMedia(query);
    }
    catch (_) {
        return null;
    }
}
function _readEnv() {
    const rm = _safeMatch('(prefers-reduced-motion: reduce)');
    const hc = _safeMatch('(prefers-contrast: more)');
    const dark = _safeMatch('(prefers-color-scheme: dark)');
    return {
        prefersReducedMotion: !!(rm && rm.matches),
        prefersHighContrast: !!(hc && hc.matches),
        prefersDarkScheme: !!(dark && dark.matches)
    };
}
function _resolveTriState(pref, envBool) {
    // pref can be: true | false | 'auto' | null/undefined
    if (pref === true)
        return true;
    if (pref === false)
        return false;
    return !!envBool;
}
function _clampNumber(v, lo, hi, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n))
        return fallback;
    return Math.max(lo, Math.min(hi, n));
}
export function createA11yService({ settings = null, emit = null, logger = null } = {}) {
    let _env = _readEnv();
    let _lastDerived = null;
    function _log(lvl, msg, data) {
        try {
            if (logger && logger[lvl])
                logger[lvl]('a11y', msg, data);
        }
        catch (_) { }
    }
    function getEnv() {
        return { ..._env };
    }
    function refreshEnv() {
        _env = _readEnv();
        try {
            if (emit)
                emit('a11y:envChanged', getEnv());
        }
        catch (_) { }
        return _env;
    }
    function compute() {
        const s = settings;
        const reducePref = s && typeof s.get === 'function' ? s.get('a11y.reduceMotion', 'auto') : 'auto';
        const contrastPref = s && typeof s.get === 'function' ? s.get('a11y.highContrast', 'auto') : 'auto';
        const schemePref = s && typeof s.get === 'function' ? s.get('ui.colorScheme', 'auto') : 'auto';
        const textScale = s && typeof s.get === 'function'
            ? _clampNumber(s.get('a11y.textScale', 1), 0.85, 1.25, 1)
            : 1;
        const uiScale = s && typeof s.get === 'function'
            ? _clampNumber(s.get('ui.scale', 1), 0.9, 1.2, 1)
            : 1;
        const reduceMotion = _resolveTriState(reducePref, _env.prefersReducedMotion);
        const highContrast = _resolveTriState(contrastPref, _env.prefersHighContrast);
        let colorScheme = 'light';
        if (schemePref === 'dark')
            colorScheme = 'dark';
        else if (schemePref === 'light')
            colorScheme = 'light';
        else
            colorScheme = _env.prefersDarkScheme ? 'dark' : 'light';
        const derived = { reduceMotion, highContrast, colorScheme, textScale, uiScale };
        // Emit if meaningfully changed.
        const changed = (() => {
            try {
                return JSON.stringify(_lastDerived) !== JSON.stringify(derived);
            }
            catch (_) {
                return true;
            }
        })();
        if (changed) {
            _lastDerived = derived;
            try {
                if (emit)
                    emit('a11y:changed', { ...derived });
            }
            catch (_) { }
        }
        return derived;
    }
    function startEnvListeners({ owner = 'system:a11y' } = {}) {
        // Optional: installs matchMedia listeners (browser only).
        // Returns a disposer.
        const subs = [];
        const add = (mql) => {
            if (!mql)
                return;
            const handler = () => {
                try {
                    refreshEnv();
                }
                catch (_) { }
                try {
                    compute();
                }
                catch (_) { }
            };
            try {
                if (typeof mql.addEventListener === 'function') {
                    mql.addEventListener('change', handler);
                    subs.push(() => mql.removeEventListener('change', handler));
                }
                else if (typeof mql.addListener === 'function') {
                    // Safari legacy
                    mql.addListener(handler);
                    subs.push(() => mql.removeListener(handler));
                }
            }
            catch (e) {
                _log('warn', 'matchMedia listener failed', { e });
            }
        };
        add(_safeMatch('(prefers-reduced-motion: reduce)'));
        add(_safeMatch('(prefers-contrast: more)'));
        add(_safeMatch('(prefers-color-scheme: dark)'));
        return () => { subs.forEach(fn => { try {
            fn();
        }
        catch (_) { } }); };
    }
    // Prime derived values.
    try {
        compute();
    }
    catch (_) { }
    return { getEnv, refreshEnv, compute, startEnvListeners };
}
//# sourceMappingURL=a11y.js.map