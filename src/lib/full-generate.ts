import { promises as fsPromises, existsSync } from 'fs';
import glob from 'globby';
import logUpdate from 'log-update';
import makeDir from 'make-dir';
import { join as pathJoin, dirname } from 'path';
import createCodegenOpts, { PartialCodegenOpts } from './create-codegen-opts';
import { genDts, wrapAsModule } from './dts';
import getHash from './hash';
import { createDtsRelDir, createPaths } from './paths';
import { PRINT_PREFIX } from './print';
import {
  getHashOfSchema,
  getSchemaPaths,
  processGenerateResolverTypes,
  shouldGenResolverTypes,
} from './resolver-types';
import { ConfigTypes } from './types';
import { processGraphQLCodegen } from './graphql-codegen';

const { readFile, writeFile } = fsPromises;

export type CodegenContext = {
  tsxFullPath: string;
  dtsFullPath: string;
  gqlRelPath: string;
}[];

export async function processResolverTypesIfNeeded(
  config: ConfigTypes,
  cwd: string,
  codegenOpts: PartialCodegenOpts,
  codegenContext: {
    tsxFullPath: string;
    dtsFullPath: string;
    gqlRelPath: string;
  }[],
) {
  let schemaHash = '';
  if (shouldGenResolverTypes(config)) {
    const schemaPaths = await getSchemaPaths(
      cwd,
      config.schema,
      config.respectGitIgnore,
    );
    const _schemaHash = await getHashOfSchema(schemaPaths);
    const createdPaths = createPaths(
      cwd,
      config.generateDir,
      '__concatedschema__',
      _schemaHash,
    );

    if (!existsSync(createdPaths.tsxFullPath)) {
      logUpdate(
        PRINT_PREFIX +
          `Local schema files are detected. Generating resolver types...`,
      );
      const {
        tsxFullPath,
        dtsFullPath,
        gqlRelPath,
      } = await processGenerateResolverTypes(
        _schemaHash,
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
    schemaHash = _schemaHash;
  }
  return schemaHash;
}

export async function processDocuments(
  gqlRelPaths: string[],
  cwd: string,
  config: ConfigTypes,
  schemaHash: string,
  codegenOpts: PartialCodegenOpts,
  codegenContext: {
    tsxFullPath: string;
    dtsFullPath: string;
    gqlRelPath: string;
  }[],
) {
  for (const gqlRelPath of gqlRelPaths) {
    const gqlContent = await readFile(pathJoin(cwd, gqlRelPath), 'utf-8');

    const { tsxFullPath, dtsFullPath } = createPaths(
      cwd,
      config.generateDir,
      gqlRelPath,
      // Here I add "schemaHash" as a hash seed. Types of GraphQL documents
      // basically depends on schema, which change should effect to document results.
      getHash(gqlContent + schemaHash),
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

export async function prepareFullGenerate(config: ConfigTypes, cwd: string) {
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

export async function finalizeCodegenContextIfNeeded(
  codegenContext: {
    tsxFullPath: string;
    dtsFullPath: string;
    gqlRelPath: string;
  }[],
  config: ConfigTypes,
) {
  if (codegenContext.length) {
    logUpdate(PRINT_PREFIX + 'Generating .d.ts...');
    const dtsContents = genDts(codegenContext.map(s => s.tsxFullPath));

    await makeDir(dirname(codegenContext[0].dtsFullPath));
    for (const [i, dtsContent] of dtsContents.entries()) {
      const { dtsFullPath, gqlRelPath } = codegenContext[i]!;

      await writeFile(dtsFullPath, wrapAsModule(gqlRelPath, dtsContent));
    }

    logUpdate(
      PRINT_PREFIX +
        `${dtsContents.length} .d.ts were generated in ${createDtsRelDir(
          config.generateDir,
        )}.`,
    );
    logUpdate.done();
  }
}

async function fullGenerate(config: ConfigTypes, cwd: string): Promise<void> {
  const { codegenOpts, gqlRelPaths } = await prepareFullGenerate(config, cwd);

  const codegenContext: CodegenContext = [];

  const schemaHash = await processResolverTypesIfNeeded(
    config,
    cwd,
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

  await finalizeCodegenContextIfNeeded(codegenContext, config);
}

export default fullGenerate;
