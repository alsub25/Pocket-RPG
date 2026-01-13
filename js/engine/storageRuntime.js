// js/engine/storageRuntime.js
// In-game localStorage wrapper with lightweight diagnostics.
//
// Boot code uses js/shared/storage/safeStorage.js directly.
// This module adds:
// - diagnostic breadcrumbs for save failures
// - a one-time in-game warning (via addLog) when storage is unavailable

import { safeStorageGet as baseGet, safeStorageSet as baseSet, safeStorageRemove as baseRemove } from '../shared/storage/safeStorage.js'

// Keep these keys stable for backwards compatibility with older reports.
export const _STORAGE_DIAG_KEY_LAST_CRASH = 'emberwood_last_crash_report_v1'
export const _STORAGE_DIAG_KEY_LAST_SAVE_FAIL = 'emberwood_last_save_error_v1'

let _storageWarnedThisSession = false

function noteStorageFailure(action, key, err) {
  try {
    const payload = {
      action: String(action || 'write'),
      key: String(key || ''),
      message: err && err.message ? String(err.message) : 'Storage failure',
      time: Date.now()
    }

    // Best-effort breadcrumb (this can fail too).
    try {
      baseSet(_STORAGE_DIAG_KEY_LAST_SAVE_FAIL, JSON.stringify(payload))
    } catch (_) {}

    if (!_storageWarnedThisSession) {
      _storageWarnedThisSession = true
      // Prefer in-game log; fall back to console.
      try {
        if (typeof window !== 'undefined' && typeof window.addLog === 'function') {
          window.addLog('⚠️ Storage is unavailable (private mode or full). Saves/settings may not persist.', 'danger')
        }
      } catch (_) {}
    }
  } catch (_) {
    // ignore
  }
}

function _onError(evt) {
  try {
    noteStorageFailure(evt && evt.action ? evt.action : 'write', evt && evt.key ? evt.key : '', evt && evt.err ? evt.err : null)
  } catch (_) {}
}

export function safeStorageGet(key) {
  return baseGet(key, { onError: _onError })
}

export function safeStorageSet(key, value, opts = {}) {
  return baseSet(key, value, { ...opts, onError: _onError })
}

export function safeStorageRemove(key, opts = {}) {
  return baseRemove(key, { ...opts, onError: _onError })
}
