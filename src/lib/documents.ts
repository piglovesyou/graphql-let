import { CodegenContext as CodegenConfig } from '@graphql-codegen/cli';
import { Types } from '@graphql-codegen/plugin-helpers';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import glob from 'globby';
import { join as pathJoin } from 'path';
import { ConfigTypes } from './config';
import { ExecContext } from './exec-context';
import { readFile, readHash } from './file';
import { processGraphQLCodegen } from './graphql-codegen';
import { createHash } from './hash';
import { createPaths, isTypeScriptPath } from './paths';
import {
  CodegenContext,
  FileCodegenContext,
  isLiteralContext,
  LiteralCodegenContext,
} from './types';
import ConfiguredOutput = Types.ConfiguredOutput;

export async function findTargetDocuments({
  cwd,
  config,
}: ExecContext): Promise<{
  graphqlRelPaths: string[];
  tsSourceRelPaths: string[];
}> {
  const documentPaths = await glob(config.documents, {
    cwd,
    gitignore: config.respectGitIgnore,
  });
  if (documentPaths.length === 0) {
    throw new Error(
      `No GraphQL documents are found from the path ${JSON.stringify(
        config.documents,
      )}. Check "documents" in .graphql-let.yml.`,
    );
  }
  const graphqlRelPaths: string[] = [];
  const tsSourceRelPaths: string[] = [];
  for (const p of documentPaths) {
    isTypeScriptPath(p) ? tsSourceRelPaths.push(p) : graphqlRelPaths.push(p);
  }
  return { graphqlRelPaths, tsSourceRelPaths };
}

type ProcessDocumentsForContextReturnType = Record<
  /*gqlRelPath*/ string,
  /*tsxContent*/ string
>;

class GraphQLLetConfig extends CodegenConfig {
  constructor(execContext: ExecContext, codegenContext: CodegenContext[]) {
    const { cwd, config, codegenOpts } = execContext;

    // In our config, "documents" should always be empty
    // since "generates" should take care of them.
    const generates = GraphQLLetConfig.buildGenerates(
      execContext,
      codegenContext,
      config,
    );
    super({
      config: {
        ...config,
        // @ts-ignore
        cwd,
        config: {
          // TODO: Quit using codegenOpts
          ...codegenOpts.config,
          ...config.config,
        },
        // schema: path.join(cwd, config.schema as any),
        documents: undefined,
        generates,
      },
    });
    this.cwd = cwd;
  }

  static buildGenerates(
    execContext: ExecContext,
    codegenContext: CodegenContext[],
    config: Omit<Types.Config, 'generates'> & ConfigTypes,
  ) {
    const generates: {
      [outputPath: string]: ConfiguredOutput;
    } = Object.create(null);
    for (const context of codegenContext) {
      const { tsxFullPath } = context;
      const documents = isLiteralContext(context)
        ? (context as LiteralCodegenContext).strippedGqlContent
        : (context as FileCodegenContext).gqlRelPath;
      generates[tsxFullPath] = {
        ...config.generateOptions,
        // graphql-let -controlled fields:
        documents,
        plugins: config.plugins,
      };
    }
    return generates;
  }

  // from graphql-file-loader
  static isGraphQLImportFile(rawSDL: string) {
    const trimmedRawSDL = rawSDL.trim();
    return (
      trimmedRawSDL.startsWith('# import') ||
      trimmedRawSDL.startsWith('#import')
    );
  }

  async loadDocuments(pointers: any) {
    const [pointer] = pointers;
    if (GraphQLLetConfig.isGraphQLImportFile(pointer)) {
      // GraphQLFileLoader only allows "# import" when passing file paths.
      // But we want it even in gql(`query {}`), don't we?
      const resolved = GraphQLFileLoader.prototype.handleFileContent(
        pointer,
        './a.graphql',
        { cwd: this.cwd },
      );
      return [resolved];
    }
    return super.loadDocuments(pointers); // , this.getConfig());
  }
}

export function processGraphQLCodegenForDocuments(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  return processGraphQLCodegen(
    execContext,
    codegenContext,
    new GraphQLLetConfig(execContext, codegenContext),
  );
}

export async function processDocumentsForContext(
  execContext: ExecContext,
  schemaHash: string,
  codegenContext: CodegenContext[],
  gqlRelPaths: string[],
  gqlContents?: string[],
) {
  const tsxContents: ProcessDocumentsForContextReturnType = Object.create(null);
  if (!gqlRelPaths.length) return tsxContents;

  const documentCodegenContext: CodegenContext[] = [];

  const { cwd } = execContext;
  for (const [i, gqlRelPath] of gqlRelPaths.entries()) {
    // Loader passes gqlContent directly
    const gqlContent = gqlContents
      ? gqlContents[i]
      : await readFile(pathJoin(cwd, gqlRelPath), 'utf-8');
    if (!gqlContent) throw new Error('never');

    const createdPaths = createPaths(execContext, gqlRelPath);
    const { tsxFullPath, dtsFullPath } = createdPaths;

    // Here I add "schemaHash" as a hash seed. Types of GraphQL documents
    // basically depends on schema, which change should effect to document results.
    const gqlHash = createHash(schemaHash + gqlContent);

    const shouldUpdate =
      gqlHash !== (await readHash(tsxFullPath)) ||
      gqlHash !== (await readHash(dtsFullPath));

    const context: FileCodegenContext = {
      ...createdPaths,
      gqlHash,
      dtsContentDecorator: (s) => s,
      skip: !shouldUpdate,
    };
    codegenContext.push(context);
    documentCodegenContext.push(context);
  }
  const results = await processGraphQLCodegenForDocuments(
    execContext,
    documentCodegenContext,
  );
  for (const [i, { content }] of results.entries()) {
    const { gqlRelPath } = codegenContext[i]! as FileCodegenContext;
    tsxContents[gqlRelPath] = content;
  }
  return tsxContents;
}
