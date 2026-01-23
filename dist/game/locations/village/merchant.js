// Locations/Village/merchant.js
// Centralized merchant system for village & traveling merchants.
// - Multiple themed village merchants (blacksmith, arcanist, alchemist, provisioner)
// - Per-playthrough shop names (stored in state)
// - Economy-aware pricing (delegated to getMerchantPrice / getVillageEconomySummary)
// - Limited stock per item (shops can sell out)
// - Live "Your gold" display and clear cannot-afford / sold-out states.
import { finiteInt } from "../../systems/safety.js";
import { rngInt } from "../../systems/rng.js";
const VILLAGE_MERCHANTS = [
    {
        id: 'blacksmith',
        baseName: 'Blacksmith',
        titleTagline: 'Steel & Sparks',
        icon: '⚔️',
        blurb: 'Heavy blades, tempered armor, and gear for front-line fighters.',
        tag: 'Weapons & armor'
    },
    {
        id: 'arcanist',
        baseName: 'Arcane Vendor',
        titleTagline: 'Tomes & Focuses',
        icon: '✨',
        blurb: 'Staves, robes, and supplies for spellcasters.',
        tag: 'Magic gear & mana'
    },
    {
        id: 'alchemist',
        baseName: 'Alchemist',
        titleTagline: 'Tonics & Draughts',
        icon: '🧪',
        blurb: 'Curative tonics and combat draughts.',
        tag: 'Potions & restoratives'
    },
    {
        id: 'provisioner',
        baseName: 'General Provisioner',
        titleTagline: 'General Goods',
        icon: '🧺',
        blurb: 'Basic supplies for any adventurer.',
        tag: 'Everyday essentials'
    }
];
// Name pools so each playthrough can have different shop names.
const MERCHANT_NAME_POOLS = {
    blacksmith: [
        'Brightforge Smithy',
        'The Hammer & Anvil',
        'Red Ember Forge',
        'Ironheart Forge',
        'Twin Anvils'
    ],
    arcanist: [
        'Starfall Tomes',
        'The Crystal Quill',
        'Arcane Curios',
        'Moonglass Atelier',
        'Runes & Relics'
    ],
    alchemist: [
        'Silverleaf Alchemy',
        'The Boiling Cauldron',
        'Moondew Remedies',
        'Root & Ember',
        'Copper Still Apothecary'
    ],
    provisioner: [
        'Emberwood Outfitters',
        'Trail & Tackle',
        'The Adventurer’s Basket',
        'Roadside Provisions',
        'Packrat Supplies'
    ]
};
// Per-playthrough merchant name state lives on the save.
function getMerchantNamesState(state) {
    if (!state.villageMerchantNames) {
        state.villageMerchantNames = {}; // { [merchantId]: runtimeName }
    }
    return state.villageMerchantNames;
}
function getOrCreateMerchantShopName(state, merchantId, fallbackName) {
    const names = getMerchantNamesState(state);
    if (names[merchantId])
        return names[merchantId];
    const pool = MERCHANT_NAME_POOLS[merchantId] || [];
    let chosen = fallbackName || merchantId;
    if (pool.length) {
        chosen = pool[rngInt(state, 0, pool.length - 1, 'merchant.shopName')];
    }
    names[merchantId] = chosen;
    return chosen;
}
function getResourcePotionKeyForPlayer(state) {
    const p = state.player;
    if (!p)
        return null;
    const key = p.resourceKey;
    if (key === 'mana')
        return 'potionMana';
    if (key === 'fury')
        return 'potionFury';
    if (key === 'blood')
        return 'potionBlood';
    if (key === 'essence')
        return 'potionEssence';
    return null;
}
// Stock for the *village* merchants (per type).
// These are simple item-key lists – add new keys here as you expand ITEM_DEFS.
function getVillageMerchantStock(merchantId, state) {
    const resPotionKey = getResourcePotionKeyForPlayer(state);
    switch (merchantId) {
        case 'blacksmith':
            // Weapon- & armor-focused
            return ['swordIron', 'bladeSanguine', 'armorLeather'];
        case 'arcanist':
            return [
                'staffOak',
                'robeApprentice',
                ...(((state.player &&
                    (state.player.resourceKey === 'mana' ||
                        state.player.resourceKey === 'essence')) &&
                    resPotionKey)
                    ? [resPotionKey]
                    : [])
            ];
        case 'alchemist':
            // All basic potion types that exist in ITEM_DEFS
            return [
                'potionSmall',
                'potionMana',
                'potionFury',
                'potionBlood',
                'potionEssence'
            ];
        case 'provisioner':
            // A generalist mix; always has small heal + your class resource pot + some light armor.
            return [
                'potionSmall',
                ...(resPotionKey ? [resPotionKey] : []),
                'armorLeather'
            ];
        default:
            return [];
    }
}
// Single traveling merchant stock (for forest/ruins events).
function getTravelingMerchantStock(state) {
    const resPotionKey = getResourcePotionKeyForPlayer(state);
    const p = state && state.player ? state.player : null;
    const rKey = p ? p.resourceKey : null;
    const base = ['potionSmall', 'armorLeather'];
    if (rKey === 'mana') {
        base.push('potionMana', 'staffOak');
    }
    else if (rKey === 'fury') {
        base.push('potionFury', 'swordIron');
    }
    else if (rKey === 'blood') {
        base.push('potionBlood', 'bladeSanguine');
    }
    else if (rKey === 'essence') {
        base.push('potionEssence', 'staffOak');
    }
    else if (resPotionKey) {
        // Unknown resource type but we still have a valid potion key mapping
        base.push(resPotionKey);
    }
    return base;
}
function findMerchantConfig(id) {
    return VILLAGE_MERCHANTS.find((m) => m.id === id) || null;
}
// ---------------------------------------------------------------------------
// STOCK PERSISTENCE
// ---------------------------------------------------------------------------
// Track per-playthrough shop stock in the save state.
// Structure: state.merchantStock[context][merchantId][itemKey] = remainingCount
function getMerchantStockBucket(state, context, merchantId) {
    if (!state.merchantStock)
        state.merchantStock = {};
    const ctxKey = context || 'village';
    if (!state.merchantStock[ctxKey])
        state.merchantStock[ctxKey] = {};
    if (!state.merchantStock[ctxKey][merchantId]) {
        state.merchantStock[ctxKey][merchantId] = {};
    }
    return state.merchantStock[ctxKey][merchantId];
}
// Ensure each item in this shop has an initial stock amount.
// Exported for smoke tests and any save-reconcile helpers that need to sanitize persisted stock buckets.
// (Stable API: mutates only the relevant bucket in the provided save state.)
export function ensureMerchantStock(state, context, merchantId, stockKeys, cloneItemDef) {
    const bucket = getMerchantStockBucket(state, context, merchantId);
    stockKeys.forEach((key) => {
        if (typeof bucket[key] !== 'number') {
            const def = cloneItemDef(key);
            // Sensible defaults: more consumables, few pieces of gear.
            let qty = 3;
            if (def && def.type === 'potion')
                qty = 6;
            else if (def && def.type === 'weapon')
                qty = 2;
            else if (def && def.type === 'armor')
                qty = 2;
            bucket[key] = qty;
        }
    });
    // Reconcile persisted buckets: remove items that are no longer sold by this merchant
    // (or no longer exist in the item defs). This prevents "ghost stock" after content changes.
    try {
        const allow = new Set(Array.isArray(stockKeys) ? stockKeys : []);
        Object.keys(bucket).forEach((k) => {
            if (!allow.has(k)) {
                delete bucket[k];
                return;
            }
            const def = cloneItemDef(k);
            if (!def)
                delete bucket[k];
        });
    }
    catch (_) { }
    return bucket;
}
// ---------------------------------------------------------------------------
// DAILY RESTOCK
// ---------------------------------------------------------------------------
// Optional but recommended: keep shops from becoming permanently empty on long runs.
// This runs once per in-game day (wired through engine.js' runDailyTicks).
//
// Behavior:
//  - Potions restock toward 6
//  - Gear restocks toward 2
//  - Other items restock toward 3
//  - Restocks are small (usually +1) to preserve the "limited stock" feeling.
export function handleMerchantDayTick(state, absoluteDay, cloneItemDef) {
    const day = Math.floor(Number(absoluteDay));
    if (!state || !Number.isFinite(day))
        return;
    if (!state.merchantStock)
        return;
    if (!state.merchantStockMeta) {
        state.merchantStockMeta = { lastDayRestocked: null };
    }
    const meta = state.merchantStockMeta;
    if (meta.lastDayRestocked === day)
        return;
    meta.lastDayRestocked = day;
    const safeClone = typeof cloneItemDef === 'function'
        ? cloneItemDef
        : () => null;
    const capFor = (def) => {
        if (def && def.type === 'potion')
            return 6;
        if (def && (def.type === 'weapon' || def.type === 'armor'))
            return 2;
        return 3;
    };
    // Iterate all contexts (village, wandering, etc.).
    Object.keys(state.merchantStock).forEach((ctxKey) => {
        const ctx = state.merchantStock[ctxKey];
        if (!ctx || typeof ctx !== 'object')
            return;
        Object.keys(ctx).forEach((merchantId) => {
            const bucket = ctx[merchantId];
            if (!bucket || typeof bucket !== 'object')
                return;
            Object.keys(bucket).forEach((itemKey) => {
                const cur = finiteInt(bucket[itemKey], 0);
                const def = safeClone(itemKey);
                const cap = capFor(def);
                // If already at/above cap, do nothing.
                if (cur >= cap) {
                    bucket[itemKey] = cap;
                    return;
                }
                // Small restock.
                const next = Math.min(cap, cur + 1);
                bucket[itemKey] = next;
            });
        });
    });
}
// ---------------------------------------------------------------------------
// ITEM ROW BUILDER
// ---------------------------------------------------------------------------
// Build one item-row inside a shop, with:
//  - live “Your gold” updates
//  - disabled + labeled Buy if you can’t afford it
//  - limited stock that can sell out
function buildItemRow({ body, itemKey, merchantId, state, context, cloneItemDef, getMerchantPrice, handleEconomyAfterPurchase, addItemToInventory, updateHUD, saveGame, addLog, recordInput, dispatchCommand, goldLineEl, // <p> "Your gold: Xg" from the shop
stockMap // object: itemKey -> remaining stock
 }) {
    const p = state.player;
    const def = cloneItemDef(itemKey);
    if (!def)
        return;
    const row = document.createElement('div');
    row.className = 'item-row';
    const header = document.createElement('div');
    header.className = 'item-row-header';
    const left = document.createElement('div');
    left.innerHTML = '<span class="item-name">' + def.name + '</span>';
    const basePrice = def.price || 0;
    const finalPrice = Math.max(1, finiteInt(getMerchantPrice(basePrice, state, context), 1));
    const right = document.createElement('div');
    right.innerHTML = '<span class="tag gold">' + finalPrice + 'g</span>';
    header.appendChild(left);
    header.appendChild(right);
    const desc = document.createElement('div');
    desc.style.fontSize = '0.75rem';
    desc.style.color = 'var(--muted)';
    desc.textContent = def.desc || '';
    // Per-item stock line.
    const stockLine = document.createElement('div');
    stockLine.className = 'item-meta';
    stockLine.style.fontSize = '0.72rem';
    stockLine.style.opacity = '0.85';
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    const btnBuy = document.createElement('button');
    btnBuy.className = 'btn small';
    // Helper: remaining stock for this item.
    const getRemainingStock = () => {
        if (!stockMap)
            return Infinity;
        const raw = stockMap[itemKey];
        return typeof raw === 'number' ? raw : 0;
    };
    function refreshUI() {
        const remaining = getRemainingStock();
        const soldOut = remaining <= 0;
        // Live gold readout.
        if (goldLineEl) {
            p.gold = Math.max(0, finiteInt(p.gold, 0));
            goldLineEl.textContent = `Your gold: ${p.gold}g`;
        }
        // Button state & text.
        if (soldOut) {
            btnBuy.disabled = true;
            btnBuy.classList.add('disabled');
            btnBuy.textContent = 'Sold out';
        }
        else if (p.gold < finalPrice) {
            btnBuy.disabled = true;
            btnBuy.classList.add('disabled');
            btnBuy.textContent = `Need ${finalPrice}g`;
        }
        else {
            btnBuy.disabled = false;
            btnBuy.classList.remove('disabled');
            btnBuy.textContent = 'Buy';
        }
        // Stock label.
        if (stockMap) {
            stockLine.textContent = `In stock: ${Math.max(0, remaining)}`;
        }
        else {
            stockLine.textContent = '';
        }
    }
    btnBuy.addEventListener('click', () => {
        // Preferred path: route purchases through the command bus so replay/telemetry
        // can capture deterministic state transitions.
        try {
            if (typeof dispatchCommand === 'function') {
                const ok = dispatchCommand('SHOP_BUY', {
                    context,
                    merchantId: merchantId || null,
                    itemKey,
                    price: finalPrice
                });
                if (ok) {
                    refreshUI();
                    return;
                }
            }
        }
        catch (_) { }
        const remaining = getRemainingStock();
        const soldOut = remaining <= 0;
        if (soldOut) {
            addLog('That item is sold out.', 'system');
            refreshUI();
            return;
        }
        if (p.gold < finalPrice) {
            addLog('You cannot afford ' + def.name + '.', 'system');
            refreshUI();
            return;
        }
        // Fallback (headless / no-engine builds): execute locally.
        // Take payment + give item.
        const price = Math.max(1, finiteInt(finalPrice, 1));
        p.gold = Math.max(0, finiteInt(p.gold, 0) - price);
        addItemToInventory(itemKey, 1);
        try {
            recordInput?.('merchant.buy', { context, itemKey, price: finalPrice });
        }
        catch (_) { }
        // Decrement stock.
        if (stockMap) {
            stockMap[itemKey] = Math.max(0, remaining - 1);
        }
        addLog('You purchase ' + def.name + ' for ' + finalPrice + ' gold.', 'good');
        handleEconomyAfterPurchase(state, price, context);
        updateHUD();
        saveGame();
        refreshUI();
    });
    actions.appendChild(btnBuy);
    row.appendChild(header);
    row.appendChild(desc);
    row.appendChild(stockLine);
    row.appendChild(actions);
    body.appendChild(row);
    // Initial draw.
    refreshUI();
}
// ---------------------------------------------------------------------------
// COMMAND HANDLERS (exported)
// ---------------------------------------------------------------------------
// Central purchase executor used by the engine command handlers.
// This keeps merchant purchases deterministic and replayable.
export function executeMerchantBuy({ state, context, merchantId, itemKey, price, addLog, recordInput, addItemToInventory, updateHUD, saveGame, handleEconomyAfterPurchase, getMerchantPrice, cloneItemDef } = {}) {
    const p = state && state.player ? state.player : null;
    if (!p)
        return false;
    const log = typeof addLog === 'function' ? addLog : () => { };
    const ctx = String(context || 'village');
    const mId = String(merchantId || '');
    const k = String(itemKey || '');
    if (!mId || !k)
        return false;
    // Ensure bucket exists; shop builders should have already called ensureMerchantStock,
    // but commands may be replayed/triggered in other contexts.
    const bucket = getMerchantStockBucket(state, ctx, mId);
    const remaining = typeof bucket[k] === 'number' ? finiteInt(bucket[k], 0) : 0;
    if (remaining <= 0) {
        log('That item is sold out.', 'system');
        return false;
    }
    // Prefer payload price for UI parity, but fall back to live price computation.
    const _defForPrice = typeof cloneItemDef === 'function' ? cloneItemDef(k) : null;
    const basePrice = _defForPrice && typeof _defForPrice.price === 'number' ? _defForPrice.price : 0;
    const computed = typeof getMerchantPrice === 'function' ? getMerchantPrice(basePrice, state, ctx) : null;
    const want = Number.isFinite(Number(price)) ? Number(price) : computed;
    const finalPrice = Math.max(1, finiteInt(want, 1));
    if (finiteInt(p.gold, 0) < finalPrice) {
        const def = typeof cloneItemDef === 'function' ? cloneItemDef(k) : null;
        log('You cannot afford ' + (def?.name || 'that item') + '.', 'system');
        return false;
    }
    // Take payment + give item.
    p.gold = Math.max(0, finiteInt(p.gold, 0) - finalPrice);
    try {
        if (typeof addItemToInventory === 'function')
            addItemToInventory(k, 1);
    }
    catch (_) { }
    // Decrement stock.
    bucket[k] = Math.max(0, finiteInt(bucket[k], 0) - 1);
    const def = typeof cloneItemDef === 'function' ? cloneItemDef(k) : null;
    log('You purchase ' + (def?.name || 'an item') + ' for ' + finalPrice + ' gold.', 'good');
    try {
        recordInput?.('merchant.buy', { context: ctx, merchantId: mId, itemKey: k, price: finalPrice });
    }
    catch (_) { }
    try {
        if (typeof handleEconomyAfterPurchase === 'function')
            handleEconomyAfterPurchase(state, finalPrice, ctx);
    }
    catch (_) { }
    try {
        if (typeof updateHUD === 'function')
            updateHUD();
    }
    catch (_) { }
    try {
        if (typeof saveGame === 'function')
            saveGame();
    }
    catch (_) { }
    return true;
}
// ---------------------------------------------------------------------------
// VILLAGE MERCHANT HUB
// ---------------------------------------------------------------------------
function openVillageMerchantHub({ state, openModal, addLog, getVillageEconomySummary, getMerchantPrice, handleEconomyAfterPurchase, cloneItemDef, addItemToInventory, updateHUD, saveGame, recordInput, dispatchCommand }) {
    const econSummary = getVillageEconomySummary(state);
    const tier = econSummary.tier;
    openModal('Village Merchants', (body) => {
        const intro = document.createElement('p');
        intro.className = 'modal-subtitle';
        intro.textContent =
            'Emberwood’s market square hums with activity. Different merchants call out to passing adventurers.';
        body.appendChild(intro);
        const econLine = document.createElement('p');
        econLine.className = 'modal-subtitle';
        econLine.textContent = `Village economy: ${tier.name} – prices are ${tier.priceDescriptor}.`;
        body.appendChild(econLine);
        VILLAGE_MERCHANTS.forEach((merchant) => {
            const runtimeName = getOrCreateMerchantShopName(state, merchant.id, merchant.baseName);
            const row = document.createElement('div');
            row.className = 'item-row';
            const header = document.createElement('div');
            header.className = 'item-row-header';
            const left = document.createElement('div');
            left.innerHTML = `<span class="item-name">${merchant.icon} ${runtimeName}</span>`;
            const right = document.createElement('div');
            right.className = 'item-meta';
            right.textContent = merchant.tag;
            header.appendChild(left);
            header.appendChild(right);
            const desc = document.createElement('div');
            desc.style.fontSize = '0.75rem';
            desc.style.color = 'var(--muted)';
            desc.textContent = merchant.blurb;
            const actions = document.createElement('div');
            actions.className = 'item-actions';
            const btnVisit = document.createElement('button');
            btnVisit.className = 'btn small';
            btnVisit.textContent = 'Visit Shop';
            btnVisit.addEventListener('click', () => {
                openSpecificMerchantShop({
                    merchantId: merchant.id,
                    state,
                    openModal,
                    addLog,
                    getVillageEconomySummary,
                    getMerchantPrice,
                    handleEconomyAfterPurchase,
                    cloneItemDef,
                    addItemToInventory,
                    updateHUD,
                    saveGame,
                    recordInput,
                    dispatchCommand
                });
            });
            actions.appendChild(btnVisit);
            row.appendChild(header);
            row.appendChild(desc);
            row.appendChild(actions);
            body.appendChild(row);
        });
        const hint = document.createElement('p');
        hint.className = 'modal-subtitle';
        hint.textContent =
            'Tip: Each merchant specializes in different wares – weapons, magic gear, or potions.';
        body.appendChild(hint);
    });
}
// Individual village merchant shop.
function openSpecificMerchantShop({ merchantId, state, openModal, addLog, getVillageEconomySummary, getMerchantPrice, handleEconomyAfterPurchase, cloneItemDef, addItemToInventory, updateHUD, saveGame, recordInput, dispatchCommand }) {
    const p = state.player;
    if (!p)
        return;
    const econSummary = getVillageEconomySummary(state);
    const tier = econSummary.tier;
    const cfg = findMerchantConfig(merchantId);
    const stockKeys = getVillageMerchantStock(merchantId, state);
    // Build or restore stock for this shop.
    const stockMap = ensureMerchantStock(state, 'village', merchantId, stockKeys, cloneItemDef);
    const runtimeName = cfg
        ? getOrCreateMerchantShopName(state, merchantId, cfg.baseName)
        : 'Merchant';
    openModal(runtimeName, (body) => {
        const subtitle = document.createElement('p');
        subtitle.className = 'modal-subtitle';
        subtitle.textContent = cfg
            ? `${cfg.titleTagline} – ${cfg.blurb}`
            : 'A local trader arranges a selection of goods for you.';
        body.appendChild(subtitle);
        const econLine = document.createElement('p');
        econLine.className = 'modal-subtitle';
        econLine.textContent = `Village economy: ${tier.name} – prices are ${tier.priceDescriptor}.`;
        body.appendChild(econLine);
        // Gold line (kept live by item rows).
        const goldLine = document.createElement('p');
        goldLine.className = 'modal-subtitle';
        body.appendChild(goldLine);
        if (!stockKeys.length) {
            const empty = document.createElement('p');
            empty.className = 'modal-subtitle';
            empty.textContent = 'For now, this merchant has nothing to offer.';
            body.appendChild(empty);
        }
        else {
            stockKeys.forEach((itemKey) => {
                buildItemRow({
                    body,
                    itemKey,
                    merchantId,
                    state,
                    context: 'village',
                    cloneItemDef,
                    getMerchantPrice,
                    handleEconomyAfterPurchase,
                    addItemToInventory,
                    updateHUD,
                    saveGame,
                    addLog,
                    recordInput,
                    dispatchCommand,
                    goldLineEl: goldLine,
                    stockMap
                });
            });
        }
        // Initial gold label text.
        goldLine.textContent = `Your gold: ${p.gold}g`;
        // Back to merchant hub.
        const backRow = document.createElement('div');
        backRow.className = 'item-actions';
        const btnBack = document.createElement('button');
        btnBack.className = 'btn outline small';
        btnBack.textContent = 'Back to Market Square';
        btnBack.addEventListener('click', () => {
            openVillageMerchantHub({
                state,
                openModal,
                addLog,
                getVillageEconomySummary,
                getMerchantPrice,
                handleEconomyAfterPurchase,
                cloneItemDef,
                addItemToInventory,
                updateHUD,
                saveGame
            });
        });
        backRow.appendChild(btnBack);
        body.appendChild(backRow);
    });
}
// ---------------------------------------------------------------------------
// TRAVELING MERCHANT (forest / ruins events)
// ---------------------------------------------------------------------------
function openTravelingMerchantShop({ state, openModal, addLog, getVillageEconomySummary, getMerchantPrice, handleEconomyAfterPurchase, cloneItemDef, addItemToInventory, updateHUD, saveGame, recordInput, dispatchCommand }) {
    const p = state.player;
    if (!p)
        return;
    const econSummary = getVillageEconomySummary(state);
    const tier = econSummary.tier;
    const stockKeys = getTravelingMerchantStock(state);
    // Shared "traveling" stock bucket in the 'wandering' context.
    const stockMap = ensureMerchantStock(state, 'wandering', 'traveling', stockKeys, cloneItemDef);
    // A little flavor each time you meet a traveling merchant.
    const travelerNames = [
        'Seren the Wanderer',
        'Old Krel',
        'Mira of the Roads',
        'Jarek the Peddler',
        'The Hooded Trader'
    ];
    const travelerName = travelerNames[rngInt(state, 0, travelerNames.length - 1, 'merchant.travelerName')];
    openModal(`${travelerName}, Traveling Merchant`, (body) => {
        const intro = document.createElement('p');
        intro.className = 'modal-subtitle';
        intro.textContent =
            'Far from Emberwood, a wary trader eyes you before revealing a carefully curated spread of travel-worthy goods.';
        body.appendChild(intro);
        const econLine = document.createElement('p');
        econLine.className = 'modal-subtitle';
        econLine.textContent = `Village economy: ${tier.name} – traveling merchants adjust their prices accordingly.`;
        body.appendChild(econLine);
        const goldLine = document.createElement('p');
        goldLine.className = 'modal-subtitle';
        body.appendChild(goldLine);
        if (!stockKeys.length) {
            const empty = document.createElement('p');
            empty.className = 'modal-subtitle';
            empty.textContent =
                'This merchant seems to be between shipments and has nothing to sell.';
            body.appendChild(empty);
        }
        else {
            stockKeys.forEach((itemKey) => {
                buildItemRow({
                    body,
                    itemKey,
                    merchantId: 'traveling',
                    state,
                    context: 'wandering',
                    cloneItemDef,
                    getMerchantPrice,
                    handleEconomyAfterPurchase,
                    addItemToInventory,
                    updateHUD,
                    saveGame,
                    addLog,
                    recordInput,
                    dispatchCommand,
                    goldLineEl: goldLine,
                    stockMap
                });
            });
        }
        goldLine.textContent = `Your gold: ${p.gold}g`;
        const hint = document.createElement('p');
        hint.className = 'modal-subtitle';
        hint.textContent =
            'Wandering merchants charge a bit extra for the risks of the road.';
        body.appendChild(hint);
    });
}
// ---------------------------------------------------------------------------
// PUBLIC ENTRY POINT
// ---------------------------------------------------------------------------
export function openMerchantModalImpl({ context = 'village', state, openModal, addLog, getVillageEconomySummary, getMerchantPrice, handleEconomyAfterPurchase, cloneItemDef, addItemToInventory, updateHUD, saveGame, recordInput, dispatchCommand }) {
    if (!state || !state.player)
        return;
    const ctx = context || 'village';
    if (ctx === 'village') {
        openVillageMerchantHub({
            state,
            openModal,
            addLog,
            getVillageEconomySummary,
            getMerchantPrice,
            handleEconomyAfterPurchase,
            cloneItemDef,
            addItemToInventory,
            updateHUD,
            saveGame,
            recordInput,
            dispatchCommand
        });
    }
    else {
        openTravelingMerchantShop({
            state,
            openModal,
            addLog,
            getVillageEconomySummary,
            getMerchantPrice,
            handleEconomyAfterPurchase,
            cloneItemDef,
            addItemToInventory,
            updateHUD,
            saveGame,
            recordInput,
            dispatchCommand
        });
    }
}
//# sourceMappingURL=merchant.js.map