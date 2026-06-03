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
          <div class="crop-buttons">
            <button class="crop-btn" @click="onCropImportOriginal">导入原图</button>
            <button class="crop-btn confirm" @click="onCropConfirm">确认</button>
            <button class="crop-btn cancel" @click="onCropCancel">取消</button>
          </div>
        </div>
        <div class="crop-container">
          <img ref="cropImageRef" :src="cropState.cropImageSrc" class="crop-image">
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import {reactive, ref, watch} from 'vue';
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

const cropState = reactive({
  cropModalOpen: false,
  cropImageSrc: '',
  cropper: null
});

function initCropper() {
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
      <cropper-shade hidden></cropper-shade>
      <cropper-handle action="move" plain></cropper-handle>
      <cropper-selection initial-coverage="0.5" movable resizable outlined>
        <cropper-grid role="grid" bordered covered></cropper-grid>
        <cropper-crosshair centered></cropper-crosshair>
        <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>
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
    // const [scale] = cropState.cropper.getCropperImage().$getTransform()
    // event.target.x = Math.round(event.detail.x / scale) * scale
    // event.target.y = Math.round(event.detail.y / scale) * scale
    // event.target.width = Math.round(event.detail.width / scale) * scale
    // event.target.height = Math.round(event.detail.height / scale) * scale
  }, 500)

  document.querySelector('cropper-selection').addEventListener('change', function (event) {
    // console.log(event);
    selectionChangeEvt(event)
  });
}

function destroyCropper() {
  if (cropState.cropper) {
    cropState.cropper.destroy();
    cropState.cropper = null;
  }
}

function setupCropper(imageDataUrl) {
  cropState.cropImageSrc = imageDataUrl;
  cropState.cropModalOpen = true;
}

function tryInitCropper() {
  destroyCropper();

  const img = cropImageRef.value;
  if (!img) {
    console.warn('cropImageRef is null, retrying...');
    setTimeout(tryInitCropper, 50);
    return;
  }

  if (img.complete && img.naturalWidth > 0) {
    initCropper();
  } else {
    img.onload = () => {
      initCropper();
    };
    img.onerror = () => {
      alert('图片加载失败');
      onCropCancel();
    };
  }
}

function loadImageFromFile(file) {
  if (!file) return;

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
  e.target.value = '';
}

async function onCropConfirm() {
  if (!cropState.cropper) return;
  const cropperImage = cropState.cropper.getCropperImage()
  const section = cropState.cropper.getCropperSelection()

  const [xScale] = cropperImage.$getTransform()
  console.log(xScale)
  console.log(section.x, section.y, section.width, section.height)
  section.x = Math.floor(section.x / xScale) * xScale
  section.y = Math.floor(section.y / xScale) * xScale
  section.width = Math.ceil(section.width / xScale) * xScale
  section.height = Math.ceil(section.height / xScale) * xScale

  setTimeout(async () => {
    const croppedCanvas = await section.$toCanvas({
      width: Math.round(section.width / xScale),
      height: Math.round(section.height / xScale),
      beforeDraw: (context, canvas) => {
        console.log(context, canvas)
        context.imageSmoothingEnabled = false
      }
    });
    const croppedDataUrl = croppedCanvas.toDataURL('image/png');

    destroyCropper();
    cropState.cropModalOpen = false;
    cropState.cropImageSrc = '';

    loadImageFromDataUrl(croppedDataUrl);
  }, 100)


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
  loadImageFromDataUrl(dataUrl);
}

function loadImageFromDataUrl(dataUrl) {
  const img = new Image();
  img.onload = () => {
    props.onImageLoaded(img);
  };
  img.onerror = () => alert('无法加载图片');
  img.src = dataUrl;
}

watch(() => cropState.cropModalOpen, (newVal) => {
  if (newVal) {
    tryInitCropper();
  } else {
    destroyCropper();
  }
});

defineExpose({
  loadImageFromDataUrl,
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
  max-width: 90vw;
  max-height: 90vh;
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
}

.crop-buttons {
  display: flex;
  gap: 0.5rem;
}

.crop-btn {
  padding: 0.4rem 0.8rem;
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
