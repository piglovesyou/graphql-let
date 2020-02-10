import { PartialCodegenOpts } from './create-codegen-opts';
import { createPaths, isURL } from './paths';
import { printInfo } from './print';
import { CommandOpts, ConfigTypes } from './types';
import { processGraphQLCodegen } from './graphql-codegen';

export function shouldGenResolverTypes(
  commandOpts: CommandOpts,
  config: ConfigTypes,
) {
  if (commandOpts.noResolverTypes) return;
  if (isURL(config.schema)) return;

  try {
    require('@graphql-codegen/typescript');
    require('@graphql-codegen/typescript-resolvers');
    return true;
  } catch (e) {
    printInfo(`To generate schema resolver types, you have to add as deps:
 * @graphql-codegen/typescript
 * @graphql-codegen/typescript-resolvers
To suppress this message, put --no-resolver-types to your command.
`);
    return false;
  }
}

export async function processGenerateResolverTypes(
  cwd: string,
  config: ConfigTypes,
  codegenOpts: PartialCodegenOpts,
) {
  const { tsxFullPath, gqlRelPath, dtsFullPath } = createPaths(
    cwd,
    config.generateDir,
    '__concatedschema__',
    'xxx',
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
  return { tsxFullPath, dtsFullPath };
}
