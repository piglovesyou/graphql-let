import { promises as fsPromises } from "fs";
import { loader } from 'webpack';
import { promisify } from "util";
import { default as _mkdirp } from "mkdirp";
import { getOptions } from 'loader-utils';
import path from 'path';
import { codegen } from "@graphql-codegen/core";
import * as typescriptPlugin from '@graphql-codegen/typescript';
import * as typescriptOperationsPlugin from '@graphql-codegen/typescript-operations';
import * as typescriptReactApolloPlugin from '@graphql-codegen/typescript-operations';
import genDts from "./gen-dts";
import { DocumentNode, GraphQLSchema, parse, printSchema } from "graphql";
import { loadSchema } from "graphql-toolkit";

const { writeFile } = fsPromises;
const mkdirp = promisify(_mkdirp);
const libDir = path.resolve(__dirname, '..');
const tsxBaseDir = path.join(libDir, '__generated__');

const defaultCodegenConfig = {
  config: {
    // withHOC: false,  // True by default
    withHooks: true,    // False by default
  },
  plugins: [
    { 'typescript-react-apollo': {} },
    { typescript: {} },
    { 'typescript-operations': {} },
  ],
  pluginMap: {
    typescript: typescriptPlugin,
    'typescript-operations': typescriptOperationsPlugin,
    'typescript-react-apollo': typescriptReactApolloPlugin,
  },
};

const graphlqCodegenLoader = async function (this: loader.LoaderContext, gqlContent: string) {
  const options = getOptions(this) as any;
  const callback = this.async()!;

  const { resourcePath: gqlFullPath, rootContext: userDir } = this;

  const gqlRelPath = path.relative(userDir, gqlFullPath);
  const tsxRelPath = gqlRelPath + `.tsx`;
  const tsxFullPath = path.join(tsxBaseDir, tsxRelPath);
  const dtsFullPath = `${ gqlFullPath }.d.ts`;

  // Pretend .tsx for later loaders.
  // babel-loader at least doesn't respond the .graphql extension.
  this.resourcePath = `${ gqlFullPath }.tsx`;

  // TODO: Memoize building schema
  const loadedSchema: GraphQLSchema = await loadSchema(options.schema);
  const schema: DocumentNode = parse(printSchema(loadedSchema));

  const codegenConfig = {
    ...defaultCodegenConfig,
    ...options,
    schema,
    filename: tsxFullPath,
    documents: [
      {
        filePath: gqlFullPath,
        content: parse(gqlContent),
      }
    ],
  };
  // TODO: Better error logs
  const tsxContent = await codegen(codegenConfig);
  await mkdirp(path.dirname(tsxFullPath));
  await writeFile(tsxFullPath, tsxContent);
  const dtsContent = await genDts(tsxFullPath);
  await writeFile(dtsFullPath, dtsContent);
  callback(undefined, tsxContent);
};

export default graphlqCodegenLoader;
