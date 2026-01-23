# Boot System

The **boot** folder contains Emberwood's initialization and bootstrap infrastructure. This code runs **before** the game engine loads, handling critical early-stage tasks like storage validation, user acceptance, splash screens, error diagnostics, and progressive loading.

---

## 📋 Overview

The boot system is the first JavaScript layer that executes when the game loads. It ensures a smooth, reliable startup experience by:

1. **Showing splash screens** (studio/engine logos)
2. **Tracking module imports** for better error reporting
3. **Validating browser storage** availability
4. **Enforcing user acceptance** of terms before gameplay
5. **Displaying loading progress** with a visual loader
6. **Diagnosing boot failures** and providing detailed error reports
7. **Loading the game entry point** with proper error handling

---

## 🗂️ File Structure

```
js/boot/
├── bootstrap.js          # Main orchestrator - coordinates entire boot sequence
├── bootLoader.js         # Loading screen UI with progress bar
├── bootDiagnostics.js    # Error capture and diagnostic overlay
├── splashScreen.js       # Studio and engine logo sequence
├── userAcceptance.js     # Terms & conditions acceptance gate
├── importTracker.js      # Module load tracking for debugging
├── lib/
│   └── safeStorage.js    # Storage helpers (re-exports from shared)
└── README.md             # This file
```

---

## 🔄 Boot Sequence

The boot process follows this flow:

```
1. index.html loads
   ↓
2. bootDiagnostics.js installs error handlers (IMMEDIATELY)
   ↓
3. userAcceptance.js checks if user has accepted terms
   ↓
4. bootstrap.js starts (main coordinator)
   ↓
5. splashScreen.js shows studio/engine logos (parallel with game load)
   ↓
6. bootLoader.js displays progress bar
   ↓
7. importTracker.js wraps module imports for better error context
   ↓
8. Preflight checks (optional): validates module graph
   ↓
9. Asset prefetch: warms HTTP cache for critical assets
   ↓
10. Game entry point loaded (js/game/main.js)
   ↓
11. Boot loader hidden, game initializes
```

**Timing Target:** Total boot to interactive < 1000ms

---

## 📄 File Descriptions

### bootstrap.js

**Purpose:** Main boot orchestrator that coordinates the entire startup sequence.

**Key Responsibilities:**
- Manages version selection (if multiple builds exist)
- Shows/hides boot loader with progress updates
- Runs optional preflight checks to validate module files
- Prefetches critical assets (audio files) to warm HTTP cache
- Loads game entry module via dynamic import or script tag
- Handles boot errors with detailed diagnostics
- Records boot performance metrics for QA/debugging
- Wires up pill tap highlights for HUD elements

**Key Functions:**
- `loadGameVersion()` - Loads a specific game version
- `preflightModuleGraph()` - Validates all module files exist
- `prefetchAssets()` - Warms HTTP cache for assets
- `pickVersionId()` - Determines which version to load
- Boot metrics tracking and persistence

**Entry Point:** Auto-executes `initBootstrap()` on load

**Dependencies:** bootLoader, splashScreen, importTracker, userAcceptance, safeStorage

---

### bootLoader.js

**Purpose:** Manages the visual loading overlay with progress bar.

**Key Features:**
- Lightweight, dependency-free loading UI
- Progress bar (0-100%)
- Text status updates
- Frame-perfect timing with `requestAnimationFrame`

**API:**
```javascript
BootLoader.show('Loading…')           // Show loader with message
BootLoader.setProgress(50, 'Assets…') // Update progress & message
BootLoader.hide()                      // Hide loader
BootLoader.nextFrame()                 // Promise that resolves next frame
```

**Usage Pattern:**
```javascript
BootLoader.show('Starting…');
await BootLoader.nextFrame();  // Let it paint
BootLoader.setProgress(30, 'Loading assets…');
// ... do work ...
BootLoader.hide();
```

**Dependencies:** None (pure DOM manipulation)

---

### bootDiagnostics.js

**Purpose:** Captures early load errors and provides diagnostic overlay for debugging.

**Key Features:**
- Installs **global error handlers** before anything else runs
- Tracks all errors during boot window (~8 seconds)
- Parses stack traces to identify actual failing file (not just bootstrap.js)
- Renders diagnostic overlay with error summary and full report
- Persists errors to localStorage for bug reports
- Integrates with window.PQ_BOOT_DIAG global

**Error Types Tracked:**
- `error` - Uncaught JavaScript errors
- `unhandledrejection` - Unhandled Promise rejections
- `scriptLoadError` - Module load failures
- `preflight` - Preflight validation failures

**Diagnostic Overlay:**
Shows when boot fails with:
- Error count and type
- File location (📍 with line:col)
- Error message and stack trace
- Copy/Clear/Close actions

