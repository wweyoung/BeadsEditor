import _ from "lodash";

// 增量历史记录：每次只保存变更的单元格 patch，而非全量快照
export class BeadsHistory {
    constructor(index, maxHistory = 50) {
        this.undoStack = [];        // 撤销栈，每项为 [{r, c, oldVal, newVal}]
        this.redoStack = [];        // 重做栈
        this.maxHistory = maxHistory;
        this.currentState = null;   // 当前完整状态（用于 diff 计算）
        index.value = 0;
        this.index = index
    }

    // 保存当前状态（与上一次对比，只存变更）
    save(newV) {
        if (!this.currentState) {
            // 第一次保存，存完整快照
            this.currentState = _.cloneDeep(newV);
            this.index.value = 0;
            this.undoStack = [];
            this.redoStack = [];
            return;
        }

        // 和当前状态比对，生成 patch
        const patch = [];
        const oldState = this.currentState;
        const maxRows = Math.max(oldState.length, newV.length);
        for (let r = 0; r < maxRows; r++) {
            const oldRow = oldState[r];
            const newRow = newV[r];
            const maxCols = Math.max(oldRow ? oldRow.length : 0, newRow ? newRow.length : 0);
            for (let c = 0; c < maxCols; c++) {
                const oldVal = oldRow && c < oldRow.length ? (oldRow[c] ?? null) : null;
                const newVal = newRow && c < newRow.length ? (newRow[c] ?? null) : null;
                if (oldVal !== newVal) {
                    patch.push({ r, c, oldVal, newVal });
                }
            }
        }

        if (patch.length === 0) return; // 无变化

        this.undoStack.push(patch);
        this.redoStack = []; // 新操作清空重做栈
        this.currentState = _.cloneDeep(newV);
        this.index.value = this.undoStack.length;

        // 限制撤销栈大小
        if (this.undoStack.length > this.maxHistory) {
            // 丢弃最早的 patch，但需要将最早的 patch 中的旧值合并到 currentState 无法回退
            // 简单做法：shift 丢弃
            this.undoStack.shift();
            this.index.value = this.undoStack.length;
        }
    }

    // 撤销
    undo() {
        if (this.undoStack.length === 0) {
            return this.currentState ? _.cloneDeep(this.currentState) : [];
        }
        const patch = this.undoStack.pop();
        this.redoStack.push(patch);
        // 回退：将每个单元格恢复为 oldVal
        for (const { r, c, oldVal } of patch) {
            if (oldVal === null) {
                // 删除单元格（设为 null）
                if (this.currentState[r]) {
                    if (c < this.currentState[r].length) {
                        this.currentState[r][c] = null;
                    }
                }
            } else {
                // 确保行存在
                if (!this.currentState[r]) this.currentState[r] = [];
                this.currentState[r][c] = oldVal;
            }
        }
        this.index.value = this.undoStack.length;
        return _.cloneDeep(this.currentState);
    }

    // 重做
    redo() {
        if (this.redoStack.length === 0) {
            return this.currentState ? _.cloneDeep(this.currentState) : [];
        }
        const patch = this.redoStack.pop();
        this.undoStack.push(patch);
        // 重做：将每个单元格恢复为 newVal
        for (const { r, c, newVal } of patch) {
            if (newVal === null) {
                if (this.currentState[r]) {
                    if (c < this.currentState[r].length) {
                        this.currentState[r][c] = null;
                    }
                }
            } else {
                if (!this.currentState[r]) this.currentState[r] = [];
                this.currentState[r][c] = newVal;
            }
        }
        this.index.value = this.undoStack.length;
        return _.cloneDeep(this.currentState);
    }

    // 清空历史
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.currentState = null;
        this.index.value = 0;
    }
}