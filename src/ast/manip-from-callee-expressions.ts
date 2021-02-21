import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { CodegenContext } from '../lib/types';
import { getProgramPath, visitFromCallExpressionPaths } from './ast';
import {
  generateForContextSync,
  manipulateLiterals,
  prepareCodegenArgs,
} from './manip-fns';

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

  const codegenContext: CodegenContext[] = [];
  const { execContext, schemaHash } = prepareCodegenArgs(cwd);

  manipulateLiterals(
    literalCallExpressionPaths,
    execContext,
    sourceRelPath,
    schemaHash,
    codegenContext,
    programPath,
    sourceFullPath,
  );

  generateForContextSync(execContext, codegenContext, sourceRelPath);
}
