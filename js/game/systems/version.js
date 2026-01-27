// js/game/systems/version.js
// Single source of truth for the *current build* label/version.
//
// Keep this file tiny and dependency-free so it can be imported during early boot
// (bootstrap) and from core systems (engine.js, changelog, diagnostics, etc.).

export const GAME_PATCH = '1.3.0';
export const GAME_PATCH_NAME = 'Major Content Expansion - New Game Systems';

// Used by bootstrap version picker + some UI labels.
export const GAME_FULL_LABEL = `Emberwood Patch V${GAME_PATCH} — ${GAME_PATCH_NAME}`;
