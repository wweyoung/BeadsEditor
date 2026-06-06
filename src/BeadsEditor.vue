<template>
  <div class="container">
    <div class="top-bar">
      <div class="top-bar-row">
        <div class="left-group">
          <h1>🧩 KX拼豆图</h1>
          <div class="color-mode-select">
            <button class="color-mode-option" :class="{ active: colorMode === 'original' }"
                    @click="setColorMode('original')"
            >原图
            </button>
            <button class="color-mode-option" :class="{ active: colorMode !== 'original' }"
                    @click="setColorMode(paletteMode)"
            >图纸
            </button>
          </div>
        </div>

        <div class="right-group">
          <button class="text-btn" title="导入" @click="onImportClick">📁 导入</button>
          <ImageImporter ref="imageImporterRef" @image-loaded="onImageLoaded"/>
          <button class="text-btn" title="导出图片" @click="exportModalVisible = true">💾 导出</button>
          <ExportModal
              :visible="exportModalVisible"
              :default-name="originalFileName"
              :displayCanvas="displayCanvas"
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
        </div>
      </div>

      <div class="top-bar-row">
        <div class="left-group">
          <div class="coord-display">
            📍 坐标 <span class="inner">{{ coordText }}</span>
            <span class="inner" style="margin-left: 0.5rem;">{{ canvasSizeText }}</span>
          </div>
        </div>

        <div class="right-group">
          <div class="coord-display">
            📊 <span class="inner">{{ statsTotal }}</span>
          </div>
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
          @mousedown="handleMouseDown"
          @mouseleave="handleMouseLeave"
          @wheel.prevent="handleWheel"
          @touchstart.prevent="onTouchStart"
          @touchmove.prevent="onTouchMove"
          @touchend="onTouchEnd"
          @click="onCanvasClick"
      ></canvas>
    </div>

    <div class="stats-bar-wrapper">
      <div class="stats-bar" :class="{ expanded: statsExpanded }">
        <span
            v-for="item in sortedStats"
            :key="item.code"
            class="stats-tag"
            :class="{ highlight: highlightCode === item.code }"
            @click="onTagClick(item.code)"
        >
          <span class="swatch" :style="{ background: item.colorHex }"></span>
          <span class="code">{{ item.code }}</span>
          <span class="count">{{ item.count }}</span>
        </span>
      </div>
      <button
          v-if="sortedStats.length > 8"
          class="stats-expand-btn"
          @click="statsExpanded = !statsExpanded"
      >
        {{ statsExpanded ? '▼' : '▲' }}
      </button>
    </div>

    <div class="bottom-bar">
      <button class="text-btn" title="撤销" @click="undo">撤销</button>
      <button class="text-btn" title="重做" @click="redo">重做</button>
      <button class="text-btn" :class="{ active: showGrid }" title="网格" @click="toggleGrid">🔲 网格</button>
      <button v-if="colorMode !== 'original'" class="text-btn" :class="{ active: showColorCode }" title="显示色号"
              @click="toggleColorCode">#️⃣ 色号
      </button>
      <button v-if="colorMode !== 'original'" class="text-btn" title="左右镜像" @click="toggleMirror">🪞 镜像</button>
      <button v-if="colorMode !== 'original'" class="text-btn" :class="{ active: operationMode === 'eraser' }"
              title="橡皮擦"
              @click="toggleOperationMode('eraser')">🧽 橡皮擦
      </button>
      <button v-if="colorMode !== 'original'" class="text-btn" :class="{ active: operationMode === 'areaEraser' }"
              title="区域擦除"
              @click="toggleOperationMode('areaEraser')">🧹 区域擦除
      </button>
      <button ref="settingsBtnRef" class="text-btn" title="设置" @click.stop="onSettingsToggle">⚙️ 设置</button>

      <div
          v-show="settingsOpen"
          ref="settingsPanelRef"
          class="settings-panel"
      >
        <div class="settings-row">
          <span class="label">背景</span>
          <input type="color" :value="bgColor" title="背景色" @input="onBgColorInput">
        </div>
        <div class="settings-row">
          <span class="label">网格</span>
          <input type="color" :value="gridColor" title="网格颜色" @input="onGridColorInput">
        </div>
        <div class="settings-row">
          <span class="label">色号套装</span>
          <button
              v-for="opt in COLOR_MODES"
              :key="opt.mode"
              class="text-btn"
              :class="{ active: paletteMode === opt.mode }"
              @click="setColorMode(opt.mode)"
          >{{ opt.label }}
          </button>
        </div>
        <div class="settings-row">
          <button class="text-btn" title="左右镜像" @click="pixelChange">像素调整</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {
  PALETTE_96,
  COLOR_MODES,
  rgb2lab,
  getPalette,
  colorDistance,
  getColorCacheKey,
  PALETTE_MAP
} from './palette.js';
import ImageImporter from './ImageImporter.vue';
import ExportModal from './ExportModal.vue';
import RowColModal from './RowColModal.vue';
import {canvasMirror} from "./util/canvasUtil";
import {BeadsHistory} from "./util/beadsHistory";
import {buildDefaultPixelArt, pixel2ImageData, rowColChange} from "./util/pixelUtil";
import {debounce} from "lodash";

