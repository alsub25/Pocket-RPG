// js/engine/uiRouter.js
// Modal stack / UI router with adapter hooks (engine-agnostic).

export function createUiRouter({ emit = null, logger = null } = {}) {
  const stack = [] // [{ id, props }]
  let adapter = null // { open(id, props), close(id) }

  function _log(lvl, msg, data) {
    try { if (logger && logger[lvl]) logger[lvl]('ui', msg, data) } catch (_) {}
  }

  function setAdapter(next) { adapter = next || null }
  function getAdapter() { return adapter }

  function open(id, props = {}) {
    const modalId = String(id || '')
    if (!modalId) return
    stack.push({ id: modalId, props: props || {} })
    _log('info', 'open', { id: modalId })
    try { if (adapter && typeof adapter.open === 'function') adapter.open(modalId, props) } catch (_) {}
    try { if (emit) emit('ui:open', { id: modalId, props }) } catch (_) {}
  }

  function close(id = null) {
    if (stack.length === 0) return
    const target = id ? String(id) : stack[stack.length - 1].id
    let removed = null
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i].id === target) { removed = stack.splice(i, 1)[0]; break }
    }
    if (!removed) return
    _log('info', 'close', { id: removed.id })
    try { if (adapter && typeof adapter.close === 'function') adapter.close(removed.id) } catch (_) {}
    try { if (emit) emit('ui:close', { id: removed.id }) } catch (_) {}
  }

  function current() { return stack.length ? stack[stack.length - 1] : null }
  function list() { return stack.slice() }
  function clear() { stack.length = 0 }

  return { open, close, current, list, clear, setAdapter, getAdapter }
}
