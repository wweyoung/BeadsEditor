<template>
  <div class="image-importer">
    <input
        type="file"
        ref="fileInputRef"
        accept="image/png, image/webp, image/jpeg, image/gif"
        style="display:none"
        @change="onFileChange"
    >

    <div v-if="cropState.cropModalOpen" class="modal-overlay" @click.self="onCancel">
      <div class="crop-modal">

        <!-- ========== Step 1: 裁剪 头部+底部 ========== -->
        <template v-if="step === 'crop'">
          <div class="crop-header">
            <div class="crop-header-row">
              <div>
                <div>选择裁剪区域</div>
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
                <div>缩放设置</div>
                <div class="crop-size-text">{{ cropWidth }} × {{ cropHeight }}</div>
                <div v-if="exceedsMaxPixels" class="pixel-limit-warn">超过100万像素，请降低像素比例</div>
              </div>
              <div class="pixel-scale-control-group">
                <div class="pixel-scale-control">
                  <span class="scale-label">像素比例:</span>
                  <select v-model="selectedScale" class="scale-select" @change="() => scaleDraw()">
                    <option v-for="opt in scaleOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </option>
                  </select>
                </div>
                <div class="pixel-scale-control" v-if="selectedScale < 1">
                  <label class="scale-label" for="algorithm-select">压缩算法:</label>
                  <select v-model="compressionAlgorithm" class="algorithm-select" @change="() => scaleDraw()">
                    <option value="avg">均值算法</option>
                    <option value="median">中位数算法</option>
                    <option value="sample">采样算法</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- 共享画布容器（两个步骤共用同一个 cropper，仅切换图片源） -->
        <div class="crop-container" v-doubletap="()=>handleAction = handleAction === 'select' ? 'move' : 'select'">
          <img ref="cropImageRef" :src="cropState.cropImageSrc" class="crop-image" @load="initCropper">
        </div>

        <!-- 底部按钮 -->
        <template v-if="step === 'crop'">
          <div class="crop-footer">
            <div class="crop-buttons">
              <button class="crop-btn" @click="clearSelection"><i class="iconfont icon-crop-alt"></i></button>
              <button class="crop-btn" @click="fixCropBoundary()"><i class="iconfont icon-compress"></i></button>
              <button class="crop-btn" @click="onCropImportOriginal"><i class="iconfont icon-expand"></i></button>
              <button class="crop-btn confirm" v-if="!loading" @click="onCropConfirm"><i class="iconfont icon-check"></i></button>
              <button class="crop-btn confirm" v-if="loading"><i class="iconfont icon-spinner"></i></button>
              <button class="crop-btn cancel" @click="onCancel"><i class="iconfont icon-times"></i></button>
            </div>
          </div>
        </template>
        <template v-if="step === 'compress'">
          <div class="crop-footer">
            <div class="crop-buttons">
              <button class="crop-btn confirm" v-if="!loading" @click="onCompressConfirm"><i class="iconfont icon-check"></i></button>
              <button class="crop-btn confirm" v-if="loading"><i class="iconfont icon-spinner"></i></button>
              <button class="crop-btn cancel" @click="onCancel"><i class="iconfont icon-times"></i></button>
            </div>
          </div>
        </template>

      </div>
    </div>
  </div>
</template>

<script setup>
import {reactive, ref, watch, computed, nextTick, getCurrentInstance} from 'vue';
import Cropper from 'cropperjs';
import {debounce} from "lodash";
import {createCanvasFromData, createCanvasFromImage} from "./util/canvasUtil";
import {colorDistance, colorDistanceFast, rgb2lab} from "./palette";

const MAX_PIXEL = 1000000;

// 源文件检测与提取
/**
 * 从图纸中检测并提取源文件区域
 * 新格式（当前）：4像素头部（2魔数 + 2宽高），W/H 各用 R+G 双字节
 * 旧格式（向后兼容）：5像素头部（1橙色标记 + 4宽高），橙色1像素标线
 * @param {HTMLCanvasElement|HTMLImageElement} img - 图纸图片
 * @returns {HTMLCanvasElement|null} 检测到源文件返回重建的 canvas，否则 null
 */
