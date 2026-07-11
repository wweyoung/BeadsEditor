<template>
  <div
      v-show="visible"
      class="settings-panel"
  >
    <div class="settings-row">
      <span class="label">背景</span>
      <ColorPicker :model-value="bgColor" @update:model-value="emit('update:bgColor', $event)" title="背景色"/>
    </div>
    <div class="settings-row">
      <span class="label">网格</span>
      <ColorPicker :model-value="gridColor" @update:model-value="emit('update:gridColor', $event)" title="网格颜色" :transparent="false"/>
    </div>
    <div class="settings-row">
      <span class="label">色号排序</span>
      <button class="text-btn" :class="{ active: colorSort === 'count' }" @click="updateSort('count')">
        数量
      </button>
      <button class="text-btn" :class="{ active: colorSort === 'alpha' }" @click="updateSort('alpha')">
        字母
      </button>
    </div>
    <div class="settings-row">
      <button class="text-btn" title="裁剪缩放" @click="emit('pixelChange')">裁剪缩放</button>
      <button v-if="colorMode === 'edit'" class="text-btn" title="自动裁剪" @click="emit('autoCropper')">自动裁剪</button>
      <button v-if="colorMode === 'edit'" class="text-btn" title="描边" @click="emit('outlineClick')">描边</button>
      <button v-if="colorMode === 'edit'" class="text-btn" title="修正空隙" @click="emit('fixGap')">修正空隙</button>
      <button v-if="colorMode === 'edit'" class="text-btn" title="自动排版" @click="emit('autoLayout')">自动排版</button>
    </div>
  </div>
</template>

<script setup>
import ColorPicker from './ColorPicker.vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  colorMode: { type: String, required: true },
  bgColor: { type: [String, null], default: '#fefaf5' },
  gridColor: { type: String, default: '#ff0000' },
  colorSort: { type: String, default: 'count' }
});

const emit = defineEmits([
  'update:bgColor',
  'update:gridColor',
  'update:colorSort',
  'pixelChange',
  'autoCropper',
  'outlineClick',
  'fixGap',
  'autoLayout',
  'close',
]);

function updateSort(val) {
  emit('update:colorSort', val);
}
</script>

<style scoped>
.settings-panel {
  position: absolute;
  bottom: 50px;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border: 1px solid #eddcd2;
  border-radius: 1rem;
  padding: 0.6rem;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.settings-panel .text-btn {
  padding: 0.3rem 0.5rem;
  font-size: 0.6rem;
  background: white;
  border: 1px solid #e7cfbc;
  border-radius: 2rem;
  font-weight: 600;
  color: #6b5a4b;
  cursor: pointer;
  transition: 0.2s;
  white-space: nowrap;
  line-height: 1;
}

.settings-panel .text-btn.active {
  background: #f0ddd0;
  color: #b45f4c;
  border-color: #f0d3c1;
}

.settings-panel .text-btn:active {
  background: #f8dcc9;
}

.settings-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.settings-row:last-child {
  flex-wrap: wrap;
  max-width: 11rem;
}

.settings-row .label {
  font-size: 0.7rem;
  color: #5e4b3c;
}
</style>
