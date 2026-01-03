import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',
  minify: true,
  platform: 'node',
  external: ['vite', '@vueplay/compiler-sfc'],
  noExternal: [/.*/],
})
