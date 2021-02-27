import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import {
  appendLiteralAndLoadCodegenContext,
  writeTiIndexForContext,
} from '../gen';
import { CodegenContext } from '../lib/types';
import {
  removeImportDeclaration,
  replaceCallExpressions,
  visitFromProgramPath,
} from '../lib2/ast';
// import { removeImportDeclaration, visitFromProgramPathDeprecated } from './ast';
import { generateForContextSync, prepareCodegenArgs } from './manip-fns';

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

  const { execContext, schemaHash } = prepareCodegenArgs(cwd);
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

  writeTiIndexForContext(execContext, codegenContext);

  generateForContextSync(execContext, codegenContext, sourceRelPath);
}
