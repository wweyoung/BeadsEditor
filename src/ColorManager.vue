<template>
  <div class="modal-overlay">
    <div class="color-manager scrollbar-custom">
      <div class="modal-header">
        <span>色号管理</span>
        <button class="close-btn" @click="onCancel">&times;</button>
      </div>
      <div class="modal-body">
        <div class="palette-list">
          <!-- 内置色号套装 -->
          <div
              v-for="p in builtinPalettes"
              :key="p.id"
              class="palette-item"
              :class="{ active: p.id === activeMode }"
              @click="selectPalette(p.id)"
          >
            <div class="palette-info">
              <span class="palette-name">{{ p.label }}</span>
              <span class="palette-count">{{ p.count }} 个色号</span>
            </div>
            <span class="palette-badge builtin">内置</span>
            <span class="palette-menu-btn" @click.stop="toggleMenu(p.id)">⋯</span>
            <!-- 内置子菜单 -->
            <div v-if="menuOpenId === p.id" class="palette-submenu" @click.stop>
              <button @click="duplicateBuiltin(p)">复制</button>
            </div>
          </div>

          <!-- 自定义色号套装 -->
          <div
              v-for="p in customPalettes"
              :key="p.id"
              class="palette-item"
              :class="{ active: p.id === activeMode }"
              @click="selectPalette(p.id)"
          >
            <div class="palette-info">
              <span class="palette-name">
                <template v-if="editingId === p.id">
                  <input
                      :ref="el => { if (el) nameInputEl = el }"
                      v-model="editingName"
                      class="inline-input"
                      @blur="confirmRename(p)"
                      @keydown.enter.prevent="confirmRename(p)"
                      @click.stop
                  />
                </template>
                <template v-else>
                  {{ p.name }}
                  <span class="edit-icon" @click.stop="startRename(p)">✎</span>
                </template>
              </span>
              <span class="palette-count">{{ p.codes.length }} 个色号</span>
            </div>
            <span class="palette-menu-btn" @click.stop="toggleMenu(p.id)">⋯</span>
            <!-- 子菜单 -->
            <div v-if="menuOpenId === p.id" class="palette-submenu" @click.stop>
              <button @click="editPalette(p)">编辑色号</button>
              <button @click="startRename(p)">更名</button>
              <button @click="duplicatePalette(p)">复制</button>
              <button class="danger" @click="deletePalette(p)">删除</button>
            </div>
          </div>

          <!-- 新增按钮 -->
          <div class="palette-item add-item" @click="startAdd">
            <span class="add-icon">+</span>
            <span>新建色号套装</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建 / 编辑色号：多选色号 -->
    <PaletteModal
        v-if="pickerVisible"
        :currentPalette="pickerPalette"
        :multiSelect="true"
        :selectedCodes="pickerSelected"
        :title="pickerTitle"
        @confirm="onPickerConfirm"
        @cancel="pickerVisible = false"
    />
  </div>
</template>

<script setup>
import {computed, nextTick, ref, watch} from 'vue';
import PaletteModal from './PaletteModal.vue';
import {
  COLOR_MODES,
  PALETTE_211,
  PALETTE_96,
  loadCustomPalettes,
  saveCustomPalettes,
  loadCustomPalette,
  nextCustomPaletteId,
} from './palette.js';

const props = defineProps({
  activeMode: {type: String, default: '211'},
});

const emit = defineEmits(['cancel', 'select']);

// ---------- 内置色号 ----------
const builtinPalettes = computed(() =>
    COLOR_MODES.map(m => ({
      id: m.mode,
      label: m.label,
      count: loadCustomPalette(m.mode)
          ? loadCustomPalette(m.mode).codes.length
          : (m.mode === '211' ? 211 : 96),
    }))
);

// ---------- 自定义色号 ----------
const customPalettes = ref(loadCustomPalettes());

function refreshCustom() {
  customPalettes.value = loadCustomPalettes();
}

// ---------- 菜单 ----------
const menuOpenId = ref(null);

function toggleMenu(id) {
  menuOpenId.value = menuOpenId.value === id ? null : id;
}

// 点击外部关闭菜单
watch(menuOpenId, (val) => {
  if (val) {
    const handler = () => {
      menuOpenId.value = null;
      document.removeEventListener('click', handler);
    };
    nextTick(() => document.addEventListener('click', handler));
  }
});

// ---------- 选择色号套装 ----------
function selectPalette(id) {
  if (menuOpenId.value) {
    menuOpenId.value = null;
    return;
  }
  emit('select', id);
  emit('cancel');
}

// ---------- 新建色号套装 ----------
const pickerVisible = ref(false);
const pickerTitle = ref('');
const pickerPalette = ref([]);
const pickerSelected = ref([]);
const pickerMode = ref(''); // 'add' | 'edit'
const pickerEditId = ref(null);

function startAdd() {
  pickerMode.value = 'add';
  pickerEditId.value = null;
  pickerTitle.value = '新建色号套装 - 选择色号';
  pickerPalette.value = PALETTE_211;
  pickerSelected.value = [];
  pickerVisible.value = true;
}

function editPalette(p) {
  pickerMode.value = 'edit';
  pickerEditId.value = p.id;
  pickerTitle.value = `编辑「${p.name}」- 选择色号`;
  pickerPalette.value = PALETTE_211;
  pickerSelected.value = [...p.codes];
  pickerVisible.value = true;
}

