/* =============================================================================
 * UI Runtime (uiRuntime.js)
 *
 * Extracted from engine.js in Patch 1.2.70.
 * Owns:
 * - DOM helpers (escapeHtml, modal helpers, screen switching)
 * - Log rendering + incremental bookkeeping
 * - HUD helpers (time label, scene text, enemy panel)
 *
 * IMPORTANT
 * - This module is intentionally UI-only. Any simulation/combat logic stays in engine.js.
 * - It reads game state via injected `getState()` (fallback: window.__emberwoodStateRef).
 * ============================================================================= */

import { finiteNumber, clampFinite } from '../../systems/safety.js'
import { getTimeInfo, formatTimeLong } from '../../systems/timeSystem.js'

let _deps = {
    getState: null,
    // Audio hooks
    getAudioState: null,
    playMusicTrack: null,
    updateAreaMusic: null,
    // Combat/hud hooks
    syncCurrentEnemyToTarget: null,
    getAllEnemies: null,
    getAliveEnemies: null,
    getEnemyAffixLabels: null,
    ENEMY_ABILITIES: null
}

// Smoke tests and other in-memory QA suites may need to run without touching the live DOM.
// Because this file is an ES module, its exports are read-only bindings for importers.
// Instead of monkey-patching imported functions (which throws on iOS Safari),
// we provide a lightweight runtime switch to disable DOM writes temporarily.
let _uiDisabled = false

export function setUiDisabled(v) {
    _uiDisabled = !!v
}

export function isUiDisabled() {
    return !!_uiDisabled
}

export function configureUI(deps) {
    try {
        if (!deps || typeof deps !== 'object') return
        _deps = { ..._deps, ...deps }
    } catch (_) {}
}

function _getState() {
    try {
        if (_deps && typeof _deps.getState === 'function') return _deps.getState()
    } catch (_) {}
    try {
        return window.__emberwoodStateRef
    } catch (_) {
        return null
    }
}

function _getAudioState() {
    try {
        if (_deps && typeof _deps.getAudioState === 'function') return _deps.getAudioState()
    } catch (_) {}
    return null
}

function _playMusicTrack(trackId) {
    try {
        if (_deps && typeof _deps.playMusicTrack === 'function') _deps.playMusicTrack(trackId)
    } catch (_) {}
}

function _updateAreaMusic() {
    try {
        if (_deps && typeof _deps.updateAreaMusic === 'function') _deps.updateAreaMusic()
    } catch (_) {}
}

export function escapeHtml(str) {
    const s = String(str == null ? '' : str)
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

/* =============================================================================
 * DOM HELPERS
 * ============================================================================= */

const enemyPanelEls = {
    panel: document.getElementById('enemyPanel'),
    name: document.getElementById('enemyName'),
    tags: document.getElementById('enemyTags'),
    hpFill: document.getElementById('enemyHpFill'),
    hpLabel: document.getElementById('enemyHpLabel'),
    status: document.getElementById('enemyStatusLine'),
    targetHint: document.getElementById('enemyTargetHint')
}

// Exported for smoke tests and legacy engine call sites.
// NOTE: This is an object (mutable properties) so tests can temporarily
// null individual screen refs without reassigning the binding.
export const screens = {
    mainMenu: document.getElementById('mainMenu'),
    character: document.getElementById('characterScreen'),
    game: document.getElementById('gameScreen'),
    settings: document.getElementById('settingsScreen')
}

const modalEl = document.getElementById('modal')
const modalTitleEl = document.getElementById('modalTitle')
const modalBodyEl = document.getElementById('modalBody')
let _modalOnClose = null // optional one-shot callback run when closeModal() is called

// Optional adapter used by QA/smoke tests to build modals in a sandboxed container
// without replacing the live in-game modal.
let _modalAdapter = null

export function setModalAdapter(adapter) {
    _modalAdapter = adapter && typeof adapter === 'object' ? adapter : null
}

export function getModalAdapter() {
    return _modalAdapter
}

// Separate modal for the Enemy Sheet so dev tools (Smoke Tests) don't "replace" it.
const enemyModalEl = document.getElementById('enemyModal')
const enemyModalTitleEl = document.getElementById('enemyModalTitle')
const enemyModalBodyEl = document.getElementById('enemyModalBody')
let enemyModalOnClose = null // optional one-shot callback run when closeEnemyModal() is called

export function setModalOnClose(fn) {
    _modalOnClose = typeof fn === 'function' ? fn : null
}

export function getModalOnClose() {
    return _modalOnClose
}

// --- MODAL ACCESSIBILITY (focus + escape + focus trap) -----------------------
let _modalLastFocusEl = null
let _modalTrapHandler = null

let _enemyModalLastFocusEl = null
let _enemyModalTrapHandler = null

function _getFocusableElements(root) {
    if (!root) return []
    const sel = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',')
    return Array.from(root.querySelectorAll(sel)).filter((el) => {
        if (!el) return false
        const style = window.getComputedStyle(el)
        if (style.display === 'none' || style.visibility === 'hidden') return false
        // Some controls can be hidden inside collapsed <details>
        if (el.offsetParent === null && style.position !== 'fixed') return false
        return true
    })
}

