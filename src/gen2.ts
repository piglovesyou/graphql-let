import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Types } from '@graphql-codegen/plugin-helpers';
import { processImport } from '@graphql-tools/import';
import {
  DocumentNode,
  OperationDefinitionNode,
  stripIgnoredCharacters,
} from 'graphql';
import makeDir from 'make-dir';
import pMap from 'p-map';
import { basename, dirname, join as pathJoin } from 'path';
import slash from 'slash';
import { visitFromProgramPath } from './ast/ast';
import loadConfig from './lib/config';
import { processDtsForContext } from './lib/dts';
import createExecContext, { ExecContext } from './lib/exec-context';
import { readFile, readHash, writeFile } from './lib/file';
import { processGraphQLCodegen } from './lib/graphql-codegen';
import { createHash } from './lib/hash';
import { updateLog } from './lib/print';
import { parserOption } from './lib/type-inject/fns';
import { typesRootRelDir } from './lib/type-inject/literals';
import { CodegenContext, CommandOpts } from './lib/types';
import {
  findTargetDocuments,
  processDocumentsForContext,
} from './lib2/documents';
import { createTiPaths } from './lib2/fns';
import { processResolverTypesIfNeeded } from './lib2/resolver-types';
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
          documents: context.gqlContent,
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
): Promise<Types.FileOutput[]> {
  const codegenConfig = buildCodegenConfig(execContext, codegenContext);
  return await processGraphQLCodegen(
    execContext,
    codegenContext,
    codegenConfig,
  );
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

async function processTsForContext(
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
                gqlContent,
              ] of visitLiteralCallResults.callExpressionPathPairs) {
                const documentNode = resolveGraphQLDocument(
                  cwd,
                  sourceFullPath,
                  gqlContent,
                );

                const documentName = documentNode.definitions
                  .map((d) => (d as OperationDefinitionNode).name!.value)
                  .join('-');
                const gqlHash = createHash(schemaHash + gqlContent);
                const createdPaths = createTiPaths(
                  execContext,
                  sourceRelPath,
                  documentName,
                );
                const { tsxFullPath, dtsFullPath } = createdPaths;
                const strippedGqlContent = stripIgnoredCharacters(gqlContent);

                (async () => {
                  const shouldUpdate =
                    gqlHash !== (await readHash(tsxFullPath)) ||
                    gqlHash !== (await readHash(dtsFullPath));
                  codegenContext.push({
                    ...createdPaths,
                    type: 'literal',
                    gqlHash,
                    gqlContent,
                    strippedGqlContent,
                    skip: !shouldUpdate,
                  });
                })().then(resolve);
              }
            },
          });
        });
      });
    },
    { concurrency: 2 },
  );
}

async function processTiIndexForContext(
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
      case 'literal':
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
      // TODO: case 'load':
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

export async function gen2({
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

  const { schemaHash } = await processResolverTypesIfNeeded(
    execContext,
    codegenContext,
  );

  await processDocumentsForContext(
    execContext,
    schemaHash,
    codegenContext,
    graphqlRelPaths,
  );

  await processTsForContext(
    execContext,
    schemaHash,
    codegenContext,
    tsSourceRelPaths,
  );

  await processCodegenForContext(execContext, codegenContext);

  await processTiIndexForContext(execContext, codegenContext);

  await processDtsForContext(execContext, codegenContext);

  // TODO: removeObsoleteFiles(execContext, codegenContext);

  return codegenContext;
}

export default gen2;
