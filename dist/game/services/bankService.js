// js/game/services/bankService.js
// Bank service - handles all banking operations through the engine
//
// This service provides deposit, withdrawal, investment, and loan operations
// through the engine's command and event system for better modularity.
export function createBankService(engine) {
    const getState = () => engine.getState();
    const setState = (newState, reason) => engine.commit(newState, reason);
    const emit = (event, payload) => engine.emit(event, payload);
    const log = engine.log;
    // Helper to ensure bank state exists
    function ensureBankState(state) {
        if (!state.bank) {
            state.bank = {
                deposits: 0,
                loans: [],
                investments: [],
                lastInterestDay: state.time?.day || 1
            };
        }
        return state;
    }
    // Initialize bank state if needed
    function initBank() {
        const state = getState();
        if (!state.bank) {
            const newState = { ...state };
            ensureBankState(newState);
            setState(newState, 'bank:init');
            log?.info?.('bank', 'Bank state initialized');
        }
    }
    // Deposit gold into bank
    function deposit(amount) {
        const state = getState();
        const player = state.player;
        if (!player || typeof amount !== 'number' || amount <= 0) {
            return { success: false, error: 'Invalid deposit amount' };
        }
        if (player.gold < amount) {
            return { success: false, error: 'Insufficient gold' };
        }
        const newState = { ...state };
        ensureBankState(newState);
        newState.player = { ...player, gold: player.gold - amount };
        newState.bank = { ...newState.bank, deposits: newState.bank.deposits + amount };
        setState(newState, 'bank:deposit');
        emit('bank:deposited', { amount, totalDeposits: newState.bank.deposits });
        log?.info?.('bank', `Deposited ${amount} gold`, { totalDeposits: newState.bank.deposits });
        return { success: true, amount, totalDeposits: newState.bank.deposits };
    }
    // Withdraw gold from bank
    function withdraw(amount) {
        const state = getState();
        const player = state.player;
        if (!player || typeof amount !== 'number' || amount <= 0) {
            return { success: false, error: 'Invalid withdrawal amount' };
        }
        if (!state.bank || state.bank.deposits < amount) {
            return { success: false, error: 'Insufficient bank deposits' };
        }
        const newState = { ...state };
        newState.player = { ...player, gold: player.gold + amount };
        newState.bank = { ...newState.bank, deposits: newState.bank.deposits - amount };
        setState(newState, 'bank:withdraw');
        emit('bank:withdrawn', { amount, remainingDeposits: newState.bank.deposits });
        log?.info?.('bank', `Withdrew ${amount} gold`, { remainingDeposits: newState.bank.deposits });
        return { success: true, amount, remainingDeposits: newState.bank.deposits };
    }
    // Invest gold (higher risk/reward)
    function invest(amount) {
        const state = getState();
        const player = state.player;
        if (!player || typeof amount !== 'number' || amount <= 0) {
            return { success: false, error: 'Invalid investment amount' };
        }
        if (player.gold < amount) {
            return { success: false, error: 'Insufficient gold' };
        }
        const newState = { ...state };
        ensureBankState(newState);
        const investment = {
            amount,
            investedDay: state.time?.day || 1,
            maturityDays: 7
        };
        newState.player = { ...player, gold: player.gold - amount };
        newState.bank = {
            ...newState.bank,
            investments: [...(newState.bank.investments || []), investment]
        };
        setState(newState, 'bank:invest');
        emit('bank:invested', { amount, investment });
        log?.info?.('bank', `Invested ${amount} gold`, investment);
        return { success: true, amount, investment };
    }
    // Cash out investments
    function cashOut() {
        const state = getState();
        const player = state.player;
        if (!state.bank || !state.bank.investments || state.bank.investments.length === 0) {
            return { success: false, error: 'No investments to cash out' };
        }
        const currentDay = state.time?.day || 1;
        let totalPayout = 0;
        const rng = engine.getService('rng');
        for (const inv of state.bank.investments) {
            const daysHeld = currentDay - inv.investedDay;
            const matured = daysHeld >= inv.maturityDays;
            // Calculate return (higher if matured)
            const baseReturn = matured ? 1.15 : 0.95; // 15% gain if matured, 5% loss if early
            const variance = rng ? (rng.random() * 0.1 - 0.05) : 0; // +/- 5% variance
            const returnRate = baseReturn + variance;
            totalPayout += Math.floor(inv.amount * returnRate);
        }
        const newState = { ...state };
        newState.player = { ...player, gold: player.gold + totalPayout };
        newState.bank = { ...newState.bank, investments: [] };
        setState(newState, 'bank:cashOut');
        emit('bank:cashedOut', { totalPayout, investmentCount: state.bank.investments.length });
        log?.info?.('bank', `Cashed out investments for ${totalPayout} gold`);
        return { success: true, totalPayout };
    }
    // Borrow gold (take loan)
    function borrow(amount) {
        const state = getState();
        const player = state.player;
        if (!player || typeof amount !== 'number' || amount <= 0) {
            return { success: false, error: 'Invalid loan amount' };
        }
        const newState = { ...state };
        ensureBankState(newState);
        const loan = {
            principal: amount,
            borrowedDay: state.time?.day || 1,
            interestRate: 0.10 // 10% interest
        };
        newState.player = { ...player, gold: player.gold + amount };
        newState.bank = {
            ...newState.bank,
            loans: [...(newState.bank.loans || []), loan]
        };
        setState(newState, 'bank:borrow');
        emit('bank:borrowed', { amount, loan });
        log?.info?.('bank', `Borrowed ${amount} gold`, loan);
        return { success: true, amount, loan };
    }
    // Repay loan
    function repay(amount) {
        const state = getState();
        const player = state.player;
        if (!player || typeof amount !== 'number' || amount <= 0) {
            return { success: false, error: 'Invalid repayment amount' };
        }
        if (!state.bank || !state.bank.loans || state.bank.loans.length === 0) {
            return { success: false, error: 'No loans to repay' };
        }
        if (player.gold < amount) {
            return { success: false, error: 'Insufficient gold' };
        }
        const newState = { ...state };
        let remaining = amount;
        const currentDay = state.time?.day || 1;
        const updatedLoans = [];
        // Repay loans (oldest first)
        for (const loan of state.bank.loans) {
            if (remaining <= 0) {
                updatedLoans.push(loan);
                continue;
            }
            const daysElapsed = currentDay - loan.borrowedDay;
            const interestOwed = Math.floor(loan.principal * loan.interestRate * (daysElapsed / 7));
            const totalOwed = loan.principal + interestOwed;
            if (remaining >= totalOwed) {
                // Pay off entire loan
                remaining -= totalOwed;
            }
            else {
                // Partial payment
                const newPrincipal = totalOwed - remaining;
                updatedLoans.push({ ...loan, principal: newPrincipal });
                remaining = 0;
            }
        }
        const amountPaid = amount - remaining;
        newState.player = { ...player, gold: player.gold - amountPaid };
        newState.bank = { ...newState.bank, loans: updatedLoans };
        setState(newState, 'bank:repay');
        emit('bank:repaid', { amountPaid, remainingLoans: updatedLoans.length });
        log?.info?.('bank', `Repaid ${amountPaid} gold on loans`, { remainingLoans: updatedLoans.length });
        return { success: true, amountPaid, remainingLoans: updatedLoans.length };
    }
    // Process daily interest
    function handleDayTick(newDay) {
        const state = getState();
        if (!state.bank || state.bank.lastInterestDay === newDay) {
            return; // Already processed today
        }
        const newState = { ...state };
        const daysElapsed = newDay - state.bank.lastInterestDay;
        // Weekly interest on deposits (2% per week)
        if (daysElapsed >= 7 && newState.bank.deposits > 0) {
            const interest = Math.floor(newState.bank.deposits * 0.02);
            newState.bank = { ...newState.bank, deposits: newState.bank.deposits + interest };
            emit('bank:interestEarned', { interest, totalDeposits: newState.bank.deposits });
            log?.info?.('bank', `Earned ${interest} gold interest on deposits`);
        }
        newState.bank = { ...newState.bank, lastInterestDay: newDay };
        setState(newState, 'bank:dayTick');
    }
    // Get bank summary
    function getSummary() {
        const state = getState();
        if (!state.bank) {
            return { deposits: 0, loans: [], investments: [], totalDebt: 0, totalInvestments: 0 };
        }
        const totalDebt = state.bank.loans?.reduce((sum, loan) => sum + loan.principal, 0) || 0;
        const totalInvestments = state.bank.investments?.reduce((sum, inv) => sum + inv.amount, 0) || 0;
        return {
            deposits: state.bank.deposits || 0,
            loans: state.bank.loans || [],
            investments: state.bank.investments || [],
            totalDebt,
            totalInvestments
        };
    }
    return {
        initBank,
        deposit,
        withdraw,
        invest,
        cashOut,
        borrow,
        repay,
        handleDayTick,
        getSummary
    };
}
//# sourceMappingURL=bankService.js.map