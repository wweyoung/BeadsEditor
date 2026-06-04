<template>
  <div v-if="visible" class="modal-overlay" @click.self="onCancel">
    <div class="export-modal">
      <div class="modal-header">
        <span>导出图片</span>
        <button class="close-btn" @click="onCancel">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-row checkbox-row">
          <label>
            <input type="checkbox" v-model="exportTitle" />
            <span>导出标题</span>
          </label>
        </div>
        <div class="form-row">
          <input type="text" v-model="artworkName" placeholder="作品名称" :disabled="!exportTitle" />
        </div>
        
        <div class="form-row checkbox-row">
          <label>
            <input type="checkbox" v-model="exportAuthor" />
            <span>添加水印</span>
          </label>
        </div>
        <div class="form-row">
          <input type="text" v-model="authorName" placeholder="作者名称" :disabled="!exportAuthor" />
        </div>
        
        <div class="form-row checkbox-row">
          <label>
            <input type="checkbox" v-model="exportGrid" />
            <span>导出网格</span>
          </label>
        </div>
        <div class="form-row checkbox-row">
          <label>
            <input type="checkbox" v-model="exportColorCode" />
            <span>导出色号</span>
          </label>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn cancel" @click="onCancel">取消</button>
        <button class="btn confirm" @click="onConfirm">确认导出</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref, watch} from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  defaultName: {
    type: String,
    default: ''
  },
  defaultAuthor: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['confirm', 'cancel']);

const artworkName = ref('');
const authorName = ref('');
const exportTitle = ref(true);
const exportAuthor = ref(false);
const exportGrid = ref(true);
const exportColorCode = ref(true);

watch(() => props.visible, (newVal) => {
  if (newVal) {
    artworkName.value = props.defaultName || 'pixel-art';
    const savedAuthor = localStorage.getItem('beads_author_name') || '';
    authorName.value = savedAuthor || props.defaultAuthor || '';
    exportTitle.value = true;
    exportAuthor.value = authorName.value ? true : false;
    exportGrid.value = true;
    exportColorCode.value = true;
  }
});

function onConfirm() {
  if (authorName.value) {
    localStorage.setItem('beads_author_name', authorName.value);
  }
  emit('confirm', {
    artworkName: artworkName.value,
    authorName: authorName.value,
    exportTitle: exportTitle.value,
    exportAuthor: exportAuthor.value,
    exportGrid: exportGrid.value,
    exportColorCode: exportColorCode.value
  });
}

function onCancel() {
  emit('cancel');
}
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.export-modal {
  background: #fff;
  border-radius: 0.5rem;
  overflow: hidden;
  width: 360px;
  max-width: 90vw;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  font-weight: 600;
  color: #5e4b3c;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.form-row label {
  font-size: 0.85rem;
  color: #5e4b3c;
  font-weight: 600;
}

.form-row input[type="text"] {
  padding: 0.5rem 0.7rem;
  border: 1px solid #e7cfbc;
  border-radius: 0.3rem;
  font-size: 0.9rem;
}

.form-row input[type="text"]:focus {
  outline: none;
  border-color: #b45f4c;
}

.form-row input[type="text"]:disabled {
  background: #f5f5f5;
  color: #999;
}

.checkbox-row label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: normal;
}

.checkbox-row input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  background: #fafafa;
  border-top: 1px solid #eee;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.3rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
  border: 1px solid #ccc;
}

.btn.cancel {
  background: #fff;
  color: #666;
}

.btn.cancel:hover {
  background: #f0f0f0;
}

.btn.confirm {
  background: #4CAF50;
  color: #fff;
  border-color: #45a049;
}

.btn.confirm:hover {
  background: #45a049;
}
</style>
