import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["packages/**/__tests__/**/*.test.ts"],
    environment: "node",
    alias: {
      "@vueplay/reactivity": path.resolve(
        __dirname,
        "packages/reactivity/src/index.ts",
      ),
      "@vueplay/runtime": path.resolve(
        __dirname,
        "packages/runtime/src/index.ts",
      ),
      "@vueplay/compiler-sfc": path.resolve(
        __dirname,
        "packages/compiler-sfc/src/index.ts",
      ),
    },
  },
});
