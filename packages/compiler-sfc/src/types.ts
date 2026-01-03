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

export type TemplateNode =
  | { type: "Element"; tag: string; props: AttributeNode[]; children: TemplateNode[] }
  | { type: "Text"; content: string }
  | { type: "Interpolation"; content: string };

export type AttributeNode = {
  name: string;
  value?: string;
};

export type ParserContext = {
  source: string;
};
