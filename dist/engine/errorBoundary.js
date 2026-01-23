// js/engine/errorBoundary.js
// Unified error boundary + crash report package.
function _nowIso() {
    try {
        return new Date().toISOString();
    }
    catch (_) {
        return '';
    }
}
export function createErrorBoundary(engine, { enabled = true, maxErrors = 25 } = {}) {
    const errors = [];
    let installed = false;
    function _push(kind, err, extra) {
        const rec = {
            t: _nowIso(),
            kind,
            message: (err && err.message) ? String(err.message) : String(err),
            stack: (err && err.stack) ? String(err.stack) : '',
            extra: extra ?? null
        };
        errors.push(rec);
        if (errors.length > maxErrors)
            errors.splice(0, errors.length - maxErrors);
        try {
            engine?.emit?.('engine:error', rec);
        }
        catch (_) { }
        try {
            engine?.log?.error?.('errorBoundary', rec.message, rec);
        }
        catch (_) { }
        return rec;
    }
    function handleError(event) {
        const err = event?.error || event;
        _push('error', err, { filename: event?.filename, lineno: event?.lineno, colno: event?.colno });
    }
    function handleRejection(event) {
        const reason = event?.reason || event;
        _push('unhandledrejection', reason);
    }
    function install() {
        if (!enabled)
            return;
        if (typeof window === 'undefined')
            return;
        if (installed) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[ErrorBoundary] Already installed, skipping duplicate installation');
            }
            return;
        }
        try {
            window.addEventListener('error', handleError);
            window.addEventListener('unhandledrejection', handleRejection);
            installed = true;
        }
        catch (_) { }
    }
    function uninstall() {
        if (typeof window === 'undefined')
            return;
        if (!installed)
            return;
        try {
            window.removeEventListener('error', handleError);
            window.removeEventListener('unhandledrejection', handleRejection);
            installed = false;
        }
        catch (_) { }
    }
    function buildReport({ includeState = false } = {}) {
        const report = {
            t: _nowIso(),
            patch: engine?.patch || '',
            patchName: engine?.patchName || '',
            userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '',
            pluginReport: (() => { try {
                return engine?.getPluginReport?.();
            }
            catch (_) {
                return null;
            } })(),
            lastEvents: (() => { try {
                return engine?.events?.getRecords?.();
            }
            catch (_) {
                return null;
            } })(),
            lastCommands: (() => { try {
                return engine?.commands?.getLog?.();
            }
            catch (_) {
                return null;
            } })(),
            log: (() => { try {
                return engine?.log?.getRecords?.();
            }
            catch (_) {
                return null;
            } })(),
            errors: errors.slice()
        };
        if (includeState) {
            try {
                report.state = engine?.getState?.();
            }
            catch (_) { }
        }
        return report;
    }
    return { install, uninstall, getErrors: () => errors.slice(), buildReport, isInstalled: () => installed };
}
//# sourceMappingURL=errorBoundary.js.map