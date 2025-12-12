<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  x: number;
  y: number;
  mode: 'none' | 'click' | 'drag' | 'scroll' | 'rotate';
  active: boolean; // Is hand detected?
  mouseActive: boolean; // Is real mouse moving?
}>();

const style = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  display: (props.active && !props.mouseActive) ? 'block' : 'none'
}));
</script>

<template>
  <div class="gesture-cursor" :class="[mode]" :style="style"></div>
</template>

<style scoped>
.gesture-cursor {
  position: fixed;
  width: 12px;
  height: 12px;
  border: 2px solid var(--primary-color);
  border-radius: 50%;
  pointer-events: none;
  z-index: 9999;
  transform: translate(-50%, -50%);
  transition: width 0.1s, height 0.1s, background-color 0.1s;
  box-shadow: 0 0 15px var(--primary-color);
  background: transparent;
}

.gesture-cursor.click {
  background: var(--primary-color);
  width: 8px;
  height: 8px;
}

.gesture-cursor.drag, .gesture-cursor.scroll, .gesture-cursor.rotate {
  border-color: white;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.1);
}

.gesture-cursor.rotate {
  border-color: #ffd700;
  border-radius: 30%;
}

</style>
