// Locations/Village/tavern.js
// Tavern UI: resting, rumors, and tavern games.
//
// This module is intentionally dependency-injected (see TavernDeps) so it can stay
// decoupled from your main game loop while still triggering all day-based systems.
//
// Notes:
// - "Rent a Room" renders the gold price using the same <span class="tag gold">…</span>
//   pill used elsewhere (e.g., merchant UI).
// - Rest advances to next morning, then runs the daily tick pipeline (preferred) or
//   falls back to individual ticks for compatibility.

import { rngInt } from "../../systems/rng.js";

/** @typedef {{
 *  state: any,
 *  openModal: (title: string, builder: (body: HTMLElement) => void) => void,
 *  addLog: (text: string, type?: string) => void,
 *  getVillageEconomySummary: (state: any) => any,
 *  getRestCost: (state: any) => number,
 *  handleEconomyAfterPurchase: (state: any, goldSpent: number, context?: string) => void,
 *  jumpToNextMorning: (state: any) => any,
 *  advanceToNextMorning?: (state: any, hooks?: any) => any,
 *  runDailyTicks?: (state: any, absoluteDay: number, hooks?: any) => void,
 *  handleEconomyDayTick?: (state: any, absoluteDay: number) => void,
 *  handleGovernmentDayTick?: (state: any, absoluteDay: number, hooks?: any) => void,
 *  handleTownHallDayTick?: (state: any, absoluteDay: number, hooks?: any) => void,
 *  handlePopulationDayTick?: (state: any, absoluteDay: number, hooks?: any) => void,
 *  updateHUD: () => void,
 *  updateTimeDisplay: () => void,
 *  saveGame: () => void,
 *  closeModal: () => void,
 *  openGambleModal?: () => void,
 * }} TavernDeps
 */

function el(tag, opts = {}) {
  const node = document.createElement(tag);
  if (opts.className) node.className = opts.className;

  // Prefer text unless HTML is explicitly provided.
  if (opts.text != null) node.textContent = String(opts.text);
  if (opts.html != null) node.innerHTML = String(opts.html);

  if (opts.attrs) {
    for (const [k, v] of Object.entries(opts.attrs)) node.setAttribute(k, String(v));
  }
  if (typeof opts.onClick === "function") node.addEventListener("click", opts.onClick);
  if (Array.isArray(opts.children)) {
    for (const c of opts.children) if (c) node.appendChild(c);
  }
  return node;
}

