// js/game/combat/companionRuntime.js
// Companion mechanics extracted from engine.js.
//
// Design goals:
// - Keep engine.js as orchestration + UI wiring.
// - Keep companion combat behavior identical (AI scoring, ward ticking, reflect, etc.).
// - Avoid circular imports by using dependency injection.
function _reqFn(deps, key) {
    const fn = deps && deps[key];
    if (typeof fn !== 'function') {
        throw new Error(`[companionRuntime] Missing required function dependency: ${key}`);
    }
    return fn;
}
function _reqObj(deps, key) {
    const obj = deps && deps[key];
    if (!obj || typeof obj !== 'object') {
        throw new Error(`[companionRuntime] Missing required object dependency: ${key}`);
    }
    return obj;
}
function _num(n, fallback = 0) {
    const v = Number(n);
    return Number.isFinite(v) ? v : fallback;
}
export function createCompanionRuntime(deps) {
    const getState = _reqFn(deps, 'getState');
    const addLog = _reqFn(deps, 'addLog');
    const rand = _reqFn(deps, 'rand');
    const randInt = _reqFn(deps, 'randInt');
    const updateHUD = _reqFn(deps, 'updateHUD');
    const updateEnemyPanel = _reqFn(deps, 'updateEnemyPanel');
    const saveGame = _reqFn(deps, 'saveGame');
    const playerHasTalent = _reqFn(deps, 'playerHasTalent');
    const applyEnemyAtkDown = _reqFn(deps, 'applyEnemyAtkDown');
    const roundIntStable = _reqFn(deps, 'roundIntStable');
    const getActiveDifficultyConfig = _reqFn(deps, 'getActiveDifficultyConfig');
    const handleEnemyDefeat = _reqFn(deps, 'handleEnemyDefeat');
    const companionDefs = _reqObj(deps, 'companionDefs');
    const companionAbilities = _reqObj(deps, 'companionAbilities');
    function computeCompanionScaledStats(def, playerLevel) {
        const lvl = Math.max(1, Math.floor(_num(playerLevel, 1)));
        // These scale factors are intentionally modest to keep companions supportive, not dominant.
        const atk = (_num(def.baseAttack, 6) + Math.floor(lvl * _num(def.scaleAtkPerLevel, 1.5)));
        const hpBonus = (_num(def.baseHpBonus, 0) + Math.floor(lvl * _num(def.scaleHpPerLevel, 4)));
        return { atk, hpBonus };
    }
    function createCompanionInstance(id) {
        const def = companionDefs[id];
        if (!def)
            return null;
        const st = getState();
        const p = st && st.player;
        const level = p ? _num(p.level, 1) : 1;
        const scaled = computeCompanionScaledStats(def, level);
        return {
            id: def.id,
            name: def.name,
            role: def.role,
            behavior: def.behavior,
            description: def.description,
            // Scaled stats (dynamic)
            attack: scaled.atk,
            hpBonus: scaled.hpBonus,
            // Track what we've actually applied to the player so we can rescale safely.
            appliedHpBonus: scaled.hpBonus,
            // Ability kit
            abilities: def.abilities ? [...def.abilities] : [],
            abilityCooldowns: {},
            // runtime / behavior
            lastAbilityUsed: null,
            wardActive: false,
            mirrorReflectTurns: 0
        };
    }
    /**
     * Rescale the active companion whenever player level changes (or on load).
     * This keeps companion attack and HP bonus scaling with the hero.
     */
    function rescaleActiveCompanion(opts) {
        const st = getState();
        const p = st && st.player;
        const comp = st && st.companion;
        if (!p || !comp)
            return;
        const def = companionDefs[comp.id];
        if (!def)
            return;
        const scaled = computeCompanionScaledStats(def, p.level);
        // Attack is just a runtime number.
        comp.attack = scaled.atk;
        // HP bonus is applied directly to player.maxHp; adjust by delta.
        const prev = _num(comp.appliedHpBonus ?? comp.hpBonus, 0);
        const next = _num(scaled.hpBonus, 0);
        const delta = next - prev;
        comp.hpBonus = next;
        comp.appliedHpBonus = next;
        if (delta !== 0) {
            p.maxHp = Math.max(1, _num(p.maxHp, 1) + delta);
            // Optional heal on positive scaling; clamp on negative scaling.
            if (delta > 0) {
                const heal = opts && opts.noHeal ? 0 : delta;
                p.hp = Math.min(p.maxHp, _num(p.hp, p.maxHp) + heal);
            }
            else {
                if (_num(p.hp, 0) > p.maxHp)
                    p.hp = p.maxHp;
            }
        }
    }
    function dismissCompanion(silent) {
        const st = getState();
        if (!st || !st.companion)
            return;
        if (!silent)
            addLog(st.companion.name + ' leaves your side.', 'system');
        const inst = st.companion;
        // Remove the applied HP bonus (safe even if the companion was rescaled).
        const applied = _num(inst.appliedHpBonus ?? inst.hpBonus, 0);
        if (st.player && applied) {
            st.player.maxHp = Math.max(1, _num(st.player.maxHp, 1) - applied);
            if (_num(st.player.hp, 0) > st.player.maxHp) {
                st.player.hp = st.player.maxHp;
            }
            updateHUD();
        }
        st.companion = null;
        saveGame();
    }
    function grantCompanion(id) {
        const st = getState();
        const inst = createCompanionInstance(id);
        if (!inst) {
            addLog('Failed to summon companion.', 'system');
            return;
        }
        // If you already had one, cleanly dismiss it first.
        if (st && st.companion) {
            dismissCompanion(true);
        }
        if (!st)
            return;
        st.companion = inst;
        addLog(inst.name + ' agrees to join your journey.', 'good');
        // Apply passive HP bonus (tracked via appliedHpBonus)
        if (st.player && inst.appliedHpBonus) {
            st.player.maxHp += inst.appliedHpBonus;
            st.player.hp = Math.min(st.player.maxHp, _num(st.player.hp, st.player.maxHp) + inst.appliedHpBonus);
            updateHUD();
        }
        saveGame();
    }
    function calcCompanionDamage(companion, isMagic) {
        const st = getState();
        const enemy = st && st.currentEnemy;
        const p = st && st.player;
        if (!enemy || !companion)
            return 0;
        const base = _num(companion.attack, 0);
        const defense = isMagic
            ? 100 / (100 + (_num(enemy.magicRes, 0) + _num(enemy.magicResBuff, 0)) * 8)
            : 100 / (100 + (_num(enemy.armor, 0) + _num(enemy.armorBuff, 0)) * 7);
        let dmg = base * defense;
        const variance = 0.85 + rand('ability.variance') * 0.3;
        dmg *= variance;
        // Paladin talent: Avenging Strike (+12% physical vs low-health targets)
        if (p && p.classId === 'paladin' && playerHasTalent(p, 'paladin_avenging_strike') && enemy) {
            const mhp = _num(enemy.maxHp || enemy.hp, 0);
            if (mhp > 0) {
                const hpPct = _num(enemy.hp, 0) / mhp;
                if (hpPct > 0 && hpPct <= 0.30)
                    dmg *= 1.12;
            }
        }
        // Rogue talents
        if (p && p.classId === 'rogue' && playerHasTalent(p, 'rogue_exploit_wounds') && enemy && enemy.bleedTurns && enemy.bleedTurns > 0) {
            dmg *= 1.10;
        }
        if (p && p.classId === 'rogue' && playerHasTalent(p, 'rogue_execution') && enemy) {
            const mhp = _num(enemy.maxHp || enemy.hp, 0);
            if (mhp > 0) {
                const hpPct = _num(enemy.hp, 0) / mhp;
                if (hpPct > 0 && hpPct <= 0.30)
                    dmg *= 1.15;
            }
        }
        // Berserker talent: Executioner (+15% physical vs low-health targets)
        if (p && p.classId === 'berserker' && playerHasTalent(p, 'berserker_executioner') && enemy) {
            const mhp = _num(enemy.maxHp || enemy.hp, 0);
            if (mhp > 0) {
                const hpPct = _num(enemy.hp, 0) / mhp;
                if (hpPct > 0 && hpPct <= 0.30)
                    dmg *= 1.15;
            }
        }
        dmg = Math.max(1, roundIntStable(dmg));
        return dmg;
    }
    function canUseCompanionAbility(comp, abilityId) {
        if (!comp || !comp.abilities)
            return false;
        const ab = companionAbilities[abilityId];
        if (!ab)
            return false;
        const cd = comp.abilityCooldowns && comp.abilityCooldowns[abilityId];
        return !cd || cd <= 0;
    }
    // Execute ability: returns textual description
    function useCompanionAbility(comp, abilityId) {
        const st = getState();
        const enemy = st && st.currentEnemy;
        const p = st && st.player;
        const ab = companionAbilities[abilityId];
        if (!ab || !comp || !enemy || !p)
            return '';
        // mark cooldown
        comp.abilityCooldowns[abilityId] = ab.cooldown || 3;
        comp.lastAbilityUsed = abilityId;
        if (ab.type === 'damage') {
            const baseStat = Math.round((_num(comp.attack, 0) + _num(p.stats && p.stats.attack, 0) * 0.15) * _num(ab.potency, 1));
            let dmg = Math.max(1, Math.round(baseStat * (0.9 + rand('ability.scaleRoll') * 0.3)));
            if (ab.critSpike && rand('ability.critSpike') < ab.critSpike) {
                const spike = Math.round(dmg * 0.6);
                dmg += spike;
                addLog(comp.name + ' lands a devastating strike for ' + spike + ' bonus damage!', 'good');
            }
            enemy.hp -= dmg;
            if (ab.stunTurns)
                enemy.stunTurns = (_num(enemy.stunTurns, 0) + ab.stunTurns);
            return comp.name + ' uses ' + ab.name + ', dealing ' + dmg + ' damage.';
        }
        if (ab.type === 'shield+damage') {
            const dmg = Math.round(_num(comp.attack, 0) * _num(ab.potency, 1.0));
            enemy.hp -= dmg;
            const shield = Math.round((_num(ab.shieldBase, 10)) + _num(p.level, 1) * 1.5);
            p.status.shield = _num(p.status.shield, 0) + shield;
            return comp.name + ' uses ' + ab.name + ': deals ' + dmg + ' and grants ' + shield + ' shield.';
        }
        if (ab.type === 'heal') {
            const missing = Math.max(0, _num(p.maxHp, 0) - _num(p.hp, 0));
            const healAmount = Math.max(5, Math.round(_num(p.maxHp, 0) * _num(ab.potency, 0.25) + missing * 0.12));
            const before = _num(p.hp, 0);
            p.hp = Math.min(_num(p.maxHp, before), before + healAmount);
            return comp.name + ' uses ' + ab.name + ' and restores ' + (p.hp - before) + ' HP.';
        }
        if (ab.type === 'damage+debuff') {
            const dmg = Math.round(_num(comp.attack, 0) * _num(ab.potency, 1.0));
            enemy.hp -= dmg;
            applyEnemyAtkDown(enemy, ab.atkDown || 2, ab.debuffTurns || 2);
            return comp.name + ' uses ' + ab.name + ', deals ' + dmg + ' and reduces enemy Attack.';
        }
        if (ab.type === 'ward') {
            comp.wardActive = true;
            comp.wardTurns = ab.wardTurns || 3;
            comp.wardPotency = ab.potency || 0.06;
            comp.wardSource = abilityId;
            const heal = Math.round(_num(p.maxHp, 0) * _num(comp.wardPotency, 0));
            const before = _num(p.hp, 0);
            p.hp = Math.min(_num(p.maxHp, before), before + heal);
            const actual = p.hp - before;
            return comp.name + ' plants a ward for ' + comp.wardTurns + ' turns and restores ' + actual + ' HP.';
        }
        if (ab.type === 'resource') {
            const gain = Math.max(4, Math.round(_num(p.maxResource, 0) * _num(ab.potency, 0.35)));
            const before = _num(p.resource, 0);
            p.resource = Math.min(_num(p.maxResource, before), before + gain);
            p.status.buffFromCompanion = _num(p.status.buffFromCompanion, 0) + 1;
            p.status.buffFromCompanionTurns = ab.buffTurns || 1;
            return comp.name + ' uses ' + ab.name + ', restoring ' + (p.resource - before) + ' ' + p.resourceName + '.';
        }
        if (ab.type === 'damage+reflect') {
            const dmg = Math.round(_num(comp.attack, 0) * _num(ab.potency, 1.0));
            enemy.hp -= dmg;
            comp.mirrorReflectTurns = ab.reflectTurns || 2;
            comp.mirrorReflectPct = ab.reflectPct || 0.35;
            return comp.name + ' uses ' + ab.name + ', deals ' + dmg + ' and will reflect some damage for ' + comp.mirrorReflectTurns + ' turns.';
        }
        return '';
    }
    function companionActIfPresent() {
        const st = getState();
        const comp = st && st.companion;
        const enemy = st && st.currentEnemy;
        const p = st && st.player;
        if (!comp || !enemy || !st || !st.inCombat || !p)
            return;
        // Ensure learning memory exists
        if (!comp.memory) {
            comp.memory = {
                abilityStats: {},
                exploration: 0.2
            };
        }
        function ensureAbilityStat(aid) {
            if (!comp.memory.abilityStats[aid]) {
                comp.memory.abilityStats[aid] = { value: 0, uses: 0, wins: 0 };
            }
            return comp.memory.abilityStats[aid];
        }
        function estimatePlainDamage() {
            try {
                return Math.max(1, calcCompanionDamage(comp, false));
            }
            catch (_) {
                return _num(comp.attack, 6);
            }
        }
        function scoreAbility(abilityId) {
            const ab = companionAbilities[abilityId];
            if (!ab)
                return -9999;
            if (ab.type === 'ward' && comp.wardActive)
                return -9999;
            if (!canUseCompanionAbility(comp, abilityId))
                return -9999;
            let score = 0;
            const potency = _num(ab.potency, 1);
            score += potency * 12;
            const remainingCd = _num(comp.abilityCooldowns && comp.abilityCooldowns[abilityId], 0);
            score -= remainingCd * 2;
            const playerHpPct = _num(p.hp, 0) / Math.max(1, _num(p.maxHp, 1));
            const enemyHpPct = _num(enemy.hp, 0) / Math.max(1, _num(enemy.maxHp, 1));
            if (ab.type === 'heal') {
                if (playerHpPct >= 0.95)
                    return -9999;
                score += (1 - playerHpPct) * 80;
                if (enemyHpPct < 0.25)
                    score -= 15;
            }
            if (ab.type === 'ward') {
                if (enemyHpPct > 0.65 && !comp.wardActive)
                    score += 45;
                if (!comp.wardActive)
                    score += 20;
            }
            if (ab.type === 'shield+damage' || ab.type === 'ward') {
                const missing = _num(p.maxHp, 1) - _num(p.hp, 0);
                score += Math.min(40, (missing / Math.max(1, _num(p.maxHp, 1))) * 50);
                if (!_num(p.status && p.status.shield, 0) || _num(p.status && p.status.shield, 0) < 6)
                    score += 6;
            }
            if (ab.type === 'damage' || ab.type === 'damage+debuff') {
                score += enemyHpPct * 40;
                const expected = _num(comp.attack, 6) * potency * 0.9;
                if (expected >= _num(enemy.hp, 0) - 6)
                    score += 60;
            }
            if (ab.type === 'damage+debuff') {
                if (!_num(enemy.debuffTurns, 0) || _num(enemy.debuffTurns, 0) <= 0)
                    score += 18;
                if (_num(p.status && p.status.buffFromCompanionTurns, 0) > 0)
                    score += 10;
            }
            if (ab.type === 'resource') {
                const resourcePct = _num(p.resource, 0) / Math.max(1, _num(p.maxResource, 1));
                score += (1 - resourcePct) * 60;
            }
            if (ab.critSpike && (_num(p.stats && p.stats.critChance, 0) > 12 || enemyHpPct > 0.6))
                score += 12;
            score -= (_num(ab.cooldown, 3)) * 1.2;
            const smart = _num(getActiveDifficultyConfig().aiSmartness, 0.7);
            const noise = (rand('ai.noise') - 0.5) * (1 - smart) * 6;
            score += noise;
            const stat = ensureAbilityStat(abilityId);
            score += _num(stat.value, 0) * 10;
            score -= Math.log(1 + _num(stat.uses, 0)) * 0.9;
            return score;
        }
        const readyAbilities = (comp.abilities || []).filter((aid) => canUseCompanionAbility(comp, aid));
        let chosenAbility = null;
        let chosenScore = -Infinity;
        if (readyAbilities.length > 0) {
            const scored = readyAbilities.map((aid) => ({ id: aid, score: scoreAbility(aid) }));
            scored.forEach((s) => {
                if (s.score > chosenScore) {
                    chosenAbility = s.id;
                    chosenScore = s.score;
                }
            });
            // epsilon-greedy exploration
            const eps = _num(comp.memory.exploration, 0.2);
            if (rand('ai.epsilon') < eps && readyAbilities.length > 1) {
                const pool = readyAbilities.filter((aid) => aid !== chosenAbility);
                const pick = pool[randInt(0, pool.length - 1, 'ai.epsPick')];
                if (pick) {
                    chosenAbility = pick;
                    chosenScore = scoreAbility(pick);
                }
                comp.memory.exploration = Math.max(0.03, eps * 0.995);
            }
        }
        const plainDamageEstimate = estimatePlainDamage();
        const damageFallbackScore = plainDamageEstimate * 1.6;
        if (!chosenAbility || chosenScore < damageFallbackScore - 2) {
            const dmg = Math.max(1, calcCompanionDamage(comp, false));
            enemy.hp -= dmg;
            addLog(comp.name + ' strikes ' + enemy.name + ' for ' + dmg + ' damage.', 'good', { domain: 'combat', kind: 'damage', actor: 'companion', breakdown: null });
            const pseudo = '_plainAttack';
            if (!comp.memory.abilityStats[pseudo])
                comp.memory.abilityStats[pseudo] = { value: 0, uses: 0, wins: 0 };
            const stat = comp.memory.abilityStats[pseudo];
            stat.uses += 1;
            let reward = (dmg / Math.max(1, _num(enemy.maxHp, 1))) * 1.0;
            if (enemy.hp <= 0)
                reward += 2.0;
            stat.value = (stat.value * (stat.uses - 1) + reward) / stat.uses;
            if (enemy.hp <= 0) {
                handleEnemyDefeat(enemy);
                return;
            }
            return;
        }
        // Snapshot pre-use values to compute observed reward
        const preEnemyHp = _num(enemy.hp, 0);
        const prePlayerHp = _num(p.hp, 0);
        const desc = useCompanionAbility(comp, chosenAbility) || '';
        const postEnemyHp = _num(enemy.hp, 0);
        const postPlayerHp = _num(p.hp, 0);
        const dmgDone = Math.max(0, preEnemyHp - postEnemyHp);
        const healDone = Math.max(0, postPlayerHp - prePlayerHp);
        let reward = 0;
        if (dmgDone > 0)
            reward += (dmgDone / Math.max(1, _num(enemy.maxHp, 1))) * 1.2;
        if (healDone > 0)
            reward += (healDone / Math.max(1, _num(p.maxHp, 1))) * 1.5;
        if (postEnemyHp <= 0)
            reward += 2.0;
        const abUsed = companionAbilities[chosenAbility] || {};
        if (abUsed.type === 'damage+debuff' && (!_num(enemy.debuffTurns, 0) || _num(enemy.debuffTurns, 0) > 0)) {
            reward += 0.4;
        }
        if (abUsed.type === 'shield+damage' && _num(p.status && p.status.shield, 0) > 0) {
            reward += 0.35;
        }
        if (abUsed.type === 'ward' && comp.wardActive) {
            reward += 0.3;
        }
        // Delayed ward value estimation
        if (abUsed.type === 'ward') {
            const expectedHeal = _num(comp.wardPotency, 0.05) * _num(p.maxHp, 1) * _num(comp.wardTurns, 2);
            reward += (expectedHeal / Math.max(1, _num(p.maxHp, 1))) * 1.4;
        }
        const stat = ensureAbilityStat(chosenAbility);
        stat.uses += 1;
        stat.wins += postEnemyHp <= 0 ? 1 : 0;
        const alpha = 1 / Math.max(4, Math.min(20, stat.uses));
        stat.value = (1 - alpha) * _num(stat.value, 0) + alpha * reward;
        if (desc)
            addLog(desc, 'good');
        updateHUD();
        updateEnemyPanel();
        if (postEnemyHp <= 0) {
            handleEnemyDefeat();
            return;
        }
    }
    function tickCompanionCooldowns() {
        const st = getState();
        const c = st && st.companion;
        if (!c)
            return;
        if (c.abilityCooldowns) {
            Object.keys(c.abilityCooldowns).forEach((k) => {
                if (!c.abilityCooldowns[k])
                    return;
                c.abilityCooldowns[k] = Math.max(0, _num(c.abilityCooldowns[k], 0) - 1);
            });
        }
        // ward ticking + per-turn heal (if present)
        if (c.wardActive) {
            const p = st && st.player;
            if (p && _num(c.wardPotency, 0) && _num(p.hp, 0) < _num(p.maxHp, 1)) {
                const heal = Math.max(1, Math.round(_num(p.maxHp, 1) * _num(c.wardPotency, 0)));
                const before = _num(p.hp, 0);
                p.hp = Math.min(_num(p.maxHp, before), before + heal);
                const actual = p.hp - before;
                if (actual > 0) {
                    addLog(c.name + "'s ward restores " + actual + ' HP.', 'good');
                }
                updateHUD();
            }
            c.wardTurns = Math.max(0, _num(c.wardTurns, 0) - 1);
            if (!c.wardTurns) {
                c.wardActive = false;
                c.wardPotency = 0;
                c.wardSource = null;
                addLog(c.name + "'s ward fades.", 'system');
            }
        }
        if (_num(c.mirrorReflectTurns, 0) > 0) {
            c.mirrorReflectTurns = Math.max(0, _num(c.mirrorReflectTurns, 0) - 1);
            if (c.mirrorReflectTurns === 0) {
                addLog(c.name + "'s reflection subsides.", 'system');
            }
        }
    }
    return {
        // Exposed for stat recalcs (engine recomputes maxHp from scratch).
        computeCompanionScaledStats,
        grantCompanion,
        dismissCompanion,
        rescaleActiveCompanion,
        companionActIfPresent,
        tickCompanionCooldowns
    };
}
//# sourceMappingURL=companionRuntime.js.map