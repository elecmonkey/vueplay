import type { Container, VNode, VNodeChild } from "../types";
import { normalizeVNode } from "./normalize";
import { mount, removeNode } from "./mount";
import { patchProp, updateProps } from "./props";

export function patch(n1: VNode | VNode[], n2: VNode | VNode[], container: Container) {
  if (Array.isArray(n1) || Array.isArray(n2)) {
    patchArray(Array.isArray(n1) ? n1 : [n1], Array.isArray(n2) ? n2 : [n2], container);
    return;
  }
  if (n2.static) {
    n2.el = n1.el;
    n2.component = n1.component;
    return;
  }
  if (n1.type !== n2.type) {
    replaceNode(n1, n2, container);
    return;
  }
  if (n2.type === "#text") {
    const el = (n2.el = n1.el) as Text;
    const newText = String(n2.children ?? "");
    if (el && el.nodeValue !== newText) {
      el.nodeValue = newText;
    }
    return;
  }
  if (typeof n2.type === "string") {
    patchElement(n1, n2);
    return;
  }
  patchComponent(n1, n2);
}

function patchArray(oldChildren: VNode[], newChildren: VNode[], container: Container) {
  const commonLength = Math.min(oldChildren.length, newChildren.length);
  for (let i = 0; i < commonLength; i += 1) {
    const n1 = normalizeVNode(oldChildren[i]);
    const n2 = normalizeVNode(newChildren[i]);
    newChildren[i] = n2;
    patch(n1, n2, container);
  }
  if (newChildren.length > oldChildren.length) {
    for (let i = commonLength; i < newChildren.length; i += 1) {
      const n2 = normalizeVNode(newChildren[i]);
      newChildren[i] = n2;
      mount(n2, container);
    }
  } else if (oldChildren.length > newChildren.length) {
    for (let i = commonLength; i < oldChildren.length; i += 1) {
      const n1 = normalizeVNode(oldChildren[i]);
      removeNode(n1, container);
    }
  }
}

function patchElement(n1: VNode, n2: VNode) {
  const el = (n2.el = n1.el) as Element;
  const oldProps = n1.props || {};
  const newProps = n2.props || {};

  for (const key of Object.keys(newProps)) {
    const prev = oldProps[key];
    const next = newProps[key];
    if (prev !== next) {
      patchProp(el, key, prev, next);
    }
  }
  for (const key of Object.keys(oldProps)) {
    if (!(key in newProps)) {
      patchProp(el, key, oldProps[key], null);
    }
  }

  patchChildren(n1, n2, el);
}

function patchChildren(n1: VNode, n2: VNode, container: Element) {
  const c1 = n1.children;
  const c2 = n2.children;

  if (typeof c2 === "string" || typeof c2 === "number") {
    if (Array.isArray(c1)) {
      container.textContent = String(c2);
    } else if (typeof c1 === "string" || typeof c1 === "number") {
      if (c1 !== c2) container.textContent = String(c2);
    } else if (c1 && typeof c1 === "object") {
      container.textContent = String(c2);
    } else {
      container.textContent = String(c2);
    }
    n2.children = c2;
    return;
  }

  if (Array.isArray(c2)) {
    const oldArray = Array.isArray(c1) ? c1.map((c) => normalizeVNode(c)) : [];
    const newArray = c2.map((c) => normalizeVNode(c));
    n2.children = newArray;
    if (oldArray.length === 0 && container.childNodes.length) {
      container.textContent = "";
    }
    patchArray(oldArray, newArray, container);
    return;
  }

  if (c2 == null) {
    container.textContent = "";
    n2.children = null;
    return;
  }

  const newVNode = normalizeVNode(c2 as VNodeChild);
  const oldVNode = c1 ? normalizeVNode(c1 as VNodeChild) : null;
  n2.children = newVNode;
  if (oldVNode) {
    patch(oldVNode, newVNode, container);
  } else {
    mount(newVNode, container);
  }
}

function patchComponent(n1: VNode, n2: VNode) {
  if (n1.type !== n2.type) {
    const container = n1.el?.parentNode;
    if (container) {
      replaceNode(n1, n2, container as Container);
    }
    return;
  }
  const instance = n1.component;
  n2.el = n1.el;
  n2.component = instance;
  if (instance) {
    updateProps(instance.props, n2.props ?? {});
    instance.update?.();
  }
}

function replaceNode(n1: VNode, n2: VNode, container: Container) {
  const anchor = n1.el;
  if (anchor) {
    removeNode(n1, container);
  }
  mount(n2, container);
}
