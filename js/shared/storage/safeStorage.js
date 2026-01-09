// js/shared/storage/safeStorage.js
// Shared localStorage helpers used in both early-boot and in-game runtime.
//
// These helpers never throw; they return null/false on failure.
//
// Optional opts:
// - fallback: value returned by safeStorageGet on failure (default null)
// - onError: callback({ action, key, err }) invoked on failures
// - action: string label for set/remove operations (default 'write'/'remove')

function _callOnError(onError, payload) {
  try {
    if (typeof onError === 'function') onError(payload)
  } catch (_) {
    // ignore
  }
}

export function safeStorageGet(key, opts = {}) {
  try {
    return localStorage.getItem(key)
  } catch (err) {
    _callOnError(opts.onError, { action: 'read', key: String(key || ''), err })
    return Object.prototype.hasOwnProperty.call(opts, 'fallback') ? opts.fallback : null
  }
}

export function safeStorageSet(key, value, opts = {}) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (err) {
    _callOnError(opts.onError, { action: String(opts.action || 'write'), key: String(key || ''), err })
    return false
  }
}

export function safeStorageRemove(key, opts = {}) {
  try {
    localStorage.removeItem(key)
    return true
  } catch (err) {
    _callOnError(opts.onError, { action: String(opts.action || 'remove'), key: String(key || ''), err })
    return false
  }
}
