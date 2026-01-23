// js/engine/i18n.js
// Minimal localization registry.
function _safeStr(v) {
    try {
        return String(v == null ? '' : v);
    }
    catch (_) {
        return '';
    }
}
export function createI18nService({ defaultLocale = 'en-US' } = {}) {
    const dictByLocale = new Map();
    let _locale = _safeStr(defaultLocale) || 'en-US';
    function register(locale, dict) {
        const loc = _safeStr(locale).trim();
        if (!loc || !dict || typeof dict !== 'object')
            return;
        const prev = dictByLocale.get(loc) || {};
        dictByLocale.set(loc, { ...prev, ...dict });
    }
    function setLocale(locale) {
        const loc = _safeStr(locale).trim();
        if (!loc)
            return;
        _locale = loc;
    }
    function getLocale() {
        return _locale;
    }
    function _lookup(key) {
        const k = _safeStr(key);
        const primary = dictByLocale.get(_locale);
        if (primary && Object.prototype.hasOwnProperty.call(primary, k))
            return primary[k];
        const en = dictByLocale.get('en-US');
        if (en && Object.prototype.hasOwnProperty.call(en, k))
            return en[k];
        return null;
    }
    function t(key, params = null) {
        const k = _safeStr(key);
        const tmpl = _lookup(k);
        let s = tmpl != null ? _safeStr(tmpl) : k;
        if (params && typeof params === 'object') {
            Object.keys(params).forEach((p) => {
                const val = _safeStr(params[p]);
                s = s.replaceAll('{' + p + '}', val);
            });
        }
        return s;
    }
    return { register, setLocale, getLocale, t };
}
//# sourceMappingURL=i18n.js.map