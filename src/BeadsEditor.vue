<template>
  <div class="container">
    <div class="top-bar">
      <div class="top-bar-row">
        <div class="left-group">
          <h1>🧩 KX拼豆图</h1>
          <div class="color-mode-select">
            <button class="color-mode-option" :class="{ active: colorMode === 'original' }"
                    @click="setColorMode('original')"
            >原图</button>
            <button class="color-mode-option" :class="{ active: colorMode !== 'original' }"
                    @click="setColorMode('211')"
            >图纸</button>
          </div>
        </div>

        <div class="right-group">
          <button class="text-btn" title="导入" @click="onImportClick">📁 导入</button>
          <ImageImporter ref="imageImporterRef" @image-loaded="onImageLoaded"/>
          <button class="text-btn" title="导出图片" @click="onExportClick">💾 导出</button>
          <ExportModal
            ref="exportModalRef"
            :visible="exportModalVisible"
            :default-name="originalFileName"
            :default-author="authorName"
            @confirm="onExportConfirm"
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
      <button class="text-btn" :class="{ active: showGrid }" title="网格" @click="toggleGrid">🔲 网格</button>
      <button class="text-btn" :class="{ active: showColorCode }" title="显示色号" @click="toggleColorCode">#️⃣ 色号</button>
      <button class="text-btn" title="左右镜像" @click="toggleMirror">🪞 镜像</button>
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
              :class="{ active: colorMode === opt.mode }"
              @click="setColorMode(opt.mode)"
          >{{ opt.label }}</button>
        </div>
        <div class="settings-row">
          <button class="text-btn" title="左右镜像" @click="pixelChange">像素调整</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import {PALETTE_211, PALETTE_96, COLOR_MODES, rgb2lab, getPalette, colorDistance, getColorCacheKey} from './palette.js';
import ImageImporter from './ImageImporter.vue';
import ExportModal from './ExportModal.vue';
import RowColModal from './RowColModal.vue';
import {canvasMirror, rowColChange} from "./util/canvasUtil";

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

function buildDefaultPixelArt() {
  const c = document.createElement('canvas');
  c.width = 50;
  c.height = 50;
  const d = c.getContext('2d');
  d.fillStyle = '#fff';
  d.fillRect(0, 0, 50, 50);
  const colors = ['#ff4444', '#4444ff', '#44ff44', '#ffff44', '#ff44ff', '#ff8800', '#00ffff', '#ff4488', '#88ff44', '#4488ff'];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      d.fillStyle = colors[(row * 5 + col) % 10];
      d.fillRect(col * 10, row * 10, 10, 10);
    }
  }
  d.fillStyle = '#000';
  d.fillRect(5, 25, 2, 2);
  d.fillRect(13, 25, 2, 2);
  d.fillRect(5, 33, 10, 2);
  d.fillRect(6, 34, 8, 2);
  return c;
}

const canvasRef = ref(null);
const wrapperRef = ref(null);
const fileInputRef = ref(null);
const settingsPanelRef = ref(null);
const settingsBtnRef = ref(null);
const imageImporterRef = ref(null);
const exportModalRef = ref(null);

const originalFileName = ref('pixel-art');
const authorName = ref(localStorage.getItem('beads_author_name') || '');

const showGrid = ref(true);
const showColorCode = ref(true);
const colorMode = ref('original');
const paletteMode = ref(null);
const statsExpanded = ref(false);

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

let originalImage = null;
let displayImage = null;
let imageWidth = 0;
let imageHeight = 0;
let colorCodeMap = null;
let ctx = null;

const isDragging = ref(false);
const isGrabbing = ref(false);
let dragStartX = 0, dragStartY = 0, dragStartOffsetX = 0, dragStartOffsetY = 0;
let touchDist = 0, touchStartScale = 1, touchStartOffsetX = 0, touchStartOffsetY = 0;
let touchMidX = 0, touchMidY = 0;

const currentPalette = ref([])

function initCanvas() {
  const canvas = canvasRef.value;
  const wrapper = wrapperRef.value;
  if (!canvas || !wrapper) return;
  canvas.width = wrapper.clientWidth;
  canvas.height = wrapper.clientHeight;
}

