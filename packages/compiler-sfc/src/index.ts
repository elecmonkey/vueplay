import { parse } from "@babel/parser";
import { generate as babelGenerate } from "@babel/generator";

export type SfcStyleBlock = {
  content: string;
  scoped?: boolean;
};

export type SfcDescriptor = {
  scriptSetup: string;
  template: string;
  styles: SfcStyleBlock[];
  scopeId?: string;
};

type CompiledSfc = {
  code: string;
  descriptor: SfcDescriptor;
};

type SfcBlock = {
  type: "template" | "script" | "style";
  content: string;
  attrs: Record<string, string | true>;
};

function parseSFCBlocks(source: string): SfcBlock[] {
  const blocks: SfcBlock[] = [];
  let index = 0;

  while (index < source.length) {
    const start = source.indexOf("<", index);
    if (start === -1) break;
    if (source.startsWith("<!--", start)) {
      const endComment = source.indexOf("-->", start + 4);
      index = endComment === -1 ? source.length : endComment + 3;
      continue;
    }
    if (source[start + 1] === "/") {
      index = start + 2;
      continue;
    }
    const tagInfo = parseSfcTag(source, start);
    if (!tagInfo) {
      index = start + 1;
      continue;
    }
    const { tag, attrs, endIndex, selfClosing } = tagInfo;
    if (tag !== "template" && tag !== "script" && tag !== "style") {
      index = endIndex + 1;
      continue;
    }
    if (selfClosing) {
      blocks.push({ type: tag, content: "", attrs });
      index = endIndex + 1;
      continue;
    }
    const closeTag = `</${tag}`;
    const closeIndex = source.indexOf(closeTag, endIndex + 1);
    if (closeIndex === -1) {
      const content = source.slice(endIndex + 1);
      blocks.push({ type: tag, content: content.trim(), attrs });
      break;
    }
    const content = source.slice(endIndex + 1, closeIndex);
    const closeEnd = source.indexOf(">", closeIndex);
    blocks.push({ type: tag, content: content.trim(), attrs });
    index = closeEnd === -1 ? source.length : closeEnd + 1;
  }

  return blocks;
}

function parseSfcTag(source: string, start: number) {
  let i = start + 1;
  while (i < source.length && /[\t\r\n\f ]/.test(source[i])) i += 1;
  const tagStart = i;
  while (i < source.length && /[A-Za-z]/.test(source[i])) i += 1;
  if (i === tagStart) return null;
  const tag = source.slice(tagStart, i);
  const { endIndex, rawAttrs, selfClosing } = readSfcTagRest(source, i);
  const attrs = parseSfcAttrs(rawAttrs);
  return { tag, attrs, endIndex, selfClosing };
}

function readSfcTagRest(source: string, start: number) {
  let i = start;
  let quote: string | null = null;
  while (i < source.length) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
      i += 1;
      continue;
    }
    if (ch === "\"" || ch === "'") {
      quote = ch;
      i += 1;
      continue;
    }
    if (ch === ">") {
      const raw = source.slice(start, i).trim();
      const selfClosing = raw.endsWith("/");
      return {
        endIndex: i,
        rawAttrs: selfClosing ? raw.slice(0, -1) : raw,
        selfClosing,
      };
    }
    i += 1;
  }
  return { endIndex: source.length - 1, rawAttrs: "", selfClosing: false };
}

function parseSfcAttrs(raw: string) {
  const attrs: Record<string, string | true> = {};
  let i = 0;
  while (i < raw.length) {
    while (i < raw.length && /[\t\r\n\f ]/.test(raw[i])) i += 1;
    if (i >= raw.length) break;
    const nameStart = i;
    while (i < raw.length && !/[\t\r\n\f =]/.test(raw[i])) i += 1;
    const name = raw.slice(nameStart, i);
    while (i < raw.length && /[\t\r\n\f ]/.test(raw[i])) i += 1;
    if (raw[i] === "=") {
      i += 1;
      while (i < raw.length && /[\t\r\n\f ]/.test(raw[i])) i += 1;
      const quote = raw[i] === "\"" || raw[i] === "'" ? raw[i] : null;
      if (quote) i += 1;
      const valueStart = i;
      while (
        i < raw.length &&
        (quote ? raw[i] !== quote : !/[\t\r\n\f ]/.test(raw[i]))
      ) {
        i += 1;
      }
      const value = raw.slice(valueStart, i);
      if (quote && raw[i] === quote) i += 1;
      attrs[name] = value;
    } else {
      attrs[name] = true;
    }
  }
  return attrs;
}

