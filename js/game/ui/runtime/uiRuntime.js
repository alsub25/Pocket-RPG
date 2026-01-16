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
import { nextTick, scheduleAfter } from '../../utils/timing.js'

let _deps = {
    getState: null,
    // Engine core (optional): used to route modals through engine.ui router.
    engine: null,
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

// NOTE: Keep the document guards near the top because other helpers depend on
// them during module evaluation.
const _hasDocument = typeof document !== 'undefined'
const _byId = (id) => (_hasDocument ? document.getElementById(id) : null)

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


function _getEngine() {
    try {
        if (_deps && _deps.engine) return _deps.engine
    } catch (_) {}
    try {
        return window.__emberwoodEngine || window.__emberwoodEngineRef || null
    } catch (_) {
        return null
    }
}

/* =============================================================================
 * UI COMPOSE HELPERS (toast / busy overlay / transitions)
 * These are intentionally tiny so the engine can drive them via uiCompose.
 * ============================================================================= */

let _toastLayer = null
let _busyOverlay = null
let _transitionOverlay = null

function _ensureToastLayer() {
    if (_uiDisabled) return null
    if (!_hasDocument) return null
    try {
        if (_toastLayer && _toastLayer.isConnected) return _toastLayer
        const existing = document.getElementById('toastLayer')
        if (existing) {
            _toastLayer = existing
            return _toastLayer
        }
        const el = document.createElement('div')
        el.id = 'toastLayer'
        el.className = 'toast-layer'
        // Minimal inline styles so it works even if CSS is overridden.
        el.style.position = 'fixed'
        el.style.top = '12px'
        el.style.left = '50%'
        el.style.transform = 'translateX(-50%)'
        el.style.display = 'flex'
        el.style.flexDirection = 'column'
        el.style.gap = '8px'
        el.style.zIndex = '9999'
        el.style.pointerEvents = 'none'
        document.body.appendChild(el)
        _toastLayer = el
        return el
    } catch (_) {
        return null
    }
}

export function showToast(message, opts = {}) {
    if (_uiDisabled) return
    const text = String(message == null ? '' : message)
    if (!text) return
    const durationMs = Number.isFinite(Number(opts.durationMs)) ? Math.max(250, Number(opts.durationMs)) : 2500

    const layer = _ensureToastLayer()
    if (!layer) return

    let toastEl = null
    const noMotion = (() => {
        try { return !!(document && document.body && document.body.classList && document.body.classList.contains('no-motion')) } catch (_) { return false }
    })()
    try {
        toastEl = document.createElement('div')
        toastEl.className = 'toast'
        toastEl.textContent = text
        toastEl.style.pointerEvents = 'none'
        toastEl.style.maxWidth = '92vw'
        toastEl.style.padding = '10px 12px'
        toastEl.style.borderRadius = '10px'
        toastEl.style.background = 'rgba(0,0,0,0.85)'
        toastEl.style.color = '#fff'
        toastEl.style.fontSize = '13px'
        toastEl.style.lineHeight = '1.25'
        toastEl.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)'
        toastEl.style.opacity = noMotion ? '1' : '0'
        toastEl.style.transform = noMotion ? 'translateY(0px)' : 'translateY(-6px)'
        layer.appendChild(toastEl)
        if (!noMotion) {
            // Animate in via engine.tween when available.
            const eng = _getEngine()
            const tw = eng && eng.getService ? eng.getService('tween') : null
            if (tw && typeof tw.to === 'function') {
                try { tw.to(toastEl, { style: { opacity: 1 } }, { ms: 120, owner: 'ui:toast' }) } catch (_) {}
                try { toastEl.style.transform = 'translateY(0px)' } catch (_) {}
            } else {
                // Fallback: next frame style flip.
                try {
                    requestAnimationFrame(() => {
                        try { toastEl.style.opacity = '1' } catch (_) {}
                        try { toastEl.style.transform = 'translateY(0px)' } catch (_) {}
                    })
                } catch (_) {
                    try { toastEl.style.opacity = '1' } catch (_) {}
                    try { toastEl.style.transform = 'translateY(0px)' } catch (_) {}
                }
            }
        }
    } catch (_) {
        return
    }

    const remove = () => {
        try {
            if (!toastEl) return
            if (noMotion) {
                try { toastEl.remove() } catch (_) {}
                return
            }

            const eng = _getEngine()
            const tw = eng && eng.getService ? eng.getService('tween') : null
            if (tw && typeof tw.to === 'function') {
                try {
                    tw.to(toastEl, { style: { opacity: 0 } }, {
                        ms: 140,
                        owner: 'ui:toast',
                        onComplete: () => { try { toastEl.remove() } catch (_) {} }
                    })
                } catch (_) {
                    try { toastEl.remove() } catch (_) {}
                }
            } else {
                try { toastEl.style.opacity = '0' } catch (_) {}
                // Use rafDelay/scheduler helper (no setTimeout).
                try { scheduleAfter(eng, 140, () => { try { toastEl.remove() } catch (_) {} }, { owner: 'ui:toast' }) } catch (_) {
                    try { toastEl.remove() } catch (_) {}
                }
            }
        } catch (_) {
            try { toastEl && toastEl.remove() } catch (_) {}
        }
    }

    // Prefer engine scheduler so ownership can cancel on screen teardown.
    const eng = _getEngine()
    try { scheduleAfter(eng, durationMs, remove, { owner: 'ui:toast' }) } catch (_) {}
}

