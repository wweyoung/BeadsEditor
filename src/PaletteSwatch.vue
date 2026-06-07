<template>
  <span
      class="palette-swatch"
      :class="{ selected, highlighted }"
      :style="style"
      @click="$emit('click', $event)"
  >
    <span class="swatch-text"><slot>{{ code }}</slot></span>
    <span v-if="count != null" class="swatch-count">{{ count }}</span>
  </span>
</template>

<script setup>
import {computed} from 'vue';
import {isHighlightColor, PALETTE_MAP} from "./palette";

const props = defineProps({
  code: {type: String, required: true},
  count: {type: [Number, String], default: null},
  selected: {type: Boolean, default: false},
  highlighted: {type: Boolean, default: false},
});

defineEmits(['click']);

const color = computed(() => PALETTE_MAP[props.code]);

const style = computed(() => {
  if (!color.value) return {};
  const hex = `#${color.value.r.toString(16).padStart(2, '0')}${color.value.g.toString(16).padStart(2, '0')}${color.value.b.toString(16).padStart(2, '0')}`;
  const textColor = isHighlightColor(color.value) ? '#fff' : '#000';
  return {backgroundColor: hex, color: textColor, borderColor: hex};
});
</script>

<style scoped>
.palette-swatch {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  min-height: 2rem;
  padding: 2px 6px;
  border-radius: 6px;
  cursor: pointer;
  font-family: Consolas, monospace;
  transition: box-shadow 0.15s, opacity 0.15s;
  user-select: none;
  line-height: 1.2;
  box-sizing: border-box;
}

.swatch-text {
  font-size: 0.75rem;
  font-weight: bold;
}

.swatch-count {
  font-size: 0.6rem;
  opacity: 0.75;
  line-height: 1;
}

.palette-swatch:hover {
  opacity: 0.85;
}

.palette-swatch.selected {
  box-shadow: 0 0 0 2px #4CAF50;
}

.palette-swatch.highlighted {
  box-shadow: 0 0 0 2px #FFD700;
}

.palette-swatch.selected.highlighted {
  box-shadow:
      inset 0 0 0 2px #4CAF50,
      0 0 0 2px #FFD700;
}
</style>
