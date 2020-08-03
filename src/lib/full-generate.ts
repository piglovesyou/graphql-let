import * as t from '@babel/types';
import glob from 'globby';
import logUpdate from 'log-update';
import makeDir from 'make-dir';
import { join as pathJoin, dirname } from 'path';
import { BabelOptions, modifyGqlCalls, visitGqlCalls } from '../babel';
import { genDts } from './dts';
import { ExecContext } from './exec-context';
import { parserOption, processGql } from './gql';
import { createHash } from './hash';
import { createPaths, isTypeScriptPath } from './paths';
import { PRINT_PREFIX } from './print';
import {
  processGenerateResolverTypes,
  shouldGenResolverTypes,
} from './resolver-types';
import { processGraphQLCodegen } from './graphql-codegen';
import { readFile, writeFile, withHash, readHash } from './file';
import traverse, { NodePath } from '@babel/traverse';
import { parse } from '@babel/parser';
import { loadOptions } from '@babel/core';
import {
  CodegenContext,
  FileCodegenContext,
  LiteralCodegenContext,
} from './types';

// Take care of `.graphqls`s if needed
export async function processResolverTypesIfNeeded(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
  // skippedContext: SkippedContext[],
) {
  const { cwd, config, configHash, codegenOpts } = execContext;
  // To pass config change on subsequent generation,
  // configHash should be primary hash seed.
  let schemaHash = configHash;

  if (shouldGenResolverTypes(config)) {
    const fileSchema = config.schema as string;
    const schemaFullPath = pathJoin(cwd, fileSchema);
    const content = await readFile(schemaFullPath);
    schemaHash = createHash(schemaHash + content);
    const createdPaths = createPaths(execContext, fileSchema);

    const shouldUpdate =
      schemaHash !== (await readHash(createdPaths.tsxFullPath)) ||
      schemaHash !== (await readHash(createdPaths.dtsFullPath));

    const context: FileCodegenContext = {
      ...createdPaths,
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
      skip: !shouldUpdate,
    };
    codegenContext.push(context);

    if (shouldUpdate) {
      // We don't delete tsxFullPath and dtsFullPath here because:
      // 1. We'll overwrite them so deleting is not necessary
      // 2. Windows throws EPERM error for the deleting and creating file process.

      logUpdate(
        PRINT_PREFIX +
          `Local schema files are detected. Generating resolver types...`,
      );

      await processGenerateResolverTypes(
        schemaHash,
        config,
        codegenOpts,
        createdPaths,
        cwd,
      );
    }
  }
  return { schemaHash };
}

// Take care of `.graphql`s
export async function processDocuments(
  execContext: ExecContext,
  gqlRelPaths: string[],
  schemaHash: string,
  codegenContext: CodegenContext[],
  // skippedContext: SkippedContext[],
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

export async function generateDts(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  if (!codegenContext.length) return;

  logUpdate(PRINT_PREFIX + 'Generating .d.ts...');
  const dtsContents = genDts(
    execContext,
    codegenContext.map(({ tsxFullPath }) => tsxFullPath),
  );

  await makeDir(dirname(codegenContext[0].dtsFullPath));
  for (const [i, dtsContent] of dtsContents.entries()) {
    const ctx = codegenContext[i];
    const { dtsFullPath, gqlHash } = ctx!;
    const { dtsContentDecorator } = ctx as FileCodegenContext;
    const content = withHash(
      gqlHash,
      dtsContentDecorator ? dtsContentDecorator(dtsContent) : dtsContent,
    );
    await makeDir(dirname(dtsFullPath));
    await writeFile(dtsFullPath, content);
  }
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

  await processDocuments(
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

  await generateDts(execContext, codegenContext);

  return codegenContext;
}

export default fullGenerate;
