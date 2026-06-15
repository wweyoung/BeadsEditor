<template>
  <div class="container">
    <div class="top-bar">
      <div class="top-bar-row">
        <div class="left-group">
          <h1>KX拼豆图</h1>
          <div class="color-mode-select">
            <button class="color-mode-option" :class="{ active: colorMode === 'original' }"
                    title="原图"
                    @click="setColorMode('original')">
              <i class="iconfont icon-image"></i>
            </button>
            <button class="color-mode-option" :class="{ active: colorMode === 'edit' }"
                    title="图纸"
                    @click="setColorMode('edit')">
              <i class="iconfont icon-drafting-compass"></i>
            </button>
            <button class="color-mode-option" :class="{ active: colorMode === 'guide' }"
                    title="向导"
                    @click="setColorMode('guide')">
              <i class="iconfont icon-puzzle-piece"></i>
            </button>
          </div>
          <button class="text-btn palette-select-btn"
                  title="管理色号套装"
                  @click="colorManagerVisible = true"
          ><i class="iconfont icon-hashtag"></i><span class="palette-label">{{ currentPalette.length }}</span>
          </button>
          <ColorManager
              v-if="colorManagerVisible"
              :activeMode="paletteMode"
              @cancel="colorManagerVisible = false"
              @select="onColorManagerSelect"
          />
        </div>

        <div class="right-group">
          <button class="text-btn" title="导入" @click="onImportClick"><i class="iconfont icon-file-import"></i></button>
          <ImageImporter ref="imageImporterRef" @image-loaded="onImageLoaded"/>
          <button class="text-btn" title="导出" @click="exportModalVisible = true"><i
              class="iconfont icon-file-export"></i></button>
          <ExportModal
              :visible="exportModalVisible"
              :default-name="originalFileName"
              :displayCanvas="paletteCanvas"
              :colorCodes="colorCodes"
              :currentPalette="currentPalette"
              :bgColor="bgColor"
              :gridColor="gridColor"
              @cancel="exportModalVisible = false"
          />
          <RowColModal
              :visible="rowColModalData.visible"
              :type="rowColModalData.type"
              :index="rowColModalData.index"
              @confirm="onRowColConfirm"
              @cancel="rowColModalData.visible = false"
          />
          <PaletteModal
              v-if="paletteModalVisible"
              :currentPalette="currentPalette"
              :selectedCode="selectedCode"
              @update:selectedCode="selectColor($event)"
              @cancel="paletteModalVisible = false"
          />
          <PaletteModal
              v-if="outlinePaletteVisible"
              :currentPalette="currentPalette"
              :selectedCode="outlineColor"
              title="选择描边色号"
              @update:selectedCode="onOutlineColorSelected($event)"
              @cancel="outlinePaletteVisible = false"
          />
          <PaletteModal
              v-if="replacePaletteVisible"
              :currentPalette="currentPalette"
              :selectedCode="replaceTarget"
              :title="`替换${replaceTarget}色号`"
              showSimilar
              @update:selectedCode="onReplaceColorSelected($event)"
              @cancel="closeReplacePalette"
          />
        </div>
      </div>

      <div class="top-bar-row">
        <div class="left-group">
          <CoordDisplay
              :selected-cell="selectedCell"
              :hovered-code="selectedCell && colorMode !== 'original' ? colorCodes[selectedCell.row][selectedCell.col]: '-'"
              :canvas-size-text="canvasSizeText"
              @click="resetView"
          />
        </div>
      </div>
    </div>

    <div
        class="canvas-wrapper"
        ref="wrapperRef"
        :class="{ grabbing: isGrabbing }"
    >
      <canvas
          ref="canvasRef"
          @wheel.prevent="handleWheel"
          @touchstart="onTouchStart"
          @touchmove="onTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchCancel"
          @mousedown="onTouchStart"
          @mousemove="onTouchMove"
          @mouseup="onTouchEnd"
          @mouseleave="onTouchCancel"
          v-longpress="onTouchLong"
          @contextmenu="(event)=>event.preventDefault()"
      ></canvas>
    </div>

    <div class="stats-bar-wrapper">
      <div class="stats-bar" ref="statsBarRef" :class="{ expanded: statsExpanded }" @wheel="onStatsBarWheel">
        <div class="stats-tag-wrap overview-tag" @click="selectedCell=null;selectColor(null);highlightColor(null);"
             v-if="colorMode !== 'original'">
          <div class="overview-inner">
            <span class="overview-count">{{ uniqueColors }}色</span>
            <span class="overview-total">{{ totalBeads }}</span>
          </div>
        </div>
        <span
            v-for="item in sortedStats"
            :key="item.code"
            class="stats-tag-wrap"
            v-longpress="() => onPaletteSwatchLongPress(item.code)"
        >
          <PaletteSwatch
              :code="item.code"
              :description="item.description"
              :selected="colorMode==='guide' ? (guideCodes.has(item.code)) : (selectedCode === item.code)"
              :highlighted="highlightCode === item.code"
              :data-code="item.code"
              :lack="!currentPaletteCodes?.includes(item.code)"
              @click="openColorMenu(item.code, $event)"
          />
        </span>
      </div>
      <button
          v-if="sortedStats.length > 8"
          class="stats-expand-btn"
          @click="statsExpanded = !statsExpanded"
      >
        <i v-if="statsExpanded" class="iconfont icon-chevron-down"></i>
        <i v-else class="iconfont icon-chevron-up"></i>
      </button>
    </div>

    <ColorContextMenu
        :color-mode="colorMode"
        :color-code="menuColorCode"
        :x="menuX"
        :y="menuY"
        :color-style="menuColorStyle"
        :selected-code="selectedCode"
        :highlight-code="highlightCode"
        :guide-codes="guideCodes"
        @select="(code) => { selectColor(code); menuColorCode = null; }"
        @highlight="(code) => { highlightColor(code); menuColorCode = null; }"
        @guide-show="(code) => { guideShowColor(code); menuColorCode = null; }"
        @replace="openReplacePalette"
        @merge="(code) => { mergeColor(code); menuColorCode = null; }"
        @delete="(code) => { deleteColor(code); menuColorCode = null; }"
    />

    <BottomToolbar
        :color-mode="colorMode"
        :operation-mode="operationMode"
        :selected-code="selectedCode"
        :show-grid="showGrid"
        :show-color-code="showColorCode"
        :settings-open="settingsOpen"
        :bg-color="bgColor"
        :grid-color="gridColor"
        :color-sort="colorSort"
        :undoDisabled="undoDisabled"
        :redoDisabled="redoDisabled"
        @toggle-mode="toggleOperationMode"
        @undo="undo"
        @redo="redo"
        @toggle-grid="toggleGrid"
        @toggle-color-code="toggleColorCode"
        @mirror="toggleMirror"
        @settings-toggle="onSettingsToggle"
        @open-palette="paletteModalVisible = true"
        @update:bg-color="bgColor = $event"
        @update:grid-color="gridColor = $event"
        @update:color-sort="colorSort = $event"
        @pixel-change="pixelChange"
        @auto-cropper="autoCropper"
        @outline-click="outlinePaletteVisible = true"
        @fix-gap="fixGap"
    />
  </div>
