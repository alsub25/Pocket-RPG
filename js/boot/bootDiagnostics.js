// bootDiagnostics.js
// Patch 1.2.86: Separated boot diagnostics for easier maintenance
// Captures early load errors and renders diagnostic overlay with precise file locations

function _pqNowIso() {
  try { return new Date().toISOString(); } catch (_) { return String(Date.now()); }
}

// Get game patch version safely without importing from game modules
// (which may be broken when diagnostics are needed)
function getGamePatch() {
  try {
    // Try to get from window if already set
    if (window.__GAME_PATCH__) return window.__GAME_PATCH__;
    // Fallback to checking localStorage for last known version
    const lastBoot = localStorage.getItem('pq-last-boot-errors');
    if (lastBoot) {
      const data = JSON.parse(lastBoot);
      if (data.patch) return data.patch;
    }
  } catch (_) {}
  return '1.2.86'; // Fallback version
}

/**
 * Extract the actual file location from various error formats
 * Handles cases where the error is in an imported module
 */
function extractFileLocation(error, stack, message) {
  // Stack trace regex: matches "at <location> (file:line:col)" or "at file:line:col"
  const STACK_TRACE_REGEX = /at\s+(?:.*?\s+\()?([^):\s]+):(\d+):(\d+)/;
  
  // Try to extract from error message first (for syntax errors in imported modules)
  // Example: "Unexpected token ':'. Expected either a closing ']' or a ',' following an array element."
  // The actual file is often in the stack or can be inferred from the URL
  
  // Check if the message contains a file reference
  // Common patterns: "in file.js", "file.js:", etc.
  const messageFileMatch = message.match(/(?:in|at|from)\s+([^\s:]+\.js)/i);
  if (messageFileMatch) {
    return messageFileMatch[1];
  }
  
  // Parse the stack trace
  if (stack) {
    const stackMatch = stack.match(STACK_TRACE_REGEX);
    if (stackMatch) {
      return `${stackMatch[1]}:${stackMatch[2]}:${stackMatch[3]}`;
    }
  }
  
  // For error events, check filename
  if (error && error.filename) {
    const file = error.filename;
    const line = error.lineno || 0;
    const col = error.colno || 0;
    if (file) {
      return `${file}${line ? ':' + line : ''}${col ? ':' + col : ''}`;
    }
  }
  
  return 'unknown location';
}

/**
 * Parse error message to find actual file causing the issue
 * For module load errors, we need to look at the import chain
 */
function parseErrorMessage(message, stack, errorObj) {
  // For module syntax errors, the browser error message is generic
  // but we can infer the file from the context
  
  // Look for URLs in the stack trace - find the first non-bootstrap/boot file
  if (stack) {
    const lines = stack.split('\n');
    const fileUrls = [];
    
    for (const line of lines) {
      // Skip bootstrap, bootDiagnostics, and userAcceptance files
      if (line.includes('bootstrap.js') || 
          line.includes('bootDiagnostics.js') || 
          line.includes('userAcceptance.js') ||
          line.includes('bootLoader.js') ||
          line.includes('splashScreen.js')) {
        continue;
      }
      
      // Match full URLs in stack traces
      const fullUrlMatch = line.match(/(https?:\/\/[^\s)]+\.js)/);
      if (fullUrlMatch) {
        fileUrls.push(fullUrlMatch[1]);
      }
    }
    
    // If we found any non-boot files in the stack, use the first one
    if (fileUrls.length > 0) {
      const url = fileUrls[0];
      // Extract filename and line/col if present
      const parts = url.match(/([^/]+\.js)(?::(\d+):(\d+))?$/);
      if (parts) {
        const [, fileName, line, col] = parts;
        return line ? `${fileName}:${line}:${col}` : fileName;
      }
    }
  }
  
  // If errorObj has a fileName property (Firefox), use that
  if (errorObj && errorObj.fileName) {
    const fileName = errorObj.fileName.split('/').pop();
    const line = errorObj.lineNumber || '';
    const col = errorObj.columnNumber || '';
    return line ? `${fileName}:${line}:${col}` : fileName;
  }
  
  return null;
}

