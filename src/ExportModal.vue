<template>
  <BaseModal
      title="导出图片"
      :visible="visible"
      width="360px"
      :overlay-opacity="0.6"
      :close-disabled="exporting"
      @cancel="onCancel"
  >
    <div class="export-form">
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
          <div class="form-row">
            <label>清晰度</label>
            <select v-model="pixelSize">
              <option :value="16">小 (16px/珠)</option>
              <option :value="20">中 (20px/珠)</option>
              <option :value="24">大 (24px/珠)</option>
              <option :value="28">超大 (28px/珠)</option>
            </select>
          </div>
          <div class="form-row checkbox-row inline-checkboxes">
            <label>
              <input type="checkbox" v-model="exportGrid" />
              <span>网格</span>
            </label>
            <label>
              <input type="checkbox" v-model="exportColorCode" />
              <span>色号</span>
            </label>
            <label>
              <input type="checkbox" v-model="exportMirror" />
              <span>镜像</span>
            </label>
            <label>
              <input type="checkbox" v-model="exportSourceFile" />
              <span>源文件</span>
            </label>
          </div>
        </template>

        <template v-else>
          <div class="form-row">
            <input type="text" v-model="artworkName" placeholder="文件名称" />
          </div>
        </template>
    </div>
    <template #footer>
      <button class="btn cancel" :disabled="exporting" @click="onCancel">取消</button>
      <button v-if="!exporting" class="btn confirm" @click="onConfirm">确认导出</button>
      <button v-if="exporting" class="btn confirm"><i class="iconfont icon-spinner"></i> 正在导出</button>
    </template>
  </BaseModal>
</template>

<script setup>
import {nextTick, ref, watch} from 'vue';
import BaseModal from './BaseModal.vue';
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
    type: [String, null],
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

// 模块级变量，跨组件挂载保持文件名持久化
let savedArtworkName = '';

const exportType = ref('pattern');
const artworkName = ref('');
const pixelSize = ref(20);
const authorName = ref(localStorage.getItem('beads_author_name') || '');
const exportTitle = ref(true);
const exportAuthor = ref(false);
const exportGrid = ref(true);
const exportColorCode = ref(true);
const exportMirror = ref(false);
const exportSourceFile = ref(true);
const exporting = ref(false);

watch(() => props.visible, (newVal) => {
  if (newVal) {
    exportType.value = 'pattern';
    // 优先使用之前保存的自定义文件名，否则使用默认名
    artworkName.value = savedArtworkName || props.defaultName || 'pixel-art';
    const savedAuthor = localStorage.getItem('beads_author_name') || '';
    authorName.value = savedAuthor || props.defaultAuthor || '';
    exportTitle.value = true;
    exportAuthor.value = authorName.value ? true : false;
    exportGrid.value = true;
    exportColorCode.value = true;
    exportMirror.value = false;
    exportSourceFile.value = true;
  }
});

// 用户修改文件名时持久化保存
watch(artworkName, (newVal) => {
  if (newVal && newVal !== (props.defaultName || 'pixel-art')) {
    savedArtworkName = newVal;
  }
});

const GRID_BASE_MAJOR = 10;
const GRID_BASE_MINOR = 5;

// ============ 辅助函数 ============

/** 计算色号统计：总数量、种类数、各自数量、排序列表 */
function calcColorStats(colorCodes) {
  if (!colorCodes) return { totalCount: 0, colorKind: 0, colorCount: {}, sorted: [] };
  const colorCount = {};
  let totalCount = 0;
  for (const row of colorCodes) {
    for (const code of row) {
      if (code) {
        colorCount[code] = (colorCount[code] || 0) + 1;
        totalCount++;
      }
    }
  }
  return {
    totalCount,
    colorKind: Object.keys(colorCount).length,
    colorCount,
    sorted: Object.entries(colorCount).sort((a, b) => b[1] - a[1])
  };
}

/** Canvas 测量文本宽度 */
function measureText(text, font) {
  const c = document.createElement('canvas').getContext('2d');
  c.font = font;
  return c.measureText(text).width;
}

