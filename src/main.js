import {createApp} from 'vue'
import App from './App.vue'
import './assets/styles/global.scss'
import longpress from "./directives/longpress";  // 导入全局样式

const app = createApp(App)
app.directive('longpress', longpress);
app.mount('#app')
