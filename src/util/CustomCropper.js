import {loadImage} from "./imageUtil";

export class CustomCropper {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.container = options.container;
    this.image = null;
    this.imageWidth = 0;
    this.imageHeight = 0;

    this.scale = 1;
    this.translateX = 0;
    this.translateY = 0;

    this.selection = null;

    this.isDragging = false;
    this.isResizing = false;
    this.isSelecting = false;
    this.dragStart = { x: 0, y: 0 };
    this.resizeHandle = null;

    this.lastTouchDistance = 0;
    this.touchDownSelection = null;
    this.touchStartScale = 1;
    this.touchStartOffsetX = 0;
    this.touchStartOffsetY = 0;
    this.touchMidX = 0;
    this.touchMidY = 0;
    this.touchStartDistance = 0;

    this.showGrid = options.showGrid || false;
    this.mode = options.mode || 'pan';
    this.onSelectionChange = options.onSelectionChange || null;
    this.gridColor = options.gridColor || '#ff0000';

    this.initEvents();
  }

  setMode(mode) {
    this.mode = mode;
    this.updateCursor();
  }

  setGridColor(color) {
    this.gridColor = color;
    this.render();
  }

  async loadImage(src) {
    this.image = await loadImage(src);
    this.imageWidth = this.image.naturalWidth;
    this.imageHeight = this.image.naturalHeight;
    this.fitImage();
  }

  fitImage() {
    if (!this.image || !this.container) return;

    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;

    const scaleX = containerWidth / this.imageWidth;
    const scaleY = containerHeight / this.imageHeight;
    const scale = Math.min(scaleX, scaleY) * 0.8;

    this.scale = scale;
    this.translateX = (containerWidth - this.imageWidth * scale) / 2;
    this.translateY = (containerHeight - this.imageHeight * scale) / 2;
  }

  render() {
    if (!this.canvas || !this.image) return;

    const width = this.canvas.width = this.container.clientWidth;
    const height = this.canvas.height = this.container.clientHeight;

    this.drawCheckerboard(width, height);

    this.ctx.save();
    this.ctx.translate(this.translateX, this.translateY);
    this.ctx.scale(this.scale, this.scale);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.image, 0, 0);

    if (this.showGrid) {
      this.drawGrid();
    }

    this.ctx.restore();

    this.drawSelection();
  }

  drawCheckerboard(width, height) {
    const size = 20;
    const color1 = '#e0e0e0';
    const color2 = '#f5f5f5';

    this.ctx.fillStyle = color2;
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.fillStyle = color1;
    for (let y = 0; y < height; y += size) {
      for (let x = (y / size) % 2 === 0 ? 0 : size; x < width; x += size * 2) {
        this.ctx.fillRect(x, y, size, size);
      }
    }
  }

  drawGrid() {
    if (!this.image) return;

    const GRID_BASE_MAJOR = 10;
    const GRID_BASE_MINOR = 5;

    this.ctx.strokeStyle = 'rgba(180,170,160,0.4)';
    this.ctx.lineWidth = 0.1;
    this.ctx.setLineDash([]);

    for (let i = 0; i <= this.imageWidth; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(i, 0);
      this.ctx.lineTo(i, this.imageHeight);
      this.ctx.stroke();
    }

    for (let i = 0; i <= this.imageHeight; i++) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, i);
      this.ctx.lineTo(this.imageWidth, i);
      this.ctx.stroke();
    }

    this.ctx.save();
    this.ctx.strokeStyle = this.gridColor;
    this.ctx.lineWidth = 0.1 ;
    this.ctx.setLineDash([0.5, 0.5]);

    for (let i = GRID_BASE_MINOR; i <= this.imageWidth; i += GRID_BASE_MAJOR) {
      this.ctx.beginPath();
      this.ctx.moveTo(i, 0);
      this.ctx.lineTo(i, this.imageHeight);
      this.ctx.stroke();
    }

    for (let i = GRID_BASE_MINOR; i <= this.imageHeight; i += GRID_BASE_MAJOR) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, i);
      this.ctx.lineTo(this.imageWidth, i);
      this.ctx.stroke();
    }
    this.ctx.restore();

    this.ctx.strokeStyle = this.gridColor;
    this.ctx.lineWidth = 0.1;
    this.ctx.setLineDash([]);

    for (let i = 0; i <= this.imageWidth; i += GRID_BASE_MAJOR) {
      this.ctx.beginPath();
      this.ctx.moveTo(i, 0);
      this.ctx.lineTo(i, this.imageHeight);
      this.ctx.stroke();
    }

    for (let i = 0; i <= this.imageHeight; i += GRID_BASE_MAJOR) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, i);
      this.ctx.lineTo(this.imageWidth, i);
      this.ctx.stroke();
    }
  }

  drawSelection() {
    if (!this.selection) return;

    const x = this.translateX + this.selection.x * this.scale;
    const y = this.translateY + this.selection.y * this.scale;
    const w = this.selection.width * this.scale;
    const h = this.selection.height * this.scale;

    this.ctx.strokeStyle = 'rgba(74, 158, 255, 1)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([4, 4]);
    this.ctx.strokeRect(x, y, w, h);
    this.ctx.setLineDash([]);

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    this.ctx.fillRect(0, 0, this.canvas.width, y);
    this.ctx.fillRect(0, y + h, this.canvas.width, this.canvas.height - y - h);
    this.ctx.fillRect(0, y, x, h);
    this.ctx.fillRect(x + w, y, this.canvas.width - x - w, h);

    const handleSize = 8;
    const handles = [
      { pos: 'nw', hx: 0, hy: 0 },
      { pos: 'n', hx: 0.5, hy: 0 },
      { pos: 'ne', hx: 1, hy: 0 },
      { pos: 'w', hx: 0, hy: 0.5 },
      { pos: 'e', hx: 1, hy: 0.5 },
      { pos: 'sw', hx: 0, hy: 1 },
      { pos: 's', hx: 0.5, hy: 1 },
      { pos: 'se', hx: 1, hy: 1 }
    ];

    this.ctx.fillStyle = 'rgba(74, 158, 255, 1)';
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = 1;

    for (const handle of handles) {
      const hx = x + handle.hx * w - handleSize / 2;
      const hy = y + handle.hy * h - handleSize / 2;
      this.ctx.fillRect(hx, hy, handleSize, handleSize);
      this.ctx.strokeRect(hx, hy, handleSize, handleSize);
    }
  }

  updateCursor() {
    if (!this.canvas) return;

    if (this.isDragging || this.isResizing || this.isSelecting) {
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const x = this.canvas._mouseX || 0;
    const y = this.canvas._mouseY || 0;

    const handle = this.getResizeHandle(x, y);
    if (handle) {
      const cursors = {
        nw: 'nw-resize',
        n: 'n-resize',
        ne: 'ne-resize',
        w: 'w-resize',
        e: 'e-resize',
        sw: 'sw-resize',
        s: 's-resize',
        se: 'se-resize'
      };
      this.canvas.style.cursor = cursors[handle] || 'default';
    } else if (this.mode === 'crop' && this.selection && this.isInsideSelection(x, y)) {
      this.canvas.style.cursor = 'move';
    } else if (this.mode === 'pan') {
      this.canvas.style.cursor = 'grab';
    } else {
      this.canvas.style.cursor = 'crosshair';
    }
  }

  screenToImage(screenX, screenY) {
    return {
      x: (screenX - this.translateX) / this.scale,
      y: (screenY - this.translateY) / this.scale
    };
  }

  imageToScreen(imageX, imageY) {
    return {
      x: this.translateX + imageX * this.scale,
      y: this.translateY + imageY * this.scale
    };
  }

  setSelection(x, y, width, height) {
    x = Math.max(0, Math.min(x, this.imageWidth));
    y = Math.max(0, Math.min(y, this.imageHeight));
    width = Math.max(1, Math.min(width, this.imageWidth - x));
    height = Math.max(1, Math.min(height, this.imageHeight - y));

    this.selection = { x, y, width, height };
    this.render();
    this.onSelectionChange(this.selection);
  }

  getSelection() {
    return { ...this.selection };
  }

  clearSelection() {
    this.selection = null;
    this.mode = 'crop';
    this.render();
    this.onSelectionChange(null);
  }

  zoom(factor, centerX, centerY) {
    const newScale = Math.max(0.1, Math.min(100, this.scale * factor));

    if (centerX !== undefined && centerY !== undefined) {
      const imagePos = this.screenToImage(centerX, centerY);
      this.translateX = centerX - imagePos.x * newScale;
      this.translateY = centerY - imagePos.y * newScale;
    }

    this.scale = newScale;
    this.render();
  }

  center(zoomFactor = 0.8) {
    if (!this.image || !this.container) return;

    const containerWidth = this.container.clientWidth;
    const containerHeight = this.container.clientHeight;

    const scaleX = containerWidth / this.imageWidth;
    const scaleY = containerHeight / this.imageHeight;
    const scale = Math.min(scaleX, scaleY) * zoomFactor;

    this.scale = scale;
    this.translateX = (containerWidth - this.imageWidth * scale) / 2;
    this.translateY = (containerHeight - this.imageHeight * scale) / 2;

    this.render();
  }

  crop() {
    if (!this.selection || !this.image) return null;

    const { x, y, width, height } = this.selection;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, x, y, width, height, 0, 0, width, height);

    return canvas;
  }

  initEvents() {
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.handleMouseUp.bind(this));

    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

    window.addEventListener('resize', () => this.render());
  }

  handleWheel(e) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    this.zoom(factor, x, y);
  }

  eventToXY(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (e.touches && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  onDown(x, y) {
    this.canvas._mouseX = x;
    this.canvas._mouseY = y;

    const handle = this.getResizeHandle(x, y);
    if (handle) {
      this.isResizing = true;
      this.resizeHandle = handle;
      this.dragStart = { x, y };
      this.initialSelection = { ...this.selection };
      return;
    }

    if (this.mode === 'crop' && this.isInsideSelection(x, y)) {
      this.isDragging = true;
      this.dragStart = { x, y };
      this.initialSelection = { ...this.selection };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    if (this.mode === 'pan') {
      this.isDragging = true;
      this.dragStart = { x, y };
      this.initialTranslate = { x: this.translateX, y: this.translateY };
      this.canvas.style.cursor = 'grabbing';
      return;
    }

    this.isSelecting = true;
    this.dragStart = { x, y };
    const imagePos = this.screenToImage(x, y);
    const ix = Math.max(0, Math.min(Math.floor(imagePos.x), this.imageWidth - 1));
    const iy = Math.max(0, Math.min(Math.floor(imagePos.y), this.imageHeight - 1));
    this.setSelection(ix, iy, 1, 1);
  }

  onMove(x, y) {
    this.canvas._mouseX = x;
    this.canvas._mouseY = y;

    if (this.isResizing && this.resizeHandle) {
      this.resizeSelection(x, y);
      return;
    }

    if (this.isDragging) {
      if (this.mode === 'pan') {
        this.translateX = this.initialTranslate.x + x - this.dragStart.x;
        this.translateY = this.initialTranslate.y + y - this.dragStart.y;
        this.render();
      } else {
        this.moveSelection(x, y);
      }
      return;
    }

    if (this.isSelecting) {
      const imagePos = this.screenToImage(x, y);
      const endX = Math.max(0, Math.min(Math.floor(imagePos.x), this.imageWidth));
      const endY = Math.max(0, Math.min(Math.floor(imagePos.y), this.imageHeight));
      const width = Math.max(1, Math.abs(endX - this.selection.x));
      const height = Math.max(1, Math.abs(endY - this.selection.y));
      const minX = Math.min(this.selection.x, endX);
      const minY = Math.min(this.selection.y, endY);
      this.setSelection(minX, minY, width, height);
      return;
    }

    this.updateCursor();
  }

  onUp() {
    this.isResizing = false;
    this.isDragging = false;
    this.isSelecting = false;
    this.resizeHandle = null;
    this.canvas.style.cursor = '';

    if (this.selection) {
      this.mode = 'pan';
    }

    if (this.onSelectionChange) {
      this.onSelectionChange(this.selection);
    }

    this.updateCursor();
  }

  handleMouseDown(e) {
    const { x, y } = this.eventToXY(e);
    this.onDown(x, y);
  }

  handleMouseMove(e) {
    const { x, y } = this.eventToXY(e);
    this.onMove(x, y);
  }

  handleMouseUp() {
    this.onUp();
  }

  isInsideSelection(x, y) {
    if (!this.selection) return false;
    const sx = this.translateX + this.selection.x * this.scale;
    const sy = this.translateY + this.selection.y * this.scale;
    const sw = this.selection.width * this.scale;
    const sh = this.selection.height * this.scale;
    return x >= sx && x <= sx + sw && y >= sy && y <= sy + sh;
  }

  getResizeHandle(x, y) {
    if (!this.selection) return null;

    const sx = this.translateX + this.selection.x * this.scale;
    const sy = this.translateY + this.selection.y * this.scale;
    const sw = this.selection.width * this.scale;
    const sh = this.selection.height * this.scale;
    const handleSize = 12;

    const handles = [
      { pos: 'nw', hx: sx, hy: sy },
      { pos: 'n', hx: sx + sw / 2, hy: sy },
      { pos: 'ne', hx: sx + sw, hy: sy },
      { pos: 'w', hx: sx, hy: sy + sh / 2 },
      { pos: 'e', hx: sx + sw, hy: sy + sh / 2 },
      { pos: 'sw', hx: sx, hy: sy + sh },
      { pos: 's', hx: sx + sw / 2, hy: sy + sh },
      { pos: 'se', hx: sx + sw, hy: sy + sh }
    ];

    for (const handle of handles) {
      if (Math.abs(x - handle.hx) < handleSize && Math.abs(y - handle.hy) < handleSize) {
        return handle.pos;
      }
    }

    return null;
  }

  resizeSelection(x, y) {
    const dx = x - this.dragStart.x;
    const dy = y - this.dragStart.y;
    const { x: sx, y: sy, width: sw, height: sh } = this.initialSelection;

    let newX = sx, newY = sy, newWidth = sw, newHeight = sh;

    if (this.resizeHandle.includes('w')) {
      const delta = Math.round(dx / this.scale);
      newX = Math.max(0, sx + delta);
      newWidth = Math.max(1, sw - delta);
    }
    if (this.resizeHandle.includes('e')) {
      newWidth = Math.max(1, Math.round((sw * this.scale + dx) / this.scale));
    }
    if (this.resizeHandle.includes('n')) {
      const delta = Math.round(dy / this.scale);
      newY = Math.max(0, sy + delta);
      newHeight = Math.max(1, sh - delta);
    }
    if (this.resizeHandle.includes('s')) {
      newHeight = Math.max(1, Math.round((sh * this.scale + dy) / this.scale));
    }

    newWidth = Math.min(newWidth, this.imageWidth - newX);
    newHeight = Math.min(newHeight, this.imageHeight - newY);
    newWidth = Math.max(1, newWidth);
    newHeight = Math.max(1, newHeight);
    this.setSelection(newX, newY, newWidth, newHeight)
  }

  moveSelection(x, y) {
    const dx = Math.round((x - this.dragStart.x) / this.scale);
    const dy = Math.round((y - this.dragStart.y) / this.scale);

    let newX = this.initialSelection.x + dx;
    let newY = this.initialSelection.y + dy;

    newX = Math.max(0, Math.min(newX, this.imageWidth - this.selection.width));
    newY = Math.max(0, Math.min(newY, this.imageHeight - this.selection.height));

    this.setSelection(newX, newY, this.selection.width, this.selection.height)
  }

  handleTouchStart(e) {
    e.preventDefault();

    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      this.touchStartDistance = Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      );
      this.lastTouchDistance = this.touchStartDistance;
      this.touchDownSelection = { ...this.selection };

      this.touchStartScale = this.scale;
      this.touchStartOffsetX = this.translateX;
      this.touchStartOffsetY = this.translateY;
      const rect = this.canvas.getBoundingClientRect();
      this.touchMidX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
      this.touchMidY = (touch1.clientY + touch2.clientY) / 2 - rect.top;
      return;
    }

    const { x, y } = this.eventToXY(e);
    this.onDown(x, y);
  }

  handleTouchMove(e) {
    e.preventDefault();

    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dx = touch2.clientX - touch1.clientX;
      const dy = touch2.clientY - touch1.clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (this.touchStartDistance > 0) {
        const ns = Math.max(0.1, Math.min(50, this.touchStartScale * (distance / this.touchStartDistance)));
        const rect = this.canvas.getBoundingClientRect();
        const midX = (touch1.clientX + touch2.clientX) / 2 - rect.left;
        const midY = (touch1.clientY + touch2.clientY) / 2 - rect.top;

        this.translateX = midX - (this.touchMidX - this.touchStartOffsetX) * (ns / this.touchStartScale);
        this.translateY = midY - (this.touchMidY - this.touchStartOffsetY) * (ns / this.touchStartScale);
        this.scale = ns;
        this.render();
      }

      this.lastTouchDistance = distance;

      if (this.touchDownSelection) {
        this.setSelection(
          this.touchDownSelection.x,
          this.touchDownSelection.y,
          this.touchDownSelection.width,
          this.touchDownSelection.height
        );
      }

      return;
    }

    const { x, y } = this.eventToXY(e);
    this.onMove(x, y);
  }

  handleTouchEnd() {
    this.lastTouchDistance = 0;
    this.touchDownSelection = null;
    this.onUp();
  }

  destroy() {
    this.canvas.removeEventListener('wheel', this.handleWheel);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mouseleave', this.handleMouseUp);
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);

    this.image = null;
    this.ctx = null;
    this.canvas = null;
  }
}
