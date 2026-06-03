import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  base: '/BeadsEditor/',
  build: {
    outDir: 'dist'
  },
  plugins: [vue()],
  server: {
    port: 3000
  }
})
