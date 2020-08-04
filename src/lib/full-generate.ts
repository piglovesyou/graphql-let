import * as t from '@babel/types';
import glob from 'globby';
import { join as pathJoin } from 'path';
import { BabelOptions, modifyGqlCalls, visitGqlCalls } from '../babel';
import { processDtsForContext } from './dts';
import { ExecContext } from './exec-context';
import { parserOption, processGql } from './gql';
import { createHash } from './hash';
import { createPaths, isTypeScriptPath } from './paths';
import { updateLog } from './print';
import { processResolverTypesIfNeeded } from './resolver-types';
import { processGraphQLCodegen } from './graphql-codegen';
import { readFile, readHash } from './file';
import traverse, { NodePath } from '@babel/traverse';
import { parse } from '@babel/parser';
import { loadOptions } from '@babel/core';
import {
  CodegenContext,
  FileCodegenContext,
  LiteralCodegenContext,
} from './types';

// Take care of `.graphql`s
export async function processDocumentsForContext(
  execContext: ExecContext,
  gqlRelPaths: string[],
  schemaHash: string,
  codegenContext: CodegenContext[],
) {
  if (!gqlRelPaths.length) return;

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

    const context: FileCodegenContext = {
      ...createdPaths,
      gqlHash,
      dtsContentDecorator: (s) => s,
      skip: !shouldUpdate,
    };
    codegenContext.push(context);

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
    }
  }
}

export async function prepareFullGenerate({
  cwd,
  config,
}: ExecContext): Promise<{
  graphqlRelPaths: string[];
  tsSourceRelPaths: string[];
}> {
  const documentPaths = await glob(config.documents, {
    cwd,
    gitignore: config.respectGitIgnore,
  });
  if (documentPaths.length === 0) {
    throw new Error(
      `No GraphQL documents are found from the path ${JSON.stringify(
        config.documents,
      )}. Check "documents" in .graphql-let.yml.`,
    );
  }
  const graphqlRelPaths: string[] = [];
  const tsSourceRelPaths: string[] = [];
  for (const p of documentPaths) {
    isTypeScriptPath(p) ? tsSourceRelPaths.push(p) : graphqlRelPaths.push(p);
  }
  return { graphqlRelPaths, tsSourceRelPaths };
}

function getGraphQLLetBabelOption(babelOptions: any): BabelOptions {
  for (const { key, options } of babelOptions.plugins || []) {
    if (key.includes('graphql-let/')) {
      return options;
    }
  }
  return {};
}

// Take care of `gql(`query {}`)` in `.ts(x)` sources
async function processLiterals(
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
  const promises: Promise<void>[] = [];
  for (const sourceRelPath of sourceRelPaths) {
    const sourceFullPath = pathJoin(cwd, sourceRelPath);
    const sourceContent = await readFile(pathJoin(cwd, sourceRelPath), 'utf-8');
    const sourceAST = parse(sourceContent, parserOption);
    traverse(sourceAST, {
      Program(programPath: NodePath<t.Program>) {
        const literalCodegenContext: LiteralCodegenContext[] = [];

        const visitGqlCallResults = visitGqlCalls(
          programPath,
          importName,
          onlyMatchImportSuffix,
        );
        const { gqlCallExpressionPaths } = visitGqlCallResults;
        const gqlContents = gqlCallExpressionPaths.map(([, value]) => value);

        // TODO: Handle error

        if (!gqlCallExpressionPaths.length) return;

        const p = processGql(
          execContext,
          sourceRelPath,
          schemaHash,
          gqlContents,
          literalCodegenContext,
        ).then(() => {
          // TODO: Check context.skip
          modifyGqlCalls(
            programPath,
            sourceFullPath,
            visitGqlCallResults,
            literalCodegenContext,
          );
          for (const c of literalCodegenContext) codegenContext.push(c);
        });

        promises.push(p);
      },
    });
  }
  // TODO: Heavy? Should stream?
  // Wait for codegenContext is filled
  await Promise.all(promises);
}

async function fullGenerate(
  execContext: ExecContext,
): Promise<CodegenContext[]> {
  const codegenContext: CodegenContext[] = [];

  const { graphqlRelPaths, tsSourceRelPaths } = await prepareFullGenerate(
    execContext,
  );

  const { schemaHash } = await processResolverTypesIfNeeded(
    execContext,
    codegenContext,
  );

  await processDocumentsForContext(
    execContext,
    graphqlRelPaths,
    schemaHash,
    codegenContext,
  );

  await processLiterals(
    execContext,
    schemaHash,
    tsSourceRelPaths,
    codegenContext,
  );

  updateLog('Generating .d.ts...');

  await processDtsForContext(execContext, codegenContext);

  return codegenContext;
}

export default fullGenerate;