**Key Functions:**
- `installBootDiagnostics()` - Sets up error handlers (auto-executes)
- `diag.markBootOk()` - Marks boot as successful
- `diag.renderOverlay()` - Shows diagnostic overlay
- `diag.buildReport()` - Generates JSON bug report

**Global API:**
```javascript
window.PQ_BOOT_DIAG.show()     // Manually show overlay
window.PQ_BOOT_DIAG.report()   // Get JSON report
```

**Dependencies:** None (must be first to load)

---

### splashScreen.js

**Purpose:** Displays studio and engine logos in a smooth sequence before game loads.

**Sequence:**
1. Show studio logo (2 seconds)
2. Fade out studio logo (0.8 seconds)
3. Show engine logo (2 seconds)
4. Fade out engine logo (0.8 seconds)
5. Fade out entire splash screen (0.6 seconds)

**User Interaction:**
- Click or tap anywhere to skip the splash sequence
- Splash runs in **parallel** with game loading for efficiency

**Timing Constants:**
```javascript
STUDIO_DISPLAY_TIME = 2000ms
ENGINE_DISPLAY_TIME = 2000ms
FADE_DURATION = 800ms
```

**API:**
```javascript
await showSplashSequence()  // Show splash, resolves when done/skipped
hideSplashImmediate()       // Immediately hide splash
```

**Dependencies:** None (pure DOM animation)

---

### userAcceptance.js

**Purpose:** Enforces user acceptance of terms and legal notice before gameplay.

**Key Features:**
- **Dual acceptance:** User must accept both Terms AND Legal Notice
- **Scroll-to-unlock:** Each checkbox unlocks only after scrolling that document to the bottom
- **Persistent storage:** Acceptance stored in localStorage
- **Version-gated:** Bump `ACCEPTANCE_VERSION` to require re-acceptance
- **Modal lock:** Prevents closing modal until accepted
- **Button gating:** Blocks New Game, Load Game, Start Game buttons

**Acceptance Flow:**
1. Check if user has accepted current version
2. If not accepted, show modal with two panels
3. User must scroll each panel to bottom
4. Checkboxes unlock when scrolled
5. User checks both boxes
6. User clicks "I Agree — Continue"
7. Acceptance record saved to localStorage

**Storage Key:** `pq_user_acceptance_v5`

**Key Functions:**
- `hasUserAccepted()` - Check if current version accepted
- `initUserAcceptanceGate()` - Install acceptance system (auto-executes)
- `resetUserAcceptance()` - Clear acceptance (for debugging)

**Global API:**
```javascript
window.PQ_ACCEPT.hasUserAccepted()    // Check acceptance status
window.PQ_ACCEPT.resetUserAcceptance() // Clear acceptance
```

**Dependencies:** safeStorage

---

### importTracker.js

**Purpose:** Tracks module imports to provide better error context when imports fail.

**Problem Solved:**
When a module import fails due to a syntax error in a deeply nested file, the browser error often points to `bootstrap.js` instead of the actual failing file. This tracker identifies the real culprit.

**How It Works:**
1. Uses `PerformanceObserver` to track all `.js` file loads
2. Takes snapshot of loaded modules before each import
3. Compares snapshots after import to find newly loaded modules
4. If import fails, the last loaded module is likely the culprit
5. Enhances error with `actualFile` property

**API:**
```javascript
await trackedImport(url)  // Wrapped import() with tracking
getImportChain()          // Get full import history
```

**Enhanced Error Properties:**
```javascript
{
  originalError: Error,
  importUrl: 'js/game/main.js',
  actualFile: 'combat.js:45:12',  // The real failing file!
  importChain: ['main.js', 'combat.js', ...]
}
```

**Dependencies:** None (uses browser Performance API)

---

### lib/safeStorage.js

**Purpose:** Early-boot storage helpers that safely handle localStorage.

**What It Does:**
Re-exports storage utilities from `js/shared/storage/safeStorage.js` so boot code can safely access localStorage without dealing with quota errors, private mode, or browser restrictions.

**API:**
```javascript
safeStorageGet(key)              // Get item, returns null on error
safeStorageSet(key, value, opts) // Set item, handles errors gracefully
safeStorageRemove(key)           // Remove item safely
```

**Dependencies:** `js/shared/storage/safeStorage.js`

---

## 🎯 Design Principles

### 1. **Fail-Safe Boot**
If any non-critical step fails (prefetch, preflight), boot continues. Only module load failures block the game.

