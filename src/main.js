import * as THREE from 'three';

// --- Scene, Camera, and Renderer Setup ---
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.set(0, 10, 20);
camera.lookAt(0, 0, -100);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(0, 20, 10);
scene.add(directionalLight);

// --- Pathway Parameters ---
const laneWidth = 3;
const laneLength = 200; // Length of each segment
const numSegments = 2; // Two segments per lane for looping
const lanePositions = [-laneWidth, 0, laneWidth]; // left, center, right

// Create the base geometry for a lane segment.
const laneGeometry = new THREE.PlaneGeometry(laneWidth, laneLength);
laneGeometry.rotateX(-Math.PI / 2);
const laneMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });

// Build lanes from segments and position them side by side.
const laneSegments = []; // Array of arrays (each lane holds multiple segments)
lanePositions.forEach((xPos) => {
  const segments = [];
  for (let i = 0; i < numSegments; i++) {
    const lane = new THREE.Mesh(laneGeometry, laneMaterial);
    lane.position.x = xPos;
    // Position segments consecutively along the z-axis.
    lane.position.z = -laneLength / 2 - i * laneLength;
    scene.add(lane);
    segments.push(lane);
  }
  laneSegments.push(segments);
});

// --- Lane Dividers ---
const dividerMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
const dividerGeometry = new THREE.PlaneGeometry(0.1, laneLength);
dividerGeometry.rotateX(-Math.PI / 2);

const dividerPositions = [-laneWidth / 2, laneWidth / 2];
const dividerSegments = [];
dividerPositions.forEach((xPos) => {
  const segments = [];
  for (let i = 0; i < numSegments; i++) {
    const divider = new THREE.Mesh(dividerGeometry, dividerMaterial);
    divider.position.x = xPos;
    divider.position.z = -laneLength / 2 - i * laneLength;
    scene.add(divider);
    segments.push(divider);
  }
  dividerSegments.push(segments);
});

// --- Obstacles ---
// Create random block obstacles that spawn in one of the lanes.
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
  // Position y so that the block sits on the ground (assuming its half height is 0.5).
  obstacle.position.y = 0.5;
  scene.add(obstacle);
  obstacles.push(obstacle);
}

// --- Animation Loop ---
// Move lanes, dividers, and obstacles forward.
// When an element moves past the camera, reposition it to create a continuous effect.
function animate() {
  requestAnimationFrame(animate);
  const speed = 0.5;

  // Move lane segments
  laneSegments.forEach((segments) => {
    segments.forEach((segment) => {
      segment.position.z += speed;
      if (segment.position.z > camera.position.z + laneLength / 2) {
        segment.position.z -= laneLength * numSegments;
      }
    });
  });

  // Move divider segments
  dividerSegments.forEach((segments) => {
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
      // Assign a new random lane and z position far down the track.
      const randomLaneIndex = Math.floor(Math.random() * lanePositions.length);
      obstacle.position.x = lanePositions[randomLaneIndex];
      obstacle.position.z = -Math.random() * 200 - 200;
    }
  });

  renderer.render(scene, camera);
}

animate();

// --- Responsive Handling ---
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

