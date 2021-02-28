import {
  createSchemaHashSync,
  shouldGenResolverTypes,
} from '../file-imports/schema-import';
import { processCodegenForContext } from '../lib/codegen';
import { loadConfigSync } from '../lib/config';
import { processDtsForContext } from '../lib/dts';
import createExecContext, { ExecContext } from '../lib/exec-context';
import { toSync } from '../lib/to-sync';
import { CodegenContext } from '../lib/types';

export function prepareToManipulate(cwd: string) {
  const [config, configHash] = loadConfigSync(cwd, undefined);
  const execContext = createExecContext(cwd, config, configHash);
  let schemaHash = configHash;
  if (shouldGenResolverTypes(config))
    schemaHash = createSchemaHashSync(execContext);
  return { execContext, schemaHash };
}

export async function generateFilesForContext(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  await processCodegenForContext(execContext, codegenContext);
  await processDtsForContext(execContext, codegenContext);
}

export const generateFilesForContextSync = toSync(generateFilesForContext);
