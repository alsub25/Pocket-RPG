/**
 * Enemy Sheet Modal
 * Extracted from gameOrchestrator.js (Patch 1.2.72)
 * 
 * Displays detailed information about the current enemy with tabs for:
 * - Overview: basic enemy info
 * - Stats: combat stats and elemental info
 * - Abilities: special abilities list
 * - Effects: affixes and current statuses
 * - Rewards: XP, gold, and loot drop info
 */

export function createEnemySheetModal(deps) {
    const {
        state,
        ENEMY_ABILITIES,
        finiteNumber,
        clampFinite,
        clamp01,
        escapeHtml,
        openEnemyModal,
        ensureEnemyRuntime,
        getEnemyRarityDef,
        getEffectiveEnemyAttack,
        getEffectiveEnemyMagic,
        getEnemyAffixDef,
        normalizeElementType,
        _normalizeAffinityMult,
        _normalizePctMaybeFraction
    } = deps

    return function openEnemySheet() {
        const enemy = state && state.currentEnemy ? state.currentEnemy : null
        if (!state || !state.inCombat || !enemy) return

        // Ensure runtime containers exist (safe for mid-combat inspection)
        try { ensureEnemyRuntime(enemy) } catch (_) {}

        const rarityDef = getEnemyRarityDef(enemy.rarity) || getEnemyRarityDef('common')
        const rarityLabel = enemy.rarityLabel || (rarityDef ? rarityDef.label : 'Common')

        const isBoss = !!enemy.isBoss
        const isElite = !!enemy.isElite

        const maxHp = Math.max(1, Math.floor(finiteNumber(enemy.maxHp, 1)))
        const hp = clampFinite(enemy.hp, 0, maxHp, maxHp)

        const pm = typeof enemy.postureMax === 'number' && Number.isFinite(enemy.postureMax) && enemy.postureMax > 0
            ? Math.max(1, Math.floor(enemy.postureMax))
            : 0
        const posture = pm ? clampFinite(enemy.posture, 0, pm, 0) : 0

        const effAtk = getEffectiveEnemyAttack(enemy)
        const effMag = getEffectiveEnemyMagic(enemy)

        // Element info (Patch 1.2.0)
        // - Affinities are multipliers (weak > 1, resist < 1)
        // - elementalResists are flat %-reductions used by some templates
        const enemyElementInfoText = (() => {
            const parts = []
            if (enemy.affinities) {
                const w = enemy.affinities.weak || {}
                const r = enemy.affinities.resist || {}

                // Normalize keys + values so the sheet stays correct even if authored content
                // uses synonyms/casing or percent-style values.
                const weakMap = {}
                const resistMap = {}

                try {
                    Object.keys(w).forEach((k) => {
                        const nk = normalizeElementType(k)
                        if (!nk) return
                        const mult = _normalizeAffinityMult(w[k])
                        if (!(mult > 1.001)) return
                        weakMap[nk] = Math.max(weakMap[nk] || 1, mult)
                    })
                } catch (_) {}

                try {
                    Object.keys(r).forEach((k) => {
                        const nk = normalizeElementType(k)
                        if (!nk) return
                        const mult = _normalizeAffinityMult(r[k])
                        if (!(mult < 0.999)) return
                        resistMap[nk] = Math.min(resistMap[nk] || 1, mult)
                    })
                } catch (_) {}

                const wk = Object.keys(weakMap)
                    .sort()
                    .map((k) => {
                        const pct = Math.round((weakMap[k] - 1) * 100)
                        return (k.charAt(0).toUpperCase() + k.slice(1)) + ' +' + pct + '%'
                    })
                const rk = Object.keys(resistMap)
                    .sort()
                    .map((k) => {
                        const pct = Math.round((1 - resistMap[k]) * 100)
                        return (k.charAt(0).toUpperCase() + k.slice(1)) + ' -' + pct + '%'
                    })

                if (wk.length) parts.push('Weak: ' + wk.join(', '))
                if (rk.length) parts.push('Resist: ' + rk.join(', '))
            }

            if (enemy.elementalResists && typeof enemy.elementalResists === 'object') {
                const flatMap = {}
                try {
                    Object.keys(enemy.elementalResists).forEach((k) => {
                        const nk = normalizeElementType(k)
                        if (!nk) return
                        const pct = _normalizePctMaybeFraction(enemy.elementalResists[k], { allowNegative: false })
                        if (!(pct > 0)) return
                        flatMap[nk] = Math.max(flatMap[nk] || 0, pct)
                    })
                } catch (_) {}

                const ek = Object.keys(flatMap)
                    .sort()
                    .map((k) => (k.charAt(0).toUpperCase() + k.slice(1)) + ' ' + Math.round(flatMap[k]) + '%')

                if (ek.length) parts.push('Flat resist: ' + ek.join(', '))
            }

            return parts.join(' • ')
        })()

        const baseDropChance = isBoss ? 1.0 : isElite ? 0.9 : 0.7
        const dropChance = clamp01(baseDropChance * finiteNumber(enemy.rarityDropMult, 1))

        const fmtPct = (x) => Math.round(clamp01(Number(x) || 0) * 100) + '%'

        function describeAffix(id) {
            const def = getEnemyAffixDef(id)
            if (!def) return id
            const parts = []
            if (def.vampiricHealPct) parts.push('Heals ' + Math.round(def.vampiricHealPct * 100) + '% of damage dealt')
            if (def.thornsReflectPct) parts.push('Reflects ' + Math.round(def.thornsReflectPct * 100) + '% of damage taken')
            if (def.chillChance) parts.push('On hit: ' + fmtPct(def.chillChance) + ' to apply Chilled (' + (def.chillTurns || 1) + 't)')
            if (def.bleedChance) parts.push('On hit: ' + fmtPct(def.bleedChance) + ' to apply Bleed (' + (def.bleedTurns || 2) + 't)')
            if (def.onShieldCastNextDmgPct) parts.push('After casting a shield: next damage +' + Math.round(def.onShieldCastNextDmgPct) + '%')
            if (def.onKillGain && def.onKillGain.key) parts.push('On kill: +' + def.onKillGain.amount + ' ' + def.onKillGain.key)
            if (def.hexTurns) parts.push('On hit: applies Hex (' + def.hexTurns + 't)')
            if (def.berserkThreshold) parts.push('Below ' + Math.round(def.berserkThreshold * 100) + '% HP: +'+ Math.round((def.berserkAtkPct||0)*100) + '% attack')
            if (def.regenPct) parts.push('Regenerates ' + Math.round(def.regenPct * 100) + '% max HP at end of turn')
            return def.label + (parts.length ? ' — ' + parts.join('; ') : '')
        }

        openEnemyModal('Enemy Sheet', (body) => {
            body.innerHTML = ''

            // --- HEADER --------------------------------------------------------------
            const header = document.createElement('div')
            header.className = 'sheet-header'
            header.innerHTML = `
          <div class="sheet-title-row">
            <div>
              <div class="sheet-title">${escapeHtml(enemy.name || 'Enemy')}</div>
              <div class="sheet-subtitle">${escapeHtml(rarityLabel)}${isBoss ? ' • Boss' : ''}${isElite ? ' • Elite' : ''} • Lv ${finiteNumber(enemy.level, 1)}</div>
            </div>
            <div class="sheet-subtitle">${escapeHtml(state.area || '')}</div>
          </div>
          <div class="sheet-badges">
            <span class="sheet-badge"><span class="k">HP</span><span class="v">${Math.round(hp)} / ${maxHp}</span></span>
            ${pm ? `<span class="sheet-badge"><span class="k">Posture</span><span class="v">${Math.round(posture)} / ${pm}</span></span>` : ''}
            <span class="sheet-badge"><span class="k">Atk</span><span class="v">${Math.round(effAtk)}</span></span>
            <span class="sheet-badge"><span class="k">Mag</span><span class="v">${Math.round(effMag)}</span></span>
          </div>
          ${enemyElementInfoText ? `<div class="sheet-line"><b>Elements:</b> ${escapeHtml(enemyElementInfoText)}</div>` : ''}
        `
            body.appendChild(header)

            const tabs = document.createElement('div')
            tabs.className = 'char-tabs'

            const tabDefs = [
                { id: 'overview', label: 'Overview' },
                { id: 'stats', label: 'Stats' },
                { id: 'abilities', label: 'Abilities' },
                { id: 'effects', label: 'Affixes & Effects' },
                { id: 'rewards', label: 'Rewards' }
            ]

            tabDefs.forEach((t, idx) => {
                const btn = document.createElement('button')
                btn.className = 'char-tab' + (idx === 0 ? ' active' : '')
                btn.dataset.tab = t.id
                btn.textContent = t.label
                tabs.appendChild(btn)
            })

            body.appendChild(tabs)

            const panelsWrapper = document.createElement('div')
            panelsWrapper.className = 'char-tabs-wrapper'

            function makePanel(id, innerHTML) {
                const panel = document.createElement('div')
                panel.className = 'char-tab-panel' + (id === 'overview' ? ' active' : '')
                panel.dataset.tab = id
                panel.innerHTML = innerHTML
                panelsWrapper.appendChild(panel)
                return panel
            }

            // --- OVERVIEW -----------------------------------------------------------
            const overviewHtml = `
      <div class="char-section">
        <div class="char-section-title">Enemy</div>
        <div class="stat-grid">
          <div class="stat-label"><span class="char-stat-icon">🏷</span>Name</div>
          <div class="stat-value">${enemy.name || 'Enemy'}</div>

          <div class="stat-label"><span class="char-stat-icon">⭐</span>Level</div>
          <div class="stat-value">${finiteNumber(enemy.level, 1)}</div>

          <div class="stat-label"><span class="char-stat-icon">💠</span>Rarity</div>
          <div class="stat-value">${rarityLabel}${isBoss ? ' • Boss' : ''}${isElite ? ' • Elite' : ''}</div>

          <div class="stat-label"><span class="char-stat-icon">❤️</span>HP</div>
          <div class="stat-value">${Math.round(hp)}/${maxHp}</div>

          ${pm ? `
          <div class="stat-label"><span class="char-stat-icon">🛡</span>Posture</div>
          <div class="stat-value">${Math.round(posture)}/${pm}</div>
          ` : ''}

          <div class="stat-label"><span class="char-stat-icon">🧠</span>Behavior</div>
          <div class="stat-value">${enemy.behavior ? String(enemy.behavior) : '—'}</div>
        </div>
      </div>
    `
            makePanel('overview', overviewHtml)

            // --- STATS --------------------------------------------------------------
            const statsHtml = `
      <div class="char-section">
        <div class="char-section-title">Combat Stats</div>
        <div class="stat-grid">
          <div class="stat-label"><span class="char-stat-icon">⚔</span>Attack</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.attack, 0))} <span style="opacity:.7">(effective ${Math.round(effAtk)})</span></div>

          <div class="stat-label"><span class="char-stat-icon">✨</span>Magic</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.magic, 0))} <span style="opacity:.7">(effective ${Math.round(effMag)})</span></div>

          <div class="stat-label"><span class="char-stat-icon">🛡</span>Armor</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.armor, 0))}${enemy.armorBuff ? ' <span style="opacity:.7">(+' + Math.round(enemy.armorBuff) + ' buff)</span>' : ''}</div>

          <div class="stat-label"><span class="char-stat-icon">🔰</span>Magic Res</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.magicRes, 0))}</div>

          <div class="stat-label"><span class="char-stat-icon">🧪</span>Elements</div>
          <div class="stat-value">${enemyElementInfoText ? escapeHtml(enemyElementInfoText) : '—'}</div>

          <div class="stat-label"><span class="char-stat-icon">📌</span>Base Attack</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.baseAttack, finiteNumber(enemy.attack, 0)))}</div>

          <div class="stat-label"><span class="char-stat-icon">📌</span>Base Magic</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.baseMagic, finiteNumber(enemy.magic, 0)))}</div>
        </div>
      </div>
    `
            makePanel('stats', statsHtml)

            // --- ABILITIES ----------------------------------------------------------
            const abilityLines = (() => {
                const arr = Array.isArray(enemy.abilities) ? enemy.abilities : []
                if (!arr.length) return '<div class="modal-subtitle">No special abilities.</div>'
                return arr
                    .map((aid) => {
                        const ab = ENEMY_ABILITIES && ENEMY_ABILITIES[aid] ? ENEMY_ABILITIES[aid] : null
                        const name = ab ? ab.name : String(aid)
                        const cd = ab && typeof ab.cooldown === 'number' ? ab.cooldown : null
                        const tele = ab && ab.telegraphTurns ? ab.telegraphTurns : 0
                        const desc = ab && ab.desc ? ab.desc : ''
                        return `
          <div class="item-row">
            <div class="item-row-header">
              <div><span class="item-name">${name}</span></div>
              <div class="item-meta">${cd != null ? 'CD ' + cd : ''}${tele ? (cd != null ? ' • ' : '') + 'Telegraph ' + tele + 't' : ''}</div>
            </div>
            ${desc ? `<div style="font-size:.78rem;color:var(--muted)">${escapeHtml(desc)}</div>` : ''}
          </div>
        `
                    })
                    .join('')
            })()

            const abilitiesHtml = `
      <div class="char-section">
        <div class="char-section-title">Abilities</div>
        ${abilityLines}
      </div>
    `
            makePanel('abilities', abilitiesHtml)

            // --- AFFIXES / EFFECTS --------------------------------------------------
            const affixIds = Array.isArray(enemy.affixes) ? enemy.affixes : []
            const affixHtml = affixIds.length
                ? affixIds
                      .map((id) => `<div class="item-row"><div class="item-row-header"><div><span class="item-name">${describeAffix(id)}</span></div></div></div>`)
                      .join('')
                : '<div class="modal-subtitle">No mini-affixes.</div>'

            const eliteHtml = enemy.isElite
                ? `<div class="item-row"><div class="item-row-header"><div><span class="item-name">Elite: ${enemy.eliteLabel || enemy.eliteAffix || 'Elite'}</span></div></div></div>`
                : ''

            const statusParts = []
            if (enemy.bleedTurns && enemy.bleedTurns > 0) statusParts.push('Bleeding (' + enemy.bleedTurns + 't)')
            if (enemy.chilledTurns && enemy.chilledTurns > 0) statusParts.push('Chilled (' + enemy.chilledTurns + 't)')
            if (enemy.burnTurns && enemy.burnTurns > 0) statusParts.push('Burning (' + enemy.burnTurns + 't)')
            if (enemy.guardTurns && enemy.guardTurns > 0) statusParts.push('Guarding (' + enemy.guardTurns + 't)')
            if (enemy.brokenTurns && enemy.brokenTurns > 0) statusParts.push('Broken (' + enemy.brokenTurns + 't)')
            if (enemy.atkDownTurns && enemy.atkDownTurns > 0 && enemy.atkDownFlat) statusParts.push('Weakened ' + enemy.atkDownFlat + ' (' + enemy.atkDownTurns + 't)')
            if (enemy.intent && enemy.intent.aid) {
                const ab = ENEMY_ABILITIES && ENEMY_ABILITIES[enemy.intent.aid] ? ENEMY_ABILITIES[enemy.intent.aid] : null
                statusParts.push('Intent: ' + (ab ? ab.name : enemy.intent.aid) + ' (' + clampFinite(enemy.intent.turnsLeft, 0, 99, 0) + 't)')
            }

            const effectsHtml = `
      <div class="char-section">
        <div class="char-section-title">Modifiers</div>
        ${eliteHtml}
        <div style="margin-top:.35rem">${affixHtml}</div>
      </div>
      <div class="char-section">
        <div class="char-section-title">Current Effects</div>
        <div class="modal-subtitle">${statusParts.length ? statusParts.join(' • ') : 'None'}</div>
      </div>
    `
            makePanel('effects', effectsHtml)

            // --- REWARDS ------------------------------------------------------------
            const rewardsHtml = `
      <div class="char-section">
        <div class="char-section-title">Rewards</div>
        <div class="stat-grid">
          <div class="stat-label"><span class="char-stat-icon">📈</span>XP</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.xp, 0))}</div>

          <div class="stat-label"><span class="char-stat-icon">🪙</span>Gold</div>
          <div class="stat-value">${Math.round(finiteNumber(enemy.goldMin, 0))}–${Math.round(finiteNumber(enemy.goldMax, 0))}</div>

          <div class="stat-label"><span class="char-stat-icon">🎁</span>Loot Drop Chance</div>
          <div class="stat-value">${Math.round(dropChance * 100)}%</div>

          <div class="stat-label"><span class="char-stat-icon">🎲</span>Loot Quality Driver</div>
          <div class="stat-value">Enemy rarity tier ${finiteNumber(enemy.rarityTier, 1)}</div>
        </div>
      </div>
    `
            makePanel('rewards', rewardsHtml)

            body.appendChild(panelsWrapper)

            // Tab switching
            const tabBtns = tabs.querySelectorAll('.char-tab')
            tabBtns.forEach((btn) => {
                btn.addEventListener('click', () => {
                    tabBtns.forEach((b) => b.classList.remove('active'))
                    btn.classList.add('active')
                    const target = btn.dataset.tab
                    panelsWrapper.querySelectorAll('.char-tab-panel').forEach((pnl) => {
                        pnl.classList.toggle('active', pnl.dataset.tab === target)
                    })
                })
            })
        })
    }
}
