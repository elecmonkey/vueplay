import { isRef, type Ref } from "./ref";

type UnwrapRef<T> = T extends Ref<infer V> ? V : T;

export type ShallowUnwrapRef<T> = { [K in keyof T]: UnwrapRef<T[K]> };

export function unref<T>(value: T | Ref<T>): T {
  return isRef(value) ? value.value : (value as T);
}

export function proxyRefs<T extends object>(objectWithRefs: T): ShallowUnwrapRef<T> {
  return new Proxy(objectWithRefs, {
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);
      return unref(res as any);
    },
    set(target, key, value, receiver) {
      const oldValue = (target as any)[key];
      if (isRef(oldValue) && !isRef(value)) {
        oldValue.value = value;
        return true;
      }
      return Reflect.set(target, key, value, receiver);
    },
  }) as ShallowUnwrapRef<T>;
}
