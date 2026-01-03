import type { Plugin } from "vite";
import { compileSFC } from "@vueplay/compiler-sfc";

function cleanId(id: string) {
  return id.split("?", 1)[0];
}

export default function vueplayPlugin(): Plugin {
  return {
    name: "vite-plugin-vueplay",
    enforce: "pre",
    transform(code, id) {
      if (!cleanId(id).endsWith(".play.vue")) return;
      const compiled = compileSFC(code);
      const scopeId = compiled.descriptor.scopeId ?? "";
      const styles = compiled.descriptor.styles
        .map((s) =>
          (s as { content: string; scoped?: boolean }).scoped && scopeId
            ? scopeCss(s.content, scopeId)
            : s.content,
        )
        .join("\n");
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

function scopeCss(css: string, scopeId: string) {
  const attr = `[${scopeId}]`;
  return css.replace(/([^{}]+)\{/g, (full, selector) => {
    const trimmed = selector.trim();
    if (!trimmed || trimmed.startsWith("@")) {
      return full;
    }
    const scoped = trimmed
      .split(",")
      .map((sel: string) => {
        const s = sel.trim();
        if (!s) return s;
        if (s.includes(attr)) return s;
        return `${s}${attr}`;
      })
      .join(", ");
    return `${scoped}{`;
  });
}

function hashId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  return `vp-${Math.abs(hash).toString(16)}`;
}
