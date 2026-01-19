// bootstrap.js

import { GAME_FULL_LABEL } from '../game/systems/version.js';
import { safeStorageGet, safeStorageSet } from './lib/safeStorage.js';
import { BootLoader } from './bootLoader.js';
import { showSplashSequence } from './splashScreen.js';

// Persisted boot timings for QA / bug reports.
const BOOT_METRICS_KEY = 'ew-last-boot-metrics';

function _bootNow() {
  try {
    if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') {
      return performance.now();
    }
  } catch (_) {}
  return Date.now();
}

function _safeJsonStringify(x) {
  try { return JSON.stringify(x); } catch (_) { return ''; }
}

const VERSIONS = [
  { id: 'future', label: GAME_FULL_LABEL, entry: './js/game/main.js' },
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

/* --------------------------- pill tap highlight --------------------------- */

// Restores the old “tap highlight” feel for the top-right HUD pills and modal close.
// This intentionally avoids any translate/scale press effects.
function wirePillTapHighlight() {
  // Patch 1.2.42: Journal pill included.
  const ids = ["btnSmokeTestsPill", "btnCheatPill", "btnQuestJournalPill", "btnGameMenu", "modalClose"];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.dataset && el.dataset.pillTapWired) return;
    try { el.dataset.pillTapWired = "1"; } catch (_) {}

    const fire = () => {
      try {
        // restart animation
        el.classList.remove("pill-tap-anim");
        // force reflow
        void el.offsetWidth;
        el.classList.add("pill-tap-anim");
        if (el.__pillTapTimer) clearTimeout(el.__pillTapTimer);
        el.__pillTapTimer = setTimeout(() => el.classList.remove("pill-tap-anim"), 380);
      } catch (_) {}
    };

    // pointerdown = instant feedback on touch
    el.addEventListener("pointerdown", fire, { passive: true });
    // click fallback
    el.addEventListener("click", fire);
    // keyboard accessibility
    el.addEventListener("keydown", (e) => {
      if (e && (e.key === "Enter" || e.key === " ")) fire();
    });
  });
}

// IMPORTANT:
// Resolve entry points relative to index.html (location.href), not import.meta.url.
// This keeps boot stable if folders move (and avoids accidental nested-base paths).
const APP_BASE = new URL('./', location.href);

function resolveEntry(entry) {
  return new URL(entry, APP_BASE).href;
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
  return safeStorageGet(STORAGE_KEY);
}

function getOnlyVersionIfSingle() {
  return (Array.isArray(VERSIONS) && VERSIONS.length === 1) ? VERSIONS[0] : null;
}



/* --------------------------- boot diagnostics --------------------------- */

function diagPush(kind, payload) {
  try {
    const d = window.PQ_BOOT_DIAG
    if (d && typeof d === 'object' && Array.isArray(d.errors)) {
      const entry = { t: new Date().toISOString(), kind, ...payload };
      
      // Try to add location information if not already present
      if (!entry.location && kind === 'scriptLoadError' && payload.src) {
        entry.location = payload.src;
      }
      
      d.errors.push(entry);
      if (d.errors.length > 80) d.errors.splice(0, d.errors.length - 80)
    }
  } catch (_) {}
}

