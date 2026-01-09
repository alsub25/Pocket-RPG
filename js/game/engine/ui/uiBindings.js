/* =============================================================================
 * UI Bindings (uiBindings.js)
 *
 * Extracted from engine.js in Patch 1.2.70.
 * Owns:
 * - DOMContentLoaded wiring
 * - Main menu + settings wiring
 * - Modal dismissal wiring
 * - Collapsible panel plumbing
 * - Log filter chips wiring
 * - Enemy panel interactions
 * ============================================================================= */

import {
    closeModal,
    closeEnemyModal,
    switchScreen,
    renderLog,
    initLogAutoScroll,
    scrollLogToBottom,
    getLogUiState
} from './uiRuntime.js'

function applyVersionLabels(patchLabel) {
    try {
        const el = document.getElementById('versionLabel')
        if (el) el.textContent = patchLabel
    } catch (_) {}

    try {
        const el2 = document.getElementById('footerVersion')
        if (el2) el2.textContent = patchLabel
    } catch (_) {}
}

function onDocReady(fn) {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', fn, { once: true })
    } else {
        fn()
    }
}

function initLogFilterChips(getState) {
    const bar = document.getElementById('logFilters')
    if (!bar) return

    // Emberwood log filters use:
    //  - buttons: .log-chip
    //  - attribute: data-log-filter
    //  - active class: log-chip-active
    const chips = Array.from(bar.querySelectorAll('.log-chip[data-log-filter]'))
    if (!chips.length) return

    const syncActiveChip = () => {
        const st = getState ? getState() : null
        const current = (st && st.logFilter) ? String(st.logFilter) : 'all'
        chips.forEach((chip) => {
            const v = (chip.dataset && chip.dataset.logFilter) ? String(chip.dataset.logFilter) : 'all'
            chip.classList.toggle('log-chip-active', v === current)
        })
    }

    // Hydrate highlight immediately
    try {
        const st = getState ? getState() : null
        if (st && !st.logFilter) st.logFilter = 'all'
    } catch (_) {}
    try { syncActiveChip() } catch (_) {}

    // Delegate clicks to avoid duplicate listeners / DOM churn.
    try {
        if (bar.dataset && bar.dataset.logFiltersWired === '1') return
        if (bar.dataset) bar.dataset.logFiltersWired = '1'
    } catch (_) {}

    bar.addEventListener('click', (e) => {
        const btn = e.target && e.target.closest ? e.target.closest('[data-log-filter]') : null
        if (!btn || !bar.contains(btn)) return

        const value = (btn.dataset && btn.dataset.logFilter) ? String(btn.dataset.logFilter) : 'all'
        try {
            const st = getState ? getState() : null
            if (st) st.logFilter = value
        } catch (_) {}

        try { syncActiveChip() } catch (_) {}
        renderLog()
    })
}

