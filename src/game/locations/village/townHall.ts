// Town Hall & Council Petitions UI
//
// Responsibilities:
//  - Maintain a 3-member *village* council (local envoys, not the 7 high councillors).
//  - Use the shared village population module for Emberwood population & mood.
//  - Queue economic petitions instead of applying them instantly.
//  - Every petition goes through:
//      1) a village-wide popularity vote,
//      2) if the village mostly approves, a council vote one full day later.
//  - Both the player and councillors may originate petitions.
//  - Approved petitions write a temporary modifier onto state.government.townHallEffects.
//  - Bank / tavern / economy systems read those effects; this module never does math directly.

import {
  ensureVillagePopulation,
  adjustPopulationMood
} from "./villagePopulation.js"; // adjust path if needed

import { rngInt, rngFloat } from "../../systems/rng.js";

// -----------------------------------------------------------------------------
// PETITION DEFINITIONS
// -----------------------------------------------------------------------------

const PETITIONS = {
  // 1. Original: lower_interest
  lower_interest: {
    id: "lower_interest",
    uiTitle: "Petition: Ease Loan Burdens",
    uiBlurb:
      "Argue that debt is strangling small folk and merchants. Ask the council to push for gentler loan terms.",
    uiEffectSummary:
      "Effect: Loan interest is reduced for a few in-game days. Savings and investments remain normal.",
    decreeTitle: "Decree: Loan Relief Act",
    decreeLabel: "Loan rates softened for a short time.",
    decreeDescription:
      "For the next few days, villagers with debts enjoy reduced interest. Savings and investments remain unchanged.",
    effect: {
      depositRateMultiplier: 1,
      investmentRateMultiplier: 1,
      loanRateMultiplier: 0.75,
      restCostMultiplier: 1
    },
    favorIdeologies: ["populist", "dove"],
    opposeIdeologies: ["hawk", "traditionalist"]
  },

  // 2. Original: market_stimulus
  market_stimulus: {
    id: "market_stimulus",
    uiTitle: "Petition: Market Stimulus",
    uiBlurb:
      "Propose incentives for savers and investors to spur commerce, accepting that inns and taverns will charge more.",
    uiEffectSummary:
      "Effect: Savings and investments earn more interest for a few days, but resting at the tavern becomes more expensive.",
    decreeTitle: "Decree: Market Stimulus Charter",
    decreeLabel:
      "Savers and investors are rewarded; inns raise their prices.",
    decreeDescription:
      "For a handful of days, deposits and investments grow faster, but the tavern quietly raises the cost of a night's rest.",
    effect: {
      depositRateMultiplier: 1.4,
      investmentRateMultiplier: 1.2,
      loanRateMultiplier: 1,
      restCostMultiplier: 1.3,
      // Short-lived spending pushes commerce upward.
      econProsperityDelta: 1,
      econTradeDelta: 1,
      econSecurityDelta: 0,
      moodDailyDelta: 0
    },
    favorIdeologies: ["hawk", "pragmatist", "reformer"],
    opposeIdeologies: ["traditionalist"]
  },

  // 3. Festival Week – trade & fun, pricier rest
  festival_week: {
    id: "festival_week",
    uiTitle: "Petition: Proclaim Festival Week",
    uiBlurb:
      "Argue for a week of fairs, games and night markets to lift spirits and coffers alike.",
    uiEffectSummary:
      "Effect: Modest boosts to savings and investments; tavern rest becomes noticeably more expensive during the festivities.",
    decreeTitle: "Decree: Emberwood Festival Week",
    decreeLabel: "Stalls, music and lanterns fill the streets.",
    decreeDescription:
      "Banners and streamers bloom over Emberwood's lanes as the council grants a week of sanctioned revelry and trade.",
    effect: {
      depositRateMultiplier: 1.1,
      investmentRateMultiplier: 1.15,
      loanRateMultiplier: 1,
      restCostMultiplier: 1.4,
      // Festival crowds: trade jumps, but watchfulness lags.
      econProsperityDelta: 1,
      econTradeDelta: 2,
      econSecurityDelta: -1,
      moodDailyDelta: 1
    },
    favorIdeologies: ["populist", "reformer", "dove"],
    opposeIdeologies: ["hawk", "traditionalist"]
  },

  // 4. Austerity Drive – harsh but frugal
  austerity_drive: {
    id: "austerity_drive",
    uiTitle: "Petition: Austerity Drive",
    uiBlurb:
      "Suggest a season of frugal living and tight ledgers to restore the village’s balance sheets.",
    uiEffectSummary:
      "Effect: Savings and investment returns shrink; loans ease slightly; rest at the tavern becomes cheaper.",
    decreeTitle: "Decree: Austerity Provisions",
    decreeLabel: "The council tightens belts across Emberwood.",
    decreeDescription:
      "By candlelight the councillors approve a lean budget, urging every household to mend old cloaks and patch their roofs.",
    effect: {
      depositRateMultiplier: 0.8,
      investmentRateMultiplier: 0.8,
      loanRateMultiplier: 0.9,
      restCostMultiplier: 0.8,
      // Belt-tightening slows commerce but can steady streets.
      econProsperityDelta: -1,
      econTradeDelta: -1,
      econSecurityDelta: 1,
      moodDailyDelta: -1
    },
    favorIdeologies: ["hawk", "traditionalist", "pragmatist"],
    opposeIdeologies: ["populist", "dove", "reformer"]
  },

  // 5. Fortification Levy – security-first
  fortification_levy: {
    id: "fortification_levy",
    uiTitle: "Petition: Fortification Levy",
    uiBlurb:
      "Urge the council to raise coin for palisades, watchtowers, and extra guards on the walls.",
    uiEffectSummary:
      "Effect: Loan interest climbs; rest at the tavern grows more costly as levy barrels roll through the streets.",
    decreeTitle: "Decree: Emberwood Fortification Levy",
    decreeLabel: "Coin is hammered into stone and steel.",
    decreeDescription:
      "Engineers draw up new lines on the village map while grim guards collect the levy from merchants and tavernkeepers.",
    effect: {
      depositRateMultiplier: 1,
      investmentRateMultiplier: 1,
      loanRateMultiplier: 1.15,
      restCostMultiplier: 1.2,
      // Guards and walls improve security, but coin is diverted from trade.
      econProsperityDelta: 0,
      econTradeDelta: -1,
      econSecurityDelta: 2,
      moodDailyDelta: -1
    },
    favorIdeologies: ["hawk", "traditionalist"],
    opposeIdeologies: ["dove", "reformer"]
  },

  // 6. Grain Subsidy – keep bread cheap
  grain_subsidy: {
    id: "grain_subsidy",
    uiTitle: "Petition: Grain Subsidy",
    uiBlurb:
      "Ask the council to spend coin from the coffers to steady the price of bread and porridge.",
    uiEffectSummary:
      "Effect: Savings benefit slightly; loans ease a little; tavern rest becomes cheaper as food prices fall.",
    decreeTitle: "Decree: Grain Price Support",
    decreeLabel: "Bread lines shorten as prices settle.",
    decreeDescription:
      "Grain stores are quietly opened, and bakers receive sacks stamped with the royal seal to ease the hunger of the poor.",
    effect: {
      depositRateMultiplier: 1.1,
      investmentRateMultiplier: 1,
      loanRateMultiplier: 0.95,
      restCostMultiplier: 0.85,
      // Stable food supply improves mood and prosperity a touch.
      econProsperityDelta: 1,
      econTradeDelta: 0,
      econSecurityDelta: 0,
      moodDailyDelta: 1
    },
    favorIdeologies: ["populist", "dove", "reformer"],
    opposeIdeologies: ["hawk"]
  },

  // 7. Merchant Charter – pro-trade
  merchant_charter: {
    id: "merchant_charter",
    uiTitle: "Petition: Merchant Charter",
    uiBlurb:
      "Invite caravans and trading houses to treat Emberwood as their favored stop along the road.",
    uiEffectSummary:
      "Effect: Strong boosts to investment and savings; loans ease slightly; rest costs stay about the same.",
    decreeTitle: "Decree: Emberwood Merchant Charter",
    decreeLabel: "Contracts and seals inked in the counting-house.",
    decreeDescription:
      "Quills dance as merchants sign new accords, promising fuller caravans and louder coin in the village markets.",
    effect: {
      depositRateMultiplier: 1.2,
      investmentRateMultiplier: 1.25,
      loanRateMultiplier: 0.95,
      restCostMultiplier: 1,
      // Better contracts = more caravans.
      econProsperityDelta: 1,
      econTradeDelta: 2,
      econSecurityDelta: 0,
      moodDailyDelta: 0
    },
    favorIdeologies: ["hawk", "pragmatist", "reformer"],
    opposeIdeologies: ["populist"]
  },

  // 8. Pilgrims Welcome – hospitality & faith
  pilgrims_welcome: {
    id: "pilgrims_welcome",
    uiTitle: "Petition: Welcome the Pilgrims",
    uiBlurb:
      "Seek to make Emberwood a haven for pilgrims, with simple beds and warm soup at gentle prices.",
    uiEffectSummary:
      "Effect: Savings and investments weaken slightly; tavern rest becomes cheaper while the influx lasts.",
    decreeTitle: "Decree: Pilgrim’s Welcome",
    decreeLabel: "Lanterns and votive ribbons line the roads.",
    decreeDescription:
      "Shrines are swept clean and bunks prepared as Emberwood opens its gates to weary travelers seeking a holy road.",
    effect: {
      depositRateMultiplier: 0.95,
      investmentRateMultiplier: 0.9,
      loanRateMultiplier: 1,
      restCostMultiplier: 0.8,
      // Hospitality raises mood and trade, with a small security tax.
      econProsperityDelta: 0,
      econTradeDelta: 1,
      econSecurityDelta: -1,
      moodDailyDelta: 1
    },
    favorIdeologies: ["dove", "traditionalist", "populist"],
    opposeIdeologies: ["hawk"]
  },

  // 9. Lenders’ Charter – pro-creditors
  lenders_charter: {
    id: "lenders_charter",
    uiTitle: "Petition: Lenders’ Charter",
    uiBlurb:
      "Urge the council to protect lenders and note-holders, arguing that strong credit keeps the realm steady.",
    uiEffectSummary:
      "Effect: Loan interest rises sharply; investments pay a bit more; savings suffer slightly.",
    decreeTitle: "Decree: Lenders’ Protection Charter",
    decreeLabel: "Ink dries on harsher loan terms.",
    decreeDescription:
      "Stern scribes revise loan ledgers under guard, while murmurs run through the poorer districts of Emberwood.",
    effect: {
      depositRateMultiplier: 0.9,
      investmentRateMultiplier: 1.1,
      loanRateMultiplier: 1.25,
      restCostMultiplier: 1
    },
    favorIdeologies: ["hawk", "traditionalist"],
    opposeIdeologies: ["populist", "dove", "reformer"]
  },

  // 10. Rainy Day Fund – savings heavy
  rainy_day_fund: {
    id: "rainy_day_fund",
    uiTitle: "Petition: Rainy Day Fund",
    uiBlurb:
      "Encourage every household to salt away coin against lean years, with the council’s blessing.",
    uiEffectSummary:
      "Effect: Savings pay clearly better; investments are a bit dull; loan rates ease slightly.",
    decreeTitle: "Decree: Emberwood Reserve Fund",
    decreeLabel: "The council praises careful savers.",
    decreeDescription:
      "Bells ring softly as the council proclaims that prudent households will find their stored coin growing faster than before.",
    effect: {
      depositRateMultiplier: 1.3,
      investmentRateMultiplier: 0.9,
      loanRateMultiplier: 0.9,
      restCostMultiplier: 1
    },
    favorIdeologies: ["pragmatist", "traditionalist", "reformer"],
    opposeIdeologies: ["populist"]
  },

  // 11. Craftsman Stipends – invest in artisans
  craftsman_stipends: {
    id: "craftsman_stipends",
    uiTitle: "Petition: Craftsman’s Stipend",
    uiBlurb:
      "Propose a purse of royal coin to help smiths, weavers and carpenters take on apprentices and new tools.",
    uiEffectSummary:
      "Effect: Investment returns grow; tavern rest creeps up in price to cover stipends.",
    decreeTitle: "Decree: Craftsman’s Stipend Program",
    decreeLabel: "Workshop chimneys smoke late into the night.",
    decreeDescription:
      "Guild banners stir as young apprentices line up for stipends, bringing a hum of new work to Emberwood’s workshops.",
    effect: {
      depositRateMultiplier: 1,
      investmentRateMultiplier: 1.3,
      loanRateMultiplier: 1,
      restCostMultiplier: 1.15
    },
    favorIdeologies: ["reformer", "populist", "pragmatist"],
    opposeIdeologies: ["hawk"]
  },

  // 12. War Levy – high risk, harsh demands
  war_levy: {
    id: "war_levy",
    uiTitle: "Petition: Emergency War Levy",
    uiBlurb:
      "Call for a grim levy of coin and supplies to prepare for distant wars or looming threats.",
    uiEffectSummary:
      "Effect: Investments pay more; loans become punishing; tavern rest is much more expensive.",
    decreeTitle: "Decree: Emberwood War Levy",
    decreeLabel: "Carts of grain and steel roll out at dawn.",
    decreeDescription:
      "Recruiters march through the lanes as tax-collectors follow, their ledgers heavy with the weight of war.",
    effect: {
      depositRateMultiplier: 1,
      investmentRateMultiplier: 1.2,
      loanRateMultiplier: 1.3,
      restCostMultiplier: 1.4,
      // War levies strain households and trade.
      econProsperityDelta: -2,
      econTradeDelta: -2,
      econSecurityDelta: 1,
      moodDailyDelta: -2
    },
    favorIdeologies: ["hawk"],
    opposeIdeologies: ["dove", "populist", "reformer"]
  },

  // 13. Quiet Nights Act – cheap rest, calm streets
  quiet_nights_act: {
    id: "quiet_nights_act",
    uiTitle: "Petition: Quiet Nights Act",
    uiBlurb:
      "Suggest curfews on rowdy inns so the town can sleep more soundly — and drink more cheaply.",
    uiEffectSummary:
      "Effect: Tavern rest grows cheaper; savings and investments dip a little as nights quieten.",
    decreeTitle: "Decree: Quiet Nights Ordinance",
    decreeLabel: "The streets fall still after dark.",
    decreeDescription:
      "Town watch patrols tap their staves as shutters are drawn early; only low murmurs spill from Emberwood’s inns.",
    effect: {
      depositRateMultiplier: 0.95,
      investmentRateMultiplier: 0.95,
      loanRateMultiplier: 1,
      restCostMultiplier: 0.85,
      // Quiet streets increase security but dampen night trade.
      econProsperityDelta: 0,
      econTradeDelta: -1,
      econSecurityDelta: 1,
      moodDailyDelta: 0
    },
    favorIdeologies: ["traditionalist", "pragmatist", "dove"],
    opposeIdeologies: ["populist"]
  },

  // 14. Debt Jubilee – big relief, messy ledgers
  debt_jubilee: {
    id: "debt_jubilee",
    uiTitle: "Petition: Village Debt Jubilee",
    uiBlurb:
      "Plead for the slate to be wiped clean for the poorest debtors, at least for a time.",
    uiEffectSummary:
      "Effect: Loan interest plummets; savings and investments suffer; tavern prices stay the same.",
    decreeTitle: "Decree: Emberwood Jubilee Proclamation",
    decreeLabel: "Old ledgers close with a snap.",
    decreeDescription:
      "Lenders grind their teeth as debtors crowd the square, some weeping, some laughing at the news of forgiven notes.",
    effect: {
      depositRateMultiplier: 0.8,
      investmentRateMultiplier: 0.85,
      loanRateMultiplier: 0.6,
      restCostMultiplier: 1
    },
    favorIdeologies: ["populist", "dove", "reformer"],
    opposeIdeologies: ["hawk", "pragmatist", "traditionalist"]
  },

  // 15. Guild Investment Drive – big capital push
  guild_investment_drive: {
    id: "guild_investment_drive",
    uiTitle: "Petition: Guild Investment Drive",
    uiBlurb:
      "Encourage guilds and wealthy patrons to pour coin into risky ventures and caravans.",
    uiEffectSummary:
      "Effect: Investments pay strongly; rest costs rise; savings remain steady.",
    decreeTitle: "Decree: Guild Investment Drive",
    decreeLabel: "Coin flows into ledgers and caravans.",
    decreeDescription:
      "Guild masters raise their cups as new ventures are chartered, each promising silver rivers if fortune smiles.",
    effect: {
      depositRateMultiplier: 1,
      investmentRateMultiplier: 1.35,
      loanRateMultiplier: 1,
      restCostMultiplier: 1.15
    },
    favorIdeologies: ["reformer", "hawk", "pragmatist"],
    opposeIdeologies: ["populist", "dove"]
  },

  // 16. Harvest Surplus Rebate – post-harvest boon
  harvest_rebate: {
    id: "harvest_rebate",
    uiTitle: "Petition: Harvest Surplus Rebate",
    uiBlurb:
      "Request that a good harvest’s surplus be turned back into the pockets of villagers and traders.",
    uiEffectSummary:
      "Effect: Savings and investments strengthen; loans ease; tavern rest becomes slightly cheaper.",
    decreeTitle: "Decree: Harvest Surplus Rebate",
    decreeLabel: "Granaries full, purses less tight.",
    decreeDescription:
      "With barns overflowing, the council decrees that not all bounty need be locked away in royal storehouses.",
    effect: {
      depositRateMultiplier: 1.2,
      investmentRateMultiplier: 1.2,
      loanRateMultiplier: 0.9,
      restCostMultiplier: 0.9
    },
    favorIdeologies: ["populist", "reformer", "dove", "pragmatist"],
    opposeIdeologies: ["traditionalist"]
  },

  // 17. Winter Relief Fund – cold-season mercy
  winter_relief: {
    id: "winter_relief",
    uiTitle: "Petition: Winter Relief Fund",
    uiBlurb:
      "Ask for firewood, blankets and coin to keep Emberwood’s poorest from freezing in the lean months.",
    uiEffectSummary:
      "Effect: Loans soften; tavern rest becomes cheap; savings and investments cool a bit.",
    decreeTitle: "Decree: Winter Hearth Relief",
    decreeLabel: "More smoke rises from chimneys each night.",
    decreeDescription:
      "Priests and volunteers haul bundles of wood and blankets through drifting snow, paid for by a grudging council purse.",
    effect: {
      depositRateMultiplier: 0.95,
      investmentRateMultiplier: 0.9,
      loanRateMultiplier: 0.8,
      restCostMultiplier: 0.7
    },
    favorIdeologies: ["dove", "populist", "reformer"],
    opposeIdeologies: ["hawk", "traditionalist"]
  }
};

