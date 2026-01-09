// Patch 1.2.65: QA performance snapshot helpers extracted from engine.js.
// Exposes consistent perf report formatting for Smoke Tests & Bug Reports.

export function qaReadBootMetrics() {
    try {
        // Prefer the in-memory copy from bootstrap if present.
        if (typeof window !== 'undefined' && window.__EW_BOOT_METRICS__ && typeof window.__EW_BOOT_METRICS__ === 'object') {
            return window.__EW_BOOT_METRICS__
        }
    } catch (_) {}
    return qaReadJsonFromStorage('ew-last-boot-metrics')
}

export function qaReadMemorySnapshot() {
    try {
        const pm = (typeof performance !== 'undefined' && performance) ? performance.memory : null
        if (!pm) return null
        const used = Number(pm.usedJSHeapSize)
        const total = Number(pm.totalJSHeapSize)
        if (!Number.isFinite(used) || !Number.isFinite(total)) return null
        return {
            usedBytes: used,
            totalBytes: total,
            usedMB: Math.round((used / (1024 * 1024)) * 10) / 10,
            totalMB: Math.round((total / (1024 * 1024)) * 10) / 10
        }
    } catch (_) {
        return null
    }
}

export function qaSummarizePerfLog(entries) {
    const arr = Array.isArray(entries) ? entries.filter(Boolean) : []
    const FRAME_BUDGET_MS = 16
    const HITCH_MS = 50

    const fnum = (x, d = 0) => {
        const n = Number(x)
        return Number.isFinite(n) ? n : d
    }

    const getWait = (e) => {
        try {
            const ex = e && e.extra
            if (!ex || typeof ex !== 'object') return 0
            return Math.max(0, fnum(ex.waitMs, 0))
        } catch (_) {
            return 0
        }
    }

    if (!arr.length) {
        return {
            count: 0,
            top: [],
            slow: [],
            worst: [],
            bySubsystem: [],
            thresholds: { frameBudgetMs: FRAME_BUDGET_MS, hitchMs: HITCH_MS }
        }
    }

    // Aggregate per [subsystem,label] using both CPU (exclusive) and wall-clock (inclusive) time.
    const byKey = new Map()
    const bySub = new Map()

    for (const e of arr) {
        const sub = String(e.subsystem || '').trim() || 'engine'
        const label = String(e.label || '').trim() || '(unnamed)'
        const wall = Math.max(0, fnum(e.ms, 0))
        const wait = Math.max(0, getWait(e))
        const cpu = Math.max(0, wall - wait)

        const key = sub + '||' + label
        let r = byKey.get(key)
        if (!r) {
            r = {
                subsystem: sub,
                label,
                count: 0,
                cpuTotal: 0,
                cpuMax: 0,
                wallTotal: 0,
                wallMax: 0,
                waitTotal: 0,
                waitMax: 0
            }
            byKey.set(key, r)
        }
        r.count++
        r.cpuTotal += cpu
        r.wallTotal += wall
        r.waitTotal += wait
        r.cpuMax = Math.max(r.cpuMax, cpu)
        r.wallMax = Math.max(r.wallMax, wall)
        r.waitMax = Math.max(r.waitMax, wait)

        let s = bySub.get(sub)
        if (!s) {
            s = { subsystem: sub, count: 0, cpuTotal: 0, cpuMax: 0, wallTotal: 0, wallMax: 0, waitTotal: 0, waitMax: 0 }
            bySub.set(sub, s)
        }
        s.count++
        s.cpuTotal += cpu
        s.wallTotal += wall
        s.waitTotal += wait
        s.cpuMax = Math.max(s.cpuMax, cpu)
        s.wallMax = Math.max(s.wallMax, wall)
        s.waitMax = Math.max(s.waitMax, wait)
    }

    const rows = Array.from(byKey.values()).map((r) => {
        const cpuAvg = r.count ? (r.cpuTotal / r.count) : 0
        const wallAvg = r.count ? (r.wallTotal / r.count) : 0
        const waitAvg = r.count ? (r.waitTotal / r.count) : 0
        return {
            subsystem: r.subsystem,
            label: r.label,
            count: r.count,
            avgMs: cpuAvg,
            maxMs: r.cpuMax,
            avgWallMs: wallAvg,
            maxWallMs: r.wallMax,
            avgWaitMs: waitAvg,
            maxWaitMs: r.waitMax
        }
    })

    rows.sort((a, b) => (b.avgMs - a.avgMs) || (b.maxMs - a.maxMs) || (b.count - a.count))

    const fmtRow = (r) => ({
        subsystem: r.subsystem,
        label: r.label,
        count: r.count,
        avgMs: Math.round(r.avgMs * 10) / 10,
        maxMs: Math.round(r.maxMs * 10) / 10,
        avgWallMs: Math.round(r.avgWallMs * 10) / 10,
        maxWallMs: Math.round(r.maxWallMs * 10) / 10,
        avgWaitMs: Math.round(r.avgWaitMs * 10) / 10,
        maxWaitMs: Math.round(r.maxWaitMs * 10) / 10
    })

    // "Top" is most expensive average CPU in the tail.
    const top = rows.slice(0, 12).map(fmtRow)

    // Slow paths: CPU that can blow frame budget.
    const slow = rows
        .filter((r) => (r.avgMs >= FRAME_BUDGET_MS) || (r.maxMs >= HITCH_MS))
        .slice(0, 12)
        .map(fmtRow)

    // Worst offenders: CPU hitch risk.
    const worst = rows
        .filter((r) => (r.maxMs >= HITCH_MS) || (r.avgMs >= FRAME_BUDGET_MS))
        .slice(0, 8)
        .map((r) => ({
            ...fmtRow(r),
            flags: {
                overFrameBudget: r.avgMs >= FRAME_BUDGET_MS,
                hitch: r.maxMs >= HITCH_MS
            }
        }))

    const bySubsystem = Array.from(bySub.values())
        .map((s) => ({
            subsystem: s.subsystem,
            count: s.count,
            avgMs: s.count ? Math.round((s.cpuTotal / s.count) * 10) / 10 : 0,
            maxMs: Math.round(s.cpuMax * 10) / 10,
            avgWallMs: s.count ? Math.round((s.wallTotal / s.count) * 10) / 10 : 0,
            maxWallMs: Math.round(s.wallMax * 10) / 10,
            avgWaitMs: s.count ? Math.round((s.waitTotal / s.count) * 10) / 10 : 0,
            maxWaitMs: Math.round(s.waitMax * 10) / 10
        }))
        .sort((a, b) => (b.avgMs - a.avgMs) || (b.maxMs - a.maxMs) || (b.count - a.count))

    return { count: arr.length, top, slow, worst, bySubsystem, thresholds: { frameBudgetMs: FRAME_BUDGET_MS, hitchMs: HITCH_MS } }
}

