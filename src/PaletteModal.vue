<template>
  <div v-if="visible" class="modal-overlay" @click.self="onCancel">
    <div class="palette-modal scrollbar-custom">
      <div class="modal-header">
        <span>色盘</span>
        <button class="close-btn" @click="onCancel">&times;</button>
      </div>
      <div class="modal-body">
        <div class="palette-grid">
          <span
              v-for="color in sortedPalette"
              :key="color.code"
              class="palette-swatch"
              :class="{ selected: selectedCode === color.code }"
              :style="{ background: `rgb(${color.r}, ${color.g}, ${color.b}, ${color.a})`, color: color.textColor }"
              @click="selectColor(color.code)"
          >{{ color.code }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {computed} from 'vue';
import {isHighlightColor} from "./palette";

const props = defineProps({
  visible: {type: Boolean, default: false},
  currentPalette: {type: Array, default: () => []},
  selectedCode: {type: String, default: null},
});

const emit = defineEmits(['update:selectedCode', 'cancel']);

const sortedPalette = computed(() => {
  return [...props.currentPalette]
      .filter((c) => c.code)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, {numeric: true}))
      .map((c) => {
        return {code: c.code, textColor: isHighlightColor(c) ? '#fff' : '#000'};
      });
});

function selectColor(color) {
  emit('update:selectedCode', color.code);
  emit('cancel');
}

function onCancel() {
  emit('cancel');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.palette-modal {
  background: #fefaf5;
  border-radius: 12px;
  width: 85vw;
  max-height: 70vh;
  overflow-y: auto;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 1.2rem;
  font-size: 1.1rem;
  font-weight: 600;
  border-bottom: 1px solid #eddcd2;
  position: sticky;
  top: 0;
  background: #fefaf5;
  border-radius: 12px 12px 0 0;
  z-index: 1;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0 0.2rem;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 1rem 1.2rem;
}

.palette-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.palette-swatch {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 2rem;
  height: 2rem;
  border-radius: 4px;
  cursor: pointer;
  font-family: Consolas, monospace;
  font-size: 0.75rem;
  font-weight: bold;
  transition: border-color 0.15s, box-shadow 0.15s;
  user-select: none;
}

.palette-swatch:hover {
  border-color: rgba(0, 0, 0, 0.3);
}

.palette-swatch.selected {
  box-shadow: 0 0 0 2px #4CAF50;
}
</style>
