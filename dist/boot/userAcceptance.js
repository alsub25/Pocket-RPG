// js/boot/userAcceptance.js
// Patch 1.2.86: User acceptance gate (boot diagnostics moved to bootDiagnostics.js)
import { safeStorageGet, safeStorageSet, safeStorageRemove } from './lib/safeStorage.js';
// Boot diagnostics is loaded separately in index.html before this module
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
    try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function readAcceptanceRecord() {
    try {
        const raw = safeStorageGet(ACCEPTANCE_STORAGE_KEY);
        if (!raw)
            return null;
        return safeJsonParse(raw);
    }
    catch {
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
    }
    catch {
        // If storage fails, acceptance is session-only after clicking Accept.
    }
}
export function hasUserAccepted() {
    const rec = readAcceptanceRecord();
    return !!(rec &&
        rec.version === ACCEPTANCE_VERSION &&
        typeof rec.acceptedAt === "number" &&
        rec.acceptedTerms === true &&
        rec.acceptedLegal === true);
}
export function resetUserAcceptance() {
    safeStorageRemove(ACCEPTANCE_STORAGE_KEY);
}
export function initUserAcceptanceGate(options = {}) {
    if (installed)
        return;
    installed = true;
    const { title = "User Acceptance Required", termsPanelTitle = "User Acceptance Terms", legalPanelTitle = "Legal Notice", checkbox1Label = "I have read and agree to the User Acceptance Terms.", checkbox2Label = "I have read and agree to the Legal Notice.", acceptButtonText = "I Agree — Continue", declineButtonText = "Exit" } = options;
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
    if (!modalEl || !modalTitleEl || !modalBodyEl || !modalCloseEl)
        return null;
    return { modalEl, modalTitleEl, modalBodyEl, modalCloseEl };
}
function openModalLikeGameDoes(title, builderFn) {
    const els = getModalEls();
    if (!els)
        return;
    const { modalEl, modalTitleEl, modalBodyEl } = els;
    // Claim and lock the modal so other UI code (bootstrap/game) can't dismiss it.
    try {
        modalEl.dataset.owner = "acceptance";
        modalEl.dataset.lock = "1";
    }
    catch (_) { }
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
    if (!els)
        return;
    const { modalEl, modalCloseEl } = els;
    modalEl.classList.add("hidden");
    modalCloseEl.style.display = "";
    // Release lock/ownership.
    try {
        if (modalEl.dataset.owner === "acceptance")
            modalEl.dataset.owner = "";
        if (modalEl.dataset.lock === "1")
            modalEl.dataset.lock = "0";
    }
    catch (_) { }
}
function installGameplayGateCapture() {
    document.addEventListener("click", (e) => {
        if (hasUserAccepted())
            return;
        const btn = e.target?.closest?.("button");
        if (!btn)
            return;
        if (!GATED_BUTTON_IDS.includes(btn.id))
            return;
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
    }, true);
}
function installModalLockCaptureHandlers() {
    const els = getModalEls();
    if (!els)
        return;
    const { modalEl, modalCloseEl } = els;
    // Block ✕ while locked
    modalCloseEl.addEventListener("click", (e) => {
        if (!acceptanceLockActive)
            return;
        e.preventDefault();
        e.stopImmediatePropagation();
    }, true);
    // Block overlay click while locked
    modalEl.addEventListener("click", (e) => {
        if (!acceptanceLockActive)
            return;
        if (e.target === modalEl) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }, true);
    // Block ESC while locked
    document.addEventListener("keydown", (e) => {
        if (!acceptanceLockActive)
            return;
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }, true);
}
function showAcceptanceModal({ title, termsPanelTitle, legalPanelTitle, checkbox1Label, checkbox2Label, acceptButtonText, declineButtonText }) {
    const els = getModalEls();
    if (!els)
        return;
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
            if (btnAccept.disabled)
                return;
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
    const commonTextStyle = "margin-top:8px; color: var(--muted); font-size: 0.85rem; line-height: 1.35;";
    const scrollBoxStyle = "max-height: 220px; overflow: auto; padding: 10px; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; background: rgba(0,0,0,0.12);";
    const noteStyle = "margin-top:8px; color: var(--muted); font-size: 0.78rem; line-height: 1.25; opacity: 0.95;";
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
    checkbox.addEventListener("change", () => { });
    return { row, checkbox, label };
}
function wireScrollUnlock({ boxEl, detailsEl, checkboxEl }) {
    if (!boxEl || !checkboxEl)
        return;
    let unlocked = false;
    const isAtBottom = () => {
        const epsilon = 2;
        return boxEl.scrollTop + boxEl.clientHeight >= boxEl.scrollHeight - epsilon;
    };
    const unlock = () => {
        if (unlocked)
            return;
        unlocked = true;
        checkboxEl.disabled = false;
        // remove tooltip from the parent label if present
        const label = checkboxEl.closest("label");
        if (label)
            label.title = "";
    };
    const checkAndUnlock = () => {
        if (unlocked)
            return;
        // If content fits, unlock immediately
        if (boxEl.scrollHeight <= boxEl.clientHeight + 2) {
            unlock();
            return;
        }
        if (isAtBottom())
            unlock();
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
    if (!boxEl || !checkboxEl)
        return;
    if (!checkboxEl.disabled)
        return;
    const epsilon = 2;
    if (boxEl.scrollHeight <= boxEl.clientHeight + epsilon) {
        checkboxEl.disabled = false;
        const label = checkboxEl.closest("label");
        if (label)
            label.title = "";
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
//# sourceMappingURL=userAcceptance.js.map