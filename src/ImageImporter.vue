<template>
  <div class="image-importer">
    <input
        type="file"
        ref="fileInputRef"
        accept="image/png, image/webp, image/jpeg, image/gif"
        style="display:none"
        @change="onFileChange"
    >

    <div v-if="urlModalVisible" class="modal-overlay">
      <div class="url-modal">
        <div class="modal-header">
          <span>通过URL导入图片</span>
          <button class="close-btn" @click="urlModalVisible = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-row">
            <input type="text" v-model="urlInput" placeholder="请输入图片URL" />
          </div>
          <div class="url-tip">支持 JPG、PNG、WebP、GIF 格式</div>
        </div>
        <div class="modal-footer">
          <button class="btn cancel" @click="urlModalVisible = false">取消</button>
          <button class="btn confirm" :disabled="loading || !urlInput.trim()" @click="handleUrlImport">
            <i v-if="loading" class="iconfont icon-spinner"></i>
            <span>{{ loading ? '导入中' : '导入' }}</span>
          </button>
        </div>
      </div>
    </div>

    <div v-if="cropState.cropModalOpen" class="modal-overlay">
      <div class="crop-modal">

        <!-- ========== Step 1: 裁剪 头部+底部 ========== -->
        <template v-if="step === 'crop'">
          <div class="crop-header">
            <div class="crop-header-row">
              <div>
                <div>Step1 裁剪</div>
                <div class="crop-size-text">{{ cropWidth }} × {{ cropHeight }}</div>
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
                <div class="crop-size-text">{{ cropWidth }} × {{ cropHeight }}</div>
                <div v-if="exceedsMaxPixels" class="pixel-limit-warn">超过100万像素，请降低像素比例</div>
              </div>
              <div class="pixel-scale-control-group">
                <div class="pixel-scale-control">
                  <div class="scale-select-wrapper">
                    <button class="scale-btn" @click="scaleDown()" :disabled="scaleOptions.length <= 1 || getScaleIndex() >= scaleOptions.length - 1">
                      -
                    </button>
                    <select v-model="selectedScale" class="scale-select" @change="() => scaleDraw()">
                      <option v-for="opt in scaleOptions" :key="opt.value" :value="opt.value">
                        {{ opt.label }}
                      </option>
                    </select>
                    <button class="scale-btn" @click="scaleUp()" :disabled="scaleOptions.length <= 1 || getScaleIndex() <= 0">
                      +
                    </button>
                  </div>
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
          </div>
        </template>

        <!-- 画布容器 -->
        <div ref="cropContainerRef" class="crop-container">
          <canvas ref="cropCanvasRef" class="crop-canvas"></canvas>
        </div>

        <!-- 底部按钮 -->
        <template v-if="step === 'crop'">
          <div class="crop-footer">
            <div class="crop-buttons">
              <div class="crop-buttons">
                <button class="crop-btn cancel" @click="onCancel"><i class="iconfont icon-times"></i></button>
                <button class="crop-btn" :class="{active: showGrid}" @click="toggleGrid"><i
                    class="iconfont icon-wangge"></i></button>
                <button class="crop-btn" :class="{active: !selection}" @click="clearSelection"><i
                    class="iconfont icon-crop-alt"></i></button>
                <button class="crop-btn" @click="fixCropBoundary()"><i class="iconfont icon-compress"></i></button>
                <button class="crop-btn" @click="onCropImportOriginal"><i class="iconfont icon-expand"></i></button>
              </div>
              <div class="crop-buttons">
                <button class="crop-btn confirm" v-if="!loading" @click="onCropConfirm">
                  <i class="iconfont icon-check"></i>
                </button>
                <button class="crop-btn confirm" v-if="loading"><i class="iconfont icon-spinner"></i></button>
              </div>
            </div>
          </div>
        </template>
        <template v-if="step === 'compress'">
          <div class="crop-footer">
            <div class="crop-buttons">
              <div class="crop-buttons">
                <button class="crop-btn cancel" @click="onCancel"><i class="iconfont icon-times"></i></button>
                <button class="crop-btn" :class="{active: showGrid}" @click="toggleGrid">
                  <i class="iconfont icon-wangge"></i>
                </button>
              </div>
              <div class="crop-buttons">
                <button class="crop-btn" @click="goBackToCrop">上一步</button>
                <button class="crop-btn confirm" v-if="!loading" @click="onCompressConfirm">
                  <i class="iconfont icon-check"></i>
                </button>
                <button class="crop-btn confirm" v-if="loading"><i class="iconfont icon-spinner"></i></button>
              </div>
            </div>
          </div>
        </template>

      </div>
    </div>
  </div>
