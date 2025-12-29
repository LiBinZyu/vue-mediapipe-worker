$visionWasmUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm/vision_wasm_internal.wasm"
$visionJsUrl = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm/vision_wasm_internal.js"
$modelUrl = "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task"

$outputLibs = "public/libs"
$outputModels = "public/models"

Write-Host "Downloading Assets for Offline Support..."

# Download WASM
Invoke-WebRequest -Uri $visionWasmUrl -OutFile "$outputLibs/vision_wasm_internal.wasm"
Write-Host "Downloaded vision_wasm_internal.wasm"

# Download JS Loader
Invoke-WebRequest -Uri $visionJsUrl -OutFile "$outputLibs/vision_wasm_internal.js"
Write-Host "Downloaded vision_wasm_internal.js"

# Download Model
Invoke-WebRequest -Uri $modelUrl -OutFile "$outputModels/gesture_recognizer.task"
Write-Host "Downloaded gesture_recognizer.task"

Write-Host "Done! Assets are ready for offline use."
