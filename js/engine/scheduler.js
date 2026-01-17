// js/engine/scheduler.js
// Deterministic scheduler driven by engine clock ticks.

let _idSeq = 0

export function createScheduler(clock, { maxTasks = 10000 } = {}) {
  const tasks = new Map() // id -> task
  const order = []        // stable insertion ordering
  const owners = new Map() // owner -> Set<id>

  function _newId() { return `t${++_idSeq}` }

  function _indexOwner(owner, id) {
    const key = String(owner || '').trim()
    if (!key) return
    let set = owners.get(key)
    if (!set) { set = new Set(); owners.set(key, set) }
    set.add(String(id))
  }

  function _unindexOwner(owner, id) {
    const key = String(owner || '').trim()
    if (!key) return
    const set = owners.get(key)
    if (!set) return
    set.delete(String(id))
    if (set.size === 0) owners.delete(key)
  }

  function _add(task) {
    if (tasks.size >= maxTasks) throw new Error('Scheduler task limit reached')
    tasks.set(task.id, task)
    order.push(task.id)
    try { if (task && task.owner) _indexOwner(task.owner, task.id) } catch (_) {}
    return task.id
  }

  function after(ms, fn, opts = null) {
    // Validate function parameter
    if (typeof fn !== 'function') {
      const err = new Error('scheduler.after() requires a function callback')
      err.code = 'INVALID_CALLBACK'
      throw err
    }
    
    const delay = Math.max(0, Number(ms) || 0)
    const owner = (opts && typeof opts === 'object' && opts.owner != null) ? String(opts.owner) : ''
    const id = _newId()
    return _add({
      id,
      type: 'after',
      due: clock.nowMs + delay,
      interval: 0,
      fn,
      owner,
      canceled: false
    })
  }

  function every(ms, fn, { immediate = false, owner = '' } = {}) {
    // Validate function parameter
    if (typeof fn !== 'function') {
      const err = new Error('scheduler.every() requires a function callback')
      err.code = 'INVALID_CALLBACK'
      throw err
    }
    
    const interval = Math.max(1, Number(ms) || 1)
    const id = _newId()
    return _add({
      id,
      type: 'every',
      due: clock.nowMs + (immediate ? 0 : interval),
      interval,
      fn,
      owner: String(owner || ''),
      canceled: false
    })
  }

  function cancel(id) {
    const key = String(id || '')
    const t = tasks.get(key)
    if (!t) return false
    t.canceled = true
    tasks.delete(key)
    try { _unindexOwner(t.owner, key) } catch (_) {}
    return true
  }

  function cancelOwner(owner) {
    const key = String(owner || '').trim()
    if (!key) return 0
    const set = owners.get(key)
    if (!set || set.size === 0) return 0
    const ids = Array.from(set)
    let n = 0
    for (let i = 0; i < ids.length; i++) {
      if (cancel(ids[i])) n++
    }
    // cancel() will unindex; but ensure we don't keep an empty set around.
    try { if (owners.get(key) && owners.get(key).size === 0) owners.delete(key) } catch (_) {}
    return n
  }

  function clear() {
    tasks.clear()
    order.length = 0
    owners.clear()
  }

  /**
   * Run tasks whose due time has passed. Should be called after clock.tick().
   */
  function pump({ maxRuns = 5000 } = {}) {
    let runs = 0
    const now = clock.nowMs
    // Stable order: iterate by insertion, but allow deletions.
    for (let i = 0; i < order.length; i++) {
      if (runs >= maxRuns) break
      const id = order[i]
      const t = tasks.get(id)
      if (!t) continue
      if (t.canceled) {
        tasks.delete(id)
        try { _unindexOwner(t.owner, id) } catch (_) {}
        continue
      }
      if (t.due > now) continue

      runs++
      try { if (t.fn) t.fn({ nowMs: now, id }) } catch (_) {}

      if (t.type === 'every' && t.interval > 0) {
        // catch-up: schedule next due in the future
        let nextDue = t.due
        while (nextDue <= now) nextDue += t.interval
        t.due = nextDue
      } else {
        tasks.delete(id)
        try { _unindexOwner(t.owner, id) } catch (_) {}
      }
    }

    // Compact order occasionally
    if (order.length > 0 && tasks.size < order.length * 0.6) {
      const next = []
      for (let i = 0; i < order.length; i++) if (tasks.has(order[i])) next.push(order[i])
      order.length = 0
      order.push(...next)
    }

    return runs
  }

  return { after, every, cancel, cancelOwner, clear, pump }
}
