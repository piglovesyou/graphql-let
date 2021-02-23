import { Types } from '@graphql-codegen/plugin-helpers';
import loadConfig from './lib/config';
import { processDtsForContext } from './lib/dts';
import createExecContext, { ExecContext } from './lib/exec-context';
import { processGraphQLCodegen } from './lib/graphql-codegen';
import { updateLog } from './lib/print';
import { CodegenContext, CommandOpts } from './lib/types';
import {
  findTargetDocuments,
  processDocumentsForContext,
} from './lib2/documents';
import { processResolverTypesIfNeeded } from './lib2/resolver-types';
import ConfiguredOutput = Types.ConfiguredOutput;

export function buildCodegenConfig(
  { cwd, config }: ExecContext,
  codegenContext: CodegenContext[],
) {
  const generates: {
    [outputPath: string]: ConfiguredOutput;
  } = Object.create(null);

  for (const context of codegenContext) {
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

  // TODO: processTsForContext(execContext, )

  await processCodegenForContext(execContext, codegenContext);

  await processDtsForContext(execContext, codegenContext);

  return codegenContext;
}

export default gen2;