</template>

<script setup>
import {computed, getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {
  rgb2lab,
  getPalette,
  colorDistance,
  getColorCacheKey,
  PALETTE_MAP, isHighlightColor, getSimilarColor, PALETTE_211
} from './palette.js';
import ImageImporter from './ImageImporter.vue';
import ExportModal from './ExportModal.vue';
import RowColModal from './RowColModal.vue';
import PaletteModal from './PaletteModal.vue';
import PaletteSwatch from './PaletteSwatch.vue';
import ColorManager from './ColorManager.vue';
import CoordDisplay from './CoordDisplay.vue';
import ColorContextMenu from './ColorContextMenu.vue';
import BottomToolbar from './BottomToolbar.vue';
import {BeadsHistory} from "./util/beadsHistory";
import {buildDefaultPixelArt, pixel2ImageData, rowColChange} from "./util/pixelUtil";
import {debounce} from "lodash";

const {proxy} = getCurrentInstance();

// =============================================
// 常量
// =============================================
const GRID_BASE_MAJOR = 10;
const GRID_BASE_MINOR = 5;
const SETTINGS_KEY = 'pixelArtSettings';
const DRAG_THRESHOLD = 5;
const CLICK_TIME_THRESHOLD = 300;

const colorCodeMapCache = new Map();

// =============================================
// 模板引用 (Template Refs)
// =============================================
const canvasRef = ref(null);
const wrapperRef = ref(null);
const statsBarRef = ref(null);
const imageImporterRef = ref(null);

// =============================================
// 画布状态 (Canvas State)
// =============================================
let originalCanvas = ref(null);
const paletteCanvas = ref(document.createElement('canvas'));
let ctx = null;
let CANVAS_DPR = 2;

const colorCodes = ref([]);
const history = new BeadsHistory();
let _historyGuard = false;
const undoDisabled = ref(true);
const redoDisabled = ref(true);

// =============================================
// 视图状态 (View State)
// =============================================
const scale = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);
const showGrid = ref(true);
const showColorCode = ref(true);
const statsExpanded = ref(false);

// =============================================
// UI 状态 (UI State)
// =============================================
const colorMode = ref('original');
const paletteMode = ref(localStorage.getItem('paletteMode') || '211');
const operationMode = ref(null);
const colorSort = ref('count');
const settingsOpen = ref(false);

const gridColor = ref('#ff0000');
const bgColor = ref('#fefaf5');

const selectedCell = ref();
const selectedCode = ref(null);
const highlightCode = ref(null);
const outlineColor = ref(null); // 描边颜色
const guideCodes = ref(new Set()); // 向导颜色集合
const replaceTarget = ref(null);

// Modal visibility
const exportModalVisible = ref(false);
const paletteModalVisible = ref(false);
const outlinePaletteVisible = ref(false);
const replacePaletteVisible = ref(false);
const colorManagerVisible = ref(false);

// Row/Col modal
const rowColModalData = ref({
  visible: false,
  type: 'column',
  index: 0,
});

// Context menu
const menuColorCode = ref(null);
const menuX = ref(0);
const menuY = ref(0);

// Coordinate / info display
const hoveredCode = ref('');
const canvasSizeText = ref('— × —');
const totalBeads = ref(0);
const uniqueColors = ref(0);
const originalFileName = ref('pixel-art');

// =============================================
// 拖拽/触摸状态 (Drag & Touch State)
// =============================================
const isDragging = ref(false);
const isGrabbing = ref(false);
let dragStartOffsetX = 0, dragStartOffsetY = 0;
let touchDist = 0, touchStartScale = 1;
let touchStartOffsetX = 0, touchStartOffsetY = 0;
let touchMidX = 0, touchMidY = 0;
let clickStartX = 0, clickStartY = 0, clickStartTime = 0;

// =============================================
// 计算属性 (Computed)
// =============================================
const currentPalette = computed(() => getPalette(paletteMode.value));

const currentPaletteCodes = computed(() =>
    currentPalette.value?.map(palette => palette.code) ?? []
);

const displayCanvas = computed(() =>
    colorMode.value === 'original' ? originalCanvas.value : paletteCanvas.value
);

const sortedStats = ref([]);

const menuColorStyle = computed(() => {
  const c = PALETTE_MAP[menuColorCode.value];
  if (!c) return {};
  return {backgroundColor: c.hex};
});

// =============================================
// Canvas 绘制函数 (Drawing)
// =============================================
function initCanvas() {
  const canvas = canvasRef.value;
  const wrapper = wrapperRef.value;
  if (!canvas || !wrapper) return;
  canvas.width = wrapper.clientWidth * CANVAS_DPR;
  canvas.height = wrapper.clientHeight * CANVAS_DPR;
  canvas.style.width = wrapper.clientWidth + 'px';
  canvas.style.height = wrapper.clientHeight + 'px';
}

