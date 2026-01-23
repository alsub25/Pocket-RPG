// js/engine/qa.js
// Engine-wide QA registry + bug report bundler.
//
// Goals:
// - Provide a single engine service (`qa`) that UI + tools can call.
// - Let the game register content-specific suites (smoke tests, audits, scenarios)
//   without the diagnostics UI needing to import game code directly.
// - Ensure bug reports include engine instrumentation tails (events/commands/perf/ui).

function _nowIso() {
  try { return new Date().toISOString() } catch (_) { return '' }
}

function _tail(arr, n) {
  const a = Array.isArray(arr) ? arr : []
  const lim = Math.max(0, Math.min(1000, Number(n) || 0))
  return lim ? a.slice(-lim) : a.slice()
}

function _safeJsonClone(x, fallback = null) {
  try { return JSON.parse(JSON.stringify(x)) } catch (_) { return fallback }
}

// Keep engine-side bundles privacy-safe by default.
function _redactProps(obj, { maxKeys = 60, maxStr = 500 } = {}) {
  if (!obj || typeof obj !== 'object') return obj
  const out = Array.isArray(obj) ? [] : {}
  const keys = Object.keys(obj).slice(0, Math.max(0, Number(maxKeys) || 0))
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]
    const v = obj[k]
    if (typeof v === 'string') out[k] = (v.length > maxStr) ? (v.slice(0, maxStr - 1) + '…') : v
    else if (v && typeof v === 'object') out[k] = _redactProps(v, { maxKeys: 40, maxStr })
    else out[k] = v
  }
  return out
}

