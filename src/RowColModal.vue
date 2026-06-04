<template>
  <div v-if="visible" class="modal-overlay" @click.self="onCancel">
    <div class="rowcol-modal">
      <div class="modal-header">
        <span>{{ modalTitle }}</span>
        <button class="close-btn" @click="onCancel">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <label>方向：</label>
          <div class="btn-group">
            <button
              v-for="dir in directions"
              :key="dir.value"
              class="option-btn"
              :class="{ active: direction === dir.value }"
              :disabled="dir.disabled"
              @click="direction = dir.value"
            >
              {{ dir.label }}
            </button>
          </div>
        </div>
        <div class="form-row">
          <label>操作：</label>
          <div class="btn-group">
            <button
              class="option-btn"
              :class="{ active: operation === 'insert' }"
              @click="operation = 'insert'"
            >
              插入
            </button>
            <button
              class="option-btn"
              :class="{ active: operation === 'remove' }"
              @click="operation = 'remove'"
            >
              移除
            </button>
          </div>
        </div>
        <div class="form-row">
          <label>数量：</label>
          <input type="number" v-model.number="count" min="1" max="100" class="count-input" />
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn cancel" @click="onCancel">取消</button>
        <button class="btn confirm" @click="onConfirm">{{ confirmText }}</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref, computed, watch} from 'vue';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  type: {
    type: String,
    default: 'column',
    validator: (v) => ['column', 'row'].includes(v)
  },
  index: {
    type: Number,
    default: 0
  }
});

const emit = defineEmits(['confirm', 'cancel']);

const direction = ref('right');
const operation = ref('insert');
const count = ref(1);

const directions = computed(() => {
  if (props.type === 'column') {
    return [
      { label: '向左', value: 'left', disabled: false },
      { label: '向右', value: 'right', disabled: false }
    ];
  } else {
    return [
      { label: '向上', value: 'up', disabled: false },
      { label: '向下', value: 'down', disabled: false }
    ];
  }
});

const modalTitle = computed(() => {
  const typeName = props.type === 'column' ? '列' : '行';
  return `向${props.index + 1}${typeName}${operation.value === 'insert' ? '插入' : '移除'}${typeName}`;
});

const confirmText = computed(() => {
  const dirMap = {
    left: '左',
    right: '右',
    up: '上',
    down: '下'
  };
  const typeName = props.type === 'column' ? '列' : '行';
  return `向${dirMap[direction.value]}${operation.value === 'insert' ? '插入' : '移除'}${count.value}${typeName}`;
});

watch(() => props.visible, (newVal) => {
  if (newVal) {
    direction.value = props.type === 'column' ? 'right' : 'down';
    operation.value = 'insert';
    count.value = 1;
  }
});

function onConfirm() {
  emit('confirm', {
    type: props.type,
    index: props.index,
    direction: direction.value,
    operation: operation.value,
    count: count.value
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

.rowcol-modal {
  background: #fff;
  border-radius: 8px;
  width: 320px;
  max-width: 90vw;

  .modal-header {
    padding: 16px;
    border-bottom: 1px solid #eee;
    font-weight: 600;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-body {
    padding: 16px;

    .form-row {
      margin-bottom: 16px;

      &:last-child {
        margin-bottom: 0;
      }

      label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
      }

      .btn-group {
        display: flex;
        gap: 8px;

        .option-btn {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #fff;
          cursor: pointer;
          transition: all 0.2s;

          &:hover:not(:disabled) {
            background: #f5f5f5;
          }

          &.active {
            background: #4a90d9;
            color: #fff;
            border-color: #4a90d9;
          }

          &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
        }
      }

      .count-input {
        width: 100px;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;

        &:focus {
          outline: none;
          border-color: #4a90d9;
        }
      }
    }
  }

  .modal-footer {
    padding: 16px;
    border-top: 1px solid #eee;
    display: flex;
    justify-content: flex-end;
    gap: 8px;

    .btn {
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      border: none;
      font-size: 14px;

      &.cancel {
        background: #f5f5f5;
        color: #333;

        &:hover {
          background: #e8e8e8;
        }
      }

      &.confirm {
        background: #4a90d9;
        color: #fff;

        &:hover {
          background: #3a7bc8;
        }
      }
    }
  }
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: #999;

  &:hover {
    color: #333;
  }
}
</style>
