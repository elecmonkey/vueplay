import type { LifecycleHook } from "../types";
import { getCurrentInstance } from "./component";

function injectHook(type: "bm" | "m" | "bu" | "u", hook: LifecycleHook) {
  const instance = getCurrentInstance();
  if (!instance) return;
  const hooks = instance[type] || (instance[type] = []);
  hooks.push(hook);
}

export function onBeforeMount(hook: LifecycleHook) {
  injectHook("bm", hook);
}

export function onMounted(hook: LifecycleHook) {
  injectHook("m", hook);
}

export function onBeforeUpdate(hook: LifecycleHook) {
  injectHook("bu", hook);
}

export function onUpdated(hook: LifecycleHook) {
  injectHook("u", hook);
}
