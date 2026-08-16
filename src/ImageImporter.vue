<template>
  <div class="image-importer">
    <input
        type="file"
        ref="fileInputRef"
        accept="image/png, image/webp, image/jpeg, image/gif"
        style="display:none"
        @change="onFileChange"
    >

    <BaseModal
        title="通过URL导入图片"
        :visible="urlModalVisible"
        width="400px"
        :overlay-opacity="0.7"
        @cancel="urlModalVisible = false"
    >
      <div class="url-form">
        <div class="form-row">
          <input type="text" v-model="urlInput" placeholder="请输入图片URL" />
        </div>
        <div class="url-tip">支持 JPG、PNG、WebP、GIF 格式</div>
      </div>
      <template #footer>
        <button class="btn cancel" @click="urlModalVisible = false">取消</button>
        <button class="btn confirm" :disabled="loading || !urlInput.trim()" @click="handleUrlImport">
          <i v-if="loading" class="iconfont icon-spinner"></i>
          <span>{{ loading ? '导入中' : '导入' }}</span>
        </button>
      </template>
    </BaseModal>

    <BaseModal
        :visible="cropState.cropModalOpen"
        bare
        width="99vw"
        max-width="800px"
        height="99vh"
        max-height="800px"
        :overlay-opacity="0.7"
    >

        <!-- ========== Step 1: 裁剪 头部+底部 ========== -->
        <template v-if="step === 'crop'">
          <div class="crop-header">
            <div class="crop-header-row">
              <div>
                <div>Step1 裁剪</div>
              </div>
            </div>
          </div>
        </template>

        <!-- ========== Step 2: 压缩 头部+底部 ========== -->
        <template v-if="step === 'compress'">
          <div class="crop-header">
            <div class="crop-header-row">
              <div>
                <div>Step2 缩放</div>
                <div v-if="exceedsMaxPixels" class="pixel-limit-warn">超过100万像素，请降低像素比例</div>
              </div>
              <div class="pixel-scale-control" v-if="selectedScale < 1">
                <label class="scale-label" for="algorithm-select">压缩算法:</label>
                <select v-model="compressionAlgorithm" id="algorithm-select" @change="() => scaleDraw()">
                  <option value="avg">均值算法</option>
                  <option value="median">中位数算法</option>
                  <option value="sample">采样算法</option>
                </select>
              </div>
            </div>
          </div>
        </template>

        <!-- 画布容器 -->
        <div ref="cropContainerRef" class="crop-container">
          <canvas ref="cropCanvasRef" class="crop-canvas"></canvas>
        </div>

        <!-- 底部按钮 -->
        <template v-if="step === 'crop' || step === 'compress'">
          <div class="crop-footer">
            <div class="scale-fields">
              <div class="scale-field">
                <label>尺寸</label>
                <div class="scale-cell">
                  <select v-model="scaleFormSizeSelect" class="scale-select">
                    <option v-for="opt in scaleFormOptions" :key="opt.key" :value="opt.value">{{ opt.label }}</option>
                  </select>
                </div>
              </div>
              <div class="scale-field">
                <label>缩放</label>
                <div class="scale-cell">
                  <button class="scale-btn" @click="scaleFormRatioDown" :disabled="!canScaleFormRatioDown" title="÷2">-</button>
                  <input type="number" min="0.01" step="0.01" v-model.number="scaleFormRatio" @input="onScaleRatioInput" />
                  <button class="scale-btn" @click="scaleFormRatioUp" :disabled="!canScaleFormRatioUp" title="×2">+</button>
                </div>
              </div>
              <div class="scale-field">
                <label>宽</label>
                <div class="scale-cell">
                  <button class="scale-btn" @click="scaleFormWidthDown" title="-1">-</button>
                  <input type="number" min="1" step="1" v-model.number="scaleFormWidth" @input="onScaleWidthInput" />
                  <button class="scale-btn" @click="scaleFormWidthUp" title="+1">+</button>
                </div>
              </div>
              <div class="scale-field">
                <label>高</label>
                <div class="scale-cell">
                  <button class="scale-btn" @click="scaleFormHeightDown" title="-1">-</button>
                  <input type="number" min="1" step="1" v-model.number="scaleFormHeight" @input="onScaleHeightInput" />
                  <button class="scale-btn" @click="scaleFormHeightUp" title="+1">+</button>
                </div>
              </div>
            </div>
            <div class="crop-buttons">
              <div class="crop-buttons">
                <button class="crop-btn cancel" @click="onCancel"><i class="iconfont icon-times"></i></button>
                <button class="crop-btn" :class="{active: showGrid}" @click="toggleGrid">
                  <i class="iconfont icon-wangge"></i>
                </button>
                <template v-if="step === 'crop'">
                  <button class="crop-btn" :class="{active: !selection}" @click="clearSelection"><i
                      class="iconfont icon-crop-alt"></i></button>
                  <button class="crop-btn" @click="fixCropBoundary()"><i class="iconfont icon-compress"></i></button>
                  <button class="crop-btn" @click="onCropImportOriginal"><i class="iconfont icon-expand"></i></button>
                </template>
              </div>
              <div class="crop-buttons">
                <button v-if="step === 'compress'" class="crop-btn" @click="goBackToCrop">上一步</button>
                <button class="crop-btn confirm" v-if="step === 'crop' && !loading" @click="onCropConfirm">
                  <i class="iconfont icon-check"></i>
                </button>
                <button class="crop-btn confirm" v-if="step === 'crop' && loading"><i class="iconfont icon-spinner"></i></button>
                <button class="crop-btn confirm" v-if="step === 'compress' && !loading" @click="onCompressConfirm">
                  <i class="iconfont icon-check"></i>
                </button>
                <button class="crop-btn confirm" v-if="step === 'compress' && loading"><i class="iconfont icon-spinner"></i></button>
              </div>
            </div>
          </div>
        </template>

    </BaseModal>
  </div>
