// js/game/utils/itemCloner.js
// Small helper for deep-cloning authored item definitions.
// Intentionally uses JSON clone to preserve the historical behavior of cloneItemDef
// (and to keep clones JSON-safe for localStorage persistence).
export function createItemCloner(itemDefs) {
    const defs = itemDefs && typeof itemDefs === 'object' ? itemDefs : {};
    return function cloneItemDef(id) {
        const def = defs[id];
        if (!def)
            return null;
        try {
            return JSON.parse(JSON.stringify(def));
        }
        catch (_) {
            return null;
        }
    };
}
//# sourceMappingURL=itemCloner.js.map