const colorCodeMapCache = new Map();

const GRID_BASE_MAJOR = 10;
const GRID_BASE_MINOR = 5;
const SETTINGS_KEY = 'pixelArtSettings';

function findClosestColor(r, g, b, palette) {
  const key = getColorCacheKey(r, g, b);
  const cached = colorCodeMapCache.get(key);
  if (cached) return cached;
  let minDist = Infinity;
  let closest = palette[0];
  const [L, A, B] = rgb2lab(r, g, b, key);
  for (const c of palette) {
    const d = colorDistance(L, A, B, c.L, c.A, c.B);
    if (d < minDist) {
      minDist = d;
      closest = c;
    }
  }
  colorCodeMapCache.set(key, closest);
  return closest;
}

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
  }
}


const canvasRef = ref(null);
const wrapperRef = ref(null);
const fileInputRef = ref(null);
const settingsPanelRef = ref(null);
const settingsBtnRef = ref(null);
const imageImporterRef = ref(null);

const originalFileName = ref('pixel-art');

const showGrid = ref(true);
const showColorCode = ref(true);
const colorMode = ref('original');
const paletteMode = ref(localStorage.getItem('beads_color_mode') || '211');
const statsExpanded = ref(false);
const operationMode = ref(null);

const gridColor = ref('#ff0000');
const bgColor = ref('#fefaf5');
const settingsOpen = ref(false);
const exportModalVisible = ref(false);
const rowColModalData = ref({
  visible: false,
  type: 'column',
  index: 0
})
const highlightCode = ref(null);
const coordText = ref('— , —');
const canvasSizeText = ref('— × —');
const statsTotal = ref('—');

const sortedStats = ref([]);

const scale = ref(1);
const offsetX = ref(0);
const offsetY = ref(0);

let originalCanvas = null;
const displayCanvas = document.createElement('canvas');
const historyIndex = ref()
const history = new BeadsHistory(historyIndex)
let imageWidth = 0;
let imageHeight = 0;
let colorCodes = ref([]);
let ctx = null;

const isDragging = ref(false);
const isGrabbing = ref(false);
let dragStartX = 0, dragStartY = 0, dragStartOffsetX = 0, dragStartOffsetY = 0;
let touchDist = 0, touchStartScale = 1, touchStartOffsetX = 0, touchStartOffsetY = 0;
let touchMidX = 0, touchMidY = 0;
let clickStartX = 0, clickStartY = 0, clickStartTime = 0;
const DRAG_THRESHOLD = 5; // 移动超过5px认为是拖动
const CLICK_TIME_THRESHOLD = 300; // 按下超过300ms认为是长按

const currentPalette = computed(() => {
  return getPalette(paletteMode.value)
})

function initCanvas() {
  const canvas = canvasRef.value;
  const wrapper = wrapperRef.value;
  if (!canvas || !wrapper) return;
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
}

