<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  x: number;
  y: number;
  mode: 'none' | 'click' | 'drag' | 'rotate' | 'scroll';
  active: boolean; // active means hand is detected
  mouseActive: boolean;
}

const props = defineProps<Props>();

const cursorStyle = computed(() => ({
  left: `${props.x}px`,
  top: `${props.y}px`,
  // If active (hand detected), show it. 
  // If mouse is moving, maybe fade it but don't hide completely to avoid "disappearing" confusion unless requested.
  // User reported "cannot be seen". Let's force visibility if active.
  opacity: props.active ? 1 : 0, 
  // If we want to hide when mouse is moving:
  // opacity: props.active && !props.mouseActive ? 1 : (props.active ? 0.5 : 0)
}));

const cursorClass = computed(() => ({
  'gesture-cursor': true,
  'clicking': props.mode === 'click' || props.mode === 'drag', 
  'dragging': props.mode === 'drag' || props.mode === 'rotate' 
}));
</script>

<template>
  <div :style="cursorStyle" :class="cursorClass"></div>
</template>

<style scoped>
/* Scoped styles removed/minimal since we use global. */
</style>