export function createQaService(engine, {
  maxTail = 140
} = {}) {
  // Hooks provided by the game layer.
  // Expected keys (all optional):
  // - runSmokeTests(opts)
  // - buildBugReportBundle()
  // - formatBugReportBundle(bundle)
  // - runIntegrityAudit(state, reason)
  // - formatIntegrityAuditReport(rep)
  // - runScenarioRunner(opts)
  // - formatScenarioRunnerReport(rep)
  // - perf snapshot helpers used by diagnostics UI
  let hooks = Object.create(null)

  function setHooks(next) {
    hooks = (next && typeof next === 'object') ? { ...hooks, ...next } : hooks
    return true
  }

  function getHooks() { return { ...hooks } }

  function _svc(name) {
    try { return engine?.getService?.(name) || engine?.[name] || null } catch (_) { return null }
  }

  function buildEngineQaTail() {
    const commands = _svc('commands')
    const events = _svc('events')
    const perf = _svc('perf')
    const uiRouter = _svc('uiRouter')
    const replay = _svc('replay')
    const telemetry = _svc('telemetry')
    const savePolicy = _svc('savePolicy')
    const flags = _svc('flags')
    const i18n = _svc('i18n')

    const commandTail = (() => {
      try { return _tail(commands?.getLog?.(), maxTail) } catch (_) { return [] }
    })()
    const eventTail = (() => {
      try { return _tail(events?.getRecords?.(), maxTail) } catch (_) { return [] }
    })()
    const perfTail = (() => {
      try { return _tail(perf?.getRecords?.(), maxTail) } catch (_) { return [] }
    })()
    const uiStack = (() => {
      try {
        const st = uiRouter?.list?.() || []
        return st.map((x) => ({ id: x?.id || null, props: _redactProps(x?.props || null) }))
      } catch (_) {
        return []
      }
    })()

    const replayMeta = (() => {
      try { return replay?.getLastMeta?.() || null } catch (_) { return null }
    })()
    const replayTape = (() => {
      try { return replay?.exportTape?.() || null } catch (_) { return null }
    })()

    return {
      t: _nowIso(),
      patch: engine?.patch || '',
      patchName: engine?.patchName || '',
      locale: (() => { try { return i18n?.getLocale?.() || null } catch (_) { return null } })(),
      flags: (() => { try { return flags?.dump?.() || null } catch (_) { return null } })(),
      savePolicy: (() => { try { return savePolicy?.getStatus?.() || null } catch (_) { return null } })(),
      telemetryTail: (() => { try { return _tail(telemetry?.getTail?.(maxTail) || [], maxTail) } catch (_) { return null } })(),
      eventTail,
      commandTail,
      perfTail,
      uiStack,
      replay: { meta: replayMeta, tape: replayTape }
    }
  }

  function buildBugReportBundle() {
    // Prefer game-provided bundle, then enrich with engine tails.
    const base = (() => {
      try {
        if (typeof hooks.buildBugReportBundle === 'function') return hooks.buildBugReportBundle()
      } catch (_) {}
      return { summary: { patch: engine?.patch || '', patchName: engine?.patchName || '', timeUtc: _nowIso() } }
    })()

    const engineQa = buildEngineQaTail()
    const out = (base && typeof base === 'object') ? { ...base } : { summary: { patch: engine?.patch || '', patchName: engine?.patchName || '', timeUtc: _nowIso() } }
    // Keep this additive to avoid breaking existing bug report tooling.
    out.engine = engineQa
    return _safeJsonClone(out, out)
  }

  function formatBugReportBundle(bundle) {
    try {
      if (typeof hooks.formatBugReportBundle === 'function') return hooks.formatBugReportBundle(bundle)
    } catch (_) {}
    try { return JSON.stringify(bundle, null, 2) } catch (_) { return String(bundle || '') }
  }

  function runSmokeTests(opts = {}) {
    try {
      if (typeof hooks.runSmokeTests === 'function') {
        const res = hooks.runSmokeTests(opts)
        // Ensure the returned bundle is engine-enriched even if the game suite
        // captured a bug report before engine QA was initialized.
        if (res && typeof res === 'object') {
          try {
            res.bugReport = buildBugReportBundle()
            // Keep a friendly human-readable report if the game provides a formatter.
            res.bugReportPretty = res.bugReportPretty || formatBugReportBundle(res.bugReport)
          } catch (_) {}
        }
        return res
      }
    } catch (e) {
      return {
        ok: false,
        failCount: 1,
        passCount: 0,
        ms: 0,
        failed: [{ label: 'Smoke Tests', msg: e?.message || String(e) }],
        smokeText: 'Smoke Tests failed: ' + (e?.message || String(e)),
        bugReport: buildBugReportBundle(),
        bugReportPretty: 'Bug report available.'
      }
    }
    return {
      ok: false,
      failCount: 1,
      passCount: 0,
      ms: 0,
      failed: [{ label: 'Smoke Tests', msg: 'No smoke tests are registered.' }],
      smokeText: 'No smoke tests are registered.',
      bugReport: buildBugReportBundle(),
      bugReportPretty: 'Bug report available.'
    }
  }

  function runIntegrityAudit(state, reason) {
    try { return typeof hooks.runIntegrityAudit === 'function' ? hooks.runIntegrityAudit(state, reason) : null } catch (_) { return null }
  }
  function formatIntegrityAuditReport(rep) {
    try { return typeof hooks.formatIntegrityAuditReport === 'function' ? hooks.formatIntegrityAuditReport(rep) : JSON.stringify(rep, null, 2) } catch (_) { return String(rep || '') }
  }
  function runScenarioRunner(opts) {
    try { return typeof hooks.runScenarioRunner === 'function' ? hooks.runScenarioRunner(opts) : null } catch (_) { return null }
  }
  function formatScenarioRunnerReport(rep) {
    try { return typeof hooks.formatScenarioRunnerReport === 'function' ? hooks.formatScenarioRunnerReport(rep) : JSON.stringify(rep, null, 2) } catch (_) { return String(rep || '') }
  }

  return {
    setHooks,
    getHooks,
    // core QA
    runSmokeTests,
    buildBugReportBundle,
    formatBugReportBundle,
    runIntegrityAudit,
    formatIntegrityAuditReport,
    runScenarioRunner,
    formatScenarioRunnerReport,
    // pass-through perf snapshot helpers (used by diagnostics UI)
    qaReadBootMetrics: (...a) => hooks.qaReadBootMetrics?.(...a),
    qaReadMemorySnapshot: (...a) => hooks.qaReadMemorySnapshot?.(...a),
    qaSummarizePerfLog: (...a) => hooks.qaSummarizePerfLog?.(...a),
    qaCollectPerfSnapshotSync: (...a) => hooks.qaCollectPerfSnapshotSync?.(...a),
    qaFormatPerfSnapshotText: (...a) => hooks.qaFormatPerfSnapshotText?.(...a),
    qaSampleFps: (...a) => hooks.qaSampleFps?.(...a)
  }
}
