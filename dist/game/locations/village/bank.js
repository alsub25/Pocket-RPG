// Locations/Village/bank.js
// Village Bank: deposits, loans, and investments with rates driven directly
// by the village economy and the in-game time system.
//
// Weekly interest:
// - Uses state.time.dayIndex as the "calendar day" (see Systems/timeSystem.js).
// - A banking week = 7 in-game days.
// - If multiple weeks passed since last interest, apply multiple weekly ticks
//   with compounding and show a summary of what happened.
import { getVillageEconomySummary } from "./villageEconomy.ts";
import { sanitizeGold } from "../../systems/safety.ts";
const BANK_DAYS_PER_WEEK = 7;
// --- Helpers to talk to the time system -----------------------------------
function getCurrentDayIndex(state) {
    // timeSystem.js maintains time.dayIndex as "absolute day" already.
    // If it's missing or corrupted (NaN/Infinity/negative), treat as day 0.
    const t = state.time;
    const raw = t && typeof t.dayIndex === "number" ? Number(t.dayIndex) : 0;
    return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 0;
}
// --- Bank state ------------------------------------------------------------
function initBankState(state) {
    if (!state.bank) {
        state.bank = {
            balance: 0, // gold stored as savings
            investments: 0, // gold invested in higher-risk assets
            loan: null, // { balance: number, baseRate: number }
            visits: 0, // legacy; no longer used for timing
            lastInterestDay: null // last calendar day (time.dayIndex) interest was applied
        };
    }
    else {
        state.bank.balance = sanitizeGold(state.bank.balance);
        state.bank.investments = sanitizeGold(state.bank.investments);
        if (!state.bank.loan) {
            state.bank.loan = null;
        }
        else {
            // sanitize existing loan
            state.bank.loan.balance = sanitizeGold(state.bank.loan.balance);
            const br = Number(state.bank.loan.baseRate);
            state.bank.loan.baseRate = Number.isFinite(br) ? br : 0;
        }
        if (!Number.isFinite(Number(state.bank.visits)))
            state.bank.visits = 0;
        // NOTE: lastInterestDay may be:
        //  - null/undefined (uninitialized)
        //  - a number (including negative values in dev/smoke scenarios)
        //  - a numeric string (legacy saves)
        // We keep null/undefined as-is so the interest engine can treat it as
        // "first ever run". We preserve negative values to allow backfilling
        // in controlled scenarios (e.g., automated tests).
        const rawLid = state.bank.lastInterestDay;
        if (rawLid === null || typeof rawLid === "undefined") {
            state.bank.lastInterestDay = null;
        }
        else {
            const lid = Number(rawLid);
            state.bank.lastInterestDay = Number.isFinite(lid) ? Math.floor(lid) : null;
        }
    }
    return state.bank;
}
// --- Rates from village economy -------------------------------------------
// Compute the current interest rates based directly on the village economy.
// These rates are per *banking week* when interest is applied.
function getCurrentRates(state) {
    const summary = getVillageEconomySummary(state);
    const tier = summary.tier;
    const prosperity = typeof summary.prosperity === "number" ? summary.prosperity : 50;
    const trade = typeof summary.trade === "number" ? summary.trade : 50;
    const security = typeof summary.security === "number" ? summary.security : 50;
    // Average economic "health" 0–100 → 0..1
    let avgScore = (prosperity + trade + security) / 3;
    let f = avgScore / 100;
    if (f < 0)
        f = 0;
    if (f > 1)
        f = 1;
    // Base curves (BEFORE tier/decree modifiers):
    // - Better economy (f high) → better deposit/investment rates, lower loan rates
    // - Worse economy (f low) → weak deposit returns, punishing loan interest
    const baseDepositRate = 0.002 + f * 0.010; // 0.2% .. 1.2% per week
    const baseInvestmentRate = 0.004 + f * 0.026; // 0.4% .. 3.0% per week
    const baseLoanRate = 0.040 + (1 - f) * 0.060; // 4.0% .. 10.0% per week
    // Tier tweaks (from villageEconomy tiers)
    let tierMultDeposit = 1;
    let tierMultInvestment = 1;
    let tierMultLoan = 1;
    if (tier.id === "struggling") {
        // Struggling: savings are weak, loans harsh
        tierMultDeposit = 0.7;
        tierMultInvestment = 0.9;
        tierMultLoan = 1.2;
    }
    else if (tier.id === "thriving") {
        // Thriving: village rewards savers/investors, loans a bit kinder
        tierMultDeposit = 1.3;
        tierMultInvestment = 1.1;
        tierMultLoan = 0.8;
    }
    // Town Hall / council petitions can place a short-lived modifier on
    // interest rates via state.government.townHallEffects. We only apply it
    // while it is active for the current in-game day.
    const g = state.government;
    const t = state.time;
    const todayRaw = t && typeof t.dayIndex === "number" ? Number(t.dayIndex) : 0;
    const today = Number.isFinite(todayRaw) && todayRaw >= 0 ? Math.floor(todayRaw) : 0;
    let decreeMultDeposit = 1;
    let decreeMultInvestment = 1;
    let decreeMultLoan = 1;
    let decreeTitle = null;
    if (g && g.townHallEffects) {
        const eff = g.townHallEffects;
        const expiresOnDay = typeof eff.expiresOnDay === "number"
            ? eff.expiresOnDay
            : null;
        if (expiresOnDay != null && today <= expiresOnDay) {
            decreeTitle = eff.title || eff.petitionId || null;
            if (typeof eff.depositRateMultiplier === "number") {
                decreeMultDeposit = eff.depositRateMultiplier;
            }
            if (typeof eff.investmentRateMultiplier === "number") {
                decreeMultInvestment = eff.investmentRateMultiplier;
            }
            if (typeof eff.loanRateMultiplier === "number") {
                decreeMultLoan = eff.loanRateMultiplier;
            }
        }
    }
    // Clamp to sane bounds so petitions can't accidentally create nonsense
    const clampRate = r => {
        if (!Number.isFinite(r))
            return 0;
        if (r < 0)
            return 0;
        if (r > 0.5)
            return 0.5; // cap at 50% per week just in case
        return r;
    };
    const depositRate = clampRate(baseDepositRate * tierMultDeposit * decreeMultDeposit);
    const investmentRate = clampRate(baseInvestmentRate * tierMultInvestment * decreeMultInvestment);
    const loanRate = clampRate(baseLoanRate * tierMultLoan * decreeMultLoan);
    return {
        depositRate,
        investmentRate,
        loanRate,
        breakdown: {
            avgScore: Math.round(avgScore * 10) / 10,
            economyFactor: Math.round(f * 1000) / 1000,
            tierId: tier?.id || null,
            tierName: tier?.name || null,
            base: {
                deposit: baseDepositRate,
                investment: baseInvestmentRate,
                loan: baseLoanRate
            },
            tierMultipliers: {
                deposit: tierMultDeposit,
                investment: tierMultInvestment,
                loan: tierMultLoan
            },
            decree: {
                title: decreeTitle,
                multipliers: {
                    deposit: decreeMultDeposit,
                    investment: decreeMultInvestment,
                    loan: decreeMultLoan
                }
            }
        }
    };
}
function formatPercent(rate) {
    return (rate * 100).toFixed(1) + "%";
}
// ---------------------------------------------------------------------------
// COMMAND HELPERS (exported)
// ---------------------------------------------------------------------------
// These helpers allow the engine command bus to execute bank actions
// deterministically (replay/telemetry/snapshots), while the modal UI can
// simply dispatch commands.
export function bankDeposit({ state, amt, addLog, recordInput, updateHUD, saveGame } = {}) {
    const p = state && state.player ? state.player : null;
    if (!p)
        return false;
    const bank = initBankState(state);
    const log = typeof addLog === 'function' ? addLog : () => { };
    const amount = Math.floor(Number(amt));
    if (!Number.isFinite(amount) || amount <= 0)
        return false;
    if ((p.gold || 0) < amount) {
        log('You do not have that much gold.', 'system');
        return false;
    }
    try {
        recordInput?.('bank.deposit', { amt: amount });
    }
    catch (_) { }
    p.gold = sanitizeGold((p.gold || 0) - amount);
    bank.balance = sanitizeGold((bank.balance || 0) + amount);
    log(`You deposit ${amount} gold into your savings account.`, 'good');
    try {
        updateHUD?.();
    }
    catch (_) { }
    try {
        saveGame?.();
    }
    catch (_) { }
    return true;
}
export function bankWithdraw({ state, amt, addLog, recordInput, updateHUD, saveGame } = {}) {
    const p = state && state.player ? state.player : null;
    if (!p)
        return false;
    const bank = initBankState(state);
    const log = typeof addLog === 'function' ? addLog : () => { };
    const amount = Math.floor(Number(amt));
    if (!Number.isFinite(amount) || amount <= 0)
        return false;
    if ((bank.balance || 0) < amount) {
        log('You do not have that much in savings.', 'system');
        return false;
    }
    try {
        recordInput?.('bank.withdraw', { amt: amount });
    }
    catch (_) { }
    bank.balance = sanitizeGold((bank.balance || 0) - amount);
    p.gold = sanitizeGold((p.gold || 0) + amount);
    log(`You withdraw ${amount} gold from your savings account.`, 'good');
    try {
        updateHUD?.();
    }
    catch (_) { }
    try {
        saveGame?.();
    }
    catch (_) { }
    return true;
}
export function bankInvest({ state, amt, addLog, recordInput, updateHUD, saveGame } = {}) {
    const p = state && state.player ? state.player : null;
    if (!p)
        return false;
    const bank = initBankState(state);
    const log = typeof addLog === 'function' ? addLog : () => { };
    const amount = Math.floor(Number(amt));
    if (!Number.isFinite(amount) || amount <= 0)
        return false;
    if ((p.gold || 0) < amount) {
        log('You do not have that much gold.', 'system');
        return false;
    }
    try {
        recordInput?.('bank.invest', { amt: amount });
    }
    catch (_) { }
    p.gold = sanitizeGold((p.gold || 0) - amount);
    bank.investments = sanitizeGold((bank.investments || 0) + amount);
    log(`You invest ${amount} gold into longer-term ventures.`, 'good');
    try {
        updateHUD?.();
    }
    catch (_) { }
    try {
        saveGame?.();
    }
    catch (_) { }
    return true;
}
export function bankCashOut({ state, addLog, updateHUD, saveGame } = {}) {
    const p = state && state.player ? state.player : null;
    if (!p)
        return false;
    const bank = initBankState(state);
    const log = typeof addLog === 'function' ? addLog : () => { };
    if ((bank.investments || 0) <= 0) {
        log('You have no investments to cash out.', 'system');
        return false;
    }
    const feeRate = 0.05;
    const fee = Math.floor((bank.investments || 0) * feeRate);
    const payout = sanitizeGold((bank.investments || 0) - fee);
    bank.investments = 0;
    p.gold = sanitizeGold((p.gold || 0) + payout);
    log(`You cash out your investments, receiving ${payout} gold after ${fee} gold in fees.`, 'system');
    try {
        updateHUD?.();
    }
    catch (_) { }
    try {
        saveGame?.();
    }
    catch (_) { }
    return true;
}
export function bankBorrow({ state, amt, addLog, recordInput, updateHUD, saveGame } = {}) {
    const p = state && state.player ? state.player : null;
    if (!p)
        return false;
    const bank = initBankState(state);
    const log = typeof addLog === 'function' ? addLog : () => { };
    const amount = Math.floor(Number(amt));
    if (!Number.isFinite(amount) || amount <= 0)
        return false;
    if (amount > 500) {
        log('The bank refuses to lend you that much in one go.', 'system');
        return false;
    }
    if (!bank.loan) {
        const baseRates = getCurrentRates(state);
        bank.loan = { balance: 0, baseRate: baseRates.loanRate };
    }
    const currentLoan = bank.loan && bank.loan.balance > 0 ? sanitizeGold(bank.loan.balance) : 0;
    if (currentLoan + amount > 1000) {
        log('The banker frowns. "Settle some of your existing debt before borrowing more."', 'danger');
        return false;
    }
    p.gold = sanitizeGold((p.gold || 0) + amount);
    bank.loan.balance = sanitizeGold(currentLoan + amount);
    try {
        recordInput?.('bank.borrow', { amt: amount });
    }
    catch (_) { }
    log(`You take a loan of ${amount} gold. Interest will accrue until you repay it.`, 'danger');
    try {
        updateHUD?.();
    }
    catch (_) { }
    try {
        saveGame?.();
    }
    catch (_) { }
    return true;
}
export function bankRepay({ state, amt, addLog, recordInput, updateHUD, saveGame } = {}) {
    const p = state && state.player ? state.player : null;
    if (!p)
        return false;
    const bank = initBankState(state);
    const log = typeof addLog === 'function' ? addLog : () => { };
    const current = bank.loan && bank.loan.balance > 0 ? sanitizeGold(bank.loan.balance) : 0;
    if (current <= 0) {
        log('You have no outstanding loan to repay.', 'system');
        return false;
    }
    const max = Math.min(current, sanitizeGold(p.gold || 0));
    const amount = Math.floor(Number(amt));
    if (!Number.isFinite(amount) || amount <= 0)
        return false;
    if (amount > max) {
        log('You cannot repay more than you currently owe and carry.', 'system');
        return false;
    }
    p.gold = sanitizeGold((p.gold || 0) - amount);
    bank.loan.balance = sanitizeGold(current - amount);
    try {
        recordInput?.('bank.repay', { amt: amount });
    }
    catch (_) { }
    if ((bank.loan.balance || 0) <= 0) {
        bank.loan.balance = 0;
        log('You fully repay your loan. The banker notes it with a nod.', 'good');
    }
    else {
        log(`You repay ${amount} gold towards your loan. Remaining balance: ${bank.loan.balance}g.`, 'system');
    }
    try {
        updateHUD?.();
    }
    catch (_) { }
    try {
        saveGame?.();
    }
    catch (_) { }
    return true;
}
// --- Weekly interest engine -----------------------------------------------
/**
 * Apply one or more "weekly" interest ticks to all bank products.
 *
 * - Uses state.time.dayIndex as the in-game calendar day.
 * - A banking week is BANK_DAYS_PER_WEEK days.
 * - If multiple weeks passed since the last interest day, applies
 *   multiple weekly ticks with compounding.
 *
 * Returns:
 *   {
 *     anyChange: boolean,
 *     weeksApplied: number,
 *     totals: { savings, investments, loans },
 *     rates: { depositRate, investmentRate, loanRate }
 *   }
 */
