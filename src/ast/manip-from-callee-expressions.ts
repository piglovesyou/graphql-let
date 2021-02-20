import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { loadConfigSync } from '../lib/config';
import { CodegenConfigForLiteralDocuments } from '../lib/documents';
import { processDtsForContext } from '../lib/dts';
import createExecContext, { ExecContext } from '../lib/exec-context';
import { processGraphQLCodegen } from '../lib/graphql-codegen';
import { processLiterals2Sync } from '../lib/literals/literals';
import {
  createSchemaHashSync,
  shouldGenResolverTypes,
} from '../lib/resolver-types';
import { toSync } from '../lib/to-sync';
import { CodegenContext } from '../lib/types';
import {
  getProgramPath,
  modifyLiteralCalls,
  visitFromCallExpressionPaths,
} from './ast';

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

export const generateForContextSync = toSync<typeof generateForContext>(
  'dist/ast/manip-from-callee-expressions',
  'generateForContext',
);

export function manipulateFromCalleeExpressionsSync(
  cwd: string,
  gqlCalleePaths: NodePath[],
  sourceRelPath: string,
  sourceFullPath: string,
) {
  const programPath = getProgramPath(gqlCalleePaths[0]);
  const gqlCallExpressionPaths = gqlCalleePaths.map(
    (p) => p.parentPath,
  ) as NodePath<t.CallExpression>[];

  const literalCallExpressionPaths = visitFromCallExpressionPaths(
    gqlCallExpressionPaths,
  );
  if (!literalCallExpressionPaths.length) return;

  const { execContext, schemaHash } = prepareCodegenArgs(cwd);
  let codegenContext: CodegenContext[] = [];

  const gqlContents = literalCallExpressionPaths.map(([, value]) => value);
  const literalCodegenContext = processLiterals2Sync(
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
  codegenContext = codegenContext.concat(literalCodegenContext);

  generateForContextSync(execContext, codegenContext, sourceRelPath);
}
