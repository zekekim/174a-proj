import * as THREE from "three";

// Prevent scrolling and remove default margins.
document.body.style.margin = "0";
document.body.style.overflow = "hidden";

//
// --- Scene Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.02);

//
// --- Constants & Variables ---
const laneWidth = 3;
const laneLength = 200; // Length of each segment
const numSegments = 2; // Two segments per lane for looping
const lanePositions = [-laneWidth, 0, laneWidth]; // left, center, right

const groundLevel = 1.6;
let targetLane = 1;

let isJumping = false;
let jumpVelocity = 0;
const gravity = 0.01;

let isGameOver = false;

let speed = 0.5; // base speed
let gameTime = 0; // elapsed game time in seconds
let obstacleSpawnTimer = 0;
const spawnInterval = 10; // spawn a new obstacle every 10 seconds

let distanceTraveled = 0; // score in meters

const clock = new THREE.Clock();

//
// --- Camera ---
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);
camera.position.set(lanePositions[targetLane], groundLevel, 0);
camera.lookAt(
  new THREE.Vector3(
    camera.position.x,
    camera.position.y,
    camera.position.z - 1,
  ),
);

//
// --- Renderer ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

//
// --- Game Over Overlay ---
const gameOverOverlay = document.createElement("div");
gameOverOverlay.style.position = "absolute";
gameOverOverlay.style.top = "50%";
gameOverOverlay.style.left = "50%";
gameOverOverlay.style.transform = "translate(-50%, -50%)";
gameOverOverlay.style.fontSize = "48px";
gameOverOverlay.style.color = "white";
gameOverOverlay.style.display = "none";
gameOverOverlay.style.pointerEvents = "none";
gameOverOverlay.innerHTML = "Game Over<br>Press 'R' to restart";
document.body.appendChild(gameOverOverlay);

//
// --- Score (Distance Meter) Display ---
const scoreCounter = document.createElement("div");
scoreCounter.style.position = "absolute";
scoreCounter.style.top = "10px";
scoreCounter.style.left = "10px";
scoreCounter.style.fontSize = "24px";
scoreCounter.style.color = "white";
scoreCounter.style.fontFamily = "Arial, sans-serif";
scoreCounter.innerHTML = "Distance: 0 m";
document.body.appendChild(scoreCounter);

//
// --- Lighting & Ambient ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

//
// --- Shader Code ---
// Vertex shader: pass along each fragment's world position.
const vertexShader = `
varying vec3 vWorldPosition;
void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// --- Obstacle Fragment Shader ---
// Computes flashlight intensity and then blends in fog.
const objectFragmentShader = `
uniform vec3 uFlashlightPosition;
uniform vec3 uFlashlightDirection;
uniform float uFlashlightAngle;
uniform vec3 uBaseColor;
uniform float uAmbient;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec3 vWorldPosition;
void main() {
  vec3 toFragment = normalize(vWorldPosition - uFlashlightPosition);
  float cutoff = cos(uFlashlightAngle);
  float theta = dot(toFragment, normalize(uFlashlightDirection));
  float intensity = smoothstep(cutoff - 0.02, cutoff + 0.02, theta);
  vec3 litColor = uBaseColor * (uAmbient + (1.0 - uAmbient) * intensity);

  // Fog computation (exponential fog)
  float distance = length(vWorldPosition - uFlashlightPosition);
  float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * distance * distance);
  fogFactor = clamp(fogFactor, 0.0, 1.0);
  vec3 finalColor = mix(litColor, uFogColor, fogFactor);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// --- Floor Fragment Shader ---
