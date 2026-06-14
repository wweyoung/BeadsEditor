<template>
  <div class="modal-overlay" @click.self="onCancel">
    <div class="palette-modal scrollbar-custom">
      <div class="modal-header">
        <span>{{ multiSelect ? title || '选择色号' : '色盘' }}</span>
        <button class="close-btn" @click="onCancel">&times;</button>
      </div>
      <div class="modal-body">
        <div v-if="showSimilar && similarColors">
          <div>
            <PaletteSwatch :code="selectedCode" size="30px"/> 相似色号
          </div>
          <div class="palette-grid">
            <PaletteSwatch
                v-for="color in similarColors"
                :key="color.code"
                :code="color.code"
                :selected="selectedCode === color.code"
                :description="parseInt(color.distance)"
                @click="multiSelect ? toggleCode(color.code) : selectColor(color.code)"
            />
          </div>
        </div>
        <div>
          <div>全部色号</div>
          <div class="palette-grid">
            <PaletteSwatch
                v-for="code in sortedCodes"
                :key="code"
                :code="code"
                :selected="multiSelect ? selectedSet.has(code) : selectedCode === code"
                @click="multiSelect ? toggleCode(code) : selectColor(code)"
            />
          </div>
        </div>
      </div>
      <div v-if="multiSelect" class="multi-actions">
        <span class="multi-count">已选 {{ selectedSet.size }} 个色号</span>
        <div class="multi-buttons">
          <button class="btn-cancel" @click="onCancel">取消</button>
          <button class="btn-confirm" @click="onConfirm">确认</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {computed, ref} from 'vue';
import PaletteSwatch from './PaletteSwatch.vue';
import {colorDistance, getSimilarColor, PALETTE_MAP,} from './palette.js';

const props = defineProps({
  currentPalette: {type: Array, default: () => []},
  selectedCode: {type: String, default: null},
  showSimilar: {type: Boolean, default: false},
  multiSelect: {type: Boolean, default: false},
  selectedCodes: {type: Array, default: () => []},
  title: {type: String, default: ''},
});

const emit = defineEmits(['update:selectedCode', 'cancel', 'confirm']);

const selectedSet = ref(new Set(props.selectedCodes));

const sortedCodes = computed(() => {
  return [...props.currentPalette]
      .sort((a, b) => a.code.localeCompare(b.code, undefined, {numeric: true}))
      .map((c) => c.code);
});
const similarColors = computed(() => {
  if (!props.selectedCode) return []
  const selected = PALETTE_MAP[props.selectedCode];
  if (!selected) return [];
  return getSimilarColor(selected.L, selected.A, selected.B, selected.a, props.currentPalette, 20)
});

function toggleCode(code) {
  const s = new Set(selectedSet.value);
  if (s.has(code)) s.delete(code); else s.add(code);
  selectedSet.value = s;
}

function selectColor(code) {
  emit('update:selectedCode', code);
  emit('cancel');
}

function onConfirm() {
  emit('confirm', [...selectedSet.value]);
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
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
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
  flex: 1;
  overflow-y: auto;
  padding: 1rem 1.2rem;
}

.palette-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 10px 0;
}

.multi-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 1.2rem;
  border-top: 1px solid #eddcd2;
  background: #fefaf5;
  border-radius: 0 0 12px 12px;
}

.multi-count {
  font-size: 0.85rem;
  color: #666;
}

.multi-buttons {
  display: flex;
  gap: 0.5rem;
}

.multi-buttons button {
  border: none;
  padding: 0.4rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s;
}

.multi-buttons .btn-cancel {
  background: #f0ebe5;
  color: #555;
}

.multi-buttons .btn-cancel:hover {
  background: #e5dfd8;
}

.multi-buttons .btn-confirm {
  background: #4CAF50;
  color: #fff;
}

.multi-buttons .btn-confirm:hover {
  background: #bca28c;
}
</style>
