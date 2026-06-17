import { createApp } from 'vue';
import { createPinia } from 'pinia';

// 设计系统（见 packages/shared-ui/README.md）
import '@ai-insight/shared-ui/styles/fonts.css';
import '@ai-insight/shared-ui/styles/tokens.css';
import '@ai-insight/shared-ui/styles/editorial.css';
import './styles/main.css';

import App from './App.vue';
import router from './router';

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
