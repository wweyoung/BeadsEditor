<template>
  <div v-if="visible" class="modal-overlay" @click.self="onCancel">
    <div class="palette-modal scrollbar-custom">
      <div class="modal-header">
        <span>色盘</span>
        <button class="close-btn" @click="onCancel">&times;</button>
      </div>
      <div class="modal-body">
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
</template>

<script setup>
import {computed} from 'vue';
import PaletteSwatch from './PaletteSwatch.vue';

const props = defineProps({
  visible: {type: Boolean, default: false},
  currentPalette: {type: Array, default: () => []},
  selectedCode: {type: String, default: null},
});

const emit = defineEmits(['update:selectedCode', 'cancel']);

const sortedCodes = computed(() => {
  return [...props.currentPalette]
      .filter((c) => c.code)
      .sort((a, b) => a.code.localeCompare(b.code, undefined, {numeric: true}))
      .map((c) => c.code);
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
