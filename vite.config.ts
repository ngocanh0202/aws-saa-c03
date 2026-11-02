import { readFileSync, readdirSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { injectChoiceShuffle } from './scripts/lib/external-html.ts';

// Chép các file HTML trong external/ vào dist/external/ để link "Mở file HTML gốc" chạy được sau khi deploy,
// kèm script xáo thứ tự lựa chọn (file gốc trong repo giữ nguyên).
// Lúc `npm run dev`, Vite phục vụ file gốc chưa chèn script.
function copyExternalHtml(): Plugin {
  return {
    name: 'copy-external-html',
    apply: 'build',
    generateBundle() {
      for (const file of readdirSync('external').filter((f) => f.endsWith('.html'))) {
        this.emitFile({ type: 'asset', fileName: `external/${file}`, source: injectChoiceShuffle(readFileSync(`external/${file}`, 'utf8')) });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), copyExternalHtml()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
});
