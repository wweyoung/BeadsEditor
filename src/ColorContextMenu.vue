<template>
  <Teleport to="body">
    <div
        v-if="colorCode"
        class="color-context-menu"
        :style="{ left: x + 'px', top: y + 'px' }"
        @click.stop
        ref="menuRef"
    >
      <div class="menu-header">
        <span class="menu-color-dot" :style="colorStyle"></span>
        <span class="menu-color-code">{{ colorCode }}</span>
      </div>
      <button @click="emit('select', colorCode)">
        {{ colorCode === selectedCode ? '取消选中色号' : '选中色号' }}
      </button>
      <button @click="emit('highlight', colorCode)">
        {{ colorCode === highlightCode ? '取消高亮色号' : '高亮色号' }}
      </button>
      <button @click="emit('replace', colorCode)">替换为指定色号</button>
      <button @click="emit('merge', colorCode)">合并至最接近的色号</button>
      <button class="danger" @click="emit('delete', colorCode)">删除色号</button>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  colorCode: { type: [String, null], default: null },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  colorStyle: { type: Object, default: () => ({}) },
  selectedCode: { type: [String, null], default: null },
  highlightCode: { type: [String, null], default: null },
});

const emit = defineEmits(['select', 'highlight', 'replace', 'merge', 'delete', 'close']);
const menuRef = ref(null);
</script>

<style scoped>
.color-context-menu {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  background: #fff;
  border: 1px solid #e0d6cc;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  overflow: hidden;
  min-width: 120px;
}

.color-context-menu .menu-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid #ece3da;
  background: #fefaf5;
}

.color-context-menu .menu-color-dot {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid rgba(0,0,0,0.1);
  flex-shrink: 0;
}

.color-context-menu .menu-color-code {
  font-family: Consolas, monospace;
  font-size: 0.85rem;
  font-weight: bold;
  color: #333;
}

.color-context-menu button {
  border: none;
  background: none;
  padding: 0.5rem 1rem;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.color-context-menu button:hover {
  background: #f5f0eb;
}

.color-context-menu button.danger {
  color: #e74c3c;
}

.color-context-menu button.danger:hover {
  background: #fde8e8;
}
</style>