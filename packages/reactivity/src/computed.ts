import { ReactiveEffect, trackEffects, triggerEffects, type Dep } from "./effect";

export class ComputedRefImpl<T> {
  private _value!: T;
  private _dirty = true;
  private _effect: ReactiveEffect;
  dep?: Dep;
  readonly __v_isRef = true;

  constructor(getter: () => T) {
    this._effect = new ReactiveEffect(getter, () => {
      if (!this._dirty) {
        this._dirty = true;
        if (this.dep) {
          triggerEffects(this.dep);
        }
      }
    });
  }

  get value() {
    if (!this.dep) {
      this.dep = new Set();
    }
    trackEffects(this.dep);
    if (this._dirty) {
      this._dirty = false;
      this._value = this._effect.run() as T;
    }
    return this._value;
  }
}

export function computed<T>(getter: () => T) {
  return new ComputedRefImpl(getter);
}
