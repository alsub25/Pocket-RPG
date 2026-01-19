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
    const filename = ev.filename || '';
    const lineno = ev.lineno || 0;
    const colno = ev.colno || 0;
    const location = filename ? `${filename}:${lineno}:${colno}` : 'unknown location';
    
    push('error', {
      message: String(ev.message || 'Unknown error'),
      filename,
      lineno,
      colno,
      location,
      displayMessage: filename 
        ? `${ev.message || 'Unknown error'}\n  at ${location}`
        : String(ev.message || 'Unknown error')
    })
  })

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev && ev.reason;
    const message = reason && reason.message ? String(reason.message) : String(reason);
    const stack = reason && reason.stack ? String(reason.stack) : '';
    
    // Try to extract file location from stack trace
    let location = 'unknown location';
    let displayMessage = message;
    
    if (stack) {
      // Match common stack trace patterns: at <location> (file:line:col) or at file:line:col
      // Examples: "at Module.load (file.js:10:5)" or "at file.js:10:5"
      const STACK_TRACE_REGEX = /at\s+(?:.*?\s+\()?([^):\s]+):(\d+):(\d+)/;
      const stackMatch = stack.match(STACK_TRACE_REGEX);
      if (stackMatch) {
        const [, file, line, col] = stackMatch;
        location = `${file}:${line}:${col}`;
        displayMessage = `${message}\n  at ${location}`;
      } else {
        const stackLines = stack.split('\n');
        if (stackLines.length > 1) {
          // If no match but we have a stack, show first meaningful line
          const meaningfulLines = stackLines.filter(l => l.trim() && !l.includes('addEventListener'));
          if (meaningfulLines.length > 1) {
            displayMessage = `${message}\n  ${meaningfulLines[1].trim()}`;
          }
        }
      }
    }
    
    push('unhandledrejection', {
      message,
      stack,
      location,
      displayMessage
    })
  })

  diag.buildReport = () => ({
    startedAt: diag.startedAt,
    url: (typeof location !== 'undefined' ? location.href : ''),
    ua: (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    errors: diag.errors
  })

  diag.renderOverlay = () => {
    try {
      const id = 'pq-boot-diag-overlay'
      if (document.getElementById(id)) return

      const overlay = document.createElement('div')
      overlay.id = id
      overlay.style.position = 'fixed'
      overlay.style.inset = '0'
      overlay.style.zIndex = '999999'
      overlay.style.background = 'rgba(0,0,0,0.86)'
      overlay.style.color = '#fff'
      overlay.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif'
      overlay.style.padding = '16px'
      overlay.style.overflow = 'auto'

      const title = document.createElement('div')
      title.style.fontSize = '18px'
      title.style.fontWeight = '700'
      title.style.marginBottom = '10px'
      title.textContent = `Boot Diagnostics (Patch ${GAME_PATCH})`
      overlay.appendChild(title)

      const sub = document.createElement('div')
      sub.style.fontSize = '12px'
      sub.style.opacity = '0.85'
      sub.style.marginBottom = '12px'
      sub.textContent = 'If the game fails to load, screenshot this overlay. Use Copy Report for a text bug report.'
      overlay.appendChild(sub)

      // Add error summary section if there are errors
      if (diag.errors && diag.errors.length > 0) {
        const errorSummary = document.createElement('div')
        errorSummary.style.background = 'rgba(255, 0, 0, 0.15)'
        errorSummary.style.border = '1px solid rgba(255, 0, 0, 0.4)'
        errorSummary.style.borderRadius = '4px'
        errorSummary.style.padding = '12px'
        errorSummary.style.marginBottom = '12px'
        errorSummary.style.fontSize = '13px'
        
        const summaryTitle = document.createElement('div')
        summaryTitle.style.fontWeight = '700'
        summaryTitle.style.marginBottom = '8px'
        summaryTitle.style.color = '#ff6b6b'
        summaryTitle.textContent = `${diag.errors.length} Error${diag.errors.length === 1 ? '' : 's'} Detected`
        errorSummary.appendChild(summaryTitle)
        
        // Show last few errors with file locations prominently
        const recentErrors = diag.errors.slice(-3).reverse()
        recentErrors.forEach((err, idx) => {
          const errDiv = document.createElement('div')
          errDiv.style.marginBottom = idx < recentErrors.length - 1 ? '8px' : '0'
          
          // Show error type
          const typeSpan = document.createElement('div')
          typeSpan.style.fontSize = '11px'
          typeSpan.style.opacity = '0.7'
          typeSpan.style.marginBottom = '2px'
          typeSpan.textContent = `[${err.kind}] ${err.t || ''}`
          errDiv.appendChild(typeSpan)
          
          // Show file location prominently if available
          if (err.location && err.location !== 'unknown location') {
            const locDiv = document.createElement('div')
            locDiv.style.fontFamily = 'Monaco, Consolas, monospace'
            locDiv.style.fontSize = '13px'
            locDiv.style.fontWeight = '700'
            locDiv.style.color = '#ffd43b'
            locDiv.style.marginBottom = '4px'
            locDiv.setAttribute('aria-label', `Location: ${err.location}`)
            locDiv.textContent = `📍 ${err.location}`
            errDiv.appendChild(locDiv)
          }
          
          // Show message
          const msgDiv = document.createElement('div')
          msgDiv.style.fontFamily = 'Monaco, Consolas, monospace'
          msgDiv.style.fontSize = '12px'
          msgDiv.style.whiteSpace = 'pre-wrap'
          msgDiv.style.wordBreak = 'break-word'
          msgDiv.textContent = err.displayMessage || err.message || 'Unknown error'
          errDiv.appendChild(msgDiv)
          
          errorSummary.appendChild(errDiv)
        })
        
        overlay.appendChild(errorSummary)
      }

      const actions = document.createElement('div')
      actions.style.display = 'flex'
      actions.style.gap = '8px'
      actions.style.marginBottom = '12px'

      const mkBtn = (label) => {
        const b = document.createElement('button')
        b.textContent = label
        b.style.padding = '8px 10px'
        b.style.cursor = 'pointer'
        return b
      }

      const btnCopy = mkBtn('Copy Report')
      btnCopy.addEventListener('click', async () => {
        try {
          const payload = JSON.stringify(diag.buildReport(), null, 2)
          await navigator.clipboard.writeText(payload)
          btnCopy.textContent = 'Copied!'
          setTimeout(() => (btnCopy.textContent = 'Copy Report'), 900)
        } catch (_) {
          btnCopy.textContent = 'Copy failed'
          setTimeout(() => (btnCopy.textContent = 'Copy Report'), 1200)
        }
      })

      const btnClear = mkBtn('Clear')
      btnClear.addEventListener('click', () => {
        diag.errors = []
        try { localStorage.removeItem('pq-last-boot-errors') } catch (_) {}
        overlay.remove()
      })

      const btnClose = mkBtn('Close')
      btnClose.addEventListener('click', () => overlay.remove())

      actions.appendChild(btnCopy)
      actions.appendChild(btnClear)
      actions.appendChild(btnClose)
      overlay.appendChild(actions)

      const pre = document.createElement('pre')
      pre.style.whiteSpace = 'pre-wrap'
      pre.style.fontSize = '12px'
      pre.textContent = JSON.stringify(diag.buildReport(), null, 2)
      overlay.appendChild(pre)

      document.body.appendChild(overlay)
    } catch (_) {}
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