const PETITION_DURATION_DAYS = 3; // how long a decree lasts once approved
const MIN_VOTE_DELAY = 1;         // population sentiment is taken 1–3 days after filing
const MAX_VOTE_DELAY = 3;

// -----------------------------------------------------------------------------
// SMALL HELPERS
// -----------------------------------------------------------------------------

function randInt(min, max) {
  return rngInt(null, min, max, 'townHall.randInt');
}

function getCurrentDay(state) {
  const t = state.time;
  return t && typeof t.dayIndex === "number" ? t.dayIndex : 0;
}

// Only show Town Hall messages in the main log if the player is in the village.
function logTownHall(state, addLog, message, style = "system") {
  if (!addLog) return;
  if (!state || state.area !== "village") return;
  addLog(message, style);
}

// Give councillors some personality in logs, including lifecycle status.
function describeCouncillor(member) {
  if (!member) return "a village councillor";

  const name = member.name || "a village councillor";
  const role = member.kingdomRole || "Councillor";
  const ideology = (member.ideology || "pragmatist").toLowerCase();
  const status = member.status || "active";

  let ideoPhrase;
  switch (ideology) {
    case "hawk":
      ideoPhrase = "a hardline hawk";
      break;
    case "dove":
      ideoPhrase = "a soft-spoken dove";
      break;
    case "traditionalist":
      ideoPhrase = "a staunch traditionalist";
      break;
    case "reformer":
      ideoPhrase = "an eager reformer";
      break;
    case "populist":
      ideoPhrase = "a fire-tongued populist";
      break;
    case "pragmatist":
    default:
      ideoPhrase = "a steady pragmatist";
      break;
  }

  let statusSuffix = "";
  if (status !== "active") {
    if (status === "deceased") statusSuffix = " – deceased";
    else if (status === "retired") statusSuffix = " – retired from council";
    else if (status === "recalled") statusSuffix = " – recalled by the realm council";
    else statusSuffix = " – former councillor";
  }

  return `${name}, ${role} (${ideoPhrase})${statusSuffix}`;
}

