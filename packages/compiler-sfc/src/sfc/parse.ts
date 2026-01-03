import type { SfcDescriptor, SfcStyleBlock } from "../types";

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
  const styles: SfcStyleBlock[] = styleBlocks.map((block) => ({
    content: block.content,
    scoped: "scoped" in block.attrs,
  }));
  return { scriptSetup, template, styles };
}