function _installModalFocusTrap() {
    if (!modalEl) return
    if (_modalTrapHandler) return

    _modalTrapHandler = (e) => {
        if (!modalEl || modalEl.classList.contains('hidden')) return

        // Escape closes the modal
        if (e.key === 'Escape') {
            e.preventDefault()
            closeModal()
            return
        }

        // Basic focus trap for Tab / Shift+Tab
        if (e.key !== 'Tab') return

        const focusables = _getFocusableElements(modalEl)
        if (!focusables.length) {
            e.preventDefault()
            return
        }

        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement

        if (e.shiftKey) {
            if (active === first || !modalEl.contains(active)) {
                e.preventDefault()
                last.focus()
            }
        } else {
            if (active === last) {
                e.preventDefault()
                first.focus()
            }
        }
    }

    document.addEventListener('keydown', _modalTrapHandler)
}

function _removeModalFocusTrap() {
    if (_modalTrapHandler) {
        document.removeEventListener('keydown', _modalTrapHandler)
        _modalTrapHandler = null
    }
}

function _installEnemyModalFocusTrap() {
    if (!enemyModalEl) return
    if (_enemyModalTrapHandler) return

    _enemyModalTrapHandler = (e) => {
        if (!enemyModalEl || enemyModalEl.classList.contains('hidden')) return

        // Escape closes the Enemy Sheet
        if (e.key === 'Escape') {
            e.preventDefault()
            closeEnemyModal()
            return
        }

        if (e.key !== 'Tab') return

        const focusables = _getFocusableElements(enemyModalEl)
        if (!focusables.length) {
            e.preventDefault()
            return
        }

        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        const active = document.activeElement

        if (e.shiftKey) {
            if (active === first || !enemyModalEl.contains(active)) {
                e.preventDefault()
                last.focus()
            }
        } else {
            if (active === last) {
                e.preventDefault()
                first.focus()
            }
        }
    }

    document.addEventListener('keydown', _enemyModalTrapHandler)
}

function _removeEnemyModalFocusTrap() {
    if (_enemyModalTrapHandler) {
        document.removeEventListener('keydown', _enemyModalTrapHandler)
        _enemyModalTrapHandler = null
    }
}

// If we close one interior modal and immediately open another (e.g., Tavern → Gambling),
// we don't want the interior music to stop/restart between those transitions.
let pendingInteriorCloseTimer = null

export function switchScreen(name) {
    if (_uiDisabled) return
    Object.values(screens).filter(Boolean).forEach((s) => s.classList.add('hidden'))
    if (screens[name]) screens[name].classList.remove('hidden')

    // Ensure ambience never leaks onto non-game screens (main menu, settings, character creation).
    if (name !== 'game') {
        try {
            const audioState = _getAudioState()
            if (audioState) audioState.interiorOpen = false
            _playMusicTrack(null)
        } catch (e) {}
    }
}

