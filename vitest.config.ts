import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';
export default defineConfig({
  resolve: { alias: {
    '@sh3d/home-model': resolve('packages/home-model/src/index.ts'),
    '@sh3d/device-model': resolve('packages/device-model/src/index.ts'),
    '@sh3d/geometry-engine': resolve('packages/geometry-engine/src/index.ts'),
    '@sh3d/floorplan-engine': resolve('packages/floorplan-engine/src/index.ts')
  } },
  test: { include: ['tests/**/*.spec.ts'], exclude: ['tests/e2e/**','node_modules/**'], environment: 'node', testTimeout: 10000 }
});
