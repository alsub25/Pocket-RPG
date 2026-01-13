// js/game/systems/version.js
// Single source of truth for the *current build* label/version.
//
// Keep this file tiny and dependency-free so it can be imported during early boot
// (bootstrap) and from core systems (engine.js, changelog, diagnostics, etc.).

export const GAME_PATCH = '1.2.80';
export const GAME_PATCH_NAME = 'The Blackbark Oath — Engine Integration Audit: Area Assets, SavePolicy Adoption & Enemy Sheet Events';

// Used by bootstrap version picker + some UI labels.
export const GAME_FULL_LABEL = `Emberwood Patch V${GAME_PATCH} — ${GAME_PATCH_NAME}`;
