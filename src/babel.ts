import { types, ConfigAPI, PluginObj, NodePath } from '@babel/core';
import * as t from '@babel/types';
import { relative, dirname, join as pathJoin } from 'path';
import { declare } from '@babel/helper-plugin-utils';
import doSync from 'do-sync';
import slash from 'slash';
import createExecContext, { ExecContext } from './lib/exec-context';
import { readFileSync } from './lib/file';
import { createHash } from './lib/hash';
import { loadConfigSync } from './lib/config';
import { LiteralsArgs } from './lib/literals';
import { printError } from './lib/print';
import { shouldGenResolverTypes } from './lib/resolver-types';
import { CodegenContext, LiteralCodegenContext } from './lib/types';

const {
  isIdentifier,
  isImportDefaultSpecifier,
  identifier,
  importDeclaration,
  importNamespaceSpecifier,
  valueToNode,
} = types;

const literalsInSubProcessSync = doSync(
  ({
    hostDirname,
    ...gqlCompileArgs
  }: LiteralsArgs & {
    hostDirname: string;
  }): /* Promise<LiteralCodegenContext[]> */ any => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require('path');
    const modulePath = join(hostDirname, '../dist/lib/literals');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { literalsInSubProcess } = require(modulePath);
    return literalsInSubProcess(gqlCompileArgs);
  },
);

export type BabelOptions = {
  configFilePath?: string;
  importName?: string;
  onlyMatchImportSuffix?: boolean;
};

export const { ensureExecContext, clearExecContext } = (() => {
  let execContext: ExecContext | null = null;
  let schemaHash: string | null = null;

  function ensureExecContext(
    cwd: string,
    configFilePath?: string,
  ): [ExecContext, string] {
    if (execContext && schemaHash) {
      return [execContext, schemaHash];
    }
    const [config, configHash] = loadConfigSync(cwd, configFilePath);
    execContext = createExecContext(cwd, config, configHash);

    schemaHash = configHash;
    if (shouldGenResolverTypes(config)) {
      const fileSchema = config.schema as string;
      const schemaFullPath = pathJoin(cwd, fileSchema);
      const content = readFileSync(schemaFullPath);
      schemaHash = createHash(schemaHash + content);
    }
    return [execContext, schemaHash];
  }

  function clearExecContext() {
    execContext = null;
    schemaHash = null;
  }

  return { ensureExecContext, clearExecContext };
})();

type VisitGqlCallResults = {
  pendingDeletion: {
    defaultSpecifier:
      | t.ImportSpecifier
      | t.ImportDefaultSpecifier
      | t.ImportNamespaceSpecifier;
    path: NodePath<t.ImportDeclaration>;
  }[];
  gqlCallExpressionPaths: [
    NodePath<t.CallExpression> | NodePath<t.TaggedTemplateExpression>,
    string,
  ][];
  hasError: boolean;
};

export function visitGqlCalls(
  programPath: NodePath<t.Program>,
  importName: string,
  onlyMatchImportSuffix: boolean,
): VisitGqlCallResults {
  const pendingDeletion: {
    defaultSpecifier:
      | t.ImportSpecifier
      | t.ImportDefaultSpecifier
      | t.ImportNamespaceSpecifier;
    path: NodePath<t.ImportDeclaration>;
  }[] = [];
  const gqlCallExpressionPaths: [
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
        gqlCallExpressionPaths.push([path, value]);
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
  return { pendingDeletion, gqlCallExpressionPaths, hasError };
}

export function modifyGqlCalls(
  programPath: NodePath<t.Program>,
  sourceFullPath: string,
  visitGqlCallResults: VisitGqlCallResults,
  codegenContext: CodegenContext[],
) {
  const {
    gqlCallExpressionPaths,
    pendingDeletion,
    hasError,
  } = visitGqlCallResults;

  if (gqlCallExpressionPaths.length !== codegenContext.length)
    throw new Error('what');

  for (const [i, [callExpressionPath]] of gqlCallExpressionPaths.entries()) {
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
        // TODO what's going on
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
        const [execContext, schemaHash] = ensureExecContext(
          cwd,
          configFilePath,
        );

        const visitGqlCallResults = visitGqlCalls(
          programPath,
          importName,
          onlyMatchImportSuffix,
        );
        const { gqlCallExpressionPaths } = visitGqlCallResults;

        // TODO: Handle error

        if (!gqlCallExpressionPaths.length) return;

        const literalCodegenContext: LiteralCodegenContext[] = literalsInSubProcessSync(
          {
            hostDirname: __dirname,
            execContext,
            schemaHash,
            sourceRelPath,
            gqlContents: gqlCallExpressionPaths.map(([, value]) => value),
          },
        ) as any; // Suppress JSONValue error. LiteralCodegenContext has a function property, but it can be ignored.

        modifyGqlCalls(
          programPath,
          sourceFullPath,
          visitGqlCallResults,
          literalCodegenContext,
        );
      },
    },
  };
};

export default declare(configFunction);
