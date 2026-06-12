// directives/longpress.js
const DRAG_THRESHOLD = 5
export default {
    mounted(el, binding) {
        const { value: callback, arg: delay = 300 } = binding;
        let timer = null;
        let isLongPressTriggered = false;

        // 滑动检测相关变量
        let startX = 0;
        let startY = 0;
        let hasMoved = false;

        const start = (event) => {
            // 确保是鼠标左键或触摸
            if (event.button !== undefined && event.button !== 0) return;
            // 多指触摸不触发长按
            if (event.touches && event.touches.length > 1) return;

            // 重置长按状态
            isLongPressTriggered = false;

            // 记录起始位置
            const point = getPoint(event);
            startX = point.x;
            startY = point.y;
            hasMoved = false;

            // 启动长按计时器
            timer = setTimeout(() => {
                // 只有未滑动时才触发长按
                if (!hasMoved) {
                    isLongPressTriggered = true;
                    callback(event);
                }
            }, delay);
        };

        const move = (event) => {
            if (!timer) return; // 没有长按计时器，不处理

            const point = getPoint(event);
            const deltaX = Math.abs(point.x - startX);
            const deltaY = Math.abs(point.y - startY);

            // 如果移动超过阈值，标记为滑动并取消长按
            if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                hasMoved = true;
                cancel();
            }
        };

        // 清除计时器
        const end = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };

        // 取消（mouseleave/touchcancel）：清除计时器并重置长按标记，确保不触发事件
        const cancel = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
            isLongPressTriggered = false;
        };

        // 阻止长按后的 click 事件（使用 capture 阶段以早于 Vue 的 @click）
        const onClick = (event) => {
            if (isLongPressTriggered) {
                event.stopImmediatePropagation();
                event.preventDefault();
                isLongPressTriggered = false;
            }
        };

        // 获取坐标（兼容触摸和鼠标）
        const getPoint = (event) => {
            if (event.touches) {
                return {
                    x: event.touches[0].clientX,
                    y: event.touches[0].clientY
                };
            }
            return {
                x: event.clientX,
                y: event.clientY
            };
        };

        // 绑定事件（click 使用 capture 阶段，在 Vue @click 之前执行）
        el.addEventListener('mousedown', start);
        el.addEventListener('mousemove', move);
        el.addEventListener('mouseup', end);
        el.addEventListener('mouseleave', cancel);
        el.addEventListener('touchstart', start);
        el.addEventListener('touchmove', move);
        el.addEventListener('touchend', end);
        el.addEventListener('touchcancel', cancel);
        el.addEventListener('click', onClick, { capture: true });

        // 保存清理函数
        el._longPressCleanup = () => {
            el.removeEventListener('mousedown', start);
            el.removeEventListener('mousemove', move);
            el.removeEventListener('mouseup', end);
            el.removeEventListener('mouseleave', cancel);
            el.removeEventListener('touchstart', start);
            el.removeEventListener('touchmove', move);
            el.removeEventListener('touchend', end);
            el.removeEventListener('touchcancel', cancel);
            el.removeEventListener('click', onClick, { capture: true });
        };
    },
    unmounted(el) {
        if (el._longPressCleanup) {
            el._longPressCleanup();
        }
    }
};
