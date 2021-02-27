import { processCodegenForContext } from '../lib/codegen';
import { loadConfigSync } from '../lib/config';
import { processDtsForContext } from '../lib/dts';
import createExecContext, { ExecContext } from '../lib/exec-context';
import { toSync } from '../lib/to-sync';
import { CodegenContext } from '../lib/types';
import { shouldGenResolverTypes } from '../schema-import/resolver-types';
import { createSchemaHashSync } from '../schema-import/schema-import';

// TODO: name of function
export function prepareCodegenArgs(cwd: string) {
  const [config, configHash] = loadConfigSync(cwd, undefined);
  const execContext = createExecContext(cwd, config, configHash);
  let schemaHash = configHash;
  if (shouldGenResolverTypes(config))
    schemaHash = createSchemaHashSync(execContext);
  return { execContext, schemaHash };
}

export async function generateForContext(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  await processCodegenForContext(execContext, codegenContext);
  await processDtsForContext(execContext, codegenContext);
}

export const generateForContextSync = toSync(generateForContext);
