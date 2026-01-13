// js/game/plugins/gameCommandsPlugin.js
// Routes user-initiated game actions through engine.commands.
//
// Goal: a single "mutation gateway" for top-level actions. The handlers below
// call into existing orchestrator functions for now (incremental migration).

function _str(x) {
  try { return String(x || '') } catch (_) { return '' }
}

function _fn(x) { return (typeof x === 'function') ? x : null }

export function createGameCommandsPlugin(deps = {}) {
  const fns = {
    // Explore / navigation
    explore: _fn(deps.explore),
    openExploreModal: _fn(deps.openExploreModal),
    setExploreChoiceMadeFalse: _fn(deps.setExploreChoiceMadeFalse),

    // Village
    openTavern: _fn(deps.openTavern),
    openBank: _fn(deps.openBank),
    openMerchant: _fn(deps.openMerchant),
    openTownHall: _fn(deps.openTownHall),
    openGovernment: _fn(deps.openGovernment),
    openElderRowan: _fn(deps.openElderRowan),

    // UI helpers
    openInventory: _fn(deps.openInventory),
    openSpells: _fn(deps.openSpells),

    // Combat
    combatAttack: _fn(deps.combatAttack),
    combatInterrupt: _fn(deps.combatInterrupt),
    combatFlee: _fn(deps.combatFlee),

    // Combat: abilities/spells
    combatCastAbility: _fn(deps.combatCastAbility),

    // Inventory
    inventoryUsePotion: _fn(deps.inventoryUsePotion),
    inventoryEquip: _fn(deps.inventoryEquip),
    inventoryUnequip: _fn(deps.inventoryUnequip),
    inventorySell: _fn(deps.inventorySell),
    inventoryDrop: _fn(deps.inventoryDrop),

    // Merchant / shop
    merchantBuy: _fn(deps.merchantBuy),

    // Bank
    bankDeposit: _fn(deps.bankDeposit),
    bankWithdraw: _fn(deps.bankWithdraw),
    bankInvest: _fn(deps.bankInvest),
    bankCashOut: _fn(deps.bankCashOut),
    bankBorrow: _fn(deps.bankBorrow),
    bankRepay: _fn(deps.bankRepay),
  }

  return {
    id: 'ew.gameCommands',

    start(engine) {
      if (!engine || !engine.commands || typeof engine.commands.use !== 'function') return

      engine.commands.use((ctx, next) => {
        const type = _str(ctx?.command?.type)
        const payload = ctx?.command?.payload || null

        // ---- Explore / navigation ----------------------------------------
        if (type === 'GAME_EXPLORE') {
          try { fns.explore?.(payload) } catch (_) {}
          return
        }

        if (type === 'GAME_CHANGE_AREA') {
          try { fns.setExploreChoiceMadeFalse?.() } catch (_) {}
          try { fns.openExploreModal?.(payload) } catch (_) {}
          return
        }

        // ---- Village -----------------------------------------------------
        if (type === 'GAME_OPEN_TAVERN') {
          try { fns.openTavern?.(payload) } catch (_) {}
          return
        }
        if (type === 'GAME_OPEN_BANK') {
          try { fns.openBank?.(payload) } catch (_) {}
          return
        }
        if (type === 'GAME_OPEN_MERCHANT') {
          try { fns.openMerchant?.(payload) } catch (_) {}
          return
        }
        if (type === 'GAME_OPEN_TOWN_HALL') {
          try { fns.openTownHall?.(payload) } catch (_) {}
          return
        }
        if (type === 'GAME_OPEN_GOVERNMENT') {
          try { fns.openGovernment?.(payload) } catch (_) {}
          return
        }
        if (type === 'GAME_OPEN_ELDER_ROWAN') {
          try { fns.openElderRowan?.(payload) } catch (_) {}
          return
        }

        // ---- UI helpers --------------------------------------------------
        if (type === 'GAME_OPEN_INVENTORY') {
          try { fns.openInventory?.(payload?.inCombat) } catch (_) {}
          return
        }
        if (type === 'GAME_OPEN_SPELLS') {
          try { fns.openSpells?.(payload?.inCombat) } catch (_) {}
          return
        }

        // ---- Combat ------------------------------------------------------
        if (type === 'COMBAT_ATTACK') {
          try { fns.combatAttack?.(payload) } catch (_) {}
          return
        }
        if (type === 'COMBAT_INTERRUPT') {
          try { fns.combatInterrupt?.(payload) } catch (_) {}
          return
        }
        if (type === 'COMBAT_FLEE') {
          try { fns.combatFlee?.(payload) } catch (_) {}
          return
        }

        if (type === 'COMBAT_CAST_ABILITY') {
          try { fns.combatCastAbility?.(payload) } catch (_) {}
          return
        }

        // ---- Inventory ---------------------------------------------------
        if (type === 'INVENTORY_USE_POTION') {
          try { fns.inventoryUsePotion?.(payload) } catch (_) {}
          return
        }
        if (type === 'INVENTORY_EQUIP') {
          try { fns.inventoryEquip?.(payload) } catch (_) {}
          return
        }
        if (type === 'INVENTORY_UNEQUIP') {
          try { fns.inventoryUnequip?.(payload) } catch (_) {}
          return
        }
        if (type === 'INVENTORY_SELL') {
          try { fns.inventorySell?.(payload) } catch (_) {}
          return
        }
        if (type === 'INVENTORY_DROP') {
          try { fns.inventoryDrop?.(payload) } catch (_) {}
          return
        }

        // ---- Merchant / shop --------------------------------------------
        if (type === 'SHOP_BUY') {
          try { fns.merchantBuy?.(payload) } catch (_) {}
          return
        }

        // ---- Bank --------------------------------------------------------
        if (type === 'BANK_DEPOSIT') {
          try { fns.bankDeposit?.(payload) } catch (_) {}
          return
        }
        if (type === 'BANK_WITHDRAW') {
          try { fns.bankWithdraw?.(payload) } catch (_) {}
          return
        }
        if (type === 'BANK_INVEST') {
          try { fns.bankInvest?.(payload) } catch (_) {}
          return
        }
        if (type === 'BANK_CASH_OUT') {
          try { fns.bankCashOut?.(payload) } catch (_) {}
          return
        }
        if (type === 'BANK_BORROW') {
          try { fns.bankBorrow?.(payload) } catch (_) {}
          return
        }
        if (type === 'BANK_REPAY') {
          try { fns.bankRepay?.(payload) } catch (_) {}
          return
        }

        return next()
      })
    }
  }
}