</template>

<script setup>
import {reactive, ref, computed, nextTick, getCurrentInstance, watch} from 'vue';
import BaseModal from './BaseModal.vue';
import {createCanvasFromImage} from "./util/canvasUtil";
import {rgba2int} from "./palette";
import {CustomCropper} from "./util/CustomCropper";
import {loadImage} from "./util/imageUtil";

const MAX_PIXEL = 1000000;

function extractSourceFromPattern(img) {
  const canvas = img instanceof HTMLCanvasElement ? img : createCanvasFromImage(img);
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  if (height < 20) return null;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let sourceStartY = -1, parsedW = 0, parsedH = 0;
  let headerSize = 4;

  for (let y = height - 1; y >= Math.floor(height * 0.5); y--) {
    const idx0 = y * width * 4;

    const r0 = data[idx0], g0 = data[idx0 + 1], b0 = data[idx0 + 2], a0 = data[idx0 + 3];
    const r1 = data[idx0 + 4], g1 = data[idx0 + 5], b1 = data[idx0 + 6], a1 = data[idx0 + 7];

    if (r0 === 1 && g0 === 1 && b0 === 0 && a0 === 255 && r1 === 2 && g1 === 2 && b1 === 0 && a1 === 255) {
      const wLow = data[idx0 + 8], wHigh = data[idx0 + 9];
      const hLow = data[idx0 + 12], hHigh = data[idx0 + 13];
      const w = wLow + (wHigh << 8);
      const h = hLow + (hHigh << 8);
      if (w > 0 && h > 0 && w <= 10000 && h <= 10000 && w * h < 10000000) {
        let nonWhite = 0;
        for (let checkY = y; checkY < Math.min(y + 3, height); checkY++) {
          for (let x = 0; x < Math.min(width, 100); x++) {
            const idx = (checkY * width + x) * 4;
            if (data[idx] < 240 || data[idx + 1] < 240 || data[idx + 2] < 240) nonWhite++;
          }
        }
        if (nonWhite > 10) {
          sourceStartY = y;
          parsedW = w;
          parsedH = h;
          headerSize = 4;
          break;
        }
      }
    }
  }

  if (sourceStartY === -1 || parsedW === 0 || parsedH === 0) {
    return null;
  }

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = parsedW;
  sourceCanvas.height = parsedH;
  const sourceCtx = sourceCanvas.getContext('2d');

  const totalPixels = parsedW * parsedH;
  const stripWidth = width;
  const destImageData = sourceCtx.createImageData(parsedW, parsedH);
  const destData = destImageData.data;
  for (let i = 0; i < totalPixels; i++) {
    const stripPixelIdx = headerSize + i;
    const stripRow = Math.floor(stripPixelIdx / stripWidth);
    const stripCol = stripPixelIdx % stripWidth;
    const srcIdx = ((sourceStartY + stripRow) * width + stripCol) * 4;
    const dstIdx = i * 4;
    destData[dstIdx] = data[srcIdx];
    destData[dstIdx + 1] = data[srcIdx + 1];
    destData[dstIdx + 2] = data[srcIdx + 2];
    destData[dstIdx + 3] = data[srcIdx + 3];
  }
  sourceCtx.putImageData(destImageData, 0, 0);

  return sourceCanvas;
}

const {proxy} = getCurrentInstance();
const props = defineProps({
  onImageLoaded: {
    type: Function,
    required: true
  }
});

const fileInputRef = ref(null);
const cropContainerRef = ref(null);
const cropCanvasRef = ref(null);
const originImageData = ref(null)
let currentFileName = null;

