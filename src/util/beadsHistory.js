import _ from "lodash";


export class BeadsHistory {
    constructor(index, maxHistory = 50) {
        this.history = [];      // 历史状态栈
        this.maxHistory = maxHistory;
        index.value = -1;
        this.index = index
    }

    // 保存当前状态
    save(newV) {
        const oldV = this.history[this.index.value]
        if (oldV === newV || _.isEqual(oldV, newV)) return;
        if (this.index.value >= this.maxHistory) {
            this.history.shift()
        } else {
            this.index.value = this.index.value + 1
        }
        this.history[this.index.value] = _.cloneDeep(newV);
        this.history.length = this.index.value + 1
    }

    // 撤销
    undo() {
        if (this.index.value <= 0) return this.history[this.index.value];
        return _.cloneDeep(this.history[--this.index.value])
    }

    // 重做
    redo() {
        if (this.index.value + 1 >= this.history.length) return this.history[this.index.value];
        return _.cloneDeep(this.history[++this.index.value])
    }

    // 清空历史
    clear() {
        this.history = [];
        this.redoStack = [];
        this.saveState();
    }
}
