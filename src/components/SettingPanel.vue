<script setup lang="ts">
import { ref, computed } from 'vue';
import { type GestureState } from '../composables/useGesture';

interface Props {
  isCameraActive: boolean;
  isWorkerReady: boolean;
  gestureState: GestureState;
  fps: number;
  logs?: any[]; 
  activeDelegate?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'toggle-camera'): void;
  (e: 'update:hand', value: 'Left' | 'Right' | 'Both'): void;
  (e: 'update:smoothing', value: 'Fast' | 'Balanced' | 'Smooth'): void;
  (e: 'update:video-source', value: string): void;
  (e: 'toggle-debug', value: boolean): void;
}>();

// State
const isOpen = ref(false); 
const debugMode = ref(false);
const selectedHand = ref<'Left' | 'Right' | 'Both'>('Both');
const selectedSmoothing = ref<'Fast' | 'Balanced' | 'Smooth'>('Balanced');
const selectedCamera = ref('');
const cameraList = ref<MediaDeviceInfo[]>([]);

// Initialize camera list
navigator.mediaDevices?.enumerateDevices().then(devices => {
  cameraList.value = devices.filter(d => d.kind === 'videoinput');
  if (cameraList.value.length > 0 && !selectedCamera.value) {
    selectedCamera.value = cameraList.value[0].deviceId;
    emit('update:video-source', selectedCamera.value);
  }
});

const CANNED_GESTURES = ["None", "Closed_Fist", "Open_Palm", "Pointing_Up", "Thumb_Down", "Thumb_Up", "Victory", "ILoveYou"];
const gestureTypes = ['IDLE', 'POINTER_MOVE', 'CLICK', 'DOUBLE_CLICK', 'DRAG_START', 'DRAG_MOVE', 'DRAG_END', 'DRAG_MIDDLE_START', 'DRAG_MIDDLE_MOVE', 'DRAG_MIDDLE_END'];

const toggleDropdown = () => isOpen.value = !isOpen.value;

const toggleDebug = (val: boolean) => {
  debugMode.value = val;
  emit('toggle-debug', val);
};

const setHandPreference = (val: 'Left' | 'Right' | 'Both') => {
    console.log('Setting Panel: setHandPreference', val);
    selectedHand.value = val;
    emit('update:hand', val);
}

const setSensitivity = (val: 'Fast' | 'Balanced' | 'Smooth') => {
    console.log('Setting Panel: setSensitivity', val);
    selectedSmoothing.value = val;
    emit('update:smoothing', val);
}

// Computed
const currentGesture = computed(() => props.gestureState.gestures[0] || 'None');
const activeEvents = computed(() => props.gestureState.events || {}); 
const debugInfo = computed(() => ({
    rootPos: { x: 0, y: 0 },
    handScale: 1,
    roi: 0.8,
    effectiveRoi: 0.8,
    landmarks: [],
    handedness: 'Unknown',
    ...props.gestureState.debugInfo
}));

// Helper for polylines
function getPolyPoints(indices: number[], landmarks: any[]) {
    if (!landmarks || landmarks.length === 0) return '';
    return indices.map(i => {
        const p = landmarks[i];
        if (!p) return '0,0';
        return `${p.x},${p.y}`;
    }).join(' ');
}
</script>

