// js/game/world3d/world3dManager.js
// Manages the 3D world integration with the game

import { init3DWorld, setupControls, dispose3DWorld, getPlayerPosition, setPlayerPosition } from './scene3d.js';

let is3DActive = false;
let world3DContainer = null;

/**
 * Initialize 3D world manager
 * @param {Object} engine - Game engine reference
 */
export function initWorld3DManager(engine) {
  console.log('3D World Manager initialized');
  
  // Create the 3D world container in the DOM
  createWorld3DContainer();
  
  // Set up the toggle button
  setupToggleButton(engine);
}

/**
 * Create the 3D world container element
 */
function createWorld3DContainer() {
  world3DContainer = document.createElement('div');
  world3DContainer.id = 'world3D';
  world3DContainer.className = 'world-3d-container hidden';
  world3DContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
    background: #000;
  `;
  
  // Add instructions overlay
  const instructions = document.createElement('div');
  instructions.className = 'world-3d-instructions';
  instructions.innerHTML = `
    <div class="instructions-panel">
      <h3>🎮 3D World Controls</h3>
      <p><strong>Move Forward/Back:</strong> W/S or Up/Down arrows</p>
      <p><strong>Strafe Left/Right:</strong> A/D keys</p>
      <p><strong>Turn Left/Right:</strong> Left/Right arrow keys</p>
      <p>Press the 🌍 button to return to the game</p>
    </div>
  `;
  instructions.style.cssText = `
    position: absolute;
    top: 20px;
    left: 20px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 20px;
    border-radius: 10px;
    font-family: Arial, sans-serif;
    z-index: 1001;
    pointer-events: none;
  `;
  
  world3DContainer.appendChild(instructions);
  document.body.appendChild(world3DContainer);
}

/**
 * Set up the toggle button in the game UI
 */
function setupToggleButton(engine) {
  // Find the HUD top buttons area
  const hudTopButtons = document.querySelector('.hud-top-buttons');
  if (!hudTopButtons) {
    console.warn('Could not find HUD top buttons area');
    return;
  }
  
  // Create toggle button
  const toggleButton = document.createElement('button');
  toggleButton.id = 'btn3DWorld';
  toggleButton.className = 'icon-btn';
  toggleButton.title = '3D World';
  toggleButton.innerHTML = '🌍';
  
  // Insert before the menu button
  const menuButton = document.getElementById('btnGameMenu');
  if (menuButton) {
    hudTopButtons.insertBefore(toggleButton, menuButton);
  } else {
    hudTopButtons.appendChild(toggleButton);
  }
  
  // Add click handler
  toggleButton.addEventListener('click', () => {
    toggle3DWorld(engine);
  });
}

/**
 * Toggle between 3D world and normal game view
 */
export function toggle3DWorld(engine) {
  is3DActive = !is3DActive;
  
  if (is3DActive) {
    // Show 3D world
    world3DContainer.classList.remove('hidden');
    
    // Initialize the 3D scene if not already done
    if (!world3DContainer.querySelector('canvas')) {
      init3DWorld(world3DContainer);
      setupControls();
      
      // Sync player position from game state if available
      const state = engine?.state;
      if (state?.player?.position3D) {
        setPlayerPosition(
          state.player.position3D.x,
          state.player.position3D.y,
          state.player.position3D.z
        );
      }
    }
    
    console.log('3D World activated');
  } else {
    // Hide 3D world
    world3DContainer.classList.add('hidden');
    
    // Save player position to game state
    if (engine?.state?.player) {
      const pos = getPlayerPosition();
      engine.state.player.position3D = pos;
    }
    
    console.log('3D World deactivated');
  }
}

/**
 * Check if 3D world is currently active
 */
export function is3DWorldActive() {
  return is3DActive;
}

/**
 * Clean up 3D world resources
 */
export function cleanup3DWorld() {
  if (is3DActive) {
    dispose3DWorld();
  }
  is3DActive = false;
}