export function openModal(title, builderFn) {
    // QA/smoke tests can provide an adapter to render modals into a detached node
    // without affecting the live UI.
    // IMPORTANT: allow the adapter even when UI writes are disabled.
    try {
        if (_modalAdapter && typeof _modalAdapter.openModal === 'function') {
            _modalAdapter.openModal(title, builderFn)
            return
        }
    } catch (_) {}

    if (_uiDisabled) return

    if (!modalEl) return

    // If another subsystem owns/locks the modal (e.g., user acceptance), don't fight it.
    try {
        const locked = modalEl.dataset.lock === '1'
        const owner = modalEl.dataset.owner || ''
        if (locked && owner && owner !== 'game') return
    } catch (_) {}

    // Cancel any deferred "interior close" so interior ambience can carry across modal-to-modal transitions.
    if (pendingInteriorCloseTimer) {
        clearTimeout(pendingInteriorCloseTimer)
        pendingInteriorCloseTimer = null
    }

    // Record current focus so we can restore it on close.
    _modalLastFocusEl = document.activeElement

    // Mark ownership for other modules (bootstrap, acceptance gate, etc.)
    try {
        modalEl.dataset.owner = 'game'
        modalEl.dataset.lock = '0'
    } catch (_) {}

    if (modalTitleEl) modalTitleEl.textContent = title

    // 🔹 Clean up any tavern-game footer carried over from a previous modal
    try {
        const strayFooters = modalEl.querySelectorAll('.tavern-footer-actions')
        strayFooters.forEach((el) => el.remove())
    } catch (_) {}

    // 🔹 Reset any per-modal layout classes (like tavern-games-body)
    if (modalBodyEl) modalBodyEl.className = '' // keep the id="modalBody" but clear classes

    // 🔹 Clear old content and build the new modal
    if (modalBodyEl) {
        modalBodyEl.innerHTML = ''
        if (typeof builderFn === 'function') builderFn(modalBodyEl)
    }

    // Accessibility: label + focus trap
    try {
        const panel = document.getElementById('modalPanel')
        if (panel) {
            panel.setAttribute('role', 'dialog')
            panel.setAttribute('aria-modal', 'true')
            panel.setAttribute('aria-labelledby', 'modalTitle')
            panel.tabIndex = -1
        }
        modalEl.setAttribute('aria-hidden', 'false')
        modalEl.dataset.open = '1'
    } catch (_) {}

    modalEl.classList.remove('hidden')
    _installModalFocusTrap()

    // Focus first focusable control (or the panel itself)
    try {
        const panel = document.getElementById('modalPanel')
        const focusables = _getFocusableElements(panel || modalEl)
        if (focusables.length) focusables[0].focus()
        else if (panel) panel.focus()
    } catch (_) {}
}

export function closeModal() {
    // IMPORTANT: allow the adapter even when UI writes are disabled.
    try {
        if (_modalAdapter && typeof _modalAdapter.closeModal === 'function') {
            _modalAdapter.closeModal()
            return
        }
    } catch (_) {}

    if (_uiDisabled) return

    if (!modalEl) return

    // If another subsystem owns/locks the modal (e.g., user acceptance), don't close it.
    try {
        const locked = modalEl.dataset.lock === '1'
        const owner = modalEl.dataset.owner || ''
        if (locked && owner && owner !== 'game') return
    } catch (_) {}

    // Tear down focus trap *before* hiding so focus doesn't get stuck.
    _removeModalFocusTrap()

    modalEl.classList.add('hidden')

    try {
        modalEl.setAttribute('aria-hidden', 'true')
        modalEl.dataset.open = '0'
        // Release ownership on close.
        if (modalEl.dataset.owner === 'game') modalEl.dataset.owner = ''
        // Ensure the modal is unlocked for other subsystems.
        modalEl.dataset.lock = '0'
    } catch (_) {}

    // Always remove any pinned tavern-game footer actions on close so they
    // can't leak into future modals or leave hidden interactive elements around.
    try {
        modalEl.querySelectorAll('.tavern-footer-actions').forEach((el) => el.remove())
    } catch (_) {
        // ignore
    }

    // Ensure close button is restored for non-skill modals
    const closeBtn = document.getElementById('modalClose')
    if (closeBtn) closeBtn.style.display = ''

    // Run any one-shot modal close hook (used by level-up auto skill distribution)
    if (typeof _modalOnClose === 'function') {
        const fn = _modalOnClose
        _modalOnClose = null // make it one-shot
        try {
            fn()
        } catch (err) {
            console.error(err)
        }
    } else {
        _modalOnClose = null
    }

    // Restore focus to whatever opened the modal (if it still exists in DOM)
    try {
        if (
            _modalLastFocusEl &&
            typeof _modalLastFocusEl.focus === 'function' &&
            document.contains(_modalLastFocusEl)
        ) {
            _modalLastFocusEl.focus()
        }
    } catch (_) {}
    _modalLastFocusEl = null

    const audioState = _getAudioState()

    // If we were inside the bank/tavern, defer flipping interiorOpen off by one tick.
    // This prevents Tavern.wav from cutting out/restarting when transitioning between
    // interior modals (e.g., Tavern → Gambling) that close & reopen the same modal UI.
    if (audioState && audioState.interiorOpen) {
        if (pendingInteriorCloseTimer) {
            clearTimeout(pendingInteriorCloseTimer)
            pendingInteriorCloseTimer = null
        }

        pendingInteriorCloseTimer = setTimeout(() => {
            pendingInteriorCloseTimer = null

            // If the modal got reopened immediately, we're still "inside"—do not stop interior music.
            const stillHidden = modalEl.classList.contains('hidden')
            if (!stillHidden) return

            audioState.interiorOpen = false
            _updateAreaMusic()
        }, 75)

        return
    }

    _updateAreaMusic()
}