<template>
  <div class="settings-panel-position">
    <!-- Main Control Row -->
    <div class="flex gap-2" style="display:flex; gap:8px;">
        <button 
            @click="emit('toggle-camera')"
            class="button"
            :class="isCameraActive ? 'button-ghost text-red-500' : 'button-primary'"
            :disabled="!isWorkerReady"
        >
            {{ isCameraActive ? 'STOP SYSTEM' : 'START SYSTEM' }}
        </button>

        <button 
            @click="toggleDropdown"
            class="button panel"
            style="color: var(--text-primary)"
        >
            SETTINGS
        </button>
    </div>

    <!-- Dropdown Panel -->
    <div v-if="isOpen" class="panel animate-enter origin-top-left" style="width:280px; padding:16px; display:flex; flex-direction:column; gap:16px; margin-top:8px;">
        <!-- Header -->
        <div class="panel-header">
            <span class="panel-title">CONFIGURATION</span>
        </div>

        <!-- Hand Selection -->
        <div>
            <span class="hero-label">Hand Detection</span>
            <div class="toggle-group">
                <div 
                    v-for="h in ['Left', 'Both', 'Right']" 
                    :key="h"
                    @click="setHandPreference(h as any)"
                    class="toggle-option"
                    :class="{ 'active': selectedHand === h }"
                >
                    {{ h }}
                </div>
            </div>
        </div>

        <!-- Sensitivity -->
        <div>
            <span class="hero-label">Smoothing Filter</span>
            <div class="toggle-group">
                <div 
                    v-for="s in ['Fast', 'Balanced', 'Smooth']" 
                    :key="s"
                    @click="setSensitivity(s as any)"
                    class="toggle-option"
                    :class="{ 'active': selectedSmoothing === s }"
                >
                    {{ s }}
                </div>
            </div>
        </div>

        <!-- Video Source -->
        <div>
            <span class="hero-label">Video Source</span>
            <div style="position:relative">
                <select 
                    v-model="selectedCamera"
                    :disabled="isCameraActive"
                    class="select-input"
                    @change="(e) => { console.log('Video changed', selectedCamera); emit('update:video-source', selectedCamera); }"
                >
                    <option v-for="cam in cameraList" :key="cam.deviceId" :value="cam.deviceId">
                        {{ cam.label || 'Camera ' + cam.deviceId.slice(0,4) }}
                    </option>
                </select>
            </div>
        </div>

        <!-- Debug Toggle -->
        <div style="padding-top:12px; border-top:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;">
            <span class="hero-label" style="margin:0">Developer Mode</span>
            <button 
                @click="toggleDebug(!debugMode)"
                style="width:36px; height:20px; border-radius:99px; position:relative; transition: background-color 0.2s; border:none; cursor:pointer;"
                :style="{ backgroundColor: debugMode ? 'var(--accent-blue)' : '#a4adbd99' }"
            >
                <div 
                    style="position:absolute; top:2px; left:2px; width:16px; height:16px; background:white; border-radius:50%; transition: transform 0.2s;"
                    :style="{ transform: debugMode ? 'translateX(16px)' : 'translateX(0)' }"
                />
            </button>
        </div>
    </div>
  </div>

  <!-- Consolidated Developer Mode Panel -->
  <div v-if="debugMode" class="panel animate-enter" style="position:fixed; top:96px; left:24px; width:280px; max-height:calc(100vh - 120px); overflow-y:auto; display:flex; flex-direction:column; gap:16px; z-index:40; padding:16px;">
        
        <!-- Section 1: Classification -->
         <div>
            <div class="panel-header">
                <span class="panel-title">Gesture Classification</span>
            </div>
            <div style="display:flex; flex-direction:column; gap:4px;">
                <div v-for="name in CANNED_GESTURES" :key="name" style="display:flex; align-items:center; gap:8px;">
                        <div style="width:96px; font-size:10px; color:var(--text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-family:var(--font-mono);">{{ name }}</div>
                        <div style="flex:1; height:4px; background:var(--border-color); border-radius:99px; overflow:hidden;">
                        <div 
                            style="height:100%; background:var(--primary-color); transition: width 0.3s ease-out;"
                            :style="{ width: currentGesture === name ? '100%' : '0%' }"
                        />
                        </div>
                </div>
            </div>
        </div>

        <!-- Section 2: Event Bus -->
        <div>
            <div class="panel-header">
                <span class="panel-title">Event Bus</span>
            </div>
            <div style="display:flex; flex-wrap:wrap; gap:6px;">
                <span 
                    v-for="t in gestureTypes" 
                    :key="t"
                    style="font-size:9px; padding:2px 6px; border-radius:4px; border:1px solid;"
                    :style="{ 
                        borderColor: activeEvents[t] ? 'transparent' : 'var(--border-color)',
                        backgroundColor: activeEvents[t] ? 'var(--accent-blue)' : 'transparent',
                        color: activeEvents[t] ? 'white' : 'var(--text-secondary)'
                    }"
                >
                    {{ t.replace('GESTURE_', '').replace('POSE_', '') }}
                </span>
            </div>
        </div>

        <!-- Section 3: Tracking Metrics & Skeleton -->
        <div style="position:relative;">
                <div class="panel-header">
                <span class="panel-title">Tracking Metrics</span>
            </div>
            
            <!-- Metrics Grid -->
            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px; font-size:10px; font-family:var(--font-mono); color:var(--text-secondary); margin-bottom:12px;">
                <!-- FPS & Init Info -->
                <div style="grid-column: span 2; display:flex; justify-content:space-between; padding-bottom:4px; border-bottom:1px solid var(--border-color);">
                     <span>FPS: <b style="color:var(--text-primary)">{{ fps }}</b></span>
                     <span>Backend: <b style="color:var(--accent-blue)">{{ activeDelegate }}</b></span>
                </div>

                <div>
                    <span style="display:block; font-size:8px; text-transform:uppercase; opacity:0.6;">Root X</span>
                    <span style="color:var(--text-primary);">{{ (debugInfo.rootPos?.x || 0).toFixed(3) }}</span>
                </div>
                <div>
                    <span style="display:block; font-size:8px; text-transform:uppercase; opacity:0.6;">Root Y</span>
                    <span style="color:var(--text-primary);">{{ (debugInfo.rootPos?.y || 0).toFixed(3) }}</span>
                </div>
                <div>
                    <span style="display:block; font-size:8px; text-transform:uppercase; opacity:0.6;">Scale (Z)</span>
                    <span style="color:var(--accent-blue); font-weight:bold;">{{ (debugInfo.handScale || 1).toFixed(3) }}</span>
                </div>
                <div>
                    <span style="display:block; font-size:8px; text-transform:uppercase; opacity:0.6;">Eff. ROI</span>
                    <span style="color:var(--accent-blue);">{{ ((debugInfo.effectiveRoi || 0.8) * 100).toFixed(0) }}%</span>
                </div>
                
                <div style="grid-column: span 2; text-align:right; font-size:9px; font-weight:bold; color:var(--primary-color);">
                    {{ debugInfo.handedness }}
                </div>
            </div>

            <!-- SVG Skeleton Overlay -->
            <div v-if="debugInfo.landmarks && debugInfo.landmarks.length > 0" style="width:100%; height:140px; background:rgba(0,0,0,0.03); border-radius:8px; position:relative; overflow:hidden;">
                    <svg viewBox="0 0 1 1" style="width:100%; height:100%; transform:scaleX(-1); opacity:0.8;">
                    <!-- ROI Box -->
                    <rect 
                        :x="0.5 - (debugInfo.effectiveRoi || 0.8) / 2"
                        :y="0.5 - (debugInfo.effectiveRoi || 0.8) / 2"
                        :width="debugInfo.effectiveRoi || 0.8"
                        :height="debugInfo.effectiveRoi || 0.8"
                        fill="none" 
                        stroke="#ef4444" 
                        stroke-width="0.008"
                        stroke-dasharray="0.02"
                    />

                    <!-- Landmarks -->
                    <polyline :points="getPolyPoints([0,1,2,3,4], debugInfo.landmarks)" fill="none" stroke="#52525b" stroke-width="0.01" />
                    <polyline :points="getPolyPoints([0,5,6,7,8], debugInfo.landmarks)" fill="none" stroke="#52525b" stroke-width="0.01" />
                    <polyline :points="getPolyPoints([0,9,10,11,12], debugInfo.landmarks)" fill="none" stroke="#52525b" stroke-width="0.01" />
                    <polyline :points="getPolyPoints([0,13,14,15,16], debugInfo.landmarks)" fill="none" stroke="#52525b" stroke-width="0.01" />
                    <polyline :points="getPolyPoints([0,17,18,19,20], debugInfo.landmarks)" fill="none" stroke="#52525b" stroke-width="0.01" />

                    <circle 
                        v-for="(lm, i) in debugInfo.landmarks" 
                        :key="i"
                        :cx="lm.x"
                        :cy="lm.y"
                        :r="[4,8,12,16,20].includes(i) ? 0.02 : 0.015"
                        :fill="[4,8,12,16,20].includes(i) ? '#006FEE' : '#d4d4d8'"
                    />
                </svg>
                    <div style="position:absolute; bottom:4px; right:4px; font-size:8px; color:rgba(239, 68, 68, 0.6); font-family:var(--font-mono);">
                    Dynamic ROI
                </div>
            </div>
        </div>

        <!-- Section 4: System Logs -->
        <div style="margin-top:auto;">
             <div class="panel-header">
                <span class="panel-title">System Logs</span>
            </div>
            <div style="height:120px; overflow-y:auto; background:rgba(0,0,0,0.03); border-radius:4px; padding:8px; font-family:var(--font-mono); font-size:9px; display:flex; flex-direction:column; gap:4px;">
                <div v-for="(log, i) in logs" :key="i" :style="{ color: log.type === 'error' ? '#ef5350' : log.type === 'success' ? '#4caf50' : 'var(--text-secondary)' }">
                     <span style="opacity:0.6;">[{{ log.timestamp }}]</span> {{ log.message }}
                </div>
                <div v-if="!logs || logs.length === 0" style="opacity:0.4; text-align:center; padding-top:20px;">No logs available</div>
            </div>
        </div>

  </div>
</template>

<style scoped>
/* Reliance on global style.css */
</style>
