import { extname, join as pathJoin } from 'path';
import { PartialCodegenOpts } from './create-codegen-opts';
import { ConfigTypes } from './config';
import { ExecContext } from './exec-context';
import { readFile, readHash } from './file';
import { createHash } from './hash';
import { createPaths } from './paths';
import { PRINT_PREFIX, updateLog } from './print';
import { processGraphQLCodegen } from './graphql-codegen';
import { CodegenContext, FileCodegenContext, FileCreatedPaths } from './types';

// Currently glob for schema is not allowed.
function isLocalFilePathWithExtension(
  s: string | Record<string, any>,
): boolean {
  if (typeof s !== 'string') return false;
  if (extname(s).length) return true;
  return false;
}

export function shouldGenResolverTypes(config: ConfigTypes): boolean {
  try {
    require('@graphql-codegen/typescript');
    require('@graphql-codegen/typescript-resolvers');

    if (isLocalFilePathWithExtension(config.schema)) return true;
    console.info(
      PRINT_PREFIX +
        'Failed to generate Resolver Types. You have to specify at least one schema (glob) path WITH an extension, such as "**/*.graphqls"',
    );
    return false;
  } catch (e) {
    // Just skip.
    return false;
  }
}

export async function processGenerateResolverTypes(
  schemaHash: string,
  config: ConfigTypes,
  codegenOpts: PartialCodegenOpts,
  createdPath: FileCreatedPaths,
  cwd: string,
): Promise<void> {
  const { gqlFullPath, tsxFullPath } = createdPath;
  await processGraphQLCodegen({
    cwd,
    schema: gqlFullPath,
    filename: tsxFullPath,
    documents: config.documents,
    plugins: ['typescript', 'typescript-resolvers'],
    config: codegenOpts.config,
    gqlHash: schemaHash,
  });

  if (!isLocalFilePathWithExtension(config.schema)) throw new Error('never');
}

export async function processResolverTypesIfNeeded(
  execContext: ExecContext,
  codegenContext: CodegenContext[],
) {
  const { cwd, config, configHash, codegenOpts } = execContext;
  // To pass config change on subsequent generation,
  // configHash should be primary hash seed.
  let schemaHash = configHash;

  if (shouldGenResolverTypes(config)) {
    const fileSchema = config.schema as string;
    const schemaFullPath = pathJoin(cwd, fileSchema);
    const content = await readFile(schemaFullPath);
    schemaHash = createHash(schemaHash + content);
    const createdPaths = createPaths(execContext, fileSchema);

    const shouldUpdate =
      schemaHash !== (await readHash(createdPaths.tsxFullPath)) ||
      schemaHash !== (await readHash(createdPaths.dtsFullPath));

    const context: FileCodegenContext = {
      ...createdPaths,
      gqlHash: schemaHash,
      dtsContentDecorator: (s) => {
        return `${s}
          
// This is an extra code in addition to what graphql-codegen makes.
// Users are likely to use 'graphql-tag/loader' with 'graphql-tag/schema/loader'
// in webpack. This code enables the result to be typed.
import { DocumentNode } from 'graphql'
export default typeof DocumentNode
`;
      },
      skip: !shouldUpdate,
    };
    codegenContext.push(context);

    if (shouldUpdate) {
      // We don't delete tsxFullPath and dtsFullPath here because:
      // 1. We'll overwrite them so deleting is not necessary
      // 2. Windows throws EPERM error for the deleting and creating file process.

      updateLog(
        `Local schema files are detected. Generating resolver types...`,
      );

      await processGenerateResolverTypes(
        schemaHash,
        config,
        codegenOpts,
        createdPaths,
        cwd,
      );
    }
  }
  return { schemaHash };
}
