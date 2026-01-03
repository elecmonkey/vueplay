import { trackEffects, triggerEffects, type Dep } from "./effect";
import { reactive } from "./reactive";
import { isObject } from "./utils";

export class RefImpl<T> {
  private _value: T;
  dep?: Dep;
  readonly __v_isRef = true;

  constructor(value: T) {
    this._value = convert(value);
  }

  get value() {
    trackRefValue(this);
    return this._value;
  }

  set value(newValue: T) {
    if (!Object.is(newValue, this._value)) {
      this._value = convert(newValue);
      triggerRefValue(this);
    }
  }
}

function convert<T>(value: T): T {
  return isObject(value) ? (reactive(value as any) as T) : value;
}

function trackRefValue(ref: RefImpl<any>) {
  let dep = ref.dep;
  if (!dep) {
    dep = new Set();
    ref.dep = dep;
  }
  trackEffects(dep);
}

function triggerRefValue(ref: RefImpl<any>) {
  if (!ref.dep) return;
  triggerEffects(ref.dep);
}

export function ref<T>(value: T) {
  return new RefImpl(value);
}

export function isRef(value: unknown): value is RefImpl<any> {
  return !!(value && (value as any).__v_isRef);
}
