import * as THREE from 'three'

function vertexShader() {
  return `
      varying vec3 vPosition;
      void main() {
          vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
  `;
}

function fragmentShader() {
  return `
      uniform vec3 metaballPositions[${metaballsCount}];
      uniform vec3 metaballColors[${metaballsCount}];
      uniform int metaballsCount;
      uniform float metaballsRadius;
      varying vec3 vPosition;

      float metaballInfluence(vec3 pos, vec3 ballPos, float radius) {
          float dist = length(pos - ballPos);
          return radius * radius * radius / (dist * dist);
      }

      void main() {
          vec3 finalColor = vec3(0.0);
          float totalInfluence = 0.0;
          float threshold = 0.0; // Adjust this value to control the blending threshold
          for (int i = 0; i < metaballsCount; i++) {
              vec3 ballPos = metaballPositions[i];
              vec3 ballColor = metaballColors[i];
              float influence = metaballInfluence(vPosition, ballPos, metaballsRadius);
              if (influence > threshold) {
                  finalColor += ballColor * influence;
                  totalInfluence += influence;
              }
          }
          finalColor /= totalInfluence;
          finalColor = clamp(finalColor, 0.0, 1.0);
          gl_FragColor = vec4(finalColor, 1.0);
      }
  `;
}


const aspectRatio = window.innerWidth / window.innerHeight
const metaballsCount = 12;
const metaballsRadius = 0.8;
const metaballSpeed = 0.002 ;
const metaballPositions = new Float32Array(metaballsCount * 3);
const metaballColors = new Float32Array(metaballsCount * 3);
const verticalBoundary = 5 - metaballsRadius;
// Calculate based on aspectRatio
let horizontalBoundary = verticalBoundary * aspectRatio
const lastMousePosition = new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2);

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x242424);
const camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 100)
camera.position.z = 10
const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth, window.innerHeight)
// renderer.setClearColor(0x242424, 1);
document.body.appendChild(renderer.domElement)

