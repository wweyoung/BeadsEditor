<template>
  <div v-if="visible" class="modal-overlay" @click.self="onCancel">
    <div class="export-modal">
      <div class="modal-header">
        <span>导出图片</span>
        <button class="close-btn" :disabled="exporting" @click="onCancel">&times;</button>
      </div>
      <div class="modal-body">
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
      <div class="modal-footer">
        <button class="btn cancel" :disabled="exporting" @click="onCancel">取消</button>
        <button v-if="!exporting" class="btn confirm" @click="onConfirm">确认导出</button>
        <button v-if="exporting" class="btn confirm"><i class="iconfont icon-spinner"></i> 正在导出</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import {nextTick, ref, watch} from 'vue';
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
  originalCanvas: {
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
function exportImage(artworkName, authorName, exportTitle, exportAuthor, exportGrid, exportColorCode, exportMirror, exportSourceFile) {
  const { displayCanvas, colorCodes, currentPalette, bgColor, gridColor } = props;
  if (!displayCanvas) return;
  if (!artworkName) return;
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

  const MIN_PIXEL_SIZE = 28;
  const ps = 1;
  const effectivePixelSize = ps * MIN_PIXEL_SIZE;
  const COORD_BORDER = MIN_PIXEL_SIZE * ps;

  const imgExportWidth = imageWidth * effectivePixelSize;
  const imgExportHeight = imageHeight * effectivePixelSize;
  const exportWidth = imgExportWidth + COORD_BORDER * 2;

  // 内容字体比例：随图像宽度自适应，限制极端大小
  const contentScale = Math.max(0.4, Math.min(3, imgExportWidth / 800));

  // 构建标题文本
  const titleParts = [];
  if (exportTitle && artworkName) titleParts.push(artworkName);
  titleParts.push(`[${imageWidth}×${imageHeight} / ${colorKind}色 / 共${totalCount}颗]`);
  const titleText = titleParts.join('  ');

  // 标题字号：随图像宽度缩放，过长时自动缩小适配
  let titleFontSize = Math.round(Math.max(14, Math.min(48, 26 * contentScale)));
  const maxTitleWidth = exportWidth - 30;
  {
    const mc = document.createElement('canvas').getContext('2d');
    mc.font = `bold ${titleFontSize}px "Segoe UI", sans-serif`;
    const tw = mc.measureText(titleText).width;
    if (tw > maxTitleWidth) {
      titleFontSize = Math.max(8, Math.floor(titleFontSize * maxTitleWidth / tw));
    }
  }
  const headerHeight = Math.round(titleFontSize * 1.6);

  const sorted = Object.entries(colorCount).sort((a, b) => b[1] - a[1]);

  // 色号统计字号：随图像缩放，保证可读性和合理行数
  const statFontSize = Math.round(Math.max(9, Math.min(20, 14 * contentScale)));
  const tagHeight = Math.round(statFontSize * 1.3);
  const lineHeight = Math.round(statFontSize * 1.6);
  const gap = Math.round(statFontSize * 0.45);
  const statFont = `bold ${statFontSize}px Consolas, monospace`;
  const statPad = statFontSize * 0.7;

  // 预计算统计标签的行数，使用 exportWidth（含边框）
  let tempX = 15 * contentScale, rowCount = 1;
  for (const [code, count] of sorted) {
    const countText = `${count}`;
    const ex2 = document.createElement('canvas').getContext('2d');
    ex2.font = statFont;
    const codeWidth = ex2.measureText(code).width + 2 * statPad;
    const countWidth = ex2.measureText(countText).width + 2 * statPad;
    const tagWidth = codeWidth + countWidth;

    if (tempX + tagWidth > exportWidth - 20 * contentScale) {
      tempX = 15 * contentScale;
      rowCount++;
    }

    tempX += tagWidth + gap;
  }
  const footerHeight = rowCount * lineHeight + 8 * contentScale;

  // 计算源文件数据区域高度（如果需要导出）
  // 源文件像素合并为横条（多行拼接），大幅减少底部高度
  let sourceAreaHeight = 0;
  let sourceStripRows = 0;
  if (exportSourceFile && originalCanvas) {
    const origW = originalCanvas.width;
    const origH = originalCanvas.height;
    const totalPixels = origW * origH;
    const headerPixels = 6; // 2个魔数字节 + 4个宽高字节
    const totalStripPixels = headerPixels + totalPixels;
    sourceStripRows = Math.ceil(totalStripPixels / exportWidth);
    sourceAreaHeight = sourceStripRows; // 无标记线，只有横条数据
  }

  const exportHeight = imgExportHeight + headerHeight + footerHeight + COORD_BORDER * 2 + sourceAreaHeight;

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
  ex.translate(COORD_BORDER, headerHeight + COORD_BORDER);
  if (exportMirror) {
    ex.translate(imgExportWidth, 0);
    ex.scale(-1, 1);
  }
  ex.scale(effectivePixelSize / ps, effectivePixelSize / ps);
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

  const coordFontSize = Math.max(8, 0.5 * effectivePixelSize / ps);
  if (exportGrid) {
    ex.font = `${coordFontSize}px Consolas, monospace`;
    ex.textAlign = 'center';
    ex.textBaseline = 'middle';
    for (let x = 0; x < imageWidth; x += ps) {
      const sx = COORD_BORDER + x * effectivePixelSize + effectivePixelSize / 2;
      const sy = headerHeight + COORD_BORDER / 2;
      ex.fillStyle = '#aaa';
      ex.fillRect(sx - effectivePixelSize / 2, headerHeight, effectivePixelSize, COORD_BORDER);
      ex.fillStyle = '#000';
      ex.fillText(`${x + 1}`, sx, sy);
    }
    for (let x = 0; x < imageWidth; x += ps) {
      const sx = COORD_BORDER + x * effectivePixelSize + effectivePixelSize / 2;
      const sy = headerHeight + imgExportHeight + COORD_BORDER + COORD_BORDER / 2;
      ex.fillStyle = '#aaa';
      ex.fillRect(sx - effectivePixelSize / 2, headerHeight + imgExportHeight + COORD_BORDER, effectivePixelSize, COORD_BORDER);
      ex.fillStyle = '#000';
      ex.fillText(`${x + 1}`, sx, sy);
    }
    for (let y = 0; y < imageHeight; y += ps) {
      const sx = COORD_BORDER / 2;
      const sy = headerHeight + COORD_BORDER + y * effectivePixelSize + effectivePixelSize / 2;
      ex.fillStyle = '#aaa';
      ex.fillRect(0, sy - effectivePixelSize / 2, COORD_BORDER, effectivePixelSize);
      ex.fillStyle = '#000';
      ex.fillText(`${y + 1}`, sx, sy);
    }
    for (let y = 0; y < imageHeight; y += ps) {
      const sx = COORD_BORDER + imgExportWidth + COORD_BORDER / 2;
      const sy = headerHeight + COORD_BORDER + y * effectivePixelSize + effectivePixelSize / 2;
      ex.fillStyle = '#aaa';
      ex.fillRect(COORD_BORDER + imgExportWidth, sy - effectivePixelSize / 2, COORD_BORDER, effectivePixelSize);
      ex.fillStyle = '#000';
      ex.fillText(`${y + 1}`, sx, sy);
    }
  }

  if (exportColorCode && colorCodes && currentPalette) {
    ex.save();
    ex.translate(COORD_BORDER, headerHeight + COORD_BORDER);
    if (exportMirror) {
      ex.translate(imgExportWidth, 0);
      ex.scale(-1, 1);
    }
    ex.scale(effectivePixelSize / ps, effectivePixelSize / ps);
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
    ex.restore();

    const footerY = headerHeight + COORD_BORDER * 2 + imgExportHeight;
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

  // 绘制源文件区域（如果有）
  // 使用2像素魔数标记 + 宽高编码，无视觉可见标记
  if (exportSourceFile && originalCanvas) {
    const origW = originalCanvas.width;
    const origH = originalCanvas.height;
    const totalPixels = origW * origH;
    const headerPixels = 6; // 2个魔数字节 + 4个宽高字节
    const stripWidth = exportWidth; // 横条填满整行宽度

    const sourceAreaY = headerHeight + COORD_BORDER * 2 + imgExportHeight + footerHeight;

    // 创建横条画布（填充像素数据）
    const stripCanvas = document.createElement('canvas');
    stripCanvas.width = stripWidth;
    stripCanvas.height = sourceStripRows;
    const stripCtx = stripCanvas.getContext('2d');
    const stripImageData = stripCtx.createImageData(stripWidth, sourceStripRows);
    const stripBuf = stripImageData.data;

    // 写入内联头部（6像素：2魔数标记 + 原始宽高）
    // 魔数用极低RGB值（1,1,0 和 2,2,0），alpha=255不透明，视觉上接近黑色几乎不可见
    // 魔数像素0: (1,1,0,255)
    stripBuf[0] = 1; stripBuf[1] = 1; stripBuf[2] = 0; stripBuf[3] = 255;
    // 魔数像素1: (2,2,0,255)
    stripBuf[4] = 2; stripBuf[5] = 2; stripBuf[6] = 0; stripBuf[7] = 255;
    // 像素2: W低字节，像素3: W高字节，像素4: H低字节，像素5: H高字节
    stripBuf[8] = origW & 0xFF; stripBuf[9] = 0; stripBuf[10] = 0; stripBuf[11] = 255;
    stripBuf[12] = (origW >> 8) & 0xFF; stripBuf[13] = 0; stripBuf[14] = 0; stripBuf[15] = 255;
    stripBuf[16] = origH & 0xFF; stripBuf[17] = 0; stripBuf[18] = 0; stripBuf[19] = 255;
    stripBuf[20] = (origH >> 8) & 0xFF; stripBuf[21] = 0; stripBuf[22] = 0; stripBuf[23] = 255;

    // 复制源文件像素数据到横条
    const srcCtx = originalCanvas.getContext('2d');
    const srcImageData = srcCtx.getImageData(0, 0, origW, origH);
    const srcData = srcImageData.data;
    for (let i = 0; i < totalPixels; i++) {
      const dstIdx = (headerPixels + i) * 4;
      const srcIdx = i * 4;
      stripBuf[dstIdx] = srcData[srcIdx];
      stripBuf[dstIdx + 1] = srcData[srcIdx + 1];
      stripBuf[dstIdx + 2] = srcData[srcIdx + 2];
      stripBuf[dstIdx + 3] = srcData[srcIdx + 3];
    }
    stripCtx.putImageData(stripImageData, 0, 0);

    // 绘制横条（紧接在图案区域之后，无标记线偏移）
    ex.imageSmoothingEnabled = false;
    ex.drawImage(stripCanvas, 0, sourceAreaY);
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
      canvas = exportImage(name, author, title, hasAuthor, grid, colorCode, exportMirror.value, exportSourceFile.value);
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

.modal-body {
  position: relative;
}
</style>
