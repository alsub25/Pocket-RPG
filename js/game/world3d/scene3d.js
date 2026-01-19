// js/game/world3d/scene3d.js
// 3D World Scene using Canvas 2.5D rendering
//
// This module creates and manages a 3D-like world that players can explore.
// Uses canvas 2D context with perspective rendering for a pseudo-3D effect.

let canvas, ctx;
let player = { x: 0, z: 0, angle: 0, height: 1.7 };
let moveState = { forward: false, backward: false, left: false, right: false, rotateLeft: false, rotateRight: false };
const MOVE_SPEED = 0.05;
const ROTATE_SPEED = 0.03;

// World objects
const trees = [];
const buildings = [];

/**
 * Initialize the 3D world
 * @param {HTMLElement} container - DOM element to render into
 */
export function init3DWorld(container) {
  // Create canvas
  canvas = document.createElement('canvas');
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  canvas.style.display = 'block';
  container.appendChild(canvas);
  
  ctx = canvas.getContext('2d');
  
  // Initialize world objects
  initWorldObjects();
  
  // Handle window resize
  window.addEventListener('resize', onWindowResize);
  
  // Start render loop
  animate();
  
  console.log('3D World initialized');
}

/**
 * Initialize world objects (trees, buildings)
 */
function initWorldObjects() {
  // Create some trees
  for (let i = 0; i < 30; i++) {
    trees.push({
      x: (Math.random() - 0.5) * 40,
      z: (Math.random() - 0.5) * 40,
      height: 3 + Math.random() * 2
    });
  }
  
  // Create buildings
  buildings.push({ x: 10, z: 5, width: 4, depth: 3, height: 4, name: 'Tavern' });
  buildings.push({ x: -10, z: 5, width: 4, depth: 4, height: 3, name: 'Shop' });
  buildings.push({ x: 0, z: -15, width: 5, depth: 5, height: 5, name: 'Town Hall' });
}

/**
 * Handle window resize
 */
function onWindowResize() {
  const container = canvas.parentElement;
  if (!container) return;
  
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
}

/**
 * Update player movement
 */
function updateMovement() {
  if (moveState.forward) {
    player.x += Math.sin(player.angle) * MOVE_SPEED;
    player.z += Math.cos(player.angle) * MOVE_SPEED;
  }
  if (moveState.backward) {
    player.x -= Math.sin(player.angle) * MOVE_SPEED;
    player.z -= Math.cos(player.angle) * MOVE_SPEED;
  }
  if (moveState.left) {
    player.x -= Math.cos(player.angle) * MOVE_SPEED;
    player.z += Math.sin(player.angle) * MOVE_SPEED;
  }
  if (moveState.right) {
    player.x += Math.cos(player.angle) * MOVE_SPEED;
    player.z -= Math.sin(player.angle) * MOVE_SPEED;
  }
  if (moveState.rotateLeft) {
    player.angle -= ROTATE_SPEED;
  }
  if (moveState.rotateRight) {
    player.angle += ROTATE_SPEED;
  }
}

/**
 * Project 3D point to 2D screen coordinates
 */
function project(x, y, z) {
  // Translate to camera space
  const dx = x - player.x;
  const dz = z - player.z;
  
  // Rotate by camera angle
  const rotatedX = dx * Math.cos(-player.angle) - dz * Math.sin(-player.angle);
  const rotatedZ = dx * Math.sin(-player.angle) + dz * Math.cos(-player.angle);
  
  // Don't render if behind camera
  if (rotatedZ <= 0.1) return null;
  
  // Perspective projection
  const scale = 400 / rotatedZ;
  const screenX = canvas.width / 2 + rotatedX * scale;
  const screenY = canvas.height / 2 - (y - player.height) * scale;
  
  return { x: screenX, y: screenY, scale: scale, distance: rotatedZ };
}

/**
 * Render the scene
 */
function render() {
  // Clear canvas with sky gradient
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#87ceeb');
  gradient.addColorStop(0.5, '#b0d8f0');
  gradient.addColorStop(1, '#228b22');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw ground
  ctx.fillStyle = '#2a5a2a';
  const groundY = canvas.height / 2;
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
  
  // Collect all renderable objects with distances
  const renderables = [];
  
  // Add trees
  trees.forEach(tree => {
    const base = project(tree.x, 0, tree.z);
    const top = project(tree.x, tree.height, tree.z);
    if (base && top) {
      renderables.push({
        type: 'tree',
        distance: base.distance,
        base: base,
        top: top,
        tree: tree
      });
    }
  });
  
  // Add buildings
  buildings.forEach(building => {
    const corners = [
      project(building.x - building.width/2, 0, building.z - building.depth/2),
      project(building.x + building.width/2, 0, building.z - building.depth/2),
      project(building.x + building.width/2, 0, building.z + building.depth/2),
      project(building.x - building.width/2, 0, building.z + building.depth/2)
    ];
    
    if (corners.every(c => c !== null)) {
      renderables.push({
        type: 'building',
        distance: corners[0].distance,
        corners: corners,
        building: building
      });
    }
  });
  
  // Sort by distance (far to near)
  renderables.sort((a, b) => b.distance - a.distance);
  
  // Render all objects
  renderables.forEach(obj => {
    if (obj.type === 'tree') {
      renderTree(obj);
    } else if (obj.type === 'building') {
      renderBuilding(obj);
    }
  });
  
  // Draw crosshair
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 2;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy);
  ctx.lineTo(cx + 10, cy);
  ctx.moveTo(cx, cy - 10);
  ctx.lineTo(cx, cy + 10);
  ctx.stroke();
}