const selectedScale = ref(1);
const showGrid = ref(false);
const cropWidth = ref(0);
const cropHeight = ref(0);
const initialCoverage = ref(1)
const compressionAlgorithm = ref('median');
const loading = ref(false);
const step = ref('crop');
const preCropState = ref(null);
const selection = ref();
const urlModalVisible = ref(false);
const urlInput = ref('');

function loadSettings() {
  try {
    const raw = localStorage.getItem('pixelArtSettings');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

const settings = loadSettings();
const gridColor = ref(settings?.gridColor || '#ff0000');

// 缩放设置弹窗状态
const scaleFormWidth = ref(0);
const scaleFormHeight = ref(0);
const scaleFormRatio = ref(1);

// 快速缩放步长因子
const SCALE_STEP = 2;

// 基础尺寸（缩放的基准）：裁剪步骤取选区，压缩步骤取原图数据
const baseSize = computed(() => {
  let cw = originImageData.value?.width || 0;
  let ch = originImageData.value?.height || 0;
  if (step.value === 'crop' && selection.value?.width && selection.value?.height) {
    cw = selection.value.width;
    ch = selection.value.height;
  }
  return {width: cw, height: ch};
});

// 整数倍档位选项（基于 baseSize）
const scaleOptions = computed(() => {
  const cw = baseSize.value.width;
  const ch = baseSize.value.height;
  const options = [{value: 1, key: 1, label: `${cw}×${ch}\t1x`}];
  if (!cw || !ch) return options;
  let lastOwOh = null;
  for (let i = 2; cw / i >= 1 && ch / i >= 1; i++) {
    const ow = Math.round(cw / i);
    const oh = Math.round(ch / i);
    const owOh = `${ow}×${oh}`;
    if (owOh === lastOwOh) continue;
    const scale = cw / ow;
    options.push({value: 1 / scale, key: 1 / i, label: `${ow}×${oh}\t1/${i}x`});
    lastOwOh = owOh;
  }
  for (let i = 2; cw * i * ch * i < MAX_PIXEL; i++) {
    const ow = cw * i;
    const oh = ch * i;
    options.push({value: i, key: i, label: `${ow}×${oh}\t${i}x`});
  }
  options.sort((a, b) => b.value - a.value);
  return options;
});

// 尺寸下拉固定选项（基于 baseSize 的整数倍档位）
const scaleFormOptions = computed(() => {
  const opts = scaleOptions.value.slice();
  // 固定的"自定义"选项，用于当前比率不在档位中时展示
  opts.push({value: 'custom', key: 'custom', label: '自定义'});
  return opts;
});

// 尺寸下拉绑定的值：当前比率命中档位则返回该档位 value，否则返回 'custom'
const scaleFormSizeSelect = computed({
  get() {
    const r = scaleFormRatio.value;
    if (!r || r <= 0) return 'custom';
    const hit = scaleOptions.value.find(opt => Math.abs(opt.value - r) < 0.001);
    return hit ? hit.value : 'custom';
  },
  set(v) {
    if (v === 'custom') return; // 选择自定义时不改变当前比率
    scaleFormRatio.value = Number(v);
    onScaleRatioInput();
  }
});

// 比率 +-：按 scaleOptions 档位上下切换（档位已按 value 降序排列）
const canScaleFormRatioUp = computed(() => {
  const opts = scaleOptions.value;
  if (!opts.length) return false;
  // 存在比当前比率更大的档位即可放大
  return opts.some(opt => opt.value > scaleFormRatio.value + 0.0001);
});

const canScaleFormRatioDown = computed(() => {
  const opts = scaleOptions.value;
  if (!opts.length) return false;
  // 存在比当前比率更小的档位即可缩小
  return opts.some(opt => opt.value < scaleFormRatio.value - 0.0001);
});

function scaleFormRatioUp() {
  if (!canScaleFormRatioUp.value) return;
  const opts = scaleOptions.value;
  // 取大于当前比率的最小档位（即上一档）
  const next = opts
      .filter(opt => opt.value > scaleFormRatio.value + 0.0001)
      .reduce((a, b) => (a.value < b.value ? a : b));
  scaleFormRatio.value = Number(next.value.toFixed(6));
  onScaleRatioInput();
}

function scaleFormRatioDown() {
  if (!canScaleFormRatioDown.value) return;
  const opts = scaleOptions.value;
  // 取小于当前比率的最大档位（即下一档）
  const next = opts
      .filter(opt => opt.value < scaleFormRatio.value - 0.0001)
      .reduce((a, b) => (a.value > b.value ? a : b));
  scaleFormRatio.value = Number(next.value.toFixed(6));
  onScaleRatioInput();
}

// 宽度 +-（每次±1）
function scaleFormWidthUp() {
  scaleFormWidth.value = parseInt(scaleFormWidth.value || 0) + 1;
  onScaleWidthInput();
}

function scaleFormWidthDown() {
  scaleFormWidth.value = Math.max(1, parseInt(scaleFormWidth.value || 1) - 1);
  onScaleWidthInput();
}

// 高度 +-（每次±1）
function scaleFormHeightUp() {
  scaleFormHeight.value = parseInt(scaleFormHeight.value || 0) + 1;
  onScaleHeightInput();
}

function scaleFormHeightDown() {
  scaleFormHeight.value = Math.max(1, parseInt(scaleFormHeight.value || 1) - 1);
  onScaleHeightInput();
}

function formatScale(r) {
  if (!r) return '1';
  const absR = Math.abs(r - 1);
  if (absR < 0.001) return '1';
  if (r > 1) {
    return Number(r.toFixed(3)).toString();
  }
  return '1/' + Number((1 / r).toFixed(3)).toString();
}

// 当 selectedScale 或 baseSize 外部变化时（如重置、选区改变），同步表单值
watch([selectedScale, baseSize], () => {
  const {width: bw, height: bh} = baseSize.value;
  if (!bw || !bh) return;
  const newWidth = Math.round(bw * selectedScale.value);
  const newHeight = Math.round(bh * selectedScale.value);
  const newRatio = Number(selectedScale.value.toFixed(4));
  // 避免与用户正在输入的值冲突，仅在不一致时更新
  if (scaleFormWidth.value !== newWidth) scaleFormWidth.value = newWidth;
  if (scaleFormHeight.value !== newHeight) scaleFormHeight.value = newHeight;
  if (Math.abs(scaleFormRatio.value - newRatio) > 0.0001) scaleFormRatio.value = newRatio;
});

// 实时应用缩放到画布
function applyScalePreview() {
  const r = parseFloat(scaleFormRatio.value);
  if (!r || r <= 0) return;
  if (scaleFormWidth.value * scaleFormHeight.value > MAX_PIXEL) return;
  selectedScale.value = r;
  if (step.value === 'crop') {
    updateCropGrid();
  } else {
    scaleDraw();
  }
}

function onScaleWidthInput() {
  const {width: bw, height: bh} = baseSize.value;
  if (!bw || !bh) return;
  const w = parseFloat(scaleFormWidth.value);
  if (!w || w <= 0) return;
  scaleFormHeight.value = Math.max(1, Math.round(w / bw * bh));
  scaleFormRatio.value = Number((w / bw).toFixed(4));
  applyScalePreview();
}

function onScaleHeightInput() {
  const {width: bw, height: bh} = baseSize.value;
  if (!bw || !bh) return;
  const h = parseFloat(scaleFormHeight.value);
  if (!h || h <= 0) return;
  scaleFormWidth.value = Math.max(1, Math.round(h / bh * bw));
  scaleFormRatio.value = Number((h / bh).toFixed(4));
  applyScalePreview();
}

function onScaleRatioInput() {
  const {width: bw, height: bh} = baseSize.value;
  if (!bw || !bh) return;
  const r = parseFloat(scaleFormRatio.value);
  if (!r || r <= 0) return;
  scaleFormWidth.value = Math.max(1, Math.round(bw * r));
  scaleFormHeight.value = Math.max(1, Math.round(bh * r));
  applyScalePreview();
}

function updateCropGrid() {
  const cropper = cropState.cropper;
  if (cropper) {
    const ps = selectedScale.value;
    const selW = selection.value?.width;
    const selH = selection.value?.height;
    const srcW = selW || cropper.imageWidth;
    const srcH = selH || cropper.imageHeight;
    const targetW = Math.max(1, Math.round(srcW * ps));
    const targetH = Math.max(1, Math.round(srcH * ps));
    // 网格单元 = 总宽/目标宽，总高/目标高，可能是小数，确保平分
    cropper.setGridCellSize(srcW / targetW, srcH / targetH);
  }
  updateCropSize();
}

const hasSelection = ref(true)

const totalPixels = computed(() => cropWidth.value * cropHeight.value);
const exceedsMaxPixels = computed(() => totalPixels.value > MAX_PIXEL);

const cropState = reactive({
  cropModalOpen: false,
  cropImageSrc: '',
  originImageSrc: '',
  cropper: null
});

function updateCropSize() {
  const cropper = cropState.cropper;
  if (!cropper) return;

  if (step.value === 'crop') {
    const ps = selectedScale.value;
    const selWidth = selection.value?.width;
    const selHeight = selection.value?.height;

    if (selWidth && selHeight) {
      cropWidth.value = Math.round(selWidth * ps);
      cropHeight.value = Math.round(selHeight * ps);
    } else {
      cropWidth.value = Math.round(cropper.imageWidth * ps);
      cropHeight.value = Math.round(cropper.imageHeight * ps);
    }
  } else {
    if (originImageData.value) {
      const ps = selectedScale.value;
      cropWidth.value = Math.round(originImageData.value.width * ps);
      cropHeight.value = Math.round(originImageData.value.height * ps);
    } else {
      cropWidth.value = cropper.imageWidth;
      cropHeight.value = cropper.imageHeight;
    }
  }
}

function scaleDraw() {
  const ps = selectedScale.value;

  const srcData = originImageData.value;
  const srcW = srcData.width;
  const srcH = srcData.height;
  const imageWidth = Math.round(srcW * ps);
  const imageHeight = Math.round(srcH * ps);

  if (step.value === 'crop') {
    const {x, y, width, height} = getSelectedRect()
    setSelectionRect(x, y, width, height)
  }

  const dc = document.createElement('canvas');
  dc.width = imageWidth;
  dc.height = imageHeight;
  const dctx = dc.getContext('2d');
  dctx.imageSmoothingEnabled = false;

  if (ps >= 1) {
    // 与网格一致：每个目标像素对应源区间 [destX*stepX, (destX+1)*stepX)，取该区间内的源像素
    const stepX = srcW / imageWidth;
    const stepY = srcH / imageHeight;
    const dstData = dctx.createImageData(imageWidth, imageHeight);
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const srcX = Math.min(Math.floor(x * stepX), srcW - 1);
        const srcY = Math.min(Math.floor(y * stepY), srcH - 1);
        const si = (srcY * srcW + srcX) * 4;
        const di = (y * imageWidth + x) * 4;
        dstData.data[di] = srcData.data[si];
        dstData.data[di + 1] = srcData.data[si + 1];
        dstData.data[di + 2] = srcData.data[si + 2];
        dstData.data[di + 3] = srcData.data[si + 3];
      }
    }
    dctx.putImageData(dstData, 0, 0);
  } else {
    // 与网格一致：每个目标像素对应的源范围按总宽/目标宽均匀切分
    const stepX = srcW / imageWidth;
    const stepY = srcH / imageHeight;
    const dstData = dctx.createImageData(imageWidth, imageHeight);
    const sampleSize = 7
    for (let destY = 0; destY < imageHeight; destY++) {
      for (let destX = 0; destX < imageWidth; destX++) {
        // 用 round 让相邻区间无缝衔接，每个源像素只归属一个目标像素
        let startX = Math.round(destX * stepX);
        let startY = Math.round(destY * stepY);
        let endX = Math.min(Math.round((destX + 1) * stepX), srcW);
        let endY = Math.min(Math.round((destY + 1) * stepY), srcH);
        // 保证至少采样一个像素
        if (endX <= startX) endX = startX + 1;
        if (endY <= startY) endY = startY + 1;
        const samplePxSize = Math.max(Math.round((Math.min(endX - startX, endY - startY)) / sampleSize + 2), 1)
        const blockPixels = [];
        if (samplePxSize >= 3) {
          startX++;
          startY++;
          endX--;
          endY--;
        }
        for (let y = startY; y < endY; y+=samplePxSize) {
          for (let x = startX; x < endX; x+=samplePxSize) {
            const idx = (y * srcW + x) * 4;
            blockPixels.push(rgba2int(srcData.data[idx], srcData.data[idx + 1], srcData.data[idx + 2], srcData.data[idx + 3]));
          }
        }
        let result = blockPixels[0];
        if (compressionAlgorithm.value === 'avg') {
          let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
          for (const p of blockPixels) {
            sumR += (p >> 24) & 0xFF;
            sumG += (p >> 16) & 0xFF;
            sumB += (p >> 8) & 0xFF;
            sumA += p & 0xFF;
          }
          const avgR = sumR / blockPixels.length, avgG = sumG / blockPixels.length, avgB = sumB / blockPixels.length;
          let minDist = Infinity;
          for (const p of blockPixels) {
            const d = (((p >> 24) & 0xFF) - avgR) ** 2 + (((p >> 16) & 0xFF) - avgG) ** 2
                + (((p >> 8) & 0xFF) - avgB) ** 2
                + Math.abs((p & 0xFF) - sumA / blockPixels.length) / 255;
            if (d < minDist) {
              minDist = d;
              result = p;
            }
          }
        } else if (compressionAlgorithm.value === 'median') {
          const rVals = blockPixels.map(p => (p >> 24) & 0xFF).sort((a, b) => a - b);
          const gVals = blockPixels.map(p => (p >> 16) & 0xFF).sort((a, b) => a - b);
          const bVals = blockPixels.map(p => (p >> 8) & 0xFF).sort((a, b) => a - b);
          const aVals = blockPixels.map(p => p & 0xFF).sort((a, b) => a - b);
          const mid = Math.floor(blockPixels.length / 2);
          result = rgba2int(rVals[mid], gVals[mid], bVals[mid], aVals[mid]);
        } else {
          const count = {};
          for (const p of blockPixels) {
            count[p] = (count[p] || 0) + 1;
          }
          let maxCount = 0;
          let result = blockPixels[0];
          for (const p in count) {
            if (count[p] > maxCount) {
              maxCount = count[p];
              result = Number(p); // 因为 key 是字符串，转回数字
            }
          }
        }
        const di = (destY * imageWidth + destX) * 4;
        dstData.data[di] = (result >> 24) & 0xFF;
        dstData.data[di + 1] = (result >> 16) & 0xFF;
        dstData.data[di + 2] = (result >> 8) & 0xFF;
        dstData.data[di + 3] = result & 0xFF;
      }
    }
    dctx.putImageData(dstData, 0, 0);
  }

  cropState.cropImageSrc = dc.toDataURL();
  cropWidth.value = imageWidth;
  cropHeight.value = imageHeight;

  if (step.value === 'compress' && cropState.cropper) {
    cropState.cropper.loadImage(cropState.cropImageSrc).then(() => {
      // 裁剪完毕，图片已被压缩，每个单元格一个像素
      cropState.cropper.setGridCellSize(1, 1);
      cropState.cropper.center(0.8);
    });
  }

  return dc;
}

