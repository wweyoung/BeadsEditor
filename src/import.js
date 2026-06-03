import { cropState, initCropper, destroyCropper, setCropModalOpen, setCropImageSrc, setCropLoaded } from './crop.js';

function setupCropper(imageDataUrl) {
  console.error('[DEBUG import.setupCropper] called, dataUrl length:', imageDataUrl?.length);
  setCropImageSrc(imageDataUrl);
  setCropModalOpen(true);
  setCropLoaded(false);
  setTimeout(() => {
    console.error('[DEBUG import.setupCropper] timeout fired, cropState.cropImageRef:', cropState.cropImageRef, 'cropContainerRef:', cropState.cropContainerRef);
    destroyCropper();
    initCropper(cropState.cropImageRef, cropState.cropContainerRef, cropState.cropGridRef, null, null);
  }, 100);
}

function loadImageFromFile(file, onFileNameChange, onMakeColorFinder) {
  if (!file) return;
  if (onMakeColorFinder) {
    onMakeColorFinder();
  }
  const fileName = file.name.replace(/\.[^/.]+$/, '');
  if (onFileNameChange) {
    onFileNameChange(fileName);
  }
  const reader = new FileReader();
  reader.onload = (e) => {
    setupCropper(e.target.result);
  };
  reader.readAsDataURL(file);
}

function loadImageFromDataUrl(dataUrl, fallbackName, onImageLoaded, onFileNameChange, onSizeChange) {
  const img = new Image();
  img.onload = () => {
    if (onFileNameChange && fallbackName !== undefined) {
      onFileNameChange(fallbackName);
    }
    if (onImageLoaded) {
      onImageLoaded(img);
    }
    if (onSizeChange) {
      onSizeChange(img.naturalWidth, img.naturalHeight);
    }
  };
  img.onerror = () => alert('无法加载图片');
  img.src = dataUrl;
}

export { loadImageFromFile, loadImageFromDataUrl, setupCropper };