### 2. **Progressive Enhancement**
- Splash screen runs in parallel with loading (not blocking)
- Preflight checks are optional (skip on file:// protocol)
- Asset prefetch is non-fatal (some environments block fetch)

### 3. **Error Context First**
Every error is enriched with actual file location, stack trace, and import chain so developers can fix issues quickly.

### 4. **Zero Dependencies**
Boot code has minimal dependencies to avoid circular import issues. Most files are self-contained.

### 5. **Performance Metrics**
Boot timing is tracked at every step and persisted to localStorage for QA analysis and bug reports.

### 6. **Graceful Degradation**
Works across environments: local dev, static hosting, file:// protocol, iOS Safari, etc.

---

## 🛠️ Common Tasks

### Add a New Boot Step

Edit `bootstrap.js` and add your step in `loadGameVersion()`:

```javascript
// Example: Add a custom validation step
mark('customCheckStart');
BootLoader.setProgress(25, 'Running custom check…');
await myCustomCheck();
mark('customCheckEnd');
```

### Change Splash Timing

Edit timing constants in `splashScreen.js`:

```javascript
const STUDIO_DISPLAY_TIME = 2000;  // Studio logo duration
const ENGINE_DISPLAY_TIME = 2000;  // Engine logo duration
const FADE_DURATION = 800;         // Fade transition time
```

### Force Re-Acceptance of Terms

Bump the version in `userAcceptance.js`:

```javascript
const ACCEPTANCE_VERSION = "6.0.0";  // Users must re-accept
```

### Debug Boot Failures

1. Open browser DevTools Console
2. Look for `[bootstrap]` logs with file locations
3. Or manually show diagnostic overlay:
   ```javascript
   PQ_BOOT_DIAG.show()
   ```
4. Click "Copy Report" to get JSON for bug reports

### Skip Preflight Checks (Faster Boot)

Preflight is disabled by default. To enable:
- Add `?preflight=1` to URL
- Or set `pq-last-boot-errors` in localStorage (auto-enables)

---

## 🔍 Debugging

### Boot Diagnostics

The diagnostic system captures errors automatically. Access it via console:

```javascript
// Show diagnostic overlay
PQ_BOOT_DIAG.show()

// Get error report as JSON
PQ_BOOT_DIAG.report()

// Check if boot succeeded
PQ_BOOT_DIAG.bootOk  // true if game loaded successfully
```

### Boot Metrics

After boot completes, inspect performance metrics:

```javascript
window.__EW_BOOT_METRICS__
// {
//   patch: "1.2.86",
//   entry: "http://localhost:8000/js/game/main.js",
//   startedAt: 1234567890,
//   ok: true,
//   durations: {
//     firstPaintMs: 15,
//     preflightMs: null,
//     prefetchMs: 234,
//     importMs: 456,
//     readyPaintMs: 12,
//     totalMs: 850
//   }
// }
```

### Common Issues

**"Preflight detected missing modules"**
- A file in your module graph is missing or returns 404
- Check the diagnostic overlay for the missing file list
- Verify all imports use correct paths with `.js` extension

**"Module script load failed"**
- Syntax error in imported module
- Check diagnostic overlay for actual file location (📍)
- Look at browser DevTools > Sources tab for syntax errors

**"Splash screen elements not found"**
- Missing `#splashScreen`, `#studioLogo`, or `#engineLogo` in HTML
- Splash will be skipped with a console warning

**"User acceptance modal not showing"**
- Check if acceptance record exists in localStorage
- Clear with: `PQ_ACCEPT.resetUserAcceptance()`

---

## 🚀 Performance

### Current Targets

| Metric | Target | Typical |
|--------|--------|---------|
| First paint | < 20ms | ~15ms |
| Prefetch | < 300ms | ~234ms |
| Module import | < 500ms | ~456ms |
| Total boot | < 1000ms | ~850ms |

### Optimization Tips

1. **Keep boot code minimal** - Don't add heavy logic to boot files
2. **Use async/parallel** - Splash and loading run in parallel
3. **Prefetch smartly** - Only prefetch assets needed in first 5 seconds
4. **Skip preflight** - Disabled by default for faster boot
5. **Lazy load** - Don't import game systems until after boot

---

## 📚 Related Documentation

- **Main README:** `/README.md` - Full project documentation
- **Architecture:** See "Boot Sequence" section in main README
- **Engine Layer:** `/js/engine/` - Core game engine
- **Game Layer:** `/js/game/` - Game-specific code

---

## 🤝 Contributing

When modifying boot code:

1. **Test all browsers** - Chrome, Firefox, Safari (especially iOS)
2. **Test file:// protocol** - Some APIs behave differently
3. **Test error cases** - Break a module import to verify diagnostics work
4. **Check performance** - Boot should stay under 1000ms
5. **Update this README** - Document your changes

---

## 📝 Version History

- **v1.2.86** - Separated boot diagnostics into dedicated file, enhanced error location detection
- **v1.2.72** - Added lightweight boot loader with progress API
- **v1.2.42** - Added journal pill tap highlight
- Earlier - Initial boot system with splash, acceptance, and diagnostics

---

**Questions?** Check the main project README or open an issue on GitHub.