function _ensureBusyOverlay() {
    if (_uiDisabled) return null
    if (!_hasDocument) return null
    try {
        if (_busyOverlay && _busyOverlay.isConnected) return _busyOverlay
        const existing = document.getElementById('busyOverlay')
        if (existing) {
            _busyOverlay = existing
            return _busyOverlay
        }
        const el = document.createElement('div')
        el.id = 'busyOverlay'
        el.className = 'busy-overlay hidden'
        el.style.position = 'fixed'
        el.style.inset = '0'
        el.style.zIndex = '9998'
        el.style.display = 'flex'
        el.style.alignItems = 'center'
        el.style.justifyContent = 'center'
        el.style.background = 'rgba(0,0,0,0.35)'
        el.style.backdropFilter = 'blur(2px)'

        const card = document.createElement('div')
        card.className = 'busy-card'
        card.style.padding = '12px 14px'
        card.style.borderRadius = '12px'
        card.style.background = 'rgba(0,0,0,0.85)'
        card.style.color = '#fff'
        card.style.fontSize = '13px'
        card.style.boxShadow = '0 6px 20px rgba(0,0,0,0.25)'
        card.style.minWidth = '220px'

        const title = document.createElement('div')
        title.className = 'busy-title'
        title.textContent = 'Working…'

        const barWrap = document.createElement('div')
        barWrap.className = 'busy-bar-wrap'
        barWrap.style.marginTop = '10px'
        barWrap.style.height = '8px'
        barWrap.style.borderRadius = '999px'
        barWrap.style.overflow = 'hidden'
        barWrap.style.background = 'rgba(255,255,255,0.18)'

        const bar = document.createElement('div')
        bar.className = 'busy-bar'
        bar.style.height = '100%'
        bar.style.width = '0%'
        bar.style.background = 'rgba(255,255,255,0.85)'
        barWrap.appendChild(bar)

        card.appendChild(title)
        card.appendChild(barWrap)
        el.appendChild(card)
        document.body.appendChild(el)
        _busyOverlay = el
        return el
    } catch (_) {
        return null
    }
}

