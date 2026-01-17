// js/game/services/villageEconomyService.js
// Engine-integrated village economy service
// 
// This service wraps the village economy system to ensure all state changes
// go through the engine properly with immutable updates and event emissions.

import {
  ECONOMY_TIERS,
  getVillageEconomySummary,
  getMerchantPrice,
  getRestCost
} from '../locations/village/villageEconomy.js';

// Economic constants
const PROSPERITY_DRIFT_BIAS = 0.45;  // Slight upward bias in daily drift
const PROSPERITY_DRIFT_RANGE = 6;    // Max drift amount per day (-3.0 to +3.3)
const BOSS_SECURITY_BONUS = 8;       // Security boost for defeating bosses
const NORMAL_SECURITY_BONUS = 2;     // Security boost for normal enemies

// Purchase impact on economy
const PURCHASE_TRADE_DIVISOR = 20;     // Gold/20 = trade boost (max 5)
const PURCHASE_TRADE_MAX = 5;          // Maximum trade boost per purchase
const PURCHASE_PROSPERITY_DIVISOR = 25; // Gold/25 = prosperity boost (max 4)
const PURCHASE_PROSPERITY_MAX = 4;     // Maximum prosperity boost per purchase

// Prosperity multipliers for battle rewards
const BOSS_PROSPERITY_MULTIPLIER = 0.6;     // Prosperity as % of boss security bonus
const NORMAL_PROSPERITY_MULTIPLIER = 0.6;   // Prosperity as % of normal security bonus

