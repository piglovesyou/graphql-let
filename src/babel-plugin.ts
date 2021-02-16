import { ConfigAPI, NodePath, PluginObj, PluginPass } from '@babel/core';
import { declare } from '@babel/helper-plugin-utils';
import * as t from '@babel/types';
import doSync from 'do-sync';
import {
  getPathsFromState,
  modifyLiteralCalls,
  removeImportDeclaration,
  visitFromProgramPath,
} from './lib/ast';
import { LiteralsArgs } from './lib/literals/literals';
import { LiteralCodegenContext } from './lib/types';

export const processLiteralsWithDtsGenerateSync = doSync(
  ({
    hostDirname,
    ...gqlCompileArgs
  }: LiteralsArgs & {
    hostDirname: string;
  }): /* Promise<LiteralCodegenContext[]> */ any => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require('path');
    const modulePath = join(hostDirname, '../dist/lib/literals/literals');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { processLiteralsWithDtsGenerate } = require(modulePath);
    return processLiteralsWithDtsGenerate(gqlCompileArgs);
  },
);

export type BabelOptions = {
  configFilePath?: string;
  importName?: string;
  onlyMatchImportSuffix?: boolean;
};

export function getGraphQLLetBabelOption(babelOptions: any): BabelOptions {
  for (const { key, options } of babelOptions.plugins || []) {
    if (key.includes('graphql-let/')) {
      return options;
    }
  }
  return {};
}

// With all my respect, I cloned the source from
// https://github.com/gajus/babel-plugin-graphql-tag/blob/master/src/index.js
export const configFunction = (options: BabelOptions = {}): PluginObj<any> => {
  const {
    configFilePath,
    importName = 'graphql-let',
    onlyMatchImportSuffix = false,
    // strip = false,
  } = options;

  return {
    visitor: {
      Program(programPath: NodePath<t.Program>, state: PluginPass) {
        const { cwd, sourceFullPath, sourceRelPath } = getPathsFromState(state);

        const visitLiteralCallResults = visitFromProgramPath(
          programPath,
          importName,
          onlyMatchImportSuffix,
        );
        const {
          literalCallExpressionPaths,
          hasError,
          pendingDeletion,
        } = visitLiteralCallResults;

        // TODO: Handle error

        if (!literalCallExpressionPaths.length) return;

        const literalCodegenContext: LiteralCodegenContext[] = processLiteralsWithDtsGenerateSync(
          {
            hostDirname: __dirname,
            cwd,
            configFilePath,
            sourceRelPath,
            gqlContents: literalCallExpressionPaths.map(([, value]) => value),
          },
        ) as any; // Suppress JSONValue error. LiteralCodegenContext has a function property, but it can be ignored.

        modifyLiteralCalls(
          programPath,
          sourceFullPath,
          literalCallExpressionPaths,
          literalCodegenContext,
        );

        // Only delete import statement or specifier when there is no error
        if (!hasError) {
          removeImportDeclaration(pendingDeletion);
        }
      },
    },
  };
};

export default declare((api: ConfigAPI, options: BabelOptions) => {
  api.assertVersion(7);
  return configFunction(options);
});
