// js/engine/logger.js
// Structured logger with in-memory ring buffer (engine-agnostic).
function _nowIso() {
    try {
        return new Date().toISOString();
    }
    catch (_) {
        return '';
    }
}
export function createLogger({ maxRecords = 400, consoleEcho = true, level = 'info' } = {}) {
    const levels = ['debug', 'info', 'warn', 'error', 'silent'];
    const levelIdx = Math.max(0, levels.indexOf(level));
    const records = [];
    let seq = 0;
    function _shouldLog(lvl) {
        const idx = levels.indexOf(lvl);
        if (idx < 0)
            return false;
        if (lvl === 'silent')
            return false;
        return idx >= levelIdx;
    }
    function _push(lvl, scope, message, data) {
        const rec = {
            seq: ++seq,
            t: _nowIso(),
            lvl,
            scope: scope ? String(scope) : '',
            msg: message ? String(message) : '',
            data: data ?? null
        };
        records.push(rec);
        if (records.length > maxRecords)
            records.splice(0, records.length - maxRecords);
        if (consoleEcho && typeof console !== 'undefined') {
            try {
                const tag = scope ? `[${scope}]` : '';
                const line = `${rec.t} ${lvl.toUpperCase()} ${tag} ${rec.msg}`.trim();
                if (lvl === 'error' && console.error)
                    console.error(line, rec.data);
                else if (lvl === 'warn' && console.warn)
                    console.warn(line, rec.data);
                else if (lvl === 'debug' && console.debug)
                    console.debug(line, rec.data);
                else if (console.log)
                    console.log(line, rec.data);
            }
            catch (_) { }
        }
        return rec;
    }
    const api = {
        setLevel(newLevel) {
            const i = levels.indexOf(String(newLevel || '').toLowerCase());
            if (i >= 0)
                api.level = levels[i];
        },
        get level() { return levels[Math.max(0, levels.indexOf(level))]; },
        debug(scope, msg, data) { if (_shouldLog('debug'))
            return _push('debug', scope, msg, data); },
        info(scope, msg, data) { if (_shouldLog('info'))
            return _push('info', scope, msg, data); },
        warn(scope, msg, data) { if (_shouldLog('warn'))
            return _push('warn', scope, msg, data); },
        error(scope, msg, data) { if (_shouldLog('error'))
            return _push('error', scope, msg, data); },
        getRecords() { return records.slice(); },
        clear() { records.length = 0; }
    };
    return api;
}
//# sourceMappingURL=logger.js.map