import type { Component, ComponentInstance, SetupContext } from "../types";

let currentInstance: ComponentInstance | null = null;

export function getCurrentInstance() {
  return currentInstance;
}

function setCurrentInstance(instance: ComponentInstance | null) {
  currentInstance = instance;
}

export function createComponentInstance(type: Component): ComponentInstance {
  return {
    type,
    props: {},
    setupState: {},
    isMounted: false,
  };
}

export function setupComponent(instance: ComponentInstance) {
  const { setup } = instance.type;
  if (setup) {
    setCurrentInstance(instance);
    const setupResult = setup(instance.props, { attrs: {}, emit: () => {} } as SetupContext);
    setCurrentInstance(null);
    if (typeof setupResult === "function") {
      instance.render = setupResult;
    } else if (setupResult && typeof setupResult === "object") {
      instance.setupState = setupResult;
    }
  }

  if (!instance.render && instance.type.render) {
    instance.render = instance.type.render;
  }

  if (!instance.render) {
    instance.render = () => "";
  }
}
