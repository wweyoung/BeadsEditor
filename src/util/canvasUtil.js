/**
 * Canvas 行列操作工具类
 */

export function rowColChange(canvas, type, index, direction, operation, count) {
    if (type === 'column') {
        if (operation === 'insert') {
            return addColumnsAt(canvas, index, count, direction)
        } else {
            return removeColumnsAt(canvas, index, count, direction)
        }
    } else {
        if (operation === 'insert') {
            return addRowsAt(canvas, index, count, direction)
        } else {
            return removeRowsAt(canvas, index, count, direction)
        }
    }
}

// ==================== 列操作 ====================

/**
 * 在指定列左侧/右侧添加列
 * @param {HTMLCanvasElement} canvas - 源 Canvas
 * @param {number} colIndex - 基准列索引
 * @param {number} count - 添加数量
 * @param {Object} fillColor - 填充颜色
 * @param {string} position - 'left' 或 'right'
 * @returns {HTMLCanvasElement}
 */
export function addColumnsAt(canvas, colIndex, count = 1, position = 'left') {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    if (colIndex < 0 || colIndex > width) {
        throw new Error(`列索引 ${colIndex} 超出范围 [0, ${width}]`);
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const newWidth = width + count;
    const newImageData = ctx.createImageData(newWidth, height);
    const newData = newImageData.data;

    const insertPos = position === 'left' ? colIndex : colIndex + 1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < newWidth; x++) {
            let srcX;
            if (x < insertPos) {
                srcX = x;
            } else if (x < insertPos + count) {
                // 新增的列：填充颜色
                const idx = (y * newWidth + x) * 4;
                newData[idx] = 0;
                newData[idx + 1] = 0;
                newData[idx + 2] = 0;
                newData[idx + 3] = 0;
                continue;
            } else {
                srcX = x - count;
            }

            const srcIdx = (y * width + srcX) * 4;
            const dstIdx = (y * newWidth + x) * 4;
            newData[dstIdx] = data[srcIdx];
            newData[dstIdx + 1] = data[srcIdx + 1];
            newData[dstIdx + 2] = data[srcIdx + 2];
            newData[dstIdx + 3] = data[srcIdx + 3];
        }
    }

    return createCanvasFromData(newImageData);
}


// ==================== 行操作 ====================


/**
 * 在指定行上方/下方添加行
 * @param {HTMLCanvasElement} canvas - 源 Canvas
 * @param {number} rowIndex - 基准行索引
 * @param {number} count - 添加数量
 * @param {Object} fillColor - 填充颜色
 * @param {string} position - 'top' 或 'bottom'
 * @returns {HTMLCanvasElement}
 */
