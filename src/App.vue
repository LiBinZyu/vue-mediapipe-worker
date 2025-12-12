<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useGesture } from './composables/useGesture';
import GestureCursor from './components/GestureCursor.vue';
import ThreeScene from './components/ThreeScene.vue';
import ScrollableText from './components/ScrollableText.vue';

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
  activeDelegate,
  logs,
  gestureState
} = useGesture();

// UI State
const showTextPanel = ref(false);
const mouseActive = ref(false);
let mouseTimer: number | null = null;

// Mouse tracking
const onMouseMove = () => {
  mouseActive.value = true;
  if (mouseTimer) clearTimeout(mouseTimer);
  mouseTimer = setTimeout(() => {
    mouseActive.value = false;
  }, 2000) as unknown as number; // 2 seconds of inactivity -> switch to gesture
};

onMounted(() => {
  initWorker();
  window.addEventListener('mousemove', onMouseMove);
});

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove);
  if (mouseTimer) clearTimeout(mouseTimer);
});

const toggleCamera = () => {
  if (isCameraActive.value) stopCamera();
  else startCamera();
};

const lastGestureText = computed(() => {
  if (gestureState.value.cursor.mode === 'none') return 'None';
  return gestureState.value.cursor.mode.toUpperCase();
});

</script>

<template>
  <div class="app-layout">
    <!-- Background Scene -->
    <div class="scene-container">
      <ThreeScene :gestureState="gestureState" />
    </div>

    <!-- UI Overlay -->
    <div class="ui-layer">
      <header class="header">
        <h1 class="title">Gesture OS <span class="version">v2.0</span></h1>
        <div class="stats">
          <div class="stat-item">
            <span class="label">FPS</span>
            <span class="value">{{ fps }}</span>
          </div>
          <div class="stat-item">
            <span class="label">MODE</span>
            <span class="value highlight l-blue">{{ activeDelegate }}</span>
          </div>
          <div class="stat-item">
            <span class="label">GESTURE</span>
            <span class="value highlight l-green">{{ lastGestureText }}</span>
          </div>
        </div>
      </header>

      <div class="controls">
        <button 
          @click="toggleCamera"
          class="btn-primary"
          :class="{ 'btn-active': isCameraActive, 'btn-disabled': !isWorkerReady }"
          :disabled="!isWorkerReady"
        >
          {{ isCameraActive ? 'STOP SYSTEM' : 'START SYSTEM' }}
        </button>

        <button 
          @click="showTextPanel = !showTextPanel"
          class="btn-secondary"
        >
          {{ showTextPanel ? 'HIDE DOCS' : 'SHOW DOCS' }}
        </button>
      </div>

      <!-- Logs -->
      <div class="logs-panel">
        <div v-for="(log, i) in logs" :key="i" class="log-entry" :class="log.type">
          <span class="timestamp">{{ log.timestamp }}</span>
          <span class="message">{{ log.message }}</span>
        </div>
      </div>

      <!-- Cam Preview -->
      <div class="cam-preview">
        <video ref="videoRef" playsinline muted class="cam-video"></video>
        <canvas ref="canvasRef" class="cam-overlay"></canvas>
        <div v-if="!isCameraActive" class="cam-placeholder">
          OFFLINE
        </div>
      </div>
    </div>

    <!-- Components -->
    <ScrollableText :visible="showTextPanel" :gestureState="gestureState" />
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
.app-layout {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  background: radial-gradient(circle at center, #1a2a3a 0%, #000000 100%);
  color: white;
  user-select: none;
}

.scene-container {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ui-layer {
  position: relative;
  z-index: 10;
  width: 100%;
  height: 100%;
  pointer-events: none; /* Let clicks pass to scene logic if needed, but buttons need pointer-events auto */
  padding: 24px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* Enable pointer events for UI elements */
.header, .controls, .logs-panel, .cam-preview {
  pointer-events: auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 20px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}

.title {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
}

.version {
  font-size: 0.8rem;
  opacity: 0.5;
  font-weight: 400;
  margin-left: 8px;
}

.stats {
  display: flex;
  gap: 24px;
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.label {
  font-size: 0.7rem;
  opacity: 0.5;
  font-weight: 600;
  letter-spacing: 0.05em;
}

.value {
  font-family: 'Courier New', monospace;
  font-weight: 700;
}

.highlight.l-blue { color: #64b5f6; }
.highlight.l-green { color: #69f0ae; }

.controls {
  position: absolute;
  top: 50%;
  left: 24px;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.btn-primary, .btn-secondary {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: white;
  padding: 12px 24px;
  font-size: 0.9rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  cursor: pointer;
  transition: all 0.2s;
  backdrop-filter: blur(10px);
  min-width: 160px;
  text-align: left;
}

.btn-primary:hover, .btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.3);
}

.btn-active {
  border-color: #ef5350;
  color: #ef5350;
  background: rgba(239, 83, 80, 0.1);
}

.btn-active:hover {
  background: rgba(239, 83, 80, 0.2);
}

.btn-disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.logs-panel {
  width: 300px;
  height: 150px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  padding: 8px;
  border-radius: 4px;
}

.log-entry { margin-bottom: 4px; opacity: 0.8; }
.log-entry.error { color: #ff5252; }
.log-entry.success { color: #69f0ae; }
.log-entry.warning { color: #ffd740; }
.timestamp { opacity: 0.5; margin-right: 8px; }

.cam-preview {
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 240px;
  height: 180px;
  background: black;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  overflow: hidden;
}

.cam-video, .cam-overlay {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: absolute;
  top: 0; left: 0;
}
.cam-video { transform: scaleX(-1); } /* Mirror locally */

.cam-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #555;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}
</style>
