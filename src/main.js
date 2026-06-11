import {createApp} from 'vue'
import App from './App.vue'
import './assets/styles/global.scss'
import longpress from "./directives/longpress";
import doubletap from "./directives/doubletap";
import Toast from "./plugins/toast";  // 导入全局样式

const app = createApp(App)
app.directive('longpress', longpress);
app.directive('doubletap', doubletap);
app.use(Toast);
app.mount('#app')

// 监听页面关闭或刷新
window.addEventListener('beforeunload', (event) => {
    // 设置提示信息
    event.preventDefault();
    event.returnValue = '确定要离开吗？未保存的数据将会丢失。';
    return event.returnValue;
});
