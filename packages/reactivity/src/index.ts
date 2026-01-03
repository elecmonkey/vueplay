type EffectScheduler = () => void;

type Dep = Set<ReactiveEffect>;

const targetMap = new WeakMap<object, Map<PropertyKey, Dep>>();
const reactiveMap = new WeakMap<object, any>();

let activeEffect: ReactiveEffect | undefined;
const effectStack: ReactiveEffect[] = [];

class ReactiveEffect {
  fn: () => any;
  deps: Dep[] = [];
  active = true;
  scheduler?: EffectScheduler;

  constructor(fn: () => any, scheduler?: EffectScheduler) {
    this.fn = fn;
    this.scheduler = scheduler;
  }

  run() {
    if (!this.active) {
      return this.fn();
    }
    cleanupEffect(this);
    try {
      effectStack.push(this);
      activeEffect = this;
      return this.fn();
    } finally {
      effectStack.pop();
      activeEffect = effectStack[effectStack.length - 1];
    }
  }

  stop() {
    if (this.active) {
      cleanupEffect(this);
      this.active = false;
    }
  }
}

function cleanupEffect(effect: ReactiveEffect) {
  for (const dep of effect.deps) {
    dep.delete(effect);
  }
  effect.deps.length = 0;
}

function track(target: object, key: PropertyKey) {
  if (!activeEffect) return;
  let depsMap = targetMap.get(target);
  if (!depsMap) {
    depsMap = new Map<PropertyKey, Dep>();
    targetMap.set(target, depsMap);
  }
  let dep = depsMap.get(key);
  if (!dep) {
    dep = new Set<ReactiveEffect>();
    depsMap.set(key, dep);
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
  }
}

function trigger(target: object, key: PropertyKey) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const dep = depsMap.get(key);
  if (!dep) return;
  const effects = new Set(dep);
  for (const effect of effects) {
    if (effect === activeEffect) continue;
    if (effect.scheduler) {
      effect.scheduler();
    } else {
      effect.run();
    }
  }
}

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object";
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

class RefImpl<T> {
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
  if (!activeEffect) return;
  let dep = ref.dep;
  if (!dep) {
    dep = new Set<ReactiveEffect>();
    ref.dep = dep;
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
  }
}

function triggerRefValue(ref: RefImpl<any>) {
  if (!ref.dep) return;
  const effects = new Set(ref.dep);
  for (const effect of effects) {
    if (effect === activeEffect) continue;
    if (effect.scheduler) {
      effect.scheduler();
    } else {
      effect.run();
    }
  }
}

export function ref<T>(value: T) {
  return new RefImpl(value);
}

export function isRef(value: unknown): value is RefImpl<any> {
  return !!(value && (value as any).__v_isRef);
}

export function effect(fn: () => any, options: { scheduler?: EffectScheduler } = {}) {
  const _effect = new ReactiveEffect(fn, options.scheduler);
  _effect.run();
  const runner = _effect.run.bind(_effect) as (() => any) & { effect: ReactiveEffect };
  runner.effect = _effect;
  return runner;
}

function traverse(value: unknown, seen = new Set<unknown>()) {
  if (!isObject(value) || seen.has(value)) return value;
  seen.add(value);
  for (const key in value) {
    traverse((value as any)[key], seen);
  }
  return value;
}

export function watch<T>(
  source: (() => T) | RefImpl<T> | object,
  cb: (value: T, oldValue: T | undefined, onCleanup: (fn: () => void) => void) => void,
  options: { immediate?: boolean; deep?: boolean } = {},
) {
  let getter: () => T;
  if (isRef(source)) {
    getter = () => source.value as T;
  } else if (isReactive(source)) {
    getter = () => source as T;
  } else if (typeof source === "function") {
    getter = source as () => T;
  } else {
    getter = () => source as T;
  }

  if (options.deep) {
    const baseGetter = getter;
    getter = () => traverse(baseGetter()) as T;
  }

  let cleanup: (() => void) | undefined;
  const onCleanup = (fn: () => void) => {
    cleanup = fn;
  };

  let oldValue: T | undefined;
  const effectRunner = new ReactiveEffect(getter, () => job());

  const job = () => {
    if (!effectRunner.active) return;
    const newValue = effectRunner.run() as T;
    if (options.deep || !Object.is(newValue, oldValue)) {
      if (cleanup) cleanup();
      cb(newValue, oldValue, onCleanup);
      oldValue = newValue;
    }
  };

  if (options.immediate) {
    job();
  } else {
    oldValue = effectRunner.run() as T;
  }

  return () => effectRunner.stop();
}

export function watchEffect(
  effectFn: (onCleanup: (fn: () => void) => void) => void,
) {
  let cleanup: (() => void) | undefined;
  const onCleanup = (fn: () => void) => {
    cleanup = fn;
  };

  const runner = new ReactiveEffect(
    () => {
      if (cleanup) cleanup();
      return effectFn(onCleanup);
    },
    () => runner.run(),
  );

  runner.run();
  return () => runner.stop();
}
