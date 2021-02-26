import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { Types } from '@graphql-codegen/plugin-helpers';
import { stripIgnoredCharacters } from 'graphql';
import makeDir from 'make-dir';
import { basename, dirname, join as pathJoin } from 'path';
import slash from 'slash';
import loadConfig from './lib/config';
import { processDtsForContext } from './lib/dts';
import createExecContext, { ExecContext } from './lib/exec-context';
import { readFileSync, writeFile } from './lib/file';
import { processGraphQLCodegen } from './lib/graphql-codegen';
import { updateLog } from './lib/print';
import { parserOption } from './lib/type-inject/fns';
import { typesRootRelDir } from './lib/type-inject/literals';
import { CodegenContext, CommandOpts } from './lib/types';
import { visitFromProgramPath } from './lib2/ast';
import { appendFileContext, findTargetDocuments } from './lib2/documents';
import { appendFileSchemaContext } from './lib2/resolver-types';
import { prepareAppendTiContext } from './lib2/type-inject';
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

export async function processCodegenForContext(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
): Promise<Types.FileOutput[]> {
  if (!codegenContext.find(({ skip }) => !skip)) return [];
  const codegenConfig = buildCodegenConfig(execContext, codegenContext);
  return await processGraphQLCodegen(
    execContext,
    codegenContext,
    codegenConfig,
  );
}

function appendLiteralAndLoadContext(
  execContext: ExecContext,
  schemaHash: string,
  codegenContext: CodegenContext[],
  tsSourceRelPaths: string[],
) {
  if (!tsSourceRelPaths.length) return;

  const { cwd } = execContext;

  for (const sourceRelPath of tsSourceRelPaths) {
    const sourceFullPath = pathJoin(cwd, sourceRelPath);
    const sourceContent = readFileSync(sourceFullPath, 'utf-8');
    const sourceAST = parse(sourceContent, parserOption);
    traverse(sourceAST, {
      Program(programPath: NodePath<t.Program>) {
        const visitLiteralCallResults = visitFromProgramPath(programPath);

        // There's no `gql()` in the source. Skip.
        if (!visitLiteralCallResults.callExpressionPathPairs.length) return;

        for (const [
          ,
          value,
          importName,
        ] of visitLiteralCallResults.callExpressionPathPairs) {
          switch (importName) {
            case 'gql':
              {
                const gqlContent = value;
                const strippedGqlContent = stripIgnoredCharacters(gqlContent);
                const {
                  gqlHash,
                  createdPaths,
                  shouldUpdate,
                  resolvedGqlContent,
                } = prepareAppendTiContext(
                  execContext,
                  schemaHash,
                  sourceRelPath,
                  sourceFullPath,
                  gqlContent,
                );
                codegenContext.push({
                  ...createdPaths,
                  type: 'literal',
                  gqlHash,
                  gqlContent,
                  resolvedGqlContent,
                  strippedGqlContent,
                  skip: !shouldUpdate,
                });
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
              const {
                gqlHash,
                createdPaths,
                shouldUpdate,
              } = prepareAppendTiContext(
                execContext,
                schemaHash,
                sourceRelPath,
                sourceFullPath,
                gqlContent,
              );
              codegenContext.push({
                ...createdPaths,
                type: 'load',
                gqlHash,
                gqlPathFragment,
                gqlRelPath,
                gqlFullPath,
                skip: !shouldUpdate,
              });
              break;
            }
          }
        }
      },
    });
  }
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

  appendFileContext(execContext, schemaHash, codegenContext, graphqlRelPaths);

  appendLiteralAndLoadContext(
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
