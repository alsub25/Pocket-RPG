// js/engine/uiCompose.js
// Lightweight UI composition surface (toast/busy/transition/HUD).
// Engine owns the API; the game installs a DOM adapter.

function _nowIso() {
  try { return new Date().toISOString() } catch (_) { return '' }
}

export function createUiCompose({
  emit = null,
  schedule = null,
  logger = null
} = {}) {
  let _adapter = null

  function setAdapter(adapter) {
    _adapter = adapter && typeof adapter === 'object' ? adapter : null
  }

  function getAdapter() {
    return _adapter
  }

  function toast(message, opts = {}) {
    const payload = { t: _nowIso(), message: String(message ?? ''), opts: opts || {} }
    try { emit && emit('uiCompose:toast', payload) } catch (_) {}
    try { _adapter?.toast?.(payload.message, payload.opts) } catch (e) {
      try { logger?.warn?.('uiCompose', 'toast adapter failed', { e }) } catch (_) {}
    }
  }

  function setBusy(isBusy, opts = {}) {
    const payload = { t: _nowIso(), isBusy: !!isBusy, opts: opts || {} }
    try { emit && emit('uiCompose:busy', payload) } catch (_) {}
    try { _adapter?.setBusy?.(payload.isBusy, payload.opts) } catch (e) {
      try { logger?.warn?.('uiCompose', 'busy adapter failed', { e }) } catch (_) {}
    }
  }

  function transition(name = 'fade', opts = {}) {
    const payload = { t: _nowIso(), name: String(name || 'fade'), opts: opts || {} }
    try { emit && emit('uiCompose:transition', payload) } catch (_) {}
    try { _adapter?.transition?.(payload.name, payload.opts) } catch (e) {
      try { logger?.warn?.('uiCompose', 'transition adapter failed', { e }) } catch (_) {}
    }

    // Optional auto-clear: if adapter doesn't handle it, remove after duration.
    const durationMs = Number(payload.opts.durationMs)
    if (schedule && Number.isFinite(durationMs) && durationMs > 0) {
      try {
        schedule.after(durationMs, () => {
          try { _adapter?.clearTransition?.(payload.name) } catch (_) {}
        }, { owner: 'uiCompose:transition' })
      } catch (_) {}
    }
  }

  function setHudState(hudState = {}) {
    const payload = { t: _nowIso(), hudState: hudState || {} }
    try { emit && emit('uiCompose:hud', payload) } catch (_) {}
    try { _adapter?.setHudState?.(payload.hudState) } catch (e) {
      try { logger?.warn?.('uiCompose', 'hud adapter failed', { e }) } catch (_) {}
    }
  }

  return { setAdapter, getAdapter, toast, setBusy, transition, setHudState }
}