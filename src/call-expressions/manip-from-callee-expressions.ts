import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { CodegenContext, isAllSkip } from '../lib/types';
import {
  CallExpressionPathPairs,
  getProgramPath,
  replaceCallExpressions,
  visitFromCallExpressionPaths,
} from './ast';
import { appendLiteralAndLoadCodegenContext } from './handle-codegen-context';
import { generateFilesForContextSync, prepareToManipulate } from './manip-fns';

export function manipulateFromCalleeExpressionsSync(
  cwd: string,
  gqlCalleePaths: NodePath[] = [],
  loadCalleePaths: NodePath[] = [],
  sourceRelPath: string,
  sourceFullPath: string,
  configFilePath: string | undefined,
) {
  if (!gqlCalleePaths.length && !loadCalleePaths?.length) return;

  const programPath = getProgramPath(
    gqlCalleePaths.concat(loadCalleePaths)[0]!,
  );
  const { execContext, schemaHash } = prepareToManipulate(cwd, configFilePath);

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

  if (!isAllSkip(codegenContext))
    generateFilesForContextSync(execContext, codegenContext);
}