// Simple population mood label for Town Hall UI
function describePopulationMood(mood) {
  if (typeof mood !== "number") {
    return {
      label: "mixed",
      text: "Voices in the lanes are a blend of grumbling and laughter."
    };
  }

  if (mood >= 50) {
    return {
      label: "joyful",
      text: "Villagers greet one another with easy smiles; even the tax collector gets a nod."
    };
  } else if (mood >= 20) {
    return {
      label: "hopeful",
      text: "Most folk seem cautiously optimistic, planning for the next market day rather than the next crisis."
    };
  } else if (mood <= -50) {
    return {
      label: "angry",
      text: "Snapped words and hard stares follow talk of the crown and its agents."
    };
  } else if (mood <= -20) {
    return {
      label: "uneasy",
      text: "Conversations hush when strangers pass; worry hangs like a low fog."
    };
  }

  return {
    label: "mixed",
    text: "Voices in the lanes are a blend of grumbling and laughter."
  };
}

// -----------------------------------------------------------------------------
// NAME POOLS
// -----------------------------------------------------------------------------

const VILLAGE_FIRST_NAMES = [
  "Elira", "Thane", "Maris", "Corin", "Lyssa", "Bran",
  "Edda", "Garran", "Isolde", "Fenric", "Rowan", "Tamsin",
  "Jorin", "Alina", "Kael", "Mira", "Torren", "Sylvi",
  "Darek", "Neris", "Oswin", "Liora", "Hadrin", "Celia",
  "Rurik", "Teska", "Eamon", "Vera", "Kellan", "Maera"
];

const VILLAGE_LAST_NAMES = [
  "Stonebrook", "Ashfield", "Greywind", "Willowmere", "Redford",
  "Thornhill", "Oakridge", "Brightwater", "Ironvale", "Foxhollow",
  "Highfen", "Duskmere", "Stormbridge", "Hearthbrook", "Copperlane",
  "Rivergate", "Frostbloom", "Kestrelford", "Goldbarrow", "Nightwell",
  "Holloway", "Amberfall", "Windmere", "Blackthorn", "Starwatch",
  "Greenholt", "Hillridge", "Fairbloom", "Wyrmford", "Dawnhollow"
];

const COUNCIL_IDEOLOGIES = [
  "hawk",
  "dove",
  "traditionalist",
  "reformer",
  "populist",
  "pragmatist"
];

function randomCouncillorName() {
  const first = VILLAGE_FIRST_NAMES[randInt(0, VILLAGE_FIRST_NAMES.length - 1)];
  const last = VILLAGE_LAST_NAMES[randInt(0, VILLAGE_LAST_NAMES.length - 1)];
  return `${first} ${last}`;
}

function randomIdeology() {
  return COUNCIL_IDEOLOGIES[randInt(0, COUNCIL_IDEOLOGIES.length - 1)];
}

// -----------------------------------------------------------------------------
// TOWN HALL STATE (ON state.government)
// -----------------------------------------------------------------------------

/**
 * Shape:
 * state.government.townHall = {
 *   council: [...],
 *   currentPetition: { ... } | null,
 *   lastResolvedPetition: { ... } | null,
 *   priorDecrees: [
 *     {
 *       petitionId,
 *       decreeTitle,
 *       startedOnDay,
 *       expiresOnDay
 *     },
 *     ...
 *   ],
 *   lastDayUpdated: number|null,
 *   councilRecess: boolean,
 *   recessReason: string|null,
 *   recessStartedOnDay: number|null,
 *   recessEndsOnDay: number|null
 * }
 */
function ensureTownHallState(state, absoluteDay) {
  if (!state.government) {
    state.government = {};
  }
  if (!state.government.townHall) {
    state.government.townHall = {
      council: [],
      currentPetition: null,
      lastResolvedPetition: null,
      priorDecrees: [],
      lastDayUpdated: typeof absoluteDay === "number" ? Math.floor(absoluteDay) : null,
      councilRecess: false,
      recessReason: null,
      recessStartedOnDay: null,
      recessEndsOnDay: null
    };
  } else {
    const th = state.government.townHall;
    if (!Array.isArray(th.council)) th.council = [];
    if (!("currentPetition" in th)) th.currentPetition = null;
    if (!("lastResolvedPetition" in th)) th.lastResolvedPetition = null;
    if (!Array.isArray(th.priorDecrees)) th.priorDecrees = [];
    if (typeof th.lastDayUpdated !== "number") {
      th.lastDayUpdated = typeof absoluteDay === "number" ? Math.floor(absoluteDay) : null;
    }
    // Patch older saves with recess fields
    if (!("councilRecess" in th)) th.councilRecess = false;
    if (!("recessReason" in th)) th.recessReason = null;
    if (!("recessStartedOnDay" in th)) th.recessStartedOnDay = null;
    if (!("recessEndsOnDay" in th)) th.recessEndsOnDay = null;
  }
  return state.government.townHall;
}

// -----------------------------------------------------------------------------
// COUNCIL SETUP
// -----------------------------------------------------------------------------

function getRealmCouncil(state) {
  const g = state.government || {};
  return Array.isArray(g.council) ? g.council : [];
}

// Build a 3-member village council with lifecycle fields.
function ensureVillageCouncil(state) {
  const today = getCurrentDay(state);
  const hall = ensureTownHallState(state, today);

  // Patch any existing councillors with lifecycle fields.
  if (Array.isArray(hall.council)) {
    hall.council.forEach(m => {
      if (!m) return;
      if (!m.status) m.status = "active"; // "active" | "deceased" | "retired" | "recalled"
      if (typeof m.seatedOnDay !== "number") m.seatedOnDay = today;
      if (!("leftOnDay" in m)) m.leftOnDay = null;
      if (!("leftReason" in m)) m.leftReason = null;
      if (typeof m.age !== "number") m.age = randInt(30, 60);
    });
  }

  if (hall.council.length >= 3) return hall.council;

  const realmCouncil = getRealmCouncil(state);
  const picks = [];
  const pool = realmCouncil.slice();

  while (picks.length < 3) {
    let sponsor = null;
    if (pool.length) {
      const idx = randInt(0, pool.length - 1);
      sponsor = pool.splice(idx, 1)[0];
    } else if (realmCouncil.length) {
      sponsor = realmCouncil[randInt(0, realmCouncil.length - 1)];
    }

    const name = randomCouncillorName();

    let role = "Councillor";
    let ideology = "pragmatist";
    let loyalty = randInt(50, 75);
    let appointedBy = null;

    if (sponsor) {
      role = sponsor.role || role;
      ideology = sponsor.ideology || ideology;
      if (typeof sponsor.loyalty === "number") {
        loyalty = sponsor.loyalty;
      }
      appointedBy = sponsor.name || null;
    } else {
      const fallbackRoles = [
        "Guild Speaker",
        "Elder's Voice",
        "Market Warden",
        "Tally-Master",
        "Trade Factor"
      ];
      role = fallbackRoles[picks.length] || role;
      ideology = randomIdeology();
    }

    picks.push({
      id: "village_councillor_" + picks.length,
      name,
      kingdomRole: role,
      ideology,
      loyalty,
      appointedBy,
      status: "active",
      seatedOnDay: today,
      leftOnDay: null,
      leftReason: null,
      age: randInt(30, 60)
    });
  }

  hall.council = picks;
  return hall.council;
}