export function setBusyOverlay(isBusy, opts = {}) {
    if (_uiDisabled) return
    const el = _ensureBusyOverlay()
    if (!el) return
    try {
        const txt = opts && typeof opts.text === 'string' ? opts.text : (opts && typeof opts.message === 'string' ? opts.message : null)
        const title = el.querySelector('.busy-title')
        if (title && txt) title.textContent = txt

        // Optional progress: accepts pct/progress in 0..1 or 0..100
        const pRaw = (opts && (opts.pct ?? opts.progress))
        let pct = null
        if (pRaw != null) {
            const n = Number(pRaw)
            if (Number.isFinite(n)) {
                pct = (n <= 1) ? Math.round(n * 100) : Math.round(n)
                pct = Math.max(0, Math.min(100, pct))
            }
        }
        const bar = el.querySelector('.busy-bar')
        if (bar) {
            if (pct == null) {
                // Hide bar when no progress is supplied.
                try { bar.style.width = '0%' } catch (_) {}
            } else {
                try { bar.style.width = String(pct) + '%' } catch (_) {}
            }
        }
        el.classList.toggle('hidden', !isBusy)
    } catch (_) {}
}

export function applyUiTransition(name, opts = {}) {
    if (_uiDisabled) return
    if (!_hasDocument) return
    // Minimal fade overlay; adapters can override with CSS if desired.
    try {
        const clear = !!opts.clear
        if (clear) {
            if (_transitionOverlay) {
                try { _transitionOverlay.remove() } catch (_) {}
            }
            _transitionOverlay = null
            return
        }

        const durationMs = Number.isFinite(Number(opts.durationMs)) ? Math.max(50, Number(opts.durationMs)) : 220
        const eng = _getEngine()
        const tw = eng && eng.getService ? eng.getService('tween') : null
        try {
            // Cancel any previous transition timers/tweens.
            if (eng && eng.schedule && typeof eng.schedule.cancelOwner === 'function') eng.schedule.cancelOwner('ui:transition')
            if (tw && typeof tw.cancelOwner === 'function') tw.cancelOwner('ui:transition')
        } catch (_) {}
        if (_transitionOverlay && _transitionOverlay.isConnected) {
            try { _transitionOverlay.remove() } catch (_) {}
        }
        const el = document.createElement('div')
        el.id = 'uiTransitionOverlay'
        el.style.position = 'fixed'
        el.style.inset = '0'
        el.style.zIndex = '9997'
        el.style.pointerEvents = 'none'
        el.style.background = 'rgba(0,0,0,0.0)'
        el.style.opacity = '0'
        el.style.transition = `opacity ${Math.max(80, Math.floor(durationMs / 2))}ms ease`
        document.body.appendChild(el)
        _transitionOverlay = el

        const half = Math.max(80, Math.floor(durationMs / 2))
        const hold = Math.max(50, Math.floor(durationMs / 3))

        const remove = () => {
            try { el.remove() } catch (_) {}
            if (_transitionOverlay === el) _transitionOverlay = null
        }

        // Animate using engine.tween when available; otherwise use scheduler + CSS transitions.
        if (tw && typeof tw.to === 'function') {
            try { tw.to(el, { style: { opacity: 1 } }, { ms: half, owner: 'ui:transition' }) } catch (_) { try { el.style.opacity = '1' } catch (_) {} }
            scheduleAfter(eng, hold, () => {
                try { tw.to(el, { style: { opacity: 0 } }, { ms: half, owner: 'ui:transition', onComplete: remove }) } catch (_) { remove() }
            }, { owner: 'ui:transition' })
        } else {
            // Kick on next frame to ensure transition triggers.
            try {
                requestAnimationFrame(() => {
                    try { el.style.opacity = '1' } catch (_) {}
                })
            } catch (_) {
                try { el.style.opacity = '1' } catch (_) {}
            }
            scheduleAfter(eng, hold, () => {
                try { el.style.opacity = '0' } catch (_) {}
                scheduleAfter(eng, half + 20, remove, { owner: 'ui:transition' })
            }, { owner: 'ui:transition' })
        }
    } catch (_) {}
}

export function applyHudState(st = {}) {
    if (_uiDisabled) return
    if (!_hasDocument) return
    try {
        if (st.devPillsVisible != null) {
            const show = !!st.devPillsVisible
            const smokePill = document.getElementById('btnSmokeTestsPill')
            const cheatPill = document.getElementById('btnCheatPill')
            if (smokePill) smokePill.classList.toggle('hidden', !show)
            if (cheatPill) cheatPill.classList.toggle('hidden', !show)
        }
        if (st.enemyPanelVisible != null) {
            const show = !!st.enemyPanelVisible
            const panel = document.getElementById('enemyPanel')
            if (panel) panel.classList.toggle('hidden', !show)
        }
    } catch (_) {}
}

