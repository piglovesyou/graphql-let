import { Types } from '@graphql-codegen/plugin-helpers/types';
import { readFileSync } from 'fs';
import globby from 'globby';
import slash from 'slash';
import { ConfigTypes } from '../lib/config';
import { ExecContext } from '../lib/exec-context';
import { createHashFromBuffers, readHash } from '../lib/hash';
import { createPaths, isURL } from '../lib/paths';
import { printError } from '../lib/print';
import { CodegenContext, SchemaImportCodegenContext } from '../lib/types';

export function shouldGenResolverTypes(config: ConfigTypes): boolean {
  try {
    if (!config.schemaEntrypoint) return false;
    require('@graphql-codegen/typescript');
    require('@graphql-codegen/typescript-resolvers');
    const hasFilePointer = getSchemaPointers(config.schema!).some(
      (p) => !isURL(p),
    );
    if (!hasFilePointer) {
      printError(
        new Error(
          `To use Resolver Types, you should have at least one file in "schema".`,
        ),
      );
      return false;
    }
    return true;
  } catch (e) {
    // Just skip.
    return false;
  }
}

function getSchemaPointers(
  schema: Types.InstanceOrArray<Types.Schema>,
  _acc: string[] = [],
): string[] {
  if (typeof schema === 'string') {
    _acc.push(schema);
  } else if (Array.isArray(schema)) {
    for (const s of schema) getSchemaPointers(s, _acc);
  } else if (typeof schema === 'object') {
    for (const s of Object.keys(schema)) getSchemaPointers(s, _acc);
  }
  return _acc;
}

function prepareCreateSchemaHashArgs(execContext: ExecContext) {
  const { config, configHash, cwd } = execContext;
  const schemaPointers = getSchemaPointers(config.schema!);
  const filePointers = schemaPointers.filter((p) => !isURL(p));
  return { configHash, cwd, filePointers };
}

export async function createSchemaHash(execContext: ExecContext) {
  const { configHash, cwd, filePointers } = prepareCreateSchemaHashArgs(
    execContext,
  );

  const files = await globby(filePointers, { cwd, absolute: true });
  const contents = files
    .map(slash)
    .sort()
    .map((file) => readFileSync(file, 'utf-8'));
  return createHashFromBuffers([configHash, ...contents]);
}

export function createSchemaHashSync(execContext: ExecContext) {
  const { configHash, cwd, filePointers } = prepareCreateSchemaHashArgs(
    execContext,
  );

  const files = globby.sync(filePointers, { cwd, absolute: true });
  const contents = files
    .map(slash)
    .sort()
    .map((file) => readFileSync(file));
  return createHashFromBuffers([configHash, ...contents]);
}

export async function appendFileSchemaContext(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  const { config, configHash } = execContext;
  // To pass config change on subsequent generation,
  // configHash should be primary hash seed.
  let schemaHash = configHash;

  if (shouldGenResolverTypes(config)) {
    schemaHash = await createSchemaHash(execContext);
    const createdPaths = createPaths(execContext, config.schemaEntrypoint);

    const shouldUpdate =
      schemaHash !== readHash(createdPaths.tsxFullPath) ||
      schemaHash !== readHash(createdPaths.dtsFullPath);

    const context: SchemaImportCodegenContext = {
      ...createdPaths,
      type: 'schema-import',
      gqlHash: schemaHash,
      skip: !shouldUpdate,
    };
    codegenContext.push(context);
  }

  return { schemaHash };
}
