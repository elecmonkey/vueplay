import type { Component, Container } from "../types";
import { createComponentInstance, setupComponent } from "../core/component";
import { setupRenderEffect } from "../renderer/renderEffect";

export function createApp(rootComponent: Component) {
  return {
    mount(container: string | Container) {
      const el =
        typeof container === "string"
          ? (document.querySelector(container) as Container | null)
          : container;

      if (!el) {
        throw new Error("Failed to mount app: container not found.");
      }

      const instance = createComponentInstance(rootComponent);
      setupComponent(instance);
      setupRenderEffect(instance, el);
    },
  };
}