export function addRowsAt(canvas, rowIndex, count = 1, position = 'top') {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    if (rowIndex < 0 || rowIndex > height) {
        throw new Error(`行索引 ${rowIndex} 超出范围 [0, ${height}]`);
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const newHeight = height + count;
    const newImageData = ctx.createImageData(width, newHeight);
    const newData = newImageData.data;

    // 计算插入位置（新增行的起始索引）
    const insertPos = position === 'top' ? rowIndex - 1 : rowIndex + 1;

    for (let y = 0; y < newHeight; y++) {
        for (let x = 0; x < width; x++) {
            let srcY;
            if (y < insertPos) {
                // 插入位置之前：直接复制原图行
                srcY = y;
            } else if (y < insertPos + count) {
                // 新增的行：填充透明色
                const idx = (y * width + x) * 4;
                newData[idx] = 0;
                newData[idx + 1] = 0;
                newData[idx + 2] = 0;
                newData[idx + 3] = 0;  // 完全透明
                continue;
            } else {
                // 插入位置之后：原图行向后偏移 count
                srcY = y - count;
            }

            const srcIdx = (srcY * width + x) * 4;
            const dstIdx = (y * width + x) * 4;
            newData[dstIdx] = data[srcIdx];
            newData[dstIdx + 1] = data[srcIdx + 1];
            newData[dstIdx + 2] = data[srcIdx + 2];
            newData[dstIdx + 3] = data[srcIdx + 3];
        }
    }

    return createCanvasFromData(newImageData);
}

// ==================== 列移除（支持方向） ====================

/**
 * 核心移除列方法（支持方向）
 * @param {HTMLCanvasElement} canvas - 源 Canvas
 * @param {number} startCol - 起始列索引
 * @param {number} count - 移除数量
 * @param {string} direction - 方向标识（仅用于校验）
 * @returns {HTMLCanvasElement}
 */
export function removeColumnsAt(canvas, startCol, count = 1, direction = 'left') {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 根据方向计算实际要删除的列范围
    let deleteStartCol = startCol;
    let deleteCount = count;

    if (direction === 'left') {
        // 向左移除：从 startCol 向左移除 count 列
        // 即删除 [startCol - count, startCol)
        deleteStartCol = startCol - count;
        deleteCount = count;
    } else if (direction === 'right') {
        // 向右移除：从 startCol 向右移除 count 列
        // 即删除 [startCol + 1, startCol + 1 + count)
        deleteStartCol = startCol + 1;
        deleteCount = count;
    } else {
        // 其他值按默认处理：从 startCol 开始移除 count 列
        deleteStartCol = startCol;
        deleteCount = count;
    }

    // 边界检查
    if (deleteStartCol < 0) {
        throw new Error(`移除起始列 ${deleteStartCol} 超出左边界`);
    }
    if (deleteStartCol + deleteCount > width) {
        throw new Error(`移除范围超出右边界，起始列: ${deleteStartCol}, 移除数量: ${deleteCount}, 总宽度: ${width}`);
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const newWidth = width - deleteCount;
    const newImageData = ctx.createImageData(newWidth, height);
    const newData = newImageData.data;

    for (let y = 0; y < height; y++) {
        let newX = 0;
        for (let x = 0; x < width; x++) {
            // 跳过要移除的列
            if (x >= deleteStartCol && x < deleteStartCol + deleteCount) continue;

            const srcIdx = (y * width + x) * 4;
            const dstIdx = (y * newWidth + newX) * 4;

            newData[dstIdx] = data[srcIdx];
            newData[dstIdx + 1] = data[srcIdx + 1];
            newData[dstIdx + 2] = data[srcIdx + 2];
            newData[dstIdx + 3] = data[srcIdx + 3];
            newX++;
        }
    }

    return createCanvasFromData(newImageData);
}
// ==================== 行移除（支持方向） ====================

/**
 * 核心移除行方法
 * @param {HTMLCanvasElement} canvas - 源 Canvas
 * @param {number} startRow - 起始行索引
 * @param {number} count - 移除数量
 * @returns {HTMLCanvasElement}
 */
export function removeRowsAt(canvas, startRow, count, direction) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 根据方向计算实际起始行和移除数量
    let actualStartRow = startRow;
    let actualCount = count;

    switch (direction) {
        case 'top':        // 从顶部开始删除 count 行
            actualStartRow = 0;
            actualCount = count;
            break;
        case 'bottom':     // 从底部开始删除 count 行
            actualStartRow = height - count;
            actualCount = count;
            break;
        case 'up':         // 向上移除：从 startRow 向上移除 count 行（删除 startRow 上方的行）
            actualStartRow = startRow - count;
            actualCount = count;
            break;
        case 'down':       // 向下移除：从 startRow 向下移除 count 行（删除 startRow 下方的行）
            actualStartRow = startRow + 1;
            actualCount = count;
            break;
        default:           // 默认：从 startRow 开始删除 count 行
            actualStartRow = startRow;
            actualCount = count;
            break;
    }

    // 边界检查
    if (actualStartRow < 0 || actualStartRow >= height) {
        throw new Error(`起始行索引 ${actualStartRow} 超出范围 [0, ${height - 1}]`);
    }
    if (actualStartRow + actualCount > height) {
        throw new Error(`移除范围超出边界，起始: ${actualStartRow}, 数量: ${actualCount}, 高度: ${height}`);
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const newHeight = height - actualCount;
    const newImageData = ctx.createImageData(width, newHeight);
    const newData = newImageData.data;

    let newY = 0;
    for (let y = 0; y < height; y++) {
        if (y >= actualStartRow && y < actualStartRow + actualCount) continue;

        const srcStart = y * width * 4;
        const dstStart = newY * width * 4;
        newData.set(data.subarray(srcStart, srcStart + width * 4), dstStart);
        newY++;
    }

    return createCanvasFromData(newImageData);
}

// ==================== 辅助函数 ====================

export function createCanvasFromData(imageData) {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

export function createCanvasFromImage(img) {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return canvas;
}

export function canvasMirror(canvas) {
    const mirrorCanvas = document.createElement('canvas');
    mirrorCanvas.width = canvas.width;
    mirrorCanvas.height = canvas.height;
    const ctx = mirrorCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(canvas, 0, 0);
    return mirrorCanvas;
}

export async function exportCanvasImage(canvas, artworkName) {
    return new Promise((resolve)=>{
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${artworkName}.png`;
            a.click();
            URL.revokeObjectURL(url);
            resolve()
        });
    })
}

/**
 * 遍历可视区域，将连续的需要绘制的单元格合并为 fillRect，消除 AA 缝隙
 * @param {number} vx - 可视区域起始 x（像素画坐标）
 * @param {number} vy - 可视区域起始 y
 * @param {number} vw - 可视区域宽度
 * @param {number} vh - 可视区域高度
 * @param {CanvasRenderingContext2D} ctx
 * @param {(x: number, y: number) => boolean} shouldFill - 返回 true 表示该格需要绘制
 */
export function fillMergedRects(vx, vy, vw, vh, ctx, shouldFill) {
    const endX = vx + vw;
    const endY = vy + vh;
    // 预计算二维布尔数组
    const fill = [];
    for (let y = vy; y < endY; y++) {
        const row = [];
        for (let x = vx; x < endX; x++) {
            row.push(shouldFill(x, y));
        }
        fill.push(row);
    }
    const rows = fill.length;
    const cols = rows > 0 ? fill[0].length : 0;

    // 贪心合并为最大矩形：先向右扩展，再向下扩展
    const path = new Path2D();
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (!fill[y][x]) continue;
            // 向右
            let w = 1;
            while (x + w < cols && fill[y][x + w]) w++;
            // 向下（需要相同的 x 范围全部为 true）
            let h = 1;
            while (y + h < rows) {
                let ok = true;
                for (let cx = x; cx < x + w; cx++) {
                    if (!fill[y + h][cx]) { ok = false; break; }
                }
                if (!ok) break;
                h++;
            }
            // 标记已合并
            for (let dy = 0; dy < h; dy++) {
                for (let dx = 0; dx < w; dx++) {
                    fill[y + dy][x + dx] = false;
                }
            }
            path.rect(vx + x, vy + y, w, h);
        }
    }
    ctx.fill(path);
}
