import { loadOptions } from '@babel/core';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import doSync from 'do-sync';
import { existsSync } from 'fs';
import { stripIgnoredCharacters } from 'graphql';
import makeDir from 'make-dir';
import { dirname, join, join as pathJoin } from 'path';
import slash from 'slash';
import { getGraphQLLetBabelOption } from '../../babel-plugin';
import {
  modifyLiteralCalls,
  visitFromProgramPath,
  VisitLiteralCallResults,
} from '../ast';
import loadConfig from '../config';
import { processGraphQLCodegenForLiterals } from '../documents';
import { processDtsForContext } from '../dts';
import createExecContext, { ExecContext } from '../exec-context';
import { readFile, rimraf } from '../file';
import { createHash } from '../hash';
import { createSchemaHash, shouldGenResolverTypes } from '../resolver-types';
import { CodegenContext, LiteralCodegenContext } from '../types';
import { LiteralCache, PartialCacheStore } from './cache';
import { appendExportAsObject, createPaths, parserOption } from './fns';

// To avoid conflicts of file names
export const typesRootRelDir = 'proj-root';

export async function processLiterals(
  execContext: ExecContext,
  sourceRelPath: string,
  schemaHash: string,
  gqlContents: string[],
  codegenContext: CodegenContext[],
  partialCache: PartialCacheStore,
): Promise<void> {
  const { cwd, config, cacheFullDir } = execContext;
  const dtsRelDir = dirname(config.gqlDtsEntrypoint);

  const literalCodegenContext: LiteralCodegenContext[] = [];
  const oldGqlHashes = new Set(Object.keys(partialCache));

  // Prepare
  await Promise.all([
    await makeDir(join(cwd, dtsRelDir)),
    await makeDir(cacheFullDir),
  ]);

  for (const gqlContent of gqlContents) {
    const strippedGqlContent = stripIgnoredCharacters(gqlContent);
    const gqlHash = createHash(schemaHash + strippedGqlContent);
    const createdPaths = createPaths(
      pathJoin(typesRootRelDir, sourceRelPath),
      gqlHash,
      dtsRelDir,
      cacheFullDir,
      cwd,
    );
    const context: LiteralCodegenContext = {
      ...createdPaths,
      gqlContent,
      strippedGqlContent,
      gqlHash,
      skip: Boolean(partialCache[gqlHash]),
      dtsContentDecorator: appendExportAsObject,
    };
    codegenContext.push(context);
    literalCodegenContext.push(context);

    // Note: Non-stripped gqlContent is necessary
    // to write dtsEntrypoint.
    partialCache[gqlHash] = [slash(createdPaths.dtsRelPath), gqlContent];

    // Old caches left will be removed
    oldGqlHashes.delete(gqlHash);
  }

  // Run codegen to write .tsx
  await processGraphQLCodegenForLiterals(
    execContext,
    literalCodegenContext,
    sourceRelPath,
  );

  // Remove old caches
  for (const oldGqlHash of oldGqlHashes) {
    delete partialCache[oldGqlHash];
    const { dtsFullPath } = createPaths(
      sourceRelPath,
      oldGqlHash,
      dtsRelDir,
      cacheFullDir,
      cwd,
    );
    if (existsSync(dtsFullPath)) {
      await rimraf(dtsFullPath);
    }
  }
}

export type LiteralsArgs = {
  // execContext: ExecContext;
  cwd: string;
  configFilePath?: string;
  // schemaHash: string;
  sourceRelPath: string;
  gqlContents: string[];
};

// Used in babel.ts
export async function processLiteralsWithDtsGenerate(
  literalsArgs: LiteralsArgs,
): Promise<LiteralCodegenContext[]> {
  const { cwd, configFilePath, sourceRelPath, gqlContents } = literalsArgs;

  const [config, configHash] = await loadConfig(cwd, configFilePath);
  const execContext = createExecContext(cwd, config, configHash);
  let schemaHash = configHash;
  if (shouldGenResolverTypes(config)) {
    schemaHash = await createSchemaHash(execContext);
  }

  const codegenContext: LiteralCodegenContext[] = [];

  const cache = new LiteralCache(execContext);
  await cache.load();

  await processLiterals(
    execContext,
    sourceRelPath,
    schemaHash,
    gqlContents,
    codegenContext,
    cache.get(sourceRelPath),
  );
  await cache.unload();

  await processDtsForContext(execContext, codegenContext);

  return codegenContext;
}

export async function processLiteralsForContext(
  execContext: ExecContext,
  schemaHash: string,
  sourceRelPaths: string[],
  codegenContext: CodegenContext[],
) {
  if (!sourceRelPaths.length) return;

  const { cwd } = execContext;
  const babelOptions = await loadOptions({ cwd });
  const {
    // configFilePath,
  } = getGraphQLLetBabelOption(babelOptions);

  const visitedSources: {
    visitLiteralCallResults: VisitLiteralCallResults;
    programPath: NodePath<t.Program>;
    sourceFullPath: string;
    sourceRelPath: string;
  }[] = [];

  for (const sourceRelPath of sourceRelPaths) {
    const sourceFullPath = pathJoin(cwd, sourceRelPath);
    const sourceContent = await readFile(pathJoin(cwd, sourceRelPath), 'utf-8');
    const sourceAST = parse(sourceContent, parserOption);
    traverse(sourceAST, {
      Program(programPath: NodePath<t.Program>) {
        const visitLiteralCallResults = visitFromProgramPath(programPath);
        // TODO: Handle error
        // There's no `gql(`query {}`)` in the source
        if (!visitLiteralCallResults.literalCallExpressionPaths.length) return;

        visitedSources.push({
          visitLiteralCallResults,
          programPath,
          sourceFullPath,
          sourceRelPath,
        });
      },
    });
  }

  const cache = new LiteralCache(execContext);
  await cache.load();

  for (const visited of visitedSources) {
    const scopedCodegenContext: LiteralCodegenContext[] = [];
    const {
      visitLiteralCallResults,
      programPath,
      sourceFullPath,
      sourceRelPath,
    } = visited;
    const { literalCallExpressionPaths } = visitLiteralCallResults;

    const gqlContents = literalCallExpressionPaths.map(([, value]) => value);

    await processLiterals(
      execContext,
      sourceRelPath,
      schemaHash,
      gqlContents,
      scopedCodegenContext,
      cache.get(sourceRelPath),
    );
    modifyLiteralCalls(
      programPath,
      sourceFullPath,
      literalCallExpressionPaths,
      scopedCodegenContext,
    );
    for (const context of scopedCodegenContext) codegenContext.push(context);
  }

  await cache.unload();
}

export const processLiteralsWithDtsGenerateSync = doSync(
  ({
    libFullDir,
    ...gqlCompileArgs
  }: LiteralsArgs & {
    libFullDir: string;
  }): /* Promise<LiteralCodegenContext[]> */ any => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { join } = require('path');
    const modulePath = join(libFullDir, './dist/lib/literals/literals');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { processLiteralsWithDtsGenerate } = require(modulePath);
    return processLiteralsWithDtsGenerate(gqlCompileArgs);
  },
);