export function parseSFC(source: string): SfcDescriptor {
  const blocks = parseSFCBlocks(source);
  const templateBlock = blocks.find((b) => b.type === "template");
  const scriptSetupBlock = blocks.find(
    (b) => b.type === "script" && "setup" in b.attrs,
  );
  const styleBlocks = blocks.filter((b) => b.type === "style");
  const scriptSetup = scriptSetupBlock ? scriptSetupBlock.content : "";
  const template = templateBlock ? templateBlock.content : "";
  const styles = styleBlocks.map((block) => ({
    content: block.content,
    scoped: "scoped" in block.attrs,
  }));
  return { scriptSetup, template, styles };
}

function indent(code: string, spaces: number) {
  const pad = " ".repeat(spaces);
  return code
    .split("\n")
    .map((line) => (line.length ? pad + line : line))
    .join("\n");
}

function compileScriptSetup(code: string) {
  if (!code.trim()) {
    return { importCode: "", setupCode: "" };
  }
  const ast = parse(code, {
    sourceType: "module",
  });

  const importNodes: any[] = [];
  const setupNodes: any[] = [];

  for (const node of ast.program.body) {
    if (node.type === "ImportDeclaration") {
      importNodes.push(node);
      continue;
    }
    if (node.type === "ExportNamedDeclaration") {
      if (node.declaration) {
        setupNodes.push(node.declaration);
      }
      continue;
    }
    if (node.type === "ExportDefaultDeclaration") {
      continue;
    }
    setupNodes.push(node);
  }

  const importCode = importNodes.map((n) => babelGenerate(n).code).join("\n");
  const setupCode = setupNodes.map((n) => babelGenerate(n).code).join("\n");
  return { importCode, setupCode };
}

export function compileSFC(source: string): CompiledSfc {
  const descriptor = parseSFC(source);
  const { importCode, setupCode } = compileScriptSetup(descriptor.scriptSetup);
  const template = descriptor.template.trim();
  const styles = descriptor.styles.map((s) => s.content.trim());
  const hasScoped = descriptor.styles.some((s) => s.scoped);
  const scopeId = hasScoped ? `data-v-${hashCode(source)}` : "";
  if (scopeId) {
    descriptor.scopeId = scopeId;
  }

  const renderBody = `return () => ${compileTemplateToVNode(
    template,
    scopeId,
  )};`;
  const setupBody = [setupCode, renderBody].filter(Boolean).join("\n");

  const code = [
    'import { h } from "@vueplay/runtime";',
    importCode,
    "const __sfc__ = {",
    "  setup() {",
    indent(setupBody, 4),
    "  },",
    "};",
    "export default __sfc__;",
  ]
    .filter(Boolean)
    .join("\n");

  return { code, descriptor };
}

type TemplateNode =
  | { type: "Element"; tag: string; props: AttributeNode[]; children: TemplateNode[] }
  | { type: "Text"; content: string }
  | { type: "Interpolation"; content: string };

type AttributeNode = {
  name: string;
  value?: string;
};

type ParserContext = {
  source: string;
};

function compileTemplateToVNode(template: string, scopeId: string) {
  if (!template) return "null";
  const ast = parseTemplate(template);
  if (ast.length === 1) {
    return genNode(ast[0], scopeId);
  }
  return `[${ast.map((node) => genNode(node, scopeId)).join(", ")}]`;
}

function parseTemplate(source: string) {
  const context: ParserContext = { source };
  return parseChildren(context, []);
}

function parseChildren(context: ParserContext, ancestors: string[]): TemplateNode[] {
  const nodes: TemplateNode[] = [];
  while (!isEnd(context, ancestors)) {
    const s = context.source;
    if (s.startsWith("{{")) {
      nodes.push(parseInterpolation(context));
      continue;
    }
    if (s[0] === "<" && /[a-z]/i.test(s[1] ?? "")) {
      nodes.push(parseElement(context, ancestors));
      continue;
    }
    const text = parseText(context);
    if (text) nodes.push(text);
  }
  return nodes;
}

