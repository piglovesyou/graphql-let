import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { processLiteralsSync } from '../lib/literals/literals';
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
  const literalCodegenContext = processLiteralsSync(
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

  removeImportDeclaration(pendingDeletion);

  generateForContextSync(execContext, codegenContext, sourceRelPath);
}
