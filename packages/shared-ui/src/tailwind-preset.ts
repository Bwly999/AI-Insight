/**
 * Tailwind 预设：把设计 token 暴露为 Tailwind 颜色 / 字体。
 * 见 doc/design-doc/15-UIUX设计.md。
 *
 * 用法（apps/user/tailwind.config.ts / apps/admin）：
 *   import preset from '@ai-insight/shared-ui/tailwind-preset'
 *   export default { presets: [preset], content: [...] }
 *
 * 这样两端可直接用：bg-paper text-ink text-vermillion font-serif 等，
 * 且因 token 是 CSS 变量，[data-theme] 切换即可反相。
 */
import type { Config } from 'tailwindcss';

const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',
        'paper-2': 'var(--paper-2)',
        ink: 'var(--ink)',
        'ink-2': 'var(--ink-2)',
        'ink-3': 'var(--ink-3)',
        rule: 'var(--rule)',
        vermillion: 'var(--vermillion)',
        mustard: 'var(--mustard)',
        forest: 'var(--forest)',
        cobalt: 'var(--cobalt)',
        rose: 'var(--rose)',
      },
      fontFamily: {
        serif: ['var(--font-serif)'],
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      maxWidth: {
        editorial: 'var(--max-width)',
      },
    },
  },
};

export default preset;
export type { Config };
