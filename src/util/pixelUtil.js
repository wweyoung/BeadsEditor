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
    let deleteStart;
    if (direction === 'left') {
        deleteStart = colIndex - count;
    } else if (direction === 'right') {
        deleteStart = colIndex + 1;
    } else {
        deleteStart = colIndex;
    }

    if (deleteStart < 0 || deleteStart >= cols) {
        throw new Error(`起始列索引 ${deleteStart} 超出范围 [0, ${cols - 1}]`);
    }
    if (deleteStart + count > cols) {
        throw new Error(`移除范围超出边界`);
    }

    // 创建新表，跳过要删除的列
    const newTable = [];
    for (let i = 0; i < rows; i++) {
        const newRow = [];
        for (let j = 0; j < cols; j++) {
            if (j >= deleteStart && j < deleteStart + count) continue;
            newRow.push(table[i][j]);
        }
        newTable.push(newRow);
    }

    return newTable;
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
        throw new Error(`移除范围超出边界`);
    }

    // 创建新表，跳过要删除的行
    const newTable = [];
    for (let i = 0; i < rows; i++) {
        if (i >= deleteStart && i < deleteStart + count) continue;
        newTable.push([...table[i]]);
    }

    return newTable;
}

export function pixel2ImageData(pixel) {
    const idata = new ImageData(pixel[0].length, pixel.length)
    const d = idata.data;

    // First pass: apply palette if not original mode
    let i = 0;
    for (let row = 0; row <pixel.length; row++) {
        for (let col = 0; col <pixel[0].length; col++, i+=4) {
            const color = PALETTE_MAP[pixel[row][col]] ?? PALETTE_MAP['']
            d[i] = color.r;
            d[i + 1] = color.g;
            d[i + 2] = color.b;
            d[i + 3] = color.a;
        }
    }
    return idata
}
