<template>
  <div v-show="visible" class="selection-tool">
    <div class="sel-row">
      <span class="sel-label">选区</span>
      <button
          class="sel-btn"
          :class="{ active: selType === 'rect' }"
          title="矩形选区"
          @click="$emit('update:selType', 'rect')"
      >矩形</button>
      <button
          class="sel-btn"
          :class="{ active: selType === 'lasso' }"
          title="套索选区"
          @click="$emit('update:selType', 'lasso')"
      >套索</button>
      <button
          class="sel-btn"
          :class="{ active: selType === 'wand' }"
          title="魔棒选区"
          @click="$emit('update:selType', 'wand')"
      >魔棒</button>
    </div>
    <div v-if="selType === 'wand'" class="sel-row">
      <span class="sel-label">魔棒</span>
      <button
          class="sel-btn"
          :class="{ active: wandMode === 'single' }"
          title="选中相同色号的连通区域"
          @click="$emit('update:wandMode', 'single')"
      >单色</button>
      <button
          class="sel-btn"
          :class="{ active: wandMode === 'multi' }"
          title="选中所有非空格子的连通区域"
          @click="$emit('update:wandMode', 'multi')"
      >多色</button>
    </div>
    <div class="sel-row">
      <span class="sel-label">操作</span>
      <button
          class="sel-btn"
          :class="{ active: selAction === 'union' }"
          title="追加选区"
          @click="$emit('update:selAction', 'union')"
      >追加</button>
      <button
          class="sel-btn"
          :class="{ active: selAction === 'subtract' }"
          :disabled="!hasSelection"
          title="减少选区"
          @click="$emit('update:selAction', 'subtract')"
      >减少</button>
      <button
          class="sel-btn"
          :class="{ active: selAction === 'move' }"
          :disabled="!hasSelection"
          title="移动选区（原位置留空）"
          @click="$emit('update:selAction', 'move')"
      >移动</button>
      <button
          class="sel-btn"
          :class="{ active: selAction === 'copy' }"
          :disabled="!hasSelection"
          title="复制选区（原位置不变）"
          @click="$emit('update:selAction', 'copy')"
      >复制</button>
    </div>
    <div class="sel-row" v-if="hasSelection">
      <span class="sel-label"></span>
      <button
          v-if="(selAction === 'move' || selAction === 'copy')"
          class="sel-btn success"
          title="确认操作"
          @click="$emit('applyMove')"
      >确认</button>
      <button
          v-else
          class="sel-btn danger"
          title="删除选中内容"
          @click="$emit('delete')"
      >删除</button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  visible: { type: Boolean, default: false },
  selType: { type: String, default: 'rect' },
  selAction: { type: String, default: 'new' },
  hasSelection: { type: Boolean, default: false },
  wandMode: { type: String, default: 'single' },
});

defineEmits([
  'update:selType',
  'update:selAction',
  'delete',
  'applyMove',
  'clear',
  'update:wandMode',
]);
</script>

<style scoped>
.selection-tool {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border: 1px solid #eddcd2;
  border-radius: 1rem;
  padding: 0.6rem;
  z-index: 1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  white-space: nowrap;
}

.sel-row {
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.sel-label {
  font-size: 0.65rem;
  color: #5e4b3c;
  min-width: 2rem;
}

.sel-btn {
  padding: 0.3rem 0.5rem;
  font-size: 0.6rem;
  background: white;
  border: 1px solid #e7cfbc;
  border-radius: 2rem;
  font-weight: 600;
  color: #6b5a4b;
  cursor: pointer;
  transition: 0.2s;
  line-height: 1;
}

.sel-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.sel-btn.active {
  background: #f0ddd0;
  color: #b45f4c;
  border-color: #f0d3c1;
}

.sel-btn:active:not(:disabled) {
  background: #f8dcc9;
}

.sel-btn.success {
  color: #327b35;
  border-color: #8BC34A;
}
.sel-btn.success:active:not(:disabled) {
  background: #fbfff6;
}

.sel-btn.danger {
  color: #c0392b;
  border-color: #e8b4b0;
}

.sel-btn.danger:active:not(:disabled) {
  background: #fce8e6;
}
</style>
