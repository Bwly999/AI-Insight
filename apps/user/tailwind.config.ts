import type { Config } from 'tailwindcss';
import preset from '@ai-insight/shared-ui/tailwind-preset';

// 见 doc/design-doc/08-前端架构.md、15-UIUX设计.md
const config: Config = {
  presets: [preset],
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