</template>

<script setup>
import {reactive, ref, watch, computed, nextTick, getCurrentInstance} from 'vue';
import {debounce} from "lodash";
import {createCanvasFromData, createCanvasFromImage} from "./util/canvasUtil";
import {colorDistance, colorDistanceFast, rgb2lab} from "./palette";
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
const showGrid = ref(true);
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

const scaleOptions = computed(() => {
  const cw = originImageData.value?.width || 0;
  const ch = originImageData.value?.height || 0;
  const options = [{value: 1, label: `${cw}×${ch}\t1x`}];
  if (!cw || !ch) return options;
  let lastOwOh = null;
  for (let i = 2; cw / i >= 1 && ch / i >= 1; i++) {
    const ow = Math.round(cw / i);
    const oh = Math.round(ch / i);
    const owOh = `${ow}×${oh}`
    if (owOh === lastOwOh) continue;
    options.push({value: 1 / i, label: `${owOh}\t1/${i}x`})
    lastOwOh = owOh
  }
  for (let i = 2; cw * i * ch * i < MAX_PIXEL; i++) {
    const ow = cw * i;
    const oh = ch * i;
    options.push({value: i, label: `${ow}×${oh}\t${i}x`})
  }
  options.sort((a, b) => b.value - a.value);
  return options;
});

function getScaleIndex() {
  return scaleOptions.value.findIndex(opt => opt.value === selectedScale.value);
}

function scaleUp() {
  const idx = getScaleIndex();
  if (idx > 0) {
    selectedScale.value = scaleOptions.value[idx - 1].value;
    scaleDraw();
  }
}

function scaleDown() {
  const idx = getScaleIndex();
  if (idx >= 0 && idx < scaleOptions.value.length - 1) {
    selectedScale.value = scaleOptions.value[idx + 1].value;
    scaleDraw();
  }
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

  cropWidth.value = selection.value?.width;
  cropHeight.value = selection.value?.height;

  if (!cropWidth.value || !cropHeight.value) {
    cropWidth.value = cropper.imageWidth;
    cropHeight.value = cropper.imageHeight;
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
    const dstData = dctx.createImageData(imageWidth, imageHeight);
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const srcX = Math.min(Math.floor(x / ps), srcW - 1);
        const srcY = Math.min(Math.floor(y / ps), srcH - 1);
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
    const ratio = Math.round(1 / ps);
    const dstData = dctx.createImageData(imageWidth, imageHeight);
    for (let destY = 0; destY < imageHeight; destY++) {
      for (let destX = 0; destX < imageWidth; destX++) {
        const startX = destX * ratio;
        const startY = destY * ratio;
        const endX = Math.min(startX + ratio, srcW);
        const endY = Math.min(startY + ratio, srcH);
        const blockPixels = [];
        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = (y * srcW + x) * 4;
            blockPixels.push({
              r: srcData.data[idx],
              g: srcData.data[idx + 1],
              b: srcData.data[idx + 2],
              a: srcData.data[idx + 3]
            });
          }
        }
        let result = blockPixels[0];
        if (compressionAlgorithm.value === 'avg') {
          let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
          for (const p of blockPixels) {
            sumR += p.r;
            sumG += p.g;
            sumB += p.b;
            sumA += p.a;
          }
          const avgR = sumR / blockPixels.length, avgG = sumG / blockPixels.length, avgB = sumB / blockPixels.length;
          let minDist = Infinity;
          for (const p of blockPixels) {
            const d = (p.r - avgR) ** 2 + (p.g - avgG) ** 2 + (p.b - avgB) ** 2 + Math.abs(p.a - sumA / blockPixels.length) / 255;
            if (d < minDist) {
              minDist = d;
              result = p;
            }
          }
        } else if (compressionAlgorithm.value === 'median') {
          const rVals = blockPixels.map(p => p.r).sort((a, b) => a - b);
          const gVals = blockPixels.map(p => p.g).sort((a, b) => a - b);
          const bVals = blockPixels.map(p => p.b).sort((a, b) => a - b);
          const aVals = blockPixels.map(p => p.a).sort((a, b) => a - b);
          const mid = Math.floor(blockPixels.length / 2);
          result = {r: rVals[mid], g: gVals[mid], b: bVals[mid], a: aVals[mid]};
        } else {
          result = blockPixels[Math.round(blockPixels.length / 2)];
        }
        const di = (destY * imageWidth + destX) * 4;
        dstData.data[di] = result.r;
        dstData.data[di + 1] = result.g;
        dstData.data[di + 2] = result.b;
        dstData.data[di + 3] = result.a;
      }
    }
    dctx.putImageData(dstData, 0, 0);
  }

  cropState.cropImageSrc = dc.toDataURL();
  cropWidth.value = imageWidth;
  cropHeight.value = imageHeight;

  if (step.value === 'compress' && cropState.cropper) {
    cropState.cropper.loadImage(cropState.cropImageSrc).then(() => {
      cropState.cropper.center(0.8);
    });
  }

  return dc;
}

