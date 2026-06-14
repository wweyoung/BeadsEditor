<template>
  <span
      class="palette-swatch"
      :class="{ selected, highlighted, lack }"
      :style="style"
      @click="$emit('click', $event)"
  >
    <span class="swatch-text"><slot>{{ code }}</slot></span>
    <span v-if="description != null" class="swatch-description">{{ description }}</span>
  </span>
</template>

<script setup>
import {computed} from 'vue';
import {isHighlightColor, PALETTE_MAP} from "./palette";

const props = defineProps({
  code: {type: String, required: true},
  description: {type: [Number, String], default: null},
  selected: {type: Boolean, default: false},
  highlighted: {type: Boolean, default: false},
  lack: {type: Boolean, default: false},
  size: {type: String, default: "2.2rem"}
});

defineEmits(['click']);

const style = computed(() => {
  const color = PALETTE_MAP[props.code]
  const style = {minWidth: props.size, minHeight: props.size}
  if (!color) return style;
  const textColor = isHighlightColor(color) > 128 ? '#000' : '#fff';
  return {backgroundColor: color.hex, color: textColor, ...style};
});
</script>

<style scoped>
.palette-swatch {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  font-family: Consolas, monospace;
  transition: box-shadow 0.15s, opacity 0.15s;
  user-select: none;
  line-height: 1.2;
  box-sizing: border-box;
  box-shadow: inset #9E9E9E 0px 0px 1px 0px;
}

.swatch-text {
  font-size: 0.75rem;
  font-weight: bold;
}

.swatch-description {
  font-size: 0.6rem;
  opacity: 0.75;
  line-height: 1;
}

.palette-swatch:hover {
  opacity: 0.85;
}

.palette-swatch.lack {
  box-shadow: inset 0 0 0 2px #F44336;
}
.palette-swatch.lack:before {
  content: '无';
  position: absolute;
  top: 0;
  left: 0;
  background-color: #F44336;
  font-size: 7px;
  color: white;
  padding: 1px 4px;
  border-radius: 5px 0;
}

.palette-swatch.selected {
  outline: 2px solid #4CAF50;
  outline-offset: 2px;
}

.palette-swatch.highlighted {
  outline: 2px solid #FFD700;
  outline-offset: 2px;
}

.palette-swatch.selected.highlighted {
  box-shadow: inset 0 0 0 2px #4CAF50;
}

@media (max-width: 600px) {
  .palette-swatch {
    border-radius: 8px;
  }

  .swatch-text {
    font-size: 0.85rem;
  }

  .swatch-description {
    font-size: 0.65rem;
  }
}
</style>
