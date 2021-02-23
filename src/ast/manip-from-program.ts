import { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { CodegenContext } from '../lib/types';
import { removeImportDeclaration, visitFromProgramPath } from './ast';
import {
  generateForContextSync,
  manipulateLiterals,
  prepareCodegenArgs,
} from './manip-fns';

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

  const codegenContext: CodegenContext[] = [];
  const { execContext, schemaHash } = prepareCodegenArgs(cwd);

  manipulateLiterals(
    callExpressionPathPairs,
    execContext,
    sourceRelPath,
    schemaHash,
    codegenContext,
    programPath,
    sourceFullPath,
  );

  removeImportDeclaration(pendingDeletion);

  generateForContextSync(execContext, codegenContext, sourceRelPath);
}
