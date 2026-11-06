import { defineConfig } from 'vitest/config';

// Test rules Realtime Database; chỉ chạy qua `npm run test:rules` (cần Java + emulator).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['rules-tests/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
