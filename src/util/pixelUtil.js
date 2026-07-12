import {PALETTE_MAP} from "../palette";

export function buildDefaultPixelArt() {
    const c = document.createElement('canvas');
    c.width = 50;
    c.height = 50;
    const d = c.getContext('2d');
    d.fillStyle = '#fff';
    d.fillRect(0, 0, 50, 50);
    const colors = ['#ff4444', '#4444ff', '#44ff44', '#ffff44', '#ff44ff', '#ff8800', '#00ffff', '#ff4488', '#88ff44', '#4488ff'];
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 5; col++) {
            d.fillStyle = colors[(row * 5 + col) % 10];
            d.fillRect(col * 10, row * 10, 10, 10);
        }
    }
    d.fillStyle = '#000';
    d.fillRect(5, 25, 2, 2);
    d.fillRect(13, 25, 2, 2);
    d.fillRect(5, 33, 10, 2);
    d.fillRect(6, 34, 8, 2);
    return c;
}

/**
 * 二维数组行列操作
 * @param {Array} table - 二维数组
 * @param {string} type - 'column' 或 'row'
 * @param {number} index - 基准索引
 * @param {string} direction - 方向: 'left'/'right' 或 'up'/'down'
 * @param {string} operation - 'insert' 或 'remove'
 * @param {number} count - 操作数量
 * @returns {Array} 新的二维数组
 */
export function rowColChange(table, type, index, direction, operation, count = 1) {
    if (type === 'column') {
        if (operation === 'insert') {
            return addColumns(table, index, count, direction);
        } else {
            return removeColumns(table, index, count, direction);
        }
    } else {
        if (operation === 'insert') {
            return addRows(table, index, count, direction);
        } else {
            return removeRows(table, index, count, direction);
        }
    }
}

// ==================== 列操作 ====================

/**
 * 添加列
 * @param {Array} table - 二维数组
 * @param {number} colIndex - 基准列索引
 * @param {number} count - 添加数量
 * @param {string} direction - 方向: 'left' | 'right'
 * @returns {Array}
 */
function addColumns(table, colIndex, count = 1, direction = 'right') {
    const rows = table.length;
    if (rows === 0) return table;

    const cols = table[0].length;

    if (colIndex < 0 || colIndex > cols) {
        throw new Error(`列索引 ${colIndex} 超出范围 [0, ${cols}]`);
    }

    // 计算插入位置
    const insertPos = direction === 'left' ? colIndex : colIndex + 1;

    // 创建新表
    const newTable = [];
    for (let i = 0; i < rows; i++) {
        const newRow = [];
        for (let j = 0; j < cols + count; j++) {
            if (j < insertPos) {
                newRow.push(table[i][j]);
            } else if (j < insertPos + count) {
                // 跳过，稍后插入空值
                continue;
            } else {
                newRow.push(table[i][j - count]);
            }
        }
        // 在指定位置插入 count 个空列
        for (let k = 0; k < count; k++) {
            newRow.splice(insertPos, 0, '');
        }
        newTable.push(newRow);
    }

    return newTable;
}

/**
 * 移除列
 * @param {Array} table - 二维数组
 * @param {number} colIndex - 基准列索引
 * @param {number} count - 移除数量
 * @param {string} direction - 方向: 'left' | 'right'
 * @returns {Array}
 */
function removeColumns(table, colIndex, count = 1, direction = 'left') {
    const rows = table.length;
    if (rows === 0) return table;

    const cols = table[0].length;

    // 计算要删除的起始列
    let deleteStart = direction === 'left' ? colIndex - count
        : direction === 'right' ? colIndex + 1
            : colIndex;

    // 边界修正
    if (deleteStart < 0) {
        count += deleteStart;
        deleteStart = 0;
    }

    if (deleteStart + count > cols) {
        count = cols - deleteStart;
    }

    // 无有效删除列，返回原表
    if (count <= 0) {
        return table.map(row => [...row]);
    }

    // 创建新表
    return table.map(row =>
        row.filter((_, j) => j < deleteStart || j >= deleteStart + count)
    );
}
// ==================== 行操作 ====================

/**
 * 添加行
 * @param {Array} table - 二维数组
 * @param {number} rowIndex - 基准行索引
 * @param {number} count - 添加数量
 * @param {string} direction
 * @returns {Array}
 */
function addRows(table, rowIndex, count = 1, direction = 'down') {
    if (table.length === 0) return table;

    const cols = table[0].length;
    const insertPos = direction === 'up' ? rowIndex : rowIndex + 1;
    const emptyRow = new Array(cols).fill('');
    const newTable = table.map(row => [...row]);

    newTable.splice(insertPos, 0, ...Array(count).fill().map(() => [...emptyRow]));

    return newTable;
}

/**
 * 移除行
 * @param {Array} table - 二维数组
 * @param {number} rowIndex - 基准行索引
 * @param {number} count - 移除数量
 * @param {string} direction
 * @returns {Array}
 */