function _getAudioState() {
    try {
        const eng = _getEngine()
        const audio = eng && typeof eng.getService === 'function' ? eng.getService('audio') : null
        if (audio && typeof audio.getAudioState === 'function') return audio.getAudioState()
    } catch (_) {}
    try {
        if (_deps && typeof _deps.getAudioState === 'function') return _deps.getAudioState()
    } catch (_) {}
    return null
}

function _playMusicTrack(trackId) {
    try {
        const eng = _getEngine()
        const audio = eng && typeof eng.getService === 'function' ? eng.getService('audio') : null
        if (audio && typeof audio.playMusicTrack === 'function') {
            audio.playMusicTrack(trackId)
            return
        }
    } catch (_) {}
    try {
        if (_deps && typeof _deps.playMusicTrack === 'function') _deps.playMusicTrack(trackId)
    } catch (_) {}
}

function _updateAreaMusic() {
    try {
        const eng = _getEngine()
        const audio = eng && typeof eng.getService === 'function' ? eng.getService('audio') : null
        if (audio && typeof audio.updateAreaMusic === 'function') {
            audio.updateAreaMusic()
            return
        }
    } catch (_) {}
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

// (moved to top)

const enemyPanelEls = {
    panel: _byId('enemyPanel'),
    name: _byId('enemyName'),
    tags: _byId('enemyTags'),
    hpFill: _byId('enemyHpFill'),
    hpLabel: _byId('enemyHpLabel'),
    status: _byId('enemyStatusLine'),
    targetHint: _byId('enemyTargetHint')
}

// Exported for smoke tests and legacy engine call sites.
// NOTE: This is an object (mutable properties) so tests can temporarily
// null individual screen refs without reassigning the binding.
export const screens = {
    mainMenu: _byId('mainMenu'),
    character: _byId('characterScreen'),
    game: _byId('gameScreen'),
    settings: _byId('settingsScreen')
}

const modalEl = _byId('modal')
const modalTitleEl = _byId('modalTitle')
const modalBodyEl = _byId('modalBody')
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
const enemyModalEl = _byId('enemyModal')
const enemyModalTitleEl = _byId('enemyModalTitle')
const enemyModalBodyEl = _byId('enemyModalBody')
let enemyModalOnClose = null // optional one-shot callback run when closeEnemyModal() is called

// Owner used for schedule/tween cleanup + input context scoping.
let _enemyModalOwner = ''

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
            // Route through the Engine input layer when available so Escape is consistent
            // across screens/modals and can be overridden by input contexts.
            try {
                const engine = _getEngine()
                if (engine && engine.input && typeof engine.input.trigger === 'function') {
                    engine.input.trigger('UI_ESCAPE', { source: 'modal:trap' })
                } else {
                    closeModal()
                }
            } catch (_) {
                closeModal()
            }
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
            try {
                const engine = _getEngine()
                if (engine && engine.input && typeof engine.input.trigger === 'function') {
                    engine.input.trigger('UI_ESCAPE', { source: 'enemyModal:trap' })
                } else {
                    closeEnemyModal()
                }
            } catch (_) {
                closeEnemyModal()
            }
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
let pendingInteriorCloseHandle = null

// Active screen label used for schedule ownership cleanup.
let _activeScreenName = null

// Owner namespace for the short interior ambience debounce used during modal transitions.
const INTERIOR_CLOSE_OWNER = 'audio:interiorClose'

function _slug(s, { maxLen = 40 } = {}) {
    const raw = String(s || '').trim().toLowerCase()
    const v = raw
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '')
    return (v.length > maxLen) ? v.slice(0, maxLen) : v
}

