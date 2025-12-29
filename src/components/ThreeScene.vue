<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import * as THREE from 'three';

// We don't need gestureState anymore as we rely on global mouse events dispatched by the bridge!
const props = defineProps<{
  gestureState?: any; 
}>();

const containerRef = ref<HTMLDivElement | null>(null);
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let cube: THREE.Mesh;
let raycaster: THREE.Raycaster;
let mouse: THREE.Vector2;

// Interaction State
let isHovered = false;
let previousMousePosition = { x: 0, y: 0 };

// --- 3D SCENE COLOR CONFIGURATION ---
// [USER CONFIG] Change these hex codes to modify the cube's color cycle
const colors = [0x1f2c89, 0x354195, 0x4c56a1, 0x626bac, 0x8f96c4];
let currentColorIndex = 0;

onMounted(() => {
  if (!containerRef.value) return;

  // Scene Setup
  scene = new THREE.Scene();
  scene.background = null; 

  camera = new THREE.PerspectiveCamera(75, containerRef.value.clientWidth / containerRef.value.clientHeight, 0.1, 1000);
  camera.position.z = 5;

  // Raycaster setup
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
  containerRef.value.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x404040, 2);
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
  directionalLight.position.set(2, 2, 5);
  scene.add(directionalLight);

  // Object
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.MeshStandardMaterial({ color: colors[0] });
  cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  // Event Listeners (Standard Mouse/Touch)
  renderer.domElement.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('mousedown', onMouseDown);
  renderer.domElement.addEventListener('mouseup', onMouseUp);
  renderer.domElement.addEventListener('click', onClick);
  window.addEventListener('mouseup', onMouseUp);

  // Start Loop
  animate();
  
  // Handle Resize
  window.addEventListener('resize', onWindowResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize);
  window.removeEventListener('mouseup', onMouseUp);
  if (renderer) {
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('click', onClick);
      renderer.dispose();
  }
});

const onWindowResize = () => {
  if (!containerRef.value) return;
  camera.aspect = containerRef.value.clientWidth / containerRef.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
};

// -- Mouse Handlers --

const updateRaycaster = (clientX: number, clientY: number) => {
    if (!containerRef.value) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
}

const onMouseMove = (event: MouseEvent) => {
    updateRaycaster(event.clientX, event.clientY);
    
    // Raycasting Logic
    const intersects = raycaster.intersectObject(cube);
    
    if (intersects.length > 0) {
        if (!isHovered) {
            isHovered = true;
            document.body.style.cursor = 'pointer'; 
            cube.scale.set(1.1, 1.1, 1.1);
        }
    } else {
        if (isHovered && event.buttons === 0) { // Only reset if not dragging
            isHovered = false;
            document.body.style.cursor = 'default';
            cube.scale.set(1, 1, 1);
        }
    }

    // Interaction Logic
    // We rely on event.buttons to distinguish Drag vs Rotate
    // Left Click (1) -> Drag (Translate)
    // Middle Click (4) -> Rotate

    const deltaMove = {
        x: event.clientX - previousMousePosition.x,
        y: event.clientY - previousMousePosition.y
    };

    if (event.buttons & 1) { 
        // Left Drag -> Translate
        // Need to map screen pixels to world move.
        // Approx 0.01 per pixel depending on Z
        const speed = 0.02; 
        // Invert Y for screen->world
        cube.position.x += deltaMove.x * speed;
        cube.position.y -= deltaMove.y * speed;
    } else if (event.buttons & 4) {
        // Middle Drag -> Rotate
        const speed = 0.005;
        cube.rotation.y += deltaMove.x * speed;
        cube.rotation.x += deltaMove.y * speed;
    }

    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
};

const onMouseDown = (event: MouseEvent) => {
    updateRaycaster(event.clientX, event.clientY);
    const intersects = raycaster.intersectObject(cube);
    
    // We allow interaction if hovering over object OR if we want to allow 'scene drag'
    // Usually gesture drag starts ON the object.
    
    previousMousePosition = {
        x: event.clientX,
        y: event.clientY
    };
};

const onMouseUp = () => {
    // Reset any drag states if we were tracking them manually
};

const onClick = (event: MouseEvent) => {
    if (event.button !== 0) return; // Only trigger color change on Left Click
    
    // Distinguish click from drag? 
    // Usually click event fires after mouseup if no move?
    // Let's rely on standard click.
    
    updateRaycaster(event.clientX, event.clientY);
    const intersects = raycaster.intersectObject(cube);
    if (intersects.length > 0) {
        changeColor();
    }
}

const animate = () => {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
};

const changeColor = () => {
  currentColorIndex = (currentColorIndex + 1) % colors.length;
  (cube.material as THREE.MeshStandardMaterial).color.setHex(colors[currentColorIndex]);
  cube.scale.set(1.2, 1.2, 1.2);
  setTimeout(() => cube.scale.set(isHovered ? 1.1 : 1, isHovered ? 1.1 : 1, isHovered ? 1.1 : 1), 100);
};

</script>

<template>
  <div ref="containerRef" class="three-scene"></div>
</template>

<style scoped>
.three-scene {
  width: 100%;
  height: 100vh; /* Scaled to viewport */
  outline: none;
  display: block;
}
</style>
