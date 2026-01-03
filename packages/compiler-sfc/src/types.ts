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

export type BindingType =
  | "setup-const"
  | "setup-let"
  | "setup-ref"
  | "props"
  | "import"
  | "unknown";

export type BindingMetadata = Map<string, BindingType>;

export type TemplateNode =
  | {
      type: "Element";
      tag: string;
      props: AttributeNode[];
      children: TemplateNode[];
      codegenProps?: CodegenProp[];
      ifCondition?: string;
      forSource?: string;
      forValue?: string;
    }
  | { type: "Text"; content: string }
  | { type: "Interpolation"; content: string };

export type AttributeNode = Attribute | DirectiveNode;

export type Attribute = {
  type: "Attribute";
  name: string;
  value?: string;
};

export type DirectiveNode = {
  type: "Directive";
  name: string;
  arg?: string;
  exp?: string;
  modifiers?: string[];
};

export type CodegenProp = {
  key: string;
  value: string;
  isExpression: boolean;
};

export type ParserContext = {
  source: string;
};
