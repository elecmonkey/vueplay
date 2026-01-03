import type { Component, Container, VNode, VNodeChild } from "../types";
import { createComponentInstance, setupComponent } from "../core/component";
import { setupRenderEffect } from "./renderEffect";
import { normalizeVNode } from "./normalize";
import { patchProp, updateProps } from "./props";

export function mount(vnode: any, container: Container) {
  if (vnode == null) return;
  if (Array.isArray(vnode)) {
    const normalized = vnode.map((child) => normalizeVNode(child));
    for (const child of normalized) {
      mount(child, container);
    }
    return;
  }
  if (typeof vnode === "string" || typeof vnode === "number") {
    const textVNode = normalizeVNode(vnode);
    mount(textVNode, container);
    return;
  }
  if (typeof vnode === "object" && vnode.type === "#text") {
    const textNode = document.createTextNode(String(vnode.children ?? ""));
    vnode.el = textNode;
    container.appendChild(textNode);
    return;
  }
  if (typeof vnode === "object" && typeof vnode.type === "string") {
    const el = document.createElement(vnode.type);
    vnode.el = el;
    const props = vnode.props || {};
    for (const key of Object.keys(props)) {
      const value = props[key];
      patchProp(el, key, null, value);
    }

    const children = vnode.children;
    if (Array.isArray(children)) {
      const normalized = children.map((child) => normalizeVNode(child));
      vnode.children = normalized;
      for (const child of normalized) {
        mount(child, el);
      }
    } else if (typeof children === "string" || typeof children === "number") {
      const textVNode = normalizeVNode(children);
      vnode.children = textVNode;
      mount(textVNode, el);
    } else {
      mount(children, el);
    }
    container.appendChild(el);
    return;
  }
  if (typeof vnode === "object" && typeof vnode.type === "object") {
    mountComponent(vnode, container);
  }
}

export function mountComponent(vnode: VNode, container: Container) {
  const instance = createComponentInstance(vnode.type as Component);
  updateProps(instance.props, vnode.props ?? {});
  setupComponent(instance);
  const anchor = document.createElement("div");
  vnode.el = anchor;
  vnode.component = instance;
  container.appendChild(anchor);
  setupRenderEffect(instance, anchor);
}

export function removeNode(vnode: VNode, container: Container) {
  const el = vnode.el;
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
    return;
  }
  if ("textContent" in container) {
    container.textContent = "";
  }
}
