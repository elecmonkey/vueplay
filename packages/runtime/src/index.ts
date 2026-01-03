import { effect } from "@vueplay/reactivity";

type Container = Element | ShadowRoot;
type VNodeChild = VNode | string | number | null | undefined;
type VNodeChildren = VNodeChild | VNodeChild[];

export type VNode = {
  type: string | Component;
  props?: Record<string, any> | null;
  children?: VNodeChildren;
  el?: Node | null;
  component?: ComponentInstance;
  static?: boolean;
};

export type SetupContext = {
  attrs: Record<string, any>;
  emit: (event: string, ...args: any[]) => void;
};

export type Component = {
  setup?: (props?: Record<string, any>, ctx?: SetupContext) => any;
  render?: () => any;
};

type LifecycleHook = () => void;

type ComponentInstance = {
  type: Component;
  setupState: Record<string, any>;
  render?: () => any;
  isMounted: boolean;
  container?: Container;
  subTree?: VNode | VNode[] | null;
  bm?: LifecycleHook[];
  m?: LifecycleHook[];
  bu?: LifecycleHook[];
  u?: LifecycleHook[];
};

let currentInstance: ComponentInstance | null = null;

export function getCurrentInstance() {
  return currentInstance;
}

function setCurrentInstance(instance: ComponentInstance | null) {
  currentInstance = instance;
}

function createComponentInstance(type: Component): ComponentInstance {
  return {
    type,
    setupState: {},
    isMounted: false,
  };
}

function setupComponent(instance: ComponentInstance) {
  const { setup } = instance.type;
  if (setup) {
    setCurrentInstance(instance);
    const setupResult = setup({}, { attrs: {}, emit: () => {} });
    setCurrentInstance(null);
    if (typeof setupResult === "function") {
      instance.render = setupResult;
    } else if (setupResult && typeof setupResult === "object") {
      instance.setupState = setupResult;
    }
  }

  if (!instance.render && instance.type.render) {
    instance.render = instance.type.render;
  }

  if (!instance.render) {
    instance.render = () => "";
  }
}

function invokeHooks(hooks?: LifecycleHook[]) {
  if (!hooks) return;
  for (const hook of hooks) {
    hook();
  }
}

function render(result: any, container: Container, prev?: VNode | VNode[] | null) {
  if (prev) {
    patch(prev, result, container);
    return;
  }
  if ("textContent" in container) {
    container.textContent = "";
  }
  mount(result, container);
}

function mount(vnode: any, container: Container) {
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
    return;
  }
}

function mountComponent(vnode: VNode, container: Container) {
  const instance = createComponentInstance(vnode.type as Component);
  setupComponent(instance);
  const anchor = document.createElement("div");
  vnode.el = anchor;
  vnode.component = instance;
  container.appendChild(anchor);
  setupRenderEffect(instance, anchor);
}

function setupRenderEffect(instance: ComponentInstance, container: Container) {
  instance.container = container;

  effect(() => {
    if (!instance.isMounted) {
      invokeHooks(instance.bm);
      const subTree = instance.render?.();
      instance.subTree = subTree;
      render(subTree, container);
      instance.isMounted = true;
      invokeHooks(instance.m);
    } else {
      invokeHooks(instance.bu);
      const subTree = instance.render?.();
      render(subTree, container, instance.subTree ?? null);
      instance.subTree = subTree;
      invokeHooks(instance.u);
    }
  });
}

export function createApp(rootComponent: Component) {
  return {
    mount(container: string | Container) {
      const el =
        typeof container === "string"
          ? (document.querySelector(container) as Container | null)
          : container;

      if (!el) {
        throw new Error("Failed to mount app: container not found.");
      }

      const instance = createComponentInstance(rootComponent);
      setupComponent(instance);
      setupRenderEffect(instance, el);
    },
  };
}

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

function normalizeVNode(child: VNodeChild): VNode {
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

function patch(n1: VNode | VNode[], n2: VNode | VNode[], container: Container) {
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
  n2.el = n1.el;
  n2.component = n1.component;
}

function replaceNode(n1: VNode, n2: VNode, container: Container) {
  const anchor = n1.el;
  if (anchor) {
    removeNode(n1, container);
  }
  mount(n2, container);
}

function removeNode(vnode: VNode, container: Container) {
  const el = vnode.el;
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
    return;
  }
  if ("textContent" in container) {
    container.textContent = "";
  }
}

function patchProp(el: Element, key: string, prev: any, next: any) {
  if (key.startsWith("on")) {
    const event = key.slice(2).toLowerCase();
    if (prev) {
      el.removeEventListener(event, prev);
    }
    if (next) {
      el.addEventListener(event, next);
    }
    return;
  }
  if (key === "class") {
    (el as HTMLElement).className = next ?? "";
    return;
  }
  if (next == null || next === false) {
    el.removeAttribute(key);
  } else if (next === true) {
    el.setAttribute(key, "");
  } else {
    el.setAttribute(key, String(next));
  }
}

function injectHook(type: "bm" | "m" | "bu" | "u", hook: LifecycleHook) {
  const instance = getCurrentInstance();
  if (!instance) return;
  const hooks = instance[type] || (instance[type] = []);
  hooks.push(hook);
}

export function onBeforeMount(hook: LifecycleHook) {
  injectHook("bm", hook);
}

export function onMounted(hook: LifecycleHook) {
  injectHook("m", hook);
}

export function onBeforeUpdate(hook: LifecycleHook) {
  injectHook("bu", hook);
}

export function onUpdated(hook: LifecycleHook) {
  injectHook("u", hook);
}
