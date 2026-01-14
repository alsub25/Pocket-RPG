// js/engine/snapshots.js
// Snapshot save/load helper with lightweight checksum (works under file://).

function _nowIso() {
  try { return new Date().toISOString() } catch (_) { return '' }
}

/**
 * FNV-1a 32-bit hash function
 * @param {string} str - String to hash
 * @returns {string} - Hex string representation of hash
 */
export function fnv1a32(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * Deterministic JSON stringify with key sorting
 * @param {*} obj - Object to stringify
 * @returns {string} - Deterministic JSON string
 */
export function stableStringify(obj) {
  // Deterministic JSON stringify with key sorting.
  const seen = new WeakSet()

  function walk(v) {
    if (v && typeof v === 'object') {
      if (seen.has(v)) return '[Circular]'
      seen.add(v)

      if (Array.isArray(v)) return v.map(walk)

      const keys = Object.keys(v).sort()
      const out = {}
      for (let i = 0; i < keys.length; i++) out[keys[i]] = walk(v[keys[i]])
      return out
    }
    return v
  }

  return JSON.stringify(walk(obj))
}

// Keep internal versions for backward compatibility
function _fnv1a32(str) {
  return fnv1a32(str)
}

function _stableStringify(obj) {
  return stableStringify(obj)
}

export function createSnapshotManager({
  getState,
  setState,
  getVersion,
  migrateState, // (state, fromVersion, toVersion) => state
  emit = null,
  logger = null
} = {}) {
  function _log(lvl, msg, data) {
    try {
      if (logger && logger[lvl]) logger[lvl]('snapshots', msg, data)
    } catch (_) {}
  }

  function save(meta = {}) {
    const state = (typeof getState === 'function') ? getState() : null
    const version = (typeof getVersion === 'function') ? String(getVersion() || '') : ''
    const payload = { version, state, meta: meta || {}, savedAt: _nowIso() }
    const json = _stableStringify(payload)
    const checksum = _fnv1a32(json)
    const snap = { ...payload, checksum, checksumAlg: 'fnv1a32' }
    try { if (emit) emit('save:created', { version, checksum }) } catch (_) {}
    return snap
  }

  function validate(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return { ok: false, reason: 'invalid_snapshot' }
    const json = _stableStringify({ version: snapshot.version, state: snapshot.state, meta: snapshot.meta || {}, savedAt: snapshot.savedAt || '' })
    const expected = _fnv1a32(json)
    if (snapshot.checksum && snapshot.checksum !== expected) return { ok: false, reason: 'checksum_mismatch', expected }
    return { ok: true }
  }

  function load(snapshot, { allowMigrate = true } = {}) {
    const v = validate(snapshot)
    if (!v.ok) {
      _log('warn', 'Snapshot validation failed', v)
      const err = new Error(`Snapshot validation failed: ${v.reason}`)
      err.code = 'SNAPSHOT_INVALID'
      err.details = v
      throw err
    }

    const currentVersion = (typeof getVersion === 'function') ? String(getVersion() || '') : ''
    let nextState = snapshot.state
    const from = String(snapshot.version || '')
    const to = String(currentVersion || '')

    if (allowMigrate && from && to && from !== to && typeof migrateState === 'function') {
      try {
        nextState = migrateState(nextState, from, to)
        _log('info', 'Migrated snapshot state', { from, to })
      } catch (e) {
        _log('error', 'Migration failed', { from, to, e })
        throw e
      }
    }

    if (typeof setState === 'function') {
      // Use metadata-enhanced setState if available (engine.setState accepts 2nd param)
      try {
        setState(nextState, { reason: 'save:loaded', fromVersion: from, toVersion: to })
      } catch (_) {
        // Fallback for legacy setState signature
        setState(nextState)
      }
    }
    try { if (emit) emit('save:loaded', { fromVersion: from, toVersion: to }) } catch (_) {}
    return nextState
  }

  return { save, load, validate }
}
