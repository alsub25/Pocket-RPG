// js/game/plugins/uiCommandsPlugin.js
// Maps input actions -> command bus -> game UI functions.

export function createUiCommandsPlugin({
    openPauseMenu = null,
    openCharacterSheet = null,
    openQuestJournal = null,
    toggleDiagnosticsOverlay = null,
    // Enemy Sheet is a special modal that doesn't live in engine.ui's modal stack.
    // We close it first on Escape so it behaves like other modals.
    isEnemySheetOpen = null,
    closeEnemySheet = null,
} = {}) {
    return {
        id: 'ew.uiCommands',
        requires: ['ew.uiRuntime'],

        start(engine) {
            if (!engine) return

            // Input actions -> command dispatch
            const onEsc = () => engine.dispatch({ type: 'UI_ESCAPE' })
            const onChar = () => engine.dispatch({ type: 'UI_OPEN_CHARACTER' })
            const onQuest = () => engine.dispatch({ type: 'UI_OPEN_QUEST_JOURNAL' })
            const onDiag = () => engine.dispatch({ type: 'UI_TOGGLE_DIAGNOSTICS' })

            engine.input.onAction('UI_ESCAPE', onEsc)
            engine.input.onAction('UI_OPEN_CHARACTER', onChar)
            engine.input.onAction('UI_OPEN_QUEST_JOURNAL', onQuest)
            engine.input.onAction('UI_TOGGLE_DIAGNOSTICS', onDiag)

            engine.__ewUiCommandInputHandlers = { onEsc, onChar, onQuest, onDiag }

            // Commands -> UI runtime calls
            engine.commands.use((ctx, next) => {
                const type = String(ctx && ctx.command && ctx.command.type ? ctx.command.type : '')

                if (type === 'UI_ESCAPE') {
                    try {
                        // Close top modal if one is open.
                        if (engine.ui && Array.isArray(engine.ui.stack) && engine.ui.stack.length > 0) {
                            engine.ui.close()
                            return
                        }
                    } catch (_) {}

                    try {
                        const open = typeof isEnemySheetOpen === 'function' ? !!isEnemySheetOpen() : false
                        if (open && typeof closeEnemySheet === 'function') {
                            closeEnemySheet()
                            return
                        }
                    } catch (_) {}

                    try { if (typeof openPauseMenu === 'function') openPauseMenu() } catch (_) {}
                    return
                }

                if (type === 'UI_OPEN_CHARACTER') {
                    try { if (typeof openCharacterSheet === 'function') openCharacterSheet() } catch (_) {}
                    return
                }

                if (type === 'UI_OPEN_QUEST_JOURNAL') {
                    try { if (typeof openQuestJournal === 'function') openQuestJournal() } catch (_) {}
                    return
                }

                if (type === 'UI_TOGGLE_DIAGNOSTICS') {
                    try {
                        if (typeof toggleDiagnosticsOverlay === 'function') {
                            toggleDiagnosticsOverlay()
                            return
                        }

                        const diag = engine.getService('diagnostics')
                        if (diag && typeof diag.openSmokeTestsModal === 'function') {
                            diag.openSmokeTestsModal()
                        }
                    } catch (_) {}
                    return
                }

                return next()
            })
        },

        stop(engine) {
            try {
                const h = engine.__ewUiCommandInputHandlers
                if (h && h.onEsc) engine.input.offAction('UI_ESCAPE', h.onEsc)
                if (h && h.onChar) engine.input.offAction('UI_OPEN_CHARACTER', h.onChar)
                if (h && h.onQuest) engine.input.offAction('UI_OPEN_QUEST_JOURNAL', h.onQuest)
                if (h && h.onDiag) engine.input.offAction('UI_TOGGLE_DIAGNOSTICS', h.onDiag)
            } catch (_) {}
            try { delete engine.__ewUiCommandInputHandlers } catch (_) {}
        }
    }
}
