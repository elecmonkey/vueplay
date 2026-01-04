import { parseExpression } from "@babel/parser";
import * as t from "@babel/types";
import generator from "@babel/generator";
import type { BindingMetadata } from "../types";

export type RewriteResult = {
  code: string;
  usesUnref: boolean;
};

type GeneratorFn = typeof import("@babel/generator").default;
const generate = (() => {
  const mod = generator as unknown as { default?: GeneratorFn };
  return (mod.default ?? (generator as unknown as GeneratorFn)) as GeneratorFn;
})();

export function rewriteExpression(
  exp: string,
  bindings: BindingMetadata,
): RewriteResult {
  const ast = parseExpression(exp, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  let usesUnref = false;
  const scopeStack: Set<string>[] = [new Set()];

  const addLocal = (name: string) => {
    scopeStack[scopeStack.length - 1].add(name);
  };

  const isLocal = (name: string) => {
    for (let i = scopeStack.length - 1; i >= 0; i -= 1) {
      if (scopeStack[i].has(name)) return true;
    }
    return false;
  };

  const collectPattern = (pattern: t.Node | null) => {
    if (!pattern) return;
    if (t.isIdentifier(pattern)) {
      addLocal(pattern.name);
      return;
    }
    if (t.isObjectPattern(pattern)) {
      for (const prop of pattern.properties) {
        if (t.isObjectProperty(prop)) {
          collectPattern(prop.value as t.Pattern);
        } else if (t.isRestElement(prop)) {
          collectPattern(prop.argument as t.Pattern);
        }
      }
      return;
    }
    if (t.isArrayPattern(pattern)) {
      for (const element of pattern.elements) {
        collectPattern(element as t.Node);
      }
      return;
    }
    if (t.isRestElement(pattern)) {
      collectPattern(pattern.argument as t.Node);
      return;
    }
    if (t.isAssignmentPattern(pattern)) {
      collectPattern(pattern.left as t.Node);
    }
  };

  const rewriteIdentifier = (
    node: t.Identifier,
    parent: t.Node | null,
    key: string | number | null,
  ) => {
    if (isExcludedIdentifier(node, parent, key)) return node;
    const name = node.name;
    if (isLocal(name)) return node;

    const bindingType = bindings.get(name);
    if (bindingType === "props") {
      return t.memberExpression(t.identifier("__props"), t.identifier(name));
    }
    if (bindingType === "import") {
      return node;
    }

    usesUnref = true;
    return t.callExpression(t.identifier("unref"), [t.identifier(name)]);
  };

  const visit = (node: t.Node | null, parent: t.Node | null, key: string | number | null): t.Node | null => {
    if (!node) return node;

    if (t.isIdentifier(node)) {
      return rewriteIdentifier(node, parent, key);
    }

    if (t.isFunction(node)) {
      scopeStack.push(new Set());
      for (const param of node.params) {
        collectPattern(param as t.Pattern);
      }
      if (t.isFunctionDeclaration(node) && node.id) {
        addLocal(node.id.name);
      }
      node.body = visit(node.body as t.Node, node, "body") as t.BlockStatement | t.Expression;
      scopeStack.pop();
      return node;
    }

    if (t.isCatchClause(node)) {
      scopeStack.push(new Set());
      collectPattern(node.param as t.Pattern);
      node.body = visit(node.body, node, "body") as t.BlockStatement;
      scopeStack.pop();
      return node;
    }

    if (t.isVariableDeclaration(node)) {
      for (const declarator of node.declarations) {
        collectPattern(declarator.id as t.Pattern);
        if (declarator.init) {
          declarator.init = visit(declarator.init, declarator, "init") as t.Expression;
        }
      }
      return node;
    }

    if (t.isMemberExpression(node)) {
      node.object = visit(node.object as t.Node, node, "object") as t.Expression;
      if (node.computed) {
        node.property = visit(node.property as t.Node, node, "property") as t.Expression;
      }
      return node;
    }

    if (t.isObjectProperty(node)) {
      if (node.computed) {
        node.key = visit(node.key as t.Node, node, "key") as t.Expression;
      }
      node.value = visit(node.value as t.Node, node, "value") as t.Expression;
      return node;
    }

    const keys = (t.VISITOR_KEYS as Record<string, string[]>)[node.type] || [];
    for (const childKey of keys) {
      const value = (node as any)[childKey];
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i += 1) {
          const child = value[i];
          if (child && typeof child.type === "string") {
            value[i] = visit(child, node, childKey) as any;
          }
        }
      } else if (value && typeof value.type === "string") {
        (node as any)[childKey] = visit(value, node, childKey) as any;
      }
    }

    return node;
  };

  visit(ast, null, null);

  return { code: generate(ast).code, usesUnref };
}

function isExcludedIdentifier(
  node: t.Identifier,
  parent: t.Node | null,
  key: string | number | null,
) {
  if (!parent) return false;

  if (t.isMemberExpression(parent)) {
    if (parent.property === node && !parent.computed) return true;
  }
  if (t.isObjectProperty(parent)) {
    if (parent.key === node && !parent.computed) return true;
  }
  if (t.isObjectMethod(parent)) {
    if (parent.key === node && !parent.computed) return true;
  }
  if (t.isFunctionDeclaration(parent) && parent.id === node) return true;
  if (t.isClassDeclaration(parent) && parent.id === node) return true;
  if (t.isLabeledStatement(parent)) return true;
  if (t.isImportSpecifier(parent) || t.isImportDefaultSpecifier(parent) || t.isImportNamespaceSpecifier(parent)) {
    return true;
  }
  if (t.isExportSpecifier(parent)) return true;
  if (t.isObjectPattern(parent)) return true;
  if (t.isArrayPattern(parent)) return true;
  if (t.isRestElement(parent)) return true;
  if (t.isAssignmentPattern(parent)) return true;
  if (t.isUpdateExpression(parent) && parent.argument === node) return false;
  if (t.isAssignmentExpression(parent) && parent.left === node) return false;
  if (t.isVariableDeclarator(parent) && parent.id === node) return true;
  if (key === "id") return true;
  return false;
}
