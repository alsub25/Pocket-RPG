// js/game/engine/perf.js
// Lightweight perf ring-buffer + wrappers for profiling hot paths.
//
// Dev-only; opt-in via state.debug.capturePerf.
//
// Patch 1.2.65: supports subsystem tagging so QA tools can surface
// worst offenders by domain (combat / HUD / save / loot / village).

const _KNOWN_SUBSYSTEMS = new Set(['combat', 'hud', 'save', 'loot', 'village', 'qa', 'engine', 'pacing'])

function _normSubsystem(x) {
  try {
    const s = String(x || '').trim().toLowerCase()
    if (!s) return null
    // Only accept known subsystem tokens to avoid accidentally treating
    // labels containing ':' as subsystem-prefixed.
    return _KNOWN_SUBSYSTEMS.has(s) ? s : null
  } catch (_) {
    return null
  }
}

function _splitLabel(label) {
  const raw = String(label || '')
  // Accept either "sub:label" or "sub::label".
  const m = raw.match(/^([a-zA-Z]+)\s*:{1,2}\s*(.+)$/)
  if (!m) return { subsystem: null, label: raw }
  const sub = _normSubsystem(m[1])
  if (!sub) return { subsystem: null, label: raw }
  const rest = String(m[2] || '').trim()
  return { subsystem: sub, label: rest || '' }
}

export function _perfNow() {
  try {
    if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
      return performance.now()
    }
  } catch (_) {}
  return Date.now()
}

export function _ensurePerfDebug(s) {
  try {
    if (!s || typeof s !== 'object') return null
    if (!s.debug || typeof s.debug !== 'object') s.debug = {}
    const d = s.debug
    if (typeof d.capturePerf !== 'boolean') d.capturePerf = false
    if (!Array.isArray(d.perfLog)) d.perfLog = []
    return d
  } catch (_) {
    return null
  }
}

export function perfRecord(s, label, ms, extra = null) {
  const d = _ensurePerfDebug(s)
  if (!d || !d.capturePerf) return
  try {
    const rawLabel = String(label || '')

    // Subsystem can be supplied in extra OR encoded in label via "sub:label".
    let subsystem = null
    if (extra && typeof extra === 'object') {
      subsystem = _normSubsystem(extra.subsystem || extra.sub || extra.domain)
    }
    const split = _splitLabel(rawLabel)
    if (!subsystem && split.subsystem) subsystem = split.subsystem
    const baseLabel = (split.subsystem ? split.label : rawLabel)

    const entry = {
      t: Date.now(),
      subsystem: subsystem || null,
      label: String(baseLabel || ''),
      ms: Number.isFinite(Number(ms)) ? Number(ms) : null,
      extra: extra || null
    }
    d.perfLog.push(entry)
    if (d.perfLog.length > 200) d.perfLog.splice(0, d.perfLog.length - 200)
  } catch (_) {}
}

export function perfWrap(s, label, extra, fn) {
  const t0 = _perfNow()
  try {
    return fn()
  } finally {
    const ms = _perfNow() - t0
    perfRecord(s, label, ms, extra)
  }
}

export async function perfWrapAsync(s, label, extra, fn) {
  const t0 = _perfNow()
  try {
    return await fn()
  } finally {
    const ms = _perfNow() - t0
    perfRecord(s, label, ms, extra)
  }
}

export function perfWrapSub(s, subsystem, label, extra, fn) {
  const sub = _normSubsystem(subsystem)
  const ex = (extra && typeof extra === 'object') ? { ...extra } : (extra || null)
  if (sub) {
    if (ex && typeof ex === 'object') ex.subsystem = sub
    // Encode in label too so plain-text tools still show the tag.
    return perfWrap(s, sub + ':' + String(label || ''), ex, fn)
  }
  return perfWrap(s, label, ex, fn)
}

export async function perfWrapAsyncSub(s, subsystem, label, extra, fn) {
  const sub = _normSubsystem(subsystem)
  const ex = (extra && typeof extra === 'object') ? { ...extra } : (extra || null)
  if (sub) {
    if (ex && typeof ex === 'object') ex.subsystem = sub
    return await perfWrapAsync(s, sub + ':' + String(label || ''), ex, fn)
  }
  return await perfWrapAsync(s, label, ex, fn)
}
