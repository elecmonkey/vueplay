import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',
  minify: true,
  platform: 'node',
  deps: {
    neverBundle: ['vite', '@vueplay/compiler-sfc'],
    alwaysBundle: [/.*/],
  },
})