function isEnd(context: ParserContext, ancestors: string[]) {
  if (!context.source) return true;
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const tag = ancestors[i];
    if (context.source.startsWith(`</${tag}`)) {
      return true;
    }
  }
  return false;
}

function advanceBy(context: ParserContext, numberOfCharacters: number) {
  context.source = context.source.slice(numberOfCharacters);
}

function parseInterpolation(context: ParserContext): TemplateNode {
  const closeIndex = context.source.indexOf("}}", 2);
  const rawContent = context.source.slice(2, closeIndex).trim();
  advanceBy(context, closeIndex + 2);
  return {
    type: "Interpolation",
    content: rawContent,
  };
}

function parseText(context: ParserContext): TemplateNode | null {
  let endIndex = context.source.length;
  const ltIndex = context.source.indexOf("<");
  const interpIndex = context.source.indexOf("{{");
  if (ltIndex !== -1 && ltIndex < endIndex) endIndex = ltIndex;
  if (interpIndex !== -1 && interpIndex < endIndex) endIndex = interpIndex;
  const content = context.source.slice(0, endIndex);
  advanceBy(context, endIndex);
  if (!content.trim()) return null;
  return {
    type: "Text",
    content,
  };
}

function parseElement(context: ParserContext, ancestors: string[]): TemplateNode {
  const element = parseTag(context);
  if (element.isSelfClosing) {
    return {
      type: "Element",
      tag: element.tag,
      props: element.props,
      children: [],
    };
  }
  ancestors.push(element.tag);
  const children = parseChildren(context, ancestors);
  ancestors.pop();
  if (context.source.startsWith(`</${element.tag}`)) {
    parseTag(context, true);
  }
  return {
    type: "Element",
    tag: element.tag,
    props: element.props,
    children,
  };
}

function parseTag(context: ParserContext, isEnd = false) {
  const match = /^<\/?([a-z][^\t\r\n\f \/>]*)/i.exec(context.source);
  const tag = match ? match[1] : "";
  advanceBy(context, match ? match[0].length : 0);
  advanceSpaces(context);
  const props = isEnd ? [] : parseAttributes(context);
  let isSelfClosing = false;
  if (context.source.startsWith("/>")) {
    isSelfClosing = true;
    advanceBy(context, 2);
  } else if (context.source.startsWith(">")) {
    advanceBy(context, 1);
  }
  return { tag, props, isSelfClosing };
}

function parseAttributes(context: ParserContext) {
  const props: AttributeNode[] = [];
  while (
    context.source.length > 0 &&
    !context.source.startsWith(">") &&
    !context.source.startsWith("/>")
  ) {
    const nameMatch = /^[^\t\r\n\f \/>][^\t\r\n\f \/>=]*/.exec(context.source);
    if (!nameMatch) break;
    const name = nameMatch[0];
    advanceBy(context, name.length);
    let value: string | undefined;
    const eqMatch = /^[\t\r\n\f ]*=/.exec(context.source);
    if (eqMatch) {
      advanceBy(context, eqMatch[0].length);
      value = parseAttributeValue(context);
    }
    props.push({ name, value });
    advanceSpaces(context);
  }
  return props;
}

function advanceSpaces(context: ParserContext) {
  const match = /^[\t\r\n\f ]+/.exec(context.source);
  if (match) {
    advanceBy(context, match[0].length);
  }
}

function parseAttributeValue(context: ParserContext) {
  const quote = context.source[0];
  if (quote === "\"" || quote === "'") {
    advanceBy(context, 1);
    const endIndex = context.source.indexOf(quote);
    const content = context.source.slice(0, endIndex);
    advanceBy(context, endIndex + 1);
    return content;
  }
  const match = /^[^\t\r\n\f >]+/.exec(context.source);
  const content = match ? match[0] : "";
  advanceBy(context, content.length);
  return content;
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
  return `h(${tag}, ${props}, ${children})`;
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

function hashCode(source: string) {
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function capitalize(value: string) {
  if (!value) return value;
  return value[0].toUpperCase() + value.slice(1);
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
