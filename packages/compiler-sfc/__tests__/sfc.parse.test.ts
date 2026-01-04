import { describe, expect, it } from "vitest";
import { parseSFC } from "../src";

describe("parseSFC", () => {
  it("splits template, script setup, and styles", () => {
    const source = `
      <template>
        <div>hello</div>
      </template>
      <script setup>
      const msg = "hi";
      </script>
      <style scoped>
      .a { color: red; }
      </style>
      <style>
      .b { color: blue; }
      </style>
    `;

    const descriptor = parseSFC(source);
    expect(descriptor.template).toContain("<div>hello</div>");
    expect(descriptor.scriptSetup).toContain('const msg = "hi";');
    expect(descriptor.styles).toHaveLength(2);
    expect(descriptor.styles[0].scoped).toBe(true);
    expect(descriptor.styles[1].scoped).toBe(false);
  });
});
