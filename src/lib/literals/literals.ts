import { loadOptions } from '@babel/core';
import { generate } from '@graphql-codegen/cli';
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
import { processDtsForContext } from '../dts';
import { ExecContext } from '../exec-context';
import { rimraf } from '../file';
import { stripIgnoredCharacters } from 'graphql';
import { parse } from '@babel/parser';
import { readFile } from '../file';
import { join } from 'path';
import { writeFile } from '../file';
import { createHash } from '../hash';
import * as t from '@babel/types';
import { LiteralCache, PartialCacheStore } from './cache';
import {
  CodegenContext,
  isLiteralContext,
  LiteralCodegenContext,
} from '../types';
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

async function processCodegenForLiterals(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  const { cwd, config } = execContext;

  for (const { strippedGqlContent, tsxFullPath } of codegenContext.filter(
    isLiteralContext,
  ) as LiteralCodegenContext[]) {
    const [{ content }] = await generate(
      {
        silent: true, // Necessary to pass stdout to the parent process
        cwd,
        schema: config.schema,
        documents: [strippedGqlContent],
        generates: {
          [tsxFullPath]: {
            plugins: config.plugins,
            config: execContext.codegenOpts.config,
          },
        },
      },
      false,
    );
    await makeDir(dirname(tsxFullPath));
    await writeFile(tsxFullPath, content);
  }
}

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
  await processCodegenForLiterals(execContext, codegenContext);

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
  execContext: ExecContext;
  schemaHash: string;
  sourceRelPath: string;
  gqlContents: string[];
};

// Used in babel.ts
export async function processLiteralsWithDtsGenerate(
  literalsArgs: LiteralsArgs,
): Promise<LiteralCodegenContext[]> {
  const { execContext, sourceRelPath, schemaHash, gqlContents } = literalsArgs;

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
