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
const rocks = [];
const paths = [];

// Touch controls state
let touchStartX = 0;
let touchStartY = 0;
let touchMoveX = 0;
let touchMoveY = 0;
let isTouching = false;

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
 * Initialize world objects (trees, buildings, rocks, paths)
 */
function initWorldObjects() {
  // Create some trees with variety
  for (let i = 0; i < 50; i++) {
    trees.push({
      x: (Math.random() - 0.5) * 60,
      z: (Math.random() - 0.5) * 60,
      height: 3 + Math.random() * 2,
      type: Math.random() > 0.5 ? 'pine' : 'oak'
    });
  }
  
  // Create rocks
  for (let i = 0; i < 20; i++) {
    rocks.push({
      x: (Math.random() - 0.5) * 60,
      z: (Math.random() - 0.5) * 60,
      size: 0.3 + Math.random() * 0.5
    });
  }
  
  // Create paths
  paths.push({ x1: -20, z1: 0, x2: 20, z2: 0 }); // Horizontal path
  paths.push({ x1: 0, z1: -20, x2: 0, z2: 20 }); // Vertical path
  
  // Create buildings with more variety
  buildings.push({ x: 10, z: 5, width: 4, depth: 3, height: 4, name: 'Tavern', color: '#a0826d' });
  buildings.push({ x: -10, z: 5, width: 4, depth: 4, height: 3, name: 'Shop', color: '#8b7355' });
  buildings.push({ x: 0, z: -15, width: 5, depth: 5, height: 5, name: 'Town Hall', color: '#9a8a7a' });
  buildings.push({ x: 15, z: -10, width: 3, depth: 3, height: 3.5, name: 'House', color: '#b8a490' });
  buildings.push({ x: -15, z: -8, width: 3.5, depth: 3, height: 3, name: 'Cottage', color: '#a89580' });
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
  // Keyboard controls
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
  
  // Touch controls
  if (isTouching) {
    const deltaX = touchMoveX - touchStartX;
    const deltaY = touchMoveY - touchStartY;
    
    // Swipe up/down to move forward/backward
    if (Math.abs(deltaY) > 20) {
      if (deltaY < 0) {
        player.x += Math.sin(player.angle) * MOVE_SPEED;
        player.z += Math.cos(player.angle) * MOVE_SPEED;
      } else {
        player.x -= Math.sin(player.angle) * MOVE_SPEED;
        player.z -= Math.cos(player.angle) * MOVE_SPEED;
      }
    }
    
    // Swipe left/right to rotate
    if (Math.abs(deltaX) > 20) {
      player.angle += deltaX * 0.001;
    }
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
  
  // Draw ground with texture pattern
  ctx.fillStyle = '#2a5a2a';
  const groundY = canvas.height / 2;
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);
  
  // Add grass texture pattern
  ctx.fillStyle = 'rgba(34, 139, 34, 0.1)';
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * canvas.width;
    const y = groundY + Math.random() * (canvas.height - groundY);
    ctx.fillRect(x, y, 2, 1);
  }
  
  // Collect all renderable objects with distances
  const renderables = [];
  
  // Add paths
  paths.forEach(path => {
    const p1 = project(path.x1, 0, path.z1);
    const p2 = project(path.x2, 0, path.z2);
    if (p1 && p2) {
      renderables.push({
        type: 'path',
        distance: (p1.distance + p2.distance) / 2,
        p1: p1,
        p2: p2
      });
    }
  });
  
  // Add rocks
  rocks.forEach(rock => {
    const center = project(rock.x, 0, rock.z);
    if (center) {
      renderables.push({
        type: 'rock',
        distance: center.distance,
        center: center,
        rock: rock
      });
    }
  });
  
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
    if (obj.type === 'path') {
      renderPath(obj);
    } else if (obj.type === 'rock') {
      renderRock(obj);
    } else if (obj.type === 'tree') {
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
 * Render a path
 */
function renderPath(obj) {
  const { p1, p2 } = obj;
  
  // Draw path as a brown/tan line
  ctx.strokeStyle = '#c4a57b';
  ctx.lineWidth = Math.max(2, 30 * p1.scale / 100);
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.stroke();
  
  // Add path edge lines
  ctx.strokeStyle = '#8b7355';
  ctx.lineWidth = Math.max(1, 2 * p1.scale / 100);
  ctx.stroke();
}

/**
 * Render a rock
 */
function renderRock(obj) {
  const { center, rock } = obj;
  
  const size = Math.max(2, rock.size * 30 * center.scale / 100);
  
  // Draw rock as irregular polygon
  ctx.fillStyle = '#696969';
  ctx.strokeStyle = '#505050';
  ctx.lineWidth = 1;
  ctx.beginPath();
  
  const points = 6;
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const radius = size * (0.8 + Math.random() * 0.4);
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius * 0.5;
    
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/**
 * Render a tree
 */
function renderTree(obj) {
  const { base, top, tree } = obj;
  
  // Trunk with texture
  const trunkWidth = Math.max(1, 3 * base.scale / 100);
  ctx.strokeStyle = '#8b4513';
  ctx.lineWidth = trunkWidth;
  ctx.beginPath();
  ctx.moveTo(base.x, base.y);
  ctx.lineTo(top.x, top.y);
  ctx.stroke();
  
  // Add bark texture lines
  ctx.strokeStyle = '#654321';
  ctx.lineWidth = Math.max(0.5, trunkWidth * 0.3);
  for (let i = 0; i < 3; i++) {
    const y = base.y - i * (base.y - top.y) / 4;
    ctx.beginPath();
    ctx.moveTo(base.x - trunkWidth / 2, y);
    ctx.lineTo(base.x + trunkWidth / 2, y);
    ctx.stroke();
  }
  
  // Foliage with variation
  const foliageY = top.y - 10 * base.scale / 100;
  const foliageRadius = Math.max(2, 20 * base.scale / 100);
  
  if (tree.type === 'pine') {
    // Pine tree (triangle shape)
    ctx.fillStyle = '#1a4d1a';
    ctx.beginPath();
    ctx.moveTo(top.x, foliageY - foliageRadius);
    ctx.lineTo(top.x - foliageRadius, foliageY + foliageRadius);
    ctx.lineTo(top.x + foliageRadius, foliageY + foliageRadius);
    ctx.closePath();
    ctx.fill();
    
    // Add layers
    ctx.fillStyle = '#228b22';
    ctx.beginPath();
    ctx.moveTo(top.x, foliageY - foliageRadius * 0.5);
    ctx.lineTo(top.x - foliageRadius * 0.7, foliageY + foliageRadius * 0.5);
    ctx.lineTo(top.x + foliageRadius * 0.7, foliageY + foliageRadius * 0.5);
    ctx.closePath();
    ctx.fill();
  } else {
    // Oak tree (round)
    ctx.fillStyle = '#228b22';
    ctx.beginPath();
    ctx.arc(top.x, foliageY, foliageRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Add darker spots for depth
    ctx.fillStyle = 'rgba(26, 77, 26, 0.3)';
    ctx.beginPath();
    ctx.arc(top.x - foliageRadius * 0.3, foliageY, foliageRadius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(top.x + foliageRadius * 0.3, foliageY + foliageRadius * 0.2, foliageRadius * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Render a building
 */
function renderBuilding(obj) {
  const { corners, building } = obj;
  
  // Draw walls with color and texture
  ctx.fillStyle = building.color || '#a0826d';
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
  
  // Add brick/plank texture
  const avgScale = corners[0].scale;
  const brickSize = Math.max(2, 8 * avgScale / 100);
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
  ctx.lineWidth = 1;
  
  // Horizontal lines
  for (let i = 1; i < 5; i++) {
    const y = corners[0].y - (corners[0].y - corners[1].y) * i / 5;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, y);
    ctx.lineTo(corners[1].x, y);
    ctx.stroke();
  }
  
  // Draw windows
  const windowWidth = Math.max(3, 15 * avgScale / 100);
  const windowHeight = Math.max(3, 20 * avgScale / 100);
  const centerX = (corners[0].x + corners[1].x) / 2;
  const centerY = (corners[0].y + corners[2].y) / 2;
  
  ctx.fillStyle = '#4a6fa5';
  ctx.strokeStyle = '#2a3f5f';
  ctx.lineWidth = 1;
  
  // Two windows
  [-1, 1].forEach(offset => {
    const windowX = centerX + offset * windowWidth * 1.5;
    ctx.fillRect(windowX - windowWidth / 2, centerY - windowHeight / 2, windowWidth, windowHeight);
    ctx.strokeRect(windowX - windowWidth / 2, centerY - windowHeight / 2, windowWidth, windowHeight);
    
    // Window cross
    ctx.beginPath();
    ctx.moveTo(windowX, centerY - windowHeight / 2);
    ctx.lineTo(windowX, centerY + windowHeight / 2);
    ctx.moveTo(windowX - windowWidth / 2, centerY);
    ctx.lineTo(windowX + windowWidth / 2, centerY);
    ctx.stroke();
  });
  
  // Draw roof (simple quadrilateral on top)
  const roofCorners = [
    { x: building.x - building.width/2, z: building.z - building.depth/2 },
    { x: building.x + building.width/2, z: building.z - building.depth/2 },
    { x: building.x + building.width/2, z: building.z + building.depth/2 },
    { x: building.x - building.width/2, z: building.z + building.depth/2 }
  ];
  
  const topCorners = roofCorners.map(corner => 
    project(corner.x, building.height, corner.z)
  ).filter(p => p !== null);
  
  if (topCorners.length >= 4) {
    ctx.fillStyle = '#8b0000';
    ctx.strokeStyle = '#5a0000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(topCorners[0].x, topCorners[0].y);
    for (let i = 1; i < topCorners.length; i++) {
      ctx.lineTo(topCorners[i].x, topCorners[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Add roof tiles pattern
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    for (let i = 1; i < 4; i++) {
      const y = topCorners[0].y + (topCorners[2].y - topCorners[0].y) * i / 4;
      ctx.beginPath();
      ctx.moveTo(topCorners[0].x, y);
      ctx.lineTo(topCorners[1].x, y);
      ctx.stroke();
    }
  }
  
  // Draw building name if close enough
  if (obj.distance < 5) {
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.strokeText(building.name, corners[0].x, corners[0].y - 20);
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
  // Keyboard controls
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
  
  // Touch controls for mobile
  if (canvas) {
    canvas.addEventListener('touchstart', (event) => {
      event.preventDefault();
      if (event.touches.length > 0) {
        touchStartX = event.touches[0].clientX;
        touchStartY = event.touches[0].clientY;
        touchMoveX = touchStartX;
        touchMoveY = touchStartY;
        isTouching = true;
      }
    }, { passive: false });
    
    canvas.addEventListener('touchmove', (event) => {
      event.preventDefault();
      if (event.touches.length > 0 && isTouching) {
        touchMoveX = event.touches[0].clientX;
        touchMoveY = event.touches[0].clientY;
      }
    }, { passive: false });
    
    canvas.addEventListener('touchend', (event) => {
      event.preventDefault();
      isTouching = false;
      touchStartX = 0;
      touchStartY = 0;
      touchMoveX = 0;
      touchMoveY = 0;
    }, { passive: false });
  }
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
