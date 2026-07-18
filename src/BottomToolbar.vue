<template>
  <div class="bottom-bar">
    <div class="btn-group">
      <button v-if="colorMode === 'edit'" class="text-btn" title="色盘" @click="$emit('openPalette')">
        <i class="iconfont icon-palette"></i>
      </button>
      <button
          v-if="colorMode === 'edit'"
          class="text-btn"
          :class="{ active: isBrushActive, continuous: operationMode === 'brush_continue' }"
          :style="isBrushActive ? {[selectedColor?.highlight > 200 ? 'backgroundColor' : 'color']: selectedColor?.hex} : null"
          title="画笔"
          :disabled="!selectedCode"
          @click="$emit('toggleMode', isBrushActive ? null : 'brush')"
          v-longpress="() => $emit('toggleMode', 'brush_continue')"
      >
        <i class="iconfont icon-paint-brush"></i>
      </button>
      <button
          v-if="colorMode === 'edit'"
          class="text-btn"
          :class="{ active: operationMode === 'fill' }"
          :style="operationMode === 'fill' ? {[selectedColor?.highlight > 200 ? 'backgroundColor' : 'color']: selectedColor?.hex} : null"
          title="填充"
          :disabled="!selectedCode"
          @click="$emit('toggleMode', 'fill')"
      >
        <i class="iconfont icon-fill-drip"></i>
      </button>
      <button
          v-if="colorMode === 'edit'"
          class="text-btn"
          :class="{ active: isEraserActive, continuous: operationMode === 'eraser_continue' }"
          title="橡皮擦"
          @click="$emit('toggleMode', isEraserActive ? null : 'eraser')"
          v-longpress="() => $emit('toggleMode', 'eraser_continue')"
      >
        <i class="iconfont icon-eraser"></i>
      </button>
      <button
          v-if="colorMode === 'edit'"
          class="text-btn"
          :class="{ active: operationMode === 'areaEraser' }"
          title="区域擦除"
          @click="$emit('toggleMode', 'areaEraser')"
      >
        <i class="iconfont icon-broom"></i>
      </button>
      <button
          v-if="colorMode === 'edit'"
          class="text-btn"
          :class="{ active: operationMode === 'selection' }"
          title="选区"
          @click="$emit('toggleMode', 'selection')"
      >
        <i class="iconfont icon-square-dashed"></i>
      </button>
    </div>
    <div class="btn-group">
      <button v-if="colorMode === 'edit'" :disabled="undoDisabled" class="text-btn" title="撤销(Ctrl+Z)" @click="$emit('undo')">
        <i class="iconfont icon-undo"></i>
      </button>
      <button v-if="colorMode === 'edit'" :disabled="redoDisabled" class="text-btn" title="重做(Ctrl+Y)" @click="$emit('redo')">
        <i class="iconfont icon-redo"></i>
      </button>
      <button class="text-btn" :class="{ active: showGrid }" title="网格" @click="$emit('toggleGrid')">
        <i class="iconfont icon-wangge"></i>
      </button>
      <button v-if="colorMode !== 'original'" class="text-btn" :class="{ active: showColorCode }" title="显示色号"
              @click="$emit('toggleColorCode')">
        <i class="iconfont icon-hashtag"></i>
      </button>
      <button v-if="colorMode !== 'original'" class="text-btn" title="左右镜像" @click="$emit('mirror')">
        <i class="iconfont icon-jingxiang"></i>
      </button>
      <button ref="settingsBtnRef" class="text-btn" title="设置" @click.stop="$emit('settingsToggle')">
        <i class="iconfont icon-cog"></i>
      </button>
    </div>

    <SettingsPanel
        :visible="settingsOpen"
        :color-mode="colorMode"
        :bg-color="bgColor"
        :grid-color="gridColor"
        :color-sort="colorSort"
        @update:bg-color="$emit('update:bgColor', $event)"
        @update:grid-color="$emit('update:gridColor', $event)"
        @update:color-sort="$emit('update:colorSort', $event)"
        @pixel-change="$emit('pixelChange')"
        @auto-cropper="$emit('autoCropper')"
        @outline-click="$emit('outlineClick')"
        @fix-gap="$emit('fixGap')"
        @auto-layout="$emit('autoLayout')"
    />
    <SelectionTool
        :visible="operationMode === 'selection' && colorMode === 'edit'"
        :sel-type="selType"
        :sel-action="selAction"
        :has-selection="hasSelection"
        :wand-mode="wandMode"
        @update:sel-type="$emit('update:selType', $event)"
        @update:sel-action="$emit('update:selAction', $event)"
        @update:wand-mode="$emit('update:wandMode', $event)"
        @delete="$emit('selectionDelete')"
        @move="$emit('selectionMove')"
        @apply-move="$emit('selectionApplyMove')"
        @clear="$emit('selectionClear')"
    />
  </div>
