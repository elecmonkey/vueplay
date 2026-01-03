export function patchProp(el: Element, key: string, prev: any, next: any) {
  if (key.startsWith("on")) {
    const event = key.slice(2).toLowerCase();
    if (prev) {
      el.removeEventListener(event, prev);
    }
    if (next) {
      el.addEventListener(event, next);
    }
    return;
  }
  if (key === "class") {
    (el as HTMLElement).className = next ?? "";
    return;
  }
  if (next == null || next === false) {
    el.removeAttribute(key);
  } else if (next === true) {
    el.setAttribute(key, "");
  } else {
    el.setAttribute(key, String(next));
  }
}

export function updateProps(target: Record<string, any>, nextProps: Record<string, any>) {
  for (const key of Object.keys(target)) {
    if (!(key in nextProps)) {
      delete target[key];
    }
  }
  for (const key of Object.keys(nextProps)) {
    target[key] = nextProps[key];
  }
}