// -----------------------------------------------------------------------------
// VILLAGE COUNCIL ATTRITION & REPLACEMENT
// -----------------------------------------------------------------------------

function maybeUpdateVillageCouncilMembership(state, absoluteDay, addLog) {
  const hall = ensureTownHallState(state, absoluteDay);
  const council = ensureVillageCouncil(state);

  // If the council is already in recess, check if it's time to seat a replacement.
  if (hall.councilRecess) {
    if (
      typeof hall.recessEndsOnDay === "number" &&
      absoluteDay >= hall.recessEndsOnDay
    ) {
      // Seat a NEW external candidate (not taken off the local village list, but
      // thematically tied to the realm council as "appointed by").
      const realmCouncil = getRealmCouncil(state);
      let sponsor = null;
      if (realmCouncil.length) {
        sponsor = realmCouncil[randInt(0, realmCouncil.length - 1)];
      }

      const name = randomCouncillorName();
      const ideology = randomIdeology();
      const loyalty = randInt(50, 80);
      const role =
        (sponsor && sponsor.role) ||
        "Councillor";
      const appointedBy = sponsor ? sponsor.name || null : null;

      // Replace the first non-active seat, or the first seat as fallback.
      let seatIndex = council.findIndex(m => !m || m.status !== "active");
      if (seatIndex === -1) seatIndex = 0;

      const newMember = {
        id: "village_councillor_" + seatIndex + "_" + absoluteDay,
        name,
        kingdomRole: role,
        ideology,
        loyalty,
        appointedBy,
        status: "active",
        seatedOnDay: absoluteDay,
        leftOnDay: null,
        leftReason: null,
        age: randInt(30, 60)
      };

      council[seatIndex] = newMember;

      hall.councilRecess = false;
      hall.recessReason = null;
      hall.recessStartedOnDay = null;
      hall.recessEndsOnDay = null;

      const approx = describeCouncillor(newMember);
      logTownHall(
        state,
        addLog,
        `[Town Hall] Word arrives from Emberkeep: after a formal vote, the realm council confirms ${approx} as Emberwood's newest village councillor. The local council ends its recess and prepares to sit again.`,
        "info"
      );
    }
    return;
  }

  // If not in recess, very rarely let a member die / resign / be removed.
  if (!Array.isArray(council) || !council.length) return;

  for (let i = 0; i < council.length; i++) {
    const member = council[i];
    if (!member || member.status !== "active") continue;

    // Ensure age present
    if (typeof member.age !== "number") {
      member.age = randInt(30, 60);
    }

    // Tiny daily chances, scaled a bit by age / loyalty.
    const age = member.age;
    const baseDeath =
      age >= 70 ? 0.01 :
      age >= 60 ? 0.006 :
      age >= 50 ? 0.003 :
      0.001;

    const leaveChance = member.loyalty < 35 ? 0.003 : 0.001;
    const removedChance = member.loyalty < 25 ? 0.004 : 0.0015;

    const roll = rngFloat(null, 'townHall.memberFate');
    let reason = null;

    if (roll < baseDeath) {
      reason = "died";
    } else if (roll < baseDeath + leaveChance) {
      reason = "resigned";
    } else if (roll < baseDeath + leaveChance + removedChance) {
      reason = "removed_by_realm";
    }

    if (!reason) continue;

    // Mark the member as no longer active.
    member.leftOnDay = absoluteDay;
    member.leftReason = reason;
    if (reason === "died") member.status = "deceased";
    else if (reason === "resigned") member.status = "retired";
    else if (reason === "removed_by_realm") member.status = "recalled";
    else member.status = "retired";

    // Put council into recess until the realm sends a replacement.
    hall.councilRecess = true;
    hall.recessReason = reason;
    hall.recessStartedOnDay = absoluteDay;
    hall.recessEndsOnDay = absoluteDay + randInt(2, 5);

    // Narrative log
    const who = describeCouncillor(member);
    let msg;
    if (reason === "died") {
      msg = `[Town Hall] News spreads that ${who} has died. With a seat vacant, the village council falls into recess until the realm council can appoint a replacement from abroad.`;
    } else if (reason === "resigned") {
      msg = `[Town Hall] After quiet arguments behind closed doors, ${who} steps down from their Emberwood seat. The council enters recess while the realm considers an external successor.`;
    } else {
      msg = `[Town Hall] A sealed writ from Emberkeep recalls ${who} from the village council. Until the realm council votes in a new external councillor, Emberwood's council remains in recess.`;
    }

    logTownHall(state, addLog, msg, "system");
    break; // only one change per day
  }
}

// -----------------------------------------------------------------------------
// ACTIVE DECREE SNAPSHOT (READS state.government.townHallEffects)
// -----------------------------------------------------------------------------

function ensureTownHallEffects(state) {
  if (!state.government) {
    state.government = {};
  }
  if (!state.government.townHallEffects) {
    state.government.townHallEffects = {};
  }

  // Keep object shape stable so UIs can rely on fields existing.
  const eff = state.government.townHallEffects;
  const defaults = {
    petitionId: null,
    title: null,
    label: null,
    description: null,
    startedOnDay: null,
    expiresOnDay: null,
    depositRateMultiplier: null,
    investmentRateMultiplier: null,
    loanRateMultiplier: null,
    restCostMultiplier: null,

    // NEW: decrees can gently nudge the raw village economy while active.
    // These are per-day additive deltas, kept small by design.
    econProsperityDelta: null,
    econTradeDelta: null,
    econSecurityDelta: null,

    // Optional: ongoing mood pressure (separate from the one-time decree announcement).
    moodDailyDelta: null
  };

  for (const [k, v] of Object.entries(defaults)) {
    if (typeof eff[k] === "undefined") eff[k] = v;
  }

  return eff;
}

// -----------------------------------------------------------------------------
// SHARED EFFECT CLEANUP (used by bank / economy / any other system)
// -----------------------------------------------------------------------------
// NOTE: Expired decree payloads should not linger. When a decree expires we
// remove state.government.townHallEffects entirely (it will be re-created
// on-demand by ensureTownHallEffects() when the Town Hall UI needs it).

export function cleanupTownHallEffects(state, todayOverride = null) {
  if (!state) return { changed: false, active: false };
  if (!state.government) return { changed: false, active: false };

  // If there is no effects object, nothing to clean.
  const eff = state.government.townHallEffects;
  if (!eff || typeof eff !== 'object') return { changed: false, active: false };
  const today =
    typeof todayOverride === "number"
      ? todayOverride
      : typeof state.time?.dayIndex === "number"
      ? state.time.dayIndex
      : 0;

  const expiresOnDay =
    typeof eff.expiresOnDay === "number" ? eff.expiresOnDay : null;

  const active = !!eff.petitionId && expiresOnDay != null && today <= expiresOnDay;

  if (!active && expiresOnDay != null && today > expiresOnDay) {
    // Delete the payload entirely so expired modifiers can't be accidentally
    // re-applied by other systems that only check for object presence.
    const hadSomething = Object.keys(eff).length > 0;
    delete state.government.townHallEffects;
    return { changed: hadSomething, active: false };
  }

  return { changed: false, active };
}

function buildActiveEffectSnapshot(state) {
  const effects = ensureTownHallEffects(state);
  const today = getCurrentDay(state);

  if (
    !effects.petitionId ||
    typeof effects.expiresOnDay !== "number" ||
    today > effects.expiresOnDay
  ) {
    return {
      hasActive: false,
      title: "No temporary decrees in effect",
      tag: "Inactive",
      lines: [
        "The council has not posted any special economic edicts.",
        "Loan, savings, and rest costs follow the normal village economy."
      ]
    };
  }

  const remainingDays = Math.max(0, effects.expiresOnDay - today + 1);
  const tag =
    remainingDays === 1
      ? "Ends today"
      : `${remainingDays} days remaining`;

  const lines = [];
  if (effects.label) {
    lines.push(effects.label);
  }
  if (effects.description) {
    lines.push(effects.description);
  }

  // NEW: surface ongoing economy/mood nudges so players understand why things drift.
  const pD = Number(effects.econProsperityDelta);
  const tD = Number(effects.econTradeDelta);
  const sD = Number(effects.econSecurityDelta);
  const mD = Number(effects.moodDailyDelta);
  const econBits = [];
  if (Number.isFinite(pD) && Math.round(pD) !== 0) econBits.push(`Prosperity ${Math.round(pD) > 0 ? '+' : ''}${Math.round(pD)}/day`);
  if (Number.isFinite(tD) && Math.round(tD) !== 0) econBits.push(`Trade ${Math.round(tD) > 0 ? '+' : ''}${Math.round(tD)}/day`);
  if (Number.isFinite(sD) && Math.round(sD) !== 0) econBits.push(`Security ${Math.round(sD) > 0 ? '+' : ''}${Math.round(sD)}/day`);
  if (econBits.length) lines.push(`Ongoing nudge: ${econBits.join(' · ')}.`);
  if (Number.isFinite(mD) && Math.round(mD) !== 0) {
    const md = Math.round(mD);
    lines.push(`Ongoing mood pressure: ${md > 0 ? '+' : ''}${md}/day.`);
  }

  return {
    hasActive: true,
    title: effects.title || "Temporary decree in effect",
    tag,
    lines
  };
}

