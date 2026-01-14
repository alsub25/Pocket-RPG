// js/engine/engine.js
// Locus Engine Core
//
// This module is intentionally game-agnostic.
// Emberwood-specific rules/content live in js/game/*.
//
// Core responsibilities:
// - Own the authoritative `state` reference.
// - Provide a tiny event bus for cross-module signaling.
// - Provide a service registry for dependency injection.
// - Provide a plugin lifecycle with dependency resolution (topological ordering).
// - Provide engine-grade services: clock/scheduler, commands, snapshots+migrations,
//   structured logs, RNG streams, perf watchdog, input routing, UI router, and a
//   headless harness.

import { createLogger } from './logger.js'
import { createEventTrace } from './eventTrace.js'
import { createClock } from './clock.js'
import { createScheduler } from './scheduler.js'
import { createCommandBus } from './commands.js'
import { createMigrationRegistry } from './migrations.js'
import { createSnapshotManager } from './snapshots.js'
import { createErrorBoundary } from './errorBoundary.js'
import { createRngService } from './rng.js'
import { createProfiler } from './profiler.js'
import { createAssetRegistry } from './assets.js'
import { createInputRouter } from './input.js'
import { createUiRouter } from './uiRouter.js'
import { createHarness } from './harness.js'
import { createFlagsService } from './flags.js'
import { createI18nService } from './i18n.js'
import { createUiCompose } from './uiCompose.js'
import { createSavePolicy } from './savePolicy.js'
import { createReplay } from './replay.js'
import { createTelemetry } from './telemetry.js'
import { createTweenService } from './tween.js'
import { createSettingsService } from './settings.js'
import { createA11yService } from './a11y.js'
import { createQaService } from './qa.js'
import { safeStorageGet, safeStorageSet } from './storageRuntime.js'

function _nowIso() {
  try { return new Date().toISOString() } catch (_) { return '' }
}

function _errInfo(e) {
  // Errors don't serialize well via JSON; capture the useful parts.
  try {
    if (!e) return null
    if (typeof e === 'string') return { message: e }
    return {
      name: e.name || 'Error',
      message: e.message || String(e),
      stack: e.stack || null
    }
  } catch (_) {
    return { message: 'Unknown error' }
  }
}

function _normId(v) {
  const s = String(v || '').trim()
  return s
}

/**
 * Plugin shape (all fields optional unless noted):
 * {
 *   id: string (required for dependency graph)
 *   requires?: string[]            // hard deps: missing => error
 *   optionalRequires?: string[]    // soft deps: missing => ignored
 *   init?(engine): void            // one-time init (service registration)
 *   start?(): void                 // start runtime work (timers, listeners)
 *   stop?(): void                  // stop runtime work
 *   dispose?(): void               // final cleanup
 * }
 */
