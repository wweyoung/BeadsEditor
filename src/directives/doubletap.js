// directives/doubletap.js
export default {
    mounted(el, binding) {
        const callback = binding.value;
        let lastTap = 0;
        const delay = binding.arg || 300;

        const onTouchStart = (event) => {
            // 忽略多指操作（如双指缩放），避免误判为双击
            if (event.touches.length > 1) return;
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;

            if (tapLength < delay && tapLength > 0) {
                callback(event);
                event.preventDefault();
            }

            lastTap = currentTime;
        };

        // 同时支持 PC 端双击
        const onDoubleClick = (event) => {
            callback(event);
        };

        el.addEventListener('touchstart', onTouchStart);
        el.addEventListener('dblclick', onDoubleClick);

        el._doubleTapCleanup = () => {
            el.removeEventListener('touchstart', onTouchStart);
            el.removeEventListener('dblclick', onDoubleClick);
        };
    },
    unmounted(el) {
        if (el._doubleTapCleanup) {
            el._doubleTapCleanup();
        }
    }
};
