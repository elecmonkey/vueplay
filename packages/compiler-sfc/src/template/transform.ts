import type {
  Attribute,
  CodegenProp,
  DirectiveNode,
  TemplateNode,
} from "../types";

export function transformTemplate(ast: TemplateNode[]) {
  for (const node of ast) {
    transformNode(node);
  }
}

function transformNode(node: TemplateNode) {
  if (node.type === "Element") {
    node.codegenProps = [];
    for (const prop of node.props) {
      if (prop.type === "Attribute") {
        node.codegenProps.push(transformAttribute(prop));
        continue;
      }
      const directive = prop as DirectiveNode;
      const transform = directiveTransforms[directive.name];
      if (transform) {
        transform(node, directive);
      }
    }

    for (const child of node.children) {
      transformNode(child);
    }
  }
}

const directiveTransforms: Record<string, DirectiveTransform | undefined> = {
  on: transformOn,
  bind: transformBind,
  if: transformIf,
  for: transformFor,
  model: transformModel,
};

type DirectiveTransform = (node: Extract<TemplateNode, { type: "Element" }>,
  dir: DirectiveNode) => void;

function transformAttribute(attr: Attribute): CodegenProp {
  if (attr.value == null) {
    return { key: attr.name, value: "true", isExpression: true };
  }
  return { key: attr.name, value: attr.value, isExpression: false };
}

function transformOn(node: Extract<TemplateNode, { type: "Element" }>, dir: DirectiveNode) {
  if (!dir.arg) return;
  const key = "on" + capitalize(dir.arg);
  const value = dir.exp && dir.exp.length ? dir.exp : "() => {}";
  node.codegenProps?.push({ key, value, isExpression: true });
}

function transformBind(node: Extract<TemplateNode, { type: "Element" }>, dir: DirectiveNode) {
  if (!dir.arg) return;
  const key = dir.arg;
  const value = dir.exp && dir.exp.length ? dir.exp : "undefined";
  node.codegenProps?.push({ key, value, isExpression: true });
}

function transformIf(node: Extract<TemplateNode, { type: "Element" }>, dir: DirectiveNode) {
  node.ifCondition = dir.exp && dir.exp.length ? dir.exp : "false";
}

function transformFor(node: Extract<TemplateNode, { type: "Element" }>, dir: DirectiveNode) {
  if (!dir.exp) return;
  const match = dir.exp.split(/\s+in\s+/);
  if (match.length !== 2) return;
  const rawValue = match[0].trim();
  const source = match[1].trim();
  node.forSource = source;
  node.forValue = normalizeForValue(rawValue);
}

function normalizeForValue(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function transformModel(node: Extract<TemplateNode, { type: "Element" }>, dir: DirectiveNode) {
  if (!dir.exp) return;
  node.codegenProps?.push({
    key: "value",
    value: dir.exp,
    isExpression: true,
  });
  node.codegenProps?.push({
    key: "onInput",
    value: `(e) => (${dir.exp} = e.target.value)`,
    isExpression: true,
  });
}

function capitalize(value: string) {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
}
