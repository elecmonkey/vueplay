import { parse } from "@babel/parser";
import { generate as babelGenerate } from "@babel/generator";
import type { BindingMetadata, BindingType } from "./types";

type ScriptSetupResult = {
  importCode: string;
  setupCode: string;
  bindings: BindingMetadata;
};

export function compileScriptSetup(code: string): ScriptSetupResult {
  if (!code.trim()) {
    return { importCode: "", setupCode: "", bindings: new Map() };
  }
  const ast = parse(code, {
    sourceType: "module",
  });

  const importNodes: any[] = [];
  const setupNodes: any[] = [];
  const bindings: BindingMetadata = new Map();

  for (const node of ast.program.body) {
    if (node.type === "ImportDeclaration") {
      importNodes.push(node);
      for (const specifier of node.specifiers) {
        if (specifier.local?.name) {
          bindings.set(specifier.local.name, "import");
        }
      }
      continue;
    }
    if (node.type === "ExportNamedDeclaration") {
      if (node.declaration) {
        setupNodes.push(node.declaration);
        collectBindings(node.declaration, bindings);
      }
      continue;
    }
    if (node.type === "ExportDefaultDeclaration") {
      continue;
    }
    setupNodes.push(node);
    collectBindings(node, bindings);
  }

  const importCode = importNodes.map((n) => babelGenerate(n).code).join("\n");
  const setupCode = setupNodes.map((n) => babelGenerate(n).code).join("\n");
  return { importCode, setupCode, bindings };
}

function collectBindings(node: any, bindings: BindingMetadata) {
  if (!node || typeof node !== "object") return;
  if (node.type === "VariableDeclaration") {
    for (const declarator of node.declarations) {
      if (declarator?.id?.type !== "Identifier") continue;
      const name = declarator.id.name;
      const bindingType = resolveBindingType(node.kind, declarator.init);
      bindings.set(name, bindingType);
    }
    return;
  }
  if (node.type === "FunctionDeclaration") {
    if (node.id?.name) {
      bindings.set(node.id.name, "setup-const");
    }
    return;
  }
  if (node.type === "ClassDeclaration") {
    if (node.id?.name) {
      bindings.set(node.id.name, "setup-const");
    }
  }
}

function resolveBindingType(kind: string, init: any): BindingType {
  if (init && init.type === "CallExpression") {
    const callee = init.callee;
    if (callee?.type === "Identifier" && callee.name === "ref") {
      return "setup-ref";
    }
  }
  if (kind === "let") return "setup-let";
  return "setup-const";
}
