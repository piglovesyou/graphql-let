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
  // XXX: Waiting for the fix of https://github.com/ardatan/graphql-toolkit/issues/399
  // const schemaPath =
  //   isURL(path) || isAbsolute(path) ? path : pathJoin(cwd, path);
  //
  // // TODO: Memoize building schema
  // const loadedSchema: GraphQLSchema = await loadSchema(schemaPath, {
  //   loaders: [new UrlLoader(), new JsonFileLoader(), new GraphQLFileLoader()],
  // });

  let loadedSchema: GraphQLSchema;
  if (isURL(path)) {
    loadedSchema = await loadSchema(path, { loaders: [new UrlLoader()] });
  } else if (isAbsolute(path)) {
    loadedSchema = await loadSchema(path, {
      loaders: [new JsonFileLoader(), new GraphQLFileLoader()],
    });
  } else {
    loadedSchema = await loadSchema(pathJoin(cwd, path), {
      loaders: [new JsonFileLoader(), new GraphQLFileLoader()],
    });
  }

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
