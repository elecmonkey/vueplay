import { describe, expect, it } from "vitest";
import { compileSFC } from "../src";

describe("compileSFC", () => {
  it("injects unref and scope id", () => {
    const source = `
      <template>
        <div>{{ count + 1 }}</div>
      </template>
      <script setup>
      import { ref } from "@vueplay/reactivity";
      const count = ref(0);
      </script>
      <style scoped>
      .a { color: red; }
      </style>
    `;
    const result = compileSFC(source);
    expect(result.code).toContain('import { unref }');
    expect(result.descriptor.scopeId).toMatch(/^data-v-/);
    if (result.descriptor.scopeId) {
      expect(result.code).toContain(result.descriptor.scopeId);
    }
  });

  it("rewrites props in template", () => {
    const source = `
      <template>
        <div>{{ detail }}</div>
      </template>
      <script setup>
      const props = defineProps(["detail"]);
      </script>
    `;
    const result = compileSFC(source);
    expect(result.code).toContain("__props.detail");
  });
});