function _cancelOwner(owner) {
    const engine = _getEngine()
    try {
        if (engine && engine.schedule && typeof engine.schedule.cancelOwner === 'function') {
            engine.schedule.cancelOwner(owner)
        }
    } catch (_) {}

    // If tweens are in use, cancel those too.
    try {
        const tw = engine && engine.getService ? engine.getService('tween') : null
        if (tw && typeof tw.cancelOwner === 'function') tw.cancelOwner(owner)
    } catch (_) {}
    // Optional companion primitive: owner-scoped disposables.
    try {
        if (engine && typeof engine.disposeOwner === 'function') {
            engine.disposeOwner(owner)
        }
    } catch (_) {}
}

export function switchScreen(name) {
    if (_uiDisabled) return

    const nextName = String(name || '')
    const prevName = _activeScreenName
    const engine = _getEngine()

    // Prevent timer leakage when leaving a screen: cancel all tasks owned by the previous screen.
    if (prevName && prevName !== nextName) {
        _cancelOwner(`screen:${prevName}`)
        // If we are leaving the live game screen, also cancel any active modal timers.
        if (prevName === 'game') {
            try {
                const modalOwner = (modalEl && modalEl.dataset && modalEl.dataset.timerOwner) ? modalEl.dataset.timerOwner : ''
                if (modalOwner) _cancelOwner(modalOwner)
            } catch (_) {}
            _cancelOwner(INTERIOR_CLOSE_OWNER)
        }

        // Lifecycle event for plugins (input contexts, analytics, etc.)
        try {
            if (engine && typeof engine.emit === 'function') {
                engine.emit('screen:leave', { screen: prevName, owner: `screen:${prevName}` })
            }
        } catch (_) {}
    }
    _activeScreenName = nextName || null

    Object.values(screens).filter(Boolean).forEach((s) => s.classList.add('hidden'))
    if (screens[name]) screens[name].classList.remove('hidden')

    // Lifecycle event for plugins (input contexts, analytics, etc.)
    try {
        if (engine && typeof engine.emit === 'function') {
            engine.emit('screen:enter', { screen: nextName, owner: `screen:${nextName}` })
        }
    } catch (_) {}

    // Ensure ambience never leaks onto non-game screens (main menu, settings, character creation).
    if (name !== 'game') {
        try {
            const audioState = _getAudioState()
            if (audioState) audioState.interiorOpen = false
            _playMusicTrack(null)
        } catch (e) {}
    }
}

export function openModalDom(title, builderFn, opts = null) {
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
    if (pendingInteriorCloseHandle && typeof pendingInteriorCloseHandle.cancel === 'function') {
        try { pendingInteriorCloseHandle.cancel() } catch (_) {}
        pendingInteriorCloseHandle = null
    }
    _cancelOwner(INTERIOR_CLOSE_OWNER)

    // Determine owner used for schedule cleanup when this modal closes.
    const owner = (() => {
        try {
            if (opts && typeof opts === 'object' && typeof opts.owner === 'string' && opts.owner.trim()) return opts.owner.trim()
        } catch (_) {}
        const guess = _slug(title)
        return `modal:${guess || 'unknown'}`
    })()

    // If a previous modal owner exists, cancel its timers before overwriting the shared modal DOM.
    try {
        const prevOwner = (modalEl.dataset && modalEl.dataset.timerOwner) ? modalEl.dataset.timerOwner : ''
        if (prevOwner && prevOwner !== owner) _cancelOwner(prevOwner)
    } catch (_) {}
    try { modalEl.dataset.timerOwner = owner } catch (_) {}

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
    modalEl.classList.remove('modal-closing') // Ensure closing animation is cleared
    _installModalFocusTrap()

    // Lifecycle event for plugins.
    try {
        const engine = _getEngine()
        if (engine && typeof engine.emit === 'function') {
            engine.emit('modal:open', { title: String(title || ''), owner })
        }
    } catch (_) {}

    // Focus first focusable control (or the panel itself)
    try {
        const panel = document.getElementById('modalPanel')
        const focusables = _getFocusableElements(panel || modalEl)
        if (focusables.length) focusables[0].focus()
        else if (panel) panel.focus()
    } catch (_) {}
}