</template>

<script setup>
import {computed, ref} from 'vue';
import SettingsPanel from './SettingsPanel.vue';
import SelectionTool from './SelectionTool.vue';
import {PALETTE_MAP} from "./palette";
import {BeadsHistory} from "./util/beadsHistory";

const props = defineProps({
  colorMode: { type: String, default: 'original' },
  operationMode: { type: [String, null], default: null },
  selectedCode: { type: [String, null], default: null },
  showGrid: { type: Boolean, default: true },
  showColorCode: { type: Boolean, default: true },
  settingsOpen: { type: Boolean, default: false },
  bgColor: { type: [String, null], default: '#fefaf5' },
  gridColor: { type: String, default: '#ff0000' },
  colorSort: { type: String, default: 'count' },
  undoDisabled: { type:Boolean, default: false},
  redoDisabled: { type:Boolean, default: false},
  selType: { type: String, default: 'rect' },
  selAction: { type: String, default: 'new' },
  hasSelection: { type: Boolean, default: false },
  wandMode: { type: String, default: 'single' },
});

defineEmits([
  'toggleMode',
  'undo',
  'redo',
  'toggleGrid',
  'toggleColorCode',
  'mirror',
  'settingsToggle',
  'openPalette',
  'update:bgColor',
  'update:gridColor',
  'update:colorSort',
  'pixelChange',
  'autoCropper',
  'outlineClick',
  'fixGap',
  'autoLayout',
  'update:selType',
  'update:selAction',
  'update:wandMode',
  'selectionDelete',
  'selectionMove',
  'selectionClear',
  'selectionApplyMove',
]);

const isBrushActive = computed(() =>
    props.operationMode === 'brush' || props.operationMode === 'brush_continue'
);
const isEraserActive = computed(() =>
    props.operationMode === 'eraser' || props.operationMode === 'eraser_continue'
);
const selectedColor = computed(() => PALETTE_MAP[props.selectedCode])
</script>

<style scoped>
.bottom-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.5rem;
  background: #fefaf5;
  border-top: 1px solid #eddcd2;
  width: 100%;
  flex-shrink: 0;
  position: relative;
}

.btn-group {
  display: flex;
  gap: 0.4rem;
}

.text-btn {
  background: white;
  border: 1px solid #e7cfbc;
  padding: 0.3rem 0.8rem;
  border-radius: 2rem;
  font-weight: 600;
  font-size: clamp(0.7rem, 2vw, 0.85rem);
  color: #6b5a4b;
  transition: 0.2s;
  white-space: nowrap;
  line-height: 1;
  cursor: pointer;
}

.text-btn.active {
  background: #f0ddd0;
  color: #b45f4c;
  border-color: #f0d3c1;
}

.text-btn.continuous {
  position: relative;
}

.text-btn.continuous::after {
  content: '';
  position: absolute;
  bottom: 1px;
  right: 1px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  border: 1.5px solid white;
  box-shadow: 0 0 2px rgba(0,0,0,0.2);
  pointer-events: none;
}

.text-btn:active {
  background: #f8dcc9;
}

.text-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

@media (max-width: 600px) {
  .bottom-bar {
    gap: 0.35rem;
    padding: 0.5rem;
  }

  .btn-group {
    gap: 0.35rem;
  }

  .text-btn {
    padding: 0.5rem 0.65rem;
    font-size: 0.9rem;
  }
}
</style>
