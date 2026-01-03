import type { Container, VNode } from "../types";
import { mount } from "./mount";
import { patch } from "./patch";

export function render(result: any, container: Container, prev?: VNode | VNode[] | null) {
  if (prev) {
    patch(prev, result, container);
    return;
  }
  if ("textContent" in container) {
    container.textContent = "";
  }
  mount(result, container);
}
