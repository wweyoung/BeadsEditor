<template>
  <span class="color-picker">
    <span
        class="color-preview"
        :class="{ transparent: modelValue === null }"
        :style="previewStyle"
        :title="title"
        @click="openPicker"
    >
      <span v-if="modelValue === null" class="transparent-icon">⊘</span>
    </span>
    <input
        ref="colorInput"
        type="color"
        :value="modelValue || '#000000'"
        @input="onColorInput"
    />
    <button
        v-if="transparent"
        class="transparent-btn"
        :class="{ active: modelValue === null }"
        :title="modelValue === null ? '取消透明' : '设为透明'"
        @click.stop="toggleTransparent"
    >透明</button>
  </span>
</template>

<script setup>
import {computed, ref} from 'vue';

const props = defineProps({
  modelValue: {type: [String, null], default: null},
  title: {type: String, default: ''},
  transparent: {type: Boolean, default: true},
});

const emit = defineEmits(['update:modelValue']);

const colorInput = ref(null);
const lastColor = ref('#000000');

const previewStyle = computed(() => {
  if (props.modelValue === null) {
    return {};
  }
  return {backgroundColor: props.modelValue};
});

function openPicker() {
  colorInput.value?.click();
}

function onColorInput(e) {
  const val = e.target.value;
  lastColor.value = val;
  emit('update:modelValue', val);
}

function toggleTransparent() {
  emit('update:modelValue', props.modelValue === null ? lastColor.value : null);
}
</script>

<style scoped>
.color-picker {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.color-preview {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  cursor: pointer;
  border: 1px solid #ccc;
  transition: border-color 0.15s;
}

.color-preview.transparent {
  background: repeating-conic-gradient(#ddd 0% 25%, transparent 0% 50%) 50% / 8px 8px;
}

.color-preview:hover {
  border-color: #999;
}

.transparent-icon {
  font-size: 0.8rem;
  color: #999;
  line-height: 1;
}

.color-picker input[type="color"] {
  display: none;
}

.transparent-btn {
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #f9f9f9;
  cursor: pointer;
  color: #666;
  line-height: 1.4;
  transition: background 0.15s, border-color 0.15s;
}

.transparent-btn:hover {
  background: #eee;
  border-color: #ccc;
}

.transparent-btn.active {
  background: #e8e0d8;
  border-color: #b45f4c;
  color: #b45f4c;
}
</style>