function safeGet(obj, path, fallback = null) {
  try {
    // eslint-disable-next-line no-null/no-null
    const v = path.reduce((acc, k) => (acc != null ? acc[k] : undefined), obj);
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function uniqueStrings(arr) {
  return Array.from(new Set(arr.filter(Boolean).map(String)));
}

function randChoice(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return arr[rngInt(null, 0, arr.length - 1, 'tavern.rumorPick')];
}

function formatGoldTag(amount) {
  const n = Number(amount);
  const safe = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
  return `<span class="tag gold">${safe}g</span>`;
}

function isActiveDecree(state) {
  const eff = safeGet(state, ["government", "townHallEffects"], null);
  const today = safeGet(state, ["time", "dayIndex"], 0);
  if (!eff || typeof eff.expiresOnDay !== "number") return false;
  return today <= eff.expiresOnDay;
}

function buildRumorPool(state, econSummary) {
  /** @type {string[]} */
  const rumors = [];

  // --- Town Hall / Decrees -------------------------------------------------
  const hall = safeGet(state, ["government", "townHall"], null);
  const eff = safeGet(state, ["government", "townHallEffects"], null);

  if (hall && hall.councilRecess) {
    rumors.push(
      "They say the council chambers are shuttered—no votes, no petitions, just sealed letters and long faces."
    );
  } else {
    const pet = hall && hall.currentPetition;
    if (pet && pet.status === "pending") {
      rumors.push(
        "Folks whisper about a petition at the Town Hall—someone’s trying to sway the village before the vote lands."
      );
    }
  }

  if (eff && isActiveDecree(state)) {
    const title = eff.title || "a fresh decree";
    const label = eff.label ? ` ${eff.label}` : "";
    rumors.push(`The barkeep mentions ${title}.${label} Some patrons are already arguing over what it will cost them.`);
  }

  // --- Economy -------------------------------------------------------------
  const tier = econSummary && econSummary.tier;
  if (tier && tier.id) {
    if (tier.id === "thriving") {
      rumors.push("Caravans are arriving on time—someone swears Emberwood’s coin has been unusually ‘lucky’ lately.");
    } else if (tier.id === "stable") {
      rumors.push("Business feels steady. Merchants aren’t grinning too wide, which is usually a good sign.");
    } else if (tier.id === "struggling") {
      rumors.push("You catch talk of thin purses and thinner patience—prices climb, and tempers climb faster.");
    }
  }

  // --- Population mood (if available) -------------------------------------
  const mood = safeGet(state, ["village", "population", "mood"], null);
  if (typeof mood === "number") {
    if (mood >= 40) {
      rumors.push("The room feels lighter than usual—songs start faster, and even the grumpiest locals tip a little.");
    } else if (mood <= -40) {
      rumors.push("Conversation keeps dropping to whispers. People watch the door like they expect bad news to walk in.");
    }
  }

  // --- Always-available adventure hooks -----------------------------------
  rumors.push(
    "Caravans swear goblins still stalk the Emberwood trails at night—especially when the fog settles low.",
    "Someone claims they saw a robed figure near the Ruined Spire, speaking to the dark like it could answer.",
    "Hunters talk about a huge wolf deeper in the forest—clever enough to herd smaller packs.",
    "The elder keeps old maps of the Spire locked away. If you knew the right question, you might get a peek.",
    "A traveler insists the dragon’s roar can still be heard on stormy nights—though nobody agrees on which direction it comes from."
  );

  return uniqueStrings(rumors);
}

function buildOvernightSummary({ state, econSummary }) {
  /** @type {string[]} */
  const lines = [];

  const tier = econSummary?.tier;
  if (tier) lines.push(`Economy: ${tier.name} (${tier.priceDescriptor}).`);

  const eff = safeGet(state, ["government", "townHallEffects"], null);
  if (eff && isActiveDecree(state)) lines.push(`Decree in effect: ${eff.title || "(unnamed decree)"}.`);

  const hall = safeGet(state, ["government", "townHall"], null);
  if (hall?.councilRecess) lines.push("Town Hall: Council in recess.");
  else if (hall?.currentPetition?.status === "pending") lines.push("Town Hall: A petition is pending.");

  const mood = safeGet(state, ["village", "population", "mood"], null);
  if (typeof mood === "number") {
    const label = mood >= 40 ? "High" : mood <= -40 ? "Low" : "Steady";
    lines.push(`Villager mood: ${label}.`);
  }

  return lines;
}

function getBankWeekInfo(state) {
  const bank = state?.bank;
  const today = typeof state?.time?.dayIndex === 'number' ? Math.floor(state.time.dayIndex) : 0;
  const last = bank && Number.isFinite(Number(bank.lastInterestDay)) ? Math.floor(Number(bank.lastInterestDay)) : null;
  if (last == null) {
    return {
      initialized: false,
      today,
      daysIntoWeek: null,
      daysUntilNext: null
    };
  }

  const daysSince = Math.max(0, today - last);
  const daysIntoWeek = daysSince % 7;
  const daysUntilNext = 7 - daysIntoWeek;
  return { initialized: true, today, daysIntoWeek, daysUntilNext, lastInterestDay: last };
}

function buildTownSummaryModal({
  openModal,
  closeModal,
  newTime,
  before,
  after,
  econNudge,
  moodChange,
  dailyReport
}) {
  if (typeof openModal !== 'function') return;

  const weekday = newTime?.weekdayName || 'Next';
  const year = newTime?.year ?? newTime?.yea;
  const yearStr = typeof year === 'number' ? `Year ${year}` : '';

  openModal('Town Summary', body => {
    body.appendChild(
      el('p', {
        className: 'modal-subtitle',
        text: `You wake on ${weekday} morning${yearStr ? ` — ${yearStr}` : ''}.`
      })
    );

    const addCard = makeCardFactory(body);

    // Economy
    const econTier = after.econ?.tier;
    const econRight = econTier ? econTier.name : 'Unknown';
    const econDescBits = [];
    if (econTier) econDescBits.push(`Prices feel ${econTier.priceDescriptor}.`);
    if (after.econ) {
      econDescBits.push(`Prosperity ${after.econ.prosperity} · Trade ${after.econ.trade} · Security ${after.econ.security}.`);
    }
    if (econNudge && (econNudge.deltas?.prosperity || econNudge.deltas?.trade || econNudge.deltas?.security)) {
      const d = econNudge.deltas;
      const bits = [];
      if (d.prosperity) bits.push(`Prosperity ${d.prosperity > 0 ? '+' : ''}${d.prosperity}`);
      if (d.trade) bits.push(`Trade ${d.trade > 0 ? '+' : ''}${d.trade}`);
      if (d.security) bits.push(`Security ${d.security > 0 ? '+' : ''}${d.security}`);
      if (bits.length) econDescBits.push(`Decree nudge: ${bits.join(' · ')}.`);
    }
    addCard({
      title: 'Village Economy',
      rightTag: econRight,
      desc: econDescBits.join(' ')
    });

    // Merchants / Restocks (Patch 1.2.52)
    try {
      const restocked = Number(dailyReport?.merchantStockDeltaUnits);
      if (Number.isFinite(restocked)) {
        addCard({
          title: 'Shops & Wares',
          rightTag: restocked > 0 ? `+${restocked}` : 'No change',
          desc:
            restocked > 0
              ? `Merchants replenish their shelves overnight (+${restocked} stock units across stalls).`
              : 'Merchants have not replenished stock since your last report.'
        });
      }
    } catch (_) {}

    // Mood
    const moodBits = [];
    if (typeof after.mood === 'number') {
      const delta = typeof before.mood === 'number' ? after.mood - before.mood : 0;
      const label = after.mood >= 40 ? 'High' : after.mood <= -40 ? 'Low' : 'Steady';
      moodBits.push(`Mood: ${label} (${after.mood}).`);
      if (delta) moodBits.push(`Change: ${delta > 0 ? '+' : ''}${delta}.`);
      const reasons = moodChange?.reasons || [];
      if (delta && reasons.length) moodBits.push(`Why: ${reasons.join(' ')}`);
    }
    addCard({
      title: 'Villager Mood',
      rightTag: typeof after.mood === 'number' ? String(after.mood) : '',
      desc: moodBits.length ? moodBits.join(' ') : 'No mood data.'
    });

    // Decree
    const eff = after.decree;
    if (eff && eff.petitionId && typeof eff.expiresOnDay === 'number' && typeof after.dayIndex === 'number') {
      const remaining = Math.max(0, eff.expiresOnDay - after.dayIndex + 1);
      addCard({
        title: 'Town Hall Decree',
        rightTag: remaining === 1 ? 'Ends today' : `${remaining} days left`,
        desc: `${eff.title || 'A decree'} remains in effect.`
      });
    } else {
      addCard({
        title: 'Town Hall Decree',
        rightTag: 'None',
        desc: 'No temporary decrees are posted right now.'
      });
    }

    // Bank week progress
    const bankInfo = after.bankWeek;
    if (bankInfo.initialized) {
      addCard({
        title: 'Bank Ledger',
        rightTag: `${bankInfo.daysIntoWeek}/7`,
        desc: `Next weekly interest update in ${bankInfo.daysUntilNext} day${bankInfo.daysUntilNext === 1 ? '' : 's'}.`
      });
    } else {
      addCard({
        title: 'Bank Ledger',
        rightTag: 'Unopened',
        desc: 'Weekly cycles start the first time you visit the bank.'
      });
    }

    const actions = el('div', {
      className: 'item-actions',
      children: [
        el('button', { className: 'btn small', text: 'Continue', onClick: () => closeModal?.() })
      ]
    });
    body.appendChild(actions);
  });
}

function removeLeakedTavernFooter(modalBody) {
  const modalPanel = modalBody?.parentElement;
  if (!modalPanel) return;
  modalPanel.querySelectorAll(".tavern-footer-actions").forEach(n => n.remove());
}


function purgeModalPanelExtras(modalBody) {
  const panel = modalBody?.parentElement;
  if (!panel) return;

  // modalPanel should only ever contain #modalHeader and #modalBody.
  // If anything else leaks in (common when re-rendering), remove it.
  const header = panel.querySelector("#modalHeader");
  for (const child of Array.from(panel.children)) {
    if (!child) continue;
    if (child === modalBody) continue;
    if (header && child === header) continue;
    child.remove();
  }

  // Also remove any known stray footer rows, regardless of where they landed.
  panel.querySelectorAll(".tavern-footer-actions").forEach(n => n.remove());
}


function makeCardFactory(body) {
  /**
   * @param {{
   *  title: string,
   *  rightTag?: string, // may be plain text OR small HTML (e.g., gold pill)
   *  desc?: string,
   *  actions?: HTMLElement[],
   * }} args
   */
  return function addCard({ title, rightTag, desc, actions }) {
    const card = el("div", { className: "item-row" });

    const header = el("div", { className: "item-row-header" });
    header.appendChild(el("div", { html: `<span class="item-name">${title}</span>` }));

    const meta = el("div", { className: "item-meta" });
    if (typeof rightTag === "string" && rightTag.includes("<")) meta.innerHTML = rightTag;
    else meta.textContent = rightTag || "";
    header.appendChild(meta);

    card.appendChild(header);

    if (desc) card.appendChild(el("div", { className: "modal-subtitle", text: desc }));

    if (Array.isArray(actions) && actions.length) {
      const row = el("div", { className: "item-actions", children: actions });
      card.appendChild(row);
    }

    body.appendChild(card);
    return card;
  };
}

function runDayTicks(deps, absoluteDay) {
  const {
    state,
    addLog,
    runDailyTicks,
    handleEconomyDayTick,
    handleGovernmentDayTick,
    handleTownHallDayTick,
    handlePopulationDayTick
  } = deps;

  if (typeof absoluteDay !== "number") return;

  // Preferred: a centralized daily tick pipeline.
  if (typeof runDailyTicks === "function") {
    runDailyTicks(state, absoluteDay, { addLog });
    return;
  }

  // Back-compat fallback: tick systems individually.
  if (typeof handleEconomyDayTick === "function") handleEconomyDayTick(state, absoluteDay);
  if (typeof handleGovernmentDayTick === "function") handleGovernmentDayTick(state, absoluteDay, { addLog });
  if (typeof handleTownHallDayTick === "function") handleTownHallDayTick(state, absoluteDay, { addLog });
  if (typeof handlePopulationDayTick === "function") handlePopulationDayTick(state, absoluteDay, { addLog });
}

/**
 * Main entrypoint used by Main.js.
 * @param {TavernDeps} deps
 */
export function openTavernModalImpl(deps) {
  const {
    state,
    openModal,
    addLog,
    recordInput,
    getVillageEconomySummary,
    getRestCost,
    handleEconomyAfterPurchase,
    jumpToNextMorning,
    updateHUD,
    updateTimeDisplay,
    saveGame,
    closeModal,
    openGambleModal,

    // Optional quest hooks (provided by Main.js)
    questDefs,
    ensureQuestStructures,
    startSideQuest,
    advanceSideQuest,
    completeSideQuest,
    updateQuestBox,
    setScene
  } = deps;


  const player = state?.player;
  if (!player || typeof openModal !== "function") return;

  const econSummary = getVillageEconomySummary?.(state);
  const tier = econSummary?.tier;

  openModal("Emberwood Tavern", body => {
    let renderQueued = false;
    let renderTavern = () => {};

    // Coalesce multiple state updates into a single UI refresh (prevents stacking / duplicates).
    const scheduleRender = () => {
      if (renderQueued) return;
      renderQueued = true;
      setTimeout(() => {
        renderQueued = false;
        if (!body || !body.isConnected) return;
        const modal = body.closest("#modal");
        if (modal && modal.classList.contains("hidden")) return;

        // If anything leaked outside #modalBody, purge it before re-rendering.
        purgeModalPanelExtras(body);

        renderTavern();
      }, 0);
    };

    renderTavern = () => {
      purgeModalPanelExtras(body);
      body.replaceChildren();
      removeLeakedTavernFooter(body);

      // --- Intro -------------------------------------------------------------
      body.appendChild(
        el("p", {
          className: "modal-subtitle",
          text: "The Emberwood tavern hums with low chatter, clinking mugs, and the smell of stew."
        })
      );

      body.appendChild(
        el("p", {
          className: "modal-subtitle",
          text: tier
            ? `Village economy: ${tier.name} — rooms and food are ${tier.priceDescriptor}.`
            : "Village economy: Unknown."
        })
      );

      const addCard = makeCardFactory(body);

      // --- REST --------------------------------------------------------------
      const initialRestCost = getRestCost?.(state) ?? 0;

      const restBtn = el("button", {
        className: "btn small",
        text: "Rest until Morning",
        onClick: () => {
          const beforeEcon = getVillageEconomySummary?.(state);
          const beforeMood = safeGet(state, ["village", "population", "mood"], null);
          const beforeDay = safeGet(state, ["time", "dayIndex"], 0);

          const cost = getRestCost?.(state) ?? 0;

          try { recordInput?.('tavern.rest', { cost, beforeDay }); } catch (_) {}

          if (Number(player.gold) < Number(cost)) {
            addLog?.("You cannot afford a room right now.", "system");
            return;
          }

          // Pay & restore core resources
          player.gold -= cost;
          player.hp = player.maxHp;
          if (typeof player.maxResource === "number") player.resource = player.maxResource;

          // Clear common wound-over-time effects
          if (player.status) {
            if ("bleedTurns" in player.status) player.status.bleedTurns = 0;
            if ("bleedDamage" in player.status) player.status.bleedDamage = 0;
          }

          // Local spending feeds the village economy.
          if (typeof handleEconomyAfterPurchase === "function") handleEconomyAfterPurchase(state, cost, "village");

          // Jump time and tick all day-based systems.
          // Patch 1.2.52 (hotfix): route rest through the unified advanceWorldTime() pipeline when available.
          let newTime = null;
          let absoluteDay = null;

          if (typeof deps.advanceToNextMorning === "function") {
            newTime = deps.advanceToNextMorning(state, { addLog });
            absoluteDay = newTime?.absoluteDay;
          } else {
            // Back-compat fallback (older builds): manual jump + daily ticks.
            newTime = typeof jumpToNextMorning === "function" ? jumpToNextMorning(state) : null;
            absoluteDay = newTime?.absoluteDay;
            runDayTicks(deps, absoluteDay);
          }

          const afterEcon = getVillageEconomySummary?.(state);
          const afterMood = safeGet(state, ["village", "population", "mood"], null);
          const afterDay = safeGet(state, ["time", "dayIndex"], beforeDay);

          const econNudge = state?.villageEconomy?.lastDecreeNudge && state.villageEconomy.lastDecreeNudge.day === absoluteDay
            ? state.villageEconomy.lastDecreeNudge
            : null;

          const moodChange = state?.village?.population?.lastMoodChange && state.village.population.lastMoodChange.day === absoluteDay
            ? state.village.population.lastMoodChange
            : null;

          // Post-rest log summary
          const refreshedEcon = getVillageEconomySummary?.(state);
          const summaryLines = buildOvernightSummary({ state, econSummary: refreshedEcon });

          const weekday = newTime?.weekdayName || "the next";
          const year = newTime?.year ?? newTime?.yea; // tolerate older shapes
          const yearStr = typeof year === "number" ? ` (Year ${year})` : "";

          addLog?.(`You rest at the tavern and wake on ${weekday} morning${yearStr}.`, "good");
          if (summaryLines.length) addLog?.("Overnight: " + summaryLines.join(" "), "system");

          updateHUD?.();
          updateTimeDisplay?.();
          saveGame?.();

          // Show a dedicated “Town Summary” card after resting.
          buildTownSummaryModal({
            openModal,
            closeModal,
            newTime,
            before: { econ: beforeEcon, mood: beforeMood, dayIndex: beforeDay },
            after: {
              econ: afterEcon,
              mood: afterMood,
              dayIndex: afterDay,
              decree: safeGet(state, ["government", "townHallEffects"], null),
              bankWeek: getBankWeekInfo(state)
            },
            econNudge,
            moodChange,
            dailyReport: (state?.sim?.lastDailyReport && state.sim.lastDailyReport.day === absoluteDay)
              ? state.sim.lastDailyReport
              : null
          });
        }
      });

      restBtn.disabled = Number(player.gold) < Number(initialRestCost);

      addCard({
        title: "Rent a Room",
        rightTag: formatGoldTag(initialRestCost),
        desc: "Rest until morning, fully restoring health and class resources while washing away most wounds.",
        actions: [restBtn]
      });

    
  // --- QUESTS ------------------------------------------------------------
  try {
    ensureQuestStructures?.();
  } catch (_) {}

  const mainQuest = state?.quests?.main || null;
  const sideState = state?.quests?.side || {};
  const sideDefs = questDefs?.side || {};

  // Helper: whether side quest is already known
  const isQuestAvailable = (id) => !!sideDefs[id] && !sideState[id];

  // --- Chapter I (expanded): Bark-Scribe intel beat (Step 0.5) ---------
  if (mainQuest && mainQuest.status === "active" && Number(mainQuest.step) === 0.5 && !state?.flags?.ch1ScribeTrailsLearned) {
    const speakBtn = el("button", {
      className: "btn small",
      text: "Ask about trails",
      onClick: () => {
        openModal?.("Ink and Footprints", (body) => {
          body.appendChild(
            el("p", {
              className: "modal-subtitle",
              text:
                "The Bark‑Scribe sits with his back to the hearth, so the light falls on the table and not his face. He writes on bark as if paper were a luxury the world no longer deserves."
            })
          );

          body.appendChild(
            el("p", {
              text:
                "“Rowan doesn’t ask for courage,” he says without looking up. “He asks for attention. Goblins learned the shape of our roads, and now they think the roads belong to them.”"
            })
          );

          body.appendChild(
            el("p", {
              text:
                "He turns a strip of bark toward you. On it: crude stamps — circles broken by short notches, like teeth marks. “Trail‑marks,” he murmurs. “Not just navigation. A promise. If you see a mark with three notches… don’t follow it straight. That’s bait.”"
            })
          );

          body.appendChild(
            el("p", {
              text:
                "The scribe finally meets your eyes. “If you want to push deep enough to find their leader, don’t go raw. Bitterleaf on the wrist. It dulls the forest’s itch — and the goblins’ dogs won’t like the scent.”"
            })
          );

          const actions = el("div", { className: "modal-actions" });
          actions.appendChild(
            el("button", {
              className: "btn small",
              text: "I’ll brew the salve.",
              onClick: () => {
                state.flags = state.flags || {};
                state.flags.ch1ScribeTrailsLearned = true;
                if (state.quests?.main) state.quests.main.step = Math.max(Number(state.quests.main.step) || 0, 0.75);

                addLog?.("The Bark‑Scribe teaches you to read goblin trail‑marks — and warns you about bait.", "system");
                addLog?.("He suggests Bitterleaf salve before you push deeper into Emberwood Forest.", "system");

	                // NOTE: Do NOT reference an undeclared identifier like `questSystem` inside an ES module.
	                // On iOS/WebKit this throws "Can't find variable" even with optional chaining.
	                // We rely on the injected hook from Main.js instead.
	                updateQuestBox?.(state);
                saveGame?.();
                closeModal?.();

                setScene?.(
                  "Bark‑Scribe’s Advice",
                  [
                    "Trail‑marks can be bait as well as guidance.",
                    "Bitterleaf salve may keep the forest — and the goblins’ dogs — from finding you first."
                  ].join("\n")
                );
              }
            })
          );
          actions.appendChild(
            el("button", {
              className: "btn small outline",
              text: "Leave",
              onClick: () => closeModal?.()
            })
          );
          body.appendChild(actions);
        });
      }
    });

    addCard({
      title: "The Bark‑Scribe",
      rightTag: "Main Quest",
      desc: "Rowan said to find ink before steel. Ask about goblin marks and safer trails.",
      actions: [speakBtn]
    });
  }

  // Bark‑Scribe: advances the main quest into Chapter II
  if (mainQuest && mainQuest.step === 9 && !state?.flags?.barkScribeMet) {
    const speakBtn = el("button", {
      className: "btn small",
      text: "Speak",
      onClick: () => {
        openModal?.("The Bark‑Scribe", (body) => {
          body.appendChild(
            el("p", {
              className: "modal-subtitle",
              text:
                "A man sits where the firelight can’t quite reach. His fingers are stained with ink and sap. He does not look up when you approach—only listens."
            })
          );

          body.appendChild(
            el("p", {
              text:
                "“Rowan sends everyone eventually,” he says. “You cut down a king and think you ended a story. But stories are forests. You only cleared one tree.”"
            })
          );

          body.appendChild(
            el("p", {
              text:
                "He slides a thin book across the table. Its pages are bark—real bark—pressed flat. The writing isn’t ink. It’s scorched."
            })
          );

          body.appendChild(
            el("p", {
              text:
                "“The Blackbark Oath wasn’t a promise to the village,” he continues. “It was a promise to the thing beneath it. The Wardens fed it. They starved it. They kept it asleep.”"
            })
          );

          body.appendChild(
            el("p", {
              text:
                "“Now it’s awake enough to notice you.” He taps three symbols—sap, reed, bone. “Bring me three splinters of what the oath was built from. The forest will not let you take them gently, but it will let you take them.”"
            })
          );

          const actions = el("div", { className: "modal-actions" });

          actions.appendChild(
            el("button", {
              className: "btn small",
              text: "I’ll do it.",
              onClick: () => {
                state.flags = state.flags || {};
                state.flags.barkScribeMet = true;
                if (state.quests?.main) state.quests.main.step = Math.max(state.quests.main.step || 0, 10);

                addLog?.("The Bark‑Scribe marks three symbols: Sap‑Run, Witch‑Reed, Bone‑Char.", "system");

                // Offer an immediate side quest hook
                if (typeof startSideQuest === "function") startSideQuest("barkThatBleeds");

                updateQuestBox?.();
                saveGame?.();
                closeModal?.();

                // Optional: set a scene beat, if provided
                setScene?.(
                  "Bark‑Scribe’s Warning",
                  [
                    "“Remember,” the scribe murmurs, “oaths don’t care if you’re brave.”",
                    "“They care if you’re useful.”"
                  ].join("\n")
                );
              }
            })
          );

          actions.appendChild(
            el("button", {
              className: "btn small outline",
              text: "Leave",
              onClick: () => closeModal?.()
            })
          );

          body.appendChild(actions);
        });
      }
    });

    addCard({
      title: "A Figure in the Shadows",
      rightTag: "Main Quest",
      desc: "Rowan’s contact waits here—the Bark‑Scribe.",
      actions: [speakBtn]
    });
  }


  // Bark‑Scribe: binding lesson after collecting all three Oath‑Splinters (Step 10.5)
  // This lengthens Chapter II pacing and unlocks the Oathgrove incursion.
  if (mainQuest && Number(mainQuest.step) === 10.5 && !state?.flags?.chapter2SplinterBindingDone) {
    const speakBtn = el("button", {
      className: "btn small",
      text: "Show the splinters",
      onClick: () => {
        openModal?.("Quiet Ink", (body) => {
          body.appendChild(
            el("p", {
              className: "modal-subtitle",
              text:
                "The Bark‑Scribe lays three splinters on bark‑paper. They don’t touch. They lean away from each other like magnets."
            })
          );

          body.appendChild(
            el("p", {
              text:
                "“Good,” he says. “They still remember being separate. That means the oath is still alive enough to argue.”"
            })
          );

          body.appendChild(
            el("p", {
              text:
                "He crushes a bead of tar‑black resin between thumb and nail. It drinks the hearth‑light. “Quiet Ink. It doesn’t write what you say. It writes what you meant.”"
            })
          );

          body.appendChild(
            el("p", {
              text:
                "“We can bind the splinters so they stop pulling apart,” he continues. “But the ink is guarded. The Oathgrove is where the old vows were fed. Something there still thinks it owns the right to keep score.”"
            })
          );

          const actions = el("div", { className: "modal-actions" });
          actions.appendChild(
            el("button", {
              className: "btn small",
              text: "I’ll take the ink",
              onClick: () => {
                state.flags = state.flags || {};
                state.flags.chapter2SplinterBindingDone = true;
                state.flags.oathgroveUnlocked = true;
                if (state.quests?.main) state.quests.main.step = Math.max(Number(state.quests.main.step) || 0, 10.75);

                addLog?.("The Bark‑Scribe teaches you Quiet Ink — and sends you to the Oathgrove.", "system");
                addLog?.("Harvest resin from Rootcrown cultists, then break the Sapbound Warden.", "system");

                updateQuestBox?.();
                saveGame?.();
                closeModal?.();

                setScene?.(
                  "Oathgrove Unsealed",
                  [
                    "The splinters hum in answer to the scribe’s ink.",
                    "Somewhere in the deepwood, something old lifts its head."
                  ].join("\n")
                );
              }
            })
          );

          actions.appendChild(
            el("button", {
              className: "btn small outline",
              text: "Leave",
              onClick: () => closeModal?.()
            })
          );

          body.appendChild(actions);
        });
      }
    });

    addCard({
      title: "The Bark‑Scribe’s Next Lesson",
      rightTag: "Main Quest",
      desc: "The three splinters resonate together. The Bark‑Scribe can bind them — if you fetch Quiet Ink from the Oathgrove.",
      actions: [speakBtn]
    });
  }


  // Bark‑Scribe: decodes the Crown‑Echo (Chapter III)
  if (mainQuest && mainQuest.step === 17 && state?.flags?.chapter3CrownEchoTaken && !state?.flags?.chapter3CrownEchoDecoded) {
    const speakBtn = el("button", {
      className: "btn small",
      text: "Show the Crown‑Echo",
      onClick: () => {
        openModal?.("Ink Against a Memory", (body) => {
          body.appendChild(
            el("p", {
              className: "modal-subtitle",
              text: "The Bark‑Scribe does not flinch when the Crown‑Echo chills the table. He only wets his pen, as if the cold is another kind of ink."
            })
          );

          body.appendChild(
            el("p", {
              text:
                "“This is not a relic,” he murmurs. “It’s a verdict. Someone tried to crown the wound—and the forest remembered the weight.”"
            })
          );

          body.appendChild(
            el("p", {
              text:
                "He sketches a triangle of symbols: iron, grave, name. “If you want to speak to what’s coming, you need three anchors. A Star‑Iron Pin to hold the words. A Grave‑Latch to hold the door. And a living voice willing to be blamed.”"
            })
          );

          const actions = el("div", { className: "modal-actions" });
          actions.appendChild(
            el("button", {
              className: "btn small",
              text: "Tell me where",
              onClick: () => {
                state.flags = state.flags || {};
                state.flags.chapter3CrownEchoDecoded = true;
                state.flags.starfallRidgeUnlocked = true;
                if (state.quests?.main) state.quests.main.step = Math.max(Number(state.quests.main.step) || 0, 17.5);

                addLog?.("The Bark‑Scribe names the first anchor: star‑iron.", "system");
                addLog?.("Go to Starfall Ridge and gather Star‑Iron shards — then return to the Ruined Spire for the Pin.", "system");

                updateQuestBox?.();
                saveGame?.();
                closeModal?.();

                setScene?.(
                  "Three Anchors",
                  [
                    "Star‑iron must be harvested before the Pin can be taken.",
                    "A Grave‑Latch waits in the Sunken Catacombs.",
                    "Then you must decide who speaks for Emberwood at the gate."
                  ].join("\n")
                );
              }
            })
          );

          actions.appendChild(
            el("button", {
              className: "btn small outline",
              text: "Not yet",
              onClick: () => closeModal?.()
            })
          );

          body.appendChild(actions);
        });
      }
    });

    addCard({
      title: "The Bark‑Scribe’s Next Lesson",
      rightTag: "Main Quest",
      desc: "You carry the Crown‑Echo. The Bark‑Scribe can name it—and tell you how to answer it.",
      actions: [speakBtn]
    });
  }

  // Turn‑ins: Bark That Bleeds / Hymn / Witch’s Apology
  const barkQ = sideState?.barkThatBleeds;
  if (barkQ && barkQ.status === "active" && barkQ.step >= 2 && state?.flags?.barkScribeMet) {
    addCard({
      title: "Return the Sap Sample",
      rightTag: "Quest Turn‑in",
      desc: "The Bark‑Scribe asked for black sap. You have it.",
      actions: [
        el("button", {
          className: "btn small",
          text: "Hand it over",
          onClick: () => {
            completeSideQuest?.("barkThatBleeds", () => {
              state.player.gold = (state.player.gold || 0) + 50;
              addLog?.("The Bark‑Scribe pays you quietly. The sap vanishes into his ink‑pots.", "good");
            });
            updateQuestBox?.();
            saveGame?.();
          scheduleRender();
          }
        })
      ]
    });
  }

  const hymnQ = sideState?.frostpeaksHymn;
  if (hymnQ && hymnQ.status === "active" && hymnQ.step >= 2) {
    addCard({
      title: "Sing the Lost Verse",
      rightTag: "Quest Turn‑in",
      desc: "You carry the hymn fragment back to the tavern singer.",
      actions: [
        el("button", {
          className: "btn small",
          text: "Return the verse",
          onClick: () => {
            completeSideQuest?.("frostpeaksHymn", () => {
              state.player.gold = (state.player.gold || 0) + 70;
              addLog?.("The singer’s voice steadies the room. For a moment, the tavern feels like a fortress.", "good");
            });
            updateQuestBox?.();
            saveGame?.();
          scheduleRender();
          }
        })
      ]
    });
  }

  const apologyQ = sideState?.witchsApology;
  if (apologyQ && apologyQ.status === "active" && apologyQ.step >= 2) {
    addCard({
      title: "Brew the Unbinding Draught",
      rightTag: "Quest Turn‑in",
      desc: "You have enough reagents to make the draught.",
      actions: [
        el("button", {
          className: "btn small",
          text: "Brew",
          onClick: () => {
            completeSideQuest?.("witchsApology", () => {
              state.player.gold = (state.player.gold || 0) + 60;
              addLog?.("The draught steams. The marsh’s anger has a shape—and you bottle it.", "good");
            });
            updateQuestBox?.();
            saveGame?.();
          scheduleRender();
          }
        })
      ]
    });
  }

  // Warden’s Gesture: give the player a clean way to complete the trio.
  const gestureQ = sideState?.wardensGesture;
  if (gestureQ && gestureQ.status === "active" && gestureQ.status !== "completed") {
    const f = state.flags || (state.flags = {});
    const mark = () => {
      updateQuestBox?.();
      saveGame?.();
      addLog?.("Warden gesture marked.", "system");
    scheduleRender();
    };
    const done = !!(f.wardenGestureMercy && f.wardenGestureRestraint && f.wardenGestureProtection);

    addCard({
      title: "The Warden’s Gesture",
      rightTag: done ? "Ready" : "In progress",
      desc:
        "Three small choices, not heroic ones: mercy, restraint, protection. The forest cares about the small choices.",
      actions: [
        el("button", {
          className: "btn small outline",
          text: f.wardenGestureMercy ? "Mercy ✓" : "Mercy",
          onClick: () => { f.wardenGestureMercy = true; mark(); }
        }),
        el("button", {
          className: "btn small outline",
          text: f.wardenGestureRestraint ? "Restraint ✓" : "Restraint",
          onClick: () => { f.wardenGestureRestraint = true; mark(); }
        }),
        el("button", {
          className: "btn small outline",
          text: f.wardenGestureProtection ? "Protection ✓" : "Protection",
          onClick: () => { f.wardenGestureProtection = true; mark(); }
        })
      ]
    });

    if (done && !f.wardenGesturesCompleted) {
      f.wardenGesturesCompleted = true;
      addLog?.("You complete the Warden’s Gesture. The forest will hear you if you try to rewrite the oath.", "good");
      completeSideQuest?.("wardensGesture", () => {});
      updateQuestBox?.();
      saveGame?.();
    scheduleRender();
    }
  }

  // Notice board: start additional side quests here.
  // UX goals:
  // - Collapsible by clicking the Notice Board header (no separate collapse button).
  // - Two-panel layout: list of notices (left) + selected notice details (right).
  // - Title + description at top of the details panel; Accept button at the bottom.
  // - Accepting a quest removes it from the board immediately (real-time).

  const ui = state.ui || (state.ui = {});
  ui.noticeBoardCollapsed = !!ui.noticeBoardCollapsed;

  const availableAll = Object.keys(sideDefs).filter((id) => isQuestAvailable(id));
  // Maintain a per-session ordering so accepting doesn't reshuffle randomly each open.
  if (!Array.isArray(ui.noticeBoardOrder) || ui.noticeBoardOrder.length === 0) {
    ui.noticeBoardOrder = availableAll.slice();
  } else {
    // Keep only those still available, and append any new ones.
    const still = ui.noticeBoardOrder.filter(id => availableAll.includes(id));
    const fresh = availableAll.filter(id => !still.includes(id));
    ui.noticeBoardOrder = still.concat(fresh);
  }

  let availableIds = ui.noticeBoardOrder.slice();
  let availableCount = availableIds.length;

  if (availableCount) {
    const card = addCard({
      title: "Notice Board",
      rightTag: "", // we replace meta with count + chevron
      desc: "Pinned requests and desperate handwriting. Choose what you’ll carry.",
      actions: []
    });
    card.classList.add("notice-board-card");

    const header = card.querySelector(".item-row-header");
    const meta = card.querySelector(".item-meta");
    const bodyTagline = card.querySelector(".modal-subtitle"); // the card description line

    // --- Header: count + chevron; click header toggles collapse ----------------
    const countSpan = el("span", { className: "notice-count", text: `${availableCount} available` });
    const chevron = el("span", { className: "notice-chevron", text: ui.noticeBoardCollapsed ? "▸" : "▾" });

    if (meta) {
      meta.textContent = "";
      meta.appendChild(countSpan);
      meta.appendChild(chevron);
    }

    const setCollapsed = (collapsed) => {
      ui.noticeBoardCollapsed = !!collapsed;
      card.classList.toggle("collapsed", ui.noticeBoardCollapsed);
      chevron.textContent = ui.noticeBoardCollapsed ? "▸" : "▾";
      saveGame?.();
    };

    if (header) {
      header.classList.add("notice-board-header");
      header.addEventListener("click", () => setCollapsed(!ui.noticeBoardCollapsed));
    }

    // --- Content grid (list + details) ---------------------------------------
    const content = el("div", { className: "notice-board-content" });

    const listPanel = el("div", { className: "notice-board-list" });
    const detailPanel = el("div", { className: "notice-board-detail" });

    // Selected notice id persists while the modal stays open.
    if (!ui.noticeBoardSelected || !availableIds.includes(ui.noticeBoardSelected)) {
      ui.noticeBoardSelected = availableIds[0] || "";
    }

    const getDef = (id) => sideDefs[id] || { name: id, steps: ["A job worth taking."] };

    const renderCount = () => {
      countSpan.textContent = `${availableCount} available`;
    };

    const renderEmpty = () => {
      listPanel.innerHTML = "";
      detailPanel.innerHTML = "";

      listPanel.appendChild(
        el("div", { className: "mini-empty", text: "No new notices right now." })
      );

      detailPanel.appendChild(
        el("div", {
          className: "notice-detail-empty",
          text: "Nothing is pinned at the moment. Check back after you travel or rest."
        })
      );
    };

    const renderList = () => {
      listPanel.innerHTML = "";

      if (availableCount <= 0) {
        renderEmpty();
        return;
      }

      for (const id of availableIds) {
        if (!isQuestAvailable(id)) continue;

        const def = getDef(id);
        const isSelected = id === ui.noticeBoardSelected;

        const row = el("div", {
          className: "notice-row" + (isSelected ? " selected" : ""),
          onClick: () => {
            ui.noticeBoardSelected = id;
            renderList();
            renderDetail();
          },
          children: [
            el("div", { className: "notice-row-title", text: def.name || id }),
            el("div", {
              className: "notice-row-sub",
              text: (def.steps && def.steps[0]) ? def.steps[0] : "A job worth taking."
            })
          ]
        });

        listPanel.appendChild(row);
      }

      // If everything got filtered out mid-session
      if (listPanel.children.length === 0) renderEmpty();
    };

    const renderDetail = () => {
      detailPanel.innerHTML = "";

      if (availableCount <= 0) {
        renderEmpty();
        return;
      }

      const id = ui.noticeBoardSelected;
      if (!id || !availableIds.includes(id) || !isQuestAvailable(id)) {
        ui.noticeBoardSelected = availableIds.find(isQuestAvailable) || "";
      }

      const activeId = ui.noticeBoardSelected;
      if (!activeId) {
        renderEmpty();
        return;
      }

      const def = getDef(activeId);

      // Title + description (top)
      detailPanel.appendChild(el("div", { className: "notice-detail-title", text: def.name || activeId }));
      detailPanel.appendChild(
        el("div", {
          className: "notice-detail-desc",
          text: def.description || (def.steps && def.steps[0]) || "A job worth taking."
        })
      );

      // Optional: show the next step hint if defined
      const stepHint = (def.steps && def.steps[0]) ? def.steps[0] : "";
      if (stepHint) {
        detailPanel.appendChild(el("div", { className: "notice-detail-hint", text: stepHint }));
      }

      // Accept button (bottom)
      const acceptBtn = el("button", {
        className: "btn small outline notice-accept",
        text: "Accept Quest",
        onClick: (ev) => {
          ev?.stopPropagation?.();

          startSideQuest?.(activeId);
          addLog?.("You accept: " + (def?.name || activeId), "system");
          updateQuestBox?.();
          saveGame?.();

          // Remove from available list immediately
          availableIds = availableIds.filter(x => x !== activeId);
          ui.noticeBoardOrder = availableIds.slice();
          availableCount = availableIds.length;

          // Select next available
          ui.noticeBoardSelected = availableIds.find(isQuestAvailable) || "";
          renderCount();

          if (availableCount <= 0) {
            renderEmpty();
          } else {
            renderList();
            renderDetail();
          }
        }
      });

      // Spacer pushes Accept to bottom
      detailPanel.appendChild(el("div", { className: "notice-detail-spacer" }));
      detailPanel.appendChild(acceptBtn);
    };

    // Build panels
    content.appendChild(listPanel);
    content.appendChild(detailPanel);
    card.appendChild(content);

    // Apply collapsed state
    card.classList.toggle("collapsed", ui.noticeBoardCollapsed);

    // Initial render
    renderCount();
    renderList();
    renderDetail();
  }

  // --- RUMORS ------------------------------------------------------------
      const rumorText = el("p", {
        className: "modal-subtitle",
        text: "Eavesdrop on patrons to learn what’s changing in Emberwood."
      });

      const rumorBtn = el("button", {
        className: "btn small outline",
        text: "Listen",
        onClick: () => {
          try { recordInput?.('tavern.rumor'); } catch (_) {}
          const pool = buildRumorPool(state, getVillageEconomySummary?.(state));
          const rumor = randChoice(pool) || "You overhear nothing useful—just laughter and half-finished stories.";
          rumorText.textContent = rumor;
          addLog?.("Tavern rumor: " + rumor, "system");
          saveGame?.();
        }
      });

      const rumorCard = addCard({
        title: "Listen for Rumors",
        rightTag: "Hints & world gossip",
        desc: "You pick up fragments of news between laughter, arguments, and clinking mugs.",
        actions: [rumorBtn]
      });
      rumorCard.appendChild(rumorText);

      // --- GAMES -------------------------------------------------------------
      addCard({
        title: "Tavern Games",
        rightTag: "Gamble for gold",
        desc: "Join dice and card games with the locals. You might win a purse of coin… or lose your last copper.",
        actions: [
          el("button", {
            className: "btn small outline",
            text: "Play Tavern Games",
            onClick: () => {
              try { recordInput?.('tavern.games'); } catch (_) {}
              closeModal?.();
              if (typeof openGambleModal === "function") openGambleModal();
            }
          })
        ]
      });

      body.appendChild(
        el("p", {
          className: "modal-subtitle",
          text: "The tavern is a safe place to regroup, gather information, and test your luck between journeys."
        })
      );
  
    };
    renderTavern();
});
}