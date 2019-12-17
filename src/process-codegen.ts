import { codegen as graphqlCodegenCodegen } from "@graphql-codegen/core";
import { promises as fsPromises } from "fs";
import { DocumentNode, GraphQLSchema, parse, printSchema } from "graphql";
import gql from "graphql-tag";
import { loadSchema } from "graphql-toolkit";
import _mkdirp from "mkdirp";
import path from "path";
import { promisify } from "util";
import genDts from "./gen-dts";
import { PartialCodegenOpts } from "./opts";
import { ConfigTypes } from "./types";

const { writeFile } = fsPromises;
const mkdirp = promisify(_mkdirp);

export async function processCodegen(gqlContent: string, gqlFullPath: string, tsxFullPath: string, dtsFullPath: string, options: ConfigTypes, codegenOpts: PartialCodegenOpts): Promise<string> {
// TODO: Memoize building schema
  const loadedSchema: GraphQLSchema = await loadSchema(options.schema);
  const schema: DocumentNode = parse(printSchema(loadedSchema));

  const codegenConfig = {
    ...codegenOpts,
    schema,
    filename: tsxFullPath,
    documents: [
      {
        filePath: gqlFullPath,
        content: gql(gqlContent),
      }
    ],
  };
  // TODO: Better error logs
  const tsxContent = await graphqlCodegenCodegen(codegenConfig);
  await mkdirp(path.dirname(tsxFullPath));
  await writeFile(tsxFullPath, tsxContent);
  const dtsContent = await genDts(tsxFullPath);
  if (!dtsContent) throw new Error(`Generate ${dtsFullPath} fails.`);
  await writeFile(dtsFullPath, dtsContent);
  return tsxContent;
}

