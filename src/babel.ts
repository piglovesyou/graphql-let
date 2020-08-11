import { types, ConfigAPI, PluginObj, NodePath } from '@babel/core';
import * as t from '@babel/types';
import { relative, dirname } from 'path';
import { declare } from '@babel/helper-plugin-utils';
import doSync from 'do-sync';
import slash from 'slash';
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

const processLiteralsInSubProcessSync = doSync(
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
    const { processLiteralsInSubProcess } = require(modulePath);
    return processLiteralsInSubProcess(gqlCompileArgs);
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
  literalCallExpressionPaths: [
    NodePath<t.CallExpression> | NodePath<t.TaggedTemplateExpression>,
    string,
  ][];
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
  const literalCallExpressionPaths: [
    NodePath<t.CallExpression> | NodePath<t.TaggedTemplateExpression>,
    string,
  ][] = [];
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

export function modifyLiteralCalls(
  programPath: NodePath<t.Program>,
  sourceFullPath: string,
  visitLiteralCallResults: VisitLiteralCallResults,
  codegenContext: CodegenContext[],
) {
  const {
    literalCallExpressionPaths,
    pendingDeletion,
    hasError,
  } = visitLiteralCallResults;

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

  // Only delete import statement or specifier when there is no error
  if (!hasError) {
    for (const { defaultSpecifier, path: pathForDeletion } of pendingDeletion) {
      if (pathForDeletion.node.specifiers.length === 1) {
        pathForDeletion.remove();
      } else {
        pathForDeletion.node.specifiers = pathForDeletion.node.specifiers.filter(
          (specifier) => {
            return specifier !== defaultSpecifier;
          },
        );
      }
    }
  }
}

// With all my respect, I cloned the source from
// https://github.com/gajus/babel-plugin-graphql-tag/blob/master/src/index.js
const configFunction = (
  api: ConfigAPI,
  options: BabelOptions,
): PluginObj<any> => {
  api.assertVersion(7);
  const {
    configFilePath,
    importName = 'graphql-let',
    onlyMatchImportSuffix = false,
    // strip = false,
  } = options;

  return {
    visitor: {
      Program(programPath: NodePath<t.Program>, state: any) {
        const { cwd } = state;
        const sourceFullPath = state.file.opts.filename;
        const sourceRelPath = relative(cwd, sourceFullPath);

        const visitLiteralCallResults = visitLiteralCalls(
          programPath,
          importName,
          onlyMatchImportSuffix,
        );
        const { literalCallExpressionPaths } = visitLiteralCallResults;

        // TODO: Handle error

        if (!literalCallExpressionPaths.length) return;

        const literalCodegenContext: LiteralCodegenContext[] = processLiteralsInSubProcessSync(
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
      },
    },
  };
};

export default declare(configFunction);
