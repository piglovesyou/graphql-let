import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { createMacro } from 'babel-plugin-macros';
import {
  modifyLiteralCalls,
  processLiteralsWithDtsGenerateSync,
} from './babel-plugin';
import { getPathsFromState, visitFromCallExpressionPaths } from './lib/ast';
import { LiteralCodegenContext } from './lib/types';

function getProgramPath(paths: NodePath<any>[]): NodePath<t.Program> {
  const p = paths[0]!;
  if (!p) throw new Error('What?');
  const ancestories = p.getAncestry() as any;
  return ancestories[ancestories.length - 1]!;
}

const macro = createMacro((params) => {
  const {
    references: { gql: gqlCalleePaths },
    state,
  } = params;

  const programPath = getProgramPath(gqlCalleePaths);
  const { cwd, sourceFullPath, sourceRelPath } = getPathsFromState(state);
  const gqlCallExpressionPaths = gqlCalleePaths.map(
    (p) => p.parentPath,
  ) as NodePath<t.CallExpression>[];

  const literalCallExpressionPaths = visitFromCallExpressionPaths(
    gqlCallExpressionPaths,
  );
  if (!literalCallExpressionPaths.length) return;

  const literalCodegenContext: LiteralCodegenContext[] = processLiteralsWithDtsGenerateSync(
    {
      hostDirname: __dirname,
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
});

export default macro;