async function initCropper() {
  if (cropState.cropper) {
    await cropState.cropper.loadImage(cropState.cropImageSrc);
    resetView();
    updateCropGrid();
    return;
  }

  cropState.cropper = new CustomCropper(cropCanvasRef.value, {
    container: cropContainerRef.value,
    showGrid: showGrid.value,
    gridColor: gridColor.value,
    gridCellW: 1 / selectedScale.value,
    gridCellH: 1 / selectedScale.value,
    onSelectionChange(newValue) {
      selection.value = newValue
      updateCropGrid();
    }
  });

  await cropState.cropper.loadImage(cropState.cropImageSrc);

  const originalImage = await loadImage(cropState.cropImageSrc);
  const oc = createCanvasFromImage(originalImage);
  const octx = oc.getContext('2d');
  originImageData.value = octx.getImageData(0, 0, oc.width, oc.height);


  setTimeout(() => {
    fixCropBoundary();
  }, 10);

  updateCropGrid();
}

function clearSelection() {
  if (cropState.cropper) {
    cropState.cropper.clearSelection();
  }
}

function toggleGrid() {
  showGrid.value = !showGrid.value;
  if (cropState.cropper) {
    cropState.cropper.showGrid = showGrid.value;
    cropState.cropper.render();
  }
}