/** 预计算色号统计标签的行数 */
function calcStatRowCount(sorted, exportWidth, font, pad, gap, marginLeft, marginRight) {
  let x = marginLeft, rows = 1;
  for (const [code, count] of sorted) {
    const tw = measureText(code, font) + 2 * pad + measureText(`${count}`, font) + 2 * pad;
    if (x + tw > exportWidth - marginRight) { x = marginLeft; rows++; }
    x += tw + gap;
  }
  return rows;
}

/** 编码源文件横条（含魔数头部 + 像素数据） */
function encodeSourceStrip(canvas, imageWidth, imageHeight, stripWidth, stripRows) {
  const stripCanvas = document.createElement('canvas');
  stripCanvas.width = stripWidth;
  stripCanvas.height = stripRows;
  const stripCtx = stripCanvas.getContext('2d');
  const stripImageData = stripCtx.createImageData(stripWidth, stripRows);
  const buf = stripImageData.data;
  const headerPixels = 4; // 2魔数 + 2宽高
  const totalPixels = imageWidth * imageHeight;

  // 魔数像素
  buf[0] = 1; buf[1] = 1; buf[2] = 0; buf[3] = 255;
  buf[4] = 2; buf[5] = 2; buf[6] = 0; buf[7] = 255;
  // W 低/高字节
  buf[8] = imageWidth & 0xFF; buf[9] = (imageWidth >> 8) & 0xFF; buf[10] = 0; buf[11] = 255;
  // H 低/高字节
  buf[12] = imageHeight & 0xFF; buf[13] = (imageHeight >> 8) & 0xFF; buf[14] = 0; buf[15] = 255;

  // 复制像素数据
  const srcCtx = canvas.getContext('2d');
  const srcData = srcCtx.getImageData(0, 0, imageWidth, imageHeight).data;
  for (let i = 0; i < totalPixels; i++) {
    const si = i * 4, di = (headerPixels + i) * 4;
    buf[di] = srcData[si]; buf[di + 1] = srcData[si + 1];
    buf[di + 2] = srcData[si + 2]; buf[di + 3] = srcData[si + 3];
  }
  stripCtx.putImageData(stripImageData, 0, 0);
  return stripCanvas;
}

