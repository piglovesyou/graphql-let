import { loadOptions } from '@babel/core';
import traverse, { NodePath } from '@babel/traverse';
import makeDir from 'make-dir';
import { join as pathJoin, dirname } from 'path';
import { existsSync } from 'fs';
import slash from 'slash';
import {
  getGraphQLLetBabelOption,
  modifyLiteralCalls,
  visitLiteralCalls,
} from '../../babel';
import loadConfig from '../config';
import { processGraphQLCodegenForDocuments } from '../documents';
import { processDtsForContext } from '../dts';
import createExecContext, { ExecContext } from '../exec-context';
import { rimraf } from '../file';
import { stripIgnoredCharacters } from 'graphql';
import { parse } from '@babel/parser';
import { readFile } from '../file';
import { join } from 'path';
import { createHash } from '../hash';
import * as t from '@babel/types';
import {
  prepareGenResolverTypes,
  shouldGenResolverTypes,
} from '../resolver-types';
import { LiteralCache, PartialCacheStore } from './cache';
import { CodegenContext, LiteralCodegenContext } from '../types';
import { appendExportAsObject, createPaths, parserOption } from './fns';

export type VisitLiteralCallResults = {
  pendingDeletion: {
    defaultSpecifier:
      | t.ImportSpecifier
      | t.ImportDefaultSpecifier
      | t.ImportNamespaceSpecifier;
    path: NodePath<t.ImportDeclaration>;
  }[];
  literalCallExpressionPaths: [
    NodePath<t.CallExpression> | NodePath<t.TaggedTemplateExpression>,
    string,
  ][];
  hasError: boolean;
};

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
      sourceRelPath,
      gqlHash,
      dtsRelDir,
      cacheFullDir,
      cwd,
    );
    codegenContext.push({
      ...createdPaths,
      gqlContent,
      strippedGqlContent,
      gqlHash,
      skip: Boolean(partialCache[gqlHash]),
      dtsContentDecorator: appendExportAsObject,
    });

    // Note: Non-stripped gqlContent is necessary
    // to write dtsEntrypoint.
    partialCache[gqlHash] = [slash(createdPaths.dtsRelPath), gqlContent];

    // Old caches left will be removed
    oldGqlHashes.delete(gqlHash);
  }

  // Run codegen to write .tsx
  await processGraphQLCodegenForDocuments(execContext, codegenContext);

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
    const { schemaHash: _schemaHash } = await prepareGenResolverTypes(
      execContext,
    );
    schemaHash = _schemaHash;
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
    importName = 'graphql-let',
    onlyMatchImportSuffix = false,
    // strip = false,
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
        const visitLiteralCallResults = visitLiteralCalls(
          programPath,
          importName,
          onlyMatchImportSuffix,
        );
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
      visitLiteralCallResults,
      scopedCodegenContext,
    );
    for (const context of scopedCodegenContext) codegenContext.push(context);
  }

  await cache.unload();
}
