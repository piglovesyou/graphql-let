import { ConfigAPI, NodePath, PluginObj, PluginPass, types } from '@babel/core';
import { declare } from '@babel/helper-plugin-utils';
import * as t from '@babel/types';
import doSync from 'do-sync';
import { dirname, relative } from 'path';
import slash from 'slash';
import { getPathsFromState, LiteralCallExpressionPaths } from './lib/ast';
import { LiteralsArgs } from './lib/literals/literals';
import { printError } from './lib/print';
import { CodegenContext, LiteralCodegenContext } from './lib/types';

const {
  isIdentifier,
  isImportDefaultSpecifier,
  identifier,
  importDeclaration,
  importNamespaceSpecifier,
  valueToNode,
} = types;

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

type VisitLiteralCallResults = {
  pendingDeletion: {
    defaultSpecifier:
      | t.ImportSpecifier
      | t.ImportDefaultSpecifier
      | t.ImportNamespaceSpecifier;
    path: NodePath<t.ImportDeclaration>;
  }[];
  literalCallExpressionPaths: LiteralCallExpressionPaths;
  hasError: boolean;
};

export function visitLiteralCalls(
  programPath: NodePath<t.Program>,
  importName: string,
  onlyMatchImportSuffix: boolean,
): VisitLiteralCallResults {
  const pendingDeletion: {
    defaultSpecifier:
      | t.ImportSpecifier
      | t.ImportDefaultSpecifier
      | t.ImportNamespaceSpecifier;
    path: NodePath<t.ImportDeclaration>;
  }[] = [];
  const literalCallExpressionPaths: LiteralCallExpressionPaths = [];
  let hasError = false;

  const tagNames: string[] = [];

  function processTargetCalls(
    path: NodePath<t.TaggedTemplateExpression> | NodePath<t.CallExpression>,
    nodeName: string,
  ) {
    if (
      tagNames.some((name) => {
        return isIdentifier((path.get(nodeName) as any).node, { name });
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
        const defaultSpecifier = path.node.specifiers.find((specifier) => {
          return isImportDefaultSpecifier(specifier);
        });

        if (defaultSpecifier) {
          tagNames.push(defaultSpecifier.local.name);
          pendingDeletion.push({
            defaultSpecifier,
            path,
          });
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

function removeImportDeclaration(
  pendingDeletion: VisitLiteralCallResults['pendingDeletion'],
) {
  for (const { defaultSpecifier, path: pathToRemove } of pendingDeletion) {
    if (pathToRemove.node.specifiers.length === 1) {
      pathToRemove.remove();
    } else {
      pathToRemove.node.specifiers = pathToRemove.node.specifiers.filter(
        (specifier) => {
          return specifier !== defaultSpecifier;
        },
      );
    }
  }
}

export function modifyLiteralCalls(
  programPath: NodePath<t.Program>,
  sourceFullPath: string,
  visitLiteralCallResults: VisitLiteralCallResults,
  codegenContext: CodegenContext[],
) {
  const { literalCallExpressionPaths } = visitLiteralCallResults;

  if (literalCallExpressionPaths.length !== codegenContext.length)
    throw new Error('what');

  for (const [
    i,
    [callExpressionPath],
  ] of literalCallExpressionPaths.entries()) {
    const { gqlHash, tsxFullPath } = codegenContext[i]!;
    const tsxRelPathFromSource =
      './' + slash(relative(dirname(sourceFullPath), tsxFullPath));

    const localVarName = `V${gqlHash}`;

    const importNode = importDeclaration(
      [importNamespaceSpecifier(identifier(localVarName))],
      valueToNode(tsxRelPathFromSource),
    );

    programPath.unshiftContainer('body', importNode);
    callExpressionPath.replaceWithSourceString(localVarName);
  }
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

        const visitLiteralCallResults = visitLiteralCalls(
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
          visitLiteralCallResults,
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
