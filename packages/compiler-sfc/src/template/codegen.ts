import type { AttributeNode, TemplateNode } from "../types";
import { parseTemplate } from "./parser";

export function compileTemplateToVNode(template: string, scopeId: string) {
  if (!template) return "null";
  const ast = parseTemplate(template);
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
  const props = genProps(node.props, scopeId);
  const children = genChildren(node.children, scopeId);
  const tag = isComponentTag(node.tag)
    ? resolveComponentTag(node.tag)
    : JSON.stringify(node.tag);
  const staticFlag = isStaticNode(node);
  return staticFlag
    ? `h(${tag}, ${props}, ${children}, true)`
    : `h(${tag}, ${props}, ${children})`;
}

function genProps(props: AttributeNode[], scopeId: string) {
  const entries = props.map((prop) => {
    if (prop.name.startsWith("@")) {
      const eventName = "on" + capitalize(prop.name.slice(1));
      const value = prop.value ? prop.value : "() => {}";
      return `${JSON.stringify(eventName)}: ${value}`;
    }
    if (prop.name.startsWith(":")) {
      const name = prop.name.slice(1);
      const value = prop.value ? prop.value : "undefined";
      return `${JSON.stringify(name)}: ${value}`;
    }
    if (prop.value == null) {
      return `${JSON.stringify(prop.name)}: true`;
    }
    return `${JSON.stringify(prop.name)}: ${JSON.stringify(prop.value)}`;
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
  return attr.name.startsWith("@") || attr.name.startsWith(":");
}

function capitalize(value: string) {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}
