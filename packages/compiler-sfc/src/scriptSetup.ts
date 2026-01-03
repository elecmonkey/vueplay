import { parse } from "@babel/parser";
import { generate as babelGenerate } from "@babel/generator";

type ScriptSetupResult = {
  importCode: string;
  setupCode: string;
};

export function compileScriptSetup(code: string): ScriptSetupResult {
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