// -----------------------------------------------------------------------------
// DECREE APPLICATION (when a petition is APPROVED)
// -----------------------------------------------------------------------------

function applyApprovedPetition(state, petitionId, addLog) {
  const def = PETITIONS[petitionId];
  if (!def) return;

  const effects = ensureTownHallEffects(state);
  const today = getCurrentDay(state);
  const hall = ensureTownHallState(state, today);
  if (!Array.isArray(hall.priorDecrees)) hall.priorDecrees = [];

  const durationDays = PETITION_DURATION_DAYS;

  const {
    depositRateMultiplier = 1,
    investmentRateMultiplier = 1,
    loanRateMultiplier = 1,
    restCostMultiplier = 1,

    // NEW: per-day economy nudges while the decree is active
    econProsperityDelta = 0,
    econTradeDelta = 0,
    econSecurityDelta = 0,

    // Optional: per-day mood pressure
    moodDailyDelta = 0
  } = def.effect || {};

  effects.petitionId = petitionId;
  effects.startedOnDay = today;
  effects.expiresOnDay = today + durationDays - 1;
  effects.title = def.decreeTitle;
  effects.label = def.decreeLabel;
  effects.description = def.decreeDescription;
  effects.depositRateMultiplier = depositRateMultiplier;
  effects.investmentRateMultiplier = investmentRateMultiplier;
  effects.loanRateMultiplier = loanRateMultiplier;
  effects.restCostMultiplier = restCostMultiplier;

  // Economy / mood nudges
  effects.econProsperityDelta = econProsperityDelta;
  effects.econTradeDelta = econTradeDelta;
  effects.econSecurityDelta = econSecurityDelta;
  effects.moodDailyDelta = moodDailyDelta;

  // Track in decree history (for Prior Decrees UI).
  hall.priorDecrees.push({
    petitionId,
    decreeTitle: def.decreeTitle,
    startedOnDay: effects.startedOnDay,
    expiresOnDay: effects.expiresOnDay
  });

  // Combined log: mood shift + decree posting when it makes sense.
  let moodDelta = 0;
  let moodLabel = null;
  let popSize = null;

  if (typeof adjustPopulationMood === "function") {
    if (def.favorIdeologies && def.favorIdeologies.includes("populist")) {
      moodDelta += 5;
    }
    if (def.opposeIdeologies && def.opposeIdeologies.includes("populist")) {
      moodDelta -= 5;
    }
    if (def.favorIdeologies && def.favorIdeologies.includes("dove")) {
      moodDelta += 2;
    }
    if (def.opposeIdeologies && def.opposeIdeologies.includes("dove")) {
      moodDelta -= 2;
    }

    if (moodDelta !== 0) {
      const pop = adjustPopulationMood(state, moodDelta);
      popSize = pop.size;
      const moodInfo = describePopulationMood(pop.mood);
      moodLabel = moodInfo.label;
    }
  }

  // Build a single narrative string when we have both mood + decree.
  if (moodDelta !== 0 && moodLabel) {
    const approxPop = popSize != null ? `roughly ${popSize} villagers` : "the village";
    logTownHall(
      state,
      addLog,
      `[Town Hall] Word of "${def.decreeTitle}" rolls through ${approxPop}, leaving the mood a little more ${moodLabel}. By evening, scribes have nailed the fresh edict to the oak notice board, where knots of villagers argue over the new terms.`,
      moodDelta > 0 ? "good" : "system"
    );
  } else {
    // If there was no mood change, still announce the decree being posted.
    logTownHall(
      state,
      addLog,
      `[Town Hall] Under flickering lamplight, the councillors have the scribes nail a fresh edict to the oak notice board: "${def.decreeTitle}". Villagers cluster under it, murmuring over the new terms.`,
      "info"
    );
  }
}

// -----------------------------------------------------------------------------
// POPULATION VOTE
// -----------------------------------------------------------------------------

function getPopulationSupportChance(petitionId, state) {
  const def = PETITIONS[petitionId];
  let chance = 0.5;

  if (def) {
    const favor = def.favorIdeologies || [];
    const oppose = def.opposeIdeologies || [];

    if (favor.includes("populist") || favor.includes("dove")) {
      chance += 0.15;
    }
    if (oppose.includes("populist") || oppose.includes("dove")) {
      chance -= 0.15;
    }

    if (favor.includes("traditionalist") || favor.includes("hawk")) {
      chance += 0.05;
    }
    if (oppose.includes("traditionalist") || oppose.includes("hawk")) {
      chance -= 0.05;
    }
  }

  chance += randInt(-8, 8) / 100;

  if (chance < 0.05) chance = 0.05;
  if (chance > 0.95) chance = 0.95;

  return chance;
}

function resolvePopulationVote(state, hall, petition, addLog) {
  const population = ensureVillagePopulation(state);
  const baseChance = getPopulationSupportChance(petition.petitionId, state);

  let supportPercent = Math.round(baseChance * 100 + randInt(-5, 5));
  if (supportPercent < 5) supportPercent = 5;
  if (supportPercent > 95) supportPercent = 95;

  const approved = supportPercent >= 50;

  petition.popularSupportPercent = supportPercent;
  petition.popularApproved = approved;

  const approxFor = Math.round((population.size * supportPercent) / 100);
  const approxAgainst = population.size - approxFor;

  if (approved) {
    // Combined comment: sentiment + hint that the matter will move to council
    // if the councillors dare oppose the village mood.
    logTownHall(
      state,
      addLog,
      `[Town Hall] Word of the petition spreads through Emberwood. Gossip in the tavern and market stalls suggests most folk approve: perhaps ${supportPercent}% in favor — roughly ${approxFor} voices for it, against ${approxAgainst} mutters of doubt. The clerks quietly note the village’s leanings, preparing to set the measure before the council once they have slept on it.`,
      "info"
    );
  } else {
    logTownHall(
      state,
      addLog,
      `[Town Hall] The petition becomes the talk of the lane. After a few days of argument, the mood is sour: only about ${supportPercent}% of villagers seem to favor it, with the rest complaining in doorways and over ale.`,
      "system"
    );
  }
}

// -----------------------------------------------------------------------------
// VOTING LOGIC (DAILY TICK)
// -----------------------------------------------------------------------------

function getYesChanceForCouncillor(
  member,
  petitionId,
  state,
  popularSupportPercent,
  popularApproved
) {
  const ideology = (member.ideology || "pragmatist").toLowerCase();
  const def = PETITIONS[petitionId];

  let chance = 0.55;

  if (def) {
    const favor = def.favorIdeologies || [];
    const oppose = def.opposeIdeologies || [];

    if (favor.includes(ideology)) {
      chance += 0.22;
    }
    if (oppose.includes(ideology)) {
      chance -= 0.22;
    }
  }

  const loyalty = typeof member.loyalty === "number" ? member.loyalty : 60;
  chance += (loyalty - 50) / 350;

  if (typeof popularSupportPercent === "number") {
    const s = popularSupportPercent;

    if (popularApproved) {
      if (s >= 65) {
        chance += 0.12;
      } else if (s >= 55) {
        chance += 0.06;
      }
    } else {
      if (s <= 35) {
        chance -= 0.12;
      } else if (s <= 45) {
        chance -= 0.06;
      }
    }
  }

  chance += randInt(-5, 5) / 100;

  if (chance < 0.08) chance = 0.08;
  if (chance > 0.92) chance = 0.92;

  return chance;
}

/**
 * Called once per in-game day by your time system.
 * - When voteDueDay arrives:
 *     • resolves the population vote (village sentiment),
 *     • if the village rejects it, the petition dies immediately and never reaches the council,
 *     • if the village approves, schedules a council vote one full day later.
 * - On or after councilVoteDay:
 *     • resolves the council vote, influenced by population mood (unless council in recess).
 * - Occasionally lets councillors originate their own petition if none is pending and
 *   the council is not in recess.
 */
