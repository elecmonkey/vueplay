import { isRef, type RefImpl } from "./ref";

export function unref<T>(value: T | RefImpl<T>): T {
  return isRef(value) ? value.value : (value as T);
}

export function proxyRefs<T extends object>(objectWithRefs: T): T {
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
  });
}
