// bootstrap.js (FULL, no placeholders)

const VERSIONS = [
  // ✅ If your main entry file is /game.js
  { id: "main", label: "Main", src: "./game.js" },

  // Optional: keep your old Core version if it exists
  { id: "core", label: "Core", src: "./Core/game.js" },

  // Optional: another dev build
  { id: "dev", label: "Dev", src: "./game_v2.js" },
];

const STORAGE_KEY = "selected_game_version";
const GAME_SCRIPT_ID = "game-entry-module";

window.addEventListener("load", () => {
  const savedId = localStorage.getItem(STORAGE_KEY);
  const saved = VERSIONS.find(v => v.id === savedId);

  if (saved) {
    loadGameVersion(saved, {
      onFail: () => showVersionPicker(), // if saved path is bad, show selector
    });
    addChangeVersionButton(); // lets you switch later
    return;
  }

  showVersionPicker();
});

function loadGameVersion(version, { onFail } = {}) {
  // Remove any previously injected game module
  const existing = document.getElementById(GAME_SCRIPT_ID);
  if (existing) existing.remove();

  const s = document.createElement("script");
  s.id = GAME_SCRIPT_ID;
  s.type = "module";
  s.src = version.src;

  s.onload = () => {
    console.log("[bootstrap] Loaded:", version.src);
  };

  s.onerror = () => {
    console.error("[bootstrap] Failed to load:", version.src);
    alert(`Failed to load ${version.src}\n\nOpen DevTools Console for details.`);
    if (typeof onFail === "function") onFail();
  };

  document.head.appendChild(s);
}

function showVersionPicker() {
  // If already shown, don’t duplicate
  if (document.getElementById("versionOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "versionOverlay";
  overlay.className = "version-overlay";

  const panel = document.createElement("div");
  panel.className = "version-panel";

  const title = document.createElement("div");
  title.className = "version-title";
  title.textContent = "Select Game Version";

  const hint = document.createElement("div");
  hint.className = "version-hint";
  hint.textContent = "This will be remembered on this device.";

  const list = document.createElement("div");
  list.className = "version-list";

  VERSIONS.forEach(v => {
    const btn = document.createElement("button");
    btn.className = "btn outline";
    btn.textContent = v.label;

    btn.addEventListener("click", () => {
      localStorage.setItem(STORAGE_KEY, v.id);
      overlay.remove();
      loadGameVersion(v);
      addChangeVersionButton();
    });

    list.appendChild(btn);
  });

  panel.appendChild(title);
  panel.appendChild(hint);
  panel.appendChild(list);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

function addChangeVersionButton() {
  // Add only once
  if (document.getElementById("btnChangeVersion")) return;

  const btn = document.createElement("button");
  btn.id = "btnChangeVersion";
  btn.className = "btn outline version-change-btn";
  btn.type = "button";
  btn.textContent = "Change version";

  btn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  document.body.appendChild(btn);
}
