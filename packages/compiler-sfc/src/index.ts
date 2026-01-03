import type { SfcDescriptor } from "./types";
import { compileScriptSetup } from "./scriptSetup";
import { parseSFC } from "./sfc/parse";
import { compileTemplateToVNode } from "./template/codegen";
import { hashCode } from "./utils/hash";

export type { SfcDescriptor, SfcStyleBlock } from "./types";

type CompiledSfc = {
  code: string;
  descriptor: SfcDescriptor;
};

export { parseSFC };

export function compileSFC(source: string): CompiledSfc {
  const descriptor = parseSFC(source);
  const { importCode, setupCode, bindings, usesDefineProps } =
    compileScriptSetup(descriptor.scriptSetup);
  const template = descriptor.template.trim();
  const styles = descriptor.styles.map((s) => s.content.trim());
  const hasScoped = descriptor.styles.some((s) => s.scoped);
  const scopeId = hasScoped ? `data-v-${hashCode(source)}` : "";
  if (scopeId) {
    descriptor.scopeId = scopeId;
  }

  const templateResult = compileTemplateToVNode(
    template,
    scopeId,
    bindings,
  );
  const renderBody = `return () => ${templateResult.code};`;
  const setupBody = [setupCode, renderBody].filter(Boolean).join("\n");
  const needsUnref = templateResult.usesUnref;

  const code = [
    needsUnref
      ? 'import { unref } from "@vueplay/reactivity";'
      : "",
    'import { h } from "@vueplay/runtime";',
    importCode,
    "const __sfc__ = {",
    `  setup(${usesDefineProps ? "__props" : ""}) {`,
    indent(setupBody, 4),
    "  },",
    "};",
    "export default __sfc__;",
  ]
    .filter(Boolean)
    .join("\n");

  return { code, descriptor };
}

function indent(code: string, spaces: number) {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.length ? pad + line : line))
    .join("\n");
}
