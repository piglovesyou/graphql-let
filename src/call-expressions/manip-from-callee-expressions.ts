import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { CodegenContext } from '../lib/types';
import {
  CallExpressionPathPairs,
  getProgramPath,
  replaceCallExpressions,
  visitFromCallExpressionPaths,
} from './ast';
import {
  appendLiteralAndLoadCodegenContext,
  writeTiIndexForContext,
} from './handle-codegen-context';
import { generateForContextSync, prepareCodegenArgs } from './manip-fns';

export function manipulateFromCalleeExpressionsSync(
  cwd: string,
  gqlCalleePaths: NodePath[] | undefined,
  loadCalleePaths: NodePath[] | undefined,
  sourceRelPath: string,
  sourceFullPath: string,
) {
  if (!gqlCalleePaths?.length && !loadCalleePaths?.length) return;

  const programPath = getProgramPath((gqlCalleePaths || loadCalleePaths!)[0]);
  const { execContext, schemaHash } = prepareCodegenArgs(cwd);

  const callExpressionPathPairs: CallExpressionPathPairs = [];
  if (gqlCalleePaths?.length)
    callExpressionPathPairs.push(
      ...visitFromCallExpressionPaths(
        gqlCalleePaths!.map(
          (p) => p.parentPath,
        ) as NodePath<t.CallExpression>[],
        'gql',
      ),
    );
  if (loadCalleePaths?.length)
    callExpressionPathPairs.push(
      ...visitFromCallExpressionPaths(
        loadCalleePaths!.map(
          (p) => p.parentPath,
        ) as NodePath<t.CallExpression>[],
        'load',
      ),
    );

  const codegenContext: CodegenContext[] = [];

  appendLiteralAndLoadCodegenContext(
    callExpressionPathPairs,
    execContext,
    schemaHash,
    sourceRelPath,
    sourceFullPath,
    codegenContext,
    cwd,
  );

  replaceCallExpressions(
    programPath,
    sourceFullPath,
    callExpressionPathPairs,
    codegenContext,
  );

  writeTiIndexForContext(execContext, codegenContext);

  generateForContextSync(execContext, codegenContext);
}
