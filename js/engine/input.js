// js/engine/input.js
// Input router (keyboard + pointer + touch) -> named actions. Engine-agnostic.

export function createInputRouter({ emit = null, logger = null } = {}) {
  const keyBindings = new Map() // key -> action
  const actionHandlers = new Map() // action -> Set<fn>

  // Context stack (top = highest priority). Used for modals, screens, etc.
  // Each context may provide:
  //  - keyBindings: Map<key, action>
  //  - actionHandlers: Map<action, Set<fn>>
  //  - consume: whether to stop propagation to lower contexts + global handlers
  const contexts = []

  let installed = false

  function _log(lvl, msg, data) {
    try { if (logger && logger[lvl]) logger[lvl]('input', msg, data) } catch (_) {}
  }

  function bindKey(key, action) {
    if (!key || !action) return
    keyBindings.set(_normKey(key), String(action))
  }

  function _normKey(key) {
    try { return String(key || '').toLowerCase() } catch (_) { return '' }
  }

  function pushContext(ctx = {}) {
    try {
      const id = String(ctx && ctx.id ? ctx.id : '').trim()
      if (!id) return null
      removeContext(id)

      const kmap = new Map()
      try {
        const b = ctx.bindings
        if (b && typeof b === 'object') {
          for (const [k, v] of Object.entries(b)) {
            const nk = _normKey(k)
            if (nk && v) kmap.set(nk, String(v))
          }
        }
      } catch (_) {}

      const hmap = new Map()
      try {
        const hs = ctx.handlers
        if (hs && typeof hs === 'object') {
          for (const [action, fns] of Object.entries(hs)) {
            const a = String(action || '')
            if (!a) continue
            const set = hmap.get(a) || new Set()
            if (typeof fns === 'function') set.add(fns)
            else if (Array.isArray(fns)) {
              for (const fn of fns) if (typeof fn === 'function') set.add(fn)
            }
            if (set.size) hmap.set(a, set)
          }
        }
      } catch (_) {}

      contexts.push({
        id,
        keyBindings: kmap,
        actionHandlers: hmap,
        consume: ctx.consume !== false,
        meta: ctx.meta || null,
      })
      return id
    } catch (_) {
      return null
    }
  }

  function removeContext(id) {
    const target = String(id || '').trim()
    if (!target) return
    for (let i = contexts.length - 1; i >= 0; i--) {
      if (contexts[i] && contexts[i].id === target) contexts.splice(i, 1)
    }
  }

  function clearContexts() {
    contexts.length = 0
  }

  function getContexts() {
    return contexts.map((c) => c.id)
  }

  function onAction(action, fn) {
    if (!action || typeof fn !== 'function') return
    const a = String(action)
    const set = actionHandlers.get(a) || new Set()
    set.add(fn)
    actionHandlers.set(a, set)
  }

  function offAction(action, fn) {
    const a = String(action || '')
    const set = actionHandlers.get(a)
    if (!set) return
    set.delete(fn)
  }

  function trigger(action, payload = {}) {
    const a = String(action || '')
    if (!a) return
    _log('debug', 'action', { action: a, payload })
    try { if (emit) emit('input:action', { action: a, payload }) } catch (_) {}

    // Context handlers: scan top-down; first handler set found may consume.
    for (let i = contexts.length - 1; i >= 0; i--) {
      const ctx = contexts[i]
      const set = ctx && ctx.actionHandlers ? ctx.actionHandlers.get(a) : null
      if (set && set.size) {
        for (const fn of set) {
          try { fn(payload) } catch (_) {}
        }
        if (ctx.consume !== false) return
        break
      }
    }

    const set = actionHandlers.get(a)
    if (!set) return
    for (const fn of set) {
      try { fn(payload) } catch (_) {}
    }
  }

  function _resolveKey(key) {
    const k = _normKey(key)
    if (!k) return { action: null, contextId: null }
    for (let i = contexts.length - 1; i >= 0; i--) {
      const ctx = contexts[i]
      const act = ctx && ctx.keyBindings ? ctx.keyBindings.get(k) : null
      if (act) return { action: act, contextId: ctx.id }
    }
    return { action: keyBindings.get(k) || null, contextId: null }
  }

  function _onKeyDown(e) {
    try {
      const key = String(e.key || '').toLowerCase()
      const resolved = _resolveKey(key)
      if (resolved && resolved.action) {
        trigger(resolved.action, { kind: 'key', key, contextId: resolved.contextId, originalEvent: null })
      }
    } catch (_) {}
  }

  function install() {
    if (installed) return
    installed = true
    if (typeof window === 'undefined') return
    try {
      window.addEventListener('keydown', _onKeyDown)
    } catch (_) {}
  }

  function uninstall() {
    if (!installed) return
    installed = false
    if (typeof window === 'undefined') return
    try { window.removeEventListener('keydown', _onKeyDown) } catch (_) {}
  }

  return {
    bindKey,
    onAction,
    offAction,
    trigger,
    pushContext,
    removeContext,
    clearContexts,
    getContexts,
    install,
    uninstall,
  }
}