function setupCollapsingPanels() {
    const questBox = document.getElementById('questBox')
    const questTitle = document.getElementById('questTitle')
    const logBox = document.getElementById('logBox')
    const logHeader = document.getElementById('logHeader')

    // Animate explicit height for the Log panel (flex-fill) so it collapses/expands smoothly
    // without snapping or breaking flex sizing.
    function toggleAnimatedHeight(boxEl, syncAriaFn, opts = {}) {
        if (!boxEl) return
        const collapsedH = Number(opts.collapsedHeightPx || 26)
        if (boxEl.dataset.panelAnimating === '1') return
        boxEl.dataset.panelAnimating = '1'

        const finish = () => {
            boxEl.dataset.panelAnimating = '0'
            boxEl.style.height = ''
        }

        const onEnd = (e) => {
            if (!e || e.target !== boxEl || e.propertyName !== 'height') return
            boxEl.removeEventListener('transitionend', onEnd)
            finish()
        }
        boxEl.addEventListener('transitionend', onEnd)

        const isCollapsed = boxEl.classList.contains('collapsed')

        if (!isCollapsed) {
            // Collapse: lock current height, then animate down to collapsed height.
            const startH = boxEl.getBoundingClientRect().height
            boxEl.style.height = `${startH}px`
            void boxEl.offsetHeight
            requestAnimationFrame(() => {
                boxEl.classList.add('collapsed')
                boxEl.style.height = `${collapsedH}px`
                try { if (typeof syncAriaFn === 'function') syncAriaFn() } catch (_) {}
            })
            return
        }

        // Expand: measure natural expanded height, then animate to it.
        boxEl.style.height = `${collapsedH}px`
        void boxEl.offsetHeight

        boxEl.classList.remove('collapsed')
        boxEl.style.height = ''
        const targetH = boxEl.getBoundingClientRect().height

        boxEl.classList.add('collapsed')
        boxEl.style.height = `${collapsedH}px`
        void boxEl.offsetHeight

        requestAnimationFrame(() => {
            boxEl.classList.remove('collapsed')
            boxEl.style.height = `${targetH}px`
            try { if (typeof syncAriaFn === 'function') syncAriaFn() } catch (_) {}
        })
    }

    function wire(headerEl, boxEl, flagKey) {
        if (!headerEl || !boxEl) return
        const key = flagKey || 'collapseWired'
        if (headerEl.dataset[key]) return
        headerEl.dataset[key] = '1'

        headerEl.setAttribute('role', 'button')
        headerEl.setAttribute('tabindex', '0')

        const syncAria = () => {
            headerEl.setAttribute('aria-expanded', String(!boxEl.classList.contains('collapsed')))
        }

        const toggle = () => {
            const wasCollapsed = boxEl.classList.contains('collapsed')
            if (boxEl.id === 'logBox') {
                toggleAnimatedHeight(boxEl, syncAria, { collapsedHeightPx: 26 })
            } else {
                boxEl.classList.toggle('collapsed')
                syncAria()
            }

            // If the Log panel is expanding and the user has stick-to-bottom enabled, pin it.
            try {
                const ui = getLogUiState()
                if (wasCollapsed && boxEl.id === 'logBox' && ui && ui.stickToBottom) {
                    requestAnimationFrame(() => {
                        try { scrollLogToBottom() } catch (_) {}
                    })
                }
            } catch (_) {}
        }

        headerEl.addEventListener('click', toggle)
        headerEl.addEventListener('keydown', (e) => {
            if (!e) return
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toggle()
            }
        })

        syncAria()
    }

    wire(questTitle, questBox, 'collapseWiredQuest')
    wire(logHeader, logBox, 'collapseWiredLog')
}

