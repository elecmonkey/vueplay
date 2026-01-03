import { trackEffects, triggerEffects, type Dep } from "./effect";
import { isObject } from "./utils";

const targetMap = new WeakMap<object, Map<PropertyKey, Dep>>();
const reactiveMap = new WeakMap<object, any>();

function track(target: object, key: PropertyKey) {
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map<PropertyKey, Dep>();
    targetMap.set(target, depsMap);
  }
  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set();
    depsMap.set(key, dep);
  }
  trackEffects(dep);
}

function trigger(target: object, key: PropertyKey) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const dep = depsMap.get(key);
  if (!dep) return;
  triggerEffects(dep);
}

function createReactive<T extends object>(target: T): T {
  if (!isObject(target)) return target;
  const existing = reactiveMap.get(target);
  if (existing) return existing;

  const proxy = new Proxy(target, {
    get(t, key, receiver) {
      if (key === "__v_isReactive") return true;
      const res = Reflect.get(t, key, receiver);
      track(t, key);
      if (isObject(res)) return reactive(res);
      return res;
    },
    set(t, key, value, receiver) {
      const oldValue = Reflect.get(t, key, receiver);
      const result = Reflect.set(t, key, value, receiver);
      if (!Object.is(oldValue, value)) {
        trigger(t, key);
      }
      return result;
    },
  });

  reactiveMap.set(target, proxy);
  return proxy;
}

export function reactive<T extends object>(target: T): T {
  return createReactive(target);
}

export function isReactive(value: unknown): boolean {
  return !!(value && (value as any).__v_isReactive);
}
