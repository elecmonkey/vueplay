export type EffectScheduler = () => void;

export type Dep = Set<ReactiveEffect>;

let activeEffect: ReactiveEffect | undefined;
const effectStack: ReactiveEffect[] = [];

export class ReactiveEffect {
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

export function trackEffects(dep: Dep) {
  if (!activeEffect) return;
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect);
    activeEffect.deps.push(dep);
  }
}

export function triggerEffects(dep: Dep) {
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

export function effect(
  fn: () => any,
  options: { scheduler?: EffectScheduler } = {},
) {
  const _effect = new ReactiveEffect(fn, options.scheduler);
  _effect.run();
  const runner = _effect.run.bind(_effect) as (() => any) & {
    effect: ReactiveEffect;
  };
  runner.effect = _effect;
  return runner;
}
