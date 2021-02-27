import { Types } from '@graphql-codegen/plugin-helpers';
import { ExecContext } from './exec-context';
import { processGraphQLCodegen } from './graphql-codegen';
import { CodegenContext } from './types';
import ConfiguredOutput = Types.ConfiguredOutput;

export function buildCodegenConfig(
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
      case 'schema-import':
        opts = {
          plugins: ['typescript', 'typescript-resolvers'],
        };
        break;

      case 'document-import':
      case 'load-call':
        opts = {
          plugins: config.plugins,
          documents: context.gqlRelPath,
        };
        break;

      case 'gql-call':
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