function onPickerConfirm(codes) {
  if (pickerMode.value === 'add') {
    const name = prompt('请输入色号套装名称：');
    if (!name) return;
    const palettes = loadCustomPalettes();
    palettes.push({
      id: nextCustomPaletteId(),
      name,
      codes,
    });
    saveCustomPalettes(palettes);
  } else if (pickerMode.value === 'edit') {
    const palettes = loadCustomPalettes();
    const idx = palettes.findIndex(p => p.id === pickerEditId.value);
    if (idx !== -1) {
      palettes[idx].codes = codes;
      saveCustomPalettes(palettes);
    }
  }
  refreshCustom();
  pickerVisible.value = false;
}

// ---------- 更名 ----------
const editingId = ref(null);
const editingName = ref('');
const nameInputEl = ref(null);

function startRename(p) {
  editingId.value = p.id;
  editingName.value = p.name;
  menuOpenId.value = null;
  nextTick(() => {
    nameInputEl.value?.focus();
    nameInputEl.value?.select();
  });
}

function confirmRename(p) {
  const name = editingName.value.trim();
  if (!name) {
    editingId.value = null;
    return;
  }
  const palettes = loadCustomPalettes();
  const idx = palettes.findIndex(item => item.id === p.id);
  if (idx !== -1) {
    palettes[idx].name = name;
    saveCustomPalettes(palettes);
    refreshCustom();
  }
  editingId.value = null;
}

// ---------- 复制内置色号 ----------
function duplicateBuiltin(p) {
  const palettes = loadCustomPalettes();
  const codes = p.id === '211'
      ? PALETTE_211.map(c => c.code)
      : PALETTE_96.map(c => c.code);
  const newName = p.label + ' (副本)';
  palettes.push({
    id: nextCustomPaletteId(),
    name: newName,
    codes,
  });
  saveCustomPalettes(palettes);
  refreshCustom();
  menuOpenId.value = null;
}

// ---------- 复制自定义色号 ----------
function duplicatePalette(p) {
  const palettes = loadCustomPalettes();
  const newName = p.name + ' (副本)';
  palettes.push({
    id: nextCustomPaletteId(),
    name: newName,
    codes: [...p.codes],
  });
  saveCustomPalettes(palettes);
  refreshCustom();
  menuOpenId.value = null;
}

// ---------- 删除 ----------
function deletePalette(p) {
  if (!confirm(`确认删除色号套装「${p.name}」？`)) return;
  const palettes = loadCustomPalettes();
  const filtered = palettes.filter(item => item.id !== p.id);
  saveCustomPalettes(filtered);
  refreshCustom();
  menuOpenId.value = null;
}

// ---------- 取消 ----------
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

.color-manager {
  background: #fefaf5;
  border-radius: 12px;
  width: 85vw;
  max-width: 440px;
  max-height: 85vh;
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
  padding: 0.8rem 1.2rem;
}

.palette-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 0.8rem;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
  position: relative;
}

.palette-item:hover {
  background: #f5f0eb;
}

.palette-item.active {
  background: #ede4db;
  outline: 1px solid #cdb4a0;
}

.palette-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.palette-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #333;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.edit-icon {
  font-size: 0.75rem;
  color: #999;
  cursor: pointer;
  padding: 0 0.1rem;
  border-radius: 3px;
  transition: background 0.15s;
}

.edit-icon:hover {
  background: #e5dfd8;
  color: #555;
}

.inline-input {
  font: inherit;
  font-size: 0.9rem;
  padding: 0.1rem 0.3rem;
  border: 1px solid #cdb4a0;
  border-radius: 4px;
  outline: none;
  width: 120px;
  background: #fff;
}

.palette-count {
  font-size: 0.75rem;
  color: #999;
}

.palette-badge {
  font-size: 0.7rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  color: #fff;
  flex-shrink: 0;
}

.palette-badge.builtin {
  background: #bca28c;
}

.palette-menu-btn {
  font-size: 1.2rem;
  color: #999;
  cursor: pointer;
  padding: 0 0.3rem;
  border-radius: 4px;
  line-height: 1;
  flex-shrink: 0;
}

.palette-menu-btn:hover {
  color: #333;
  background: #e5dfd8;
}

.palette-submenu {
  position: absolute;
  right: 0.5rem;
  top: 100%;
  z-index: 10;
  background: #fff;
  border: 1px solid #e0d6cc;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  overflow: hidden;
  min-width: 100px;
}

.palette-submenu button {
  display: block;
  width: 100%;
  border: none;
  background: none;
  padding: 0.4rem 1rem;
  font-size: 0.8rem;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.palette-submenu button:hover {
  background: #f5f0eb;
}

.palette-submenu button.danger {
  color: #e74c3c;
}

.palette-submenu button.danger:hover {
  background: #fde8e8;
}

.add-item {
  justify-content: center;
  color: #999;
  border: 1px dashed #ddd;
  margin-top: 0.3rem;
}

.add-item:hover {
  color: #555;
  border-color: #bbb;
}

.add-icon {
  font-size: 1.2rem;
  font-weight: bold;
}
</style>