function processImageWithPalette() {
  if (!originalCanvas) return Promise.resolve();

  return new Promise((resolve) => {
    const oid = originalCanvas.getContext('2d', {willReadFrequently: true})
        .getImageData(0, 0, originalCanvas.width, originalCanvas.height).data;
    const idata = new ImageData(originalCanvas.width, originalCanvas.height);
    const d = idata.data;

    // First pass: apply palette if not original mode
    const palette = currentPalette.value;
    let i = 0;
    for (let row = 0; row < originalCanvas.height; row++) {
      for (let col = 0; col < originalCanvas.width; col++, i += 4) {
        const r = oid[i], g = oid[i + 1], b = oid[i + 2], a = oid[i + 3];
        if (!colorCodes.value[row]) colorCodes.value[row] = []
        if (a === 0) {
          colorCodes.value[row][col] = null;
        } else {
          const closest = findClosestColor(r, g, b, palette);
          d[i] = closest.r;
          d[i + 1] = closest.g;
          d[i + 2] = closest.b;
          d[i + 3] = 255;
          colorCodes.value[row][col] = closest.code;
        }
      }
    }

    imageWidth = idata.width;
    imageHeight = idata.height;
    displayCanvas.getContext('2d').putImageData(idata, 0, 0);
    canvasSizeText.value = `${imageWidth} × ${imageHeight}`;
    redrawCanvas();
    resolve();
  });
}

function redrawCanvas() {
  if (!ctx) return;
  const canvas = canvasRef.value;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = bgColor.value;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const image = colorMode.value === 'original' ? originalCanvas : displayCanvas
  if (!image) return;

  ctx.save();
  ctx.translate(offsetX.value, offsetY.value);
  ctx.scale(scale.value, scale.value);
  ctx.imageSmoothingEnabled = false;

  const invScale = 1 / scale.value;
  const visibleX = Math.max(0, Math.floor(-offsetX.value * invScale));
  const visibleY = Math.max(0, Math.floor(-offsetY.value * invScale));
  const visibleW = Math.min(imageWidth - visibleX, Math.ceil(canvas.width * invScale) + 1);
  const visibleH = Math.min(imageHeight - visibleY, Math.ceil(canvas.height * invScale) + 1);

  ctx.drawImage(image,
      visibleX, visibleY, visibleW, visibleH,
      visibleX, visibleY, visibleW, visibleH
  );

  if (showGrid.value) drawGrid(visibleX, visibleY, visibleW, visibleH);
  if (showColorCode.value && colorMode.value !== 'original') {
    drawColorCodes(visibleX, visibleY, visibleW, visibleH);
  }
  if (highlightCode.value && colorMode.value !== 'original') {
    drawHighlightMask(visibleX, visibleY, visibleW, visibleH);
  }

  ctx.restore();
  updateStatsBar();
}

function drawGrid(vx, vy, vw, vh) {
  if (imageWidth === 0 || imageHeight === 0) return;
  const ps = 1;

  const baseWidth = Math.max(imageWidth, imageHeight);
  const scaleFactor = Math.max(0.3, Math.min(1.5, baseWidth / 50));

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
  const xStart2 = Math.ceil(vx / (GRID_BASE_MAJOR * ps)) * GRID_BASE_MAJOR * ps + GRID_BASE_MINOR * ps;
  for (let x = xStart2; x < endX; x += GRID_BASE_MAJOR * ps) {
    ctx.beginPath();
    ctx.moveTo(x, vy);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  const yStart2 = Math.ceil(vy / (GRID_BASE_MAJOR * ps)) * GRID_BASE_MAJOR * ps + GRID_BASE_MINOR * ps;
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
  const showScale = scale.value >= 16
  const coordFontSize = Math.max(0.5, 12 / scale.value);
  ctx.font = `${coordFontSize}px Consolas, monospace`;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let x = 0; x < imageWidth; x += ps) {
    if (x >= vx && x <= endX) {
      ctx.fillStyle = 'rgba(170,170,170,0.5)';
      ctx.fillRect(x, -ps, ps, ps);
      if (showScale) {
        const text = `${x + 1}`;
        const cx = x + ps / 2;
        const cy = -ps / 2;
        ctx.fillStyle = '#000';
        ctx.fillText(text, cx, cy);
      }
    }
  }
  for (let x = 0; x < imageWidth; x += ps) {
    if (x >= vx && x <= endX) {
      ctx.fillStyle = 'rgba(170,170,170,0.5)';
      ctx.fillRect(x, imageHeight, ps, ps);
      if (showScale) {
        const text = `${x + 1}`;
        const cx = x + ps / 2;
        const cy = imageHeight + ps / 2;
        ctx.fillStyle = '#000';
        ctx.fillText(text, cx, cy);
      }
    }
  }
  ctx.textAlign = 'center';
  for (let y = 0; y < imageHeight; y += ps) {
    if (y >= vy && y <= endY) {
      ctx.fillStyle = 'rgba(170,170,170,0.5)';
      ctx.fillRect(-ps, y, ps, ps);
      if (showScale) {
        const text = `${y + 1}`;
        const cx = -ps / 2;
        const cy = y + ps / 2;
        ctx.fillStyle = '#000';
        ctx.fillText(text, cx, cy);
      }
    }
  }
  for (let y = 0; y < imageHeight; y += ps) {
    if (y >= vy && y <= endY) {
      ctx.fillStyle = 'rgba(170,170,170,0.5)';
      ctx.fillRect(imageWidth, y, ps, ps);
      if (showScale) {
        const text = `${y + 1}`;
        const cx = imageWidth + ps / 2;
        const cy = y + ps / 2;
        ctx.fillStyle = '#000';
        ctx.fillText(text, cx, cy);
      }
    }
  }
}

