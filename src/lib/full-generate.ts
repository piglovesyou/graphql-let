import { promises as fsPromises } from 'fs';
import glob from 'globby';
import logUpdate from 'log-update';
import makeDir from 'make-dir';
import path from 'path';
import _rimraf from 'rimraf';
import { promisify } from 'util';
import createCodegenOpts from './create-codegen-opts';
import { genDts, wrapAsModule } from './dts';
import getHash from './hash';
import { createDtsRelDir, createPaths } from './paths';
import { PRINT_PREFIX } from './print';
import {
  processGenerateResolverTypes,
  shouldGenResolverTypes,
} from './resolver-types';
import { ConfigTypes } from './types';
import { processGraphQLCodegen } from './graphql-codegen';

const rimraf = promisify(_rimraf);
const { readFile, writeFile } = fsPromises;

async function fullGenerate(config: ConfigTypes, cwd: string) {
  // When we rebuild from schema, we have to restart from very beginning.
  await rimraf(path.join(cwd, config.generateDir));

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

  const codegenContext: {
    tsxFullPath: string;
    dtsFullPath: string;
    gqlRelPath: string;
  }[] = [];

  let schemaHash = '';
  if (shouldGenResolverTypes(config)) {
    logUpdate(
      PRINT_PREFIX +
        `Local schema files are detected. Generating resolver types...`,
    );
    const {
      schemaHash: _schemaHash,
      tsxFullPath,
      dtsFullPath,
      gqlRelPath,
    } = await processGenerateResolverTypes(cwd, config, codegenOpts);
    codegenContext.push({
      tsxFullPath,
      dtsFullPath,
      gqlRelPath,
    });
    schemaHash = _schemaHash;
  }

  for (const gqlRelPath of gqlRelPaths) {
    const gqlContent = await readFile(path.join(cwd, gqlRelPath), 'utf-8');

    const { tsxFullPath, dtsFullPath } = createPaths(
      cwd,
      config.generateDir,
      gqlRelPath,
      // Here I add "schemaHash" as a hash seed. Types of GraphQL documents
      // basically depends on schema, which change should effect to document results.
      getHash(gqlContent + schemaHash),
    );

    await processGraphQLCodegen(
      codegenOpts,
      tsxFullPath,
      gqlRelPath,
      gqlContent,
    );

    codegenContext.push({ tsxFullPath, dtsFullPath, gqlRelPath });
  }

  logUpdate(PRINT_PREFIX + 'Generating .d.ts...');
  const dtsContents = genDts(codegenContext.map(s => s.tsxFullPath));

  await makeDir(path.dirname(codegenContext[0].dtsFullPath));
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

export default fullGenerate;
