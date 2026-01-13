// js/engine/settings.js
// Persistent settings registry (engine-agnostic).
//
// Goals:
// - Single source of truth for user preferences (UI, audio, accessibility, etc.).
// - Dot-path keys (e.g. "a11y.reduceMotion").
// - Safe persistence (localStorage via injected get/set).
// - Emits settings:loaded and settings:changed.

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v) }

function _clone(v) {
  try { return JSON.parse(JSON.stringify(v)) } catch (_) { return v }
}

function _getPath(obj, path, fallback) {
  try {
    if (!obj) return fallback
    const parts = String(path || '').split('.').filter(Boolean)
    let cur = obj
    for (let i = 0; i < parts.length; i++) {
      if (!_isObj(cur)) return fallback
      cur = cur[parts[i]]
      if (cur === undefined) return fallback
    }
    return cur
  } catch (_) {
    return fallback
  }
}

function _setPath(obj, path, value) {
  const parts = String(path || '').split('.').filter(Boolean)
  if (!parts.length) return obj
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (!_isObj(cur[p])) cur[p] = {}
    cur = cur[p]
  }
  cur[parts[parts.length - 1]] = value
  return obj
}

export function createSettingsService({
  emit = null,
  logger = null,
  storageGet = null,
  storageSet = null,
  storageKey = 'locus_settings_v1',
  schema = 1
} = {}) {
  let _defaults = {}
  let _values = {}
  let _loaded = false

  function _log(lvl, msg, data) {
    try { if (logger && logger[lvl]) logger[lvl]('settings', msg, data) } catch (_) {}
  }

  function defineDefaults(obj) {
    if (!_isObj(obj)) return
    _defaults = { ..._defaults, ..._clone(obj) }
    // If defaults change after load, merge them in without overwriting explicit values.
    if (_loaded) {
      _values = _mergeDefaults(_defaults, _values)
    }
  }

  function _mergeDefaults(defs, cur) {
    const out = _clone(defs)
    // overlay cur on top of defaults
    const walk = (dst, src) => {
      if (!_isObj(src)) return
      Object.keys(src).forEach(k => {
        const sv = src[k]
        if (_isObj(sv)) {
          if (!_isObj(dst[k])) dst[k] = {}
          walk(dst[k], sv)
        } else {
          dst[k] = sv
        }
      })
    }
    walk(out, cur)
    return out
  }

  function load() {
    let raw = null
    try { raw = storageGet ? storageGet(storageKey) : null } catch (_) { raw = null }
    let parsed = null
    try { parsed = raw ? JSON.parse(raw) : null } catch (_) { parsed = null }

    if (parsed && typeof parsed === 'object') {
      const gotSchema = Number(parsed.schema)
      const vals = _isObj(parsed.values) ? parsed.values : {}
      // Future: migrations could go here. For now, accept unknown keys.
      if (Number.isFinite(gotSchema) && gotSchema > schema) {
        _log('warn', 'settings schema is newer than engine schema; loading best-effort.', { gotSchema, schema })
      }
      _values = _mergeDefaults(_defaults, vals)
    } else {
      _values = _mergeDefaults(_defaults, {})
    }

    _loaded = true
    try { if (emit) emit('settings:loaded', { key: storageKey }) } catch (_) {}
    return getAll()
  }

  function save() {
    try {
      if (!storageSet) return false
      const payload = JSON.stringify({ schema, values: _values })
      storageSet(storageKey, payload, { action: 'settings' })
      return true
    } catch (e) {
      _log('warn', 'settings save failed', { e })
      return false
    }
  }

  function get(key, fallback = null) {
    return _getPath(_values, key, fallback)
  }

  function set(key, value, { persist = true } = {}) {
    const k = String(key || '').trim()
    if (!k) return
    const prev = get(k, undefined)
    // Avoid noisy churn.
    const same = (() => {
      try { return JSON.stringify(prev) === JSON.stringify(value) } catch (_) { return prev === value }
    })()
    if (same) return
    _setPath(_values, k, value)
    try { if (emit) emit('settings:changed', { key: k, value }) } catch (_) {}
    if (persist) save()
  }

  function toggle(key, { persist = true } = {}) {
    const cur = !!get(key, false)
    set(key, !cur, { persist })
    return !cur
  }

  function reset({ persist = true } = {}) {
    _values = _mergeDefaults(_defaults, {})
    try { if (emit) emit('settings:reset', {}) } catch (_) {}
    if (persist) save()
  }

  function getAll() {
    return _clone(_values)
  }

  return {
    defineDefaults,
    load,
    save,
    get,
    set,
    toggle,
    reset,
    getAll
  }
}
