import {defineConfig} from 'vitest/config';
import {resolve} from 'node:path';

export default defineConfig({
  base: './',
  build: {target: 'es2022', rollupOptions: {input: resolve(import.meta.dirname, 'pond.html')}},
  optimizeDeps: {include: [
    'three', 'three/addons/environments/RoomEnvironment.js',
    'three/addons/controls/OrbitControls.js', 'three/addons/exporters/GLTFExporter.js',
  ]},
  server: {watch: {ignored: ['**/output/**', '**/dist/**']}},
  // The long simulation checks share the CPU with a running desktop wallpaper.
  test: {include: ['tests/**/*.test.ts'], environment: 'node', maxWorkers: 1},
});