export function installBootDiagnostics() {
  if (typeof window === 'undefined') return;
  if (window.PQ_BOOT_DIAG && window.PQ_BOOT_DIAG.__installed) return;

  const diag = (window.PQ_BOOT_DIAG = window.PQ_BOOT_DIAG || {});
  diag.__installed = true;
  diag.startedAt = diag.startedAt || _pqNowIso();
  diag.errors = Array.isArray(diag.errors) ? diag.errors : [];

  // Boot overlay is meant for *launch-blocking* issues.
  if (typeof diag.bootOk !== 'boolean') diag.bootOk = false;
  if (typeof diag.bootWindowEndsAt !== 'number') diag.bootWindowEndsAt = Date.now() + 8000;
  diag._overlayShown = !!diag._overlayShown;

  diag.markBootOk = () => {
    try {
      diag.bootOk = true;
      diag.bootWindowEndsAt = 0;
    } catch (_) {}
  };

  const maybeAutoShowOverlay = () => {
    try {
      if (diag._overlayShown) return;
      if (diag.bootOk) return;
      if (diag.bootWindowEndsAt && Date.now() > diag.bootWindowEndsAt) return;
      diag._overlayShown = true;
      setTimeout(() => {
        try { if (diag.renderOverlay) diag.renderOverlay(); } catch (_) {}
      }, 0);
    } catch (_) {}
  };

  const push = (kind, payload) => {
    try {
      const entry = { t: _pqNowIso(), kind, ...payload };
      
      // Try to add location information if not already present
      if (!entry.location && kind === 'scriptLoadError' && payload.src) {
        entry.location = payload.src;
      }
      
      diag.errors.push(entry);
      if (diag.errors.length > 80) diag.errors.splice(0, diag.errors.length - 80);

      try {
        localStorage.setItem(
          'pq-last-boot-errors',
          JSON.stringify({
            startedAt: diag.startedAt,
            url: location.href,
            ua: navigator.userAgent,
            errors: diag.errors
          })
        );
      } catch (_) {}
    } catch (_) {}

    if (kind === 'error' || kind === 'unhandledrejection' || kind === 'scriptLoadError' || kind === 'preflight') {
      maybeAutoShowOverlay();
    }
  };

  window.addEventListener('error', (ev) => {
    const filename = ev.filename || '';
    const lineno = ev.lineno || 0;
    const colno = ev.colno || 0;
    const message = String(ev.message || 'Unknown error');
    const error = ev.error;
    
    // Try to extract the actual source URL from the error
    // For module syntax errors, the browser sometimes includes the URL in the error properties
    let location = filename ? `${filename}:${lineno}:${colno}` : 'unknown location';
    let actualFile = null;
    
    // Check if the error object has additional location info
    if (error && error.stack) {
      actualFile = parseErrorMessage(message, error.stack, error);
    }
    
    if (actualFile) {
      location = actualFile;
    }
    
    push('error', {
      message,
      filename,
      lineno,
      colno,
      location,
      displayMessage: actualFile || filename 
        ? `${message}\n  at ${location}`
        : message
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev && ev.reason;
    const message = reason && reason.message ? String(reason.message) : String(reason);
    const stack = reason && reason.stack ? String(reason.stack) : '';
    
    // Try to extract actual file location from stack trace
    let location = 'unknown location';
    let displayMessage = message;
    
    // Parse the stack to find the actual file (skip boot files)
    const actualFile = parseErrorMessage(message, stack);
    if (actualFile) {
      location = actualFile;
      displayMessage = `${message}\n  at ${location}`;
    } else if (stack) {
      // Fallback to original stack parsing
      const STACK_TRACE_REGEX = /at\s+(?:.*?\s+\()?([^):\s]+):(\d+):(\d+)/;
      const stackMatch = stack.match(STACK_TRACE_REGEX);
      if (stackMatch) {
        const [, file, line, col] = stackMatch;
        location = `${file}:${line}:${col}`;
        displayMessage = `${message}\n  at ${location}`;
      } else {
        const stackLines = stack.split('\n');
        if (stackLines.length > 1) {
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
    });
  });

  diag.buildReport = () => ({
    startedAt: diag.startedAt,
    url: (typeof location !== 'undefined' ? location.href : ''),
    ua: (typeof navigator !== 'undefined' ? navigator.userAgent : ''),
    errors: diag.errors
  });

  diag.renderOverlay = () => {
    try {
      const id = 'pq-boot-diag-overlay';
      if (document.getElementById(id)) return;

      const overlay = document.createElement('div');
      overlay.id = id;
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.zIndex = '999999';
      overlay.style.background = 'rgba(0,0,0,0.95)';
      overlay.style.color = '#fff';
      overlay.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
      overlay.style.padding = '20px';
      overlay.style.overflow = 'auto';
      overlay.style.WebkitOverflowScrolling = 'touch'; // Smooth scrolling on iOS

      const title = document.createElement('div');
      title.style.fontSize = '22px';
      title.style.fontWeight = '700';
      title.style.marginBottom = '12px';
      title.style.lineHeight = '1.3';
      title.textContent = `Boot Diagnostics (Patch ${getGamePatch()})`;
      overlay.appendChild(title);

      const sub = document.createElement('div');
      sub.style.fontSize = '14px';
      sub.style.opacity = '0.85';
      sub.style.marginBottom = '16px';
      sub.style.lineHeight = '1.5';
      sub.textContent = 'If the game fails to load, screenshot this overlay. Use Copy Report for a text bug report.';
      overlay.appendChild(sub);

      // Add error summary section if there are errors
      if (diag.errors && diag.errors.length > 0) {
        const errorSummary = document.createElement('div');
        errorSummary.style.background = 'rgba(220, 38, 38, 0.2)';
        errorSummary.style.border = '2px solid rgba(220, 38, 38, 0.5)';
        errorSummary.style.borderRadius = '8px';
        errorSummary.style.padding = '16px';
        errorSummary.style.marginBottom = '20px';
        
        const summaryTitle = document.createElement('div');
        summaryTitle.style.fontWeight = '700';
        summaryTitle.style.fontSize = '18px';
        summaryTitle.style.marginBottom = '12px';
        summaryTitle.style.color = '#fca5a5';
        summaryTitle.style.lineHeight = '1.3';
        summaryTitle.textContent = `${diag.errors.length} Error${diag.errors.length === 1 ? '' : 's'} Detected`;
        errorSummary.appendChild(summaryTitle);
        
        // Show last few errors with file locations prominently
        const recentErrors = diag.errors.slice(-3).reverse();
        recentErrors.forEach((err, idx) => {
          const errDiv = document.createElement('div');
          errDiv.style.marginBottom = idx < recentErrors.length - 1 ? '16px' : '0';
          errDiv.style.paddingBottom = idx < recentErrors.length - 1 ? '12px' : '0';
          errDiv.style.borderBottom = idx < recentErrors.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none';
          
          // Show error type
          const typeSpan = document.createElement('div');
          typeSpan.style.fontSize = '12px';
          typeSpan.style.opacity = '0.7';
          typeSpan.style.marginBottom = '6px';
          typeSpan.textContent = `[${err.kind}] ${err.t || ''}`;
          errDiv.appendChild(typeSpan);
          
          // Show file location prominently if available
          if (err.location && err.location !== 'unknown location') {
            const locDiv = document.createElement('div');
            locDiv.style.fontFamily = 'Monaco, Consolas, "Courier New", monospace';
            locDiv.style.fontSize = '16px';
            locDiv.style.fontWeight = '700';
            locDiv.style.color = '#fbbf24';
            locDiv.style.marginBottom = '8px';
            locDiv.style.lineHeight = '1.4';
            locDiv.style.wordBreak = 'break-all';
            locDiv.setAttribute('aria-label', `Location: ${err.location}`);
            locDiv.textContent = `📍  ${err.location}`;
            errDiv.appendChild(locDiv);
          }
          
          // Show message
          const msgDiv = document.createElement('div');
          msgDiv.style.fontFamily = 'Monaco, Consolas, "Courier New", monospace';
          msgDiv.style.fontSize = '14px';
          msgDiv.style.lineHeight = '1.5';
          msgDiv.style.whiteSpace = 'pre-wrap';
          msgDiv.style.wordBreak = 'break-word';
          msgDiv.style.color = '#e5e7eb';
          msgDiv.textContent = err.displayMessage || err.message || 'Unknown error';
          errDiv.appendChild(msgDiv);
          
          errorSummary.appendChild(errDiv);
        });
        
        overlay.appendChild(errorSummary);
      }

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.gap = '12px';
      actions.style.marginBottom = '20px';
      actions.style.flexWrap = 'wrap';

      const mkBtn = (label) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.padding = '12px 16px';
        b.style.fontSize = '15px';
        b.style.fontWeight = '600';
        b.style.borderRadius = '6px';
        b.style.border = '1px solid rgba(255,255,255,0.3)';
        b.style.background = 'rgba(255,255,255,0.1)';
        b.style.color = '#fff';
        b.style.cursor = 'pointer';
        b.style.minHeight = '44px'; // iOS touch target minimum
        b.style.minWidth = '90px';
        b.style.touchAction = 'manipulation'; // Prevent double-tap zoom
        return b;
      };

      const btnCopy = mkBtn('Copy Report');
      btnCopy.addEventListener('click', async () => {
        try {
          const payload = JSON.stringify(diag.buildReport(), null, 2);
          await navigator.clipboard.writeText(payload);
          btnCopy.textContent = 'Copied!';
          setTimeout(() => (btnCopy.textContent = 'Copy Report'), 900);
        } catch (_) {
          btnCopy.textContent = 'Copy failed';
          setTimeout(() => (btnCopy.textContent = 'Copy Report'), 1200);
        }
      });

      const btnClear = mkBtn('Clear');
      btnClear.addEventListener('click', () => {
        diag.errors = [];
        try { localStorage.removeItem('pq-last-boot-errors'); } catch (_) {}
        overlay.remove();
      });

      const btnClose = mkBtn('Close');
      btnClose.addEventListener('click', () => overlay.remove());

      actions.appendChild(btnCopy);
      actions.appendChild(btnClear);
      actions.appendChild(btnClose);
      overlay.appendChild(actions);

      // Collapsible JSON report section
      const jsonSection = document.createElement('details');
      jsonSection.style.marginTop = '16px';
      
      const jsonSummary = document.createElement('summary');
      jsonSummary.style.fontSize = '14px';
      jsonSummary.style.fontWeight = '600';
      jsonSummary.style.padding = '12px';
      jsonSummary.style.background = 'rgba(255,255,255,0.05)';
      jsonSummary.style.borderRadius = '6px';
      jsonSummary.style.cursor = 'pointer';
      jsonSummary.style.marginBottom = '8px';
      jsonSummary.textContent = 'Show Full Report (JSON)';
      jsonSection.appendChild(jsonSummary);
      
      const pre = document.createElement('pre');
      pre.style.whiteSpace = 'pre-wrap';
      pre.style.fontSize = '12px';
      pre.style.lineHeight = '1.5';
      pre.style.background = 'rgba(0,0,0,0.5)';
      pre.style.padding = '12px';
      pre.style.borderRadius = '6px';
      pre.style.overflow = 'auto';
      pre.textContent = JSON.stringify(diag.buildReport(), null, 2);
      jsonSection.appendChild(pre);
      
      overlay.appendChild(jsonSection);

      document.body.appendChild(overlay);
    } catch (_) {}
  };

  // Convenience: expose for quick console access
  try {
    window.PQ_BOOT_DIAG.show = diag.renderOverlay;
    window.PQ_BOOT_DIAG.report = diag.buildReport;
  } catch (_) {}
}

// Install as early as possible
installBootDiagnostics();
