// importTracker.js
// Tracks module imports to provide better error context when imports fail
// Track all module loads via Performance Observer
let moduleLoadAttempts = [];
// Set up Performance Observer to track module loads
if (typeof PerformanceObserver !== 'undefined') {
    try {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.name.endsWith('.js') && entry.initiatorType === 'script') {
                    moduleLoadAttempts.push({
                        url: entry.name,
                        startTime: entry.startTime,
                        duration: entry.duration,
                        transferSize: entry.transferSize
                    });
                    // Keep only last 50 attempts
                    if (moduleLoadAttempts.length > 50) {
                        moduleLoadAttempts.shift();
                    }
                }
            }
        });
        observer.observe({ entryTypes: ['resource'] });
    }
    catch (e) {
        console.warn('[importTracker] Could not set up PerformanceObserver:', e.message);
    }
}
/**
 * Enhanced import wrapper that tracks module loads and provides better error reporting
 * @param {string} url - The module URL to import
 * @returns {Promise} - The imported module
 */
export async function trackedImport(url) {
    // Track the import attempt
    const importAttempt = {
        url,
        timestamp: Date.now()
    };
    if (window.PQ_BOOT_DIAG) {
        window.PQ_BOOT_DIAG.lastImportAttempt = importAttempt;
    }
    // Get snapshot of currently loaded modules before import
    const modulesBefore = moduleLoadAttempts.map(m => m.url);
    try {
        const module = await import(url);
        // Track successful import
        if (window.PQ_BOOT_DIAG) {
            if (!window.PQ_BOOT_DIAG.successfulImports) {
                window.PQ_BOOT_DIAG.successfulImports = [];
            }
            window.PQ_BOOT_DIAG.successfulImports.push({
                url,
                timestamp: Date.now()
            });
        }
        return module;
    }
    catch (error) {
        // Get snapshot of modules loaded AFTER the failed import attempt
        // Any new modules that appeared are part of the import chain
        const modulesAfter = moduleLoadAttempts.map(m => m.url);
        const newModules = modulesAfter.filter(m => !modulesBefore.includes(m));
        // The most recently loaded module is likely where the error occurred
        let actualFile = null;
        if (newModules.length > 0) {
            const lastModule = newModules[newModules.length - 1];
            actualFile = lastModule.split('/').pop();
            console.log(`[importTracker] 📍 Detected failed module: ${actualFile}`);
        }
        // Enhanced error reporting
        const enhancedError = new Error(error.message);
        enhancedError.originalError = error;
        enhancedError.importUrl = url;
        enhancedError.stack = error.stack;
        enhancedError.actualFile = actualFile;
        enhancedError.importChain = newModules;
        // Track failed import
        if (window.PQ_BOOT_DIAG) {
            if (!window.PQ_BOOT_DIAG.failedImports) {
                window.PQ_BOOT_DIAG.failedImports = [];
            }
            window.PQ_BOOT_DIAG.failedImports.push({
                url,
                actualFile: actualFile || url,
                error: error.message,
                timestamp: Date.now(),
                importChain: newModules
            });
        }
        throw enhancedError;
    }
}
/**
 * Get import chain for debugging
 * @returns {Object} - Import tracking information
 */
export function getImportChain() {
    if (!window.PQ_BOOT_DIAG) {
        return {
            lastImportAttempt: null,
            successfulImports: [],
            failedImports: [],
            moduleLoadAttempts: []
        };
    }
    return {
        lastImportAttempt: window.PQ_BOOT_DIAG.lastImportAttempt || null,
        successfulImports: window.PQ_BOOT_DIAG.successfulImports || [],
        failedImports: window.PQ_BOOT_DIAG.failedImports || [],
        moduleLoadAttempts: moduleLoadAttempts
    };
}
//# sourceMappingURL=importTracker.js.map