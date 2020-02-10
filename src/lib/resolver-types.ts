import glob from 'fast-glob';
import { promises } from 'fs';
import { PartialCodegenOpts } from './create-codegen-opts';
import getHash from './hash';
import { createPaths, isURL } from './paths';
import { CommandOpts, ConfigTypes } from './types';
import { processGraphQLCodegen } from './graphql-codegen';

const { readFile } = promises;

export function shouldGenResolverTypes(
  commandOpts: CommandOpts,
  config: ConfigTypes,
) {
  if (isURL(config.schema)) return;

  try {
    require('@graphql-codegen/typescript');
    require('@graphql-codegen/typescript-resolvers');
    return true;
  } catch (e) {
    // Just skip.
    return false;
  }
}

async function getHashOfSchema(cwd: string, schemaPattern: string) {
  // Instead of concatenating all the schema content,
  // concatenating hashes for the contents to save memory.
  const hashes: string[] = [];
  for (const schemaFullPath of await glob(schemaPattern, {
    cwd,
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
  const hash = await getHashOfSchema(cwd, config.schema);
  const { tsxFullPath, gqlRelPath, dtsFullPath } = createPaths(
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

  return { tsxFullPath, dtsFullPath, gqlRelPath };
}
