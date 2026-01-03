import { trackEffects, triggerEffects, type Dep } from "./effect";
import { isObject } from "./utils";

const targetMap = new WeakMap<object, Map<PropertyKey, Dep>>();
const reactiveMap = new WeakMap<object, any>();
const readonlyMap = new WeakMap<object, any>();

const enum ReactiveFlags {
  IsReactive = "__v_isReactive",
  IsReadonly = "__v_isReadonly",
}

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

function createReactive<T extends object>(
  target: T,
  isReadonly: boolean,
  isShallow: boolean,
): T {
  if (!isObject(target)) return target;
  const proxyMap = isReadonly ? readonlyMap : reactiveMap;
  const existing = proxyMap.get(target);
  if (existing) return existing;

  const proxy = new Proxy(target, {
    get(t, key, receiver) {
      if (key === ReactiveFlags.IsReactive) return !isReadonly;
      if (key === ReactiveFlags.IsReadonly) return isReadonly;
      const res = Reflect.get(t, key, receiver);
      if (!isReadonly) {
        track(t, key);
      }
      if (isShallow || !isObject(res)) return res;
      return isReadonly ? readonly(res) : reactive(res);
    },
    set(t, key, value, receiver) {
      if (isReadonly) return true;
      const oldValue = Reflect.get(t, key, receiver);
      const result = Reflect.set(t, key, value, receiver);
      if (!Object.is(oldValue, value)) {
        trigger(t, key);
      }
      return result;
    },
    deleteProperty(t, key) {
      if (isReadonly) return true;
      const hadKey = Object.prototype.hasOwnProperty.call(t, key);
      const result = Reflect.deleteProperty(t, key);
      if (hadKey && result) {
        trigger(t, key);
      }
      return result;
    },
  });

  proxyMap.set(target, proxy);
  return proxy;
}

export function reactive<T extends object>(target: T): T {
  return createReactive(target, false, false);
}

export function shallowReactive<T extends object>(target: T): T {
  return createReactive(target, false, true);
}

export function readonly<T extends object>(target: T): T {
  return createReactive(target, true, false);
}

export function isReactive(value: unknown): boolean {
  return !!(value && (value as any)[ReactiveFlags.IsReactive]);
}

export function isReadonly(value: unknown): boolean {
  return !!(value && (value as any)[ReactiveFlags.IsReadonly]);
}
