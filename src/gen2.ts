import { Types } from '@graphql-codegen/plugin-helpers';
import loadConfig from './lib/config';
import { processDtsForContext } from './lib/dts';
import createExecContext, { ExecContext } from './lib/exec-context';
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

    let documents: string;
    switch (context.type) {
      case 'literal':
        // XXX: We want to pass shorter `strippedGqlContent`,
        // but `# import` also disappears!
        documents = context.gqlContent;
        break;
      default:
        documents = context.gqlRelPath;
    }
    generates[tsxFullPath] = {
      ...config.generateOptions,
      // graphql-let -controlled fields:
      documents,
      plugins: config.plugins,
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
): Promise<void> {}

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

  // TODO: processTsForContext()

  // TODO: processCodegenForContext()

  await processDtsForContext(execContext, codegenContext);

  return codegenContext;
}

export default gen2;