async function initCropper() {
  if (cropState.cropper) {
    await cropState.cropper.loadImage(cropState.cropImageSrc);
    resetView();
    updateCropSize();
    return;
  }

  cropState.cropper = new CustomCropper(cropCanvasRef.value, {
    container: cropContainerRef.value,
    showGrid: showGrid.value,
    gridColor: gridColor.value,
    onSelectionChange(newValue) {
      selection.value = newValue
      updateCropSize();
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

  updateCropSize();
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
    cropper.setMode('pan')
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

    updateCropSize();
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
  updateCropSize();
}

defineExpose({
  openFilePicker,
  setupCropper,
  importFromUrl,
  openUrlPicker
});
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.crop-modal {
  width: 90vw;
  max-width: 800px;
  height: 90vh;
  max-height: 600px;
  background: #faf8f5;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

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

.pixel-scale-control-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.url-modal {
  background: #fff;
  border-radius: 0.5rem;
  overflow: hidden;
  width: 400px;
  max-width: 90vw;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.url-modal .modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  font-weight: 600;
  color: #5e4b3c;
}

.url-modal .close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
  padding: 0;
  line-height: 1;
}

.url-modal .close-btn:hover {
  color: #333;
}

.url-modal .modal-body {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.url-modal .form-row {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.url-modal .form-row input[type="text"] {
  padding: 0.7rem 0.8rem;
  border: 1px solid #e7cfbc;
  border-radius: 0.3rem;
  font-size: 0.9rem;
  width: 100%;
  box-sizing: border-box;
}

.url-modal .form-row input[type="text"]:focus {
  outline: none;
  border-color: #b45f4c;
}

.url-modal .url-tip {
  font-size: 0.75rem;
  color: #999;
  margin-top: 0.3rem;
}

.url-modal .modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  background: #fafafa;
  border-top: 1px solid #eee;
}

.url-modal .btn {
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

.url-modal .btn.cancel {
  background: #fff;
  color: #666;
}

.url-modal .btn.cancel:hover {
  background: #f0f0f0;
}

.url-modal .btn.confirm {
  background: #4CAF50;
  color: #fff;
  border-color: #45a049;
}

.url-modal .btn.confirm:hover:not(:disabled) {
  background: #45a049;
}

.url-modal .btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