function drawColorCodes(vx, vy, vw, vh) {
  if (!colorCodes.value?.length) return;
  if (scale.value < 16) return;
  const fontSize = Math.max(7 / scale.value, 0.5);
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
        const br = (ci.r * 299 + ci.g * 587 + ci.b * 114) / 1000;
        ctx.fillStyle = br < 128 ? '#fff' : '#000';
      }
      ctx.fillText(code, x + 0.5, y + 0.5);
    }
  }
  ctx.restore();
}

async function setColorMode(mode) {

  highlightCode.value = null;
  colorMode.value = mode;
  localStorage.setItem('beads_color_mode', mode);
  if (mode !== 'original') {
    if (paletteMode.value !== mode) {
      // 清除缓存
      colorCodeMapCache.clear();
      paletteMode.value = mode
      await processImageWithPalette();
      return
    }
  }
  redrawCanvas()
}

function onImportClick() {
  imageImporterRef.value?.openFilePicker();
}

function onImageLoaded(img, fileName) {
  originalCanvas = img;
  originalFileName.value = fileName;
  processImageWithPalette();
  resetView();
}

function resetView() {
  if (!displayCanvas) return;
  initCanvas();
  const wrapper = wrapperRef.value;
  const ww = wrapper.clientWidth, wh = wrapper.clientHeight;
  const sx = (ww * 0.9) / imageWidth;
  const sy = (wh * 0.9) / imageHeight;
  let s = Math.min(sx, sy, 50);
  s = Math.max(0.1, s);
  scale.value = s;
  offsetX.value = (ww - imageWidth * s) / 2;
  offsetY.value = (wh - imageHeight * s) / 2;
  redrawCanvas();
}

function toggleMirror() {
  colorCodes.value = colorCodes.value.map(row => [...row].reverse());
}

async function toggleColorCode(show) {
  if (colorMode.value === 'original') {
    await setColorMode(paletteMode.value);
  }
  showColorCode.value = typeof show === 'boolean' ? show : !showColorCode.value;
  saveSettings({bgColor: bgColor.value, gridColor: gridColor.value, showGrid: showGrid.value});
  redrawCanvas();
}

function handleMouseDown(e) {
  if (!displayCanvas) return;
  isDragging.value = true;
  isGrabbing.value = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartOffsetX = offsetX.value;
  dragStartOffsetY = offsetY.value;
  clickStartX = e.clientX;
  clickStartY = e.clientY;
  clickStartTime = Date.now();
  e.preventDefault();
}

function handleMouseMove(e) {
  if (!displayCanvas) return;
  if (isDragging.value) {
    offsetX.value = dragStartOffsetX + (e.clientX - dragStartX);
    offsetY.value = dragStartOffsetY + (e.clientY - dragStartY);
    redrawCanvas();
  }
  updateCoordinateDisplay(e);
}

function handleMouseUp() {
  isDragging.value = false;
  isGrabbing.value = false;
}

function handleMouseLeave() {
  isDragging.value = false;
  isGrabbing.value = false;
  coordText.value = '— , —';
}

function handleTouchStart(e) {
  if (!displayCanvas) return;
  updateCoordinateDisplay(e);
}

