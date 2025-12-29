<script setup lang="ts">
import { onMounted, onUnmounted, watch, ref } from 'vue';
import { useGesture } from './composables/useGesture';
import GestureCursor from './components/GestureCursor.vue';
import ThreeScene from './components/ThreeScene.vue';
import ScrollableText from './components/ScrollableText.vue';
import SettingPanel from './components/SettingPanel.vue';
import { processGestureInteraction } from './utils/GestureInteraction';

// Gesture System
const { 
  videoRef, 
  canvasRef, 
  initWorker, 
  startCamera, 
  stopCamera, 
  isCameraActive, 
  isWorkerReady,
  fps, 
  logs,
  activeDelegate,
  gestureState,
  setHandPreference,
  setSmoothing,
  setVideoSource
} = useGesture();

// Global Interaction Bridge
watch(() => gestureState.value, (newState) => {
    // Only process if active
    processGestureInteraction(newState);
}, { deep: true });


// Mouse tracking for cursor hiding
const mouseActive = ref(false);
let mouseTimer: number | null = null;
const onMouseMove = () => {
  mouseActive.value = true;
  if (mouseTimer) clearTimeout(mouseTimer);
  mouseTimer = setTimeout(() => {
    mouseActive.value = false;
  }, 2000) as unknown as number; 
};

onMounted(() => {
  initWorker();
  window.addEventListener('mousemove', onMouseMove);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  if (mouseTimer) clearTimeout(mouseTimer);
});

// Handlers for Settings Panel
const updateHand = (val: 'Left' | 'Right' | 'Both') => setHandPreference(val);
const updateSmoothing = (val: 'Fast' | 'Balanced' | 'Smooth') => setSmoothing(val);
const updateVideo = (val: string) => setVideoSource(val);

</script>

<template>
  <div class="app-layout">
    <!-- Background Scene -->
    <div class="scene-layer">
      <ThreeScene :gestureState="gestureState" />
    </div>

    <!-- Settings Panel -->
    <SettingPanel 
        :isCameraActive="isCameraActive"
        :isWorkerReady="isWorkerReady"
        :gestureState="gestureState"
        :fps="fps"
        :logs="logs"
        :activeDelegate="activeDelegate"
        @toggle-camera="() => isCameraActive ? stopCamera() : startCamera()"
        @update:hand="updateHand"
        @update:smoothing="updateSmoothing"
        @update:video-source="updateVideo"
    />

    <!-- Cam Preview (Hidden/Managed by Panel) -->
    <div class="hidden-video-layer" :style="{ opacity: 0 }">
        <video ref="videoRef" playsinline muted style="width:100%; height:100%; object-fit:cover; transform:scaleX(-1);"></video>
        <canvas ref="canvasRef" style="display:none"></canvas>
    </div>

    <!-- Components -->
    <ScrollableText :visible="true" />

    <GestureCursor 
      :x="gestureState.cursor.x" 
      :y="gestureState.cursor.y" 
      :mode="gestureState.cursor.mode"
      :active="gestureState.cursor.active"
      :mouseActive="mouseActive"
    />
  </div>
</template>

<style scoped>
/* App layout managed in style.css */
</style>
