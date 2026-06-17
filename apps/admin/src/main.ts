import { createApp } from 'vue';
import { createPinia } from 'pinia';

// 设计系统（管理端叠加 admin.css，<html data-theme="admin"> 见 index.html）
import '@ai-insight/shared-ui/styles/fonts.css';
import '@ai-insight/shared-ui/styles/tokens.css';
import '@ai-insight/shared-ui/styles/editorial.css';
import '@ai-insight/shared-ui/styles/admin.css';
import './styles/main.css';

import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
