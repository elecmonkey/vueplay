import { describe, expect, it, vi } from "vitest";
import {
  effect,
  reactive,
  ref,
  computed,
  watch,
  watchEffect,
} from "../src/index";

describe("reactive", () => {
  it("tracks and triggers effects", () => {
    const state = reactive({ count: 0 });
    let dummy = 0;

    effect(() => {
      dummy = state.count;
    });

    expect(dummy).toBe(0);
    state.count += 1;
    expect(dummy).toBe(1);
  });

  it("makes nested objects reactive", () => {
    const state = reactive({ nested: { name: "vue" } });
    let seen = "";

    effect(() => {
      seen = state.nested.name;
    });

    expect(seen).toBe("vue");
    state.nested.name = "mini-vue";
    expect(seen).toBe("mini-vue");
  });
});

describe("ref", () => {
  it("tracks and triggers via .value", () => {
    const count = ref(0);
    let dummy = 0;

    effect(() => {
      dummy = count.value;
    });

    expect(dummy).toBe(0);
    count.value = 2;
    expect(dummy).toBe(2);
  });
});

describe("effect", () => {
  it("returns a runner", () => {
    const count = ref(1);
    const runner = effect(() => count.value + 1);
    expect(runner()).toBe(2);
  });

  it("supports scheduler", () => {
    const state = reactive({ count: 0 });
    const scheduler = vi.fn();
    let dummy = 0;

    effect(
      () => {
        dummy = state.count;
      },
      { scheduler },
    );

    expect(dummy).toBe(0);
    state.count += 1;
    expect(scheduler).toHaveBeenCalledTimes(1);
    expect(dummy).toBe(0);
  });
});

describe("watch", () => {
  it("calls on change", () => {
    const state = reactive({ count: 0 });
    const calls: Array<[number, number | undefined]> = [];

    watch(
      () => state.count,
      (value, oldValue) => {
        calls.push([value, oldValue]);
      },
    );

    state.count = 1;
    state.count = 2;

    expect(calls).toEqual([
      [1, 0],
      [2, 1],
    ]);
  });

  it("supports immediate", () => {
    const state = reactive({ count: 0 });
    const calls: Array<[number, number | undefined]> = [];

    watch(
      () => state.count,
      (value, oldValue) => {
        calls.push([value, oldValue]);
      },
      { immediate: true },
    );

    expect(calls).toEqual([[0, undefined]]);
  });

  it("supports deep", () => {
    const state = reactive({ nested: { name: "vue" } });
    const calls: string[] = [];

    watch(
      state,
      () => {
        calls.push(state.nested.name);
      },
      { deep: true },
    );

    state.nested.name = "mini-vue";
    expect(calls).toEqual(["mini-vue"]);
  });
});

describe("watchEffect", () => {
  it("tracks and re-runs with cleanup", () => {
    const state = reactive({ count: 0 });
    const cleanups: string[] = [];
    const values: number[] = [];

    watchEffect((onCleanup) => {
      const seen = state.count;
      values.push(seen);
      onCleanup(() => cleanups.push(`cleanup:${seen}`));
    });

    state.count = 1;
    state.count = 2;

    expect(values).toEqual([0, 1, 2]);
    expect(cleanups).toEqual(["cleanup:0", "cleanup:1"]);
  });
});

describe("computed", () => {
  it("is lazy and cached", () => {
    const state = reactive({ count: 1 });
    const getter = vi.fn(() => state.count * 2);
    const doubled = computed(getter);

    expect(getter).toHaveBeenCalledTimes(0);
    expect(doubled.value).toBe(2);
    expect(getter).toHaveBeenCalledTimes(1);
    expect(doubled.value).toBe(2);
    expect(getter).toHaveBeenCalledTimes(1);

    state.count += 1;
    expect(getter).toHaveBeenCalledTimes(1);
    expect(doubled.value).toBe(4);
    expect(getter).toHaveBeenCalledTimes(2);
  });

  it("triggers effects on change", () => {
    const state = reactive({ count: 1 });
    const doubled = computed(() => state.count * 2);
    let dummy = 0;

    effect(() => {
      dummy = doubled.value;
    });

    expect(dummy).toBe(2);
    state.count += 1;
    expect(dummy).toBe(4);
  });
});
