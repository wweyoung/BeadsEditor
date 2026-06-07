<template>
  <div class="image-importer">
    <input
        type="file"
        ref="fileInputRef"
        accept="image/png, image/webp, image/jpeg, image/gif"
        style="display:none"
        @change="onFileChange"
    >

    <div v-if="cropState.cropModalOpen" class="modal-overlay" @click.self="onCropCancel">
      <div class="crop-modal">
        <div class="crop-header">
          <div class="crop-header-row">
            <div>
              <div>选择裁剪区域</div>
              <div>{{ cropWidth }} × {{ cropHeight }}</div>
            </div>
            <div class="pixel-scale-control-group">
              <div class="pixel-scale-control">
                <span class="scale-label">像素比例:</span>
                <button class="scale-btn" @click="decreaseScale">−</button>
                <span class="scale-value">{{ scaleLabel }}</span>
                <button class="scale-btn" @click="increaseScale">+</button>
              </div>
              <div class="pixel-scale-control">
                <label class="scale-label" for="autoFix">自动吸附:</label>
                <input class="scale-btn fix-button" v-model="isAutoFix" type="checkbox" id="autoFix">
              </div>
              <div class="pixel-scale-control" v-if="selectedScale < 1">
                <label class="scale-label" for="autoFix">压缩算法:</label>
                <select
                    v-model="compressionAlgorithm"
                    class="algorithm-select"
                    @change="scaleDraw"
                >
                  <option value="avg">均值算法</option>
                  <option value="median">中位数算法</option>
                  <option value="sample">采样算法</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        <div class="crop-container">
          <img ref="cropImageRef" :src="cropState.cropImageSrc" class="crop-image" @load="initCropper">
        </div>
        <div class="crop-footer">
          <div class="crop-buttons">
              <button class="crop-btn" @click="fixCropBoundary()">识别边界</button>
              <button class="crop-btn" @click="onCropImportOriginal">原图尺寸</button>
              <button class="crop-btn confirm" :disabled="loading" @click="onCropConfirm">
                <span v-if="loading" class="spinner"></span>
                {{ loading ? '处理中…' : '确认' }}
              </button>
              <button class="crop-btn cancel" @click="onCropCancel">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {reactive, ref, watch, computed} from 'vue';
import Cropper from 'cropperjs';
import {debounce} from "lodash";
import {createCanvasFromData, createCanvasFromImage} from "./util/canvasUtil";
import {colorDistance, colorDistanceFast, rgb2lab} from "./palette";

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
const initialCoverage = ref(0.5)
const compressionAlgorithm = ref('avg');
const isAutoFix = ref(true)
const loading = ref(false);

const scaleLabel = computed(() => {
  if (selectedScale.value >= 1) return `${selectedScale.value}x`;
  const denom = Math.round(1 / selectedScale.value);
  return `1/${denom}x`;
});

async function updateCropSize() {
  setTimeout(() => {
    if (!cropState.cropper) return;

    const cropperImage = cropState.cropper.getCropperImage();
    const section = cropState.cropper.getCropperSelection();
    if (!section) return;

    let [xScale] = cropperImage.$getTransform();
    cropWidth.value = Math.round(section.width / xScale);
    // console.log(section.width, xScale, cropWidth.value)
    cropHeight.value = Math.round(section.height / xScale);
  }, 10)
}

function increaseScale() {
  if (selectedScale.value < 1) {
    selectedScale.value = 1 / Math.max(1, Math.round(1 / selectedScale.value) - 1);
  } else {
    selectedScale.value = Math.min(10, selectedScale.value + 1);
  }
  scaleDraw()
}

function decreaseScale() {
  if (selectedScale.value > 1) {
    selectedScale.value = Math.max(1, selectedScale.value - 1);
  } else {
    selectedScale.value = 1 / (Math.round(1 / selectedScale.value) + 1);
  }
  scaleDraw()
}

