import { parse } from "@babel/parser";
import { generate as babelGenerate } from "@babel/generator";
import type { BindingMetadata, BindingType } from "./types";

type ScriptSetupResult = {
  importCode: string;
  setupCode: string;
  bindings: BindingMetadata;
  propsBindings: Set<string>;
  usesDefineProps: boolean;
};

export function compileScriptSetup(code: string): ScriptSetupResult {
  if (!code.trim()) {
    return {
      importCode: "",
      setupCode: "",
      bindings: new Map(),
      propsBindings: new Set(),
      usesDefineProps: false,
    };
  }
  const ast = parse(code, {
    sourceType: "module",
  });

  const importNodes: any[] = [];
  const setupNodes: any[] = [];
  const bindings: BindingMetadata = new Map();
  const propsBindings = new Set<string>();
  let usesDefineProps = false;

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
        if (transformDefineProps(node.declaration, propsBindings)) {
          usesDefineProps = true;
        }
        collectBindings(node.declaration, bindings);
      }
      continue;
    }
    if (node.type === "ExportDefaultDeclaration") {
      continue;
    }
    setupNodes.push(node);
    if (transformDefineProps(node, propsBindings)) {
      usesDefineProps = true;
    }
    collectBindings(node, bindings);
  }

  for (const prop of propsBindings) {
    if (!bindings.has(prop)) {
      bindings.set(prop, "props");
    }
  }

  const importCode = importNodes.map((n) => babelGenerate(n).code).join("\n");
  const setupCode = setupNodes.map((n) => babelGenerate(n).code).join("\n");
  return { importCode, setupCode, bindings, propsBindings, usesDefineProps };
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

function transformDefineProps(node: any, propsBindings: Set<string>) {
  let used = false;
  if (node.type === "VariableDeclaration") {
    for (const declarator of node.declarations) {
      const call = declarator?.init;
      if (
        call?.type === "CallExpression" &&
        call.callee?.type === "Identifier" &&
        call.callee.name === "defineProps"
      ) {
        used = true;
        const args = call.arguments;
        if (args.length && args[0]?.type === "ArrayExpression") {
          for (const element of args[0].elements) {
            if (element?.type === "StringLiteral") {
              propsBindings.add(element.value);
            }
          }
        }
        declarator.init = { type: "Identifier", name: "__props" };
      }
    }
  } else if (
    node.type === "ExpressionStatement" &&
    node.expression?.type === "CallExpression" &&
    node.expression.callee?.type === "Identifier" &&
    node.expression.callee.name === "defineProps"
  ) {
    used = true;
    const args = node.expression.arguments;
    if (args.length && args[0]?.type === "ArrayExpression") {
      for (const element of args[0].elements) {
        if (element?.type === "StringLiteral") {
          propsBindings.add(element.value);
        }
      }
    }
  }
  return used;
}
