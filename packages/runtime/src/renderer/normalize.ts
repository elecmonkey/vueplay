import { isRef, unref } from "@vueplay/reactivity";
import type { VNode, VNodeChild } from "../types";

export function normalizeVNode(child: VNodeChild): VNode {
  if (isRef(child)) {
    child = unref(child);
  }
  if (typeof child === "object" && child && "type" in child) {
    return child as VNode;
  }
  return {
    type: "#text",
    props: null,
    children: child == null ? "" : String(child),
    el: null,
  };
}
