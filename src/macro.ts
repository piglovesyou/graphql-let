import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { createMacro } from 'babel-plugin-macros';
import { join } from 'path';
import {
  getPathsFromState,
  getProgramPath,
  modifyLiteralCalls,
  visitFromCallExpressionPaths,
} from './ast/ast';
import { processLiteralsWithDtsGenerateSync } from './lib/literals/literals';
import { LiteralCodegenContext } from './lib/types';

const macro = createMacro((params) => {
  const {
    references: { gql: gqlCalleePaths },
    state,
  } = params;

  const programPath = getProgramPath(gqlCalleePaths[0]);
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
      libFullDir: join(__dirname, '..'),
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
