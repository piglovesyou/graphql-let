import { ConfigAPI, NodePath, PluginObj, PluginPass } from '@babel/core';
import { declare } from '@babel/helper-plugin-utils';
import * as t from '@babel/types';
import doSync from 'do-sync';
import {
  getPathsFromState,
  LiteralCallExpressionPaths,
  modifyLiteralCalls,
  PendingDeletion,
  removeImportDeclaration,
  VisitLiteralCallResults,
} from './lib/ast';
import { LiteralsArgs } from './lib/literals/literals';
import { printError } from './lib/print';
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

export function visitFromProgramPath(
  programPath: NodePath<t.Program>,
  importName: string,
  onlyMatchImportSuffix: boolean,
): VisitLiteralCallResults {
  const pendingDeletion: PendingDeletion = [];
  const literalCallExpressionPaths: LiteralCallExpressionPaths = [];
  let hasError = false;

  const tagNames: string[] = [];

  function processTargetCalls(
    path: NodePath<t.TaggedTemplateExpression> | NodePath<t.CallExpression>,
    nodeName: string,
  ) {
    if (
      tagNames.some((name) => {
        return t.isIdentifier((path.get(nodeName) as any).node, { name });
      })
    ) {
      try {
        let value = '';
        path.traverse({
          TemplateLiteral(path: NodePath<t.TemplateLiteral>) {
            if (path.node.quasis.length !== 1)
              printError(
                new Error(
                  `TemplateLiteral of the argument must not contain arguments.`,
                ),
              );
            value = path.node.quasis[0].value.raw;
          },
          StringLiteral(path: NodePath<t.StringLiteral>) {
            value = path.node.value;
          },
        });
        if (!value) printError(new Error(`Check argument.`));
        literalCallExpressionPaths.push([path, value]);
      } catch (error) {
        printError(error);
        hasError = true;
      }
    }
  }

  programPath.traverse({
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const pathValue = path.node.source.value;
      if (
        onlyMatchImportSuffix
          ? pathValue.endsWith(importName)
          : pathValue === importName
      ) {
        for (const specifier of path.node.specifiers) {
          if (!t.isImportSpecifier(specifier)) continue;
          tagNames.push(specifier.local.name);
          pendingDeletion.push({ specifier, path });
        }
      }
    },
    CallExpression(path: NodePath<t.CallExpression>) {
      processTargetCalls(path, 'callee');
    },
    TaggedTemplateExpression(path: NodePath<t.TaggedTemplateExpression>) {
      processTargetCalls(path, 'tag');
    },
  });
  return {
    pendingDeletion,
    literalCallExpressionPaths: literalCallExpressionPaths,
    hasError,
  };
}

// With all my respect, I cloned the source from
// https://github.com/gajus/babel-plugin-graphql-tag/blob/master/src/index.js
export const configFunction = (
  options: BabelOptions = {},
  shouldRemoveImportDeclaration = true,
): PluginObj<any> => {
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
        if (shouldRemoveImportDeclaration && !hasError) {
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
