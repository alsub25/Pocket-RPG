// js/game/quests/questSystem.js
// Quest state + progression logic.
//
// This module keeps quest code out of engine.js. It is intentionally written as
// pure-ish functions that operate on a provided `state` object and a small set
// of injected UI/gameplay hooks (see questBindings.js).
import { QUEST_DEFS } from './questDefs.js';
import { createDefaultQuestFlags, createDefaultQuestState } from './questDefaults.js';
import { rngFloat, rngPick } from '../systems/rng.js';
function applyMissingDefaults(target, defaults) {
    for (const [k, v] of Object.entries(defaults)) {
        if (typeof target[k] === 'undefined')
            target[k] = v;
    }
}
export function ensureQuestStructures(state) {
    if (!state)
        return;
    if (!state.quests)
        state.quests = createDefaultQuestState();
    if (!state.quests.main)
        state.quests.main = null;
    if (!state.quests.side)
        state.quests.side = {};
    if (!state.flags)
        state.flags = {};
    // Backfill quest-related flags for old saves
    applyMissingDefaults(state.flags, createDefaultQuestFlags());
    // Backfill: if a save already has a main quest in progress, treat it as accepted.
    try {
        const q0 = state?.quests?.main;
        const f0 = state?.flags;
        if (q0 && f0 && !f0.mainQuestAccepted) {
            f0.mainQuestAccepted = true;
        }
    }
    catch (_) {
        // ignore
    }
    // Patch 1.2.5: Chapter III (The Hollow Crown) back-compat.
    // Older saves may have Chapter II marked as completed. We reopen the main quest
    // at step 15 so the story can continue without requiring a new run.
    try {
        const q = state?.quests?.main;
        const f = state?.flags;
        if (q && String(q.status) === 'completed' && f && f.blackbarkChoiceMade && !f.chapter3Started) {
            q.status = 'active';
            q.step = Math.max(Number.isFinite(q.step) ? q.step : 0, 15);
            f.chapter3Started = true;
            f.chapter3IntroQueued = true;
        }
    }
    catch (_) {
        // ignore
    }
    // Patch 1.2.5: Chapter IV (The Rootbound Court) back-compat.
    // Earlier 1.2.42 builds could mark the main quest completed at the end of
    // Chapter III. If that happened, reopen at Chapter IV so the story can
    // continue without forcing a new save.
    try {
        const q = state?.quests?.main;
        const f = state?.flags;
        if (q && String(q.status) === 'completed' && f && f.chapter3FinalChoiceMade && !f.chapter4Started) {
            q.status = 'active';
            q.step = Math.max(Number.isFinite(q.step) ? q.step : 0, 23);
            f.chapter4Started = true;
            f.chapter4IntroQueued = true;
        }
    }
    catch (_) {
        // ignore
    }
}
export function initMainQuest(state) {
    ensureQuestStructures(state);
    if (state && state.flags) {
        state.flags.mainQuestAccepted = true;
    }
    state.quests.main = {
        id: 'main',
        name: 'Shadows over Emberwood',
        step: 0,
        status: 'active'
    };
}
export function openElderRowanDialog(state, api = {}) {
    ensureQuestStructures(state);
    const flags = state.flags || {};
    const mainQuest = state.quests.main;
    const openModal = api.openModal;
    const closeModal = api.closeModal;
    const makeActionButton = api.makeActionButton;
    const setScene = api.setScene;
    const addLog = api.addLog;
    const saveGame = api.saveGame;
    const updateHUD = api.updateHUD;
    const accepted = !!flags.mainQuestAccepted;
    // If we can't open a modal (very rare), just ensure the quest can be accepted via flags.
    if (typeof openModal !== 'function') {
        if (!accepted) {
            initMainQuest(state);
            flags.mainQuestAccepted = true;
            flags.metElder = true;
            if (state.quests && state.quests.main)
                state.quests.main.step = 0.25;
            updateQuestBox(state);
            saveGame && saveGame();
        }
        return;
    }
    const stepText = mainQuest && QUEST_DEFS.main.steps
        ? QUEST_DEFS.main.steps[mainQuest.step] || 'Quest objective unavailable.'
        : QUEST_DEFS.main.steps[0];
    openModal('Elder Rowan', (body) => {
        const lead = document.createElement('p');
        lead.className = 'modal-subtitle';
        lead.textContent = accepted
            ? 'Rowan watches the lantern flame like it might confess.'
            : 'The village elder waits behind a desk scarred by old maps and newer worries.';
        body.appendChild(lead);
        const story = document.createElement('div');
        story.style.whiteSpace = 'pre-line';
        story.style.fontSize = '0.86rem';
        story.style.lineHeight = '1.35';
        if (accepted) {
            story.textContent = [
                '“You’ve already stepped into it,” Rowan says quietly. “The forest does not forget footsteps.”',
                '',
                'Current task:',
                stepText
            ].join('\n');
        }
        else {
            story.textContent = [
                'Rowan gestures to a crude map of Emberwood Forest. Red marks cluster where the trails narrow.',
                '',
                '“Caravans vanish. Hunters come back lighter — if they come back at all.”',
                'He meets your eyes.',
                '',
                '“I won’t order you. I’m asking.”'
            ].join('\n');
        }
        body.appendChild(story);
        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        if (!accepted) {
            const acceptBtn = makeActionButton
                ? makeActionButton('Accept the task', () => { }, '')
                : document.createElement('button');
            if (!makeActionButton) {
                acceptBtn.className = 'btn';
                acceptBtn.textContent = 'Accept the task';
            }
            acceptBtn.addEventListener('click', () => {
                initMainQuest(state);
                flags.mainQuestAccepted = true;
                flags.metElder = true;
                const q = state.quests && state.quests.main ? state.quests.main : null;
                if (q) {
                    q.status = 'active';
                    // Chapter I (expanded): start with an in-village beat before the forest arc.
                    q.step = Math.max(Number.isFinite(Number(q.step)) ? Number(q.step) : 0, 0.25);
                }
                setScene &&
                    setScene('Elder Rowan', [
                        'In a lantern‑lit hall, Elder Rowan lays out the truth: goblins have been taking what the village needs to last the winter.',
                        '',
                        'But he does not send you into the trees blind.',
                        '',
                        '“Speak with Captain Elara,” he says. “Then find the Bark‑Scribe at the tavern. Between steel and ink, you’ll learn which trail is theirs — and which trail is bait.”'
                    ].join('\n'));
                addLog && addLog('You accept Rowan’s request. He urges you to gather intel in the village before you go.', 'system');
                updateQuestBox(state);
                updateHUD && updateHUD();
                saveGame && saveGame();
                closeModal && closeModal();
            });
            const notNowBtn = makeActionButton
                ? makeActionButton('Not now', () => { }, 'outline')
                : document.createElement('button');
            if (!makeActionButton) {
                notNowBtn.className = 'btn outline';
                notNowBtn.textContent = 'Not now';
            }
            notNowBtn.addEventListener('click', () => {
                // You can meet Rowan without accepting the main quest.
                flags.metElder = true;
                addLog && addLog('You leave Rowan’s hall without taking the task.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
                closeModal && closeModal();
            });
            actions.appendChild(acceptBtn);
            actions.appendChild(notNowBtn);
        }
        else {
            const closeBtn = makeActionButton
                ? makeActionButton('Close', () => closeModal && closeModal(), '')
                : document.createElement('button');
            if (!makeActionButton) {
                closeBtn.className = 'btn';
                closeBtn.textContent = 'Close';
                closeBtn.addEventListener('click', () => closeModal && closeModal());
            }
            actions.appendChild(closeBtn);
        }
        body.appendChild(actions);
    });
}
export function getActiveSideQuests(state) {
    ensureQuestStructures(state);
    return Object.values(state.quests.side || {}).filter((q) => q && q.status === 'active');
}
export function getSideQuestStepText(q) {
    const def = q ? QUEST_DEFS.side[q.id] : null;
    if (!def)
        return q && q.status === 'active' ? 'Quest objective unavailable.' : '';
    const stepText = def.steps && def.steps[q.step];
    if (stepText)
        return stepText;
    return q && q.status === 'active' ? 'Quest objective unavailable.' : '';
}
export function hasAllOathSplinters(state) {
    const f = (state && state.flags) || {};
    return !!(f.oathShardSapRun && f.oathShardWitchReed && f.oathShardBoneChar);
}
// ---------------------------------------------------------------------------
// Objective helpers (kill/collect progress)
//
// Quest defs may optionally provide:
//   def.objectives = { [stepNumber]: [ { type, required, ... }, ... ] }
// We persist progress on the quest instance:
//   q.objectiveProgress = { "<step>:<idx>": number }
// ---------------------------------------------------------------------------
function _objKey(step, idx) {
    return String(step) + ':' + String(idx);
}
function _ensureObjectiveProgress(q) {
    if (!q)
        return;
    if (!q.objectiveProgress || typeof q.objectiveProgress !== 'object') {
        q.objectiveProgress = {};
    }
}
function _getObjectivesFor(def, step) {
    if (!def || !def.objectives)
        return null;
    const s = String(step);
    // allow numeric keys OR string keys
    return def.objectives[step] || def.objectives[s] || null;
}
function _objectiveCount(q, step, idx) {
    _ensureObjectiveProgress(q);
    const key = _objKey(step, idx);
    const v = Math.floor(Number(q.objectiveProgress[key] || 0));
    return Number.isFinite(v) && v > 0 ? v : 0;
}
function _setObjectiveCount(q, step, idx, next) {
    _ensureObjectiveProgress(q);
    const key = _objKey(step, idx);
    q.objectiveProgress[key] = Math.max(0, Math.floor(Number(next) || 0));
}
function _isObjectiveComplete(cur, required) {
    const req = Math.max(1, Math.floor(Number(required) || 1));
    return Math.floor(Number(cur) || 0) >= req;
}
function _areStepObjectivesComplete(q, def) {
    if (!q || !def)
        return true;
    const objs = _getObjectivesFor(def, q.step);
    if (!objs || !objs.length)
        return true;
    for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        const cur = _objectiveCount(q, q.step, i);
        if (!_isObjectiveComplete(cur, o.required))
            return false;
    }
    return true;
}
export function updateQuestBox(state) {
    ensureQuestStructures(state);
    // Patch 1.2.53d: Smoke tests and other cloned-save QA routines swap `state` while
    // sharing the same live DOM. If Quest Box rendering runs while a smoke suite is
    // active, it can overwrite the player's on-screen Quest Box (even though the
    // pinned quest remains correct in the save/journal).
    //
    // We treat Quest Box rendering as a UI-only side effect and skip it during
    // smoke-test runs.
    try {
        if (state && state.debug && state.debug.smokeTestRunning)
            return;
    }
    catch (_) { }
    // IMPORTANT: #questTitle contains a chevron span. Writing to .textContent
    // on the header will wipe child nodes (including the chevron). We write
    // into #questTitleText when present, and fall back safely if not.
    const qTitle = document.getElementById('questTitle');
    const qTitleText = document.getElementById('questTitleText');
    const qDesc = document.getElementById('questDesc');
    if (!qTitle || !qDesc)
        return;
    const mainQuest = state.quests.main;
    const activeSide = getActiveSideQuests(state);
    // Patch 1.2.5 (Journal + Pin): Quest Box only renders pinned quests.
    // If nothing is pinned, the Quest Box stays minimal and instructs the
    // player to pin a quest from the Journal.
    // Pinned quest support (Patch 1.2.5)
    // state.quests.pinned can be:
    //  - null
    //  - { kind: 'main' }
    //  - { kind: 'side', id: '<sideQuestId>' }
    //  - legacy string values ('main' or a side quest id)
    //
    // Design choice: the Quest Box only shows pinned quests.
    let mainForBox = null;
    let sideForBox = [];
    let hasValidPin = false;
    try {
        const pinRaw = state.quests ? state.quests.pinned : null;
        let pin = null;
        if (pinRaw && typeof pinRaw === 'object') {
            pin = pinRaw;
        }
        else if (typeof pinRaw === 'string' && pinRaw.trim()) {
            pin = pinRaw.trim().toLowerCase() === 'main' ? { kind: 'main' } : { kind: 'side', id: pinRaw.trim() };
        }
        if (pin && pin.kind === 'main') {
            if (mainQuest && String(mainQuest.status) === 'active') {
                mainForBox = mainQuest;
                sideForBox = [];
                hasValidPin = true;
            }
            else {
                state.quests.pinned = null;
            }
        }
        else if (pin && pin.kind === 'side') {
            const pinnedSide = (activeSide || []).find((q) => q && q.id === pin.id && String(q.status) === 'active');
            if (pinnedSide) {
                mainForBox = null;
                sideForBox = [pinnedSide];
                hasValidPin = true;
            }
            else {
                state.quests.pinned = null;
            }
        }
    }
    catch (_) {
        // ignore pin failures
    }
    if (!mainForBox && sideForBox.length === 0) {
        if (qTitleText)
            qTitleText.textContent = 'Quests';
        else
            qTitle.textContent = 'Quests';
        const f = state && state.flags ? state.flags : {};
        const anyActive = (mainQuest && String(mainQuest.status) === 'active') || (Array.isArray(activeSide) && activeSide.length > 0);
        if (!f.mainQuestAccepted) {
            // NOTE: Use explicit \n so this file parses correctly in all browsers.
            qDesc.textContent =
                'No active quests.\n\nMain Quest available: Speak with Elder Rowan in Emberwood Village.';
        }
        else if (anyActive && !hasValidPin) {
            // The player has quests, but hasn't pinned one.
            // Keep the Quest Box clean and point them at the Journal.
            qDesc.textContent = 'No pinned quest.\n\nOpen the Journal to pin a quest and show it here.';
        }
        else {
            qDesc.textContent = 'No active quests.';
        }
        return;
    }
    const lines = [];
    // If a quest is pinned, show a small header.
    if (hasValidPin)
        lines.push('Pinned Quest');
    if (mainForBox) {
        const stepLine = (QUEST_DEFS.main.steps && QUEST_DEFS.main.steps[mainForBox.step]) ||
            'Quest objective unavailable.';
        const mainHeader = 'Main Quest – ' +
            (mainForBox.name || QUEST_DEFS.main.name || 'Main Quest');
        lines.push(mainHeader);
        if (mainForBox.status === 'completed') {
            lines.push('Completed.');
        }
        else {
            lines.push(stepLine);
            // Interactive objectives (optional)
            const objs = _getObjectivesFor(QUEST_DEFS.main, mainForBox.step);
            if (objs && objs.length) {
                _ensureObjectiveProgress(mainForBox);
                objs.forEach((o, idx) => {
                    const cur = _objectiveCount(mainForBox, mainForBox.step, idx);
                    const req = Math.max(1, Math.floor(Number(o.required) || 1));
                    const done = _isObjectiveComplete(cur, req);
                    const label = o.label || (o.type === 'kill' ? 'Defeat enemies' : 'Collect items');
                    lines.push('  ◦ ' + label + ' (' + Math.min(cur, req) + '/' + req + ')' + (done ? ' ✓' : ''));
                });
            }
        }
    }
    if (sideForBox.length > 0) {
        lines.push('');
        lines.push('Side Quests – ' + sideForBox.length + ' active');
        sideForBox.slice(0, 3).forEach((q) => {
            const stepText = getSideQuestStepText(q);
            const def = q && q.id ? QUEST_DEFS.side[q.id] : null;
            const objs = def ? _getObjectivesFor(def, q.step) : null;
            let suffix = '';
            if (objs && objs.length) {
                // Compact summary: show the first objective progress
                const cur0 = _objectiveCount(q, q.step, 0);
                const req0 = Math.max(1, Math.floor(Number(objs[0].required) || 1));
                suffix = ' (' + Math.min(cur0, req0) + '/' + req0 + ')';
            }
            lines.push('• ' + q.name + (stepText ? ' — ' + stepText : '') + suffix);
        });
        if (sideForBox.length > 3) {
            lines.push('• …and ' + (sideForBox.length - 3) + ' more');
        }
    }
    if (qTitleText)
        qTitleText.textContent = 'Quests';
    else
        qTitle.textContent = 'Quests';
    qDesc.textContent = lines.join('\n');
    // Patch 1.2.5: Journal badge intentionally disabled (per design).
}
// ---------------------------------------------------------------------------
// Quest Journal (Patch 1.2.5)
//
// A lightweight modal that lists active + completed quests, including
// objective progress. The game already has #questBox for quick reference;
// the journal is meant for “full” tracking.
// ---------------------------------------------------------------------------
export function openQuestJournal(state, api = {}) {
    ensureQuestStructures(state);
    const openModal = api.openModal;
    const closeModal = api.closeModal;
    const makeActionButton = api.makeActionButton;
    if (typeof openModal !== 'function')
        return;
    const mainQuest = state.quests && state.quests.main ? state.quests.main : null;
    const sideAll = Object.values((state.quests && state.quests.side) || {});
    const sideActive = sideAll.filter((q) => q && q.status === 'active');
    const sideCompleted = sideAll.filter((q) => q && q.status === 'completed');
    const mainActive = mainQuest && String(mainQuest.status) === 'active';
    const mainCompleted = mainQuest && String(mainQuest.status) === 'completed';
    const activeCount = (mainActive ? 1 : 0) + sideActive.length;
    const completedCount = (mainCompleted ? 1 : 0) + sideCompleted.length;
    openModal('Journal', (body) => {
        const meta = document.createElement('div');
        meta.className = 'qj-meta';
        meta.textContent =
            (activeCount ? activeCount + ' active' : 'No active quests') +
                ' • ' +
                (completedCount ? completedCount + ' completed' : '0 completed');
        body.appendChild(meta);
        // Pinned quest indicator
        try {
            const pinRaw = state.quests ? state.quests.pinned : null;
            let pin = null;
            if (pinRaw && typeof pinRaw === 'object')
                pin = pinRaw;
            else if (typeof pinRaw === 'string' && pinRaw.trim()) {
                pin = pinRaw.trim().toLowerCase() === 'main' ? { kind: 'main' } : { kind: 'side', id: pinRaw.trim() };
            }
            if (pin) {
                const p = document.createElement('div');
                p.className = 'qj-pinned';
                let label = '';
                if (pin.kind === 'main')
                    label = 'Pinned: Main Quest';
                else if (pin.kind === 'side') {
                    const q = ((state.quests && state.quests.side) || {})[pin.id];
                    label = 'Pinned: ' + (q && q.name ? q.name : pin.id);
                }
                p.textContent = label;
                body.appendChild(p);
            }
        }
        catch (_) { }
        const makeQuestDetails = ({ title, statusText, stepText, objectives, objectiveProgressLines, questKind, questId, questState }) => {
            const d = document.createElement('details');
            d.className = 'qj-details';
            const s = document.createElement('summary');
            s.className = 'qj-summary';
            const left = document.createElement('span');
            left.textContent = title;
            const right = document.createElement('span');
            right.className = 'qj-summary-right';
            right.textContent = statusText || '';
            s.appendChild(left);
            s.appendChild(right);
            d.appendChild(s);
            const inner = document.createElement('div');
            inner.className = 'qj-body';
            inner.textContent = stepText || '';
            d.appendChild(inner);
            if (objectives && objectives.length) {
                const ul = document.createElement('ul');
                ul.className = 'qj-objs';
                (objectiveProgressLines || []).forEach((line) => {
                    const li = document.createElement('li');
                    li.textContent = line;
                    ul.appendChild(li);
                });
                d.appendChild(ul);
            }
            // Quest Items (collect objectives)
            try {
                const inv = state && state.player && Array.isArray(state.player.inventory) ? state.player.inventory : [];
                const collectObjs = (objectives || []).filter((o) => o && o.type === 'collect' && o.itemId);
                if (collectObjs.length) {
                    const itemsWrap = document.createElement('div');
                    itemsWrap.className = 'qj-items';
                    const h = document.createElement('div');
                    h.className = 'qj-items-title';
                    h.textContent = 'Quest Items';
                    itemsWrap.appendChild(h);
                    const ulItems = document.createElement('ul');
                    ulItems.className = 'qj-items-list';
                    collectObjs.forEach((o, idx) => {
                        const li = document.createElement('li');
                        const itemId = o.itemId;
                        let name = itemId;
                        try {
                            const def = typeof api.getItemDef === 'function' ? api.getItemDef(itemId) : null;
                            if (def && def.name)
                                name = def.name;
                        }
                        catch (_) { }
                        const req = Math.max(1, Math.floor(Number(o.required) || 1));
                        let cur = 0;
                        try {
                            if (questState) {
                                _ensureObjectiveProgress(questState);
                                cur = _objectiveCount(questState, questState.step, (objectives || []).indexOf(o));
                            }
                        }
                        catch (_) { }
                        let have = 0;
                        try {
                            const it = inv.find((x) => x && x.id === itemId);
                            have = it ? Math.floor(Number(it.quantity) || 0) : 0;
                        }
                        catch (_) { }
                        const done = _isObjectiveComplete(cur, req);
                        li.textContent = name + ' (' + Math.min(cur, req) + '/' + req + ')' + (done ? ' ✓' : '') + (have ? ' • In pack: ' + have : '');
                        ulItems.appendChild(li);
                    });
                    itemsWrap.appendChild(ulItems);
                    d.appendChild(itemsWrap);
                }
            }
            catch (_) { }
            // Pin / unpin controls (active quests)
            try {
                const isActive = questState && String(questState.status) === 'active';
                if (isActive && (questKind === 'main' || questKind === 'side')) {
                    const pinRaw = state.quests ? state.quests.pinned : null;
                    let pin = null;
                    if (pinRaw && typeof pinRaw === 'object')
                        pin = pinRaw;
                    else if (typeof pinRaw === 'string' && pinRaw.trim()) {
                        pin = pinRaw.trim().toLowerCase() === 'main' ? { kind: 'main' } : { kind: 'side', id: pinRaw.trim() };
                    }
                    const pinned = (questKind === 'main' && pin && pin.kind === 'main') ||
                        (questKind === 'side' && pin && pin.kind === 'side' && pin.id === questId);
                    const btn = document.createElement('button');
                    btn.className = 'btn qj-pin-btn';
                    btn.type = 'button';
                    btn.textContent = pinned ? 'Unpin from Quest Box' : 'Pin to Quest Box';
                    btn.addEventListener('click', () => {
                        try {
                            if (!state.quests)
                                state.quests = createDefaultQuestState();
                            if (pinned)
                                state.quests.pinned = null;
                            else if (questKind === 'main')
                                state.quests.pinned = { kind: 'main' };
                            else
                                state.quests.pinned = { kind: 'side', id: questId };
                        }
                        catch (_) { }
                        try {
                            updateQuestBox(state);
                        }
                        catch (_) { }
                        try {
                            if (typeof api.saveGame === 'function')
                                api.saveGame();
                        }
                        catch (_) { }
                        try {
                            if (typeof closeModal === 'function')
                                closeModal();
                        }
                        catch (_) { }
                        // Re-open for instant UI refresh
                        try {
                            openQuestJournal(state, api);
                        }
                        catch (_) { }
                    });
                    d.appendChild(btn);
                }
            }
            catch (_) { }
            return d;
        };
        // --- Active --------------------------------------------------------
        const activeTitle = document.createElement('div');
        activeTitle.className = 'qj-section-title';
        activeTitle.textContent = 'Active';
        body.appendChild(activeTitle);
        let anyActive = false;
        if (mainActive) {
            anyActive = true;
            const stepText = (QUEST_DEFS.main.steps && QUEST_DEFS.main.steps[mainQuest.step]) ||
                'Quest objective unavailable.';
            const objs = _getObjectivesFor(QUEST_DEFS.main, mainQuest.step) || [];
            _ensureObjectiveProgress(mainQuest);
            const lines = objs.map((o, idx) => {
                const cur = _objectiveCount(mainQuest, mainQuest.step, idx);
                const req = Math.max(1, Math.floor(Number(o.required) || 1));
                const done = _isObjectiveComplete(cur, req);
                const label = o.label ||
                    (o.type === 'kill'
                        ? 'Defeat enemies'
                        : o.type === 'collect'
                            ? 'Collect items'
                            : 'Complete objective');
                return label + ' (' + Math.min(cur, req) + '/' + req + ')' + (done ? ' ✓' : '');
            });
            body.appendChild(makeQuestDetails({
                title: 'Main Quest — ' + (mainQuest.name || QUEST_DEFS.main.name || 'Main Quest'),
                statusText: 'Active',
                stepText,
                objectives: objs,
                objectiveProgressLines: lines,
                questKind: 'main',
                questId: 'main',
                questState: mainQuest
            }));
        }
        if (sideActive.length) {
            anyActive = true;
            sideActive
                .slice()
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                .forEach((q) => {
                const def = q && q.id ? QUEST_DEFS.side[q.id] : null;
                const stepText = getSideQuestStepText(q);
                const objs = def ? _getObjectivesFor(def, q.step) || [] : [];
                _ensureObjectiveProgress(q);
                const lines = objs.map((o, idx) => {
                    const cur = _objectiveCount(q, q.step, idx);
                    const req = Math.max(1, Math.floor(Number(o.required) || 1));
                    const done = _isObjectiveComplete(cur, req);
                    const label = o.label ||
                        (o.type === 'kill'
                            ? 'Defeat enemies'
                            : o.type === 'collect'
                                ? 'Collect items'
                                : 'Complete objective');
                    return label + ' (' + Math.min(cur, req) + '/' + req + ')' + (done ? ' ✓' : '');
                });
                body.appendChild(makeQuestDetails({
                    title: 'Side Quest — ' + (q.name || (def && def.name) || 'Side Quest'),
                    statusText: 'Active',
                    stepText,
                    objectives: objs,
                    objectiveProgressLines: lines,
                    questKind: 'side',
                    questId: q.id,
                    questState: q
                }));
            });
        }
        if (!anyActive) {
            const p = document.createElement('p');
            p.className = 'modal-subtitle';
            p.textContent = 'No active quests right now.';
            body.appendChild(p);
        }
        // --- Completed -----------------------------------------------------
        const doneTitle = document.createElement('div');
        doneTitle.className = 'qj-section-title';
        doneTitle.textContent = 'Completed';
        body.appendChild(doneTitle);
        let anyDone = false;
        if (mainCompleted) {
            anyDone = true;
            body.appendChild(makeQuestDetails({
                title: 'Main Quest — ' + (mainQuest.name || QUEST_DEFS.main.name || 'Main Quest'),
                statusText: 'Completed',
                stepText: 'Completed.',
                objectives: [],
                objectiveProgressLines: [],
                questKind: 'main',
                questId: 'main',
                questState: mainQuest
            }));
        }
        if (sideCompleted.length) {
            anyDone = true;
            sideCompleted
                .slice()
                .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
                .forEach((q) => {
                const def = q && q.id ? QUEST_DEFS.side[q.id] : null;
                body.appendChild(makeQuestDetails({
                    title: 'Side Quest — ' + (q.name || (def && def.name) || 'Side Quest'),
                    statusText: 'Completed',
                    stepText: 'Completed.',
                    objectives: [],
                    objectiveProgressLines: [],
                    questKind: 'side',
                    questId: q.id,
                    questState: q
                }));
            });
        }
        if (!anyDone) {
            const p = document.createElement('p');
            p.className = 'modal-subtitle';
            p.textContent = 'No completed quests yet.';
            body.appendChild(p);
        }
        // Footer close button for consistency (modal already has ✕ in header)
        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        const closeBtn = makeActionButton
            ? makeActionButton('Close', () => closeModal && closeModal(), 'outline')
            : document.createElement('button');
        if (!makeActionButton) {
            closeBtn.className = 'btn outline';
            closeBtn.textContent = 'Close';
            closeBtn.addEventListener('click', () => closeModal && closeModal());
        }
        actions.appendChild(closeBtn);
        body.appendChild(actions);
    });
}
export function startSideQuest(state, id, api = {}) {
    ensureQuestStructures(state);
    const def = QUEST_DEFS.side[id];
    if (!def)
        return;
    if (!state.quests.side[id]) {
        state.quests.side[id] = {
            id,
            name: def.name,
            status: 'active',
            step: 0
        };
        if (typeof api.addLog === 'function') {
            api.addLog('Quest started: ' + def.name, 'system');
        }
        updateQuestBox(state);
        if (typeof api.saveGame === 'function')
            api.saveGame();
    }
}
export function advanceSideQuest(state, id, nextStep, api = {}) {
    ensureQuestStructures(state);
    const q = state.quests.side[id];
    if (!q || q.status !== 'active')
        return;
    q.step = Math.max(q.step || 0, nextStep);
    if (typeof api.addLog === 'function') {
        api.addLog('Quest updated: ' + q.name, 'system');
    }
    updateQuestBox(state);
    if (typeof api.saveGame === 'function')
        api.saveGame();
}
export function completeSideQuest(state, id, rewardsFn, api = {}) {
    ensureQuestStructures(state);
    const q = state.quests.side[id];
    if (!q || q.status !== 'active')
        return;
    q.status = 'completed';
    if (typeof api.addLog === 'function') {
        api.addLog('Quest completed: ' + q.name, 'good');
    }
    try {
        if (typeof rewardsFn === 'function')
            rewardsFn();
    }
    catch (_) {
        // ignore reward errors
    }
    updateQuestBox(state);
    if (typeof api.saveGame === 'function')
        api.saveGame();
}
export function buildProgressionAuditReport(state, meta = {}) {
    try {
        ensureQuestStructures(state);
        const lines = [];
        const qMain = state?.quests?.main;
        const step = qMain && typeof qMain.step === 'number' ? Math.floor(qMain.step) : null;
        const status = qMain ? String(qMain.status || 'active') : 'none';
        const flags = state?.flags || {};
        lines.push('=== Progression Audit ===');
        if (meta.GAME_PATCH != null && meta.SAVE_SCHEMA != null) {
            lines.push(`Patch: ${meta.GAME_PATCH} (schema ${meta.SAVE_SCHEMA})`);
        }
        lines.push(`Area: ${state?.area || 'unknown'}`);
        lines.push(`Main Quest: ${qMain ? 'present' : 'missing'} | status=${status}${step != null ? ' | step=' + step : ''}`);
        lines.push('');
        lines.push('Unlocks:');
        const unlocks = [
            ['Ashen Marsh', !!flags.marshUnlocked],
            ['Frostpeak Pass', !!flags.frostpeakUnlocked],
            ['Sunken Catacombs', !!flags.catacombsUnlocked],
            ['Obsidian Keep', !!flags.keepUnlocked]
        ];
        unlocks.forEach(([name, on]) => lines.push(`- ${name}: ${on ? 'UNLOCKED' : 'locked'}`));
        lines.push('');
        lines.push('Boss Flags:');
        const bosses = [
            ['Goblin Warlord', !!flags.goblinBossDefeated],
            ['Void-Touched Dragon', !!flags.dragonDefeated],
            ['Marsh Witch', !!flags.marshWitchDefeated],
            ['Frostpeak Giant', !!flags.frostGiantDefeated],
            ['Sunken Lich', !!flags.lichDefeated],
            ['Obsidian King', !!flags.obsidianKingDefeated]
        ];
        bosses.forEach(([name, on]) => lines.push(`- ${name}: ${on ? 'defeated' : 'not defeated'}`));
        lines.push('');
        const warnings = [];
        if (step != null) {
            if (step >= 1 && !flags.metElder)
                warnings.push('Main step >= 1 but metElder=false (intro may not have fired).');
            if (step >= 2 && !flags.goblinBossDefeated)
                warnings.push('Main step >= 2 but goblinBossDefeated=false.');
            if (step >= 3 && !flags.dragonDefeated)
                warnings.push('Main step >= 3 but dragonDefeated=false.');
            if (step >= 4 && !flags.marshUnlocked)
                warnings.push('Main step >= 4 but marshUnlocked=false (travel gate mismatch).');
            if (step >= 5 && !flags.frostpeakUnlocked)
                warnings.push('Main step >= 5 but frostpeakUnlocked=false.');
            if (step >= 6 && !flags.catacombsUnlocked)
                warnings.push('Main step >= 6 but catacombsUnlocked=false.');
            if (step >= 7 && !flags.keepUnlocked)
                warnings.push('Main step >= 7 but keepUnlocked=false.');
            if (step >= 9 && !flags.barkScribeMet)
                warnings.push('Blackbark step >= 9 but barkScribeMet=false.');
            if (step >= 11 && !hasAllOathSplinters(state))
                warnings.push('Blackbark step >= 11 but not all oath splinters are collected.');
            if (step >= 12 && !flags.quietRootsTrialDone)
                warnings.push('Blackbark step >= 12 but quietRootsTrialDone=false.');
            if (step >= 13 && !flags.ashWardenMet)
                warnings.push('Blackbark step >= 13 but ashWardenMet=false.');
            if (step >= 14 && !flags.blackbarkGateFound)
                warnings.push('Blackbark step >= 14 but blackbarkGateFound=false.');
            if (status === 'completed' && !flags.blackbarkChoiceMade)
                warnings.push('Main quest completed but blackbarkChoiceMade=false.');
        }
        const side = state?.quests?.side || {};
        Object.values(side).forEach((q) => {
            if (!q || typeof q !== 'object')
                return;
            if (!q.id || !QUEST_DEFS.side[q.id])
                warnings.push(`Side quest '${q.id || 'unknown'}' is missing a definition.`);
            if (q.status === 'active' && (q.step == null || !Number.isFinite(Number(q.step))))
                warnings.push(`Side quest '${q.id}' has invalid step.`);
        });
        lines.push('Warnings:');
        if (!warnings.length)
            lines.push('- (none found)');
        else
            warnings.forEach((w) => lines.push('- ' + w));
        lines.push('');
        try {
            if (step != null && QUEST_DEFS.main?.steps && QUEST_DEFS.main.steps[step]) {
                lines.push('Current Main Objective:');
                lines.push('- ' + QUEST_DEFS.main.steps[step]);
            }
        }
        catch (_) { }
        return lines.join('\n');
    }
    catch (e) {
        return 'Audit failed: ' + (e && e.message ? e.message : String(e));
    }
}
export function maybeTriggerSideQuestEvent(state, areaId, api = {}) {
    ensureQuestStructures(state);
    const qs = state.quests.side || {};
    const p = state.player || { gold: 0 };
    const addLog = api.addLog;
    const setScene = api.setScene;
    const openModal = api.openModal;
    const makeActionButton = api.makeActionButton;
    const closeModal = api.closeModal;
    const startBattleWith = api.startBattleWith;
    const addItemToInventory = api.addItemToInventory;
    // Helper: complete in village (or tavern) with simple rewards
    const rewardGold = (amt) => {
        if (!amt)
            return;
        p.gold += amt;
        if (typeof addLog === 'function') {
            addLog('You receive ' + amt + ' gold.', 'good');
        }
    };
    // -----------------------------------------------------------------------
    // Whispers in the Grain
    // -----------------------------------------------------------------------
    const grain = qs.grainWhispers;
    if (grain && grain.status === 'active') {
        if (areaId === 'village' && grain.step === 0) {
            setScene('Whispers in the Grain', [
                'The storehouse keeper is pale and sweating.',
                '"We pulled a good harvest," she insists, "but the sacks keep… emptying."',
                '',
                'You find neat pin‑holes in the grain sacks, as if something small and clever has been feeding without leaving footprints.',
                '',
                'A tavernhand mentions seeing lantern‑glints beyond the palisade — not wolves, not men… something in between.'
            ].join('\n'));
            advanceSideQuest(state, 'grainWhispers', 1, api);
            return true;
        }
        if (areaId === 'forest' && grain.step === 1) {
            setScene('Outskirts – Spoiled Tracks', [
                'Near the road, you find a trail of spilled kernels leading into brush.',
                '',
                'The ground is alive with tiny scrapes — not claws, not boots.',
                'Just the nervous scratch of many small mouths.'
            ].join('\n'));
            advanceSideQuest(state, 'grainWhispers', 2, api);
            return true;
        }
        // While active, bias the forest toward goblin thief fights so objectives
        // can be completed reliably during testing.
        if (areaId === 'forest' && grain.step === 2) {
            const def = QUEST_DEFS.side.grainWhispers;
            if (!_areStepObjectivesComplete(grain, def) && rngFloat(state, 'quest.grainThief') < 0.45) {
                const pick = rngFloat(state, 'quest.grainThiefPick') < 0.75 ? 'goblinScout' : 'goblinArcher';
                setScene('Grain Thieves', 'Lantern-glints move between trunks. A goblin darts with a bulging pouch — then turns and bares teeth.');
                addLog && addLog('You catch goblin thieves in the brush!', 'danger');
                startBattleWith && startBattleWith(pick);
                return true;
            }
        }
        if (areaId === 'village' && grain.step === 2) {
            const def = QUEST_DEFS.side.grainWhispers;
            if (!_areStepObjectivesComplete(grain, def)) {
                const objs = _getObjectivesFor(def, grain.step) || [];
                const lines = [];
                objs.forEach((o, i) => {
                    const cur = _objectiveCount(grain, grain.step, i);
                    const req = Math.max(1, Math.floor(Number(o.required) || 1));
                    const label = o.label || 'Objective';
                    lines.push(label + ': ' + Math.min(cur, req) + '/' + req);
                });
                setScene('Grain – Not Yet Settled', 'The keeper’s eyes search your hands. You do not have enough proof yet.\n\n' + lines.join('\n'));
                addLog && addLog('You still need to recover more stolen grain.', 'system');
                updateQuestBox(state);
                return true;
            }
            setScene('Grain Settled', 'You return with proof enough to calm the panic. The storehouse keeper presses coins into your hand with shaking gratitude.');
            completeSideQuest(state, 'grainWhispers', () => {
                rewardGold(60);
                addItemToInventory && addItemToInventory('potionMana', 1);
            }, api);
            return true;
        }
    }
    // -----------------------------------------------------------------------
    // The Missing Runner
    // -----------------------------------------------------------------------
    const runner = qs.missingRunner;
    if (runner && runner.status === 'active') {
        if (areaId === 'forest' && runner.step === 0) {
            setScene('The Missing Runner', [
                'You find a torn strip of cloth snagged on a bramble — village weave.',
                '',
                'The prints in the mud are wrong — too neat, too recent. Someone staged this trail.',
                '',
                'Further in, you hear low voices: bandits on the old road, arguing over “what the runner carried.”'
            ].join('\n'));
            advanceSideQuest(state, 'missingRunner', 1, api);
            return true;
        }
        if (areaId === 'forest' && runner.step === 1 && !runner.banditAmbushStarted) {
            runner.banditAmbushStarted = true;
            setScene('Old Road – Bandit Ambush', 'You step onto the road and the brush explodes with movement. Bandits rush you — and one of them carries a satchel with a village clasp.');
            advanceSideQuest(state, 'missingRunner', 2, api);
            addLog && addLog('Bandits! Someone is profiting from the missing runner.', 'danger');
            startBattleWith && startBattleWith('bandit');
            return true;
        }
        // After the first ambush, continue surfacing bandits in the forest
        // until the objective is complete.
        if (areaId === 'forest' && runner.step === 2) {
            const def = QUEST_DEFS.side.missingRunner;
            if (!_areStepObjectivesComplete(runner, def) && rngFloat(state, 'quest.runnerBandit') < 0.35) {
                setScene('Old Road – Bandits', 'You hear boots on gravel and the jingle of stolen coin. The road is still not safe.');
                addLog && addLog('More bandits stalk the old road!', 'danger');
                startBattleWith && startBattleWith('bandit');
                return true;
            }
        }
        if (areaId === 'village' && runner.step === 2) {
            const def = QUEST_DEFS.side.missingRunner;
            if (!_areStepObjectivesComplete(runner, def)) {
                const objs = _getObjectivesFor(def, runner.step) || [];
                const lines = [];
                objs.forEach((o, i) => {
                    const cur = _objectiveCount(runner, runner.step, i);
                    const req = Math.max(1, Math.floor(Number(o.required) || 1));
                    const label = o.label || 'Objective';
                    lines.push(label + ': ' + Math.min(cur, req) + '/' + req);
                });
                setScene('Runner – Not Yet Found', 'The family waits for news. You still need to pry answers from the road.\n\n' + lines.join('\n'));
                addLog && addLog('You have not recovered the runner’s satchel yet.', 'system');
                updateQuestBox(state);
                return true;
            }
            setScene('Runner’s Satchel', 'You return with the satchel. The family doesn’t get answers, but they get something to hold — and sometimes that’s what keeps grief from turning into rage.');
            completeSideQuest(state, 'missingRunner', () => rewardGold(80), api);
            // Gesture: mercy (you returned it)
            state.flags.wardenGestureMercy = true;
            return true;
        }
    }
    // -----------------------------------------------------------------------
    // Bark That Bleeds
    // -----------------------------------------------------------------------
    const bark = qs.barkThatBleeds;
    if (bark && bark.status === 'active') {
        if (areaId === 'forest' && bark.step === 0) {
            setScene('Bark That Bleeds', [
                'You find the blackened tree the Bark‑Scribe described.',
                '',
                'Its bark flakes like old scabs. When you cut a shallow notch, sap wells up — dark, slow, and warm as if the tree is holding a secret close to its chest.',
                '',
                'You bottle the sample.'
            ].join('\n'));
            advanceSideQuest(state, 'barkThatBleeds', 2, api);
            return true;
        }
    }
    // -----------------------------------------------------------------------
    // Debt of the Hearth
    // -----------------------------------------------------------------------
    const debt = qs.debtOfTheHearth;
    if (debt && debt.status === 'active') {
        if (areaId === 'village' && debt.step === 0) {
            openModal &&
                openModal('Debt of the Hearth', (body) => {
                    const t = document.createElement('p');
                    t.className = 'modal-subtitle';
                    t.textContent =
                        'A tired parent asks for help paying a collector. You can pay 150 gold… or refuse.';
                    body.appendChild(t);
                    const wrap = document.createElement('div');
                    wrap.className = 'modal-actions';
                    body.appendChild(wrap);
                    const payBtn = makeActionButton('Pay (150g)', () => {
                        if (p.gold < 150) {
                            addLog && addLog('You do not have enough gold.', 'danger');
                            return;
                        }
                        p.gold -= 150;
                        addLog && addLog('You pay the debt. A hearth stays lit another season.', 'good');
                        state.flags.wardenGestureProtection = true;
                        completeSideQuest(state, 'debtOfTheHearth', () => addItemToInventory && addItemToInventory('potionMana', 1), api);
                        closeModal && closeModal();
                    });
                    const refuseBtn = makeActionButton('Refuse', () => {
                        addLog && addLog('You refuse. The collector smiles like a knife.', 'system');
                        state.flags.wardenGestureRestraint = true; // you chose not to take violence
                        completeSideQuest(state, 'debtOfTheHearth', () => rewardGold(20), api);
                        closeModal && closeModal();
                    });
                    wrap.appendChild(payBtn);
                    wrap.appendChild(refuseBtn);
                });
            advanceSideQuest(state, 'debtOfTheHearth', 1, api);
            return true;
        }
    }
    // -----------------------------------------------------------------------
    // Frostpeak’s Lost Hymn
    // -----------------------------------------------------------------------
    const hymn = qs.frostpeaksHymn;
    if (hymn && hymn.status === 'active') {
        if (areaId === 'frostpeak' && hymn.step === 0) {
            setScene('Frostpeak’s Lost Hymn', [
                'Wind scrapes the stones like a bow across a string.',
                'In a split boulder you find a scrap of parchment, ink‑bleached but stubborn.',
                '',
                'A single verse survives — enough for a singer to rebuild the rest.'
            ].join('\n'));
            advanceSideQuest(state, 'frostpeaksHymn', 2, api);
            return true;
        }
    }
    // -----------------------------------------------------------------------
    // The Witch’s Apology (simple 3‑reagent counter)
    // -----------------------------------------------------------------------
    const apology = qs.witchsApology;
    if (apology && apology.status === 'active') {
        if (areaId === 'marsh') {
            if (typeof apology.progress !== 'number')
                apology.progress = 0;
            if (apology.step === 0)
                apology.step = 1;
            if (apology.step === 1 && apology.progress < 3) {
                apology.progress += 1;
                setScene('Reagent Gathered', [
                    'You gather a foul-smelling reagent from the marsh.',
                    `Reagents collected: ${apology.progress}/3.`
                ].join('\n'));
                addLog && addLog('You gather a reagent for the witch’s apology.', 'system');
                updateQuestBox(state);
                api.saveGame && api.saveGame();
                if (apology.progress >= 3) {
                    apology.step = 2;
                    updateQuestBox(state);
                    api.saveGame && api.saveGame();
                }
                return true;
            }
        }
        if (areaId === 'village' && apology.step === 2) {
            setScene('Apology Delivered', 'You deliver the reagents. The witch does not forgive, but she does not curse you either. That is its own kind of mercy.');
            completeSideQuest(state, 'witchsApology', () => rewardGold(120), api);
            return true;
        }
    }
    // -----------------------------------------------------------------------
    // Hound of Old Roads
    // -----------------------------------------------------------------------
    const hound = qs.houndOfOldRoads;
    if (hound && hound.status === 'active') {
        if (areaId === 'forest' && hound.step === 0) {
            setScene('Hound of Old Roads', [
                'You spot a massive hound — too still, too patient.',
                '',
                'It stops, looks back at you once — and you feel an old promise tug like a leash.',
                '',
                'Then it vanishes between trees, leaving only the smell of rain on stone.'
            ].join('\n'));
            advanceSideQuest(state, 'houndOfOldRoads', 1, api);
            return true;
        }
        if (areaId === 'village' && hound.step === 1) {
            setScene('Old Roads', 'You report what you saw. The elders exchange glances that do not belong to ordinary stories.');
            completeSideQuest(state, 'houndOfOldRoads', () => rewardGold(75), api);
            return true;
        }
    }
    // -----------------------------------------------------------------------
    // A Crown Without a King (two shards + choice)
    // -----------------------------------------------------------------------
    const crown = qs.crownWithoutKing;
    if (crown && crown.status === 'active') {
        if (areaId === 'catacombs' && crown.step === 0) {
            setScene('Crown‑Shard', 'Half‑melted metal glints in the silt. It is shaped like authority — and it feels cold to hold.');
            advanceSideQuest(state, 'crownWithoutKing', 1, api);
            crown.found1 = true;
            return true;
        }
        if (areaId === 'keep' && crown.step <= 1 && !crown.found2) {
            setScene('Crown‑Shard', 'You pry a second shard from a cracked throne‑step. Power comes apart the way all brittle things do — suddenly.');
            crown.found2 = true;
            crown.step = 2;
            updateQuestBox(state);
            api.saveGame && api.saveGame();
            return true;
        }
        if (areaId === 'village' && crown.step === 2 && crown.found1 && crown.found2 && !crown.choiceMade) {
            openModal &&
                openModal('A Crown Without a King', (body) => {
                    const t = document.createElement('p');
                    t.className = 'modal-subtitle';
                    t.textContent =
                        'Two shards in your hand. One decision in your throat. Destroy them… or sell them.';
                    body.appendChild(t);
                    const wrap = document.createElement('div');
                    wrap.className = 'modal-actions';
                    body.appendChild(wrap);
                    wrap.appendChild(makeActionButton('Destroy', () => {
                        crown.choiceMade = true;
                        addLog && addLog('You destroy the shards. Some temptations end quietly.', 'good');
                        completeSideQuest(state, 'crownWithoutKing', () => rewardGold(60), api);
                        closeModal && closeModal();
                    }));
                    wrap.appendChild(makeActionButton('Sell', () => {
                        crown.choiceMade = true;
                        addLog && addLog('You sell the shards. Coin is lighter than conscience.', 'system');
                        completeSideQuest(state, 'crownWithoutKing', () => rewardGold(220), api);
                        closeModal && closeModal();
                    }));
                });
            return true;
        }
    }
    // -----------------------------------------------------------------------
    // Warden’s Gesture (completion computed from flags)
    // -----------------------------------------------------------------------
    const gesture = qs.wardensGesture;
    if (gesture && gesture.status === 'active') {
        const f = state.flags || {};
        const done = !!(f.wardenGestureMercy && f.wardenGestureRestraint && f.wardenGestureProtection);
        if (done && !f.wardenGesturesCompleted) {
            f.wardenGesturesCompleted = true;
            gesture.step = 2;
            updateQuestBox(state);
            api.saveGame && api.saveGame();
        }
    }
    return false;
}
export function handleExploreQuestBeats(state, areaId, api = {}) {
    ensureQuestStructures(state);
    const addLog = api.addLog;
    const setScene = api.setScene;
    const openModal = api.openModal;
    const makeActionButton = api.makeActionButton;
    const closeModal = api.closeModal;
    const saveGame = api.saveGame;
    const startBattleWith = api.startBattleWith;
    const recalcPlayerStats = api.recalcPlayerStats;
    const updateHUD = api.updateHUD;
    const mainQuest = state.quests.main;
    const flags = state.flags;
    const mainQuestAccepted = !!(flags && (flags.mainQuestAccepted || mainQuest));
    // --- VILLAGE ------------------------------------------------------------
    if (areaId === 'village') {
        // New Game: meeting Rowan and accepting the main quest is no longer automatic.
        // The player must explicitly accept via the Village menu (Elder Rowan).
        // Safety back-compat: if a save has accepted the quest but never set metElder, fix it here.
        if (flags.mainQuestAccepted && mainQuest && !flags.metElder) {
            flags.metElder = true;
            // Chapter I (expanded): accepted quests should begin at the in-village intel beat.
            mainQuest.step = Math.max(Number(mainQuest.step) || 0, 0.25);
            setScene('Elder Rowan', 'Rowan gives you a task — but not a blind one. He urges you to speak with Captain Elara and the Bark‑Scribe before you head into the forest.');
            addLog && addLog('You speak with Elder Rowan and accept the task.', 'system');
            updateQuestBox(state);
            saveGame && saveGame();
            return true;
        }
        // Chapter I (expanded): Captain Elara briefing (Step 0.25)
        if (mainQuestAccepted &&
            mainQuest &&
            mainQuest.status === 'active' &&
            Number(mainQuest.step) === 0.25 &&
            !flags.ch1CaptainBriefed) {
            flags.ch1CaptainBriefed = true;
            mainQuest.step = 0.5;
            setScene('Captain Elara', 'At the guard table, Captain Elara unrolls a torn ledger and points to the missing lines.');
            openModal &&
                openModal('Captain Elara', (body) => {
                    const lead = document.createElement('p');
                    lead.className = 'modal-subtitle';
                    lead.textContent = 'Steel has a memory. So does hunger.';
                    body.appendChild(lead);
                    const story = document.createElement('div');
                    story.style.whiteSpace = 'pre-line';
                    story.style.fontSize = '0.86rem';
                    story.style.lineHeight = '1.35';
                    story.textContent = [
                        'Elara taps the ledger with a gauntleted finger.',
                        '',
                        '“Two nights ago, they hit the road again,” she says. “Not just food. Blankets. Lamp‑oil. Bandages.”',
                        '',
                        'She flips the ledger. The back page is smeared with pitch, and crude symbols are pressed into it like stamps.',
                        '“That’s new. They’re organizing. Someone taught them to keep track.”',
                        '',
                        'Elara meets your eyes.',
                        '“Bring me proof you can follow. Trail‑marks. Tags. Anything with those stamps.”',
                        '',
                        '“And watch the snareline,” she adds. “They’ve been hanging hooks where the underbrush looks too clean.”'
                    ].join('\n');
                    body.appendChild(story);
                    const actions = document.createElement('div');
                    actions.className = 'modal-actions';
                    actions.appendChild(makeActionButton('Understood', () => closeModal && closeModal(), ''));
                    body.appendChild(actions);
                });
            addLog && addLog('Captain Elara warns: the goblins are keeping crude tallies. Find their marks.', 'system');
            updateQuestBox(state);
            saveGame && saveGame();
            return true;
        }
        // Chapter I: after the Goblin Warlord falls, Rowan delivers the next story beat.
        // This prevents the Spire arc from feeling like an abrupt jump.
        if (mainQuestAccepted &&
            mainQuest &&
            mainQuest.status === 'active' &&
            flags.goblinBossDefeated &&
            !flags.goblinRowanDebriefShown &&
            Number(mainQuest.step) >= 1.5 &&
            Number(mainQuest.step) < 2) {
            flags.goblinRowanDebriefShown = true;
            flags.goblinRowanDebriefPending = false;
            mainQuest.step = 2;
            setScene('Elder Rowan', 'Rowan hears the news in silence. Then he draws a circle of ash on the table, as if to show you where the world has started leaking.');
            openModal &&
                openModal('Rowan’s Counsel', (body) => {
                    const lead = document.createElement('p');
                    lead.className = 'modal-subtitle';
                    lead.textContent = 'A victory is a door. Rowan tells you what you opened.';
                    body.appendChild(lead);
                    const story = document.createElement('div');
                    story.style.whiteSpace = 'pre-line';
                    story.style.fontSize = '0.86rem';
                    story.style.lineHeight = '1.35';
                    story.textContent = [
                        'Rowan’s fingers trace the edge of your proof like he’s checking for heat.',
                        '',
                        '“Good,” he says — and it sounds like a warning.',
                        '',
                        '“That Warlord wasn’t the sickness. He was a symptom. Something older is pressing up from below the roots.”',
                        '',
                        'He draws a circle of ash and taps the center with a nail.',
                        '“The Ruined Spire used to be a watchtower for scholars who measured the dark between stars.”',
                        '“When they fled, they left their instruments behind… and the dark kept learning.”',
                        '',
                        'Rowan looks toward the forest as if it can hear him.',
                        '“If the Warlord fell and the air tasted like stone… then the Spire has started answering again.”',
                        '',
                        '“Go. Purge what nests there. Bring me proof — shards, relics, anything that doesn’t belong in living soil.”'
                    ].join('\n');
                    body.appendChild(story);
                    const actions = document.createElement('div');
                    actions.className = 'modal-actions';
                    actions.appendChild(makeActionButton('I’ll go to the Spire', () => closeModal && closeModal(), ''));
                    body.appendChild(actions);
                });
            addLog && addLog('Rowan sends you to the Ruined Spire. Something there is waking.', 'system');
            updateQuestBox(state);
            saveGame && saveGame();
            return true;
        }
        // Chapter III intro (queued from the Blackbark Gate choice)
        if (flags.chapter3IntroQueued && !flags.chapter3IntroShown) {
            flags.chapter3IntroQueued = false;
            flags.chapter3IntroShown = true;
            // Ensure we are on the Chapter III entry step
            if (mainQuest) {
                mainQuest.status = 'active';
                mainQuest.step = Math.max(mainQuest.step || 0, 15);
            }
            setScene('Chapter III: The Hollow Crown', 'A crown without a king has started walking through dreams. The council calls you to the Town Hall.');
            openModal &&
                openModal('Chapter III: The Hollow Crown', (body) => {
                    const lead = document.createElement('p');
                    lead.className = 'modal-subtitle';
                    lead.textContent =
                        'The forest did not end its story when you spoke at the gate. It only chose a new narrator.';
                    body.appendChild(lead);
                    const story = document.createElement('div');
                    story.style.whiteSpace = 'pre-line';
                    story.style.fontSize = '0.86rem';
                    story.style.lineHeight = '1.35';
                    const choice = flags.blackbarkChoice || null;
                    const line1 = choice === 'swear'
                        ? 'That night, the village sleeps heavier. Sap beads on doorframes like sweat, and the lanterns burn low but steady.'
                        : choice === 'break'
                            ? 'That night, the village sleeps lightly. Dogs whine at empty corners, and the wind keeps practicing your name.'
                            : 'That night, the village sleeps strangely. Dreams overlap like pages. You wake with words you do not remember writing.';
                    story.textContent = [
                        line1,
                        '',
                        'By morning, three things are true:',
                        '• Children hum a melody no one taught them.',
                        '• The old oak behind the hall has split—cleanly—like it was opened from the inside.',
                        '• The council has sent runners for you with ink still wet on the summons.',
                        '',
                        'Elder Rowan’s note is short:',
                        '“Town Hall. Now. Bring whatever you think can survive being listened to.”'
                    ].join('\n');
                    body.appendChild(story);
                    const actions = document.createElement('div');
                    actions.className = 'modal-actions';
                    actions.appendChild(makeActionButton('Understood', () => closeModal && closeModal(), ''));
                    body.appendChild(actions);
                });
            addLog && addLog('Chapter III begins: the Hollow Crown stirs. The Town Hall awaits.', 'system');
            updateQuestBox(state);
            saveGame && saveGame();
            return true;
        }
        // Chapter III: Choose who leads the ritual (Step 20)
        if (mainQuest && mainQuest.status !== 'completed' && mainQuest.step === 20 && !flags.chapter3RitualAllyChosen) {
            openModal &&
                openModal('The Ritual Question', (body) => {
                    const lead = document.createElement('p');
                    lead.className = 'modal-subtitle';
                    lead.textContent =
                        'The village wants an answer. The forest wants a price. Someone has to speak first.';
                    body.appendChild(lead);
                    const story = document.createElement('div');
                    story.style.whiteSpace = 'pre-line';
                    story.style.fontSize = '0.86rem';
                    story.style.lineHeight = '1.35';
                    const oath = flags.blackbarkChoice || null;
                    const opener = oath === 'swear'
                        ? 'Your vow holds — but it holds like a clenched fist.'
                        : oath === 'break'
                            ? 'Your refusal echoes — but echoes are invitations.'
                            : 'Your rewrite holds — but ink still needs a mouth to read it aloud.';
                    story.textContent = [
                        opener,
                        '',
                        'Rowan offers steadiness. The Bark‑Scribe offers precision. The Ash‑Warden offers fire.'
                    ].join('\n');
                    body.appendChild(story);
                    const actions = document.createElement('div');
                    actions.className = 'modal-actions';
                    const pick = (who) => {
                        flags.chapter3RitualAllyChosen = true;
                        flags.chapter3RitualAlly = who;
                        if (mainQuest)
                            mainQuest.step = 21;
                        addLog && addLog('You choose a ritual leader: ' + who.toUpperCase() + '.', 'system');
                        updateQuestBox(state);
                        saveGame && saveGame();
                        closeModal && closeModal();
                    };
                    actions.appendChild(makeActionButton('Rowan leads', () => pick('rowan'), ''));
                    if (flags.barkScribeMet) {
                        actions.appendChild(makeActionButton('Bark‑Scribe leads', () => pick('scribe'), ''));
                    }
                    if (flags.ashWardenMet) {
                        actions.appendChild(makeActionButton('Ash‑Warden leads', () => pick('ash'), ''));
                    }
                    actions.appendChild(makeActionButton('Not yet', () => closeModal && closeModal(), 'outline'));
                    body.appendChild(actions);
                });
            return true;
        }
        // Chapter III finale (Step 22): decide the village’s future
        if (mainQuest && mainQuest.step === 22 && flags.hollowRegentDefeated && !flags.chapter3FinalChoiceMade) {
            openModal &&
                openModal('After the Hollow Crown', (body) => {
                    const lead = document.createElement('p');
                    lead.className = 'modal-subtitle';
                    lead.textContent = 'The crown is gone. The space it occupied is not.';
                    body.appendChild(lead);
                    const story = document.createElement('div');
                    story.style.whiteSpace = 'pre-line';
                    story.style.fontSize = '0.86rem';
                    story.style.lineHeight = '1.35';
                    story.textContent = [
                        'In the quiet after battle, you can feel the village like a heartbeat behind you.',
                        'Somewhere deep, the roots consider what they learned from you.',
                        '',
                        'Whatever you do next becomes Emberwood’s new tradition.'
                    ].join('\n');
                    body.appendChild(story);
                    const actions = document.createElement('div');
                    actions.className = 'modal-actions';
                    const finish = (ending) => {
                        flags.chapter3FinalChoiceMade = true;
                        flags.chapter3Ending = ending;
                        // Chapter IV kickoff: do NOT mark the main quest completed.
                        // We queue the next chapter so the story can continue.
                        flags.chapter4Started = true;
                        flags.chapter4IntroQueued = true;
                        if (state.quests && state.quests.main) {
                            state.quests.main.status = 'active';
                            state.quests.main.step = Math.max(Number(state.quests.main.step) || 0, 23);
                        }
                        const bonus = ending === 'bargain' ? 220 : ending === 'seal' ? 260 : 300;
                        state.player.gold = (state.player.gold || 0) + bonus;
                        setScene('Emberwood Remade', ending === 'seal'
                            ? 'You seal the wound. The forest quiets — not kindly, but cleanly.'
                            : ending === 'bargain'
                                ? 'You strike a bargain. The forest is not your friend — but it recognizes your terms.'
                                : 'You burn the remnant. The forest recoils, and the village learns what power costs.');
                        addLog && addLog('Chapter III completed: The Hollow Crown. +' + bonus + ' gold.', 'good');
                        addLog && addLog('A new summons arrives. Chapter IV begins.', 'system');
                        updateQuestBox(state);
                        saveGame && saveGame();
                        closeModal && closeModal();
                    };
                    actions.appendChild(makeActionButton('Seal the wound', () => finish('seal'), ''));
                    actions.appendChild(makeActionButton('Bargain with it', () => finish('bargain'), ''));
                    actions.appendChild(makeActionButton('Burn what remains', () => finish('burn'), 'danger'));
                    body.appendChild(actions);
                });
            return true;
        }
        // Chapter IV intro (Step 23): Rootbound Court summons
        if (mainQuest &&
            mainQuest.status !== 'completed' &&
            (mainQuest.step === 23 || flags.chapter4IntroQueued) &&
            !flags.chapter4IntroShown) {
            flags.chapter4IntroQueued = false;
            flags.chapter4IntroShown = true;
            flags.chapter4Started = true;
            if (mainQuest) {
                mainQuest.status = 'active';
                mainQuest.step = Math.max(Number(mainQuest.step) || 0, 23);
            }
            setScene('Chapter IV: The Rootbound Court', 'A summons arrives written in bark‑grain and frost‑rime. The forest convenes a court — and it names you as witness and accused.');
            openModal &&
                openModal('Chapter IV: The Rootbound Court', (body) => {
                    const lead = document.createElement('p');
                    lead.className = 'modal-subtitle';
                    lead.textContent = 'Something old has decided your choices require paperwork.';
                    body.appendChild(lead);
                    const story = document.createElement('div');
                    story.style.whiteSpace = 'pre-line';
                    story.style.fontSize = '0.86rem';
                    story.style.lineHeight = '1.35';
                    const oath = flags.blackbarkChoice || null;
                    const crown = flags.chapter3Ending || null;
                    const opener = oath === 'swear'
                        ? 'Your vow tightens like a rope — and someone on the other end pulls.'
                        : oath === 'break'
                            ? 'Your refusal did not end the bargain. It only changed who is collecting.'
                            : 'Your rewrite held. Now the forest wants to see the signature.';
                    const crownLine = crown === 'seal'
                        ? 'You sealed the wound. The Court calls that “evidence of restraint.”'
                        : crown === 'bargain'
                            ? 'You bargained. The Court calls that “admission of jurisdiction.”'
                            : 'You burned the remnant. The Court calls that “contempt.”';
                    story.textContent = [
                        opener,
                        crownLine,
                        '',
                        'Elder Rowan’s hands shake as he reads the summons aloud. The words taste like sap and iron:',
                        '“Let the Rootbound Court convene. Let the records be complete. Let the verdict be spoken at the Gate.”',
                        '',
                        'To answer, you will need three writs and a lens that can make lies visible.'
                    ].join('\n');
                    body.appendChild(story);
                    const actions = document.createElement('div');
                    actions.className = 'modal-actions';
                    actions.appendChild(makeActionButton('Begin the hunt', () => {
                        if (mainQuest)
                            mainQuest.step = 24;
                        updateQuestBox(state);
                        saveGame && saveGame();
                        closeModal && closeModal();
                    }, ''));
                    body.appendChild(actions);
                });
            addLog && addLog('Chapter IV begins: the Rootbound Court convenes.', 'system');
            updateQuestBox(state);
            saveGame && saveGame();
            return true;
        }
        // Chapter IV finale (Step 30): answer the Court
        if (mainQuest && mainQuest.step === 30 && flags.chapter4MagistrateDefeated && !flags.chapter4FinalChoiceMade) {
            openModal &&
                openModal('The Rootbound Verdict', (body) => {
                    const lead = document.createElement('p');
                    lead.className = 'modal-subtitle';
                    lead.textContent = 'The Court has read your record. Now it demands your reply.';
                    body.appendChild(lead);
                    const story = document.createElement('div');
                    story.style.whiteSpace = 'pre-line';
                    story.style.fontSize = '0.86rem';
                    story.style.lineHeight = '1.35';
                    const ritual = flags.chapter3RitualAlly || null;
                    const ritualLine = ritual === 'scribe'
                        ? 'The Bark‑Scribe’s ink still stains your hands. The Court notices.'
                        : ritual === 'ash'
                            ? 'The Ash‑Warden’s fire still clings to your breath. The Court flinches.'
                            : 'Rowan’s steadiness is with you — a counterweight against roots and rage.';
                    story.textContent = [
                        ritualLine,
                        '',
                        'With the writs assembled, the Magistrate’s sigil can be used three ways:',
                        '• Accept the Court’s verdict — bind Emberwood to a strict peace.',
                        '• Defy the Court — break the chain and invite retaliation.',
                        '• Rewrite the verdict — forge a new law that the forest must obey.'
                    ].join('\n');
                    body.appendChild(story);
                    const actions = document.createElement('div');
                    actions.className = 'modal-actions';
                    const finish = (ending) => {
                        flags.chapter4FinalChoiceMade = true;
                        flags.chapter4Ending = ending;
                        // Small rewards + a persistent flavor bonus hook.
                        const bonus = ending === 'accept' ? 240 : ending === 'defy' ? 260 : 300;
                        state.player.gold = (state.player.gold || 0) + bonus;
                        // Keep the main quest active for future chapters.
                        if (mainQuest) {
                            mainQuest.status = 'active';
                            mainQuest.step = 31;
                        }
                        setScene('The Court Answered', ending === 'accept'
                            ? 'You accept the verdict. The forest tightens its rules — and the village learns to live inside them.'
                            : ending === 'defy'
                                ? 'You defy the verdict. The forest withdraws, nursing a grudge that will return with interest.'
                                : 'You rewrite the verdict. The forest resists — then, slowly, begins to read.');
                        addLog && addLog('Chapter IV completed: The Rootbound Court. +' + bonus + ' gold.', 'good');
                        updateQuestBox(state);
                        saveGame && saveGame();
                        closeModal && closeModal();
                    };
                    actions.appendChild(makeActionButton('Accept the verdict', () => finish('accept'), ''));
                    actions.appendChild(makeActionButton('Defy the Court', () => finish('defy'), 'danger'));
                    actions.appendChild(makeActionButton('Rewrite the verdict', () => finish('rewrite'), ''));
                    body.appendChild(actions);
                });
            return true;
        }
        // Side quest events tied to the village
        if (maybeTriggerSideQuestEvent(state, 'village', api))
            return true;
        // Before Goblin Warlord is dead: show this ONLY once as a hint
        if (mainQuestAccepted && !flags.goblinBossDefeated) {
            if (!flags.goblinWhisperShown) {
                addLog &&
                    addLog('The villagers whisper about goblins in Emberwood Forest. You can travel there any time using "Change Area".', 'system');
                flags.goblinWhisperShown = true;
                updateQuestBox(state);
                saveGame && saveGame();
            }
            return false;
        }
        // AFTER final boss is dead: Chapter II handoff (Step 7 → 9)
        // (Previously this jumped straight to Step 9; now it respects Steps 7–8.)
        if (flags.obsidianKingDefeated && !flags.blackbarkChapterStarted) {
            // Safety: ensure main quest is at the intended debrief step.
            if (mainQuest) {
                mainQuest.status = 'active';
                mainQuest.step = Math.max(Number(mainQuest.step) || 0, 7);
            }
            // Step 7: Rowan debrief
            if (mainQuest && mainQuest.step === 7 && !flags.rowanDebriefShown) {
                flags.rowanDebriefShown = true;
                mainQuest.step = 8;
                setScene('Elder Rowan', 'Rowan listens without blinking. When you finish, he reaches for an old cedar box — like he has been waiting to need it.');
                addLog && addLog('You return to Elder Rowan with proof the corruption was broken.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
                return true;
            }
            // Step 8: Reveal the Blackbark Oath (full beat)
            // Patch 1.2.5: Step 8.25 is a new village follow-up beat (Captain Elara)
            // that bridges Rowan's reveal into the Bark-Scribe tavern handoff.
            if (mainQuest && mainQuest.step === 8) {
                flags.epilogueShown = true;
                flags.blackbarkChapterStarted = true;
                // Advance into the new follow-up beat, not straight to the tavern.
                mainQuest.step = 8.25;
                setScene('The Blackbark Oath', 'Rowan reveals the Blackbark Oath — but Captain Elara insists you learn what the goblins are counting before you chase ink in the tavern.');
                openModal &&
                    openModal('Chapter II: The Blackbark Oath', (body) => {
                        const intro = document.createElement('p');
                        intro.className = 'modal-subtitle';
                        intro.textContent =
                            'Rowan does not celebrate. He speaks like a man handling a live ember.';
                        body.appendChild(intro);
                        const story = document.createElement('div');
                        story.style.whiteSpace = 'pre-line';
                        story.style.fontSize = '0.86rem';
                        story.style.lineHeight = '1.35';
                        story.textContent = [
                            'Elder Rowan does not celebrate. He studies you like a man reading smoke for weather.',
                            '',
                            '"You think you ended it," he says at last. "Heroes always do. Endings are easier than debts."',
                            '',
                            '"The Obsidian King was not a king. He was a cork — a black nail hammered into rotting wood."',
                            '"When you pulled him free, the realm took a breath… and the wound beneath it took one too."',
                            '',
                            'Rowan opens a cedar box you swear was not in the room a moment ago. Inside: a strip of bark, dark as old blood, etched with a vow.',
                            '',
                            'He speaks the words with the careful fear of a man handling a live ember:',
                            '“Let my life be the hinge. Let my name be the lock. Let the hungers starve behind me.”',
                            '',
                            '"That was the Blackbark Oath," Rowan whispers. "Wardens bound themselves to the heartwood beneath Emberwood — not to rule it, but to keep it sealed."',
                            '',
                            '"But oaths are living things. If no one feeds them, they don’t die."',
                            'His gaze lifts to you.',
                            '"They become hungry."',
                            '',
                            'He pushes the bark-strip toward you.',
                            '"Before you chase ink," Rowan adds, "hear the Captain. The goblins aren’t just raiding. They’re tallying."',
                            '',
                            '"Find Elara in the village. Learn what they count — and why."'
                        ].join('\n');
                        body.appendChild(story);
                        const actions = document.createElement('div');
                        actions.className = 'modal-actions';
                        actions.appendChild(makeActionButton('Continue', () => closeModal && closeModal(), ''));
                        body.appendChild(actions);
                    });
                addLog && addLog('Rowan reveals the Blackbark Oath — and urges you to speak with Captain Elara before you visit the Bark‑Scribe.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
                return true;
            }
            // Step 8.25: Captain Elara explains the goblin tallies.
            // This is a short, village-only story beat that leads into the tavern handoff.
            if (mainQuest && Number(mainQuest.step) === 8.25 && !flags.ch2ElaraTalliesShown) {
                flags.ch2ElaraTalliesShown = true;
                setScene('Tallies in the Dirt', 'Captain Elara shows you the goblins’ marks — and why the village fears being counted.');
                openModal &&
                    openModal('Captain Elara', (body) => {
                        const intro = document.createElement('p');
                        intro.className = 'modal-subtitle';
                        intro.textContent =
                            'Elara’s armor is scuffed like she has been wearing it to sleep. She doesn’t waste words — she spends them like arrows.';
                        body.appendChild(intro);
                        const story = document.createElement('div');
                        story.style.whiteSpace = 'pre-line';
                        story.style.fontSize = '0.86rem';
                        story.style.lineHeight = '1.35';
                        story.textContent = [
                            '“We’ve had raids before,” Elara says. “Steal a pig. Burn a fence. Run when we raise the bells.”',
                            '',
                            'She kneels and scrapes a boot-print in the dust, then presses three notches into the edge like teeth-marks.',
                            '',
                            '“This is new. They’re not just taking. They’re counting. House by house. Path by path.”',
                            '',
                            'She taps each notch with a knuckle.',
                            '“A tally is a promise. It means someone intends to come back — with enough bodies to collect what they marked.”',
                            '',
                            'Elara’s gaze flicks to the treeline.',
                            '“Rowan thinks ink will explain it. He’s probably right.”',
                            '“The Bark‑Scribe keeps old records — old debts.”',
                            '',
                            '“If the goblins learned to write their hunger down, it means they learned it from something that used to live here.”'
                        ].join('\n');
                        body.appendChild(story);
                        const actions = document.createElement('div');
                        actions.className = 'modal-actions';
                        actions.appendChild(makeActionButton('Go to the tavern', () => {
                            mainQuest.step = 9;
                            addLog && addLog('Elara warns: tallies are promises. Rowan’s contact waits in the tavern.', 'system');
                            updateQuestBox(state);
                            saveGame && saveGame();
                            closeModal && closeModal();
                        }, ''));
                        body.appendChild(actions);
                    });
                updateQuestBox(state);
                saveGame && saveGame();
                return true;
            }
        }
        // Quiet Roots Trial gate
        if (mainQuest &&
            mainQuest.step === 11 &&
            hasAllOathSplinters(state) &&
            !flags.quietRootsTrialDone) {
            flags.quietRootsTrialDone = true;
            mainQuest.step = 12;
            setScene('The Trial of Quiet Roots', [
                'You kneel. The three splinters warm in your palm.',
                'The tavern’s laughter outside becomes distant — like it belongs to someone else.',
                '',
                'The floorboards become soil.',
                'The air becomes rain that never fell.',
                '',
                'Roots curl around your wrist — not binding, not harming — judging.',
                '',
                'A voice that is not Rowan whispers:',
                '“Say the part you didn’t know you were saying.”',
                '',
                'And your mouth answers anyway:',
                '“Let my victories be compost. Let my pride become mulch.”',
                '',
                'The forest approves.',
                'That is not comfort.',
                'That is permission.'
            ].join('\n'));
            addLog && addLog('You endure the Quiet Roots Trial. The next lead waits in the depths.', 'system');
            updateQuestBox(state);
            saveGame && saveGame();
            return true;
        }
        // The final choice (Chapter II ending)
        if (mainQuest && mainQuest.step === 14 && !flags.blackbarkChoiceMade) {
            openModal &&
                openModal('The Blackbark Gate', (body) => {
                    const p = document.createElement('p');
                    p.className = 'modal-subtitle';
                    p.textContent =
                        'Three voices rise from the wood — Swear, Break, or Rewrite. The forest listens for what kind of person you become when something listens back.';
                    body.appendChild(p);
                    const wrap = document.createElement('div');
                    wrap.className = 'modal-actions';
                    body.appendChild(wrap);
                    const canRewrite = !!flags.wardenGesturesCompleted;
                    const choose = (choiceId) => {
                        flags.blackbarkChoiceMade = true;
                        flags.blackbarkChoice = choiceId;
                        addLog && addLog('You choose: ' + choiceId.toUpperCase() + ' the Blackbark Oath.', 'system');
                        // Small, visible stat shift (applied in recalcPlayerStats)
                        if (typeof recalcPlayerStats === 'function')
                            recalcPlayerStats();
                        if (typeof updateHUD === 'function')
                            updateHUD();
                        setScene('The Oath Answers', choiceId === 'swear'
                            ? 'You speak the oath aloud. The air stills. The forest does not forgive — but it allows.'
                            : choiceId === 'break'
                                ? 'You refuse the old vow. The gate exhales like a wound. Somewhere, something laughs — and something else takes note.'
                                : 'You rewrite the vow with your own words. The gate shudders… then settles, like a jaw unclenching.');
                        // Chapter II complete. Chapter III begins (Patch 1.2.5 story expansion).
                        if (state.quests && state.quests.main) {
                            state.quests.main.status = 'active';
                            state.quests.main.step = Math.max(state.quests.main.step || 0, 15);
                        }
                        flags.chapter3Started = true;
                        flags.chapter3IntroQueued = true;
                        const showEpilogue = !flags.blackbarkEpilogueShown;
                        flags.blackbarkEpilogueShown = true;
                        // Immediate reward
                        if (!flags.blackbarkQuestRewarded) {
                            flags.blackbarkQuestRewarded = true;
                            const reward = choiceId === 'rewrite' ? 250 : choiceId === 'swear' ? 200 : 180;
                            state.player.gold = (state.player.gold || 0) + reward;
                            addLog && addLog('Chapter II completed: The Blackbark Oath. You receive ' + reward + ' gold.', 'good');
                        }
                        else {
                            addLog && addLog('Chapter II completed: The Blackbark Oath.', 'good');
                        }
                        updateQuestBox(state);
                        saveGame && saveGame();
                        closeModal && closeModal();
                        if (showEpilogue) {
                            openModal &&
                                openModal('Epilogue: The Blackbark Oath', (body2) => {
                                    const lead = document.createElement('p');
                                    lead.className = 'modal-subtitle';
                                    lead.textContent =
                                        choiceId === 'swear'
                                            ? 'You bind yourself to an old promise — and the forest marks the bargain.'
                                            : choiceId === 'break'
                                                ? 'You deny the old vow — and the forest learns your name the hard way.'
                                                : 'You rewrite the vow — and the forest adjusts, as if relieved to be understood.';
                                    body2.appendChild(lead);
                                    const story = document.createElement('div');
                                    story.style.whiteSpace = 'pre-line';
                                    story.style.fontSize = '0.86rem';
                                    story.style.lineHeight = '1.35';
                                    story.textContent =
                                        choiceId === 'swear'
                                            ? [
                                                'The gate drinks your words.',
                                                '',
                                                'Sap beads along the seams of the wood like sweat.',
                                                'Not blood. Not quite.',
                                                '',
                                                'Somewhere below, something that has been starving for a long time stops scraping at the inside of its cage.',
                                                '',
                                                'Rowan does not smile when you return.',
                                                'He only nods, like a man who has watched a storm pass without taking the roof.',
                                                '',
                                                '“Then we live on borrowed peace,” he says.',
                                                '“And we learn what it costs.”'
                                            ].join('\n')
                                            : choiceId === 'break'
                                                ? [
                                                    'Your refusal lands like a stone in a deep well.',
                                                    '',
                                                    'The gate’s seam widens. Cold air spills out — not winter-cold, but the absence of seasons.',
                                                    '',
                                                    'In the distance, you hear a laugh that is not made for throats.',
                                                    '',
                                                    'When you return, Rowan’s hands tremble for the first time.',
                                                    '“Then it will come to bargain on its own,” he whispers.',
                                                    '',
                                                    'He looks at you as if measuring whether you are enough weapon for what’s waking up.'
                                                ].join('\n')
                                                : [
                                                    'You speak new words into old wood.',
                                                    '',
                                                    'The splinters in your pocket pulse — sap, reed, bone — and the gate shivers like a jaw unclenching.',
                                                    '',
                                                    'For a heartbeat the forest feels quiet. Not safe. Quiet.',
                                                    '',
                                                    'When you return, Rowan exhales a breath he didn’t know he was holding.',
                                                    '“Wardens bound themselves to keep it asleep,” he says.',
                                                    '“You just taught it how to listen.”',
                                                    '',
                                                    'Somewhere beneath Emberwood, a hunger turns its head.',
                                                    'Not toward the village…',
                                                    'Toward you.'
                                                ].join('\n');
                                    body2.appendChild(story);
                                    const actions = document.createElement('div');
                                    actions.className = 'modal-actions';
                                    actions.appendChild(makeActionButton('Continue', () => closeModal && closeModal(), ''));
                                    body2.appendChild(actions);
                                });
                        }
                    };
                    wrap.appendChild(makeActionButton('Swear', () => choose('swear'), ''));
                    wrap.appendChild(makeActionButton('Break', () => choose('break'), ''));
                    const rewriteBtn = makeActionButton('Rewrite', () => choose('rewrite'), '');
                    if (!canRewrite) {
                        rewriteBtn.disabled = true;
                        rewriteBtn.title =
                            'To rewrite the oath, complete “The Warden’s Gesture” side quest.';
                    }
                    wrap.appendChild(rewriteBtn);
                });
            return true;
        }
        // Post-dragon flavor (shown once)
        if (flags.dragonDefeated && !flags.villageFeastShown) {
            flags.villageFeastShown = true;
            setScene('Village Feast', 'The village celebrates your victory over the Dragon. War-stories and songs greet you – but the world beyond is still dangerous.');
            addLog && addLog('You are a legend here, but monsters still lurk outside Emberwood.', 'system');
            saveGame && saveGame();
        }
        return false;
    }
    // --- FOREST -------------------------------------------------------------
    if (areaId === 'forest') {
        // Chapter II: splinter — Sap-Run (interactive)
        if (mainQuest && mainQuest.status !== 'completed') {
            if (mainQuest.step >= 10 && mainQuest.step <= 11 && !flags.oathShardSapRun) {
                if (!flags.oathShardSapRunClueShown) {
                    flags.oathShardSapRunClueShown = true;
                    setScene('Sap‑Run Trail', [
                        'A blackened tree stands where it shouldn’t — too old for this grove, too angry for this soil.',
                        '',
                        'Sap has been painted into runes at its base. Something has been feeding the mark with blood.',
                        '',
                        'A shamanic laugh echoes between trunks.'
                    ].join('\n'));
                    addLog && addLog('You feel an Oath‑Splinter nearby. Hunt the guardian.', 'system');
                    updateQuestBox(state);
                    saveGame && saveGame();
                }
                // Strong bias toward the required guardian while the objective is active.
                if (rngFloat(state, 'quest.main.splinter.sapRun') < 0.8) {
                    addLog && addLog('A goblin shaman steps from the roots — guarding something that should not be here.', 'danger');
                    startBattleWith && startBattleWith('goblinShaman');
                    return true;
                }
            }
            // Step 13: The Blackbark Gate
            if (mainQuest.step === 13 && !flags.blackbarkGateFound) {
                flags.blackbarkGateFound = true;
                mainQuest.step = 14;
                setScene('The Blackbark Gate', [
                    'At the edge of the familiar path, the forest folds in on itself like a slow blink.',
                    '',
                    'A seam appears between two living trunks — not a door made of wood, but a wound wearing the shape of a gate.',
                    '',
                    'The air smells like rain that never fell.',
                    'The bark beneath your fingers feels… listening.',
                    '',
                    'You are not invited.',
                    'You are expected.'
                ].join('\n'));
                addLog && addLog('You find the Blackbark Gate. The choice must be made in Emberwood.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
                return true;
            }
        }
        // Chapter III: Crown‑Echo (Step 16) — requires Night
        if (mainQuest && mainQuest.status !== 'completed' && mainQuest.step === 16 && !flags.chapter3CrownEchoTaken) {
            const part = state?.time?.partIndex;
            const isNight = Number(part) === 2;
            if (!isNight) {
                if (!flags.chapter3CrownEchoHintShown) {
                    flags.chapter3CrownEchoHintShown = true;
                    addLog && addLog('The gate feels wrong by day. Return to Emberwood Forest at Night.', 'system');
                    updateQuestBox(state);
                    saveGame && saveGame();
                }
                return false;
            }
            setScene('Night at the Blackbark Gate', 'The seam between trees is wider tonight — as if it heard your footsteps hours ago and made room for them.');
            addLog && addLog('A cold resonance gathers at the gate…', 'danger');
            startBattleWith && startBattleWith('crownShade');
            return true;
        }
        // Chapter III: return to the Gate with an ally (Step 21) — requires Night
        if (mainQuest && mainQuest.status !== 'completed' && mainQuest.step === 21 && flags.chapter3RitualAllyChosen && !flags.hollowRegentDefeated) {
            const part = state?.time?.partIndex;
            const isNight = Number(part) === 2;
            if (!isNight) {
                addLog && addLog('The ritual will not hold by day. Return to Emberwood Forest at Night.', 'system');
                return false;
            }
            setScene('Return to the Gate', 'You stand with your chosen ally. The forest is quiet — not peaceful. Waiting.');
            addLog && addLog('Something steps forward wearing a crown made of absence…', 'danger');
            startBattleWith && startBattleWith('hollowRegent');
            return true;
        }
        // Chapter IV: Rootbound Magistrate (Step 29) — requires Night
        if (mainQuest && mainQuest.status !== 'completed' && mainQuest.step === 29 && !flags.chapter4MagistrateDefeated) {
            const part = state?.time?.partIndex;
            const isNight = Number(part) === 2;
            if (!isNight) {
                addLog && addLog('The Court will not speak by day. Return to Emberwood Forest at Night.', 'system');
                return false;
            }
            setScene('The Gate as Tribunal', 'The Blackbark Gate stands open like a mouth. Paper‑thin shadows gather into robed shapes. A Magistrate steps forward, woven from root and rule.');
            addLog && addLog('The Rootbound Magistrate calls your name like a sentence.', 'danger');
            startBattleWith && startBattleWith('rootboundMagistrate');
            return true;
        }
        // --- Chapter I (expanded): pre-Warlord arc -------------------------
        // Step 0.75: gather Bitterleaf for a warding salve.
        if (mainQuest &&
            mainQuest.status === 'active' &&
            Number(mainQuest.step) === 0.75 &&
            !_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
            // Forage instead of forcing combat every click.
            if (rngFloat(state, 'quest.main.ch1.bitterleaf.find') < 0.55 && api.addItemToInventory) {
                api.addItemToInventory('bitterleaf', 1);
                addLog && addLog('You find Bitterleaf tucked beneath damp bark.', 'good');
                updateQuestBox(state);
                saveGame && saveGame();
                return true;
            }
            // Otherwise fall through to normal encounters to keep pacing varied.
        }
        // Auto-advance beats when step objectives are complete.
        if (mainQuest && mainQuest.status === 'active') {
            const stepNum = Number(mainQuest.step);
            if (stepNum === 0.75 && _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main) && !flags.ch1SalvePrepared) {
                flags.ch1SalvePrepared = true;
                mainQuest.step = 1;
                setScene('Warding Salve', [
                    'You grind Bitterleaf into a thick green paste. The smell bites your nose — then clears it.',
                    '',
                    'When you smear it on your wrists, the forest feels less eager to touch you.',
                    '',
                    'You are ready to push deeper and break the raiders.'
                ].join('\n'));
                addLog && addLog('The salve is prepared. You head toward the raider trails.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
                return true;
            }
            if (stepNum === 1 && _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main) && !flags.ch1RaidersPushedBack) {
                flags.ch1RaidersPushedBack = true;
                mainQuest.step = 1.1;
                setScene('Snareline', [
                    'The last raider falls — and the forest answers with silence, not relief.',
                    '',
                    'You spot a strip of bark scraped clean in a straight line: a snareline path.',
                    'Someone wants you to follow.'
                ].join('\n'));
                addLog && addLog('A suspicious snareline cuts through the brush. Follow it.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
                return true;
            }
            if (stepNum === 1.1 && _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main) && !flags.ch1TrapperDefeated) {
                flags.ch1TrapperDefeated = true;
                flags.ch1SnarelineFound = true;
                mainQuest.step = 1.2;
                setScene('A Freed Hunter', [
                    'You cut through the last line and a trapped hunter staggers free.',
                    '',
                    '“They drag crates east,” he rasps. “Marks on the tags — like stamps.”',
                    '',
                    'Supply route. Organised theft. Someone is counting.'
                ].join('\n'));
                addLog && addLog('The hunter points you toward a supply route. Find the tags.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
                return true;
            }
            if (stepNum === 1.2 && _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main) && !flags.ch1SupplyRouteFound) {
                flags.ch1SupplyRouteFound = true;
                mainQuest.step = 1.25;
                setScene('The Supply Route', [
                    'You collect enough tags to read the pattern: turns, stones, a creek crossing.',
                    '',
                    'It is not a raid. It is a route — and it ends at a cache.'
                ].join('\n'));
                addLog && addLog('The goblins are staging supplies. Burn their cache.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
                return true;
            }
            if (stepNum === 1.25 && _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main) && !flags.ch1CacheBurned) {
                flags.ch1CacheBurned = true;
                mainQuest.step = 1.3;
                setScene('Cache in Flames', [
                    'The cache goes up fast. Pitch, oil, and stolen blankets make a hungry fire.',
                    '',
                    'Somewhere deeper, a drum answers — a signal that says: they know.'
                ].join('\n'));
                addLog && addLog('The cache burns. The war drums begin to beat.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
                return true;
            }
            if (stepNum === 1.3 && _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main) && !flags.ch1DrumsSilenced) {
                flags.ch1DrumsSilenced = true;
                mainQuest.step = 1.4;
                setScene('The Drums Fall Silent', [
                    'The drum’s skin splits. The echo dies between the trees.',
                    '',
                    'Without the beat, patrols hesitate — and you see a steadier path: a captain’s trail.'
                ].join('\n'));
                addLog && addLog('Follow the captain’s trail and take his sigil.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
                return true;
            }
            if (stepNum === 1.4 && _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main) && !flags.ch1SigilRecovered) {
                flags.ch1SigilRecovered = true;
                flags.ch1CaptainDefeated = true;
                setScene('Camp Sigil', [
                    'The captain’s token is cold — too cold for bone.',
                    '',
                    'With it, you can pass the outer sentries. The Warlord will not be able to ignore you now.'
                ].join('\n'));
                addLog && addLog('You have the Warlord Sigil. Hunt the Goblin Warlord.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
                // Do not advance step here; Step 1.5 is reserved for post-Warlord Rowan debrief.
                return true;
            }
        }
        // Chapter I: step-driven encounter bias / authored fights
        if (mainQuest && mainQuest.status === 'active' && !flags.goblinBossDefeated) {
            const s = Number(mainQuest.step);
            // Step 1: raid suppression — bias to goblins while objectives are incomplete.
            if (s === 1 && !_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
                if (rngFloat(state, 'quest.main.ch1.raiders.bias') < 0.65) {
                    const pick = rngPick(state, ['goblin', 'goblinScout', 'goblinArcher', 'goblinShaman'], 'quest.main.ch1.raiders.pick');
                    addLog && addLog('You follow fresh raider marks through the underbrush…', 'system');
                    startBattleWith && startBattleWith(pick);
                    return true;
                }
            }
            // Step 1.1: the snareline — force the trapper encounter reliably.
            if (s === 1.1 && !_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
                if (!flags.ch1SnarelineFound) {
                    flags.ch1SnarelineFound = true;
                    setScene('Snareline', 'A too-straight path through brush: rope fibers snagged on thorns. A trapper is near.');
                    addLog && addLog('You spot rope fibers and scraped bark. The trapper is close.', 'system');
                    updateQuestBox(state);
                    saveGame && saveGame();
                    return true;
                }
                if (rngFloat(state, 'quest.main.ch1.trapper.bias') < 0.8) {
                    addLog && addLog('A Goblin Trapper steps from the shadows, knife already moving.', 'danger');
                    startBattleWith && startBattleWith('goblinTrapper');
                    return true;
                }
            }
            // Step 1.2: supply route — bias to scouts.
            if (s === 1.2 && !_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
                if (rngFloat(state, 'quest.main.ch1.supply.bias') < 0.65) {
                    const pick = rngPick(state, ['goblinScout', 'goblinArcher'], 'quest.main.ch1.supply.pick');
                    addLog && addLog('You catch glimpses of runners carrying sacks between trees…', 'system');
                    startBattleWith && startBattleWith(pick);
                    return true;
                }
            }
            // Step 1.25: cache fight
            if (s === 1.25 && !_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
                if (rngFloat(state, 'quest.main.ch1.cache.bias') < 0.85) {
                    setScene('Stolen Cache', 'Behind a thorn wall, stolen crates are stacked like a shrine. A packmaster watches them like treasure.');
                    addLog && addLog('The Goblin Packmaster charges to defend the cache!', 'danger');
                    startBattleWith && startBattleWith('goblinPackmaster');
                    return true;
                }
            }
            // Step 1.3: war drums
            if (s === 1.3 && !_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
                if (rngFloat(state, 'quest.main.ch1.drums.bias') < 0.85) {
                    setScene('War Drums', 'A pounding rhythm moves through the trunks — not sound, but instruction. The drummer is close.');
                    addLog && addLog('The Goblin Drummer beats a signal through the woods!', 'danger');
                    startBattleWith && startBattleWith('goblinDrummer');
                    return true;
                }
            }
            // Step 1.4: captain
            if (s === 1.4 && !_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
                if (rngFloat(state, 'quest.main.ch1.captain.bias') < 0.85) {
                    setScene('Captain’s Trail', 'Boot prints — actual boots, not bare goblin feet — lead to a small command fire.');
                    addLog && addLog('A Goblin Captain blocks your path, sigil in hand.', 'danger');
                    startBattleWith && startBattleWith('goblinCaptain');
                    return true;
                }
            }
        }
        if (maybeTriggerSideQuestEvent(state, 'forest', api))
            return true;
        // Goblin Warlord encounter chance (quest progression)
        if (mainQuestAccepted && !flags.goblinBossDefeated) {
            const stepNum = mainQuest ? Number(mainQuest.step) : NaN;
            const canSpawnBoss = !mainQuest ||
                mainQuest.status === 'completed' ||
                (Number.isFinite(stepNum) && stepNum >= 1.4 && !!flags.ch1SigilRecovered);
            if (canSpawnBoss && rngFloat(state, 'quest.main.goblinBoss.roll') < 0.32) {
                setScene("Goblin Warlord's Camp", "After following tracks and ash, you discover the Goblin Warlord's fortified camp.");
                addLog && addLog('The Goblin Warlord roars a challenge!', 'danger');
                startBattleWith && startBattleWith('goblinBoss');
                return true;
            }
        }
        return false;
    }
    // --- RUINS --------------------------------------------------------------
    if (areaId === 'ruins') {
        // Main Quest Step 2 (interactive): bias encounters toward spire threats
        // until the step objectives are complete.
        if (mainQuest &&
            mainQuest.status !== 'completed' &&
            mainQuest.step === 2 &&
            !flags.dragonDefeated &&
            !_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
            if (rngFloat(state, 'quest.main.spire.bias') < 0.55) {
                const pick = rngPick(state, ['cultist', 'voidSpawn', 'voidHound'], 'quest.main.spire.pick');
                addLog && addLog('The Spire answers your presence with chanting and teeth…', 'system');
                startBattleWith && startBattleWith(pick);
                return true;
            }
        }
        // Dragon encounter (gated when you are on Step 2)
        if (mainQuestAccepted && !flags.dragonDefeated) {
            // Chapter I pacing: don't allow the Spire boss to spawn until Rowan has sent you here.
            // (This prevents out-of-order story bosses when the player travels early.)
            if (mainQuest && mainQuest.status !== 'completed' && Number(mainQuest.step) < 2)
                return false;
            const canSpawnBoss = !mainQuest ||
                mainQuest.status === 'completed' ||
                mainQuest.step !== 2 ||
                _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main);
            if (canSpawnBoss && rngFloat(state, 'quest.main.dragon.roll') < 0.4) {
                setScene('The Ruined Spire', 'Atop a crumbling spire, the Void-Touched Dragon coils around shards of crystal, hatred in its eyes.');
                addLog && addLog('The Void-Touched Dragon descends from the darkness!', 'danger');
                startBattleWith && startBattleWith('dragon');
                return true;
            }
        }
        // Chapter III: Star‑Iron Pin (Step 18)
        if (mainQuest && mainQuest.status !== 'completed' && mainQuest.step === 18 && !flags.chapter3StarIronPin) {
            setScene('Mirror Warden', 'At the spire’s shattered crown, a figure of polished voidglass watches you — reflecting not your face, but your choices.');
            addLog && addLog('The Mirror Warden draws a blade made of reflected light.', 'danger');
            startBattleWith && startBattleWith('mirrorWarden');
            return true;
        }
        // Chapter IV: Verdant Lens (Step 24)
        if (mainQuest && mainQuest.status !== 'completed' && mainQuest.step === 24 && !flags.chapter4VerdantLens) {
            setScene('Echo Archivist', 'Among the spire’s broken shelves, a clerk made of glass‑ink and old breath turns a page that is not there. The record is being edited.');
            addLog && addLog('The Echo Archivist seals the aisle and raises a quill like a blade.', 'danger');
            startBattleWith && startBattleWith('echoArchivist');
            return true;
        }
        return false;
    }
    // --- ASHEN MARSH --------------------------------------------------------
    if (areaId === 'marsh') {
        if (mainQuest && mainQuest.status !== 'completed') {
            // Chapter II: splinter — Witch‑Reed (interactive)
            if (mainQuest.step >= 10 && mainQuest.step <= 11 && !flags.oathShardWitchReed) {
                if (!flags.oathShardWitchReedClueShown) {
                    flags.oathShardWitchReedClueShown = true;
                    setScene('Witch‑Reed Trail', [
                        'You part the reeds and find them braided into a deliberate knot — a warding sign, half‑rotted, half‑remembered.',
                        '',
                        'Fresh blood darkens the braid. Someone keeps the ward alive.',
                        '',
                        'A cultist chant slips between the cattails like smoke.'
                    ].join('\n'));
                    addLog && addLog('You feel an Oath‑Splinter nearby. Hunt the guardian.', 'system');
                    updateQuestBox(state);
                    saveGame && saveGame();
                }
                if (rngFloat(state, 'quest.main.splinter.witchReed') < 0.8) {
                    addLog && addLog('A Bog Cultist steps from the fog — clutching something bound in reeds.', 'danger');
                    startBattleWith && startBattleWith('bogCultist');
                    return true;
                }
            }
        }
        if (maybeTriggerSideQuestEvent(state, 'marsh', api))
            return true;
        // Chapter IV: Marsh writs (Step 25)
        if (mainQuest &&
            mainQuest.status !== 'completed' &&
            mainQuest.step === 25 &&
            !flags.chapter4MarshWritsDone &&
            !_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
            if (!flags.chapter4MarshWritsClueShown) {
                flags.chapter4MarshWritsClueShown = true;
                setScene('Bailiffs in the Reeds', [
                    'The fog is threaded with pale ribbons — not mist, but paper fibers soaked in sap.',
                    '',
                    'Footprints appear where no one walked. A voice reads a charge you did not consent to hear.',
                    '',
                    '“By Rootbound authority…”'
                ].join('\n'));
                addLog && addLog('Rootbound bailiffs patrol the marsh. Recover their writs.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
            }
            // Heavy bias to keep testing reliable.
            if (rngFloat(state, 'quest.main.chapter4.marsh.bias') < 0.7) {
                addLog && addLog('A Rootbound Bailiff emerges, parchment‑skin crackling.', 'danger');
                startBattleWith && startBattleWith('mireBailiff');
                return true;
            }
        }
        // Main Quest Step 3 (interactive): bias encounters toward bog threats
        // until the step objectives are complete.
        if (mainQuest &&
            mainQuest.status !== 'completed' &&
            mainQuest.step === 3 &&
            !flags.marshWitchDefeated &&
            !_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
            if (rngFloat(state, 'quest.main.marsh.bias') < 0.55) {
                const pick = rngPick(state, ['bogCultist', 'mireStalker', 'plagueToad'], 'quest.main.marsh.pick');
                addLog && addLog('The marsh answers with wet footsteps and muttered prayers…', 'system');
                startBattleWith && startBattleWith(pick);
                return true;
            }
        }
        if (mainQuestAccepted && !flags.marshWitchDefeated) {
            const canSpawnBoss = !mainQuest ||
                mainQuest.status === 'completed' ||
                mainQuest.step !== 3 ||
                _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main);
            if (canSpawnBoss && rngFloat(state, 'quest.main.marshWitch.roll') < 0.35) {
                setScene('Witchlight Fen', 'A pale lantern-fog rolls over the marsh. Cackling laughter echoes as the Marsh Witch steps from the mire.');
                addLog && addLog('The Marsh Witch emerges from the brackish gloom!', 'danger');
                startBattleWith && startBattleWith('marshWitch');
                return true;
            }
        }
        return false;
    }
    // --- FROSTPEAK PASS -----------------------------------------------------
    if (areaId === 'frostpeak') {
        if (maybeTriggerSideQuestEvent(state, 'frostpeak', api))
            return true;
        // Chapter IV: Frozen Writ (Step 26)
        if (mainQuest && mainQuest.status !== 'completed' && mainQuest.step === 26 && !flags.chapter4FrozenWrit) {
            setScene('Ice Censor', 'A figure of frost‑paper stands on the ridge, stamping seals into the wind. Every breath feels like a verdict.');
            addLog && addLog('The Ice Censor raises a gavel of glacier‑glass.', 'danger');
            startBattleWith && startBattleWith('iceCensor');
            return true;
        }
        // Main Quest Step 4 (interactive): bias encounters toward Frost wolves
        // until you recover a rune-stone and complete the step goals.
        if (mainQuest &&
            mainQuest.status !== 'completed' &&
            mainQuest.step === 4 &&
            !flags.frostGiantDefeated &&
            !_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
            if (rngFloat(state, 'quest.main.frostpeak.bias') < 0.55) {
                addLog && addLog('You follow fresh pawprints carved into the snow…', 'system');
                startBattleWith && startBattleWith('iceWolf');
                return true;
            }
        }
        if (mainQuestAccepted && !flags.frostGiantDefeated) {
            const canSpawnBoss = !mainQuest ||
                mainQuest.status === 'completed' ||
                mainQuest.step !== 4 ||
                _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main);
            if (canSpawnBoss && rngFloat(state, 'quest.main.frostGiant.roll') < 0.35) {
                setScene('Frostpeak Ridge', 'Snow whips like knives. The Frostpeak Giant towers above the pass, blocking your way with a bellow.');
                addLog && addLog('The Frostpeak Giant challenges you!', 'danger');
                startBattleWith && startBattleWith('frostGiant');
                return true;
            }
        }
        return false;
    }
    // --- SUNKEN CATACOMBS ---------------------------------------------------
    if (areaId === 'catacombs') {
        if (mainQuest && mainQuest.status !== 'completed') {
            // Chapter II: splinter — Bone‑Char (interactive)
            if (mainQuest.step >= 10 && mainQuest.step <= 11 && !flags.oathShardBoneChar) {
                if (!flags.oathShardBoneCharClueShown) {
                    flags.oathShardBoneCharClueShown = true;
                    setScene('Bone‑Char Trail', [
                        'A rib‑cage half buried in silt forms a crude altar.',
                        'Someone arranged the bones with care — not devotion, but apology.',
                        '',
                        'Fresh candle‑wax drips where no candles should survive damp stone.',
                        'A chant echoes in the drowned hall.'
                    ].join('\n'));
                    addLog && addLog('You feel an Oath‑Splinter nearby. Hunt the guardian.', 'system');
                    updateQuestBox(state);
                    saveGame && saveGame();
                }
                if (rngFloat(state, 'quest.main.splinter.boneChar') < 0.8) {
                    addLog && addLog('A Drowned Necromancer rises — clutching a charred splinter like a confession.', 'danger');
                    startBattleWith && startBattleWith('necromancer');
                    return true;
                }
            }
            // Step 12: Ash‑Warden encounter
            if (mainQuest.step === 12 && !flags.ashWardenMet) {
                flags.ashWardenMet = true;
                mainQuest.step = 13;
                setScene('The Warden in Ash', [
                    'A figure stands where the tunnel narrows — armor powdered into gray dust, eyes like coals in a hearth that hates to go out.',
                    '',
                    '"You carry the stink of endings," it says.',
                    '"But you don’t carry the weight."',
                    '',
                    '"They told you monsters were invaders. No. They were refugees from the places the oath could no longer seal."',
                    '',
                    '"The oath didn’t fail."',
                    '"It was harvested."',
                    '',
                    'The ash‑warden leans closer, and the air tastes of burnt names:',
                    '"You are either the last honest knife in a dishonest world… or the next hand to hold the theft."'
                ].join('\n'));
                addLog && addLog('You meet the Ash‑Warden. The Blackbark Gate waits in Emberwood Forest.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
                return true;
            }
        }
        if (maybeTriggerSideQuestEvent(state, 'catacombs', api))
            return true;
        // Chapter IV: Bone Writ (Step 27)
        if (mainQuest && mainQuest.status !== 'completed' && mainQuest.step === 27 && !flags.chapter4BoneWrit) {
            setScene('Bone Notary', 'In a drowned chapel, a scribe made of bone‑splinters stamps seals into wet stone. It has recorded too many deaths to forget yours.');
            addLog && addLog('The Bone Notary reads your name out of the dark.', 'danger');
            startBattleWith && startBattleWith('boneNotary');
            return true;
        }
        // Main Quest Step 5 (interactive): bias encounters toward catacomb sentries
        // until the step objectives are complete.
        if (mainQuest &&
            mainQuest.status !== 'completed' &&
            mainQuest.step === 5 &&
            !flags.lichDefeated &&
            !_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
            if (rngFloat(state, 'quest.main.catacombs.bias') < 0.55) {
                const pick = rngPick(state, ['skeletonWarrior', 'skeletonArcher', 'boneGolem', 'necromancer'], 'quest.main.catacombs.pick');
                addLog && addLog('Stone scrapes stone. Something dead hears you and stands.', 'system');
                startBattleWith && startBattleWith(pick);
                return true;
            }
        }
        // Chapter III: Grave‑Latch (Step 19)
        if (mainQuest && mainQuest.status !== 'completed' && mainQuest.step === 19 && flags.lichDefeated && !flags.chapter3GraveLatch) {
            setScene('The Grave‑Latch', 'Past the drowned sanctum, stone ribs form a doorway no map remembers. A lock made of bone clicks once — and something answers.');
            addLog && addLog('A Rootbound Warden rises to keep what was stolen.', 'danger');
            startBattleWith && startBattleWith('graveLatchWarden');
            return true;
        }
        if (mainQuestAccepted && !flags.lichDefeated) {
            const canSpawnBoss = !mainQuest ||
                mainQuest.status === 'completed' ||
                mainQuest.step !== 5 ||
                _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main);
            if (canSpawnBoss && rngFloat(state, 'quest.main.lich.roll') < 0.35) {
                setScene('Drowned Sanctum', 'Water drips from vaulted stone. A cold voice chants from the dark — the Sunken Lich rises to meet you.');
                addLog && addLog('The Sunken Lich awakens!', 'danger');
                startBattleWith && startBattleWith('lich');
                return true;
            }
        }
        return false;
    }
    // --- OBSIDIAN KEEP ------------------------------------------------------
    if (areaId === 'keep') {
        if (maybeTriggerSideQuestEvent(state, 'keep', api))
            return true;
        // Chapter IV: Seal of Verdict (Step 28)
        if (mainQuest && mainQuest.status !== 'completed' && mainQuest.step === 28 && !flags.chapter4SealOfVerdict) {
            setScene('Oathbinder', 'An armored adjudicator blocks the hall — etched with seals that bleed voidlight. It does not ask why you came. It already wrote the answer.');
            addLog && addLog('The Oathbinder raises a chain of obsidian links.', 'danger');
            startBattleWith && startBattleWith('oathBinder');
            return true;
        }
        // Main Quest Step 6 (interactive): bias encounters toward the king’s guard
        // until the step objectives (kills + keep seal) are complete.
        if (mainQuest &&
            mainQuest.status !== 'completed' &&
            mainQuest.step === 6 &&
            !flags.obsidianKingDefeated &&
            !_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
            if (rngFloat(state, 'quest.main.keep.bias') < 0.55) {
                const pick = rngPick(state, ['darkKnight', 'shadowAssassin'], 'quest.main.keep.pick');
                addLog && addLog('You stalk the king’s guard through halls of humming obsidian…', 'system');
                startBattleWith && startBattleWith(pick);
                return true;
            }
        }
        if (mainQuestAccepted && !flags.obsidianKingDefeated) {
            const canSpawnBoss = !mainQuest ||
                mainQuest.status === 'completed' ||
                mainQuest.step !== 6 ||
                _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main);
            if (canSpawnBoss && rngFloat(state, 'quest.main.obsidianKing.roll') < 0.4) {
                setScene('The Throne of Glass', 'Obsidian walls hum with voidlight. The Obsidian King descends from his throne, blade and sorcery entwined.');
                addLog && addLog('The Obsidian King will not yield his realm!', 'danger');
                startBattleWith && startBattleWith('obsidianKing');
                return true;
            }
        }
        return false;
    }
    // --- OATHGROVE ---------------------------------------------------------
    if (areaId === 'oathgrove') {
        if (maybeTriggerSideQuestEvent(state, 'oathgrove', api))
            return true;
        // Chapter II (expanded): Quiet Ink incursion (Step 10.75)
        if (mainQuest && mainQuest.status !== 'completed' && Number(mainQuest.step) === 10.75) {
            // One-time atmosphere beat
            if (!flags.oathgroveIntroShown) {
                flags.oathgroveIntroShown = true;
                setScene('The Oathgrove', [
                    'Trees grow too close together here — like an audience leaning in.',
                    'The air smells of sap and old promises.',
                    '',
                    'Somewhere deeper, something scratches tally-marks into living bark.'
                ].join('\n'));
                addLog && addLog('The Oathgrove watches you. Harvest Quiet Ink resin — then break the Warden.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
            }
            // If objectives are not complete, bias encounters to help you progress.
            if (!_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
                // Objectives (10.75):
                //  - [0] Kill Sapbound Warden (1)
                //  - [1] Collect Quiet Ink Resin (2)
                const resin = _objectiveCount(mainQuest, 10.75, 1);
                const wardenKilled = _objectiveCount(mainQuest, 10.75, 0) >= 1;
                // Prioritize resin farming early
                if (resin < 2 && rngFloat(state, 'quest.main.oathgrove.resin') < 0.65) {
                    const pick = rngPick(state, ['rootcrownAcolyte', 'oathgroveStalker'], 'quest.main.oathgrove.resin.pick');
                    addLog && addLog('Something with Rootcrown ink in its veins steps from the thicket.', 'danger');
                    startBattleWith && startBattleWith(pick);
                    return true;
                }
                // Spawn the Sapbound Warden once you have resin (or sometimes earlier)
                if (!wardenKilled && rngFloat(state, 'quest.main.oathgrove.warden') < (resin >= 2 ? 0.65 : 0.25)) {
                    setScene('Sapbound Warden', 'The grove shudders. A guardian rises from fused roots and oath‑sap — a Warden that never learned to stop keeping score.');
                    addLog && addLog('The Sapbound Warden lumbers toward you!', 'danger');
                    startBattleWith && startBattleWith('sapboundWarden');
                    return true;
                }
            }
        }
        return false;
    }
    // --- BLACKBARK DEPTHS --------------------------------------------------
    if (areaId === 'blackbarkDepths') {
        if (maybeTriggerSideQuestEvent(state, 'blackbarkDepths', api))
            return true;
        // Chapter III (expanded): Investigation beat (Step 15.5)
        if (mainQuest && mainQuest.status !== 'completed' && Number(mainQuest.step) === 15.5) {
            if (!flags.blackbarkDepthsIntroShown) {
                flags.blackbarkDepthsIntroShown = true;
                setScene('Blackbark Depths', [
                    'Below the village, the roots turn to corridors.',
                    'Sap runs like ink — too dark, too deliberate.',
                    '',
                    'Your charcoal squeaks when it touches the carved veins.'
                ].join('\n'));
                addLog && addLog('Take charcoal rubbings and silence the stalkers hunting these tunnels.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
            }
            if (!_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
                const stalkerKills = _objectiveCount(mainQuest, 15.5, 0);
                const rubbings = _objectiveCount(mainQuest, 15.5, 1);
                // Ensure the wraith appears often enough to make rubbings achievable
                if (rubbings < 1 && rngFloat(state, 'quest.main.depths.wraith') < 0.4) {
                    addLog && addLog('A Blackbark Wraith slides out of the sigils, trying to erase your footsteps.', 'danger');
                    startBattleWith && startBattleWith('blackbarkWraith');
                    return true;
                }
                // Otherwise bias toward stalkers until the kill quota is met
                if (stalkerKills < 6 && rngFloat(state, 'quest.main.depths.stalker') < 0.6) {
                    addLog && addLog('Oathbound Stalkers stalk the tunnels, counting breaths like debts.', 'system');
                    startBattleWith && startBattleWith('oathboundStalker');
                    return true;
                }
            }
        }
        return false;
    }
    // --- STARFALL RIDGE ----------------------------------------------------
    if (areaId === 'starfallRidge') {
        if (maybeTriggerSideQuestEvent(state, 'starfallRidge', api))
            return true;
        // Chapter III (expanded): gather Star‑Iron shards (Step 17.5)
        if (mainQuest && mainQuest.status !== 'completed' && Number(mainQuest.step) === 17.5) {
            if (!flags.starfallRidgeIntroShown) {
                flags.starfallRidgeIntroShown = true;
                setScene('Starfall Ridge', [
                    'A scar of glassy stone cuts across the ridge.',
                    'The air tastes like thunder that never arrived.',
                    '',
                    'Metal fragments glitter in the dust — stars that forgot to stay in the sky.'
                ].join('\n'));
                addLog && addLog('Gather Star‑Iron shards. Something here still guards the impact site.', 'system');
                updateQuestBox(state);
                saveGame && saveGame();
            }
            if (!_areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
                const shards = _objectiveCount(mainQuest, 17.5, 0);
                // Mini-boss: once the player has 2 shards, a sentinel can appear to force a set-piece fight.
                if (shards >= 2 && !flags.starfallSentinelDefeated && rngFloat(state, 'quest.main.starfall.sentinel') < 0.65) {
                    flags.starfallSentinelEncountered = true;
                    setScene('Falling Star Sentinel', 'A plated shape rises from the crater-dust, eyes burning with pale meteor-light. It moves like a verdict with legs.');
                    addLog && addLog('A Starfall Sentinel blocks your path!', 'danger');
                    startBattleWith && startBattleWith('starfallSentinel');
                    return true;
                }
                // Otherwise, bias toward shard-dropping enemies while the objective is unfinished.
                if (rngFloat(state, 'quest.main.starfall.bias') < 0.55) {
                    const pick = rngPick(state, ['starfallReaver', 'astralWisp', 'skyfallenHusk'], 'quest.main.starfall.pick');
                    addLog && addLog('The ridge whispers with static. Something stirs in the crater dust…', 'system');
                    startBattleWith && startBattleWith(pick);
                    return true;
                }
            }
        }
        return false;
    }
    return false;
}
export function applyQuestProgressOnItemGain(state, itemId, quantity = 1, api = {}) {
    ensureQuestStructures(state);
    if (!itemId)
        return false;
    const addLog = api.addLog;
    const setScene = api.setScene;
    const saveGame = api.saveGame;
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    let changed = false;
    const reg = api && api.questRegistry;
    const triggers = reg && reg.collectByItemId
        ? reg.collectByItemId[String(itemId)]
        : null;
    if (Array.isArray(triggers) && triggers.length) {
        // Registry-driven: update only objectives that could possibly care about this item.
        triggers.forEach((t) => {
            if (!t || t.type !== 'collect')
                return;
            const q = t.questKind === 'main'
                ? state.quests.main
                : (state.quests.side || {})[t.questId];
            if (!q || q.status !== 'active')
                return;
            if (Number(q.step) !== Number(t.step))
                return;
            _ensureObjectiveProgress(q);
            const prev = _objectiveCount(q, q.step, t.objectiveIndex);
            const next = prev + qty;
            _setObjectiveCount(q, q.step, t.objectiveIndex, next);
            changed = true;
            const req = Math.max(1, Math.floor(Number(t.required) || 1));
            if (prev < req && next >= req) {
                addLog && addLog('Objective complete: ' + (t.label || 'Collected required items') + '.', 'good');
            }
        });
    }
    else {
        // Fallback: legacy scan (kept for safety/back-compat).
        const applyToQuest = (q, def) => {
            if (!q || !def || q.status !== 'active')
                return;
            const objs = _getObjectivesFor(def, q.step);
            if (!objs || !objs.length)
                return;
            _ensureObjectiveProgress(q);
            for (let i = 0; i < objs.length; i++) {
                const o = objs[i];
                if (!o || o.type !== 'collect')
                    continue;
                if (String(o.itemId || '') !== String(itemId))
                    continue;
                const prev = _objectiveCount(q, q.step, i);
                const next = prev + qty;
                _setObjectiveCount(q, q.step, i, next);
                changed = true;
                const req = Math.max(1, Math.floor(Number(o.required) || 1));
                if (prev < req && next >= req) {
                    addLog && addLog('Objective complete: ' + (o.label || 'Collected required items') + '.', 'good');
                }
            }
        };
        const main = state.quests.main;
        if (main && main.status === 'active')
            applyToQuest(main, QUEST_DEFS.main);
        const side = state.quests.side || {};
        Object.values(side).forEach((q) => {
            const def = q && q.id ? QUEST_DEFS.side[q.id] : null;
            if (def)
                applyToQuest(q, def);
        });
    }
    if (changed) {
        // Chapter IV: Step 25 is an objective-only beat (no boss trigger).
        // Advance automatically once the player has the required writs.
        try {
            const qMain = state?.quests?.main;
            const f = state?.flags;
            if (qMain &&
                String(qMain.status) === 'active' &&
                Number(qMain.step) === 25 &&
                f &&
                !f.chapter4MarshWritsDone &&
                _areStepObjectivesComplete(qMain, QUEST_DEFS.main)) {
                f.chapter4MarshWritsDone = true;
                qMain.step = 26;
                setScene &&
                    setScene('Marsh Writs Secured', 'The bailiffs fall apart into damp parchment. Two writs remain — stamped, wet, and angry. The Court points north.');
                addLog && addLog('Chapter IV: marsh writs recovered. Frostpeak awaits.', 'system');
            }
            // Chapter III: Step 17.5 is item-only (Star‑Iron shards). Advance once complete.
            if (qMain &&
                String(qMain.status) === 'active' &&
                Number(qMain.step) === 17.5 &&
                f &&
                !f.chapter3StarfallShardsDone &&
                _areStepObjectivesComplete(qMain, QUEST_DEFS.main)) {
                f.chapter3StarfallShardsDone = true;
                qMain.step = 18;
                setScene &&
                    setScene('Star‑Iron Gathered', 'The shards bite cold into your palm. Enough star‑iron to take a Pin from the Spire. Return to the Ruined Spire.');
                addLog && addLog('Star‑Iron gathered. Return to the Ruined Spire for the Pin.', 'system');
            }
        }
        catch (_) {
            // ignore
        }
        updateQuestBox(state);
        saveGame && saveGame();
    }
    // ---------------------------------------------------------------------
    // Main Quest: Chapter II splinters are tracked by flags for story beats.
    // When splinter items are acquired (via interactive objectives), mark
    // the corresponding flags so existing story gates continue to work.
    // ---------------------------------------------------------------------
    try {
        const f = state.flags || {};
        const qMain = state.quests && state.quests.main;
        const id = String(itemId || '');
        const markSplinter = (flagKey, label) => {
            if (f[flagKey])
                return false;
            f[flagKey] = true;
            addLog && addLog('You recover an Oath‑Splinter (' + label + ').', 'good');
            return true;
        };
        let splinterChanged = false;
        if (id === 'oathSplinterSapRun')
            splinterChanged = markSplinter('oathShardSapRun', 'Sap‑Run') || splinterChanged;
        if (id === 'oathSplinterWitchReed')
            splinterChanged = markSplinter('oathShardWitchReed', 'Witch‑Reed') || splinterChanged;
        if (id === 'oathSplinterBoneChar')
            splinterChanged = markSplinter('oathShardBoneChar', 'Bone‑Char') || splinterChanged;
        if (splinterChanged && hasAllOathSplinters(state)) {
            // Patch 1.2.5 story pacing: after collecting all three splinters,
            // return to the Bark-Scribe for a binding lesson (Step 10.5) before
            // the Oathgrove incursion (Step 10.75) and the Quiet Roots Trial (Step 11).
            if (qMain && qMain.status === 'active' && Number(qMain.step) < 10.5) {
                qMain.step = Math.max(Number(qMain.step) || 0, 10.5);
                addLog && addLog('All three splinters resonate. Return to the Bark‑Scribe in the tavern.', 'system');
            }
            // Light story ping (optional)
            if (typeof setScene === 'function' && !f.allOathSplintersSceneShown) {
                f.allOathSplintersSceneShown = true;
                setScene('Oath‑Splinters Gathered', 'The three splinters warm in your palm at once, like a heartbeat syncing to yours. The forest has noticed.');
            }
            updateQuestBox(state);
            saveGame && saveGame();
        }
    }
    catch (_) { }
    return changed;
}
export function applyQuestProgressOnEnemyDefeat(state, enemy, api = {}) {
    ensureQuestStructures(state);
    if (!enemy || !enemy.id)
        return false;
    const addLog = api.addLog;
    const setScene = api.setScene;
    const addItemToInventory = api.addItemToInventory;
    const saveGame = api.saveGame;
    const mainQuest = state.quests.main;
    const flags = state.flags;
    const mainQuestAccepted = !!(flags && (flags.mainQuestAccepted || mainQuest));
    // Generic objective progression (kill/collect via drops) for any quest
    // that defines objective metadata in questDefs.js.
    let objChanged = false;
    // --- Registry-driven kill objective progression -----------------------
    // Only touch objectives that could possibly match this enemy id.
    const reg = api && api.questRegistry;
    const killTriggers = reg && reg.killByEnemyId
        ? reg.killByEnemyId[String(enemy.id)]
        : null;
    if (Array.isArray(killTriggers) && killTriggers.length) {
        killTriggers.forEach((t) => {
            if (!t || t.type !== 'kill')
                return;
            const q = t.questKind === 'main'
                ? state.quests.main
                : (state.quests.side || {})[t.questId];
            if (!q || q.status !== 'active')
                return;
            if (Number(q.step) !== Number(t.step))
                return;
            _ensureObjectiveProgress(q);
            const prev = _objectiveCount(q, q.step, t.objectiveIndex);
            const next = prev + 1;
            _setObjectiveCount(q, q.step, t.objectiveIndex, next);
            objChanged = true;
            const req = Math.max(1, Math.floor(Number(t.required) || 1));
            if (prev < req && next >= req) {
                addLog && addLog('Objective complete: ' + (t.label || 'Defeated required enemies') + '.', 'good');
            }
        });
    }
    // --- Collect objectives sourced via enemy drops -----------------------
    // This is still scanned per active quest step because it is an authored,
    // optional mechanic (dropsFrom + dropChance) rather than a simple event mapping.
    const applyCollectDropsToQuest = (q, def) => {
        if (!q || !def || q.status !== 'active')
            return;
        const objs = _getObjectivesFor(def, q.step);
        if (!objs || !objs.length)
            return;
        _ensureObjectiveProgress(q);
        for (let i = 0; i < objs.length; i++) {
            const o = objs[i];
            if (!o)
                continue;
            if (o.type !== 'collect' || !o.itemId || !addItemToInventory)
                continue;
            const ids = Array.isArray(o.dropsFrom) ? o.dropsFrom : null;
            if (!ids || !ids.includes(enemy.id))
                continue;
            const req = Math.max(1, Math.floor(Number(o.required) || 1));
            const cur = _objectiveCount(q, q.step, i);
            if (cur >= req)
                continue;
            const chance = Math.max(0, Math.min(1, Number(o.dropChance ?? 1)));
            if (rngFloat(state, 'quest.drop') < chance) {
                // Granting the item will also be tracked by applyQuestProgressOnItemGain
                // because addItemToInventory() is hooked in engine.js.
                addItemToInventory(String(o.itemId), 1);
                addLog && addLog('You recover: ' + (o.label || String(o.itemId)) + '.', 'good');
            }
        }
    };
    if (mainQuest && mainQuest.status === 'active') {
        applyCollectDropsToQuest(mainQuest, QUEST_DEFS.main);
    }
    const side = state.quests.side || {};
    Object.values(side).forEach((q) => {
        const def = q && q.id ? QUEST_DEFS.side[q.id] : null;
        if (def)
            applyCollectDropsToQuest(q, def);
    });
    if (objChanged) {
        updateQuestBox(state);
        saveGame && saveGame();
    }
    // ------------------------------------------------------------------
    // Patch 1.2.5 story expansion: mini-boss and step auto-advances
    // ------------------------------------------------------------------
    try {
        // Mini-boss reward: guaranteed Star‑Iron shard on Sentinel defeat.
        if (enemy.id === 'starfallSentinel') {
            flags.starfallSentinelDefeated = true;
            if (addItemToInventory)
                addItemToInventory('starIronShard', 1);
            addLog && addLog('You pry a Star‑Iron shard from the Sentinel’s plating.', 'good');
            updateQuestBox(state);
            saveGame && saveGame();
        }
        // Chapter II: mark Sapbound Warden and complete the Oathgrove incursion.
        if (enemy.id === 'sapboundWarden') {
            flags.sapboundWardenDefeated = true;
        }
        // Step 10.75 → 11 (once objectives are complete)
        if (mainQuest &&
            String(mainQuest.status) === 'active' &&
            Number(mainQuest.step) === 10.75 &&
            !flags.chapter2OathgroveDone &&
            _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
            flags.chapter2OathgroveDone = true;
            mainQuest.step = 11;
            setScene &&
                setScene('Quiet Ink Secured', 'The resin is yours. The splinters stop tugging apart — as if the oath has been forced to listen. Return to Emberwood for the Quiet Roots Trial.');
            addLog && addLog('Quiet Ink secured. Return to Emberwood for the Quiet Roots Trial.', 'system');
            updateQuestBox(state);
            saveGame && saveGame();
        }
        // Step 15.5 → 16 (depths investigation complete)
        if (mainQuest &&
            String(mainQuest.status) === 'active' &&
            Number(mainQuest.step) === 15.5 &&
            !flags.chapter3InvestigationDone &&
            _areStepObjectivesComplete(mainQuest, QUEST_DEFS.main)) {
            flags.chapter3InvestigationDone = true;
            mainQuest.step = 16;
            setScene &&
                setScene('Marks in the Dark', 'Your charcoal rubbings show the same crown‑shape repeated — not a symbol of rule, but of ownership. Something is preparing a ritual at the gate. Return at Night.');
            addLog && addLog('You have enough evidence. Return to the Blackbark Gate at Night.', 'system');
            updateQuestBox(state);
            saveGame && saveGame();
        }
    }
    catch (_) {
        // ignore
    }
    if (enemy.id === 'goblinBoss') {
        flags.goblinBossDefeated = true;
        // Chapter I pacing: after the Warlord falls, send the player back to Rowan for context
        // before the Spire arc begins.
        if (mainQuest)
            mainQuest.step = Math.max(Number(mainQuest.step) || 0, 1.5);
        flags.goblinRowanDebriefPending = true;
        addLog && addLog('The Goblin Warlord falls. Return to Elder Rowan — he will tell you what this woke.', 'system');
        setScene &&
            setScene('The Warlord Falls', [
                'The Goblin Warlord collapses into the mud with a sound like splitting bark.',
                '',
                'For a moment, the forest is quiet — not peaceful. Listening.',
                '',
                'Something in the air tastes like old smoke and stone. You should return to Elder Rowan.'
            ].join('\n'));
        updateQuestBox(state);
        saveGame && saveGame();
        return true;
    }
    if (enemy.id === 'dragon') {
        flags.dragonDefeated = true;
        flags.marshUnlocked = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 3);
        addLog && addLog('With a final roar, the Void‑Touched Dragon collapses.', 'system');
        setScene &&
            setScene('Ruined Spire – Silent', 'The Dragon is slain. Yet the void‑sickness in the land does not fade — something deeper still feeds it.');
        updateQuestBox(state);
        return true;
    }
    if (enemy.id === 'marshWitch') {
        flags.marshWitchDefeated = true;
        flags.frostpeakUnlocked = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 4);
        addLog && addLog('The Marsh Witch dissolves into ash and stagnant water.', 'system');
        setScene &&
            setScene('Ashen Marsh – Quiet', 'The fen’s lantern‑fog thins. A cold wind points north — toward the mountains.');
        updateQuestBox(state);
        return true;
    }
    if (enemy.id === 'frostGiant') {
        flags.frostGiantDefeated = true;
        flags.catacombsUnlocked = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 5);
        addLog && addLog('The Frostpeak Giant crashes into the snow with a thunderous boom.', 'system');
        setScene &&
            setScene('Frostpeak Pass – Open', 'The pass is cleared. Beneath the meltwater, old stone steps sink into darkness — the entrance to sunken catacombs.');
        updateQuestBox(state);
        return true;
    }
    if (enemy.id === 'lich') {
        flags.lichDefeated = true;
        flags.keepUnlocked = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 6);
        addLog && addLog('The Sunken Lich’s phylactery cracks, and the chanting finally stops.', 'system');
        setScene &&
            setScene('Catacombs – Still', 'The dead are quiet. Far away, a black keep drinks the horizon — the corruption’s heart.');
        updateQuestBox(state);
        return true;
    }
    if (enemy.id === 'obsidianKing') {
        flags.obsidianKingDefeated = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 7);
        addLog && addLog('The Obsidian King falls, and the keep’s voidlight gutters like a dying candle.', 'system');
        setScene &&
            setScene('Obsidian Keep – Shattered', 'The throne stands empty. Return to Emberwood and speak with Elder Rowan.');
        updateQuestBox(state);
        return true;
    }
    // --- Chapter III (Patch 1.2.5): The Hollow Crown ------------------------
    if (enemy.id === 'crownShade') {
        flags.chapter3CrownEchoTaken = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 17);
        addLog && addLog('You seize the Crown‑Echo. It is cold as a promise kept by someone else.', 'good');
        setScene &&
            setScene('Crown‑Echo', 'The thing you took is not an object. It is a memory with teeth. Bring it to the Bark‑Scribe.');
        updateQuestBox(state);
        return true;
    }
    if (enemy.id === 'mirrorWarden') {
        flags.chapter3StarIronPin = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 19);
        addLog && addLog('The Mirror Warden shatters. In the debris: a Star‑Iron Pin that refuses to rust.', 'good');
        setScene &&
            setScene('Star‑Iron Pin', 'A cold weight that can anchor a vow — or a lie. The next piece waits in the catacombs.');
        updateQuestBox(state);
        return true;
    }
    if (enemy.id === 'graveLatchWarden') {
        flags.chapter3GraveLatch = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 20);
        addLog && addLog('The Grave‑Latch breaks free. The lock yields — and the catacombs exhale.', 'good');
        setScene &&
            setScene('Grave‑Latch', 'You carry a key that was never meant to be carried. Return to Emberwood and decide who leads the ritual.');
        updateQuestBox(state);
        return true;
    }
    if (enemy.id === 'hollowRegent') {
        flags.hollowRegentDefeated = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 22);
        addLog && addLog('The Hollow Regent falls. The crown hits the ground without sound.', 'good');
        setScene &&
            setScene('The Hollow Crown', 'The forest is listening, and for the first time it does not interrupt. Return to Emberwood and choose what happens next.');
        updateQuestBox(state);
        return true;
    }
    // --- Chapter IV (Patch 1.2.5): The Rootbound Court --------------------
    if (enemy.id === 'echoArchivist') {
        flags.chapter4VerdantLens = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 25);
        addLog && addLog('The Archivist breaks. In the shards: a Verdant Lens that makes lies flare green.', 'good');
        setScene &&
            setScene('Verdant Lens', 'The lens is cold and damp, like leaf‑mold. Through it, even your own thoughts look edited. The Court will want writs next.');
        updateQuestBox(state);
        return true;
    }
    if (enemy.id === 'iceCensor') {
        flags.chapter4FrozenWrit = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 27);
        addLog && addLog('The Ice Censor fractures. A Frozen Writ slides from its sleeve like a confession.', 'good');
        setScene &&
            setScene('Frozen Writ', 'The paper is rimed and rigid. The ink does not run — it bites. One writ remains below, where the dead keep records.');
        updateQuestBox(state);
        return true;
    }
    if (enemy.id === 'boneNotary') {
        flags.chapter4BoneWrit = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 28);
        addLog && addLog('The Bone Notary crumbles. Its stamp remains: a Bone Writ, signed in silence.', 'good');
        setScene &&
            setScene('Bone Writ', 'You carry the last writ like a weight. The Court’s chain now points to the keep — where oaths are forged into shackles.');
        updateQuestBox(state);
        return true;
    }
    if (enemy.id === 'oathBinder') {
        flags.chapter4SealOfVerdict = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 29);
        addLog && addLog('The Oathbinder falls. A Seal of Verdict clicks open in your palm.', 'good');
        setScene &&
            setScene('Seal of Verdict', 'With writs and seal, the Court can be summoned — or challenged. Return to the Blackbark Gate at Night.');
        updateQuestBox(state);
        return true;
    }
    if (enemy.id === 'rootboundMagistrate') {
        flags.chapter4MagistrateDefeated = true;
        if (mainQuest)
            mainQuest.step = Math.max(mainQuest.step || 0, 30);
        addLog && addLog('The Magistrate unravels. Its sigil remains, warm with judgement.', 'good');
        setScene &&
            setScene('Magistrate’s Sigil', 'The Court has been forced to listen. Return to Emberwood and decide how you answer the verdict.');
        updateQuestBox(state);
        return true;
    }
    return false;
}
//# sourceMappingURL=questSystem.js.map