// Generate pastel arrowColors for each metaball
for (let i = 0; i < metaballsCount; i++) {
  // Random hue between 0 and 360
  const hue = Math.random() * 360;
  // Saturation and lightness with some variation
  const saturation = Math.random() * 30 + 70; // Between 70% and 100%
  const lightness = Math.random() * 20 + 70; // Between 70% and 90%
  
  // Create a color using the HSL model
  const color = new THREE.Color(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
  
  // Assign the color to the metaballColors array
  metaballColors[i * 3] = color.r;
  metaballColors[i * 3 + 1] = color.g;
  metaballColors[i * 3 + 2] = color.b;
}

// Metaballs setup
const geometry = new THREE.SphereGeometry(metaballsRadius, 32, 32);
const material = new THREE.ShaderMaterial({
  uniforms: {
      metaballPositions: { value: metaballPositions },
      metaballColors: { value: metaballColors },
      metaballsCount: { value: metaballsCount },
      metaballsRadius: { value: metaballsRadius },
      ambientLightColor: { value: new THREE.Color(0xcccccc) },
      directionalLightColor: { value: new THREE.Color(0xffffff) },
      directionalLightDirection: { value: new THREE.Vector3(0, 0, 1).normalize() }
  },
  vertexShader: vertexShader(),
  fragmentShader: fragmentShader(),
  transparent: true
});

const metaballs = [];
for (let i = 0; i < metaballsCount; i++) {
  const sphere = new THREE.Mesh(geometry, material);
  sphere.position.set(Math.random() * (2 * horizontalBoundary) - horizontalBoundary, Math.random() * 10 - verticalBoundary, 0); // Adjusted range of random positions
  sphere.velocity = new THREE.Vector3(metaballSpeed * getRandomArbitrary(), metaballSpeed * getRandomArbitrary(), 0)
  scene.add(sphere);
  metaballs.push(sphere);
}

// animate
function animate() {
  requestAnimationFrame(animate);

  // Update metaballs positions
  for (let i = 0; i < metaballsCount; i++) {
    const sphere = metaballs[i]
    sphere.position.add(sphere.velocity);
    if (sphere.position.x < -horizontalBoundary || sphere.position.x > horizontalBoundary) sphere.velocity.x *= -1;
    if (sphere.position.y < -verticalBoundary || sphere.position.y > verticalBoundary) sphere.velocity.y *= -1;
    // if (sphere.position.z < -5 || sphere.position.z > 5) sphere.velocity.z *= -1;

    // Apply damping to gradually reduce velocity
    sphere.velocity.multiplyScalar(0.96); // Damping factor
    // Ensure velocity stays within -metaballSpeed and metaballSpeed
    if (Math.abs(sphere.velocity.x) < metaballSpeed) {
      sphere.velocity.x = metaballSpeed * Math.sign(sphere.velocity.x);
    }
    if (Math.abs(sphere.velocity.y) < metaballSpeed) {
      sphere.velocity.y = metaballSpeed * Math.sign(sphere.velocity.y);
    }
  
    const { x, y, z } = sphere.position
    metaballPositions[i * 3] = x;
    metaballPositions[i * 3 + 1] = y;
    metaballPositions[i * 3 + 2] = z;
  }

  // Update the uniforms
  material.uniforms.metaballPositions.value = metaballPositions;

  renderer.render(scene, camera);
}

function getRandomArbitrary() {
  return Math.random() < 0.5 ? -1 : 1
}

window.addEventListener('resize', function() {
  // Update camera
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  // Update renderer
  renderer.setSize(window.innerWidth, window.innerHeight);
  horizontalBoundary = verticalBoundary * camera.aspect;
}, false)

// Function to convert screen coordinates to normalized device coordinates (NDC) in Three.js
function getMouseWorldPosition(mouseX, mouseY) {
  const vector = new THREE.Vector3(
    (mouseX / window.innerWidth) * 2 - 1,
    -(mouseY / window.innerHeight) * 2 + 1,
    0.5
  );
  vector.unproject(camera);
  const dir = vector.sub(camera.position).normalize();
  const distance = -camera.position.z / dir.z;
  const pos = camera.position.clone().add(dir.multiplyScalar(distance));
  return pos;
}

window.addEventListener('mousemove', function(event) {
  const mouseX = event.clientX;
  const mouseY = event.clientY;
  const deltaX = mouseX - lastMousePosition.x;
  const deltaY = mouseY - lastMousePosition.y;
  lastMousePosition.set(mouseX, mouseY);

  const forceMultiplier = 0.001; // Larger initial force for the fling effect
  const mousePosition = getMouseWorldPosition(mouseX, mouseY);

  for (let i = 0; i < metaballsCount; i++) {
    const sphere = metaballs[i];
    const distanceToMouse = mousePosition.distanceTo(sphere.position);

    if (distanceToMouse < 1.2) {
      // Apply initial fling velocity change
      sphere.velocity.x += deltaX * forceMultiplier;
      sphere.velocity.y -= deltaY * forceMultiplier; // Inverted to go in the opposite direction
    }
  }
}, false);

const arrowColors = new Array(metaballsCount)
  .fill(0)
  .map((_, i) => {
    // convers metaballColors to 0-255 rgb
    const r = Math.round(metaballColors[i * 3] * 255)
    const g = Math.round(metaballColors[i * 3 + 1] * 255)
    const b = Math.round(metaballColors[i * 3 + 2] * 255)
    return [r, g, b]
  })
let colorIndex = 0
let colorTime = performance.now()
const colorAnimationDuration = 1000
const segments = document.querySelectorAll('path');
const totalSegments = segments.length;
let currentSegment = 0;

function animateSegment() {
  
  const segment = segments[currentSegment];
  const length = segment.getTotalLength();
  
  segment.style.strokeDasharray = length;
  segment.style.strokeDashoffset = length;
  const animationDuration = 200; // Duration in ms
  
  const start = performance.now();

  function animate(time) {
    const elapsed = time - start;
    const progress = Math.min(elapsed / animationDuration, 1);
    segment.style.strokeDashoffset = length - (progress * length);
    
    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      currentSegment++;
      if (currentSegment === totalSegments) {
        currentSegment = 0
        resetSegments()
      }
      animateSegment();
    }
  }
  
  requestAnimationFrame(animate);
}

function animateColor() {
  const now = performance.now();
  const elapsed = now - colorTime;
  const fraction = Math.min(elapsed / colorAnimationDuration, 1);
  const endColor = arrowColors[(colorIndex + 1) % arrowColors.length];
  const [r, g, b] = interpolateColor(arrowColors[colorIndex], endColor, fraction);

  for (const s of segments) {
    s.setAttribute("stroke", `rgb(${r},${g},${b})`);
  }

  if (fraction >= 1) {
    colorIndex = (colorIndex + 1) % arrowColors.length;
    colorTime = now;
  }

  requestAnimationFrame(animateColor);
}
  
function resetSegments () {
  for (const segment of segments) {
    const length = segment.getTotalLength();
    segment.style.strokeDashoffset = length
    segment.style.strokeDasharray = length
  }
}
  
function interpolateColor(start, end, factor = 0) {
  return start.map((startValue, i) => 
    Math.round(startValue + factor * (end[i] - startValue))
  );
}

animate()
resetSegments()
animateSegment()
animateColor()