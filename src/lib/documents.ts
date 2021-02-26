import { CodegenContext as CodegenConfig } from '@graphql-codegen/cli';
import { Types } from '@graphql-codegen/plugin-helpers';
import { processImport } from '@graphql-tools/import';
import glob from 'globby';
import { join as pathJoin } from 'path';
import { ExecContext } from './exec-context';
import { readFile, readHash } from './file';
import { buildCodegenConfig, processGraphQLCodegen } from './graphql-codegen';
import { createHash } from './hash';
import { createPaths, isTypeScriptPath } from './paths';
import {
  CodegenContext,
  FileCodegenContext,
  LiteralCodegenContext,
} from './types';

export async function findTargetDocumentsDeprecated({
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

// GraphQLFileLoader only allows "# import" when passing file paths.
// But we want it even in gql(`query {}`), don't we?
export class CodegenConfigForLiteralDocumentsDeprecated extends CodegenConfig {
  sourceRelPath: string;
  constructor(
    execContext: ExecContext,
    codegenContext: CodegenContext[],
    sourceRelPath: string,
  ) {
    super({
      config: buildCodegenConfig(execContext, codegenContext),
    });
    const { cwd } = execContext;
    this.cwd = cwd;
    this.sourceRelPath = sourceRelPath;
  }

  async loadDocuments(pointers: any) {
    const sourceFullPath = pathJoin(this.cwd, this.sourceRelPath);
    return pointers.map((pointer: string) => {
      // This allows to start from content of GraphQL document, not file path
      const predefinedImports = { [sourceFullPath]: pointer };
      const document = processImport(
        sourceFullPath,
        this.cwd,
        predefinedImports,
      );
      return { document };
    });
  }
}

export function processGraphQLCodegenForFilesDeprecated(
  execContext: ExecContext,
  codegenContext: FileCodegenContext[],
) {
  return processGraphQLCodegen(
    execContext,
    codegenContext,
    buildCodegenConfig(execContext, codegenContext),
  );
}

export function processGraphQLCodegenForLiteralsDeprecated(
  execContext: ExecContext,
  codegenContext: LiteralCodegenContext[],
  sourceRelPath: string,
) {
  return processGraphQLCodegen(
    execContext,
    codegenContext,
    new CodegenConfigForLiteralDocumentsDeprecated(
      execContext,
      codegenContext,
      sourceRelPath,
    ),
  );
}

export async function processDocumentsForContextDeprecated(
  execContext: ExecContext,
  schemaHash: string,
  codegenContext: CodegenContext[],
  gqlRelPaths: string[],
  gqlContents?: string[],
): Promise<Types.FileOutput[]> {
  if (!gqlRelPaths.length) return [];

  const { cwd } = execContext;
  const documentCodegenContext: FileCodegenContext[] = [];

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
      gqlHash !== readHash(tsxFullPath) || gqlHash !== readHash(dtsFullPath);

    const context: FileCodegenContext = {
      ...createdPaths,
      type: 'file',
      gqlHash,
      skip: !shouldUpdate,
    };
    codegenContext.push(context);
    documentCodegenContext.push(context);
  }

  if (documentCodegenContext.every(({ skip }) => skip)) return [];

  return await processGraphQLCodegenForFilesDeprecated(
    execContext,
    documentCodegenContext,
  );
}