function removeRows(table, rowIndex, count = 1, direction = 'up') {
    const rows = table.length;
    if (rows === 0) return table;

    // 计算要删除的起始行
    let deleteStart;
    if (direction === 'up') {
        deleteStart = rowIndex - count;
    } else if (direction === 'down') {
        deleteStart = rowIndex + 1;
    } else {
        deleteStart = rowIndex;
    }

    if (deleteStart < 0 || deleteStart >= rows) {
        throw new Error(`起始行索引 ${deleteStart} 超出范围 [0, ${rows - 1}]`);
    }
    if (deleteStart + count > rows) {
        count = rows - deleteStart
    }

    // 创建新表，跳过要删除的行
    const newTable = [];
    for (let i = 0; i < rows; i++) {
        if (i >= deleteStart && i < deleteStart + count) continue;
        newTable.push([...table[i]]);
    }

    return newTable;
}

const transparentColor = {r: 210, g: 210, b: 210, a: 255}

export function pixel2ImageData(pixel, canvas) {
    let idata;
    const ctx = canvas.getContext('2d');
    if (pixel.length === canvas.height && pixel[0].length === canvas.width) {
        idata = ctx.getImageData(0, 0, canvas.width, canvas.height);
    } else {
        idata = new ImageData(pixel[0].length, pixel.length)
    }
    const d = idata.data;

    // First pass: apply palette if not original mode
    let i = 0;
    for (let row = 0; row < pixel.length; row++) {
        for (let col = 0; col < pixel[0].length; col++, i += 4) {
            const colorCode = pixel[row][col]
            const color = PALETTE_MAP[colorCode]
            d[i] = color.r;
            d[i + 1] = color.g;
            d[i + 2] = color.b;
            d[i + 3] = color.a;
        }
    }
    canvas.width = idata.width;
    canvas.height = idata.height;
    ctx.putImageData(idata, 0, 0);
}

export function autoCropper(grid, padding = 1) {
    if (!grid?.length || !grid[0]?.length) return grid;

    let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
    for (let y = 0; y < grid.length; y++) {
        const row = grid[y];
        for (let x = 0; x < row.length; x++) {
            if (row[x]) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (minX > maxX || minY > maxY) return grid;

    const newWidth = maxX - minX + 1 + padding * 2;
    const nullRow = Array(newWidth).fill(null);
    const newCodes = [];

    for (let i = 0; i < padding; i++) {
        newCodes.push([...nullRow]);
    }

    for (let y = minY; y <= maxY; y++) {
        const paddedRow = [];
        for (let i = 0; i < padding; i++) {
            paddedRow.push(null);
        }
        paddedRow.push(...grid[y].slice(minX, maxX + 1));
        for (let i = 0; i < padding; i++) {
            paddedRow.push(null);
        }
        newCodes.push(paddedRow);
    }

    for (let i = 0; i < padding; i++) {
        newCodes.push([...nullRow]);
    }

    return newCodes;
}

export function fixGap(grid) {
    if (!grid?.length || !grid[0]?.length) return grid;

    const h = grid.length, w = grid[0].length;

    const isRowEmpty = (r) => {
        for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c]) return false;
        }
        return true;
    };

    const keepRow = new Array(h).fill(true);
    let r = 0;
    while (r < h) {
        if (isRowEmpty(r)) {
            const start = r;
            while (r < h && isRowEmpty(r)) r++;
            const len = r - start;
            if (len > 2) {
                for (let i = start + 2; i < r; i++) keepRow[i] = false;
            }
        } else {
            r++;
        }
    }

    let newGrid = grid.filter((_, i) => keepRow[i]);
    if (!newGrid.length) return grid;

    const h2 = newGrid.length, w2 = newGrid[0].length;
    const isColEmpty = (c) => {
        for (let r = 0; r < h2; r++) {
            if (newGrid[r][c]) return false;
        }
        return true;
    };

    const keepCol = new Array(w2).fill(true);
    let c = 0;
    while (c < w2) {
        if (isColEmpty(c)) {
            const start = c;
            while (c < w2 && isColEmpty(c)) c++;
            const len = c - start;
            if (len > 2) {
                for (let i = start + 2; i < c; i++) keepCol[i] = false;
            }
        } else {
            c++;
        }
    }

    newGrid = newGrid.map(row => row.filter((_, i) => keepCol[i]));
    return autoCropper(newGrid, 1);
}

export function outline(grid, strokeColor) {
    if (!grid?.length || !grid[0]?.length) return grid;

    const height = grid.length;
    const width = grid[0].length;
    const toFill = new Set();

    for (let row = 0; row < height; row++) {
        for (let col = 0; col < width; col++) {
            const current = grid[row][col];
            if (!current) continue;
            for (const [nx, ny] of [[col - 1, row], [col + 1, row], [col, row - 1], [col, row + 1]]) {
                if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
                if (!grid[ny][nx]) {
                    toFill.add(`${nx},${ny}`);
                }
            }
        }
    }

    const codes = grid.map(row => [...row]);
    for (const key of toFill) {
        const [col, row] = key.split(',').map(Number);
        codes[row][col] = strokeColor;
    }

    return codes;
}

