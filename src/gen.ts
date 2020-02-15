import makeDir from 'make-dir';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { promises as fsPromises } from 'fs';
import glob from 'globby';
import getHash from './lib/hash';
import createCodegenOpts from './lib/create-codegen-opts';
import { genDts, wrapAsModule } from './lib/dts';
import memoize from './lib/memoize';
import { createDtsRelDir, createPaths } from './lib/paths';
import { PRINT_PREFIX } from './lib/print';
import {
  processGenerateResolverTypes,
  shouldGenResolverTypes,
} from './lib/resolver-types';
import { CommandOpts, ConfigTypes } from './lib/types';
import { promisify } from 'util';
import _rimraf from 'rimraf';
import logUpdate from 'log-update';
import { processGraphQLCodegen as _processGraphQLCodegen } from './lib/graphql-codegen';

const rimraf = promisify(_rimraf);
const { readFile, writeFile } = fsPromises;
const processGraphQLCodegen = memoize(
  _processGraphQLCodegen,
  (_, tsxFullPath) => tsxFullPath,
);

export default async function gen(commandOpts: CommandOpts): Promise<void> {
  logUpdate(PRINT_PREFIX + 'Running graphql-codegen...');

  const { configPath, cwd } = commandOpts;
  const config = parseYaml(await readFile(configPath, 'utf-8')) as ConfigTypes;

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

  for (const gqlRelPath of gqlRelPaths) {
    const gqlContent = await readFile(path.join(cwd, gqlRelPath), 'utf-8');

    const { tsxFullPath, dtsFullPath } = createPaths(
      cwd,
      config.generateDir,
      gqlRelPath,
      getHash(gqlContent),
    );

    await processGraphQLCodegen(
      codegenOpts,
      tsxFullPath,
      gqlRelPath,
      gqlContent,
    );

    codegenContext.push({ tsxFullPath, dtsFullPath, gqlRelPath });
  }

  if (shouldGenResolverTypes(commandOpts, config)) {
    logUpdate(
      PRINT_PREFIX +
        `Local schema files are detected. Generating resolver types...`,
    );
    const {
      tsxFullPath,
      dtsFullPath,
      gqlRelPath,
    } = await processGenerateResolverTypes(cwd, config, codegenOpts);
    codegenContext.push({
      tsxFullPath,
      dtsFullPath,
      gqlRelPath,
    });
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