function processImageWithPalette() {
  if (!originalImage) return Promise.resolve();

  return new Promise((resolve) => {
    const oid = originalImage.getContext('2d', { willReadFrequently: true })
        .getImageData(0, 0, originalImage.width, originalImage.height).data;
    const dc = document.createElement('canvas');
    dc.width = originalImage.width;
    dc.height = originalImage.height;
    const dctx = dc.getContext('2d');
    const idata = dctx.createImageData(dc.width, dc.height);
    const d = idata.data;

    // First pass: apply palette if not original mode
    let tempColorCodeMap = [];
    const palette = currentPalette.value;

    if (colorMode.value !== 'original' && palette) {
      for (let i = 0; i < oid.length; i += 4) {
        const r = oid[i], g = oid[i + 1], b = oid[i + 2], a = oid[i + 3];
        if (a === 0) {
          tempColorCodeMap.push(null);
        } else {
          const closest = findClosestColor(r, g, b, palette);
          d[i] = closest.r;
          d[i + 1] = closest.g;
          d[i + 2] = closest.b;
          d[i + 3] = 255;
          tempColorCodeMap.push(closest.code);
        }
      }
      dctx.putImageData(idata, 0, 0);
    }

    imageWidth = dc.width;
    imageHeight = dc.height;
    colorCodeMap = tempColorCodeMap;
    displayImage = dc;
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
  const image = colorMode.value === 'original' ? originalImage : displayImage
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
  if (!colorCodeMap?.length) return;
  if (scale.value < 16) return;
  const fontSize = Math.max(7 / scale.value, 0.5);
  ctx.save();
  ctx.font = `${fontSize}px Consolas, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const palette = currentPalette.value;
  if (!palette) { ctx.restore(); return; }

  const endX = vx + vw;
  const endY = vy + vh;

  for (let y = vy; y < endY; y++) {
    for (let x = vx; x < endX; x++) {
      const code = colorCodeMap[y * imageWidth + x];
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
  currentPalette.value = getPalette(mode);
  if (mode !== 'original') {
    if (paletteMode.value !== mode) {
      // 清除缓存
      colorCodeMapCache.clear();
      paletteMode.value = mode
    }
    localStorage.setItem('beads_color_mode', mode);
  }
  await processImageWithPalette();
}

function onImportClick() {
  imageImporterRef.value?.openFilePicker();
}

function onImageLoaded(img, fileName) {
  originalImage = img;
  displayImage = null;
  originalFileName.value = fileName;
  processImageWithPalette();
  resetView();
}

function resetView() {
  if (!displayImage) return;
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
  displayImage = canvasMirror(displayImage);
  originalImage = canvasMirror(originalImage);

  const mirroredCodes = [];
  for (let y = 0; y < imageHeight; y++) {
    for (let x = imageWidth - 1; x >= 0; x--) {
      mirroredCodes.push(colorCodeMap[y * imageWidth + x]);
    }
  }

  colorCodeMap = mirroredCodes;
  redrawCanvas();
}

async function toggleColorCode(show) {
  if (colorMode.value === 'original') {
    // 切换到之前保存的模式，默认211
    const savedMode = localStorage.getItem('beads_color_mode') || '211';
    await setColorMode(savedMode);
  }
  showColorCode.value = typeof show === 'boolean' ? show : !showColorCode.value;
  saveSettings({ bgColor: bgColor.value, gridColor: gridColor.value, showGrid: showGrid.value });
  redrawCanvas();
}

async function exportImage(artworkName, authorName, exportTitle, exportAuthor, exportGrid, exportColorCode) {
  await toggleColorCode(true);
  if (!displayImage) return;
  if (!artworkName) return;

  let totalCount = 0, colorKind = 0;
  const colorCount = {};
  if (colorCodeMap) {
    for (const code of colorCodeMap) {
      if (code) {
        colorCount[code] = (colorCount[code] || 0) + 1;
        totalCount++;
      }
    }
    colorKind = Object.keys(colorCount).length;
  }

  const MIN_PIXEL_SIZE = 40;
  const ps = 1;
  const effectivePixelSize = ps * MIN_PIXEL_SIZE;
  const COORD_BORDER = MIN_PIXEL_SIZE * ps;

  const imgExportWidth = imageWidth * effectivePixelSize;
  const imgExportHeight = imageHeight * effectivePixelSize;

  const BASE_SCALE = imgExportWidth / 800;
  const TITLE_SCALE = Math.max(1, BASE_SCALE);
  const STAT_SCALE = Math.max(1, BASE_SCALE);
  const headerHeight = Math.round(50 * TITLE_SCALE);

  const palette = currentPalette.value;
  const sorted = Object.entries(colorCount).sort((a, b) => b[1] - a[1]);
  const tagHeight = Math.round(18 * STAT_SCALE);
  const lineHeight = Math.round(22 * STAT_SCALE);
  const gap = Math.round(6 * STAT_SCALE);
  const fontSize = Math.round(14 * STAT_SCALE);

  let tempX = 15 * STAT_SCALE, rowCount = 1;
  for (const [code, count] of sorted) {
    const countText = `${count}`;
    const tempFont = `bold ${fontSize}px Consolas, monospace`;
    const ex2 = document.createElement('canvas').getContext('2d');
    ex2.font = tempFont;
    const codeWidth = ex2.measureText(code).width + 10 * STAT_SCALE;
    const countWidth = ex2.measureText(countText).width + 10 * STAT_SCALE;
    const tagWidth = codeWidth + countWidth;
    if (tempX + tagWidth > imgExportWidth - 20 * STAT_SCALE) {
      tempX = 15 * STAT_SCALE;
      rowCount++;
    }
    tempX += tagWidth + gap;
  }
  const footerHeight = rowCount * lineHeight + 10 * STAT_SCALE;

  const exportWidth = imgExportWidth + COORD_BORDER * 2;
  const exportHeight = imgExportHeight + headerHeight + footerHeight + COORD_BORDER * 2;

  const MAX_CANVAS_SIZE = 16384;
  let finalExportWidth = exportWidth;
  let finalExportHeight = exportHeight;
  let exportScaleDown = 1;

  if (exportWidth > MAX_CANVAS_SIZE || exportHeight > MAX_CANVAS_SIZE) {
    exportScaleDown = MAX_CANVAS_SIZE / Math.max(exportWidth, exportHeight);
    finalExportWidth = Math.round(exportWidth * exportScaleDown);
    finalExportHeight = Math.round(exportHeight * exportScaleDown);
  }

  const ec = document.createElement('canvas');
  ec.width = finalExportWidth;
  ec.height = finalExportHeight;
  const ex = ec.getContext('2d');

  if (exportScaleDown < 1) {
    ex.scale(exportScaleDown, exportScaleDown);
    ex.imageSmoothingEnabled = true;
  } else {
    ex.imageSmoothingEnabled = false;
  }

  ex.fillStyle = bgColor.value;
  ex.fillRect(0, 0, exportWidth, exportHeight);
  ex.imageSmoothingEnabled = false;

  if (exportTitle) {
    ex.fillStyle = '#5e4b3c';
    const titleFontSize = Math.round(18 * TITLE_SCALE);
    ex.font = `bold ${titleFontSize}px "Segoe UI", sans-serif`;
    ex.textAlign = 'left';
    ex.textBaseline = 'middle';
    ex.fillText(`${artworkName}  [${imageWidth}×${imageHeight} / ${colorKind}色 / 共${totalCount}颗]`, 15 * TITLE_SCALE, headerHeight / 2);
  }

  ex.save();
  ex.translate(COORD_BORDER, (exportTitle ? headerHeight : 0) + COORD_BORDER);
  ex.scale(effectivePixelSize / ps, effectivePixelSize / ps);
  ex.drawImage(displayImage, 0, 0);

  if (exportGrid) {
    const ms = GRID_BASE_MAJOR, mis = GRID_BASE_MINOR, gridPs = ps;
    ex.strokeStyle = 'rgba(180,170,160,0.1)';
    ex.lineWidth = 0.05;
    ex.setLineDash([]);
    for (let x = 0; x <= imageWidth; x += gridPs) {
      ex.beginPath();
      ex.moveTo(x, 0);
      ex.lineTo(x, imageHeight);
      ex.stroke();
    }
    for (let y = 0; y <= imageHeight; y += gridPs) {
      ex.beginPath();
      ex.moveTo(0, y);
      ex.lineTo(imageWidth, y);
      ex.stroke();
    }
    ex.save();
    ex.strokeStyle = gridColor.value;
    ex.lineWidth = 0.08;
    ex.setLineDash([0.3, 0.3]);
    for (let x = mis * gridPs; x < imageWidth; x += ms * gridPs) {
      ex.beginPath();
      ex.moveTo(x, 0);
      ex.lineTo(x, imageHeight);
      ex.stroke();
    }
    for (let y = mis * gridPs; y < imageHeight; y += ms * gridPs) {
      ex.beginPath();
      ex.moveTo(0, y);
      ex.lineTo(imageWidth, y);
      ex.stroke();
    }
    ex.restore();
    ex.strokeStyle = gridColor.value;
    ex.lineWidth = 0.05;
    ex.setLineDash([]);
    for (let x = 0; x <= imageWidth; x += ms * gridPs) {
      ex.beginPath();
      ex.moveTo(x, 0);
      ex.lineTo(x, imageHeight);
      ex.stroke();
    }
    for (let y = 0; y <= imageHeight; y += ms * gridPs) {
      ex.beginPath();
      ex.moveTo(0, y);
      ex.lineTo(imageWidth, y);
      ex.stroke();
    }
  }

  if (exportColorCode && colorCodeMap && palette) {
    ex.font = '0.5px Consolas, monospace';
    ex.textAlign = 'center';
    ex.textBaseline = 'middle';
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const code = colorCodeMap[y * imageWidth + x];
        if (!code) continue;
        const ci = palette.find((c) => c.code === code);
        ex.fillStyle = '#000';
        if (ci) {
          const br = (ci.r * 299 + ci.g * 587 + ci.b * 114) / 1000;
          ex.fillStyle = br < 128 ? '#fff' : '#000';
        }
        ex.fillText(code, x + 0.5, y + 0.5);
      }
    }
  }

  if (exportAuthor && authorName) {
    ex.save();
    ex.beginPath();
    ex.rect(0, 0, imageWidth, imageHeight);
    ex.clip();

    ex.strokeStyle = 'rgba(192, 192, 192, 0.3)';
    ex.lineWidth = 0.1;
    ex.setLineDash([0.3, 0.3]);
    const diagonalSpacing = 10 * ps;
    const diagW = Math.sqrt(imageWidth * imageWidth + imageHeight * imageHeight);

    ex.save();
    ex.translate(imageWidth / 2, imageHeight / 2);
    ex.rotate(Math.PI / 4);
    for (let i = -diagW / 2; i < diagW / 2; i += diagonalSpacing) {
      ex.beginPath();
      ex.moveTo(i, -diagW);
      ex.lineTo(i, diagW);
      ex.stroke();
    }
    ex.restore();

    ex.save();
    ex.translate(imageWidth / 2, imageHeight / 2);
    ex.rotate(-Math.PI / 4);
    for (let i = -diagW / 2; i < diagW / 2; i += diagonalSpacing) {
      ex.beginPath();
      ex.moveTo(i, -diagW);
      ex.lineTo(i, diagW);
      ex.stroke();
    }
    ex.restore();

    ex.font = `${0.8 * ps}px "Segoe UI", sans-serif`;
    ex.fillStyle = 'rgba(140, 140, 140, 0.6)';
    ex.textAlign = 'center';
    ex.textBaseline = 'middle';

    const text = authorName;

    ex.save();
    ex.translate(imageWidth / 2, imageHeight / 2);
    ex.rotate(Math.PI / 4);

    const textWidth = ex.measureText(text).width + 6 * ps;

    for (let i = -diagW / 2; i < diagW / 2; i += diagonalSpacing * 2) {
      for (let j = -diagW / 2; j < diagW / 2; j += textWidth) {
        ex.save();
        ex.translate(i, j);
        ex.rotate(-Math.PI / 4);
        ex.fillText(text, 0, 0);
        ex.restore();
      }
    }

    ex.restore();
    ex.restore();
  }

  ex.restore();

  const coordFontSize = Math.max(8, 0.5 * effectivePixelSize / ps);
  if (exportGrid) {
    ex.font = `${coordFontSize}px Consolas, monospace`;
    ex.textAlign = 'center';
    ex.textBaseline = 'middle';
    for (let x = 0; x < imageWidth; x += ps) {
      const sx = COORD_BORDER + x * effectivePixelSize + effectivePixelSize / 2;
      const sy = (exportTitle ? headerHeight : 0) + COORD_BORDER / 2;
      ex.fillStyle = '#aaa';
      ex.fillRect(sx - effectivePixelSize / 2, exportTitle ? headerHeight : 0, effectivePixelSize, COORD_BORDER);
      ex.fillStyle = '#000';
      ex.fillText(`${x + 1}`, sx, sy);
    }
    for (let x = 0; x < imageWidth; x += ps) {
      const sx = COORD_BORDER + x * effectivePixelSize + effectivePixelSize / 2;
      const sy = (exportTitle ? headerHeight : 0) + imgExportHeight + COORD_BORDER + COORD_BORDER / 2;
      ex.fillStyle = '#aaa';
      ex.fillRect(sx - effectivePixelSize / 2, (exportTitle ? headerHeight : 0) + imgExportHeight + COORD_BORDER, effectivePixelSize, COORD_BORDER);
      ex.fillStyle = '#000';
      ex.fillText(`${x + 1}`, sx, sy);
    }
    for (let y = 0; y < imageHeight; y += ps) {
      const sx = COORD_BORDER / 2;
      const sy = (exportTitle ? headerHeight : 0) + COORD_BORDER + y * effectivePixelSize + effectivePixelSize / 2;
      ex.fillStyle = '#aaa';
      ex.fillRect(0, sy - effectivePixelSize / 2, COORD_BORDER, effectivePixelSize);
      ex.fillStyle = '#000';
      ex.fillText(`${y + 1}`, sx, sy);
    }
    for (let y = 0; y < imageHeight; y += ps) {
      const sx = COORD_BORDER + imgExportWidth + COORD_BORDER / 2;
      const sy = (exportTitle ? headerHeight : 0) + COORD_BORDER + y * effectivePixelSize + effectivePixelSize / 2;
      ex.fillStyle = '#aaa';
      ex.fillRect(COORD_BORDER + imgExportWidth, sy - effectivePixelSize / 2, COORD_BORDER, effectivePixelSize);
      ex.fillStyle = '#000';
      ex.fillText(`${y + 1}`, sx, sy);
    }
  }

  if (exportColorCode && colorCodeMap && palette) {
    const footerY = (exportTitle ? headerHeight : 0) + COORD_BORDER * 2 + imgExportHeight;
    let tagX = 15 * STAT_SCALE, tagY = footerY + 5 * STAT_SCALE;

    for (const [code, count] of sorted) {
      const ci = palette.find((c) => c.code === code);
      const colorHex = ci
        ? `#${ci.r.toString(16).padStart(2, '0')}${ci.g.toString(16).padStart(2, '0')}${ci.b.toString(16).padStart(2, '0')}`
        : '#ccc';
      const countText = `${count}`;

      ex.font = `bold ${fontSize}px Consolas, monospace`;
      const codeWidth = ex.measureText(code).width + 10 * STAT_SCALE;
      const countWidth = ex.measureText(countText).width + 10 * STAT_SCALE;
      const tagWidth = codeWidth + countWidth;

      if (tagX + tagWidth > exportWidth - 20 * STAT_SCALE) {
        tagX = 15 * STAT_SCALE;
        tagY += lineHeight;
      }

      ex.fillStyle = bgColor.value;
      ex.strokeStyle = '#ccc';
      ex.lineWidth = 1 * STAT_SCALE;
      ex.fillRect(tagX, tagY, tagWidth, tagHeight);
      ex.strokeRect(tagX, tagY, tagWidth, tagHeight);

      ex.fillStyle = colorHex;
      ex.fillRect(tagX, tagY, codeWidth, tagHeight);

      const br = ci ? (ci.r * 299 + ci.g * 587 + ci.b * 114) / 1000 : 255;
      ex.fillStyle = br < 128 ? '#fff' : '#000';
      ex.textBaseline = 'middle';
      ex.textAlign = 'center';
      ex.fillText(code, tagX + codeWidth / 2, tagY + tagHeight / 2);

      ex.fillStyle = '#333';
      ex.fillText(countText, tagX + codeWidth + countWidth / 2, tagY + tagHeight / 2);

      tagX += tagWidth + gap;
    }
  }

  ec.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${artworkName}.png`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function handleMouseDown(e) {
  if (!displayImage) return;
  isDragging.value = true;
  isGrabbing.value = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartOffsetX = offsetX.value;
  dragStartOffsetY = offsetY.value;
  e.preventDefault();
}

function handleMouseMove(e) {
  if (!displayImage) return;
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
  if (!displayImage) return;
  updateCoordinateDisplay(e);
}

function handleTouchMove(e) {
  if (!displayImage) return;
  updateCoordinateDisplay(e);
}

function handleWheel(e) {
  if (!displayImage) return;
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
  if (!displayImage) {
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
    const idx = row * imageWidth + col;
    const code = colorCodeMap ? colorCodeMap[idx] : null;
    coordText.value = code ? `${col + 1},${row + 1} #${code}` : `${col + 1},${row + 1}`;
  } else {
    coordText.value = '— , —';
  }
}