export function qaCollectPerfSnapshotSync(s) {
    const boot = qaReadBootMetrics()
    const memory = qaReadMemorySnapshot()

    const d = (s && s.debug && typeof s.debug === 'object') ? s.debug : null
    const perfTail = (d && Array.isArray(d.perfLog)) ? d.perfLog.slice(-200) : []
    const perfSummary = qaSummarizePerfLog(perfTail)
    const fps = (d && d.lastFpsSample) ? d.lastFpsSample : null

    return {
        boot,
        memory,
        fps,
        perf: {
            captureEnabled: !!(d && d.capturePerf),
            tailCount: perfSummary.count,
            top: perfSummary.top,
            slow: perfSummary.slow,
            worst: perfSummary.worst,
            bySubsystem: perfSummary.bySubsystem,
            thresholds: perfSummary.thresholds
        }
    }
}

export function qaFormatPerfSnapshotText(snap) {
    const lines = []
    const boot = snap && snap.boot ? snap.boot : null
    const mem = snap && snap.memory ? snap.memory : null
    const fps = snap && snap.fps ? snap.fps : null
    const perf = snap && snap.perf ? snap.perf : null

    lines.push('Performance')
    if (boot && boot.durations) {
        const d = boot.durations
        const fmt = (n) => (typeof n === 'number' && Number.isFinite(n)) ? (String(n) + ' ms') : '(n/a)'
        lines.push('  Boot total: ' + fmt(d.totalMs) + ' • Engine import: ' + fmt(d.importMs))
        if (d.prefetchMs !== null) lines.push('  Asset prefetch: ' + fmt(d.prefetchMs) + ' • Ready paint: ' + fmt(d.readyPaintMs))
        if (d.preflightMs !== null) lines.push('  Preflight scan: ' + fmt(d.preflightMs))
    } else {
        lines.push('  Boot timings: (n/a)')
    }

    if (fps && typeof fps.fps === 'number') {
        lines.push('  FPS sample: ' + String(fps.fps) + ' fps • avg frame: ' + String(fps.avgFrameMs) + ' ms (' + String(fps.samples || 0) + ' samples)')
    } else {
        lines.push('  FPS sample: (tap “Run” or open this modal to capture)')
    }

    if (mem && typeof mem.usedMB === 'number' && typeof mem.totalMB === 'number') {
        lines.push('  JS heap: ' + String(mem.usedMB) + ' / ' + String(mem.totalMB) + ' MB')
    }

    if (perf) {
        const th = (perf.thresholds && typeof perf.thresholds === 'object') ? perf.thresholds : { frameBudgetMs: 16, hitchMs: 50 }
        const frameMs = Number(th.frameBudgetMs) || 16
        const hitchMs = Number(th.hitchMs) || 50

        const fmtTriple = (r) => {
            if (!r) return ''
            const cpuA = (typeof r.avgMs === 'number') ? r.avgMs : 0
            const cpuM = (typeof r.maxMs === 'number') ? r.maxMs : 0
            const wallA = (typeof r.avgWallMs === 'number') ? r.avgWallMs : null
            const wallM = (typeof r.maxWallMs === 'number') ? r.maxWallMs : null
            const waitA = (typeof r.avgWaitMs === 'number') ? r.avgWaitMs : null
            const waitM = (typeof r.maxWaitMs === 'number') ? r.maxWaitMs : null
            let s = String(cpuA) + ' / ' + String(cpuM) + ' ms'
            if (wallA !== null && wallM !== null) s += ' (wall ' + String(wallA) + ' / ' + String(wallM) + ')'
            if (waitA !== null && waitM !== null && (waitA > 0 || waitM > 0)) s += ' (wait ' + String(waitA) + ' / ' + String(waitM) + ')'
            return s
        }

        lines.push(
            '  Perf capture: ' + (perf.captureEnabled ? 'ON' : 'off') +
            ' • entries: ' + String(perf.tailCount || 0) +
            ' • thresholds: >' + String(frameMs) + 'ms avg, >' + String(hitchMs) + 'ms max'
        )

        if (Array.isArray(perf.bySubsystem) && perf.bySubsystem.length) {
            lines.push('  Subsystems (avg/max ms):')
            perf.bySubsystem.slice(0, 7).forEach((r) => {
                lines.push('    - [' + String(r.subsystem || 'other') + '] ' + fmtTriple(r) + ' (' + String(r.count) + 'x)')
            })
        }

        if (Array.isArray(perf.worst) && perf.worst.length) {
            lines.push('  Worst offenders (avg/max ms):')
            perf.worst.slice(0, 10).forEach((r) => {
                const flags = r && r.flags ? r.flags : null
                const tag = (flags && flags.hitch) ? ' ⚠ hitch' : (flags && flags.overFrameBudget) ? ' ⚠ over budget' : ''
                lines.push(
                    '    - [' + String(r.subsystem || 'other') + '] ' + String(r.label) +
                    ' — ' + fmtTriple(r) + ' (' + String(r.count) + 'x)' + tag
                )
            })
        } else if (perf.captureEnabled) {
            lines.push('  Worst offenders: none (good)')
        }

        if (Array.isArray(perf.slow) && perf.slow.length) {
            lines.push('  Slow paths (avg/max ms):')
            perf.slow.slice(0, 8).forEach((r) => {
                lines.push('    - [' + String(r.subsystem || 'other') + '] ' + String(r.label) + ' — ' + fmtTriple(r) + ' (' + String(r.count) + 'x)')
            })
        } else if (perf.captureEnabled) {
            lines.push('  Slow paths: none flagged in tail (good)')
        }
    }

    return lines.join('\n')
}

