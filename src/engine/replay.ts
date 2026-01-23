// js/engine/replay.js
// Replay recorder / player.
// Records command dispatches and (optionally) an initial snapshot.

function _nowIso() {
  try { return new Date().toISOString() } catch (_) { return '' }
}

function _safeJson(obj) {
  try { return JSON.stringify(obj) } catch (_) { return null }
}

export function createReplay(engine, {
  owner = 'system:replay',
  maxCommands = 3000
} = {}) {
  let _recording = false
  let _tape = null
  let _listener = null
  let _lastTape = null

  function isRecording() { return !!_recording }
  function getLastTape() { return _lastTape }

  function startRecording({ name = 'replay', includeSnapshot = true } = {}) {
    if (_recording) return false
    _recording = true

    const seed = (() => {
      try { return engine?.rng?.getSeed?.() ?? engine?.rng?.rootSeed ?? null } catch (_) { return null }
    })()
    const snapshot = (includeSnapshot && engine?.save) ? (() => {
      try { return engine.save({ kind: 'replay', name }) } catch (_) { return null }
    })() : null

    _tape = {
      v: 1,
      name: String(name || 'replay'),
      patch: engine?.patch || '',
      patchName: engine?.patchName || '',
      startedAt: _nowIso(),
      seed,
      snapshot,
      commands: []
    }

    _listener = (entry) => {
      if (!_tape || !_recording) return
      try {
        const cmd = entry && entry.command ? entry.command : entry
        if (!cmd || typeof cmd.type !== 'string') return
        _tape.commands.push({ t: entry?.t || _nowIso(), cmd: { type: cmd.type, payload: cmd.payload ?? null } })
        if (_tape.commands.length > maxCommands) {
          _tape.commands.splice(0, _tape.commands.length - maxCommands)
        }
      } catch (_) {}
    }

    try { engine?.on?.('command:dispatched', _listener) } catch (_) {}
    try { engine?.emit?.('replay:recordingStart', { t: _nowIso(), name: _tape.name }) } catch (_) {}
    return true
  }

  function stopRecording() {
    if (!_recording) return null
    _recording = false
    try { if (_listener) engine?.off?.('command:dispatched', _listener) } catch (_) {}
    _listener = null

    if (_tape) {
      _tape.stoppedAt = _nowIso()
      try { engine?.emit?.('replay:recordingStop', { t: _tape.stoppedAt, name: _tape.name, commands: _tape.commands.length }) } catch (_) {}
      _lastTape = _tape
    }
    const out = _tape
    _tape = null
    return out
  }

  function exportTape(tape) {
    const t = tape || _lastTape
    return _safeJson(t)
  }

  function importTape(json) {
    if (!json) return null
    try {
      const t = typeof json === 'string' ? JSON.parse(json) : json
      if (!t || typeof t !== 'object') return null
      if (!Array.isArray(t.commands)) t.commands = []
      return t
    } catch (_) {
      return null
    }
  }

  function getLastMeta() {
    const t = _lastTape
    if (!t) return null
    return {
      name: t.name,
      startedAt: t.startedAt,
      stoppedAt: t.stoppedAt || null,
      seed: t.seed ?? null,
      commandCount: Array.isArray(t.commands) ? t.commands.length : 0,
      hasSnapshot: !!t.snapshot
    }
  }

  async function play(tape, {
    immediate = false,
    intervalMs = 0
  } = {}) {
    const t = tape || _lastTape
    if (!t) return false
    try { engine?.emit?.('replay:playStart', { t: _nowIso(), name: t.name }) } catch (_) {}

    // Load snapshot (if present)
    if (t.snapshot && engine?.load) {
      try { engine.load(t.snapshot, { reason: 'replay' }) } catch (_) {}
    }

    // Apply seed
    if (t.seed != null && engine?.rng?.setSeed) {
      try { engine.rng.setSeed(t.seed) } catch (_) {}
    }

    const cmds = Array.isArray(t.commands) ? t.commands.slice() : []
    if (!cmds.length) {
      try { engine?.emit?.('replay:playEnd', { t: _nowIso(), name: t.name, commands: 0 }) } catch (_) {}
      return true
    }

    const dispatchOne = (rec) => {
      try {
        const c = rec && rec.cmd ? rec.cmd : null
        if (!c) return
        engine?.dispatch?.({ type: c.type, payload: c.payload })
      } catch (_) {}
    }

    if (immediate || !engine?.schedule?.after || intervalMs <= 0) {
      for (let i = 0; i < cmds.length; i++) dispatchOne(cmds[i])
      try { engine?.emit?.('replay:playEnd', { t: _nowIso(), name: t.name, commands: cmds.length }) } catch (_) {}
      return true
    }

    // Scheduled playback
    return new Promise((resolve) => {
      let i = 0
      const step = () => {
        if (i >= cmds.length) {
          try { engine?.emit?.('replay:playEnd', { t: _nowIso(), name: t.name, commands: cmds.length }) } catch (_) {}
          resolve(true)
          return
        }
        dispatchOne(cmds[i])
        i += 1
        try {
          engine.schedule.after(intervalMs, step, { owner })
        } catch (_) {
          step()
        }
      }
      step()
    })
  }

  function stopPlayback() {
    try { engine?.schedule?.cancelOwner?.(owner) } catch (_) {}
  }

  function dispose() {
    try { stopRecording() } catch (_) {}
    try { stopPlayback() } catch (_) {}
  }

  return {
    isRecording,
    startRecording,
    stopRecording,
    play,
    stopPlayback,
    exportTape,
    importTape,
    getLastTape,
    getLastMeta,
    dispose
  }
}
