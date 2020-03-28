import { existsSync } from 'fs';
import glob from 'globby';
import logUpdate from 'log-update';
import makeDir from 'make-dir';
import { join as pathJoin, dirname } from 'path';
import createCodegenOpts, { PartialCodegenOpts } from './create-codegen-opts';
import { genDts, wrapAsModule } from './dts';
import getHash from './hash';
import { createPaths } from './paths';
import { PRINT_PREFIX } from './print';
import {
  getHashOfSchema,
  getSchemaPaths,
  processGenerateResolverTypes,
  shouldGenResolverTypes,
} from './resolver-types';
import { ConfigTypes } from './types';
import { processGraphQLCodegen } from './graphql-codegen';
import { readFile, writeFile, removeByPatterns } from './file';

export type CodegenContext = {
  tsxFullPath: string;
  dtsFullPath: string;
  gqlRelPath: string;
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

  let schemaPaths: string[] = [];
  if (shouldGenResolverTypes(config)) {
    schemaPaths = await getSchemaPaths(
      cwd,
      config.schema,
      config.respectGitIgnore,
    );
    schemaHash = schemaHash + (await getHashOfSchema(schemaPaths));
    const createdPaths = createPaths(
      cwd,
      config.generateDir,
      '__concatedschema__',
      schemaHash,
    );

    await removeByPatterns(
      cwd,
      createdPaths.tsxRelRegex,
      createdPaths.dtsRelRegex,
      '!' + createdPaths.tsxFullPath,
      '!' + createdPaths.dtsFullPath,
    );

    if (
      !existsSync(createdPaths.tsxFullPath) ||
      !existsSync(createdPaths.dtsFullPath)
    ) {
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
        schemaPaths,
        config,
        codegenOpts,
        createdPaths,
      );

      codegenContext.push({
        tsxFullPath,
        dtsFullPath,
        gqlRelPath,
      });
    }
  }
  return { schemaHash, schemaPaths };
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

    const { tsxFullPath, dtsFullPath, tsxRelRegex, dtsRelRegex } = createPaths(
      cwd,
      config.generateDir,
      gqlRelPath,
      // Here I add "schemaHash" as a hash seed. Types of GraphQL documents
      // basically depends on schema, which change should effect to document results.
      getHash(gqlContent + schemaHash),
    );

    await removeByPatterns(
      cwd,
      tsxRelRegex,
      dtsRelRegex,
      '!' + tsxFullPath,
      '!' + dtsFullPath,
    );

    if (!existsSync(tsxFullPath)) {
      await processGraphQLCodegen(
        codegenOpts,
        tsxFullPath,
        gqlRelPath,
        gqlContent,
      );

      codegenContext.push({ tsxFullPath, dtsFullPath, gqlRelPath });
    }
  }
}

export async function prepareFullGenerate(cwd: string, config: ConfigTypes) {
  const codegenOpts = await createCodegenOpts(config, cwd);
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
) {
  logUpdate(PRINT_PREFIX + 'Generating .d.ts...');
  const dtsContents = genDts(codegenContext.map(s => s.tsxFullPath));

  await makeDir(dirname(codegenContext[0].dtsFullPath));
  for (const [i, dtsContent] of dtsContents.entries()) {
    const { dtsFullPath, gqlRelPath } = codegenContext[i]!;

    await writeFile(dtsFullPath, wrapAsModule(gqlRelPath, dtsContent));
  }
}

async function fullGenerate(
  cwd: string,
  config: ConfigTypes,
  configHash: string,
): Promise<number> {
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

  if (codegenContext.length) await processDtsForCodegenContext(codegenContext);

  return codegenContext.length;
}

export default fullGenerate;
