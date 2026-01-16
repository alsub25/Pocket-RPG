// js/game/plugins/bankServicePlugin.js
// Plugin to register bank service with the engine
//
// This plugin exposes banking operations (deposits, withdrawals, loans, investments)
// as an engine service and handles bank commands through the engine.

import { createBankService } from '../services/bankService.js';

export function createBankServicePlugin() {
  let bankService = null;
  let dayTickHandler = null;

  return {
    id: 'ew.bankService',
    requires: ['ew.rngBridge', 'ew.timeService'], // Needs RNG and time

    init(engine) {
      try {
        // Create and register bank service
        bankService = createBankService(engine);
        engine.registerService('bank', bankService);

        // Initialize bank state
        bankService.initBank();

        engine.log?.info?.('bank', 'Bank service registered with engine', {
          service: !!bankService
        });
      } catch (e) {
        engine.log?.error?.('bank', 'Failed to register bank service', { error: e.message });
      }
    },

    start(engine) {
      // Listen for time advancement to process daily interest
      dayTickHandler = (payload) => {
        if (bankService && typeof payload.newDay === 'number') {
          bankService.handleDayTick(payload.newDay);
        }
      };
      engine.on('time:dayChanged', dayTickHandler);

      // Register command handlers for bank operations
      engine.commands?.register('bank:deposit', (payload) => {
        if (!bankService) return { success: false, error: 'Bank service not available' };
        return bankService.deposit(payload.amount);
      });

      engine.commands?.register('bank:withdraw', (payload) => {
        if (!bankService) return { success: false, error: 'Bank service not available' };
        return bankService.withdraw(payload.amount);
      });

      engine.commands?.register('bank:invest', (payload) => {
        if (!bankService) return { success: false, error: 'Bank service not available' };
        return bankService.invest(payload.amount);
      });

      engine.commands?.register('bank:cashOut', () => {
        if (!bankService) return { success: false, error: 'Bank service not available' };
        return bankService.cashOut();
      });

      engine.commands?.register('bank:borrow', (payload) => {
        if (!bankService) return { success: false, error: 'Bank service not available' };
        return bankService.borrow(payload.amount);
      });

      engine.commands?.register('bank:repay', (payload) => {
        if (!bankService) return { success: false, error: 'Bank service not available' };
        return bankService.repay(payload.amount);
      });

      engine.commands?.register('bank:getSummary', () => {
        if (!bankService) return null;
        return bankService.getSummary();
      });

      engine.log?.info?.('bank', 'Bank service started and commands registered');
    },

    stop(engine) {
      // Cleanup event listeners
      if (dayTickHandler) {
        engine.off('time:dayChanged', dayTickHandler);
        dayTickHandler = null;
      }

      // Unregister commands
      const commands = ['deposit', 'withdraw', 'invest', 'cashOut', 'borrow', 'repay', 'getSummary'];
      commands.forEach(cmd => {
        try {
          engine.commands?.unregister(`bank:${cmd}`);
        } catch (e) {
          // Ignore errors during cleanup
        }
      });

      engine.log?.info?.('bank', 'Bank service stopped');
    },

    dispose(engine) {
      // Service cleanup (engine doesn't have unregisterService method)
      bankService = null;
    }
  };
}