function applyInterest(state, addLog) {
    const bank = initBankState(state);
    bank.visits += 1;
    // addLog is optional; guard so applyInterest can be reused safely.
    const log = typeof addLog === "function" ? addLog : null;
    const currentDay = getCurrentDayIndex(state);
    const { depositRate, investmentRate, loanRate } = getCurrentRates(state);
    let anyChange = false;
    let weeksApplied = 0;
    let savingsInterestTotal = 0;
    let investInterestTotal = 0;
    let loanInterestTotal = 0;
    // First-ever run: initialize the reference day and bail.
    // (Treat null/undefined as uninitialized; do not coerce with Number(null) -> 0.)
    if (bank.lastInterestDay === null || typeof bank.lastInterestDay === "undefined" || !Number.isFinite(Number(bank.lastInterestDay))) {
        bank.lastInterestDay = currentDay;
        // Patch/migration quality-of-life: give a one-time note so it doesn't feel "broken".
        // This runs the first time the player opens the bank after the weekly-interest system exists.
        if (!bank._weeklyInterestInitialized) {
            bank._weeklyInterestInitialized = true;
            if (log) {
                log("The bank updates its ledgers to weekly interest cycles.", "system");
            }
        }
        return {
            anyChange: false,
            weeksApplied: 0,
            totals: { savings: 0, investments: 0, loans: 0 },
            rates: { depositRate, investmentRate, loanRate }
        };
    }
    // Defensive: if the calendar ever goes backwards (save rollback, dev tools, etc.),
    // don't strand the interest engine in a negative delta.
    let daysDelta = currentDay - Number(bank.lastInterestDay);
    if (!Number.isFinite(daysDelta)) {
        bank.lastInterestDay = currentDay;
        daysDelta = 0;
    }
    if (daysDelta < 0) {
        bank.lastInterestDay = currentDay;
        daysDelta = 0;
        if (!bank._weeklyInterestRecalibrated) {
            bank._weeklyInterestRecalibrated = true;
            if (log) {
                log("The bank recalibrates its ledgers after a calendar discrepancy.", "system");
            }
        }
    }
    if (daysDelta >= BANK_DAYS_PER_WEEK) {
        weeksApplied = Math.floor(daysDelta / BANK_DAYS_PER_WEEK);
    }
    // Defensive cap: if something corrupted lastInterestDay far into the past,
    // don't explode balances with thousands of compounded weeks.
    const MAX_WEEKS_BACKLOG = 260; // ~5 in-game years of weekly ticks
    const remainderDays = daysDelta >= 0 ? (daysDelta % BANK_DAYS_PER_WEEK) : 0;
    let backlogCapped = false;
    if (weeksApplied > MAX_WEEKS_BACKLOG) {
        weeksApplied = MAX_WEEKS_BACKLOG;
        backlogCapped = true;
    }
    // No full weeks passed -> just return current rates snapshot
    if (weeksApplied <= 0) {
        return {
            anyChange,
            weeksApplied: 0,
            totals: {
                savings: 0,
                investments: 0,
                loans: 0
            },
            rates: { depositRate, investmentRate, loanRate }
        };
    }
    // Apply N weekly ticks, compounding as we go
    for (let i = 0; i < weeksApplied; i++) {
        if (bank.balance > 0) {
            const interest = Math.floor(bank.balance * depositRate);
            if (interest > 0) {
                bank.balance += interest;
                savingsInterestTotal += interest;
                anyChange = true;
            }
        }
        if (bank.investments > 0) {
            const interest = Math.floor(bank.investments * investmentRate);
            if (interest > 0) {
                bank.investments += interest;
                investInterestTotal += interest;
                anyChange = true;
            }
        }
        if (bank.loan && bank.loan.balance > 0) {
            const interest = Math.ceil(bank.loan.balance * loanRate);
            if (interest > 0) {
                bank.loan.balance += interest;
                loanInterestTotal += interest;
                anyChange = true;
            }
        }
    }
    // Aggregate logs so you don't get spammed if many weeks passed
    if (log && savingsInterestTotal > 0) {
        log(`Since your last banking week, your savings earn ${savingsInterestTotal} gold in interest.`, "system");
    }
    if (log && investInterestTotal > 0) {
        log(`Since your last banking week, your investments yield ${investInterestTotal} gold in returns.`, "good");
    }
    if (log && loanInterestTotal > 0) {
        log(`Since your last banking week, interest adds ${loanInterestTotal} gold to your outstanding loan.`, "danger");
    }
    // Move lastInterestDay forward by the number of *whole* weeks we consumed.
    // This preserves any "leftover" days towards the next week.
    // If we capped the backlog, snap the reference point to avoid repeated
    // re-application on every bank visit.
    const daysConsumed = weeksApplied * BANK_DAYS_PER_WEEK;
    bank.lastInterestDay = Number(bank.lastInterestDay);
    if (!Number.isFinite(bank.lastInterestDay))
        bank.lastInterestDay = currentDay;
    bank.lastInterestDay += daysConsumed;
    if (backlogCapped) {
        bank.lastInterestDay = currentDay - remainderDays;
        if (log && !bank._weeklyInterestBacklogCapped) {
            bank._weeklyInterestBacklogCapped = true;
            log("The bank's ledgers are unusually old; weekly interest has been capped to protect account stability.", "system");
        }
    }
    return {
        anyChange,
        weeksApplied,
        totals: {
            savings: savingsInterestTotal,
            investments: investInterestTotal,
            loans: loanInterestTotal
        },
        rates: { depositRate, investmentRate, loanRate }
    };
}
// --- Public UI entry point -------------------------------------------------
export function openBankModalImpl({ state, openModal, addLog, recordInput, updateHUD, saveGame, dispatchCommand }) {
    const p = state.player;
    if (!p)
        return;
    const bank = initBankState(state);
    // Apply weekly interest first so the numbers you see are current
    const { anyChange, weeksApplied, totals, rates } = applyInterest(state, addLog);
    // Pull a fresh rate snapshot (with a breakdown) for UI explanation.
    const rateExplain = getCurrentRates(state);
    // Pull the current village economy summary for display
    const econSummary = getVillageEconomySummary(state);
    const tier = econSummary.tier;
    openModal("Emberwood Bank", body => {
        // Flavor intro
        const intro = document.createElement("p");
        intro.className = "modal-subtitle";
        intro.textContent =
            "Stone walls and ledger-lined counters greet you. The banker watches your purse with professional interest.";
        body.appendChild(intro);
        // --- ECONOMY SNAPSHOT & RATES CARD ------------------------------------
        const econRow = document.createElement("div");
        econRow.className = "item-row";
        const econHeader = document.createElement("div");
        econHeader.className = "item-row-header";
        const econTitle = document.createElement("span");
        econTitle.className = "item-name";
        econTitle.textContent = "Emberwood Market Snapshot";
        econHeader.appendChild(econTitle);
        const econTag = document.createElement("span");
        econTag.className = "tag";
        econTag.textContent = tier.name;
        econHeader.appendChild(econTag);
        econRow.appendChild(econHeader);
        const econText = document.createElement("p");
        econText.className = "modal-subtitle";
        econText.textContent =
            `Prosperity ${econSummary.prosperity} • ` +
                `Trade ${econSummary.trade} • ` +
                `Security ${econSummary.security}`;
        econRow.appendChild(econText);
        const rateLine = document.createElement("p");
        rateLine.className = "modal-subtitle";
        rateLine.textContent =
            `Weekly rates — Savings: ${formatPercent(rates.depositRate)}, ` +
                `Investments: ${formatPercent(rates.investmentRate)}, ` +
                `Loans: ${formatPercent(rates.loanRate)}.`;
        econRow.appendChild(rateLine);
        // --- Rate breakdown -------------------------------------------------
        // Players should be able to see *why* the bank offers these numbers.
        const bd = rateExplain?.breakdown;
        if (bd) {
            const details = document.createElement('details');
            details.style.marginTop = '6px';
            const summaryEl = document.createElement('summary');
            summaryEl.textContent = 'Rate breakdown';
            summaryEl.style.cursor = 'pointer';
            summaryEl.style.userSelect = 'none';
            details.appendChild(summaryEl);
            const list = document.createElement('ul');
            list.style.margin = '6px 0 0 1rem';
            list.style.padding = '0';
            list.style.fontSize = '0.78rem';
            const tierName = bd.tierName || 'Normal';
            const decreeTitle = bd.decree?.title ? String(bd.decree.title) : null;
            const lineFor = (label, base, tierMult, decreeMult, final) => {
                const li = document.createElement('li');
                const parts = [];
                parts.push(`${label}: base ${formatPercent(base)}`);
                if (tierMult !== 1)
                    parts.push(`${tierName} ×${tierMult}`);
                if (decreeMult !== 1)
                    parts.push(`${decreeTitle || 'Decree'} ×${decreeMult}`);
                parts.push(`= ${formatPercent(final)}`);
                li.textContent = parts.join(' · ');
                return li;
            };
            list.appendChild(lineFor('Savings', bd.base.deposit, bd.tierMultipliers.deposit, bd.decree.multipliers.deposit, rateExplain.depositRate));
            list.appendChild(lineFor('Investments', bd.base.investment, bd.tierMultipliers.investment, bd.decree.multipliers.investment, rateExplain.investmentRate));
            list.appendChild(lineFor('Loans', bd.base.loan, bd.tierMultipliers.loan, bd.decree.multipliers.loan, rateExplain.loanRate));
            const liMeta = document.createElement('li');
            liMeta.textContent = `Economy health score: ${bd.avgScore}/100 (used to shape base rates).`;
            list.appendChild(liMeta);
            details.appendChild(list);
            econRow.appendChild(details);
        }
        if (anyChange) {
            const note = document.createElement("p");
            note.className = "modal-subtitle";
            note.textContent =
                "The banker quietly updates your accounts based on the weeks that have passed.";
            econRow.appendChild(note);
        }
        body.appendChild(econRow);
        // --- SINCE YOU WERE AWAY (SUMMARY OF MISSED WEEKS) --------------------
        if (weeksApplied > 0) {
            const summaryCard = document.createElement("div");
            summaryCard.className = "item-row";
            const header = document.createElement("div");
            header.className = "item-row-header";
            const title = document.createElement("span");
            title.className = "item-name";
            title.textContent = "Since you were away";
            header.appendChild(title);
            const tag = document.createElement("span");
            tag.className = "tag";
            tag.textContent =
                weeksApplied === 1
                    ? "1 banking week"
                    : `${weeksApplied} banking weeks`;
            header.appendChild(tag);
            summaryCard.appendChild(header);
            const list = document.createElement("ul");
            list.style.margin = "4px 0 0 1rem";
            list.style.padding = "0";
            list.style.fontSize = "0.8rem";
            const { savings, investments, loans } = totals;
            const nothingEarned = savings <= 0 && investments <= 0 && loans <= 0;
            if (nothingEarned) {
                const li = document.createElement("li");
                li.textContent =
                    "You had no active balances, so no interest was applied.";
                list.appendChild(li);
            }
            else {
                if (savings > 0) {
                    const li = document.createElement("li");
                    li.textContent = `Savings interest earned: +${savings} gold`;
                    list.appendChild(li);
                }
                if (investments > 0) {
                    const li = document.createElement("li");
                    li.textContent = `Investment returns: +${investments} gold`;
                    list.appendChild(li);
                }
                if (loans > 0) {
                    const li = document.createElement("li");
                    li.textContent = `Loan interest charged: +${loans} gold owed`;
                    list.appendChild(li);
                }
            }
            summaryCard.appendChild(list);
            body.appendChild(summaryCard);
        }
        // --- ACCOUNT OVERVIEW CARD --------------------------------------------
        const summaryRow = document.createElement("div");
        summaryRow.className = "item-row";
        const summaryHeader = document.createElement("div");
        summaryHeader.className = "item-row-header";
        const summaryTitle = document.createElement("span");
        summaryTitle.className = "item-name";
        summaryTitle.textContent = "Account Overview";
        summaryHeader.appendChild(summaryTitle);
        summaryRow.appendChild(summaryHeader);
        const summaryGrid = document.createElement("div");
        summaryGrid.className = "stat-grid";
        const goldSpan = document.createElement("span");
        const savingsSpan = document.createElement("span");
        const investSpan = document.createElement("span");
        const loanSpan = document.createElement("span");
        function addSummaryRow(labelText, valueEl) {
            const label = document.createElement("div");
            label.className = "stat-label";
            label.textContent = labelText;
            const value = document.createElement("div");
            value.className = "stat-value";
            value.appendChild(valueEl);
            summaryGrid.appendChild(label);
            summaryGrid.appendChild(value);
        }
        addSummaryRow("On hand", goldSpan);
        addSummaryRow("Savings", savingsSpan);
        addSummaryRow("Invested", investSpan);
        addSummaryRow("Loan balance", loanSpan);
        summaryRow.appendChild(summaryGrid);
        body.appendChild(summaryRow);
        // Helper for current loan balance
        function loanBalanceNow() {
            return bank.loan && bank.loan.balance > 0 ? bank.loan.balance : 0;
        }
        function refreshSummaryText() {
            goldSpan.textContent = `${p.gold}g`;
            savingsSpan.textContent = `${bank.balance}g`;
            investSpan.textContent = `${bank.investments}g`;
            const loanBal = loanBalanceNow();
            loanSpan.textContent = loanBal > 0 ? `${loanBal}g` : "—";
        }
        // --- SAVINGS CONTROLS ---------------------------------------------------
        const savingsRow = document.createElement("div");
        savingsRow.className = "item-row";
        const savingsHeader = document.createElement("div");
        savingsHeader.className = "item-row-header";
        const savingsTitle = document.createElement("span");
        savingsTitle.className = "item-name";
        savingsTitle.textContent = "Savings Account";
        savingsHeader.appendChild(savingsTitle);
        const savingsTag = document.createElement("span");
        savingsTag.className = "tag";
        savingsTag.textContent = `${formatPercent(rates.depositRate)} / week`;
        savingsHeader.appendChild(savingsTag);
        savingsRow.appendChild(savingsHeader);
        const savingsDesc = document.createElement("p");
        savingsDesc.className = "modal-subtitle";
        savingsDesc.textContent =
            "Store gold safely and earn modest interest, boosted when Emberwood prospers.";
        savingsRow.appendChild(savingsDesc);
        const savingsBalanceText = document.createElement("p");
        savingsBalanceText.className = "modal-subtitle";
        savingsRow.appendChild(savingsBalanceText);
        const savingsActions = document.createElement("div");
        savingsActions.className = "item-actions";
        const btnDeposit = document.createElement("button");
        btnDeposit.className = "btn small";
        btnDeposit.textContent = "Deposit Gold";
        btnDeposit.addEventListener("click", () => {
            if (p.gold <= 0) {
                addLog("You have no gold to deposit.", "system");
                return;
            }
            const max = p.gold;
            const raw = prompt(`How much gold would you like to deposit? (1–${max})`);
            if (!raw)
                return;
            const amt = Math.floor(Number(raw));
            if (!Number.isFinite(amt) || amt <= 0)
                return;
            if (amt > max) {
                addLog("You do not have that much gold.", "system");
                return;
            }
            // Route through engine.commands when available.
            try {
                if (typeof dispatchCommand === 'function') {
                    dispatchCommand('BANK_DEPOSIT', { amt });
                    refreshSummaryText();
                    refreshAccountStats();
                    return;
                }
            }
            catch (_) { }
            // Fallback: mutate directly (headless / no-engine builds)
            bankDeposit({ state, amt, addLog, recordInput, updateHUD, saveGame });
            refreshSummaryText();
            refreshAccountStats();
        });
        savingsActions.appendChild(btnDeposit);
        const btnWithdraw = document.createElement("button");
        btnWithdraw.className = "btn small outline";
        btnWithdraw.textContent = "Withdraw Gold";
        btnWithdraw.addEventListener("click", () => {
            if (bank.balance <= 0) {
                addLog("You have no savings to withdraw.", "system");
                return;
            }
            const max = bank.balance;
            const raw = prompt(`How much gold would you like to withdraw? (1–${max})`);
            if (!raw)
                return;
            const amt = Math.floor(Number(raw));
            if (!Number.isFinite(amt) || amt <= 0)
                return;
            if (amt > max) {
                addLog("You do not have that much in savings.", "system");
                return;
            }
            try {
                if (typeof dispatchCommand === 'function') {
                    dispatchCommand('BANK_WITHDRAW', { amt });
                    refreshSummaryText();
                    refreshAccountStats();
                    return;
                }
            }
            catch (_) { }
            bankWithdraw({ state, amt, addLog, recordInput, updateHUD, saveGame });
            refreshSummaryText();
            refreshAccountStats();
        });
        savingsActions.appendChild(btnWithdraw);
        savingsRow.appendChild(savingsActions);
        body.appendChild(savingsRow);
        // --- INVESTMENTS CONTROLS ----------------------------------------------
        const investRow = document.createElement("div");
        investRow.className = "item-row";
        const investHeader = document.createElement("div");
        investHeader.className = "item-row-header";
        const investTitle = document.createElement("span");
        investTitle.className = "item-name";
        investTitle.textContent = "Investment Portfolio";
        investHeader.appendChild(investTitle);
        const investTag = document.createElement("span");
        investTag.className = "tag";
        investTag.textContent = `${formatPercent(rates.investmentRate)} / week`;
        investHeader.appendChild(investTag);
        investRow.appendChild(investHeader);
        const investDesc = document.createElement("p");
        investDesc.className = "modal-subtitle";
        investDesc.textContent =
            "Riskier ventures that can grow faster than savings when trade is strong.";
        investRow.appendChild(investDesc);
        const investBalanceText = document.createElement("p");
        investBalanceText.className = "modal-subtitle";
        investRow.appendChild(investBalanceText);
        const investActions = document.createElement("div");
        investActions.className = "item-actions";
        const btnInvest = document.createElement("button");
        btnInvest.className = "btn small";
        btnInvest.textContent = "Invest Gold";
        btnInvest.addEventListener("click", () => {
            if (p.gold <= 0) {
                addLog("You have no spare gold to invest.", "system");
                return;
            }
            const max = p.gold;
            const raw = prompt(`How much gold would you like to invest? (1–${max})`);
            if (!raw)
                return;
            const amt = Math.floor(Number(raw));
            if (!Number.isFinite(amt) || amt <= 0)
                return;
            if (amt > max) {
                addLog("You do not have that much gold.", "system");
                return;
            }
            try {
                if (typeof dispatchCommand === 'function') {
                    dispatchCommand('BANK_INVEST', { amt });
                    refreshSummaryText();
                    refreshAccountStats();
                    return;
                }
            }
            catch (_) { }
            bankInvest({ state, amt, addLog, recordInput, updateHUD, saveGame });
            refreshSummaryText();
            refreshAccountStats();
        });
        investActions.appendChild(btnInvest);
        const btnCashOut = document.createElement("button");
        btnCashOut.className = "btn small outline";
        btnCashOut.textContent = "Cash Out";
        btnCashOut.addEventListener("click", () => {
            if (bank.investments <= 0) {
                addLog("You have no investments to cash out.", "system");
                return;
            }
            try {
                if (typeof dispatchCommand === 'function') {
                    dispatchCommand('BANK_CASH_OUT', {});
                    refreshSummaryText();
                    refreshAccountStats();
                    return;
                }
            }
            catch (_) { }
            bankCashOut({ state, addLog, updateHUD, saveGame });
            refreshSummaryText();
            refreshAccountStats();
        });
        investActions.appendChild(btnCashOut);
        investRow.appendChild(investActions);
        body.appendChild(investRow);
        // --- LOANS CONTROLS -----------------------------------------------------
        const loanRow = document.createElement("div");
        loanRow.className = "item-row";
        const loanHeader = document.createElement("div");
        loanHeader.className = "item-row-header";
        const loanTitle = document.createElement("span");
        loanTitle.className = "item-name";
        loanTitle.textContent = "Loans & Credit";
        loanHeader.appendChild(loanTitle);
        const loanTag = document.createElement("span");
        loanTag.className = "tag";
        loanTag.textContent = `${formatPercent(rates.loanRate)} / week`;
        loanHeader.appendChild(loanTag);
        loanRow.appendChild(loanHeader);
        const loanDesc = document.createElement("p");
        loanDesc.className = "modal-subtitle";
        loanDesc.textContent =
            "Borrow gold at interest. In hard times, the terms grow harsher; in prosperous times, kinder.";
        loanRow.appendChild(loanDesc);
        const loanBalanceText = document.createElement("p");
        loanBalanceText.className = "modal-subtitle";
        loanRow.appendChild(loanBalanceText);
        const loanActions = document.createElement("div");
        loanActions.className = "item-actions";
        function ensureLoanObject() {
            if (!bank.loan) {
                const baseRates = getCurrentRates(state);
                bank.loan = {
                    balance: 0,
                    baseRate: baseRates.loanRate
                };
            }
        }
        const btnBorrow = document.createElement("button");
        btnBorrow.className = "btn small";
        btnBorrow.textContent = "Take Loan";
        btnBorrow.addEventListener("click", () => {
            ensureLoanObject();
            const raw = prompt("How much gold would you like to borrow? (max 500g)");
            if (!raw)
                return;
            const amt = Math.floor(Number(raw));
            if (!Number.isFinite(amt) || amt <= 0)
                return;
            if (amt > 500) {
                addLog("The bank refuses to lend you that much in one go.", "system");
                return;
            }
            // Soft cap: if you already owe a lot, discourage more borrowing
            const currentLoan = loanBalanceNow();
            if (currentLoan + amt > 1000) {
                addLog('The banker frowns. "Settle some of your existing debt before borrowing more."', "danger");
                return;
            }
            try {
                if (typeof dispatchCommand === 'function') {
                    dispatchCommand('BANK_BORROW', { amt });
                    refreshSummaryText();
                    refreshAccountStats();
                    return;
                }
            }
            catch (_) { }
            bankBorrow({ state, amt, addLog, recordInput, updateHUD, saveGame });
            refreshSummaryText();
            refreshAccountStats();
        });
        loanActions.appendChild(btnBorrow);
        const btnRepay = document.createElement("button");
        btnRepay.className = "btn small outline";
        btnRepay.textContent = "Repay Loan";
        btnRepay.addEventListener("click", () => {
            const current = loanBalanceNow();
            if (current <= 0) {
                addLog("You have no outstanding loan to repay.", "system");
                return;
            }
            if (p.gold <= 0) {
                addLog("You have no gold available to repay your loan.", "system");
                return;
            }
            const max = Math.min(current, p.gold);
            const raw = prompt(`How much gold would you like to repay? (1–${max})`);
            if (!raw)
                return;
            const amt = Math.floor(Number(raw));
            if (!Number.isFinite(amt) || amt <= 0)
                return;
            if (amt > max) {
                addLog("You cannot repay more than you currently owe and carry.", "system");
                return;
            }
            try {
                if (typeof dispatchCommand === 'function') {
                    dispatchCommand('BANK_REPAY', { amt });
                    refreshSummaryText();
                    refreshAccountStats();
                    return;
                }
            }
            catch (_) { }
            bankRepay({ state, amt, addLog, recordInput, updateHUD, saveGame });
            refreshSummaryText();
            refreshAccountStats();
        });
        loanActions.appendChild(btnRepay);
        loanRow.appendChild(loanActions);
        body.appendChild(loanRow);
        // Shared stats refresher for account sections
        function refreshAccountStats() {
            savingsBalanceText.textContent = `Balance: ${bank.balance}g`;
            investBalanceText.textContent = `Balance: ${bank.investments}g`;
            const loanBal = loanBalanceNow();
            loanBalanceText.textContent =
                loanBal > 0 ? `Balance: ${loanBal}g` : "No outstanding loan.";
        }
        // Initial populate for per-section balances + overview
        refreshSummaryText();
        refreshAccountStats();
        // --- FOOTER NOTE -------------------------------------------------------
        const footer = document.createElement("p");
        footer.className = "modal-subtitle";
        footer.textContent =
            "Deposits are safe from monsters and thieves. Loans, however, have a way of catching up with you.";
        body.appendChild(footer);
    });
}
//# sourceMappingURL=bank.js.map