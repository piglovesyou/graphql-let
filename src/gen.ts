import Maybe from 'graphql/tsutils/Maybe';
import makeDir from 'make-dir';
import path from 'path';
import { parse as parseYaml } from 'yaml';
import { promises as fsPromises } from 'fs';
import glob from 'fast-glob';
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
  const gqlRelPaths = await glob(config.documents, { cwd });

  if (gqlRelPaths.length === 0) {
    throw new Error(
      `No GraphQL documents are found from the path ${JSON.stringify(
        config.documents,
      )}. Check "documents" in .graphql-let.yml.`,
    );
  }
  const codegenContexts: {
    tsxFullPath: string;
    dtsFullPath: string;
    dtsRelPath: string;
    gqlRelPath: string;
  }[] = [];

  for (const gqlRelPath of gqlRelPaths) {
    const gqlContent = await readFile(path.join(cwd, gqlRelPath), 'utf-8');

    const { tsxFullPath, dtsFullPath, dtsRelPath } = createPaths(
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

    codegenContexts.push({ tsxFullPath, dtsFullPath, gqlRelPath, dtsRelPath });
  }

  const documentsTsxPaths = codegenContexts.map(s => s.tsxFullPath);
  let resolverTypesResult: Maybe<{ tsxFullPath: string; dtsFullPath: string }>;

  if (shouldGenResolverTypes(commandOpts, config)) {
    logUpdate(
      PRINT_PREFIX +
        `Local schema files are detected. Generating resolver types...`,
    );
    resolverTypesResult = await processGenerateResolverTypes(
      cwd,
      config,
      codegenOpts,
    );
  }

  logUpdate(PRINT_PREFIX + 'Generating .d.ts...');
  const dtsResults = genDts(
    resolverTypesResult
      ? [resolverTypesResult.tsxFullPath, ...documentsTsxPaths]
      : documentsTsxPaths,
  );

  let dtsContents: string[];
  let schemaDtsContent: Maybe<string>;

  await makeDir(path.dirname(codegenContexts[0].dtsFullPath));

  if (resolverTypesResult) {
    [schemaDtsContent, ...dtsContents] = dtsResults;
    await writeFile(
      resolverTypesResult.dtsFullPath,
      wrapAsModule(config.schema, schemaDtsContent),
    );
  } else {
    dtsContents = dtsResults;
  }

  for (const [i, dtsContent] of dtsContents.entries()) {
    const { dtsFullPath, gqlRelPath } = codegenContexts[i]!;

    await writeFile(dtsFullPath, wrapAsModule(gqlRelPath, dtsContent));
  }

  logUpdate(
    PRINT_PREFIX +
      `${dtsResults.length} .d.ts were generated in ${createDtsRelDir(
        config.generateDir,
      )}.`,
  );
  logUpdate.done();
}
