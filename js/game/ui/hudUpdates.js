/**
 * @fileoverview HUD Update Functions
 * Extracted from gameOrchestrator.js for modularity (Patch 1.2.72)
 *
 * Provides functions for:
 * - Main HUD updates (health, resource, level, gold)
 * - Class mechanics meter rendering
 * - Companion/player view switching
 */

export function createHUDUpdaters(deps) {
    const {
        state,
        PLAYER_CLASSES,
        getActiveDifficultyConfig,
        finiteNumber,
        clampFinite,
        clampNumber,
        sanitizeCoreState,
        syncSmokeTestsPillVisibility
    } = deps

    function updateHUD(perfWrapper) {
        const st = state
        try {
            if (st && st.debug && st.debug.capturePerf && perfWrapper) {
                return perfWrapper(st, 'hud:updateHUD', null, () => _updateHUDImpl())
            }
        } catch (_) {}
        return _updateHUDImpl()
    }

    function _updateHUDImpl() {
        if (!state.player) return

        sanitizeCoreState()

        // Dev cheats UI affordance
        try { syncSmokeTestsPillVisibility() } catch (_) {}

        const p = state.player
        const comp = state.companion
        const diff = getActiveDifficultyConfig()
        const classDef = PLAYER_CLASSES[p.classId]

        const nameEl = document.getElementById('hud-name')
        const classDiffEl = document.getElementById('hud-class-diff')
        const hpFill = document.getElementById('hpFill')
        const hpLabel = document.getElementById('hpLabel')
        const resFill = document.getElementById('resFill')
        const resLabel = document.getElementById('resLabel')
        const hudLevel = document.getElementById('hud-level')
        const hudGold = document.getElementById('hud-gold')
        const hudBottom = document.getElementById('hud-bottom')
        const hudTime = document.getElementById('timeLabel')

        // Defensive: if HUD nodes are missing (partial DOM / early calls), don't crash.
        if (!nameEl || !classDiffEl || !hpFill || !hpLabel || !resFill || !resLabel || !hudLevel || !hudGold || !hudBottom) return

        // Decide which entity to show: default to player if no companion
        let mode = state.hudView || 'player'
        if (!comp && mode === 'companion') {
            mode = 'player'
            state.hudView = 'player'
        }

        if (mode === 'player') {
            // --- PLAYER VIEW ---
            nameEl.textContent = p.name || 'Nameless'
            classDiffEl.textContent =
                (classDef ? classDef.name : 'Adventurer') +
                ' • ' +
                (diff ? diff.name : '')

            const maxHp = Math.max(1, Math.floor(finiteNumber(p.maxHp, 1)))
            const hpNow = clampFinite(p.hp, 0, maxHp, maxHp)
            const hpPercent = Math.max(0, Math.min(100, (hpNow / maxHp) * 100))
            hpFill.style.width = hpPercent + '%'
            hpLabel.textContent = 'HP ' + Math.round(hpNow) + '/' + maxHp
            hpFill.className = 'bar-fill hp-fill'

            const rk =
                p.resourceKey === 'mana' || p.resourceKey === 'fury' || p.resourceKey === 'blood' || p.resourceKey === 'essence'
                    ? p.resourceKey
                    : 'mana'
            const resName = p.resourceName || 'Resource'
            const maxResRaw = finiteNumber(p.maxResource, 0)
            const maxRes = maxResRaw > 0 ? maxResRaw : 0

            if (maxRes <= 0) {
                // Some classes / corrupted saves may temporarily have no resource pool.
                resFill.style.width = '0%'
                resFill.className = 'bar-fill resource-fill ' + rk
                resLabel.textContent = resName + ' —'
            } else {
                const resNow = clampFinite(p.resource, 0, maxRes, maxRes)
                const resPercent = Math.max(0, Math.min(100, (resNow / maxRes) * 100))
                resFill.style.width = resPercent + '%'
                resFill.className = 'bar-fill resource-fill ' + rk
                resLabel.textContent = resName + ' ' + Math.round(resNow) + '/' + Math.round(maxRes)
            }
        } else {
            // --- COMPANION VIEW ---
            // We already guaranteed comp exists above.
            nameEl.textContent = comp.name + ' (Companion)'
            classDiffEl.textContent =
                comp.role.charAt(0).toUpperCase() +
                comp.role.slice(1) +
                ' • Swipe to switch'

            // Use bars to show companion stats instead of HP/resource
            // HP bar -> Attack
            hpFill.style.width = '100%'
            hpFill.className = 'bar-fill hp-fill'
            hpLabel.textContent = 'Attack ' + comp.attack

            // Resource bar -> HP bonus
            resFill.style.width = '100%'
            resFill.className = 'bar-fill resource-fill mana'
            resLabel.textContent = 'HP Bonus +' + comp.hpBonus
        }

        // Bottom: progression + gold are hidden during combat per HUD request.
        // (Show again immediately after combat ends.)
        if (hudLevel) {
            hudLevel.textContent =
                'Lv ' + p.level + ' • ' + p.xp + '/' + p.nextLevelXp + ' XP'
        }
        if (hudGold) {
            hudGold.innerHTML = '<span class="gold">' + p.gold + '</span> Gold'
        }

        const inCombatNow = !!(state.inCombat && state.currentEnemy)
        if (hudBottom) {
            if (inCombatNow) hudBottom.classList.add('hidden')
            else hudBottom.classList.remove('hidden')
        } else {
            // Fallback if DOM changed: hide individual fields.
            if (hudLevel) hudLevel.classList.toggle('hidden', inCombatNow)
            if (hudGold) hudGold.classList.toggle('hidden', inCombatNow)
            if (hudTime) hudTime.classList.toggle('hidden', inCombatNow)
        }

        // Class mechanics meter (combat only)
        try { updateClassMeterHUD() } catch (_) {}
    }

    function updateClassMeterHUD() {
        const el = document.getElementById('hudClassMeter')
        if (!el) return

        const p = state && state.player
        if (!p || !state.inCombat) {
            el.classList.add('hidden')
            el.innerHTML = ''
            return
        }

        const enemy = state.currentEnemy || null
        const classId = String(p.classId || '')
        const st = p.status || {}

        // Helper functions
        const clampInt = (v, min, max) => {
            const n = Math.floor(Number(v))
            return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min))
        }
        const clampNum = (v, min, max) => {
            const n = Number(v)
            return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min))
        }
        const cap = (s) => {
            s = String(s || '')
            if (!s) return ''
            return s.charAt(0).toUpperCase() + s.slice(1)
        }
        const escHtml = (s) => {
            s = String(s == null ? '' : s)
            return s.replace(/[&<>\"]/g, (ch) => {
                if (ch === '&') return '&amp;'
                if (ch === '<') return '&lt;'
                if (ch === '>') return '&gt;'
                return '&quot;'
            })
        }

        const iconUse = (symbolId) => {
            const id = escHtml(symbolId || '')
            if (!id) return ''
            const strokeId = id + '-stroke'
            return (
                '<svg class="meter-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
                '<use class="meter-icon-stroke" href="#' + strokeId + '" xlink:href="#' + strokeId + '"></use>' +
                '</svg>'
            )
        }

        const renderPips = (filled, max, symbolId) => {
            filled = clampInt(filled, 0, max)
            max = clampInt(max, 1, 12)
            const svg = iconUse(symbolId)
            let out = '<span class="meter-dots" aria-hidden="true">'
            for (let i = 1; i <= max; i++) {
                out += '<span class="meter-dot' + (i <= filled ? ' filled' : '') + '">' + svg + '</span>'
            }
            out += '</span>'
            return out
        }

        // Meter definitions (data-driven)
        const M = {
            rogue: {
                label: 'Combo',
                kind: 'pips',
                icon: 'i-dagger',
                max: 5,
                filled: () => clampInt(st.comboPoints || 0, 0, 5)
            },
            ranger: {
                label: 'Marks',
                kind: 'pips+turns',
                icon: 'i-bullseye',
                max: 5,
                filled: () => clampInt(enemy && enemy.markedStacks ? enemy.markedStacks : 0, 0, 5),
                turns: () => clampInt(enemy && enemy.markedTurns ? enemy.markedTurns : 0, 0, 99)
            },
            shaman: {
                label: 'Totem',
                kind: 'chip+turns',
                chip: () => cap(st.totemType || '') || 'None',
                turns: () => clampInt(st.totemTurns || 0, 0, 99)
            },
            necromancer: {
                label: 'Shards',
                kind: 'pips',
                icon: 'i-skull',
                max: 5,
                filled: () => clampInt(st.soulShards || 0, 0, 5)
            },
            mage: {
                label: 'Rhythm',
                kind: 'pips+chip',
                icon: 'i-starburst',
                max: 3,
                filled: () => {
                    const count = clampInt(st.spellCastCount || 0, 0, 999999)
                    return clampInt(count % 3, 0, 3)
                },
                chip: () => {
                    const count = clampInt(st.spellCastCount || 0, 0, 999999)
                    return (count % 3) === 2 ? 'Ready' : ''
                }
            },
            warrior: {
                label: 'Bulwark',
                kind: 'pips+chip',
                icon: 'i-shield',
                max: 5,
                filled: () => {
                    const fury = clampNum(p.resource || 0, 0, p.maxResource || 0)
                    const threshold = 40
                    return clampInt(Math.round((Math.min(fury, threshold) / threshold) * 5), 0, 5)
                },
                chip: () => {
                    const fury = clampNum(p.resource || 0, 0, p.maxResource || 0)
                    return fury >= 40 ? 'On' : ''
                }
            },
            blood: {
                label: 'Blood',
                kind: 'pips',
                icon: 'i-blooddrop',
                max: 5,
                filled: () => {
                    const cur = clampNum(p.resource || 0, 0, p.maxResource || 0)
                    const mx = clampNum(p.maxResource || 0, 1, 99999)
                    return clampInt(Math.round((cur / mx) * 5), 0, 5)
                }
            },
            paladin: {
                label: 'Sanctuary',
                kind: 'pips+chip',
                icon: 'i-shield',
                max: 5,
                filled: () => {
                    const shield = clampNum(st.shield || 0, 0, 99999)
                    const mx = clampNum(p.maxHp || 1, 1, 99999)
                    return clampInt(Math.round((Math.min(shield, mx) / mx) * 5), 0, 5)
                },
                chip: () => (clampNum(st.shield || 0, 0, 99999) > 0 ? 'On' : 'Off')
            },
            cleric: {
                label: 'Ward',
                kind: 'pips+value',
                icon: 'i-cross',
                max: 5,
                filled: () => {
                    const shield = clampNum(st.shield || 0, 0, 99999)
                    const mx = clampNum(p.maxHp || 1, 1, 99999)
                    return clampInt(Math.round((Math.min(shield, mx) / mx) * 5), 0, 5)
                },
                value: () => {
                    const shield = clampNum(st.shield || 0, 0, 99999)
                    return shield > 0 ? String(Math.round(shield)) : ''
                }
            },
            berserker: {
                label: 'Frenzy',
                kind: 'pips',
                icon: 'i-flame',
                max: 5,
                filled: () => {
                    const mx = clampNum(p.maxHp || 1, 1, 99999)
                    const hp = clampNum(p.hp || 0, 0, mx)
                    const missingPct = clampNum((mx - hp) / mx, 0, 1)
                    return clampInt(Math.round(missingPct * 5), 0, 5)
                }
            },
            vampire: {
                label: 'Hunger',
                kind: 'pips+chip',
                icon: 'i-bat',
                max: 5,
                filled: () => {
                    const cur = clampNum(p.resource || 0, 0, p.maxResource || 0)
                    const mx = clampNum(p.maxResource || 0, 1, 99999)
                    return clampInt(Math.round((cur / mx) * 5), 0, 5)
                },
                chip: () => {
                    const cur = clampNum(p.resource || 0, 0, p.maxResource || 0)
                    const mx = clampNum(p.maxResource || 0, 1, 99999)
                    return (cur / mx) >= 0.55 ? 'On' : ''
                }
            }
        }

        const meter = M[classId]
        if (!meter) {
            el.classList.add('hidden')
            el.innerHTML = ''
            return
        }

        el.setAttribute('data-meter-class', classId)

        let html = '<span class="meter-label">' + escHtml(meter.label) + '</span>'

        let pipFilled = 0
        let pipMax = 0
        let chipPreview = ''
        if (meter.kind === 'pips' || meter.kind === 'pips+turns' || meter.kind === 'pips+chip' || meter.kind === 'pips+value') {
            pipMax = clampInt(meter.max || 5, 1, 12)
            pipFilled = clampInt(meter.filled(), 0, pipMax)
            if (meter.kind === 'pips+chip') chipPreview = String(meter.chip() || '')

            const chipLower = chipPreview.trim().toLowerCase()
            const filledForRender = (chipLower === 'ready') ? pipMax : pipFilled

            html += renderPips(filledForRender, pipMax, meter.icon)

            const isReady = (filledForRender >= pipMax) && pipMax > 0
            el.classList.toggle('is-ready', isReady)
        } else {
            el.classList.remove('is-ready')
        }

        if (meter.kind === 'chip+turns') {
            const chip = escHtml(meter.chip())
            const turns = clampInt(meter.turns(), 0, 99)
            html += '<span class="meter-chip">' + chip + '</span>'
            html += '<span class="meter-turns">' + turns + 't</span>'
        }

        if (meter.kind === 'pips+turns') {
            const turns = clampInt(meter.turns(), 0, 99)
            html += '<span class="meter-turns">' + turns + 't</span>'
        }

        if (meter.kind === 'pips+chip') {
            const chip = escHtml(chipPreview || meter.chip())
            if (chip) html += '<span class="meter-chip">' + chip + '</span>'
        }

        if (meter.kind === 'pips+value') {
            const v = escHtml(meter.value())
            if (v) html += '<span class="meter-turns">' + v + '</span>'
        }

        el.innerHTML = html
        el.classList.remove('hidden')
    }

    return {
        updateHUD,
        updateClassMeterHUD
    }
}
