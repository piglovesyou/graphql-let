import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { loadConfigSync } from '../lib/config';
import { CodegenConfigForLiteralDocuments } from '../lib/documents';
import { processDtsForContext } from '../lib/dts';
import createExecContext, { ExecContext } from '../lib/exec-context';
import { processGraphQLCodegen } from '../lib/graphql-codegen';
import { processLiteralsSync } from '../lib/inject-types/literals';
import { processLoadsSync } from '../lib/inject-types/loads';
import {
  createSchemaHashSync,
  shouldGenResolverTypes,
} from '../lib/resolver-types';
import { toSync } from '../lib/to-sync';
import { CodegenContext } from '../lib/types';
import { CallExpressionPathPairs, modifyLiteralCalls } from './ast';

// TODO: name of function
export function prepareCodegenArgs(cwd: string) {
  const [config, configHash] = loadConfigSync(cwd, undefined);
  const execContext = createExecContext(cwd, config, configHash);
  let schemaHash = configHash;
  if (shouldGenResolverTypes(config))
    schemaHash = createSchemaHashSync(execContext);
  return { execContext, schemaHash };
}

export async function generateForContext(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
  sourceRelPath: string,
) {
  await processGraphQLCodegen(
    execContext,
    codegenContext,
    new CodegenConfigForLiteralDocuments(
      execContext,
      codegenContext,
      sourceRelPath,
    ),
  );
  await processDtsForContext(execContext, codegenContext);
}

export const generateForContextSync = toSync(generateForContext);

export function manipulateLiterals(
  literalCallExpressionPaths: CallExpressionPathPairs,
  execContext: ExecContext,
  sourceRelPath: string,
  schemaHash: string,
  codegenContext: CodegenContext[],
  programPath: NodePath<t.Program>,
  sourceFullPath: string,
) {
  const gqlContents = literalCallExpressionPaths.map(([, value]) => value);
  const literalCodegenContext = processLiteralsSync(
    execContext,
    sourceRelPath,
    schemaHash,
    gqlContents,
    codegenContext,
  );

  modifyLiteralCalls(
    programPath,
    sourceFullPath,
    literalCallExpressionPaths,
    literalCodegenContext,
  );

  codegenContext.push(...literalCodegenContext);
}

export function manipulateLoads(
  loadCallExpressionPaths: CallExpressionPathPairs,
  execContext: ExecContext,
  sourceRelPath: string,
  schemaHash: string,
  codegenContext: CodegenContext[],
  programPath: NodePath<t.Program>,
  sourceFullPath: string,
) {
  const loadRelPaths = loadCallExpressionPaths.map(([, value]) => value);

  // TODO:
  const literalCodegenContext = processLoadsSync(
    execContext,
    sourceRelPath,
    schemaHash,
    loadRelPaths,
    codegenContext,
  );

  modifyLiteralCalls(
    programPath,
    sourceFullPath,
    loadCallExpressionPaths,
    literalCodegenContext,
  );

  codegenContext.push(...literalCodegenContext);
}
