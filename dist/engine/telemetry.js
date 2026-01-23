// js/engine/telemetry.js
// Lightweight telemetry + crash breadcrumb pipeline.
function _nowIso() {
    try {
        return new Date().toISOString();
    }
    catch (_) {
        return '';
    }
}
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
export function createTelemetry(engine, { maxEvents = 220, storageKeyLastCrash = 'locus.telemetry.lastCrash.v1' } = {}) {
    let _enabled = false;
    const _buf = [];
    const _unsubs = [];
    let _contextProvider = null;
    function setContextProvider(fn) {
        _contextProvider = (typeof fn === 'function') ? fn : null;
    }
    function record(type, payload = null) {
        const rec = { t: _nowIso(), type: String(type || 'event'), payload: payload ?? null };
        _buf.push(rec);
        if (_buf.length > maxEvents)
            _buf.splice(0, _buf.length - maxEvents);
        return rec;
    }
    function getTail(n = 200) {
        const lim = Math.max(0, Math.min(1000, Number(n) || 200));
        return _buf.slice(-lim);
    }
    function clear() {
        _buf.splice(0, _buf.length);
    }
    function _flags() {
        try {
            return engine?.getService?.('flags') || engine?.flags || null;
        }
        catch (_) {
            return null;
        }
    }
    function _isEnabledFlag(key, fallback = false) {
        try {
            const f = _flags();
            if (!f)
                return fallback;
            if (typeof f.isEnabled === 'function')
                return !!f.isEnabled(key);
            if (typeof f.get === 'function')
                return !!f.get(key, fallback);
            return fallback;
        }
        catch (_) {
            return fallback;
        }
    }
    function _persistCrash(bundle) {
        if (!_isEnabledFlag('telemetry.persistCrashes', true))
            return;
        try {
            _safeSet(storageKeyLastCrash, JSON.stringify(bundle));
        }
        catch (_) { }
    }
    function readLastCrash() {
        const raw = _safeGet(storageKeyLastCrash);
        if (!raw)
            return null;
        try {
            return JSON.parse(raw);
        }
        catch (_) {
            return null;
        }
    }
    function buildBundle({ includeState = null } = {}) {
        const include = includeState != null ? !!includeState : _isEnabledFlag('telemetry.includeStateInCrash', false);
        const ctx = (() => {
            try {
                return _contextProvider ? _contextProvider() : null;
            }
            catch (_) {
                return null;
            }
        })();
        const flagsDump = (() => {
            try {
                return _flags()?.dump?.() || null;
            }
            catch (_) {
                return null;
            }
        })();
        const savePolicyStatus = (() => {
            try {
                return engine?.getService?.('savePolicy')?.getStatus?.() || null;
            }
            catch (_) {
                return null;
            }
        })();
        const replayMeta = (() => {
            try {
                return engine?.getService?.('replay')?.getLastMeta?.() || null;
            }
            catch (_) {
                return null;
            }
        })();
        const report = (() => {
            try {
                return engine?.errorBoundary?.buildReport?.({ includeState: include }) || null;
            }
            catch (_) {
                return null;
            }
        })();
        return {
            t: _nowIso(),
            patch: engine?.patch || '',
            patchName: engine?.patchName || '',
            context: ctx,
            flags: flagsDump,
            savePolicy: savePolicyStatus,
            replay: replayMeta,
            telemetryTail: getTail(200),
            engineReport: report
        };
    }
    function start() {
        if (_enabled)
            return;
        _enabled = true;
        const listen = (eventName, mapper) => {
            const fn = (payload) => {
                try {
                    const p = mapper ? mapper(payload) : payload;
                    record(eventName, p);
                }
                catch (_) { }
            };
            try {
                engine?.on?.(eventName, fn);
            }
            catch (_) { }
            _unsubs.push(() => { try {
                engine?.off?.(eventName, fn);
            }
            catch (_) { } });
        };
        // Core breadcrumbs
        listen('command:dispatched', (e) => ({ t: e?.t || null, type: e?.command?.type || null }));
        listen('ui:open', (e) => ({ id: e?.id || null }));
        listen('ui:close', (e) => ({ id: e?.id || null }));
        listen('screen:enter', (e) => ({ screen: e?.screen || null }));
        listen('screen:leave', (e) => ({ screen: e?.screen || null }));
        listen('modal:open', (e) => ({ owner: e?.owner || null }));
        listen('modal:close', (e) => ({ owner: e?.owner || null }));
        listen('perf:slowScope');
        listen('perf:slowFrame');
        // Save policy
        listen('savePolicy:dirty');
        listen('savePolicy:flushStart');
        listen('savePolicy:flushOk');
        listen('savePolicy:flushFail');
        listen('savePolicy:flushBlocked');
        listen('savePolicy:txnBegin');
        listen('savePolicy:txnEnd');
        // Replay
        listen('replay:recordingStart');
        listen('replay:recordingStop');
        listen('replay:playStart');
        listen('replay:playEnd');
        // Crash persistence
        const onErr = (err) => {
            try {
                record('engine:error', err);
                const bundle = buildBundle({ includeState: null });
                _persistCrash(bundle);
            }
            catch (_) { }
        };
        try {
            engine?.on?.('engine:error', onErr);
        }
        catch (_) { }
        _unsubs.push(() => { try {
            engine?.off?.('engine:error', onErr);
        }
        catch (_) { } });
    }
    function stop() {
        _enabled = false;
        while (_unsubs.length) {
            try {
                _unsubs.pop()();
            }
            catch (_) { }
        }
    }
    function dispose() {
        stop();
        clear();
    }
    return {
        start,
        stop,
        dispose,
        record,
        getTail,
        clear,
        buildBundle,
        readLastCrash,
        setContextProvider
    };
}
//# sourceMappingURL=telemetry.js.map