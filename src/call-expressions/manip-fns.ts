import { createSchemaHashSync } from '../file-imports/schema-import';
import { processCodegenForContext } from '../lib/codegen';
import { loadConfigSync } from '../lib/config';
import { processDtsForContext } from '../lib/dts';
import createExecContext, { ExecContext } from '../lib/exec-context';
import { toSync } from '../lib/to-sync';
import { CodegenContext } from '../lib/types';
import { writeTiIndexForContext } from './handle-codegen-context';

export function prepareToManipulate(cwd: string, configFilePath?: string) {
  const [config, configHash] = loadConfigSync(cwd, configFilePath);
  const execContext = createExecContext(cwd, config, configHash);
  const schemaHash = createSchemaHashSync(execContext);
  return { execContext, schemaHash };
}

export async function generateFilesForContext(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  writeTiIndexForContext(execContext, codegenContext);
  await processCodegenForContext(execContext, codegenContext);
  await processDtsForContext(execContext, codegenContext);
}

export const generateFilesForContextSync = toSync(generateFilesForContext);
