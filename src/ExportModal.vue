<template>
  <div v-if="visible" class="modal-overlay" @click.self="onCancel">
    <div class="export-modal">
      <div class="modal-header">
        <span>导出图片</span>
        <button class="close-btn" :disabled="exporting" @click="onCancel">&times;</button>
      </div>
      <div class="modal-body">
        <div v-if="exporting" class="loading-overlay">
          <span class="loading-text">导出中，请稍候...</span>
        </div>
        <div class="form-row">
          <label>导出类型</label>
          <div class="export-type-group">
            <label class="export-type-option">
              <input type="radio" v-model="exportType" value="pattern" />
              <span>图纸</span>
            </label>
            <label class="export-type-option">
              <input type="radio" v-model="exportType" value="source" />
              <span>源文件</span>
            </label>
            <label class="export-type-option">
              <input type="radio" v-model="exportType" value="hd" />
              <span>高清图</span>
            </label>
          </div>
        </div>

        <template v-if="exportType === 'pattern'">
          <div class="form-row checkbox-row">
            <label>
              <input type="checkbox" v-model="exportTitle" />
              <span>导出标题</span>
            </label>
          </div>
          <div class="form-row">
            <input type="text" v-model="artworkName" placeholder="作品名称" :disabled="!exportTitle" />
          </div>

          <div class="form-row checkbox-row">
            <label>
              <input type="checkbox" v-model="exportAuthor" />
              <span>添加水印</span>
            </label>
          </div>
          <div class="form-row">
            <input type="text" v-model="authorName" placeholder="作者名称" :disabled="!exportAuthor" />
          </div>

          <div class="form-row checkbox-row inline-checkboxes">
            <label>
              <input type="checkbox" v-model="exportGrid" />
              <span>导出网格</span>
            </label>
            <label>
              <input type="checkbox" v-model="exportColorCode" />
              <span>导出色号</span>
            </label>
            <label>
              <input type="checkbox" v-model="exportMirror" />
              <span>导出镜像</span>
            </label>
          </div>
        </template>

        <template v-else>
          <div class="form-row">
            <input type="text" v-model="artworkName" placeholder="文件名称" />
          </div>
        </template>
      </div>
      <div class="modal-footer">
        <button class="btn cancel" @click="onCancel">取消</button>
        <button class="btn confirm" @click="onConfirm">确认导出</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import {ref, watch} from 'vue';
import {exportCanvasImage} from "./util/canvasUtil";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  defaultName: {
    type: String,
    default: ''
  },
  defaultAuthor: {
    type: String,
    default: ''
  },
  displayCanvas: {
    type: null,
    default: null
  },
  imageWidth: {
    type: Number,
    default: 0
  },
  imageHeight: {
    type: Number,
    default: 0
  },
  colorCodes: {
    type: Array,
    default: null
  },
  currentPalette: {
    type: Array,
    default: null
  },
  bgColor: {
    type: String,
    default: '#fefaf5'
  },
  gridColor: {
    type: String,
    default: '#ff0000'
  },
  GRID_BASE_MAJOR: {
    type: Number,
    default: 10
  },
  GRID_BASE_MINOR: {
    type: Number,
    default: 5
  }
});

const emit = defineEmits(['cancel']);

const exportType = ref('pattern');
const artworkName = ref('');
const authorName = ref(localStorage.getItem('beads_author_name') || '');
const exportTitle = ref(true);
const exportAuthor = ref(false);
const exportGrid = ref(true);
const exportColorCode = ref(true);
const exportMirror = ref(false);
const exporting = ref(false);

watch(() => props.visible, (newVal) => {
  if (newVal) {
    exportType.value = 'pattern';
    artworkName.value = props.defaultName || 'pixel-art';
    const savedAuthor = localStorage.getItem('beads_author_name') || '';
    authorName.value = savedAuthor || props.defaultAuthor || '';
    exportTitle.value = true;
    exportAuthor.value = authorName.value ? true : false;
    exportGrid.value = true;
    exportColorCode.value = true;
    exportMirror.value = false;
  }
});