export function handleTownHallDayTick(state, absoluteDay, hooks = {}) {
  if (!state) return;
  const addLog = typeof hooks.addLog === "function" ? hooks.addLog : null;
  
  const day = Number.isFinite(absoluteDay) ? Math.floor(absoluteDay) : 0;

  const hall = ensureTownHallState(state, day);
  // Guard against double-running the same day (keeps petition timelines sane).
  if (hall.lastDayUpdated === day) return;
  hall.lastDayUpdated = day;

  // Centralized cleanup so expired decrees don't linger.
  cleanupTownHallEffects(state, day);
  const council = ensureVillageCouncil(state);

  // NEW: Let councillors die / leave / be recalled, and handle recess / replacement.
  maybeUpdateVillageCouncilMembership(state, day, addLog);

  const inRecess = !!hall.councilRecess;

  // 1) Resolve population + council stages for an existing petition.
  const petition = hall.currentPetition;
  if (petition && petition.status === "pending") {
    const def = PETITIONS[petition.petitionId];

    // 1a) Population vote happens first, on or after voteDueDay, if not yet taken.
    if (
      typeof petition.popularSupportPercent !== "number" &&
      day >= petition.voteDueDay
    ) {
      resolvePopulationVote(state, hall, petition, addLog);

      const popSupport = petition.popularSupportPercent;
      const popApproved = petition.popularApproved;

      if (!popApproved) {
        // Village rejects the petition; it never reaches the council.
        hall.lastResolvedPetition = {
          petitionId: petition.petitionId,
          submittedBy: petition.submittedBy,
          approved: false,
          yesVotes: 0,
          noVotes: 0,
          resolvedOnDay: day,
          popularApproved: false,
          popularSupportPercent: popSupport
        };

        hall.currentPetition = null;

        if (def) {
          logTownHall(
            state,
            addLog,
            `[Town Hall] With most of Emberwood grumbling against "${def.uiTitle}", the parchment is quietly filed away. The councillors decline to call a formal vote on a measure the village clearly does not want.`,
            "system"
          );
        }
      } else {
        // Village approves; schedule council for the *next* day.
        petition.councilVoteDay = day + 1;
        // No extra log here — the population-vote log already hints that
        // the matter will be put before the council after a pause.
      }
    }

    // 1b) If the village approved and the waiting day has passed, hold the council vote
    //     – but only if the council is not in recess.
    if (
      petition &&
      !inRecess &&
      typeof petition.popularSupportPercent === "number" &&
      petition.popularApproved &&
      typeof petition.councilVoteDay === "number" &&
      day >= petition.councilVoteDay
    ) {
      const popSupport = petition.popularSupportPercent;
      const popApproved = petition.popularApproved;

      const votes = [];
      council.forEach(member => {
        if (!member || member.status !== "active") return;
        const chance = getYesChanceForCouncillor(
          member,
          petition.petitionId,
          state,
          popSupport,
          popApproved
        );
        const yes = rngFloat(null, 'townHall.voteCitizen') < chance;
        votes.push({ member, yes });
      });

      const yesVotes = votes.filter(v => v.yes).length;
      const noVotes = votes.length - yesVotes;
      const approved = yesVotes >= 2;

      hall.lastResolvedPetition = {
        petitionId: petition.petitionId,
        submittedBy: petition.submittedBy,
        approved,
        yesVotes,
        noVotes,
        resolvedOnDay: day,
        popularApproved: popApproved,
        popularSupportPercent: popSupport
      };

      hall.currentPetition = null;

      const speaker = (approved
        ? votes.find(v => v.yes)
        : votes.find(v => !v.yes)) || votes[0];

      const speakerDesc = describeCouncillor(speaker && speaker.member);
      const decreeName = def ? def.decreeTitle : "the decree";

      if (approved) {
        applyApprovedPetition(state, def.id, addLog);
        logTownHall(
          state,
          addLog,
          `[Town Hall] After giving the village’s mood a night to settle, ${speakerDesc} raps the table and declares that the petition carries, ${yesVotes}–${noVotes}. The clerk finalizes "${decreeName}" as law while the murmurs from the square drift in through the shuttered windows.`,
          "good"
        );
      } else {
        logTownHall(
          state,
          addLog,
          `[Town Hall] Though the village leaned in favor, ${speakerDesc} announces that the petition fails, ${yesVotes}–${noVotes}. A few villagers cheer, others go home shaking their heads.`,
          "system"
        );
      }
    }
  }

  // 2) If no active petition and council is NOT in recess, councillors may file their own.
  if (!hall.currentPetition && !inRecess) {
    const effects = state.government && state.government.townHallEffects;
    const hasActiveDecree =
      effects &&
      effects.petitionId &&
      typeof effects.expiresOnDay === "number" &&
      day <= effects.expiresOnDay;

    if (!hasActiveDecree) {
      const roll = rngFloat(null, 'townHall.autoPetitionRoll');
      const councilPetitionChance = 0.06; // ~6% per in-game day

      if (roll < councilPetitionChance && council.length) {
        const keys = Object.keys(PETITIONS);
        const petitionId = keys[randInt(0, keys.length - 1)];
        const def = PETITIONS[petitionId];
        const sponsor = council[randInt(0, council.length - 1)];

        const voteDelay = randInt(MIN_VOTE_DELAY, MAX_VOTE_DELAY);

        const today = day;
        hall.currentPetition = {
          petitionId,
          submittedBy: "council:" + sponsor.id,
          submittedOnDay: today,
          voteDueDay: today + voteDelay,
          status: "pending"
        };

        if (def) {
          const sponsorDesc = describeCouncillor(sponsor);
          logTownHall(
            state,
            addLog,
            `[Town Hall] ${sponsorDesc} rises from their bench, cloak rustling, and calls for "${def.uiTitle}". Scribes scratch furiously as the other councillors mutter into their sleeves; the streets will buzz with argument until the village mood is taken in about ${voteDelay} day(s). If folk favor it, the council will convene to vote the following day.`,
            "info"
          );
        }
      }
    }
  }
}

// -----------------------------------------------------------------------------
// PLAYER-FACING UI
// -----------------------------------------------------------------------------

function queuePlayerPetition(state, petitionId, addLog) {
  const def = PETITIONS[petitionId];
  if (!def) return;

  const today = getCurrentDay(state);
  const hall = ensureTownHallState(state, today);

  if (hall.councilRecess) {
    logTownHall(
      state,
      addLog,
      "[Town Hall] The village council is currently in recess after a recent vacancy. Clerks apologise and explain that no new petitions can be formally docketed until a replacement councillor is seated.",
      "system"
    );
    return;
  }

  if (hall.currentPetition && hall.currentPetition.status === "pending") {
    logTownHall(
      state,
      addLog,
      "[Town Hall] The council's docket is already full. Clerks politely inform you that no new petition can be heard until the current one is decided.",
      "system"
    );
    return;
  }

  const voteDelay = randInt(MIN_VOTE_DELAY, MAX_VOTE_DELAY);

  hall.currentPetition = {
    petitionId,
    submittedBy: "player",
    submittedOnDay: today,
    voteDueDay: today + voteDelay,
    status: "pending"
  };

  logTownHall(
    state,
    addLog,
    `[Town Hall] You present your case for "${def.uiTitle}". Wax seals are pressed to parchment as the clerks take your petition. Word will spread through the lanes first; in about ${voteDelay} day(s) the scribes will quietly take the measure of village opinion. If most folk approve, the councillors will hold their own vote on the following day.`,
    "info"
  );
}

// Build a human-readable status line for current + last petition.
function buildPetitionStatusSummary(state) {
  const today = getCurrentDay(state);
  const hall = ensureTownHallState(state, today);
  const current = hall.currentPetition;
  const last = hall.lastResolvedPetition;

  const lines = [];

  if (hall.councilRecess) {
    let line =
      "The village council is presently in recess after a recent vacancy; no formal council votes will be held until a replacement councillor is appointed by the realm.";
    if (typeof hall.recessEndsOnDay === "number") {
      const daysLeft = Math.max(0, hall.recessEndsOnDay - today);
      if (daysLeft === 0) {
        line += " Rumor says a new appointment could be announced any day now.";
      } else {
        line += ` Scribes whisper that a successor may be seated in about ${daysLeft} day(s).`;
      }
    }
    lines.push(line);
  }

  if (!current) {
    lines.push("No petition is currently being debated by the village council.");
  } else {
    const def = PETITIONS[current.petitionId];
    const source =
      current.submittedBy === "player"
        ? "You submitted this petition."
        : "Proposed by a village councillor.";

    lines.push(def ? def.uiTitle : "Unknown petition");
    lines.push(source);

    if (typeof current.popularSupportPercent === "number") {
      if (current.popularApproved) {
        const councilDay =
          typeof current.councilVoteDay === "number"
            ? current.councilVoteDay
            : current.voteDueDay + 1;
        const daysUntilCouncil = Math.max(0, councilDay - today);

        const when =
          daysUntilCouncil === 0
            ? hall.councilRecess
              ? "The villagers have signaled their approval, but the council is in recess; the final vote must wait until a replacement councillor is seated."
              : "The villagers have signaled their approval; the council is expected to vote today."
            : hall.councilRecess
              ? `The villagers have already signaled their approval, but the council is in recess. Once the council sits again, they are expected to vote after about ${daysUntilCouncil} additional day(s).`
              : `The villagers have already signaled their approval. The council is expected to vote in about ${daysUntilCouncil} day(s).`;

        lines.push(
          `Roughly ${current.popularSupportPercent}% of villagers seem to favor it.`
        );
        lines.push(when);
      } else {
        lines.push(
          `The villagers have mostly rejected this petition (${current.popularSupportPercent}% support); it will not advance to a council vote.`
        );
      }
    } else {
      const daysRemaining = Math.max(0, current.voteDueDay - today);
      const when =
        daysRemaining === 0
          ? "The streets are thick with argument, and the village's leanings should become clear today. Only if folk largely approve will the council take it up tomorrow."
          : `The village will argue over it for about ${daysRemaining} more day(s), after which the mood will be measured. If the people favor it, the council will vote the following day.`;
      lines.push(when);
    }
  }

  if (last) {
    const def = PETITIONS[last.petitionId];
    const title = def ? def.uiTitle : "Previous petition";

    let outcome;
    if (!last.popularApproved && last.yesVotes === 0 && last.noVotes === 0) {
      outcome = "defeated by the villagers before any council vote";
    } else {
      outcome = last.approved ? "approved by the council" : "rejected by the council";
    }

    if (typeof last.popularSupportPercent === "number") {
      const popPhrase = last.popularApproved
        ? `The villagers mostly favored it (${last.popularSupportPercent}% support)`
        : `The villagers mostly opposed it (${last.popularSupportPercent}% support)`;

      if (!last.popularApproved && last.yesVotes === 0 && last.noVotes === 0) {
        lines.push(
          `${title} was ${outcome} on day ${last.resolvedOnDay}. ${popPhrase}, so the councillors never took a formal vote.`
        );
      } else {
        lines.push(
          `${title} was ${outcome} (${last.yesVotes}–${last.noVotes}) on day ${last.resolvedOnDay}. ${popPhrase} before the councillors cast their votes.`
        );
      }
    } else {
      lines.push(
        `${title} was ${outcome} (${last.yesVotes}–${last.noVotes}) on day ${last.resolvedOnDay}.`
      );
    }
  }

  return lines;
}