export function initUIBindings(api) {
    const {
        patchLabel,
        initCrashCatcher,
        getState,
        randInt,
        resetDevCheatsCreationUI,
        buildCharacterCreationOptions,
        openSaveManager,
        initSettingsFromState,
        openChangelogModal,
        openFeedbackModal,
        openCharacterSheet,
        startNewGameFromCreation,
        applySettingsChanges,
        safeStorageGet,
        setTheme,
        SAVE_KEY,
        migrateSaveData,
        updateEnemyPanel,
        openEnemySheet,
        cycleTargetEnemy,
        toggleHudEntity,
        openPauseMenu,
        quests,
        syncSmokeTestsPillVisibility,
        openSmokeTestsModal,
        openCheatMenu,
        cheatsEnabled
    } = api || {}

    onDocReady(() => {
        try { if (typeof initCrashCatcher === 'function') initCrashCatcher() } catch (_) {}
        applyVersionLabels(String(patchLabel || ''))

        // HUD: tap player name to open Character Sheet
        try {
            const hudName = document.getElementById('hud-name')
            if (hudName && !(hudName.dataset && hudName.dataset.charSheetWired)) {
                try { hudName.dataset.charSheetWired = '1' } catch (_) {}
                try { hudName.style.cursor = 'pointer' } catch (_) {}
                hudName.addEventListener('click', () => {
                    try {
                        const st = getState ? getState() : null
                        if (!st || !st.player) return
                        if (typeof openCharacterSheet === 'function') openCharacterSheet()
                    } catch (_) {}
                })
            }
        } catch (_) {}

        // Force refresh to clear any potentially stuck audio on load.
        try {
            if (typeof window !== 'undefined') {
                window.__emberwoodTouchAudioUnlocked = false
            }
        } catch (_) {}

        // --- MAIN MENU BUTTONS ---
        // IDs must match index.html.
        const btnNewGame = document.getElementById('btnNewGame')
        const btnLoadGame = document.getElementById('btnLoadGame')
        const btnSettingsMain = document.getElementById('btnSettingsMain')
        const btnChangelog = document.getElementById('btnChangelog')
        const btnFeedback = document.getElementById('btnFeedback')

        if (btnNewGame) {
            btnNewGame.addEventListener('click', () => {
                try {
                    if (typeof resetDevCheatsCreationUI === 'function') resetDevCheatsCreationUI()
                    if (typeof buildCharacterCreationOptions === 'function') buildCharacterCreationOptions()
                } catch (_) {}
                switchScreen('character')
            })
        }

        if (btnLoadGame) {
            btnLoadGame.addEventListener('click', () => {
                try { if (typeof openSaveManager === 'function') openSaveManager({ mode: 'load' }) } catch (_) {}
            })
        }

        if (btnSettingsMain) {
            btnSettingsMain.addEventListener('click', () => {
                try { if (typeof initSettingsFromState === 'function') initSettingsFromState() } catch (_) {}
                switchScreen('settings')
            })
        }

        if (btnChangelog) {
            btnChangelog.addEventListener('click', () => {
                try { if (typeof openChangelogModal === 'function') openChangelogModal() } catch (_) {}
            })
        }

        if (btnFeedback) {
            btnFeedback.addEventListener('click', () => {
                try { if (typeof openFeedbackModal === 'function') openFeedbackModal() } catch (_) {}
            })
        }

        // --- CHARACTER CREATION ---
        const btnRandomName = document.getElementById('btnRandomName')
        const nameInputEl = document.getElementById('inputName')

        // Keep this lightweight: the full character options UI is built by buildCharacterCreationOptions().
        if (btnRandomName && nameInputEl) {
            const RANDOM_NAMES = [
                'Aria',
                'Thorne',
                'Kael',
                'Lira',
                'Rowan',
                'Nyx',
                'Darius',
                'Mira',
                'Sylas',
                'Eira',
                'Corin',
                'Vale',
                'Seren',
                'Riven',
                'Kaida'
            ]

            btnRandomName.addEventListener('click', () => {
                try {
                    const idx = typeof randInt === 'function'
                        ? randInt(0, RANDOM_NAMES.length - 1, 'name.pick')
                        : Math.floor(Math.random() * RANDOM_NAMES.length)
                    nameInputEl.value = RANDOM_NAMES[idx]
                } catch (_) {
                    nameInputEl.value = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]
                }
            })
        }

        const btnStartGame = document.getElementById('btnStartGame')
        if (btnStartGame) {
            btnStartGame.addEventListener('click', () => {
                try {
                    if (typeof startNewGameFromCreation === 'function') startNewGameFromCreation()
                } catch (e) {
                    console.error(e)
                }
            })
        }

        const btnBackToMenu = document.getElementById('btnBackToMenu')
        if (btnBackToMenu) {
            btnBackToMenu.addEventListener('click', () => {
                try { if (typeof resetDevCheatsCreationUI === 'function') resetDevCheatsCreationUI() } catch (_) {}
                switchScreen('mainMenu')
            })
        }

        // --- SETTINGS SCREEN ---
        const btnSettingsBack = document.getElementById('btnSettingsBack')
        if (btnSettingsBack) {
            btnSettingsBack.addEventListener('click', () => {
                try { if (typeof applySettingsChanges === 'function') applySettingsChanges() } catch (_) {}
                switchScreen('mainMenu')
            })
        }

        const settingsDifficulty = document.getElementById('settingsDifficulty')
        if (settingsDifficulty) {
            settingsDifficulty.addEventListener('change', () => {
                try { if (typeof applySettingsChanges === 'function') applySettingsChanges() } catch (_) {}
            })
        }

        // Theme selector is storage-backed and independent of applySettingsChanges().
        const themeSelect = document.getElementById('themeSelect')
        if (themeSelect) {
            try {
                const savedTheme = typeof safeStorageGet === 'function' ? (safeStorageGet('pq-theme') || 'default') : 'default'
                themeSelect.value = savedTheme
            } catch (_) {}

            themeSelect.addEventListener('change', () => {
                try {
                    if (typeof setTheme === 'function') setTheme(themeSelect.value)
                } catch (_) {}
            })
        }

        // --- MODAL DISMISSAL WIRING ---
        try {
            const modalEl = document.getElementById('modal')
            if (modalEl && !(modalEl.dataset && modalEl.dataset.dismissWired)) {
                try { modalEl.dataset.dismissWired = '1' } catch (_) {}

                const closeBtn = document.getElementById('modalClose')
                if (closeBtn) closeBtn.addEventListener('click', closeModal)

                modalEl.addEventListener('click', (e) => {
                    if (e && e.target === modalEl) closeModal()
                })
            }
        } catch (_) {}

        try {
            const enemyModalEl = document.getElementById('enemyModal')
            if (enemyModalEl && !(enemyModalEl.dataset && enemyModalEl.dataset.dismissWired)) {
                try { enemyModalEl.dataset.dismissWired = '1' } catch (_) {}

                const closeBtn = document.getElementById('enemyModalClose')
                if (closeBtn) closeBtn.addEventListener('click', closeEnemyModal)

                enemyModalEl.addEventListener('click', (e) => {
                    if (e && e.target === enemyModalEl) closeEnemyModal()
                })
            }
        } catch (_) {}

        // --- IN-GAME MENU BUTTONS ---
        // Quest Journal pill (full quest tracker)
        try {
            const btnQuestJournalPill = document.getElementById('btnQuestJournalPill')
            if (btnQuestJournalPill && !(btnQuestJournalPill.dataset && btnQuestJournalPill.dataset.questJournalWired)) {
                try { btnQuestJournalPill.dataset.questJournalWired = '1' } catch (_) {}
                btnQuestJournalPill.addEventListener('click', () => {
                    try {
                        if (!quests) return
                        if (typeof quests.openQuestJournal === 'function') quests.openQuestJournal()
                        else if (typeof quests.openQuestJournalModal === 'function') quests.openQuestJournalModal()
                    } catch (_) {}
                })
            }
        } catch (_) {}

        // Menu button
        try {
            const btnGameMenu = document.getElementById('btnGameMenu')
            if (btnGameMenu && !(btnGameMenu.dataset && btnGameMenu.dataset.gameMenuWired)) {
                try { btnGameMenu.dataset.gameMenuWired = '1' } catch (_) {}
                btnGameMenu.addEventListener('click', () => {
                    try { if (typeof openPauseMenu === 'function') openPauseMenu() } catch (_) {}
                })
            }
        } catch (_) {}

        // --- HUD SWIPE: switch between player and companion view ---
        try {
            const hudTop = document.getElementById('hud-top')
            if (hudTop && !(hudTop.dataset && hudTop.dataset.hudSwipeWired)) {
                try { hudTop.dataset.hudSwipeWired = '1' } catch (_) {}

                let hudTouchStartX = null
                let hudTouchStartY = null

                hudTop.addEventListener('touchstart', (e) => {
                    if (!e || !e.touches || !e.touches.length) return
                    const t = e.touches[0]
                    hudTouchStartX = t.clientX
                    hudTouchStartY = t.clientY
                })

                hudTop.addEventListener('touchend', (e) => {
                    if (hudTouchStartX == null || hudTouchStartY == null) return
                    const t = e.changedTouches[0]
                    const dx = t.clientX - hudTouchStartX
                    const dy = t.clientY - hudTouchStartY
                    hudTouchStartX = null
                    hudTouchStartY = null

                    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
                        try { if (typeof toggleHudEntity === 'function') toggleHudEntity() } catch (_) {}
                    }
                })
            }
        } catch (_) {}

        // --- PRE-LOAD DIFFICULTY FROM SAVE ---
        try {
            const json = typeof safeStorageGet === 'function' ? safeStorageGet(SAVE_KEY) : null
            if (json && typeof migrateSaveData === 'function') {
                const st = getState ? getState() : null
                const data = migrateSaveData(JSON.parse(json))
                if (st && data && data.difficulty) st.difficulty = data.difficulty
            }
        } catch (e) {
            console.warn('No prior save or failed to read.')
        }

        // Initialize settings UI from state
        try { if (typeof initSettingsFromState === 'function') initSettingsFromState() } catch (_) {}
        try { if (typeof updateEnemyPanel === 'function') updateEnemyPanel() } catch (_) {}

        // --- ENEMY PANEL: open Enemy Sheet + swipe to switch targets ---
        try {
            const enemyPanel = document.getElementById('enemyPanel')
            if (enemyPanel && !(enemyPanel.dataset && enemyPanel.dataset.enemySheetWired)) {
                try { enemyPanel.dataset.enemySheetWired = '1' } catch (_) {}
                enemyPanel.setAttribute('role', 'button')
                enemyPanel.setAttribute('tabindex', '0')

                let lastSwipeAt = 0
                let touchStartX = 0
                let touchStartY = 0
                let touchMoved = false

                const open = () => {
                    const st = getState ? getState() : null
                    if (!st || !st.inCombat || !st.currentEnemy) return
                    if (typeof openEnemySheet === 'function') openEnemySheet()
                }

                const shouldSuppressClick = () => Date.now() - lastSwipeAt < 500

                enemyPanel.addEventListener('click', () => {
                    if (shouldSuppressClick()) {
                        try { enemyPanel.blur() } catch (_) {}
                        return
                    }
                    open()
                    try { enemyPanel.blur() } catch (_) {}
                })

                enemyPanel.addEventListener('keydown', (e) => {
                    if (!e) return
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        open()
                    }
                })

                enemyPanel.addEventListener('touchstart', (e) => {
                    if (!e || !e.touches || !e.touches.length) return
                    const t = e.touches[0]
                    touchStartX = t.clientX
                    touchStartY = t.clientY
                    touchMoved = false
                })

                enemyPanel.addEventListener('touchmove', (e) => {
                    if (!e || !e.touches || !e.touches.length) return
                    const t = e.touches[0]
                    const dx = t.clientX - touchStartX
                    const dy = t.clientY - touchStartY
                    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) touchMoved = true
                })

                enemyPanel.addEventListener('touchend', (e) => {
                    if (!touchMoved || !e || !e.changedTouches || !e.changedTouches.length) {
                        open()
                        return
                    }
                    const t = e.changedTouches[0]
                    const dx = t.clientX - touchStartX
                    const dy = t.clientY - touchStartY

                    // Horizontal swipe threshold (match engine)
                    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
                        lastSwipeAt = Date.now()
                        try {
                            if (dx < 0) {
                                if (typeof cycleTargetEnemy === 'function') cycleTargetEnemy(1)
                            } else {
                                if (typeof cycleTargetEnemy === 'function') cycleTargetEnemy(-1)
                            }
                            if (typeof updateEnemyPanel === 'function') updateEnemyPanel()
                        } catch (_) {}
                    } else {
                        open()
                    }
                })
            }
        } catch (_) {}

        // --- DEV HUD / SMOKE / CHEAT PILLS ---
        try {
            if (typeof syncSmokeTestsPillVisibility === 'function') syncSmokeTestsPillVisibility()
        } catch (_) {}

        try {
            const pill = document.getElementById('btnSmokeTestsPill')
            if (pill) {
                pill.addEventListener('click', () => {
                    try { if (typeof openSmokeTestsModal === 'function') openSmokeTestsModal() } catch (_) {}
                })
                try { if (typeof syncSmokeTestsPillVisibility === 'function') syncSmokeTestsPillVisibility() } catch (_) {}
            }
        } catch (_) {}

        try {
            const pill = document.getElementById('btnCheatPill')
            if (pill) {
                pill.addEventListener('click', () => {
                    try {
                        if (typeof openCheatMenu === 'function') openCheatMenu()
                    } catch (_) {}
                })
                try { if (typeof syncSmokeTestsPillVisibility === 'function') syncSmokeTestsPillVisibility() } catch (_) {}
            }
        } catch (_) {}

        // General UI niceties
        setupCollapsingPanels()
        initLogFilterChips(getState)
        initLogAutoScroll()
    })
}
