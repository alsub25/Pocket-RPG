// systems/kingdomGovernment.js

// -----------------------------------------------------------------------------
// KINGDOM GOVERNMENT SYSTEM
// -----------------------------------------------------------------------------
// Responsibilities:
//  - Create and maintain an autonomous kingdom-level government for the overworld
//  - Track monarch (King/Queen), spouse, and children if married
//  - Maintain a 7-member council appointed by the monarch
//  - Track village-level leaders & attitudes influenced by royal policy
//  - Provide a daily "tick" hook to evolve government and villages over time
//
// Public API:
//  - initGovernmentState(state, absoluteDay?)
//  - handleGovernmentDayTick(state, absoluteDay, hooks?)
//  - getGovernmentSummary(state)
//  - getVillageGovernmentEffect(state, areaId)
//
// NOTE: This module is **state-agnostic**. It only relies on properties on the
//       `state` object passed in (like state.flags). It does not touch DOM.
// -----------------------------------------------------------------------------

import { rngInt, rngFloat } from "./rng.js";

// --- CONSTANTS / SMALL HELPERS ------------------------------------------------

const COUNCIL_ROLES = [
  "Chancellor",      // internal affairs
  "Marshal",         // military
  "Spymaster",       // intelligence
  "High Priest",     // faith / morale
  "Treasurer",       // coin & trade
  "Archmage",        // magic / research
  "Justiciar"        // law & justice
];

const IDEOLOGIES = [
  "traditionalist",
  "reformer",
  "populist",
  "hawk",
  "dove",
  "pragmatist"
];

const POLICY_TAX = ["low", "normal", "high"];
const POLICY_MILITARY = ["peace", "tense", "war"];
const POLICY_JUSTICE = ["lenient", "balanced", "harsh"];

// Helper – clamp numeric metrics to 0–100
function clamp01(x) {
  return Math.max(0, Math.min(100, x));
}

// Random helpers
function randInt(min, max) {
  return rngInt(null, min, max, 'government.randInt');
}

function randChoice(arr) {
  if (!Array.isArray(arr) || !arr.length) return null;
  return arr[rngInt(null, 0, arr.length - 1, 'government.randChoice')];
}

// Tiny name generator (keeps flavor light but varied)
const NAME_FRAGMENTS = {
  male: [
    "Rowan", "Thorne", "Darius", "Corin", "Kael",
    "Riven", "Vale", "Edric", "Garran", "Loric"
  ],
  female: [
    "Aria", "Lira", "Mira", "Eira", "Seren",
    "Nyx", "Kaida", "Elowen", "Maera", "Sylia"
  ],
  neutral: [
    "Ash", "Ren", "Kerris", "Tal", "Vale",
    "Sera", "Nox", "Lyn", "Caro", "Sol"
  ]
};

function randomNameForGender(gender) {
  if (gender === "male") return randChoice(NAME_FRAGMENTS.male);
  if (gender === "female") return randChoice(NAME_FRAGMENTS.female);
  return randChoice(NAME_FRAGMENTS.neutral);
}

// --- CORE FACTORY FUNCTIONS ---------------------------------------------------

function createInitialMonarch(absoluteDay = 0) {
  const isFemaleRuler = rngFloat(null, 'government.isFemaleRuler') < 0.4;
  const rulerGender = isFemaleRuler ? "female" : "male";
  const spouseGender = isFemaleRuler ? "male" : "female";

  const rulerTitle = isFemaleRuler ? "Queen" : "King";
  const spouseTitle = isFemaleRuler ? "King Consort" : "Queen Consort";

  const rulerName = randomNameForGender(rulerGender);
  const spouseName = randomNameForGender(spouseGender);

  const married = rngFloat(null, 'government.married') < 0.8; // 80% chance...

  const monarch = {
    title: rulerTitle,
    name: rulerName,
    gender: rulerGender,
    age: randInt(28, 52),
    married: married,
    spouse: married
      ? {
          title: spouseTitle,
          name: spouseName,
          gender: spouseGender,
          age: randInt(25, 48)
        }
      : null,
    children: [],
    // Day the ruler ascended to the throne (for flavor / later events)
    coronationDay: absoluteDay
  };

  // Children only if married, 0–3 of them
  if (married) {
    const numKids = randInt(0, 3);
    for (let i = 0; i < numKids; i++) {
      const gender = rngFloat(null, 'government.childGender') < 0.5 ? "male" : "female";
      monarch.children.push({
        name: randomNameForGender(gender),
        gender,
        age: randInt(4, 20),
        birthOrder: i + 1,
        isHeir: i === 0 // simple “eldest child” succession
      });
    }
  }

  return monarch;
}

