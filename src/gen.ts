import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Types } from '@graphql-codegen/plugin-helpers';
import { processImport } from '@graphql-tools/import';
import {
  DocumentNode,
  OperationDefinitionNode,
  print,
  stripIgnoredCharacters,
} from 'graphql';
import makeDir from 'make-dir';
import pMap from 'p-map';
import { basename, dirname, join as pathJoin } from 'path';
import slash from 'slash';
import loadConfig from './lib/config';
import { processDtsForContext } from './lib/dts';
import createExecContext, { ExecContext } from './lib/exec-context';
import { readFile, readFileSync, readHash, writeFile } from './lib/file';
import { processGraphQLCodegen } from './lib/graphql-codegen';
import { createHash } from './lib/hash';
import { updateLog } from './lib/print';
import { parserOption } from './lib/type-inject/fns';
import { typesRootRelDir } from './lib/type-inject/literals';
import { CodegenContext, CommandOpts } from './lib/types';
import { visitFromProgramPath } from './lib2/ast';
import { appendFileContext, findTargetDocuments } from './lib2/documents';
import { createTiPaths } from './lib2/fns';
import { appendFileSchemaContext } from './lib2/resolver-types';
import ConfiguredOutput = Types.ConfiguredOutput;

function buildCodegenConfig(
  { cwd, config }: ExecContext,
  codegenContext: CodegenContext[],
) {
  const generates: {
    [outputPath: string]: ConfiguredOutput;
  } = Object.create(null);

  for (const context of codegenContext) {
    if (context.skip) continue;
    const { tsxFullPath } = context;
    let opts: ConfiguredOutput;
    switch (context.type) {
      case 'file-schema':
        opts = {
          plugins: ['typescript', 'typescript-resolvers'],
        };
        break;

      case 'file':
      case 'load':
        opts = {
          plugins: config.plugins,
          documents: context.gqlRelPath,
        };
        break;

      case 'literal':
        // XXX: We want to pass shorter `strippedGqlContent`,
        // but `# import` also disappears!
        opts = {
          plugins: config.plugins,
          documents: context.resolvedGqlContent,
        };
        break;
    }
    generates[tsxFullPath] = {
      ...config.generateOptions,
      ...opts,
    };
  }

  return {
    silent: true,
    ...config,
    // @ts-ignore
    cwd,

    // @ts-ignore This allows recognizing "#import" in GraphQL documents
    skipGraphQLImport: false,

    // In our config, "documents" should always be empty
    // since "generates" should take care of them.
    documents: undefined,
    generates,
  };
}

async function processCodegenForContext(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
): Promise<void> {
  if (!codegenContext.find(({ skip }) => !skip)) return;
  const codegenConfig = buildCodegenConfig(execContext, codegenContext);
  await processGraphQLCodegen(execContext, codegenContext, codegenConfig);
}

function resolveGraphQLDocument(
  cwd: string,
  sourceFullPath: string,
  gqlContent: string,
): DocumentNode {
  // This allows to start from content of GraphQL document, not file path
  const predefinedImports = { [sourceFullPath]: gqlContent };
  return processImport(sourceFullPath, cwd, predefinedImports);
}

async function prepareAppendTiContext(
  execContext: ExecContext,
  schemaHash: string,
  sourceRelPath: string,
  sourceFullPath: string,
  gqlContent: string,
) {
  const { cwd } = execContext;
  const documentNode = resolveGraphQLDocument(cwd, sourceFullPath, gqlContent);
  const resolvedGqlContent = print(documentNode);
  const documentName = documentNode.definitions
    .map((d) => (d as OperationDefinitionNode).name!.value)
    .join('-');
  const gqlHash = createHash(schemaHash + resolvedGqlContent);
  const createdPaths = createTiPaths(execContext, sourceRelPath, documentName);
  const { tsxFullPath, dtsFullPath } = createdPaths;
  const shouldUpdate =
    gqlHash !== (await readHash(tsxFullPath)) ||
    gqlHash !== (await readHash(dtsFullPath));
  return { gqlHash, createdPaths, shouldUpdate, resolvedGqlContent };
}

