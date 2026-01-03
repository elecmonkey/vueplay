import type { AttributeNode, TemplateNode } from "../types";
import { parseTemplate } from "./parser";
import { transformTemplate } from "./transform";

export function compileTemplateToVNode(template: string, scopeId: string) {
  if (!template) return "null";
  const ast = parseTemplate(template);
  transformTemplate(ast);
  if (ast.length === 1) {
    return genNode(ast[0], scopeId);
  }
  return `[${ast.map((node) => genNode(node, scopeId)).join(", ")}]`;
}

function genNode(node: TemplateNode, scopeId: string): string {
  if (node.type === "Text") {
    return JSON.stringify(node.content);
  }
  if (node.type === "Interpolation") {
    return `(${node.content})`;
  }
  return genElement(node, scopeId);
}

function genElement(node: Extract<TemplateNode, { type: "Element" }>, scopeId: string) {
  const tag = isComponentTag(node.tag)
    ? resolveComponentTag(node.tag)
    : JSON.stringify(node.tag);
  const props = genProps(node, scopeId);
  const children = genChildren(node.children, scopeId);
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

function genProps(node: Extract<TemplateNode, { type: "Element" }>, scopeId: string) {
  const props = node.codegenProps ?? [];
  const entries = props.map((prop) => {
    const value = prop.isExpression ? prop.value : JSON.stringify(prop.value);
    return `${JSON.stringify(prop.key)}: ${value}`;
  });
  if (scopeId) {
    entries.push(`${JSON.stringify(scopeId)}: true`);
  }
  if (!entries.length) return "null";
  return `{ ${entries.join(", ")} }`;
}

function genChildren(children: TemplateNode[], scopeId: string) {
  if (!children.length) return "null";
  return `[${children.map((node) => genNode(node, scopeId)).join(", ")}]`;
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
