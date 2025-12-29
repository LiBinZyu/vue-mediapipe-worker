<script setup lang="ts">
import { ref, computed } from 'vue';
import { useDragScroll } from '../composables/useDragScroll';

const props = defineProps<{
  visible: boolean;
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const contentRef = ref<HTMLDivElement | null>(null);

// Shared Drag Logic
const { onStartDrag } = useDragScroll(containerRef);

const style = computed(() => ({
  transform: props.visible ? 'translateX(0) translateY(-50%)' : 'translateX(100%) translateY(-50%)',
  opacity: props.visible ? 1 : 0,
  // Ensure native scrolling works
  overflowY: 'auto' as 'auto', // or 'hidden' if we want to hide scrollbar but allow drag
  // Using auto allows wheel support natively
}));

const onWheel = (e: WheelEvent) => {
    // Native scroll handles this if overflow is auto
}
</script>

<template>
  <div 
    ref="containerRef" 
    class="scrollable-text-container" 
    :style="style"
    @mousedown="onStartDrag"
    @wheel="onWheel"
    style="cursor: grab;"
  >
    <!-- Content wrapper no longer needs transform, just flow -->
    <div ref="contentRef" class="scrollable-text-content">
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
.scrollable-text-container:active {
    cursor: grabbing !important;
}
/* Hide scrollbar for cleaner look if desired, but 'auto' is safer for now */
.scrollable-text-container::-webkit-scrollbar {
  width: 6px;
}
.scrollable-text-container::-webkit-scrollbar-thumb {
  background: rgba(255,255,255,0.2);
  border-radius: 4px;
}
</style>