function createInitialCouncil(absoluteDay = 0) {
  const council = [];

  COUNCIL_ROLES.forEach(role => {
    const gender = rngFloat(null, 'government.childGender') < 0.5 ? "male" : "female";
    const member = {
      id: role.toLowerCase().replace(/\s+/g, "_"),
      role,
      name: randomNameForGender(gender),
      gender,
      age: randInt(26, 60),
      loyalty: clamp01(randInt(35, 80)),        // loyalty to the crown
      competence: clamp01(randInt(40, 90)),     // how good they are at their job
      ideology: randChoice(IDEOLOGIES),
      appointedOnDay: absoluteDay,
      // Simple mood flag we can evolve daily
      mood: "calm" // calm | uneasy | pleased | resentful
    };
    council.push(member);
  });

  return council;
}

function createInitialVillagesGovernance() {
  // This matches your existing world where Emberwood is the starting village.
  // You can add more entries here later if you add more overworld locations.
  return {
    village: {
      id: "village",
      name: "Emberwood Village",
      leaderName: "Elder Rowan",
      // Attitudes toward the crown
      loyalty: 65,     // love / trust
      fear: 20,        // fear of punishment
      unrest: 10,      // higher = more likely to rebel
      // Modifiers that other systems can read (economy, encounter difficulty, etc.)
      prosperityModifier: 0,   // -0.3 .. +0.3
      safetyModifier: 0,       // -0.3 .. +0.3
      cultureModifier: 0       // -0.3 .. +0.3 (could be used for events / flavor)
    }
  };
}

function createDefaultGovernment(absoluteDay = 0) {
  const monarch = createInitialMonarch(absoluteDay);
  const council = createInitialCouncil(absoluteDay);
  const villages = createInitialVillagesGovernance();

  return {
    realmName: "Kingdom of Emberfall",
    capitalName: "Emberkeep",
    monarch,
    council,
    villages,
    // Macro metrics
    metrics: {
      stability: 65,      // how likely it is things stay calm
      prosperity: 55,     // wealth of the realm
      royalPopularity: 60,
      corruption: 25
    },
    // Current policy stance – affects how metrics drift per day
    currentPolicies: {
      taxRate: "normal",       // low | normal | high
      militaryPosture: "peace",// peace | tense | war
      justiceStyle: "balanced" // lenient | balanced | harsh
    },
    // Last “headline” political event
    lastDecree: null,
    // Short log of notable government events (for UI / codex)
    history: [],
    // Internal bookkeeping
    lastUpdatedDay: absoluteDay
  };
}

// --- ENSURE GOVERNMENT STATE --------------------------------------------------

/**
 * Ensure state.government exists and is structurally sane.
 * Call this once after creating a new save, and also from load().
 */
export function initGovernmentState(state, absoluteDay = 0) {
  if (!state) return;

  if (!state.government) {
    state.government = createDefaultGovernment(absoluteDay);
    return;
  }

  const g = state.government;

  // Patch older saves that might be missing bits as this system evolves
  if (!g.monarch) g.monarch = createInitialMonarch(absoluteDay);
  if (!Array.isArray(g.council) || g.council.length === 0) {
    g.council = createInitialCouncil(absoluteDay);
  }
  if (!g.villages) {
    g.villages = createInitialVillagesGovernance();
  }
  if (!g.metrics) {
    g.metrics = {
      stability: 60,
      prosperity: 50,
      royalPopularity: 55,
      corruption: 30
    };
  }
  if (!g.currentPolicies) {
    g.currentPolicies = {
      taxRate: "normal",
      militaryPosture: "peace",
      justiceStyle: "balanced"
    };
  }
  if (!Array.isArray(g.history)) {
    g.history = [];
  }
  if (typeof g.lastUpdatedDay !== "number") {
    g.lastUpdatedDay = absoluteDay;
  }
}

