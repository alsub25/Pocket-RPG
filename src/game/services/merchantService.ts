// js/game/services/merchantService.js
// Merchant service - handles commerce operations through the engine
//
// This service provides buying/selling operations and merchant stock management
// through the engine's command and event system.

export function createMerchantService(engine) {
  const getState = () => engine.getState();
  const setState = (newState, reason) => engine.commit(newState, reason);
  const emit = (event, payload) => engine.emit(event, payload);
  const log = engine.log;

  // Helper to ensure merchant state exists
  function ensureMerchantState(state) {
    if (!state.merchant) {
      state.merchant = {
        stock: [],
        lastRestockDay: state.time?.day || 1,
        transactions: 0
      };
    }
    return state;
  }

  // Initialize merchant state
  function initMerchant() {
    const state = getState();
    if (!state.merchant) {
      const newState = { ...state };
      ensureMerchantState(newState);
      setState(newState, 'merchant:init');
      log?.info?.('merchant', 'Merchant state initialized');
    }
  }

  // Get current merchant stock
  function getStock() {
    const state = getState();
    return state.merchant?.stock || [];
  }

  // Get item price with economy multipliers
  function getPrice(item, context = 'village') {
    if (!item || !item.value) return 0;
    
    const state = getState();
    const economy = state.village?.economy || {};
    const multiplier = economy.priceMultiplier || 1.0;
    
    // Base price affected by economy
    const basePrice = Math.floor(item.value * multiplier);
    
    // Context-specific adjustments
    const contextMultipliers = {
      village: 1.0,
      dungeon: 1.5, // More expensive in dungeons
      special: 0.8  // Discounts for special merchants
    };
    
    const contextMult = contextMultipliers[context] || 1.0;
    return Math.floor(basePrice * contextMult);
  }

  // Buy item from merchant
  function buyItem(itemKey, price, context = 'village') {
    const state = getState();
    const player = state.player;
    
    if (!player) {
      return { success: false, error: 'No player state' };
    }

    if (player.gold < price) {
      return { success: false, error: 'Insufficient gold' };
    }

    // Find item in merchant stock
    const stock = state.merchant?.stock || [];
    const itemIndex = stock.findIndex(i => i.key === itemKey);
    
    if (itemIndex === -1) {
      return { success: false, error: 'Item not in stock' };
    }

    const item = stock[itemIndex];
    const newState = { ...state };
    
    // Deduct gold
    newState.player = { ...player, gold: player.gold - price };
    
    // Add item to inventory
    if (!newState.player.inventory) {
      newState.player.inventory = [];
    }
    newState.player.inventory.push({ ...item.data });
    
    // Remove from merchant stock
    newState.merchant = {
      ...newState.merchant,
      stock: stock.filter((_, idx) => idx !== itemIndex),
      transactions: (newState.merchant.transactions || 0) + 1
    };

    setState(newState, 'merchant:buy');
    emit('merchant:purchase', { item: item.data, price, goldSpent: price, context });
    
    log?.info?.('merchant', `Purchased ${item.data.name} for ${price} gold`);
    return { success: true, item: item.data, price };
  }

  // Sell item to merchant
  function sellItem(itemIndex, context = 'village') {
    const state = getState();
    const player = state.player;
    
    if (!player || !player.inventory || itemIndex < 0 || itemIndex >= player.inventory.length) {
      return { success: false, error: 'Invalid item' };
    }

    const item = player.inventory[itemIndex];
    if (!item || !item.value) {
      return { success: false, error: 'Item cannot be sold' };
    }

    // Calculate sell price (typically 50% of base value)
    const sellPrice = Math.floor(item.value * 0.5);
    
    const newState = { ...state };
    
    // Add gold
    newState.player = { 
      ...player, 
      gold: player.gold + sellPrice,
      inventory: player.inventory.filter((_, idx) => idx !== itemIndex)
    };

    setState(newState, 'merchant:sell');
    emit('merchant:sold', { item, sellPrice, context });
    
    log?.info?.('merchant', `Sold ${item.name} for ${sellPrice} gold`);
    return { success: true, item, sellPrice };
  }

  // Restock merchant inventory (called daily)
  function handleDayTick(newDay) {
    const state = getState();
    if (!state.merchant || state.merchant.lastRestockDay === newDay) {
      return; // Already restocked today
    }

    // Restock logic would go here
    // For now, just update the last restock day
    const newState = { ...state };
    ensureMerchantState(newState);
    newState.merchant = { ...newState.merchant, lastRestockDay: newDay };
    
    setState(newState, 'merchant:restock');
    emit('merchant:restocked', { day: newDay });
    
    log?.info?.('merchant', `Merchant restocked for day ${newDay}`);
  }

  // Get merchant summary
  function getSummary() {
    const state = getState();
    const merchant = state.merchant || {};
    
    return {
      stockCount: merchant.stock?.length || 0,
      transactions: merchant.transactions || 0,
      lastRestockDay: merchant.lastRestockDay || 1
    };
  }

  return {
    initMerchant,
    getStock,
    getPrice,
    buyItem,
    sellItem,
    handleDayTick,
    getSummary
  };
}
