import { defineConfig } from 'vite';
import aseLive from '../dist/index.js';

export default defineConfig({ plugins: [aseLive()] });
