import { describe, expect, it } from "vitest";
import { parseTemplate } from "../src/template/parser";

describe("template parser", () => {
  it("parses directives and attributes", () => {
    const [node] = parseTemplate(
      '<button @click.prevent="onClick" :id="foo" v-if="ok">hi</button>',
    );
    if (node.type !== "Element") throw new Error("expected element");
    expect(node.tag).toBe("button");
    expect(node.props[0]).toMatchObject({
      type: "Directive",
      name: "on",
      arg: "click",
      modifiers: ["prevent"],
      exp: "onClick",
    });
    expect(node.props[1]).toMatchObject({
      type: "Directive",
      name: "bind",
      arg: "id",
      exp: "foo",
    });
    expect(node.props[2]).toMatchObject({
      type: "Directive",
      name: "if",
      exp: "ok",
    });
  });

  it("treats void tags as self closing", () => {
    const [node] = parseTemplate('<img src="a">');
    if (node.type !== "Element") throw new Error("expected element");
    expect(node.tag).toBe("img");
    expect(node.children).toHaveLength(0);
  });

  it("keeps rawtext and rcdata as plain text", () => {
    const [styleNode] = parseTemplate("<style>.a{color:red}</style>");
    if (styleNode.type !== "Element") throw new Error("expected element");
    expect(styleNode.children[0]).toMatchObject({
      type: "Text",
      content: ".a{color:red}",
    });

    const [textareaNode] = parseTemplate(
      "<textarea><div>{{count}}</div></textarea>",
    );
    if (textareaNode.type !== "Element") throw new Error("expected element");
    expect(textareaNode.children[0]).toMatchObject({
      type: "Text",
      content: "<div>{{count}}</div>",
    });
  });
});
