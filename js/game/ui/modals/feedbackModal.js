/**
 * Feedback Modal
 * User feedback and bug reporting interface
 */

// GitHub configuration
const GITHUB_REPO_URL = 'https://github.com/alsub25/Emberwood-The-Blackbark-Oath'
const GITHUB_ISSUE_TITLE_MAX_LENGTH = 60
const GITHUB_URL_MAX_LENGTH = 8190

function isRunningOnGitHubPages() {
    if (typeof window === 'undefined') return false
    const hostname = window.location.hostname
    return hostname.endsWith('.github.io')
}

export function createFeedbackModal(deps) {
    const {
        openModal,
        state,
        GAME_PATCH,
        GAME_PATCH_NAME,
        SAVE_SCHEMA,
        getLastCrashReport,
        copyFeedbackToClipboard,
        safeStorageGet,
        safeStorageRemove,
        copyBugReportBundleToClipboard,
        _STORAGE_DIAG_KEY_LAST_CRASH
    } = deps

    function buildFeedbackPayload(type, text) {
        const lines = []
        lines.push('Emberwood: The Blackbark Oath RPG Feedback')
        lines.push('-------------------------')
        lines.push(`Type: ${type}`)
        lines.push('')

        lines.push('Build:')
        lines.push(`- Patch: ${GAME_PATCH}${GAME_PATCH_NAME ? ' - ' + GAME_PATCH_NAME : ''}`)
        lines.push(`- Save Schema: ${SAVE_SCHEMA}`)
        lines.push('')

        if (text) {
            lines.push('Description:')
            lines.push(text)
            lines.push('')
        }

        if (state && state.player) {
            const p = state.player
            lines.push('Game Context:')
            lines.push(`- Player: ${p.name} (${p.classId})`)
            lines.push(`- Level: ${p.level} (XP: ${p.xp}/${p.nextLevelXp})`)
            lines.push(`- Gold: ${p.gold}`)
            lines.push(`- Area: ${state.area}`)
            if (state.inCombat && state.currentEnemy) {
                lines.push(`- In Combat: YES (Enemy: ${state.currentEnemy.name})`)
            } else {
                lines.push(`- In Combat: NO`)
            }
            lines.push('')
        }

        const crashReport = getLastCrashReport()
        if (crashReport) {
            lines.push('Last Crash:')
            lines.push(`- Kind: ${crashReport.kind}`)
            lines.push(`- Time: ${new Date(crashReport.time).toISOString()}`)
            lines.push(`- Message: ${crashReport.message}`)
            if (crashReport.stack) {
                lines.push('- Stack:')
                lines.push(String(crashReport.stack))
            }
            lines.push('')
        }

        if (state && Array.isArray(state.log) && state.log.length) {
            const tail = state.log.slice(-30)
            lines.push('Recent Log (last 30):')
            tail.forEach((e) => {
                const tag = e && e.type ? e.type : 'normal'
                const msg = e && e.text ? e.text : ''
                lines.push(`- [${tag}] ${msg}`)
            })
            lines.push('')
        }

        lines.push('Client Info:')
        lines.push(`- Time: ${new Date().toISOString()}`)
        lines.push(`- User Agent: ${navigator.userAgent}`)
        lines.push('')

        return lines.join('\n')
    }

    function handleFeedbackCopy() {
        const typeEl = document.getElementById('feedbackType')
        const textEl = document.getElementById('feedbackText')
        const status = document.getElementById('feedbackStatus')
        if (!typeEl || !textEl || !status) return

        const type = typeEl.value
        const text = (textEl.value || '').trim()

        const payload = buildFeedbackPayload(type, text)

        copyFeedbackToClipboard(payload)
            .then(() => (status.textContent = '[check] Copied! Paste this into your tracker.'))
            .catch(() => (status.textContent = '? Could not access clipboard.'))
    }

    function handleCreateGitHubIssue() {
        const typeEl = document.getElementById('feedbackType')
        const textEl = document.getElementById('feedbackText')
        const status = document.getElementById('feedbackStatus')
        if (!typeEl || !textEl || !status) return

        const type = typeEl.value
        const text = (textEl.value || '').trim()

        if (!text) {
            status.textContent = '?? Please provide some details about your feedback.'
            return
        }

        // Build issue title based on type
        const typeLabels = {
            'ui': '? UI Issue',
            'bug': '? Bug Report',
            'balance': '?? Balance Issue',
            'suggestion': '? Suggestion',
            'other': '? Feedback'
        }
        const issueTitle = `${typeLabels[type] || 'Feedback'}: ${text.substring(0, GITHUB_ISSUE_TITLE_MAX_LENGTH)}${text.length > GITHUB_ISSUE_TITLE_MAX_LENGTH ? '...' : ''}`

        // Build issue body with all context
        const payload = buildFeedbackPayload(type, text)
        
        // Encode for URL
        const githubUrl = `${GITHUB_REPO_URL}/issues/new?` +
            `title=${encodeURIComponent(issueTitle)}&` +
            `body=${encodeURIComponent(payload)}`

        // Validate URL length (conservative browser limit)
        if (githubUrl.length > GITHUB_URL_MAX_LENGTH) {
            status.textContent = '?? Feedback too long for URL. Please use "Copy to Clipboard" instead.'
            return
        }

        // Open in new tab
        try {
            window.open(githubUrl, '_blank')
            status.textContent = '[check] Opening GitHub issue page...'
        } catch (error) {
            status.textContent = '? Could not open GitHub. Please copy feedback manually.'
        }
    }

    return function openFeedbackModal() {
        const isGitHubPages = isRunningOnGitHubPages()
        
        // Build GitHub issue button HTML only if on GitHub Pages
        const githubButtonHtml = isGitHubPages ? `
        <button class="btn primary small" id="btnCreateGitHubIssue">
          ? Create GitHub Issue
        </button>
        ` : ''
        
        // Adjust subtitle based on where the game is running
        const subtitle = isGitHubPages 
            ? 'Help improve Emberwood: The Blackbark Oath by sending structured feedback. You can submit directly to GitHub or copy the text manually.'
            : 'Help improve Emberwood: The Blackbark Oath by sending structured feedback. Copy this text and paste it wherever you\'re tracking issues.'
        
        const bodyHtml = `
        <div class="modal-subtitle">
          ${subtitle}
        </div>

        <div class="field">
          <label for="feedbackType">Type</label>
          <select id="feedbackType">
            <option value="ui">UI issue</option>
            <option value="bug">Bug</option>
            <option value="balance">Balance issue</option>
            <option value="suggestion">Suggestion</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div class="field">
          <label for="feedbackText">Details</label>
          <textarea id="feedbackText"
            placeholder="What happened? What did you expect? Steps to reproduce?"
          ></textarea>
        </div>

        ${githubButtonHtml}

        <button class="btn ${isGitHubPages ? 'small outline' : 'primary small'}" id="btnFeedbackCopy" style="${isGitHubPages ? 'margin-top:8px;' : ''}">
          Copy Feedback To Clipboard
        </button>

        <button class="btn small outline" id="btnBugBundleCopy" style="margin-top:8px;">
          Copy Bug Report Bundle (JSON)
        </button>

        <button class="btn small outline" id="btnClearCrash" style="margin-top:8px;">
          Clear Crash Report
        </button>
        <p class="hint" id="feedbackStatus"></p>
      `

        openModal('Feedback / Bug Report', (bodyEl) => {
            bodyEl.innerHTML = bodyHtml

            const btnCreateIssue = document.getElementById('btnCreateGitHubIssue')
            if (btnCreateIssue) {
                btnCreateIssue.addEventListener('click', handleCreateGitHubIssue)
            }

            const btnCopy = document.getElementById('btnFeedbackCopy')
            if (btnCopy) {
                btnCopy.addEventListener('click', handleFeedbackCopy)
            }

            const btnBundle = document.getElementById('btnBugBundleCopy')
            if (btnBundle) {
                btnBundle.addEventListener('click', () => {
                    const status = document.getElementById('feedbackStatus')
                    copyBugReportBundleToClipboard()
                        .then(() => status && (status.textContent = '[check] Copied JSON bundle!'))
                        .catch(() => status && (status.textContent = '? Could not access clipboard.'))
                })
            }

            const btnClearCrash = document.getElementById('btnClearCrash')
            if (btnClearCrash) {
                const status = document.getElementById('feedbackStatus')
                const existing = safeStorageGet(_STORAGE_DIAG_KEY_LAST_CRASH, null)
                btnClearCrash.disabled = !existing

                btnClearCrash.addEventListener('click', () => {
                    safeStorageRemove(_STORAGE_DIAG_KEY_LAST_CRASH)
                    if (status) status.textContent = '? Cleared last crash report.'
                    btnClearCrash.disabled = true
                })
            }
        })
    }
}
