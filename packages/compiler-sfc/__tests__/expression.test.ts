import { describe, expect, it } from "vitest";
import { rewriteExpression } from "../src/template/expression";
import type { BindingMetadata } from "../src/types";

describe("expression rewrite", () => {
  it("unwraps refs", () => {
    const bindings: BindingMetadata = new Map([["count", "setup-ref"]]);
    const result = rewriteExpression("count", bindings);
    expect(result.code).toBe("unref(count)");
    expect(result.usesUnref).toBe(true);
  });

  it("rewrites props to __props access", () => {
    const bindings: BindingMetadata = new Map([["detail", "props"]]);
    const result = rewriteExpression("detail", bindings);
    expect(result.code).toBe("__props.detail");
    expect(result.usesUnref).toBe(false);
  });

  it("handles complex expressions", () => {
    const bindings: BindingMetadata = new Map([["count", "setup-ref"]]);
    const result = rewriteExpression("count + 1", bindings);
    expect(result.code).toContain("unref(count) + 1");
  });

  it("respects local scope", () => {
    const bindings: BindingMetadata = new Map([
      ["count", "setup-ref"],
      ["other", "setup-ref"],
    ]);
    const result = rewriteExpression("(count) => count + other", bindings);
    expect(result.code).toContain("count + unref(other)");
  });
});
