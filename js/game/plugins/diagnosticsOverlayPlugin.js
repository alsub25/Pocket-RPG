// js/game/plugins/diagnosticsOverlayPlugin.js
// Engine plugin: Diagnostics / QA overlay
//
// Wraps createDiagnosticsUI() into the Engine lifecycle and exposes a
// diagnostics service for the orchestrator to call.

import { createDiagnosticsUI } from '../ui/devtools/diagnosticsUI.js'

export function createDiagnosticsOverlayPlugin(opts = {}) {
  const deps = (opts && typeof opts.deps === 'object') ? opts.deps : {}
  let _diag = null
  let _engine = null

  return {
    id: 'ew.diagnosticsOverlay',
    requires: ['ew.uiRuntime'],
    init(engine) {
      _engine = engine || null

      // Prefer the engine-wide QA service; allow callers to override by
      // explicitly passing functions in `deps`.
      const qa = (() => {
        try { return engine && typeof engine.getService === 'function' ? engine.getService('qa') : null } catch (_) { return null }
      })()

      const merged = { ...deps }
      if (qa) {
        // QA suite wiring
        if (!merged.runSmokeTests) merged.runSmokeTests = qa.runSmokeTests
        if (!merged.buildBugReportBundle) merged.buildBugReportBundle = qa.buildBugReportBundle
        if (!merged.formatBugReportBundle) merged.formatBugReportBundle = qa.formatBugReportBundle
        if (!merged.runIntegrityAudit) merged.runIntegrityAudit = qa.runIntegrityAudit
        if (!merged.formatIntegrityAuditReport) merged.formatIntegrityAuditReport = qa.formatIntegrityAuditReport
        if (!merged.runScenarioRunner) merged.runScenarioRunner = qa.runScenarioRunner
        if (!merged.formatScenarioRunnerReport) merged.formatScenarioRunnerReport = qa.formatScenarioRunnerReport

        // Perf snapshot helpers
        if (!merged.qaReadBootMetrics) merged.qaReadBootMetrics = qa.qaReadBootMetrics
        if (!merged.qaReadMemorySnapshot) merged.qaReadMemorySnapshot = qa.qaReadMemorySnapshot
        if (!merged.qaSummarizePerfLog) merged.qaSummarizePerfLog = qa.qaSummarizePerfLog
        if (!merged.qaCollectPerfSnapshotSync) merged.qaCollectPerfSnapshotSync = qa.qaCollectPerfSnapshotSync
        if (!merged.qaFormatPerfSnapshotText) merged.qaFormatPerfSnapshotText = qa.qaFormatPerfSnapshotText
        if (!merged.qaSampleFps) merged.qaSampleFps = qa.qaSampleFps
      }

      _diag = createDiagnosticsUI({ ...merged, engine })

      // Expose service
      try { engine.registerService('diagnostics', _diag) } catch (_) {}

      // Optional: surface engine errors in the UI if a modal helper exists.
      try {
        engine.on('engine:error', (err) => {
          try { console.error('[Engine error]', err) } catch (_) {}
          try {
            if (!_diag || typeof _diag.openSmokeTestsModal !== 'function') {
              // Don't force UI if diagnostics isn't ready.
            }
          } catch (_) {}

          // If the host passed openModal, show a minimal crash note.
          try {
            const openModal = deps && deps.openModal
            if (typeof openModal !== 'function') return
            const title = 'Engine Error'
            openModal(title, (body) => {
              try {
                const pre = document.createElement('pre')
                pre.className = 'qa-pre'
                pre.style.whiteSpace = 'pre-wrap'
                pre.style.fontSize = '12px'
                pre.textContent = JSON.stringify(err, null, 2)
                body.appendChild(pre)
              } catch (_) {}
            })
          } catch (_) {}
        })
      } catch (_) {}
    },
    start() {
      try {
        if (_diag && typeof _diag.syncSmokeTestsPillVisibility === 'function') {
          _diag.syncSmokeTestsPillVisibility()
        }
      } catch (_) {}
    },
    stop() {
      // no-op
    },
    dispose() {
      _diag = null
      _engine = null
    }
  }
}