async function appendLiteralAndLoadContext(
  execContext: ExecContext,
  schemaHash: string,
  codegenContext: CodegenContext[],
  tsSourceRelPaths: string[],
) {
  if (!tsSourceRelPaths.length) return;

  const { cwd } = execContext;

  await pMap(
    tsSourceRelPaths,
    (sourceRelPath) => {
      return new Promise<void>((resolve) => {
        const sourceFullPath = pathJoin(cwd, sourceRelPath);
        readFile(sourceFullPath, 'utf-8').then((sourceContent) => {
          const sourceAST = parse(sourceContent, parserOption);
          traverse(sourceAST, {
            Program(programPath: NodePath<t.Program>) {
              const visitLiteralCallResults = visitFromProgramPath(programPath);
              // TODO: Handle error
              if (!visitLiteralCallResults.callExpressionPathPairs.length) {
                // There's no `gql()` in the source. Skip.
                resolve();
                return;
              }

              for (const [
                ,
                value,
                importName,
              ] of visitLiteralCallResults.callExpressionPathPairs) {
                switch (importName) {
                  case 'gql':
                    {
                      const gqlContent = value;
                      const strippedGqlContent = stripIgnoredCharacters(
                        gqlContent,
                      );
                      prepareAppendTiContext(
                        execContext,
                        schemaHash,
                        sourceRelPath,
                        sourceFullPath,
                        gqlContent,
                      )
                        .then(
                          ({
                            gqlHash,
                            createdPaths,
                            shouldUpdate,
                            resolvedGqlContent,
                          }) => {
                            codegenContext.push({
                              ...createdPaths,
                              type: 'literal',
                              gqlHash,
                              gqlContent,
                              resolvedGqlContent,
                              strippedGqlContent,
                              skip: !shouldUpdate,
                            });
                          },
                        )
                        .then(resolve);
                    }
                    break;

                  case 'load': {
                    const gqlPathFragment = value;
                    const gqlRelPath = pathJoin(
                      dirname(sourceRelPath),
                      gqlPathFragment,
                    );
                    const gqlFullPath = pathJoin(cwd, gqlRelPath);
                    const gqlContent = readFileSync(gqlFullPath, 'utf-8');
                    prepareAppendTiContext(
                      execContext,
                      schemaHash,
                      sourceRelPath,
                      sourceFullPath,
                      gqlContent,
                    )
                      .then(({ gqlHash, createdPaths, shouldUpdate }) => {
                        codegenContext.push({
                          ...createdPaths,
                          type: 'load',
                          gqlHash,
                          gqlPathFragment,
                          gqlRelPath,
                          gqlFullPath,
                          skip: !shouldUpdate,
                        });
                      })
                      .then(resolve);
                    break;
                  }
                }
              }
            },
          });
        });
      });
    },
    { concurrency: 2 },
  );
}

async function writeTiIndexForContext(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  const { cwd, config } = execContext;
  const gqlDtsEntrypointFullPath = pathJoin(cwd, config.gqlDtsEntrypoint);
  const gqlDtsEntrypointFullDir = pathJoin(
    cwd,
    dirname(config.gqlDtsEntrypoint),
  );
  const gqlDtsMacroFullPath = pathJoin(gqlDtsEntrypointFullDir, 'macro.d.ts');
  await makeDir(gqlDtsEntrypointFullDir);

  let hasLiteral = false;
  let hasLoad = false;
  let dtsEntrypointContent = '';
  for (const c of codegenContext) {
    switch (c.type) {
      case 'file':
      case 'file-schema':
        continue;
      case 'literal': {
        // For TS2691
        const dtsRelPathWithoutExtension = slash(
          pathJoin(
            typesRootRelDir,
            dirname(c.dtsRelPath),
            basename(c.dtsRelPath, '.d.ts'),
          ),
        );
        dtsEntrypointContent += `import T${c.gqlHash} from './${dtsRelPathWithoutExtension}';
export function gql(gql: \`${c.gqlContent}\`): T${c.gqlHash}.__GraphQLLetTypeInjection;
`;
        hasLiteral = true;
        break;
      }

      case 'load': {
        // For TS2691
        const dtsRelPathWithoutExtension = slash(
          pathJoin(
            typesRootRelDir,
            dirname(c.dtsRelPath),
            basename(c.dtsRelPath, '.d.ts'),
          ),
        );
        dtsEntrypointContent += `import T${c.gqlHash} from './${dtsRelPathWithoutExtension}';
export function load(load: \`${c.gqlPathFragment}\`): T${c.gqlHash}.__GraphQLLetTypeInjection;
`;
        hasLoad = true;
        break;
      }
    }
  }
  await writeFile(gqlDtsEntrypointFullPath, dtsEntrypointContent);
  if (hasLoad || hasLoad) {
    await writeFile(
      gqlDtsMacroFullPath,
      (hasLiteral ? `export { gql } from ".";\n` : '') +
        (hasLoad ? `export { load } from ".";\n` : ''),
    );
  }
}

export async function gen({
  cwd,
  configFilePath,
}: CommandOpts): Promise<CodegenContext[]> {
  updateLog('Running graphql-codegen...');

  const [config, configHash] = await loadConfig(cwd, configFilePath);
  const execContext = createExecContext(cwd, config, configHash);
  const codegenContext: CodegenContext[] = [];

  const { graphqlRelPaths, tsSourceRelPaths } = await findTargetDocuments(
    execContext,
  );

  const { schemaHash } = await appendFileSchemaContext(
    execContext,
    codegenContext,
  );

  await appendFileContext(
    execContext,
    schemaHash,
    codegenContext,
    graphqlRelPaths,
  );

  await appendLiteralAndLoadContext(
    execContext,
    schemaHash,
    codegenContext,
    tsSourceRelPaths,
  );

  await processCodegenForContext(execContext, codegenContext);

  await processDtsForContext(execContext, codegenContext);

  await writeTiIndexForContext(execContext, codegenContext);

  // TODO: removeObsoleteFiles(execContext, codegenContext);

  return codegenContext;
}

export default gen;
