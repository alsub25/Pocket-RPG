// bootstrap.js

const VERSIONS = [
  { id: "core", label: "Main", entry: "./Future/Future.js" },
  { id: "core", label: "Main", entry: "./Core/Main.js" },
  { id: "dev",  label: "Prior Patch V0.7.0",  entry: "./Core/Old.js" },
];

const STORAGE_KEY = "selected_game_version";
const GAME_SCRIPT_ID = "game-entry-module";
const BTN_ID = "btnChangeVersion";

/* --------------------------- small helpers --------------------------- */

function onDocReady(fn) {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fn, { once: true });
  } else {
    fn();
  }
}

function resolveEntry(entry) {
  return new URL(entry, import.meta.url).href;
}

function normalizeUrlWithoutQueryV() {
  const url = new URL(location.href);
  url.searchParams.delete("v");
  return url.toString();
}

function pickVersionId() {
  const url = new URL(location.href);
  const fromQuery = url.searchParams.get("v");
  if (fromQuery) return fromQuery;
  return localStorage.getItem(STORAGE_KEY);
}

/* --------------------------- game loading --------------------------- */

function loadGameVersion(version, { onFail } = {}) {
  const existing = document.getElementById(GAME_SCRIPT_ID);
  if (existing) existing.remove();

  const s = document.createElement("script");
  s.id = GAME_SCRIPT_ID;
  s.type = "module";
  s.src = resolveEntry(version.entry);

  s.onload = () => console.log("[bootstrap] Loaded:", s.src);
  s.onerror = () => {
    console.error("[bootstrap] Failed to load:", s.src);
    alert(`Failed to load:\n${s.src}\n\nCheck DevTools Console for details.`);
    if (typeof onFail === "function") onFail();
  };

  document.head.appendChild(s);
}

/* --------------------------- modal (use game's modal shell) --------------------------- */

function getModalEls() {
  const modal = document.getElementById("modal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  const close = document.getElementById("modalClose");
  return { modal, title, body, close };
}

function ensureBootstrapModalCloseHandlers() {
  const { modal, close } = getModalEls();
  if (!modal) return;

  // Avoid stacking duplicate listeners.
  if (!modal.dataset.bootstrapCloseWired) {
    modal.dataset.bootstrapCloseWired = "1";

    // click outside panel closes (matches your existing UX)
    modal.addEventListener("click", (e) => {
      if (e.target === modal) hideBootstrapModal();
    });

    if (close) {
      close.addEventListener("click", () => hideBootstrapModal());
    }
  }
}

function showBootstrapModal(titleText, contentNode) {
  const { modal, title, body } = getModalEls();
  if (!modal || !title || !body) return;

  ensureBootstrapModalCloseHandlers();

  title.textContent = titleText;

  body.innerHTML = "";
  body.appendChild(contentNode);

  modal.classList.remove("hidden");
  modal.dataset.bootstrapOpen = "1";
}

function hideBootstrapModal() {
  const { modal, body } = getModalEls();
  if (!modal) return;

  // Only close what we opened (so we don’t fight game code if it opens its own modal)
  if (modal.dataset.bootstrapOpen === "1") {
    modal.classList.add("hidden");
    modal.dataset.bootstrapOpen = "0";
    if (body) body.innerHTML = "";
  }
}

/* --------------------------- version picker UI --------------------------- */

function openVersionModal({ requirePick = false } = {}) {
  const pickedId = pickVersionId();
  const picked = VERSIONS.find(v => v.id === pickedId);

  const wrap = document.createElement("div");
  wrap.className = "version-modal";

  const subtitle = document.createElement("div");
  subtitle.className = "modal-subtitle";
  subtitle.textContent = "Pick which build to load. This device will remember your choice.";
  wrap.appendChild(subtitle);

  const current = document.createElement("div");
  current.className = "hint";
  current.style.textAlign = "left";
  current.style.marginTop = "0";
  current.textContent = picked ? `Current: ${picked.label}` : "Current: (none selected)";
  wrap.appendChild(current);

  const list = document.createElement("div");
  list.className = "version-modal-list";

  VERSIONS.forEach(v => {
    const btn = document.createElement("button");
    btn.type = "button";

    // Highlight current selection
    btn.className = (picked && v.id === picked.id) ? "btn outline" : "btn outline";
    btn.textContent = v.label;

    btn.addEventListener("click", () => {
      localStorage.setItem(STORAGE_KEY, v.id);
      location.href = normalizeUrlWithoutQueryV(); // clean swap, no leftover ?v=
    });

    list.appendChild(btn);
  });

  // Optional cancel button (only if you already have something selected)
  if (!requirePick && picked) {
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "btn outline";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", () => hideBootstrapModal());
    list.appendChild(cancel);
  }

  wrap.appendChild(list);
  showBootstrapModal("Select Game Version", wrap);
}

/* --------------------------- main menu button injection --------------------------- */

function insertAfter(newNode, referenceNode) {
  referenceNode.parentNode.insertBefore(newNode, referenceNode.nextSibling);
}

function ensureChangeVersionButton() {
  // If it already exists, do nothing
  if (document.getElementById(BTN_ID)) return;

  const mainMenu = document.getElementById("mainMenu");
  const card = mainMenu ? mainMenu.querySelector(".card") : null;
  if (!card) return;

  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.type = "button";
  btn.className = "btn outline";
  btn.textContent = "Change Version";
  btn.addEventListener("click", () => openVersionModal({ requirePick: false }));

  // Place it near other main menu buttons (right after Changelog if present)
  const after = document.getElementById("btnChangelog")
            || document.getElementById("btnSettingsMain")
            || document.getElementById("btnLoadGame")
            || document.getElementById("btnNewGame");

  if (after && after.parentElement === card) {
    insertAfter(btn, after);
  } else {
    card.appendChild(btn);
  }
}

/* --------------------------- bootstrap init --------------------------- */

function initBootstrap() {
  onDocReady(() => {
    // Put the button into the main menu; it will auto-hide when the menu screen is hidden.
    ensureChangeVersionButton();

    const pickedId = pickVersionId();
    const picked = VERSIONS.find(v => v.id === pickedId);

    // If query param used and valid, persist it so it “sticks”
    const url = new URL(location.href);
    const q = url.searchParams.get("v");
    if (q && picked) localStorage.setItem(STORAGE_KEY, picked.id);

    if (picked) {
      loadGameVersion(picked, { onFail: () => openVersionModal({ requirePick: true }) });
    } else {
      // Force first-time selection (cleanest when you’re managing multiple builds)
      openVersionModal({ requirePick: true });
    }
  });
}

initBootstrap();
