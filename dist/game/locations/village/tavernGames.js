// Locations/Village/tavernGames.js
// Tavern gambling UI and game logic.
//
// Design goals:
// - Single source of truth for UI state (selected game, stake, call).
// - No leaked/stale footers when switching modals.
// - Play button disables when stake is unaffordable.
// - Game logic is data-driven and easy to expand.
import { rngInt, rngFloat } from "../../systems/rng.js";
/** @typedef {{
 *  state: any,
 *  openModal: (title: string, builder: (body: HTMLElement) => void) => void,
 *  addLog: (text: string, type?: string) => void,
 *  updateHUD: () => void,
 *  saveGame: () => void,
 *  closeModal: () => void,
 *  openTavernModal: () => void,
 * }} TavernGamesDeps
 */
function el(tag, opts = {}) {
    const node = document.createElement(tag);
    if (opts.className)
        node.className = opts.className;
    if (opts.text != null)
        node.textContent = String(opts.text);
    if (opts.html != null)
        node.innerHTML = String(opts.html);
    if (opts.attrs) {
        Object.entries(opts.attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
    }
    if (opts.onClick)
        node.addEventListener("click", opts.onClick);
    if (Array.isArray(opts.children))
        opts.children.forEach(c => c && node.appendChild(c));
    return node;
}
function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
function randInt(min, max) {
    return rngInt(null, min, max, 'tavernGames.randInt');
}
function pick(list) {
    if (!Array.isArray(list) || !list.length)
        return null;
    return list[rngInt(null, 0, list.length - 1, 'tavernGames.pick')];
}
// ----------------------------------------------------------------------------
// DATA
// ----------------------------------------------------------------------------
const PATRONS = [
    { id: "mira", name: "Mira the Cardsharp", mood: "shifty", favoriteGame: "cards" },
    { id: "bram", name: "Old Bram", mood: "grumpy", favoriteGame: "dice" },
    { id: "lysa", name: "Lysa One-Eye", mood: "cheery", favoriteGame: "coin" },
    { id: "tobin", name: "Tobin the Swift", mood: "cheery", favoriteGame: "dice" },
    { id: "gruk", name: "Gruk the Quiet", mood: "shifty", favoriteGame: "cards" }
];
/**
 * biasKey: which patron pool to prefer (dice/cards/coin)
 * baseStake: default stake when switching to the game
 */
const GAMES = {
    dice: {
        id: "dice",
        label: "Dice Duel",
        riskLabel: "Steady Odds",
        baseStake: 10,
        biasKey: "dice",
        description: "You and a patron each roll two dice. Higher total wins the full pot; ties push."
    },
    cards: {
        id: "cards",
        label: "High Card",
        riskLabel: "Swingy",
        baseStake: 15,
        biasKey: "cards",
        description: "You and a patron each draw a single card. Higher value wins; ties refund most of your stake."
    },
    coin: {
        id: "coin",
        label: "Coin Toss",
        riskLabel: "Simple 50/50",
        baseStake: 5,
        biasKey: "coin",
        description: "Call Heads or Tails, then flip. Simple odds, quick swings."
    },
    dragon: {
        id: "dragon",
        label: "Dragonbone Dice",
        riskLabel: "High Risk",
        baseStake: 20,
        biasKey: "dice",
        description: "You both throw carved dragonbone dice. Win big by beating the patron soundly."
    },
    runes: {
        id: "runes",
        label: "Lucky Runes",
        riskLabel: "Blessings & Omens",
        baseStake: 10,
        biasKey: "cards",
        description: "Draw a rune from a pouch. Blessings, favors, or omens decide your fortune."
    },
    wheel: {
        id: "wheel",
        label: "Elemental Wheel",
        riskLabel: "Very Swingy",
        baseStake: 15,
        biasKey: "coin",
        description: "A painted wheel spins. Where it stops can mean a small profit or a blazing jackpot."
    },
    seven: {
        id: "seven",
        label: "Seven's Reckoning",
        riskLabel: "Tactical",
        baseStake: 10,
        biasKey: "dice",
        callLabel: "Bet",
        callOptions: ["Under", "Seven", "Over"],
        description: "Choose Under (2–6), Seven, or Over (8–12), then roll two dice. Under/Over pay steady; Seven pays a rare bounty."
    },
    cups: {
        id: "cups",
        label: "Cups & Pebble",
        riskLabel: "Fast Hands",
        baseStake: 12,
        biasKey: "coin",
        callLabel: "Cup",
        callOptions: ["Left", "Center", "Right"],
        description: "A pebble vanishes beneath three cups as the patron shuffles. Pick the cup—quick wins, quicker losses."
    },
    odd: {
        id: "odd",
        label: "Odd or Even",
        riskLabel: "Even Odds",
        baseStake: 8,
        biasKey: "dice",
        callLabel: "Call",
        callOptions: ["Odd", "Even"],
        description: "A single die rolls across the table. Call odd or even before it lands—simple wagers for simple folk."
    },
    colors: {
        id: "colors",
        label: "Red & Black",
        riskLabel: "Card Luck",
        baseStake: 10,
        biasKey: "cards",
        callLabel: "Color",
        callOptions: ["Red", "Black"],
        description: "A card is drawn from a worn deck. Call Red or Black. The tavern swears the deck is fair (the tavern always swears)."
    }
};
// ----------------------------------------------------------------------------
// STATE PATCHING
// ----------------------------------------------------------------------------
function ensureGamblingState(state) {
    if (!state.gambling) {
        state.gambling = {
            lastPatronId: null,
            roundsWithPatron: 0,
            // -1..+1: soft "fortune" that drifts with streaks.
            // Positive = you feel lucky; negative = cold table.
            luck: 0,
            // 0..1: how closely the house is watching you.
            // High heat means the table gets tighter (worse odds + lower max bet).
            heat: 0,
            winStreak: 0,
            lossStreak: 0,
            // Optional timed tavern event that changes feel/odds for a few rounds.
            // { id, name, desc, roundsLeft, bias, payoutBonus, stakeMaxDelta, onlyGames? }
            event: null
        };
    }
    if (!("lastPatronId" in state.gambling))
        state.gambling.lastPatronId = null;
    if (!("roundsWithPatron" in state.gambling))
        state.gambling.roundsWithPatron = 0;
    if (typeof state.gambling.luck !== "number")
        state.gambling.luck = 0;
    state.gambling.luck = clamp(state.gambling.luck, -1, 1);
    if (typeof state.gambling.heat !== "number")
        state.gambling.heat = 0;
    state.gambling.heat = clamp(state.gambling.heat, 0, 1);
    if (typeof state.gambling.winStreak !== "number")
        state.gambling.winStreak = 0;
    if (typeof state.gambling.lossStreak !== "number")
        state.gambling.lossStreak = 0;
    if (!("event" in state.gambling))
        state.gambling.event = null;
    return state.gambling;
}
// ----------------------------------------------------------------------------
// DYNAMIC TABLE FEEL (fortune/heat/events)
// ----------------------------------------------------------------------------
const EVENT_POOL = [
    {
        id: "festival",
        name: "Festival Crowd",
        desc: "Songs spill into the tavern. Patrons toss coin like confetti.",
        rounds: [3, 6],
        bias: 0.04,
        payoutBonus: 0.08,
        stakeMaxDelta: 60
    },
    {
        id: "crooked",
        name: "Crooked Dealer",
        desc: "A new hand runs the table—quick fingers, quicker smiles.",
        rounds: [3, 5],
        bias: -0.06,
        payoutBonus: -0.05,
        stakeMaxDelta: -50
    },
    {
        id: "freeAle",
        name: "Free Ale Night",
        desc: "Half the tavern is tipsy. Mistakes happen… on both sides.",
        rounds: [4, 7],
        bias: 0.0,
        payoutBonus: 0.03,
        stakeMaxDelta: 20
    },
    {
        id: "wornDeck",
        name: "Worn Deck",
        desc: "Cards stick together. Some draws feel… suspicious.",
        rounds: [3, 6],
        bias: -0.05,
        payoutBonus: 0.0,
        stakeMaxDelta: 0,
        onlyGames: ["cards", "colors"]
    }
];
function eventApplies(event, gameId) {
    if (!event)
        return false;
    if (!Array.isArray(event.onlyGames) || !event.onlyGames.length)
        return true;
    return event.onlyGames.includes(gameId);
}
function tickGamblingDynamics(state) {
    const g = ensureGamblingState(state);
    // Drift luck/heat toward neutral each round.
    g.luck *= 0.9;
    g.heat = clamp(g.heat * 0.92, 0, 1);
    if (g.event && typeof g.event.roundsLeft === "number") {
        g.event.roundsLeft -= 1;
        if (g.event.roundsLeft <= 0)
            g.event = null;
    }
    // Chance to start a new event when none is active.
    if (!g.event && rngFloat(null, 'tavernGames.eventRoll') < 0.12) {
        const e = pick(EVENT_POOL);
        const rounds = Array.isArray(e.rounds) ? randInt(e.rounds[0], e.rounds[1]) : randInt(3, 6);
        g.event = {
            id: e.id,
            name: e.name,
            desc: e.desc,
            roundsLeft: rounds,
            bias: e.bias || 0,
            payoutBonus: e.payoutBonus || 0,
            stakeMaxDelta: e.stakeMaxDelta || 0,
            onlyGames: e.onlyGames || null
        };
    }
    return g;
}
function getPatronBias(patron, gameBiasKey) {
    if (!patron)
        return 0;
    // Shifty patrons press the edge; cheery ones play looser.
    const moodBias = patron.mood === "shifty" ? -0.03 : patron.mood === "cheery" ? 0.01 : 0;
    // If it's their favorite kind of game, they get a tiny edge from experience.
    const favoriteEdge = patron.favoriteGame === gameBiasKey ? -0.02 : 0;
    return moodBias + favoriteEdge;
}
function getTableLimits(state) {
    const g = ensureGamblingState(state);
    const baseMax = 200;
    // Heat clamps table limits.
    let max = baseMax;
    if (g.heat >= 0.75)
        max = 80;
    else if (g.heat >= 0.45)
        max = 120;
    else if (g.heat >= 0.25)
        max = 160;
    // Event can push limits up/down.
    if (g.event)
        max = max + (g.event.stakeMaxDelta || 0);
    // Hard clamp.
    max = clamp(max, 40, 300);
    return { min: 5, max };
}
function describeLuck(luck) {
    if (luck >= 0.55)
        return "Blessed";
    if (luck >= 0.2)
        return "Favored";
    if (luck <= -0.55)
        return "Cursed";
    if (luck <= -0.2)
        return "Cold";
    return "Steady";
}
function describeHeat(heat) {
    if (heat >= 0.75)
        return "High";
    if (heat >= 0.45)
        return "Rising";
    if (heat >= 0.2)
        return "Low";
    return "None";
}
function computeRoundMods({ state, patron, gameId, stake, gameBiasKey }) {
    const g = ensureGamblingState(state);
    const event = g.event;
    // Luck gives a small nudge; heat is a stronger counterweight.
    let bias = g.luck * 0.05 - g.heat * 0.09;
    bias += getPatronBias(patron, gameBiasKey);
    // Big bets attract scrutiny.
    if (stake >= 120)
        bias -= 0.02;
    if (stake >= 180)
        bias -= 0.03;
    // Event bias, only if it applies to this game.
    if (event && eventApplies(event, gameId))
        bias += event.bias || 0;
    // Streak "momentum" (tiny), but it also increases heat elsewhere.
    if (g.winStreak >= 2)
        bias += clamp(g.winStreak * 0.005, 0, 0.02);
    if (g.lossStreak >= 2)
        bias += clamp(g.lossStreak * 0.007, 0, 0.025);
    bias = clamp(bias, -0.12, 0.12);
    // Payout bonus is mostly a flavor lever; keep it modest.
    let payoutBonus = 0;
    if (event && eventApplies(event, gameId))
        payoutBonus += event.payoutBonus || 0;
    // Win streak can make the crowd eager to match you (slight payout bump), but not forever.
    payoutBonus += clamp(g.winStreak * 0.01, 0, 0.06);
    const payoutMult = clamp(1 + payoutBonus, 0.8, 1.25);
    return { bias, payoutMult, event };
}
function applyPostRoundDynamics(state, outcomeType, stake) {
    const g = ensureGamblingState(state);
    // Decay heat a little each round, but spike it on big wins.
    g.heat = clamp(g.heat + Math.min(0.18, stake / 900), 0, 1);
    if (outcomeType === "good") {
        g.winStreak += 1;
        g.lossStreak = 0;
        g.luck = clamp(g.luck + 0.18, -1, 1);
        g.heat = clamp(g.heat + 0.12 + Math.min(0.12, stake / 700), 0, 1);
    }
    else if (outcomeType === "danger") {
        g.lossStreak += 1;
        g.winStreak = 0;
        g.luck = clamp(g.luck - 0.16, -1, 1);
        // Losing cools the table's attention.
        g.heat = clamp(g.heat - 0.08, 0, 1);
    }
    else {
        // Push/neutral results soften streaks.
        g.winStreak = Math.max(0, g.winStreak - 1);
        g.lossStreak = Math.max(0, g.lossStreak - 1);
        g.luck *= 0.95;
        g.heat = clamp(g.heat - 0.03, 0, 1);
    }
    return g;
}
function ensureGamblingDebug(state) {
    if (!state.gamblingDebug) {
        state.gamblingDebug = { mode: "normal", payoutMultiplier: 1 };
    }
    if (!state.gamblingDebug.mode)
        state.gamblingDebug.mode = "normal";
    if (typeof state.gamblingDebug.payoutMultiplier !== "number" || state.gamblingDebug.payoutMultiplier <= 0) {
        state.gamblingDebug.payoutMultiplier = 1;
    }
    return state.gamblingDebug;
}
function findPatronById(id) {
    return PATRONS.find(p => p.id === id) || null;
}
function pickPatron(state, biasKey) {
    const g = ensureGamblingState(state);
    // Reuse the same patron some of the time.
    if (g.lastPatronId) {
        const last = findPatronById(g.lastPatronId);
        if (last) {
            const favorMatch = last.favoriteGame === biasKey;
            const reuseChance = favorMatch ? 0.7 : 0.5;
            if (rngFloat(null, 'tavernGames.reusePatron') < reuseChance) {
                g.roundsWithPatron = (g.roundsWithPatron || 0) + 1;
                return last;
            }
        }
    }
    // Otherwise, bias toward patrons who love this game type.
    const favored = PATRONS.filter(p => p.favoriteGame === biasKey);
    const pool = favored.length && rngFloat(null, 'tavernGames.favoredPool') < 0.6 ? favored : PATRONS;
    const patron = pick(pool);
    g.lastPatronId = patron.id;
    g.roundsWithPatron = 1;
    return patron;
}
function addFlavor(text, outcomeType, patron, roundsWithPatron) {
    if (!patron)
        return text;
    if (roundsWithPatron < 3)
        return text;
    const shortName = patron.name.split(" ")[0];
    const mood = patron.mood;
    const good = {
        grumpy: ` ${shortName} grumbles that you must be cheating, but keeps playing.`,
        cheery: ` ${shortName} laughs and insists the next round's drinks are on them.`,
        shifty: ` ${shortName}'s eyes narrow, clearly trying to learn your tricks.`
    };
    const bad = {
        grumpy: ` ${shortName} snorts, clearly satisfied to have your coin.`,
        cheery: ` ${shortName} claps you on the shoulder and tells you not to lose heart.`,
        shifty: ` ${shortName} sweeps the coins away with a practiced hand.`
    };
    const neutral = {
        grumpy: ` ${shortName} mutters that the odds will turn soon enough.`,
        cheery: ` ${shortName} just grins, happy to keep the game going.`,
        shifty: ""
    };
    if (outcomeType === "good")
        return text + (good[mood] || "");
    if (outcomeType === "danger")
        return text + (bad[mood] || "");
    return text + (neutral[mood] || "");
}
// ----------------------------------------------------------------------------
// GAME LOGIC (returns delta in gold after paying the stake)
// ----------------------------------------------------------------------------
function applyDebugBias(dbgMode, kind, playerValue, houseValue, maxValue) {
    // kind is informational; bias behavior is the same pattern for all.
    if (dbgMode === "playerFavored" && playerValue <= houseValue) {
        return { playerValue: clamp(houseValue + 1, 1, maxValue), houseValue };
    }
    if (dbgMode === "houseFavored" && playerValue >= houseValue) {
        return { playerValue, houseValue: clamp(playerValue + 1, 1, maxValue) };
    }
    return { playerValue, houseValue };
}
function applyDynamicBiasToPair(bias, playerValue, houseValue, maxValue) {
    // bias in [-0.12..+0.12]. Use it as a small chance to "tighten" or "loosen" the outcome.
    if (typeof bias !== "number" || bias === 0)
        return { playerValue, houseValue };
    // Positive bias: if you're losing/tied, chance to nudge you ahead.
    if (bias > 0 && playerValue <= houseValue && rngFloat(null, 'tavernGames.biasBoost') < bias) {
        return { playerValue: clamp(houseValue + randInt(1, 2), 1, maxValue), houseValue };
    }
    // Negative bias: if you're winning/tied, chance to nudge the house ahead.
    if (bias < 0 && playerValue >= houseValue && rngFloat(null, 'tavernGames.biasNerf') < -bias) {
        return { playerValue, houseValue: clamp(playerValue + randInt(1, 2), 1, maxValue) };
    }
    return { playerValue, houseValue };
}
function clampProb(p) {
    return clamp(p, 0.05, 0.95);
}
function playDice({ stake, patron, dbgMode, payoutMult, bias = 0 }) {
    let you = randInt(1, 6) + randInt(1, 6);
    let them = randInt(1, 6) + randInt(1, 6);
    ({ playerValue: you, houseValue: them } = applyDynamicBiasToPair(bias, you, them, 12));
    ({ playerValue: you, houseValue: them } = applyDebugBias(dbgMode, "dice", you, them, 12));
    if (you > them) {
        const win = Math.round(stake * 2 * payoutMult);
        return {
            type: "good",
            delta: win,
            text: `You roll ${you} against ${patron.name}'s ${them}. You win ${win} gold from the table.`
        };
    }
    if (you < them) {
        return {
            type: "danger",
            delta: 0,
            text: `${patron.name} rolls ${them} to your ${you}. Laughter rises as you lose your ${stake} gold stake.`
        };
    }
    return {
        type: "system",
        delta: stake,
        text: `Both you and ${patron.name} roll ${you}. The pot is pushed and your stake is returned.`
    };
}
function playCards({ stake, patron, dbgMode, payoutMult, bias = 0 }) {
    const suits = ["♠", "♥", "♦", "♣"];
    let you = randInt(1, 13);
    let them = randInt(1, 13);
    const youSuit = pick(suits);
    const themSuit = pick(suits);
    ({ playerValue: you, houseValue: them } = applyDynamicBiasToPair(bias, you, them, 13));
    ({ playerValue: you, houseValue: them } = applyDebugBias(dbgMode, "cards", you, them, 13));
    const names = { 1: "Ace", 11: "Jack", 12: "Queen", 13: "King" };
    const n = v => names[v] || String(v);
    if (you > them) {
        const win = Math.round(Math.round(stake * 2.5) * payoutMult);
        return {
            type: "good",
            delta: win,
            text: `You reveal ${n(you)}${youSuit} against ${patron.name}'s ${n(them)}${themSuit}. You rake in ${win} gold.`
        };
    }
    if (you < them) {
        return {
            type: "danger",
            delta: 0,
            text: `${patron.name} shows ${n(them)}${themSuit} to your ${n(you)}${youSuit}. You lose your ${stake} gold.`
        };
    }
    const refund = Math.round(stake * 0.75);
    return {
        type: "system",
        delta: refund,
        text: `Both cards are ${n(you)}. The table laughs and some coins slide back your way (${refund} gold).`
    };
}
function playCoin({ stake, patron, dbgMode, payoutMult, call, bias = 0 }) {
    const other = call === "Heads" ? "Tails" : "Heads";
    const pCorrect = clampProb(0.5 + bias);
    let toss = rngFloat(null, 'tavernGames.coinToss') < pCorrect ? call : other;
    if (dbgMode === "playerFavored")
        toss = call;
    if (dbgMode === "houseFavored")
        toss = call === "Heads" ? "Tails" : "Heads";
    if (toss === call) {
        const win = Math.round(stake * 2 * payoutMult);
        return {
            type: "good",
            delta: win,
            text: `The coin lands ${toss}. You called it right against ${patron.name} and scoop up ${win} gold.`
        };
    }
    return {
        type: "danger",
        delta: 0,
        text: `The coin lands ${toss}. ${patron.name} grins as your ${stake} gold vanishes into the pot.`
    };
}
function playDragon({ stake, patron, payoutMult, bias = 0 }) {
    const roll3d6 = () => randInt(1, 6) + randInt(1, 6) + randInt(1, 6);
    let you = roll3d6();
    let them = roll3d6();
    ({ playerValue: you, houseValue: them } = applyDynamicBiasToPair(bias, you, them, 18));
    let multiplier = 0;
    if (you >= them + 4)
        multiplier = 3;
    else if (you > them)
        multiplier = 2;
    else if (you === them)
        multiplier = 1;
    if (multiplier === 0) {
        return {
            type: "danger",
            delta: 0,
            text: `Dragonbone dice tumble across the felt. You roll ${you} to ${patron.name}'s ${them}, and lose your ${stake} gold stake.`
        };
    }
    if (multiplier === 1) {
        return {
            type: "system",
            delta: stake,
            text: `Matching fortunes—both totals ${you}. The table pushes the pot, returning your stake.`
        };
    }
    const win = Math.round(stake * multiplier * payoutMult);
    return {
        type: "good",
        delta: win,
        text: `The dragonbone dice flash your way: ${you} against ${patron.name}'s ${them}. You drag ${win} gold into your corner.`
    };
}
function playRunes({ stake, patron, payoutMult, bias = 0 }) {
    let roll = randInt(1, 100);
    // Positive bias pushes toward better runes; negative toward worse.
    roll = clamp(Math.round(roll + bias * 55), 1, 100);
    let multiplier = 0;
    let rune = "a dark, cracked rune";
    if (roll >= 95) {
        multiplier = 4;
        rune = "a blazing rune of fortune";
    }
    else if (roll >= 75) {
        multiplier = 2;
        rune = "a bright, promising rune";
    }
    else if (roll >= 40) {
        multiplier = 1;
        rune = "a faint flicker of luck";
    }
    if (multiplier === 0) {
        return {
            type: "danger",
            delta: 0,
            text: `${patron.name} tips the rune pouch and you draw ${rune}. The omen is poor—you lose your ${stake} gold stake.`
        };
    }
    if (multiplier === 1) {
        return {
            type: "system",
            delta: stake,
            text: `You draw ${rune}. The table decides its too vague to favor anyone, and your stake is returned.`
        };
    }
    const win = Math.round(stake * multiplier * payoutMult);
    return {
        type: "good",
        delta: win,
        text: `From the pouch you pull ${rune}, and murmurs ripple around the table. You gain ${win} gold in the name of fate.`
    };
}
function playWheel({ stake, patron, payoutMult, bias = 0 }) {
    const elements = ["Flame", "Tide", "Gale", "Stone"];
    const landed = pick(elements);
    const r = clamp(rngFloat(null, 'tavernGames.diceRoll') + bias * 0.6, 0, 0.999);
    let multiplier = 0;
    let flavor = "the wheel sputters out, leaving the element dim and cold";
    if (r < 0.5) {
        multiplier = 0;
    }
    else if (r < 0.8) {
        multiplier = 1.5;
        flavor = "a modest surge of power hums through the tavern";
    }
    else if (r < 0.95) {
        multiplier = 3;
        flavor = "the element flares brightly, drawing cheers from nearby tables";
    }
    else {
        multiplier = 5;
        flavor = "the element erupts in an imaginary blaze, and the whole tavern roars";
    }
    if (multiplier === 0) {
        return {
            type: "danger",
            delta: 0,
            text: `The Elemental Wheel settles on ${landed}; ${flavor} as your ${stake} gold is swallowed by the pot.`
        };
    }
    const win = Math.round(Math.round(stake * multiplier) * payoutMult);
    return {
        type: multiplier <= 1.5 ? "system" : "good",
        delta: win,
        text: `The Elemental Wheel clicks to a stop on ${landed}; ${flavor}. You earn ${win} gold.`
    };
}
function playSeven({ stake, patron, dbgMode, payoutMult, call, bias = 0 }) {
    // Under: 2-6, Seven: 7, Over: 8-12
    const winningTotals = bet => {
        if (bet === "Seven")
            return [7];
        if (bet === "Under")
            return [2, 3, 4, 5, 6];
        return [8, 9, 10, 11, 12];
    };
    const losingTotals = bet => {
        const all = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        const win = new Set(winningTotals(bet));
        return all.filter(t => !win.has(t));
    };
    let total = randInt(1, 6) + randInt(1, 6);
    // Small chance to flip a losing roll into a winning one (or vice versa), while keeping it plausible.
    const isWin = winningTotals(call || "Under").includes(total);
    if (!isWin && bias > 0 && rngFloat(null, 'tavernGames.totalAdjust') < bias)
        total = pick(winningTotals(call || "Under"));
    if (isWin && bias < 0 && rngFloat(null, 'tavernGames.totalAdjust') < -bias)
        total = pick(losingTotals(call || "Under"));
    if (dbgMode === "playerFavored")
        total = pick(winningTotals(call));
    if (dbgMode === "houseFavored")
        total = pick(losingTotals(call));
    let multiplier = 0;
    let betName = call || "Under";
    if (betName === "Seven") {
        multiplier = total === 7 ? 5.5 : 0;
    }
    else if (betName === "Under") {
        multiplier = total <= 6 ? 2.2 : 0;
    }
    else {
        multiplier = total >= 8 ? 2.2 : 0;
    }
    if (multiplier === 0) {
        return {
            type: "danger",
            delta: 0,
            text: `You wager ${betName}, but the dice show ${total}. ${patron.name} takes your ${stake} gold.`
        };
    }
    const win = Math.round(Math.round(stake * multiplier) * payoutMult);
    return {
        type: betName === "Seven" ? "good" : "system",
        delta: win,
        text: `You wager ${betName} and the dice land ${total}. The table pays out ${win} gold.`
    };
}
function playCups({ stake, patron, dbgMode, payoutMult, call, bias = 0 }) {
    const cups = ["Left", "Center", "Right"];
    const guess = call || "Center";
    // Base is 1/3; bias nudges it.
    const pGuess = clampProb(1 / 3 + bias);
    let pebble = rngFloat(null, 'tavernGames.shellGame') < pGuess ? guess : pick(cups.filter(c => c !== guess));
    if (dbgMode === "playerFavored")
        pebble = guess;
    if (dbgMode === "houseFavored")
        pebble = pick(cups.filter(c => c !== guess));
    if (pebble === guess) {
        const win = Math.round(Math.round(stake * 2.9) * payoutMult);
        return {
            type: "good",
            delta: win,
            text: `Your finger taps the ${guess} cup—there's the pebble! You win ${win} gold from ${patron.name}.`
        };
    }
    return {
        type: "danger",
        delta: 0,
        text: `You choose the ${guess} cup, but the pebble sits under the ${pebble}. You lose your ${stake} gold.`
    };
}
function playOddEven({ stake, patron, dbgMode, payoutMult, call, bias = 0 }) {
    const want = call || "Odd";
    const pWant = clampProb(0.5 + bias);
    const chooseWant = rngFloat(null, 'tavernGames.wantRoll') < pWant;
    const parity = chooseWant ? want : want === "Odd" ? "Even" : "Odd";
    let die = parity === "Odd" ? pick([1, 3, 5]) : pick([2, 4, 6]);
    if (dbgMode === "playerFavored")
        die = want === "Odd" ? pick([1, 3, 5]) : pick([2, 4, 6]);
    if (dbgMode === "houseFavored")
        die = want === "Odd" ? pick([2, 4, 6]) : pick([1, 3, 5]);
    const got = die % 2 === 0 ? "Even" : "Odd";
    if (got === want) {
        const win = Math.round(stake * 2 * payoutMult);
        return {
            type: "system",
            delta: win,
            text: `The die shows ${die} (${got}). You called it—${patron.name} pays you ${win} gold.`
        };
    }
    return {
        type: "danger",
        delta: 0,
        text: `The die shows ${die} (${got}). Wrong call—your ${stake} gold is gone.`
    };
}
function playColors({ stake, patron, dbgMode, payoutMult, call, bias = 0 }) {
    const suits = ["♠", "♥", "♦", "♣"];
    const suitColor = s => (s === "♥" || s === "♦" ? "Red" : "Black");
    const want = call || "Red";
    const pWant = clampProb(0.5 + bias);
    const chooseWant = rngFloat(null, 'tavernGames.wantRoll') < pWant;
    const color = chooseWant ? want : want === "Red" ? "Black" : "Red";
    let suit = color === "Red" ? pick(["♥", "♦"]) : pick(["♠", "♣"]);
    if (dbgMode === "playerFavored")
        suit = want === "Red" ? pick(["♥", "♦"]) : pick(["♠", "♣"]);
    if (dbgMode === "houseFavored")
        suit = want === "Red" ? pick(["♠", "♣"]) : pick(["♥", "♦"]);
    const got = suitColor(suit);
    if (got === want) {
        const win = Math.round(stake * 2 * payoutMult);
        return {
            type: "system",
            delta: win,
            text: `A card flips—${suit} (${got}). You called it right and win ${win} gold.`
        };
    }
    return {
        type: "danger",
        delta: 0,
        text: `A card flips—${suit} (${got}). ${patron.name} grins as you lose your ${stake} gold.`
    };
}
const GAME_RUNNERS = {
    dice: playDice,
    cards: playCards,
    coin: playCoin,
    dragon: playDragon,
    runes: playRunes,
    wheel: playWheel,
    seven: playSeven,
    cups: playCups,
    odd: playOddEven,
    colors: playColors
};
// ----------------------------------------------------------------------------
// UI ENTRYPOINT
// ----------------------------------------------------------------------------
/**
 * Main entrypoint used by Main.js.
 * @param {TavernGamesDeps} deps
 */
export function openGambleModalImpl(deps) {
    const { state, openModal, addLog, updateHUD, saveGame, closeModal, openTavernModal } = deps;
    const player = state?.player;
    if (!player)
        return;
    // Local UI state.
    let currentGameId = "dice";
    let currentStake = GAMES[currentGameId].baseStake;
    let currentCall = "Heads";
    let currentCallOptions = ["Heads", "Tails"]; // games can override via cfg.callOptions
    let currentCallLabel = "Call";
    const STAKE_MIN = 5;
    const STAKE_MAX_BASE = 200;
    function getLimits() {
        // Use dynamic table limits (heat/events) when available.
        const lim = getTableLimits(state);
        // Keep minimum aligned with this modal's minimum, even if table limits change.
        return { min: Math.max(STAKE_MIN, lim.min || STAKE_MIN), max: lim.max || STAKE_MAX_BASE };
    }
    function cleanFooters(modalBodyEl) {
        const panel = modalBodyEl?.parentElement;
        if (!panel)
            return;
        panel.querySelectorAll(".tavern-footer-actions").forEach(el => el.remove());
    }
    openModal("Tavern Games", body => {
        body.innerHTML = "";
        cleanFooters(body);
        // --- Header card ------------------------------------------------------
        const headerCard = el("div", { className: "item-row" });
        const headerTop = el("div", { className: "item-row-header" });
        headerTop.appendChild(el("span", { className: "item-name", text: "The Ember Mug Tavern" }));
        headerTop.appendChild(el("span", { className: "tag", text: "Games & Wagers" }));
        headerCard.appendChild(headerTop);
        headerCard.appendChild(el("p", {
            className: "modal-subtitle",
            text: "Dice clatter, cards slap the tables, and a dozen games vie for your coin. Patrons wave you over to join."
        }));
        const goldLine = el("p", { className: "modal-subtitle" });
        const tableLine = el("p", { className: "modal-subtitle" });
        // NEW: quick-visual meters for Luck and Heat.
        const meterRow = el("div", { className: "mini-meter-row" });
        const luckBlock = el("div", { className: "mini-meter-block" });
        const heatBlock = el("div", { className: "mini-meter-block" });
        const luckLabel = el("div", { className: "mini-meter-label", text: "Luck" });
        const heatLabel = el("div", { className: "mini-meter-label", text: "Heat" });
        const luckBar = el("div", { className: "mini-meter" });
        const heatBar = el("div", { className: "mini-meter" });
        const luckFill = el("div", { className: "mini-meter-fill" });
        const heatFill = el("div", { className: "mini-meter-fill" });
        luckBar.appendChild(luckFill);
        heatBar.appendChild(heatFill);
        luckBlock.appendChild(luckLabel);
        luckBlock.appendChild(luckBar);
        heatBlock.appendChild(heatLabel);
        heatBlock.appendChild(heatBar);
        meterRow.appendChild(luckBlock);
        meterRow.appendChild(heatBlock);
        const hintLine = el("p", { className: "modal-subtitle" });
        const eventLine = el("p", { className: "modal-subtitle" });
        const dbgLine = el("p", { className: "modal-subtitle" });
        headerCard.appendChild(goldLine);
        headerCard.appendChild(tableLine);
        headerCard.appendChild(meterRow);
        headerCard.appendChild(hintLine);
        headerCard.appendChild(eventLine);
        headerCard.appendChild(dbgLine);
        body.appendChild(headerCard);
        const currentGameCard = el("div", { className: "item-row" });
        const currentHeader = el("div", { className: "item-row-header" });
        const currentTitle = el("span", { className: "item-name", text: "Game Table" });
        const currentTag = el("span", { className: "tag" });
        currentHeader.appendChild(currentTitle);
        currentHeader.appendChild(currentTag);
        currentGameCard.appendChild(currentHeader);
        const currentDesc = el("p", { className: "modal-subtitle" });
        currentGameCard.appendChild(currentDesc);
        body.appendChild(currentGameCard);
        // --- Game selection card ---------------------------------------------
        const selectCard = el("div", { className: "item-row" });
        const selectHeader = el("div", { className: "item-row-header" });
        selectHeader.appendChild(el("span", { className: "item-name", text: "Choose Your Game" }));
        selectHeader.appendChild(el("span", { className: "tag", text: "Different odds, different thrills" }));
        selectCard.appendChild(selectHeader);
        const pillRow = el("div", { className: "item-actions tavern-game-row" });
        const gameButtons = {};
        Object.values(GAMES).forEach(cfg => {
            const btn = el("button", {
                className: "btn small tavern-game-pill",
                text: cfg.label,
                onClick: () => setGame(cfg.id)
            });
            gameButtons[cfg.id] = btn;
            pillRow.appendChild(btn);
        });
        selectCard.appendChild(pillRow);
        body.appendChild(selectCard);
        // --- Stake card -------------------------------------------------------
        const stakeCard = el("div", { className: "item-row" });
        const stakeHeader = el("div", { className: "item-row-header" });
        stakeHeader.appendChild(el("span", { className: "item-name", text: "Stake & Options" }));
        stakeHeader.appendChild(el("span", { className: "tag", text: "Adjust your wager" }));
        stakeCard.appendChild(stakeHeader);
        const stakeRow = el("div", { className: "item-actions" });
        const stakeLabel = el("span", { className: "modal-subtitle" });
        stakeRow.appendChild(stakeLabel);
        const btnDown = el("button", {
            className: "btn small outline",
            text: "-5g",
            onClick: () => {
                const lim = getLimits();
                currentStake = clamp(currentStake - 5, lim.min, lim.max);
                refreshStake();
            }
        });
        const btnUp = el("button", {
            className: "btn small outline",
            text: "+5g",
            onClick: () => {
                const lim = getLimits();
                currentStake = clamp(currentStake + 5, lim.min, lim.max);
                refreshStake();
            }
        });
        const btnMax = el("button", {
            className: "btn small outline",
            text: "M",
            attrs: { title: "Max bet" },
            onClick: () => {
                const lim = getLimits();
                currentStake = clamp(Math.min(player.gold, lim.max), lim.min, lim.max);
                refreshStake();
            }
        });
        const callBtn = el("button", {
            className: "btn small outline",
            text: `${currentCallLabel}: ${currentCall}`,
            onClick: () => {
                if (!Array.isArray(currentCallOptions) || currentCallOptions.length < 2)
                    return;
                const idx = Math.max(0, currentCallOptions.indexOf(currentCall));
                currentCall = currentCallOptions[(idx + 1) % currentCallOptions.length];
                callBtn.textContent = `${currentCallLabel}: ${currentCall}`;
            }
        });
        stakeRow.appendChild(btnDown);
        stakeRow.appendChild(btnUp);
        stakeRow.appendChild(btnMax);
        stakeRow.appendChild(callBtn);
        stakeCard.appendChild(stakeRow);
        stakeCard.appendChild(el("p", {
            className: "modal-subtitle",
            text: "Higher stakes mean bigger swings. Some games favor steady gains; others chase wild jackpots."
        }));
        body.appendChild(stakeCard);
        // --- Last round card --------------------------------------------------
        const resultCard = el("div", { className: "item-row" });
        const resultHeader = el("div", { className: "item-row-header" });
        resultHeader.appendChild(el("span", { className: "item-name", text: "Last Round" }));
        resultCard.appendChild(resultHeader);
        const resultText = el("p", { className: "modal-subtitle", text: "No bets placed yet." });
        resultCard.appendChild(resultText);
        body.appendChild(resultCard);
        // --- Footer actions (pinned) -----------------------------------------
        const footer = el("div", { className: "item-actions tavern-footer-actions" });
        const btnPlay = el("button", { className: "btn small", text: "Play Round" });
        const btnLeave = el("button", { className: "btn small outline", text: "Leave Table" });
        footer.appendChild(btnPlay);
        footer.appendChild(btnLeave);
        // Put footer under the modal panel so it stays at the bottom.
        const panel = body.parentElement;
        if (panel)
            panel.appendChild(footer);
        else
            body.appendChild(footer);
        // --- UI refresh helpers ----------------------------------------------
        function refreshGold() {
            goldLine.textContent = `Your gold: ${player.gold}g`;
            const g = ensureGamblingState(state);
            const lim = getLimits();
            const streak = g.winStreak > 0 ? `W${g.winStreak}` : g.lossStreak > 0 ? `L${g.lossStreak}` : "-";
            tableLine.textContent = `Fortune: ${describeLuck(g.luck)} · Eyes: ${describeHeat(g.heat)} · Streak: ${streak} · Table max: ${lim.max}g`;
            eventLine.textContent = g.event
                ? `Event: ${g.event.name} (${g.event.roundsLeft} rounds) — ${g.event.desc}`
                : "";
            // Meters: Luck is -1..1; Heat is 0..1.
            const luckNorm = clamp((g.luck + 1) / 2, 0, 1);
            const heatNorm = clamp(g.heat, 0, 1);
            luckFill.style.width = `${Math.round(luckNorm * 100)}%`;
            heatFill.style.width = `${Math.round(heatNorm * 100)}%`;
            luckFill.setAttribute('title', `Luck: ${describeLuck(g.luck)}`);
            heatFill.setAttribute('title', `Heat: ${describeHeat(g.heat)}`);
            hintLine.textContent =
                g.heat >= 0.65
                    ? 'The house is watching you closely. Walking away now may be wise.'
                    : g.luck <= -0.55
                        ? 'The table feels cold. If you keep playing, keep your bets small.'
                        : '';
            const dbg = ensureGamblingDebug(state);
            const mode = dbg.mode || "normal";
            const mult = dbg.payoutMultiplier || 1;
            dbgLine.textContent =
                mode !== "normal" || mult !== 1
                    ? `Debug: ${mode}, payout×${mult}`
                    : "";
        }
        function refreshStake() {
            const lim = getLimits();
            currentStake = clamp(currentStake, lim.min, lim.max);
            const affordable = player.gold >= currentStake;
            const limitNote = currentStake >= lim.max ? ` (table max ${lim.max}g)` : "";
            stakeLabel.textContent = affordable
                ? `Stake: ${currentStake}g${limitNote}`
                : `Stake: ${currentStake}g${limitNote} (need ${currentStake - player.gold}g more)`;
            btnPlay.disabled = !affordable;
        }
        function refreshCallVisibility() {
            const show = Array.isArray(currentCallOptions) && currentCallOptions.length;
            callBtn.style.display = show ? "inline-flex" : "none";
            if (show)
                callBtn.textContent = `${currentCallLabel}: ${currentCall}`;
        }
        function setGame(id) {
            const cfg = GAMES[id] || GAMES.dice;
            const lim = getLimits();
            currentGameId = cfg.id;
            currentStake = clamp(cfg.baseStake, lim.min, lim.max);
            currentCallOptions = Array.isArray(cfg.callOptions) && cfg.callOptions.length ? cfg.callOptions : [];
            currentCallLabel = cfg.callLabel || "Call";
            currentCall = currentCallOptions.length ? currentCallOptions[0] : "";
            currentTag.textContent = `${cfg.label} · ${cfg.riskLabel}`;
            currentDesc.textContent = cfg.description;
            Object.values(gameButtons).forEach(b => b.classList.remove("selected"));
            gameButtons[cfg.id]?.classList.add("selected");
            refreshCallVisibility();
            refreshStake();
        }
        function showOutcome(text, type) {
            addLog(text, type);
            resultText.textContent = text;
        }
        function playRound() {
            const beforeEventId = ensureGamblingState(state).event?.id || null;
            tickGamblingDynamics(state);
            const afterEvent = ensureGamblingState(state).event;
            if (afterEvent && afterEvent.id && afterEvent.id !== beforeEventId) {
                addLog(`The tavern mood shifts: ${afterEvent.name}. ${afterEvent.desc}`, "system");
            }
            // If the table has tightened/loosened, keep the current stake valid.
            const limNow = getLimits();
            const stakeBeforeClamp = currentStake;
            const safeStake = Number.isFinite(Number(currentStake)) ? Number(currentStake) : limNow.min;
            currentStake = clamp(safeStake, limNow.min, limNow.max);
            if (currentStake !== stakeBeforeClamp) {
                addLog?.(`The dealer caps your bet to the table limit (${currentStake}g).`, "system");
            }
            if (player.gold < currentStake) {
                refreshGold();
                refreshStake();
                showOutcome("You don't have enough gold to cover that stake.", "system");
                updateHUD();
                saveGame();
                return;
            }
            const dbg = ensureGamblingDebug(state);
            const dbgMode = dbg.mode || "normal";
            const payoutMult = typeof dbg.payoutMultiplier === "number" && dbg.payoutMultiplier > 0 ? dbg.payoutMultiplier : 1;
            const cfg = GAMES[currentGameId] || GAMES.dice;
            const patron = pickPatron(state, cfg.biasKey);
            const rounds = ensureGamblingState(state).roundsWithPatron || 1;
            const mods = computeRoundMods({
                state,
                patron,
                gameId: cfg.id,
                stake: currentStake,
                gameBiasKey: cfg.biasKey
            });
            const finalPayoutMult = payoutMult * mods.payoutMult;
            // Pay stake up front.
            player.gold -= currentStake;
            const runner = GAME_RUNNERS[cfg.id] || GAME_RUNNERS.dice;
            const outcome = runner({
                stake: currentStake,
                patron,
                dbgMode,
                payoutMult: finalPayoutMult,
                call: currentCall,
                bias: mods.bias
            });
            if (outcome && typeof outcome.delta === "number") {
                player.gold += outcome.delta;
            }
            applyPostRoundDynamics(state, outcome.type, currentStake);
            const flavored = addFlavor(outcome.text, outcome.type, patron, rounds);
            showOutcome(`${flavored} You now have ${player.gold} gold.`, outcome.type);
            refreshGold();
            refreshStake();
            updateHUD();
            saveGame();
        }
        function leaveTable() {
            cleanFooters(body);
            closeModal?.();
            openTavernModal?.();
        }
        btnPlay.addEventListener("click", playRound);
        btnLeave.addEventListener("click", leaveTable);
        refreshGold();
        setGame("dice");
    });
}
//# sourceMappingURL=tavernGames.js.map