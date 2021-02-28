import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { CodegenContext } from '../lib/types';
import {
  removeImportDeclaration,
  replaceCallExpressions,
  visitFromProgramPath,
} from './ast';
import { appendLiteralAndLoadCodegenContext } from './handle-codegen-context';
import { generateFilesForContextSync, prepareToManipulate } from './manip-fns';

export function manipulateFromProgramPath(
  cwd: string,
  programPath: NodePath<t.Program>,
  configFilePath: string | undefined,
  sourceRelPath: string,
  sourceFullPath: string,
) {
  const { callExpressionPathPairs, pendingDeletion } = visitFromProgramPath(
    programPath,
  );
  if (!callExpressionPathPairs.length) return;

  const { execContext, schemaHash } = prepareToManipulate(cwd);
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

  removeImportDeclaration(pendingDeletion);

  generateFilesForContextSync(execContext, codegenContext);
}
