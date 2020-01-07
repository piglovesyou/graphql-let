import { join as pathJoin, isAbsolute } from 'path';
import { GraphQLSchema, parse, printSchema, DocumentNode } from 'graphql';
import { loadSchema } from '@graphql-toolkit/core';
import { UrlLoader } from '@graphql-toolkit/url-loader';
import { JsonFileLoader } from '@graphql-toolkit/json-file-loader';
import { GraphQLFileLoader } from '@graphql-toolkit/graphql-file-loader';
import { Types } from '@graphql-codegen/plugin-helpers';
import { ConfigTypes } from './types';

export type PartialCodegenOpts = Pick<
  Types.GenerateOptions,
  'schema' | 'config' | 'plugins' | 'pluginMap'
>;

function isURL(path: string): boolean {
  try {
    new URL(path);
    return true;
  } catch (e) {
    return false;
  }
}

async function generateSchema(
  path: string,
  cwd: string,
): Promise<DocumentNode> {
  const schemaPointer =
    isURL(path) || isAbsolute(path) ? path : pathJoin(cwd, path);
  const loadedSchema: GraphQLSchema = await loadSchema(schemaPointer, {
    loaders: [new UrlLoader(), new JsonFileLoader(), new GraphQLFileLoader()],
  });

  return parse(printSchema(loadedSchema));
}

export default async function createCodegenOpts(
  config: ConfigTypes,
  cwd: string,
): Promise<PartialCodegenOpts> {
  return {
    config: {
      withHOC: false, // True by default
      withHooks: true, // False by default
    },
    schema: await generateSchema(config.schema, cwd),
    plugins: config.plugins.map(name => ({ [name]: {} })),
    pluginMap: config.plugins.reduce((acc, name) => {
      return { ...acc, [name]: require(`@graphql-codegen/${name}`) };
    }, {}),
  };
}
