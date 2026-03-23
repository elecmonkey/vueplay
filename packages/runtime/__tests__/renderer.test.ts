// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { h, createApp, nextTick } from "../src/index";
import { ref } from "../../reactivity/src/index";

describe("renderer", () => {
  it("should mount element", () => {
    const root = document.createElement("div");
    const vnode = h("div", { id: "foo" }, "hello");
    
    const app = createApp({
      render() {
        return vnode;
      }
    });
    
    app.mount(root);
    
    expect(root.innerHTML).toBe('<div id="foo">hello</div>');
  });

  it("should update element content", async () => {
    const root = document.createElement("div");
    const count = ref(0);
    
    const Component = {
      setup() {
        return { count };
      },
      render() {
        return h("div", null, String(count.value));
      }
    };
    
    const app = createApp(Component);
    app.mount(root);
    
    expect(root.innerHTML).toBe("<div>0</div>");
    
    count.value++;
    await nextTick();
    
    expect(root.innerHTML).toBe("<div>1</div>");
  });

  it("should handle props update", async () => {
    const root = document.createElement("div");
    const id = ref("foo");
    
    const Component = {
      setup() {
        return { id };
      },
      render() {
        return h("div", { id: id.value }, "hello");
      }
    };
    
    const app = createApp(Component);
    app.mount(root);
    
    expect(root.innerHTML).toBe('<div id="foo">hello</div>');
    
    id.value = "bar";
    await nextTick();
    
    expect(root.innerHTML).toBe('<div id="bar">hello</div>');
  });
  
  it("should handle click event", () => {
    const root = document.createElement("div");
    let clicked = false;
    
    const Component = {
      render() {
        return h("button", {
          onClick: () => {
            clicked = true;
          }
        }, "click me");
      }
    };
    
    const app = createApp(Component);
    app.mount(root);
    
    const button = root.querySelector("button");
    button?.click();
    
    expect(clicked).toBe(true);
  });

  it("should reorder keyed children and reuse nodes", async () => {
    const root = document.createElement("div");
    const order = ref(["A", "B", "C", "D"]);

    const Component = {
      render() {
        return h(
          "ul",
          null,
          order.value.map((item) => h("li", { key: item }, item)),
        );
      },
    };

    const app = createApp(Component);
    app.mount(root);

    const beforeNodes = Array.from(root.querySelectorAll("li"));
    expect(beforeNodes.map((node) => node.textContent)).toEqual(["A", "B", "C", "D"]);

    order.value = ["D", "B", "A", "C"];
    await nextTick();

    const afterNodes = Array.from(root.querySelectorAll("li"));
    expect(afterNodes.map((node) => node.textContent)).toEqual(["D", "B", "A", "C"]);
    expect(afterNodes[0]).toBe(beforeNodes[3]);
    expect(afterNodes[1]).toBe(beforeNodes[1]);
    expect(afterNodes[2]).toBe(beforeNodes[0]);
    expect(afterNodes[3]).toBe(beforeNodes[2]);
  });

  it("should handle keyed insertions and removals", async () => {
    const root = document.createElement("div");
    const order = ref(["A", "B", "C"]);

    const Component = {
      render() {
        return h(
          "ul",
          null,
          order.value.map((item) => h("li", { key: item }, item)),
        );
      },
    };

    const app = createApp(Component);
    app.mount(root);

    const beforeNodes = Array.from(root.querySelectorAll("li"));
    expect(beforeNodes.map((node) => node.textContent)).toEqual(["A", "B", "C"]);

    order.value = ["B", "D", "A"];
    await nextTick();

    const afterNodes = Array.from(root.querySelectorAll("li"));
    expect(afterNodes.map((node) => node.textContent)).toEqual(["B", "D", "A"]);
    expect(afterNodes[0]).toBe(beforeNodes[1]);
    expect(afterNodes[2]).toBe(beforeNodes[0]);
  });
});
