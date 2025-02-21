import * as THREE from "three";

// --- Scene Setup (with a spooky vibe) ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.02);

// --- Lane Parameters ---
const laneWidth = 3;
const laneLength = 200; // Length of each segment
const numSegments = 2; // Two segments per lane for looping
const lanePositions = [-laneWidth, 0, laneWidth]; // left, center, right

// --- Camera Setup (First-Person Player) ---
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
// Ground level (player’s eye height)
const groundLevel = 1.6;
let currentLane = 1; // start in the center lane (index 1)
let targetLane = 1;
camera.position.set(lanePositions[targetLane], groundLevel, 0);
camera.lookAt(
  new THREE.Vector3(
    camera.position.x,
    camera.position.y,
    camera.position.z - 1,
  ),
);

// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(0, 20, 10);
scene.add(directionalLight);

// --- Pathway Geometry & Lanes ---
const laneGeometry = new THREE.PlaneGeometry(laneWidth, laneLength);
laneGeometry.rotateX(-Math.PI / 2);
const laneMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });

const laneSegments = []; // Each lane holds multiple segments
lanePositions.forEach((xPos) => {
  const segments = [];
  for (let i = 0; i < numSegments; i++) {
    const lane = new THREE.Mesh(laneGeometry, laneMaterial);
    lane.position.x = xPos;
    // Place segments consecutively along the z-axis
    lane.position.z = -laneLength / 2 - i * laneLength;
    scene.add(lane);
    segments.push(lane);
  }
  laneSegments.push(segments);
});

// --- Obstacles ---
const obstacleGeometry = new THREE.BoxGeometry(1, 1, 1);
const obstacleMaterial = new THREE.MeshLambertMaterial({ color: 0xff0000 });
const obstacles = [];
const obstacleCount = 10;

for (let i = 0; i < obstacleCount; i++) {
  const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
  // Randomly assign the obstacle to one of the lanes.
  const randomLaneIndex = Math.floor(Math.random() * lanePositions.length);
  obstacle.position.x = lanePositions[randomLaneIndex];
  // Random z position between -100 and -300 initially.
  obstacle.position.z = -Math.random() * 200 - 100;
  // Set y so the block sits on the ground (half height = 0.5)
  obstacle.position.y = 0.5;
  scene.add(obstacle);
  obstacles.push(obstacle);
}

// --- Player Controls ---
let isJumping = false;
let jumpVelocity = 0;
const gravity = 0.01;

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    // Move left if not already in the leftmost lane
    if (targetLane > 0) {
      targetLane--;
    }
  } else if (event.key === "ArrowRight") {
    // Move right if not already in the rightmost lane
    if (targetLane < lanePositions.length - 1) {
      targetLane++;
    }
  } else if (event.key === " " && !isJumping) {
    // Start jump if space is pressed and not already jumping
    isJumping = true;
    jumpVelocity = 0.15; // adjust for jump strength
  }
});

// --- Animation Loop ---
function animate() {
  requestAnimationFrame(animate);
  const speed = 0.5;

  // Smoothly interpolate the camera's x-position to the target lane
  camera.position.x = THREE.MathUtils.lerp(
    camera.position.x,
    lanePositions[targetLane],
    0.2,
  );

  // Handle jumping
  if (isJumping) {
    camera.position.y += jumpVelocity;
    jumpVelocity -= gravity;
    if (camera.position.y <= groundLevel) {
      camera.position.y = groundLevel;
      isJumping = false;
      jumpVelocity = 0;
    }
  }

  // Move lane segments
  laneSegments.forEach((segments) => {
    segments.forEach((segment) => {
      segment.position.z += speed;
      if (segment.position.z > camera.position.z + laneLength / 2) {
        segment.position.z -= laneLength * numSegments;
      }
    });
  });

  // Move obstacles and reposition them randomly after they pass the camera.
  obstacles.forEach((obstacle) => {
    obstacle.position.z += speed;
    if (obstacle.position.z > camera.position.z + laneLength / 2) {
      const randomLaneIndex = Math.floor(Math.random() * lanePositions.length);
      obstacle.position.x = lanePositions[randomLaneIndex];
      obstacle.position.z = -Math.random() * 200 - 200;
    }
  });

  // Keep the first-person view looking forward
  camera.lookAt(
    new THREE.Vector3(
      camera.position.x,
      camera.position.y,
      camera.position.z - 1,
    ),
  );

  renderer.render(scene, camera);
}

animate();

// --- Responsive Handling ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
