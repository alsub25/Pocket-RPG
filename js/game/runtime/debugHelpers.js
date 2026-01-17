/* =============================================================================
 * Debug and Harness Helpers
 * Patch: 1.2.72 — The Blackbark Oath — Refactored from gameOrchestrator.js
 *
 * Extracted debugging, crash reporting, and diagnostics helpers to reduce
 * monolithic orchestration risk.
 * ============================================================================= */

import { safeStorageGet, safeStorageSet, safeStorageRemove } from '../../engine/storageRuntime.js'
import { _STORAGE_DIAG_KEY_LAST_CRASH } from '../../engine/storageRuntime.js'

// Track the most recent crash for bug reports
let lastCrashReport = null

/**
 * Record a crash/error for bug reporting
 * @param {string} kind - Type of error ('error', 'unhandledrejection', etc.)
 * @param {Error|string} err - Error object or message
 * @param {Object} extra - Additional context
 */
export function recordCrash(kind, err, extra = {}) {
    try {
        const message =
            (err && err.message) ||
            (typeof err === 'string' ? err : '') ||
            'Unknown error'
        const stack = err && err.stack ? String(err.stack) : ''
        
        lastCrashReport = {
            kind,
            message: String(message),
            stack: stack,
            time: Date.now(),
            extra
        }

        try {
            safeStorageSet(_STORAGE_DIAG_KEY_LAST_CRASH, JSON.stringify(lastCrashReport), { action: 'write crash report' })
        } catch (_) {}

        // Keep a short in-game breadcrumb too (if addLog available)
        try {
            if (extra.addLog && typeof extra.addLog === 'function') {
                extra.addLog('⚠️ An error occurred. Use Feedback to copy a report.', 'danger')
            }
        } catch (_) {}
    } catch (_) {
        // ignore
    }
}

/**
 * Get the last crash report (if any)
 * @returns {Object|null} Last crash report
 */
export function getLastCrashReport() {
    return lastCrashReport
}

/**
 * Initialize crash catcher (global error handlers)
 * @param {Object} opts - Options including patch/schema/state access
 */
export function initCrashCatcher(opts = {}) {
    if (window.__pqCrashCatcherInstalled) return
    window.__pqCrashCatcherInstalled = true

    const { GAME_PATCH, SAVE_SCHEMA, getState, addLog } = opts

    // Restore the last crash report (if any) so Feedback can include it after reload.
    // To reduce confusion, we auto-expire stale crash reports (e.g., from prior patches/sessions).
    try {
        const raw = safeStorageGet(_STORAGE_DIAG_KEY_LAST_CRASH)
        if (raw) {
            const parsed = JSON.parse(raw)
            const now = Date.now()
            const tooOld = parsed && typeof parsed.time === 'number' ? (now - parsed.time) > 1000 * 60 * 60 * 12 : false
            const wrongPatch = parsed && parsed.patch && typeof GAME_PATCH === 'string' ? parsed.patch !== GAME_PATCH : false
            if (parsed && typeof parsed === 'object' && !tooOld && !wrongPatch) {
                lastCrashReport = parsed
            } else {
                safeStorageRemove(_STORAGE_DIAG_KEY_LAST_CRASH)
            }
        }
    } catch (_) {}

    window.addEventListener('error', (e) => {
        const state = getState && getState()
        recordCrash(
            'error',
            e && e.error ? e.error : new Error(e && e.message ? e.message : 'Script error'),
            { 
                filename: e && e.filename, 
                lineno: e && e.lineno, 
                colno: e && e.colno,
                patch: GAME_PATCH,
                schema: SAVE_SCHEMA,
                area: state && state.area ? state.area : null,
                player: state && state.player ? {
                    name: state.player.name,
                    classId: state.player.classId,
                    level: state.player.level
                } : null,
                addLog
            }
        )
    })

    window.addEventListener('unhandledrejection', (e) => {
        const state = getState && getState()
        const reason = e && e.reason ? e.reason : new Error('Unhandled promise rejection')
        recordCrash('unhandledrejection', reason, {
            patch: GAME_PATCH,
            schema: SAVE_SCHEMA,
            area: state && state.area ? state.area : null,
            player: state && state.player ? {
                name: state.player.name,
                classId: state.player.classId,
                level: state.player.level
            } : null,
            addLog
        })
    })
}

/**
 * Copy text to clipboard (with fallback)
 * @param {string} text - Text to copy
 * @returns {Promise} Promise that resolves when copied
 */
export function copyFeedbackToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text)
    }

    return new Promise((resolve, reject) => {
        try {
            const temp = document.createElement('textarea')
            temp.value = text
            temp.style.position = 'fixed'
            temp.style.left = '-9999px'
            document.body.appendChild(temp)
            temp.select()
            const OK = document.execCommand('copy')
            document.body.removeChild(temp)
            OK ? resolve() : reject()
        } catch (e) {
            reject(e)
        }
    })
}