function destroyCropper() {
  if (cropState.cropper) {
    cropState.cropper.destroy();
    cropState.cropper = null;
  }
}

function setupCropper(imageDataUrl, _initialCoverage = 0.8) {
  cropState.originImageSrc = imageDataUrl;
  cropState.cropImageSrc = imageDataUrl;
  cropState.cropModalOpen = true;
  originImageData.value = null;
  selectedScale.value = 1;
  initialCoverage.value = _initialCoverage;

  nextTick(() => {
    initCropper();
  });
}

async function loadImageFromFile(file) {
  if (!file) return;
  currentFileName = file.name.replace(/\.[^/.]+$/, "");
  try {
    const bitmap = await createImageBitmap(file, {colorSpaceConversion: 'none'});
    const canvas = createCanvasFromImage(bitmap)
    bitmap.close();
    const sourceCanvas = extractSourceFromPattern(canvas);
    if (sourceCanvas) {
      props.onImageLoaded(sourceCanvas, currentFileName);
    } else {
      const dataUrl = await fileToDataUrl(file);
      setupCropper(dataUrl, 0.5);
    }
  } catch {
    const dataUrl = await fileToDataUrl(file)
    await tryDetectFromDataUrl(dataUrl);
  }
}

async function tryDetectFromDataUrl(dataUrl) {
  const img = await loadImage(dataUrl);

  const c = createCanvasFromImage(img);
  const sourceCanvas = extractSourceFromPattern(c);
  if (sourceCanvas) {
    props.onImageLoaded(sourceCanvas, currentFileName);
  } else {
    setupCropper(dataUrl, 0.5);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function importFromUrl(url) {
  if (!url || !url.trim()) {
    proxy.$toast.show('请输入有效的URL链接');
    return;
  }

  loading.value = true;
  try {
    const img = await loadImage(url).catch(async e => {
      const proxyUrl = "https://i0.wp.com/" + url.replace(/^https?:\/\//, '');
      return await loadImage(proxyUrl)
    });

    const canvas = createCanvasFromImage(img)

    const urlParts = url.split('/');
    let fileName = urlParts[urlParts.length - 1];
    const queryIndex = fileName.indexOf('?');
    if (queryIndex !== -1) {
      fileName = fileName.substring(0, queryIndex);
    }
    currentFileName = fileName.replace(/\.[^/.]+$/, "");

    const sourceCanvas = extractSourceFromPattern(canvas);
    if (sourceCanvas) {
      props.onImageLoaded(sourceCanvas, currentFileName);
    } else {
      const dataUrl = canvas.toDataURL();
      setupCropper(dataUrl, 0.5);
    }
  } catch (error) {
    proxy.$toast.show('导入失败：图片无法加载或存在跨域限制，请尝试下载图片后再导入');
  } finally {
    loading.value = false;
  }
}

function openFilePicker() {
  fileInputRef.value?.click();
}

function openUrlPicker() {
  urlInput.value = '';
  urlModalVisible.value = true;
}

function handleUrlImport() {
  importFromUrl(urlInput.value).then(() => {
    urlModalVisible.value = false;
  });
}

function onFileChange(e) {
  const file = e.target.files?.[0];
  if (file) loadImageFromFile(file);
  e.target.value = '';
}

async function onCropConfirm() {
  loading.value = true;
  try {
    const cropper = cropState.cropper;
    if (!cropper) return;

    const selection = cropper.getSelection();
    if (!selection.width || !selection.height) {
      onCropImportOriginal();
    }

    const croppedCanvas = cropper.crop();
    preCropState.value = {
      originImageData: originImageData.value,
      cropImageSrc: cropState.cropImageSrc,
      selectedScale: selectedScale.value,
      selectionRect: getSelectedRect()
    };

    const octx = croppedCanvas.getContext('2d');
    originImageData.value = octx.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height);
    cropState.cropImageSrc = croppedCanvas.toDataURL();
    if (preCropState.value && preCropState.value.selectedScale !== undefined) {
      selectedScale.value = preCropState.value.selectedScale;
    } else {
      selectedScale.value = 1;
    }
    step.value = 'compress';

    scaleDraw();

    await cropper.loadImage(cropState.cropImageSrc);
    cropper.clearSelection();
    cropper.setMode('pan');
    // 裁剪完毕，图片已被压缩，每个单元格一个像素
    cropper.setGridCellSize(1, 1);
    resetView();
  } finally {
    loading.value = false;
  }
}

async function goBackToCrop() {
  if (!preCropState.value) return;

  preCropState.value.selectedScale = selectedScale.value;

  const {
    originImageData: savedOriginData,
    cropImageSrc: savedSrc,
    selectedScale: savedScale,
    selectionRect: savedRect
  } = preCropState.value;

  originImageData.value = savedOriginData;
  cropState.cropImageSrc = savedSrc;
  selectedScale.value = savedScale;

  const cropper = cropState.cropper;
  await cropper.loadImage(savedSrc);

  step.value = 'crop';
  await nextTick();
  setTimeout(() => {
    resetView();

    if (savedRect.width > 0 && savedRect.height > 0) {
      setSelectionRect(savedRect.x, savedRect.y, savedRect.width, savedRect.height);
      hasSelection.value = true;
    } else {
      cropper.clearSelection();
      hasSelection.value = false;
    }
  }, 10);
}

function onCancel() {
  destroyCropper();
  cropState.cropModalOpen = false;
  cropState.cropImageSrc = '';
  step.value = 'crop';
  originImageData.value = null;
  preCropState.value = null;
}

async function onCompressConfirm() {
  if (exceedsMaxPixels.value) {
    proxy.$toast.show(`不允许超过${MAX_PIXEL / 10000}万像素\n当前像素为${parseInt(totalPixels.value / 10000)}万`);
    return;
  }
  loading.value = true;
  try {
    const finalCanvas = scaleDraw();
    destroyCropper();
    cropState.cropModalOpen = false;
    step.value = 'crop';
    originImageData.value = null;
    preCropState.value = null;
    props.onImageLoaded(finalCanvas, currentFileName);
  } finally {
    loading.value = false;
  }
}

function onCropImportOriginal() {
  const cropper = cropState.cropper;
  if (!cropper) return;
  resetView();
  setSelectionRect(0, 0, cropper.imageWidth, cropper.imageHeight);
}

function resetView() {
  const cropper = cropState.cropper;
  if (!cropper) return;
  cropper.center(0.8);
}

function getSelectedRect() {
  const cropper = cropState.cropper;
  if (!cropper) return {x: 0, y: 0, width: 0, height: 0};
  return cropper.getSelection();
}

async function fixCropBoundary(gap = 0) {
  const cropper = cropState.cropper;
  if (!cropper) return;

  resetView();

  const canvas = document.createElement('canvas');
  canvas.width = cropper.imageWidth;
  canvas.height = cropper.imageHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(cropper.image, 0, 0);

  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX === width) {
    return;
  }
  maxX++;
  maxY++;
  setSelectionRect(minX - gap, minY - gap, maxX - minX + 2 * gap, maxY - minY + 2 * gap)
}

function setSelectionRect(x, y, width, height) {
  const cropper = cropState.cropper;
  if (!cropper) return;
  cropper.setSelection(x, y, width, height);
}

defineExpose({
  openFilePicker,
  setupCropper,
  importFromUrl,
  openUrlPicker
});
</script>

<style scoped lang="scss">
.crop-header {
  padding: 12px 16px;
  background: #f5f2ed;
  border-bottom: 1px solid #e7cfbc;
}

.crop-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.crop-size-text {
  font-size: 14px;
  color: #888;
  margin-top: 4px;
}

.pixel-scale-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.scale-label {
  font-size: 12px;
  color: #6b5a4b;
}

.scale-select, #algorithm-select {
  padding: 4px 8px;
  font-size: 12px;
  background: #fff;
  border: 1px solid #e7cfbc;
  border-radius: 4px;
  color: #6b5a4b;
  outline: none;
  cursor: pointer;
}

