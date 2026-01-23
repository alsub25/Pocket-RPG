// js/engine/tween.js
// Tween/animation service driven by the engine clock.
//
// Design goals:
// - One place for timed UI/game transitions (no scattered setTimeout/CSS races).
// - Owner-based cancellation to prevent leaks across screen/modal teardown.
// - Works in headless mode: if target isn't a DOM element, treat it as a plain object.
function _now(clock) {
    try {
        return Number(clock && clock.nowMs) || 0;
    }
    catch (_) {
        return 0;
    }
}
function _isEl(t) {
    try {
        return !!t && typeof t === 'object' && typeof t.style === 'object';
    }
    catch (_) {
        return false;
    }
}
function _lerp(a, b, t) { return a + (b - a) * t; }
const EASINGS = {
    linear: (t) => t,
    easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    easeOutCubic: (t) => 1 - Math.pow(1 - t, 3)
};
let _nextId = 1;
export function createTweenService({ clock = null, emit = null, logger = null } = {}) {
    const _tweens = new Map(); // id -> tween
    const _byOwner = new Map(); // owner -> Set<id>
    function _log(lvl, msg, data) {
        try {
            if (logger && logger[lvl])
                logger[lvl]('tween', msg, data);
        }
        catch (_) { }
    }
    function _registerOwner(owner, id) {
        const o = String(owner || '').trim();
        if (!o)
            return;
        const set = _byOwner.get(o) || new Set();
        set.add(id);
        _byOwner.set(o, set);
    }
    function _unregisterOwner(owner, id) {
        const o = String(owner || '').trim();
        if (!o)
            return;
        const set = _byOwner.get(o);
        if (!set)
            return;
        set.delete(id);
        if (set.size === 0)
            _byOwner.delete(o);
    }
    function cancel(id) {
        const t = _tweens.get(id);
        if (!t)
            return false;
        _tweens.delete(id);
        _unregisterOwner(t.owner, id);
        try {
            if (t.onCancel)
                t.onCancel();
        }
        catch (_) { }
        try {
            if (emit)
                emit('tween:cancel', { id });
        }
        catch (_) { }
        return true;
    }
    function cancelOwner(owner) {
        const o = String(owner || '').trim();
        if (!o)
            return 0;
        const set = _byOwner.get(o);
        if (!set || set.size === 0) {
            _byOwner.delete(o);
            return 0;
        }
        const ids = Array.from(set);
        let n = 0;
        for (let i = 0; i < ids.length; i++) {
            if (cancel(ids[i]))
                n++;
        }
        _byOwner.delete(o);
        return n;
    }
    function to(target, props, { ms = 250, easing = 'easeOutCubic', owner = null, onUpdate = null, onComplete = null, onCancel = null } = {}) {
        if (!target || !props || typeof props !== 'object')
            return null;
        const id = _nextId++;
        const startMs = _now(clock);
        const dur = Math.max(0, Number(ms) || 0);
        const ease = EASINGS[String(easing || 'easeOutCubic')] || EASINGS.easeOutCubic;
        const isEl = _isEl(target);
        const from = {};
        const toVals = {};
        // Supports either flat props (for object fields) or { style: { ... } } for DOM elements.
        const styleProps = props.style && typeof props.style === 'object' ? props.style : null;
        const flatProps = { ...props };
        if (styleProps)
            delete flatProps.style;
        try {
            Object.keys(flatProps).forEach(k => {
                const a = Number(target[k]);
                const b = Number(flatProps[k]);
                if (!Number.isFinite(a) || !Number.isFinite(b))
                    return;
                from[k] = a;
                toVals[k] = b;
            });
            if (isEl && styleProps) {
                Object.keys(styleProps).forEach(k => {
                    const rawA = target.style[k];
                    const a = Number(rawA);
                    const b = Number(styleProps[k]);
                    if (!Number.isFinite(b))
                        return;
                    // If current style isn't numeric, treat missing as 0.
                    from['style.' + k] = Number.isFinite(a) ? a : 0;
                    toVals['style.' + k] = b;
                });
            }
        }
        catch (e) {
            _log('warn', 'tween.to capture failed', { e });
        }
        const tween = {
            id,
            owner: owner ? String(owner) : '',
            target,
            isEl,
            startMs,
            dur,
            ease,
            from,
            to: toVals,
            onUpdate,
            onComplete,
            onCancel
        };
        _tweens.set(id, tween);
        if (tween.owner)
            _registerOwner(tween.owner, id);
        try {
            if (emit)
                emit('tween:start', { id, owner: tween.owner, ms: dur });
        }
        catch (_) { }
        return id;
    }
    function _apply(tween, alpha) {
        const t = tween.target;
        const keys = Object.keys(tween.to);
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            const a = tween.from[k];
            const b = tween.to[k];
            const v = _lerp(a, b, alpha);
            try {
                if (k.startsWith('style.')) {
                    const sk = k.slice(6);
                    if (t && t.style)
                        t.style[sk] = String(v);
                }
                else {
                    t[k] = v;
                }
            }
            catch (_) { }
        }
        try {
            if (typeof tween.onUpdate === 'function')
                tween.onUpdate(alpha);
        }
        catch (_) { }
    }
    function update() {
        // Called by engine on each clock tick.
        if (_tweens.size === 0)
            return;
        const nowMs = _now(clock);
        const ids = Array.from(_tweens.keys());
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            const tw = _tweens.get(id);
            if (!tw)
                continue;
            const elapsed = nowMs - tw.startMs;
            const t = tw.dur <= 0 ? 1 : Math.max(0, Math.min(1, elapsed / tw.dur));
            const alpha = tw.ease(t);
            _apply(tw, alpha);
            if (t >= 1) {
                _tweens.delete(id);
                _unregisterOwner(tw.owner, id);
                try {
                    if (typeof tw.onComplete === 'function')
                        tw.onComplete();
                }
                catch (_) { }
                try {
                    if (emit)
                        emit('tween:complete', { id });
                }
                catch (_) { }
            }
        }
    }
    function count() { return _tweens.size; }
    return { to, cancel, cancelOwner, update, count, easings: Object.keys(EASINGS) };
}
//# sourceMappingURL=tween.js.map