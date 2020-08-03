export type CommandOpts = {
  cwd: string;
  configFilePath?: string;
};

export type CreatedPathsBase = {
  // "tsx" stands for `.ts(x)`s generated by GraphQL code generator as intermediate artifacts
  tsxRelPath: string;
  tsxFullPath: string;
  // "dts" stands for `.d.ts`s generated by graphql-let
  dtsRelPath: string;
  dtsFullPath: string;
};

export type CodegenContextBase = {
  gqlHash: string;
  // If true, cache is fresh, so we don't need to generate new one.
  skip: boolean;
  dtsContentDecorator: (content: string) => string;
};

/**
 * Assumes `.graphql`s and `.graphqls`s
 */
export type FileCreatedPaths = CreatedPathsBase & {
  gqlRelPath: string;
  gqlFullPath: string;
};

/**
 * Assumes `gql(`query {}`)` calls in `.ts(x)`s
 */
export type LiteralCreatedPaths = CreatedPathsBase & {
  srcRelPath: string;
  srcFullPath: string;
};

export type FileCodegenContext = {} & CodegenContextBase & FileCreatedPaths;

export type LiteralCodegenContext = {
  gqlContent: string;
  strippedGqlContent: string;
} & CodegenContextBase &
  LiteralCreatedPaths;

export type CodegenContext = FileCodegenContext | LiteralCodegenContext;

export function isLiteralContext(context: CodegenContext): boolean {
  return Boolean((context as LiteralCodegenContext).strippedGqlContent);
}
