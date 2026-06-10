<template>
  <div class="modal-overlay" @click.self="onCancel">
    <div class="palette-modal scrollbar-custom">
      <div class="modal-header">
        <span>色盘</span>
        <button class="close-btn" @click="onCancel">&times;</button>
      </div>
      <div class="modal-body">
        <div v-if="showSimilar && similarColors">
          <div>{{ selectedCode }} 相似色号</div>
          <div class="palette-grid">
            <PaletteSwatch
                v-for="color in similarColors"
                :key="color.code"
                :code="color.code"
                :selected="selectedCode === color.code"
                :description="parseInt(color.distance)"
                @click="selectColor(color.code)"
            />
          </div>
        </div>
        <div>
          <div>当前套装全部色号</div>
          <div class="palette-grid">
            <PaletteSwatch
                v-for="code in sortedCodes"
                :key="code"
                :code="code"
                :selected="selectedCode === code"
                @click="selectColor(code)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {computed} from 'vue';
import PaletteSwatch from './PaletteSwatch.vue';
import {colorDistance, PALETTE_MAP,} from './palette.js';

const props = defineProps({
  currentPalette: {type: Array, default: () => []},
  selectedCode: {type: String, default: null},
  showSimilar: {type: Boolean, default: false},
});

const emit = defineEmits(['update:selectedCode', 'cancel']);

const sortedCodes = computed(() => {
  return [...props.currentPalette]
      .sort((a, b) => a.code.localeCompare(b.code, undefined, {numeric: true}))
      .map((c) => c.code);
});
const similarColors = computed(() => {
  if (!props.selectedCode) return []
  const {L, a, b} = PALETTE_MAP[props.selectedCode]
  const palette = [...props.currentPalette];
  palette.forEach((c) => c.distance = colorDistance(L, a, b, c.L, c.a, c.b))
  return palette.sort((a, b) => a.distance - b.distance).slice(0, 10);
});

function selectColor(code) {
  emit('update:selectedCode', code);
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
</style>