async function preflightModuleGraph(entryUrl, { maxModules = 140, onVisit } = {}) {
  const visited = new Set()
  const missing = []
  const bad = []

  async function check(url, onVisit) {
    if (visited.has(url)) return
    if (visited.size >= maxModules) return
    visited.add(url)
    try { if (typeof onVisit === 'function') onVisit(visited.size, url); } catch (_) {}

    let res
    try {
      res = await fetch(url, { cache: 'no-store' })
    } catch (e) {
      bad.push({ url, message: String(e && e.message ? e.message : e) })
      return
    }

    if (!res || !res.ok) {
      missing.push({ url, status: res ? res.status : 0, statusText: res ? res.statusText : '' })
      return
    }

    // Only parse JS-ish content.
    const ct = (res.headers && res.headers.get ? (res.headers.get('content-type') || '') : '')
    const looksJs = url.endsWith('.js') || ct.includes('javascript') || ct.includes('ecmascript') || ct.includes('text/plain')
    if (!looksJs) return

    let src = ''
    try {
      src = await res.text()
    } catch (_) {
      return
    }

    // Parse static imports (best-effort). This is *not* a full JS parser; it's an early warning system.
    const re = /import\s+(?:[^'"\n;]*?from\s*)?['"]([^'"]+)['"]/g
    let m
    while ((m = re.exec(src))) {
      const spec = m[1]
      if (!spec || typeof spec !== 'string') continue
      if (!spec.startsWith('.') && !spec.startsWith('/')) continue
      // Skip remote specifiers
      if (spec.startsWith('http:') || spec.startsWith('https:')) continue
      const next = new URL(spec, url).href
      await check(next, onVisit)
    }
  }

  await check(entryUrl, onVisit)
  return { visitedCount: visited.size, missing, bad }
}

function shouldRunPreflight() {
  try {
    const url = new URL(location.href);
    const qp = url.searchParams;
    if (qp.get('preflight') === '1' || qp.get('diag') === '1') return true;
  } catch (_) {}
  try {
    // If the last boot recorded errors, preflight can help catch missing files.
    return !!localStorage.getItem('pq-last-boot-errors');
  } catch (_) {
    return false;
  }
}

async function prefetchAssets(urls, { onProgress } = {}) {
  if (!Array.isArray(urls) || !urls.length) return;
  const total = urls.length;
  let done = 0;

  for (const u of urls) {
    try {
      // Warm the HTTP cache; we don't need the bytes in JS.
      await fetch(u, { cache: 'force-cache' });
    } catch (_) {
      // Non-fatal. Some environments (file://) don't allow fetch.
    }
    done++;
    try { if (typeof onProgress === 'function') onProgress(done, total, u); } catch (_) {}
  }
}
/* --------------------------- game loading --------------------------- */

async function loadGameVersion(version, { onFail } = {}) {
  const existing = document.getElementById(GAME_SCRIPT_ID);
  if (existing) existing.remove();

  const entryUrl = resolveEntry(version.entry);

  // ---- boot performance metrics (for QA + bug reports) ----
  const boot = {
    patch: GAME_FULL_LABEL,
    versionId: version && version.id ? String(version.id) : 'unknown',
    entry: String(entryUrl || ''),
    startedAt: Date.now(),
    t0: _bootNow(),
    steps: {},
    ok: false,
  };

  const mark = (k) => {
    try { boot.steps[String(k)] = _bootNow(); } catch (_) {}
  };

  try { window.__EW_BOOT_METRICS__ = boot; } catch (_) {}
  mark('start');

  // Ensure the loader can paint BEFORE heavy parsing begins.
  BootLoader.show('Preparing…');
  mark('loaderShown');
  await BootLoader.nextFrame();
  mark('afterFirstPaint');

  // Optional preflight (disabled by default for better boot performance).
  if (location.protocol === 'file:') {
    diagPush('preflightSkipped', { version: version.id, reason: 'file-protocol' });
  } else if (shouldRunPreflight()) {
    try {
      mark('preflightStart');
      BootLoader.setProgress(8, 'Checking files…');
      const result = await preflightModuleGraph(entryUrl, {
        onVisit: (count) => {
          // Map the scan into ~8–28%.
          const pct = 8 + Math.min(20, Math.floor(count / 6));
          BootLoader.setProgress(pct, 'Checking files…');
        },
      });
      if ((result.missing && result.missing.length) || (result.bad && result.bad.length)) {
        mark('preflightEnd');
        
        // Enhanced diagnostic logging for missing/bad modules
        console.error('[bootstrap] ❌ Preflight check failed');
        if (result.missing && result.missing.length) {
          console.error(`  Missing modules (${result.missing.length}):`);
          result.missing.forEach(m => {
            console.error(`    📍 ${m.url} (HTTP ${m.status} ${m.statusText})`);
          });
        }
        if (result.bad && result.bad.length) {
          console.error(`  Failed to fetch (${result.bad.length}):`);
          result.bad.forEach(b => {
            console.error(`    📍 ${b.url}`);
            console.error(`       Error: ${b.message}`);
          });
        }
        
        diagPush('preflight', { 
          version: version.id, 
          ...result,
          // Add formatted messages for display
          missingFiles: result.missing ? result.missing.map(m => `${m.url} (HTTP ${m.status})`) : [],
          failedFiles: result.bad ? result.bad.map(b => `${b.url}: ${b.message}`) : []
        });
        if (window.PQ_BOOT_DIAG && window.PQ_BOOT_DIAG.renderOverlay) window.PQ_BOOT_DIAG.renderOverlay();
        BootLoader.hide();
        try {
          boot.ok = false;
          boot.error = 'Preflight detected missing modules';
          boot.endedAt = Date.now();
          mark('end');
          safeStorageSet(BOOT_METRICS_KEY, _safeJsonStringify(boot), { action: 'bootMetrics' });
        } catch (_) {}
        if (onFail) onFail(new Error('Preflight detected missing modules'));
        return;
      }
      mark('preflightEnd');
    } catch (e) {
      diagPush('preflightException', { message: String(e && e.message ? e.message : e) });
      // continue: don't block load for environments where fetch is restricted
    }
  }

  // Prefetch a small set of critical assets to avoid "first interaction" stalls.
  // (Non-fatal if fetch is blocked.)
  try {
    mark('prefetchStart');
    const base = new URL('./', location.href);
    const audio = [
      new URL('assets/audio/village_day.wav', base).href,
      new URL('assets/audio/night-ambience.wav', base).href,
      new URL('assets/audio/old-wooden-door.wav', base).href,
      new URL('assets/audio/Tavern.wav', base).href,
    ];

    BootLoader.setProgress(28, 'Loading assets…');
    await prefetchAssets(audio, {
      onProgress: (done, total) => {
        const pct = 28 + Math.round((done / total) * 12); // 28–40%
        BootLoader.setProgress(pct, `Loading assets… (${done}/${total})`);
      },
    });
    mark('prefetchEnd');
  } catch (_) {}

  BootLoader.setProgress(45, 'Loading engine…');
  await BootLoader.nextFrame();
  mark('importStart');

  function loadModuleViaScriptTag(url) {
    return new Promise((resolve, reject) => {
      try {
        const s = document.createElement('script');
        s.id = GAME_SCRIPT_ID;
        s.type = 'module';
        s.src = url;
        s.async = true;
        s.addEventListener('load', () => resolve(), { once: true });
        s.addEventListener('error', (e) => reject(e || new Error('Module script load failed')), { once: true });
        document.head.appendChild(s);
      } catch (e) {
        reject(e);
      }
    });
  }

  // Load the game entry module via dynamic import so we can await completion
  // and hide the loader in a consistent place.
  try {
    // iOS Safari / WebView can behave differently under file://:
    // module <script> tags often work even when dynamic import() throws.
    if (location.protocol === 'file:') {
      await loadModuleViaScriptTag(entryUrl);
    } else {
      await import(entryUrl);
    }
    mark('importEnd');
    console.log(`[bootstrap] ✅ Loaded successfully: ${entryUrl}`);
    try {
      if (window.PQ_BOOT_DIAG && typeof window.PQ_BOOT_DIAG.markBootOk === 'function') {
        window.PQ_BOOT_DIAG.markBootOk();
      }
    } catch (_) {}

    // Give the engine one frame to paint the menu before we remove the overlay.
    BootLoader.setProgress(100, 'Ready');
    await BootLoader.nextFrame();
    mark('readyPaint');
    BootLoader.hide();
    mark('loaderHidden');

    try {
      boot.ok = true;
      boot.endedAt = Date.now();
      mark('end');

      const step = (a, b) => {
        const x = boot.steps[a];
        const y = boot.steps[b];
        if (typeof x !== 'number' || typeof y !== 'number') return null;
        const ms = y - x;
        return Number.isFinite(ms) ? Math.round(ms) : null;
      };

      boot.durations = {
        firstPaintMs: step('loaderShown', 'afterFirstPaint'),
        preflightMs: step('preflightStart', 'preflightEnd'),
        prefetchMs: step('prefetchStart', 'prefetchEnd'),
        importMs: step('importStart', 'importEnd'),
        readyPaintMs: step('importEnd', 'readyPaint'),
        totalMs: step('start', 'end')
      };

      safeStorageSet(BOOT_METRICS_KEY, _safeJsonStringify(boot), { action: 'bootMetrics' });
      try { window.__EW_BOOT_METRICS__ = boot; } catch (_) {}
    } catch (_) {}
  } catch (e) {
    // Enhanced error logging with file/line information
    const errorMsg = e && e.message ? e.message : String(e);
    const errorStack = e && e.stack ? e.stack : '';
    
    // For ES module syntax errors, the browser doesn't provide a detailed stack trace
    // because the error occurs during parsing, not execution.
    // The stack will typically just be "SyntaxError: <message>" with no file info.
    
    let fileLocation = 'unknown';
    let isSyntaxError = errorMsg.includes('Unexpected token') || errorMsg.includes('Unexpected end') || e.name === 'SyntaxError';
    
    // Try to parse the stack to find files OTHER than bootstrap/boot files
    if (errorStack) {
      const lines = errorStack.split('\n');
      const relevantFiles = [];
      
      for (const line of lines) {
        // Skip all boot infrastructure files
        if (line.includes('bootstrap.js') || 
            line.includes('bootDiagnostics.js') || 
            line.includes('userAcceptance.js') ||
            line.includes('bootLoader.js') ||
            line.includes('splashScreen.js') ||
            line.includes('safeStorage.js')) {
          continue;
        }
        
        // Match full URLs with line/col numbers
        const urlMatch = line.match(/(https?:\/\/[^\s)]+\.js)(?::(\d+):(\d+))?/);
        if (urlMatch) {
          const [, url, lineNum, col] = urlMatch;
          const fileName = url.split('/').pop();
          const location = lineNum ? `${fileName}:${lineNum}:${col}` : fileName;
          relevantFiles.push(location);
        }
      }
      
      // Use the first relevant file found
      if (relevantFiles.length > 0) {
        fileLocation = relevantFiles[0];
      }
    }
    
    // If we still don't have a file, check for fileName property (Firefox)
    if (fileLocation === 'unknown' && e.fileName) {
      const fileName = e.fileName.split('/').pop();
      const line = e.lineNumber || '';
      const col = e.columnNumber || '';
      fileLocation = line ? `${fileName}:${line}:${col}` : fileName;
    }
    
    console.error(`[bootstrap] ❌ Failed to load module`);
    console.error(`  Entry: ${entryUrl}`);
    if (fileLocation !== 'unknown') {
      console.error(`  📍 Location: ${fileLocation}`);
    } else if (isSyntaxError) {
      console.error(`  ⚠️  Syntax error in imported module (check browser DevTools > Sources tab)`);
    }
    console.error(`  Error: ${errorMsg}`);
    if (errorStack && errorStack.length > 100) {
      console.error(`  Stack trace:\n${errorStack}`);
    }
    
    // Provide helpful message for syntax errors where we can't determine the file
    let helpText = isSyntaxError && fileLocation === 'unknown'
      ? `\n⚠️  The error is in a module imported by ${entryUrl.split('/').pop()}.\nCheck browser DevTools > Sources or Network tab to find the file.`
      : '';
    
    alert(`Failed to load game module:\n\n` +
          `Entry: ${entryUrl}\n` +
          (fileLocation !== 'unknown' ? `📍 Location: ${fileLocation}\n` : '') +
          `Error: ${errorMsg}${helpText}\n\n` +
          `Check DevTools Console for details.`);
    BootLoader.hide();
    try {
      // Include the actual file location in the diagnostic push
      diagPush('scriptLoadError', { 
        src: String(entryUrl || ''), 
        version: version.id, 
        message: String(e && e.message ? e.message : e),
        location: fileLocation !== 'unknown' ? fileLocation : String(entryUrl || ''),
        stack: errorStack,
        isSyntaxError,
        note: isSyntaxError && fileLocation === 'unknown' ? 'Syntax error in imported module - check DevTools Sources tab' : undefined
      });
      if (window.PQ_BOOT_DIAG && window.PQ_BOOT_DIAG.renderOverlay) window.PQ_BOOT_DIAG.renderOverlay();
    } catch (_) {}
    BootLoader.hide();

    try {
      boot.ok = false;
      boot.error = String(e && e.message ? e.message : e);
      boot.endedAt = Date.now();
      mark('end');
      safeStorageSet(BOOT_METRICS_KEY, _safeJsonStringify(boot), { action: 'bootMetrics' });
      try { window.__EW_BOOT_METRICS__ = boot; } catch (_) {}
    } catch (_) {}
    if (typeof onFail === 'function') onFail(e);
  }
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

  try { modal.dataset.owner = "bootstrap"; modal.dataset.lock = "0"; } catch (_) {}

  modal.classList.remove("hidden");
  modal.dataset.bootstrapOpen = "1";
}