function exportImage(artworkName, authorName, exportTitle, exportAuthor, exportGrid, exportColorCode, exportMirror, exportSourceFile, pixelSize = 28) {
  const { displayCanvas, colorCodes, currentPalette, bgColor, gridColor } = props;
  if (!displayCanvas) return;
  if (!artworkName) return;
  const imageWidth = displayCanvas.width;
  const imageHeight = displayCanvas.height;

  const { totalCount, colorKind, sorted } = calcColorStats(colorCodes);

  const BASE_PIXEL_SIZE = pixelSize;

  const imgExportWidth = imageWidth * BASE_PIXEL_SIZE;
  const imgExportHeight = imageHeight * BASE_PIXEL_SIZE;
  const exportWidth = imgExportWidth + BASE_PIXEL_SIZE * 2;
  const contentScale = Math.max(0.4, Math.min(3, imgExportWidth / 800));

  // 标题
  const titleParts = [];
  if (exportTitle && artworkName) titleParts.push(artworkName);
  titleParts.push(`[${imageWidth}×${imageHeight} / ${colorKind}色 / 共${totalCount}颗]`);
  const titleText = titleParts.join('  ');

  let titleFontSize = Math.round(Math.max(14, Math.min(48, 26 * contentScale)));
  const maxTitleWidth = exportWidth - 30;
  const titleFont = `bold ${titleFontSize}px "Segoe UI", sans-serif`;
  const tw = measureText(titleText, titleFont);
  if (tw > maxTitleWidth) {
    titleFontSize = Math.max(8, Math.floor(titleFontSize * maxTitleWidth / tw));
  }
  const headerHeight = Math.round(titleFontSize * 1.6);

  // 色号统计配置
  const statFontSize = Math.round(Math.max(9, Math.min(20, 14 * contentScale)));
  const tagHeight = Math.round(statFontSize * 1.3);
  const lineHeight = Math.round(statFontSize * 1.6);
  const gap = Math.round(statFontSize * 0.45);
  const statFont = `bold ${statFontSize}px Consolas, monospace`;
  const statPad = statFontSize * 0.7;
  const marginLeft = 15 * contentScale;
  const marginRight = 20 * contentScale;

  const rowCount = sorted.length ? calcStatRowCount(sorted, exportWidth, statFont, statPad, gap, marginLeft, marginRight) : 1;
  const footerHeight = Math.round(rowCount * lineHeight + 8 * contentScale);

  // 源文件
  let sourceAreaHeight = 0;
  let sourceStripRows = 0;
  if (exportSourceFile) {
    const totalPixels = imageWidth * imageHeight;
    const headerPixels = 4;
    sourceStripRows = Math.ceil((headerPixels + totalPixels) / exportWidth);
    sourceAreaHeight = sourceStripRows;
  }

  const exportHeight = imgExportHeight + headerHeight + footerHeight + BASE_PIXEL_SIZE * 2 + sourceAreaHeight;

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

  ex.fillStyle = bgColor || '#ffffff';
  ex.fillRect(0, 0, exportWidth, exportHeight);
  ex.imageSmoothingEnabled = false;

  ex.fillStyle = '#5e4b3c';
  ex.font = `bold ${titleFontSize}px "Segoe UI", sans-serif`;
  ex.textAlign = 'left';
  ex.textBaseline = 'middle';
  ex.fillText(titleText, 15 * contentScale, headerHeight / 2);

  ex.save();
  ex.translate(BASE_PIXEL_SIZE, headerHeight + BASE_PIXEL_SIZE);
  if (exportMirror) {
    ex.translate(imgExportWidth, 0);
    ex.scale(-1, 1);
  }
  ex.scale(BASE_PIXEL_SIZE, BASE_PIXEL_SIZE);
  // 透明背景时在图片区域绘制棋盘格
  if (!bgColor && colorCodes) {
    for (let y = 0; y < imageHeight; y++) {
      for (let x = 0; x < imageWidth; x++) {
        if (colorCodes[y]?.[x]) continue;
        if ((x + y) % 2 !== 0) continue;
        ex.fillStyle = '#DDDDDD';
        ex.fillRect(x, y, 1, 1);
      }
    }
  }
  ex.drawImage(displayCanvas, 0, 0);

  if (exportGrid) {
    const ms = GRID_BASE_MAJOR, mis = GRID_BASE_MINOR;
    ex.strokeStyle = 'rgba(180,170,160,0.1)';
    ex.lineWidth = 0.05;
    ex.setLineDash([]);
    for (let x = 0; x <= imageWidth; x++) {
      ex.beginPath();
      ex.moveTo(x, 0);
      ex.lineTo(x, imageHeight);
      ex.stroke();
    }
    for (let y = 0; y <= imageHeight; y++) {
      ex.beginPath();
      ex.moveTo(0, y);
      ex.lineTo(imageWidth, y);
      ex.stroke();
    }
    ex.save();
    ex.strokeStyle = gridColor;
    ex.lineWidth = 0.08;
    ex.setLineDash([0.3, 0.3]);
    for (let x = mis; x < imageWidth; x += ms) {
      ex.beginPath();
      ex.moveTo(x, 0);
      ex.lineTo(x, imageHeight);
      ex.stroke();
    }
    for (let y = mis; y < imageHeight; y += ms) {
      ex.beginPath();
      ex.moveTo(0, y);
      ex.lineTo(imageWidth, y);
      ex.stroke();
    }
    ex.restore();
    ex.strokeStyle = gridColor;
    ex.lineWidth = 0.05;
    ex.setLineDash([]);
    for (let x = 0; x <= imageWidth; x += ms) {
      ex.beginPath();
      ex.moveTo(x, 0);
      ex.lineTo(x, imageHeight);
      ex.stroke();
    }
    for (let y = 0; y <= imageHeight; y += ms) {
      ex.beginPath();
      ex.moveTo(0, y);
      ex.lineTo(imageWidth, y);
      ex.stroke();
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
    const diagonalSpacing = 10;
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
    ex.font = `0.8px "Segoe UI", sans-serif`;
    ex.fillStyle = 'rgba(140, 140, 140, 0.6)';
    ex.textAlign = 'center';
    ex.textBaseline = 'middle';

    const text = authorName;

    ex.save();
    ex.translate(imageWidth / 2, imageHeight / 2);
    ex.rotate(Math.PI / 4);

    const textWidth = ex.measureText(text).width + 6;

    for (let i = -diagW / 2; i < diagW / 2; i += diagonalSpacing * 2) {
      for (let j = -diagW / 2; j < diagW / 2; j += textWidth) {
        ex.save();
        ex.translate(i, j);
        ex.rotate(-Math.PI / 4);
        if (exportMirror) {
          ex.scale(-1, 1);
        }
        ex.fillText(text, 0, 0);
        ex.restore();
      }
    }

    ex.restore();
    ex.restore();
  }

  ex.restore();

  const coordFontSize = Math.max(8, 0.5 * BASE_PIXEL_SIZE);
  if (exportGrid) {
    ex.font = `${coordFontSize}px Consolas, monospace`;
    ex.textAlign = 'center';
    ex.textBaseline = 'middle';
    for (let x = 0; x < imageWidth; x++) {
      const sx = BASE_PIXEL_SIZE + x * BASE_PIXEL_SIZE + BASE_PIXEL_SIZE / 2;
      const sy = headerHeight + BASE_PIXEL_SIZE / 2;
      ex.fillStyle = '#aaa';
      ex.fillRect(sx - BASE_PIXEL_SIZE / 2, headerHeight, BASE_PIXEL_SIZE, BASE_PIXEL_SIZE);
      ex.fillStyle = '#000';
      ex.fillText(`${x + 1}`, sx, sy);
    }
    for (let x = 0; x < imageWidth; x++) {
      const sx = BASE_PIXEL_SIZE + x * BASE_PIXEL_SIZE + BASE_PIXEL_SIZE / 2;
      const sy = headerHeight + imgExportHeight + BASE_PIXEL_SIZE + BASE_PIXEL_SIZE / 2;
      ex.fillStyle = '#aaa';
      ex.fillRect(sx - BASE_PIXEL_SIZE / 2, headerHeight + imgExportHeight + BASE_PIXEL_SIZE, BASE_PIXEL_SIZE, BASE_PIXEL_SIZE);
      ex.fillStyle = '#000';
      ex.fillText(`${x + 1}`, sx, sy);
    }
    for (let y = 0; y < imageHeight; y++) {
      const sx = BASE_PIXEL_SIZE / 2;
      const sy = headerHeight + BASE_PIXEL_SIZE + y * BASE_PIXEL_SIZE + BASE_PIXEL_SIZE / 2;
      ex.fillStyle = '#aaa';
      ex.fillRect(0, sy - BASE_PIXEL_SIZE / 2, BASE_PIXEL_SIZE, BASE_PIXEL_SIZE);
      ex.fillStyle = '#000';
      ex.fillText(`${y + 1}`, sx, sy);
    }
    for (let y = 0; y < imageHeight; y++) {
      const sx = BASE_PIXEL_SIZE + imgExportWidth + BASE_PIXEL_SIZE / 2;
      const sy = headerHeight + BASE_PIXEL_SIZE + y * BASE_PIXEL_SIZE + BASE_PIXEL_SIZE / 2;
      ex.fillStyle = '#aaa';
      ex.fillRect(BASE_PIXEL_SIZE + imgExportWidth, sy - BASE_PIXEL_SIZE / 2, BASE_PIXEL_SIZE, BASE_PIXEL_SIZE);
      ex.fillStyle = '#000';
      ex.fillText(`${y + 1}`, sx, sy);
    }
  }

  if (exportColorCode && colorCodes && currentPalette) {
    ex.save();
    ex.translate(BASE_PIXEL_SIZE, headerHeight + BASE_PIXEL_SIZE);
    if (exportMirror) {
      ex.translate(imgExportWidth, 0);
      ex.scale(-1, 1);
    }
    ex.scale(BASE_PIXEL_SIZE, BASE_PIXEL_SIZE);
    ex.font = '0.5px Consolas, monospace'; // 这里使用0.5px，最终会*BASE_PIXEL_SIZE，字体会被放大到实际像素
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
    ex.restore();

    const footerY = headerHeight + BASE_PIXEL_SIZE * 2 + imgExportHeight;
    let tagX = 15 * contentScale, tagY = footerY + 6 * contentScale;

    for (const [code, count] of sorted) {
      const ci = currentPalette.find((c) => c.code === code);
      const colorHex = ci
          ? `#${ci.r.toString(16).padStart(2, '0')}${ci.g.toString(16).padStart(2, '0')}${ci.b.toString(16).padStart(2, '0')}`
          : '#ccc';
      const countText = `${count}`;

      ex.font = statFont;
      const codeWidth = ex.measureText(code).width + 2 * statPad;
      const countWidth = ex.measureText(countText).width + 2 * statPad;
      const tagWidth = codeWidth + countWidth;

      if (tagX + tagWidth > exportWidth - 20 * contentScale) {
        tagX = 15 * contentScale;
        tagY += lineHeight;
      }

      ex.fillStyle = bgColor || '#ffffff';
      ex.strokeStyle = '#ccc';
      ex.lineWidth = Math.max(0.5, contentScale);
      ex.fillRect(tagX, tagY, tagWidth, tagHeight);
      ex.strokeRect(tagX, tagY, tagWidth, tagHeight);

      ex.fillStyle = colorHex;
      ex.fillRect(tagX, tagY, codeWidth, tagHeight);

      const br = ci ? (ci.r * 299 + ci.g * 587 + ci.b * 114) / 1000 : 255;
      ex.fillStyle = br < 128 ? '#fff' : '#000';
      ex.textBaseline = 'middle';
      ex.textAlign = 'center';
      ex.fillText(code, tagX + codeWidth / 2, tagY + tagHeight / 2);

      // 绘制数量文字
      ex.fillStyle = '#333';
      ex.fillText(countText, tagX + codeWidth + countWidth / 2, tagY + tagHeight / 2);

      tagX += tagWidth + gap;
    }
  }

  // 绘制源文件区域
  if (exportSourceFile && sourceStripRows > 0) {
    const sourceAreaY = Math.round(headerHeight + BASE_PIXEL_SIZE * 2 + imgExportHeight + footerHeight);
    const stripCanvas = encodeSourceStrip(displayCanvas, imageWidth, imageHeight, exportWidth, sourceStripRows);
    // 直接写入像素数据，避免 drawImage 的透明合成（透明像素会被白色背景破坏）
    const stripData = stripCanvas.getContext('2d').getImageData(0, 0, exportWidth, sourceStripRows);
    ex.putImageData(stripData, 0, sourceAreaY);
  }

  return ec;
}

function exportSourceImage(artworkName) {
  const { displayCanvas } = props;
  if (!displayCanvas) return;
  return displayCanvas;
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
  return scaledCanvas
}

async function onConfirm() {
  if (exporting.value) return;
  exporting.value = true;
  await nextTick();
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
    let canvas;
    if (exportType.value === 'pattern') {
      canvas = exportImage(name, author, title, hasAuthor, grid, colorCode, exportMirror.value, exportSourceFile.value, pixelSize.value);
    } else if (exportType.value === 'source') {
      canvas = exportSourceImage(name);
    } else if (exportType.value === 'hd') {
      canvas = exportHDImage(name);
    }
    await exportCanvasImage(canvas, name)
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
.export-form {
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
</style>
