// js/engine/flags.js
// Persistent feature flags / experiments.
function _hasStorage() {
    try {
        return typeof localStorage !== 'undefined' && !!localStorage;
    }
    catch (_) {
        return false;
    }
}
function _safeGet(key) {
    if (!_hasStorage())
        return null;
    try {
        return localStorage.getItem(String(key || ''));
    }
    catch (_) {
        return null;
    }
}
function _safeSet(key, val) {
    if (!_hasStorage())
        return false;
    try {
        localStorage.setItem(String(key || ''), String(val));
        return true;
    }
    catch (_) {
        return false;
    }
}
function _safeRemove(key) {
    if (!_hasStorage())
        return false;
    try {
        localStorage.removeItem(String(key || ''));
        return true;
    }
    catch (_) {
        return false;
    }
}
function _nowIso() {
    try {
        return new Date().toISOString();
    }
    catch (_) {
        return '';
    }
}
export function createFlagsService({ storageKey = 'locus.flags.v1', logger = null } = {}) {
    const _log = logger;
    let _defaults = Object.create(null);
    let _flags = Object.create(null);
    function defineDefaults(obj) {
        if (!obj || typeof obj !== 'object')
            return;
        _defaults = { ..._defaults, ...obj };
        // Populate current flags if missing.
        Object.keys(obj).forEach((k) => {
            if (!Object.prototype.hasOwnProperty.call(_flags, k)) {
                _flags[k] = !!obj[k];
            }
        });
    }
    function load() {
        const raw = _safeGet(storageKey);
        if (!raw) {
            _flags = { ..._defaults };
            return dump();
        }
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                _flags = { ..._defaults, ...parsed };
            }
            else {
                _flags = { ..._defaults };
            }
        }
        catch (e) {
            _flags = { ..._defaults };
            try {
                _log?.warn?.('flags', 'failed to parse flags storage; resetting', { e });
            }
            catch (_) { }
        }
        return dump();
    }
    function save() {
        try {
            const payload = JSON.stringify(_flags);
            _safeSet(storageKey, payload);
        }
        catch (e) {
            try {
                _log?.warn?.('flags', 'failed to persist flags', { e });
            }
            catch (_) { }
        }
    }
    function get(key, fallback = null) {
        const k = String(key || '').trim();
        if (!k)
            return fallback;
        if (Object.prototype.hasOwnProperty.call(_flags, k))
            return _flags[k];
        if (Object.prototype.hasOwnProperty.call(_defaults, k))
            return _defaults[k];
        return fallback;
    }
    function isEnabled(key) {
        return !!get(key, false);
    }
    function set(key, value, { persist = true } = {}) {
        const k = String(key || '').trim();
        if (!k)
            return;
        _flags[k] = !!value;
        if (persist)
            save();
    }
    function toggle(key, { persist = true } = {}) {
        const k = String(key || '').trim();
        if (!k)
            return false;
        const next = !isEnabled(k);
        set(k, next, { persist });
        return next;
    }
    function reset({ persist = true } = {}) {
        _flags = { ..._defaults };
        if (persist)
            save();
    }
    function clearStorage() {
        _safeRemove(storageKey);
    }
    function dump() {
        // Keep it stable + JSON safe
        return {
            t: _nowIso(),
            storageKey,
            defaults: { ..._defaults },
            flags: { ..._flags }
        };
    }
    return {
        defineDefaults,
        load,
        save,
        get,
        set,
        toggle,
        isEnabled,
        reset,
        clearStorage,
        dump
    };
}
//# sourceMappingURL=flags.js.map