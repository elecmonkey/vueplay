import { describe, expect, it } from "vitest";
import { compileTemplateToVNode } from "../src/template/codegen";

describe("template codegen", () => {
  it("generates static flags for static subtrees", () => {
    const result = compileTemplateToVNode(
      "<div><span>ok</span></div>",
      "",
      new Map(),
    );
    expect(result.code).toContain('h("span"');
    expect(result.code).toContain(", true");
  });

  it("resolves component tags", () => {
    const result = compileTemplateToVNode("<hello-card />", "", new Map());
    expect(result.code).toContain("h(HelloCard");
  });

  it("handles v-if and event bindings", () => {
    const bindings = new Map([
      ["onClick", "setup-const"],
      ["ok", "setup-const"],
      ["disabled", "setup-const"],
    ]);
    const result = compileTemplateToVNode(
      '<button @click="onClick" :disabled="disabled" v-if="ok"></button>',
      "",
      bindings,
    );
    expect(result.code).toContain('"onClick"');
    expect(result.code).toContain('"disabled"');
    expect(result.code).toContain("? h(");
  });

  it("handles v-for", () => {
    const result = compileTemplateToVNode(
      '<li v-for="item in list">{{ item }}</li>',
      "",
      new Map(),
    );
    expect(result.code).toContain("list).map((item) =>");
  });

  it("injects scope id", () => {
    const result = compileTemplateToVNode("<div />", "data-v-abc", new Map());
    expect(result.code).toContain('"data-v-abc": true');
  });
});
