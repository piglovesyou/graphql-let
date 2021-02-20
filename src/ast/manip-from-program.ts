import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { processLiteralsWithDtsGenerateSync } from '../lib/literals/literals';
import { LiteralCodegenContext } from '../lib/types';
import {
  modifyLiteralCalls,
  removeImportDeclaration,
  visitFromProgramPath,
} from './ast';

export function manipulateFromProgramPath(
  cwd: string,
  programPath: NodePath<t.Program>,
  configFilePath: string | undefined,
  sourceRelPath: string,
  sourceFullPath: string,
) {
  const visitLiteralCallResults = visitFromProgramPath(programPath);
  const {
    literalCallExpressionPaths,
    hasError,
    pendingDeletion,
  } = visitLiteralCallResults;

  // TODO: Handle error

  if (!literalCallExpressionPaths.length) return;

  const literalCodegenContext: LiteralCodegenContext[] = processLiteralsWithDtsGenerateSync(
    {
      cwd,
      configFilePath,
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

  // Only delete import statement or specifier when there is no error
  if (!hasError) {
    removeImportDeclaration(pendingDeletion);
  }
}
