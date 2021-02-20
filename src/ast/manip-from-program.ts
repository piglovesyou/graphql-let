import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { processLiterals2Sync } from '../lib/literals/literals';
import { CodegenContext } from '../lib/types';
import {
  modifyLiteralCalls,
  removeImportDeclaration,
  visitFromProgramPath,
} from './ast';
import {
  generateForContextSync,
  prepareCodegenArgs,
} from './manip-from-callee-expressions';

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
    pendingDeletion,
  } = visitLiteralCallResults;

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

  // Only delete import statement or specifier when there is no error
  removeImportDeclaration(pendingDeletion);
}
