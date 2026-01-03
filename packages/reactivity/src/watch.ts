import { ReactiveEffect } from "./effect";
import { isReactive } from "./reactive";
import { isRef, type RefImpl } from "./ref";
import { isObject } from "./utils";

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
