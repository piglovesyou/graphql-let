import { CodegenContext as CodegenConfig } from '@graphql-codegen/cli';
import { processImport } from '@graphql-tools/import';
import glob from 'globby';
import { join as pathJoin } from 'path';
import { ExecContext } from '../lib/exec-context';
import { readFile, readHash } from '../lib/file';
import {
  buildCodegenConfig,
  processGraphQLCodegen,
} from '../lib/graphql-codegen';
import { createHash } from '../lib/hash';
import { createPaths, isTypeScriptPath } from '../lib/paths';
import {
  CodegenContext,
  FileCodegenContext,
  LiteralCodegenContext,
} from '../lib/types';

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

// GraphQLFileLoader only allows "# import" when passing file paths.
// But we want it even in gql(`query {}`), don't we?
export class CodegenConfigForLiteralDocuments extends CodegenConfig {
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

export function processGraphQLCodegenForFiles(
  execContext: ExecContext,
  codegenContext: FileCodegenContext[],
) {
  return processGraphQLCodegen(
    execContext,
    codegenContext,
    buildCodegenConfig(execContext, codegenContext),
  );
}

export function processGraphQLCodegenForLiterals(
  execContext: ExecContext,
  codegenContext: LiteralCodegenContext[],
  sourceRelPath: string,
) {
  return processGraphQLCodegen(
    execContext,
    codegenContext,
    new CodegenConfigForLiteralDocuments(
      execContext,
      codegenContext,
      sourceRelPath,
    ),
  );
}

export async function appendFileContext(
  execContext: ExecContext,
  schemaHash: string,
  codegenContext: CodegenContext[],
  gqlRelPaths: string[],
  gqlContents?: string[],
): Promise<void> {
  if (!gqlRelPaths.length) return;

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
}
