// js/engine/commands.js
// Command bus with middleware and optional replay log.

function _nowIso() {
  try { return new Date().toISOString() } catch (_) { return '' }
}

export function createCommandBus({
  maxLog = 300,
  emit = null,     // optional engine.emit
  getState = null, // optional engine.getState
  setState = null  // optional engine.setState
} = {}) {
  const middlewares = []
  const log = []

  function use(mw) {
    if (typeof mw === 'function') middlewares.push(mw)
  }

  function _push(entry) {
    log.push(entry)
    if (log.length > maxLog) log.splice(0, log.length - maxLog)
  }

  function dispatch(command) {
    const cmd = command && typeof command === 'object' ? command : { type: String(command) }
    if (!cmd.type) cmd.type = 'UNKNOWN'

    const entry = {
      t: _nowIso(),
      type: String(cmd.type),
      payload: cmd.payload ?? null,
      meta: cmd.meta ?? null
    }

    // Compose middlewares like (ctx, next) => next()
    let idx = -1
    const ctx = {
      command: cmd,
      entry,
      getState: (typeof getState === 'function') ? getState : () => null,
      setState: (typeof setState === 'function') ? setState : () => {},
      emit: (typeof emit === 'function') ? emit : () => {}
    }

    function next() {
      idx++
      const mw = middlewares[idx]
      if (!mw) return
      return mw(ctx, next)
    }

    try { next() } catch (_) {}

    _push(entry)
    try { ctx.emit('command:dispatched', entry) } catch (_) {}
    return entry
  }

  function getLog() { return log.slice() }
  function clearLog() { log.length = 0 }

  function replay(entries, { onEntry = null } = {}) {
    const arr = Array.isArray(entries) ? entries : log
    for (let i = 0; i < arr.length; i++) {
      const e = arr[i]
      try { if (typeof onEntry === 'function') onEntry(e) } catch (_) {}
      dispatch({ type: e.type, payload: e.payload, meta: { ...(e.meta || {}), replay: true } })
    }
  }

  return { use, dispatch, getLog, clearLog, replay }
}
