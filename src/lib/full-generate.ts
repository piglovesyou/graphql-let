import glob from 'globby';
import logUpdate from 'log-update';
import makeDir from 'make-dir';
import { join as pathJoin, dirname } from 'path';
import createCodegenOpts, { PartialCodegenOpts } from './create-codegen-opts';
import { genDts } from './dts';
import { createHash } from './hash';
import { createPaths } from './paths';
import { PRINT_PREFIX } from './print';
import {
  processGenerateResolverTypes,
  shouldGenResolverTypes,
} from './resolver-types';
import { ConfigTypes } from './types';
import { processGraphQLCodegen } from './graphql-codegen';
import { readFile, writeFile, withHash, readHash } from './file';

export type CodegenContext = {
  tsxFullPath: string;
  dtsFullPath: string;
  gqlRelPath: string;
  gqlHash: string;
  dtsContentDecorator: (content: string) => string;
}[];

export async function processResolverTypesIfNeeded(
  cwd: string,
  config: ConfigTypes,
  configHash: string,
  codegenOpts: PartialCodegenOpts,
  codegenContext: CodegenContext,
) {
  // To pass config change on subsequent generation,
  // configHash should be primary hash seed.
  let schemaHash = configHash;

  if (shouldGenResolverTypes(config)) {
    const schemaFullPath = pathJoin(cwd, config.schema);
    const content = await readFile(schemaFullPath);
    schemaHash = createHash(schemaHash + content);
    const createdPaths = createPaths(cwd, config.schema, config.cacheDir);

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

      const {
        tsxFullPath,
        dtsFullPath,
        gqlRelPath,
      } = await processGenerateResolverTypes(
        schemaHash,
        config,
        codegenOpts,
        createdPaths,
        cwd,
      );

      codegenContext.push({
        tsxFullPath,
        dtsFullPath,
        gqlRelPath,
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
    }
  }
  return { schemaHash };
}

export async function processDocuments(
  gqlRelPaths: string[],
  cwd: string,
  config: ConfigTypes,
  schemaHash: string,
  codegenOpts: PartialCodegenOpts,
  codegenContext: CodegenContext,
) {
  for (const gqlRelPath of gqlRelPaths) {
    const gqlContent = await readFile(pathJoin(cwd, gqlRelPath), 'utf-8');

    const { tsxFullPath, dtsFullPath } = createPaths(
      cwd,
      gqlRelPath,
      config.cacheDir,
    );

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
        tsxFullPath,
        dtsFullPath,
        gqlRelPath,
        gqlHash,
        dtsContentDecorator: (s) => s,
      });
    }
  }
}

export async function prepareFullGenerate(cwd: string, config: ConfigTypes) {
  const codegenOpts = await createCodegenOpts(config);
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
  return { codegenOpts, gqlRelPaths };
}

export async function processDtsForCodegenContext(
  codegenContext: CodegenContext,
  config: ConfigTypes,
) {
  logUpdate(PRINT_PREFIX + 'Generating .d.ts...');
  const dtsContents = genDts(
    codegenContext.map((s) => s.tsxFullPath),
    config,
  );

  await makeDir(dirname(codegenContext[0].dtsFullPath));
  for (const [i, dtsContent] of dtsContents.entries()) {
    const { dtsFullPath, gqlHash, dtsContentDecorator } = codegenContext[i]!;
    const content = withHash(gqlHash, dtsContentDecorator(dtsContent));
    await writeFile(dtsFullPath, content);
  }
}

async function fullGenerate(
  cwd: string,
  config: ConfigTypes,
  configHash: string,
): Promise<CodegenContext> {
  const codegenContext: CodegenContext = [];

  const { codegenOpts, gqlRelPaths } = await prepareFullGenerate(cwd, config);

  const { schemaHash } = await processResolverTypesIfNeeded(
    cwd,
    config,
    configHash,
    codegenOpts,
    codegenContext,
  );

  await processDocuments(
    gqlRelPaths,
    cwd,
    config,
    schemaHash,
    codegenOpts,
    codegenContext,
  );

  if (codegenContext) await processDtsForCodegenContext(codegenContext, config);

  return codegenContext;
}

export default fullGenerate;