function scaleDraw() {
  const ps = selectedScale.value;
  const originImageDataV = originImageData.value;
  const imageWidth = Math.round(originImageDataV.width * ps);
  const imageHeight = Math.round(originImageDataV.height * ps);
  const dc = document.createElement('canvas');
  dc.width = imageWidth;
  dc.height = imageHeight;
  const dctx = dc.getContext('2d');
  dctx.imageSmoothingEnabled = false;
  let dd = originImageDataV;

  if (ps > 1) {
    dd = dctx.createImageData(imageWidth, imageHeight)
    for (let y = 0; y < originImageDataV.height; y++) {
      for (let dy = 0; dy < ps; dy++) {
        for (let x = 0; x < originImageDataV.width; x++) {
          const si = (y * originImageDataV.width + x) * 4;
          for (let dx = 0; dx < ps; dx++) {
            const di = ((y * ps + dy) * imageWidth + (x * ps + dx)) * 4;
            dd.data[di] = originImageDataV.data[si];
            dd.data[di + 1] = originImageDataV.data[si + 1];
            dd.data[di + 2] = originImageDataV.data[si + 2];
            dd.data[di + 3] = originImageDataV.data[si + 3];
          }
        }
      }
    }
  } else if (ps < 1) {
    const ratio = Math.round(1 / ps);
    dd = dctx.createImageData(imageWidth, imageHeight)

    // 遍历每个目标像素
    for (let destY = 0; destY < imageHeight; destY++) {
      for (let destX = 0; destX < imageWidth; destX++) {
        // 原图中的块范围
        const startX = destX * ratio;
        const startY = destY * ratio;
        const endX = Math.min(startX + ratio, originImageDataV.width);
        const endY = Math.min(startY + ratio, originImageDataV.height);


        // 收集块内所有像素
        const blockPixels = [];

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = (y * originImageDataV.width + x) * 4;
            const r = originImageDataV.data[idx];
            const g = originImageDataV.data[idx + 1];
            const b = originImageDataV.data[idx + 2];
            const a = originImageDataV.data[idx + 3];
            blockPixels.push({r, g, b, a});
          }
        }

        let closestPixel = blockPixels[0]
        if (compressionAlgorithm.value === 'avg') {
          // 第一步：计算块内平均色
          let sumR = 0, sumG = 0, sumB = 0, sumA = 0;
          for (const pixel of blockPixels) {
            sumR += pixel.r;
            sumG += pixel.g;
            sumB += pixel.b;
            sumA += pixel.a;
          }

          const avgR = sumR / blockPixels.length;
          const avgG = sumG / blockPixels.length;
          const avgB = sumB / blockPixels.length;
          const avgA = sumA / blockPixels.length;

          let minDistance = Infinity;

          for (const pixel of blockPixels) {
            // 只考虑不透明的像素（可选）
            const dr = pixel.r - avgR;
            const dg = pixel.g - avgG;
            const db = pixel.b - avgB;
            const da = Math.abs(pixel.a - avgA) / 255 // 范围0-1
            const distance = (dr * dr + dg * dg + db * db) * da;

            if (distance < minDistance) {
              minDistance = distance;
              closestPixel = pixel;
            }
          }
        } else if (compressionAlgorithm.value === 'median') {
          // 分别对 R、G、B 取中位数
          const rValues = blockPixels.map(p => p.r).sort((a, b) => a - b);
          const gValues = blockPixels.map(p => p.g).sort((a, b) => a - b);
          const bValues = blockPixels.map(p => p.b).sort((a, b) => a - b);
          const aValues = blockPixels.map(p => p.a).sort((a, b) => a - b);

          const mid = Math.floor(blockPixels.length / 2);

          // 第二步：在块内查找与平均色最相似的像素
          closestPixel = {
            r: rValues[mid],
            g: gValues[mid],
            b: bValues[mid],
            a: aValues[mid]
          }
        } else if (compressionAlgorithm.value === 'sample') {
          closestPixel = blockPixels[Math.round(blockPixels.length / 2)]
        }

        // 写入目标像素
        const destIdx = (destY * imageWidth + destX) * 4;
        dd.data[destIdx] = closestPixel.r;
        dd.data[destIdx + 1] = closestPixel.g;
        dd.data[destIdx + 2] = closestPixel.b;
        dd.data[destIdx + 3] = closestPixel.a;
      }
    }
  }
  dctx.putImageData(dd, 0, 0);

  cropState.cropImageSrc = dc.toDataURL();
  updateCropSize()
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
      <cropper-handle action="move" plain></cropper-handle>
      <cropper-selection initial-coverage="${initialCoverage.value}" resizable outlined precise>
        <cropper-crosshair centered></cropper-crosshair>
        <cropper-handle action="move" theme-color="rgba(0, 0, 0, 0)"></cropper-handle>
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

  cropState.cropper.getCropperCanvas().addEventListener('action', () => {
    updateCropSize();
  })
  const section = cropState.cropper.getCropperSelection()
  const fixSection = debounce(() => {
    if (!cropState.cropper) return
    const {x, y, width, height} = getSelectedRect()
    setSectionRect(x, y, width, height)
  }, 500)
  section.addEventListener('change', function (event) {
    if (isAutoFix.value) {
      fixSection()
    }
    updateCropSize();
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

function loadImageFromFile(file) {
  if (!file) return;
  currentFileName = file.name.replace(/\.[^/.]+$/, "");
  const reader = new FileReader();
  reader.onload = (e) => {
    setupCropper(e.target.result, 0.5);
  };
  reader.readAsDataURL(file);
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
    if (!cropState.cropper) return;
    const cropperImage = cropState.cropper.getCropperImage();
    const section = cropState.cropper.getCropperSelection();
    const [xScale, b, c, yScale, tx, ty] = cropperImage.$getTransform()
    const {x, y, width, height} = getSelectedRect()
    section.x = x;
    section.y = y;
    section.width = width;
    section.height = height;
    console.log(section.x, section.y, section.width, section.height)
    cropperImage.$setTransform(1, 0, 0, 1, 0, 0)

    const croppedCanvas = await section.$toCanvas({
      width: section.width,
      height: section.height,
      beforeDraw: (context, canvas) => {
        context.imageSmoothingEnabled = false;
      }
    });

    destroyCropper();
    cropState.cropModalOpen = false;
    cropState.cropImageSrc = '';

    // 直接导入，传递像素比例
    props.onImageLoaded(croppedCanvas, currentFileName);
  } finally {
    loading.value = false;
  }
}

function onCropCancel() {
  destroyCropper();
  cropState.cropModalOpen = false;
  cropState.cropImageSrc = '';
}

function onCropImportOriginal() {
  const section = cropState.cropper.getCropperSelection()
  const image = cropState.cropper.getCropperImage()
  resetView()
  // matrix(0.253743, 0, 0, 0.253743, -409.906, -1002.96);
  const [xScale, , , yScale, x, y] = image.$getTransform()
  console.log(xScale)

  setSectionRect(0, 0, image.$image.width, image.$image.height)
}

function resetView() {
  const image = cropState.cropper.getCropperImage()
  image.$center('contain').$zoom(-0.1, 0, 0).$center()
}

function getSelectedRect() {
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
  setSectionRect(minX - gap, minY - gap, maxX - minX + 2 * gap, maxY - minY + 2 * gap)
}

function setSectionRect(x, y, width, height) {
  console.log(x, y, width, height)
  const image = cropState.cropper.getCropperImage()
  const [xScale, , , yScale, tx, ty] = image.$getTransform()
  const section = cropState.cropper.getCropperSelection()


  section.width = (width) * xScale
  section.height = (height) * yScale
  section.x = tx + x * xScale + (image.$image.width - image.$image.width * xScale) / 2
  section.y = ty + y * yScale + (image.$image.height - image.$image.height * yScale) / 2

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

  .fix-button {
    width: 18px;
    height: 18px;
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
