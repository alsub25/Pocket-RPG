/**
 * spellsModal.js
 * 
 * Spells modal wrapper that bridges gameOrchestrator to the spellbook modal.
 * Extracted from gameOrchestrator.js to reduce file size.
 * 
 * ~41 lines extracted (plus the variable declaration).
 */

/**
 * Creates the spells modal wrapper with all necessary dependencies injected.
 * @returns {Object} Object with openSpellsModal function and getSpellbookModal getter
 */
export function createSpellsModal({
    // Core state
    state,
    
    // Spell system
    createSpellbookModal,
    ABILITIES,
    MAX_EQUIPPED_SPELLS,
    ABILITY_UPGRADE_RULES,
    ensurePlayerSpellSystems,
    normalizeElementType,
    clampNumber,
    buildAbilityContext,
    getActiveDifficultyConfig,
    getAliveEnemies,
    getPlayerElementalBonusPct,
    getEnemyAffinityMultiplier,
    getEnemyElementalResistPct,
    playerHasTalent,
    _getMageRhythmBonus,
    _roundIntStable,
    getAbilityUpgrade,
    getEffectiveAbilityCost,
    
    // UI functions
    addLog,
    openModal,
    closeModal,
    
    // Game functions
    saveGame,
    dispatchGameCommand,
    useAbilityInCombat
}) {
    let _spellbookModal = null

    function _getSpellbookModal() {
        if (_spellbookModal) return _spellbookModal
        _spellbookModal = createSpellbookModal({
            getState: () => state,
            ABILITIES,
            MAX_EQUIPPED_SPELLS,
            ABILITY_UPGRADE_RULES,
            ensurePlayerSpellSystems,
            normalizeElementType,
            clampNumber,
            buildAbilityContext,
            getActiveDifficultyConfig,
            getAliveEnemies,
            getPlayerElementalBonusPct,
            getEnemyAffinityMultiplier,
            getEnemyElementalResistPct,
            playerHasTalent,
            _getMageRhythmBonus,
            _roundIntStable,
            addLog,
            openModal,
            closeModal,
            saveGame,
            useAbilityInCombat: (abilityId) => {
                const dispatched = dispatchGameCommand('COMBAT_CAST_ABILITY', {
                    abilityId
                })

                if (!dispatched) {
                    try { useAbilityInCombat(abilityId) } catch (_) {}
                }
            },
            getAbilityUpgrade,
            getEffectiveAbilityCost
        })
        return _spellbookModal
    }

    function openSpellsModal(inCombat) {
        return _getSpellbookModal().openSpellsModal(inCombat)
    }

    return {
        openSpellsModal,
        getSpellbookModal: _getSpellbookModal
    }
}