export function openEnemyModal(title, builderFn) {
    if (_uiDisabled) return
    if (!enemyModalEl) return

    // Record focus so we can restore it on close.
    _enemyModalLastFocusEl = document.activeElement

    if (enemyModalTitleEl) enemyModalTitleEl.textContent = title

    // Reset body and build content
    if (enemyModalBodyEl) {
        enemyModalBodyEl.className = ''
        enemyModalBodyEl.innerHTML = ''
        if (typeof builderFn === 'function') builderFn(enemyModalBodyEl)
    }

    try {
        enemyModalEl.setAttribute('aria-hidden', 'false')
        enemyModalEl.dataset.open = '1'
        const panel = document.getElementById('enemyModalPanel')
        if (panel) {
            panel.setAttribute('role', 'dialog')
            panel.setAttribute('aria-modal', 'true')
            panel.setAttribute('aria-labelledby', 'enemyModalTitle')
            panel.tabIndex = -1
        }
    } catch (_) {}

    enemyModalEl.classList.remove('hidden')
    _installEnemyModalFocusTrap()

    // Focus first focusable control (or the panel itself)
    try {
        const panel = document.getElementById('enemyModalPanel')
        const focusables = _getFocusableElements(panel || enemyModalEl)
        if (focusables.length) focusables[0].focus()
        else if (panel) panel.focus()
    } catch (_) {}
}

export function closeEnemyModal() {
    if (_uiDisabled) return
    if (!enemyModalEl) return

    _removeEnemyModalFocusTrap()

    enemyModalEl.classList.add('hidden')

    try {
        enemyModalEl.setAttribute('aria-hidden', 'true')
        enemyModalEl.dataset.open = '0'
    } catch (_) {}

    // Run any one-shot close hook
    if (typeof enemyModalOnClose === 'function') {
        const fn = enemyModalOnClose
        enemyModalOnClose = null
        try {
            fn()
        } catch (err) {
            console.error(err)
        }
    } else {
        enemyModalOnClose = null
    }

    // Restore focus
    try {
        if (
            _enemyModalLastFocusEl &&
            typeof _enemyModalLastFocusEl.focus === 'function' &&
            document.contains(_enemyModalLastFocusEl)
        ) {
            _enemyModalLastFocusEl.focus()
        }
    } catch (_) {}
    _enemyModalLastFocusEl = null
}

/* =============================================================================
 * LOG (incremental renderer)
 * ============================================================================= */

let _logSeq = 0
let _logUi = {
    filter: 'all',
    lastFirstId: null,
    renderedUpToId: 0,
    stickToBottom: true,
    _ignoreScroll: false
}

export function getLogUiState() {
    return _logUi
}

export function getLogRuntimeSnapshot() {
    try {
        return {
            logSeq: typeof _logSeq === 'number' ? _logSeq : 0,
            logUi: JSON.parse(JSON.stringify(_logUi))
        }
    } catch (_) {
        return {
            logSeq: typeof _logSeq === 'number' ? _logSeq : 0,
            logUi: {
                filter: _logUi && _logUi.filter,
                lastFirstId: _logUi && _logUi.lastFirstId,
                renderedUpToId: _logUi && _logUi.renderedUpToId,
                stickToBottom: _logUi && _logUi.stickToBottom
            }
        }
    }
}

export function restoreLogRuntimeSnapshot(snap) {
    if (!snap || typeof snap !== 'object') return
    try {
        if (typeof snap.logSeq === 'number') _logSeq = snap.logSeq
    } catch (_) {}
    try {
        if (snap.logUi && typeof snap.logUi === 'object') {
            _logUi = {
                filter: snap.logUi.filter || 'all',
                lastFirstId: snap.logUi.lastFirstId || null,
                renderedUpToId: Number(snap.logUi.renderedUpToId || 0) || 0,
                stickToBottom:
                    typeof snap.logUi.stickToBottom === 'boolean'
                        ? snap.logUi.stickToBottom
                        : true,
                _ignoreScroll: false
            }
        }
    } catch (_) {}
}

