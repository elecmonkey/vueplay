import { describe, expect, it } from "vitest";
import { h } from "../src/index";

describe("h", () => {
  it("create a vnode", () => {
    const vnode = h("div", { id: "app" }, "hello");
    expect(vnode.type).toBe("div");
    expect(vnode.props).toEqual({ id: "app" });
    expect(vnode.children).toBe("hello");
    expect(vnode.el).toBe(null);
  });

  it("create a vnode with children array", () => {
    const vnode = h("div", null, [h("span", null, "child")]);
    expect(vnode.children).toHaveLength(1);
    expect((vnode.children as any)[0].type).toBe("span");
  });

  it("create a vnode with null props", () => {
    const vnode = h("div", null, "hello");
    expect(vnode.props).toBe(null);
  });
});
