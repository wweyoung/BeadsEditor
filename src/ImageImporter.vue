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
          <span>选择裁剪区域</span>
          <div class="pixel-scale-control">
            <span class="scale-label">像素比例:</span>
            <button class="scale-btn" @click="decreaseScale">−</button>
            <span class="scale-value">{{ scaleLabel }}</span>
            <button class="scale-btn" @click="increaseScale">+</button>
          </div>
        </div>
        <div class="crop-container">
          <img ref="cropImageRef" :src="cropState.cropImageSrc" class="crop-image" @load="initCropper">
        </div>
        <div class="crop-footer">
          <span>裁剪尺寸: {{ cropWidth }} × {{ cropHeight }}</span>
          <div class="crop-buttons">
            <button class="crop-btn" @click="onCropImportOriginal">导入原图</button>
            <button class="crop-btn confirm" @click="onCropConfirm">确认</button>
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
const previewWidth = ref(0);
const previewHeight = ref(0);

const scaleLabel = computed(() => {
  if (selectedScale.value >= 1) return `${selectedScale.value}x`;
  const denom = Math.round(1 / selectedScale.value);
  return `1/${denom}x`;
});

function updateCropSize() {
  if (!cropState.cropper) return;

  const cropperImage = cropState.cropper.getCropperImage();
  const section = cropState.cropper.getCropperSelection();
  if (!section) return;

  let [xScale] = cropperImage.$getTransform();
  cropWidth.value = Math.round(section.width / xScale);
  console.log(section.width, xScale, cropWidth.value)
  cropHeight.value = Math.round(section.height / xScale);
  // updatePreviewSize();
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

  if (ps > 1){
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

        // 第一步：计算块内平均色
        let sumR = 0, sumG = 0, sumB = 0;
        let pixelCount = 0;

        // 同时收集块内所有像素
        const blockPixels = [];

        for (let y = startY; y < endY; y++) {
          for (let x = startX; x < endX; x++) {
            const idx = (y * originImageDataV.width + x) * 4;
            const r = originImageDataV.data[idx];
            const g = originImageDataV.data[idx + 1];
            const b = originImageDataV.data[idx + 2];
            const a = originImageDataV.data[idx + 3];

            sumR += r;
            sumG += g;
            sumB += b;
            pixelCount++;

            blockPixels.push({ r, g, b, a, x, y });
          }
        }

        const avgR = sumR / pixelCount;
        const avgG = sumG / pixelCount;
        const avgB = sumB / pixelCount;

        // 第二步：在块内查找与平均色最相似的像素
        let closestPixel = blockPixels[0];
        let minDistance = Infinity;

        for (const pixel of blockPixels) {
          // 只考虑不透明的像素（可选）
          if (pixel.a === 0) continue;

          const dr = pixel.r - avgR;
          const dg = pixel.g - avgG;
          const db = pixel.b - avgB;
          const distance = dr * dr + dg * dg + db * db;

          if (distance < minDistance) {
            minDistance = distance;
            closestPixel = pixel;
          }
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
}


const cropState = reactive({
  cropModalOpen: false,
  cropImageSrc: '',
  originImageSrc: '',
  cropper: null
});

async function initCropper() {
  console.log("init", cropState.originImageSrc)
  if (cropState.cropper) {
    cropState.cropper.destroy();
    cropState.cropper = null;
  }

  if (!cropImageRef.value) return;

  cropState.cropper = new Cropper(cropImageRef.value, {
    container: ".crop-container",
    template: `
    <cropper-canvas background scale-step="0.1">
      <cropper-image scalable rotatable skewable translatable dynamic></cropper-image>
      <cropper-shade hidden theme-color="rgba(0, 0, 0, 0)"></cropper-shade>
      <cropper-handle action="move" plain></cropper-handle>
      <cropper-selection initial-coverage="0.5" movable resizable outlined>
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

  const selectionChangeEvt = debounce((event) => {
    updateCropSize();
  }, 300)

  cropState.cropper.getCropperSelection().addEventListener('change', function (event) {
    selectionChangeEvt(event)
  });
  if (!originImageData.value) {
    const originalImage = cropImageRef.value
    const oc = document.createElement('canvas');
    oc.width = originalImage.naturalWidth;
    oc.height = originalImage.naturalHeight;
    const octx = oc.getContext('2d');
    octx.drawImage(originalImage, 0, 0);
    originImageData.value = octx.getImageData(0, 0, oc.width, oc.height);
  }
  // 初始化裁剪尺寸
  setTimeout(updateCropSize, 100);
}

function destroyCropper() {
  if (cropState.cropper) {
    cropState.cropper.destroy();
    cropState.cropper = null;
  }
}

function setupCropper(imageDataUrl) {
  cropState.originImageSrc = imageDataUrl;
  cropState.cropImageSrc = imageDataUrl;
  cropState.cropModalOpen = true;
}

function loadImageFromFile(file) {
  if (!file) return;
  currentFileName = file.name.replace(/\.[^/.]+$/, "");
  const reader = new FileReader();
  reader.onload = (e) => {
    setupCropper(e.target.result);
  };
  reader.readAsDataURL(file);
}

function openFilePicker() {
  fileInputRef.value?.click();
}

function onFileChange(e) {
  const file = e.target.files?.[0];
  if (file) loadImageFromFile(file);
  selectedScale.value = 1
  e.target.value = '';
}

async function onCropConfirm() {
  if (!cropState.cropper) return;
  const cropperImage = cropState.cropper.getCropperImage();
  const section = cropState.cropper.getCropperSelection();

  const [xScale] = cropperImage.$getTransform();
  section.x = Math.round(section.x / xScale) * xScale;
  section.y = Math.round(section.y / xScale) * xScale;
  section.width = Math.round(section.width / xScale) * xScale;
  section.height = Math.round(section.height / xScale) * xScale;

  setTimeout(async () => {
    console.log(section.width, xScale, Math.round(section.width / xScale))
    const croppedCanvas = await section.$toCanvas({
      width: Math.round(section.width / xScale),
      height: Math.round(section.height / xScale),
      beforeDraw: (context, canvas) => {
        context.imageSmoothingEnabled = false;
      }
    });

    destroyCropper();
    cropState.cropModalOpen = false;
    cropState.cropImageSrc = '';

    // 直接导入，传递像素比例
    props.onImageLoaded(croppedCanvas, currentFileName);
  }, 100);
}

function onCropCancel() {
  destroyCropper();
  cropState.cropModalOpen = false;
  cropState.cropImageSrc = '';
}

function onCropImportOriginal() {
  const dataUrl = cropState.cropImageSrc;
  destroyCropper();
  cropState.cropModalOpen = false;
  cropState.cropImageSrc = '';

  const img = new Image();
  img.onload = () => {
    props.onImageLoaded(img, currentFileName, selectedScale.value);
  };
  img.onerror = () => alert('无法加载图片');
  img.src = dataUrl;
}

defineExpose({
  openFilePicker
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
  justify-content: space-between;
  align-items: center;
  padding: 0.8rem 1rem;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  font-weight: 600;

  > span {
    flex-shrink: 0;
  }
}

.pixel-scale-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  .scale-label {
    font-weight: normal;
    font-size: 0.85rem;
  }

  .scale-btn {
    width: 24px;
    height: 24px;
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
}

.crop-btn {
  padding: 0.2rem 0.4rem;
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
