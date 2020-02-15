import { extname } from 'path';
import glob from 'globby';
import slash from 'slash';
import { promises } from 'fs';
import { PartialCodegenOpts } from './create-codegen-opts';
import getHash from './hash';
import { createPaths, isURL } from './paths';
import { PRINT_PREFIX } from './print';
import { CommandOpts, ConfigTypes } from './types';
import { processGraphQLCodegen } from './graphql-codegen';

const { readFile } = promises;

// If it's ['!node_modules', '**/*.graphqls']
// then we want to pick '**/*.graphqls'.
function getSchemaPointerWithExtension(
  s: string | string[],
): string | undefined {
  if (typeof s === 'string') {
    if (extname(s).length) return s;
    return undefined;
  }
  return s.find(e => require('path').extname(e).length);
}

export function shouldGenResolverTypes(
  commandOpts: CommandOpts,
  config: ConfigTypes,
): boolean {
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

async function getHashOfSchema(
  cwd: string,
  schemaPattern: string | string[],
  respectGitIgnore: boolean,
) {
  // Instead of concatenating all the schema content,
  // concatenating hashes for the contents to save memory.
  const hashes: string[] = [];
  for (const schemaFullPath of await glob(schemaPattern, {
    cwd: slash(cwd),
    gitignore: respectGitIgnore,
    absolute: true,
  })) {
    const content = await readFile(schemaFullPath);
    hashes.push(getHash(content));
  }
  return getHash(hashes.join(''));
}

export async function processGenerateResolverTypes(
  cwd: string,
  config: ConfigTypes,
  codegenOpts: PartialCodegenOpts,
) {
  const hash = await getHashOfSchema(
    cwd,
    config.schema,
    config.respectGitIgnore,
  );
  const { tsxFullPath, dtsFullPath, gqlRelPath } = createPaths(
    cwd,
    config.generateDir,
    '__concatedschema__',
    hash,
  );

  await processGraphQLCodegen(
    {
      ...codegenOpts,
      pluginMap: {
        '@graphql-codegen/typescript': require('@graphql-codegen/typescript'),
        '@graphql-codegen/typescript-resolvers': require('@graphql-codegen/typescript-resolvers'),
      },
      plugins: [
        { '@graphql-codegen/typescript': {} },
        { '@graphql-codegen/typescript-resolvers': {} },
      ],
    },
    tsxFullPath,
    gqlRelPath,
    '',
  );

  const schemaPathWithExtension = getSchemaPointerWithExtension(config.schema);
  if (!schemaPathWithExtension) throw new Error('never');

  return { tsxFullPath, dtsFullPath, gqlRelPath: schemaPathWithExtension };
}
