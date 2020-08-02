import { extname } from 'path';
import { PartialCodegenOpts } from './create-codegen-opts';
import { ConfigTypes } from './config';
import { CreatedPaths } from './paths';
import { PRINT_PREFIX } from './print';
import { processGraphQLCodegen } from './graphql-codegen';

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
  createdPath: CreatedPaths,
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
