// js/game/utils/timing.js
// Tiny timing helpers used by gameplay/UI code.
//
// Goal: prefer the Engine scheduler (engine.schedule) for any "timer-ish" work,
// but provide a safe fallback that avoids setTimeout.

function _safe(fn) {
  try { return typeof fn === 'function' ? fn : null } catch (_) { return null }
}

function _now() {
  try {
    if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
      return performance.now()
    }
  } catch (_) {}
  try { return Date.now() } catch (_) { return 0 }
}

// Queue a task without using setTimeout.
// Prefer MessageChannel (macrotask), else fall back to a microtask.
function _postTask(fn) {
  const f = _safe(fn)
  if (!f) return () => {}

  // MessageChannel macrotask (widely supported in browsers).
  try {
    if (typeof MessageChannel === 'function') {
      const ch = new MessageChannel()
      let canceled = false

      ch.port1.onmessage = () => {
        if (canceled) return
        try { ch.port1.onmessage = null } catch (_) {}
        try { f() } catch (_) {}
      }

      try { ch.port2.postMessage(0) } catch (_) {
        // Fallback to microtask if posting fails.
        try { Promise.resolve().then(() => { if (!canceled) f() }) } catch (_) { try { f() } catch (_) {} }
      }

      return () => {
        canceled = true
        try { ch.port1.onmessage = null } catch (_) {}
      }
    }
  } catch (_) {}

  // Microtask fallback.
  let canceled = false
  try { Promise.resolve().then(() => { if (!canceled) { try { f() } catch (_) {} } }) } catch (_) {
    try { f() } catch (_) {}
  }
  return () => { canceled = true }
}

// Run on the next microtask tick (0ms debounce/coalescing).
export function nextTick(fn) {
  const f = _safe(fn)
  if (!f) return
  try {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(f)
      return
    }
  } catch (_) {}
  try { Promise.resolve().then(f) } catch (_) {
    // last resort: sync
    try { f() } catch (_) {}
  }
}

// requestAnimationFrame-based delay. Returns a cancelable handle.
// If requestAnimationFrame is unavailable, falls back to a MessageChannel/microtask loop.
export function rafDelay(ms, fn) {
  const f = _safe(fn)
  if (!f) return { cancel() {} }

  const delay = Math.max(0, Number(ms) || 0)
  let canceled = false
  let start = null
  let rafId = null

  const hasRaf = (typeof requestAnimationFrame === 'function')

  function done() {
    if (canceled) return
    try { f() } catch (_) {}
  }

  function step(t) {
    if (canceled) return
    const now = (typeof t === 'number') ? t : _now()
    if (start == null) start = now

    if ((now - start) >= delay) {
      done()
      return
    }

    if (hasRaf) {
      try { rafId = requestAnimationFrame(step) } catch (_) { _postTask(() => step(_now())) }
    } else {
      _postTask(() => step(_now()))
    }
  }

  if (hasRaf) {
    try { rafId = requestAnimationFrame(step) } catch (_) { _postTask(() => step(_now())) }
  } else {
    _postTask(() => step(_now()))
  }

  return {
    cancel() {
      canceled = true
      try { if (rafId != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafId) } catch (_) {}
    }
  }
}

// Prefer Engine scheduler when available, else fall back to rafDelay.
// Returns a handle with { cancel() }.
export function scheduleAfter(engine, ms, fn, opts = null) {
  try {
    const sch = engine && engine.schedule
    if (sch && typeof sch.after === 'function') {
      const id = sch.after(ms, fn, opts || null)
      return {
        cancel() {
          try { if (typeof sch.cancel === 'function') sch.cancel(id) } catch (_) {}
        }
      }
    }
  } catch (_) {}
  return rafDelay(ms, fn)
}
