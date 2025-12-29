<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  visible: boolean;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const contentRef = ref<HTMLDivElement | null>(null);
const scrollTop = ref(0);
const maxScroll = ref(0);

// Physics State
let velocity = 0;
let lastY = 0;
let isDragging = false;
let animationFrame = 0;

const style = computed(() => ({
  transform: props.visible ? 'translateX(0) translateY(-50%)' : 'translateX(100%) translateY(-50%)',
  opacity: props.visible ? 1 : 0
}));

const contentStyle = computed(() => ({
  transform: `translateY(${-scrollTop.value}px)`
}));

onMounted(() => {
  // Slight delay to ensure layout is ready
  setTimeout(updateMaxScroll, 100);
  window.addEventListener('resize', updateMaxScroll);
  window.addEventListener('mouseup', onStopDrag);
  window.addEventListener('mousemove', onDragMove);
});

onUnmounted(() => {
  window.removeEventListener('resize', updateMaxScroll);
  window.removeEventListener('mouseup', onStopDrag);
  window.removeEventListener('mousemove', onDragMove);
  if (animationFrame) cancelAnimationFrame(animationFrame);
});

const updateMaxScroll = () => {
    if (containerRef.value && contentRef.value) {
        maxScroll.value = Math.max(0, contentRef.value.scrollHeight - containerRef.value.clientHeight);
    }
}

// ---- Standard Mouse Events (Works with Real Mouse AND Gesture Bridge) ----

const onStartDrag = (e: MouseEvent) => {
    isDragging = true;
    lastY = e.clientY;
    velocity = 0;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    e.preventDefault(); // Prevent text selection
};

const onDragMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    const dy = e.clientY - lastY;
    scrollTop.value -= dy; // 1:1 movement
    velocity = -dy; // Store velocity
    
    // Clamp
    scrollTop.value = Math.max(0, Math.min(scrollTop.value, maxScroll.value));
    
    lastY = e.clientY;
};

const onStopDrag = () => {
    if (isDragging) {
        isDragging = false;
        requestAnimationFrame(momentumLoop);
    }
};

const momentumLoop = () => {
  if (isDragging) return; 
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

  animationFrame = requestAnimationFrame(momentumLoop);
};

const onWheel = (e: WheelEvent) => {
    scrollTop.value += e.deltaY;
    scrollTop.value = Math.max(0, Math.min(scrollTop.value, maxScroll.value));
    velocity = 0; // Stop momentum on wheel
    e.preventDefault();
}

</script>

<template>
  <div 
    ref="containerRef" 
    class="scrollable-text-container" 
    :style="style"
    @mousedown="onStartDrag"
    @wheel="onWheel"
  >
    <div ref="contentRef" class="scrollable-text-content" :style="contentStyle">
      <h2>Scroll Control</h2>
      <p>
        The text panel you are reading demonstrates the <strong>Virtual Drag</strong> capability.
      </p>
      <p>
        You can use your mouse to drag this text up and down, or use the <strong>Index Pinch</strong> gesture to grab the panel and scroll just like a touchscreen.
      </p>
      <hr style="border:0; border-top:1px solid var(--border-color); margin: 24px 0;" />
      <div v-for="i in 10" :key="i">
        <p>
            <strong>Section {{ i }}</strong><br/>
            This is additional content to demonstrate the scrolling physics. Momentum is calculated based on your throw speed.
        </p>
      </div>
       <p style="opacity:0.5; font-size:0.8rem; margin-top:24px;">End of content.</p>
    </div>
  </div>
</template>

<style scoped>
/* Scoped styles removed. Using global style.css */
</style>
