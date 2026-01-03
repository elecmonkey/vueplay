import type { Component, VNode, VNodeChildren } from "../types";

export function h(
  type: string | Component,
  props?: Record<string, any> | null,
  children?: VNodeChildren,
  staticFlag?: boolean,
): VNode {
  return {
    type,
    props: props ?? null,
    children,
    el: null,
    component: undefined,
    static: staticFlag,
  };
}
