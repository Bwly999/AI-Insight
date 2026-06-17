import type { Config } from 'tailwindcss';
import preset from '@ai-insight/shared-ui/tailwind-preset';

// 见 doc/design-doc/08-前端架构.md、15-UIUX设计.md §15.3
const config: Config = {
  presets: [preset],
  // darkMode 由 [data-theme="admin"] 驱动（tokens.css 反相）
  darkMode: ['selector', '[data-theme="admin"]'],
  content: [
    './index.html',
    './src/**/*.{vue,ts,tsx}',
    '../../packages/shared-ui/src/**/*.{vue,ts}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
