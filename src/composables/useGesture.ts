import { ref, onUnmounted, type Ref } from 'vue';
import type { LogEntry, GestureResult, WorkerMessage } from '../types';

// Web Worker import for Vite
// Web Worker import removed in favor of Blob approach
// import GestureWorker from '../worker/gesture.worker?worker';

export interface GestureState {
    cursor: { x: number; y: number; active: boolean; mode: 'none' | 'click' | 'drag' | 'rotate' | 'scroll' };
    gestures: string[]; // e.g. "Thumb_Up", "Open_Palm"
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

    // Gesture State for UI
    const gestureState = ref<GestureState>({
        cursor: { x: 0, y: 0, active: false, mode: 'none' },
        gestures: []
    });

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

      // Use a consistent WASM URL or the one found in the original app
      const vision = await mp.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm"
      );

      gestureRecognizer = await mp.GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
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
        // Handle loose typings for handedness
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

            const delegate = useGPU ? 'GPU' : 'CPU';
            worker.postMessage({ type: 'init', payload: { delegate } });

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

    const handleResult = (result: GestureResult | null) => {
        if (!result || !canvasRef.value) return;

        // Draw landmarks (Basic debug drawing)
        const ctx = canvasRef.value.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvasRef.value.width, canvasRef.value.height);
            // We can implement drawing here or import from utils
            // For now, let's just focus on logic
            if (result.landmarks && result.landmarks.length > 0) {
                // Drawing logic can be added here if needed
            }
        }

        // Process Gestures for State
        if (result.landmarks && result.landmarks.length > 0) {
            const hand = result.landmarks[0]; // Primary hand
            // Normalize coordinates (0-1) to screen space
            // Hand landmark 8 is Index Tip, 4 is Thumb Tip.
            // We can use 9 (Middle Finger MCP) or a robust point for cursor.
            // Usually Index Tip (8) is good for pointing, or a centroid.

            const indexTip = hand[8];
            if (indexTip) {
                // Mirror X for intuitive control? Webcam is usually mirrored.
                // If we draw mirrored, we should also track mirrored.
                const x = 1 - indexTip.x;
                const y = indexTip.y;

                gestureState.value.cursor.x = x * window.innerWidth;
                gestureState.value.cursor.y = y * window.innerHeight;
                gestureState.value.cursor.active = true;
            }

            // Check Pinches
            const thumbTip = hand[4];
            const middleTip = hand[12];

            const isIndexPinch = calculateDistance(indexTip, thumbTip) < 0.05; // Threshold
            const isMiddlePinch = calculateDistance(middleTip, thumbTip) < 0.05;

            if (isMiddlePinch) {
                gestureState.value.cursor.mode = 'rotate'; // Middle Pinch -> Rotate
            } else if (isIndexPinch) {
                gestureState.value.cursor.mode = 'drag'; // Index Pinch -> Drag
            } else {
                gestureState.value.cursor.mode = 'none';
            }

        } else {
            gestureState.value.cursor.active = false;
        }
    };

    const calculateDistance = (p1: any, p2: any) => {
        if (!p1 || !p2) return 1;
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    };

    const startCamera = async () => {
        if (isCameraActive.value || !videoRef.value) return;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 640, height: 480, frameRate: { ideal: 30 } }
            });
            videoRef.value.srcObject = stream;
            videoRef.value.onloadedmetadata = () => {
                videoRef.value!.play();
                isCameraActive.value = true;
                isBusyRef.value = false;
                startPredictionLoop();
            };
        } catch (e: any) {
            addLog(`Camera Error: ${e.message}`, 'error');
        }
    };

    const stopCamera = () => {
        // Stop loop
        if (requestRef.value) {
            cancelAnimationFrame(requestRef.value);
            requestRef.value = null;
        }
        // Stop tracks
        if (videoRef.value && videoRef.value.srcObject) {
            const stream = videoRef.value.srcObject as MediaStream;
            stream.getTracks().forEach(t => t.stop());
            videoRef.value.srcObject = null;
        }
        isCameraActive.value = false;
        isBusyRef.value = false;
        gestureState.value.cursor.active = false;
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
        stopCamera
    };
}
