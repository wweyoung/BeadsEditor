import _ from "lodash";

// 历史记录：颜色变更存增量 patch，尺寸变更存全量快照
export class BeadsHistory {
    constructor(maxHistory = 200) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = maxHistory;
        this.currentState = null;
    }

    // 判断两个状态尺寸是否不同
    _dimsChanged(a, b) {
        if (a.length !== b.length) return true;
        for (let r = 0; r < a.length; r++) {
            const aLen = a[r] ? a[r].length : 0;
            const bLen = b[r] ? b[r].length : 0;
            if (aLen !== bLen) return true;
        }
        return false;
    }

    save(newV) {
        if (!this.currentState) {
            this.currentState = _.cloneDeep(newV);
            this.undoStack = [];
            this.redoStack = [];
            return;
        }

        // 尺寸变化 → 存全量快照
        if (this._dimsChanged(this.currentState, newV)) {
            this.undoStack.push({ type: 'full', state: _.cloneDeep(this.currentState) });
            this.redoStack = [];
            this.currentState = _.cloneDeep(newV);
        } else {
            // 仅颜色变化 → 存增量 patch
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
            if (patch.length === 0) return;

            this.undoStack.push({ type: 'patch', data: patch });
            this.redoStack = [];
            this.currentState = _.cloneDeep(newV);
        }

        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }
    }

    undo() {
        if (this.undoStack.length === 0) {
            return this.currentState ? _.cloneDeep(this.currentState) : [];
        }
        const entry = this.undoStack.pop();

        if (entry.type === 'full') {
            // 全量快照 → 整体替换
            this.redoStack.push({ type: 'full', state: _.cloneDeep(this.currentState) });
            this.currentState = _.cloneDeep(entry.state);
        } else {
            // 增量 patch → 逐格回退为 oldVal
            this.redoStack.push({ type: 'patch', data: entry.data });
            for (const { r, c, oldVal } of entry.data) {
                if (oldVal === null) {
                    if (this.currentState[r]) {
                        if (c < this.currentState[r].length) {
                            this.currentState[r][c] = null;
                        }
                    }
                } else {
                    if (!this.currentState[r]) this.currentState[r] = [];
                    this.currentState[r][c] = oldVal;
                }
            }
        }
        return _.cloneDeep(this.currentState);
    }

    redo() {
        if (this.redoStack.length === 0) {
            return this.currentState ? _.cloneDeep(this.currentState) : [];
        }
        const entry = this.redoStack.pop();

        if (entry.type === 'full') {
            // 全量快照 → 整体替换
            this.undoStack.push({ type: 'full', state: _.cloneDeep(this.currentState) });
            this.currentState = _.cloneDeep(entry.state);
        } else {
            // 增量 patch → 逐格恢复为 newVal
            this.undoStack.push({ type: 'patch', data: entry.data });
            for (const { r, c, newVal } of entry.data) {
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
        }
        return _.cloneDeep(this.currentState);
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.currentState = null;
    }
}