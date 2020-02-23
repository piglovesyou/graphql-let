import { join as pathJoin, isAbsolute } from 'path';
import slash from 'slash';
import { GraphQLSchema, parse, printSchema, DocumentNode } from 'graphql';
import { CodegenContext } from '@graphql-codegen/cli';
import { Types } from '@graphql-codegen/plugin-helpers';
import { ConfigTypes } from './types';
import { isURL } from './paths';

export type PartialCodegenOpts = Pick<
  Types.GenerateOptions,
  'schema' | 'config' | 'plugins' | 'pluginMap'
>;

type MultipleSchemaPointer = { [pointer: string]: {} };

function loadSchema(
  pointer: MultipleSchemaPointer,
  respectGitIgnore: boolean,
  cwd: string,
) {
  const config: Types.Config = { cwd: slash(cwd), generates: {} };
  const extendedConfig: any = {
    ...config,
    gitignore: respectGitIgnore,
  };

  // Do shit as they do
  // https://github.com/dotansimha/graphql-code-generator/blob/d3438740d96c8c716c3af65b73f2b7f7a9e70c3d/packages/graphql-codegen-cli/src/codegen.ts#L170
  const pointerAny = pointer as any;

  return new CodegenContext({
    config: extendedConfig,
  }).loadSchema(pointerAny);
}

async function generateSchema(
  path: string | string[],
  respectGitIgnore: boolean,
  cwd: string,
): Promise<DocumentNode> {
  const schemaPointer: MultipleSchemaPointer = (Array.isArray(path)
    ? path
    : [path]
  ).reduce((acc, pointer) => {
    const p =
      isURL(pointer) || isAbsolute(pointer) ? pointer : pathJoin(cwd, pointer);
    return { ...acc, [p]: {} };
  }, {});
  const loadedSchema: GraphQLSchema = await loadSchema(
    schemaPointer,
    respectGitIgnore,
    cwd,
  );

  return parse(printSchema(loadedSchema));
}

export default async function createCodegenOpts(
  config: ConfigTypes,
  cwd: string,
): Promise<PartialCodegenOpts> {
  return {
    config: config.config,
    schema: await generateSchema(config.schema, config.respectGitIgnore, cwd),
    plugins: config.plugins.map(name => ({ [name]: {} })),
    pluginMap: config.plugins.reduce((acc, name) => {
      return { ...acc, [name]: require(`@graphql-codegen/${name}`) };
    }, {}),
  };
}