.scale-select:focus, #algorithm-select:focus {
  border-color: #b45f4c;
}

.scale-select-wrapper {
  display: flex;
  align-items: center;
  border: 1px solid #e7cfbc;
  border-radius: 4px;
  overflow: hidden;
}

.scale-btn {
  width: 28px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5ebe3;
  border: none;
  border-right: 1px solid #e7cfbc;
  font-size: 14px;
  color: #6b5a4b;
  cursor: pointer;
  transition: background 0.2s;
}

.scale-btn:last-child {
  border-right: none;
  border-left: 1px solid #e7cfbc;
}

.scale-btn:hover:not(:disabled) {
  background: #e8dcc8;
}

.scale-btn:disabled {
  background: #faf8f6;
  color: #ccc;
  cursor: not-allowed;
}

.pixel-limit-warn {
  font-size: 12px;
  color: #b45f4c;
  margin-top: 4px;
}

.crop-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #f0f0f0;
}

.crop-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.crop-footer {
  padding: 12px 16px;
  background: #f5f2ed;
  border-top: 1px solid #e7cfbc;
}

.crop-buttons {
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.crop-btn {
  padding: 0.5rem 0.8rem;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 0.3rem;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
}

.crop-btn:hover {
  background: #f0f0f0;
}

.crop-btn.confirm {
  background: #4CAF50;
  color: #fff;
  border-color: #45a049;
}

.crop-btn.confirm:hover {
  background: #45a049;
}

.crop-btn.cancel {
  background: #f44336;
  color: #fff;
  border-color: #da4336;
}

.crop-btn.cancel:hover {
  background: #da4336;
}

.crop-btn.active {
  background: #4a9eff;
  color: #fff;
  border-color: #4a9eff;
}

.url-form {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.scale-fields {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px 10px;
  margin-bottom: 8px;
}

@media (min-width: 768px) {
  .scale-fields {
    grid-template-columns: repeat(4, 1fr);
  }
}

.scale-field {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.scale-field label {
  flex-shrink: 0;
  font-size: 0.78rem;
  color: #5e4b3c;
  font-weight: 600;
  white-space: nowrap;
  width: 26px;
  text-align: right;
}

.scale-cell {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.scale-cell input,
.scale-cell select {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  border: 1px solid #e7cfbc;
  border-radius: 3px;
  font-size: 0.8rem;
  color: #5e4b3c;
  outline: none;
  background: #fff;
  text-align: center;
}

.scale-cell input:focus,
.scale-cell select:focus {
  border-color: #b45f4c;
}

.scale-cell .scale-btn {
  width: 24px;
  height: 26px;
  min-height: 26px;
  font-size: 12px;
  flex-shrink: 0;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.form-row input[type="text"] {
  padding: 0.7rem 0.8rem;
  border: 1px solid #e7cfbc;
  border-radius: 0.3rem;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
}

.form-row input[type="text"]:focus {
  outline: none;
  border-color: #b45f4c;
}

.url-tip {
  font-size: 0.75rem;
  color: #999;
  margin-top: 0.3rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.3rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
  border: 1px solid #ccc;
  display: flex;
  align-items: center;
  gap: 0.3rem;
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

.btn.confirm:hover:not(:disabled) {
  background: #45a049;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
