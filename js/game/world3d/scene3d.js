// js/game/world3d/scene3d.js
// 3D World Scene using Three.js
//
// This module creates and manages a 3D world that players can explore.
// Uses Three.js for rendering and provides movement controls.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';

let scene, camera, renderer, controls;
let player, ground, buildings = [];
let moveState = { forward: false, backward: false, left: false, right: false };
let playerVelocity = new THREE.Vector3();
const MOVE_SPEED = 0.1;

/**
 * Initialize the 3D world
 * @param {HTMLElement} container - DOM element to render into
 */
export function init3DWorld(container) {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky blue
  scene.fog = new THREE.Fog(0x87ceeb, 10, 50);

  // Create camera
  camera = new THREE.PerspectiveCamera(
    75,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 5, 10);

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // Add controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.1; // Prevent camera going below ground

  // Create ground
  createGround();

  // Create player
  createPlayer();

  // Create environment
  createEnvironment();

  // Add lighting
  createLighting();

  // Handle window resize
  window.addEventListener('resize', onWindowResize);

  // Start animation loop
  animate();

  console.log('3D World initialized');
}

/**
 * Create the ground plane
 */
function createGround() {
  const groundGeometry = new THREE.PlaneGeometry(100, 100);
  const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x228b22, // Forest green
    roughness: 0.8,
  });
  ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Add grid helper for better depth perception
  const gridHelper = new THREE.GridHelper(100, 50, 0x444444, 0x888888);
  scene.add(gridHelper);
}

/**
 * Create the player character representation
 */
function createPlayer() {
  // Simple player as a capsule-like shape (cylinder + spheres)
  const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.5, 8);
  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x4169e1 }); // Royal blue
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.castShadow = true;
  body.position.y = 0.75;

  // Head
  const headGeometry = new THREE.SphereGeometry(0.35, 8, 8);
  const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffd700 }); // Gold
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.castShadow = true;
  head.position.y = 1.85;

  // Create player group
  player = new THREE.Group();
  player.add(body);
  player.add(head);
  player.position.set(0, 0, 0);
  scene.add(player);
}

/**
 * Create environment objects (trees, buildings, etc.)
 */
function createEnvironment() {
  // Create some trees
  for (let i = 0; i < 20; i++) {
    createTree(
      Math.random() * 40 - 20,
      Math.random() * 40 - 20
    );
  }

  // Create a simple village building
  createBuilding(10, 0, 3, 4, 3);
  createBuilding(-10, 0, 4, 3, 4);
  createBuilding(0, -15, 5, 5, 4);

  // Create a tavern sign
  createSign(10, 0);
}

/**
 * Create a simple tree
 */
function createTree(x, z) {
  // Trunk
  const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 2, 8);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 }); // Brown
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.set(x, 1, z);
  trunk.castShadow = true;
  scene.add(trunk);

  // Foliage
  const foliageGeometry = new THREE.ConeGeometry(1.5, 3, 8);
  const foliageMaterial = new THREE.MeshStandardMaterial({ color: 0x228b22 }); // Forest green
  const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
  foliage.position.set(x, 3.5, z);
  foliage.castShadow = true;
  scene.add(foliage);
}

/**
 * Create a simple building
 */
function createBuilding(x, z, width, depth, height) {
  // Building body
  const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
  const buildingMaterial = new THREE.MeshStandardMaterial({ color: 0xa0826d }); // Tan
  const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
  building.position.set(x, height / 2, z);
  building.castShadow = true;
  building.receiveShadow = true;
  scene.add(building);

  // Roof
  const roofGeometry = new THREE.ConeGeometry(width * 0.7, 1.5, 4);
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0x8b0000 }); // Dark red
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.position.set(x, height + 0.75, z);
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  scene.add(roof);

  buildings.push({ building, roof, position: new THREE.Vector3(x, 0, z) });
}

/**
 * Create a simple sign
 */
function createSign(x, z) {
  // Sign post
  const postGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
  const postMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
  const post = new THREE.Mesh(postGeometry, postMaterial);
  post.position.set(x - 2, 1, z);
  scene.add(post);

  // Sign board
  const boardGeometry = new THREE.BoxGeometry(1.5, 0.8, 0.1);
  const boardMaterial = new THREE.MeshStandardMaterial({ color: 0xdaa520 }); // Goldenrod
  const board = new THREE.Mesh(boardGeometry, boardMaterial);
  board.position.set(x - 2, 2.2, z);
  scene.add(board);
}

/**
 * Create lighting
 */
function createLighting() {
  // Ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  // Directional light (sun)
  const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
  sunLight.position.set(10, 20, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 50;
  sunLight.shadow.camera.left = -20;
  sunLight.shadow.camera.right = 20;
  sunLight.shadow.camera.top = 20;
  sunLight.shadow.camera.bottom = -20;
  scene.add(sunLight);

  // Add a point light for evening effect
  const pointLight = new THREE.PointLight(0xffa500, 0.3, 50);
  pointLight.position.set(0, 5, 0);
  scene.add(pointLight);
}

/**
 * Handle window resize
 */
function onWindowResize() {
  const container = renderer.domElement.parentElement;
  if (!container) return;

  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
}

/**
 * Update movement based on keyboard input
 */
function updateMovement() {
  playerVelocity.set(0, 0, 0);

  if (moveState.forward) playerVelocity.z -= MOVE_SPEED;
  if (moveState.backward) playerVelocity.z += MOVE_SPEED;
  if (moveState.left) playerVelocity.x -= MOVE_SPEED;
  if (moveState.right) playerVelocity.x += MOVE_SPEED;

  // Apply movement to player
  player.position.add(playerVelocity);

  // Update camera to follow player
  const cameraOffset = new THREE.Vector3(0, 5, 10);
  camera.position.copy(player.position).add(cameraOffset);
  controls.target.copy(player.position);
}

/**
 * Animation loop
 */
function animate() {
  requestAnimationFrame(animate);

  updateMovement();
  controls.update();

  renderer.render(scene, camera);
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
      case 'arrowleft':
        moveState.left = true;
        break;
      case 'd':
      case 'arrowright':
        moveState.right = true;
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
      case 'arrowleft':
        moveState.left = false;
        break;
      case 'd':
      case 'arrowright':
        moveState.right = false;
        break;
    }
  });
}

/**
 * Clean up 3D world resources
 */
export function dispose3DWorld() {
  if (renderer) {
    window.removeEventListener('resize', onWindowResize);
    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  }
  
  // Reset move state
  moveState = { forward: false, backward: false, left: false, right: false };
  
  console.log('3D World disposed');
}

/**
 * Get current player position (for game state sync)
 */
export function getPlayerPosition() {
  if (!player) return { x: 0, y: 0, z: 0 };
  return {
    x: player.position.x,
    y: player.position.y,
    z: player.position.z
  };
}

/**
 * Set player position (for game state sync)
 */
export function setPlayerPosition(x, y, z) {
  if (player) {
    player.position.set(x, y, z);
  }
}
