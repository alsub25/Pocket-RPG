// js/game/plugins/screenAssetPreloadPlugin.js
// Preloads asset groups when entering screens/modals.
// Uses engine.uiCompose for busy/progress messaging and engine.schedule owners.
function _str(x) {
    try {
        return String(x || '');
    }
    catch (_) {
        return '';
    }
}
function _hasGroup(assets, groupId) {
    try {
        const groups = assets?.listGroups?.() || [];
        return groups.some(g => g && String(g.group) === String(groupId));
    }
    catch (_) {
        return false;
    }
}
export function createScreenAssetPreloadPlugin({ 
// optional mapping: screen name -> group id
screenGroup = (screen) => 'screen:' + String(screen || ''), 
// optional mapping: modal owner -> group id
modalGroup = (owner) => String(owner || ''), 
// optional mapping: area id -> group id
areaGroup = (area) => 'area:' + String(area || ''), 
// UX strings
labelForGroup = (groupId) => {
    const g = String(groupId || '');
    if (g.startsWith('screen:'))
        return 'Loading ' + g.slice('screen:'.length) + '…';
    if (g.startsWith('modal:'))
        return 'Loading ' + g.slice('modal:'.length) + '…';
    if (g.startsWith('area:'))
        return 'Loading ' + g.slice('area:'.length) + '…';
    if (g)
        return 'Loading…';
    return 'Working…';
} } = {}) {
    return {
        id: 'ew.screenAssetPreload',
        requires: ['ew.assetsManifest', 'ew.uiComposeBridge'],
        start(engine) {
            const assets = engine?.getService?.('assets') || engine?.assets;
            const ui = engine?.getService?.('uiCompose') || engine?.uiCompose;
            const schedule = engine?.getService?.('schedule') || engine?.schedule;
            if (!engine || !assets || !ui)
                return;
            let active = null;
            const loadedGroups = new Set();
            const inflightGroups = new Set();
            let prewarmInProgress = true;
            const show = (text, done, total) => {
                try {
                    const pct = (total && total > 0) ? Math.max(0, Math.min(1, done / total)) : null;
                    ui.setBusy(true, { text, progress: (pct == null ? null : pct) });
                }
                catch (_) { }
            };
            const hide = () => { try {
                ui.setBusy(false, {});
            }
            catch (_) { } };
            const begin = async (groupId) => {
                const g = _str(groupId);
                if (!g)
                    return;
                if (!_hasGroup(assets, g))
                    return;
                // Only preload each group once per session; prevents "re-loading" overlays on every click.
                if (loadedGroups.has(g))
                    return;
                if (inflightGroups.has(g))
                    return;
                inflightGroups.add(g);
                // Cancel prior preload UI.
                active = { group: g, done: 0, total: 0 };
                show(labelForGroup(g), 0, 0);
                try {
                    // Warm cache; assets service will emit progress events.
                    await assets.preloadGroup(g);
                    loadedGroups.add(g);
                }
                catch (_) {
                    // Even if something fails, don't spam the user with repeated "loading" overlays.
                    loadedGroups.add(g);
                }
                finally {
                    inflightGroups.delete(g);
                }
            };
            const onProgress = (evt) => {
                try {
                    if (!active)
                        return;
                    const g = _str(evt?.group);
                    if (!g || g !== active.group)
                        return;
                    active.done = Number(evt?.done || 0);
                    active.total = Number(evt?.total || 0);
                    show(labelForGroup(g), active.done, active.total);
                    if (active.total > 0 && active.done >= active.total) {
                        // Defer hide slightly to avoid flash.
                        const owner = 'system:assetPreload';
                        try {
                            schedule?.cancelOwner?.(owner);
                        }
                        catch (_) { }
                        try {
                            schedule?.after?.(80, () => { hide(); active = null; }, { owner });
                        }
                        catch (_) {
                            hide();
                            active = null;
                        }
                    }
                }
                catch (_) { }
            };
            // Track progress events.
            try {
                engine.listen('system:assetPreload', 'assets:progress', onProgress);
            }
            catch (_) { }
            // Kick when entering screens.
            try {
                engine.listen('system:assetPreload', 'screen:enter', (evt) => {
                    if (prewarmInProgress)
                        return;
                    const screen = _str(evt?.screen);
                    if (!screen)
                        return;
                    const groupId = screenGroup(screen);
                    begin(groupId);
                });
            }
            catch (_) { }
            // Kick when opening modals.
            try {
                engine.listen('system:assetPreload', 'modal:open', (evt) => {
                    if (prewarmInProgress)
                        return;
                    const owner = _str(evt?.owner);
                    if (!owner)
                        return;
                    const groupId = modalGroup(owner);
                    begin(groupId);
                });
            }
            catch (_) { }
            // Kick when entering areas (the live game runs multiple areas inside a single screen).
            try {
                engine.listen('system:assetPreload', 'area:enter', (evt) => {
                    if (prewarmInProgress)
                        return;
                    const area = _str(evt?.area);
                    if (!area)
                        return;
                    const groupId = areaGroup(area);
                    begin(groupId);
                });
            }
            catch (_) { }
            // Prewarm all declared groups at boot so the game only "loads" once at launch.
            // After this completes, reactive screen/modal/area preloads are suppressed by the loadedGroups cache.
            const prewarmAll = async () => {
                try {
                    const all = (assets?.listGroups?.() || []).map(g => _str(g?.group)).filter(Boolean);
                    if (!all.length) {
                        prewarmInProgress = false;
                        return;
                    }
                    // Deduplicate while preserving order.
                    const seen = new Set();
                    const groupsToWarm = [];
                    for (const g of all) {
                        if (seen.has(g))
                            continue;
                        seen.add(g);
                        groupsToWarm.push(g);
                    }
                    // Single startup overlay.
                    active = { group: '__prewarm__', done: 0, total: groupsToWarm.length };
                    show('Loading game assets…', 0, groupsToWarm.length);
                    for (let i = 0; i < groupsToWarm.length; i++) {
                        const g = groupsToWarm[i];
                        try {
                            // Update progress by group (keeps UI stable even if assets service emits no progress).
                            show(labelForGroup(g), i, groupsToWarm.length);
                            inflightGroups.add(g);
                            await assets.preloadGroup(g);
                        }
                        catch (_) {
                            // Ignore; warm as much as we can.
                        }
                        finally {
                            inflightGroups.delete(g);
                            loadedGroups.add(g);
                        }
                    }
                }
                catch (_) {
                    // Ignore boot preload errors.
                }
                finally {
                    try {
                        hide();
                    }
                    catch (_) { }
                    active = null;
                    prewarmInProgress = false;
                }
            };
            // Run after the first paint so the UI can render before heavy parsing.
            try {
                const owner = 'system:assetPreload';
                schedule?.after?.(0, () => { prewarmAll(); }, { owner });
            }
            catch (_) {
                try {
                    Promise.resolve().then(() => prewarmAll());
                }
                catch (_) {
                    prewarmAll();
                }
            }
        },
        stop(engine) {
            try {
                engine?.disposeOwner?.('system:assetPreload');
            }
            catch (_) { }
        },
        dispose(engine) {
            try {
                engine?.disposeOwner?.('system:assetPreload');
            }
            catch (_) { }
        }
    };
}
//# sourceMappingURL=screenAssetPreloadPlugin.js.map