// The floor is white when lit and dark when not. It also applies fog.
const floorFragmentShader = `
uniform vec3 uFlashlightPosition;
uniform vec3 uFlashlightDirection;
uniform float uFlashlightAngle;
uniform float uAmbient;
uniform vec3 uFogColor;
uniform float uFogDensity;
varying vec3 vWorldPosition;
void main() {
  vec3 toFragment = normalize(vWorldPosition - uFlashlightPosition);
  float cutoff = cos(uFlashlightAngle);
  float theta = dot(toFragment, normalize(uFlashlightDirection));
  float intensity = smoothstep(cutoff - 0.02, cutoff + 0.02, theta);

  // Base color: dark (0.2) when unlit, white when fully lit.
  vec3 baseColor = mix(vec3(0.001), vec3(0.0, 0.0, 1.0), uAmbient + (1.0 - uAmbient) * intensity);

  // Fog computation:
  float distance = length(vWorldPosition - uFlashlightPosition);
  float fogFactor = 1.0 - exp(-uFogDensity * uFogDensity * distance * distance);
  fogFactor = clamp(fogFactor, 0.0, 1.0);
  vec3 finalColor = mix(baseColor, uFogColor, fogFactor);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

// --- Helpers to Create Shader Materials ---
function createObstacleMaterial(baseColor) {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: objectFragmentShader,
    uniforms: {
      uFlashlightPosition: { value: new THREE.Vector3() },
      uFlashlightDirection: { value: new THREE.Vector3() },
      uFlashlightAngle: { value: Math.PI / 48 },
      uBaseColor: { value: new THREE.Color(baseColor) },
      uAmbient: { value: 0.1 },
      uFogColor: { value: new THREE.Color(0x000000) },
      uFogDensity: { value: 0.02 },
    },
  });
}

function createFloorMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: floorFragmentShader,
    uniforms: {
      uFlashlightPosition: { value: new THREE.Vector3() },
      uFlashlightDirection: { value: new THREE.Vector3() },
      uFlashlightAngle: { value: Math.PI / 48 },
      uAmbient: { value: 0.1 },
      uFogColor: { value: new THREE.Color(0x000000) },
      uFogDensity: { value: 0.02 },
    },
  });
}

//
// --- Floor (Lane) Geometry ---
// The floor now uses our custom shader so it’s affected by the flashlight.
const laneSegments = [];
const floorMaterial = createFloorMaterial();

lanePositions.forEach((xPos) => {
  const segments = [];
  for (let i = 0; i < numSegments; i++) {
    const laneGeometry = new THREE.PlaneGeometry(laneWidth, laneLength);
    laneGeometry.rotateX(-Math.PI / 2);
    const lane = new THREE.Mesh(laneGeometry, floorMaterial);
    lane.position.x = xPos;
    lane.position.z = -laneLength / 2 - i * laneLength;
    scene.add(lane);
    segments.push(lane);
  }
  laneSegments.push(segments);
});

//
// --- Obstacles ---
let obstacles = [];
const obstacleMaterial = createObstacleMaterial(0xff0000);
const initialObstacleCount = 10;

function createObstacle() {
  const obstacleGeometry = new THREE.BoxGeometry(1, 1, 1);
  const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
  const randomLaneIndex = Math.floor(Math.random() * lanePositions.length);
  obstacle.position.x = lanePositions[randomLaneIndex];
  obstacle.position.z = -Math.random() * 200 - 100;
  obstacle.position.y = 0.5;
  scene.add(obstacle);
  return obstacle;
}

function initObstacles() {
  obstacles.forEach((ob) => scene.remove(ob));
  obstacles = [];
  for (let i = 0; i < initialObstacleCount; i++) {
    obstacles.push(createObstacle());
  }
}
initObstacles();

//
// --- Update Flashlight & Fog Uniforms ---
// Updates the uniforms so that the flashlight (and fog) effect follows the camera.
function updateFlashlightUniforms() {
  const flashlightPos = camera.position.clone();
  const flashlightDir = new THREE.Vector3();
  camera.getWorldDirection(flashlightDir);
  // Update floor material uniforms.
  floorMaterial.uniforms.uFlashlightPosition.value.copy(flashlightPos);
  floorMaterial.uniforms.uFlashlightDirection.value.copy(flashlightDir);
  // Update obstacle material uniforms.
  obstacleMaterial.uniforms.uFlashlightPosition.value.copy(flashlightPos);
  obstacleMaterial.uniforms.uFlashlightDirection.value.copy(flashlightDir);
}

//
// --- Collision Detection ---
function checkCollisions() {
  if (camera.position.y - groundLevel > 0.5) return;
  for (let obstacle of obstacles) {
    const dx = camera.position.x - obstacle.position.x;
    const dz = camera.position.z - obstacle.position.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance < 1.0) {
      isGameOver = true;
      gameOverOverlay.style.display = "block";
      break;
    }
  }
}

//
// --- Spawn New Obstacles ---
function spawnNewObstacle() {
  const newObstacle = createObstacle();
  obstacles.push(newObstacle);
}

//
// --- Restart Game ---
function resetGame() {
  isGameOver = false;
  gameOverOverlay.style.display = "none";
  targetLane = 1;
  camera.position.set(lanePositions[targetLane], groundLevel, 0);
  camera.lookAt(
    new THREE.Vector3(
      camera.position.x,
      camera.position.y,
      camera.position.z - 1,
    ),
  );
  speed = 0.5;
  gameTime = 0;
  obstacleSpawnTimer = 0;
  distanceTraveled = 0;
  scoreCounter.innerHTML = "Distance: 0 m";
  initObstacles();
}

//
// --- Player Controls ---
window.addEventListener("keydown", (event) => {
  if (!isGameOver) {
    if (event.key === "ArrowLeft" && targetLane > 0) {
      targetLane--;
    } else if (
      event.key === "ArrowRight" &&
      targetLane < lanePositions.length - 1
    ) {
      targetLane++;
    } else if (event.key === " " && !isJumping) {
      isJumping = true;
      jumpVelocity = 0.15;
    }
  }
  if (event.key.toLowerCase() === "r" && isGameOver) {
    resetGame();
  }
});

//
// --- Animation Loop ---
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (!isGameOver) {
    gameTime += delta;
    // Increase track speed over time.
    speed += delta * 0.02;
    obstacleSpawnTimer += delta;
    if (obstacleSpawnTimer >= spawnInterval) {
      spawnNewObstacle();
      obstacleSpawnTimer = 0;
    }

    // Smooth lane switching.
    camera.position.x = THREE.MathUtils.lerp(
      camera.position.x,
      lanePositions[targetLane],
      0.2,
    );

    // Handle jumping.
    if (isJumping) {
      camera.position.y += jumpVelocity;
      jumpVelocity -= gravity;
      if (camera.position.y <= groundLevel) {
        camera.position.y = groundLevel;
        isJumping = false;
        jumpVelocity = 0;
      }
    }

    // Move lane segments.
    laneSegments.forEach((segments) => {
      segments.forEach((segment) => {
        segment.position.z += speed;
        if (segment.position.z > camera.position.z + laneLength / 2) {
          segment.position.z -= laneLength * numSegments;
        }
      });
    });

    // Move obstacles.
    obstacles.forEach((obstacle) => {
      obstacle.position.z += speed;
      if (obstacle.position.z > camera.position.z + laneLength / 2) {
        const randomLaneIndex = Math.floor(
          Math.random() * lanePositions.length,
        );
        obstacle.position.x = lanePositions[randomLaneIndex];
        obstacle.position.z = -Math.random() * 200 - 200;
      }
    });

    // Update distance traveled.
    distanceTraveled += speed * delta;
    scoreCounter.innerHTML = "Distance: " + Math.floor(distanceTraveled) + " m";

    // Check for collisions.
    checkCollisions();
  }

  // --- Camera Shake ---
  const baseCamPos = camera.position.clone();
  const shakeAmplitude = 0.05;
  const shakeFrequency = 20.0;
  const shakeX = Math.sin(gameTime * shakeFrequency) * shakeAmplitude;
  const shakeY = Math.cos(gameTime * shakeFrequency) * shakeAmplitude;
  camera.position.add(new THREE.Vector3(shakeX, shakeY, 0));

  // Update flashlight (and fog) uniforms.
  updateFlashlightUniforms();
  camera.lookAt(
    new THREE.Vector3(
      camera.position.x,
      camera.position.y,
      camera.position.z - 1,
    ),
  );
  renderer.render(scene, camera);

  // Revert camera to base position.
  camera.position.copy(baseCamPos);
}

animate();

//
// --- Responsive Handling ---
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
