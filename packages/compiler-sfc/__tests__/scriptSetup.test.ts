import { describe, expect, it } from "vitest";
import { compileScriptSetup } from "../src/scriptSetup";

describe("script setup", () => {
  it("collects bindings and defineProps", () => {
    const code = `
      import { ref } from "@vueplay/reactivity";
      const count = ref(0);
      let name = "hi";
      const props = defineProps(["title", "detail"]);
      function inc() {}
    `;
    const result = compileScriptSetup(code);
    expect(result.importCode).toContain('import { ref }');
    expect(result.setupCode).toContain("const props = __props");
    expect(result.usesDefineProps).toBe(true);
    expect(result.bindings.get("count")).toBe("setup-ref");
    expect(result.bindings.get("name")).toBe("setup-let");
    expect(result.bindings.get("inc")).toBe("setup-const");
    expect(result.bindings.get("detail")).toBe("props");
    expect(result.bindings.get("title")).toBe("props");
  });
});