function redrawCanvas() {
  if (!ctx) return;
  const canvas = canvasRef.value;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(CANVAS_DPR, CANVAS_DPR);
  ctx.translate(offsetX.value, offsetY.value);
  ctx.scale(scale.value, scale.value);
  ctx.imageSmoothingEnabled = false;

  const invScale = 1 / scale.value;
  const visibleX = Math.max(0, Math.floor(-offsetX.value * invScale));
  const visibleY = Math.max(0, Math.floor(-offsetY.value * invScale));
  const visibleW = Math.min(displayCanvas.value.width - visibleX, Math.ceil(canvas.width * invScale) + 1);
  const visibleH = Math.min(displayCanvas.value.height - visibleY, Math.ceil(canvas.height * invScale) + 1);

  drawCellBackground(visibleX, visibleY, visibleW, visibleH);

  ctx.drawImage(displayCanvas.value,
      visibleX, visibleY, visibleW, visibleH,
      visibleX, visibleY, visibleW, visibleH
  );

  if (showColorCode.value && colorMode.value !== 'original') {
    drawColorCodes(visibleX, visibleY, visibleW, visibleH);
  }
  if (colorMode.value === 'guide') {
    drawGuideMask(visibleX, visibleY, visibleW, visibleH);
  }
  if (highlightCode.value && colorMode.value !== 'original') {
    drawHighlightMask(visibleX, visibleY, visibleW, visibleH);
  }
  if (showGrid.value) drawGrid(visibleX, visibleY, visibleW, visibleH);
  drawSelectedCell();

  ctx.restore();
  updateStatsBar();
}