// --- DAILY TICK LOGIC ---------------------------------------------------------

// Small helper: push a “government event” into history, trimming length.
function pushGovernmentEvent(government, event) {
  government.history.push({
    day: event.day,
    title: event.title,
    description: event.description,
    impact: event.impact || null,
    type: event.type || "decree"
  });

  // Keep history reasonably short (last 25 entries)
  if (government.history.length > 25) {
    government.history.splice(0, government.history.length - 25);
  }

  government.lastDecree = event;
}

// Policy-driven metric drift (called once per day)
function applyPassiveDrift(government, state) {
  const { metrics, currentPolicies } = government;
  const flags = state && state.flags ? state.flags : {};

  // Base minor random wobble
  metrics.stability = clamp01(metrics.stability + randInt(-2, 2));
  metrics.prosperity = clamp01(metrics.prosperity + randInt(-2, 2));
  metrics.royalPopularity = clamp01(metrics.royalPopularity + randInt(-2, 2));
  metrics.corruption = clamp01(metrics.corruption + randInt(-1, 2));

  // Tax policy effects
  if (currentPolicies.taxRate === "low") {
    metrics.royalPopularity = clamp01(metrics.royalPopularity + 2);
    metrics.prosperity = clamp01(metrics.prosperity - 1);
  } else if (currentPolicies.taxRate === "high") {
    metrics.royalPopularity = clamp01(metrics.royalPopularity - 2);
    metrics.prosperity = clamp01(metrics.prosperity + 2);
    metrics.corruption = clamp01(metrics.corruption + 1);
  }

  // Military posture
  if (currentPolicies.militaryPosture === "peace") {
    metrics.stability = clamp01(metrics.stability + 1);
  } else if (currentPolicies.militaryPosture === "war") {
    metrics.prosperity = clamp01(metrics.prosperity - 2);
    metrics.stability = clamp01(metrics.stability - 1);
  }

  // Justice style
  if (currentPolicies.justiceStyle === "harsh") {
    metrics.stability = clamp01(metrics.stability + 2);
    metrics.royalPopularity = clamp01(metrics.royalPopularity - 1);
    metrics.corruption = clamp01(metrics.corruption - 1);
  } else if (currentPolicies.justiceStyle === "lenient") {
    metrics.stability = clamp01(metrics.stability - 1);
    metrics.royalPopularity = clamp01(metrics.royalPopularity + 1);
  }

  // Tie in your existing story flags:
  if (flags.goblinBossDefeated) {
    metrics.stability = clamp01(metrics.stability + 1);
    metrics.royalPopularity = clamp01(metrics.royalPopularity + 1);
  }
  if (flags.dragonDefeated) {
    metrics.stability = clamp01(metrics.stability + 2);
    metrics.royalPopularity = clamp01(metrics.royalPopularity + 3);
    metrics.prosperity = clamp01(metrics.prosperity + 2);
  }
}

