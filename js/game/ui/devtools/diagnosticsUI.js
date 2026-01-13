// diagnosticsUI.js
// ES6 module: Diagnostics / QA Tools UI (Smoke Tests modal, QA pills visibility)

/*
  Patch 1.2.70 goal
  - Keep engine.js focused on orchestration.
  - Move diagnostics/QA UI wiring (Smoke Tests modal + dev pill visibility) into
    a dedicated module.

  This module is UI-only.
*/

import { nextTick } from '../../utils/timing.js'

function safeStringify(obj, maxLen = 220) {
    const lim = Math.max(40, Number(maxLen || 220))
    try {
        const s = JSON.stringify(obj)
        if (typeof s !== 'string') return ''
        if (s.length <= lim) return s
        return s.slice(0, lim - 1) + '…'
    } catch (_) {
        try {
            const s = String(obj)
            if (s.length <= lim) return s
            return s.slice(0, lim - 1) + '…'
        } catch (_2) {
            return ''
        }
    }
}

function qaReadJsonFromStorage(key) {
    try {
        const raw = localStorage.getItem(String(key || ''))
        if (!raw || typeof raw !== 'string') return null
        return JSON.parse(raw)
    } catch (_) {
        return null
    }
}

export function createDiagnosticsUI(deps) {
    const {
        engine,
        getState,
        cheatsEnabled,
        patchLabel,
        patchName,
        openModal,
        closeModal,
        getModalOnClose,
        setModalOnClose,
        copyToClipboard,

        // QA tools
        runSmokeTests,
        runIntegrityAudit,
        formatIntegrityAuditReport,
        runScenarioRunner,
        formatScenarioRunnerReport,
        buildBugReportBundle,

        // Perf snapshot helpers
        qaReadBootMetrics,
        qaReadMemorySnapshot,
        qaSummarizePerfLog,
        qaCollectPerfSnapshotSync,
        qaFormatPerfSnapshotText,
        qaSampleFps
    } = deps || {}

    function _getReplay() {
        try { return engine && (engine.getService ? engine.getService('replay') : engine.replay) } catch (_) { return null }
    }

    function _t(key, fallback) {
        try {
            const i18n = engine && (engine.getService ? engine.getService('i18n') : engine.i18n)
            if (i18n && typeof i18n.t === 'function') return i18n.t(key)
        } catch (_) {}
        return fallback || key
    }

    function syncSmokeTestsPillVisibility() {
        // NOTE: The HUD dev pills are present in the DOM but shipped with the
        // `.hidden` class by default. Do NOT rely on `style.display = ''` to show
        // them, because `.hidden { display:none !important; }` will still win.
        // Instead, toggle the `.hidden` class for reliable behavior across iOS.
        try {
            const smokePill = document.getElementById('btnSmokeTestsPill')
            const cheatPill = document.getElementById('btnCheatPill')
            if (!smokePill && !cheatPill) return

            // Show dev pills whenever cheats are enabled.
            // Do not additionally require state.flags here; cheatsEnabled()
            // already gates on it in the engine, and QA/isolated states may
            // omit optional containers.
            const show = !!(typeof cheatsEnabled === 'function' && cheatsEnabled())

            const apply = (el) => {
                if (!el) return
                // Keep it accessible but non-interactive while hidden.
                el.classList.toggle('hidden', !show)
                if (!show) el.setAttribute('aria-hidden', 'true')
                else el.removeAttribute('aria-hidden')
            }

            apply(smokePill)
            apply(cheatPill)
        } catch (_) {}
    }

    function openSmokeTestsModal() {
        if (typeof openModal !== 'function') return

        let last = null
        openModal('Smoke Tests & Bug Report', (b) => {
            const hint = document.createElement('div')
            hint.className = 'modal-subtitle'
            hint.textContent = 'Runs an isolated QA suite in-memory (does not modify your save) and prints a Bug Report bundle for fast debugging.'
            b.appendChild(hint)

            const summary = document.createElement('div')
            summary.className = 'modal-subtitle'
            summary.style.fontSize = '12px'
            summary.style.opacity = '0.9'
            summary.textContent = 'Ready. Click Run to start.'
            b.appendChild(summary)

            const actions = document.createElement('div')
            actions.className = 'item-actions qa-pill-actions'
            b.appendChild(actions)

            const btn = (label, cls = 'btn small') => {
                const x = document.createElement('button')
                x.className = cls
                x.textContent = label
                actions.appendChild(x)
                return x
            }

            const btnRun = btn('Run')
            const btnAudit = btn('Audit save', 'btn small outline')
            const btnScenario = btn('Scenario', 'btn small outline')
            const btnCopy = btn('Copy results', 'btn small outline')
            const btnCopyFails = btn('Copy failures', 'btn small outline')
            const btnCopyJson = btn('Copy JSON', 'btn small outline')

            btnCopy.disabled = true
            btnCopyFails.disabled = true
            btnCopyJson.disabled = true

            function fitQaActionPillsTextOnly() {
                try {
                    const kids = Array.from(actions.children || []).filter(Boolean)
                    if (!kids.length) return

                    actions.style.setProperty('--qa-pill-font', '0.8rem')
                    const rowCount = () => {
                        const tops = new Set()
                        kids.forEach((el) => {
                            try { tops.add(el.offsetTop) } catch (_) {}
                        })
                        return tops.size
                    }

                    let font = 0.8
                    for (let i = 0; i < 10; i++) {
                        if (rowCount() <= 2) break
                        if (font <= 0.65) break
                        font = Math.max(0.65, font - 0.03)
                        actions.style.setProperty('--qa-pill-font', font.toFixed(2) + 'rem')
                    }
                } catch (_) {}
            }

            const _qaResizeHandler = () => requestAnimationFrame(() => fitQaActionPillsTextOnly())
            try { window.addEventListener('resize', _qaResizeHandler) } catch (_) {}
            const _prevModalOnClose = typeof getModalOnClose === 'function' ? getModalOnClose() : null
            if (typeof setModalOnClose === 'function') {
                setModalOnClose(() => {
                    try { window.removeEventListener('resize', _qaResizeHandler) } catch (_) {}
                    try { if (typeof _prevModalOnClose === 'function') _prevModalOnClose() } catch (_) {}
                })
            }
            nextTick(() => { try { fitQaActionPillsTextOnly() } catch (_) {} })

            const mkDetails = (title, openByDefault = false) => {
                const details = document.createElement('details')
                details.className = 'qa-details'
                details.open = !!openByDefault
                const sum = document.createElement('summary')
                sum.className = 'qa-summary'
                sum.textContent = title
                details.appendChild(sum)
                const pre = document.createElement('pre')
                pre.className = 'qa-pre'
                pre.style.whiteSpace = 'pre-wrap'
                pre.style.fontSize = '12px'
                pre.textContent = 'Ready.'
                details.appendChild(pre)
                return { details, pre }
            }

            // Match the classic Smoke Tests modal layout: keep the sections
            // collapsed by default (users expand as needed).
            const smoke = mkDetails('Smoke Tests', false)
            const bug = mkDetails('Bug Report', false)
            const perf = mkDetails('Performance Snapshot', false)
            const replay = mkDetails('Replay', false)
            const audit = mkDetails('Live Save Audit', false)
            const scenario = mkDetails('Scenario Runner', false)

            // Bug JSON nested details
            const bugJsonDetails = document.createElement('details')
            bugJsonDetails.className = 'qa-subdetails'
            bugJsonDetails.open = false
            const bugJsonSummary = document.createElement('summary')
            bugJsonSummary.className = 'qa-summary'
            bugJsonSummary.textContent = 'Raw JSON'
            bugJsonDetails.appendChild(bugJsonSummary)
            const bugJsonPre = document.createElement('pre')
            bugJsonPre.className = 'qa-pre'
            bugJsonPre.style.whiteSpace = 'pre-wrap'
            bugJsonPre.style.fontSize = '12px'
            bugJsonPre.textContent = ''
            bugJsonDetails.appendChild(bugJsonPre)
            bug.details.appendChild(bugJsonDetails)

            b.appendChild(smoke.details)
            b.appendChild(bug.details)
            b.appendChild(perf.details)
            b.appendChild(replay.details)
            b.appendChild(audit.details)
            b.appendChild(scenario.details)

            // Replay controls
            let lastTapeJson = ''
            const replayActions = document.createElement('div')
            replayActions.className = 'item-actions qa-pill-actions'
            replay.details.appendChild(replayActions)
            const rbtn = (label, cls = 'btn small outline') => {
                const x = document.createElement('button')
                x.className = cls
                x.textContent = label
                replayActions.appendChild(x)
                return x
            }

            const btnRec = rbtn('Record', 'btn small')
            const btnStop = rbtn('Stop', 'btn small outline')
            const btnCopyTape = rbtn('Copy tape', 'btn small outline')
            const btnPlay = rbtn('Play', 'btn small outline')

            btnStop.disabled = true
            btnCopyTape.disabled = true
            btnPlay.disabled = true

            function refreshReplayStatus() {
                const r = _getReplay()
                if (!r) {
                    replay.pre.textContent = 'Replay service not available.'
                    btnRec.disabled = true
                    btnStop.disabled = true
                    btnCopyTape.disabled = true
                    btnPlay.disabled = true
                    return
                }
                const recording = !!(r.isRecording && r.isRecording())
                const meta = (r.getLastMeta && r.getLastMeta()) || null
                const lines = []
                lines.push('Recording: ' + (recording ? 'YES' : 'no'))
                if (meta) {
                    lines.push('Last tape: ' + String(meta.name || 'replay'))
                    if (meta.startedAt) lines.push('  started: ' + String(meta.startedAt))
                    if (meta.stoppedAt) lines.push('  stopped: ' + String(meta.stoppedAt))
                    lines.push('  commands: ' + String(meta.commandCount || 0))
                    lines.push('  snapshot: ' + (meta.hasSnapshot ? 'yes' : 'no'))
                } else {
                    lines.push('Last tape: (none)')
                }
                replay.pre.textContent = lines.join('\n')
                btnRec.disabled = recording
                btnStop.disabled = !recording
                btnCopyTape.disabled = !(meta && meta.commandCount >= 0)
                btnPlay.disabled = !(meta && meta.commandCount >= 0)
            }

            refreshReplayStatus()

            btnRec.onclick = () => {
                const r = _getReplay()
                if (!r || !r.startRecording) return
                try { r.startRecording({ name: 'qa', includeSnapshot: true }) } catch (_) {}
                try { engine?.uiCompose?.toast?.(_t('toast.replay.recording', 'Recording replay…')) } catch (_) {}
                refreshReplayStatus()
            }

            btnStop.onclick = () => {
                const r = _getReplay()
                if (!r || !r.stopRecording) return
                let tape = null
                try { tape = r.stopRecording() } catch (_) {}
                try { lastTapeJson = (r.exportTape && r.exportTape(tape)) || '' } catch (_) { lastTapeJson = '' }
                try { engine?.uiCompose?.toast?.(_t('toast.replay.stopped', 'Replay captured.')) } catch (_) {}
                btnCopyTape.disabled = !lastTapeJson
                btnPlay.disabled = !tape
                refreshReplayStatus()
            }

            btnCopyTape.onclick = () => {
                if (!lastTapeJson) {
                    const r = _getReplay()
                    try { lastTapeJson = (r && r.exportTape) ? r.exportTape() : '' } catch (_) { lastTapeJson = '' }
                }
                if (!lastTapeJson) return
                try { if (typeof copyToClipboard === 'function') copyToClipboard(lastTapeJson) } catch (_) {}
            }

            btnPlay.onclick = () => {
                const r = _getReplay()
                if (!r || !r.play) return
                try { engine?.uiCompose?.toast?.(_t('toast.replay.playing', 'Playing replay…')) } catch (_) {}
                try { r.play(null, { immediate: true }) } catch (_) {}
                refreshReplayStatus()
            }

            // Perf snapshot content
            function refreshPerfSnapshot() {
                try {
                    const st = typeof getState === 'function' ? getState() : null
                    const snap = typeof qaCollectPerfSnapshotSync === 'function' ? qaCollectPerfSnapshotSync(st) : null
                    const lines = []
                    if (typeof qaFormatPerfSnapshotText === 'function' && snap) {
                        lines.push(qaFormatPerfSnapshotText(snap))
                    }
                    const boot = typeof qaReadBootMetrics === 'function' ? qaReadBootMetrics() : null
                    const mem = typeof qaReadMemorySnapshot === 'function' ? qaReadMemorySnapshot() : null
                    if (boot) {
                        lines.push('')
                        lines.push('Boot metrics (persisted)')
                        lines.push(JSON.stringify(boot, null, 2))
                    }
                    if (mem) {
                        lines.push('')
                        lines.push('Memory snapshot')
                        lines.push(JSON.stringify(mem, null, 2))
                    }
                    perf.pre.textContent = lines.join('\n') || 'No snapshot available.'
                } catch (e) {
                    perf.pre.textContent = 'Failed to build snapshot: ' + (e && e.message ? e.message : String(e))
                }
            }
            refreshPerfSnapshot()

            // Kick an FPS sample opportunistically (async) so snapshot shows it.
            try {
                const st = typeof getState === 'function' ? getState() : null
                if (st && st.debug && !st.debug.lastFpsSample && typeof qaSampleFps === 'function') {
                    qaSampleFps(25, 1200).then((fps) => {
                        try {
                            const s2 = typeof getState === 'function' ? getState() : null
                            if (!s2) return
                            if (!s2.debug || typeof s2.debug !== 'object') s2.debug = {}
                            s2.debug.lastFpsSample = fps
                        } catch (_) {}
                        refreshPerfSnapshot()
                    }).catch(() => {})
                }
            } catch (_) {}

            // Live audit controls
            const auditControls = document.createElement('div')
            auditControls.className = 'item-actions'
            auditControls.style.marginTop = '6px'
            auditControls.style.marginBottom = '6px'
            audit.details.insertBefore(auditControls, audit.pre)

            const perfChkLabel = document.createElement('label')
            perfChkLabel.style.display = 'flex'
            perfChkLabel.style.alignItems = 'center'
            perfChkLabel.style.gap = '6px'
            perfChkLabel.style.fontSize = '12px'
            perfChkLabel.style.opacity = '0.9'

            const perfChk = document.createElement('input')
            perfChk.type = 'checkbox'
            try {
                const st = typeof getState === 'function' ? getState() : null
                perfChk.checked = !!(st && st.debug && st.debug.capturePerf)
            } catch (_) {}
            perfChk.addEventListener('change', () => {
                try {
                    const st = typeof getState === 'function' ? getState() : null
                    if (!st) return
                    if (!st.debug || typeof st.debug !== 'object') st.debug = {}
                    st.debug.capturePerf = !!perfChk.checked
                    if (!st.debug.capturePerf) st.debug.perfLog = []
                } catch (_) {}
            })

            const perfChkText = document.createElement('span')
            perfChkText.textContent = 'Capture perf'
            perfChkLabel.appendChild(perfChk)
            perfChkLabel.appendChild(perfChkText)
            auditControls.appendChild(perfChkLabel)

            const btnPerfTail = document.createElement('button')
            btnPerfTail.className = 'btn small outline'
            btnPerfTail.textContent = 'Perf tail'
            auditControls.appendChild(btnPerfTail)

            const btnPerfWorst = document.createElement('button')
            btnPerfWorst.className = 'btn small outline'
            btnPerfWorst.textContent = 'Worst offenders'
            auditControls.appendChild(btnPerfWorst)

            btnPerfTail.addEventListener('click', () => {
                try {
                    const st = typeof getState === 'function' ? getState() : null
                    const tail = st && st.debug && Array.isArray(st.debug.perfLog) ? st.debug.perfLog.slice(-60) : []
                    if (!tail.length) {
                        audit.pre.textContent = 'No perf data. Enable "Capture perf" and play a bit, then re-open this panel.'
                        audit.details.open = true
                        return
                    }
                    const lines = []
                    lines.push('Perf tail (last ' + tail.length + ')')
                    tail.forEach((e) => {
                        const sub = e && e.subsystem ? String(e.subsystem) : ''
                        const label = e && e.label ? String(e.label) : ''
                        const ms = (e && typeof e.ms === 'number') ? Math.round(e.ms) : null
                        const ex = e && e.extra ? safeStringify(e.extra, 220) : ''
                        lines.push('- ' + (sub ? ('[' + sub + '] ') : '') + label + (ms !== null ? ' • ' + ms + ' ms' : '') + (ex ? ' • ' + ex : ''))
                    })
                    audit.pre.textContent = lines.join('\n')
                    audit.details.open = true
                } catch (e) {
                    audit.pre.textContent = 'Failed to build perf tail: ' + (e && e.message ? e.message : String(e))
                    audit.details.open = true
                }
            })

            btnPerfWorst.addEventListener('click', () => {
                try {
                    const st = typeof getState === 'function' ? getState() : null
                    const tail = st && st.debug && Array.isArray(st.debug.perfLog) ? st.debug.perfLog.slice(-200) : []
                    if (!tail.length) {
                        audit.pre.textContent = 'No perf data. Enable "Capture perf" and play a bit, then re-open this panel.'
                        audit.details.open = true
                        return
                    }

                    const summary = typeof qaSummarizePerfLog === 'function' ? qaSummarizePerfLog(tail) : null
                    const th = (summary && summary.thresholds && typeof summary.thresholds === 'object') ? summary.thresholds : { frameBudgetMs: 16, hitchMs: 50 }
                    const frameMs = Number(th.frameBudgetMs) || 16
                    const hitchMs = Number(th.hitchMs) || 50

                    const pad = (s, n) => {
                        const str = String(s || '')
                        if (str.length >= n) return str.slice(0, n)
                        return str + ' '.repeat(n - str.length)
                    }

                    const lines = []
                    lines.push('Worst offenders (thresholds: >' + frameMs + 'ms avg, >' + hitchMs + 'ms max)')
                    lines.push(pad('Subsystem', 10) + '  ' + pad('Label', 28) + '  ' + pad('Avg', 6) + '  ' + pad('Max', 6) + '  ' + pad('N', 4) + '  Flags')
                    lines.push('-'.repeat(10) + '  ' + '-'.repeat(28) + '  ' + '-'.repeat(6) + '  ' + '-'.repeat(6) + '  ' + '-'.repeat(4) + '  ' + '-'.repeat(10))

                    const worst = (summary && Array.isArray(summary.worst)) ? summary.worst : []
                    if (!worst.length) {
                        lines.push('(none flagged)')
                    } else {
                        worst.slice(0, 15).forEach((r) => {
                            const flags = r && r.flags ? r.flags : {}
                            const f = [flags.hitch ? 'hitch' : '', flags.overFrameBudget ? 'overBudget' : ''].filter(Boolean).join(',')
                            lines.push(
                                pad(r.subsystem || 'other', 10) + '  ' +
                                pad(r.label || '', 28) + '  ' +
                                pad(r.avgMs, 6) + '  ' +
                                pad(r.maxMs, 6) + '  ' +
                                pad(r.count, 4) + '  ' +
                                (f || '')
                            )
                        })
                    }

                    audit.pre.textContent = lines.join('\n')
                    audit.details.open = true
                } catch (e) {
                    audit.pre.textContent = 'Failed to build worst-offenders table: ' + (e && e.message ? e.message : String(e))
                    audit.details.open = true
                }
            })

            // Button handlers
            const summarize = (res) => {
                // Match the classic Smoke Tests modal summary line:
                //   "122 passed, 0 failed • 84 ms"
                try {
                    const failCount = res && typeof res.failCount === 'number' ? res.failCount : 0
                    const passCount = res && typeof res.passCount === 'number' ? res.passCount : 0
                    const ms = res && typeof res.ms === 'number' ? res.ms : null

                    let s = passCount + ' passed, ' + failCount + ' failed'
                    if (ms !== null) s += ' • ' + ms + ' ms'
                    summary.textContent = s
                } catch (_) {}
            }

            const runSuite = () => {
                try {
                    btnRun.disabled = true
                    summary.textContent = 'Running…'
                    smoke.pre.textContent = 'Running…'
                    nextTick(() => {
                        try {
                            last = typeof runSmokeTests === 'function' ? runSmokeTests({ returnObject: true }) : null
                            smoke.pre.textContent = last && last.smokeText ? last.smokeText : (last && last.text ? last.text : String(last || ''))

                            const bugBundle = (last && last.bugReport) ? last.bugReport : (typeof buildBugReportBundle === 'function' ? buildBugReportBundle() : null)
                            if (bugBundle) {
                                bug.pre.textContent = (last && last.bugReportPretty) ? last.bugReportPretty : 'Bug report ready.'
                                try { bugJsonPre.textContent = JSON.stringify(bugBundle, null, 2) } catch (_) { bugJsonPre.textContent = '{"error":"failed to stringify"}' }
                            }

                            const smokeHasIssues = !!(last && (last.failCount > 0 || (last.console && ((last.console.errors || []).length > 0 || (last.console.asserts || []).length > 0))))
                            smoke.details.open = smokeHasIssues
                            bug.details.open = !!(last && last.bugHasIssues)

                            summarize(last)
                            btnCopy.disabled = false
                            btnCopyFails.disabled = !(last && last.failCount > 0)
                            btnCopyJson.disabled = false
                        } catch (e) {
                            smoke.pre.textContent = 'Smoke Tests failed: ' + (e && e.message ? e.message : String(e))
                            summary.textContent = 'Failed.'
                        } finally {
                            btnRun.disabled = false
                        }
                    })
                } catch (_) {
                    btnRun.disabled = false
                }
            }

            btnRun.addEventListener('click', runSuite)

            btnAudit.addEventListener('click', () => {
                try {
                    btnAudit.disabled = true
                    audit.pre.textContent = 'Running audit…'
                    audit.details.open = true
                    nextTick(() => {
                        try {
                            const st = typeof getState === 'function' ? getState() : null
                            const rep = typeof runIntegrityAudit === 'function' ? runIntegrityAudit(st, 'manual_audit') : null
                            audit.pre.textContent = typeof formatIntegrityAuditReport === 'function' ? formatIntegrityAuditReport(rep) : JSON.stringify(rep, null, 2)
                            if (!last) summary.textContent = 'Audit: ' + String(rep && rep.severity ? rep.severity : 'done')
                        } catch (e) {
                            audit.pre.textContent = 'Audit failed: ' + (e && e.message ? e.message : String(e))
                            if (!last) summary.textContent = 'Audit failed'
                        } finally {
                            btnAudit.disabled = false
                        }
                    })
                } catch (_) {
                    btnAudit.disabled = false
                }
            })

            btnScenario.addEventListener('click', () => {
                try {
                    btnScenario.disabled = true
                    scenario.pre.textContent = 'Running scenario…'
                    scenario.details.open = true
                    nextTick(() => {
                        try {
                            const res = typeof runScenarioRunner === 'function' ? runScenarioRunner({ days: 7, lootRolls: 60 }) : null
                            scenario.pre.textContent = typeof formatScenarioRunnerReport === 'function' ? formatScenarioRunnerReport(res) : JSON.stringify(res, null, 2)
                            if (!last) summary.textContent = 'Scenario: ' + String(res && res.severity ? res.severity : (res && res.ok ? 'ok' : 'done'))
                        } catch (e) {
                            scenario.pre.textContent = 'Scenario failed: ' + (e && e.message ? e.message : String(e))
                            if (!last) summary.textContent = 'Scenario failed'
                        } finally {
                            btnScenario.disabled = false
                        }
                    })
                } catch (_) {
                    btnScenario.disabled = false
                }
            })

            btnCopy.addEventListener('click', () => {
                try {
                    const text = (smoke.pre && smoke.pre.textContent) ? smoke.pre.textContent : ''
                    if (typeof copyToClipboard === 'function') copyToClipboard(text)
                } catch (_) {}
            })

            btnCopyFails.addEventListener('click', () => {
                try {
                    const out = []
                    out.push('SMOKE TEST FAILURES & BUG REPORT')
                    out.push('Patch ' + String(patchLabel || '') + (patchName ? ' — ' + String(patchName) : ''))
                    out.push('')

                    if (last && Array.isArray(last.failed) && last.failed.length) {
                        last.failed.forEach((f, i) => {
                            out.push(String(i + 1) + ') ' + String(f.label || '') + ': ' + String(f.msg || ''))
                        })
                    }

                    const ce = last && last.console && Array.isArray(last.console.errors) ? last.console.errors : []
                    const ca = last && last.console && Array.isArray(last.console.asserts) ? last.console.asserts : []
                    if (ce.length) {
                        out.push('')
                        out.push('console.error (first 20):')
                        ce.slice(0, 20).forEach((x) => out.push('  - ' + String(x)))
                        if (ce.length > 20) out.push('  … +' + (ce.length - 20) + ' more')
                    }
                    if (ca.length) {
                        out.push('')
                        out.push('console.assert failures (first 20):')
                        ca.slice(0, 20).forEach((x) => out.push('  - ' + String(x)))
                        if (ca.length > 20) out.push('  … +' + (ca.length - 20) + ' more')
                    }

                    out.push('')
                    out.push('BUG REPORT (JSON)')
                    try {
                        const bundle = (last && last.bugReport) ? last.bugReport : (typeof buildBugReportBundle === 'function' ? buildBugReportBundle() : null)
                        out.push(JSON.stringify(bundle || { error: 'no bug report' }, null, 2))
                    } catch (_) {
                        out.push('{"error":"failed to stringify bug report"}')
                    }

                    if (typeof copyToClipboard === 'function') copyToClipboard(out.join('\n'))
                } catch (_) {
                    try {
                        if (typeof copyToClipboard === 'function') copyToClipboard((smoke.pre && smoke.pre.textContent) ? smoke.pre.textContent : '')
                    } catch (_) {}
                }
            })

            btnCopyJson.addEventListener('click', () => {
                try {
                    const payload = JSON.stringify((last && last.bugReport) ? last.bugReport : (typeof buildBugReportBundle === 'function' ? buildBugReportBundle() : null), null, 2)
                    if (typeof copyToClipboard === 'function') copyToClipboard(payload)
                } catch (_) {
                    try {
                        if (typeof copyToClipboard === 'function') copyToClipboard((smoke.pre && smoke.pre.textContent) ? smoke.pre.textContent : '')
                    } catch (_) {}
                }
            })

            // Run immediately once so testers see current output without extra taps.
            runSuite()

            // Preflight/perf diagnostic read (kept tiny; stored for quick checks).
            try {
                const preflight = qaReadJsonFromStorage('__emberwood_preflight_last__')
                if (preflight && typeof preflight === 'object') {
                    // Keep in the perf box so it is easy to spot.
                    perf.pre.textContent = (perf.pre.textContent || '') + '\n\nPreflight (last)\n' + safeStringify(preflight, 500)
                }
            } catch (_) {}
        })
    }

    return {
        syncSmokeTestsPillVisibility,
        openSmokeTestsModal
    }
}
