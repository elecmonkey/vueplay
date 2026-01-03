import type {
  Attribute,
  AttributeNode,
  ParserContext,
  TemplateNode,
} from "../types";

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const RAWTEXT_TAGS = new Set(["script", "style"]);
const RCDATA_TAGS = new Set(["textarea", "title"]);

export function parseTemplate(source: string) {
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
  if (element.isSelfClosing || VOID_TAGS.has(element.tag)) {
    return {
      type: "Element",
      tag: element.tag,
      props: element.props,
      children: [],
    };
  }
  if (RAWTEXT_TAGS.has(element.tag)) {
    const rawText = parseRawText(context, element.tag);
    return {
      type: "Element",
      tag: element.tag,
      props: element.props,
      children: rawText ? [{ type: "Text", content: rawText }] : [],
    };
  }
  if (RCDATA_TAGS.has(element.tag)) {
    const rcdata = parseRcdata(context, element.tag);
    return {
      type: "Element",
      tag: element.tag,
      props: element.props,
      children: rcdata ? [{ type: "Text", content: rcdata }] : [],
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
    const nameMatch = /^[^\t\r\n\f \/>][^\t\r\n\f \/>=]*/.exec(
      context.source,
    );
    if (!nameMatch) break;
    const name = nameMatch[0];
    advanceBy(context, name.length);
    let value: string | undefined;
    const eqMatch = /^[\t\r\n\f ]*=/.exec(context.source);
    if (eqMatch) {
      advanceBy(context, eqMatch[0].length);
      value = parseAttributeValue(context);
    }
    props.push(parseAttributeNode(name, value));
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

function parseAttributeNode(name: string, value?: string): AttributeNode {
  if (name.startsWith("@")) {
    const { arg, modifiers } = parseArgAndModifiers(name.slice(1));
    return {
      type: "Directive",
      name: "on",
      arg,
      exp: value,
      modifiers,
    };
  }
  if (name.startsWith(":")) {
    const { arg, modifiers } = parseArgAndModifiers(name.slice(1));
    return {
      type: "Directive",
      name: "bind",
      arg,
      exp: value,
      modifiers,
    };
  }
  if (name.startsWith("v-")) {
    const raw = name.slice(2);
    const [dirName, argAndMods] = raw.split(":", 2);
    const { arg, modifiers } = parseArgAndModifiers(argAndMods ?? "");
    return {
      type: "Directive",
      name: dirName,
      arg,
      exp: value,
      modifiers,
    };
  }
  const attr: Attribute = {
    type: "Attribute",
    name,
    value,
  };
  return attr;
}

function parseArgAndModifiers(input: string) {
  if (!input) return { arg: undefined, modifiers: undefined as string[] | undefined };
  const parts = input.split(".");
  const arg = parts.shift();
  const modifiers = parts.length ? parts : undefined;
  return { arg, modifiers };
}

function parseRawText(context: ParserContext, tag: string) {
  const closeTag = `</${tag}>`;
  const closeIndex = context.source.indexOf(closeTag);
  if (closeIndex === -1) {
    const content = context.source;
    context.source = "";
    return content;
  }
  const content = context.source.slice(0, closeIndex);
  advanceBy(context, closeIndex + closeTag.length);
  return content;
}

function parseRcdata(context: ParserContext, tag: string) {
  return parseRawText(context, tag);
}