// Update council mood & loyalty based on metrics / policies
function updateCouncil(government) {
  const { metrics, currentPolicies, council } = government;
  const { stability, royalPopularity, corruption } = metrics;

  council.forEach(member => {
    let delta = 0;

    // Ideology influence
    switch (member.ideology) {
      case "populist":
        // Like popularity, dislike harsh justice
        delta += (royalPopularity - 50) * 0.02;
        if (currentPolicies.justiceStyle === "harsh") delta -= 1.5;
        break;
      case "hawk":
        if (currentPolicies.militaryPosture === "war") delta += 1.5;
        if (currentPolicies.militaryPosture === "peace") delta -= 1;
        break;
      case "dove":
        if (currentPolicies.militaryPosture === "peace") delta += 1.5;
        if (currentPolicies.militaryPosture === "war") delta -= 2;
        break;
      case "reformer":
        delta -= (corruption - 30) * 0.02;
        break;
      case "traditionalist":
        delta += (stability - 60) * 0.02;
        break;
      case "pragmatist":
      default:
        // Pragmatists care about “overall doing OK”
        const avg = (stability + royalPopularity + (100 - corruption)) / 3;
        delta += (avg - 55) * 0.015;
        break;
    }

    // Tiny random wobble
    delta += randInt(-1, 1) * 0.5;

    member.loyalty = clamp01(member.loyalty + delta);

    // Mood flag (can be used for flavor text)
    if (member.loyalty > 75) member.mood = "pleased";
    else if (member.loyalty < 30) member.mood = "resentful";
    else if (member.loyalty < 50) member.mood = "uneasy";
    else member.mood = "calm";
  });

  // Auto-replace very disloyal councilors (monarch “fires” and appoints new)
  for (let i = 0; i < council.length; i++) {
    const c = council[i];
    if (c.loyalty <= 10) {
      const role = c.role;
      council[i] = {
        ...createInitialCouncil(government.lastUpdatedDay).find(
          m => m.role === role
        ),
        // Slightly higher minimum loyalty on re-appointment
        loyalty: clamp01(randInt(50, 85)),
        appointedOnDay: government.lastUpdatedDay
      };
    }
  }
}

// Apply royal influence to each village
function updateVillageAttitudes(government, state) {
  const { villages, metrics } = government;
  const { stability, prosperity, royalPopularity } = metrics;
  const flags = state && state.flags ? state.flags : {};

  Object.values(villages).forEach(v => {
    // Loyalty drifts toward royalPopularity with a bit of inertia
    const targetLoyalty = royalPopularity;
    const step = (targetLoyalty - v.loyalty) * 0.05;
    v.loyalty = clamp01(v.loyalty + step + randInt(-1, 1));

    // Unrest inversely tracks stability & loyalty
    const desiredUnrest = 100 - Math.min(stability, v.loyalty);
    v.unrest = clamp01(v.unrest + (desiredUnrest - v.unrest) * 0.03);

    // Fear: higher when justice is harsh or corruption is high
    const justiceStyle =
      government.currentPolicies && government.currentPolicies.justiceStyle;
    let fearDelta = 0;
    if (justiceStyle === "harsh") fearDelta += 1;
    else if (justiceStyle === "lenient") fearDelta -= 1;

    fearDelta += (metrics.corruption - 30) * 0.01;
    v.fear = clamp01(v.fear + fearDelta + randInt(-1, 1) * 0.5);

    // Prosperity / safety modifiers normalized to -0.3 .. +0.3
    v.prosperityModifier = Math.max(
      -0.3,
      Math.min(0.3, (prosperity - 50) / 100)
    );
    v.safetyModifier = Math.max(
      -0.3,
      Math.min(0.3, (stability - 50) / 100)
    );

    // Bonus effects from world events
    if (flags.goblinBossDefeated && v.id === "village") {
      v.safetyModifier = Math.min(v.safetyModifier + 0.1, 0.3);
      v.unrest = clamp01(v.unrest - 3);
    }
    if (flags.dragonDefeated && v.id === "village") {
      v.prosperityModifier = Math.min(v.prosperityModifier + 0.1, 0.3);
      v.loyalty = clamp01(v.loyalty + 4);
    }
  });
}

