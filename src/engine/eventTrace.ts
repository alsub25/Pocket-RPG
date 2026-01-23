// js/engine/eventTrace.js
// Ring buffer for emitted engine events (helps bug reports).

function _nowIso() {
  try { return new Date().toISOString() } catch (_) { return '' }
}

export function createEventTrace({ maxRecords = 200 } = {}) {
  const records = []
  let seq = 0
  function push(name, payload) {
    records.push({ seq: ++seq, t: _nowIso(), name: String(name || ''), payload: payload ?? null })
    if (records.length > maxRecords) records.splice(0, records.length - maxRecords)
  }
  return { push, getRecords: () => records.slice(), clear: () => { records.length = 0 } }
}
