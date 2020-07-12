import { extname } from 'path';
import { PartialCodegenOpts } from './create-codegen-opts';
import { CreatedPaths, isURL } from './paths';
import { PRINT_PREFIX } from './print';
import { ConfigTypes } from './types';
import { processGraphQLCodegen } from './graphql-codegen';

// If it's ['!node_modules', '**/*.graphqls']
// then we want to pick '**/*.graphqls'.
function getSchemaPointerWithExtension(
  s: string | string[],
): string | undefined {
  if (typeof s === 'string') {
    if (extname(s).length) return s;
    return undefined;
  }
  return s.find((e) => require('path').extname(e).length);
}

export function shouldGenResolverTypes(config: ConfigTypes): boolean {
  if (typeof config.schema === 'string' && isURL(config.schema)) return false;

  try {
    require('@graphql-codegen/typescript');
    require('@graphql-codegen/typescript-resolvers');

    if (getSchemaPointerWithExtension(config.schema)) return true;
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
  { dtsFullPath, dtsRelPath, gqlFullPath, tsxFullPath }: CreatedPaths,
  cwd: string,
) {
  await processGraphQLCodegen({
    cwd,
    schema: gqlFullPath,
    filename: tsxFullPath,
    documents: config.documents,
    plugins: ['typescript', 'typescript-resolvers'],
    config: codegenOpts.config,
    gqlHash: schemaHash,
  });

  const schemaPathWithExtension = getSchemaPointerWithExtension(config.schema);
  if (!schemaPathWithExtension) throw new Error('never');

  return {
    schemaHash,
    tsxFullPath,
    dtsFullPath,
    dtsRelPath,
    gqlRelPath: schemaPathWithExtension,
  };
}