function updateStatsBar() {
  if (!colorCodeMap || colorCodeMap.length === 0 || colorMode.value === 'original') {
    statsTotal.value = '—';
    sortedStats.value = [];
    return;
  }
  const colorCount = {};
  let total = 0;
  for (const code of colorCodeMap) {
    if (code) {
      colorCount[code] = (colorCount[code] || 0) + 1;
      total++;
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
      return { code, count, colorHex };
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
      saveSettings({ bgColor: bgColor.value, gridColor: gridColor.value, showGrid: showGrid.value });
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
  if (!colorCodeMap || colorCodeMap.length === 0) return;
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
      const code = colorCodeMap[y * imageWidth + x];
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
      if (colorCodeMap[y * imageWidth + x] !== target) continue;
      const top = y > 0 && colorCodeMap[(y - 1) * imageWidth + x] === target;
      const bottom = y < imageHeight - 1 && colorCodeMap[(y + 1) * imageWidth + x] === target;
      const left = x > 0 && colorCodeMap[y * imageWidth + (x - 1)] === target;
      const right = x < imageWidth - 1 && colorCodeMap[y * imageWidth + (x + 1)] === target;

      if (!top) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y); ctx.stroke(); }
      if (!bottom) { ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + 1, y + 1); ctx.stroke(); }
      if (!left) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 1); ctx.stroke(); }
      if (!right) { ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + 1); ctx.stroke(); }
    }
  }

  ctx.restore();
}

