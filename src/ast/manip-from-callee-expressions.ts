import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { CodegenContext } from '../lib/types';
import { getProgramPath, visitFromCallExpressionPaths } from './ast';
import {
  generateForContextSync,
  manipulateLiterals,
  manipulateLoads,
  prepareCodegenArgs,
} from './manip-fns';

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
  const codegenContext: CodegenContext[] = [];

  if (gqlCalleePaths?.length) {
    const literalCallExpressionPaths = visitFromCallExpressionPaths(
      gqlCalleePaths.map((p) => p.parentPath) as NodePath<t.CallExpression>[],
    );
    if (literalCallExpressionPaths.length) {
      manipulateLiterals(
        literalCallExpressionPaths,
        execContext,
        sourceRelPath,
        schemaHash,
        codegenContext, // TODO: Remove
        programPath,
        sourceFullPath,
      );
    }
  }

  if (loadCalleePaths?.length) {
    const loadCallExpressionPaths = visitFromCallExpressionPaths(
      loadCalleePaths.map((p) => p.parentPath) as NodePath<t.CallExpression>[],
    );
    if (loadCallExpressionPaths.length) {
      manipulateLoads(
        loadCallExpressionPaths,
        execContext,
        sourceRelPath,
        schemaHash,
        codegenContext, // TODO: Remove
        programPath,
        sourceFullPath,
      );
    }
  }

  generateForContextSync(execContext, codegenContext, sourceRelPath);
}