function _nextLogId() {
    _logSeq += 1
    return _logSeq
}

function ensureLogIds(st) {
    if (!st) return
    if (!Array.isArray(st.log)) st.log = []
    let maxId = 0

    // Find existing ids
    st.log.forEach((e) => {
        if (!e || typeof e !== 'object') return
        const id = (typeof e.id === 'number' && Number.isFinite(e.id)) ? Math.floor(e.id) : 0
        if (id > maxId) maxId = id
    })

    // Old saves had no ids; assign them.
    if (maxId <= 0) {
        st.log.forEach((e) => {
            if (!e || typeof e !== 'object') return
            maxId += 1
            e.id = maxId
        })
    } else {
        // If any entries are missing ids, assign them after the current max.
        st.log.forEach((e) => {
            if (!e || typeof e !== 'object') return
            const id = (typeof e.id === 'number' && Number.isFinite(e.id)) ? Math.floor(e.id) : 0
            if (id > 0) return
            maxId += 1
            e.id = maxId
        })
    }

    _logSeq = Math.max(_logSeq, maxId)
}

// Exported for smoke tests and for any future combat-log formatting helpers.
export function formatDamageBreakdownForLog(b) {
    if (!b || typeof b !== 'object') return ''
    const bits = []
    if (b.damageType) bits.push(b.damageType)
    if (b.elementType) bits.push(String(b.elementType))

    // Elemental modifiers:
    // - affinities (weak/resist) are stored as multipliers (e.g., 1.15 = +15% weak, 0.87 = -13% resist)
    // - enemyResistPct is a flat %-reduction that stacks with affinities
    if (typeof b.affinityMult === 'number' && Number.isFinite(b.affinityMult)) {
        if (b.affinityMult > 1.001) {
            const pct = Math.round((b.affinityMult - 1) * 100)
            if (pct) bits.push('weak +' + pct + '%')
        } else if (b.affinityMult < 0.999) {
            const pct = Math.round((1 - b.affinityMult) * 100)
            if (pct) bits.push('resist -' + pct + '%')
        }
    }

    if (typeof b.enemyResistPct === 'number' && Number.isFinite(b.enemyResistPct) && b.enemyResistPct > 0) {
        bits.push('flat resist ' + b.enemyResistPct + '%')
    }
    if (typeof b.playerElementResistPct === 'number' && b.playerElementResistPct > 0) bits.push('your resist ' + b.playerElementResistPct + '%')

    // Penetration naming varies across legacy / newer breakdowns.
    const pen =
        typeof b.armorPenPct === 'number'
            ? b.armorPenPct
            : typeof b.penPct === 'number'
            ? b.penPct
            : typeof b.penetrationPct === 'number'
            ? b.penetrationPct
            : null

    if (typeof b.effectiveArmor === 'number' && b.damageType === 'physical') {
        bits.push('armor ' + b.effectiveArmor + (typeof pen === 'number' ? ' (pen ' + pen + '%)' : ''))
    }

    const effMres =
        typeof b.effectiveMagicRes === 'number'
            ? b.effectiveMagicRes
            : typeof b.effectiveRes === 'number'
            ? b.effectiveRes
            : null
    if (typeof effMres === 'number' && b.damageType === 'magic') {
        bits.push('mres ' + effMres + (typeof pen === 'number' ? ' (pen ' + pen + '%)' : ''))
    }

    if (b.crit) bits.push('CRIT x' + (b.critMult || 1))
    if (b.broken) bits.push('broken')
    return bits.join(' • ')
}

function _buildLogLineEl(entry, activeFilter) {
    const p = document.createElement('p')
    p.className = 'log-line'
    if (entry.type && entry.type !== 'normal') p.classList.add(entry.type)

    p.textContent = entry.text

    // Patch 1.2.52: when filtering for damage, show a compact breakdown line if present.
    const showDetails = activeFilter === 'damage'
    if (showDetails && entry && entry.meta && entry.meta.domain === 'combat' && entry.meta.kind === 'damage') {
        const b = entry.meta.breakdown
        const detail = formatDamageBreakdownForLog(b)
        if (detail) {
            p.appendChild(document.createElement('br'))
            const s = document.createElement('span')
            s.className = 'log-sub'
            s.textContent = detail
            p.appendChild(s)
        }
    }
    return p
}

