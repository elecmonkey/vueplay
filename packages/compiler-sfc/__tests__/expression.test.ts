import { describe, expect, it } from "vitest";
import { rewriteExpression } from "../src/template/expression";

describe("expression rewrite", () => {
  it("unwraps refs", () => {
    const bindings = new Map([["count", "setup-ref"]]);
    const result = rewriteExpression("count", bindings);
    expect(result.code).toBe("unref(count)");
    expect(result.usesUnref).toBe(true);
  });

  it("rewrites props to __props access", () => {
    const bindings = new Map([["detail", "props"]]);
    const result = rewriteExpression("detail", bindings);
    expect(result.code).toBe("__props.detail");
    expect(result.usesUnref).toBe(false);
  });

  it("handles complex expressions", () => {
    const bindings = new Map([["count", "setup-ref"]]);
    const result = rewriteExpression("count + 1", bindings);
    expect(result.code).toContain("unref(count) + 1");
  });

  it("respects local scope", () => {
    const bindings = new Map([
      ["count", "setup-ref"],
      ["other", "setup-ref"],
    ]);
    const result = rewriteExpression("(count) => count + other", bindings);
    expect(result.code).toContain("count + unref(other)");
  });
});
