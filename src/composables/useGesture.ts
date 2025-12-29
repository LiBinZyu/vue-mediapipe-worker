import { ref, onUnmounted, reactive } from 'vue';
import type { LogEntry, WorkerMessage } from '../types';

// Web Worker import for Vite
// Web Worker import removed in favor of Blob approach

type GestureMode = 'none' | 'click' | 'drag' | 'rotate' | 'scroll';
type HandPreference = 'Left' | 'Right' | 'Both';
type SmoothingProfile = 'Fast' | 'Balanced' | 'Smooth';

export interface GestureState {
    cursor: {
        x: number;
        y: number;
        active: boolean;
        mode: GestureMode
    };
    gestures: string[]; // e.g. "Thumb_Up", "Open_Palm"
    events: Record<string, boolean>; // 'CLICK': true
    debugInfo: {
        rootPos: { x: number; y: number };
        handScale: number;
        roi: number; // Base ROI
        effectiveRoi: number; // Dynamic ROI
        landmarks: { x: number; y: number; z: number }[];
        handedness: string;
    };
}

export function useGesture() {
    const videoRef = ref<HTMLVideoElement | null>(null);
    const canvasRef = ref<HTMLCanvasElement | null>(null);
    const isCameraActive = ref(false);
    const isWorkerReady = ref(false);
    const fps = ref(0);
    const activeDelegate = ref('Unknown');
    const logs = ref<LogEntry[]>([]);

    const workerRef = ref<Worker | null>(null);
    const isBusyRef = ref(false);
    const requestRef = ref<number | null>(null);

    // Configuration
    const config = reactive({
        hand: 'Both' as HandPreference,
        smoothing: 'Balanced' as SmoothingProfile,
        roi: 0.8,
        videoSource: '' as string
    });

    // Gesture State for UI
    const gestureState = ref<GestureState>({
        cursor: { x: 0, y: 0, active: false, mode: 'none' },
        gestures: [],
        events: {},
        debugInfo: {
            rootPos: { x: 0, y: 0 },
            handScale: 1,
            roi: 0.8,
            effectiveRoi: 0.8,
            landmarks: [],
            handedness: 'Unknown'
        }
    });

    // Helper: Smoothing Buffer
    const positionBuffer: { x: number, y: number }[] = [];
    const BUFFER_SIZE_MAP = {
        'Fast': 2,
        'Balanced': 5,
        'Smooth': 10
    };

    const addLog = (message: string, type: LogEntry['type'] = 'info') => {
        const timestamp = new Date().toLocaleTimeString();
        logs.value = [{ timestamp, message, type }, ...logs.value].slice(0, 50);
    };

    // Worker Logic as String (Solution for importScripts issue in Module Workers)
    const WORKER_LOGIC = `
  let gestureRecognizer = null;

  async function init(config) {
    try {
      let mp = self.$mediapipe;
      if (!mp && typeof $mediapipe !== 'undefined') mp = $mediapipe;
      if (!mp) throw new Error("MediaPipe library not found in worker scope. ensure mediapipe.js is loaded.");

      // Offline / Local Assets
      const vision = await mp.FilesetResolver.forVisionTasks(
        config.wasmBase 
      );

      gestureRecognizer = await mp.GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: config.modelPath,
          delegate: config.delegate || "CPU" 
        },
        runningMode: "VIDEO",
        numHands: 2
      });

      self.postMessage({ type: 'init-success', delegate: config.delegate });
    } catch (error) {
      self.postMessage({ type: 'init-error', error: error.toString() });
    }
  }

  async function detect(imageBitmap) {
    if (!gestureRecognizer) {
      imageBitmap.close();
      self.postMessage({ type: 'result', result: null, timestamp: performance.now() });
      return;
    }

    const timestamp = performance.now();
    
    try {
      const result = gestureRecognizer.recognizeForVideo(imageBitmap, timestamp);
      
      const simpleResult = {
        landmarks: result ? result.landmarks : [],
        gestures: result && result.gestures ? result.gestures.map(cats => ({ categories: cats })) : [],
        handednesses: result ? (result.handednesses || result.handedness) : []
      };

      self.postMessage({ 
        type: 'result', 
        result: simpleResult,
        timestamp 
      });
    } catch (e) {
      console.error("Detection error in worker:", e);
      self.postMessage({ type: 'result', result: null, timestamp });
    } finally {
      if (imageBitmap && typeof imageBitmap.close === 'function') {
        imageBitmap.close();
      }
    }
  }

  self.onmessage = async (event) => {
    const { type, payload } = event.data;

    if (type === 'init') {
      await init(payload || {});
    } else if (type === 'detect') {
      await detect(payload.image);
    }
  };
  `;

    const initWorker = async () => {
        if (workerRef.value) workerRef.value.terminate();
        isBusyRef.value = false;

        let workerUrl = '';

        try {
            addLog('Fetching MediaPipe library...', 'info');
            const response = await fetch('/mediapipe.js');
            if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
            const libCode = await response.text();

            addLog('Compiling worker...', 'info');
            const fullScript = libCode + '\n\n' + WORKER_LOGIC;
            const blob = new Blob([fullScript], { type: 'application/javascript' });
            workerUrl = URL.createObjectURL(blob);

            const worker = new Worker(workerUrl);
            workerRef.value = worker;

            worker.onmessage = (e: MessageEvent<WorkerMessage & { delegate?: string }>) => {
                const { type } = e.data;
                if (type === 'init-success') {
                    const usedDelegate = (e.data as any).delegate || 'CPU';
                    isWorkerReady.value = true;
                    activeDelegate.value = usedDelegate;
                    isBusyRef.value = false;
                    addLog(`Initialized (${usedDelegate}).`, 'success');
                } else if (type === 'init-error') {
                    addLog(`Init Failed: ${(e.data as any).error}`, 'error');
                    isBusyRef.value = false;
                } else if (type === 'result') {
                    handleResult((e.data as any).result);
                    isBusyRef.value = false;
                    updateFps();
                }
            };

            // Auto-detect GPU
            let useGPU = false;
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
                useGPU = !!gl;
            } catch (e) { useGPU = false; }

            const baseUrl = window.location.origin;
            const delegate = useGPU ? 'GPU' : 'CPU';
            worker.postMessage({
                type: 'init',
                payload: {
                    delegate,
                    wasmBase: `${baseUrl}/libs`,
                    modelPath: `${baseUrl}/models/gesture_recognizer.task`
                }
            });

        } catch (err: any) {
            addLog(`Setup Error: ${err.message}`, 'error');
        }
    };

    const frameCount = ref(0);
    const lastFpsTime = ref(0);
    const updateFps = () => {
        frameCount.value++;
        const now = performance.now();
        if (now - lastFpsTime.value >= 1000) {
            fps.value = frameCount.value;
            frameCount.value = 0;
            lastFpsTime.value = now;
        }
    };

    // State Machine Variables
    const STATE = {
        lastPinchTime: 0,
        clickCount: 0,
        clickTimer: null as ReturnType<typeof setTimeout> | null,
        dragStartTime: 0,
        isDragging: false,
        isMiddleDragging: false,
        lastPosition: { x: 0, y: 0 }
    };

    const handleResult = (result: any) => {
        if (!result) return;
        const now = performance.now();

        // Standardized Reset
        const resetState = () => {
            gestureState.value.cursor.active = false;
            gestureState.value.gestures = [];
            // Keep last known events for a frame? No, instant feedback.
            gestureState.value.events = { 'IDLE': true };
            gestureState.value.debugInfo.landmarks = [];
        }

        // Reset if no hands
        if (!result.landmarks || result.landmarks.length === 0) {
            resetState();
            return;
        }

        // 1. Hand Filtering & Selection
        let targetHandIndex = -1;
        const hands = result.landmarks;
        const handednesses = result.handednesses;

        if (config.hand !== 'Both') {
            // Strict Mode: Look for specific hand
            const correctIndex = handednesses.findIndex((h: any) => {
                const label = h[0]?.categoryName;
                return label === config.hand; // 'Left' or 'Right'
            });

            if (correctIndex !== -1) {
                targetHandIndex = correctIndex;
            } else {
                // Desired hand not found. Ignore other hands.
                resetState();
                return;
            }
        } else {
            // Both allowed, default to first (primary)
            targetHandIndex = 0;
        }

        if (targetHandIndex === -1 || !hands[targetHandIndex]) {
            resetState();
            return;
        }

        const hand = hands[targetHandIndex];
        const handednessObj = handednesses[targetHandIndex];
        const handLabel = handednessObj && handednessObj[0] ? handednessObj[0].categoryName : 'Unknown';

        // Debug Info / ROI
        const root = hand[0]; // Wrist
        // Z-depth scale calculation
        // Wrist z is relative to image plane. 
        // We want effective ROI to shrink as hand moves away (Z decreases/becomes smaller).
        // Actually Z is usually 0 at wrist in World landmarks, but in Normalized landmarks it's relative?
        // Wait, recognizeForVideo returns Normalized landmarks (x,y,z). Z is relative to wrist depth logic usually.
        // Let's use simple scale: Hand Scale.
        // Distance Wrist(0) to MiddleMCP(9)
        const wristToMiddle = Math.sqrt(Math.pow(root.x - hand[9].x, 2) + Math.pow(root.y - hand[9].y, 2));
        // typical size ~ 0.15 (Close) to 0.05 (Far)

        let roiScaleFactor = 1.0;
        // If hand is small (far), effective ROI should be small to allow reaching corners.
        // ROI size = BaseROI * (HandSize / RefSize) ? 
        // No, User said: "Z used to dynamically change ROI box... hand far -> ROI small"
        // We can just us a linear map based on handSize.
        // Let's map handSize 0.05 -> ROI 0.3, handSize 0.2 -> ROI 0.8

        // Using Wrist Z if available? In Normalized landmarks, Z is approximate.
        // Let's trust handSize (0->9 distance) as proxy for distance.
        const refSize = 0.10; // "Normal" distance size
        const distFactor = wristToMiddle / refSize;

        // Effective ROI
        let effRoi = config.roi * Math.min(1.2, Math.max(0.5, distFactor));
        // Cap
        if (effRoi > 1.0) effRoi = 1.0;

        const newDebugInfo = {
            rootPos: { x: root.x, y: root.y },
            handScale: wristToMiddle,
            roi: config.roi,
            effectiveRoi: effRoi,
            landmarks: hand,
            handedness: handLabel
        };
        gestureState.value.debugInfo = newDebugInfo;


        // 2. Cursor Mapping
        const indexTip = hand[8];
        if (indexTip) {
            // Mirroring: If camera is mirrored, x is 1-x.
            // Usually local webcam is mirrored.
            let rawX = 1 - indexTip.x;
            let rawY = indexTip.y;

            // Apply ROI Scaling
            // Center is (0.5, 0.5).
            // Map (0.5 - ROI/2) -> 0, (0.5 + ROI/2) -> 1
            const roiHalf = effRoi / 2;
            const roiMinX = 0.5 - roiHalf;
            const roiMinY = 0.5 - roiHalf;

            let mappedX = (rawX - roiMinX) / effRoi;
            let mappedY = (rawY - roiMinY) / effRoi;

            // Clamp
            mappedX = Math.max(0, Math.min(1, mappedX));
            mappedY = Math.max(0, Math.min(1, mappedY));

            // Smoothing
            const bufferSize = BUFFER_SIZE_MAP[config.smoothing] || 5;
            positionBuffer.push({ x: mappedX, y: mappedY });
            if (positionBuffer.length > bufferSize) positionBuffer.shift();

            const avgX = positionBuffer.reduce((sum, p) => sum + p.x, 0) / positionBuffer.length;
            const avgY = positionBuffer.reduce((sum, p) => sum + p.y, 0) / positionBuffer.length;

            gestureState.value.cursor.x = avgX * window.innerWidth;
            gestureState.value.cursor.y = avgY * window.innerHeight;
            gestureState.value.cursor.active = true;
        }

        // 3. Gesture State Machine
        const thumbTip = hand[4];
        const middleTip = hand[12];
        const indexTipP = hand[8];

        const distIndexThumb = calculateDistance(indexTipP, thumbTip);
        const distMiddleThumb = calculateDistance(middleTip, thumbTip);

        // Constants (normalized coords)
        const PINCH_THRESH = 0.05;
        const isPinch = distIndexThumb < PINCH_THRESH;
        const isMiddlePinch = distMiddleThumb < PINCH_THRESH;

        const currentEvents: Record<string, boolean> = {};

        // Middle Pinch = Rotate logic
        if (isMiddlePinch) {
            if (!STATE.isMiddleDragging) {
                currentEvents['DRAG_MIDDLE_START'] = true;
                STATE.isMiddleDragging = true;
            } else {
                currentEvents['DRAG_MIDDLE_MOVE'] = true;
            }
            gestureState.value.cursor.mode = 'rotate';
        } else {
            // End Rotate
            if (STATE.isMiddleDragging) {
                currentEvents['DRAG_MIDDLE_END'] = true;
                STATE.isMiddleDragging = false;
            }

            if (isPinch) {
                // Index Pinch = Click / Drag
                if (!STATE.isDragging) {
                    if (STATE.dragStartTime === 0) STATE.dragStartTime = now;

                    // 200ms hold -> Drag Start
                    if (now - STATE.dragStartTime > 200) {
                        STATE.isDragging = true;
                        currentEvents['DRAG_START'] = true;
                    }
                } else {
                    currentEvents['DRAG_MOVE'] = true;
                    gestureState.value.cursor.mode = 'drag';
                }
            } else {
                // Release
                if (STATE.isDragging) {
                    currentEvents['DRAG_END'] = true;
                    STATE.isDragging = false;
                    STATE.dragStartTime = 0;
                } else if (STATE.dragStartTime > 0) {
                    // Short press logic
                    STATE.dragStartTime = 0;

                    // Double Click Detection
                    STATE.clickCount++;
                    if (STATE.clickCount === 1) {
                        // Wait 300ms for second click
                        STATE.clickTimer = setTimeout(() => {
                            STATE.clickCount = 0;
                            // Timeout -> Single Click confirmed (too late for double)
                            // We can emit single click now? 
                            // Or just emit CLICK on release for responsiveness, 
                            // and DOUBLE_CLICK effectively fires two clicks + 1 double?
                            // Standard UI: Click always fires. Double click fires after.
                        }, 300);
                        currentEvents['CLICK'] = true;
                    } else {
                        if (STATE.clickTimer) clearTimeout(STATE.clickTimer);
                        STATE.clickCount = 0;
                        currentEvents['DOUBLE_CLICK'] = true;
                    }
                }
                gestureState.value.cursor.mode = 'none';
            }
        }

        if (!isPinch && !isMiddlePinch && !STATE.isDragging && !STATE.isMiddleDragging) {
            gestureState.value.cursor.mode = 'none';
            if (gestureState.value.cursor.active) currentEvents['POINTER_MOVE'] = true;
            else currentEvents['IDLE'] = true;
        }

        // Gesture Name (Classification)
        const cats = result.gestures?.[targetHandIndex]?.categories;
        const gestureName = cats && cats.length > 0 ? cats[0].categoryName : 'None';
        gestureState.value.gestures = [gestureName];

        gestureState.value.events = currentEvents;

        // Pass to Global Event Bridge
        // We will implement this in `App.vue` watcher or a utility hook.
        // window.dispatchEvent(new CustomEvent('gesture-event', { detail: { state: gestureState.value }}));
    };

    const calculateDistance = (p1: any, p2: any) => {
        if (!p1 || !p2) return 1;
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    };

    const startCamera = async () => {
        if (isCameraActive.value || !videoRef.value) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: config.videoSource ? { exact: config.videoSource } : undefined,
                    width: 640, height: 480, frameRate: { ideal: 30 }
                }
            });
            videoRef.value.srcObject = stream;
            videoRef.value.onloadedmetadata = () => {
                videoRef.value!.play();
                isCameraActive.value = true;
                isBusyRef.value = false;
                startPredictionLoop();
            };
            addLog(`Camera started`, 'success');
        } catch (e: any) {
            addLog(`Camera Error: ${e.message}`, 'error');
        }
    };

    const stopCamera = () => {
        if (requestRef.value) {
            cancelAnimationFrame(requestRef.value);
            requestRef.value = null;
        }
        if (videoRef.value && videoRef.value.srcObject) {
            const stream = videoRef.value.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoRef.value.srcObject = null;
        }
        isCameraActive.value = false;
        isBusyRef.value = false;
        gestureState.value.cursor.active = false;
        addLog('Camera stopped', 'info');
    };

    const startPredictionLoop = () => {
        if (requestRef.value) cancelAnimationFrame(requestRef.value);

        const loop = async () => {
            if (!isCameraActive.value) return;

            if (
                videoRef.value &&
                workerRef.value &&
                isWorkerReady.value &&
                !isBusyRef.value &&
                videoRef.value.readyState >= 2
            ) {
                try {
                    isBusyRef.value = true;
                    // Optimization: Do we need full res? 
                    const bitmap = await createImageBitmap(videoRef.value);
                    workerRef.value.postMessage({ type: 'detect', payload: { image: bitmap } }, [bitmap]);
                } catch (e) {
                    isBusyRef.value = false;
                }
            }
            requestRef.value = requestAnimationFrame(loop);
        };
        loop();
    };

    onUnmounted(() => {
        stopCamera();
        workerRef.value?.terminate();
    });

    // Configuration Setters
    const setHandPreference = (h: HandPreference) => {
        config.hand = h;
        addLog(`Hand preference set to: ${h}`, 'info');
    };
    const setSmoothing = (s: SmoothingProfile) => {
        config.smoothing = s;
        addLog(`Smoothing profile set to: ${s}`, 'info');
    };
    const setRoi = (r: number) => config.roi = r;
    const setVideoSource = (id: string) => {
        config.videoSource = id;
        addLog(`Video source changed. Restarting...`, 'info');
        // Optional: Auto restart
        if (isCameraActive.value) {
            stopCamera();
            startCamera();
        }
    };

    return {
        videoRef,
        canvasRef,
        isCameraActive,
        isWorkerReady,
        fps,
        activeDelegate,
        logs,
        gestureState,
        initWorker,
        startCamera,
        stopCamera,
        setHandPreference,
        setSmoothing,
        setRoi,
        setVideoSource
    };
}
