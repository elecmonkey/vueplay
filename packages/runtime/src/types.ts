export type Container = Element | ShadowRoot;

export type VNodeChild = VNode | string | number | null | undefined;
export type VNodeChildren = VNodeChild | VNodeChild[];

export type SetupContext = {
  attrs: Record<string, any>;
  emit: (event: string, ...args: any[]) => void;
};

export type Component = {
  setup?: (props?: Record<string, any>, ctx?: SetupContext) => any;
  render?: () => any;
};

export type LifecycleHook = () => void;

export type ComponentInstance = {
  type: Component;
  props: Record<string, any>;
  setupState: Record<string, any>;
  render?: () => any;
  isMounted: boolean;
  container?: Container;
  subTree?: VNode | VNode[] | null;
  update?: () => void;
  bm?: LifecycleHook[];
  m?: LifecycleHook[];
  bu?: LifecycleHook[];
  u?: LifecycleHook[];
};

export type VNode = {
  type: string | Component;
  props?: Record<string, any> | null;
  children?: VNodeChildren;
  el?: Node | null;
  component?: ComponentInstance;
  static?: boolean;
};
