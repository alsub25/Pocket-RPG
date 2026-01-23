// bootLoader.js
// Patch 1.2.72: lightweight boot overlay + progress API.
const LOADER_ID = 'bootLoader';
const FILL_ID = 'bootLoaderFill';
const TEXT_ID = 'bootLoaderText';
function _el(id) {
    try {
        return document.getElementById(id);
    }
    catch (_) {
        return null;
    }
}
function ensure() {
    const root = _el(LOADER_ID);
    if (!root)
        return { root: null, fill: null, text: null };
    return { root, fill: _el(FILL_ID), text: _el(TEXT_ID) };
}
function show(msg = 'Loading…') {
    const { root, text } = ensure();
    if (!root)
        return;
    root.classList.remove('hidden');
    try {
        root.setAttribute('aria-busy', 'true');
    }
    catch (_) { }
    if (text)
        text.textContent = msg;
}
function setProgress(pct, msg) {
    const { root, fill, text } = ensure();
    if (!root)
        return;
    const p = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
    if (fill)
        fill.style.width = `${p}%`;
    if (typeof msg === 'string' && msg) {
        if (text)
            text.textContent = msg;
    }
}
function hide() {
    const { root } = ensure();
    if (!root)
        return;
    root.classList.add('hidden');
    try {
        root.setAttribute('aria-busy', 'false');
    }
    catch (_) { }
}
function nextFrame() {
    return new Promise((resolve) => {
        try {
            requestAnimationFrame(() => resolve());
        }
        catch (_) {
            setTimeout(resolve, 0);
        }
    });
}
export const BootLoader = {
    ensure,
    show,
    hide,
    setProgress,
    nextFrame,
};
//# sourceMappingURL=bootLoader.js.map