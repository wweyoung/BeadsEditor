import { ref, watch, getCurrentInstance } from 'vue';
import { fillCellBg, fillMergedRects, resolveTextColor } from '../util/canvasUtil';

export function useSelection(colorCodes, redrawCanvas) {
  const proxy = getCurrentInstance().proxy;

  // =============================================
  // 选区状态
  // =============================================
  const selType = ref('rect');
  const selAction = ref('new');
  const selection = ref(new Set());
  const isSelecting = ref(false);
  const selRectStart = ref(null);
  const selRectEnd = ref(null);
  const isMovingSelection = ref(false);
  const originalSelection = ref(new Set());
  const selMoveGrab = ref(null);
  const moveOffset = ref({dc: 0, dr: 0});
  const lassoPath = ref(new Set());
  const wandMode = ref('single');

  // =============================================
  // 选区核心操作
  // =============================================
  function clearSelection() {
    selection.value = new Set();
    isSelecting.value = false;
    selRectStart.value = null;
    selRectEnd.value = null;
    isMovingSelection.value = false;
    originalSelection.value = new Set();
    selMoveGrab.value = null;
    moveOffset.value = {dc: 0, dr: 0};
    lassoPath.value = new Set();
    selAction.value = 'new';
    redrawCanvas();
  }

  function getRectSelection(col1, row1, col2, row2) {
    const w = colorCodes.value[0].length;
    const h = colorCodes.value.length;
    const sCol = Math.max(0, Math.min(col1, col2));
    const eCol = Math.min(w - 1, Math.max(col1, col2));
    const sRow = Math.max(0, Math.min(row1, row2));
    const eRow = Math.min(h - 1, Math.max(row1, row2));
    const result = new Set();
    for (let r = sRow; r <= eRow; r++) {
      for (let c = sCol; c <= eCol; c++) {
        result.add(`${c},${r}`);
      }
    }
    return result;
  }

  function getLassoSelection(pathCells) {
    if (pathCells.size < 3) return new Set(pathCells);
    const verts = [];
    for (const key of pathCells) {
      const [c, r] = key.split(',').map(Number);
      verts.push({x: c + 0.5, y: r + 0.5});
    }
    let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
    for (const key of pathCells) {
      const [c, r] = key.split(',').map(Number);
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
    }
    function isInside(px, py) {
      let inside = false;
      for (let i = 0, j = verts.length - 1; i < verts.length; j = i++) {
        const xi = verts[i].x, yi = verts[i].y;
        const xj = verts[j].x, yj = verts[j].y;
        const intersect = ((yi > py) !== (yj > py))
            && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }
    const result = new Set();
    for (const key of pathCells) result.add(key);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const key = `${c},${r}`;
        if (result.has(key)) continue;
        if (isInside(c + 0.5, r + 0.5)) {
          result.add(key);
        }
      }
    }
    return result;
  }

  function getWandSelection(col, row, mode) {
    const targetCode = colorCodes.value[row]?.[col];
    if (targetCode === undefined) return new Set();
    const h = colorCodes.value.length, w = colorCodes.value[0].length;
    const visited = new Set();
    const queue = [[col, row]];
    while (queue.length) {
      const [c, r] = queue.shift();
      const key = `${c},${r}`;
      if (visited.has(key)) continue;
      if (r < 0 || r >= h || c < 0 || c >= w) continue;
      if (mode === 'multi') {
        if (!colorCodes.value[r][c]) continue;
      } else {
        if (colorCodes.value[r][c] !== targetCode) continue;
      }
      visited.add(key);
      queue.push([c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]);
    }
    return visited;
  }

  function applySelection(newSel) {
    // 过滤空白格
    const nonEmpty = new Set();
    for (const key of newSel) {
      const [c, r] = key.split(',').map(Number);
      const code = colorCodes.value[r]?.[c];
      if (code) nonEmpty.add(key);
    }
    if (selAction.value === 'new') {
      selection.value = nonEmpty;
    } else if (selAction.value === 'union') {
      const merged = new Set(selection.value);
      for (const k of nonEmpty) merged.add(k);
      selection.value = merged;
    } else if (selAction.value === 'subtract') {
      const merged = new Set(selection.value);
      for (const k of nonEmpty) merged.delete(k);
      selection.value = merged;
      if (selection.value.size === 0) {
        selAction.value = 'new'
      }
    }
  }

  function deleteSelection() {
    if (selection.value.size === 0) return;
    for (const key of selection.value) {
      const [c, r] = key.split(',').map(Number);
      if (colorCodes.value[r]?.[c] !== undefined) {
        colorCodes.value[r][c] = null;
      }
    }
    clearSelection();
  }

  // =============================================
  // 选区移动 / 复制
  // =============================================
  function startSelectionMove() {
    if (selection.value.size === 0) return;
    isMovingSelection.value = false;
    originalSelection.value = new Set(selection.value);
    selMoveGrab.value = null;
    moveOffset.value = {dc: 0, dr: 0};
    const cur = selAction.value;
    if (cur === 'move') {
      proxy.$toast.show('在选区内拖拽移动，点击"确认"确认');
    } else if (cur === 'copy') {
      proxy.$toast.show('在选区内拖拽复制，点击"确认"确认');
    }
  }

  function beginSelectionDrag(col, row) {
    if (selAction.value !== 'move' && selAction.value !== 'copy') return false;
    if (selection.value.size === 0) return false;
    const {dc: curDc, dr: curDr} = moveOffset.value;
    const key = `${col},${row}`;
    let grabCol = col, grabRow = row;
    if (selection.value.has(`${col - curDc},${row - curDr}`)) {
      grabCol = col - curDc; grabRow = row - curDr;
    } else if (selection.value.has(key)) {
      grabCol = col; grabRow = row;
    } else {
      return false;
    }
    isMovingSelection.value = true;
    originalSelection.value = new Set(selection.value);
    selMoveGrab.value = {col: grabCol, row: grabRow};
    return true;
  }

  function updateSelectionDrag(col, row) {
    if (!isMovingSelection.value || !selMoveGrab.value) return;
    const dc = col - selMoveGrab.value.col;
    const dr = row - selMoveGrab.value.row;
    moveOffset.value = {dc, dr};
  }

  function applySelectionMove() {
    if (selAction.value !== 'move' && selAction.value !== 'copy') return;
    const {dc, dr} = moveOffset.value;
    const grid = colorCodes.value;
    const orig = [...originalSelection.value];
    const backup = {};
    for (const key of orig) {
      const [c, r] = key.split(',').map(Number);
      backup[key] = grid[r]?.[c] ?? null;
    }
    if (selAction.value === 'move') {
      for (const key of orig) {
        const [c, r] = key.split(',').map(Number);
        if (grid[r]?.[c] !== undefined) grid[r][c] = null;
      }
    }
    const newSel = new Set();
    for (const key of orig) {
      const [c, r] = key.split(',').map(Number);
      const nc = c + dc, nr = r + dr;
      if (nr >= 0 && nr < grid.length && nc >= 0 && nc < grid[0].length) {
        grid[nr][nc] = backup[key];
        newSel.add(`${nc},${nr}`);
      }
    }
    selection.value = newSel;
    isMovingSelection.value = false;
    originalSelection.value = new Set();
    selMoveGrab.value = null;
    moveOffset.value = {dc: 0, dr: 0};
    // 移动完成后自动取消选区和移动状态；复制则保留选区
    if (selAction.value === 'move') {
      selAction.value = 'new';
      selection.value = new Set();
    }
  }

  // =============================================
  // 选区镜像（左右反转选区和内容）
  // =============================================
  function mirrorSelection() {
    const sel = selection.value;
    if (sel.size === 0) return;
    const grid = colorCodes.value;
    const w = grid[0]?.length ?? 0;
    // 求包围盒
    let minC = Infinity, maxC = -Infinity;
    for (const key of sel) {
      const [c] = key.split(',').map(Number);
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
    // 快照 → 清除原位置 → 写入镜像位置
    const snapshot = {};
    for (const key of sel) {
      const [c, r] = key.split(',').map(Number);
      snapshot[key] = grid[r][c];
      grid[r][c] = null;
    }
    const newSel = new Set();
    for (const key of sel) {
      const [c, r] = key.split(',').map(Number);
      const mc = minC + maxC - c;
      if (mc < 0 || mc >= w) continue;
      grid[r][mc] = snapshot[key];
      newSel.add(`${mc},${r}`);
    }
    selection.value = newSel;
  }

  // =============================================
  // watcher：选区操作模式切换
  // =============================================
  watch(selAction, (newVal, oldVal) => {
    if (newVal === 'move' || newVal === 'copy') {
      startSelectionMove();
    } else if (oldVal === 'move' || oldVal === 'copy') {
      isMovingSelection.value = false;
      selMoveGrab.value = null;
      moveOffset.value = {dc: 0, dr: 0};
      redrawCanvas();
    }
  });

  // =============================================
  // 选区绘制
  // =============================================
  function drawSelectionMask(vx, vy, vw, vh, { ctx, scale, colorMode, showColorCode, bgColor, currentPalette }) {
    if (!ctx) return;
    const sel = selection.value;
    const h = colorCodes.value.length;
    const w = colorCodes.value[0]?.length ?? 0;
    const endX = Math.min(vx + vw, w);
    const endY = Math.min(vy + vh, h);
    if (endX <= vx || endY <= vy) return;

    // 遮罩非选中区域
    if (sel.size > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      fillMergedRects(vx, vy, endX - vx, endY - vy, ctx, (x, y) => !sel.has(`${x},${y}`));

      // 选中区域边框
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 1.5 / scale;
      ctx.setLineDash([]);
      for (const key of sel) {
        const [x, y] = key.split(',').map(Number);
        if (x < vx || x >= endX || y < vy || y >= endY) continue;
        const top = sel.has(`${x},${y - 1}`);
        const bottom = sel.has(`${x},${y + 1}`);
        const left = sel.has(`${x - 1},${y}`);
        const right = sel.has(`${x + 1},${y}`);
        if (!top) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y); ctx.stroke(); }
        if (!bottom) { ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + 1, y + 1); ctx.stroke(); }
        if (!left) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 1); ctx.stroke(); }
        if (!right) { ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + 1); ctx.stroke(); }
      }

      // 拖拽移动时的偏移预览
      const { dc, dr } = moveOffset.value;
      if (dc !== 0 || dr !== 0) {
        ctx.save();
        // 收集可视区域内的选中格子
        const visCells = [];
        for (const key of sel) {
          const [cx, cy] = key.split(',').map(Number);
          if (cx < vx || cx >= endX || cy < vy || cy >= endY) continue;
          visCells.push({ cx, cy, code: colorCodes.value[cy]?.[cx] });
        }
        // 移动模式：清空原位置
        if (selAction.value === 'move') {
          for (const { cx, cy } of visCells) fillCellBg(ctx, cx, cy, null, currentPalette, bgColor);
        }
        // 偏移在画布内且在可视区域内的格子
        const offCells = [];
        for (const key of sel) {
          const [cx, cy] = key.split(',').map(Number);
          const nx = cx + dc, ny = cy + dr;
          if (ny < 0 || ny >= h || nx < 0 || nx >= w) continue;
          if (nx < vx || nx >= endX || ny < vy || ny >= endY) continue;
          offCells.push({ cx, cy, nx, ny, code: colorCodes.value[cy]?.[cx] });
        }
        if (offCells.length > 0) {
          // 偏移位置背景
          for (const { nx, ny, code } of offCells) fillCellBg(ctx, nx, ny, code, currentPalette, bgColor);
          // 网格线
          ctx.strokeStyle = 'rgba(180,170,160,0.25)';
          ctx.lineWidth = Math.max(0.1, 0.05 / scale);
          for (const { nx, ny } of offCells) ctx.strokeRect(nx, ny, 1, 1);
          // 色号文字
          if (showColorCode && colorMode !== 'original' && scale >= 8) {
            ctx.font = '0.5px Consolas, monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (const { nx, ny, code } of offCells) {
              if (!code) continue;
              ctx.fillStyle = resolveTextColor(code, currentPalette);
              ctx.fillText(code, nx + 0.5, ny + 0.5);
            }
          }
          // 选区虚线边框
          ctx.strokeStyle = 'rgba(0, 191, 255, 0.6)';
          ctx.lineWidth = 1.5 / scale;
          ctx.setLineDash([3 / scale, 2 / scale]);
          for (const { cx, cy, nx, ny } of offCells) {
            const t = sel.has(`${cx},${cy - 1}`);
            const b = sel.has(`${cx},${cy + 1}`);
            const l = sel.has(`${cx - 1},${cy}`);
            const r = sel.has(`${cx + 1},${cy}`);
            if (!t) { ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx + 1, ny); ctx.stroke(); }
            if (!b) { ctx.beginPath(); ctx.moveTo(nx, ny + 1); ctx.lineTo(nx + 1, ny + 1); ctx.stroke(); }
            if (!l) { ctx.beginPath(); ctx.moveTo(nx, ny); ctx.lineTo(nx, ny + 1); ctx.stroke(); }
            if (!r) { ctx.beginPath(); ctx.moveTo(nx + 1, ny); ctx.lineTo(nx + 1, ny + 1); ctx.stroke(); }
          }
          ctx.setLineDash([]);
        }
        ctx.restore();
      }

      ctx.restore();
    }

    // 正在绘制的选区轮廓
    if (isSelecting.value && selRectStart.value && selRectEnd.value) {
      ctx.save();
      ctx.strokeStyle = '#00BFFF';
      ctx.lineWidth = 1.5 / scale;
      if (selType.value === 'lasso') {
        ctx.setLineDash([]);
        const path = lassoPath.value;
        for (const key of path) {
          const [col, row] = key.split(',').map(Number);
          if (row >= vy && row < endY && col >= vx && col < endX) {
            ctx.fillStyle = 'rgba(0, 191, 255, 0.2)';
            ctx.fillRect(col, row, 1, 1);
            ctx.strokeRect(col, row, 1, 1);
          }
        }
      } else {
        ctx.setLineDash([2 / scale, 1.5 / scale]);
        const sx = Math.min(selRectStart.value.col, selRectEnd.value.col);
        const sy = Math.min(selRectStart.value.row, selRectEnd.value.row);
        const ex = Math.max(selRectStart.value.col, selRectEnd.value.col) + 1;
        const ey = Math.max(selRectStart.value.row, selRectEnd.value.row) + 1;
        ctx.strokeRect(sx, sy, ex - sx, ey - sy);
      }
      ctx.restore();
    }
  }

  return {
    selType, selAction, selection, isSelecting,
    selRectStart, selRectEnd,
    isMovingSelection, originalSelection, selMoveGrab, moveOffset,
    lassoPath, wandMode,
    clearSelection, getRectSelection, getLassoSelection, getWandSelection,
    applySelection, deleteSelection,
    startSelectionMove, beginSelectionDrag, updateSelectionDrag, applySelectionMove,
    mirrorSelection,
    drawSelectionMask,
  };
}