function extractSourceFromPattern(img) {
  const canvas = img instanceof HTMLCanvasElement ? img : createCanvasFromImage(img);
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  if (height < 20) return null;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // 尝试匹配新格式（2像素魔数）或旧格式（1像素橙色）
  let sourceStartY = -1, parsedW = 0, parsedH = 0;
  let headerSize = 4; // 默认新格式：2魔数 + 2宽高

  for (let y = height - 1; y >= Math.floor(height * 0.5); y--) {
    const idx0 = y * width * 4;

    // --- 检测新格式（魔数）：像素0=(1,1,0,255), 像素1=(2,2,0,255) ---
    const r0 = data[idx0], g0 = data[idx0 + 1], b0 = data[idx0 + 2], a0 = data[idx0 + 3];
    const r1 = data[idx0 + 4], g1 = data[idx0 + 5], b1 = data[idx0 + 6], a1 = data[idx0 + 7];

    if (r0 === 1 && g0 === 1 && b0 === 0 && a0 === 255 && r1 === 2 && g1 === 2 && b1 === 0 && a1 === 255) {
      // 新格式：魔数匹配，读取宽高（像素2-3，R+G 双字节编码）
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

  // 重建源文件画布
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
const cropImageRef = ref(null);
const originImageData = ref(null)
let currentFileName = null;

const selectedScale = ref(1);
const cropWidth = ref(0);
const cropHeight = ref(0);
const initialCoverage = ref(1)
const compressionAlgorithm = ref('median');
const loading = ref(false);
const step = ref('crop'); // 'crop' | 'compress'

const scaleOptions = computed(() => {
  const cw = originImageData.value.width;
  const ch = originImageData.value.height;
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

const hasSelection = ref(true)

const totalPixels = computed(() => cropWidth.value * cropHeight.value);
const exceedsMaxPixels = computed(() => totalPixels.value > MAX_PIXEL);

let touchDownCropSelection;

async function updateCropSize() {
  setTimeout(() => {
    if (!cropState.cropper) return;

    const cropperImage = cropState.cropper.getCropperImage();
    const section = cropState.cropper.getCropperSelection();
    if (!section) return;

    let [xScale] = cropperImage.$getTransform();
    cropWidth.value = Math.round(section.width / xScale);
    cropHeight.value = Math.round(section.height / xScale);
    if (!cropWidth.value || !cropHeight.value) {
      cropWidth.value = cropperImage.$image.width
      cropHeight.value = cropperImage.$image.height
    }
  }, 10)
}

/**
 * 缩放绘制。srcCanvas 为空时使用原图（裁剪步骤），非空时缩放裁剪后的 canvas（压缩步骤）
 * 返回创建的 canvas（供 onCompressConfirm 使用）
 */
function scaleDraw() {
  const ps = selectedScale.value;

  // 确定数据源
  const srcData = originImageData.value;
  const srcW = srcData.width;
  const srcH = srcData.height;
  const imageWidth = Math.round(srcW * ps);
  const imageHeight = Math.round(srcH * ps);

  // 裁剪步骤：更新选区（压缩步骤无选区操作）
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
    // 最近邻上采样
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
    // 下采样：块内按算法取值
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
            blockPixels.push({r: srcData.data[idx], g: srcData.data[idx + 1], b: srcData.data[idx + 2], a: srcData.data[idx + 3]});
          }
        }
        let result = blockPixels[0];
        if (compressionAlgorithm.value === 'avg') {
          let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
          for (const p of blockPixels) { sumR += p.r; sumG += p.g; sumB += p.b; sumA += p.a; }
          const avgR = sumR / blockPixels.length, avgG = sumG / blockPixels.length, avgB = sumB / blockPixels.length;
          let minDist = Infinity;
          for (const p of blockPixels) {
            const d = (p.r - avgR) ** 2 + (p.g - avgG) ** 2 + (p.b - avgB) ** 2 + Math.abs(p.a - sumA / blockPixels.length) / 255;
            if (d < minDist) { minDist = d; result = p; }
          }
        } else if (compressionAlgorithm.value === 'median') {
          const rVals = blockPixels.map(p => p.r).sort((a, b) => a - b);
          const gVals = blockPixels.map(p => p.g).sort((a, b) => a - b);
          const bVals = blockPixels.map(p => p.b).sort((a, b) => a - b);
          const aVals = blockPixels.map(p => p.a).sort((a, b) => a - b);
          const mid = Math.floor(blockPixels.length / 2);
          result = {r: rVals[mid], g: gVals[mid], b: bVals[mid], a: aVals[mid]};
        } else { // sample
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
  updateCropSize();
  return dc;
}


const cropState = reactive({
  cropModalOpen: false,
  cropImageSrc: '',
  originImageSrc: '',
  cropper: null
});

async function initCropper() {
  if (cropState.cropper) {
    const image = cropState.cropper.getCropperImage()
    image.src = cropState.cropImageSrc
    setTimeout(() => {
      resetView()
    }, 1)
    updateCropSize()
    return
  }

  cropState.cropper = new Cropper(cropImageRef.value, {
    container: ".crop-container",
    template: `
    <cropper-canvas background scale-step="0.1">
      <cropper-image scalable translatable dynamic></cropper-image>
      <cropper-shade hidden theme-color="rgba(0, 0, 0, 0)"></cropper-shade>
      <cropper-handle action="select" plain class="cropper-handle"></cropper-handle>
      <cropper-selection initial-coverage="${initialCoverage.value}" resizable movable outlined precise dynamic zoomable>
        <cropper-crosshair centered></cropper-crosshair>
        <cropper-handle action="move" class="cropper-handle" theme-color="rgba(0, 0, 0, 0)"></cropper-handle>
        <cropper-handle action="n-resize"></cropper-handle>
        <cropper-handle action="e-resize"></cropper-handle>
        <cropper-handle action="s-resize"></cropper-handle>
        <cropper-handle action="w-resize"></cropper-handle>
        <cropper-handle action="ne-resize"></cropper-handle>
        <cropper-handle action="nw-resize"></cropper-handle>
        <cropper-handle action="se-resize"></cropper-handle>
        <cropper-handle action="sw-resize"></cropper-handle>
      </cropper-selection>
    </cropper-canvas>
    `
  });

  const canvas = cropState.cropper.getCropperCanvas();
  canvas.addEventListener('action', () => {
    updateCropSize();
  })
  // 监听移动端缩放事件，实现选框同步缩放
  canvas.addEventListener('touchstart', (e) => {
    if (step.value === 'compress') return;
    if (e.touches.length === 2) {
      touchDownCropSelection = getSelectedRect()
    } else {
      touchDownCropSelection = undefined;
    }
  })
  canvas.addEventListener('touchmove', (e) => {
    if (step.value === 'compress' || !touchDownCropSelection) return;
    const {x, y, width, height} = touchDownCropSelection
    setSelectionRect(x, y, width, height)
  })
  canvas.addEventListener('touchend', (e) => {
    if (step.value === 'compress' || !touchDownCropSelection) return;
    const {x, y, width, height} = touchDownCropSelection
    setSelectionRect(x, y, width, height)
    touchDownCropSelection = undefined;
  })
  const section = cropState.cropper.getCropperSelection()
  const fixSection = debounce(() => {
    const {x, y, width, height} = getSelectedRect()
    setSelectionRect(x, y, width, height)
  }, 500)
  section.addEventListener('change', function (event) {
    if (step.value === 'compress') return;
    hasSelection.value = event.detail.width > 0 && event.detail.height > 0;
    if (hasSelection.value) {
      fixSection()
    }
    updateCropSize();
    const handles = document.querySelectorAll("cropper-handle.cropper-handle")
    handles.forEach(handle => handle.action = (hasSelection.value ? 'move' : 'select'))
  });
  if (!originImageData.value) {
    const originalImage = cropImageRef.value
    const oc = createCanvasFromImage(originalImage)
    const octx = oc.getContext('2d');
    originImageData.value = octx.getImageData(0, 0, oc.width, oc.height);
  }

  setTimeout(() => {
    fixCropBoundary()
  }, 10)

  // 初始化裁剪尺寸
  updateCropSize()
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
  originImageData.value = null
  selectedScale.value = 1
  initialCoverage.value = _initialCoverage
}

async function loadImageFromFile(file) {
  if (!file) return;
  currentFileName = file.name.replace(/\.[^/.]+$/, "");
  try {
    // 使用 colorSpaceConversion: 'none' 禁用色彩管理，确保读取精确的像素值
    const bitmap = await createImageBitmap(file, {colorSpaceConversion: 'none'});
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    const sourceCanvas = extractSourceFromPattern(canvas);
    if (sourceCanvas) {
      props.onImageLoaded(sourceCanvas, currentFileName);
    } else {
      // 未检测到，用 data URL 走正常裁剪流程
      const dataUrl = await fileToDataUrl(file);
      setupCropper(dataUrl, 0.5);
    }
  } catch {
    // 回退：通过 FileReader 加载
    const dataUrl = await fileToDataUrl(file)
    tryDetectFromDataUrl(dataUrl);
  }
}

function tryDetectFromDataUrl(dataUrl) {
  const img = new Image();
  img.onload = () => {
    const c = createCanvasFromImage(img);
    const sourceCanvas = extractSourceFromPattern(c);
    if (sourceCanvas) {
      props.onImageLoaded(sourceCanvas, currentFileName);
    } else {
      setupCropper(dataUrl, 0.5);
    }
  };
  img.src = dataUrl;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function openFilePicker() {
  fileInputRef.value?.click();
}

function onFileChange(e) {
  const file = e.target.files?.[0];
  if (file) loadImageFromFile(file);
  e.target.value = '';
}

async function onCropConfirm() {
  loading.value = true;
  try {
    const cropperImage = cropState.cropper.getCropperImage();
    const selection = cropState.cropper.getCropperSelection();
    if (!selection.width || !selection.height) {
      onCropImportOriginal()
    }
    await nextTick();
    const [xScale, b, c, yScale, tx, ty] = cropperImage.$getTransform()
    const {x, y, width, height} = getSelectedRect()
    selection.x = x;
    selection.y = y;
    selection.width = width;
    selection.height = height;
    console.log(selection.x, selection.y, selection.width, selection.height)
    cropperImage.$setTransform(1, 0, 0, 1, 0, 0)

    const croppedCanvas = await selection.$toCanvas({
      width: selection.width,
      height: selection.height,
      beforeDraw: (context, canvas) => {
        context.imageSmoothingEnabled = false;
      }
    });

    // 不销毁 cropper，复用同一个实例，用裁剪结果替换原图
    const octx = croppedCanvas.getContext('2d');
    originImageData.value = octx.getImageData(0, 0, croppedCanvas.width, croppedCanvas.height);
    cropState.cropImageSrc = croppedCanvas.toDataURL();
    selectedScale.value = 1;
    step.value = 'compress';
    // 设置 handle 为 move，进入只预览模式
    selection.$clear();
    selection.style.display = 'none';
    const handles = document.querySelectorAll("cropper-handle.cropper-handle")
    handles.forEach(handle => handle.action = 'move')
  } finally {
    loading.value = false;
  }
}

function onCancel() {
    destroyCropper();
    cropState.cropModalOpen = false;
    cropState.cropImageSrc = '';
    step.value = 'crop';
    originImageData.value = null;
}

/** 压缩确认：将缩放后的 canvas 传给编辑器 */
async function onCompressConfirm() {
  if (exceedsMaxPixels.value) {
    proxy.$toast.show(`不允许超过${MAX_PIXEL / 10000}万像素\n当前像素为${parseInt(totalPixels.value / 10000)}万`);
    return;
  }
  loading.value = true;
  try {
    // scaleDraw 会更新 cropWidth/cropHeight、调用 updateCropSize
    const finalCanvas = scaleDraw();
    destroyCropper();
    cropState.cropModalOpen = false;
    step.value = 'crop';
    originImageData.value = null;
    props.onImageLoaded(finalCanvas, currentFileName);
  } finally {
    loading.value = false;
  }
}

function onCropImportOriginal() {
  const image = cropState.cropper.getCropperImage()
  resetView()
  setSelectionRect(0, 0, image.$image.width, image.$image.height)
}

function resetView() {
  const image = cropState.cropper.getCropperImage()
  image.$center('contain').$zoom(-0.2, 0, 0).$center()
}

function getSelectedRect() {
  if (!cropState.cropper) return {x: 0, y: 0, width: 0, height: 0};
  const image = cropState.cropper.getCropperImage()
  const section = cropState.cropper.getCropperSelection()
  const imageRect = image.getBoundingClientRect()
  const sectionRect = section.getBoundingClientRect()
  const [xScale, , , yScale, tx, ty] = image.$getTransform()
  const x = Math.round((sectionRect.x - imageRect.x) / xScale)
  const y = Math.round((sectionRect.y - imageRect.y) / xScale)
  const width = Math.round(section.width / xScale)
  const height = Math.round(section.height / xScale)
  return {x, y, width, height}
}

function clearSelection() {
  cropState.cropper.getCropperSelection().$clear();
}

async function fixCropBoundary(gap = 0) {
  const image = cropState.cropper.getCropperImage()
  resetView()
  const canvas = createCanvasFromImage(image.$image)
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  // 遍历所有像素，找到非透明像素的边界
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) { // 非透明像素
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // 如果没有找到任何非透明像素
  if (minX === width) {
    return;
  }
  maxX++;
  maxY++;
  setSelectionRect(minX - gap, minY - gap, maxX - minX + 2 * gap, maxY - minY + 2 * gap)
}

function setSelectionRect(x, y, width, height) {
  if (!cropState.cropper) return;
  const selection = cropState.cropper.getCropperSelection()
  if (width <= 0 || height <= 0) {
    selection.$clear();
  }
  const image = cropState.cropper.getCropperImage()
  const [xScale, , , yScale, tx, ty] = image.$getTransform()
  x = Math.min(Math.max(x, -1), image.$image.width)
  y = Math.min(Math.max(y, -1), image.$image.height)
  let endX = x + width;
  let endY = y + height;
  width = Math.min(endX, image.$image.width + 1) - x
  height = Math.min(endY, image.$image.height + 1) - y
  selection.width = width * xScale
  selection.height = height * yScale
  selection.x = tx + x * xScale + (image.$image.width - image.$image.width * xScale) / 2
  selection.y = ty + y * yScale + (image.$image.height - image.$image.height * yScale) / 2
}

defineExpose({
  openFilePicker,
  setupCropper
});
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

.crop-modal {
  background: #fff;
  border-radius: 0.5rem;
  overflow: hidden;
  max-width: 95vw;
  max-height: 95vh;
  width: 1400px;
  height: 900px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.crop-header {
  display: flex;
  flex-direction: column;
  padding: 0.6rem 1rem;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  font-weight: 600;
}

.crop-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;

  > span {
    flex-shrink: 0;
  }
}

.pixel-scale-control-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.pixel-scale-control {
  display: flex;
  align-items: center;
  gap: 0.4rem;

  .scale-label {
    font-weight: normal;
    font-size: 0.85rem;
  }

  .scale-btn {
    width: 22px;
    height: 22px;
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    font-weight: bold;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background: #f0f0f0;
    }
  }

  .scale-value {
    min-width: 40px;
    text-align: center;
    font-size: 0.9rem;
  }
}

.crop-buttons {
  display: flex;
  gap: 0.5rem;
  justify-content: space-between;
  flex: 1;
}

.crop-btn {
  padding: 0.2rem 0.4rem;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 0.3rem;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s;
  flex: 1;
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

.crop-btn.confirm:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  vertical-align: middle;
  margin-right: 4px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.crop-btn.cancel {
  background: #f44336;
  color: #fff;
  border-color: #da4336;
}

.crop-btn.cancel:hover {
  background: #da4336;
}

.crop-size-text {
  font-size: 0.75rem;
}

.pixel-limit-warn {
  color: #e74c3c;
  font-weight: 600;
  font-size: 0.6rem;
}

.crop-container {
  position: relative;
  overflow: hidden;
  background: #000;
  flex: 1;
  min-height: 0;

  :deep(cropper-canvas) {
    height: 100%;

    cropper-image {
      image-rendering: crisp-edges; /* Firefox */
      image-rendering: pixelated; /* Chrome/Edge/Safari */
      image-rendering: crisp-edges; /* Firefox */
    }
  }
}

.crop-image {
  display: block;
  max-width: 100%;
}

.crop-footer {
  padding: 0.5rem 1rem;
  background: #f5f5f5;
  border-top: 1px solid #ddd;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
  color: #666;
}

:deep(.cropper-container) {
  max-width: 100%;
}

:deep(.cropper-view-box),
:deep(.cropper-face) {
  border-radius: 0;
}

:deep(.cropper-view-box) {
  outline: 1px solid rgba(255, 255, 255, 0.5);
  outline-offset: -1px;
}

:deep(.cropper-line) {
  background-color: rgba(255, 255, 255, 0.75);
}

:deep(.cropper-point) {
  background-color: #fff;
  width: 10px;
  height: 10px;
  opacity: 0.75;
}
</style>
