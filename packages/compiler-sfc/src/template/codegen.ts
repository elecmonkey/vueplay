import type { AttributeNode, BindingMetadata, TemplateNode } from "../types";
import { parseTemplate } from "./parser";
import { transformTemplate } from "./transform";

type CodegenContext = {
  bindings: BindingMetadata;
  usesUnref: boolean;
};

export function compileTemplateToVNode(
  template: string,
  scopeId: string,
  bindings: BindingMetadata,
) {
  if (!template) {
    return { code: "null", usesUnref: false };
  }
  const context: CodegenContext = { bindings, usesUnref: false };
  const ast = parseTemplate(template);
  transformTemplate(ast);
  if (ast.length === 1) {
    return {
      code: genNode(ast[0], scopeId, context),
      usesUnref: context.usesUnref,
    };
  }
  return {
    code: `[${ast.map((node) => genNode(node, scopeId, context)).join(", ")}]`,
    usesUnref: context.usesUnref,
  };
}

function genNode(node: TemplateNode, scopeId: string, context: CodegenContext): string {
  if (node.type === "Text") {
    return JSON.stringify(node.content);
  }
  if (node.type === "Interpolation") {
    return `(${genInterpolation(node.content, context)})`;
  }
  return genElement(node, scopeId, context);
}

function genElement(
  node: Extract<TemplateNode, { type: "Element" }>,
  scopeId: string,
  context: CodegenContext,
) {
  const tag = isComponentTag(node.tag)
    ? resolveComponentTag(node.tag)
    : JSON.stringify(node.tag);
  const props = genProps(node, scopeId, context);
  const children = genChildren(node.children, scopeId, context);
  const base = `h(${tag}, ${props}, ${children}${
    isStaticNode(node) ? ", true" : ""
  })`;
  const withIf = node.ifCondition ? `(${node.ifCondition}) ? ${base} : null` : base;
  if (node.forSource) {
    const value = node.forValue && node.forValue.length ? node.forValue : "item";
    return `(${node.forSource}).map((${value}) => ${withIf})`;
  }
  return withIf;
}

function genProps(
  node: Extract<TemplateNode, { type: "Element" }>,
  scopeId: string,
  context: CodegenContext,
) {
  const props = node.codegenProps ?? [];
  const entries = props.map((prop) => {
    const value = prop.isExpression
      ? genExpression(prop.value, context)
      : JSON.stringify(prop.value);
    return `${JSON.stringify(prop.key)}: ${value}`;
  });
  if (scopeId) {
    entries.push(`${JSON.stringify(scopeId)}: true`);
  }
  if (!entries.length) return "null";
  return `{ ${entries.join(", ")} }`;
}

function genChildren(
  children: TemplateNode[],
  scopeId: string,
  context: CodegenContext,
) {
  if (!children.length) return "null";
  return `[${children
    .map((node) => genNode(node, scopeId, context))
    .join(", ")}]`;
}

function isComponentTag(tag: string) {
  return tag.includes("-") || /[A-Z]/.test(tag);
}

function resolveComponentTag(tag: string) {
  if (tag.includes("-")) {
    return toPascalCase(tag);
  }
  return tag;
}

function toPascalCase(tag: string) {
  return tag
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join("");
}

function isStaticNode(node: TemplateNode): boolean {
  if (node.type === "Interpolation") return false;
  if (node.type === "Text") return true;
  if (isComponentTag(node.tag)) return false;
  if (node.props.some(isDynamicAttr)) return false;
  for (const child of node.children) {
    if (!isStaticNode(child)) return false;
  }
  return true;
}

function isDynamicAttr(attr: AttributeNode) {
  return attr.type === "Directive";
}

function genInterpolation(exp: string, context: CodegenContext) {
  const trimmed = exp.trim();
  if (!isSimpleIdentifier(trimmed)) {
    return trimmed;
  }
  const type = context.bindings.get(trimmed);
  if (type === "props") {
    return `__props.${trimmed}`;
  }
  if (type === "import") {
    return trimmed;
  }
  context.usesUnref = true;
  return `unref(${trimmed})`;
}

function isSimpleIdentifier(exp: string) {
  return /^[A-Za-z_$][\w$]*$/.test(exp);
}

function genExpression(exp: string, context: CodegenContext) {
  const trimmed = exp.trim();
  if (!isSimpleIdentifier(trimmed)) {
    return exp;
  }
  return genInterpolation(trimmed, context);
}
