/**
 * QA Integrity Scanners Module
 * Patch 1.2.72 - Extracted from gameOrchestrator.js (lines 11094-12301)
 * 
 * Provides comprehensive QA scanning and integrity checking functions for game state validation.
 * All functions use dependency injection for testability and modularity.
 */

/**
 * Creates the integrity scanners module with injected dependencies
 * @param {Object} deps - Dependencies object containing all required functions and constants
 * @returns {Object} Object containing all QA scanner functions
 */
export function createIntegrityScannersModule(deps) {
    const {
        // Constants
        PLAYER_CLASSES,
        ABILITIES,
        ENEMY_ABILITIES,
        COMPANION_ABILITIES,
        TALENT_DEFS,
        GAME_PATCH,
        GAME_PATCH_NAME,
        SAVE_SCHEMA,
        
        // State functions
        validateState,
        normalizeElementType,
        ensurePlayerTalents,
        ensurePlayerSpellSystems,
        ensurePlayerStatsDefaults,
        recalcPlayerStats,
        sanitizeCoreStateObject,
        _setState,
        syncGlobalStateRef,
        createEmptyState,
        createQuestState,
        createFlagState,
        
        // RNG functions
        initRngState,
        setDeterministicRngEnabled,
        setRngSeed,
        
        // Time and economy functions
        initTimeState,
        initVillageEconomyState,
        initGovernmentState,
        ensureVillagePopulation,
        advanceWorldDays,
        
        // Loot and items
        generateLootDrop,
        
        // Save/load functions
        _buildSaveBlob,
        copyFeedbackToClipboard,
        
        // Debug functions
        getLastCrashReport,
        qaCollectPerfSnapshotSync,
        qaFormatPerfSnapshotText,
        
        // Performance
        perfWrap,
        _perfNow,
        
        // UI functions
        isUiDisabled,
        setUiDisabled,
        
        // Global state references
        state,
        saveGame,
        updateHUD,
        recordInput,
        quests,
        lastSaveError
    } = deps

    function qaScanNonFiniteNumbers(rootObj, opts = {}) {
        const maxIssues = Number.isFinite(Number(opts.maxIssues)) ? Math.max(1, Number(opts.maxIssues)) : 400
        const issues = []
        const seen = new WeakSet()

        const walk = (obj, path, depth) => {
            if (issues.length >= maxIssues) return
            if (obj === null || obj === undefined) return

            const t = typeof obj
            if (t === 'number') {
                if (!Number.isFinite(obj)) issues.push(path + ' = ' + String(obj))
                return
            }
            if (t !== 'object') return

            if (seen.has(obj)) return
            seen.add(obj)

            // keep this bounded
            if (depth > 24) return

            if (Array.isArray(obj)) {
                for (let i = 0; i < obj.length; i++) {
                    walk(obj[i], path + '[' + i + ']', depth + 1)
                    if (issues.length >= maxIssues) return
                }
                return
            }

            const keys = Object.keys(obj)
            for (let i = 0; i < keys.length; i++) {
                const k = keys[i]
                walk(obj[k], path ? (path + '.' + k) : k, depth + 1)
                if (issues.length >= maxIssues) return
            }
        }

        try { walk(rootObj, '', 0) } catch (_) {}
        return issues
    }

    function qaScanNegativeCounters(s) {
        const issues = []
        try {
            const p = s && s.player
            if (p && typeof p.gold === 'number' && p.gold < 0) issues.push('player.gold < 0 (' + p.gold + ')')
            if (p && typeof p.hp === 'number' && p.hp < 0) issues.push('player.hp < 0 (' + p.hp + ')')
            if (p && typeof p.maxHp === 'number' && p.maxHp < 0) issues.push('player.maxHp < 0 (' + p.maxHp + ')')
            if (p && typeof p.resource === 'number' && p.resource < 0) issues.push('player.resource < 0 (' + p.resource + ')')
            if (p && typeof p.maxResource === 'number' && p.maxResource < 0) issues.push('player.maxResource < 0 (' + p.maxResource + ')')

            if (p && Array.isArray(p.inventory)) {
                p.inventory.forEach((it, i) => {
                    if (!it) return
                    if (typeof it.quantity === 'number' && it.quantity < 0) issues.push('player.inventory[' + i + '].quantity < 0 (' + it.quantity + ')')
                })
            }

            const bank = s && s.bank
            if (bank && typeof bank.balance === 'number' && bank.balance < 0) issues.push('bank.balance < 0 (' + bank.balance + ')')
            if (bank && typeof bank.investments === 'number' && bank.investments < 0) issues.push('bank.investments < 0 (' + bank.investments + ')')
            if (bank && bank.loan && typeof bank.loan.balance === 'number' && bank.loan.balance < 0) issues.push('bank.loan.balance < 0 (' + bank.loan.balance + ')')

            const stock = s && s.merchantStock
            if (stock && typeof stock === 'object') {
                for (const region in stock) {
                    const regionObj = stock[region]
                    if (!regionObj || typeof regionObj !== 'object') continue
                    for (const merchant in regionObj) {
                        const bucket = regionObj[merchant]
                        if (!bucket || typeof bucket !== 'object') continue
                        for (const key in bucket) {
                            const v = bucket[key]
                            if (typeof v === 'number' && v < 0) issues.push('merchantStock.' + region + '.' + merchant + '.' + key + ' < 0 (' + v + ')')
                        }
                    }
                }
            }
        } catch (_) {}
        return issues
    }

    function qaScanStatSanity(s) {
        const issues = []
        const push = (msg) => { if (issues.length < 140) issues.push(msg) }

        try {
            const p = s && s.player
            if (!p) return issues

            const num = (v) => {
                const n = Number(v)
                return Number.isFinite(n) ? n : null
            }
            const pct = (v, name, min, max) => {
                const n = num(v)
                if (n === null) return push(name + ' is non-finite (' + String(v) + ')')
                if (n < min - 1e-6) push(name + ' below ' + min + '% (' + n + ')')
                if (n > max + 1e-6) push(name + ' above ' + max + '% (' + n + ')')
            }
            const nonneg = (v, name) => {
                const n = num(v)
                if (n === null) return push(name + ' is non-finite (' + String(v) + ')')
                if (n < -1e-6) push(name + ' < 0 (' + n + ')')
            }

            // Core resource bounds
            if (num(p.maxHp) !== null && num(p.hp) !== null && num(p.hp) > num(p.maxHp) + 1e-6) push('player.hp exceeds maxHp (' + p.hp + ' > ' + p.maxHp + ')')
            if (num(p.maxResource) !== null && num(p.resource) !== null && num(p.resource) > num(p.maxResource) + 1e-6) push('player.resource exceeds maxResource (' + p.resource + ' > ' + p.maxResource + ')')

            const st = p.stats || {}
            nonneg(st.attack, 'player.stats.attack')
            nonneg(st.magic, 'player.stats.magic')
            nonneg(st.armor, 'player.stats.armor')
            nonneg(st.speed, 'player.stats.speed')

            pct(st.critChance, 'player.stats.critChance', 0, 100)
            pct(st.dodge, 'player.stats.dodge', 0, 100)
            pct(st.resistAll, 'player.stats.resistAll', 0, 95)
            pct(st.armorPen, 'player.stats.armorPen', 0, 80)

            const scanElemVals = (m, label, min, max) => {
                if (!m || typeof m !== 'object') return
                Object.keys(m).forEach((k) => {
                    const v = num(m[k])
                    if (v === null) return push(label + '.' + String(k) + ' is non-finite (' + String(m[k]) + ')')
                    if (v < min - 1e-6) push(label + '.' + String(k) + ' below ' + min + ' (' + v + ')')
                    if (v > max + 1e-6) push(label + '.' + String(k) + ' above ' + max + ' (' + v + ')')
                })
            }

            scanElemVals(st.elementalBonuses, 'player.stats.elementalBonuses', -50, 300)
            scanElemVals(st.elementalResists, 'player.stats.elementalResists', -10, 500)

            // Combat caps reminder: resistAll/element resists are capped at 75% in combat.
            // Values above that aren't "invalid", but are usually unintended.
            if (st.elementalResists && typeof st.elementalResists === 'object') {
                Object.keys(st.elementalResists).forEach((k) => {
                    const v = num(st.elementalResists[k])
                    if (v !== null && v > 200) push('player.stats.elementalResists.' + String(k) + ' extremely high (' + v + '%)')
                })
            }
        } catch (_) {}

        return issues
    }

    function qaScanCombatRuntimeSanity(s) {
        const issues = []
        const push = (msg) => { if (issues.length < 120) issues.push(msg) }

        try {
            if (!s || typeof s !== 'object') return ['state is null/invalid']
            const c = s.combat
            if (!c || typeof c !== 'object') return issues

            // Busy should never be true when not in combat.
            if (!s.inCombat && c.busy) push('combat.busy=true while inCombat=false')

            if (typeof c.round === 'number' && (!Number.isFinite(c.round) || c.round < 1)) push('combat.round invalid (' + String(c.round) + ')')
            if (c.phase && ['player', 'enemy', 'loot', 'win', 'lose'].indexOf(String(c.phase)) < 0) push('combat.phase unknown (' + String(c.phase) + ')')

            // Action context multipliers should be finite if present
            const ctx = s && s._playerAbilityCtx
            if (ctx && typeof ctx === 'object') {
                if (ctx.dmgMult !== undefined && !(typeof ctx.dmgMult === 'number' && Number.isFinite(ctx.dmgMult))) push('_playerAbilityCtx.dmgMult non-finite (' + String(ctx.dmgMult) + ')')
                if (ctx.healMult !== undefined && !(typeof ctx.healMult === 'number' && Number.isFinite(ctx.healMult))) push('_playerAbilityCtx.healMult non-finite (' + String(ctx.healMult) + ')')
            }
        } catch (_) {}

        return issues
    }

    function qaScanElementKeyIssues(s) {
        const issues = []
        const push = (msg) => { if (issues.length < 120) issues.push(msg) }

        const scanMap = (obj, label) => {
            if (!obj || typeof obj !== 'object') return
            const buckets = {}
            Object.keys(obj).forEach((raw) => {
                const nk = normalizeElementType(raw)
                if (!nk) {
                    push(label + ': invalid element key "' + String(raw) + '"')
                    return
                }
                const r = String(raw).trim().toLowerCase()
                if (r !== nk) push(label + ': non-normalized key "' + String(raw) + '" -> "' + nk + '"')
                if (!buckets[nk]) buckets[nk] = []
                buckets[nk].push(raw)
            })
            Object.keys(buckets).forEach((k) => {
                if (buckets[k].length > 1) {
                    push(label + ': duplicate keys for "' + k + '": ' + buckets[k].map(String).join(', '))
                }
            })
        }

        try {
            const p = s && s.player
            if (p && p.stats) {
                scanMap(p.stats.elementalBonuses, 'player.stats.elementalBonuses')
                scanMap(p.stats.elementalResists, 'player.stats.elementalResists')
            }
            if (p && p.equipment && typeof p.equipment === 'object') {
                Object.keys(p.equipment).forEach((slot) => {
                    const it = p.equipment[slot]
                    if (!it || typeof it !== 'object') return
                    scanMap(it.elementalBonuses, 'equipment.' + slot + '.elementalBonuses')
                    scanMap(it.elementalResists, 'equipment.' + slot + '.elementalResists')
                })
            }
            if (p && Array.isArray(p.inventory)) {
                p.inventory.forEach((it, i) => {
                    if (!it || typeof it !== 'object') return
                    scanMap(it.elementalBonuses, 'inventory[' + i + '].elementalBonuses')
                    scanMap(it.elementalResists, 'inventory[' + i + '].elementalResists')
                })
            }
            // Enemies
            if (s && s.inCombat && Array.isArray(s.enemies)) {
                s.enemies.forEach((e, i) => {
                    if (!e || typeof e !== 'object') return
                    scanMap(e.elementalResists, 'enemies[' + i + '].elementalResists')
                })
            }
        } catch (_) {}
        return issues
    }

    function qaScanAbilityElementCoverage() {
        const issues = []
        const push = (msg) => { if (issues.length < 200) issues.push(msg) }

        const allowed = { fire: 1, frost: 1, lightning: 1, holy: 1, shadow: 1, arcane: 1, poison: 1, earth: 1, nature: 1 }
        const scan = (bucket, label) => {
            if (!bucket || typeof bucket !== 'object') return
            Object.keys(bucket).forEach((id) => {
                const ab = bucket[id]
                if (!ab || typeof ab !== 'object') return push(label + '.' + id + ': missing def')
                const et = normalizeElementType(ab.elementType || null)
                const tags = Array.isArray(ab.tags) ? ab.tags : []
                const hasPhysical = tags.indexOf('physical') >= 0
                if (!et && !hasPhysical) push(label + '.' + id + ': missing elementType and missing physical tag')
                if (et && !allowed[et]) push(label + '.' + id + ': unknown elementType "' + String(ab.elementType) + '"')
                if (et && hasPhysical) push(label + '.' + id + ': has both elementType "' + et + '" and physical tag')
            })
        }

        try {
            scan(ABILITIES, 'ABILITIES')
            scan(ENEMY_ABILITIES, 'ENEMY_ABILITIES')
            scan(COMPANION_ABILITIES, 'COMPANION_ABILITIES')
        } catch (_) {}
        return issues
    }

    function qaScanTalentIntegrity(s) {
        const issues = []
        const push = (msg) => { if (issues.length < 160) issues.push(msg) }
        try {
            const p = s && s.player
            if (!p || typeof p !== 'object') return issues
            ensurePlayerTalents(p)

            if (!Number.isFinite(Number(p.talentPoints))) push('player.talentPoints is not finite')
            if (Number(p.talentPoints) < 0) push('player.talentPoints < 0 (' + String(p.talentPoints) + ')')

            const classId = String(p.classId || '')
            const classTalents = (TALENT_DEFS && TALENT_DEFS[classId]) ? TALENT_DEFS[classId] : []
            if (!classTalents || !classTalents.length) push('no talent table found for classId="' + classId + '"')
            const allowed = {}
            classTalents.forEach((t) => { if (t && t.id) allowed[t.id] = true })

            const owned = p.talents && typeof p.talents === 'object' ? Object.keys(p.talents).filter((k) => p.talents[k]) : []
            owned.forEach((tid) => {
                if (!allowed[tid]) push('talent unlocked but not in class table: ' + String(tid))
            })

            // Defensive: ensure the table itself contains  (8) unique ids.
            if (classTalents && classTalents.length) {
                const seen = {}
                classTalents.forEach((t) => {
                    if (!t || !t.id) return
                    if (seen[t.id]) push('duplicate talent id in table: ' + t.id)
                    seen[t.id] = true
                })
                if (classTalents.length !== 8) push('class talent table count != 8 (' + classTalents.length + ')')
            }
        } catch (_) {}
        return issues
    }

    function qaScanCooldownIntegrity(s) {
        const issues = []
        const push = (msg) => { if (issues.length < 120) issues.push(msg) }
        try {
            const p = s && s.player
            if (p && p.cooldowns && typeof p.cooldowns === 'object') {
                Object.keys(p.cooldowns).forEach((k) => {
                    const v = Number(p.cooldowns[k])
                    if (!Number.isFinite(v)) push('player.cooldowns.' + k + ' not finite (' + String(p.cooldowns[k]) + ')')
                    if (v < 0) push('player.cooldowns.' + k + ' < 0 (' + v + ')')
                    if (v > 99) push('player.cooldowns.' + k + ' unusually high (' + v + ')')
                })
            }
            if (s && s.inCombat && Array.isArray(s.enemies)) {
                s.enemies.forEach((e, i) => {
                    if (!e || typeof e !== 'object') return
                    if (e.abilityCooldowns && typeof e.abilityCooldowns === 'object') {
                        Object.keys(e.abilityCooldowns).forEach((k) => {
                            const v = Number(e.abilityCooldowns[k])
                            if (!Number.isFinite(v)) push('enemies[' + i + '].abilityCooldowns.' + k + ' not finite')
                            if (v < 0) push('enemies[' + i + '].abilityCooldowns.' + k + ' < 0 (' + v + ')')
                        })
                    }
                })
            }
        } catch (_) {}
        return issues
    }

    function qaScanReferenceIntegrity(s) {
        const issues = []
        const push = (msg) => { if (issues.length < 120) issues.push(msg) }

        try {
            if (!s || typeof s !== 'object') return ['state is null/invalid']
            const p = s.player
            if (!p) push('state.player missing')
            if (p) {
                if (!PLAYER_CLASSES[p.classId]) push('player.classId unknown: ' + String(p.classId))
                if (Array.isArray(p.equippedSpells)) {
                    p.equippedSpells.forEach((id) => { if (!ABILITIES || !ABILITIES[id]) push('player.equippedSpells missing ability: ' + String(id)) })
                }
                if (Array.isArray(p.spells)) {
                    p.spells.forEach((id) => { if (!ABILITIES || !ABILITIES[id]) push('player.spells missing ability: ' + String(id)) })
                }
            }
            if (s.inCombat) {
                if (!Array.isArray(s.enemies) || !s.enemies.length) push('inCombat=true but enemies[] missing/empty')
                if (s.currentEnemy) {
                    if (Array.isArray(s.enemies) && s.enemies.indexOf(s.currentEnemy) < 0) push('currentEnemy not present in enemies[] (pointer leak)')
                }
                const idx = Number(s.targetEnemyIndex)
                if (Array.isArray(s.enemies) && Number.isFinite(idx)) {
                    if (idx < 0 || idx >= s.enemies.length) push('targetEnemyIndex out of range: ' + String(s.targetEnemyIndex))
                }
            }
        } catch (_) {}
        return issues
    }

    function qaCollectBugScannerFindings(s) {
        const nonFinite = qaScanNonFiniteNumbers(s, { maxIssues: 250 })
        const negatives = qaScanNegativeCounters(s)
        const elementKeys = qaScanElementKeyIssues(s)
        const refs = qaScanReferenceIntegrity(s)
        const abilityElements = qaScanAbilityElementCoverage()
        const statSanity = qaScanStatSanity(s)
        const combatRuntime = qaScanCombatRuntimeSanity(s)
        const talentIntegrity = qaScanTalentIntegrity(s)

        const hasIssues = !!(
            nonFinite.length ||
            negatives.length ||
            elementKeys.length ||
            refs.length ||
            abilityElements.length ||
            statSanity.length ||
            combatRuntime.length ||
            talentIntegrity.length
        )
        return {
            hasIssues,
            counts: {
                nonFinite: nonFinite.length,
                negatives: negatives.length,
                elementKeys: elementKeys.length,
                refs: refs.length,
                abilityElements: abilityElements.length,
                statSanity: statSanity.length,
                combatRuntime: combatRuntime.length,
                talentIntegrity: talentIntegrity.length
            },
            findings: {
                nonFinite,
                negatives,
                elementKeys,
                refs,
                abilityElements,
                statSanity,
                combatRuntime,
                talentIntegrity
            }
        }
    }

    function classifyIntegritySeverity(invariant, scanners) {
        try {
            if (!invariant || typeof invariant !== 'object') return 'warn'
            const invIssues = Array.isArray(invariant.issues) ? invariant.issues : []
            const counts = scanners && scanners.counts ? scanners.counts : null

            // Any non-finite numbers are treated as critical.
            if (counts && counts.nonFinite && counts.nonFinite > 0) return 'critical'

            // Missing core containers or NaN core stats are critical.
            for (let i = 0; i < invIssues.length; i++) {
                const code = invIssues[i] && invIssues[i].code ? String(invIssues[i].code) : ''
                if (!code) continue
                if (code.indexOf('.missing') >= 0) return 'critical'
                if (code.indexOf('.nan') >= 0) return 'critical'
                if (code.indexOf('time.dayIndex.bad') >= 0) return 'critical'
                if (code.indexOf('player.hp.range') >= 0) return 'warn'
            }

            // Reference issues + negative counters are usually recoverable but should be investigated.
            if (counts) {
                if (counts.negatives && counts.negatives > 0) return 'warn'
                if (counts.refs && counts.refs > 0) return 'warn'
                if (counts.combatRuntime && counts.combatRuntime > 0) return 'warn'
                if (counts.statSanity && counts.statSanity > 0) return 'warn'
                if (counts.elementKeys && counts.elementKeys > 0) return 'warn'
            }

            return invIssues.length ? 'warn' : 'ok'
        } catch (_) {
            return 'warn'
        }
    }

    function runIntegrityAudit(s, stage, opts = {}) {
        const st = s || state
        const label = String(stage || 'audit')

        return perfWrap(st, 'qa:integrityAudit', { stage: label }, () => {
            // Best-effort sanitation so "harmless" out-of-range values don't masquerade as corruption.
            try { sanitizeCoreStateObject(st) } catch (_) {}

            let invariant = null
            try {
                invariant = validateState(st)
            } catch (e) {
                invariant = {
                    ok: false,
                    issues: [{ code: 'audit.exception', detail: (e && e.message) ? e.message : String(e) }]
                }
            }

            // Deep scanners: bounded and safe to run on live saves.
            let scanners = null
            try {
                scanners = qaCollectBugScannerFindings(st)
            } catch (_) {
                scanners = { hasIssues: false, counts: {}, findings: {} }
            }

            const severity = classifyIntegritySeverity(invariant, scanners)
            const report = {
                stage: label,
                time: Date.now(),
                severity,
                ok: severity === 'ok',
                invariant,
                scanners
            }

            // Persist a compact summary for bug reports.
            try {
                if (!st.debug || typeof st.debug !== 'object') st.debug = {}
                st.debug.lastAudit = {
                    stage: report.stage,
                    time: report.time,
                    severity: report.severity,
                    invariantIssueCount: Array.isArray(invariant.issues) ? invariant.issues.length : 0,
                    scannerCounts: scanners && scanners.counts ? scanners.counts : {}
                }
            } catch (_) {}

            return report
        })
    }

    function formatIntegrityAuditReport(report) {
        const r = report || {}
        const inv = r.invariant || {}
        const sc = r.scanners || {}
        const counts = sc.counts || {}

        const lines = []
        lines.push('Integrity Audit — ' + String(r.stage || 'manual'))
        lines.push('Severity: ' + String(r.severity || 'unknown'))
        try {
            if (r.time) lines.push('Time (UTC): ' + new Date(Number(r.time)).toISOString())
        } catch (_) {}
        lines.push('')

        if (inv && inv.ok) {
            lines.push('Invariants: ✓ OK')
        } else {
            const issues = Array.isArray(inv.issues) ? inv.issues : []
            lines.push('Invariants: ⚠ ' + issues.length + ' issue(s)')
            issues.slice(0, 16).forEach((x) => {
                const code = x && x.code ? String(x.code) : 'issue'
                const detail = x && x.detail ? String(x.detail) : ''
                lines.push('  - ' + code + (detail ? ': ' + detail : ''))
            })
            if (issues.length > 16) lines.push('  … +' + String(issues.length - 16) + ' more')
        }
        lines.push('')

        const fmtCount = (k, label) => {
            const v = Number(counts && counts[k])
            if (Number.isFinite(v) && v > 0) lines.push('Scanner: ' + label + ' — ' + v)
        }
        fmtCount('nonFinite', 'Non-finite numbers')
        fmtCount('negatives', 'Negative counters')
        fmtCount('elementKeys', 'Element key anomalies')
        fmtCount('refs', 'Reference integrity')
        fmtCount('abilityElements', 'Ability element tags')
        fmtCount('statSanity', 'Derived stat sanity')
        fmtCount('combatRuntime', 'Combat runtime sanity')
        fmtCount('talentIntegrity', 'Talent wiring integrity')

        const hasAny = !!(sc && sc.hasIssues)
        if (!hasAny) lines.push('Scanners: ✓ No findings')

        // Include a tiny snippet of the highest-signal scanner output.
        try {
            const f = sc.findings || {}
            const show = (label, arr) => {
                if (!Array.isArray(arr) || !arr.length) return
                lines.push('')
                lines.push(label + ' (top ' + Math.min(8, arr.length) + ')')
                arr.slice(0, 8).forEach((x) => lines.push('  - ' + String(x)))
            }
            show('Non-finite paths', f.nonFinite)
            show('Negative counters', f.negatives)
            show('Reference issues', f.refs)
        } catch (_) {}

        return lines.join('\n')
    }

    function runScenarioRunner(opts = {}) {
        const days = Math.max(1, Math.min(30, Math.floor(Number(opts.days || 7))))
        const lootRolls = Math.max(0, Math.min(250, Math.floor(Number(opts.lootRolls || 60))))
        const seed = (Number.isFinite(Number(opts.seed)) ? (Number(opts.seed) >>> 0) : 13371337)

        // Build a fully-serializable snapshot and clone it so the scenario cannot mutate the live state.
        let blob = null
        try {
            blob = JSON.parse(JSON.stringify(_buildSaveBlob()))
        } catch (e) {
            return { ok: false, ms: 0, error: 'Failed to clone save blob: ' + (e && e.message ? e.message : String(e)) }
        }

        const t0 = _perfNow()
        const live = {
            state: state,
            ref: null,
            saveGame: typeof saveGame === 'function' ? saveGame : null,
            updateHUD: typeof updateHUD === 'function' ? updateHUD : null,
            uiWasDisabled: (typeof isUiDisabled === 'function') ? !!isUiDisabled() : false,
            recordInput: typeof recordInput === 'function' ? recordInput : null,
            updateQuestBox: (typeof quests !== 'undefined' && quests && typeof quests.updateQuestBox === 'function')
                ? quests.updateQuestBox
                : null
        }

        try {
            try {
                if (typeof window !== 'undefined') live.ref = window.__emberwoodStateRef
            } catch (_) {}

            // Hydrate an isolated state.
            const s = createEmptyState()
            s.player = blob.player || null
            s.area = blob.area || 'village'
            s.difficulty = blob.difficulty || 'normal'
            s.dynamicDifficulty = blob.dynamicDifficulty || { band: 0, tooEasyStreak: 0, struggleStreak: 0 }
            s.quests = blob.quests || createQuestState()
            s.flags = blob.flags || createFlagState()
            s.debug = Object.assign({}, blob.debug || {})
            s.companion = blob.companion || null
            s.time = blob.time || null
            s.villageEconomy = blob.villageEconomy || null
            s.government = blob.government || null
            s.village = blob.village || null
            s.bank = blob.bank || null
            s.villageMerchantNames = blob.villageMerchantNames || null
            s.merchantStock = blob.merchantStock || null
            s.merchantStockMeta = blob.merchantStockMeta || null
            s.sim = blob.sim || { lastDailyTickDay: null }
            s.log = []
            s.logFilter = 'all'
            s.inCombat = false
            s.enemies = null
            s.currentEnemy = null

            // Swap global refs so rngFloat(null, …) and any stray global reads use the scenario state.
            _setState(s)
            syncGlobalStateRef()

            // Disable persistence + UI side effects while the scenario runs.
            if (live.saveGame) saveGame = () => {}
            if (live.updateHUD) updateHUD = () => {}
            if (live.recordInput) recordInput = () => {}
            try { if (typeof setUiDisabled === 'function') setUiDisabled(true) } catch (_) {}

            // Patch 1.2.53: prevent quest UI refreshes from mutating the live DOM while state is swapped.
            try {
                if (typeof quests !== 'undefined' && quests && typeof quests.updateQuestBox === 'function') {
                    quests.updateQuestBox = () => {}
                }
            } catch (_) {}

            // Ensure subsystems exist.
            try { initRngState(s) } catch (_) {}
            try { setDeterministicRngEnabled(s, true) } catch (_) {}
            try { setRngSeed(s, seed) } catch (_) {}

            try {
                if (!s.time) initTimeState(s)
                if (!s.villageEconomy) initVillageEconomyState(s)
                if (!s.government) initGovernmentState(s, 0)
                ensureVillagePopulation(s)
            } catch (_) {}

            try {
                if (s.player) {
                    ensurePlayerSpellSystems(s.player)
                    recalcPlayerStats()
                }
            } catch (_) {}

            // Run day advances through the unified pipeline.
            try {
                advanceWorldDays(s, days, { silent: true })
            } catch (e) {
                // Continue; audit will capture any fallout.
            }

            // Loot rolls (exercise RNG paths + rarity tables).
            const lootCounts = { totalItems: 0, potions: 0, weapons: 0, armor: 0, rarities: {} }
            try {
                for (let i = 0; i < lootRolls; i++) {
                    const drop = generateLootDrop({
                        area: s.area || 'forest',
                        playerLevel: s.player ? (s.player.level || 1) : 1,
                        playerResourceKey: s.player ? (s.player.resourceKey || null) : null
                    })

                    if (Array.isArray(drop)) {
                        drop.forEach((it) => {
                            if (!it) return
                            lootCounts.totalItems += 1
                            const cat = it.category || it.type || ''
                            if (cat === 'potion') lootCounts.potions += 1
                            else if (cat === 'weapon') lootCounts.weapons += 1
                            else if (cat === 'armor') lootCounts.armor += 1
                            const r = it.rarity ? String(it.rarity) : 'unknown'
                            lootCounts.rarities[r] = (lootCounts.rarities[r] || 0) + 1
                        })
                    } else if (drop) {
                        lootCounts.totalItems += 1
                    }
                }
            } catch (_) {}

            const audit = runIntegrityAudit(s, 'scenario_end')
            const ms = _perfNow() - t0

            const severity = (audit && typeof audit.severity === 'string' && audit.severity)
                ? audit.severity
                : (audit && audit.ok ? 'ok' : 'issues')

            const out = {
                ok: !!(audit && audit.ok),
                severity,
                days,
                lootRolls,
                lootCounts,
                seed,
                ms,
                audit
            }

            // Store compact summary for bug reports.
            try {
                if (!live.state.debug || typeof live.state.debug !== 'object') live.state.debug = {}
                live.state.debug.lastScenario = {
                    time: Date.now(),
                    days,
                    lootRolls,
                    seed,
                    ms: Math.round(ms),
                    severity: out.severity,
                    lootCounts: out.lootCounts
                }
            } catch (_) {}

            return out
        } finally {
            // Restore globals.
            try {
                _setState(live.state)
                syncGlobalStateRef()
                if (typeof window !== 'undefined' && live.ref) window.__emberwoodStateRef = live.ref
            } catch (_) {}

            try {
                if (live.saveGame) saveGame = live.saveGame
                if (live.updateHUD) updateHUD = live.updateHUD
                if (live.recordInput) recordInput = live.recordInput
            } catch (_) {}

            try { if (typeof setUiDisabled === 'function') setUiDisabled(!!live.uiWasDisabled) } catch (_) {}

            // Restore quest box renderer and refresh HUD so any stray scenario-time UI writes are corrected.
            try {
                if (typeof quests !== 'undefined' && quests) {
                    if (live.updateQuestBox) quests.updateQuestBox = live.updateQuestBox
                    // Ensure the pinned-quest UI is consistent with the restored live state.
                    if (typeof quests.updateQuestBox === 'function') quests.updateQuestBox()
                }
            } catch (_) {}
            try {
                if (typeof updateHUD === 'function') updateHUD()
            } catch (_) {}
        }
    }

    function formatScenarioRunnerReport(res) {
        const r = res || {}
        const lines = []
        lines.push('Scenario Runner (cloned save)')
        lines.push('Result: ' + (r.ok ? '✓ OK' : '⚠ ' + String(r.severity || 'issues')))
        lines.push('Days advanced: ' + String(r.days || 0))
        lines.push('Loot rolls: ' + String(r.lootRolls || 0) + ' • Seed: ' + String(r.seed || ''))
        if (typeof r.ms === 'number') lines.push('Runtime: ' + String(Math.round(r.ms)) + ' ms')
        lines.push('')

        const c = r.lootCounts || {}
        if (c.totalItems) {
            lines.push('Loot summary')
            lines.push('  Total items: ' + String(c.totalItems))
            lines.push('  Potions: ' + String(c.potions || 0) + ' • Weapons: ' + String(c.weapons || 0) + ' • Armor: ' + String(c.armor || 0))
            const rar = c.rarities || {}
            const keys = Object.keys(rar)
            if (keys.length) {
                lines.push('  Rarities:')
                keys.sort((a, b) => (rar[b] || 0) - (rar[a] || 0)).forEach((k) => {
                    lines.push('    - ' + k + ': ' + String(rar[k]))
                })
            }
            lines.push('')
        }

        if (r.audit) {
            lines.push(formatIntegrityAuditReport(r.audit))
        }

        if (r.error) {
            lines.push('Error: ' + String(r.error))
        }

        return lines.join('\n')
    }

    function buildBugReportBundle() {
        const p = state && state.player
        try { ensurePlayerStatsDefaults(p) } catch (_) {}
        const now = new Date().toISOString()

        // Keep this compact and safe to share publicly.
        const summary = {
            patch: GAME_PATCH,
            patchName: GAME_PATCH_NAME,
            saveSchema: SAVE_SCHEMA,
            timeUtc: now,
            userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : 'unknown',
            locale: (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'unknown'
        }

        const game = {
            area: state ? state.area : null,
            inCombat: !!(state && state.inCombat),
            enemy: state && state.currentEnemy ? {
                name: state.currentEnemy.name,
                id: state.currentEnemy.id || null,
                tier: state.currentEnemy.tier || null,
                hp: state.currentEnemy.hp
            } : null,
            player: p ? {
                name: p.name,
                classId: p.classId,
                level: p.level,
                hp: p.hp,
                maxHp: p.maxHp,
                resource: p.resource,
                maxResource: p.maxResource,
                gold: p.gold
            } : null
        }

        const debug = state && state.debug ? {
            useDeterministicRng: !!state.debug.useDeterministicRng,
            rngSeed: Number.isFinite(Number(state.debug.rngSeed)) ? (Number(state.debug.rngSeed) >>> 0) : null,
            rngIndex: Number.isFinite(Number(state.debug.rngIndex)) ? (Number(state.debug.rngIndex) >>> 0) : null,
            lastAction: state.debug.lastAction || '',
            inputLogTail: Array.isArray(state.debug.inputLog) ? state.debug.inputLog.slice(-120) : [],
            invariantIssues: state.debug.lastInvariantIssues || null,
            rngLogTail: Array.isArray(state.debug.rngLog) ? state.debug.rngLog.slice(-200) : [],

            // Patch 1.2.52+: simulation reliability tooling (compact)
            lastAudit: state.debug.lastAudit || null,
            capturePerf: !!state.debug.capturePerf,
            perfLogTail: Array.isArray(state.debug.perfLog) ? state.debug.perfLog.slice(-120) : []
        } : null

        const scanners = qaCollectBugScannerFindings(state)

        const diag = {
            lastCrashReport: getLastCrashReport() || null,
            lastSaveError: lastSaveError || null,
            perfSnapshot: (() => { try { return qaCollectPerfSnapshotSync(state) } catch (_) { return null } })(),
            logTail: (state && Array.isArray(state.log)) ? state.log.slice(-200) : [],
            scanners,
            playerStats: (p && p.stats) ? {
                attack: p.stats.attack,
                magic: p.stats.magic,
                armor: p.stats.armor,
                speed: p.stats.speed,
                magicRes: p.stats.magicRes,
                critChance: p.stats.critChance,
                dodgeChance: p.stats.dodgeChance,
                dodge: p.stats.dodge,
                resistAll: p.stats.resistAll,
                armorPen: p.stats.armorPen,
                lifeSteal: p.stats.lifeSteal,
                haste: p.stats.haste,
                elementalBonuses: p.stats.elementalBonuses || {},
                elementalResists: p.stats.elementalResists || {}
            } : null
        }

        // Locus services: attach small, privacy-safe tails that help debugging.
        const locus = (() => {
            try {
                const _engine = deps._engine
                const flagsSvc = _engine && (_engine.getService ? _engine.getService('flags') : _engine.flags)
                const i18nSvc = _engine && (_engine.getService ? _engine.getService('i18n') : _engine.i18n)
                const savePolicySvc = _engine && (_engine.getService ? _engine.getService('savePolicy') : _engine.savePolicy)
                const replaySvc = _engine && (_engine.getService ? _engine.getService('replay') : _engine.replay)
                const telemetrySvc = _engine && (_engine.getService ? _engine.getService('telemetry') : _engine.telemetry)

                return {
                    flags: flagsSvc && typeof flagsSvc.dump === 'function' ? flagsSvc.dump() : null,
                    locale: i18nSvc && typeof i18nSvc.getLocale === 'function' ? i18nSvc.getLocale() : null,
                    savePolicy: savePolicySvc && typeof savePolicySvc.getStatus === 'function' ? savePolicySvc.getStatus() : null,
                    replay: replaySvc && typeof replaySvc.getLastMeta === 'function' ? replaySvc.getLastMeta() : null,
                    telemetryTail: telemetrySvc && typeof telemetrySvc.getTail === 'function' ? telemetrySvc.getTail(120) : null
                }
            } catch (_) {
                return null
            }
        })()

        return { summary, game, debug, diagnostics: diag, locus }
    }

    function copyBugReportBundleToClipboard() {
        const json = JSON.stringify(buildBugReportBundle(), null, 2)
        return copyFeedbackToClipboard(json)
    }

    function formatBugReportBundle(bundle) {
        const b = bundle || {}
        const s = (b.summary || {})
        const g = (b.game || {})
        const p = (g.player || {})
        const d = (b.debug || {})
        const diag = (b.diagnostics || {})

        const lines = []

        const patchLine = 'Patch ' + String(s.patch || GAME_PATCH || '') + (s.patchName ? ' — ' + String(s.patchName) : '')
        lines.push(patchLine)
        if (s.timeUtc) lines.push('Time (UTC): ' + String(s.timeUtc))
        if (s.saveSchema !== undefined) lines.push('Save schema: ' + String(s.saveSchema))
        if (s.userAgent) lines.push('UA: ' + String(s.userAgent))
        if (s.locale) lines.push('Locale: ' + String(s.locale))
        lines.push('')

        // Snapshot
        const inCombat = !!g.inCombat
        const enemyName = (g.enemy && g.enemy.name) ? g.enemy.name : null
        const area = g.area ? String(g.area) : '(unknown)'
        lines.push('Snapshot')
        lines.push('  Area: ' + area)
        lines.push('  In combat: ' + (inCombat ? 'YES' : 'no'))
        if (enemyName) lines.push('  Current enemy: ' + enemyName)
        lines.push('  Player: ' + String(p.name || 'Player') + ' • ' + String(p.classId || '?') + ' • Lv ' + String(p.level || '?'))
        if (p.maxHp) lines.push('  HP: ' + String(p.hp) + ' / ' + String(p.maxHp))
        if (p.maxResource !== undefined) lines.push('  Resource: ' + String(p.resource) + ' / ' + String(p.maxResource))
        if (p.gold !== undefined) lines.push('  Gold: ' + String(p.gold))
        lines.push('')

        // Issues
        const issues = []
        if (Array.isArray(d.invariantIssues) && d.invariantIssues.length) {
            d.invariantIssues.forEach((x) => {
                const code = x && x.code ? String(x.code) : 'invariant'
                const detail = x && x.detail ? String(x.detail) : ''
                issues.push(code + (detail ? ' — ' + detail : ''))
            })
        }
        if (diag.lastCrashReport && diag.lastCrashReport.message) {
            issues.push('crash: ' + String(diag.lastCrashReport.message))
        }
        if (diag.lastSaveError) {
            issues.push('saveError: ' + String(diag.lastSaveError))
        }

        const scanners = diag && diag.scanners ? diag.scanners : null
        if (scanners && scanners.hasIssues) {
            const c = scanners.counts || {}
            if (c.nonFinite) issues.push('scan: non-finite numbers (' + String(c.nonFinite) + ')')
            if (c.negatives) issues.push('scan: negative counters (' + String(c.negatives) + ')')
            if (c.elementKeys) issues.push('scan: element key anomalies (' + String(c.elementKeys) + ')')
            if (c.refs) issues.push('scan: reference integrity (' + String(c.refs) + ')')
            if (c.abilityElements) issues.push('scan: ability element tags (' + String(c.abilityElements) + ')')
            if (c.statSanity) issues.push('scan: derived stat sanity (' + String(c.statSanity) + ')')
            if (c.combatRuntime) issues.push('scan: combat runtime sanity (' + String(c.combatRuntime) + ')')
            if (c.talentIntegrity) issues.push('scan: talent wiring integrity (' + String(c.talentIntegrity) + ')')
        }

        lines.push('Findings')
        if (!issues.length) {
            lines.push('  ✓ No issues detected by the bug report scanners.')
        } else {
            issues.slice(0, 12).forEach((x) => lines.push('  ⚠ ' + x))
            if (issues.length > 12) lines.push('  … +' + String(issues.length - 12) + ' more')
        }
        lines.push('')

        // Performance snapshot
        try {
            const perfSnap = diag && diag.perfSnapshot ? diag.perfSnapshot : null
            if (perfSnap) {
                lines.push(qaFormatPerfSnapshotText(perfSnap))
                lines.push('')
            }
        } catch (_) {}

        // Deep scanner details (top findings) — helps catch subtle calc bugs.
        const _sc = diag && diag.scanners ? diag.scanners : null
        if (_sc && _sc.hasIssues) {
            const f = _sc.findings || {}
            const show = (title, arr) => {
                if (!Array.isArray(arr) || !arr.length) return
                lines.push('Scanner: ' + title + ' (top ' + Math.min(6, arr.length) + ' of ' + arr.length + ')')
                arr.slice(0, 6).forEach((x) => lines.push('  - ' + String(x)))
                if (arr.length > 6) lines.push('  … +' + String(arr.length - 6) + ' more')
                lines.push('')
            }
            show('Non-finite numbers', f.nonFinite)
            show('Negative counters', f.negatives)
            show('Element key anomalies', f.elementKeys)
            show('Reference integrity', f.refs)
            show('Ability element coverage', f.abilityElements)
            show('Derived stat sanity', f.statSanity)
            show('Combat runtime sanity', f.combatRuntime)
            show('Talent wiring integrity', f.talentIntegrity)
        }

        // Crash details (short)
        if (diag.lastCrashReport) {
            const cr = diag.lastCrashReport
            lines.push('Last crash (summary)')
            if (cr.kind) lines.push('  Kind: ' + String(cr.kind))
            if (cr.time !== undefined && cr.time !== null) {
                const tNum = Number(cr.time)
                if (Number.isFinite(tNum) && tNum > 0) {
                    let iso = ''
                    try { iso = new Date(tNum).toISOString() } catch (_) { iso = '' }
                    lines.push('  Time (UTC): ' + (iso || String(cr.time)) + ' (' + String(cr.time) + ')')
                } else {
                    lines.push('  Time: ' + String(cr.time))
                }
            }
            lines.push('  Note: this is the most recent recorded crash and may be from a previous session.')
            if (cr.message) lines.push('  Message: ' + String(cr.message))
            if (cr.stack) {
                const stackLines = String(cr.stack).split('\n').slice(0, 6)
                lines.push('  Stack (top):')
                stackLines.forEach((ln) => lines.push('    ' + ln))
                if (String(cr.stack).split('\n').length > 6) lines.push('    …')
            }
            lines.push('')
        }

        // Recent input
        if (Array.isArray(d.inputLogTail) && d.inputLogTail.length) {
            lines.push('Recent input (tail)')
            d.inputLogTail.slice(-12).forEach((x) => {
                const a = x && x.action ? String(x.action) : '(action)'
                const pl = x && x.payload ? safeJsonShort(x.payload, 120) : ''
                lines.push('  - ' + a + (pl ? ' ' + pl : ''))
            })
            lines.push('')
        }

        // Recent log
        if (Array.isArray(diag.logTail) && diag.logTail.length) {
            lines.push('Recent game log (tail)')
            diag.logTail.slice(-18).forEach((x) => {
                const t = x && x.text ? String(x.text) : ''
                if (!t) return
                lines.push('  • ' + t)
            })
        }

        return lines.join('\n')
    }

    function safeJsonShort(obj, maxLen) {
        const lim = Math.max(20, Number(maxLen || 120))
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

    // Return public API
    return {
        qaScanNonFiniteNumbers,
        qaScanNegativeCounters,
        qaScanStatSanity,
        qaScanCombatRuntimeSanity,
        qaScanElementKeyIssues,
        qaScanAbilityElementCoverage,
        qaScanTalentIntegrity,
        qaScanCooldownIntegrity,
        qaScanReferenceIntegrity,
        qaCollectBugScannerFindings,
        classifyIntegritySeverity,
        runIntegrityAudit,
        formatIntegrityAuditReport,
        runScenarioRunner,
        formatScenarioRunnerReport,
        buildBugReportBundle,
        copyBugReportBundleToClipboard,
        formatBugReportBundle,
        safeJsonShort
    }
}