export function addLog(msg, type = 'system', meta = null) {
    const st = _getState()
    if (!st) return
    if (!Array.isArray(st.log)) st.log = []

    // Normalize legacy / inconsistent log types.
    if (type === 'info') type = 'system'

    ensureLogIds(st)

    const entry = {
        id: _nextLogId(),
        text: String(msg),
        type: type,
        meta: meta || undefined
    }

    st.log.push(entry)

    // Keep the log bounded
    const MAX = 220
    if (st.log.length > MAX) {
        st.log.splice(0, st.log.length - MAX)
        // A trim invalidates our incremental bookkeeping.
        _logUi.lastFirstId = null
        _logUi.renderedUpToId = 0
    }

    // Update UI (disabled during smoke tests to protect the live DOM)
    if (_uiDisabled) return
    renderLog()
}

function logPassesFilter(entry, filter) {
    if (!entry) return false
    if (!filter || filter === 'all') return true
    const t = String(entry.type || '')
    if (filter === 'good') return t === 'good'
    if (filter === 'danger') return t === 'danger'
    if (filter === 'system') return t === 'system'

    // Patch 1.2.52: combat sub-filters (domain-aware)
    const m = entry.meta
    if (filter === 'combat') return !!(m && m.domain === 'combat')
    if (filter === 'damage') return !!(m && m.domain === 'combat' && m.kind === 'damage')
    if (filter === 'procs') return !!(m && m.domain === 'combat' && m.kind === 'proc')
    if (filter === 'status') return !!(m && m.domain === 'combat' && m.kind === 'status')

    return true
}

function _clamp(n, a, b) {
    return Math.max(a, Math.min(b, n))
}

function _getMaxScrollTop(el) {
    if (!el) return 0
    return Math.max(0, el.scrollHeight - el.clientHeight)
}

function _isNearBottom(el, px) {
    if (!el) return true
    // If collapsed / heightless, treat as near-bottom so we don't disable stickiness.
    if (el.clientHeight <= 0) return true
    const maxTop = _getMaxScrollTop(el)
    return maxTop - el.scrollTop <= px
}

export function scrollLogToBottom() {
    if (_uiDisabled) return
    const logEl = document.getElementById('log')
    if (!logEl) return
    try {
        logEl.scrollTop = _getMaxScrollTop(logEl)
    } catch (_) {}
}

export function initLogAutoScroll() {
    if (_uiDisabled) return
    const logEl = document.getElementById('log')
    if (!logEl) return

    const onScroll = () => {
        if (_logUi._ignoreScroll) return
        _logUi.stickToBottom = _isNearBottom(logEl, 80)
    }

    try {
        if (logEl.dataset && logEl.dataset.autoscrollWired === '1') return
        if (logEl.dataset) logEl.dataset.autoscrollWired = '1'
    } catch (_) {}

    logEl.addEventListener('scroll', onScroll, { passive: true })

    // Initialize stickiness
    _logUi.stickToBottom = _isNearBottom(logEl, 80)
}

export function renderLog() {
    if (_uiDisabled) return
    const st = _getState()
    const logEl = document.getElementById('log')
    if (!logEl || !st) return

    // Ensure auto-scroll wiring exists.
    initLogAutoScroll()

    ensureLogIds(st)

    const entries = Array.isArray(st.log) ? st.log : []

    // Determine active filter (source of truth is state.logFilter)
    const activeFilter = st.logFilter || 'all'

    const firstId = entries.length ? entries[0].id : null

    const prevMaxTop = _getMaxScrollTop(logEl)
    const prevScrollTop = _clamp(Number.isFinite(logEl.scrollTop) ? logEl.scrollTop : 0, 0, prevMaxTop)
    const wasNearBottom = _isNearBottom(logEl, 80)

    const filterChanged = _logUi.filter !== activeFilter
    const trimmed = _logUi.lastFirstId !== firstId
    const needsFull = filterChanged || trimmed || !_logUi.renderedUpToId

    const shouldAutoScroll = _logUi.stickToBottom || wasNearBottom

    if (needsFull) {
        logEl.innerHTML = ''
        _logUi.renderedUpToId = 0

        const frag = document.createDocumentFragment()
        entries.forEach((entry) => {
            if (!logPassesFilter(entry, activeFilter)) return
            frag.appendChild(_buildLogLineEl(entry, activeFilter))
            _logUi.renderedUpToId = entry.id
        })
        logEl.appendChild(frag)

        _logUi.filter = activeFilter
        _logUi.lastFirstId = firstId

        if (shouldAutoScroll) {
            _logUi._ignoreScroll = true
            requestAnimationFrame(() => {
                scrollLogToBottom()
                _logUi._ignoreScroll = false
            })
        } else {
            const maxTop = _getMaxScrollTop(logEl)
            logEl.scrollTop = _clamp(prevScrollTop, 0, maxTop)
        }

        return
    }

    // Incremental append: add only new entries.
    const frag = document.createDocumentFragment()
    let any = false
    entries.forEach((entry) => {
        if (!entry || entry.id <= _logUi.renderedUpToId) return
        if (!logPassesFilter(entry, activeFilter)) return
        frag.appendChild(_buildLogLineEl(entry, activeFilter))
        _logUi.renderedUpToId = entry.id
        any = true
    })
    if (any) logEl.appendChild(frag)

    if (shouldAutoScroll) {
        _logUi._ignoreScroll = true
        requestAnimationFrame(() => {
            scrollLogToBottom()
            _logUi._ignoreScroll = false
        })
    }
}

