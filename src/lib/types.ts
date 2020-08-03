import { CreatedPaths } from './paths';

export type CommandOpts = {
  cwd: string;
  configFilePath?: string;
};

export type GqlCodegenContext = {
  gqlContent: string;
  strippedGqlContent: string;
  gqlContentHash: string;
  sourceRelPath: string;
  sourceFullPath: string;
  tsxRelPath: string;
  tsxFullPath: string;
  dtsRelPath: string;
  dtsFullPath: string;
};

export type CodegenContext = CreatedPaths & {
  gqlHash: string;
  dtsContentDecorator: (content: string) => string;
};

export type SkippedContext = {
  tsxFullPath: string;
  dtsFullPath: string;
};
