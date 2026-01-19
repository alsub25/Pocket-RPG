// js/game/world3d/scene2d-topdown.js
// 2D Top-Down World View
//
// This module creates a 2D top-down view of the world that players can explore.

let canvas, ctx;
let player = { x: 0, y: 0, angle: 0 };
let moveState = { forward: false, backward: false, left: false, right: false, rotateLeft: false, rotateRight: false };
const MOVE_SPEED = 0.15;
const ROTATE_SPEED = 0.05;
const ZOOM = 20; // Pixels per world unit

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
 * Initialize the 2D top-down world
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
  
  console.log('2D Top-Down World initialized');
}

/**
 * Initialize world objects
 */
function initWorldObjects() {
  // Create trees
  for (let i = 0; i < 50; i++) {
    trees.push({
      x: (Math.random() - 0.5) * 60,
      y: (Math.random() - 0.5) * 60,
      radius: 0.4 + Math.random() * 0.3,
      type: Math.random() > 0.5 ? 'pine' : 'oak'
    });
  }
  
  // Create rocks
  for (let i = 0; i < 20; i++) {
    rocks.push({
      x: (Math.random() - 0.5) * 60,
      y: (Math.random() - 0.5) * 60,
      radius: 0.2 + Math.random() * 0.3
    });
  }
  
  // Create paths
  paths.push({ x1: -20, y1: 0, x2: 20, y2: 0, width: 1.5 });
  paths.push({ x1: 0, y1: -20, x2: 0, y2: 20, width: 1.5 });
  
  // Create buildings
  buildings.push({ x: 10, y: 5, width: 4, height: 3, name: 'Tavern', color: '#a0826d' });
  buildings.push({ x: -10, y: 5, width: 4, height: 4, name: 'Shop', color: '#8b7355' });
  buildings.push({ x: 0, y: -15, width: 5, height: 5, name: 'Town Hall', color: '#9a8a7a' });
  buildings.push({ x: 15, y: -10, width: 3, height: 3, name: 'House', color: '#b8a490' });
  buildings.push({ x: -15, y: -8, width: 3.5, height: 3, name: 'Cottage', color: '#a89580' });
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
    player.y += Math.cos(player.angle) * MOVE_SPEED;
  }
  if (moveState.backward) {
    player.x -= Math.sin(player.angle) * MOVE_SPEED;
    player.y -= Math.cos(player.angle) * MOVE_SPEED;
  }
  if (moveState.left) {
    player.x -= Math.cos(player.angle) * MOVE_SPEED;
    player.y += Math.sin(player.angle) * MOVE_SPEED;
  }
  if (moveState.right) {
    player.x += Math.cos(player.angle) * MOVE_SPEED;
    player.y -= Math.sin(player.angle) * MOVE_SPEED;
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
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    if (distance > 10) {
      const isVertical = Math.abs(deltaY) > Math.abs(deltaX);
      
      if (isVertical) {
        const direction = deltaY < 0 ? 1 : -1;
        const intensity = Math.min(Math.abs(deltaY) / 100, 1);
        player.x += Math.sin(player.angle) * MOVE_SPEED * direction * intensity;
        player.y += Math.cos(player.angle) * MOVE_SPEED * direction * intensity;
      } else {
        const rotateAmount = deltaX * 0.0008;
        player.angle += rotateAmount;
      }
    }
  }
}

/**
 * Convert world coordinates to screen coordinates
 */
function worldToScreen(wx, wy) {
  // Camera follows player
  const relX = wx - player.x;
  const relY = wy - player.y;
  
  // Rotate around player
  const rotX = relX * Math.cos(-player.angle) - relY * Math.sin(-player.angle);
  const rotY = relX * Math.sin(-player.angle) + relY * Math.cos(-player.angle);
  
  // Convert to screen space
  const sx = canvas.width / 2 + rotX * ZOOM;
  const sy = canvas.height / 2 - rotY * ZOOM; // Invert Y for screen coordinates
  
  return { x: sx, y: sy };
}

/**
 * Render the world
 */