function toggleGrid() {
  showGrid.value = !showGrid.value;
  redrawCanvas();
  saveSettings({ bgColor: bgColor.value, gridColor: gridColor.value, showGrid: showGrid.value });
}


function pixelChange(){
  imageImporterRef.value?.setupCropper(originalImage.toDataURL());
}

function onBgColorInput(e) {
  bgColor.value = e.target.value;
  redrawCanvas();
  saveSettings({ bgColor: bgColor.value, gridColor: gridColor.value, showGrid: showGrid.value });
}

function onGridColorInput(e) {
  gridColor.value = e.target.value;
  redrawCanvas();
  saveSettings({ bgColor: bgColor.value, gridColor: gridColor.value, showGrid: showGrid.value });
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
  if (!displayImage) {
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
  if (!displayImage) return;
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
  if (!displayImage) return;
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

const onExportClick = () => {
  exportModalVisible.value = true;
};
const onExportConfirm = ({ artworkName, authorName, exportTitle, exportAuthor, exportGrid, exportColorCode }) => {
  exportModalVisible.value = false;
  exportImage(artworkName, authorName, exportTitle, exportAuthor, exportGrid, exportColorCode);
};

function onCanvasClick(e) {
  if (!displayImage || !canvasRef.value) return;
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
  }
}

function onRowColConfirm({ type, index, direction, operation, count }) {
  rowColModalData.value.visible = false;
  originalImage = rowColChange(originalImage, type, index, direction, operation, count)
  processImageWithPalette()
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
</script>

<style src="./BeadsEditor.css" scoped></style>
