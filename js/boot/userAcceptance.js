// js/boot/userAcceptance.js
// Patch 1.2.86: User acceptance gate (boot diagnostics moved to bootDiagnostics.js)

import { safeStorageGet, safeStorageSet, safeStorageRemove } from './lib/safeStorage.js';
// Import boot diagnostics from separate module for easier maintenance
import './bootDiagnostics.js';

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

