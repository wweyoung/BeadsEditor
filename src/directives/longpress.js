// directives/longpress.js
export default {
    mounted(el, binding) {
        const { value: callback, arg: delay = 500 } = binding;
        let timer = null;
        let isLongPressTriggered = false; // 标记是否已触发长按

        const start = (event) => {
            // 确保是鼠标左键或触摸
            if (event.button !== undefined && event.button !== 0) return;

            isLongPressTriggered = false;
            timer = setTimeout(() => {
                isLongPressTriggered = true;
                callback(event);
            }, delay);
        };

        const cancel = () => {
            if (timer) {
                clearTimeout(timer);
                timer = null;
            }
        };

        // 阻止长按后的 click 事件
        const onClick = (event) => {
            if (isLongPressTriggered) {
                event.stopPropagation();
                event.preventDefault();
                isLongPressTriggered = false;
            }
        };

        el.addEventListener('mousedown', start);
        el.addEventListener('mouseup', cancel);
        el.addEventListener('mouseleave', cancel);
        el.addEventListener('touchstart', start);
        el.addEventListener('touchend', cancel);
        el.addEventListener('touchcancel', cancel);
        el.addEventListener('click', onClick);

        // 保存清理函数
        el._longPressCleanup = () => {
            el.removeEventListener('mousedown', start);
            el.removeEventListener('mouseup', cancel);
            el.removeEventListener('mouseleave', cancel);
            el.removeEventListener('touchstart', start);
            el.removeEventListener('touchend', cancel);
            el.removeEventListener('touchcancel', cancel);
            el.removeEventListener('click', onClick);
        };
    },
    unmounted(el) {
        if (el._longPressCleanup) {
            el._longPressCleanup();
        }
    }
};
