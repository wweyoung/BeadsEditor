<template>
  <div
      v-if="visible"
      class="modal-overlay"
      :style="{ background: `rgba(0, 0, 0, ${overlayOpacity})` }"
      @click.self="closeOnOverlay && $emit('cancel')"
  >
    <div
        class="modal-container scrollbar-custom"
        :class="{ bare, draggable: draggable && !bare }"
        :style="containerStyle"
        ref="containerRef"
    >
      <template v-if="bare">
        <slot></slot>
      </template>
      <template v-else>
        <div
            class="modal-header"
            :class="{ 'modal-header-drag': draggable }"
            @mousedown="draggable ? onDragStart($event) : null"
        >
          <span class="modal-title">{{ title }}</span>
          <div class="modal-header-actions">
            <slot name="header-actions"></slot>
            <button
                v-if="closable"
                class="modal-close-btn"
                :disabled="closeDisabled"
                @click="$emit('cancel')"
            >&times;</button>
          </div>
        </div>
        <div class="modal-body">
          <slot></slot>
        </div>
        <div v-if="$slots.footer" class="modal-footer">
          <slot name="footer"></slot>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import {computed, ref, watch} from 'vue';

const props = defineProps({
  visible: {type: Boolean, default: false},
  title: {type: String, default: ''},
  width: {type: String, default: ''},
  maxWidth: {type: String, default: '90vw'},
  maxHeight: {type: String, default: ''},
  height: {type: String, default: ''},
  overlayOpacity: {type: Number, default: 0.4},
  bare: {type: Boolean, default: false},
  closable: {type: Boolean, default: true},
  closeDisabled: {type: Boolean, default: false},
  closeOnOverlay: {type: Boolean, default: false},
  draggable: {type: Boolean, default: false},
});

defineEmits(['cancel']);

const containerRef = ref(null);
const dragOffset = ref({x: 0, y: 0});

const containerStyle = computed(() => {
  const style = {};
  if (props.width) style.width = props.width;
  if (props.maxWidth) style.maxWidth = props.maxWidth;
  if (props.maxHeight) style.maxHeight = props.maxHeight;
  if (props.height) style.height = props.height;
  if (dragOffset.value.x || dragOffset.value.y) {
    style.transform = `translate(${dragOffset.value.x}px, ${dragOffset.value.y}px)`;
  }
  return style;
});

// 弹窗关闭时重置偏移
watch(() => props.visible, (v) => {
  if (!v) dragOffset.value = {x: 0, y: 0};
});

function onDragStart(e) {
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const originX = dragOffset.value.x;
  const originY = dragOffset.value.y;

  const onMove = (ev) => {
    dragOffset.value = {
      x: originX + (ev.clientX - startX),
      y: originY + (ev.clientY - startY),
    };
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: #fefaf5;
  border-radius: 12px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
  overflow-y: auto;
  position: relative;
}

.modal-container.bare {
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

.modal-header-drag {
  cursor: move;
  user-select: none;
}

.modal-header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.modal-close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #666;
  padding: 0 0.2rem;
  line-height: 1;
}

.modal-close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 0.8rem 1.2rem;
  position: relative;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  background: #fafafa;
  border-top: 1px solid #eee;
}
</style>