// Random chance each day that the monarch issues a decree that nudges things
function maybeIssueRoyalDecree(government, absoluteDay, hooks) {
  const { metrics, currentPolicies } = government;
  const addLog = hooks && typeof hooks.addLog === "function"
    ? hooks.addLog
    : null;

  // About ~10% chance per day, scaled slightly by instability
  const baseChance = 0.1 + (50 - metrics.stability) / 400; // 5–20%
  if (rngFloat(null, 'government.randomDecree') > baseChance) return;

  // Very rough “situation awareness”
  const needsMoney = metrics.prosperity < 45;
  const unrestHigh = metrics.stability < 45 || metrics.royalPopularity < 45;

  // Pick a decree type based on the situation
  let decreeType;
  if (unrestHigh) {
    decreeType = rngFloat(null, 'government.decreePick') < 0.5 ? "hold_festival" : "ease_taxes";
  } else if (needsMoney) {
    decreeType = rngFloat(null, 'government.decreePick') < 0.5 ? "raise_taxes" : "merchant_charters";
  } else {
    decreeType = randChoice([
      "anti_bandit_crackdown",
      "hold_festival",
      "ease_taxes",
      "patronize_mages",
      "favor_nobles",
      "favor_commoners"
    ]);
  }

  // Apply the chosen decree
  let title = "";
  let description = "";
  const impact = {};

  switch (decreeType) {
    case "hold_festival":
      title = "Realm-Wide Harvest Festival";
      description =
        "The monarch orders feasting and games across the realm, easing tensions.";
      metrics.royalPopularity = clamp01(metrics.royalPopularity + 5);
      metrics.stability = clamp01(metrics.stability + 3);
      metrics.prosperity = clamp01(metrics.prosperity - 2);
      impact.popularity = "+5";
      impact.stability = "+3";
      impact.prosperity = "-2";
      break;

    case "ease_taxes":
      title = "Taxes Temporarily Reduced";
      description =
        "To calm unrest, the crown lowers taxes on the villages for a season.";
      currentPolicies.taxRate = "low";
      metrics.royalPopularity = clamp01(metrics.royalPopularity + 4);
      metrics.prosperity = clamp01(metrics.prosperity - 2);
      impact.taxRate = "low";
      impact.popularity = "+4";
      impact.prosperity = "-2";
      break;

    case "raise_taxes":
      title = "Royal Tax Increase";
      description =
        "Needing coin, the monarch raises levies on merchants and villagers.";
      currentPolicies.taxRate = "high";
      metrics.royalPopularity = clamp01(metrics.royalPopularity - 4);
      metrics.prosperity = clamp01(metrics.prosperity + 3);
      metrics.corruption = clamp01(metrics.corruption + 1);
      impact.taxRate = "high";
      impact.popularity = "-4";
      impact.prosperity = "+3";
      impact.corruption = "+1";
      break;

    case "merchant_charters":
      title = "New Merchant Charters";
      description =
        "Trusted merchants receive royal charters, boosting trade but concentrating wealth.";
      metrics.prosperity = clamp01(metrics.prosperity + 4);
      metrics.royalPopularity = clamp01(metrics.royalPopularity - 1);
      impact.prosperity = "+4";
      impact.popularity = "-1";
      break;

    case "anti_bandit_crackdown":
      title = "Crackdown on Banditry";
      description =
        "The Marshal rides out with soldiers to break up bandit camps across the realm.";
      currentPolicies.militaryPosture = "tense";
      metrics.stability = clamp01(metrics.stability + 4);
      metrics.prosperity = clamp01(metrics.prosperity + 1);
      metrics.royalPopularity = clamp01(metrics.royalPopularity + 2);
      impact.militaryPosture = "tense";
      impact.stability = "+4";
      impact.prosperity = "+1";
      impact.popularity = "+2";
      break;

    case "patronize_mages":
      title = "Patronage for the Emberkeep Mages";
      description =
        "The crown grants coin and authority to court mages, seeking arcane solutions to threats.";
      metrics.prosperity = clamp01(metrics.prosperity - 1);
      metrics.stability = clamp01(metrics.stability + 1);
      metrics.royalPopularity = clamp01(metrics.royalPopularity + 1);
      impact.prosperity = "-1";
      impact.stability = "+1";
      impact.popularity = "+1";
      break;

    case "favor_nobles":
      title = "Edict Favoring the Nobles";
      description =
        "Landed nobles receive new privileges. Villagers grumble at the imbalance.";
      metrics.royalPopularity = clamp01(metrics.royalPopularity - 3);
      metrics.stability = clamp01(metrics.stability + 1);
      metrics.corruption = clamp01(metrics.corruption + 2);
      impact.popularity = "-3";
      impact.stability = "+1";
      impact.corruption = "+2";
      break;

    case "favor_commoners":
    default:
      title = "Edict in Favor of the Common Folk";
      description =
        "The crown rolls back some noble privileges and confirms rights for village elders.";
      metrics.royalPopularity = clamp01(metrics.royalPopularity + 4);
      metrics.stability = clamp01(metrics.stability + 1);
      metrics.corruption = clamp01(metrics.corruption - 1);
      impact.popularity = "+4";
      impact.stability = "+1";
      impact.corruption = "-1";
      break;
  }

  const event = {
    day: absoluteDay,
    title,
    description,
    impact,
    type: "decree"
  };

  pushGovernmentEvent(government, event);

  // Optional: write to the main game log if a hook was provided
  if (addLog) {
    addLog(
      `${government.monarch.title} ${government.monarch.name} issues a decree: ${title}.`,
      "system"
    );
  }
}