function clamp(val, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  const rounded = Math.round(n);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function recomputeTier(econ) {
  if (econ.prosperity < 35) {
    econ.tierId = 'struggling';
  } else if (econ.prosperity > 70) {
    econ.tierId = 'thriving';
  } else {
    econ.tierId = 'stable';
  }
}

/**
 * Creates an engine-integrated village economy service.
 * All state mutations go through engine.setState() with immutable updates.
 * All significant changes emit events for other systems to react.
 */
export function createVillageEconomyService(engine) {
  if (!engine) throw new Error('VillageEconomyService requires engine instance');

  const rng = engine.get('rng');
  if (!rng) throw new Error('VillageEconomyService requires RNG service');

  /**
   * Initialize economy state if missing (called automatically on reads)
   */
  function initEconomy(state) {
    if (!state.villageEconomy) {
      return {
        ...state,
        villageEconomy: {
          tierId: 'stable',
          prosperity: 50,
          security: 40,
          trade: 50,
          lastDayUpdated: null,
          lastDecreeNudge: null
        }
      };
    }
    return state;
  }

  /**
   * Handle daily economy tick (prosperity drift, decree effects)
   */
  function handleDayTick(absoluteDay) {
    const state = engine.getState();
    const stateWithEcon = initEconomy(state);
    const econ = stateWithEcon.villageEconomy;

    // Guard against double-ticking
    if (econ.lastDayUpdated === absoluteDay) return;

    // Create immutable update with daily prosperity drift
    const drift = (rng.random() - PROSPERITY_DRIFT_BIAS) * PROSPERITY_DRIFT_RANGE;
    const newProsperity = clamp(econ.prosperity + drift, 0, 100);

    // Check for active Town Hall decree effects
    const eff = state?.government?.townHallEffects;
    const today = typeof absoluteDay === 'number' ? Math.floor(absoluteDay) : 0;
    const isActive =
      eff &&
      eff.petitionId &&
      typeof eff.expiresOnDay === 'number' &&
      today <= eff.expiresOnDay;

    let prosperityDelta = 0;
    let tradeDelta = 0;
    let securityDelta = 0;
    let lastDecreeNudge = null;

    if (isActive) {
      const pDelta = Number(eff.econProsperityDelta);
      const tDelta = Number(eff.econTradeDelta);
      const sDelta = Number(eff.econSecurityDelta);

      prosperityDelta = Number.isFinite(pDelta) ? Math.round(pDelta) : 0;
      tradeDelta = Number.isFinite(tDelta) ? Math.round(tDelta) : 0;
      securityDelta = Number.isFinite(sDelta) ? Math.round(sDelta) : 0;

      if (prosperityDelta || tradeDelta || securityDelta) {
        lastDecreeNudge = {
          day: absoluteDay,
          petitionId: eff.petitionId,
          deltas: {
            prosperity: prosperityDelta,
            trade: tradeDelta,
            security: securityDelta
          }
        };
      }
    }

    const updatedEcon = {
      ...econ,
      prosperity: clamp(newProsperity + prosperityDelta, 0, 100),
      trade: clamp((econ.trade || 50) + tradeDelta, 0, 100),
      security: clamp((econ.security || 40) + securityDelta, 0, 100),
      lastDayUpdated: absoluteDay
    };

    if (lastDecreeNudge) {
      updatedEcon.lastDecreeNudge = lastDecreeNudge;
    }

    // Recompute tier
    recomputeTier(updatedEcon);

    // Immutable state update through engine
    const newState = {
      ...stateWithEcon,
      villageEconomy: updatedEcon
    };

    engine.setState(newState);

    // Emit event for other systems
    engine.emit('village:economyTick', {
      day: absoluteDay,
      prosperity: updatedEcon.prosperity,
      tierId: updatedEcon.tierId,
      decreeNudge: lastDecreeNudge
    });
  }

  /**
   * Handle economy changes after battle (security & prosperity boost)
   */
  function handleAfterBattle(enemy, area) {
    const state = engine.getState();
    const stateWithEcon = initEconomy(state);
    const econ = stateWithEcon.villageEconomy;

    // Only monsters outside the village affect trade route safety
    if (area !== 'forest' && area !== 'ruins') return;

    const isBoss = enemy && enemy.isBoss;
    const securityBonus = isBoss ? BOSS_SECURITY_BONUS : NORMAL_SECURITY_BONUS;
    const prosperityMultiplier = isBoss ? BOSS_PROSPERITY_MULTIPLIER : NORMAL_PROSPERITY_MULTIPLIER;
    const prosperityBonus = securityBonus * prosperityMultiplier;
    
    const newSecurity = clamp((econ.security || 40) + securityBonus, 0, 100);
    const newProsperity = clamp(econ.prosperity + prosperityBonus, 0, 100);

    const updatedEcon = {
      ...econ,
      security: newSecurity,
      prosperity: newProsperity
    };

    recomputeTier(updatedEcon);

    // Immutable state update
    const newState = {
      ...stateWithEcon,
      villageEconomy: updatedEcon
    };

    engine.setState(newState);

    // Emit event
    engine.emit('village:economyAfterBattle', {
      enemy,
      area,
      securityDelta: securityBonus,
      prosperityDelta: prosperityBonus,
      newTierId: updatedEcon.tierId
    });
  }

  /**
   * Handle economy changes after purchase (trade & prosperity boost)
   */
  function handleAfterPurchase(goldSpent, context = 'village') {
    goldSpent = Number(goldSpent);
    if (!Number.isFinite(goldSpent) || goldSpent <= 0) return;

    // Only village purchases boost local economy
    if (context !== 'village') return;

    const state = engine.getState();
    const stateWithEcon = initEconomy(state);
    const econ = stateWithEcon.villageEconomy;

    const tradeDelta = Math.min(PURCHASE_TRADE_MAX, goldSpent / PURCHASE_TRADE_DIVISOR);
    const prosperityDelta = Math.min(PURCHASE_PROSPERITY_MAX, goldSpent / PURCHASE_PROSPERITY_DIVISOR);

    const updatedEcon = {
      ...econ,
      trade: clamp((econ.trade || 50) + tradeDelta, 0, 100),
      prosperity: clamp(econ.prosperity + prosperityDelta, 0, 100)
    };

    recomputeTier(updatedEcon);

    // Immutable state update
    const newState = {
      ...stateWithEcon,
      villageEconomy: updatedEcon
    };

    engine.setState(newState);

    // Emit event
    engine.emit('village:economyAfterPurchase', {
      goldSpent,
      context,
      tradeDelta,
      prosperityDelta,
      newTierId: updatedEcon.tierId
    });
  }

  // Public API
  return {
    // State initialization
    initEconomy: () => {
      const state = engine.getState();
      const newState = initEconomy(state);
      if (newState !== state) {
        engine.setState(newState);
      }
    },

    // Read-only accessors (delegate to existing pure functions)
    getSummary: () => getVillageEconomySummary(engine.getState()),
    getMerchantPrice: (basePrice, context) => getMerchantPrice(basePrice, engine.getState(), context),
    getRestCost: () => getRestCost(engine.getState()),
    getTiers: () => ECONOMY_TIERS,

    // State-modifying operations (engine-integrated)
    handleDayTick,
    handleAfterBattle,
    handleAfterPurchase
  };
}