function drawCellBackground(vx, vy, vw, vh) {
  if (!colorCodes.value.length) return;
  const endX = vx + vw;
  const endY = vy + vh;
  if (bgColor.value) {
    ctx.fillStyle = bgColor.value;
    for (let y = vy; y < endY; y++) {
      for (let x = vx; x < endX; x++) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  } else { // 棋盘格
    for (let y = vy; y < endY; y++) {
      for (let x = vx; x < endX; x++) {
        if ((x + y) % 2 !== 0) continue;
        ctx.fillStyle = '#DDDDDD';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function drawGrid(vx, vy, vw, vh) {
  if (displayCanvas.value.width === 0 || displayCanvas.value.height === 0) return;
  const ps = 1;
  const endX = vx + vw;
  const endY = vy + vh;

  ctx.strokeStyle = 'rgba(180,170,160,0.15)';
  ctx.lineWidth = Math.max(0.1, 0.05 / scale.value);
  ctx.setLineDash([]);
  const xStart1 = Math.floor(vx / ps) * ps;
  for (let x = xStart1; x <= endX; x += ps) {
    ctx.beginPath();
    ctx.moveTo(x, vy);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  const yStart1 = Math.floor(vy / ps) * ps;
  for (let y = yStart1; y <= endY; y += ps) {
    ctx.beginPath();
    ctx.moveTo(vx, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  ctx.save();
  ctx.strokeStyle = gridColor.value;
  ctx.lineWidth = Math.max(0.08, 0.08 / scale.value);
  ctx.setLineDash([Math.max(0.3, 0.3 / scale.value), Math.max(0.3, 0.3 / scale.value)]);
  const xStart2 = Math.floor(vx / (GRID_BASE_MAJOR * ps)) * GRID_BASE_MAJOR * ps + GRID_BASE_MINOR * ps;
  for (let x = xStart2; x < endX; x += GRID_BASE_MAJOR * ps) {
    ctx.beginPath();
    ctx.moveTo(x, vy);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  const yStart2 = Math.floor(vy / (GRID_BASE_MAJOR * ps)) * GRID_BASE_MAJOR * ps + GRID_BASE_MINOR * ps;
  for (let y = yStart2; y < endY; y += GRID_BASE_MAJOR * ps) {
    ctx.beginPath();
    ctx.moveTo(vx, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
  ctx.restore();

  ctx.strokeStyle = gridColor.value;
  ctx.lineWidth = Math.max(0.05, 0.05 / scale.value);
  ctx.setLineDash([]);
  const xStart3 = Math.floor(vx / (GRID_BASE_MAJOR * ps)) * GRID_BASE_MAJOR * ps;
  for (let x = xStart3; x <= endX; x += GRID_BASE_MAJOR * ps) {
    ctx.beginPath();
    ctx.moveTo(x, vy);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  const yStart3 = Math.floor(vy / (GRID_BASE_MAJOR * ps)) * GRID_BASE_MAJOR * ps;
  for (let y = yStart3; y <= endY; y += GRID_BASE_MAJOR * ps) {
    ctx.beginPath();
    ctx.moveTo(vx, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
  const coordFontSize = 0.5;
  ctx.font = `${coordFontSize}px Consolas, monospace`;

  const coordLineWidth = Math.max(0.1, 0.05 / scale.value);
  const coordStrokeStyle = 'rgba(180,170,160,0.15)';

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let x = 0; x < displayCanvas.value.width; x += ps) {
    if (x >= vx && x <= endX) {
      ctx.fillStyle = 'rgba(170,170,170,0.5)';
      ctx.fillRect(x, -ps, ps, ps);
      ctx.strokeStyle = coordStrokeStyle;
      ctx.lineWidth = coordLineWidth;
      ctx.strokeRect(x, -ps, ps, ps);
      const text = `${x + 1}`;
      const cx = x + ps / 2;
      const cy = -ps / 2;
      ctx.fillStyle = '#000';
      ctx.fillText(text, cx, cy);
    }
  }
  for (let x = 0; x < displayCanvas.value.width; x += ps) {
    if (x >= vx && x <= endX) {
      ctx.fillStyle = 'rgba(170,170,170,0.5)';
      ctx.fillRect(x, displayCanvas.value.height, ps, ps);
      ctx.strokeStyle = coordStrokeStyle;
      ctx.lineWidth = coordLineWidth;
      ctx.strokeRect(x, displayCanvas.value.height, ps, ps);
      const text = `${x + 1}`;
      const cx = x + ps / 2;
      const cy = displayCanvas.value.height + ps / 2;
      ctx.fillStyle = '#000';
      ctx.fillText(text, cx, cy);
    }
  }
  ctx.textAlign = 'center';
  for (let y = 0; y < displayCanvas.value.height; y += ps) {
    if (y >= vy && y <= endY) {
      ctx.fillStyle = 'rgba(170,170,170,0.5)';
      ctx.fillRect(-ps, y, ps, ps);
      ctx.strokeStyle = coordStrokeStyle;
      ctx.lineWidth = coordLineWidth;
      ctx.strokeRect(-ps, y, ps, ps);
      const text = `${y + 1}`;
      const cx = -ps / 2;
      const cy = y + ps / 2;
      ctx.fillStyle = '#000';
      ctx.fillText(text, cx, cy);
    }
  }
  for (let y = 0; y < displayCanvas.value.height; y += ps) {
    if (y >= vy && y <= endY) {
      ctx.fillStyle = 'rgba(170,170,170,0.5)';
      ctx.fillRect(displayCanvas.value.width, y, ps, ps);
      ctx.strokeStyle = coordStrokeStyle;
      ctx.lineWidth = coordLineWidth;
      ctx.strokeRect(displayCanvas.value.width, y, ps, ps);
      const text = `${y + 1}`;
      const cx = displayCanvas.value.width + ps / 2;
      const cy = y + ps / 2;
      ctx.fillStyle = '#000';
      ctx.fillText(text, cx, cy);
    }
  }
}

function drawColorCodes(vx, vy, vw, vh) {
  if (scale.value < 8 || !colorCodes.value?.length) return;
  const fontSize = 0.5;
  ctx.save();
  ctx.font = `${fontSize}px Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const palette = currentPalette.value;
  if (!palette) {
    ctx.restore();
    return;
  }

  const endX = vx + vw;
  const endY = vy + vh;

  for (let y = vy; y < endY; y++) {
    for (let x = vx; x < endX; x++) {
      const code = colorCodes.value[y][x];
      if (!code) continue;
      const ci = palette.find((c) => c.code === code);
      ctx.fillStyle = '#000';
      if (ci) {
        ctx.fillStyle = isHighlightColor(ci) > 128 ? '#000' : '#fff';
      }
      ctx.fillText(code, x + 0.5, y + 0.5);
    }
  }
  ctx.restore();
}

function drawHighlightMask(vx, vy, vw, vh) {
  if (!colorCodes.value.length) return;
  const target = highlightCode.value;
  if (!target) return;

  ctx.save();
  ctx.setTransform(CANVAS_DPR, 0, 0, CANVAS_DPR, 0, 0);
  ctx.translate(offsetX.value, offsetY.value);
  ctx.scale(scale.value, scale.value);

  const endX = vx + vw;
  const endY = vy + vh;

  for (let y = vy; y < endY; y++) {
    for (let x = vx; x < endX; x++) {
      const code = colorCodes.value[y][x];
      if (code === target) continue;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(x, y, 1, 1);
    }
  }

  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 1.5 / scale.value;
  ctx.setLineDash([]);

  for (let y = vy; y < endY; y++) {
    for (let x = vx; x < endX; x++) {
      if (colorCodes.value[y][x] !== target) continue;
      const top = y > 0 && colorCodes.value[y - 1][x] === target;
      const bottom = y < displayCanvas.value.height - 1 && colorCodes.value[y + 1][x] === target;
      const left = x > 0 && colorCodes.value[y][x - 1] === target;
      const right = x < displayCanvas.value.width - 1 && colorCodes.value[y][x + 1] === target;

      if (!top) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 1, y);
        ctx.stroke();
      }
      if (!bottom) {
        ctx.beginPath();
        ctx.moveTo(x, y + 1);
        ctx.lineTo(x + 1, y + 1);
        ctx.stroke();
      }
      if (!left) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + 1);
        ctx.stroke();
      }
      if (!right) {
        ctx.beginPath();
        ctx.moveTo(x + 1, y);
        ctx.lineTo(x + 1, y + 1);
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}

function drawGuideMask(vx, vy, vw, vh) {
  const endX = vx + vw;
  const endY = vy + vh;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
  for (let y = vy; y < endY; y++) {
    for (let x = vx; x < endX; x++) {
      const code = colorCodes.value[y][x];
      if (guideCodes.value.has(code)) continue;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function drawSelectedCell() {
  const cell = selectedCell.value;
  if (!cell) return;
  const {col, row} = cell;
  if (!colorCodes.value[row]?.[col]) return;

  ctx.save();
  ctx.strokeStyle = '#00BFFF';
  ctx.lineWidth = 2 / scale.value;
  ctx.setLineDash([]);
  ctx.strokeRect(col + 0.05, row + 0.05, 0.9, 0.9);
  ctx.restore();
}

// =============================================
// 图片处理 & 调色板 (Image Processing & Palette)
// =============================================
function findClosestColor(r, g, b, a, palette) {
  const key = getColorCacheKey(r, g, b, a);
  const cached = colorCodeMapCache.get(key);
  if (cached) return cached;
  let minDist = Infinity;
  let closest = palette[0];
  const [L, A, B] = rgb2lab(r, g, b, a, key);
  for (const c of palette) {
    if (c.a === 0) continue;
    const d = colorDistance(L, A, B, a, c.L, c.A, c.B, c.a);
    if (d < minDist) {
      minDist = d;
      closest = c;
    }
  }
  colorCodeMapCache.set(key, closest);
  return closest;
}

function processImageWithPalette() {
  if (!originalCanvas.value) return;
  if (originalCanvas.value.width * originalCanvas.value.height > 1000 * 1000) {
    CANVAS_DPR = 1;
  }

  const oid = originalCanvas.value.getContext('2d', {willReadFrequently: true})
      .getImageData(0, 0, originalCanvas.value.width, originalCanvas.value.height).data;
  const palette = currentPalette.value;
  let i = 0;
  colorCodes.value = [];
  for (let row = 0; row < originalCanvas.value.height; row++) {
    for (let col = 0; col < originalCanvas.value.width; col++, i += 4) {
      const r = oid[i], g = oid[i + 1], b = oid[i + 2], a = oid[i + 3];
      if (!colorCodes.value[row]) colorCodes.value[row] = [];
      if (a === 0) {
        colorCodes.value[row][col] = null;
      } else {
        const closest = findClosestColor(r, g, b, a, palette);
        colorCodes.value[row][col] = closest.code;
      }
    }
  }

  paletteCanvas.value.width = displayCanvas.value.width;
  paletteCanvas.value.height = displayCanvas.value.height;
}

// =============================================
// 视图控制 (View Controls)
// =============================================
function resetView() {
  initCanvas();
  const wrapper = wrapperRef.value;
  const ww = wrapper.clientWidth, wh = wrapper.clientHeight;
  const sx = (ww * 0.9) / displayCanvas.value.width;
  const sy = (wh * 0.9) / displayCanvas.value.height;
  let s = Math.min(sx, sy, 50);
  s = Math.max(0.1, s);
  scale.value = s;
  offsetX.value = (ww - displayCanvas.value.width * s) / 2;
  offsetY.value = (wh - displayCanvas.value.height * s) / 2;
  redrawCanvas();
}

function handleWheel(e) {
  e.preventDefault();
  const canvas = canvasRef.value;
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const os = scale.value;
  const ns = e.deltaY < 0 ? Math.min(50, scale.value * 1.1) : Math.max(0.1, scale.value / 1.1);
  scale.value = ns;
  offsetX.value = mx - (mx - offsetX.value) * (ns / os);
  offsetY.value = my - (my - offsetY.value) * (ns / os);
  redrawCanvas();
}

function handleResize() {
  const canvas = canvasRef.value;
  const ocx = (canvas.width / CANVAS_DPR) / 2, ocy = (canvas.height / CANVAS_DPR) / 2;
  initCanvas();
  offsetX.value += (canvas.width / CANVAS_DPR) / 2 - ocx;
  offsetY.value += (canvas.height / CANVAS_DPR) / 2 - ocy;
  redrawCanvas();
}

// =============================================
// 颜色模式 & 选择 (Color Mode & Selection)
// =============================================
function setColorMode(mode) {
  highlightCode.value = null;
  colorMode.value = mode;
  redrawCanvas();
}

function setPaletteMode(mode) {
  paletteMode.value = mode;
  localStorage.setItem('paletteMode', mode);
}

function onColorManagerSelect(mode) {
  setPaletteMode(mode);
  colorCodeMapCache.clear();
  processImageWithPalette();
}

function onPaletteSwatchLongPress(code) {
  if (colorMode.value === 'guide') {
    guideShowColor(code)
  } else {
    selectColor(code)
  }
}

function selectColor(colorCode) {
  if (selectedCode.value === colorCode) {
    selectedCode.value = null;
    operationMode.value = null;
  } else {
    selectedCode.value = colorCode;
    proxy.$toast.show(colorCode);
    if (!operationMode.value) {
      operationMode.value = 'brush';
    } else if (operationMode.value === 'eraser' || operationMode.value === 'areaEraser' || operationMode.value === 'eraser_continue') {
      operationMode.value = 'brush';
    }
    nextTick(() => {
      scrollToColor(colorCode)
    });
  }
}

function highlightColor(code) {
  if (highlightCode.value === code) {
    highlightCode.value = null;
  } else {
    highlightCode.value = code;
  }
  redrawCanvas();
}

function guideShowColor(code) {
  if (guideCodes.value.has(code)) {
    guideCodes.value.delete(code)
  } else {
    guideCodes.value.add(code);
  }
  redrawCanvas();
}

function scrollToColor(colorCode) {
  if (!statsBarRef.value || !colorCode) return;
  const el = statsBarRef.value.querySelector(`[data-code="${colorCode}"]`);
  if (el) {
    const container = statsBarRef.value;
    const scrollLeft = el.offsetLeft + el.offsetWidth / 2 - container.offsetWidth / 2;
    container.scrollTo({left: scrollLeft, behavior: 'smooth'});
  }
}

// =============================================
// 色号操作菜单 (Color Context Menu)
// =============================================
function onStatsBarWheel(e) {
  if (!statsExpanded.value) {
    e.preventDefault()
    statsBarRef.value.scrollLeft += e.deltaY;
  }
}

function openColorMenu(code, event) {
  if (colorMode.value === 'original') {
    // 原图模式点击色号直接选中色号
    selectColor(code)
    return;
  } else if (colorMode.value === 'guide' && !guideCodes.value.has(code)) {
    guideShowColor(code);
    return
  }

  if (menuColorCode.value === code) {
    menuColorCode.value = null;
    return;
  }
  menuColorCode.value = code;
  nextTick(() => {
    const rect = event.target.closest('.palette-swatch')?.getBoundingClientRect();
    const el = document.querySelector('.color-context-menu');
    if (rect) {
      menuX.value = (rect.left + rect.right - el.clientWidth) / 2;
      menuY.value = rect.top - el.clientHeight - 10;
    } else {
      menuX.value = event.clientX;
      menuY.value = event.clientY;
    }
  });
}

function onWindowClick(e) {
  if (menuColorCode.value) {
    const el = document.querySelector('.color-context-menu');
    if (el && !el.contains(e.target)) {
      const swatch = e.target.closest('.palette-swatch');
      if (!swatch) {
        menuColorCode.value = null;
      }
    }
  }
  if (settingsOpen.value) {
    const el = document.querySelector('.settings-panel');
    if (el && !el.contains(e.target)) {
      settingsOpen.value = false;
    }
  }
}

function closeReplacePalette() {
  replacePaletteVisible.value = false;
  replaceTarget.value = null;
}

function openReplacePalette(code) {
  replaceTarget.value = code;
  replacePaletteVisible.value = true;
  menuColorCode.value = null;
}

function onReplaceColorSelected(newCode) {
  if (!replaceTarget.value || !newCode) return;
  const oldCode = replaceTarget.value;
  if (oldCode === newCode) {
    closeReplacePalette();
    return;
  }
  if (!colorCodes.value.length) return;
  for (let row = 0; row < colorCodes.value.length; row++) {
    for (let col = 0; col < colorCodes.value[row].length; col++) {
      if (colorCodes.value[row][col] === oldCode) {
        colorCodes.value[row][col] = newCode;
      }
    }
  }
  if (selectedCode.value === oldCode) selectedCode.value = newCode;
  if (highlightCode.value === oldCode) highlightCode.value = null;
  replaceTarget.value = null;
  replacePaletteVisible.value = false;
  updateStatsBar();
}

function deleteColor(code) {
  if (!colorCodes.value.length) return;
  for (let row = 0; row < colorCodes.value.length; row++) {
    for (let col = 0; col < colorCodes.value[row].length; col++) {
      if (colorCodes.value[row][col] === code) {
        colorCodes.value[row][col] = null;
      }
    }
  }
  if (selectedCode.value === code) {
    selectedCode.value = null;
    operationMode.value = null;
  }
  if (highlightCode.value === code) highlightCode.value = null;
  updateStatsBar();
}

function mergeColor(code) {
  const candidates = sortedStats.value.filter(c => c.code !== code)
  if (candidates.length === 0) return;
  const color = PALETTE_MAP[code]
  const [similarColor] = getSimilarColor(color.L, color.A, color.B, color.a, candidates, 1)
  // 替换所有 source → best
  for (let row = 0; row < colorCodes.value.length; row++) {
    for (let col = 0; col < colorCodes.value[row].length; col++) {
      if (colorCodes.value[row][col] === code) {
        colorCodes.value[row][col] = similarColor.code;
      }
    }
  }
  proxy.$toast.show(`${code} => ${similarColor.code}`)
  if (selectedCode.value === code) selectedCode.value = similarColor.code;
  if (highlightCode.value === code) highlightCode.value = similarColor.code;
}

// =============================================
// 操作模式 (Operation Modes)
// =============================================
function toggleOperationMode(mode) {
  if (operationMode.value === mode) {
    operationMode.value = null;
  } else {
    operationMode.value = mode;
    const modeNames = {
      brush: '毛笔',
      brush_continue: '毛笔-连续',
      fill: '填充',
      eraser: '橡皮',
      eraser_continue: '橡皮-连续',
      areaEraser: '区域擦除',
    };
    const name = modeNames[mode] || mode;
    proxy.$toast.show(name);
  }
}

function toggleGrid() {
  showGrid.value = !showGrid.value;
  redrawCanvas();
  saveSettings({bgColor: bgColor.value, gridColor: gridColor.value, showGrid: showGrid.value});
}

async function toggleColorCode(show) {
  showColorCode.value = typeof show === 'boolean' ? show : !showColorCode.value;
  saveSettings({bgColor: bgColor.value, gridColor: gridColor.value, showGrid: showGrid.value});
  redrawCanvas();
}

function toggleMirror() {
  colorCodes.value = colorCodes.value.map(row => [...row].reverse());
}

function onTouchStart(e) {
  e.preventDefault();
  clickStartX = e.clientX ?? e.touches[0].clientX;
  clickStartY = e.clientY ?? e.touches[0].clientY;
  clickStartTime = Date.now();
  if (!e.touches || e.touches.length === 1) {
    isDragging.value = true;
    isGrabbing.value = true;
    dragStartOffsetX = offsetX.value;
    dragStartOffsetY = offsetY.value;
  } else if (e.touches.length === 2) {
    isDragging.value = false;
    const dx = clickStartX - e.touches[1].clientX;
    const dy = clickStartY - e.touches[1].clientY;
    touchDist = Math.hypot(dx, dy);
    touchStartScale = scale.value;
    touchStartOffsetX = offsetX.value;
    touchStartOffsetY = offsetY.value;
    const canvas = canvasRef.value;
    const rect = canvas.getBoundingClientRect();
    touchMidX = (clickStartX + e.touches[1].clientX) / 2 - rect.left;
    touchMidY = (clickStartY + e.touches[1].clientY) / 2 - rect.top;
  }
}

function onTouchMove(e) {
  e.preventDefault();
  const [row, col, clientX, clientY, isOnCanvas] = eventToRowCol(e)
  if ((!e.touches || e.touches.length === 1) && isDragging.value) {
    const isEdit = colorMode.value === 'edit'
    if (operationMode.value === 'eraser_continue' && isOnCanvas && isEdit) {
      setCellColor(col, row);
    } else if (operationMode.value === 'brush_continue' && isOnCanvas && selectedCode.value && isEdit) {
      setCellColor(col, row, selectedCode.value);
    } else {
      offsetX.value = dragStartOffsetX + (clientX - clickStartX);
      offsetY.value = dragStartOffsetY + (clientY - clickStartY);
    }
    redrawCanvas();
  } else if (e.touches?.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const d = Math.hypot(dx, dy);
    const ns = Math.max(0.1, Math.min(50, touchStartScale * (d / touchDist)));
    const canvas = canvasRef.value;
    const rect = canvas.getBoundingClientRect();
    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
    offsetX.value = midX - (touchMidX - touchStartOffsetX) * (ns / touchStartScale);
    offsetY.value = midY - (touchMidY - touchStartOffsetY) * (ns / touchStartScale);
    scale.value = ns;
    redrawCanvas();
  }
}

function onTouchLong(e) {
  const [row, col, cx, cy, isOnCanvas] = eventToRowCol(e)
  if (!isOnCanvas) return;
  const code = colorCodes.value[row][col];
  if (colorMode.value === 'edit') {
    selectColor(code);
  } else if (colorMode.value === 'guide') {
    guideShowColor(code)
  }
}

function onTouchEnd(e) {
  const [row, col, clientX, clientY] = eventToRowCol(e)
  if (clientX) {
    const moveDistance = Math.sqrt(Math.pow(clientX - clickStartX, 2) + Math.pow(clientY - clickStartY, 2));
    const duration = Date.now() - clickStartTime;
    if (moveDistance <= DRAG_THRESHOLD && duration <= CLICK_TIME_THRESHOLD) {
      onCanvasClick(col, row);
    }
  }
  isDragging.value = false;
  isGrabbing.value = false;
  onWindowClick(e)
}

function onTouchCancel() {
  isDragging.value = false;
  isGrabbing.value = false;
}

function onCanvasClick(col, row) {
  const isEdit = colorMode.value === 'edit';
  const width = displayCanvas.value.width;
  const height = displayCanvas.value.height;
  if (col >= 0 && col < width && row >= 0 && row < height) {
    selectedCell.value = {col, row}
    if (isEdit) {
      if (operationMode.value === 'eraser') {
        setCellColor(col, row);
      } else if (operationMode.value === 'areaEraser') {
        setCellAreaColor(col, row);
      } else if (operationMode.value === 'brush' && selectedCode.value) {
        setCellColor(col, row, selectedCode.value);
      } else if (operationMode.value === 'fill' && selectedCode.value) {
        setCellAreaColor(col, row, selectedCode.value);
      }
    }
    selectedCode.value = colorCodes.value[row][col]
    scrollToColor(selectedCode.value)
    redrawCanvas();
    return;
  }
  if (!isEdit) return;
  if ((row >= -1 && row < 0 && col >= 0 && col < width) || (row >= height && row < height + 1 && col >= 0 && col < width)) {
    rowColModalData.value = {type: 'column', index: Math.max(0, Math.min(col, width - 1)), visible: true};
  } else if ((col >= -1 && col < 0 && row >= 0 && row < height) || (col >= width && col < width + 1 && row >= 0 && row < height)) {
    rowColModalData.value = {type: 'row', index: Math.max(0, Math.min(row, height - 1)), visible: true};
  }
}

function eventToRowCol(e) {
  const clientX = e.clientX ?? e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX;
  const clientY = e.clientY ?? e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY;
  if (!clientX) {
    return [];
  }
  const rect = canvasRef.value.getBoundingClientRect();
  const canvasX = clientX - rect.left;
  const canvasY = clientY - rect.top;
  const col = Math.floor((canvasX - offsetX.value) / scale.value);
  const row = Math.floor((canvasY - offsetY.value) / scale.value);
  const isOnCanvas = row >= 0 && col >= 0 && row < displayCanvas.value.height && col < displayCanvas.value.width
  return [row, col, clientX, clientY, isOnCanvas]
}

// =============================================
// 单元格操作 (Cell Operations)
// =============================================
function setCellColor(col, row, colorCode = '') {
  if (row >= 0 && row < colorCodes.value.length && col >= 0 && col < colorCodes.value[0].length) {
    colorCodes.value[row][col] = colorCode;
  }
}

function setCellAreaColor(startCol, startRow, colorCode = '') {
  const clickColorCode = colorCodes.value[startRow]?.[startCol];
  if (clickColorCode === undefined) return;

  const visited = new Set();
  const queue = [[startCol, startRow]];
  const cellsToUpdate = [];

  while (queue.length > 0) {
    const [col, row] = queue.shift();
    const key = `${col},${row}`;
    if (visited.has(key)) continue;
    if (row < 0 || row >= colorCodes.value.length || col < 0 || col >= colorCodes.value[0].length) continue;
    if (colorCodes.value[row][col] !== clickColorCode) continue;

    visited.add(key);
    cellsToUpdate.push([col, row]);
    queue.push([col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]);
  }

  for (const [col, row] of cellsToUpdate) {
    colorCodes.value[row][col] = colorCode;
  }
}

// =============================================
// 统计 & 排序 (Statistics & Sorting)
// =============================================
function updateStatsBar() {
  if (colorMode.value === 'original') {
    if (selectedCell.value) {
      // 原图模式如果选中了格子则识别色号
      const [r, g, b, a] = originalCanvas.value.getContext('2d').getImageData(selectedCell.value.col, selectedCell.value.row, 1, 1).data
      const [L, A, B] = rgb2lab(r, g, b, a);
      const similarColors = getSimilarColor(L, A, B, a, PALETTE_211);
      similarColors.forEach(color => color.description = parseInt(color.distance))
      sortedStats.value = similarColors
    } else {
      sortedStats.value = [];
    }
    return;
  }

  if (!colorCodes.value.length) {
    totalBeads.value = 0;
    uniqueColors.value = 0;
    sortedStats.value = [];
    return;
  }
  const colorCount = {};
  let total = 0;
  for (const row of colorCodes.value) {
    for (const code of row) {
      if (code) {
        colorCount[code] = (colorCount[code] || 0) + 1;
        total++;
      }
    }
  }
  const sorted = Object.entries(colorCount)
      .sort((a, b) => colorSort.value === 'alpha' ? a[0].localeCompare(b[0]) : b[1] - a[1])
      .map(([code, description]) => ({...PALETTE_MAP[code], description}));
  totalBeads.value = total;
  uniqueColors.value = sorted.length;
  sortedStats.value = sorted;
}

// =============================================
// 历史记录 (Undo/Redo)
// =============================================
function undo() {
  _historyGuard = true;
  colorCodes.value = history.undo();
  undoDisabled.value = history.undoStack.length <= 0
  redoDisabled.value = history.redoStack.length <= 0
  _historyGuard = false;
  redrawCanvas();
}

function redo() {
  _historyGuard = true;
  colorCodes.value = history.redo();
  undoDisabled.value = history.undoStack.length <= 0
  redoDisabled.value = history.redoStack.length <= 0
  _historyGuard = false;
  redrawCanvas();
}

// =============================================
// 图像操作 (Image Operations)
// =============================================
function onImportClick() {
  imageImporterRef.value?.openFilePicker();
}

function onImageLoaded(img, fileName) {
  originalCanvas.value = img;
  originalFileName.value = fileName;
  history.clear();
  undoDisabled.value = redoDisabled.value = true;
  selectedCell.value = null;
  processImageWithPalette();
  resetView();
}

function pixelChange() {
  imageImporterRef.value?.setupCropper(displayCanvas.value.toDataURL());
}

function autoCropper() {
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = 0; y < colorCodes.value.length; y++) {
    const row = colorCodes.value[y];
    for (let x = 0; x < row.length; x++) {
      if (row[x]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (minX > maxX || minY > maxY) return;
  const newWidth = maxX - minX + 3;
  const nullRow = Array(newWidth).fill(null);
  const newCodes = [nullRow];
  for (let y = minY; y <= maxY; y++) {
    newCodes.push([null, ...colorCodes.value[y].slice(minX, maxX + 1), null]);
  }
  newCodes.push(nullRow);
  colorCodes.value = newCodes;
}

function fixGap() {
  const grid = colorCodes.value;
  if (!grid?.length || !grid[0]?.length) return;
  const h = grid.length, w = grid[0].length;

  const isRowEmpty = (r) => {
    for (let c = 0; c < grid[r].length; c++) {
      if (grid[r][c] !== null) return false;
    }
    return true;
  };

  const keepRow = new Array(h).fill(true);
  let r = 0;
  while (r < h) {
    if (isRowEmpty(r)) {
      const start = r;
      while (r < h && isRowEmpty(r)) r++;
      const len = r - start;
      if (len > 2) {
        for (let i = start + 2; i < r; i++) keepRow[i] = false;
      }
    } else {
      r++;
    }
  }

  let newGrid = grid.filter((_, i) => keepRow[i]);
  if (!newGrid.length) { colorCodes.value = newGrid; return; }

  const h2 = newGrid.length, w2 = newGrid[0].length;
  const isColEmpty = (c) => {
    for (let r = 0; r < h2; r++) {
      if (newGrid[r][c] !== null) return false;
    }
    return true;
  };

  const keepCol = new Array(w2).fill(true);
  let c = 0;
  while (c < w2) {
    if (isColEmpty(c)) {
      const start = c;
      while (c < w2 && isColEmpty(c)) c++;
      const len = c - start;
      if (len > 2) {
        for (let i = start + 2; i < c; i++) keepCol[i] = false;
      }
    } else {
      c++;
    }
  }

  colorCodes.value = newGrid.map(row => row.filter((_, i) => keepCol[i]));
  autoCropper()
}

/**
 * 描边
 * @param strokeColor
 */
function onOutlineColorSelected(strokeColor) {
  outlinePaletteVisible.value = false;
  const height = colorCodes.value.length;
  if (height === 0) return;
  const width = colorCodes.value[0].length;
  const toFill = new Set();
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const current = colorCodes.value[row][col];
      if (!current) continue;
      for (const [nx, ny] of [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]]) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        if (!colorCodes.value[ny][nx]) {
          toFill.add(`${nx},${ny}`);
        }
      }
    }
  }
  const codes = colorCodes.value.map(row => [...row]);
  for (const key of toFill) {
    const [col, row] = key.split(',').map(Number);
    codes[row][col] = strokeColor;
  }
  colorCodes.value = codes;
}

function onRowColConfirm({type, index, direction, operation, count}) {
  rowColModalData.value.visible = false;
  colorCodes.value = rowColChange(colorCodes.value, type, index, direction, operation, count);
  redrawCanvas();
}

// =============================================
// 设置 (Settings)
// =============================================
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    // ignore
  }
}

function onSettingsToggle() {
  settingsOpen.value = !settingsOpen.value;
}

// =============================================
// Watch
// =============================================
const colorCodeChangeDebounce = debounce((newV) => {
  if (_historyGuard) return;
  const imageData = pixel2ImageData(newV);
  paletteCanvas.value.width = imageData.width;
  paletteCanvas.value.height = imageData.height;
  paletteCanvas.value.getContext('2d').putImageData(imageData, 0, 0);
  redrawCanvas();
  canvasSizeText.value = `${imageData.width} × ${imageData.height}`;
  history.save(newV);
  undoDisabled.value = history.undoStack.length <= 0
  redoDisabled.value = history.redoStack.length <= 0
}, 200, {leading: true, trailing: true});

watch(colorCodes, (newV) => {
  colorCodeChangeDebounce(newV);
}, {deep: true});

watch(colorSort, () => {
  updateStatsBar();
});

watch([bgColor, gridColor, showGrid], () => {
  redrawCanvas();
  saveSettings({bgColor: bgColor.value, gridColor: gridColor.value, showGrid: showGrid.value});
});

// =============================================
// 生命周期 (Lifecycle)
// =============================================
onMounted(() => {
  ctx = canvasRef.value.getContext('2d');
  const saved = loadSettings();
  if (saved) {
    if (saved.bgColor !== undefined) bgColor.value = saved.bgColor;
    if (saved.gridColor) gridColor.value = saved.gridColor;
    if (typeof saved.showGrid === 'boolean') showGrid.value = saved.showGrid;
  }
  initCanvas();
  const defaultImg = buildDefaultPixelArt();
  onImageLoaded(defaultImg);
  window.addEventListener('resize', handleResize);
  window.addEventListener('click', onWindowClick);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('click', onWindowClick);
});
</script>

<style src="src/BeadsEditor.scss" scoped></style>
