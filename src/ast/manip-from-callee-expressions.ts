import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { processLiteralsWithDtsGenerateSync } from '../lib/literals/literals';
import { LiteralCodegenContext } from '../lib/types';
import {
  getProgramPath,
  modifyLiteralCalls,
  visitFromCallExpressionPaths,
} from './ast';

export function manipulateFromCalleeExpressions(
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

  const literalCodegenContext: LiteralCodegenContext[] = processLiteralsWithDtsGenerateSync(
    {
      cwd,
      configFilePath: undefined, // TODO: Remove this arg from the signature.
      sourceRelPath,
      gqlContents: literalCallExpressionPaths.map(([, value]) => value),
    },
  ) as any; // Suppress JSONValue error. LiteralCodegenContext has a function property, but it can be ignored.

  modifyLiteralCalls(
    programPath,
    sourceFullPath,
    literalCallExpressionPaths,
    literalCodegenContext,
  );
}