export function closeModalDom() {
    // IMPORTANT: allow the adapter even when UI writes are disabled.
    try {
        if (_modalAdapter && typeof _modalAdapter.closeModal === 'function') {
            _modalAdapter.closeModal()
            return
        }
    } catch (_) {}

    if (_uiDisabled) return

    if (!modalEl) return
    
    // Don't close if the modal is already hidden or closing
    if (modalEl.classList.contains('hidden') || modalEl.classList.contains('modal-closing')) return
    
    // Don't close if the modal isn't actually marked as open
    try {
        if (modalEl.dataset.open !== '1') return
    } catch (_) {}

    // If another subsystem owns/locks the modal (e.g., user acceptance), don't close it.
    try {
        const locked = modalEl.dataset.lock === '1'
        const owner = modalEl.dataset.owner || ''
        if (locked && owner && owner !== 'game') return
    } catch (_) {}

    // Cancel any outstanding tasks owned by the active modal (UI effects, deferred renders, etc.).
    const _closingOwner = (() => {
        try { return (modalEl.dataset && modalEl.dataset.timerOwner) ? modalEl.dataset.timerOwner : '' } catch (_) { return '' }
    })()

    try {
        const modalOwner = _closingOwner
        if (modalOwner) _cancelOwner(modalOwner)
        if (modalEl.dataset) modalEl.dataset.timerOwner = ''
    } catch (_) {}

    // Add smooth closing animation before hiding (v1.2.85 enhancement)
    modalEl.classList.add('modal-closing')
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
        if (!modalEl) return
        
        // Tear down focus trap *before* hiding so focus doesn't get stuck.
        _removeModalFocusTrap()

        modalEl.classList.add('hidden')
        modalEl.classList.remove('modal-closing')

        try {
            modalEl.setAttribute('aria-hidden', 'true')
            modalEl.dataset.open = '0'
            // Release ownership on close.
            if (modalEl.dataset.owner === 'game') modalEl.dataset.owner = ''
            // Ensure the modal is unlocked for other subsystems.
            modalEl.dataset.lock = '0'
        } catch (_) {}

        // Lifecycle event for plugins (input contexts, analytics, etc.).
        // Emit immediately so it always fires even when audio does a deferred interior-close.
        try {
            const engine = _getEngine()
            if (engine && typeof engine.emit === 'function') {
                engine.emit('modal:close', { owner: _closingOwner || '' })
            }
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
            if (pendingInteriorCloseHandle && typeof pendingInteriorCloseHandle.cancel === 'function') {
                try { pendingInteriorCloseHandle.cancel() } catch (_) {}
                pendingInteriorCloseHandle = null
            }
            _cancelOwner(INTERIOR_CLOSE_OWNER)

            const run = () => {
                pendingInteriorCloseHandle = null

                // If the modal got reopened immediately, we're still "inside"—do not stop interior music.
                const stillHidden = modalEl.classList.contains('hidden')
                if (!stillHidden) return

                audioState.interiorOpen = false
                _updateAreaMusic()
            }

            // Prefer the Engine scheduler so this debounce follows the unified clock.
            try {
                const engine = _getEngine()
                pendingInteriorCloseHandle = scheduleAfter(engine, 75, run, { owner: INTERIOR_CLOSE_OWNER })
            } catch (_) {
                pendingInteriorCloseHandle = { cancel() {} }
                nextTick(run)
            }
            return
        }

        _updateAreaMusic()
    }, 200)

}


// -----------------------------------------------------------------------------
// Engine UI router integration (Patch 1.2.72)
// - We route modal opens/closes through engine.ui so the Engine Core owns the
//   modal stack and can include it in diagnostics/telemetry.
// - The engine adapter (installed by the UI plugin) calls openModalDom/closeModalDom
//   to actually render into the live DOM.
// -----------------------------------------------------------------------------
let _engineModalSeq = 0

