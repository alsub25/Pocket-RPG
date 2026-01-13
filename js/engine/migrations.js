// js/engine/migrations.js
// Versioned migration registry (engine-agnostic).

export function createMigrationRegistry() {
  // fromVersion -> [{ to, migrate }]
  const map = new Map()

  function register(from, to, migrate) {
    const f = String(from || '').trim()
    const t = String(to || '').trim()
    if (!f || !t) return
    if (typeof migrate !== 'function') return
    const arr = map.get(f) || []
    arr.push({ to: t, migrate })
    map.set(f, arr)
  }

  function _findPath(from, to, maxSteps = 50) {
    // BFS to find any path
    const start = String(from || '').trim()
    const goal = String(to || '').trim()
    if (!start || !goal) return null
    if (start === goal) return []
    const q = [{ v: start, path: [] }]
    const seen = new Set([start])
    let steps = 0

    while (q.length && steps < 10000) {
      steps++
      const cur = q.shift()
      const edges = map.get(cur.v) || []
      for (let i = 0; i < edges.length; i++) {
        const e = edges[i]
        const nextV = e.to
        const nextPath = cur.path.concat([{ from: cur.v, to: nextV, migrate: e.migrate }])
        if (nextV === goal) return nextPath
        if (!seen.has(nextV) && nextPath.length <= maxSteps) {
          seen.add(nextV)
          q.push({ v: nextV, path: nextPath })
        }
      }
    }
    return null
  }

  function migrateState(state, fromVersion, toVersion) {
    const path = _findPath(fromVersion, toVersion)
    if (path == null) {
      const err = new Error(`No migration path from ${fromVersion} to ${toVersion}`)
      err.code = 'NO_MIGRATION_PATH'
      err.details = { fromVersion, toVersion }
      throw err
    }
    let s = state
    for (let i = 0; i < path.length; i++) {
      const step = path[i]
      s = step.migrate(s)
    }
    return s
  }

  function getReport() {
    const out = {}
    for (const [k, arr] of map.entries()) {
      out[k] = arr.map(x => x.to)
    }
    return out
  }

  return { register, migrateState, getReport }
}
