<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import * as THREE from 'three';
import type { GestureState } from '../composables/useGesture';

const props = defineProps<{
  gestureState: GestureState;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let cube: THREE.Mesh;

// Interaction State
let lastCursor = { x: 0, y: 0 };
let currentColorIndex = 0;
const colors = [0x646cff, 0xff6464, 0x64ff64, 0xffd700, 0xff64ff];

// Click detection info
let pinchStartTime = 0;
let isPinching = false;
let startPinchPos = { x: 0, y: 0 };

onMounted(() => {
  if (!containerRef.value) return;

  // Scene Setup
  scene = new THREE.Scene();
  // Transparent background to blend with UI
  scene.background = null; 

  camera = new THREE.PerspectiveCamera(75, containerRef.value.clientWidth / containerRef.value.clientHeight, 0.1, 1000);
  camera.position.z = 5;

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

  // Start Loop
  animate();
  
  // Handle Resize
  window.addEventListener('resize', onWindowResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', onWindowResize);
  renderer?.dispose();
});

const onWindowResize = () => {
  if (!containerRef.value) return;
  camera.aspect = containerRef.value.clientWidth / containerRef.value.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(containerRef.value.clientWidth, containerRef.value.clientHeight);
};

const animate = () => {
  requestAnimationFrame(animate);
  
  // Smooth rotation for idle
  // cube.rotation.x += 0.005;
  // cube.rotation.y += 0.005;

  renderer.render(scene, camera);
};

// Gesture Logic
watch(() => props.gestureState.cursor, (newVal, oldVal) => {
  if (!newVal.active) return;
  
  const dx = newVal.x - lastCursor.x;
  const dy = newVal.y - lastCursor.y;

  // Update logic
  // Mode: Drag (Index Pinch) -> Translate
  if (newVal.mode === 'drag') {
    // Check if this is a fresh pinch
    if (!isPinching) {
      isPinching = true;
      pinchStartTime = performance.now();
      startPinchPos = { x: newVal.x, y: newVal.y };
    }

    // Move object (Screen space X -> world X, Y -> -Y)
    // Scale factor needs tuning
    const moveScale = 0.01; 
    cube.position.x += dx * moveScale;
    cube.position.y -= dy * moveScale; // Y is inverted in screen
  } 
  
  // Mode: Rotate (Middle Pinch) -> Rotate
  else if (newVal.mode === 'rotate') {
    isPinching = false; // Middle pinch doesn't count as click for now
    
    // Rotate 3D model
    const rotScale = 0.01;
    cube.rotation.y += dx * rotScale;
    cube.rotation.x += dy * rotScale;
  }
  
  // Mode: None (Release) -> Check Click
  else if (newVal.mode === 'none') {
    if (isPinching) {
      // Released
      const duration = performance.now() - pinchStartTime;
      const dist = Math.sqrt(Math.pow(newVal.x - startPinchPos.x, 2) + Math.pow(newVal.y - startPinchPos.y, 2));
      
      // Click criteria: short duration < 300ms, small movement < 20px
      if (duration < 300 && dist < 50) {
        // Trigger Click
        changeColor();
      }
      isPinching = false;
    }
  }

  lastCursor = { x: newVal.x, y: newVal.y };
}, { deep: true });

const changeColor = () => {
  currentColorIndex = (currentColorIndex + 1) % colors.length;
  (cube.material as THREE.MeshStandardMaterial).color.setHex(colors[currentColorIndex]);
  // Add small scale animation
  cube.scale.set(1.2, 1.2, 1.2);
  setTimeout(() => cube.scale.set(1, 1, 1), 100);
};

</script>

<template>
  <div ref="containerRef" class="three-scene"></div>
</template>

<style scoped>
.three-scene {
  width: 100%;
  height: 60vh; /* Takes substantial space */
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.02); /* Subtle frame */
  border: 1px solid rgba(255, 255, 255, 0.05);
}
</style>
