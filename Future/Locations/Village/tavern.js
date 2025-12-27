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

/** @typedef {{
 *  state: any,
 *  openModal: (title: string, builder: (body: HTMLElement) => void) => void,
 *  addLog: (text: string, type?: string) => void,
 *  getVillageEconomySummary: (state: any) => any,
 *  getRestCost: (state: any) => number,
 *  handleEconomyAfterPurchase: (state: any, goldSpent: number, context?: string) => void,
 *  jumpToNextMorning: (state: any) => any,
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
  return arr[Math.floor(Math.random() * arr.length)];
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

function removeLeakedTavernFooter(modalBody) {
  const modalPanel = modalBody?.parentElement;
  if (!modalPanel) return;
  modalPanel.querySelectorAll(".tavern-footer-actions").forEach(n => n.remove());
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
    getVillageEconomySummary,
    getRestCost,
    handleEconomyAfterPurchase,
    jumpToNextMorning,
    updateHUD,
    updateTimeDisplay,
    saveGame,
    closeModal,
    openGambleModal
  } = deps;

  const player = state?.player;
  if (!player || typeof openModal !== "function") return;

  const econSummary = getVillageEconomySummary?.(state);
  const tier = econSummary?.tier;

  openModal("Emberwood Tavern", body => {
    body.innerHTML = "";
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
        const cost = getRestCost?.(state) ?? 0;

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
        const newTime = typeof jumpToNextMorning === "function" ? jumpToNextMorning(state) : null;
        const absoluteDay = newTime?.absoluteDay;

        runDayTicks(deps, absoluteDay);

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
        closeModal?.();
      }
    });

    restBtn.disabled = Number(player.gold) < Number(initialRestCost);

    addCard({
      title: "Rent a Room",
      rightTag: formatGoldTag(initialRestCost),
      desc: "Rest until morning, fully restoring health and class resources while washing away most wounds.",
      actions: [restBtn]
    });

    // --- RUMORS ------------------------------------------------------------
    const rumorText = el("p", {
      className: "modal-subtitle",
      text: "Eavesdrop on patrons to learn what’s changing in Emberwood."
    });

    const rumorBtn = el("button", {
      className: "btn small outline",
      text: "Listen",
      onClick: () => {
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
  });
}
