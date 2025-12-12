<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import type { GestureState } from '../composables/useGesture';

const props = defineProps<{
  gestureState: GestureState;
  visible: boolean;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const contentRef = ref<HTMLDivElement | null>(null);
const scrollTop = ref(0);
const maxScroll = ref(0);

// Smooth scrolling physics
let velocity = 0;
let lastY = 0;
let isDragging = false;
let animationFrame = 0;

const style = computed(() => ({
  transform: props.visible ? 'translateX(0)' : 'translateX(100%)',
  opacity: props.visible ? 1 : 0
}));

const contentStyle = computed(() => ({
  transform: `translateY(${-scrollTop.value}px)`
}));

onMounted(() => {
  if (containerRef.value && contentRef.value) {
    maxScroll.value = Math.max(0, contentRef.value.scrollHeight - containerRef.value.clientHeight);
  }
});

// Watch for gesture updates
watch(() => props.gestureState.cursor, (newVal) => {
  if (!props.visible || !containerRef.value) return;

  // Hit Test
  const rect = containerRef.value.getBoundingClientRect();
  const isInside = newVal.x >= rect.left && newVal.x <= rect.right && 
                   newVal.y >= rect.top && newVal.y <= rect.bottom;

  if (isInside && newVal.mode === 'drag') {
    if (!isDragging) {
      isDragging = true;
      lastY = newVal.y;
      velocity = 0;
    }
    
    // Drag logic (Direct Scroll)
    const dy = newVal.y - lastY;
    scrollTop.value -= dy * 2; // Multiplier for feel
    
    // Calculate velocity for inertia
    velocity = -dy * 2;
    lastY = newVal.y;

    // Clamp
    scrollTop.value = Math.max(0, Math.min(scrollTop.value, maxScroll.value));
  } else {
    if (isDragging) {
      isDragging = false;
      // Start momentum
      requestAnimationFrame(momentumLoop);
    }
  }
}, { deep: true });

const momentumLoop = () => {
  if (isDragging) return; // Stop if grabbed again
  if (Math.abs(velocity) < 0.1) return;

  scrollTop.value += velocity;
  velocity *= 0.95; // Friction

  // Bounce / Clamp
  if (scrollTop.value < 0) {
    scrollTop.value = 0;
    velocity = 0;
  } else if (scrollTop.value > maxScroll.value) {
    scrollTop.value = maxScroll.value;
    velocity = 0;
  }

  requestAnimationFrame(momentumLoop);
};

</script>

<template>
  <div ref="containerRef" class="scrollable-panel" :style="style">
    <div ref="contentRef" class="scroll-content" :style="contentStyle">
      <h2>Gesture Scrolling</h2>
      <p v-for="i in 20" :key="i">
        This is a scrollable text block item #{{ i }}. 
        Use the "Pinch & Drag" gesture to scroll up and down.
        Momentum scrolling is enabled for a smooth feel.
      </p>
    </div>
  </div>
</template>

<style scoped>
.scrollable-panel {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 300px;
  background: rgba(20, 20, 20, 0.95);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  padding: 20px;
  transition: transform 0.3s cubic-bezier(0.4, 0.0, 0.2, 1), opacity 0.3s;
  overflow: hidden;
  z-index: 100;
  color: #eee;
}

.scroll-content {
  will-change: transform;
}

h2 {
  margin-top: 0;
  color: var(--primary-color, #646cff);
}

p {
  margin-bottom: 1em;
  line-height: 1.6;
  font-size: 0.95rem;
  color: rgba(255,255,255,0.7);
}
</style>
