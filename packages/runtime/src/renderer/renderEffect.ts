import { effect, queueJob } from "@vueplay/reactivity";
import type { ComponentInstance, Container } from "../types";
import { render } from "./render";

export function setupRenderEffect(instance: ComponentInstance, container: Container) {
  instance.container = container;

  const runner = effect(
    () => {
      if (!instance.isMounted) {
        invokeHooks(instance.bm);
        const subTree = instance.render?.();
        instance.subTree = subTree;
        render(subTree, container);
        instance.isMounted = true;
        invokeHooks(instance.m);
      } else {
        invokeHooks(instance.bu);
        const subTree = instance.render?.();
        render(subTree, container, instance.subTree ?? null);
        instance.subTree = subTree;
        invokeHooks(instance.u);
      }
    },
    {
      scheduler: () => queueJob(runner),
    },
  );
  instance.update = runner;
}

function invokeHooks(hooks?: Array<() => void>) {
  if (!hooks) return;
  for (const hook of hooks) {
    hook();
  }
}