/* =============================================================================
 * SMALL HUD HELPERS
 * ============================================================================= */

export function updateTimeDisplay() {
    if (_uiDisabled) return
    const label = document.getElementById('timeLabel')
    const st = _getState()
    if (!label || !st) return
    const info = getTimeInfo(st)
    label.textContent = formatTimeLong(info)
}

export function setScene(title, text) {
    if (_uiDisabled) return
    const t = document.getElementById('sceneTitle')
    const b = document.getElementById('sceneText')
    if (t) t.textContent = title
    if (b) {
        b.textContent = text
        // Keep long story beats readable without pushing the UI.
        b.scrollTop = 0
    }
}

export function updateEnemyPanel() {
    if (_uiDisabled) return
    const st = _getState()

    if (!enemyPanelEls.panel) {
        enemyPanelEls.panel = document.getElementById('enemyPanel')
        enemyPanelEls.name = document.getElementById('enemyName')
        enemyPanelEls.tags = document.getElementById('enemyTags')
        enemyPanelEls.hpFill = document.getElementById('enemyHpFill')
        enemyPanelEls.hpLabel = document.getElementById('enemyHpLabel')
        enemyPanelEls.status = document.getElementById('enemyStatusLine')
        enemyPanelEls.targetHint = document.getElementById('enemyTargetHint')
    } else if (!enemyPanelEls.targetHint) {
        enemyPanelEls.targetHint = document.getElementById('enemyTargetHint')
    }

    const ep = enemyPanelEls
    if (!ep.panel) return

    // Keep target sane for multi-enemy fights.
    try {
        if (st && st.inCombat && typeof _deps.syncCurrentEnemyToTarget === 'function') {
            _deps.syncCurrentEnemyToTarget()
        }
    } catch (_) {}

    const enemy = st ? st.currentEnemy : null
    const all = st && st.inCombat && typeof _deps.getAllEnemies === 'function' ? _deps.getAllEnemies() : []
    const alive = st && st.inCombat && typeof _deps.getAliveEnemies === 'function' ? _deps.getAliveEnemies() : []

    if (!st || !st.inCombat || !enemy || alive.length <= 0 || finiteNumber(enemy.hp, 0) <= 0) {
        ep.panel.classList.add('hidden')
        if (ep.status) ep.status.textContent = ''
        if (ep.hpFill) ep.hpFill.style.width = '0%'
        if (ep.targetHint) ep.targetHint.textContent = ''
        return
    }

    ep.panel.classList.remove('hidden')

    if (ep.name) ep.name.textContent = enemy.name || 'Enemy'

    // Target hint (multi-enemy)
    if (ep.targetHint) {
        if (all.length > 1) {
            const idx = Math.max(0, Math.min(all.length - 1, Math.floor(Number(st.targetEnemyIndex || 0))))
            ep.targetHint.textContent = 'Target ' + (idx + 1) + '/' + all.length + ' • Swipe to switch'
        } else {
            ep.targetHint.textContent = ''
        }
    }

    const tags = []
    if (enemy.level) tags.push('Lv ' + enemy.level)
    if (enemy.rarityLabel) tags.push(enemy.rarityLabel)
    if (enemy.isBoss) tags.push('Boss')
    if (enemy.behavior === 'bossDragon') tags.push('Dragon')
    else if (enemy.behavior === 'bossGoblin') tags.push('Warlord')
    else if (enemy.behavior === 'bossWitch') tags.push('Witch')
    else if (enemy.behavior === 'bossGiant') tags.push('Giant')
    else if (enemy.behavior === 'bossLich') tags.push('Lich')
    else if (enemy.behavior === 'bossKing') tags.push('King')
    else if (enemy.behavior === 'caster') tags.push('Caster')
    else if (enemy.behavior === 'aggressive') tags.push('Aggressive')
    else if (enemy.behavior === 'cunning') tags.push('Cunning')

    try {
        const fn = _deps.getEnemyAffixLabels
        const affixLabels = typeof fn === 'function' ? fn(enemy) : []
        if (affixLabels && affixLabels.length > 0) {
            tags.push('Affixes: ' + affixLabels.join(', '))
        }
    } catch (_) {}

    // Elemental affinities shown in panel (Patch 1.2.0)
    // Show only if defined on the template (keeps early enemies clean).
    if (enemy && enemy.affinities) {
        const w = enemy.affinities.weak || {}
        const r = enemy.affinities.resist || {}
        const weakKeys = Object.keys(w).filter((k) => w[k] && w[k] > 1.001)
        const resistKeys = Object.keys(r).filter((k) => r[k] && r[k] < 0.999)
        if (weakKeys.length) {
            tags.push(
                'Weak: ' +
                    weakKeys
                        .map((k) => (k ? k.charAt(0).toUpperCase() + k.slice(1) : k))
                        .join(', ')
            )
        }
        if (resistKeys.length) {
            tags.push(
                'Resist: ' +
                    resistKeys
                        .map((k) => (k ? k.charAt(0).toUpperCase() + k.slice(1) : k))
                        .join(', ')
            )
        }
    }

    if (ep.tags) ep.tags.textContent = tags.join(' • ')

    const maxHp = Math.max(1, Math.floor(finiteNumber(enemy.maxHp, enemy.hp || 1)))
    const hp = clampFinite(enemy.hp, 0, maxHp, maxHp)
    const hpPct = Math.max(0, Math.min(100, (hp / maxHp) * 100))
    if (ep.hpFill) ep.hpFill.style.width = hpPct + '%'

    if (ep.hpLabel) {
        ep.hpLabel.textContent = 'HP ' + Math.max(0, Math.round(hp)) + '/' + maxHp
    }

    const statusParts = []

    if (enemy.bleedTurns && enemy.bleedTurns > 0 && enemy.bleedDamage) {
        statusParts.push(`Bleeding (${enemy.bleedTurns}t, ${enemy.bleedDamage} dmg)`)
    }
    if (enemy.chilledTurns && enemy.chilledTurns > 0) {
        statusParts.push(`Chilled (${enemy.chilledTurns}t)`)
    }
    if (enemy.burnTurns && enemy.burnTurns > 0) {
        statusParts.push(`Burning (${enemy.burnTurns}t)`)
    }
    if (enemy.guardTurns && enemy.guardTurns > 0) {
        statusParts.push(`Guarding (${enemy.guardTurns}t)`)
    }

    if (typeof enemy.postureMax === 'number' && Number.isFinite(enemy.postureMax) && enemy.postureMax > 0) {
        const pm = Math.max(1, Math.floor(enemy.postureMax))
        const posture = clampFinite(enemy.posture, 0, pm, 0)
        statusParts.push('Posture ' + posture + '/' + pm)
    }
    if (enemy.brokenTurns && enemy.brokenTurns > 0) {
        statusParts.push('Broken ' + enemy.brokenTurns + 't')
    }
    if (enemy.atkDownTurns && enemy.atkDownTurns > 0 && enemy.atkDownFlat) {
        statusParts.push('Weakened ' + enemy.atkDownFlat + ' (' + enemy.atkDownTurns + 't)')
    }
    if (enemy.intent && enemy.intent.aid) {
        try {
            const tbl = _deps.ENEMY_ABILITIES || {}
            const ab = tbl[enemy.intent.aid]
            const turns = clampFinite(enemy.intent.turnsLeft, 0, 99, 0)
            statusParts.push('Intent: ' + (ab ? ab.name : enemy.intent.aid) + ' (' + turns + 't)')
        } catch (_) {
            const turns = clampFinite(enemy.intent.turnsLeft, 0, 99, 0)
            statusParts.push('Intent: ' + enemy.intent.aid + ' (' + turns + 't)')
        }
    }

    if (ep.status) ep.status.textContent = statusParts.join(' • ')
}
