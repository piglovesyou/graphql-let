import { types, ConfigAPI, PluginObj, NodePath } from '@babel/core';
import * as t from '@babel/types';
import { relative, dirname, join as pathJoin } from 'path';
import { declare } from '@babel/helper-plugin-utils';
import doSync from 'do-sync';
// import createDebug from 'debug';
import { readFileSync } from './lib/file';
import { GqlCodegenContext, GqlCompileArgs } from './lib/gql-compile';
import { createHash } from './lib/hash';
import { ConfigTypes, loadConfigSync } from './lib/config';
import { shouldGenResolverTypes } from './lib/resolver-types';

// // TODO: Utilize it
// const debug = createDebug('graphql-let/babel');

const {
  // cloneDeep,
  isIdentifier,
  // isMemberExpression,
  isImportDefaultSpecifier,
  // variableDeclaration,
  // variableDeclarator,
  // memberExpression,
  // callExpression,
  identifier,
  importDeclaration,
  importNamespaceSpecifier,
  valueToNode,
} = types;

const gqlCompileSync = doSync(
  async ({
    hostDirname,
    ...gqlCompileArgs
  }: GqlCompileArgs & { hostDirname: string }) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require('path');
    const modulePath = join(hostDirname, '../dist/lib/gql-compile');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { gqlCompile } = require(modulePath);
    return await gqlCompile(gqlCompileArgs);
  },
);

export type BabelOptions = {
  configFilePath?: string;
  importName?: string;
  onlyMatchImportSuffix?: boolean;
};

const ensureConfig = (() => {
  let config: ConfigTypes | null = null;
  let schemaHash: string | null = null;
  return (cwd: string, configFilePath: string): [ConfigTypes, string] => {
    if (config && schemaHash) {
      return [config, schemaHash];
    }
    const [_config, configHash] = loadConfigSync(cwd, configFilePath);
    // TODO: refactor with create-codegen-opts.ts
    config = {
      ..._config,
      config: {
        withHOC: false, // True by default
        withHooks: true, // False by default
        ..._config.config,
      },
    };

    schemaHash = configHash;
    if (shouldGenResolverTypes(config)) {
      const fileSchema = config.schema as string;
      const schemaFullPath = pathJoin(cwd, fileSchema);
      const content = readFileSync(schemaFullPath);
      schemaHash = createHash(schemaHash + content);
    }
    return [config, schemaHash];
  };
})();

// With all my respect, I cloned the source from
// https://github.com/gajus/babel-plugin-graphql-tag/blob/master/src/index.js
const configFunction = (
  api: ConfigAPI,
  options: BabelOptions,
): PluginObj<any> => {
  api.assertVersion(7);
  const {
    configFilePath = '',
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

        const [graphqlLetConfig, schemaHash] = ensureConfig(
          cwd,
          configFilePath,
        );
        const cacheRelDir = graphqlLetConfig.cacheDir;

        const tagNames: string[] = [];
        const pendingDeletion: {
          defaultSpecifier:
            | t.ImportSpecifier
            | t.ImportDefaultSpecifier
            | t.ImportNamespaceSpecifier;
          path: NodePath<t.ImportDeclaration>;
        }[] = [];
        const gqlCallExpressionPaths: [
          NodePath<t.CallExpression>,
          string,
        ][] = [];
        let hasError = false;

        programPath.traverse({
          ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
            const pathValue = path.node.source.value;
            if (
              onlyMatchImportSuffix
                ? pathValue.endsWith(importName)
                : pathValue === importName
            ) {
              const defaultSpecifier = path.node.specifiers.find(
                (specifier) => {
                  return isImportDefaultSpecifier(specifier);
                },
              );

              if (defaultSpecifier) {
                tagNames.push(defaultSpecifier.local.name);
                pendingDeletion.push({
                  defaultSpecifier,
                  path,
                });
              }
            }
          },
          // TODO: Allow TemplateLiteralCall with warning:
          // "transpile is ok, but it can't finish type injection"
          CallExpression(path: NodePath<t.CallExpression>) {
            if (
              tagNames.some((name) => {
                return isIdentifier(path.node.callee, { name });
              })
            ) {
              try {
                const args = path.get('arguments');
                if (args.length !== 1)
                  throw new Error(
                    `The argument must be a single string value.`,
                  );
                let value = '';
                path.traverse({
                  TemplateLiteral(path: NodePath<t.TemplateLiteral>) {
                    if (path.node.quasis.length !== 1)
                      throw new Error(
                        `TemplateLiteral of the argument must not contain arguments.`,
                      );
                    value = path.node.quasis[0].value.raw;
                  },
                  StringLiteral(path: NodePath<t.StringLiteral>) {
                    value = path.node.value;
                  },
                });
                if (!value) throw new Error('never');
                gqlCallExpressionPaths.push([path, value]);
              } catch (error) {
                // eslint-disable-next-line no-console
                console.error('error', error);
                hasError = true;
              }
            }
          },
        });

        // TODO: Handle error

        if (!gqlCallExpressionPaths.length) return;

        const rv: GqlCodegenContext = gqlCompileSync({
          hostDirname: __dirname,
          cwd,
          sourceRelPath,
          gqlContents: gqlCallExpressionPaths.map(([, value]) => value),
          cacheRelDir, // TODO: Include in config
          schemaHash,
          config: graphqlLetConfig,
        });
        if (gqlCallExpressionPaths.length !== rv.length)
          throw new Error('what');

        for (const [
          i,
          [callExpressionPath],
        ] of gqlCallExpressionPaths.entries()) {
          const { gqlContentHash, tsxFullPath } = rv[i]!;
          const tsxRelPathFromSource =
            './' + relative(dirname(sourceFullPath), tsxFullPath);

          const localVarName = `V${gqlContentHash}`;

          const importNode = importDeclaration(
            [importNamespaceSpecifier(identifier(localVarName))],
            valueToNode(tsxRelPathFromSource),
          );

          programPath.unshiftContainer('body', importNode);
          callExpressionPath.replaceWithSourceString(localVarName);
        }

        // Only delete import statement or specifier when there is no error
        if (!hasError) {
          for (const {
            defaultSpecifier,
            path: pathForDeletion,
          } of pendingDeletion) {
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
      },
    },
  };
};

export default declare(configFunction);
