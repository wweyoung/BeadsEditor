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
