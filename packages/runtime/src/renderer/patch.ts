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
  const oldArray = oldChildren.map((child) => normalizeVNode(child));
  const newArray = newChildren.map((child) => normalizeVNode(child));

  for (let i = 0; i < newArray.length; i += 1) {
    newChildren[i] = newArray[i];
  }

  if (!shouldUseKeyedDiff(oldArray, newArray)) {
    patchArrayByIndex(oldArray, newArray, container);
    return;
  }

  patchKeyedChildren(oldArray, newArray, container);
}

function patchArrayByIndex(oldChildren: VNode[], newChildren: VNode[], container: Container) {
  const commonLength = Math.min(oldChildren.length, newChildren.length);
  for (let i = 0; i < commonLength; i += 1) {
    patch(oldChildren[i], newChildren[i], container);
  }
  if (newChildren.length > oldChildren.length) {
    for (let i = commonLength; i < newChildren.length; i += 1) {
      mount(newChildren[i], container);
    }
  } else if (oldChildren.length > newChildren.length) {
    for (let i = commonLength; i < oldChildren.length; i += 1) {
      removeNode(oldChildren[i], container);
    }
  }
}

function patchKeyedChildren(oldChildren: VNode[], newChildren: VNode[], container: Container) {
  let i = 0;
  let oldEnd = oldChildren.length - 1;
  let newEnd = newChildren.length - 1;

  while (i <= oldEnd && i <= newEnd) {
    const oldVNode = oldChildren[i];
    const newVNode = newChildren[i];
    if (!isSameVNodeType(oldVNode, newVNode)) break;
    patch(oldVNode, newVNode, container);
    i += 1;
  }

  while (i <= oldEnd && i <= newEnd) {
    const oldVNode = oldChildren[oldEnd];
    const newVNode = newChildren[newEnd];
    if (!isSameVNodeType(oldVNode, newVNode)) break;
    patch(oldVNode, newVNode, container);
    oldEnd -= 1;
    newEnd -= 1;
  }

  if (i > oldEnd) {
    const anchor = newEnd + 1 < newChildren.length
      ? (newChildren[newEnd + 1].el as Node | null)
      : null;
    while (i <= newEnd) {
      mount(newChildren[i], container, anchor);
      i += 1;
    }
    return;
  }

  if (i > newEnd) {
    while (i <= oldEnd) {
      removeNode(oldChildren[i], container);
      i += 1;
    }
    return;
  }

  const oldStart = i;
  const newStart = i;
  const toBePatched = newEnd - newStart + 1;
  const newIndexToOldIndexMap = new Array<number>(toBePatched).fill(0);
  const keyToNewIndexMap = new Map<unknown, number>();

  for (let index = newStart; index <= newEnd; index += 1) {
    const key = getVNodeKey(newChildren[index]);
    if (key != null) {
      keyToNewIndexMap.set(key, index);
    }
  }

  let moved = false;
  let maxNewIndexSoFar = 0;
  let patched = 0;

  for (let index = oldStart; index <= oldEnd; index += 1) {
    const oldVNode = oldChildren[index];
    if (patched >= toBePatched) {
      removeNode(oldVNode, container);
      continue;
    }

    let newIndex: number | undefined;
    const key = getVNodeKey(oldVNode);
    if (key != null) {
      newIndex = keyToNewIndexMap.get(key);
    } else {
      for (let j = newStart; j <= newEnd; j += 1) {
        if (newIndexToOldIndexMap[j - newStart] !== 0) continue;
        if (isSameVNodeType(oldVNode, newChildren[j])) {
          newIndex = j;
          break;
        }
      }
    }

    if (newIndex === undefined) {
      removeNode(oldVNode, container);
      continue;
    }

    newIndexToOldIndexMap[newIndex - newStart] = index + 1;
    if (newIndex >= maxNewIndexSoFar) {
      maxNewIndexSoFar = newIndex;
    } else {
      moved = true;
    }

    patch(oldVNode, newChildren[newIndex], container);
    patched += 1;
  }

  const increasingNewIndexSequence = moved
    ? getSequence(newIndexToOldIndexMap)
    : [];
  let sequenceIndex = increasingNewIndexSequence.length - 1;

  for (let index = toBePatched - 1; index >= 0; index -= 1) {
    const newIndex = newStart + index;
    const newVNode = newChildren[newIndex];
    const anchor = newIndex + 1 < newChildren.length
      ? (newChildren[newIndex + 1].el as Node | null)
      : null;

    if (newIndexToOldIndexMap[index] === 0) {
      mount(newVNode, container, anchor);
      continue;
    }

    if (!moved) continue;
    if (sequenceIndex >= 0 && index === increasingNewIndexSequence[sequenceIndex]) {
      sequenceIndex -= 1;
    } else {
      moveVNode(newVNode, container, anchor);
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
    const oldArray = Array.isArray(c1) ? c1.map((child) => normalizeVNode(child)) : [];
    const newArray = c2.map((child) => normalizeVNode(child));
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
  const anchor = n1.el?.nextSibling ?? null;
  removeNode(n1, container);
  mount(n2, container, anchor);
}

function getVNodeKey(vnode: VNode) {
  return vnode.props?.key;
}

function shouldUseKeyedDiff(oldChildren: VNode[], newChildren: VNode[]) {
  return oldChildren.some((child) => getVNodeKey(child) != null)
    || newChildren.some((child) => getVNodeKey(child) != null);
}

function isSameVNodeType(n1: VNode, n2: VNode) {
  return n1.type === n2.type && getVNodeKey(n1) === getVNodeKey(n2);
}

function moveVNode(vnode: VNode, container: Container, anchor: Node | null) {
  const el = vnode.el;
  if (el) {
    container.insertBefore(el, anchor);
  }
}

function getSequence(arr: number[]) {
  const p = arr.slice();
  const result: number[] = [];

  for (let i = 0; i < arr.length; i += 1) {
    const value = arr[i];
    if (value === 0) continue;

    if (result.length === 0 || arr[result[result.length - 1]] < value) {
      p[i] = result.length > 0 ? result[result.length - 1] : -1;
      result.push(i);
      continue;
    }

    let start = 0;
    let end = result.length - 1;
    while (start < end) {
      const middle = (start + end) >> 1;
      if (arr[result[middle]] < value) {
        start = middle + 1;
      } else {
        end = middle;
      }
    }

    if (value < arr[result[start]]) {
      if (start > 0) {
        p[i] = result[start - 1];
      } else {
        p[i] = -1;
      }
      result[start] = i;
    }
  }

  let length = result.length;
  let last = length > 0 ? result[length - 1] : -1;
  while (length > 0) {
    result[length - 1] = last;
    last = p[last];
    length -= 1;
  }

  return result;
}