export function qaSampleFps(frames = 28, maxMs = 900) {
    return new Promise((resolve) => {
        try {
            if (typeof requestAnimationFrame !== 'function') return resolve(null)
            const now = (typeof performance !== 'undefined' && performance && typeof performance.now === 'function')
                ? () => performance.now()
                : () => Date.now()

            const deltas = []
            let last = now()
            const start = last
            let n = 0

            const tick = (t) => {
                const cur = (typeof t === 'number') ? t : now()
                const dt = cur - last
                last = cur
                deltas.push(dt)
                n += 1

                if (n >= frames || (cur - start) >= maxMs) {
                    // drop warmup frames
                    const sample = deltas.slice(3).filter((x) => typeof x === 'number' && Number.isFinite(x) && x > 0)
                    if (!sample.length) return resolve(null)
                    const avg = sample.reduce((a, b) => a + b, 0) / sample.length
                    const fps = avg > 0 ? (1000 / avg) : null
                    return resolve({
                        fps: (fps && Number.isFinite(fps)) ? Math.round(fps * 10) / 10 : null,
                        avgFrameMs: Math.round(avg * 10) / 10,
                        samples: sample.length
                    })
                }
                requestAnimationFrame(tick)
            }

            requestAnimationFrame(tick)
        } catch (_) {
            resolve(null)
        }
    })
}