function hideBootstrapModal() {
  const { modal, body } = getModalEls();
  if (!modal) return;

  // Don’t close if someone else locked the modal (acceptance gate).
  try {
    if (modal.dataset.lock === "1" && modal.dataset.owner && modal.dataset.owner !== "bootstrap") return;
  } catch (_) {}

  // Only close what we opened (so we don’t fight game code if it opens its own modal)
  if (modal.dataset.bootstrapOpen === "1" && (!modal.dataset.owner || modal.dataset.owner === "bootstrap")) {
    modal.classList.add("hidden");
    modal.dataset.bootstrapOpen = "0";
    try { if (modal.dataset.owner === "bootstrap") modal.dataset.owner = ""; } catch (_) {}
    if (body) body.innerHTML = "";
  }
}

/* --------------------------- version picker UI --------------------------- */

function openVersionModal({ requirePick = false } = {}) {
  // If only one build exists, there is nothing to pick.
  const only = getOnlyVersionIfSingle();
  if (only) return;

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
    btn.className = (picked && v.id === picked.id) ? "btn primary" : "btn outline";
    btn.textContent = v.label;

    btn.addEventListener("click", () => {
      safeStorageSet(STORAGE_KEY, v.id);
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

function removeChangeVersionButtonIfPresent() {
  const existing = document.getElementById(BTN_ID);
  if (existing) existing.remove();
}

function ensureChangeVersionButton() {
  // Only show if there are multiple versions.
  if (!Array.isArray(VERSIONS) || VERSIONS.length <= 1) {
    removeChangeVersionButtonIfPresent();
    return;
  }

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
  onDocReady(async () => {
    // Start splash screen and game loading in parallel
    // This ensures the game loads during the splash screen display
    const splashPromise = showSplashSequence();
    
    // Start preparing for game load immediately
    const loadPromise = (async () => {
      // Show boot loader (it will be hidden behind splash initially)
      BootLoader.show('Starting…');
      await BootLoader.nextFrame();

      // Wire HUD/modal pill tap highlight immediately (before game module loads)
      // so feedback is consistent across early boot and in-game overlays.
      wirePillTapHighlight();

      // If only one build exists: auto-load it and don't show the Change Version button.
      const only = getOnlyVersionIfSingle();
      if (only) {
        removeChangeVersionButtonIfPresent();
        // Keep localStorage consistent (optional but helpful for debugging)
        safeStorageSet(STORAGE_KEY, only.id);
        await loadGameVersion(only);
        return;
      }

      // Multiple builds: show the Change Version button.
      ensureChangeVersionButton();

      const pickedId = pickVersionId();
      const picked = VERSIONS.find(v => v.id === pickedId);

      // If query param used and valid, persist it so it "sticks"
      const url = new URL(location.href);
      const q = url.searchParams.get("v");
      if (q && picked) safeStorageSet(STORAGE_KEY, picked.id);

      if (picked) {
        await loadGameVersion(picked, { onFail: () => openVersionModal({ requirePick: true }) });
      } else {
        // Force first-time selection (cleanest when you're managing multiple builds)
        BootLoader.hide();
        openVersionModal({ requirePick: true });
      }
    })();

    // Wait for splash to finish (either by completion or user skip)
    await splashPromise;
    
    // Then wait for game loading to complete
    await loadPromise;
  });
}


initBootstrap();