export function autoLayout(grid) {
    if (!grid?.length || !grid[0]?.length) return grid;

    const visited = new Set();
    const components = [];

    for (let row = 0; row < grid.length; row++) {
        for (let col = 0; col < grid[row].length; col++) {
            if (!grid[row][col] || visited.has(`${col},${row}`)) continue;

            const queue = [[col, row]];
            visited.add(`${col},${row}`);
            const cells = [];
            let minX = col, maxX = col, minY = row, maxY = row;

            while (queue.length > 0) {
                const [cx, cy] = queue.shift();
                cells.push([cx, cy]);

                if (cx < minX) minX = cx;
                if (cx > maxX) maxX = cx;
                if (cy < minY) minY = cy;
                if (cy > maxY) maxY = cy;

                for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1]]) {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (nx >= 0 && nx < grid[0].length && ny >= 0 && ny < grid.length) {
                        if (grid[ny][nx] && !visited.has(`${nx},${ny}`)) {
                            visited.add(`${nx},${ny}`);
                            queue.push([nx, ny]);
                        }
                    }
                }
            }

            const width = maxX - minX + 1;
            const height = maxY - minY + 1;
            const data = [];
            for (let y = 0; y < height; y++) {
                data[y] = [];
                for (let x = 0; x < width; x++) {
                    data[y][x] = null;
                }
            }

            for (const [cx, cy] of cells) {
                const localX = cx - minX;
                const localY = cy - minY;
                if (localY >= 0 && localY < height && localX >= 0 && localX < width) {
                    data[localY][localX] = grid[cy][cx];
                }
            }

            components.push({ width, height, data, area: width * height });
        }
    }

    if (components.length === 0) return grid;

    components.sort((a, b) => b.area - a.area);

    function calculateLayout(maxWidth) {
        const shelves = [];
        let currentShelf = [];
        let currentShelfWidth = 0;
        let currentShelfHeight = 0;

        for (const comp of components) {
            const requiredWidth = currentShelfWidth + (currentShelfWidth > 0 ? 2 : 0) + comp.width;

            if (currentShelf.length > 0 && requiredWidth > maxWidth) {
                shelves.push({
                    items: currentShelf,
                    width: currentShelfWidth,
                    height: currentShelfHeight
                });
                currentShelf = [comp];
                currentShelfWidth = comp.width;
                currentShelfHeight = comp.height;
            } else {
                if (currentShelfWidth > 0) currentShelfWidth += 2;
                currentShelfWidth += comp.width;
                currentShelfHeight = Math.max(currentShelfHeight, comp.height);
                currentShelf.push(comp);
            }
        }

        if (currentShelf.length > 0) {
            shelves.push({
                items: currentShelf,
                width: currentShelfWidth,
                height: currentShelfHeight
            });
        }

        const layoutWidth = shelves.reduce((max, s) => Math.max(max, s.width), 0);
        const layoutHeight = shelves.reduce((sum, s) => sum + s.height + 2, 0) - 2;

        return { shelves, layoutWidth, layoutHeight };
    }

    function applyLayout(layout) {
        const newGrid = [];
        for (let y = 0; y < layout.layoutHeight; y++) {
            newGrid[y] = [];
            for (let x = 0; x < layout.layoutWidth; x++) {
                newGrid[y][x] = null;
            }
        }

        let currentY = 0;
        for (const shelf of layout.shelves) {
            let currentX = 0;
            for (const comp of shelf.items) {
                for (let ry = 0; ry < comp.height; ry++) {
                    for (let rx = 0; rx < comp.width; rx++) {
                        const targetY = currentY + ry;
                        const targetX = currentX + rx;
                        if (targetY >= 0 && targetY < layout.layoutHeight && targetX >= 0 && targetX < layout.layoutWidth) {
                            if (newGrid[targetY][targetX] === null) {
                                newGrid[targetY][targetX] = comp.data[ry][rx];
                            }
                        }
                    }
                }
                currentX += comp.width + 2;
            }
            currentY += shelf.height + 2;
        }

        return newGrid;
    }

    const maxCompWidth = components.reduce((max, c) => Math.max(max, c.width), 0);
    const totalArea = components.reduce((sum, c) => sum + c.area, 0);
    const totalWidthWithGaps = components.reduce((sum, c) => sum + c.width, 0) + (components.length - 1) * 2;

    const idealSide = Math.ceil(Math.sqrt(totalArea));
    const minWidth = maxCompWidth;
    const maxWidth = totalWidthWithGaps;

    let bestLayout = null;
    let bestRatio = Infinity;

    for (let targetWidth = minWidth; targetWidth <= maxWidth; targetWidth++) {
        const layout = calculateLayout(targetWidth);
        const ratio = Math.abs(layout.layoutWidth / layout.layoutHeight - 1);

        if (ratio < bestRatio || (ratio === bestRatio && layout.layoutWidth * layout.layoutHeight < (bestLayout?.layoutWidth * bestLayout?.layoutHeight || Infinity))) {
            bestRatio = ratio;
            bestLayout = layout;
        }
    }

    if (!bestLayout) return grid;

    const result = applyLayout(bestLayout);
    return autoCropper(result, 1);
}
