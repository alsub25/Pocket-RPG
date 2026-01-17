// js/boot/userAcceptance.js
// Patch 1.2.72: early boot diagnostics + acceptance gate.

import { GAME_PATCH } from '../game/systems/version.js';
import { safeStorageGet, safeStorageSet, safeStorageRemove } from './lib/safeStorage.js';

/* --------------------------------------------------------------------------
   Boot diagnostics: capture early load errors that prevent the game from
   launching, and render a screenshot-friendly overlay.
   -------------------------------------------------------------------------- */

function _pqNowIso() {
  try { return new Date().toISOString(); } catch (_) { return String(Date.now()); }
}

export function installBootDiagnostics() {
  if (typeof window === 'undefined') return
  if (window.PQ_BOOT_DIAG && window.PQ_BOOT_DIAG.__installed) return

  const diag = (window.PQ_BOOT_DIAG = window.PQ_BOOT_DIAG || {})
  diag.__installed = true
  diag.startedAt = diag.startedAt || _pqNowIso()
  diag.errors = Array.isArray(diag.errors) ? diag.errors : []

  // Boot overlay is meant for *launch-blocking* issues.
  // We only auto-show it during a short "boot window" (or until bootstrap
  // marks the boot as successful).
  if (typeof diag.bootOk !== 'boolean') diag.bootOk = false
  if (typeof diag.bootWindowEndsAt !== 'number') diag.bootWindowEndsAt = Date.now() + 8000
  diag._overlayShown = !!diag._overlayShown

  diag.markBootOk = () => {
    try {
      diag.bootOk = true
      diag.bootWindowEndsAt = 0
    } catch (_) {}
  }

  const maybeAutoShowOverlay = () => {
    try {
      if (diag._overlayShown) return
      if (diag.bootOk) return
      if (diag.bootWindowEndsAt && Date.now() > diag.bootWindowEndsAt) return
      diag._overlayShown = true
      // Yield to let the current error flush into the report first.
      setTimeout(() => {
        try { if (diag.renderOverlay) diag.renderOverlay() } catch (_) {}
      }, 0)
    } catch (_) {}
  }

  const push = (kind, payload) => {
    try {
      diag.errors.push({
        t: _pqNowIso(),
        kind,
        ...payload
      })
      if (diag.errors.length > 80) diag.errors.splice(0, diag.errors.length - 80)

      try {
        localStorage.setItem(
          'pq-last-boot-errors',
          JSON.stringify({
            startedAt: diag.startedAt,
            url: location.href,
            ua: navigator.userAgent,
            errors: diag.errors
          })
        )
      } catch (_) {}
    } catch (_) {}

    // If something goes wrong during boot, show the overlay automatically.
    // (Runtime gameplay errors should not pop overlays in the player's face.)
    if (kind === 'error' || kind === 'unhandledrejection' || kind === 'scriptLoadError' || kind === 'preflight') {
      maybeAutoShowOverlay()
    }
  }

  window.addEventListener('error', (ev) => {
    push('error', {
      message: String(ev.message || 'Unknown error'),
      filename: ev.filename || '',
      lineno: ev.lineno || 0,
      colno: ev.colno || 0
    })
  })

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev && ev.reason
    push('unhandledrejection', {
      message: reason && reason.message ? String(reason.message) : String(reason),
      stack: reason && reason.stack ? String(reason.stack) : ''
    })
  })

  // Enhanced system diagnostics
  diag.getSystemInfo = () => {
    const info = {
      timestamp: _pqNowIso(),
      url: typeof location !== 'undefined' ? location.href : '',
      protocol: typeof location !== 'undefined' ? location.protocol : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      platform: typeof navigator !== 'undefined' ? navigator.platform : '',
      language: typeof navigator !== 'undefined' ? navigator.language : '',
      cookiesEnabled: typeof navigator !== 'undefined' ? navigator.cookieEnabled : false,
      onLine: typeof navigator !== 'undefined' ? navigator.onLine : false,
      screenSize: typeof window !== 'undefined' && window.screen ? `${window.screen.width}x${window.screen.height}` : '',
      viewportSize: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
    }

    // Browser detection
    const ua = info.userAgent.toLowerCase()
    if (ua.includes('chrome') && !ua.includes('edge')) info.browser = 'Chrome'
    else if (ua.includes('safari') && !ua.includes('chrome')) info.browser = 'Safari'
    else if (ua.includes('firefox')) info.browser = 'Firefox'
    else if (ua.includes('edge')) info.browser = 'Edge'
    else info.browser = 'Unknown'

    // Check for critical features
    info.features = {
      localStorage: (() => {
        try {
          const test = '__test__'
          localStorage.setItem(test, test)
          localStorage.removeItem(test)
          return 'Available'
        } catch (e) {
          return `Unavailable: ${e.message || 'Unknown error'}`
        }
      })(),
      esModules: typeof import === 'function' ? 'Supported' : 'Not supported',
      fetch: typeof fetch === 'function' ? 'Available' : 'Not available',
      promises: typeof Promise !== 'undefined' ? 'Supported' : 'Not supported',
      performance: typeof performance !== 'undefined' && typeof performance.now === 'function' ? 'Available' : 'Not available',
    }

    return info
  }

  // Categorize errors by type
  diag.categorizeErrors = () => {
    const categories = {
      storage: [],
      network: [],
      module: [],
      script: [],
      runtime: [],
      other: []
    }

    diag.errors.forEach(err => {
      const msg = (err.message || '').toLowerCase()
      const kind = (err.kind || '').toLowerCase()

      if (msg.includes('storage') || msg.includes('quota') || msg.includes('localstorage')) {
        categories.storage.push(err)
      } else if (msg.includes('fetch') || msg.includes('network') || msg.includes('cors') || kind === 'preflight') {
        categories.network.push(err)
      } else if (msg.includes('module') || msg.includes('import') || kind === 'scriptloaderror') {
        categories.module.push(err)
      } else if (kind === 'error' && (err.filename || '').endsWith('.js')) {
        categories.script.push(err)
      } else if (kind === 'unhandledrejection' || kind === 'error') {
        categories.runtime.push(err)
      } else {
        categories.other.push(err)
      }
    })

    return categories
  }

  // Provide troubleshooting suggestions based on errors
  diag.getSuggestions = () => {
    const suggestions = []
    const systemInfo = diag.getSystemInfo()
    const categories = diag.categorizeErrors()

    // Storage issues
    if (categories.storage.length > 0 || systemInfo.features.localStorage.includes('Unavailable')) {
      suggestions.push({
        category: 'Storage',
        severity: 'critical',
        problem: 'Browser storage is not available or has reached its limit',
        solutions: [
          'Exit private/incognito browsing mode',
          'Check browser settings to ensure cookies and site data are allowed',
          'Clear some browser data to free up storage quota',
          'Try a different browser'
        ]
      })
    }

    // File protocol issues
    if (systemInfo.protocol === 'file:') {
      suggestions.push({
        category: 'Protocol',
        severity: 'warning',
        problem: 'Running from file:// protocol can cause module loading issues',
        solutions: [
          'Use a local web server (run "python -m http.server 8000" from the game directory)',
          'Use npx serve or similar HTTP server',
          'Deploy to a web host'
        ]
      })
    }

    // Network/CORS issues
    if (categories.network.length > 0) {
      suggestions.push({
        category: 'Network',
        severity: 'critical',
        problem: 'Failed to load required game files',
        solutions: [
          'Check your internet connection',
          'Disable browser extensions that might block requests',
          'Try clearing browser cache and reloading',
          'Check if a firewall or security software is blocking the site'
        ]
      })
    }

    // Module loading issues
    if (categories.module.length > 0 || systemInfo.features.esModules !== 'Supported') {
      suggestions.push({
        category: 'Browser Compatibility',
        severity: 'critical',
        problem: 'Your browser does not support ES modules or failed to load them',
        solutions: [
          'Update your browser to the latest version',
          'Use a modern browser (Chrome 87+, Firefox 78+, Safari 14+)',
          'Check if JavaScript is enabled in browser settings'
        ]
      })
    }

    // Missing or problematic files (from preflight)
    const problematicFiles = diag.errors.filter(e => e.kind === 'preflight' && (e.missing?.length > 0 || e.bad?.length > 0))
    if (problematicFiles.length > 0) {
      suggestions.push({
        category: 'Missing Files',
        severity: 'critical',
        problem: 'Some game files are missing or could not be loaded',
        solutions: [
          'Refresh the page (Ctrl+R or Cmd+R)',
          'Clear browser cache and reload',
          'Check if the deployment is complete and all files are present',
          'Report this issue with a screenshot to the developer'
        ]
      })
    }

    // Generic runtime errors
    if (categories.runtime.length > 0 && suggestions.length === 0) {
      suggestions.push({
        category: 'Runtime Error',
        severity: 'critical',
        problem: 'An unexpected error occurred while starting the game',
        solutions: [
          'Refresh the page and try again',
          'Clear browser cache and cookies',
          'Try using an incognito/private browsing window',
          'Report this issue with a screenshot to the developer'
        ]
      })
    }

    return suggestions
  }

  diag.buildReport = () => ({
    startedAt: diag.startedAt,
    url: (typeof location !== 'undefined' ? location.href : ''),
    ua: (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    errors: diag.errors,
    systemInfo: diag.getSystemInfo(),
    categorizedErrors: diag.categorizeErrors(),
    suggestions: diag.getSuggestions()
  })

  diag.renderOverlay = () => {
    try {
      const id = 'pq-boot-diag-overlay'
      if (document.getElementById(id)) return

      const report = diag.buildReport()
      const systemInfo = report.systemInfo
      const categories = report.categorizedErrors
      const suggestions = report.suggestions

      const overlay = document.createElement('div')
      overlay.id = id
      overlay.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 999999;
        background: rgba(0,0,0,0.95);
        color: #fff;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        overflow: auto;
        padding: 20px;
      `

      // Header
      const header = document.createElement('div')
      header.style.cssText = 'margin-bottom: 20px; border-bottom: 2px solid rgba(255,255,255,0.2); padding-bottom: 16px;'
      
      const title = document.createElement('div')
      title.style.cssText = 'font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #ff6b6b;'
      title.textContent = `🔧 Boot Diagnostics`
      header.appendChild(title)

      const subtitle = document.createElement('div')
      subtitle.style.cssText = 'font-size: 14px; color: rgba(255,255,255,0.8); margin-bottom: 4px;'
      subtitle.textContent = `Game Patch: ${GAME_PATCH}`
      header.appendChild(subtitle)

      const helpText = document.createElement('div')
      helpText.style.cssText = 'font-size: 12px; color: rgba(255,255,255,0.6);'
      helpText.textContent = 'The game encountered errors during startup. Screenshot this page or use "Copy Report" to share with support.'
      header.appendChild(helpText)

      overlay.appendChild(header)

      // Action buttons
      const actions = document.createElement('div')
      actions.style.cssText = 'display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap;'

      const mkBtn = (label, variant = 'default') => {
        const b = document.createElement('button')
        b.textContent = label
        const bgColor = variant === 'primary' ? '#4CAF50' : variant === 'danger' ? '#f44336' : '#555'
        b.style.cssText = `
          padding: 10px 16px;
          cursor: pointer;
          background: ${bgColor};
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          transition: opacity 0.2s;
        `
        b.onmouseover = () => b.style.opacity = '0.8'
        b.onmouseout = () => b.style.opacity = '1'
        return b
      }

      const btnCopy = mkBtn('📋 Copy Report', 'primary')
      btnCopy.addEventListener('click', async () => {
        try {
          const payload = JSON.stringify(report, null, 2)
          await navigator.clipboard.writeText(payload)
          btnCopy.textContent = '✅ Copied!'
          setTimeout(() => (btnCopy.textContent = '📋 Copy Report'), 1500)
        } catch (_) {
          btnCopy.textContent = '❌ Copy failed'
          setTimeout(() => (btnCopy.textContent = '📋 Copy Report'), 1500)
        }
      })

      const btnClear = mkBtn('🗑️ Clear & Close', 'danger')
      btnClear.addEventListener('click', () => {
        diag.errors = []
        try { localStorage.removeItem('pq-last-boot-errors') } catch (_) {}
        overlay.remove()
        // Reset flag so overlay can be shown again if needed
        diag._overlayShown = false
      })

      const btnClose = mkBtn('✖️ Close')
      btnClose.addEventListener('click', () => {
        overlay.remove()
        // Reset flag so overlay can be shown again if needed
        diag._overlayShown = false
      })

      const btnRefresh = mkBtn('🔄 Refresh Page')
      btnRefresh.addEventListener('click', () => location.reload())

      actions.appendChild(btnCopy)
      actions.appendChild(btnRefresh)
      actions.appendChild(btnClear)
      actions.appendChild(btnClose)
      overlay.appendChild(actions)

      // Troubleshooting section (if suggestions exist)
      if (suggestions.length > 0) {
        const troubleshootSection = document.createElement('div')
        troubleshootSection.style.cssText = 'margin-bottom: 20px; background: rgba(255,107,107,0.15); border-left: 4px solid #ff6b6b; padding: 16px; border-radius: 6px;'
        
        const troubleshootTitle = document.createElement('div')
        troubleshootTitle.style.cssText = 'font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #ff6b6b;'
        troubleshootTitle.textContent = '⚠️ Issues Detected & Solutions'
        troubleshootSection.appendChild(troubleshootTitle)

        suggestions.forEach(suggestion => {
          const item = document.createElement('div')
          item.style.cssText = 'margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1);'
          
          const severityColor = suggestion.severity === 'critical' ? '#ff6b6b' : suggestion.severity === 'warning' ? '#ffa500' : '#4CAF50'
          const severityIcon = suggestion.severity === 'critical' ? '🔴' : suggestion.severity === 'warning' ? '⚠️' : 'ℹ️'
          
          const header = document.createElement('div')
          header.style.cssText = `font-weight: 700; margin-bottom: 6px; color: ${severityColor}; font-size: 14px;`
          header.textContent = `${severityIcon} ${suggestion.category}: ${suggestion.problem}`
          item.appendChild(header)

          const solutionsList = document.createElement('ul')
          solutionsList.style.cssText = 'margin: 8px 0 0 20px; padding: 0;'
          suggestion.solutions.forEach(solution => {
            const li = document.createElement('li')
            li.style.cssText = 'margin-bottom: 4px; font-size: 13px; color: rgba(255,255,255,0.9);'
            li.textContent = solution
            solutionsList.appendChild(li)
          })
          item.appendChild(solutionsList)

          troubleshootSection.appendChild(item)
        })

        overlay.appendChild(troubleshootSection)
      }

      // System Information
      const sysInfoSection = document.createElement('div')
      sysInfoSection.style.cssText = 'margin-bottom: 20px; background: rgba(76,175,80,0.15); border-left: 4px solid #4CAF50; padding: 16px; border-radius: 6px;'
      
      const sysInfoTitle = document.createElement('div')
      sysInfoTitle.style.cssText = 'font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #4CAF50;'
      sysInfoTitle.textContent = '💻 System Information'
      sysInfoSection.appendChild(sysInfoTitle)

      const sysInfoGrid = document.createElement('div')
      sysInfoGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; font-size: 13px;'
      
      const addSysInfoItem = (label, value, status) => {
        const item = document.createElement('div')
        item.style.cssText = 'display: flex; justify-content: space-between; padding: 6px; background: rgba(0,0,0,0.3); border-radius: 4px;'
        
        const labelEl = document.createElement('span')
        labelEl.style.cssText = 'color: rgba(255,255,255,0.7); font-weight: 600;'
        labelEl.textContent = label + ':'
        
        const valueEl = document.createElement('span')
        const statusColor = status === 'ok' ? '#4CAF50' : status === 'error' ? '#ff6b6b' : 'rgba(255,255,255,0.9)'
        valueEl.style.cssText = `color: ${statusColor}; font-family: monospace;`
        valueEl.textContent = value
        
        item.appendChild(labelEl)
        item.appendChild(valueEl)
        sysInfoGrid.appendChild(item)
      }

      addSysInfoItem('Browser', systemInfo.browser || 'Unknown', 'info')
      addSysInfoItem('Platform', systemInfo.platform || 'Unknown', 'info')
      addSysInfoItem('Protocol', systemInfo.protocol || 'Unknown', systemInfo.protocol === 'file:' ? 'error' : 'ok')
      addSysInfoItem('Online', systemInfo.onLine ? 'Yes' : 'No', systemInfo.onLine ? 'ok' : 'error')
      addSysInfoItem('Viewport', systemInfo.viewportSize || 'Unknown', 'info')
      const localStorageAvailable = systemInfo.features.localStorage.includes('Available')
      addSysInfoItem('LocalStorage', localStorageAvailable ? 'Available' : 'Unavailable', localStorageAvailable ? 'ok' : 'error')
      addSysInfoItem('ES Modules', systemInfo.features.esModules, systemInfo.features.esModules === 'Supported' ? 'ok' : 'error')
      addSysInfoItem('Fetch API', systemInfo.features.fetch, systemInfo.features.fetch === 'Available' ? 'ok' : 'error')

      sysInfoSection.appendChild(sysInfoGrid)
      overlay.appendChild(sysInfoSection)

      // Error Details (categorized)
      const totalErrors = diag.errors.length
      if (totalErrors > 0) {
        const errorSection = document.createElement('div')
        errorSection.style.cssText = 'margin-bottom: 20px;'
        
        const errorTitle = document.createElement('div')
        errorTitle.style.cssText = 'font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #ffa500;'
        errorTitle.textContent = `⚡ Error Details (${totalErrors} total)`
        errorSection.appendChild(errorTitle)

        const renderErrorCategory = (categoryName, errors, icon, color) => {
          if (errors.length === 0) return

          const categoryDiv = document.createElement('details')
          categoryDiv.open = true
          categoryDiv.style.cssText = `margin-bottom: 12px; background: rgba(${color},0.15); border-left: 4px solid rgb(${color}); padding: 12px; border-radius: 6px;`

          const summary = document.createElement('summary')
          summary.style.cssText = `cursor: pointer; font-weight: 700; margin-bottom: 8px; color: rgb(${color}); font-size: 14px;`
          summary.textContent = `${icon} ${categoryName} (${errors.length})`
          categoryDiv.appendChild(summary)

          errors.forEach((err, idx) => {
            const errDiv = document.createElement('div')
            errDiv.style.cssText = 'margin-bottom: 8px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 4px; font-size: 12px;'
            
            const time = document.createElement('div')
            time.style.cssText = 'color: rgba(255,255,255,0.5); font-size: 11px; margin-bottom: 4px;'
            time.textContent = `[${err.t || 'Unknown time'}] ${err.kind || 'error'}`
            errDiv.appendChild(time)

            const msg = document.createElement('div')
            msg.style.cssText = 'color: rgba(255,255,255,0.9); margin-bottom: 4px; word-break: break-word;'
            msg.textContent = err.message || 'No message'
            errDiv.appendChild(msg)

            if (err.filename) {
              const file = document.createElement('div')
              file.style.cssText = 'color: rgba(255,255,255,0.6); font-size: 11px; font-family: monospace;'
              file.textContent = `📄 ${err.filename}:${err.lineno || '?'}:${err.colno || '?'}`
              errDiv.appendChild(file)
            }

            if (err.stack) {
              const stack = document.createElement('details')
              stack.style.cssText = 'margin-top: 6px;'
              const stackSummary = document.createElement('summary')
              stackSummary.style.cssText = 'cursor: pointer; color: rgba(255,255,255,0.6); font-size: 11px;'
              stackSummary.textContent = 'Stack trace'
              stack.appendChild(stackSummary)
              const stackPre = document.createElement('pre')
              stackPre.style.cssText = 'margin-top: 4px; font-size: 10px; color: rgba(255,255,255,0.5); overflow-x: auto;'
              stackPre.textContent = err.stack
              stack.appendChild(stackPre)
              errDiv.appendChild(stack)
            }

            if (err.missing && err.missing.length > 0) {
              const missing = document.createElement('div')
              missing.style.cssText = 'margin-top: 6px; color: #ff6b6b; font-size: 11px;'
              missing.textContent = `Missing files: ${err.missing.map(m => m.url).join(', ')}`
              errDiv.appendChild(missing)
            }

            categoryDiv.appendChild(errDiv)
          })

          errorSection.appendChild(categoryDiv)
        }

        renderErrorCategory('Storage Errors', categories.storage, '💾', '255,152,0')
        renderErrorCategory('Network Errors', categories.network, '🌐', '255,107,107')
        renderErrorCategory('Module Errors', categories.module, '📦', '156,39,176')
        renderErrorCategory('Script Errors', categories.script, '📜', '255,193,7')
        renderErrorCategory('Runtime Errors', categories.runtime, '⚡', '244,67,54')
        renderErrorCategory('Other Errors', categories.other, '❓', '158,158,158')

        overlay.appendChild(errorSection)
      }

      // Raw JSON (collapsible)
      const jsonSection = document.createElement('details')
      jsonSection.style.cssText = 'margin-top: 20px; background: rgba(0,0,0,0.5); padding: 12px; border-radius: 6px;'
      
      const jsonSummary = document.createElement('summary')
      jsonSummary.style.cssText = 'cursor: pointer; font-weight: 700; color: rgba(255,255,255,0.8); margin-bottom: 8px;'
      jsonSummary.textContent = '📊 Raw JSON Report (for developers)'
      jsonSection.appendChild(jsonSummary)

      const pre = document.createElement('pre')
      pre.style.cssText = 'white-space: pre-wrap; font-size: 11px; color: rgba(255,255,255,0.7); overflow-x: auto; margin: 0;'
      pre.textContent = JSON.stringify(report, null, 2)
      jsonSection.appendChild(pre)

      overlay.appendChild(jsonSection)

      document.body.appendChild(overlay)
    } catch (e) {
      console.error('Failed to render boot diagnostics overlay:', e)
    }
  }

  // Convenience: expose for quick console access.
  try {
    window.PQ_BOOT_DIAG.show = diag.renderOverlay
    window.PQ_BOOT_DIAG.report = diag.buildReport
  } catch (_) {}
}

// Install as early as possible.
installBootDiagnostics()



/* ==========================================================================
   userAcceptance.js  (2 SEPARATE PANELS + SCROLL-TO-BOTTOM UNLOCK PER PANEL)
   --------------------------------------------------------------------------
   - Blocks play until the user accepts BOTH:
       (1) User Acceptance Terms
       (2) Legal Notice
   - Each panel has its OWN scroll box + its OWN checkbox directly under it.
   - Each checkbox is DISABLED until its panel is scrolled to the bottom.

   Reuses existing #modal UI.

   Requires existing DOM nodes:
     #modal, #modalTitle, #modalBody, #modalClose

   Buttons it gates:
     #btnNewGame, #btnLoadGame, #btnStartGame

   Install:
     <script type="module" src="userAcceptance.js"></script>
     <script type="module" src="bootstrap.js"></script>

   To force re-accept after changing terms:
     - bump ACCEPTANCE_VERSION
   ========================================================================== */

const ACCEPTANCE_STORAGE_KEY = "pq_user_acceptance_v5";
const ACCEPTANCE_VERSION = "5.0.0";

const GATED_BUTTON_IDS = ["btnNewGame", "btnLoadGame", "btnStartGame"];

let acceptanceLockActive = false;
let installed = false;

function safeJsonParse(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function readAcceptanceRecord() {
  try {
    const raw = safeStorageGet(ACCEPTANCE_STORAGE_KEY);
    if (!raw) return null;
    return safeJsonParse(raw);
  } catch {
    return null;
  }
}

function writeAcceptanceRecord() {
  const rec = {
    version: ACCEPTANCE_VERSION,
    acceptedAt: Date.now(),
    acceptedTerms: true,
    acceptedLegal: true
  };
  try {
    safeStorageSet(ACCEPTANCE_STORAGE_KEY, JSON.stringify(rec));
  } catch {
    // If storage fails, acceptance is session-only after clicking Accept.
  }
}

export function hasUserAccepted() {
  const rec = readAcceptanceRecord();
  return !!(
    rec &&
    rec.version === ACCEPTANCE_VERSION &&
    typeof rec.acceptedAt === "number" &&
    rec.acceptedTerms === true &&
    rec.acceptedLegal === true
  );
}

export function resetUserAcceptance() {
  safeStorageRemove(ACCEPTANCE_STORAGE_KEY);
}

export function initUserAcceptanceGate(options = {}) {
  if (installed) return;
  installed = true;

  const {
    title = "User Acceptance Required",
    termsPanelTitle = "User Acceptance Terms",
    legalPanelTitle = "Legal Notice",
    checkbox1Label = "I have read and agree to the User Acceptance Terms.",
    checkbox2Label = "I have read and agree to the Legal Notice.",
    acceptButtonText = "I Agree — Continue",
    declineButtonText = "Exit"
  } = options;

  document.addEventListener("DOMContentLoaded", () => {
    installGameplayGateCapture();
    installModalLockCaptureHandlers();

    if (!hasUserAccepted()) {
      showAcceptanceModal({
        title,
        termsPanelTitle,
        legalPanelTitle,
        checkbox1Label,
        checkbox2Label,
        acceptButtonText,
        declineButtonText
      });
    }
  });
}

function getModalEls() {
  const modalEl = document.getElementById("modal");
  const modalTitleEl = document.getElementById("modalTitle");
  const modalBodyEl = document.getElementById("modalBody");
  const modalCloseEl = document.getElementById("modalClose");
  if (!modalEl || !modalTitleEl || !modalBodyEl || !modalCloseEl) return null;
  return { modalEl, modalTitleEl, modalBodyEl, modalCloseEl };
}

function openModalLikeGameDoes(title, builderFn) {
  const els = getModalEls();
  if (!els) return;

  const { modalEl, modalTitleEl, modalBodyEl } = els;

  // Claim and lock the modal so other UI code (bootstrap/game) can't dismiss it.
  try {
    modalEl.dataset.owner = "acceptance";
    modalEl.dataset.lock = "1";
  } catch (_) {}

  modalTitleEl.textContent = title;

  // cleanup any leftovers your game may append
  const strayFooters = modalEl.querySelectorAll(".tavern-footer-actions");
  strayFooters.forEach((el) => el.remove());

  modalBodyEl.className = "";
  modalBodyEl.innerHTML = "";
  builderFn(modalBodyEl);

  modalEl.classList.remove("hidden");
}

function closeModalLikeGameDoes() {
  const els = getModalEls();
  if (!els) return;
  const { modalEl, modalCloseEl } = els;
  modalEl.classList.add("hidden");
  modalCloseEl.style.display = "";

  // Release lock/ownership.
  try {
    if (modalEl.dataset.owner === "acceptance") modalEl.dataset.owner = "";
    if (modalEl.dataset.lock === "1") modalEl.dataset.lock = "0";
  } catch (_) {}
}

function installGameplayGateCapture() {
  document.addEventListener(
    "click",
    (e) => {
      if (hasUserAccepted()) return;

      const btn = e.target?.closest?.("button");
      if (!btn) return;
      if (!GATED_BUTTON_IDS.includes(btn.id)) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      showAcceptanceModal({
        title: "User Acceptance Required",
        termsPanelTitle: "User Acceptance Terms",
        legalPanelTitle: "Legal Notice",
        checkbox1Label: "I have read and agree to the User Acceptance Terms.",
        checkbox2Label: "I have read and agree to the Legal Notice.",
        acceptButtonText: "I Agree — Continue",
        declineButtonText: "Exit"
      });
    },
    true
  );
}

function installModalLockCaptureHandlers() {
  const els = getModalEls();
  if (!els) return;

  const { modalEl, modalCloseEl } = els;

  // Block ✕ while locked
  modalCloseEl.addEventListener(
    "click",
    (e) => {
      if (!acceptanceLockActive) return;
      e.preventDefault();
      e.stopImmediatePropagation();
    },
    true
  );

  // Block overlay click while locked
  modalEl.addEventListener(
    "click",
    (e) => {
      if (!acceptanceLockActive) return;
      if (e.target === modalEl) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );

  // Block ESC while locked
  document.addEventListener(
    "keydown",
    (e) => {
      if (!acceptanceLockActive) return;
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
}

function showAcceptanceModal({
  title,
  termsPanelTitle,
  legalPanelTitle,
  checkbox1Label,
  checkbox2Label,
  acceptButtonText,
  declineButtonText
}) {
  const els = getModalEls();
  if (!els) return;

  const { modalCloseEl } = els;
  acceptanceLockActive = true;
  modalCloseEl.style.display = "none";

  openModalLikeGameDoes(title, (body) => {
    const intro = document.createElement("p");
    intro.className = "modal-subtitle";
    intro.innerHTML =
      "You must accept <strong>both</strong> documents below before playing. Each checkbox unlocks only after you scroll that document to the bottom.";
    body.appendChild(intro);

    // ----- Panel 1: Terms (panel + checkbox directly under it)
    const termsBlock = buildPanelBlock({
      panelKey: "terms",
      panelTitle: termsPanelTitle,
      noteText: "Scroll to the bottom to unlock this checkbox.",
      scrollInnerHtml: buildTermsHtml()
    });
    body.appendChild(termsBlock.block);

    const cb1 = buildAcceptanceCheckboxRow({
      id: "pqAcceptTerms",
      labelText: checkbox1Label,
      lockedTitle: "Scroll the User Acceptance Terms to the bottom to unlock.",
      initiallyDisabled: true
    });
    body.appendChild(cb1.row);

    // spacing
    const spacer = document.createElement("div");
    spacer.style.height = "10px";
    body.appendChild(spacer);

    // ----- Panel 2: Legal (panel + checkbox directly under it)
    const legalBlock = buildPanelBlock({
      panelKey: "legal",
      panelTitle: legalPanelTitle,
      noteText: "Scroll to the bottom to unlock this checkbox.",
      scrollInnerHtml: buildLegalHtml()
    });
    body.appendChild(legalBlock.block);

    const cb2 = buildAcceptanceCheckboxRow({
      id: "pqAcceptLegal",
      labelText: checkbox2Label,
      lockedTitle: "Scroll the Legal Notice to the bottom to unlock.",
      initiallyDisabled: true
    });
    body.appendChild(cb2.row);

    // ----- Actions
    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.style.marginTop = "12px";

    const btnAccept = document.createElement("button");
    btnAccept.className = "btn outline";
    btnAccept.textContent = acceptButtonText;
    btnAccept.disabled = true;

    const btnDecline = document.createElement("button");
    btnDecline.className = "btn outline";
    btnDecline.textContent = declineButtonText;

    function refreshAcceptEnabled() {
      btnAccept.disabled = !(cb1.checkbox.checked && cb2.checkbox.checked);
    }

    cb1.checkbox.addEventListener("change", refreshAcceptEnabled);
    cb2.checkbox.addEventListener("change", refreshAcceptEnabled);

    btnAccept.addEventListener("click", () => {
      if (btnAccept.disabled) return;
      writeAcceptanceRecord();
      acceptanceLockActive = false;
      closeModalLikeGameDoes();
    });

    btnDecline.addEventListener("click", () => {
      acceptanceLockActive = false;
      closeModalLikeGameDoes();
    });

    actions.appendChild(btnAccept);
    actions.appendChild(btnDecline);
    body.appendChild(actions);

    const hint = document.createElement("p");
    hint.className = "modal-subtitle";
    hint.style.marginTop = "8px";
    hint.textContent =
      "If you exit without accepting, gameplay remains locked; starting again will reopen this prompt.";
    body.appendChild(hint);

    // ----- Scroll-to-bottom unlock wiring (each checkbox tied to its own scrollbox)
    wireScrollUnlock({
      boxEl: termsBlock.scrollBox,
      detailsEl: termsBlock.details,
      checkboxEl: cb1.checkbox
    });

    wireScrollUnlock({
      boxEl: legalBlock.scrollBox,
      detailsEl: legalBlock.details,
      checkboxEl: cb2.checkbox
    });

    // If a panel’s content fits with no scrolling, unlock immediately
    requestAnimationFrame(() => {
      forceUnlockIfNoScroll(termsBlock.scrollBox, cb1.checkbox);
      forceUnlockIfNoScroll(legalBlock.scrollBox, cb2.checkbox);
    });

    window.addEventListener("resize", () => {
      forceUnlockIfNoScroll(termsBlock.scrollBox, cb1.checkbox);
      forceUnlockIfNoScroll(legalBlock.scrollBox, cb2.checkbox);
    });
  });
}

function buildPanelBlock({ panelKey, panelTitle, noteText, scrollInnerHtml }) {
  const commonTextStyle =
    "margin-top:8px; color: var(--muted); font-size: 0.85rem; line-height: 1.35;";
  const scrollBoxStyle =
    "max-height: 220px; overflow: auto; padding: 10px; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; background: rgba(0,0,0,0.12);";
  const noteStyle =
    "margin-top:8px; color: var(--muted); font-size: 0.78rem; line-height: 1.25; opacity: 0.95;";

  const block = document.createElement("div");
  block.className = "item-row";
  block.style.marginTop = "10px";

  const details = document.createElement("details");
  details.open = true;
  details.dataset.pqDetails = panelKey;

  const summary = document.createElement("summary");
  const strong = document.createElement("strong");
  strong.textContent = panelTitle;
  summary.appendChild(strong);
  details.appendChild(summary);

  const note = document.createElement("div");
  note.style.cssText = noteStyle;
  note.textContent = noteText;
  details.appendChild(note);

  const scrollBox = document.createElement("div");
  scrollBox.dataset.pqScrollbox = panelKey;
  scrollBox.style.cssText = scrollBoxStyle;

  const inner = document.createElement("div");
  inner.style.cssText = commonTextStyle;
  inner.innerHTML = scrollInnerHtml;

  scrollBox.appendChild(inner);
  details.appendChild(scrollBox);

  block.appendChild(details);

  return { block, details, scrollBox };
}

function buildAcceptanceCheckboxRow({ id, labelText, lockedTitle, initiallyDisabled }) {
  const row = document.createElement("div");
  row.className = "item-row";
  row.style.marginTop = "8px";

  const label = document.createElement("label");
  label.style.display = "flex";
  label.style.gap = "10px";
  label.style.alignItems = "flex-start";
  label.style.cursor = "pointer";
  label.title = lockedTitle;

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = id;
  checkbox.disabled = !!initiallyDisabled;

  const text = document.createElement("div");
  text.style.fontSize = "0.85rem";
  text.style.color = "var(--text)";
  text.textContent = labelText;

  label.appendChild(checkbox);
  label.appendChild(text);
  row.appendChild(label);

  // When unlocked, remove the tooltip so it doesn't feel “stuck”
  checkbox.addEventListener("change", () => { /* noop */ });

  return { row, checkbox, label };
}

function wireScrollUnlock({ boxEl, detailsEl, checkboxEl }) {
  if (!boxEl || !checkboxEl) return;

  let unlocked = false;

  const isAtBottom = () => {
    const epsilon = 2;
    return boxEl.scrollTop + boxEl.clientHeight >= boxEl.scrollHeight - epsilon;
  };

  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    checkboxEl.disabled = false;

    // remove tooltip from the parent label if present
    const label = checkboxEl.closest("label");
    if (label) label.title = "";
  };

  const checkAndUnlock = () => {
    if (unlocked) return;

    // If content fits, unlock immediately
    if (boxEl.scrollHeight <= boxEl.clientHeight + 2) {
      unlock();
      return;
    }

    if (isAtBottom()) unlock();
  };

  boxEl.addEventListener("scroll", checkAndUnlock, { passive: true });

  // Details toggle can change layout/scrollHeight
  if (detailsEl) {
    detailsEl.addEventListener("toggle", () => {
      setTimeout(checkAndUnlock, 0);
    });
  }

  setTimeout(checkAndUnlock, 0);
}

function forceUnlockIfNoScroll(boxEl, checkboxEl) {
  if (!boxEl || !checkboxEl) return;
  if (!checkboxEl.disabled) return;
  const epsilon = 2;
  if (boxEl.scrollHeight <= boxEl.clientHeight + epsilon) {
    checkboxEl.disabled = false;
    const label = checkboxEl.closest("label");
    if (label) label.title = "";
  }
}

function buildTermsHtml() {
  // Generic strict terms (not legal advice). Keep as HTML string.
  return `
    <p><strong>Effective & Binding Agreement.</strong> By accepting, you enter into a binding agreement with the Creator. If you do not agree to every provision, do not use the Game.</p>

    <p><strong>1) Definitions.</strong></p>
    <ul>
      <li><strong>“Game”</strong> includes all software, code, UI, content, assets, save systems, updates, patches, and any related services/features.</li>
      <li><strong>“Content”</strong> includes text, art, audio, animations, items, characters, balance values, mechanics, and documentation.</li>
      <li><strong>“Creator”</strong> includes the author(s)/publisher(s) and any permitted contributors/licensors.</li>
      <li><strong>“Device”</strong> includes your computer/phone/tablet/browser profile and its storage.</li>
    </ul>

    <p><strong>2) Eligibility & Authority.</strong> You represent that you can form a legally binding agreement where you live, and if accepting for an entity, you have authority to bind it.</p>

    <p><strong>3) License Grant (Limited).</strong> Subject to compliance, you receive a limited, revocable, non-exclusive, non-transferable license to run the Game for personal, non-commercial entertainment. No ownership transfers.</p>

    <p><strong>4) Prototype Status / Volatility.</strong> The Game may be experimental and incomplete. Features may change or be removed; mechanics may be rebalanced; saves may become incompatible; and access may be discontinued without notice.</p>

    <p><strong>5) Saves, Storage, and Reliability (Strict).</strong></p>
    <ul>
      <li>Saves/settings may be stored locally (e.g., localStorage). The Creator may be unable to restore data for any reason.</li>
      <li>Clearing site data, browser resets, private mode, extensions, security tools, OS cleanup, quota limits, and updates can delete/corrupt saves.</li>
      <li>You are solely responsible for any backups (if feasible) and for securing your Device.</li>
    </ul>

    <p><strong>6) Conduct & Restrictions (Zero-Tolerance).</strong> You agree you will not:</p>
    <ul>
      <li>Bypass, disable, or undermine gating systems, cooldowns, fairness constraints, integrity checks, or other protections.</li>
      <li>Reverse engineer, decompile, disassemble, or attempt to extract proprietary logic except where a non-waivable law permits it.</li>
      <li>Use scripts/bots/automation to gain unfair advantage or to stress/disrupt the Game.</li>
      <li>Inject malicious code, tamper with local storage to crash/cheat, or exfiltrate data from any part of the Game.</li>
      <li>Use the Game to harass, threaten, impersonate, or encourage harmful/illegal activity.</li>
    </ul>

    <p><strong>7) Safety & Health.</strong> The Game may include flashing visuals, rapid animations, high contrast, or repetitive motion. Stop immediately if you feel discomfort (dizziness, nausea, headaches, seizures, eye strain). Do not play when alertness is required.</p>

    <p><strong>8) No Support Obligation.</strong> The Creator has no obligation to provide support, maintenance, compatibility fixes, or restore lost progress. Any support is voluntary and may stop at any time.</p>

    <p><strong>9) Feedback License.</strong> If you submit ideas/bug reports/suggestions, you grant the Creator a perpetual, worldwide, royalty-free right to use, modify, publish, and incorporate them without compensation or attribution (unless required by law).</p>

    <p><strong>10) Changes & Re-Acceptance.</strong> Terms may change. The Game may require re-acceptance before continued use. Continued use after updates constitutes acceptance.</p>

    <p><strong>11) Termination.</strong> Permission to use the Game ends immediately upon any breach. You must stop using the Game and delete unauthorized copies/derivatives.</p>

    <p><strong>12) Disclaimer of Warranties (Maximum).</strong> THE GAME IS PROVIDED “AS IS” AND “AS AVAILABLE.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, ALL WARRANTIES ARE DISCLAIMED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.</p>

    <p><strong>13) Assumption of Risk.</strong> You accept that gameplay outcomes, randomness, balance, and progression are not guaranteed; content may be inaccurate; and the Game may fail without warning. You proceed anyway.</p>
  `;
}

function buildLegalHtml() {
  // Generic strict legal notice (not legal advice). Keep as HTML string.
  return `
    <p><strong>Scope.</strong> This notice covers intellectual property, liability limits, indemnity, third-party materials, and related legal concepts applying to the Game and Content.</p>

    <p><strong>1) Ownership & Intellectual Property.</strong></p>
    <ul>
      <li>All right, title, and interest in the Game and Content remain with the Creator and/or licensors.</li>
      <li>The Game is licensed, not sold. No ownership rights transfer to you.</li>
      <li>You must not remove or obscure copyright, trademark, attribution, or proprietary notices.</li>
    </ul>

    <p><strong>2) Copying / Distribution / Commercial Restrictions.</strong></p>
    <ul>
      <li>You may not sell, resell, sublicense, distribute, publish, publicly perform/display, or commercially exploit the Game or Content without explicit written permission.</li>
      <li>You may not bundle the Game into another product, launcher, paid service, or monetized pack without permission.</li>
      <li>You may not redistribute raw assets (art/audio/fonts) or extracted asset packs.</li>
    </ul>

    <p><strong>3) Streaming / Recording.</strong> Unless separate guidelines exist, personal streaming/recording may be permitted for non-commercial sharing if you do not misrepresent ownership, do not distribute raw assets, and comply with platform rules and applicable law. Permission may be revoked in cases of abuse or misrepresentation.</p>

    <p><strong>4) Third-Party Materials & Licenses.</strong></p>
    <ul>
      <li>Third-party trademarks and names (if any) belong to their owners and do not imply endorsement.</li>
      <li>Third-party libraries/fonts/assets may be governed by separate licenses; you are responsible for compliance where applicable.</li>
    </ul>

    <p><strong>5) Privacy / Data Handling (General).</strong></p>
    <ul>
      <li>The Game may store saves/settings locally on your Device.</li>
      <li>If online features/telemetry/accounts/analytics are added later, additional notices/consents may be required.</li>
      <li>Anyone with access to your device/browser profile may access local saves. You are responsible for device security.</li>
    </ul>

    <p><strong>6) Security & Integrity.</strong> You agree not to attempt unauthorized access, tamper with storage, exploit vulnerabilities, or create/share tools that facilitate cheating, exploitation, disruption, or unauthorized copying.</p>

    <p><strong>7) Indemnity.</strong> To the maximum extent permitted by law, you agree to defend, indemnify, and hold harmless the Creator from claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of: (a) your misuse of the Game, (b) your violation of these documents, or (c) your violation of law or third-party rights.</p>

    <p><strong>8) Limitation of Liability (Broad).</strong> TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
    <ul>
      <li>The Creator is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages.</li>
      <li>The Creator is not liable for loss of data/saves, loss of profits, device issues, downtime, or content inaccuracies.</li>
      <li>If liability cannot be excluded, it is limited to the maximum extent permitted by law and may be capped at the amount you paid (if any), where such a cap is allowed.</li>
    </ul>

    <p><strong>9) Governing Law / Venue.</strong> Disputes are governed by applicable law as required in your jurisdiction. Where allowed, disputes must be brought in an appropriate venue under that governing law. (Customize if you need a specific jurisdiction clause.)</p>

    <p><strong>10) Severability & Entire Agreement.</strong> If any provision is unenforceable, the remainder remains effective. These documents form the entire agreement regarding access to the Game unless superseded by a written agreement.</p>

    <p><strong>11) Notice & Contact.</strong> If the Game provides an official contact method, that is the channel for notices. If none is provided, response is not guaranteed.</p>
  `;
}

// Auto-init
initUserAcceptanceGate();

// Optional debug helpers
if (typeof window !== "undefined") {
  window.PQ_ACCEPT = { hasUserAccepted, resetUserAcceptance };
}
