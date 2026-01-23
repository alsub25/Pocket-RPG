// js/engine/savePolicy.js
// Dirty-state + transactional save flush policy.
//
// Goal: centralize save decisions (safe points, coalescing, retries).
function _nowIso() {
    try {
        return new Date().toISOString();
    }
    catch (_) {
        return '';
    }
}
function _safeStr(v) {
    try {
        return String(v == null ? '' : v);
    }
    catch (_) {
        return '';
    }
}
export function createSavePolicy(engine, { owner = 'system:savePolicy', coalesceMs = 900, retryMs = 1500 } = {}) {
    let _writer = null;
    let _safePredicate = null;
    let _dirty = false;
    let _dirtyReasons = [];
    let _txnDepth = 0;
    let _timer = null;
    let _flushInProgress = false;
    let _lastFlush = null;
    function setWriter(fn) {
        _writer = (typeof fn === 'function') ? fn : null;
    }
    function setSafePredicate(fn) {
        _safePredicate = (typeof fn === 'function') ? fn : null;
    }
    function beginTxn(label = 'txn') {
        _txnDepth += 1;
        const token = { id: Math.random().toString(36).slice(2), label: _safeStr(label), t: _nowIso() };
        try {
            engine?.emit?.('savePolicy:txnBegin', { ...token, depth: _txnDepth });
        }
        catch (_) { }
        return token;
    }
    function endTxn(token) {
        _txnDepth = Math.max(0, _txnDepth - 1);
        try {
            engine?.emit?.('savePolicy:txnEnd', { token, depth: _txnDepth });
        }
        catch (_) { }
        // If we were waiting for txn completion, try flushing now.
        try {
            flush({ reason: 'txnEnd' });
        }
        catch (_) { }
    }
    function markDirty(reason = 'unknown') {
        _dirty = true;
        const r = _safeStr(reason) || 'unknown';
        if (r) {
            _dirtyReasons.push(r);
            if (_dirtyReasons.length > 20)
                _dirtyReasons.splice(0, _dirtyReasons.length - 20);
        }
        try {
            engine?.emit?.('savePolicy:dirty', { t: _nowIso(), reason: r });
        }
        catch (_) { }
    }
    function _isSafe() {
        try {
            return _safePredicate ? !!_safePredicate() : true;
        }
        catch (_) {
            return true;
        }
    }
    function _clearTimer() {
        try {
            if (_timer && engine?.schedule?.cancel)
                engine.schedule.cancel(_timer);
        }
        catch (_) { }
        _timer = null;
    }
    function flush({ force = false, reason = 'flush' } = {}) {
        if (!_dirty && !force)
            return false;
        if (_flushInProgress)
            return false;
        // Never flush mid-transaction unless forced.
        if (_txnDepth > 0 && !force) {
            try {
                engine?.emit?.('savePolicy:flushBlocked', { t: _nowIso(), reason: 'txn', depth: _txnDepth });
            }
            catch (_) { }
            return false;
        }
        if (!_isSafe() && !force) {
            // Retry later.
            try {
                engine?.emit?.('savePolicy:flushBlocked', { t: _nowIso(), reason: 'unsafe' });
            }
            catch (_) { }
            _clearTimer();
            try {
                if (engine?.schedule?.after) {
                    _timer = engine.schedule.after(retryMs, () => {
                        _timer = null;
                        try {
                            flush({ force: false, reason: 'retry' });
                        }
                        catch (_) { }
                    }, { owner });
                }
            }
            catch (_) { }
            return false;
        }
        _clearTimer();
        // Coalesce: schedule actual write.
        try {
            if (engine?.schedule?.after && !force) {
                _timer = engine.schedule.after(coalesceMs, () => {
                    _timer = null;
                    _doFlush(reason);
                }, { owner });
                return true;
            }
        }
        catch (_) { }
        // Immediate flush
        _doFlush(reason);
        return true;
    }
    function _doFlush(reason) {
        if (_flushInProgress)
            return;
        if (!_writer) {
            try {
                engine?.emit?.('savePolicy:flushFail', { t: _nowIso(), reason, error: 'no-writer' });
            }
            catch (_) { }
            return;
        }
        _flushInProgress = true;
        const started = _nowIso();
        const reasons = _dirtyReasons.slice();
        _dirtyReasons = [];
        try {
            engine?.emit?.('savePolicy:flushStart', { t: started, reason, reasons });
        }
        catch (_) { }
        let ok = false;
        let err = null;
        try {
            _writer({ reason, reasons });
            ok = true;
        }
        catch (e) {
            err = e;
        }
        _flushInProgress = false;
        if (ok) {
            _dirty = false;
            _lastFlush = { t: _nowIso(), reason };
            try {
                engine?.emit?.('savePolicy:flushOk', { t: _lastFlush.t, reason });
            }
            catch (_) { }
        }
        else {
            _dirty = true;
            try {
                engine?.emit?.('savePolicy:flushFail', { t: _nowIso(), reason, error: (err && err.message) ? err.message : String(err) });
            }
            catch (_) { }
            // Retry after a short delay.
            try {
                if (engine?.schedule?.after) {
                    _timer = engine.schedule.after(retryMs, () => {
                        _timer = null;
                        try {
                            flush({ reason: 'retry' });
                        }
                        catch (_) { }
                    }, { owner });
                }
            }
            catch (_) { }
        }
    }
    function getStatus() {
        return {
            dirty: !!_dirty,
            txnDepth: _txnDepth,
            flushInProgress: !!_flushInProgress,
            lastFlush: _lastFlush,
            pendingReasons: _dirtyReasons.slice()
        };
    }
    function dispose() {
        _clearTimer();
        _writer = null;
        _safePredicate = null;
        _dirtyReasons = [];
    }
    return {
        setWriter,
        setSafePredicate,
        beginTxn,
        endTxn,
        markDirty,
        flush,
        getStatus,
        dispose
    };
}
//# sourceMappingURL=savePolicy.js.map