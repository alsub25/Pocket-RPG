// js/game/combat/statusEngine.js
// Status engine module (combat status containers, synergies, and turn-based ticking).
//
// This module avoids importing engine internals directly.
// The engine provides helpers + state access via dependency injection.
export function createStatusEngine(deps) {
    const { getState, clampNumber, ensurePlayerSpellSystems, playerHasTalent, normalizeElementType, addLog, } = deps;
    function resetPlayerCombatStatus(p) {
        if (!p)
            return;
        ensurePlayerSpellSystems(p);
        const st = p.status || (p.status = {});
        // Clear fight-scoped effects.
        st.bleedTurns = 0;
        st.bleedDamage = 0;
        st.shield = 0;
        st.buffAttack = 0;
        st.buffAttackTurns = 0;
        st.buffMagic = 0;
        st.buffMagicTurns = 0;
        st.atkDown = 0;
        st.atkDownTurns = 0;
        st.magicDown = 0;
        st.magicDownTurns = 0;
        st.armorDown = 0;
        st.armorDownTurns = 0;
        st.magicResDown = 0;
        st.magicResDownTurns = 0;
        st.vulnerableTurns = 0;
        st.dmgReductionTurns = 0;
        st.buffFromCompanion = 0;
        st.buffFromCompanionTurns = 0;
        st.evasionBonus = 0;
        st.evasionTurns = 0;
        // Reset per-fight class cadence.
        st.spellCastCount = 0;
        st.firstHitBonusAvailable = true;
        // Patch 1.1.7 class mechanics
        st.comboPoints = 0;
        st.soulShards = 0;
        st.lichTurns = 0;
        st.totemType = '';
        st.totemTurns = 0;
        st.vanishTurns = 0;
        // Talent: Cleric Sanctuary — start combat with a small shield.
        if (playerHasTalent(p, 'cleric_sanctuary')) {
            st.shield = (st.shield || 0) + 20;
        }
    }
    function applyStatusSynergyOnPlayerHit(enemy, damageDealt, elementType, damageType) {
        if (!enemy || enemy.hp <= 0)
            return;
        const et = normalizeElementType(elementType || null);
        const dt = damageType || null;
        // Bleed + Fire => Ignite (DoT)
        if (et === 'fire' && (enemy.bleedTurns || 0) > 0) {
            const extra = Math.max(2, Math.round(damageDealt * 0.12));
            enemy.burnDamage = Math.max(enemy.burnDamage || 0, extra);
            const before = enemy.burnTurns || 0;
            enemy.burnTurns = Math.max(before, 2);
            // Prevent log spam when repeatedly refreshing an existing burn.
            if (before <= 0)
                addLog(enemy.name + ' ignites from the bleeding wound!', 'good');
        }
        // Chilled + Physical => Shatter (bonus burst, consumes chill)
        if (dt === 'physical' && (enemy.chilledTurns || 0) > 0) {
            const burst = Math.max(1, Math.round(damageDealt * 0.18));
            enemy.hp -= burst;
            enemy.chilledTurns = 0;
            addLog('Shatter! ' + enemy.name + ' takes ' + burst + ' bonus damage.', 'good', { domain: 'combat', kind: 'proc', actor: 'player', proc: 'shatter', amount: burst });
        }
    }
    function applyStartOfTurnEffectsPlayer(p) {
        const state = getState();
        if (!p || !p.status)
            return;
        // Bleed ticking (used by enemy abilities)
        if (p.status.bleedTurns &&
            p.status.bleedTurns > 0 &&
            p.status.bleedDamage) {
            if (!(state && state.flags && state.flags.godMode)) {
                p.hp -= p.status.bleedDamage;
            }
            p.status.bleedTurns -= 1;
            addLog('You bleed for ' + p.status.bleedDamage + ' damage.', 'danger', { domain: 'combat', kind: 'status', actor: 'enemy', effect: 'bleed' });
            if (p.status.bleedTurns <= 0) {
                addLog('The bleeding slows.', 'system');
                p.status.bleedDamage = 0;
            }
        }
    }
    function tickPlayerTimedStatuses() {
        const state = getState();
        const p = state.player;
        if (!p || !p.status)
            return;
        const st = p.status;
        // damage reduction
        if (st.dmgReductionTurns > 0) {
            st.dmgReductionTurns -= 1;
            if (st.dmgReductionTurns <= 0) {
                addLog('Your Shield Wall fades.', 'system');
            }
        }
        // vulnerable
        if (st.vulnerableTurns > 0) {
            st.vulnerableTurns -= 1;
            if (st.vulnerableTurns <= 0) {
                addLog('You feel less exposed.', 'system');
            }
        }
        // armor down
        if (st.armorDownTurns > 0) {
            st.armorDownTurns -= 1;
            if (st.armorDownTurns <= 0) {
                st.armorDown = 0;
                addLog('Your footing steadies; your armor holds again.', 'system');
            }
        }
        // magic resist down
        if (st.magicResDownTurns > 0) {
            st.magicResDownTurns -= 1;
            if (st.magicResDownTurns <= 0) {
                st.magicResDown = 0;
                addLog('Arcane resistance returns.', 'system');
            }
        }
        // chilled: reduced outgoing damage (affix / frost)
        if (st.chilledTurns && st.chilledTurns > 0) {
            st.chilledTurns -= 1;
            if (st.chilledTurns <= 0) {
                st.chilledTurns = 0;
                addLog('Warmth returns to your limbs.', 'system');
            }
        }
        // attack down
        if (st.atkDownTurns > 0) {
            st.atkDownTurns -= 1;
            if (st.atkDownTurns <= 0) {
                st.atkDown = 0;
                addLog('Your strength returns.', 'system');
            }
        }
        // magic down
        if (st.magicDownTurns > 0) {
            st.magicDownTurns -= 1;
            if (st.magicDownTurns <= 0) {
                st.magicDown = 0;
                addLog('Your focus returns.', 'system');
            }
        }
        // simple buffs (if present in the build)
        if (st.buffAttackTurns > 0) {
            st.buffAttackTurns -= 1;
            if (st.buffAttackTurns <= 0) {
                st.buffAttack = 0;
                addLog('Your battle rhythm fades.', 'system');
            }
        }
        if (st.buffMagicTurns > 0) {
            st.buffMagicTurns -= 1;
            if (st.buffMagicTurns <= 0) {
                st.buffMagic = 0;
                addLog('Your arcane charge dissipates.', 'system');
            }
        }
        // companion boons
        if (st.buffFromCompanionTurns > 0) {
            st.buffFromCompanionTurns -= 1;
            if (st.buffFromCompanionTurns <= 0) {
                st.buffFromCompanion = 0;
                addLog("Your companion's boon fades.", 'system');
            }
        }
        // evasion windows
        if (st.evasionTurns > 0) {
            st.evasionTurns -= 1;
            if (st.evasionTurns <= 0) {
                st.evasionBonus = 0;
                addLog('You stop moving so evasively.', 'system');
            }
        }
        // Patch 1.1.7: necromancer lich form
        if (st.lichTurns > 0) {
            st.lichTurns -= 1;
            if (st.lichTurns <= 0) {
                addLog('Lich Form fades.', 'system');
            }
        }
        // Patch 1.1.7: shaman totems
        if (st.totemTurns > 0) {
            st.totemTurns -= 1;
            if (st.totemTurns <= 0) {
                st.totemType = '';
                addLog('Your totem crumbles to dust.', 'system');
            }
        }
        // Patch 1.1.7: rogue vanish
        if (st.vanishTurns > 0) {
            st.vanishTurns -= 1;
            if (st.vanishTurns <= 0) {
                addLog('You step back into the light.', 'system');
            }
        }
        // Patch 1.2.0 timed DOT durations (bleed/poison/burning/regen/chill) are
        // advanced at *player turn start* (see applyStartOfTurnEffectsPlayer).
        // Do not tick them here, or they will double-tick.
    }
    return {
        resetPlayerCombatStatus,
        applyStatusSynergyOnPlayerHit,
        applyStartOfTurnEffectsPlayer,
        tickPlayerTimedStatuses,
    };
}
//# sourceMappingURL=statusEngine.js.map