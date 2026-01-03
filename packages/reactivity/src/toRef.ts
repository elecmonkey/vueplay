import { isRef, type Ref } from "./ref";

class ObjectRefImpl<T extends object, K extends keyof T> {
  private _object: T;
  private _key: K;
  readonly __v_isRef = true;

  constructor(object: T, key: K) {
    this._object = object;
    this._key = key;
  }

  get value() {
    return this._object[this._key];
  }

  set value(newValue: T[K]) {
    this._object[this._key] = newValue;
  }
}

export function toRef<T extends object, K extends keyof T>(
  object: T,
  key: K,
): Ref<T[K]> {
  const value = object[key];
  if (isRef(value)) return value as Ref<T[K]>;
  return new ObjectRefImpl(object, key);
}

export function toRefs<T extends object>(object: T): { [K in keyof T]: Ref<T[K]> } {
  const ret = {} as { [K in keyof T]: Ref<T[K]> };
  for (const key in object) {
    ret[key] = toRef(object, key);
  }
  return ret;
}