/**
 * Town Hall / Council petition UI.
 */
export function openTownHallModalImpl({
  state,
  openModal,
  addLog,
  handleGovernmentDayTick,
  handleEconomyDayTick,
  updateHUD,
  saveGame
}) {
  const player = state.player;
  if (!player) return;

  const today = getCurrentDay(state);
  const hall = ensureTownHallState(state, today);
  const council = ensureVillageCouncil(state);
  const population = ensureVillagePopulation(state);
  const activeSnapshot = buildActiveEffectSnapshot(state);
  const popMoodInfo = describePopulationMood(population.mood);

  openModal("Town Hall & Council", body => {
    body.innerHTML = "";

    // Intro text
    const intro = document.createElement("p");
    intro.className = "modal-subtitle";
    intro.textContent =
      "The village council chambers smell of ink, wax, and old oak. Councillors pore over ledgers and petitions from the common folk.";
    body.appendChild(intro);

    // --- CARD: VILLAGE POPULATION -----------------------------------------
    const popCard = document.createElement("div");
    popCard.className = "item-row";
    body.appendChild(popCard);

    const popHeader = document.createElement("div");
    popHeader.className = "item-row-header";
    popCard.appendChild(popHeader);

    const popTitle = document.createElement("span");
    popTitle.className = "item-name";
    popTitle.textContent = "Emberwood Population";
    popHeader.appendChild(popTitle);

    const popTag = document.createElement("span");
    popTag.className = "tag";
    popTag.textContent = `${popMoodInfo.label} mood`;
    popHeader.appendChild(popTag);

    const popBody = document.createElement("div");
    popBody.className = "item-body";
    popCard.appendChild(popBody);

    const popLine = document.createElement("p");
    popLine.className = "item-description";
    popLine.textContent =
      `Roughly ${population.size.toLocaleString()} souls call Emberwood home. ` +
      popMoodInfo.text;
    popBody.appendChild(popLine);


    // --- STORY CARD: EMERGENCY COUNCIL (Chapter III) -------------------------
    try {
      const q = state?.quests?.main;
      const f = state?.flags || {};
      if (q && q.status === 'active' && Number(q.step) === 15 && !f.chapter3CouncilDone) {
        const storyCard = document.createElement('div');
        storyCard.className = 'item-row';
        body.appendChild(storyCard);

        const storyHeader = document.createElement('div');
        storyHeader.className = 'item-row-header';
        storyCard.appendChild(storyHeader);

        const storyTitle = document.createElement('span');
        storyTitle.className = 'item-name';
        storyTitle.textContent = 'Emergency Council: The Hollow Crown';
        storyHeader.appendChild(storyTitle);

        const storyTag = document.createElement('span');
        storyTag.className = 'tag';
        storyTag.textContent = 'Main Quest';
        storyHeader.appendChild(storyTag);

        const storyBody = document.createElement('div');
        storyBody.className = 'item-body';
        storyCard.appendChild(storyBody);

        const blurb = document.createElement('p');
        blurb.className = 'item-description';
        blurb.textContent = 'Runners have dragged every councillor out of bed. The oak behind the hall split in the night, and the village is pretending it did not.';
        storyBody.appendChild(blurb);

        const btnRow = document.createElement('div');
        btnRow.className = 'pill-row';
        storyBody.appendChild(btnRow);

        const btn = document.createElement('button');
        btn.className = 'btn small';
        btn.textContent = 'Attend council';

        btn.addEventListener('click', () => {
          openModal && openModal('Emergency Council', (mBody) => {
            const lead = document.createElement('p');
            lead.className = 'modal-subtitle';
            lead.textContent = 'Voices overlap. Ink scratches. Someone keeps asking if the split oak was an omen or a threat.';
            mBody.appendChild(lead);

            const txt = document.createElement('div');
            txt.style.whiteSpace = 'pre-line';
            txt.style.fontSize = '0.86rem';
            txt.style.lineHeight = '1.35';
            txt.textContent = [
              'Rowan looks older than yesterday.',
              'The council looks like it wishes it believed in accidents.',
              '',
              'They want a plan that can survive being wrong.'
            ].join('\n');
            mBody.appendChild(txt);

            const actions = document.createElement('div');
            actions.className = 'modal-actions';

            const choose = (stance) => {
              f.chapter3CouncilDone = true;
              f.chapter3CouncilStance = stance;
              q.step = 15.5;
              f.blackbarkDepthsUnlocked = true;
              f.chapter3InvestigationDone = false;

              // Light, narrative-facing mood impact
              if (stance === 'fortify') {
                adjustPopulationMood(state, -1);
                addLog && addLog('You urge fortifications. The village feels safer — and smaller.', 'system');
              } else if (stance === 'appease') {
                adjustPopulationMood(state, 1);
                addLog && addLog('You urge calm and terms. Hope rises — nervous and bright.', 'good');
              } else {
                addLog && addLog('You urge investigation. The council grants you time — and responsibility.', 'system');
              }

              // (Syntax fix) Escape the apostrophe inside a single-quoted string.
              addLog && addLog('The hall empties with the uneasy relief of a decision made. Rowan marks a route into the Blackbark Depths — the only place the split oak\'s sap could have come from.', 'system');
              updateHUD && updateHUD();
              saveGame && saveGame();

              // Confirmation modal
              openModal && openModal('Council Decision', (b2) => {
                const p = document.createElement('p');
                p.className = 'modal-subtitle';
                p.textContent = stance === 'fortify' ? 'You choose walls.' : stance === 'appease' ? 'You choose words.' : 'You choose answers.';
                b2.appendChild(p);
                const t2 = document.createElement('p');
                t2.className = 'item-description';
                t2.textContent = 'Go to the Blackbark Depths and take a charcoal rubbing of the sigil‑vein. Then, at night, return to the Blackbark Gate and take the Crown‑Echo.';
                b2.appendChild(t2);
              });
            };

            const b1 = document.createElement('button');
            b1.className = 'btn';
            b1.textContent = 'Fortify the village';
            b1.addEventListener('click', () => choose('fortify'));
            actions.appendChild(b1);

            const b2 = document.createElement('button');
            b2.className = 'btn';
            b2.textContent = 'Seek terms';
            b2.addEventListener('click', () => choose('appease'));
            actions.appendChild(b2);

            const b3 = document.createElement('button');
            b3.className = 'btn';
            b3.textContent = 'Hunt the source';
            b3.addEventListener('click', () => choose('investigate'));
            actions.appendChild(b3);
            mBody.appendChild(actions);
          });
        });

        btnRow.appendChild(btn);
      }
    } catch (e) {
      // fail open: town hall should still render
    }

    // --- CARD: VILLAGE COUNCIL ---------------------------------------------
    const councilCard = document.createElement("div");
    councilCard.className = "item-row";
    body.appendChild(councilCard);

    const councilHeader = document.createElement("div");
    councilHeader.className = "item-row-header";
    councilCard.appendChild(councilHeader);

    const councilTitle = document.createElement("span");
    councilTitle.className = "item-name";
    councilTitle.textContent = "Village Council of Emberwood";
    councilHeader.appendChild(councilTitle);

    const councilTag = document.createElement("span");
    councilTag.className = "tag";
    councilTag.textContent = `${council.length} members • Pop. ~${population.size}`;
    councilHeader.appendChild(councilTag);

    const councilBody = document.createElement("div");
    councilBody.className = "item-body";
    councilCard.appendChild(councilBody);

    const councilIntro = document.createElement("p");
    councilIntro.className = "item-description";
    councilIntro.textContent =
      "Three councillors, drawn from the orbit of the royal court, steer Emberwood's local decrees – with hundreds of voices in the streets behind them.";
    councilBody.appendChild(councilIntro);

    // Recess status line (if any)
    if (hall.councilRecess) {
      const recessP = document.createElement("p");
      recessP.className = "item-description";

      let reasonText =
        "A recent vacancy has left the council unable to sit; Emberwood's council is currently in recess.";
      if (hall.recessReason === "died") {
        reasonText =
          "A councillor's recent death has left a vacant chair; Emberwood's council is in recess until the realm council appoints a replacement.";
      } else if (hall.recessReason === "resigned") {
        reasonText =
          "One councillor has stepped down, and the council stands in recess while the realm deliberates on an external successor.";
      } else if (hall.recessReason === "removed_by_realm") {
        reasonText =
          "The realm council has recalled one of Emberwood's councillors; until a new envoy is chosen, the village council remains in recess.";
      }

      if (typeof hall.recessEndsOnDay === "number") {
        const daysLeft = Math.max(0, hall.recessEndsOnDay - today);
        if (daysLeft === 0) {
          reasonText += " Scribes whisper that a new appointment is expected any day now.";
        } else {
          reasonText += ` Rumor suggests a replacement may be seated in about ${daysLeft} day(s).`;
        }
      }

      recessP.textContent = reasonText;
      councilBody.appendChild(recessP);
    }

    const councilList = document.createElement("ul");
    councilList.style.margin = "4px 0 0 1rem";
    councilList.style.padding = "0";
    councilList.style.fontSize = "0.8rem";

    council.forEach(m => {
      const li = document.createElement("li");
      li.textContent = describeCouncillor(m);
      councilList.appendChild(li);
    });

    councilBody.appendChild(councilList);

    // --- CARD: CURRENT DECREE ----------------------------------------------
    const activeCard = document.createElement("div");
    activeCard.className = "item-row";
    body.appendChild(activeCard);

    const activeHeader = document.createElement("div");
    activeHeader.className = "item-row-header";
    activeCard.appendChild(activeHeader);

    const activeTitle = document.createElement("span");
    activeTitle.className = "item-name";
    activeHeader.appendChild(activeTitle);

    const activeTag = document.createElement("span");
    activeTag.className = "tag";
    activeHeader.appendChild(activeTag);

    const activeBody = document.createElement("div");
    activeBody.className = "item-body";
    activeCard.appendChild(activeBody);

    const activeText = document.createElement("p");
    activeText.className = "item-description";
    activeBody.appendChild(activeText);

    function refreshActiveCard() {
      const snap = buildActiveEffectSnapshot(state);
      activeTitle.textContent = snap.title;
      activeTag.textContent = snap.tag;
      activeText.textContent = snap.lines.join(" ");
    }

    refreshActiveCard();

    // --- CARD: PRIOR DECREES (COLLAPSIBLE) ---------------------------------
    const historyCard = document.createElement("div");
    historyCard.className = "item-row";
    body.appendChild(historyCard);

    const historyHeader = document.createElement("div");
    historyHeader.className = "item-row-header";
    historyCard.appendChild(historyHeader);

    const historyTitle = document.createElement("span");
    historyTitle.className = "item-name";
    historyTitle.textContent = "Prior Decrees";
    historyHeader.appendChild(historyTitle);

    const historyTag = document.createElement("span");
    historyTag.className = "tag";
    historyTag.textContent = "History";
    historyHeader.appendChild(historyTag);

    const historyBody = document.createElement("div");
    historyBody.className = "item-body";
    historyCard.appendChild(historyBody);

    const historyText = document.createElement("div");
    historyText.className = "item-description";
    historyBody.appendChild(historyText);

    function renderPriorDecrees() {
      const todayDay = getCurrentDay(state);
      const hallState = ensureTownHallState(state, todayDay);
      const prior = Array.isArray(hallState.priorDecrees)
        ? hallState.priorDecrees.slice()
        : [];

      historyText.innerHTML = "";

      if (!prior.length) {
        const p = document.createElement("p");
        p.textContent = "No decrees have yet been enacted by the village council.";
        historyText.appendChild(p);
        return;
      }

      // Sort most recent first.
      prior.sort((a, b) => (b.startedOnDay || 0) - (a.startedOnDay || 0));

      const details = document.createElement("details");
      details.open = false;

      const summary = document.createElement("summary");
      summary.textContent = "Show prior decrees (with enactment days)";
      details.appendChild(summary);

      const list = document.createElement("ul");
      list.style.margin = "4px 0 0 1rem";
      list.style.padding = "0";
      list.style.fontSize = "0.8rem";

      prior.forEach(entry => {
        const def = PETITIONS[entry.petitionId];
        const title = entry.decreeTitle || (def && def.decreeTitle) || "Unknown decree";
        const start = typeof entry.startedOnDay === "number" ? entry.startedOnDay : "?";
        const end = typeof entry.expiresOnDay === "number" ? entry.expiresOnDay : "?";

        const li = document.createElement("li");
        const isActive =
          typeof start === "number" &&
          typeof end === "number" &&
          todayDay >= start &&
          todayDay <= end;

        li.textContent = isActive
          ? `${title} — enacted day ${start}, effective through day ${end} (active)`
          : `${title} — enacted day ${start}, effective through day ${end}`;
        list.appendChild(li);
      });

      details.appendChild(list);
      historyText.appendChild(details);
    }

    renderPriorDecrees();

    // --- CARD: PETITION & VOTE STATUS --------------------------------------
    const petitionCard = document.createElement("div");
    petitionCard.className = "item-row";
    body.appendChild(petitionCard);

    const petitionHeader = document.createElement("div");
    petitionHeader.className = "item-row-header";
    petitionCard.appendChild(petitionHeader);

    const petitionTitle = document.createElement("span");
    petitionTitle.className = "item-name";
    petitionTitle.textContent = "Petitions & Votes";
    petitionHeader.appendChild(petitionTitle);

    const petitionTag = document.createElement("span");
    petitionTag.className = "tag";
    petitionTag.textContent = "Village & council";
    petitionHeader.appendChild(petitionTag);

    const petitionBody = document.createElement("div");
    petitionBody.className = "item-body";
    petitionCard.appendChild(petitionBody);

    const petitionStatus = document.createElement("p");
    petitionStatus.className = "item-description";
    petitionBody.appendChild(petitionStatus);

    function refreshPetitionStatus() {
      const lines = buildPetitionStatusSummary(state);
      petitionStatus.textContent = lines.join(" ");
    }

    refreshPetitionStatus();

    // --- CARD: PLAYER PETITION OPTIONS (collapsible list) ------------------
    const petitionsIntro = document.createElement("p");
    petitionsIntro.className = "modal-subtitle";
    petitionsIntro.textContent =
      "You may submit a petition for the council to consider. First the streets argue and the village mood is taken; only then, if folk favor it, do the councillors make it law—or let it die.";
    body.appendChild(petitionsIntro);

    const petitionBodies = [];

    Object.values(PETITIONS).forEach((petition, index) => {
      const card = document.createElement("div");
      card.className = "item-row";
      body.appendChild(card);

      const header = document.createElement("div");
      header.className = "item-row-header";
      header.style.cursor = "pointer";
      card.appendChild(header);

      const titleEl = document.createElement("span");
      titleEl.className = "item-name";
      titleEl.textContent = petition.uiTitle;
      header.appendChild(titleEl);

      const tagWrap = document.createElement("div");
      tagWrap.style.display = "flex";
      tagWrap.style.alignItems = "center";
      tagWrap.style.gap = "4px";
      header.appendChild(tagWrap);

      const chevron = document.createElement("span");
      chevron.textContent = index === 0 ? "▾" : "▸";
      chevron.style.fontSize = "0.75rem";
      chevron.style.opacity = "0.8";
      tagWrap.appendChild(chevron);

      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = "Petition";
      tagWrap.appendChild(tag);

      const inner = document.createElement("div");
      inner.className = "item-body";
      inner.style.display = index === 0 ? "block" : "none";
      card.appendChild(inner);
      petitionBodies.push({ inner, chevron });

      const blurb = document.createElement("p");
      blurb.className = "item-description";
      blurb.textContent = petition.uiBlurb;
      inner.appendChild(blurb);

      const effectLine = document.createElement("p");
      effectLine.className = "item-description";
      effectLine.textContent = petition.uiEffectSummary;
      inner.appendChild(effectLine);

      const btnRow = document.createElement("div");
      btnRow.className = "pill-row";
      inner.appendChild(btnRow);

      const btn = document.createElement("button");
      btn.className = "btn small";
      btn.textContent = "Submit petition";

      btn.addEventListener("click", () => {
        queuePlayerPetition(state, petition.id, addLog);
        updateHUD && updateHUD();
        saveGame && saveGame();
        refreshPetitionStatus();
        refreshActiveCard();
        renderPriorDecrees();
      });

      btnRow.appendChild(btn);

      // Header click → toggle this card, collapse the others
      header.addEventListener("click", () => {
        petitionBodies.forEach(entry => {
          if (entry.inner === inner) {
            const isOpen = inner.style.display !== "none";
            inner.style.display = isOpen ? "none" : "block";
            entry.chevron.textContent = isOpen ? "▸" : "▾";
          } else {
            entry.inner.style.display = "none";
            entry.chevron.textContent = "▸";
          }
        });
      });
    });
  });
}