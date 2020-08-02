import glob from 'globby';
import logUpdate from 'log-update';
import makeDir from 'make-dir';
import { join as pathJoin, dirname } from 'path';
import { genDts } from './dts';
import { ExecContext } from './exec-context';
import { createHash } from './hash';
import { CreatedPaths, createPaths } from './paths';
import { PRINT_PREFIX } from './print';
import {
  processGenerateResolverTypes,
  shouldGenResolverTypes,
} from './resolver-types';
import { processGraphQLCodegen } from './graphql-codegen';
import { readFile, writeFile, withHash, readHash } from './file';

export type CodegenContext = CreatedPaths & {
  gqlHash: string;
  dtsContentDecorator: (content: string) => string;
};

export type SkippedContext = {
  tsxFullPath: string;
  dtsFullPath: string;
};

export async function processResolverTypesIfNeeded(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
  skippedContext: SkippedContext[],
) {
  const { cwd, config, configHash, codegenOpts } = execContext;
  // To pass config change on subsequent generation,
  // configHash should be primary hash seed.
  let schemaHash = configHash;

  if (shouldGenResolverTypes(config)) {
    const fileSchema = config.schema as string;
    const schemaFullPath = pathJoin(cwd, fileSchema);
    const content = await readFile(schemaFullPath);
    schemaHash = createHash(schemaHash + content);
    const createdPaths = createPaths(execContext, fileSchema);

    const shouldUpdate =
      schemaHash !== (await readHash(createdPaths.tsxFullPath)) ||
      schemaHash !== (await readHash(createdPaths.dtsFullPath));
    if (shouldUpdate) {
      // We don't delete tsxFullPath and dtsFullPath here because:
      // 1. We'll overwrite them so deleting is not necessary
      // 2. Windows throws EPERM error for the deleting and creating file process.

      logUpdate(
        PRINT_PREFIX +
          `Local schema files are detected. Generating resolver types...`,
      );

      await processGenerateResolverTypes(
        schemaHash,
        config,
        codegenOpts,
        createdPaths,
        cwd,
      );

      codegenContext.push({
        ...createdPaths,
        gqlHash: schemaHash,
        dtsContentDecorator: (s) => {
          return `${s}
          
// This is an extra code in addition to what graphql-codegen makes.
// Users are likely to use 'graphql-tag/loader' with 'graphql-tag/schema/loader'
// in webpack. This code enables the result to be typed.
import { DocumentNode } from 'graphql'
export default typeof DocumentNode
`;
        },
      });
    } else {
      skippedContext.push({
        tsxFullPath: createdPaths.tsxFullPath,
        dtsFullPath: createdPaths.dtsFullPath,
      });
    }
  }
  return { schemaHash };
}

export async function processDocuments(
  execContext: ExecContext,
  gqlRelPaths: string[],
  schemaHash: string,
  codegenContext: CodegenContext[],
  skippedContext: SkippedContext[],
) {
  const { cwd, config, codegenOpts } = execContext;
  for (const gqlRelPath of gqlRelPaths) {
    const gqlContent = await readFile(pathJoin(cwd, gqlRelPath), 'utf-8');

    const createdPaths = createPaths(execContext, gqlRelPath);
    const { tsxFullPath, dtsFullPath } = createdPaths;

    // Here I add "schemaHash" as a hash seed. Types of GraphQL documents
    // basically depends on schema, which change should effect to document results.
    const gqlHash = createHash(schemaHash + gqlContent);

    const shouldUpdate =
      gqlHash !== (await readHash(tsxFullPath)) ||
      gqlHash !== (await readHash(dtsFullPath));
    if (shouldUpdate) {
      // We don't delete tsxFullPath and dtsFullPath here because:
      // 1. We'll overwrite them so deleting is not necessary
      // 2. Windows throws EPERM error for the deleting and creating file process.
      await processGraphQLCodegen({
        cwd,
        schema: config.schema,
        plugins: config.plugins,
        config: codegenOpts.config,
        filename: tsxFullPath,
        gqlHash,
        documents: gqlRelPath,
      });
      codegenContext.push({
        ...createdPaths,
        gqlHash,
        dtsContentDecorator: (s) => s,
      });
    } else {
      skippedContext.push({ tsxFullPath, dtsFullPath });
    }
  }
}

export async function prepareFullGenerate({ cwd, config }: ExecContext) {
  const gqlRelPaths = await glob(config.documents, {
    cwd,
    gitignore: config.respectGitIgnore,
  });
  if (gqlRelPaths.length === 0) {
    throw new Error(
      `No GraphQL documents are found from the path ${JSON.stringify(
        config.documents,
      )}. Check "documents" in .graphql-let.yml.`,
    );
  }
  return gqlRelPaths;
}

export async function processDtsForCodegenContext(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  logUpdate(PRINT_PREFIX + 'Generating .d.ts...');
  const dtsContents = genDts(execContext, codegenContext);

  await makeDir(dirname(codegenContext[0].dtsFullPath));
  for (const [i, dtsContent] of dtsContents.entries()) {
    const { dtsFullPath, gqlHash, dtsContentDecorator } = codegenContext[i]!;
    const content = withHash(gqlHash, dtsContentDecorator(dtsContent));
    await writeFile(dtsFullPath, content);
  }
}

async function fullGenerate(
  execContext: ExecContext,
): Promise<[CodegenContext[], SkippedContext[]]> {
  const codegenContext: CodegenContext[] = [];
  const skippedContext: SkippedContext[] = [];

  const gqlRelPaths = await prepareFullGenerate(execContext);

  const { schemaHash } = await processResolverTypesIfNeeded(
    execContext,
    codegenContext,
    skippedContext,
  );

  await processDocuments(
    execContext,
    gqlRelPaths,
    schemaHash,
    codegenContext,
    skippedContext,
  );

  if (codegenContext.length)
    await processDtsForCodegenContext(execContext, codegenContext);

  return [codegenContext, skippedContext];
}

export default fullGenerate;