function handleTouchMove(e) {
  if (!displayCanvas) return;
  updateCoordinateDisplay(e);
}

function handleWheel(e) {
  if (!displayCanvas) return;
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

function updateCoordinateDisplay(e) {
  if (!displayCanvas) {
    coordText.value = '— , —';
    return;
  }
  const canvas = canvasRef.value;
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const ix = (clientX - rect.left - offsetX.value) / scale.value;
  const iy = (clientY - rect.top - offsetY.value) / scale.value;
  const col = Math.floor(ix);
  const row = Math.floor(iy);
  if (col >= 0 && col < imageWidth && row >= 0 && row < imageHeight) {
    const code = colorCodes.value[row][col];
    coordText.value = code ? `${col + 1},${row + 1} #${code}` : `${col + 1},${row + 1}`;
  } else {
    coordText.value = '— , —';
  }
}

function updateStatsBar() {
  if (colorCodes.value.length || colorMode.value === 'original') {
    statsTotal.value = '—';
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
  const palette = currentPalette.value;
  const sorted = Object.entries(colorCount)
      .sort((a, b) => b[1] - a[1])
      .map(([code, count]) => {
        const ci = palette ? palette.find((c) => c.code === code) : null;
        const colorHex = ci
            ? `#${ci.r.toString(16).padStart(2, '0')}${ci.g.toString(16).padStart(2, '0')}${ci.b.toString(16).padStart(2, '0')}`
            : '#ccc';
        return {code, count, colorHex};
      });
  statsTotal.value = `共 ${total} 珠 · ${sorted.length} 色`;
  sortedStats.value = sorted;
}

function onTagClick(code) {
  if (highlightCode.value === code) {
    highlightCode.value = null;
  } else {
    highlightCode.value = code;
    if (!showColorCode.value) {
      showColorCode.value = true;
      saveSettings({bgColor: bgColor.value, gridColor: gridColor.value, showGrid: showGrid.value});
      if (scale.value < 16) {
        const canvas = canvasRef.value;
        scale.value = 16;
        offsetX.value = (canvas.width - imageWidth * scale.value) / 2;
        offsetY.value = (canvas.height - imageHeight * scale.value) / 2;
      }
    }
  }
  redrawCanvas();
}

function drawHighlightMask(vx, vy, vw, vh) {
  if (colorCodes.value.length) return;
  const target = highlightCode.value;
  if (!target) return;

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(offsetX.value, offsetY.value);
  ctx.scale(scale.value, scale.value);

  const endX = vx + vw;
  const endY = vy + vh;

  for (let y = vy; y < endY; y++) {
    for (let x = vx; x < endX; x++) {
      const code = colorCodes.value[y][x];
      if (code === target || !code) continue;
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
      const bottom = y < imageHeight - 1 && colorCodes.value[y + 1][x] === target;
      const left = x > 0 && colorCodes.value[y][x - 1] === target;
      const right = x < imageWidth - 1 && colorCodes.value[y][x + 1] === target;

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

function toggleGrid() {
  showGrid.value = !showGrid.value;
  redrawCanvas();
  saveSettings({bgColor: bgColor.value, gridColor: gridColor.value, showGrid: showGrid.value});
}


function pixelChange() {
  imageImporterRef.value?.setupCropper(originalCanvas.toDataURL());
}

function onBgColorInput(e) {
  bgColor.value = e.target.value;
  redrawCanvas();
  saveSettings({bgColor: bgColor.value, gridColor: gridColor.value, showGrid: showGrid.value});
}

function onGridColorInput(e) {
  gridColor.value = e.target.value;
  redrawCanvas();
  saveSettings({bgColor: bgColor.value, gridColor: gridColor.value, showGrid: showGrid.value});
}

function onSettingsToggle() {
  settingsOpen.value = !settingsOpen.value;
}

function onWindowClick(e) {
  if (!settingsOpen.value) return;
  if (settingsPanelRef.value && !settingsPanelRef.value.contains(e.target)
      && settingsBtnRef.value && !settingsBtnRef.value.contains(e.target)) {
    settingsOpen.value = false;
  }
}

function handleResize() {
  if (!displayCanvas) {
    initCanvas();
    return;
  }
  const canvas = canvasRef.value;
  const ocx = canvas.width / 2, ocy = canvas.height / 2;
  initCanvas();
  offsetX.value += canvas.width / 2 - ocx;
  offsetY.value += canvas.height / 2 - ocy;
  redrawCanvas();
}

function onTouchStart(e) {
  if (!displayCanvas) return;
  e.preventDefault();
  if (e.touches.length === 1) {
    isDragging.value = true;
    isGrabbing.value = true;
    dragStartX = e.touches[0].clientX;
    dragStartY = e.touches[0].clientY;
    dragStartOffsetX = offsetX.value;
    dragStartOffsetY = offsetY.value;
  } else if (e.touches.length === 2) {
    isDragging.value = false;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    touchDist = Math.hypot(dx, dy);
    touchStartScale = scale.value;
    touchStartOffsetX = offsetX.value;
    touchStartOffsetY = offsetY.value;
    const canvas = canvasRef.value;
    const rect = canvas.getBoundingClientRect();
    touchMidX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
    touchMidY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
  }
}

function onTouchMove(e) {
  if (!displayCanvas) return;
  e.preventDefault();
  if (e.touches.length === 1 && isDragging.value) {
    offsetX.value = dragStartOffsetX + (e.touches[0].clientX - dragStartX);
    offsetY.value = dragStartOffsetY + (e.touches[0].clientY - dragStartY);
    redrawCanvas();
  } else if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const d = Math.hypot(dx, dy);
    const ns = Math.max(0.1, Math.min(50, touchStartScale * (d / touchDist)));
    offsetX.value = touchMidX - (touchMidX - touchStartOffsetX) * (ns / touchStartScale);
    offsetY.value = touchMidY - (touchMidY - touchStartOffsetY) * (ns / touchStartScale);
    scale.value = ns;
    redrawCanvas();
  }
}

function onTouchEnd() {
  isDragging.value = false;
  isGrabbing.value = false;
}

function onCanvasClick(e) {
  if (!displayCanvas || !canvasRef.value) return;

  // 判断是否是真正的点击操作（非拖动）
  const moveDistance = Math.sqrt(
      Math.pow(e.clientX - clickStartX, 2) +
      Math.pow(e.clientY - clickStartY, 2)
  );
  const clickDuration = Date.now() - clickStartTime;

  // 如果移动距离超过阈值或按住时间过长，认为是拖动操作，不触发点击
  if (moveDistance > DRAG_THRESHOLD || clickDuration > CLICK_TIME_THRESHOLD) {
    return;
  }

  const rect = canvasRef.value.getBoundingClientRect();
  const canvasX = e.clientX - rect.left;
  const canvasY = e.clientY - rect.top;
  const displayX = (canvasX - offsetX.value) / scale.value;
  const displayY = (canvasY - offsetY.value) / scale.value;
  const ps = 1;

  // Check if click is in ruler area
  const inTopRuler = displayY >= -ps && displayY < 0 && displayX >= 0 && displayX < imageWidth;
  const inBottomRuler = displayY >= imageHeight && displayY < imageHeight + ps && displayX >= 0 && displayX < imageWidth;
  const inLeftRuler = displayX >= -ps && displayX < 0 && displayY >= 0 && displayY < imageHeight;
  const inRightRuler = displayX >= imageWidth && displayX < imageWidth + ps && displayY >= 0 && displayY < imageHeight;

  if (inTopRuler || inBottomRuler) {
    const col = Math.floor(displayX / ps);
    rowColModalData.value = {
      type: 'column',
      index: Math.max(0, Math.min(col, imageWidth - 1)),
      visible: true,
    }
  } else if (inLeftRuler || inRightRuler) {
    const row = Math.floor(displayY / ps);
    rowColModalData.value = {
      type: 'row',
      index: Math.max(0, Math.min(row, imageHeight - 1)),
      visible: true,
    }
  } else if (operationMode.value === 'eraser' || operationMode.value === 'areaEraser') {
    // Handle eraser tools
    const col = Math.floor(displayX / ps);
    const row = Math.floor(displayY / ps);
    if (col >= 0 && col < imageWidth && row >= 0 && row < imageHeight) {
      if (operationMode.value === 'eraser') {
        // Single cell eraser
        setCellColor(col, row);
      } else if (operationMode.value === 'areaEraser') {
        // Area eraser - erase connected same-color cells
        setCellAreaColor(col, row);
      }
    }
  }
}

function setCellColor(col, row, colorCode = '') {
  const ctx = displayCanvas.getContext('2d');
  const color = PALETTE_MAP[colorCode]
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
  ctx.fillRect(col, row, 1, 1);
  colorCodes.value[row][col] = colorCode
  redrawCanvas()
}

function setCellAreaColor(startCol, startRow, colorCode = '') {
  const ctx = originalCanvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, imageWidth, imageHeight);
  const color = PALETTE_MAP[colorCode];
  // Get the color of the starting cell
  const startIdx = (startRow * imageWidth + startCol) * 4;
  const targetR = imageData.data[startIdx];
  const targetG = imageData.data[startIdx + 1];
  const targetB = imageData.data[startIdx + 2];
  const targetA = imageData.data[startIdx + 3];

  // BFS to find all connected same-color cells
  const visited = new Set();
  const queue = [[startCol, startRow]];
  const cellsToErase = [];

  while (queue.length > 0) {
    const [col, row] = queue.shift();
    const key = `${col},${row}`;

    if (visited.has(key)) continue;
    if (col < 0 || col >= imageWidth || row < 0 || row >= imageHeight) continue;

    const idx = (row * imageWidth + col) * 4;
    const r = imageData.data[idx];
    const g = imageData.data[idx + 1];
    const b = imageData.data[idx + 2];
    const a = imageData.data[idx + 3];

    // Check if color matches (including transparency check)
    if (r !== targetR || g !== targetG || b !== targetB || a !== targetA) continue;

    visited.add(key);
    cellsToErase.push([col, row]);

    // Add adjacent cells to queue
    queue.push([col + 1, row]);
    queue.push([col - 1, row]);
    queue.push([col, row + 1]);
    queue.push([col, row - 1]);
  }

  // Erase all cells
  for (const [col, row] of cellsToErase) {
    const idx = (row * imageWidth + col) * 4;
    imageData.data[idx] = color.r;
    imageData.data[idx + 1] = color.g;
    imageData.data[idx + 2] = color.b;
    imageData.data[idx + 3] = color.a;
    colorCodes.value[row][col] = colorCode
  }

  redrawCanvas()
}

function undo() {
  const undoCodes = history.undo();
  colorCodes.value = undoCodes
}

function redo() {
  colorCodes.value = history.redo()
}

function toggleOperationMode(mode) {
  if (operationMode.value === mode) {
    operationMode.value = null;
  } else {
    operationMode.value = mode;
  }
}

function onRowColConfirm({type, index, direction, operation, count}) {
  rowColModalData.value.visible = false;
  colorCodes.value = rowColChange(colorCodes.value, type, index, direction, operation, count)
  redrawCanvas();
}


onMounted(() => {
  ctx = canvasRef.value.getContext('2d');
  const saved = loadSettings();
  if (saved) {
    if (saved.bgColor) bgColor.value = saved.bgColor;
    if (saved.gridColor) gridColor.value = saved.gridColor;
    if (typeof saved.showGrid === 'boolean') showGrid.value = saved.showGrid;
  }
  initCanvas();
  const defaultImg = buildDefaultPixelArt();
  onImageLoaded(defaultImg);
  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
  window.addEventListener('resize', handleResize);
  window.addEventListener('click', onWindowClick);
  canvasRef.value.addEventListener('touchstart', handleTouchStart, {passive: true});
  canvasRef.value.addEventListener('touchmove', handleTouchMove, {passive: true});
});

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove);
  window.removeEventListener('mouseup', handleMouseUp);
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('click', onWindowClick);
  if (canvasRef.value) {
    canvasRef.value.removeEventListener('touchstart', handleTouchStart);
    canvasRef.value.removeEventListener('touchmove', handleTouchMove);
  }
});

const colorCodeChangeDebounce = debounce((newV) => {
  const imageData = pixel2ImageData(newV)
  displayCanvas.getContext('2d').putImageData(imageData, 0, 0);
  redrawCanvas();
  history.save(newV)
}, 100, {leading: true, trailing: true})

watch(colorCodes, (newV) => {
  colorCodeChangeDebounce(newV)
}, {deep: true})
</script>

<style src="./BeadsEditor.css" scoped></style>
