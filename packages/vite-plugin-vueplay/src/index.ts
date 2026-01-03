import type { Plugin } from "vite";
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
import { compileSFC } from "@vueplay/compiler-sfc";

function cleanId(id: string) {
  return id.split("?", 1)[0];
}

export default function vueplayPlugin(): Plugin {
  return {
    name: "vite-plugin-vueplay",
    enforce: "pre",
    async transform(code, id) {
      if (!cleanId(id).endsWith(".play.vue")) return;
      const compiled = compileSFC(code);
      const scopeId = compiled.descriptor.scopeId ?? "";
      const styles = (
        await Promise.all(
          compiled.descriptor.styles.map((s) => {
            const scoped = (s as { content: string; scoped?: boolean }).scoped;
            if (scoped && scopeId) {
              return scopeCss(s.content, scopeId);
            }
            return Promise.resolve(s.content);
          }),
        )
      ).join("\n");
      const styleCode = styles
        ? [
            "const __vueplay_style__ = " + JSON.stringify(styles) + ";",
            "if (typeof document !== \"undefined\") {",
            "  const style = document.createElement(\"style\");",
            "  style.setAttribute(\"data-vueplay\", " + JSON.stringify(scopeId || hashId(id)) + ");",
            "  style.textContent = __vueplay_style__;",
            "  document.head.appendChild(style);",
            "}",
          ].join("\n")
        : "";
      return {
        code: [compiled.code, styleCode].filter(Boolean).join("\n"),
        map: null,
      };
    },
  };
}

async function scopeCss(css: string, scopeId: string) {
  const processor = postcss([
    {
      postcssPlugin: "vueplay-scope",
      Rule(rule) {
        rule.selector = selectorParser((selectors) => {
          selectors.each((selector) => {
            let currentCompound: selectorParser.Node[] = [];
            const commitCompound = () => {
              if (!currentCompound.length) return;
              if (hasScopeAttr(currentCompound, scopeId)) {
                currentCompound = [];
                return;
              }
              const insertAt = findInsertPosition(currentCompound);
              const attr = selectorParser.attribute({
                attribute: scopeId,
              } as { attribute: string });
              if (insertAt) {
                insertAt.parent?.insertAfter(insertAt, attr);
              } else {
                selector.append(attr);
              }
              currentCompound = [];
            };

            selector.nodes.forEach((node) => {
              if (node.type === "combinator") {
                commitCompound();
                return;
              }
              currentCompound.push(node);
            });
            commitCompound();
          });
        }).processSync(rule.selector);
      },
    },
  ]);

  const result = await processor.process(css, { from: undefined });
  return result.css;
}

function hasScopeAttr(nodes: selectorParser.Node[], scopeId: string) {
  return nodes.some(
    (node) =>
      node.type === "attribute" && (node as selectorParser.Attribute).attribute === scopeId,
  );
}

function findInsertPosition(nodes: selectorParser.Node[]) {
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i];
    if (node.type === "pseudo" && isPseudoElement(node.value)) {
      continue;
    }
    return node;
  }
  return nodes[nodes.length - 1] ?? null;
}

function isPseudoElement(value: string) {
  return value.startsWith("::") || value === ":before" || value === ":after";
}

function hashId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return `vp-${Math.abs(hash).toString(16)}`;
}
