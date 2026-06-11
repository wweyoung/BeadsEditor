// plugins/toast.js
import { createApp, h } from 'vue';

const Toast = {
    install(app) {
        let toastContainer = null;
        let timer = null;

        const show = (message, duration = 2000) => {
            if (!message) {
                return;
            }
            if (toastContainer) {
                document.body.removeChild(toastContainer);
                if (timer) clearTimeout(timer);
            }

            const div = document.createElement('div');
            div.className = 'toast-message';
            div.textContent = message;
            div.style.cssText = `
                position: fixed;
                top: 20%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0, 0, 0, 0.7);
                color: white;
                padding: 10px 20px;
                border-radius: 8px;
                font-size: 14px;
                z-index: 9999;
                white-space: nowrap;
                max-width: 80%;
                word-break: break-word;
                white-space: normal;
                text-align: center;
                line-height: 1.4;
                pointer-events: none;
            `;

            document.body.appendChild(div);
            toastContainer = div;

            timer = setTimeout(() => {
                if (toastContainer) {
                    document.body.removeChild(toastContainer);
                    toastContainer = null;
                }
            }, duration);
        };

        app.config.globalProperties.$toast = { show };
    }
};

export default Toast;