/**
 * Advance the government simulation by one in-game day.
 *
 * @param {object} state        - global game state (same object used in game.js)
 * @param {number} absoluteDay  - current absolute day from your time system
 * @param {object} hooks        - optional { addLog } for writing into your log
 */
export function handleGovernmentDayTick(state, absoluteDay, hooks = {}) {
  if (!state) return;

  // Normalize day to a non-negative integer.
  const dayRaw = Number(absoluteDay);
  const day = Number.isFinite(dayRaw) && dayRaw >= 0 ? Math.floor(dayRaw) : 0;

  initGovernmentState(state, day);
  const g = state.government;

  const lastRaw = Number(g.lastUpdatedDay);
  const lastDay = Number.isFinite(lastRaw) && lastRaw >= 0 ? Math.floor(lastRaw) : null;
  if (lastDay === day) return;

  g.lastUpdatedDay = day;

  // 1) Passive metric drift and story-based effects
  applyPassiveDrift(g, state);

  // 2) Council reacts & evolves
  updateCouncil(g);

  // 3) Villages adjust their attitudes based on macro metrics
  updateVillageAttitudes(g, state);

  // 4) Possibly issue a new royal decree
  maybeIssueRoyalDecree(g, day, hooks);
}

// --- READ-ONLY HELPERS FOR OTHER SYSTEMS -------------------------------------

/**
 * Return a lightweight snapshot of government status for UI / tooltips.
 * (Safe to call even if government is missing; returns fallback values.)
 */
export function getGovernmentSummary(state) {
  const g = state && state.government;
  if (!g) {
    return {
      hasGovernment: false,
      realmName: "Unknown Realm",
      monarchTitle: "",
      monarchName: "",
      metrics: {
        stability: 50,
        prosperity: 50,
        royalPopularity: 50,
        corruption: 50
      },
      councilCount: 0,
      lastDecreeTitle: null
    };
  }

  return {
    hasGovernment: true,
    realmName: g.realmName,
    capitalName: g.capitalName,
    monarchTitle: g.monarch.title,
    monarchName: g.monarch.name,
    married: !!g.monarch.married,
    spouseName: g.monarch.spouse ? g.monarch.spouse.name : null,
    childrenCount: Array.isArray(g.monarch.children)
      ? g.monarch.children.length
      : 0,
    metrics: { ...g.metrics },
    councilCount: Array.isArray(g.council) ? g.council.length : 0,
    lastDecreeTitle: g.lastDecree ? g.lastDecree.title : null
  };
}

/**
 * Internal helper: snapshot local population for a given area.
 * We don't create population here; we just read it if present so the
 * government UI can show everything together.
 */