export function createEngine({
  initialState = null,
  patch = '',
  patchName = '',
  // Engine service defaults (safe for file:// + headless).
  logger = null,
  clock = null,
  rngSeed = null,
  installErrorBoundary = true,
  startPerfWatchdog = true,
  autoInstallInput = true,
  autoTick = true,
  autoTickMode = 'raf'
} = {}) {
  let _state = initialState

// Auto tick-loop (drives clock + scheduler in live browser runtime).
// The engine can also be driven manually (tests/headless) by calling engine.tick(dtMs).
let _autoTickEnabled = !!autoTick
let _autoTickMode = (autoTickMode === 'timeout') ? 'timeout' : 'raf'
let _autoTickRunning = false
let _autoTickHandle = null
let _autoTickLastT = 0

  // Event listeners: eventName -> Set<fn>
  const _listeners = new Map()

  // Named services for DI (ui, storage, rng, etc.)
  const services = Object.create(null)

  // Owner-scoped disposables used for UI teardown (screens/modals/etc.).
  // Mirrors scheduler ownership (schedule.cancelOwner) but for arbitrary cleanup.
  const _ownerDisposables = new Map() // owner -> Set<fn>

  // Engine-grade instrumentation
  const log = logger || createLogger({ maxRecords: 500, consoleEcho: true, level: 'info' })
  const events = createEventTrace({ maxRecords: 250 })

  // ---- Event bus -----------------------------------------------------------

  function on(eventName, fn) {
    if (!eventName || typeof fn !== 'function') return
    const key = String(eventName)
    const set = _listeners.get(key) || new Set()
    set.add(fn)
    _listeners.set(key, set)
  }

  function off(eventName, fn) {
    const key = String(eventName || '')
    const set = _listeners.get(key)
    if (!set) return
    if (typeof fn === 'function') set.delete(fn)
    else set.clear()
  }

  function emit(eventName, payload) {
    const key = String(eventName || '')
    if (!key) return
    try { events.push(key, payload) } catch (_) {}

    const set = _listeners.get(key)
    if (!set || set.size === 0) return
    const arr = Array.from(set)
    for (let i = 0; i < arr.length; i++) {
      try { arr[i](payload) } catch (e) {
        try { log.warn('events', `listener failed for ${key}`, { e }) } catch (_) {}
      }
    }
  }

  // Convenience: owner-scoped event listener.
  // Equivalent to engine.on(...) + engine.own(owner, () => engine.off(...)).
  function listen(owner, eventName, fn) {
    if (!eventName || typeof fn !== 'function') return null
    const ev = String(eventName)
    on(ev, fn)
    own(owner, () => { try { off(ev, fn) } catch (_) {} })
    return fn
  }

  // ---- Services ------------------------------------------------------------

  // Core services that should never be accidentally overwritten
  const _coreServiceNames = new Set([
    'log', 'events', 'clock', 'schedule', 'commands', 'migrations', 'snapshots',
    'rng', 'perf', 'assets', 'settings', 'a11y', 'tween', 'input', 'uiRouter',
    'errorBoundary', 'harness', 'flags', 'i18n', 'uiCompose', 'savePolicy',
    'replay', 'telemetry', 'qa'
  ])

  function registerService(name, value, opts = {}) {
    if (!name) return
    const key = String(name)
    const { allowOverride = false } = opts || {}
    
    // Check for collision
    const existing = services[key]
    if (existing !== undefined && !allowOverride) {
      const isCoreService = _coreServiceNames.has(key)
      const msg = isCoreService
        ? `Attempted to overwrite core service: ${key}. Use { allowOverride: true } to force.`
        : `Service already registered: ${key}. Use { allowOverride: true } to replace.`
      
      try {
        log.warn('services', msg, { name: key, isCoreService })
      } catch (_) {}
      
      // Throw for core services to prevent silent failures
      if (isCoreService) {
        const err = new Error(msg)
        err.code = 'SERVICE_COLLISION'
        err.serviceName = key
        throw err
      } else {
        // Warn but allow for non-core services (backward compatibility)
        try {
          console.warn('[Engine] ' + msg)
        } catch (_) {}
      }
    }
    
    services[key] = value
  }

  function getService(name) {
    if (!name) return null
    return services[String(name)] ?? null
  }

  // ---- Owner disposables ---------------------------------------------------

  function own(owner, disposer) {
    const o = String(owner || '').trim()
    if (!o || typeof disposer !== 'function') return null
    const set = _ownerDisposables.get(o) || new Set()
    set.add(disposer)
    _ownerDisposables.set(o, set)
    return disposer
  }

  function disposeOwner(owner) {
    const o = String(owner || '').trim()
    if (!o) return
    const set = _ownerDisposables.get(o)
    if (!set || set.size === 0) {
      _ownerDisposables.delete(o)
      return
    }

    const arr = Array.from(set)
    _ownerDisposables.delete(o)
    for (let i = 0; i < arr.length; i++) {
      try { arr[i]() } catch (_) {}
    }
  }

  // ---- Plugin manager (dependency graph + lifecycle) -----------------------

  const _pluginById = new Map()   // id -> plugin
  const _insertionOrder = []      // ids, for stable ordering
  let _resolvedOrder = []         // plugins in topo order
  let _orderIsDirty = false

  const _inited = new Set()
  const _started = new Set()
  let _engineStarted = false

  function _engineError(code, message, details) {
    const err = {
      t: _nowIso(),
      code: String(code || 'ENGINE_ERROR'),
      message: String(message || ''),
      details: details ?? null
    }
    try { emit('engine:error', err) } catch (_) {}
    return err
  }

  function _normalizePlugin(plugin) {
    if (!plugin) return null
    if (typeof plugin === 'function') {
      // plugin factory
      try { plugin = plugin() } catch (e) {
        throw _engineError('PLUGIN_FACTORY_FAILED', 'Plugin factory threw during creation.', { e: _errInfo(e) })
      }
    }
    if (!plugin || typeof plugin !== 'object') return null

    const id = _normId(plugin.id)
    if (!id) throw _engineError('PLUGIN_MISSING_ID', 'Plugin is missing required `id`.', { plugin })

    const requires = Array.isArray(plugin.requires) ? plugin.requires.map(_normId).filter(Boolean) : []
    const optionalRequires = Array.isArray(plugin.optionalRequires) ? plugin.optionalRequires.map(_normId).filter(Boolean) : []
    return { ...plugin, id, requires, optionalRequires }
  }

  function use(pluginOrPlugins) {
    const list = Array.isArray(pluginOrPlugins) ? pluginOrPlugins : [pluginOrPlugins]
    for (let i = 0; i < list.length; i++) {
      const normalized = _normalizePlugin(list[i])
      if (!normalized) continue

      const id = normalized.id
      if (_pluginById.has(id)) {
        throw _engineError('PLUGIN_DUPLICATE_ID', `Plugin id already registered: ${id}`, { id })
      }

      _pluginById.set(id, normalized)
      _insertionOrder.push(id)
      _orderIsDirty = true

      // Late registration behavior: safe only if deps already started.
      if (_engineStarted) {
        for (let j = 0; j < normalized.requires.length; j++) {
          const dep = normalized.requires[j]
          if (!_started.has(dep)) {
            throw _engineError(
              'PLUGIN_LATE_REGISTER_MISSING_DEP',
              `Plugin ${id} cannot be registered after engine start because dependency ${dep} is not started.`,
              { id, dep }
            )
          }
        }
        _initPlugin(normalized)
        _startPlugin(normalized)
      }
    }
  }

  function getPlugin(id) {
    const k = _normId(id)
    if (!k) return null
    return _pluginById.get(k) || null
  }

  function listPlugins() {
    return _insertionOrder.slice()
  }

  function _resolveOrder() {
    if (!_orderIsDirty) return _resolvedOrder

    // Topological sort with stable tie-breaking by insertion order.
    const visited = new Map() // id -> 0=unvisited, 1=visiting, 2=done
    const order = []
    const stack = []

    function visit(id) {
      const state = visited.get(id) || 0
      if (state === 2) return
      if (state === 1) {
        const cycleStart = stack.indexOf(id)
        const cycle = (cycleStart >= 0) ? stack.slice(cycleStart).concat([id]) : stack.concat([id])
        throw _engineError('PLUGIN_DEP_CYCLE', `Dependency cycle detected: ${cycle.join(' -> ')}`, { cycle })
      }

      visited.set(id, 1)
      stack.push(id)

      const p = _pluginById.get(id)
      if (!p) {
        stack.pop()
        visited.set(id, 2)
        return
      }

      // Hard deps first
      for (let i = 0; i < p.requires.length; i++) {
        const dep = p.requires[i]
        if (!_pluginById.has(dep)) {
          throw _engineError(
            'PLUGIN_MISSING_DEP',
            `Plugin ${id} requires missing dependency ${dep}.`,
            { id, dep }
          )
        }
        visit(dep)
      }

      // Soft deps if present
      for (let i = 0; i < p.optionalRequires.length; i++) {
        const dep = p.optionalRequires[i]
        if (_pluginById.has(dep)) visit(dep)
      }

      stack.pop()
      visited.set(id, 2)
      order.push(p)
    }

    for (let i = 0; i < _insertionOrder.length; i++) {
      visit(_insertionOrder[i])
    }

    // order currently has deps before dependents due to DFS postorder.
    _resolvedOrder = order
    _orderIsDirty = false
    return _resolvedOrder
  }

  function _initPlugin(p) {
    if (_inited.has(p.id)) return
    _inited.add(p.id)
    try { if (typeof p.init === 'function') p.init(engine) } catch (e) {
      throw _engineError('PLUGIN_INIT_FAILED', `Plugin init failed: ${p.id}`, { id: p.id, e: _errInfo(e) })
    }
  }

  function _startPlugin(p) {
    if (_started.has(p.id)) return
    _started.add(p.id)
    try { if (typeof p.start === 'function') p.start(engine) } catch (e) {
      throw _engineError('PLUGIN_START_FAILED', `Plugin start failed: ${p.id}`, { id: p.id, e: _errInfo(e) })
    }
  }
function _startAutoTickLoop() {
  if (!_autoTickEnabled || _autoTickRunning) return
  _autoTickRunning = true
  try { _autoTickLastT = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now() } catch (_) { _autoTickLastT = Date.now() }

  const hasRaf = (typeof requestAnimationFrame === 'function')
  const useRaf = (_autoTickMode === 'raf') && hasRaf

  function step(now) {
    if (!_autoTickRunning) return
    const t = (typeof now === 'number') ? now : (() => {
      try { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now() } catch (_) { return Date.now() }
    })()
    let dt = t - _autoTickLastT
    _autoTickLastT = t
    // Clamp absurd deltas (background tabs / iOS resume) to avoid huge catch-up bursts.
    if (!Number.isFinite(dt) || dt < 0) dt = 0
    if (dt > 250) dt = 250
    try { tick(dt) } catch (e) {
      try { emit('engine:error', { where: 'autoTick', e: String(e && e.message ? e.message : e) }) } catch (_) {}
    }
    if (useRaf) {
      try { _autoTickHandle = requestAnimationFrame(step) } catch (_) { _autoTickHandle = setTimeout(step, 16) }
    } else {
      _autoTickHandle = setTimeout(step, 16)
    }
  }

  if (useRaf) {
    try { _autoTickHandle = requestAnimationFrame(step) } catch (_) { _autoTickHandle = setTimeout(step, 16) }
  } else {
    _autoTickHandle = setTimeout(step, 16)
  }
}

function _stopAutoTickLoop() {
  _autoTickRunning = false
  const h = _autoTickHandle
  _autoTickHandle = null
  if (!h) return
  try {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(h)
  } catch (_) {}
  try {
    clearTimeout(h)
  } catch (_) {}
}



  function start() {
    if (_engineStarted) return
    const order = _resolveOrder()
    for (let i = 0; i < order.length; i++) _initPlugin(order[i])
    for (let i = 0; i < order.length; i++) _startPlugin(order[i])
    _engineStarted = true
    emit('engine:started', { patch, patchName })
    _startAutoTickLoop()
  }

  function stop() {
    if (!_engineStarted) return
    const order = _resolveOrder()
    for (let i = order.length - 1; i >= 0; i--) {
      const p = order[i]
      try { if (p && typeof p.stop === 'function') p.stop(engine) } catch (_) {}
    }
    _engineStarted = false
    _stopAutoTickLoop()
    emit('engine:stopped', { patch, patchName })
  }

  function dispose() {
    emit('engine:disposing', { patch, patchName })
    try { stop() } catch (_) {}

    // Dispose plugins in reverse order.
    const order = (() => { try { return _resolveOrder() } catch (_) { return [] } })()
    for (let i = order.length - 1; i >= 0; i--) {
      const p = order[i]
      try { if (p && typeof p.dispose === 'function') p.dispose(engine) } catch (_) {}
    }

    // Stop engine services
    try { perf.stopWatchdog() } catch (_) {}
    try { input.uninstall() } catch (_) {}
    try { errorBoundary.uninstall() } catch (_) {}
    try { scheduler.clear() } catch (_) {}
	    try {
	      for (const o of Array.from(_ownerDisposables.keys())) {
	        try { disposeOwner(o) } catch (_) {}
	      }
	    } catch (_) {}
	    try { _ownerDisposables.clear() } catch (_) {}

    _pluginById.clear()
    _insertionOrder.length = 0
    _resolvedOrder = []
    _orderIsDirty = false
    _inited.clear()
    _started.clear()
    _engineStarted = false

    emit('engine:disposed', { patch, patchName })
    _listeners.clear()
    // leave services/state for postmortem debugging
  }

  function getPluginReport() {
    const order = (() => { try { return _resolveOrder() } catch (_) { return [] } })()
    return {
      registered: listPlugins(),
      resolvedOrder: order.map(p => p.id),
      started: Array.from(_started),
      inited: Array.from(_inited)
    }
  }

  // ---- State ---------------------------------------------------------------

  function getState() { return _state }
  
  /**
   * Update the engine state with optional metadata for observability.
   * @param {*} nextState - New state value
   * @param {Object} [meta] - Optional metadata (reason, action, etc.)
   * @param {string} [meta.reason] - Why the state changed (e.g., 'save:loaded', 'command:execute')
   * @param {string} [meta.action] - What action triggered the change
   */
  function setState(nextState, meta = {}) {
    _state = nextState
    const payload = {
      t: _nowIso(),
      ...(meta && typeof meta === 'object' ? meta : {})
    }
    emit('state:changed', payload)
  }
  
  /**
   * Convenience helper that wraps setState with metadata.
   * Useful for command handlers and critical paths.
   * @param {*} nextState - New state value
   * @param {string} reason - Why the state changed
   * @param {Object} [extra] - Additional metadata
   */
  function commit(nextState, reason, extra = {}) {
    setState(nextState, { reason, ...extra })
  }

  // ---- Engine services: clock + scheduler ---------------------------------

  const clockSvc = clock || createClock()
  const scheduler = createScheduler(clockSvc)

  function tick(dtMs = 16) {
    const used = clockSvc.tick(dtMs)
    try { scheduler.pump() } catch (_) {}
    emit('clock:tick', { dtMs: used, nowMs: clockSvc.nowMs })
    return used
  }

  // ---- Commands ------------------------------------------------------------

  const commands = createCommandBus({
    emit,
    getState,
    setState
  })

  // ---- Migrations + snapshots ---------------------------------------------

  const migrations = createMigrationRegistry()
  const snapshots = createSnapshotManager({
    getState,
    setState,
    getVersion: () => patch,
    migrateState: (state, fromV, toV) => migrations.migrateState(state, fromV, toV),
    emit,
    logger: log
  })

  // ---- RNG ----------------------------------------------------------------

  const rng = createRngService({ seed: rngSeed })

  // ---- Perf ----------------------------------------------------------------

  const perf = createProfiler({ emit, logger: log })

  // ---- Assets --------------------------------------------------------------

  const assets = createAssetRegistry({ emit, logger: log })

  // ---- Settings + Accessibility -------------------------------------------

  const settings = createSettingsService({
    emit,
    logger: log,
    storageGet: safeStorageGet,
    storageSet: safeStorageSet,
    storageKey: 'locus_settings_v1',
    schema: 1
  })
  const a11y = createA11yService({ settings, emit, logger: log })

  // ---- Tweens / animation -------------------------------------------------

  const tween = createTweenService({ clock: clockSvc, emit, logger: log })

  // Drive tweens from the engine clock so all motion flows from one timing source.
  const _tweenListener = () => { try { tween.update() } catch (_) {} }
  on('clock:tick', _tweenListener)
  own('system:tween', () => { try { off('clock:tick', _tweenListener) } catch (_) {} })

  // ---- Input / UI ----------------------------------------------------------

  const input = createInputRouter({ emit, logger: log })
  const uiRouter = createUiRouter({ emit, logger: log })

  // ---- Error boundary ------------------------------------------------------

  // created after engine object is assembled (needs engine reference)
  let errorBoundary = null

  // ---- Register core services (non-conflicting names) ----------------------

  registerService('log', log)
  registerService('events', events)
  registerService('clock', clockSvc)
  registerService('schedule', scheduler)
  registerService('commands', commands)
  registerService('migrations', migrations)
  registerService('snapshots', snapshots)
  registerService('rng', rng)
  registerService('perf', perf)
  registerService('assets', assets)
  registerService('settings', settings)
  registerService('a11y', a11y)
  registerService('tween', tween)
  registerService('input', input)
  registerService('uiRouter', uiRouter)

  // ---- Engine API ----------------------------------------------------------

  const engine = {
    // meta
    patch: String(patch || ''),
    patchName: String(patchName || ''),
    // state
    getState,
    setState,
    commit,  // convenience helper for setState with metadata
    // events
    on,
    off,
    emit,
    listen,
    events,
    // services
    registerService,
    getService,
	    // owner-scoped cleanup
	    own,
	    disposeOwner,
    // plugins
    use,
    start,
    stop,
    dispose,
    getPlugin,
    listPlugins,
    getPluginReport,
    get isStarted() { return _engineStarted },

    // clock/schedule
    clock: clockSvc,
    schedule: scheduler,
    tick,
    setTimeScale(v) { clockSvc.setTimeScale(v) },

    // commands
    commands,
    dispatch(cmd) { return commands.dispatch(cmd) },

    // save/load
    save(meta) { return snapshots.save(meta) },
    load(snapshot, opts) { return snapshots.load(snapshot, opts) },
    validateSave(snapshot) { return snapshots.validate(snapshot) },
    migrations,

    // utilities/services
    log,
    rng,
    perf,
    assets,
    input,
    ui: uiRouter
  }

  // Error boundary + harness are initialized after engine exists.
  errorBoundary = createErrorBoundary(engine, { enabled: !!installErrorBoundary })
  engine.errorBoundary = errorBoundary
  registerService('errorBoundary', errorBoundary)

  const harness = createHarness(engine)
  engine.harness = harness
  registerService('harness', harness)

  // ---- Optional cross-cutting services ------------------------------------

  const flags = createFlagsService({ logger: log })
  engine.flags = flags
  registerService('flags', flags)

  const i18n = createI18nService({
    defaultLocale: (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US'
  })
  engine.i18n = i18n
  registerService('i18n', i18n)

  const uiCompose = createUiCompose({ emit, schedule: scheduler, logger: log })
  engine.uiCompose = uiCompose
  registerService('uiCompose', uiCompose)

  const savePolicy = createSavePolicy(engine)
  engine.savePolicy = savePolicy
  registerService('savePolicy', savePolicy)

  const replay = createReplay(engine)
  engine.replay = replay
  registerService('replay', replay)

  const telemetry = createTelemetry(engine)
  engine.telemetry = telemetry
  registerService('telemetry', telemetry)

  // ---- QA (engine-wide) ---------------------------------------------------

  // QA is an engine service; the game registers the actual suites via hooks.
  const qa = createQaService(engine)
  engine.qa = qa
  registerService('qa', qa)

  // Optional auto installs (safe no-ops in headless)
  try { if (startPerfWatchdog) perf.startWatchdog() } catch (_) {}
  try { if (autoInstallInput) input.install() } catch (_) {}
  try { if (installErrorBoundary) errorBoundary.install() } catch (_) {}

  return engine
}
