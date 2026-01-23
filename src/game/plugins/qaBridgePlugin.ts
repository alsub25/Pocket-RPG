// js/game/plugins/qaBridgePlugin.js
// Bridges Emberwood's QA implementations into the engine-wide `qa` service.

export function createQaBridgePlugin(opts = {}) {
  const deps = (opts && typeof opts.deps === 'object') ? opts.deps : {}

  return {
    id: 'ew.qaBridge',
    init(engine) {
      try {
        const qa = (engine && typeof engine.getService === 'function') ? engine.getService('qa') : null
        if (!qa || typeof qa.setHooks !== 'function') return

        // Register the game-layer implementations as QA hooks.
        qa.setHooks({
          runSmokeTests: deps.runSmokeTests,
          buildBugReportBundle: deps.buildBugReportBundle,
          formatBugReportBundle: deps.formatBugReportBundle,

          runIntegrityAudit: deps.runIntegrityAudit,
          formatIntegrityAuditReport: deps.formatIntegrityAuditReport,

          runScenarioRunner: deps.runScenarioRunner,
          formatScenarioRunnerReport: deps.formatScenarioRunnerReport,

          // Perf snapshot helpers (used by the diagnostics UI)
          qaReadBootMetrics: deps.qaReadBootMetrics,
          qaReadMemorySnapshot: deps.qaReadMemorySnapshot,
          qaSummarizePerfLog: deps.qaSummarizePerfLog,
          qaCollectPerfSnapshotSync: deps.qaCollectPerfSnapshotSync,
          qaFormatPerfSnapshotText: deps.qaFormatPerfSnapshotText,
          qaSampleFps: deps.qaSampleFps
        })
      } catch (_) {}
    }
  }
}