const GRID_BASE_MAJOR = 10;
const GRID_BASE_MINOR = 5;
async function exportImage(artworkName, authorName, exportTitle, exportAuthor, exportGrid, exportColorCode, exportMirror) {
  const { displayCanvas, colorCodes, currentPalette, gridColor } = props;
  if (!displayCanvas) return;
  if (!artworkName) return;
  const bgColor = "#ffffff"
  const imageWidth = displayCanvas.width
  const imageHeight = displayCanvas.height
  let totalCount = 0, colorKind = 0;
  const colorCount = {};
  if (colorCodes) {
    for (const row of colorCodes) {
      for (const code of row) {
        if (code) {
          colorCount[code] = (colorCount[code] || 0) + 1;
          totalCount++;
        }
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

  ex.fillStyle = bgColor;
  ex.fillRect(0, 0, exportWidth, exportHeight);
  ex.imageSmoothingEnabled = false;

  if (exportTitle) {
    ex.fillStyle = '#5e4b3c';
    const titleFontSize = Math.round(30 * TITLE_SCALE);
    ex.font = `bold ${titleFontSize}px "Segoe UI", sans-serif`;
    ex.textAlign = 'left';
    ex.textBaseline = 'middle';
    ex.fillText(`${artworkName}  [${imageWidth}×${imageHeight} / ${colorKind}色 / 共${totalCount}颗]`, 15 * TITLE_SCALE, headerHeight / 2);
  }

  ex.save();
  ex.translate(COORD_BORDER, (exportTitle ? headerHeight : 0) + COORD_BORDER);
  if (exportMirror) {
    ex.translate(imgExportWidth, 0);
    ex.scale(-1, 1);
  }
  ex.scale(effectivePixelSize / ps, effectivePixelSize / ps);
  ex.drawImage(displayCanvas, 0, 0);

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
    ex.strokeStyle = gridColor;
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
    ex.strokeStyle = gridColor;
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

  if (exportColorCode && colorCodes && currentPalette) {
    ex.font = '0.5px Consolas, monospace';
    ex.textAlign = 'center';
    ex.textBaseline = 'middle';
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        const code = colorCodes[y][x];
        if (!code) continue;
        const ci = currentPalette.find((c) => c.code === code);
        ex.fillStyle = '#000';
        if (ci) {
          const br = (ci.r * 299 + ci.g * 587 + ci.b * 114) / 1000;
          ex.fillStyle = br < 128 ? '#fff' : '#000';
        }
        if (exportMirror) {
          ex.save();
          ex.translate(x + 0.5, y + 0.5);
          ex.scale(-1, 1);
          ex.fillText(code, 0, 0);
          ex.restore();
        } else {
          ex.fillText(code, x + 0.5, y + 0.5);
        }
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

  if (exportColorCode && colorCodes && currentPalette) {
    const footerY = (exportTitle ? headerHeight : 0) + COORD_BORDER * 2 + imgExportHeight;
    let tagX = 15 * STAT_SCALE, tagY = footerY + 5 * STAT_SCALE;

    for (const [code, count] of sorted) {
      const ci = currentPalette.find((c) => c.code === code);
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

      ex.fillStyle = bgColor;
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

  exportCanvasImage(ec, artworkName)
}

function exportSourceImage(artworkName) {
  const { displayCanvas } = props;
  if (!displayCanvas) return;
  exportCanvasImage(displayCanvas, artworkName)
}

function exportHDImage(artworkName) {
  const { displayCanvas } = props;
  if (!displayCanvas) return;
  const scale = 8
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = displayCanvas.width * scale;
  scaledCanvas.height = displayCanvas.height * scale;
  const ctx = scaledCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(displayCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
  exportCanvasImage(scaledCanvas, artworkName)
}

async function onConfirm() {
  if (exporting.value) return;
  exporting.value = true;
  try {
    if (authorName.value) {
      localStorage.setItem('beads_author_name', authorName.value);
    }

    const name = artworkName.value;
    const author = authorName.value;
    const title = exportTitle.value;
    const hasAuthor = exportAuthor.value;
    const grid = exportGrid.value;
    const colorCode = exportColorCode.value;

    if (exportType.value === 'pattern') {
      await exportImage(name, author, title, hasAuthor, grid, colorCode, exportMirror.value);
    } else if (exportType.value === 'source') {
      exportSourceImage(name);
    } else if (exportType.value === 'hd') {
      exportHDImage(name);
    }

    emit('cancel');
  } finally {
    exporting.value = false;
  }
}

function onCancel() {
  emit('cancel');
}
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

.export-modal {
  background: #fff;
  border-radius: 0.5rem;
  overflow: hidden;
  width: 360px;
  max-width: 90vw;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  font-weight: 600;
  color: #5e4b3c;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: #999;
  padding: 0;
  line-height: 1;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.form-row label {
  font-size: 0.85rem;
  color: #5e4b3c;
  font-weight: 600;
  margin-bottom: 0.3rem;
}

.export-type-group {
  display: flex;
  gap: 0.8rem;
}

.export-type-option {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: normal;
}

.export-type-option input[type="radio"] {
  width: 0.9rem;
  height: 0.9rem;
  cursor: pointer;
}

.form-row input[type="text"] {
  padding: 0.5rem 0.7rem;
  border: 1px solid #e7cfbc;
  border-radius: 0.3rem;
  font-size: 0.9rem;
}

.form-row input[type="text"]:focus {
  outline: none;
  border-color: #b45f4c;
}

.form-row input[type="text"]:disabled {
  background: #f5f5f5;
  color: #999;
}

.checkbox-row label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-weight: normal;
}

.inline-checkboxes {
  flex-direction: row;
  gap: 1rem;
}

.checkbox-row input[type="checkbox"] {
  width: 1rem;
  height: 1rem;
  cursor: pointer;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 1rem;
  background: #fafafa;
  border-top: 1px solid #eee;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 0.3rem;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: all 0.2s;
  border: 1px solid #ccc;
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

.btn.confirm:hover {
  background: #45a049;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  border-radius: 0.3rem;
}

.modal-body {
  position: relative;
}

.loading-text {
  font-size: 0.95rem;
  color: #5e4b3c;
  font-weight: 600;
}
</style>