export function openModal(title, builderFn, opts = null) {
    const engine = _getEngine()
    try {
        if (engine && engine.ui && typeof engine.ui.open === 'function') {
            const id = `modal.${++_engineModalSeq}`
            const owner = (() => {
                try {
                    const o = (opts && typeof opts === 'object') ? opts.owner : ''
                    if (typeof o === 'string' && o.trim()) return o.trim()
                } catch (_) {}
                return `modal:${id}`
            })()
            engine.ui.open(id, { title, builderFn, owner })
            return
        }
    } catch (_) {}
    return openModalDom(title, builderFn, opts)
}

export function closeModal() {
    const engine = _getEngine()
    try {
        if (engine && engine.ui && typeof engine.ui.close === 'function') {
            const hasStack = (() => {
                try { return Array.isArray(engine.ui.list ? engine.ui.list() : null) && engine.ui.list().length > 0 } catch (_) { return true }
            })()
            if (hasStack) {
                engine.ui.close()
                return
            }
        }
    } catch (_) {}
    return closeModalDom()
}

export function openEnemyModal(title, builderFn) {
    if (_uiDisabled) return
    if (!enemyModalEl) return

    // Keep the Enemy Sheet under a stable owner key so engine plugins
    // (input contexts, asset preloads, schedule/tween cleanup) can treat it
    // predictably regardless of title text.
    const owner = 'modal:enemySheet'

    // If a previous owner exists, cancel its timers before overwriting the shared Enemy Sheet DOM.
    try {
        const prevOwner = (enemyModalEl.dataset && enemyModalEl.dataset.timerOwner) ? enemyModalEl.dataset.timerOwner : ''
        if (prevOwner && prevOwner !== owner) _cancelOwner(prevOwner)
    } catch (_) {}
    try { enemyModalEl.dataset.timerOwner = owner } catch (_) {}
    _enemyModalOwner = owner

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
    enemyModalEl.classList.remove('modal-closing') // Ensure closing animation is cleared
    _installEnemyModalFocusTrap()

    // Lifecycle event for plugins (input contexts, analytics, asset preloads, etc.).
    try {
        const engine = _getEngine()
        if (engine && typeof engine.emit === 'function') {
            engine.emit('modal:open', { title: String(title || ''), owner })
        }
    } catch (_) {}

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
    
    // Don't close if the modal is already hidden or closing
    if (enemyModalEl.classList.contains('hidden') || enemyModalEl.classList.contains('modal-closing')) return
    
    // Don't close if the modal isn't actually marked as open
    try {
        if (enemyModalEl.dataset.open !== '1') return
    } catch (_) {}

    // Cancel any outstanding tasks owned by this modal.
    const _closingOwner = (() => {
        try { return (enemyModalEl.dataset && enemyModalEl.dataset.timerOwner) ? enemyModalEl.dataset.timerOwner : (_enemyModalOwner || '') } catch (_) { return _enemyModalOwner || '' }
    })()

    try {
        if (_closingOwner) _cancelOwner(_closingOwner)
        if (enemyModalEl.dataset) enemyModalEl.dataset.timerOwner = ''
    } catch (_) {}

    // Add smooth closing animation (v1.2.85 enhancement)
    enemyModalEl.classList.add('modal-closing')
    
    // Wait for animation to complete before hiding
    setTimeout(() => {
        if (!enemyModalEl) return
        
        _removeEnemyModalFocusTrap()

        enemyModalEl.classList.add('hidden')
        enemyModalEl.classList.remove('modal-closing')

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

        // Lifecycle event for plugins (input contexts, analytics, etc.).
        try {
            const engine = _getEngine()
            if (engine && typeof engine.emit === 'function') {
                engine.emit('modal:close', { owner: _closingOwner || '' })
            }
        } catch (_) {}

        _enemyModalOwner = ''
    }, 200)
}

export function isEnemyModalOpen() {
    try {
        if (_uiDisabled) return false
        if (!enemyModalEl) return false
        if (enemyModalEl.classList.contains('hidden')) return false
        if (enemyModalEl.dataset && enemyModalEl.dataset.open === '1') return true
        // Fallback: treat visible = open.
        return true
    } catch (_) {
        return false
    }
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