function render() {
  // Clear with grass background
  ctx.fillStyle = '#2a5a2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Add grass texture
  ctx.fillStyle = 'rgba(34, 139, 34, 0.1)';
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillRect(x, y, 2, 2);
  }
  
  // Draw paths
  ctx.strokeStyle = '#c4a57b';
  paths.forEach(path => {
    const p1 = worldToScreen(path.x1, path.y1);
    const p2 = worldToScreen(path.x2, path.y2);
    ctx.lineWidth = path.width * ZOOM;
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });
  
  // Draw rocks
  ctx.fillStyle = '#696969';
  ctx.strokeStyle = '#505050';
  ctx.lineWidth = 1;
  rocks.forEach(rock => {
    const pos = worldToScreen(rock.x, rock.y);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, rock.radius * ZOOM, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
  
  // Draw trees
  trees.forEach(tree => {
    const pos = worldToScreen(tree.x, tree.y);
    
    if (tree.type === 'pine') {
      // Pine tree (triangle)
      ctx.fillStyle = '#1a4d1a';
      const size = tree.radius * ZOOM;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y - size);
      ctx.lineTo(pos.x - size * 0.8, pos.y + size * 0.5);
      ctx.lineTo(pos.x + size * 0.8, pos.y + size * 0.5);
      ctx.closePath();
      ctx.fill();
    } else {
      // Oak tree (circle)
      ctx.fillStyle = '#228b22';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, tree.radius * ZOOM, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Trunk
    ctx.fillStyle = '#8b4513';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, tree.radius * ZOOM * 0.3, 0, Math.PI * 2);
    ctx.fill();
  });
  
  // Draw buildings
  buildings.forEach(building => {
    const pos = worldToScreen(building.x, building.y);
    const w = building.width * ZOOM;
    const h = building.height * ZOOM;
    
    // Building base
    ctx.fillStyle = building.color;
    ctx.strokeStyle = '#6b5d50';
    ctx.lineWidth = 2;
    ctx.fillRect(pos.x - w/2, pos.y - h/2, w, h);
    ctx.strokeRect(pos.x - w/2, pos.y - h/2, w, h);
    
    // Roof
    ctx.fillStyle = '#8b0000';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y - h/2 - w * 0.2);
    ctx.lineTo(pos.x - w/2 - w * 0.1, pos.y - h/2);
    ctx.lineTo(pos.x + w/2 + w * 0.1, pos.y - h/2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Door
    ctx.fillStyle = '#654321';
    const doorW = w * 0.3;
    const doorH = h * 0.4;
    ctx.fillRect(pos.x - doorW/2, pos.y + h/2 - doorH, doorW, doorH);
    
    // Building name
    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.strokeText(building.name, pos.x, pos.y + h/2 + 15);
    ctx.fillText(building.name, pos.x, pos.y + h/2 + 15);
  });
  
  // Draw player
  const playerScreen = worldToScreen(player.x, player.y);
  
  // Player body (circle)
  ctx.fillStyle = '#4a90e2';
  ctx.strokeStyle = '#2a5a8a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(playerScreen.x, playerScreen.y, 0.4 * ZOOM, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  
  // Direction indicator
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(playerScreen.x, playerScreen.y);
  ctx.lineTo(
    playerScreen.x + Math.sin(player.angle) * ZOOM,
    playerScreen.y - Math.cos(player.angle) * ZOOM
  );
  ctx.stroke();
  
  // Mini compass
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(canvas.width - 60, 10, 50, 50);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(canvas.width - 35, 35, 20, 0, Math.PI * 2);
  ctx.stroke();
  
  // North indicator
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.moveTo(canvas.width - 35, 20);
  ctx.lineTo(canvas.width - 40, 30);
  ctx.lineTo(canvas.width - 30, 30);
  ctx.closePath();
  ctx.fill();
  
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('N', canvas.width - 35, 18);
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
 * Set up keyboard and touch controls
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
  
  // Touch controls
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
 * Clean up resources
 */
export function dispose3DWorld() {
  if (canvas && canvas.parentElement) {
    canvas.parentElement.removeChild(canvas);
  }
  
  window.removeEventListener('resize', onWindowResize);
  
  moveState = { forward: false, backward: false, left: false, right: false, rotateLeft: false, rotateRight: false };
  
  console.log('2D Top-Down World disposed');
}

/**
 * Get current player position
 */
export function getPlayerPosition() {
  return {
    x: player.x,
    y: player.y,
    angle: player.angle
  };
}

/**
 * Set player position
 */
export function setPlayerPosition(x, y, angle) {
  player.x = x;
  player.y = y;
  if (angle !== undefined) {
    player.angle = angle;
  }
}