/**
 * Render a tree
 */
function renderTree(obj) {
  const { base, top, tree } = obj;
  
  // Trunk
  ctx.strokeStyle = '#8b4513';
  ctx.lineWidth = Math.max(1, 3 * base.scale / 100);
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();
  
  // Foliage (circle)
  const foliageY = top.y - 10 * base.scale / 100;
  const foliageRadius = Math.max(2, 20 * base.scale / 100);
  ctx.fillStyle = '#228b22';
  ctx.beginPath();
  ctx.arc(top.x, foliageY, foliageRadius, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Render a building
 */
function renderBuilding(obj) {
  const { corners, building } = obj;
  
  // Draw walls
  ctx.fillStyle = '#a0826d';
  ctx.strokeStyle = '#6b5d50';
  ctx.lineWidth = 2;
  
  ctx.beginPath();
  ctx.moveTo(corners[0].x, corners[0].y);
  for (let i = 1; i < 4; i++) {
    ctx.lineTo(corners[i].x, corners[i].y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Draw roof (simple triangle on top)
  const topCorners = corners.map(c => {
    const p = project(
      building.x + (c.x > canvas.width / 2 ? building.width/2 : -building.width/2),
      building.height,
      building.z + (corners.indexOf(c) > 1 ? building.depth/2 : -building.depth/2)
    );
    return p;
  }).filter(p => p !== null);
  
  if (topCorners.length >= 4) {
    ctx.fillStyle = '#8b0000';
    ctx.beginPath();
    ctx.moveTo(topCorners[0].x, topCorners[0].y);
    for (let i = 1; i < topCorners.length; i++) {
      ctx.lineTo(topCorners[i].x, topCorners[i].y);
    }
    ctx.closePath();
    ctx.fill();
  }
  
  // Draw building name if close enough
  if (obj.distance < 5) {
    ctx.fillStyle = 'white';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(building.name, corners[0].x, corners[0].y - 20);
  }
}

/**
 * Animation loop
 */
function animate() {
  updateMovement();
  render();
  requestAnimationFrame(animate);
}

/**
 * Set up keyboard controls
 */
export function setupControls() {
  document.addEventListener('keydown', (event) => {
    switch (event.key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        moveState.forward = true;
        break;
      case 's':
      case 'arrowdown':
        moveState.backward = true;
        break;
      case 'a':
        moveState.left = true;
        break;
      case 'd':
        moveState.right = true;
        break;
      case 'arrowleft':
        moveState.rotateLeft = true;
        break;
      case 'arrowright':
        moveState.rotateRight = true;
        break;
    }
  });
  
  document.addEventListener('keyup', (event) => {
    switch (event.key.toLowerCase()) {
      case 'w':
      case 'arrowup':
        moveState.forward = false;
        break;
      case 's':
      case 'arrowdown':
        moveState.backward = false;
        break;
      case 'a':
        moveState.left = false;
        break;
      case 'd':
        moveState.right = false;
        break;
      case 'arrowleft':
        moveState.rotateLeft = false;
        break;
      case 'arrowright':
        moveState.rotateRight = false;
        break;
    }
  });
}

/**
 * Clean up 3D world resources
 */
export function dispose3DWorld() {
  if (canvas && canvas.parentElement) {
    canvas.parentElement.removeChild(canvas);
  }
  
  window.removeEventListener('resize', onWindowResize);
  
  // Reset move state
  moveState = { forward: false, backward: false, left: false, right: false, rotateLeft: false, rotateRight: false };
  
  console.log('3D World disposed');
}

/**
 * Get current player position (for game state sync)
 */
export function getPlayerPosition() {
  return {
    x: player.x,
    y: 0,
    z: player.z,
    angle: player.angle
  };
}

/**
 * Set player position (for game state sync)
 */
export function setPlayerPosition(x, y, z, angle) {
  player.x = x;
  player.z = z;
  if (angle !== undefined) player.angle = angle;
}