function getPopulationSnapshot(state, areaId) {
  if (!state) {
    return { size: null, mood: null };
  }

  // For now, only Emberwood village is population-aware.
  if (areaId !== "village") {
    return { size: null, mood: null };
  }

  const villageState = state.village;
  const pop = villageState && villageState.population;
  if (!pop) {
    return { size: null, mood: null };
  }

  return {
    size: typeof pop.size === "number" ? pop.size : null,
    mood: typeof pop.mood === "number" ? pop.mood : null
  };
}

/**
 * Return a summarized view of how the kingdom currently affects a given area.
 * This is where you plug government into other systems (e.g. villageEconomy).
 *
 * @param {object} state   - global game state
 * @param {string} areaId  - e.g. "village", "forest", "ruins"
 */
export function getVillageGovernmentEffect(state, areaId) {
  const g = state && state.government;
  if (!g || !g.villages || !g.villages[areaId]) {
    return {
      hasData: false,
      loyalty: 50,
      fear: 50,
      unrest: 50,
      prosperityModifier: 0,
      safetyModifier: 0,
      populationSize: null,
      populationMood: null,
      description:
        "The crown's influence on this region is uncertain."
    };
  }

  const v = g.villages[areaId];
  const popSnapshot = getPopulationSnapshot(state, areaId);

  return {
    hasData: true,
    loyalty: v.loyalty,
    fear: v.fear,
    unrest: v.unrest,
    prosperityModifier: v.prosperityModifier,
    safetyModifier: v.safetyModifier,
    populationSize: popSnapshot.size,
    populationMood: popSnapshot.mood,
    description: buildVillageInfluenceDescription(v, g, popSnapshot)
  };
}

function buildVillageInfluenceDescription(village, government, popSnapshot) {
  const parts = [];

  if (village.loyalty > 70) {
    parts.push("The villagers speak well of the crown.");
  } else if (village.loyalty < 35) {
    parts.push("Many villagers mutter seditious rumors.");
  } else {
    parts.push("Most villagers are watchful but not openly hostile.");
  }

  if (village.unrest > 65) {
    parts.push("Tension hangs in the air; unrest is high.");
  } else if (village.unrest < 25) {
    parts.push("For now, life feels steady and predictable.");
  }

  if (village.safetyModifier > 0.1) {
    parts.push("Royal patrols keep the worst threats at bay.");
  } else if (village.safetyModifier < -0.1) {
    parts.push("Bandits and monsters slip through the cracks of royal patrols.");
  }

  // Fold in population, if we know it.
  if (popSnapshot && typeof popSnapshot.size === "number") {
    parts.push(
      `Roughly ${popSnapshot.size.toLocaleString()} souls call this place home.`
    );
  }

  if (popSnapshot && typeof popSnapshot.mood === "number") {
    const mood = popSnapshot.mood;
    if (mood >= 50) {
      parts.push("The townsfolk are openly cheerful and quick to laugh.");
    } else if (mood >= 20) {
      parts.push("Most folk seem hopeful about the days ahead.");
    } else if (mood <= -50) {
      parts.push(
        "Anger simmers just below the surface whenever the crown is mentioned."
      );
    } else if (mood <= -20) {
      parts.push("Uneasy looks and hushed whispers hint at growing discontent.");
    }
  }

  return parts.join(" ");
}

// -----------------------------------------------------------------------------
// OPTIONAL: Example integration notes (no runtime impact)
//
// In your time system integration (where you already call handleEconomyDayTick):
//
//   import { handleGovernmentDayTick } from "systems/kingdomGovernment.js";
//
//   // When a new day begins inside exploreArea():
//   const timeStep = advanceTime(state, 1);
//   if (timeStep.dayChanged) {
//     handleEconomyDayTick(state, timeStep.after.absoluteDay);
//     handleGovernmentDayTick(state, timeStep.after.absoluteDay, { addLog });
//   }
//
// And when saving/loading, just allow state.government to be serialized the
// same way you already do for state.bank, state.villageEconomy, etc.
// -----------------------------------------------------------------------------